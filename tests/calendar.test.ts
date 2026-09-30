import { describe, expect, it, vi } from 'vitest';
import { CalendarService, calendarTemplate, nextHalfHourSlot, type GoogleIdentity } from '../src/services/calendarService';
type Callback = Parameters<GoogleIdentity['accounts']['oauth2']['initTokenClient']>[0]['callback'];
async function connected() {
  let callback: Callback = () => {};
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [] })));
  const google: GoogleIdentity = { accounts: { oauth2: {
    initTokenClient(options) { callback = options.callback; return { requestAccessToken() { callback({ access_token: 'test-only-memory-token', expires_in: 3600 }); } }; }, revoke: vi.fn(),
  } } };
  const storage = { getItem: () => 'test.apps.googleusercontent.com', setItem: vi.fn() };
  const service = new CalendarService(storage, () => google, request);
  service.connect(); await vi.waitFor(() => expect(service.getSnapshot().loading).toBe(false)); request.mockClear();
  return { service, request, google, storage };
}
const event = (id: string) => ({ id, summary: `Event ${id}`, start: { dateTime: '2026-09-30T09:00:00Z' }, end: { dateTime: '2026-09-30T18:00:00Z' } });
describe('Google Calendar service without real credentials', () => {
  it('uses the existing GIS token flow and never stores access tokens', async () => {
    const { service, storage, google } = await connected(); expect(service.getSnapshot().connected).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled(); service.disconnect(); expect(google.accounts.oauth2.revoke).toHaveBeenCalled();
    expect(service.getSnapshot().events).toEqual([]);
  });
  it('fetches every page with no-store and maps only planned commitments', async () => {
    const { service, request } = await connected();
    request.mockResolvedValueOnce(new Response(JSON.stringify({ items: [event('1')], nextPageToken: 'page2' }))).mockResolvedValueOnce(new Response(JSON.stringify({ items: [event('2')] })));
    await service.loadToday(new Date('2026-09-30T12:00:00Z'));
    expect(service.getSnapshot().events).toHaveLength(2); expect(new URL(String(request.mock.calls[1][0])).searchParams.get('pageToken')).toBe('page2');
    expect(request.mock.calls.every(([, options]) => options?.cache === 'no-store')).toBe(true);
    expect(service.getSnapshot().events[0]).not.toHaveProperty('actualStart');
    expect(request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });
  it.each([403, 429, 500])('surfaces HTTP %s and clears previous events', async status => {
    const { service, request } = await connected(); request.mockResolvedValueOnce(new Response(JSON.stringify({ items: [event('1')] })));
    await service.loadToday(); request.mockResolvedValueOnce(new Response('{}', { status })); await service.loadToday();
    expect(service.getSnapshot().error).toBeTruthy(); expect(service.getSnapshot().events).toEqual([]); expect(service.getSnapshot().fetchedAt).toBeNull();
  });
  it('clears an expired session', async () => {
    const { service, request } = await connected(); request.mockResolvedValueOnce(new Response('{}', { status: 401 })); await service.loadToday();
    expect(service.getSnapshot().connected).toBe(false); expect(service.getSnapshot().error).toContain('expired');
  });
  it('discards a delayed response after disconnect', async () => {
    const { service, request } = await connected(); let resolve!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise(r => { resolve = r; })); const load = service.loadToday();
    service.disconnect(); resolve(new Response(JSON.stringify({ items: [event('old')] }))); await load;
    expect(service.getSnapshot().events).toEqual([]); expect(service.getSnapshot().connected).toBe(false);
  });
  it('detects broken pagination and never publishes a partial list', async () => {
    const { service, request } = await connected(); request.mockImplementation(async () => new Response(JSON.stringify({ items: [event('1')], nextPageToken: 'same' })));
    await service.loadToday(); expect(service.getSnapshot().events).toEqual([]); expect(service.getSnapshot().error).toContain('repeated');
  });
  it('creates events only on explicit addTask and reports failed creation', async () => {
    const { service, request } = await connected(); request.mockResolvedValueOnce(new Response('{}', { status: 403 }));
    await expect(service.addTask('Read')).rejects.toThrow('denied');
    expect(request.mock.calls[0][1]?.method).toBe('POST');
  });
  it('retains the disconnected prefilled Calendar link', async () => {
    const service = new CalendarService({ getItem: () => null, setItem() {} }, () => undefined, vi.fn()); const open = vi.fn();
    await service.addTask('Draw & rest', open); expect(new URL(open.mock.calls[0][0]).searchParams.get('text')).toBe('Draw & rest');
    const { start, end } = nextHalfHourSlot(new Date('2026-09-30T10:45:00Z')); expect(end.getTime() - start.getTime()).toBe(1800000);
    expect(new URL(calendarTemplate('A', start, end)).searchParams.get('dates')).toBe('20260930T110000Z/20260930T113000Z');
  });
  it('ignores a late consent response after disconnect', () => {
    let callback!: Callback;
    const request = vi.fn<typeof fetch>();
    const identity: GoogleIdentity = { accounts: { oauth2: { initTokenClient(options) { callback = options.callback; return { requestAccessToken() {} }; }, revoke() {} } } };
    const service = new CalendarService({ getItem: () => 'test.apps.googleusercontent.com', setItem() {} }, () => identity, request);
    service.connect(); service.disconnect(); callback({ access_token: 'late-test-token', expires_in: 3600 });
    expect(service.getSnapshot().connected).toBe(false); expect(request).not.toHaveBeenCalled();
  });
});
