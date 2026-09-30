import { useEffect, useState } from 'react';
import type { SyncEngine, SyncSnapshot } from '../services/syncEngine';
import type { FirebaseIdentity } from '../services/firebaseCloud';
import type { CalendarService } from '../services/calendarService';
import type { SyncCategory } from '../domain/models';
import { Toggle } from './Controls';
const categories: Array<[SyncCategory, string]> = [['tasks', 'Tasks'], ['projects', 'Projects'], ['activities', 'Actual timeline'], ['journals', 'Journal'], ['cycles', 'Cycle'], ['observations', 'Mood / body'], ['symptoms', 'Symptoms'], ['memories', 'Profile, preferences & routines'], ['reminders', 'Reminders'], ['meals', 'Food descriptions'], ['hydration', 'Hydration'], ['careRoutines', 'Care routines'], ['careLogs', 'Care completions'], ['suggestions', 'Journal suggestions'], ['preferences', 'Account name and module settings']];
export function SyncSettings({ sync, identity, calendar, act }: { sync: SyncEngine | null; identity: FirebaseIdentity | null; calendar: CalendarService; act: (action: () => Promise<unknown>) => void }) {
  const [state, setState] = useState<SyncSnapshot | null>(sync?.getSnapshot() ?? null);
  const [cal, setCal] = useState(calendar.getSnapshot());
  const [waiting, setWaiting] = useState(false);
  const [authIssue, setAuthIssue] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const changePolicy = (policy: NonNullable<typeof state>['policy']) => {
    if (!sync || !state || savingPolicy) return;
    setState({ ...state, policy }); setSavingPolicy(true);
    act(async () => { try { await sync.setPolicy(policy); } finally { setState(sync.getSnapshot()); setSavingPolicy(false); } });
  };
  useEffect(() => sync?.subscribe(() => setState(sync.getSnapshot())), [sync]);
  useEffect(() => calendar.subscribe(() => setCal(calendar.getSnapshot())), [calendar]);
  const authenticate = (signingOut = false) => {
    if (!identity || !sync || waiting) return;
    setWaiting(true); setAuthIssue(null);
    // Open the popup from the click, rather than waiting behind local data refreshes.
    void (signingOut ? sync.setAccount(null).then(() => identity.signOut()) : identity.signIn()).catch(() => setAuthIssue(signingOut ? 'Could not sign out. Please try again.' : 'Sign-in did not finish. You can keep using this device and try again. Check pop-up permissions if needed.')).finally(() => setWaiting(false));
  };
  return <div className="sync-settings">
    <section><h2>My Life account</h2>{state?.account ? <><p>Signed in as {state.account.email ?? 'your My Life account'}</p><button disabled={waiting} onClick={() => authenticate(true)}>Sign out</button><p className="small muted">Signing out keeps your local notebook and stops cloud sync.</p><details><summary>Account identifier</summary><p className="small">{state.account.uid}</p></details></> : <><p className="muted">Your notebook works without signing in.</p><button disabled={!identity || waiting} onClick={() => authenticate()}>Sign in to My Life</button>{!identity && <p className="small muted">Cloud configuration is unavailable in this build.</p>}</>}{authIssue && <p role="status">{authIssue}</p>}</section>
    {state && sync && <><section><h2>Sync</h2><p role="status">{state.status}</p>{state.lastSuccess && <p className="small muted">Last successful sync: {new Date(state.lastSuccess).toLocaleString()}</p>}{state.issue && <p role="status">{state.issue}</p>}{state.conflicts > 0 && <p>Writing has been preserved in conflict copies. Export your notebook to review both versions; both versions are visible in Journal.</p>}
      <Toggle label="Sync between my devices" checked={state.policy.enabled} disabled={savingPolicy} onChange={enabled => changePolicy({ ...state.policy, enabled })} />
      <button disabled={!state.account || !state.policy.enabled || state.accountMismatch || state.status === 'Syncing'} onClick={() => { void sync.syncNow(); }}>Sync now</button></section>
      <section><h2>Sync this data</h2><p className="small muted">Choose what may leave this device. Life records start off. Minimal account name and module settings sync by default. Turning a category off preserves any copies already in your cloud account.</p>
      {categories.map(([key, label]) => <Toggle key={key} label={label} checked={state.policy.categories[key] === true} disabled={savingPolicy} onChange={enabled => changePolicy({ ...state.policy, categories: { ...state.policy.categories, [key]: enabled } })} />)}
      <p className="small muted">Cycle and mood/body sync also require Symptoms to be enabled, so symptom text is never downloaded or uploaded through another category. Meal photos remain local in this phase.</p></section></>}
    <section><h2>Google Calendar</h2><p>{cal.connected ? 'Connected through separate Google Calendar consent. The current Calendar flow does not provide an account email.' : 'Not connected.'}</p><p className="small muted">Calendar permission is separate from My Life sign-in. You may use different Google accounts.</p><a className="text-link" href="#Calendar">Manage connection →</a></section>
  </div>;
}
