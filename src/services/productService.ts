import type { Repository, Write } from '../data/repository';
import { changed, metadata, DEFAULT_PREFERENCES, PREFERENCES_ID, type PreferencesSettings, type AccountPreferences, type Journal, type ActivitySegment, type Metadata, type Tables, type JournalSuggestion } from '../domain/models';
import { validSyncRecord, type SyncTable } from './syncRecords';
import { previewCycleImport, validateCycle } from './cycleImport';
import { extractSuggestions, type ExtractionProvider } from './suggestions';
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function localDateTime(date = new Date()) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
export class ProductService {
  constructor(private repo: Repository, readonly deviceId: string, private notify: () => void, private extraction: ExtractionProvider = extractSuggestions) {}
  async snapshot() {
    const tables = ['journals', 'cycles', 'observations', 'memories', 'reminders', 'preferences', 'meals', 'hydration', 'careRoutines', 'careLogs', 'suggestions'] as const;
    const rows = await Promise.all(tables.map(table => this.repo.list(table)));
    return Object.fromEntries(tables.map((table, index) => [table, rows[index].filter(row => !row.deletedAt)])) as { [K in typeof tables[number]]: Tables[K][] };
  }
  private operations = new Set<Promise<unknown>>();
  private track<T>(action: () => Promise<T>): Promise<T> { const promise = action(); this.operations.add(promise); void promise.finally(() => this.operations.delete(promise)).catch(() => {}); return promise; }
  async idle() { while (this.operations.size) await Promise.allSettled([...this.operations]); }
  async preferences(): Promise<PreferencesSettings> { return (await this.repo.get('preferences', PREFERENCES_ID)) ?? structuredClone(DEFAULT_PREFERENCES); }
  savePreferences(edits: Partial<PreferencesSettings>) { return this.track(() => this._savePreferences(edits)); }
  add<K extends SyncTable>(table: K, data: Omit<Tables[K], keyof Metadata>) { return this.track(() => this._add(table, data)); }
  update<K extends SyncTable>(table: K, id: string, edits: Partial<Omit<Tables[K], keyof Metadata>>) { return this.track(() => this._update(table, id, edits)); }
  remove(table: SyncTable, id: string) { return this.track(() => this._remove(table, id)); }
  journal(text: string, kind: Journal['kind'], source: Journal['source'], revisionOf?: string) { return this.track(() => this._journal(text, kind, source, revisionOf)); }
  decideSuggestion(id: string, confirm: boolean, value?: string) { return this.track(() => this._decideSuggestion(id, confirm, value)); }
  activity(title: string, start: string, end: string, id?: string) { return this.track(() => this._activity(title, start, end, id)); }
  deleteActivity(id: string) { return this.track(() => this._deleteActivity(id)); }
  splitActivity(id: string, at: string) { return this.track(() => this._splitActivity(id, at)); }
  savePhoto(file: File) { return this.track(() => this._savePhoto(file)); }
  importCycles(text: string) { return this.track(() => this._importCycles(text)); }
  private async _savePreferences(edits: Partial<PreferencesSettings>) {
    const existing = await this.repo.get('preferences', PREFERENCES_ID);
    if (existing) return this.update('preferences', PREFERENCES_ID, edits);
    const record: AccountPreferences = { ...metadata(this.deviceId), ...structuredClone(DEFAULT_PREFERENCES), ...edits, id: PREFERENCES_ID };
    await this.repo.commitOnce([{ table: 'preferences', value: record }, { table: 'meta', value: { id: 'preferences-created', value: true } }], 'preferences-created');
    this.notify();
  }
  private async _add<K extends SyncTable>(table: K, data: Omit<Tables[K], keyof Metadata>) {
    const record = { ...metadata(this.deviceId), ...data } as Tables[K];
    if (!validSyncRecord(table, record) || table === 'cycles' && !validateCycle(data)) throw new Error('Check the entry before saving.');
    await this.repo.commit([{ table, value: record } as Write]); this.notify(); return record;
  }
  private async _update<K extends SyncTable>(table: K, id: string, edits: Partial<Omit<Tables[K], keyof Metadata>>) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await this.repo.get(table, id); if (!before || before.deletedAt) throw new Error('This entry is no longer available.');
      const after = changed({ ...before, ...edits }, this.deviceId);
      if (!validSyncRecord(table, after) || table === 'cycles' && !validateCycle(after)) throw new Error('Check the entry before saving.');
      if (table === 'journals' && 'originalTranscription' in edits) throw new Error('Save writing as a separate journal revision.');
      if (await this.repo.compareAndCommit([{ table, value: after } as Write], [{ table, id, value: before }])) { this.notify(); return after; }
    }
    throw new Error('This entry changed in another tab. Please try again.');
  }
  private async _remove(table: SyncTable, id: string) {
    const before = await this.repo.get(table, id); if (!before || before.deletedAt) return;
    const after = changed({ ...before, deletedAt: new Date().toISOString() }, this.deviceId);
    if (!await this.repo.compareAndCommit([{ table, value: after } as Write], [{ table, id, value: before }])) throw new Error('This entry changed. Please try again.');
    this.notify();
  }
  private async _journal(text: string, kind: Journal['kind'], source: Journal['source'], revisionOf?: string) {
    if (!text.trim() || text.length > 200_000) throw new Error('Write something first (up to 200,000 characters).');
    const entry: Journal = { ...metadata(this.deviceId), originalTranscription: text, kind, source, date: dateKey(), ...(revisionOf ? { revisionOf } : {}) };
    const suggestions: JournalSuggestion[] = (await this.extraction.suggest(text)).map(s => ({ ...metadata(this.deviceId), ...s, journalId: entry.id, status: 'suggested' }));
    await this.repo.commit([{ table: 'journals', value: entry }, ...suggestions.map(value => ({ table: 'suggestions' as const, value }))]); this.notify(); return entry;
  }
  private async _decideSuggestion(id: string, confirm: boolean, value?: string) {
    const suggestion = await this.repo.get('suggestions', id);
    if (!suggestion || suggestion.status !== 'suggested') return;
    const text = (value ?? suggestion.value).trim(); if (confirm && !text) throw new Error('Give this suggestion a value.');
    const writes: Write[] = [{ table: 'suggestions', value: changed({ ...suggestion, value: text, status: confirm ? 'confirmed' : 'ignored' }, this.deviceId) }];
    if (confirm && suggestion.kind === 'task') writes.push({ table: 'tasks', value: { ...metadata(this.deviceId), title: text, notes: '', completed: false, priority: false, important: false, legacyElapsedSeconds: 0 } });
    if (confirm && suggestion.kind !== 'task') writes.push({ table: 'observations', value: { ...metadata(this.deviceId), date: dateKey(), journalId: suggestion.journalId, symptoms: suggestion.kind === 'symptom' ? [text] : [], ...(suggestion.kind === 'energy' ? { energy: text as 'low' } : {}) } });
    if (await this.repo.compareAndCommit(writes, [{ table: 'suggestions', id, value: suggestion }])) this.notify();
  }
  private async _activity(title: string, startTime: string, endTime: string, id?: string) {
    if (!title.trim() || !Number.isFinite(Date.parse(startTime)) || !Number.isFinite(Date.parse(endTime)) || Date.parse(endTime) < Date.parse(startTime)) throw new Error('Give it a title and an end after the start.');
    if (id) { await this.ensureNotRunning(id); return this.update('activities', id, { title: title.trim(), startTime, endTime }); }
    return this.add('activities', { title: title.trim(), source: 'manual', startTime, endTime });
  }
  private async ensureNotRunning(id: string) { const active = (await this.repo.get('meta', 'activeTimer'))?.value as { segmentId?: string } | undefined; if (active?.segmentId === id) throw new Error('Pause the task timer before editing this session.'); }
  private async _deleteActivity(id: string) { await this.ensureNotRunning(id); await this.remove('activities', id); }
  private async _splitActivity(id: string, at: string) {
    await this.ensureNotRunning(id);
    const before = await this.repo.get('activities', id);
    if (!before || before.deletedAt || !before.endTime || !Number.isFinite(Date.parse(at)) || Date.parse(at) <= Date.parse(before.startTime) || Date.parse(at) >= Date.parse(before.endTime)) throw new Error('Choose a split time inside this finished activity.');
    const second: ActivitySegment = { ...before, ...metadata(this.deviceId), startTime: at };
    const writes: Write[] = [{ table: 'activities', value: changed({ ...before, endTime: at }, this.deviceId) }, { table: 'activities', value: second }];
    if (!await this.repo.compareAndCommit(writes, [{ table: 'activities', id, value: before }])) throw new Error('This activity changed. Try again.'); this.notify();
  }
  private async _savePhoto(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8_000_000) throw new Error('Choose a JPEG, PNG or WebP photo smaller than 8 MB.');
    const id = crypto.randomUUID(); await this.repo.commit([{ table: 'photos', value: { id, blob: file, createdAt: new Date().toISOString() } }]); return id;
  }
  photo(id: string) { return this.repo.get('photos', id); }
  private async _importCycles(text: string) {
    const preview = previewCycleImport(text); const existing = await this.repo.list('cycles');
    const sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), n => n.toString(16).padStart(2, '0')).join('');
    const marker = `cycle-import-${sourceHash}`;
    const rows = preview.valid.filter(r => !existing.some(e => !e.deletedAt && e.periodStart === r.periodStart));
    const writes: Write[] = rows.map(r => ({ table: 'cycles', value: { ...metadata(this.deviceId), ...r, importedFrom: `json:${sourceHash}` } }));
    writes.push({ table: 'meta', value: { id: marker, value: { count: rows.length, importedAt: new Date().toISOString() } } });
    const committed = await this.repo.commitOnce(writes, marker); this.notify(); return committed ? rows.length : 0;
  }
}
