import { metadata, type RecoveryBackup, type Task, type LegacyTimer } from '../domain/models';
import type { Repository, Write } from '../data/repository';
export const MIGRATION_ID = 'localStorage-tasks-v1';
export const TASKS_KEY = 'dailystack_widget_todos';
export const TIMER_KEY = 'dailystack_active_timer';
interface LegacyTask { id: string | number; text: string; done: boolean; elapsedSeconds: number }
export function captureLegacy(storage: Pick<Storage, 'getItem'>): RecoveryBackup {
  return { id: MIGRATION_ID, capturedAt: new Date().toISOString(), tasksRaw: storage.getItem(TASKS_KEY), timerRaw: storage.getItem(TIMER_KEY) };
}
export function validateLegacy(backup: RecoveryBackup): { tasks: LegacyTask[]; timer: { id: string | number; startedAt: number } | null } {
  const parsed: unknown = backup.tasksRaw === null ? [] : JSON.parse(backup.tasksRaw);
  if (!Array.isArray(parsed)) throw new Error('Legacy tasks are not a list. Export a recovery copy before correcting the original data.');
  const ids = new Set<string>();
  const tasks = parsed.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('A legacy task is invalid. Original data has been kept.');
    const t = item as Record<string, unknown>;
    const done = t.done ?? t.completed ?? false;
    const elapsed = t.elapsedSeconds ?? 0;
    if (!['string', 'number'].includes(typeof t.id) || typeof t.text !== 'string' || !t.text.trim() || typeof done !== 'boolean' || typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0) throw new Error('A legacy task is invalid. Original data has been kept.');
    const key = `${typeof t.id}:${t.id}`;
    if (ids.has(key)) throw new Error('Duplicate legacy task IDs. Original data has been kept.');
    ids.add(key);
    return { id: t.id as string | number, text: t.text, done, elapsedSeconds: elapsed };
  });
  const timer = backup.timerRaw === null ? null : JSON.parse(backup.timerRaw);
  if (timer && (!Number.isFinite(timer.startedAt) || timer.startedAt > Date.now() || !tasks.some(t => t.id === timer.id && !t.done))) throw new Error('The legacy timer is invalid or has no unfinished task. Original data has been kept.');
  return { tasks, timer };
}
export async function migrateLegacy(repo: Repository, snapshot: RecoveryBackup, deviceId: string): Promise<number> {
  const existing = await repo.get('meta', MIGRATION_ID);
  if (existing?.value === 'verified') return 0;
  const original = await repo.get('backups', MIGRATION_ID) ?? snapshot;
  // Save exact original strings before any migration writes, including invalid input.
  await repo.commit([{ table: 'backups', value: original }]);
  const { tasks, timer } = validateLegacy(original);
  let imported = (await repo.list('tasks')).filter(t => t.legacyId !== undefined);
  if (existing?.value !== 'imported') {
    imported = tasks.map(t => ({ ...metadata(deviceId), title: t.text, completed: t.done, notes: '', priority: false, important: false, legacyElapsedSeconds: t.elapsedSeconds, legacyId: t.id }));
    const writes: Write[] = imported.map(value => ({ table: 'tasks', value }));
    if (timer) {
      const task = imported.find(t => t.legacyId === timer.id)!;
      const value: LegacyTimer = { taskId: task.id, startedAt: timer.startedAt, legacy: true };
      writes.push({ table: 'meta', value: { id: 'activeTimer', value } });
    }
    writes.push({ table: 'meta', value: { id: MIGRATION_ID, value: 'imported' } });
    const applied = await repo.commitOnce(writes, MIGRATION_ID);
    if (!applied) imported = (await repo.list('tasks')).filter(t => t.legacyId !== undefined);
  }
  for (const old of tasks) {
    const task = imported.find(t => t.legacyId === old.id);
    const saved: Task | undefined = task && await repo.get('tasks', task.id);
    if (!saved || saved.title !== old.text || saved.completed !== old.done || saved.legacyElapsedSeconds !== old.elapsedSeconds) throw new Error('Migration verification failed. Recovery copy and original localStorage are preserved.');
  }
  if (timer) {
    const active = (await repo.get('meta', 'activeTimer'))?.value as LegacyTimer | undefined;
    const task = imported.find(t => t.legacyId === timer.id);
    if (!active?.legacy || active.taskId !== task?.id || active.startedAt !== timer.startedAt) throw new Error('Timer migration verification failed. Original data is preserved.');
  }
  await repo.commit([{ table: 'meta', value: { id: MIGRATION_ID, value: 'verified' } }]);
  return tasks.length;
}
