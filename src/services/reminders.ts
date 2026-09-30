import type { Reminder } from '../domain/models';
import type { Repository } from '../data/repository';
export interface NotificationProvider { permission(): Promise<'granted' | 'denied' | 'prompt'>; requestPermission(): Promise<boolean>; show(reminder: Reminder): Promise<void>; schedule?(reminders: Reminder[]): Promise<void> }
export class BrowserNotificationProvider implements NotificationProvider {
 async permission(): Promise<'granted' | 'denied' | 'prompt'> { return typeof Notification === 'undefined' ? 'denied' : Notification.permission === 'default' ? 'prompt' : Notification.permission; }
 async requestPermission() { return typeof Notification !== 'undefined' && await Notification.requestPermission() === 'granted'; }
 async show(r: Reminder) { if (await this.permission() !== 'granted') return; const registration = await navigator.serviceWorker?.ready; if (registration) await registration.showNotification(r.intensity === 'important' ? 'Alright. This one matters.' : 'A little reminder', { body: r.title, tag: r.id }); }
}
export class ReminderScheduler {
 private running = false;
 constructor(private repo: Repository, private provider: NotificationProvider) {}
 async tick(now = Date.now()) {
  if (this.running || await this.provider.permission() !== 'granted') return; this.running = true;
  try { const reminders = (await this.repo.list('reminders')).filter(r => !r.deletedAt && r.enabled); if (this.provider.schedule) { await this.provider.schedule(reminders); return; }
   for (const r of reminders) { const when = Date.parse(r.scheduledAt); if (when > now || when < now - 15 * 60_000 || await this.repo.get('meta', `reminder-delivered-${r.id}-${r.version}`)) continue;
    await this.provider.show(r); await this.repo.commit([{ table: 'meta', value: { id: `reminder-delivered-${r.id}-${r.version}`, value: true } }]);
   }
  } finally { this.running = false; }
 }
}
export function leaveBy(plannedStart: string, minutes: number) { const start = Date.parse(plannedStart); if (!Number.isFinite(start) || !Number.isFinite(minutes) || minutes < 0 || minutes > 1440) throw new Error('Choose a travel time between 0 and 1,440 minutes.'); return new Date(start - minutes * 60_000).toISOString(); }
