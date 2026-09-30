import { useState, useSyncExternalStore } from 'react';
import type { ActivitySegment } from '../domain/models';
import type { ProductService } from '../services/productService';
import { dateKey, localDateTime } from '../services/productService';
import type { CalendarService } from '../services/calendarService';
import { AddButton } from './Controls';
export function ActivityForm({ product, original, done }: { product: ProductService; original?: ActivitySegment; done: () => void }) {
  const [title, setTitle] = useState(original?.title ?? '');
  const [start, setStart] = useState(localDateTime(original ? new Date(original.startTime) : new Date(Date.now() - 30 * 60000)));
  const [end, setEnd] = useState(localDateTime(original?.endTime ? new Date(original.endTime) : new Date()));
  const [issue, setIssue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return <form className="life-form" onSubmit={e => { e.preventDefault(); setSaving(true); void product.activity(title, new Date(start).toISOString(), new Date(end).toISOString(), original?.id).then(done).catch(() => setIssue('Check the title and times. Pause a running timer before editing.')).finally(() => setSaving(false)); }}><h2>Something I did</h2><label>What happened?<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={1000} /></label><label>Started<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /></label><label>Ended<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required /></label><p className="small muted">This records actual life. Your Calendar stays as planned.</p><button disabled={saving}>Save activity</button>{issue && <p role="status">{issue}</p>}</form>;
}
export function TimelineScreen({ activities, calendar, product, act, now }: { activities: ActivitySegment[]; calendar: CalendarService; product: ProductService; act: (fn: () => Promise<unknown>) => void; now: number }) {
  const cal = useSyncExternalStore(calendar.subscribe, calendar.getSnapshot);
  const [day, setDay] = useState(dateKey(new Date(now)));
  const [editing, setEditing] = useState<ActivitySegment | 'new' | null>(null);
  const [split, setSplit] = useState<Record<string, string>>({});
  const start = new Date(`${day}T00:00:00`).getTime(); const end = new Date(start); end.setDate(end.getDate() + 1); const span = end.getTime() - start;
  const rows = [...cal.events.filter(e => Date.parse(e.plannedStart) < end.getTime() && Date.parse(e.plannedEnd) > start).map(e => ({ id: e.id, title: e.title, start: e.plannedStart, end: e.plannedEnd, kind: 'Planned', activity: undefined as ActivitySegment | undefined })), ...activities.filter(a => Date.parse(a.startTime) < end.getTime() && Date.parse(a.endTime ?? new Date(now).toISOString()) >= start).map(a => ({ id: a.id, title: a.title, start: a.startTime, end: a.endTime ?? new Date(now).toISOString(), kind: 'Actual', activity: a }))].sort((a, b) => a.start.localeCompare(b.start));
  return <section className="paper-section"><div className="section-heading"><h1>Your actual day</h1><AddButton aria-label="Log an activity" onClick={() => setEditing('new')} /></div><label>Day<input type="date" value={day} onChange={e => setDay(e.target.value)} /></label><p className="small muted">Dashed is planned. Solid is actual. Blank space can stay blank.</p>
    {editing && <><ActivityForm product={product} original={editing === 'new' ? undefined : editing} done={() => setEditing(null)} /><button onClick={() => setEditing(null)}>Cancel</button></>}
    <div className="notch-chart"><div className="notch-hours"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>{dateKey(new Date(now)) === day && <div className="now-notch" style={{ left: `${Math.max(0, Math.min(100, (now - start) / span * 100))}%` }} aria-label="Current time" />}
    {rows.map(row => { const left = Math.max(0, (Date.parse(row.start) - start) / span * 100); const right = Math.min(100, (Date.parse(row.end) - start) / span * 100); return <div className={`notch-row ${row.kind.toLowerCase()}`} key={`${row.kind}-${row.id}`}><span className="notch-bar" style={{ left: `${left}%`, width: `${Math.max(.4, right - left)}%` }} /><p><strong>{row.title}</strong> · {row.kind}<br /><time>{new Date(row.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(row.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></p>{row.activity && <details><summary>Correct this activity</summary><button onClick={() => setEditing(row.activity!)}>Edit times / title</button><button onClick={() => act(() => product.deleteActivity(row.id))}>Remove activity</button><label>Split at<input type="datetime-local" value={split[row.id] ?? ''} onChange={e => setSplit(s => ({ ...s, [row.id]: e.target.value }))} /></label><button disabled={!split[row.id]} onClick={() => act(() => product.splitActivity(row.id, new Date(split[row.id]).toISOString()))}>Split activity</button></details>}</div>; })}</div>
    {!rows.length && <p className="muted">Nothing recorded here yet. Free time can stay free.</p>}{day !== dateKey(new Date(now)) && <p className="small muted">Calendar currently loads today's events only. Historical actual activities remain available.</p>}
  </section>;
}
