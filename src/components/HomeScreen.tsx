import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { ActivitySegment, Task, PreferencesSettings } from '../domain/models';
import type { CalendarService } from '../services/calendarService';
import { CatCompanion } from './CatCompanion';
export type LogKind = 'Talk' | 'Something I did' | 'Task' | 'Food' | 'Body / mood' | 'Period' | 'Note';
export const logKinds: LogKind[] = ['Talk', 'Something I did', 'Task', 'Food', 'Body / mood', 'Period', 'Note'];
export function LineIcon({ kind }: { kind: string }) {
  const paths: Record<string, ReactNode> = {
    Today: <><path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" /></>,
    Calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-11 4h.01M14 15h.01" /></>,
    Journal: <><path d="M5 3h13a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V5a2 2 0 0 1 1-2ZM7 3v18m4-13h5m-5 4h5" /></>,
    Projects: <><path d="M3 8V5h6l2 3h10v12H3Z" /><path d="M8 13h8m-8 3h5" /></>,
    Insights: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></>,
    Talk: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8" /></>,
    Food: <><path d="M5 3v6m3-6v6M3 3v6a3 3 0 0 0 6 0m-3 3v9m13-18c-4 1-5 7-2 9h3V3Zm1 9v9" /></>,
    'Body / mood': <><path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><path d="M8 10h.01m8-.01h.01M8 14q4 4 8 0" /></>,
    Period: <><path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z" /><path d="M8 15q0 3 3 3" /></>,
    'Something I did': <><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l3 3m6 6 3 3M6 18l3-3m6-6 3-3" /></>,
    Note: <><path d="M4 4h16v12l-4 4H4Z" /><path d="M8 9h8m-8 4h5m3 7v-4h4" /></>,
    Task: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8 12 3 3 5-6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] ?? paths.Note}</svg>;
}
export function HomeScreen({ now, calendar, priorities, activities, taskList, navigate, onLog, preferredName, modules }: {
  preferredName: string; modules: PreferencesSettings['modules']; now: number; calendar: CalendarService; priorities: Task[]; activities: ActivitySegment[];
  taskList: ReactNode; navigate: (screen: string) => void; onLog: (kind: LogKind) => void;
}) {
  const calendarState = useSyncExternalStore(calendar.subscribe, calendar.getSnapshot);
  const today = new Date(now); const evening = today.getHours() >= 18;
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return date; });
  const items = [
    ...calendarState.events.map(event => ({ id: `plan:${event.id}`, title: event.title, time: event.allDay ? 'All day' : new Date(event.plannedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: event.allDay ? new Date(today).setHours(0, 0, 0, 0) : Date.parse(event.plannedStart), end: Date.parse(event.plannedEnd), kind: 'Planned' })),
    ...activities.map(activity => ({ id: activity.id, title: activity.title, time: new Date(activity.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: Date.parse(activity.startTime), end: activity.endTime ? Date.parse(activity.endTime) : now, kind: 'Actual' })),
  ].sort((a, b) => a.at - b.at);
  const relevant = [
    ...items.filter(item => item.kind === 'Actual').slice(-2),
    ...items.filter(item => item.kind === 'Planned' && item.end >= now).slice(0, 2),
  ].sort((a, b) => a.at - b.at);
  const preview = relevant.length ? relevant : items.slice(-3);
  return <>
    <section className="home-welcome"><div><h1>Hi, {preferredName || 'you'}.</h1><p>{today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · A little room for your day.</p></div><span className="hello-sun" aria-hidden="true">✳</span></section>
    <div className="date-strip" aria-label="This week">{week.map(date => {
      const current = date.toDateString() === today.toDateString();
      return <div key={date.toISOString()} className={current ? 'date-day is-today' : 'date-day'} aria-current={current ? 'date' : undefined}><span>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{date.getDate()}</strong></div>;
    })}</div>
    <div className="home-composition">
      <section className={`checkin-hero ${evening ? 'evening' : ''}`}>
        <div className="hero-copy"><p className="hero-label">{evening ? 'A little evening check-in' : 'A little check-in'}</p>{evening && <p className="miau">miau miau miau miau miau</p>}<h2>{evening ? 'How was your day?' : 'How are you feeling?'}</h2><p>{evening ? 'The whole story, or just a little of it.' : 'Tell me what’s going on today.'}</p></div>
        <div className="cat-scene"><span className="scene-sun" /><span className="scene-cloud cloud-one" /><span className="scene-cloud cloud-two" /><span className="scene-spark spark-one">✧</span><span className="scene-spark spark-two">✧</span><div className="cat-ground" /><CatCompanion state={evening ? 'sleeping' : 'idle'} /><svg className="scene-flower" viewBox="0 0 60 95" aria-hidden="true"><path d="M30 90V38M30 68Q8 70 8 54q20-1 22 14m0-12q23-1 23-19-20 0-23 19" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M30 24c-28-24-29 18-9 15-4 25 27 24 22 2 23 4 22-26 2-21 0-23-29-24-15 4" fill="var(--strawberry)" /><circle cx="33" cy="30" r="7" fill="var(--sunny)" /></svg></div>
        <div className="hero-actions"><button className="talk-button" onClick={() => onLog('Talk')}><LineIcon kind="Talk" />Hold to talk</button><button className="write-button" onClick={() => onLog('Note')}>Write instead <span aria-hidden="true">↗</span></button></div>
      </section>
      <section className="today-preview"><div className="section-heading"><h2>Today</h2><button onClick={() => navigate('Timeline')}>View timeline <span aria-hidden="true">↗</span></button></div><p className="section-note">A little of what’s planned. A little of what happened.</p>
        {calendarState.loading && <p className="small muted" role="status">Checking your Calendar…</p>}
        {calendarState.error && <p className="small muted">{calendarState.error}</p>}
        {preview.length ? <ol className="day-preview-list">{preview.map(item => <li key={item.id} className={item.kind.toLowerCase()}><time>{item.time}</time><span className="timeline-dot" /><div><strong>{item.title}</strong><span>{item.kind}</span></div></li>)}</ol> : <div className="day-open"><span className="open-line" /><p>Your day has room.<br /><span>Connect Calendar or log a little of it.</span></p><button onClick={() => navigate('Calendar')}>Connect Calendar <span aria-hidden="true">↗</span></button></div>}
        <div className="home-priorities"><h3>A few priorities</h3>{priorities.length ? taskList : <p className="small muted">Choose what matters. Leave room for the rest.</p>}<button className="text-link" onClick={() => navigate('Projects')}>Your tasks <span aria-hidden="true">↗</span></button></div>
      </section>
      <section className="quick-log"><div className="section-heading"><h2>Quick Log</h2><span className="small muted">Just a little note.</span></div><div className="quick-log-track">{(['Body / mood', 'Food', 'Period', 'Something I did', 'Note'] as LogKind[]).filter(kind => (kind !== 'Period' || modules.cycle) && (kind !== 'Food' || modules.food)).map((kind, index) => <button className={`quick-log-card quick-${index}`} key={kind} onClick={() => onLog(kind)}><LineIcon kind={kind} /><strong>{kind === 'Body / mood' ? 'Mood / body' : kind === 'Period' ? 'Period / symptoms' : kind}</strong><span>{['How’s it feeling?', 'Have you eaten yet?', 'Keep a little note.', 'That happened.', 'Whatever’s on your mind.'][index]}</span><span className="quick-arrow" aria-hidden="true">↗</span></button>)}</div></section>
    </div>
  </>;
}
