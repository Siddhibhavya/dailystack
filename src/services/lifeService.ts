import { changed, metadata, TABLES, type ActivitySegment, type LegacyTimer, type Task } from '../domain/models';
import type { Repository, Write } from '../data/repository';
import { captureLegacy, migrateLegacy, MIGRATION_ID } from './migration';
export type ActiveTimer = LegacyTimer | { segmentId: string } | null;
export class LifeService {
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('my-life-changes') : null;
  constructor(private readonly repo: Repository, readonly deviceId: string, private readonly storage: Pick<Storage, 'getItem'>) {
    if (this.channel) this.channel.onmessage = () => this.notify(false);
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  close() { this.channel?.close(); }
  private notify(broadcast = true) { for (const listener of this.listeners) listener(); if (broadcast) this.channel?.postMessage('changed'); }
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  async snapshot() {
    const [tasks, activities, active, projects] = await Promise.all([this.repo.list('tasks'), this.repo.list('activities'), this.repo.get('meta', 'activeTimer'), this.repo.list('projects')]);
    return { tasks: tasks.filter(t => !t.deletedAt), activities: activities.filter(a => !a.deletedAt), active: (active?.value ?? null) as ActiveTimer, projects: projects.filter(p => !p.deletedAt) };
  }
  async migrationNeeded() { return (await this.repo.get('meta', MIGRATION_ID))?.value !== 'verified' && (this.storage.getItem('dailystack_widget_todos') !== null || this.storage.getItem('dailystack_active_timer') !== null); }
  legacyBackup() { return captureLegacy(this.storage); }
  async migrationBackup() { return await this.repo.get('backups', MIGRATION_ID) ?? this.legacyBackup(); }
  migrate() { return this.run(async () => { const count = await migrateLegacy(this.repo, this.legacyBackup(), this.deviceId); this.notify(); return count; }); }
  async exportBackup() {
    const records = Object.fromEntries(await Promise.all(TABLES.map(async table => [table, await this.repo.list(table)])));
    return { format: 'my-life-backup', schemaVersion: 1, exportedAt: new Date().toISOString(), legacy: this.legacyBackup(), records };
  }
  addTask(title: string) { return this.run(async () => {
    if (!title.trim()) return;
    const task: Task = { ...metadata(this.deviceId), title: title.trim(), completed: false, notes: '', priority: false, important: false, legacyElapsedSeconds: 0 };
    await this.repo.commit([{ table: 'tasks', value: task }]); this.notify();
  }); }
  private async task(id: string) { const task = await this.repo.get('tasks', id); if (!task || task.deletedAt) throw new Error('This task is no longer available.'); return task; }
  private timerKey(active: ActiveTimer): string | null { return active && ('legacy' in active ? `legacy:${active.taskId}:${active.startedAt}` : active.segmentId); }
  private async stopWrites(active: ActiveTimer, now: string): Promise<Write[]> {
    if (!active) return [];
    if ('legacy' in active) {
      const task = await this.task(active.taskId);
      // Keep old running time as legacy time; never invent a historical activity segment.
      return [{ table: 'tasks', value: changed({ ...task, legacyElapsedSeconds: task.legacyElapsedSeconds + Math.max(0, (Date.parse(now) - active.startedAt) / 1000) }, this.deviceId) }];
    }
    const segment = await this.repo.get('activities', active.segmentId);
    if (!segment || segment.endTime || segment.deletedAt) throw new Error('The active timer is inconsistent. Export a backup before recovery.');
    return [{ table: 'activities', value: changed({ ...segment, endTime: new Date(Math.max(Date.parse(segment.startTime), Date.parse(now))).toISOString() }, this.deviceId) }];
  }
  editTask(id: string, edits: Partial<Pick<Task, 'title' | 'priority'>>) { return this.run(async () => {
    const task = await this.task(id);
    if (edits.title !== undefined && !edits.title.trim()) throw new Error('Give the task a title.');
    await this.repo.commit([{ table: 'tasks', value: changed({ ...task, ...edits }, this.deviceId) }]); this.notify();
  }); }
  toggleTimer(id: string) { return this.run(async () => {
    const task = await this.task(id);
    if (task.completed) throw new Error('Reopen this task before starting its timer.');
    const active = ((await this.repo.get('meta', 'activeTimer'))?.value ?? null) as ActiveTimer;
    const now = new Date().toISOString();
    const writes = await this.stopWrites(active, now);
    const currentTask = active && ('legacy' in active ? active.taskId : (await this.repo.get('activities', active.segmentId))?.taskId);
    let next: ActiveTimer = null;
    if (currentTask !== id) {
      const segment: ActivitySegment = { ...metadata(this.deviceId, now), source: 'timer', taskId: id, projectId: task.projectId, title: task.title, startTime: now, endTime: null };
      writes.push({ table: 'activities', value: segment }); next = { segmentId: segment.id };
    }
    writes.push({ table: 'meta', value: { id: 'activeTimer', value: next } });
    await this.repo.commitTimer(writes, this.timerKey(active)); this.notify();
  }); }
  setCompleted(id: string, remove = false) { return this.run(async () => {
    const task = await this.task(id);
    const active = ((await this.repo.get('meta', 'activeTimer'))?.value ?? null) as ActiveTimer;
    const currentTask = active && ('legacy' in active ? active.taskId : (await this.repo.get('activities', active.segmentId))?.taskId);
    const writes = currentTask === id ? await this.stopWrites(active, new Date().toISOString()) : [];
    const timerTaskWrite = writes.find(w => w.table === 'tasks');
    const base = timerTaskWrite?.table === 'tasks' ? timerTaskWrite.value : task;
    writes.push({ table: 'tasks', value: changed({ ...base, completed: remove ? task.completed : !task.completed, deletedAt: remove ? new Date().toISOString() : null }, this.deviceId) });
    if (currentTask === id) writes.push({ table: 'meta', value: { id: 'activeTimer', value: null } });
    await this.repo.commitTimer(writes, this.timerKey(active)); this.notify();
  }); }
}
export async function createLifeService(repo: Repository, storage: Pick<Storage, 'getItem'>) {
  const existing = await repo.get('meta', 'deviceId');
  const deviceId = typeof existing?.value === 'string' ? existing.value : crypto.randomUUID();
  if (!existing) await repo.commitOnce([{ table: 'meta', value: { id: 'deviceId', value: deviceId } }], 'deviceId');
  return new LifeService(repo, String((await repo.get('meta', 'deviceId'))!.value), storage);
}
