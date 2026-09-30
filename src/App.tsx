import { useCallback, useEffect, useState } from 'react';
import type { LifeService } from './services/lifeService';
import type { CalendarService } from './services/calendarService';
import { nextHalfHourSlot } from './services/calendarService';
import { downloadBackup } from './services/backup';
import { readTheme, setTheme } from './services/theme';
import { TaskList } from './components/TaskList';
import { CatCompanion } from './components/CatCompanion';
import { CalendarPanel } from './components/CalendarPanel';
import { HomeScreen, LineIcon, type LogKind } from './components/HomeScreen';
import { LogSheet } from './components/LogSheet';
import type { Task } from './domain/models';
type Snapshot = Awaited<ReturnType<LifeService['snapshot']>>;
const primary = ['Today', 'Calendar', 'Journal', 'Projects', 'Insights'];
const secondary = ['Insights', 'Cycle', 'Reminders', 'Me Time', 'What this app knows', 'Settings'];
function currentScreen() { const name = decodeURIComponent(location.hash.slice(1)); return [...primary, ...secondary].includes(name) ? name : 'Today'; }
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
export function App({ life, calendar }: { life: LifeService; calendar: CalendarService }) {
  const [screen, setScreen] = useState(currentScreen);
  const [data, setData] = useState<Snapshot>({ tasks: [], activities: [], active: null, projects: [] });
  const [migration, setMigration] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const [newTask, setNewTask] = useState('');
  const [theme, updateTheme] = useState(readTheme);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [calendarTask, setCalendarTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogKind | 'choose' | null>(null);
  const refresh = useCallback(async () => { setData(await life.snapshot()); setMigration(await life.migrationNeeded()); setReady(true); }, [life]);
  useEffect(() => {
    void refresh().catch(e => setError(String(e)));
    const unsubscribe = life.subscribe(() => { void refresh().catch(e => setError(String(e))); });
    const hash = () => setScreen(currentScreen());
    const connectivity = () => { setOnline(navigator.onLine); if (!navigator.onLine) calendar.invalidateLiveData(); else if (calendar.getSnapshot().connected) void calendar.loadToday(); };
    const installer = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const visible = () => { if (document.visibilityState === 'visible') { void refresh().catch(e => setError(String(e))); if (calendar.getSnapshot().connected && navigator.onLine) void calendar.loadToday(); } };
    window.addEventListener('hashchange', hash); window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
    window.addEventListener('beforeinstallprompt', installer); document.addEventListener('visibilitychange', visible);
    return () => { unsubscribe(); clearInterval(tick); window.removeEventListener('hashchange', hash); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); window.removeEventListener('beforeinstallprompt', installer); document.removeEventListener('visibilitychange', visible); };
  }, [life, calendar, refresh]);
  useEffect(() => { setTheme(theme); }, [theme]);
  const dateKey = new Date(now).toDateString();
  useEffect(() => { if (calendar.getSnapshot().connected && navigator.onLine) void calendar.loadToday(); }, [calendar, dateKey]);
  const act = (action: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(null); void action().then(refresh).catch(e => setError(e instanceof Error ? e.message : 'Could not save. Please try again.')).finally(() => setBusy(false)); };
  const navigate = (name: string) => { location.hash = encodeURIComponent(name); };
  const list = (tasks: Task[]) => <TaskList tasks={tasks} activities={data.activities} active={data.active} now={now} life={life} act={act} calendarAction={setCalendarTask} disabled={migration || busy || !ready} />;
  const activeProjects = new Set(data.projects.filter(p => p.status === 'active').map(p => p.id));
  const priorities = data.tasks.filter(t => t.priority && !t.completed && (!t.projectId || activeProjects.has(t.projectId)));
  const day = new Date(now);

  const date = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const todaySegments = data.activities.filter(a => a.startTime < new Date(new Date(now).setHours(24, 0, 0, 0)).toISOString() && (!a.endTime || a.endTime >= new Date(new Date(now).setHours(0, 0, 0, 0)).toISOString()));
  return <div className={screen === 'Today' ? 'app-shell home-shell' : 'app-shell'}>
    <aside className="sidebar"><a className="brand" href="#Today">My Life<span>A little room for your day.</span></a>
      <nav aria-label="Primary navigation">{['Today', 'Calendar', 'Journal', 'Projects', 'Insights'].map((name, index) => <span className={name === 'Insights' ? 'nav-item nav-insights' : 'nav-item'} key={name}>{index === 2 && <button className="universal-log" aria-label="Log something" onClick={() => setLog('choose')}>+</button>}<a href={`#${name}`} aria-current={screen === name ? 'page' : undefined}><LineIcon kind={name} /><span>{name}</span></a></span>)}</nav>
      <details className="secondary-nav"><summary>Your other things</summary><nav aria-label="Secondary navigation">{secondary.map(name => <a key={name} href={`#${encodeURIComponent(name)}`} aria-current={screen === name ? 'page' : undefined}>{name}</a>)}</nav></details>
      <p className="storage-note">Saved on this device.<br />{online ? 'Cloud sync is not connected.' : 'Offline. Your tasks still work.'}</p>
    </aside>
    <main id="main-content">
      <header className="topbar"><span>{date}</span><div><button onClick={() => updateTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? 'Dark' : 'Light'} mode</button>{install && <button onClick={() => act(async () => { await install.prompt(); await install.userChoice; setInstall(null); })}>Install app</button>}</div></header>
      {error && <div className="message error" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="message" role="status">{notice}</div>}
      {!ready && !error && <p role="status">Opening your notebook…</p>}
      {migration && <section className="migration paper-section"><h2>Your Daily Stack tasks are here.</h2><p>Save a recovery copy, then bring them into My Life. Their original data will stay on this device.</p>
        <button onClick={() => act(async () => downloadBackup(await life.migrationBackup(), 'dailystack-before-migration.json'))}>Export original tasks</button>
        <button disabled={busy} onClick={() => act(async () => { const count = await life.migrate(); setNotice(`${count} tasks imported and verified. Original data and a recovery copy are preserved.`); })}>Back up &amp; import tasks</button>
      </section>}
      <div className="content" aria-busy={busy}>
      {screen === 'Today' && <HomeScreen now={now} calendar={calendar} priorities={priorities} activities={todaySegments} taskList={list(priorities)} navigate={navigate} onLog={setLog} />}
      {screen === 'Calendar' && <CalendarPanel calendar={calendar} act={act} />}
      {screen === 'Projects' && <section className="paper-section"><p className="eyebrow">Room for what matters</p><h1>Projects &amp; tasks</h1><p className="muted">Your existing tasks, with their time intact. Project planning will grow from here.</p>
        <form className="add-task" onSubmit={e => { e.preventDefault(); act(async () => { await life.addTask(newTask); setNewTask(''); }); }}><label className="sr-only" htmlFor="new-task">New task</label><input id="new-task" value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Something to remember…" maxLength={140} disabled={migration || !ready} /><button disabled={migration || busy || !ready}>Add task</button></form>
        {!data.tasks.length && <p className="muted">Nothing written here yet.</p>}{list(data.tasks)}
      </section>}
      {screen === 'Journal' && <section className="paper-section journal-shell"><p className="eyebrow">Lived life</p><h1>A place for your day.</h1><CatCompanion state="listening" /><p>Morning thoughts. Evening stories. Whatever happened in between.</p><p className="muted">Journal writing and optional voice input arrive in a later phase. Your original words will be kept separately from any suggestions.</p></section>}
      {screen === 'Insights' && <section className="paper-section"><p className="eyebrow">Over time</p><h1>Things you might notice.</h1><p className="muted">As your history grows, this becomes a place to understand your time, energy and days. Nothing to score.</p></section>}
      {screen === 'Settings' && <section className="paper-section"><h1>Your settings</h1><h2>Your data</h2><p>Tasks and activity sessions are saved locally first. Cloud synchronization is not enabled in this phase.</p><button onClick={() => act(async () => downloadBackup(await life.exportBackup()))}>Export local backup</button><button onClick={() => act(async () => { const granted = await navigator.storage?.persist?.(); setNotice(granted ? 'Persistent storage is enabled for this browser.' : 'This browser has not granted persistent storage. Keep a backup of important data.'); })}>Protect local storage</button><p className="small muted">Backups contain personal data. Keep them somewhere private. Import/restore is not included yet.</p><h2>Other places</h2>{secondary.filter(s => s !== 'Settings').map(s => <p key={s}><button className="text-link" onClick={() => navigate(s)}>{s} →</button></p>)}</section>}
      {secondary.includes(screen) && screen !== 'Settings' && screen !== 'Insights' && <section className="paper-section"><p className="eyebrow">Room to grow</p><h1>{screen}</h1><p className="muted">This space will be built in a later phase. Nothing is being inferred or saved here yet.</p></section>}
      </div>
    </main>
    {log && <LogSheet kind={log} close={() => setLog(null)} navigate={navigate} select={kind => { if (kind === 'Task') { setLog(null); navigate('Projects'); setTimeout(() => document.getElementById('new-task')?.focus(), 0); } else setLog(kind); }} />}
    {calendarTask && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="calendar-add-title" className="paper-section dialog"><h2 id="calendar-add-title">Add this task to Google Calendar?</h2><p>{calendarTask.title}</p><p className="muted">A 30-minute planned event starting at {nextHalfHourSlot().start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This will not log actual activity.</p><button onClick={() => { const task = calendarTask; setCalendarTask(null); act(async () => { await calendar.addTask(task.title); setNotice(calendar.getSnapshot().connected ? 'The planned event was added.' : 'Opened Google Calendar. Save the event there when you’re ready.'); }); }}>Add to Calendar</button><button autoFocus onClick={() => setCalendarTask(null)}>Cancel</button></section></div>}
  </div>;
}
