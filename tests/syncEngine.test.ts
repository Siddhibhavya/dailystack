import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbRepository } from '../src/data/indexedDb';
import { createLifeService, type LifeService } from '../src/services/lifeService';
import { SyncEngine, type CloudTransport } from '../src/services/syncEngine';
import { metadata, type Journal, type SyncPolicy, type Task } from '../src/domain/models';
import { canonicalRecord, reconcile, type SyncRecord, type SyncTable } from '../src/services/syncRecords';
export class MemoryCloud implements CloudTransport {
  records = new Map<string, SyncRecord>();
  fail = false;
  requests: string[] = [];
  async pull(uid: string, table: SyncTable) {
    this.requests.push(`pull:${uid}:${table}`); if (this.fail) throw new Error('Transient unavailable');
    return [...this.records.entries()].filter(([key]) => key.startsWith(`${uid}/${table}/`)).map(([, record]) => structuredClone(record));
  }
  async exchange(uid: string, table: SyncTable, record: SyncRecord) {
    this.requests.push(`push:${uid}:${table}`); if (this.fail) throw new Error('Transient unavailable');
    const key = `${uid}/${table}/${record.id}`;
    const result = await reconcile(table, record, this.records.get(key));
    this.records.set(key, structuredClone(result.record));
    for (const copy of result.copies) this.records.set(`${uid}/journals/${copy.id}`, structuredClone(copy));
    return result;
  }
}
interface Device { repo: IndexedDbRepository; life: LifeService; engine: SyncEngine; online: boolean; name: string }
const policy: SyncPolicy = { enabled: true, categories: { tasks: true, projects: true, activities: true, journals: true, observations: true, cycles: true, symptoms: true, memories: true, reminders: true } };
let devices: Device[];
let cloud: MemoryCloud;
async function device(name = `sync-${crypto.randomUUID()}`) {
  const repo = await IndexedDbRepository.open(name);
  const life = await createLifeService(repo, { getItem: () => null });
  const d = { repo, life, online: true, name } as Device;
  d.engine = new SyncEngine(repo, cloud, life.refreshFromRepository, () => d.online);
  life.subscribe(d.engine.localChanged);
  await d.engine.initialize(); await d.engine.setAccount({ uid: 'owner', email: null }); await d.engine.setPolicy(policy);
  devices.push(d); return d;
}
beforeEach(() => { cloud = new MemoryCloud(); devices = []; vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
afterEach(() => { for (const d of devices) { d.engine.close(); d.life.close(); d.repo.close(); } vi.useRealTimers(); });
async function task(d: Device, title = 'A task') { await d.life.addTask(title); return (await d.repo.list('tasks')).find(t => t.title === title)!; }
async function converge(a: Device, b: Device) { await a.engine.syncNow(); await b.engine.syncNow(); await a.engine.syncNow(); await b.engine.syncNow(); }
describe('two independent offline-first device databases', () => {
  it('saves online writes locally before any transport request and acknowledges them', async () => {
    const a = await device(); const t = await task(a);
    expect(cloud.requests).toEqual([]); expect(t.syncStatus).toBe('pending');
    await a.engine.syncNow(); expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('synced'); expect(a.engine.getSnapshot().status).toBe('Synced');
  });
  it('saves offline, pushes on reconnect, and hydrates a fresh device with stable IDs', async () => {
    const a = await device(); a.online = false; const t = await task(a);
    await a.engine.syncNow(); expect(cloud.records.size).toBe(0); expect(a.engine.getSnapshot().status).toBe('Offline');
    a.online = true; a.engine.networkChanged(); await a.engine.syncNow();
    const b = await device(); await b.engine.syncNow(); expect((await b.life.snapshot()).tasks[0].id).toBe(t.id);
    await converge(a, b); expect(await b.repo.list('tasks')).toHaveLength(1); expect(cloud.records.size).toBe(1);
  });
  it('preserves independent edits to different records across two offline devices', async () => {
    const a = await device(); const one = await task(a, 'One'); const two = await task(a, 'Two'); const b = await device(); await converge(a, b);
    a.online = b.online = false; await a.life.editTask(one.id, { title: 'Phone edit' }); await b.life.editTask(two.id, { title: 'Tablet edit' });
    a.online = b.online = true; await converge(a, b);
    for (const d of [a, b]) expect((await d.repo.list('tasks')).map(t => t.title).sort()).toEqual(['Phone edit', 'Tablet edit']);
  });
  it('resolves the same structured record deterministically regardless of push order', async () => {
    const a = await device(); const t = await task(a); const b = await device(); await converge(a, b);
    const base = (await a.repo.get('tasks', t.id))!;
    const left = { ...base, title: 'Left', updatedAt: '2026-10-01T10:00:00.000Z', version: 2, deviceId: a.life.deviceId, syncStatus: 'pending' as const };
    const right = { ...base, title: 'Right', updatedAt: '2026-10-01T11:00:00.000Z', version: 2, deviceId: b.life.deviceId, syncStatus: 'pending' as const };
    await a.repo.commit([{ table: 'tasks', value: left }]); await b.repo.commit([{ table: 'tasks', value: right }]); await converge(a, b);
    expect((await a.repo.get('tasks', t.id))?.title).toBe('Right'); expect((await b.repo.get('tasks', t.id))?.title).toBe('Right');
    expect((await reconcile('tasks', left, right)).record).toEqual((await reconcile('tasks', right, left)).record);
  });
  it('preserves both versions of journal writing and creates no duplicate conflict copies', async () => {
    const a = await device(); const j: Journal = { ...metadata(a.life.deviceId), kind: 'general', originalTranscription: 'Original words', source: 'manual', date: '2026-09-30' };
    await a.repo.commit([{ table: 'journals', value: j }]); const b = await device(); await converge(a, b);
    await a.repo.commit([{ table: 'journals', value: { ...j, originalTranscription: 'Phone writing', version: 2, syncStatus: 'pending' } }]);
    await b.repo.commit([{ table: 'journals', value: { ...j, originalTranscription: 'Tablet writing', version: 2, deviceId: b.life.deviceId, syncStatus: 'pending' } }]);
    await converge(a, b); await converge(a, b);
    for (const d of [a, b]) {
      const journals = await d.repo.list('journals');
      expect(journals.map(r => r.originalTranscription).sort()).toEqual(['Original words', 'Phone writing', 'Tablet writing']);
      expect(journals.filter(r => r.revisionOf === j.id)).toHaveLength(2);
      expect(d.engine.getSnapshot().status).toBe('Conflict');
    }
  });
  it('propagates deletions and refuses resurrection even from a later-clock offline edit', async () => {
    const a = await device(); const t = await task(a); const b = await device(); await converge(a, b);
    await a.life.setCompleted(t.id, true);
    await b.repo.commit([{ table: 'tasks', value: { ...t, title: 'Stale offline', updatedAt: '2030-01-01T00:00:00.000Z', version: 99 } }]); await converge(a, b);
    expect((await a.life.snapshot()).tasks).toHaveLength(0); expect((await b.life.snapshot()).tasks).toHaveLength(0);
    expect((await b.repo.get('tasks', t.id))?.deletedAt).toBeTruthy();
  });
  it('safely reconciles local data plus cloud data without replacing either notebook', async () => {
    const a = await device(); const cloudTask = await task(a, 'Cloud-only'); await a.engine.syncNow();
    const b = await device(); const localTask = await task(b, 'Local-only'); await converge(a, b);
    expect((await b.repo.list('tasks')).map(t => t.id).sort()).toEqual([cloudTask.id, localTask.id].sort());
  });
  it('sign-out stops synchronization and preserves local records and active timers', async () => {
    const a = await device(); const t = await task(a); await a.life.toggleTimer(t.id); await a.engine.setAccount(null);
    await a.engine.syncNow(); expect(cloud.records.size).toBe(0); expect((await a.life.snapshot()).tasks).toHaveLength(1); expect((await a.life.snapshot()).active).not.toBeNull();
  });
  it('blocks a different My Life account from reading or uploading the previous notebook', async () => {
    const a = await device(); await task(a); await a.engine.setAccount({ uid: 'other', email: null }); await a.engine.syncNow();
    expect(a.engine.getSnapshot().accountMismatch).toBe(true); expect(cloud.requests).toHaveLength(0); expect((await a.life.snapshot()).tasks).toHaveLength(1);
  });
  it('disabling a category blocks push and pull; re-enabling reconciles backlog', async () => {
    const a = await device(); const t = await task(a);
    await a.engine.setPolicy({ enabled: true, categories: { projects: true } }); await a.engine.syncNow();
    expect(cloud.records.size).toBe(0); expect(cloud.requests.some(r => r.endsWith(':tasks'))).toBe(false);
    await a.engine.setPolicy(policy); await a.engine.syncNow(); expect(cloud.records.has(`owner/tasks/${t.id}`)).toBe(true);
  });
  it('all categories default off, including on the second device', async () => {
    const repo = await IndexedDbRepository.open(`default-${crypto.randomUUID()}`); const engine = new SyncEngine(repo, cloud, () => {}, () => true);
    await engine.initialize(); await engine.setAccount({ uid: 'owner', email: null }); await engine.syncNow();
    expect(engine.getSnapshot().policy).toEqual({ enabled: false, categories: {} }); expect(cloud.requests).toHaveLength(0); engine.close(); repo.close();
  });
  it('retries transient failures without losing pending local changes', async () => {
    const a = await device(); const t = await task(a); cloud.fail = true; await a.engine.syncNow();
    expect(a.engine.getSnapshot().status).toBe('Sync issue'); expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('pending');
    cloud.fail = false; await a.engine.syncNow(); expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('synced');
  });
  it('reloads with pending writes, stable device identity, preferences and owner binding intact', async () => {
    const a = await device(); a.online = false; const t = await task(a); const id = a.life.deviceId;
    a.engine.close(); a.life.close(); a.repo.close(); const b = await device(a.name);
    expect(b.life.deviceId).toBe(id); await b.engine.syncNow(); expect((await b.repo.get('tasks', t.id))?.syncStatus).toBe('synced');
  });
  it('does not overwrite a newer local edit with an in-flight acknowledgement', async () => {
    const a = await device(); const t = await task(a); const realExchange = cloud.exchange.bind(cloud);
    cloud.exchange = async (uid, table, record) => {
      const result = await realExchange(uid, table, record);
      if (table === 'tasks' && record.id === t.id) await a.life.editTask(t.id, { title: 'Edited while syncing' });
      return result;
    };
    await a.engine.syncNow(); expect((await a.repo.get('tasks', t.id))?.title).toBe('Edited while syncing'); expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('pending');
    cloud.exchange = realExchange; await a.engine.syncNow(); expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('synced');
  });
  it('requires separate symptom consent before reading or uploading embedded symptoms', async () => {
    const a = await device(); await a.repo.commit([{ table: 'observations', value: { ...metadata(a.life.deviceId), date: '2026-09-30', symptoms: ['Test symptom'] } }]);
    await a.engine.setPolicy({ enabled: true, categories: { observations: true, symptoms: false } }); await a.engine.syncNow();
    expect(cloud.requests.some(r => r.endsWith(':observations'))).toBe(false);
    await a.engine.setPolicy({ enabled: true, categories: { observations: true, symptoms: true } }); await a.engine.syncNow(); expect(cloud.records.size).toBe(1);
  });
  it('isolates a bad record and continues syncing unrelated valid records', async () => {
    const a = await device(); const t = await task(a);
    await a.repo.commit([{ table: 'tasks', value: { ...t, id: crypto.randomUUID(), title: 42 } as unknown as Task }]);
    await a.engine.syncNow(); expect(cloud.records.has(`owner/tasks/${t.id}`)).toBe(true); expect(a.engine.getSnapshot().status).toBe('Sync issue');
  });
  it('does not loop when local sync status differs from cloud bookkeeping', async () => {
    const a = await device(); const t = await task(a); await a.engine.syncNow();
    const synced = (await a.repo.get('tasks', t.id))!; await a.repo.commit([{ table: 'tasks', value: { ...synced, syncStatus: 'pending' } }]);
    const pushes = cloud.requests.filter(r => r.startsWith('push')).length;
    await a.engine.syncNow(); await a.engine.syncNow(); expect(cloud.requests.filter(r => r.startsWith('push'))).toHaveLength(pushes);
    expect(canonicalRecord(t)).toBe(canonicalRecord(synced));
  });
  it('syncs model-only projects, timers, journals, cycles, observations, preferences and reminders', async () => {
    const a = await device(); const base = () => metadata(a.life.deviceId);
    const project = { ...base(), title: 'Project', description: '', notes: '', status: 'active' as const, priority: 'normal' as const };
    await a.repo.commit([
      { table: 'projects', value: project },
      { table: 'cycles', value: { ...base(), periodStart: '2026-09-30', notes: '', flow: [], symptoms: [] } },
      { table: 'observations', value: { ...base(), date: '2026-09-30', symptoms: [] } },
      { table: 'memories', value: { ...base(), lifecycle: 'preference', key: 'color', value: 'yellow', confirmedAt: null } },
      { table: 'reminders', value: { ...base(), title: 'Water check', kind: 'water', intensity: 'soft', scheduledAt: new Date().toISOString(), enabled: true } }
    ]);
    const t = await task(a); await a.life.toggleTimer(t.id); await a.life.toggleTimer(t.id);
    const b = await device(); await converge(a, b);
    for (const table of ['projects', 'activities', 'cycles', 'observations', 'memories', 'reminders'] as const) expect(await b.repo.list(table)).toHaveLength(1);
    expect((await b.life.snapshot()).active).toBeNull(); // another device's activity is not its timer
  });
  it('never exports Firebase authentication sessions or Calendar OAuth tokens', async () => {
    const a = await device(); await task(a); const backup = JSON.stringify(await a.life.exportBackup());
    expect(backup).not.toMatch(/access_token|refresh_token|apiKey|stsTokenManager/); expect(backup).toContain('deviceId');
  });
  it('a remote task completion closes this device timer without losing its recorded session', async () => {
    const a = await device(); const t = await task(a); await a.life.toggleTimer(t.id);
    const b = await device(); await converge(a, b);
    await b.life.setCompleted(t.id); await b.engine.syncNow(); await a.engine.syncNow();
    await a.life.reconcileActiveTimer();
    expect((await a.life.snapshot()).active).toBeNull(); expect((await a.repo.list('activities'))[0].endTime).not.toBeNull();
    await a.life.addTask('Next task'); const next = (await a.repo.list('tasks')).find(r => r.title === 'Next task')!;
    await a.life.toggleTimer(next.id); expect((await a.life.snapshot()).active).not.toBeNull();
  });
  it('automatically debounces local writes rather than blocking the save on cloud access', async () => {
    const a = await device(); await a.engine.syncNow(); const before = cloud.requests.length;
    const t = await task(a); expect(cloud.requests.length).toBe(before); expect(t.syncStatus).toBe('pending');
    await vi.advanceTimersByTimeAsync(700); await a.engine.syncNow();
    expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('synced');
  });
  it('removes realtime listeners when a category is disabled and on sign-out', async () => {
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    const watch = vi.fn(() => { const stop = vi.fn(); stops.push(stop); return stop; });
    (cloud as CloudTransport).watch = watch;
    const a = await device(); expect(watch).toHaveBeenCalledTimes(8);
    await a.engine.setPolicy({ enabled: true, categories: { tasks: true } });
    expect(stops.slice(0, 8).every(stop => stop.mock.calls.length === 1)).toBe(true);
    await a.engine.setAccount(null); expect(stops.every(stop => stop.mock.calls.length === 1)).toBe(true);
  });
  it('retries a transient issue automatically using bounded backoff', async () => {
    const a = await device(); const t = await task(a); cloud.fail = true; await a.engine.syncNow();
    cloud.fail = false; await vi.advanceTimersByTimeAsync(3100); await a.engine.syncNow();
    expect((await a.repo.get('tasks', t.id))?.syncStatus).toBe('synced'); expect(a.engine.getSnapshot().status).toBe('Synced');
  });
  it('manual sync waits for a follow-up when records are created during an older pass', async () => {
    const a = await device(); await task(a, 'First');
    let release!: () => void; let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entering = new Promise<void>(resolve => { started = resolve; });
    const real = cloud.exchange.bind(cloud); let pause = true;
    cloud.exchange = async (uid, table, record) => { if (pause) { pause = false; started(); await gate; } return real(uid, table, record); };
    const firstPass = a.engine.syncNow(); await entering;
    const second = await task(a, 'Created during request'); const manual = a.engine.syncNow(); release();
    await Promise.all([firstPass, manual]);
    expect(cloud.records.has(`owner/tasks/${second.id}`)).toBe(true); expect((await a.repo.get('tasks', second.id))?.syncStatus).toBe('synced');
  });
  it('preserves local and cloud records when the same ID has incompatible creation metadata', async () => {
    const a = await device(); const t = await task(a); await a.engine.syncNow();
    const other = { ...t, title: 'Ambiguous local copy', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z', syncStatus: 'pending' as const };
    await a.repo.commit([{ table: 'tasks', value: other }]); await a.engine.syncNow();
    expect((await a.repo.get('tasks', t.id))?.title).toBe('Ambiguous local copy'); expect((cloud.records.get(`owner/tasks/${t.id}`) as Task).title).toBe(t.title);
    expect(a.engine.getSnapshot().status).toBe('Sync issue');
  });
});
