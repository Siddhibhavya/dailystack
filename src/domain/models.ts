export type SyncStatus = 'pending' | 'synced' | 'conflict';
export interface Metadata {
  id: string; createdAt: string; updatedAt: string; deviceId: string;
  syncStatus: SyncStatus; version: number; deletedAt: string | null;
}
export interface Task extends Metadata {
  title: string; completed: boolean; projectId?: string; parentTaskId?: string;
  notes: string; priority: boolean; important: boolean; deadline?: string;
  estimatedMinutes?: number; legacyElapsedSeconds: number; legacyId?: string | number;
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
}
export type Table = keyof Tables;
export const TABLES: Table[] = ['tasks', 'projects', 'activities', 'journals', 'cycles', 'observations', 'memories', 'reminders', 'backups', 'meta'];
export type SyncCategory = Exclude<Table, 'backups' | 'meta'> | 'calendarMetadata' | 'mealPhotos' | 'symptoms' | 'meals' | 'selfCare';
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
