import type { Tables, Metadata, Journal } from '../domain/models';
import { structuredWinner } from './syncContracts';
export const SYNC_TABLES = ['tasks', 'projects', 'activities', 'journals', 'cycles', 'observations', 'memories', 'reminders', 'preferences', 'meals', 'hydration', 'careRoutines', 'careLogs', 'suggestions'] as const;
export type SyncTable = typeof SYNC_TABLES[number];
export type SyncRecord = Tables[SyncTable];
export interface MergeResult { record: SyncRecord; copies: Journal[] }
export function cleanRecord<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanRecord) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, cleanRecord(v)])) as T;
  return value;
}
export function canonicalRecord(record: SyncRecord): string {
  const ordered = (v: unknown): unknown => Array.isArray(v) ? v.map(ordered) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k, value]) => k !== 'syncStatus' && value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, ordered(value)])) : v;
  return JSON.stringify(ordered(record));
}
export function validSyncRecord(table: SyncTable, value: unknown): value is SyncRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const iso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
  if (typeof r.id !== 'string' || !uuid.test(r.id) || typeof r.deviceId !== 'string' || !uuid.test(r.deviceId) || !iso(r.createdAt) || !iso(r.updatedAt)
    || !Number.isInteger(r.version) || Number(r.version) < 1 || !(r.deletedAt === null || iso(r.deletedAt)) || !['pending', 'synced', 'conflict'].includes(String(r.syncStatus))) return false;
  switch (table) {
    case 'tasks': return typeof r.title === 'string' && typeof r.completed === 'boolean' && typeof r.notes === 'string' && typeof r.priority === 'boolean' && typeof r.important === 'boolean' && typeof r.legacyElapsedSeconds === 'number' && r.legacyElapsedSeconds >= 0;
    case 'projects': return typeof r.title === 'string' && typeof r.description === 'string' && typeof r.notes === 'string' && ['active', 'paused', 'completed', 'archived'].includes(String(r.status)) && ['low', 'normal', 'high'].includes(String(r.priority));
    case 'activities': return typeof r.title === 'string' && ['timer', 'manual', 'journal'].includes(String(r.source)) && iso(r.startTime) && (r.endTime === null || iso(r.endTime) && Date.parse(String(r.endTime)) >= Date.parse(String(r.startTime)));
    case 'journals': return typeof r.originalTranscription === 'string' && r.originalTranscription.length <= 200_000 && ['morning', 'evening', 'general'].includes(String(r.kind)) && ['manual', 'voice'].includes(String(r.source)) && typeof r.date === 'string';
    case 'cycles': return typeof r.periodStart === 'string' && typeof r.notes === 'string' && Array.isArray(r.symptoms) && Array.isArray(r.flow);
    case 'observations': return typeof r.date === 'string' && Array.isArray(r.symptoms);
    case 'memories': return typeof r.key === 'string' && typeof r.value === 'string' && ['profile', 'preference', 'routine', 'temporary-context', 'suggestion'].includes(String(r.lifecycle)) && (r.confirmedAt === null || iso(r.confirmedAt));
    case 'reminders': return typeof r.title === 'string' && typeof r.enabled === 'boolean' && ['soft', 'important'].includes(String(r.intensity)) && ['water', 'meal', 'supplement', 'appointment', 'leave-by', 'custom'].includes(String(r.kind)) && iso(r.scheduledAt);
    case 'preferences': { const modules = r.modules as Record<string, unknown> | undefined; const routines = r.routines as Record<string, unknown> | undefined; return typeof r.preferredName === 'string' && r.preferredName.length <= 100 && typeof r.onboardingComplete === 'boolean' && Boolean(modules && ['cycle', 'meTime', 'hydration', 'food'].every(k => typeof modules[k] === 'boolean')) && Boolean(routines && ['water', 'meals', 'morning', 'evening'].every(k => typeof routines[k] === 'boolean')) && Array.isArray(r.emphasis) && r.emphasis.every(v => typeof v === 'string') && typeof r.showCompleted === 'boolean' && (r.gentleDate === null || typeof r.gentleDate === 'string'); }
    case 'meals': return iso(r.time) && typeof r.description === 'string' && typeof r.notes === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(r.kind)) && ['yes', 'no', 'unsure'].includes(String(r.protein)) && ['yes', 'no', 'unsure'].includes(String(r.fibre));
    case 'hydration': return iso(r.time) && Number.isInteger(r.glasses) && Number(r.glasses) > 0;
    case 'careRoutines': return typeof r.title === 'string' && typeof r.enabled === 'boolean' && ['morning', 'evening', 'any'].includes(String(r.timeOfDay));
    case 'careLogs': return typeof r.routineId === 'string' && typeof r.date === 'string' && ['done', 'taken', 'skipped', 'not-today'].includes(String(r.status));
    case 'suggestions': return typeof r.journalId === 'string' && typeof r.value === 'string' && ['energy', 'symptom', 'task'].includes(String(r.kind)) && ['suggested', 'confirmed', 'ignored'].includes(String(r.status));
  }
}
async function conflictId(journal: Journal): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRecord(journal))));
  hash[6] = (hash[6] & 15) | 80; hash[8] = (hash[8] & 63) | 128;
  const hex = Array.from(hash.slice(0, 16), n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function reconcile(table: SyncTable, local: SyncRecord, remote?: SyncRecord): Promise<MergeResult> {
  if (!remote) return { record: cleanRecord({ ...local, syncStatus: local.syncStatus === 'conflict' ? 'conflict' : 'synced' }), copies: [] };
  if (table !== 'journals' && local.createdAt !== remote.createdAt) throw new Error('Different records share an ID. Both notebooks are preserved for review.');
  // Journal text is immutable in the primary document. Differing writing is retained
  // as a stable conflict copy, so retrying the same exchange never duplicates it.
  if (table === 'journals' && (local as Journal).originalTranscription !== (remote as Journal).originalTranscription) {
    const writing = local as Journal;
    const copy: Journal = { ...writing, id: await conflictId(writing), revisionOf: writing.revisionOf ?? writing.id, syncStatus: 'conflict' };
    // A deletion still propagates, while both versions of the writing stay recoverable.
    const record = { ...remote, deletedAt: local.deletedAt ?? remote.deletedAt, syncStatus: 'conflict' as const };
    if (local.deletedAt && !remote.deletedAt) Object.assign(record, { updatedAt: local.updatedAt, deviceId: local.deviceId, version: Math.max(local.version, remote.version) });
    return { record: cleanRecord(record), copies: [cleanRecord(copy)] };
  }
  const winner = structuredWinner(local, remote);
  return { record: cleanRecord({ ...winner, syncStatus: local.syncStatus === 'conflict' || remote.syncStatus === 'conflict' ? 'conflict' : 'synced' }), copies: [] };
}
export function hasSymptoms(record: Metadata): boolean { return 'symptoms' in record && Array.isArray(record.symptoms) && record.symptoms.length > 0; }
