import type { CalendarCommitment } from '../domain/models';
const CLIENT_KEY = 'dailystack_cal_client_id';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(options: { prompt: string }): void }
export interface GoogleIdentity {
  accounts: { oauth2: {
    initTokenClient(options: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback: () => void }): TokenClient;
    revoke(token: string, callback: () => void): void;
  } };
}
declare global { interface Window { google?: GoogleIdentity } }
interface GoogleEvent { id: string; summary?: string; status?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }
export interface CalendarState {
  connected: boolean; loading: boolean; events: CalendarCommitment[];
  error: string | null; fetchedAt: string | null;
}
export function nextHalfHourSlot(now = new Date()) {
  const start = new Date(now); start.setMinutes(start.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return { start, end: new Date(start.getTime() + 30 * 60_000) };
}
export function calendarTemplate(title: string, start: Date, end: Date) {
  const basic = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE'); url.searchParams.set('text', title);
  url.searchParams.set('dates', `${basic(start)}/${basic(end)}`); return url.toString();
}
export class CalendarService {
  private token: string | null = null;
  private expiresAt = 0;
  private client: TokenClient | null = null;
  private generation = 0;
  private authGeneration = 0;
  private controller: AbortController | null = null;
  private state: CalendarState = { connected: false, loading: false, events: [], error: null, fetchedAt: null };
  private listeners = new Set<() => void>();
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>, private readonly identity: () => GoogleIdentity | undefined = () => window.google, private readonly request: typeof fetch = fetch) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(next: Partial<CalendarState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(l => l()); }
  clientId() { return this.storage.getItem(CLIENT_KEY) ?? ''; }
  saveClientId(value: string) {
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(value.trim())) throw new Error('Enter a Google OAuth web client ID.');
    if (value.trim() !== this.clientId()) { this.disconnect(); this.storage.setItem(CLIENT_KEY, value.trim()); this.client = null; }
  }
  connect() {
    const google = this.identity();
    if (!this.clientId()) throw new Error('Add your Google OAuth client ID in Calendar setup first.');
    if (!google) throw new Error('Google sign-in has not loaded. Check your connection and try again.');
    const authGeneration = ++this.authGeneration;
    this.client = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId(), scope: SCOPE,
      error_callback: () => { if (authGeneration === this.authGeneration) this.update({ error: 'The sign-in window closed or could not open. Try again.' }); },
      callback: response => {
        if (authGeneration !== this.authGeneration) return;
        if (response.error || !response.access_token) { this.update({ error: 'Calendar connection was not completed.' }); return; }
        this.token = response.access_token; this.expiresAt = Date.now() + (response.expires_in ?? 3000) * 1000;
        this.update({ connected: true, error: null }); void this.loadToday();
      },
    });
    this.client.requestAccessToken({ prompt: this.valid() ? '' : 'consent' });
  }
  disconnect() {
    if (this.token) this.identity()?.accounts.oauth2.revoke(this.token, () => {});
    this.clearSession();
  }
  private clearSession() {
    this.generation++; this.authGeneration++; this.controller?.abort(); this.token = null; this.expiresAt = 0;
    this.update({ connected: false, loading: false, events: [], fetchedAt: null });
  }
  private valid() { return !!this.token && Date.now() < this.expiresAt; }
  invalidateLiveData() { this.generation++; this.controller?.abort(); this.update({ events: [], loading: false, fetchedAt: null, error: 'Offline. Calendar needs a live connection.' }); }
  async loadToday(date = new Date()): Promise<void> {
    if (!this.valid()) { this.clearSession(); this.update({ error: 'Connect Calendar to load today’s commitments.' }); return; }
    this.controller?.abort(); const controller = new AbortController(); this.controller = controller;
    const generation = ++this.generation; const token = this.token!;
    this.update({ loading: true, events: [], fetchedAt: null, error: null });
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const events: CalendarCommitment[] = []; const seen = new Set<string>(); let page: string | undefined;
    try {
      do {
        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.searchParams.set('timeMin', start.toISOString()); url.searchParams.set('timeMax', end.toISOString());
        url.searchParams.set('singleEvents', 'true'); url.searchParams.set('orderBy', 'startTime');
        if (page) url.searchParams.set('pageToken', page);
        const response = await this.request(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
        if (generation !== this.generation) return;
        if (response.status === 401) { this.clearSession(); this.update({ error: 'Calendar session expired. Connect again.' }); return; }
        if (!response.ok) throw new Error(this.failureMessage(response.status));
        const data = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string };
        if (generation !== this.generation) return;
        for (const event of data.items ?? []) {
          if (event.status === 'cancelled') continue;
          const plannedStart = event.start?.dateTime ?? event.start?.date;
          const plannedEnd = event.end?.dateTime ?? event.end?.date;
          if (!plannedStart || !plannedEnd) continue;
          events.push({ id: event.id, accountId: 'current-oauth-session', calendarId: 'primary', title: event.summary ?? 'Untitled event', plannedStart, plannedEnd, allDay: !event.start.dateTime });
        }
        page = data.nextPageToken;
        if (page && seen.has(page)) throw new Error('Calendar returned a repeated page. Try refreshing.');
        if (page) seen.add(page);
      } while (page);
      if (generation === this.generation) this.update({ events, loading: false, fetchedAt: new Date().toISOString() });
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.update({ loading: false, events: [], fetchedAt: null, error: error instanceof Error ? error.message : 'Could not load Calendar. Try again.' });
    }
  }
  private failureMessage(status: number) {
    if (status === 403) return 'Calendar access was denied. Check API access and account permissions.';
    if (status === 429) return 'Calendar is receiving too many requests. Try again shortly.';
    if (status >= 500) return 'Google Calendar is temporarily unavailable. Try again later.';
    return `Calendar request failed (${status}). Try again.`;
  }
  /** Independent live range read; never replaces Today or stores Calendar in Firestore. */
  async readRange(from: string, through: string): Promise<CalendarCommitment[]> {
    if (!this.valid()) throw new Error('Connect Calendar first.');
    const start = new Date(`${from}T00:00:00`); const end = new Date(`${through}T00:00:00`); end.setDate(end.getDate() + 1);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || +end - +start > 33 * 86400_000) throw new Error('Choose a valid date range of up to 32 days.');
    const generation = this.authGeneration; const token = this.token!; const events: CalendarCommitment[] = []; const seen = new Set<string>(); let page: string | undefined;
    do {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events'); url.searchParams.set('timeMin', start.toISOString()); url.searchParams.set('timeMax', end.toISOString()); url.searchParams.set('singleEvents', 'true'); url.searchParams.set('orderBy', 'startTime'); if (page) url.searchParams.set('pageToken', page);
      const response = await this.request(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (generation !== this.authGeneration || !this.valid()) throw new Error('Calendar connection changed.');
      if (response.status === 401) { this.clearSession(); throw new Error('Calendar session expired.'); }
      if (!response.ok) throw new Error(this.failureMessage(response.status));
      const data = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string };
      for (const event of data.items ?? []) { const plannedStart = event.start?.dateTime ?? event.start?.date; const plannedEnd = event.end?.dateTime ?? event.end?.date; if (event.status !== 'cancelled' && plannedStart && plannedEnd) events.push({ id: event.id, accountId: 'current-oauth-session', calendarId: 'primary', title: event.summary ?? 'Untitled event', plannedStart, plannedEnd, allDay: !event.start.dateTime }); }
      page = data.nextPageToken; if (page && seen.has(page)) throw new Error('Calendar repeated a page.'); if (page) seen.add(page);
    } while (page);
    if (generation !== this.authGeneration || !this.valid()) throw new Error('Calendar connection changed.'); return events;
  }
  async addTask(title: string, open: (url: string) => void = url => { window.open(url, '_blank', 'noopener'); }) {
    const { start, end } = nextHalfHourSlot();
    if (!this.valid()) { open(calendarTemplate(title, start, end)); return; }
    const response = await this.request('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: title, start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
    });
    if (response.status === 401) { this.clearSession(); open(calendarTemplate(title, start, end)); return; }
    if (!response.ok) throw new Error(this.failureMessage(response.status));
    await this.loadToday();
  }
}
