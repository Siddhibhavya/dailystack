import { useState, useSyncExternalStore } from 'react';
import type { CalendarService } from '../services/calendarService';
export function CommitmentList({ calendar }: { calendar: CalendarService }) {
  const state = useSyncExternalStore(calendar.subscribe, calendar.getSnapshot);
  return <>
    {state.loading && <p className="muted" role="status">Getting today’s commitments…</p>}
    {state.error && <p role="status" className="muted">{state.error}</p>}
    {!state.connected && !state.error && <p className="muted">Connect Calendar to see what’s planned.</p>}
    {state.fetchedAt && <>
      <ul className="commitments">{state.events.map(event => <li key={event.id}>
        <span className="event-time">{event.allDay ? 'All day' : `${new Date(event.plannedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(event.plannedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>
        <span>{event.title}</span>
      </li>)}</ul>
      {!state.events.length && <p className="muted">Nothing on your calendar today.</p>}
      <p className="small muted">Live Calendar · checked {new Date(state.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
    </>}
  </>;
}
export function CalendarPanel({ calendar, act }: { calendar: CalendarService; act: (action: () => Promise<unknown>) => void }) {
  const state = useSyncExternalStore(calendar.subscribe, calendar.getSnapshot);
  const [clientId, setClientId] = useState(() => calendar.clientId());
  return <section className="paper-section"><p className="eyebrow">Planned life</p><h1>Calendar</h1>
    <p className="muted">Your commitments belong here. What actually happened has its own place.</p>
    <div className="inline-actions">{state.connected ? <><button onClick={() => act(() => calendar.loadToday())} disabled={state.loading}>Refresh today</button><button onClick={() => calendar.disconnect()}>Disconnect</button></> : <button onClick={() => act(async () => calendar.connect())}>Connect Google Calendar</button>}</div>
    <CommitmentList calendar={calendar} />
    <details className="setup"><summary>Calendar setup</summary>
      <p className="small muted">Use your existing Google OAuth web client ID. Calendar API must be enabled and this site’s origin authorized. This is separate from Firebase.</p>
      <form onSubmit={e => { e.preventDefault(); act(async () => calendar.saveClientId(clientId)); }}>
        <label htmlFor="oauth-client">Google OAuth client ID</label>
        <input id="oauth-client" autoComplete="off" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Your web client ID" />
        <button type="submit">Save setup</button>
      </form>
    </details>
  </section>;
}
