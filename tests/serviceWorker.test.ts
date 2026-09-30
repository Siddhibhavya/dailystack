import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync('public/service-worker.js', 'utf8');
function worker() {
  const listeners = new Map<string, (event: { request?: unknown; waitUntil?: (value: Promise<unknown>) => void; respondWith?: (value: Promise<unknown>) => void }) => void>();
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn().mockResolvedValue(new Response('offline shell')) };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(['dailystack-v1', 'my-life-app-old', 'some-other-app']), delete: vi.fn().mockResolvedValue(true) };
  const fetch = vi.fn().mockRejectedValue(new Error('offline'));
  const self = { location: { origin: 'https://my-life.test' }, addEventListener: (name: string, fn: typeof listeners extends Map<string, infer V> ? V : never) => listeners.set(name, fn), clients: { claim: vi.fn() }, skipWaiting: vi.fn() };
  runInNewContext(source, { self, caches, fetch, URL, Response });
  return { listeners, cache, caches, fetch };
}
function request(url: string, authorization = false, mode = 'cors') { return { url, method: 'GET', headers: new Headers(authorization ? { Authorization: 'Bearer test' } : {}), mode }; }
describe('service worker privacy and offline shell', () => {
  it.each(['https://www.googleapis.com/calendar/v3/calendars/primary/events', 'https://accounts.google.com/gsi/client', 'https://other.test/public', 'https://my-life.test/oauth/token', 'https://my-life.test/?access_token=test'])('never intercepts %s', url => {
    const { listeners, caches } = worker(); const respondWith = vi.fn(); listeners.get('fetch')!({ request: request(url), respondWith });
    expect(respondWith).not.toHaveBeenCalled(); expect(caches.open).not.toHaveBeenCalled();
  });
  it('never intercepts an authenticated same-origin asset', () => {
    const { listeners } = worker(); const respondWith = vi.fn(); listeners.get('fetch')!({ request: request('https://my-life.test/index.html', true), respondWith }); expect(respondWith).not.toHaveBeenCalled();
  });
  it('ignores arbitrary same-origin requests', () => {
    const { listeners } = worker(); const respondWith = vi.fn(); listeners.get('fetch')!({ request: request('https://my-life.test/private-notes.json'), respondWith }); expect(respondWith).not.toHaveBeenCalled();
  });
  it('uses a precached shell when navigation is offline', async () => {
    const { listeners, cache } = worker(); let result!: Promise<Response>;
    listeners.get('fetch')!({ request: request('https://my-life.test/', false, 'navigate'), respondWith: value => { result = value as Promise<Response>; } });
    expect(await (await result).text()).toBe('offline shell'); expect(cache.match).toHaveBeenCalledWith('/index.html');
  });
  it('cleans only this app caches, including the old unsafe cache', async () => {
    const { listeners, caches } = worker(); let completion!: Promise<unknown>; listeners.get('activate')!({ waitUntil: value => { completion = value; } }); await completion;
    expect(caches.delete.mock.calls.map(call => call[0])).toEqual(['dailystack-v1', 'my-life-app-old']);
  });
});
