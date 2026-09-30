import type { Table, Tables } from '../domain/models';
export type Write = { [K in Table]: { table: K; value: Tables[K] } }[Table];
export interface ExpectedRecord { table: Table; id: string; value: unknown }
export interface Repository {
  get<K extends Table>(table: K, id: string): Promise<Tables[K] | undefined>;
  list<K extends Table>(table: K): Promise<Tables[K][]>;
  commit(writes: Write[]): Promise<void>;
  commitOnce(writes: Write[], markerId: string): Promise<boolean>;
  /** Atomic check-and-write prevents two tabs starting competing timer sessions. */
  commitTimer(writes: Write[], expected: string | null): Promise<void>;
  /** Sync acknowledgement must not overwrite edits made while a network request was running. */
  compareAndCommit(writes: Write[], expected: ExpectedRecord[]): Promise<boolean>;
}
