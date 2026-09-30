import { IndexedDbRepository } from './indexedDb';
import type { Repository, Write, ExpectedRecord } from './repository';
import type { Table } from '../domain/models';
/** One repository interface, with an IndexedDB notebook per Firebase UID. */
export class AccountRepository implements Repository {
  private selected: IndexedDbRepository;
  private accounts = new Map<string, IndexedDbRepository>();
  private constructor(private legacy: IndexedDbRepository) { this.selected = legacy; }
  legacyAllowed() { return this.selected === this.legacy; }
  static async open() {
    const repository = new AccountRepository(await IndexedDbRepository.open());
    const last = (await repository.legacy.get('meta', 'lastActiveAccount'))?.value;
    if (typeof last === 'string') await repository.selectAccount(last);
    return repository;
  }
  async selectAccount(uid: string) {
    if (!uid || uid.length > 128) throw new Error('Invalid Firebase account.');
    await this.legacy.commitOnce([{ table: 'meta', value: { id: 'cloudOwner', value: uid } }], 'cloudOwner');
    const owner = (await this.legacy.get('meta', 'cloudOwner'))?.value;
    if (owner === uid) this.selected = this.legacy;
    else {
      if (!this.accounts.has(uid)) this.accounts.set(uid, await IndexedDbRepository.open(`my-life-account-${encodeURIComponent(uid)}`));
      this.selected = this.accounts.get(uid)!;
      const installation = await this.legacy.get('meta', 'deviceId');
      if (installation) await this.selected.commitOnce([{ table: 'meta', value: installation }], 'deviceId');
    }
    await this.legacy.commit([{ table: 'meta', value: { id: 'lastActiveAccount', value: uid } }]);
  }
  get<K extends Table>(table: K, id: string) { return this.selected.get(table, id); }
  list<K extends Table>(table: K) { return this.selected.list(table); }
  commit(writes: Write[]) { return this.selected.commit(writes); }
  commitOnce(writes: Write[], markerId: string) { return this.selected.commitOnce(writes, markerId); }
  commitTimer(writes: Write[], expected: string | null) { return this.selected.commitTimer(writes, expected); }
  compareAndCommit(writes: Write[], expected: ExpectedRecord[]) { return this.selected.compareAndCommit(writes, expected); }
  close() { this.legacy.close(); for (const repo of this.accounts.values()) repo.close(); }
}
