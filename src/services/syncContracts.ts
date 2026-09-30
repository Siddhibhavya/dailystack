import type { Metadata, Journal, SyncCategory, SyncPolicy } from '../domain/models';
/** Contract only. Phase 1 never starts a cloud transport or uploads records. */
export interface SyncTransport {
  push(category: SyncCategory, records: Metadata[]): Promise<void>;
  pull(category: SyncCategory, cursor?: string): Promise<{ records: Metadata[]; cursor: string }>;
}
export function canSync(policy: SyncPolicy, category: SyncCategory): boolean {
  return policy.enabled && policy.categories[category] === true;
}
/** Same comparison on every device. Deletion participates as a normal revision. */
export function structuredWinner<T extends Metadata>(left: T, right: T): T {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
    return JSON.stringify(value) ?? 'null';
  };
  // Tabs on one device can write at the same millisecond/version. Break that tie
  // by canonical payload so the merge order cannot change the selected result.
  const key = (record: T) => `${record.updatedAt}|${String(record.version).padStart(12, '0')}|${record.deviceId}|${canonical(record)}`;
  return key(left) >= key(right) ? left : right;
}
export function journalConflict(left: Journal, right: Journal): { versions: Journal[]; needsReview: boolean } {
  if (left.originalTranscription !== right.originalTranscription) return { versions: [left, right], needsReview: true };
  return { versions: [structuredWinner(left, right)], needsReview: false };
}
