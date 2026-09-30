import type { Repository, Write } from '../data/repository';
import { DEFAULT_SYNC_POLICY, type SyncPolicy } from '../domain/models';
import { canSync, type SyncTransport } from './syncContracts';
import { canonicalRecord, hasSymptoms, SYNC_TABLES, validSyncRecord, type SyncRecord, type SyncTable, type MergeResult } from './syncRecords';
export type CloudTransport = SyncTransport;
export interface SyncAccount { uid: string; email: string | null }
export interface SyncSnapshot {
  status: 'Saved on this device' | 'Syncing' | 'Synced' | 'Offline' | 'Sync issue' | 'Conflict';
  account: SyncAccount | null; policy: SyncPolicy; lastSuccess: string | null;
  accountMismatch: boolean; issue: string | null; conflicts: number;
}
export class SyncEngine {
  private snapshot: SyncSnapshot = { status: 'Saved on this device', account: null, policy: DEFAULT_SYNC_POLICY, lastSuccess: null, accountMismatch: false, issue: null, conflicts: 0 };
  private listeners = new Set<() => void>();
  private watches: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private generation = 0;
  private attempts = 0;
  private requested = false;
  constructor(private repo: Repository, private transport: CloudTransport, private refresh: () => void, private online: () => boolean = () => navigator.onLine) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<SyncSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  async initialize() {
    const policy = (await this.repo.get('meta', 'syncPolicy'))?.value as SyncPolicy | undefined;
    const last = (await this.repo.get('meta', 'lastSync'))?.value;
    this.set({ policy: policy && typeof policy.enabled === 'boolean' && policy.categories ? policy : { enabled: false, categories: {} }, lastSuccess: typeof last === 'string' ? last : null });
  }
  private eligible() { return this.snapshot.policy.enabled || this.snapshot.policy.categories.preferences === true; }
  private enabled(table: SyncTable) { return (table === 'preferences' ? this.snapshot.policy.categories.preferences === true : canSync(this.snapshot.policy, table)) && (!(table === 'observations' || table === 'cycles') || canSync(this.snapshot.policy, 'symptoms')); }
  private safe(record: SyncRecord) { return !hasSymptoms(record) || canSync(this.snapshot.policy, 'symptoms'); }
  private stop() { this.generation++; clearTimeout(this.timer); this.timer = undefined; this.watches.forEach(fn => fn()); this.watches = []; }
  async setAccount(account: SyncAccount | null) {
    this.stop(); this.attempts = 0;
    this.set({ account, accountMismatch: false, issue: null, status: 'Saved on this device' });
    if (!account) return;
    const generation = this.generation;
    await this.repo.commitOnce([{ table: 'meta', value: { id: 'cloudOwner', value: account.uid } }], 'cloudOwner');
    const owner = (await this.repo.get('meta', 'cloudOwner'))?.value;
    if (generation !== this.generation) return;
    if (owner !== account.uid) { this.set({ accountMismatch: true, status: 'Sync issue', issue: 'This local notebook belongs to a different My Life account. Sign in with that account to sync. Local data is preserved.' }); return; }
    this.restartWatches(); this.schedule(0);
  }
  async setPolicy(policy: SyncPolicy) {
    this.stop(); this.attempts = 0;
    const copy = { enabled: policy.enabled, categories: { ...policy.categories } };
    await this.repo.commit([{ table: 'meta', value: { id: 'syncPolicy', value: copy } }]);
    this.set({ policy: copy, issue: null, status: this.online() ? 'Saved on this device' : 'Offline' });
    this.restartWatches(); this.schedule(0);
  }
  private restartWatches() {
    const uid = this.snapshot.account?.uid;
    if (!uid || this.snapshot.accountMismatch || !this.eligible() || !this.online()) return;
    for (const table of SYNC_TABLES.filter(t => this.enabled(t))) {
      const stop = this.transport.watch?.(uid, table, () => this.schedule(), () => this.set({ status: this.online() ? 'Sync issue' : 'Offline', issue: this.online() ? 'Cloud access is unavailable. Your local data is safe. Check sign-in and private security rules.' : null }));
      if (stop) this.watches.push(stop);
    }
  }
  localChanged = () => this.schedule();
  networkChanged = () => { this.stop(); this.attempts = 0; this.set({ status: this.online() ? 'Saved on this device' : 'Offline', issue: null }); this.restartWatches(); this.schedule(0); };
  resume = () => { this.attempts = 0; this.schedule(0); };
  private schedule(delay = 600) {
    if (!this.snapshot.account || this.snapshot.accountMismatch || !this.eligible()) return;
    if (!this.online()) { this.set({ status: 'Offline' }); return; }
    clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = undefined; void this.syncNow(); }, delay);
  }
  async syncNow(): Promise<void> {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.inFlight) { this.requested = true; return this.inFlight; }
    this.inFlight = (async () => {
      let passes = 0;
      do {
        this.requested = false;
        await this.cycle();
        // A manual request during an older pass waits for its follow-up, rather
        // than returning before records created during that pass are reconciled.
      } while (this.requested && ++passes < 8 && this.online() && this.snapshot.account && !this.snapshot.accountMismatch && this.eligible());
    })().catch(() => this.set({ status: this.online() ? 'Sync issue' : 'Offline', issue: this.online() ? 'Sync could not finish. Your local notebook is preserved.' : null })).finally(() => { this.inFlight = null; if (this.requested) { this.requested = false; this.schedule(); } });
    return this.inFlight;
  }
  private async cycle() {
    const account = this.snapshot.account;
    if (!account || this.snapshot.accountMismatch || !this.eligible()) return;
    if (!this.online()) { this.set({ status: 'Offline', issue: null }); return; }
    const generation = this.generation;
    const current = () => generation === this.generation && this.online() && this.snapshot.account?.uid === account.uid;
    this.set({ status: 'Syncing', issue: null });
    let failures = 0;
    let conflicts = 0;
    let mutated = false;
    for (const table of SYNC_TABLES.filter(t => this.enabled(t))) {
      if (!current()) break;
      try {
        // A full paginated reconciliation avoids timestamp cursor omissions after
        // long offline edits, clock skew, and category re-enablement.
        const remote = await this.transport.pull(account.uid, table);
        if (!current()) break;
        const local = await this.repo.list(table);
        const localMap = new Map(local.map(r => [r.id, r]));
        const remoteMap = new Map<string, SyncRecord>();
        for (const record of remote) { if (!validSyncRecord(table, record)) { failures++; continue; } if (this.safe(record)) remoteMap.set(record.id, record); }
        const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
        for (const id of ids) {
          if (!current()) break;
          const before = await this.repo.get(table, id);
          if (before && !this.safe(before)) continue;
          const remoteRecord = remoteMap.get(id);
          if (!before && !remoteRecord) continue;
          try {
            if (before && !validSyncRecord(table, before)) { failures++; continue; }
            const same = before && remoteRecord && canonicalRecord(before) === canonicalRecord(remoteRecord);
            const result: MergeResult = same ? { record: remoteRecord, copies: [] } : before
              ? await this.transport.exchange(account.uid, table, before) : { record: remoteRecord!, copies: [] };
            if (!current()) break;
            if (!validSyncRecord(table, result.record) || result.copies.some(copy => !validSyncRecord('journals', copy))) { failures++; continue; }
            const next = { ...result.record, syncStatus: result.record.syncStatus === 'conflict' ? 'conflict' as const : 'synced' as const };
            if (next.syncStatus === 'conflict') conflicts++;
            // Preserve the losing local journal copy in the same atomic commit.
            const writes: Write[] = [{ table, value: next } as Write];
            const expected = [{ table, id, value: before }];
            for (const copy of result.copies) {
              const existing = await this.repo.get('journals', copy.id);
              if (!existing) { writes.push({ table: 'journals', value: copy }); expected.push({ table: 'journals', id: copy.id, value: undefined }); }
            }
            if (JSON.stringify(before) !== JSON.stringify(next) || writes.length > 1) {
              if (!current()) break;
              const applied = await this.repo.compareAndCommit(writes, expected);
              mutated ||= applied;
              if (!applied) this.requested = true;
            }
          } catch { failures++; }
        }
      } catch { failures++; }
    }
    if (mutated) this.refresh();
    if (!current()) return;
    if (failures) {
      this.set({ status: 'Sync issue', conflicts, issue: 'Some records could not sync. They are still saved on this device. Retry, or check private security rules.' });
      if (++this.attempts <= 5) this.schedule(Math.min(60_000, 1500 * 2 ** this.attempts));
    } else {
      this.attempts = 0;
      const lastSuccess = new Date().toISOString();
      await this.repo.commit([{ table: 'meta', value: { id: 'lastSync', value: lastSuccess } }]);
      if (current()) this.set({ status: conflicts ? 'Conflict' : 'Synced', lastSuccess, conflicts });
    }
  }
  close() { this.stop(); this.set({ account: null, status: 'Saved on this device' }); this.listeners.clear(); }
}
