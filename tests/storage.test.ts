import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbRepository } from '../src/data/indexedDb';
import { createLifeService, type LifeService } from '../src/services/lifeService';
import { captureLegacy, migrateLegacy, validateLegacy, MIGRATION_ID, TASKS_KEY, TIMER_KEY } from '../src/services/migration';
import { elapsedSeconds } from '../src/domain/models';
import type { Repository } from '../src/data/repository';
let repo: IndexedDbRepository;
let life: LifeService;
let values: Map<string, string>;
const storage = { getItem: (key: string) => values.get(key) ?? null };
beforeEach(async () => {
  values = new Map(); repo = await IndexedDbRepository.open(`test-${crypto.randomUUID()}`);
  life = await createLifeService(repo, storage);
});
afterEach(() => { life.close(); repo.close(); vi.useRealTimers(); });
function seed(timer = false) {
  values.set(TASKS_KEY, JSON.stringify([{ id: 10, text: 'Presentation', done: false, elapsedSeconds: 91.5 }, { id: 11, text: 'Book', completed: true, elapsedSeconds: 4 }]));
  if (timer) values.set(TIMER_KEY, JSON.stringify({ id: 10, startedAt: Date.now() - 30_000 }));
}
describe('versioned localStorage migration', () => {
  it('backs up exact original strings, preserves task fields, assigns UUIDs, and fabricates no segments', async () => {
    seed(); const original = values.get(TASKS_KEY);
    expect(await life.migrationNeeded()).toBe(true); expect(await life.migrate()).toBe(2);
    const tasks = await repo.list('tasks');
    expect(tasks.find(t => t.legacyId === 10)).toMatchObject({ title: 'Presentation', completed: false, legacyElapsedSeconds: 91.5, syncStatus: 'pending', version: 1 });
    expect(tasks.find(t => t.legacyId === 11)?.completed).toBe(true);
    expect(tasks.every(t => /^[0-9a-f-]{36}$/.test(t.id))).toBe(true);
    expect(await repo.list('activities')).toEqual([]);
    expect((await repo.get('backups', MIGRATION_ID))?.tasksRaw).toBe(original);
    expect(values.get(TASKS_KEY)).toBe(original);
    expect(await life.migrationNeeded()).toBe(false);
    expect(await life.migrate()).toBe(0); expect(await repo.list('tasks')).toHaveLength(2);
  });
  it('retains malformed data and its backup without importing any task', async () => {
    values.set(TASKS_KEY, '{broken');
    await expect(life.migrate()).rejects.toThrow();
    expect(await repo.list('tasks')).toHaveLength(0);
    expect(values.get(TASKS_KEY)).toBe('{broken');
    expect((await repo.get('backups', MIGRATION_ID))?.tasksRaw).toBe('{broken');
    expect(await repo.get('meta', MIGRATION_ID)).toBeUndefined();
  });
  it('rejects duplicates, negative elapsed time, and orphan timers', () => {
    seed(); const backup = captureLegacy(storage);
    expect(() => validateLegacy({ ...backup, tasksRaw: JSON.stringify([{ id: 1, text: 'A', done: false }, { id: 1, text: 'B', done: false }]) })).toThrow('Duplicate');
    expect(() => validateLegacy({ ...backup, tasksRaw: JSON.stringify([{ id: 1, text: 'A', done: false, elapsedSeconds: -1 }]) })).toThrow('invalid');
    expect(() => validateLegacy({ ...backup, timerRaw: JSON.stringify({ id: 999, startedAt: Date.now() }) })).toThrow('timer');
  });
  it('can retry after a save failure without touching legacy data', async () => {
    seed(); const original = captureLegacy(storage);
    const failing: Repository = { get: repo.get.bind(repo), list: repo.list.bind(repo), commit: repo.commit.bind(repo), commitTimer: repo.commitTimer.bind(repo), commitOnce: async () => { throw new Error('disk full'); } };
    await expect(migrateLegacy(failing, original, life.deviceId)).rejects.toThrow('disk full');
    expect(await repo.list('tasks')).toHaveLength(0); expect(values.get(TASKS_KEY)).toBe(original.tasksRaw);
    await life.migrate(); expect(await repo.list('tasks')).toHaveLength(2);
  });
  it('does not duplicate tasks when two tabs import at the same time', async () => {
    seed(); await Promise.all([migrateLegacy(repo, captureLegacy(storage), life.deviceId), migrateLegacy(repo, captureLegacy(storage), life.deviceId)]);
    expect(await repo.list('tasks')).toHaveLength(2);
  });
  it('resumes verification after an interrupted import', async () => {
    seed(); await life.migrate(); await repo.commit([{ table: 'meta', value: { id: MIGRATION_ID, value: 'imported' } }]);
    await life.migrate(); expect(await repo.list('tasks')).toHaveLength(2);
    expect((await repo.get('meta', MIGRATION_ID))?.value).toBe('verified');
  });
});
describe('timers and activity sessions', () => {
  it('preserves a legacy running timer without inventing a historical segment', async () => {
    seed(true); await life.migrate(); const task = (await repo.list('tasks')).find(t => t.legacyId === 10)!;
    const originalTimer = values.get(TIMER_KEY);
    expect((await life.snapshot()).active).toMatchObject({ legacy: true, taskId: task.id });
    await life.toggleTimer(task.id);
    expect((await repo.get('tasks', task.id))!.legacyElapsedSeconds).toBeGreaterThanOrEqual(121.5);
    expect(await repo.list('activities')).toHaveLength(0); expect(values.get(TIMER_KEY)).toBe(originalTimer);
    await life.toggleTimer(task.id); expect(await repo.list('activities')).toHaveLength(1);
  });
  it('records separate sessions, persists across service recreation, and stops on completion', async () => {
    await life.addTask('Draw'); const task = (await life.snapshot()).tasks[0];
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    await life.toggleTimer(task.id); vi.setSystemTime(new Date('2026-09-30T10:01:00Z')); await life.toggleTimer(task.id);
    await life.toggleTimer(task.id); vi.setSystemTime(new Date('2026-09-30T10:03:00Z'));
    life.close(); life = await createLifeService(repo, storage);
    expect((await life.snapshot()).active).not.toBeNull();
    await life.setCompleted(task.id);
    const data = await life.snapshot(); expect(data.active).toBeNull(); expect(data.tasks[0].completed).toBe(true);
    expect(data.activities).toHaveLength(2); expect(data.activities.every(s => s.endTime !== null)).toBe(true);
    expect(elapsedSeconds(data.tasks[0], data.activities)).toBe(180);
  });
  it('switches timers atomically and preserves session history when a task is removed', async () => {
    await life.addTask('One'); await life.addTask('Two'); const tasks = (await life.snapshot()).tasks;
    await life.toggleTimer(tasks[0].id); await life.toggleTimer(tasks[1].id);
    expect((await repo.list('activities')).filter(s => !s.endTime)).toHaveLength(1);
    await life.setCompleted(tasks[1].id, true);
    expect((await life.snapshot()).active).toBeNull(); expect((await life.snapshot()).tasks).toHaveLength(1);
    expect((await repo.get('tasks', tasks[1].id))?.deletedAt).not.toBeNull(); expect(await repo.list('activities')).toHaveLength(2);
  });
  it('rejects a timer update with a stale tab snapshot', async () => {
    await life.addTask('One'); const task = (await life.snapshot()).tasks[0]; await life.toggleTimer(task.id);
    await expect(repo.commitTimer([{ table: 'meta', value: { id: 'activeTimer', value: null } }], null)).rejects.toThrow('another tab');
    expect((await life.snapshot()).active).not.toBeNull();
  });
  it('exports local records and tombstones without OAuth configuration', async () => {
    await life.addTask('One'); const task = (await life.snapshot()).tasks[0]; await life.setCompleted(task.id, true);
    const backup = await life.exportBackup(); expect(backup.records.tasks).toHaveLength(1);
    expect(JSON.stringify(backup)).not.toContain('dailystack_cal_client_id');
  });
});
