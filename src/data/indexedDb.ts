import { TABLES, type Table, type Tables } from '../domain/models';
import type { Repository, Write, ExpectedRecord } from './repository';
export const DATABASE_VERSION = 2;
export class IndexedDbRepository implements Repository {
  private constructor(private readonly db: IDBDatabase) {}
  static open(name = 'my-life'): Promise<IndexedDbRepository> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        for (const table of TABLES) {
          if (!request.result.objectStoreNames.contains(table)) {
            const store = request.result.createObjectStore(table, { keyPath: 'id' });
            if (table !== 'meta' && table !== 'backups' && table !== 'photos') {
              store.createIndex('updatedAt', 'updatedAt');
              store.createIndex('syncStatus', 'syncStatus');
            }
          }
        }
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Another tab is using an older database. Close it and reload.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(new IndexedDbRepository(request.result));
      };
    });
  }
  close() { this.db.close(); }
  private read<K extends Table>(table: K, id?: string): Promise<Tables[K] | Tables[K][] | undefined> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(table, 'readonly');
      const store = tx.objectStore(table);
      const request = id === undefined ? store.getAll() : store.get(id);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error('Local read failed.'));
      tx.onerror = () => reject(tx.error);
    });
  }
  get<K extends Table>(table: K, id: string) { return this.read(table, id) as Promise<Tables[K] | undefined>; }
  list<K extends Table>(table: K) { return this.read(table) as Promise<Tables[K][]>; }
  private write(writes: Write[], expected?: string | null): Promise<void> {
    if (!writes.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const stores = [...new Set([...writes.map(w => w.table), 'meta'])];
      const tx = this.db.transaction(stores, 'readwrite');
      let conflict = false;
      const put = () => { for (const write of writes) tx.objectStore(write.table).put(write.value); };
      if (expected !== undefined) {
        const request = tx.objectStore('meta').get('activeTimer');
        request.onsuccess = () => {
          const value = request.result?.value;
          const current = value?.legacy ? `legacy:${value.taskId}:${value.startedAt}` : value?.segmentId ?? null;
          if (current !== expected) { conflict = true; tx.abort(); } else put();
        };
      } else put();
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error(conflict ? 'The timer changed in another tab. Try again.' : 'Local save failed. Your previous data is unchanged.'));
      tx.onerror = () => reject(tx.error);
    });
  }
  commit(writes: Write[]) { return this.write(writes); }
  commitOnce(writes: Write[], markerId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([...new Set([...writes.map(w => w.table), 'meta'])], 'readwrite');
      let applied = false;
      const request = tx.objectStore('meta').get(markerId);
      request.onsuccess = () => {
        if (request.result) return;
        for (const write of writes) tx.objectStore(write.table).put(write.value);
        applied = true;
      };
      tx.oncomplete = () => resolve(applied);
      tx.onabort = () => reject(new Error('Local migration save failed. Original data is preserved.'));
      tx.onerror = () => reject(tx.error);
    });
  }
  commitTimer(writes: Write[], expected: string | null) { return this.write(writes, expected); }
  compareAndCommit(writes: Write[], expected: ExpectedRecord[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stores = [...new Set([...writes.map(w => w.table), ...expected.map(e => e.table)])];
      if (!stores.length) { resolve(true); return; }
      const tx = this.db.transaction(stores, 'readwrite');
      let remaining = expected.length;
      let applied = false;
      let equal = true;
      const put = () => { if (!equal) return; for (const w of writes) tx.objectStore(w.table).put(w.value); applied = true; };
      if (!remaining) put();
      for (const e of expected) {
        const request = tx.objectStore(e.table).get(e.id);
        request.onsuccess = () => { if (JSON.stringify(request.result) !== JSON.stringify(e.value)) equal = false; if (--remaining === 0) put(); };
      }
      tx.oncomplete = () => resolve(applied);
      tx.onabort = () => reject(new Error('Local reconciliation failed. Previous data is preserved.'));
      tx.onerror = () => reject(tx.error);
    });
  }
}
