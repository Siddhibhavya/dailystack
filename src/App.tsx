import { useCallback, useEffect, useState } from 'react';
import type { LifeService } from './services/lifeService';
import type { CalendarService } from './services/calendarService';
import { nextHalfHourSlot } from './services/calendarService';
import { downloadBackup } from './services/backup';
import { readTheme, setTheme } from './services/theme';
import { RecordsScreen } from './components/RecordsScreen';
import { Onboarding } from './components/Onboarding';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { personalInsights } from './services/insights';
import { MeTimeScreen, RemindersScreen, MemoryScreen } from './components/PersonalScreens';
import { CycleScreen } from './components/CycleScreen';
import { MemoBoard } from './components/MemoBoard';
import { CarePanel } from './components/CareForms';
import { AddButton, Toggle } from './components/Controls';
import { dateKey as localDayKey } from './services/productService';
import { TaskList } from './components/TaskList';
import { CalendarPanel } from './components/CalendarPanel';
import { HomeScreen, LineIcon, type LogKind } from './components/HomeScreen';
import { LogSheet } from './components/LogSheet';
import { DEFAULT_PREFERENCES, type PreferencesSettings, type Task } from './domain/models';
import type { ProductService } from './services/productService';
import { JournalScreen } from './components/JournalScreen';
import { TimelineScreen } from './components/TimelineScreen';
import { SyncSettings } from './components/SyncSettings';
import type { SyncEngine } from './services/syncEngine';
import type { FirebaseIdentity } from './services/firebaseCloud';
type Snapshot = Awaited<ReturnType<LifeService['snapshot']>>;
const primary = ['Today', 'Calendar', 'Journal', 'Projects', 'Insights'];
const secondary = ['Insights', 'Cycle', 'Reminders', 'Me Time', 'What this app knows', 'Settings', 'Timeline', 'Availability', 'Logs'];
function currentScreen() { const name = decodeURIComponent(location.hash.slice(1)); return [...primary, ...secondary].includes(name) ? name : 'Today'; }
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
export function App({ life, product, calendar, sync = null, identity = null }: { life: LifeService; product: ProductService; calendar: CalendarService; sync?: SyncEngine | null; identity?: FirebaseIdentity | null }) {
  const [screen, setScreen] = useState(currentScreen);
  const [data, setData] = useState<Snapshot>({ tasks: [], activities: [], active: null, projects: [] });
  const [productData, setProductData] = useState<Awaited<ReturnType<ProductService['snapshot']>>>({ journals: [], cycles: [], observations: [], memories: [], reminders: [], preferences: [], meals: [], hydration: [], careRoutines: [], careLogs: [], suggestions: [] });
  const [preferenceEdits, setPreferenceEdits] = useState<Partial<PreferencesSettings>>({});
  const preferences = { ...(productData.preferences[0] ?? DEFAULT_PREFERENCES), ...preferenceEdits };
  const [migration, setMigration] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, updateTheme] = useState(readTheme);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [calendarTask, setCalendarTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogKind | 'choose' | null>(null);
  const refresh = useCallback(async () => { setData(await life.snapshot()); setProductData(await product.snapshot()); setMigration(await life.migrationNeeded()); setReady(true); }, [life, product]);
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
  const changePreferences = (edits: Partial<PreferencesSettings>) => { if (busy) return; setPreferenceEdits(edits); act(async () => { try { await product.savePreferences(edits); await refresh(); } finally { setPreferenceEdits({}); } }); };
  const navigate = (name: string) => { location.hash = encodeURIComponent(name); };
  const list = (tasks: Task[]) => <TaskList tasks={tasks} activities={data.activities} active={data.active} now={now} life={life} act={act} calendarAction={setCalendarTask} disabled={migration || busy || !ready} />;
  const activeProjects = new Set(data.projects.filter(p => p.status === 'active').map(p => p.id));
  const priorities = data.tasks.filter(t => (t.priority || t.pinnedToday) && !t.completed && (!t.projectId || activeProjects.has(t.projectId)));
  const finishOnboarding = useCallback(() => { void refresh(); }, [refresh]);
  const day = new Date(now);

  const date = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const todaySegments = data.activities.filter(a => a.startTime < new Date(new Date(now).setHours(24, 0, 0, 0)).toISOString() && (!a.endTime || a.endTime >= new Date(new Date(now).setHours(0, 0, 0, 0)).toISOString()));
  if (ready && !preferences.onboardingComplete && !data.tasks.length && !migration) return <Onboarding product={product} identity={identity} sync={sync} done={finishOnboarding} />;
  return <div className={`${screen === 'Today' ? 'app-shell home-shell' : 'app-shell'} ${preferences.gentleDate === localDayKey() ? 'gentle' : ''}`}>
    <aside className="sidebar"><a className="brand" href="#Today">My Life<span>A little room for your day.</span></a>
      <nav aria-label="Primary navigation">{['Today', 'Calendar', 'Journal', 'Projects', 'Insights'].map((name, index) => <span className={name === 'Insights' ? 'nav-item nav-insights' : 'nav-item'} key={name}>{index === 2 && <AddButton className="universal-log" label="Log something" onClick={() => setLog('choose')} />}<a href={`#${name}`} aria-current={screen === name ? 'page' : undefined}><LineIcon kind={name} /><span>{name}</span></a></span>)}</nav>
      <details className="secondary-nav"><summary>Your other things</summary><nav aria-label="Secondary navigation">{secondary.filter(name => name !== 'Cycle' || preferences.modules.cycle).map(name => <a key={name} href={`#${encodeURIComponent(name)}`} aria-current={screen === name ? 'page' : undefined}>{name}</a>)}</nav></details>
      <p className="storage-note">Saved on this device.<br />{online ? 'Sync preferences are in Settings.' : 'Offline. Your notebook still works.'}</p>
    </aside>
    <main id="main-content">
      <header className="topbar"><span>{date}</span><div><Toggle label="Dark mode" checked={theme === 'dark'} onChange={on => updateTheme(on ? 'dark' : 'light')} />{install && <button onClick={() => act(async () => { await install.prompt(); await install.userChoice; setInstall(null); })}>Install app</button>}</div></header>
      {error && <div className="message error" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="message" role="status">{notice}</div>}
      {!ready && !error && <p role="status">Opening your notebook…</p>}
      {migration && <section className="migration paper-section"><h2>Your Daily Stack tasks are here.</h2><p>Save a recovery copy, then bring them into My Life. Their original data will stay on this device.</p>
        <button onClick={() => act(async () => downloadBackup(await life.migrationBackup(), 'dailystack-before-migration.json'))}>Export original tasks</button>
        <button disabled={busy} onClick={() => act(async () => { const count = await life.migrate(); setNotice(`${count} tasks imported and verified. Original data and a recovery copy are preserved.`); })}>Back up &amp; import tasks</button>
      </section>}
      <div className="content" aria-busy={busy}>
      {screen === 'Today' && <HomeScreen now={now} calendar={calendar} priorities={priorities} activities={todaySegments} taskList={list(priorities)} navigate={navigate} onLog={setLog} preferredName={preferences.preferredName} modules={preferences.modules} />}
      {screen === 'Today' && <section className="paper-section"><Toggle label="Gentle Mode" checked={preferences.gentleDate === localDayKey()} onChange={on => changePreferences({ gentleDate: on ? localDayKey() : null })} />{preferences.gentleDate === localDayKey() && <p>We're doing less today. That's the plan.</p>}<CarePanel product={product} data={productData} act={act} hydrationEnabled={preferences.modules.hydration} /></section>}
      {screen === 'Calendar' && <CalendarPanel calendar={calendar} act={act} />}
      {screen === 'Projects' && <MemoBoard data={data} now={now} life={life} product={product} act={act} calendarAction={setCalendarTask} showCompleted={preferences.showCompleted} setShowCompleted={showCompleted => changePreferences({ showCompleted })} />}
      {screen === 'Journal' && <JournalScreen entries={productData.journals} suggestions={productData.suggestions} product={product} act={act} />}
      {screen === 'Timeline' && <TimelineScreen activities={data.activities} calendar={calendar} product={product} act={act} now={now} />}
      {screen === 'Cycle' && <CycleScreen records={productData.cycles} enabled={preferences.modules.cycle} product={product} act={act} />}
      {screen === 'Me Time' && <MeTimeScreen product={product} gentle={preferences.gentleDate === localDayKey()} enabled={preferences.modules.meTime} act={act} />}
      {screen === 'Reminders' && <RemindersScreen product={product} reminders={productData.reminders} events={calendar.getSnapshot().events} act={act} />}
      {screen === 'What this app knows' && <MemoryScreen product={product} records={productData.memories} projects={data.projects} act={act} />}
      {screen === 'Logs' && <RecordsScreen data={productData} product={product} act={act} />}
      {screen === 'Availability' && <AvailabilityScreen calendar={calendar} />}
      {screen === 'Insights' && <section className="paper-section"><p className="eyebrow">Over time</p><h1>Things you might notice.</h1>{personalInsights(data.activities, productData.observations, productData.cycles, calendar.getSnapshot().events).length ? personalInsights(data.activities, productData.observations, productData.cycles, calendar.getSnapshot().events).map(text => <p key={text}>{text}</p>) : <p className="muted">Still learning your rhythms. There is not enough recorded history yet.</p>}<p className="small muted">Only recorded entries are included. Nothing to score.</p></section>}
      {screen === 'Settings' && <section className="paper-section"><h1>Your settings</h1><SyncSettings sync={sync} identity={identity} calendar={calendar} act={act} /><h2>Your name</h2><label>Preferred name<input maxLength={100} defaultValue={preferences.preferredName} onBlur={e => changePreferences({ preferredName: e.target.value })} /></label><h2>Features</h2>{(Object.keys(preferences.modules) as Array<keyof typeof preferences.modules>).map(key => <Toggle key={key} label={key === 'cycle' ? 'Cycle tracking' : key === 'meTime' ? 'Me Time' : key === 'food' ? 'Food' : 'Hydration'} checked={preferences.modules[key]} onChange={on => changePreferences({ modules: { ...preferences.modules, [key]: on } })} />)}<p className="small muted">Hiding a feature preserves its existing data.</p><h2>Reminder preferences</h2>{(Object.keys(preferences.routines) as Array<keyof typeof preferences.routines>).map(key => <Toggle key={key} label={{ water: 'Water reminders', meals: 'Meal reminders', morning: 'Morning routine', evening: 'Evening routine' }[key]} checked={preferences.routines[key]} onChange={on => changePreferences({ routines: { ...preferences.routines, [key]: on } })} />)}<a href="#Reminders">Choose reminder times</a><h2>Your device</h2><p className="small muted">Device: {life.deviceId}<br />Local database available offline.</p><h2>Your data</h2><p>Your notebook is saved locally first. Choose private cloud synchronization below.</p><button onClick={() => act(async () => downloadBackup(await life.exportBackup()))}>Export local backup</button><button onClick={() => act(async () => { const granted = await navigator.storage?.persist?.(); setNotice(granted ? 'Persistent storage is enabled for this browser.' : 'This browser has not granted persistent storage. Keep a backup of important data.'); })}>Protect local storage</button><p className="small muted">Backups contain personal data. Keep them somewhere private. Import/restore is not included yet.</p><h2>Other places</h2>{secondary.filter(s => s !== 'Settings').map(s => <p key={s}><button className="text-link" onClick={() => navigate(s)}>{s} →</button></p>)}</section>}
      {secondary.includes(screen) && screen !== 'Settings' && screen !== 'Insights' && screen !== 'Timeline' && screen !== 'Cycle' && screen !== 'Me Time' && screen !== 'Reminders' && screen !== 'What this app knows' && screen !== 'Availability' && screen !== 'Logs' && <section className="paper-section"><p className="eyebrow">Room to grow</p><h1>{screen}</h1><p className="muted">This space will be built in a later phase. Nothing is being inferred or saved here yet.</p></section>}
      </div>
    </main>
    {log && <LogSheet product={product} cycleEnabled={preferences.modules.cycle} kind={log} close={() => setLog(null)} navigate={navigate} select={kind => { if (kind === 'Task') { setLog(null); navigate('Projects'); setTimeout(() => document.getElementById('new-task')?.focus(), 0); } else setLog(kind); }} />}
    {calendarTask && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="calendar-add-title" className="paper-section dialog"><h2 id="calendar-add-title">Add this task to Google Calendar?</h2><p>{calendarTask.title}</p><p className="muted">A 30-minute planned event starting at {nextHalfHourSlot().start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This will not log actual activity.</p><button onClick={() => { const task = calendarTask; setCalendarTask(null); act(async () => { await calendar.addTask(task.title); setNotice(calendar.getSnapshot().connected ? 'The planned event was added.' : 'Opened Google Calendar. Save the event there when you’re ready.'); }); }}>Add to Calendar</button><button autoFocus onClick={() => setCalendarTask(null)}>Cancel</button></section></div>}
  </div>;
}
