export type SyncStatus = 'pending' | 'synced' | 'conflict';
export interface Metadata {
  id: string; createdAt: string; updatedAt: string; deviceId: string;
  syncStatus: SyncStatus; version: number; deletedAt: string | null;
}
export interface Task extends Metadata {
  title: string; completed: boolean; projectId?: string; parentTaskId?: string;
  notes: string; priority: boolean; important: boolean; deadline?: string;
  estimatedMinutes?: number; legacyElapsedSeconds: number; legacyId?: string | number;
  kind?: 'task' | 'checklist'; sortOrder?: number; pinnedToday?: boolean; pinnedTasks?: boolean; widgetEligible?: boolean;
}
export interface Project extends Metadata {
  title: string; description: string; deadline?: string; priority: 'low' | 'normal' | 'high';
  status: 'active' | 'paused' | 'completed' | 'archived'; notes: string; estimatedMinutes?: number;
}
export interface ActivitySegment extends Metadata {
  source: 'timer' | 'manual' | 'journal'; taskId?: string; projectId?: string;
  title: string; startTime: string; endTime: string | null;
}
export interface Journal extends Metadata {
  kind: 'morning' | 'evening' | 'general'; originalTranscription: string;
  source: 'manual' | 'voice'; date: string; revisionOf?: string;
}
export interface Cycle extends Metadata {
  periodStart: string; periodEnd?: string; notes: string;
  flow: Array<{ date: string; level: 'light' | 'medium' | 'heavy' }>;
  symptoms: string[]; importedFrom?: string;
}
export interface Observation extends Metadata {
  date: string; energy?: 'very-low' | 'low' | 'steady' | 'high';
  mood?: string; calm?: 'low' | 'steady' | 'high'; stress?: 'low' | 'steady' | 'high';
  bodyState?: string; symptoms: string[]; journalId?: string;
}
export interface Memory extends Metadata {
  lifecycle: 'profile' | 'preference' | 'routine' | 'temporary-context' | 'suggestion';
  key: string; value: string; confirmedAt: string | null; expiresAt?: string; journalId?: string;
}
export interface Reminder extends Metadata {
  title: string; kind: 'water' | 'meal' | 'supplement' | 'appointment' | 'leave-by' | 'custom';
  intensity: 'soft' | 'important'; scheduledAt: string; enabled: boolean;
}
export interface PreferencesSettings {
  preferredName: string; onboardingComplete: boolean;
  modules: { cycle: boolean; meTime: boolean; hydration: boolean; food: boolean };
  emphasis: string[]; routines: { water: boolean; meals: boolean; morning: boolean; evening: boolean };
  gentleDate: string | null; showCompleted: boolean;
}
export interface AccountPreferences extends Metadata, PreferencesSettings {}
export const PREFERENCES_ID = '7ecaa281-3eb8-4e62-8fb4-0f72e8f0b1ad';
export const DEFAULT_PREFERENCES: PreferencesSettings = { preferredName: '', onboardingComplete: false, modules: { cycle: false, meTime: true, hydration: true, food: true }, emphasis: ['My day', 'Tasks', 'Journaling'], routines: { water: false, meals: false, morning: false, evening: false }, gentleDate: null, showCompleted: true };
export interface Meal extends Metadata { time: string; kind: 'breakfast' | 'lunch' | 'dinner' | 'snack'; description: string; photoId?: string; protein: 'yes' | 'no' | 'unsure'; fibre: 'yes' | 'no' | 'unsure'; notes: string }
export interface Hydration extends Metadata { time: string; glasses: number }
export interface CareRoutine extends Metadata { title: string; timeOfDay: 'morning' | 'evening' | 'any'; enabled: boolean }
export interface CareLog extends Metadata { routineId: string; date: string; status: 'done' | 'taken' | 'skipped' | 'not-today' }
export interface Photo { id: string; blob: Blob; createdAt: string }
export interface JournalSuggestion extends Metadata { journalId: string; kind: 'energy' | 'symptom' | 'task'; value: string; status: 'suggested' | 'confirmed' | 'ignored' }
export interface CalendarCommitment {
  id: string; accountId: string; calendarId: string; title: string;
  plannedStart: string; plannedEnd: string; allDay: boolean;
}
export interface LegacyTimer { taskId: string; startedAt: number; legacy: true }
export interface RecoveryBackup { id: string; capturedAt: string; tasksRaw: string | null; timerRaw: string | null }
export interface Meta { id: string; value: unknown }
export interface Tables {
  tasks: Task; projects: Project; activities: ActivitySegment; journals: Journal;
  cycles: Cycle; observations: Observation; memories: Memory; reminders: Reminder;
  backups: RecoveryBackup; meta: Meta;
  preferences: AccountPreferences; meals: Meal; hydration: Hydration; careRoutines: CareRoutine; careLogs: CareLog; photos: Photo; suggestions: JournalSuggestion;
}
export type Table = keyof Tables;
export const TABLES: Table[] = ['tasks', 'projects', 'activities', 'journals', 'cycles', 'observations', 'memories', 'reminders', 'backups', 'meta', 'preferences', 'meals', 'hydration', 'careRoutines', 'careLogs', 'photos', 'suggestions'];
export type SyncCategory = Exclude<Table, 'backups' | 'meta' | 'photos'> | 'calendarMetadata' | 'mealPhotos' | 'symptoms' | 'selfCare';
export interface SyncPolicy { enabled: boolean; categories: Partial<Record<SyncCategory, boolean>> }
export const DEFAULT_SYNC_POLICY: SyncPolicy = { enabled: false, categories: {} };
export function metadata(deviceId: string, now = new Date().toISOString()): Metadata {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, deviceId, syncStatus: 'pending', version: 1, deletedAt: null };
}
export function changed<T extends Metadata>(record: T, deviceId: string): T {
  return { ...record, updatedAt: new Date().toISOString(), deviceId, syncStatus: 'pending', version: record.version + 1 };
}
export function elapsedSeconds(task: Task, segments: ActivitySegment[], now = Date.now()): number {
  return task.legacyElapsedSeconds + segments.filter(s => s.taskId === task.id && !s.deletedAt)
    .reduce((total, s) => total + Math.max(0, ((s.endTime ? Date.parse(s.endTime) : now) - Date.parse(s.startTime)) / 1000), 0);
}
