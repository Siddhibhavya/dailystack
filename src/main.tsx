import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AccountRepository } from './data/accountRepository';
import { createLifeService } from './services/lifeService';
import { CalendarService } from './services/calendarService';
import { createFirebaseCloud } from './services/firebaseCloud';
import { SyncEngine } from './services/syncEngine';
import { ProductService } from './services/productService';
import { BrowserNotificationProvider, ReminderScheduler } from './services/reminders';
import './styles/tokens.css';
import './styles/app.css';
async function start() {
  const repository = await AccountRepository.open();
  const legacyStorage = { getItem: (key: string) => repository.legacyAllowed() ? localStorage.getItem(key) : null };
  const life = await createLifeService(repository, legacyStorage);
  const product = new ProductService(repository, life.deviceId, life.refreshFromRepository);
  const reminders = new ReminderScheduler(repository, new BrowserNotificationProvider());
  const checkReminders = () => { void reminders.tick().catch(() => {}); };
  life.subscribe(checkReminders); setInterval(checkReminders, 30_000);
  const calendar = new CalendarService(localStorage);
  let cloud: ReturnType<typeof createFirebaseCloud> = null;
  try { cloud = createFirebaseCloud(); } catch { /* Cloud configuration must never prevent local use. */ }
  const sync = cloud ? new SyncEngine(repository, cloud.transport, life.refreshFromRepository) : null;
  const root = createRoot(document.getElementById('root')!);
  const render = (key = 'local') => root.render(<App key={key} life={life} product={product} calendar={calendar} sync={sync} identity={cloud?.identity ?? null} />);
  render();
  if (sync && cloud) {
    await sync.initialize();
    life.subscribe(sync.localChanged);
    let identityGeneration = 0;
    let lastUid = (await repository.get('meta', 'cloudOwner'))?.value;
    cloud.identity.subscribe(account => {
      const generation = ++identityGeneration;
      if (!account) { void sync.setAccount(null).then(() => render('local')); return; }
      root.render(<p role="status">Opening your private notebook…</p>);
      void (async () => {
        await sync.setAccount(null); await Promise.all([life.idle(), product.idle()]);
        if (generation !== identityGeneration) return;
        await repository.selectAccount(account.uid);
        if (generation !== identityGeneration) return;
        if (lastUid && lastUid !== account.uid) calendar.disconnect();
        lastUid = account.uid;
        await sync.initialize();
        const policy = sync.getSnapshot().policy;
        if (policy.categories.preferences === undefined) await sync.setPolicy({ ...policy, categories: { ...policy.categories, preferences: true } });
        await sync.setAccount(account);
        if (generation === identityGeneration) render(account.uid);
      })().catch(() => { if (generation === identityGeneration) root.render(<p role="alert">Could not open this account’s local notebook. Previous data is preserved. Reload to retry.</p>); });
    });
    window.addEventListener('online', sync.networkChanged);
    window.addEventListener('offline', sync.networkChanged);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.resume(); });
  }
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/service-worker.js'); }
    catch { /* Local tasks work even if browser installation/offline assets are unavailable. */ }
  }
}
void start().catch(() => {
  const root = document.getElementById('root')!;
  const message = document.createElement('p');
  message.textContent = 'Could not open local storage. Your existing Daily Stack data has not been changed. Check browser storage permissions, then reload.';
  root.append(message);
});
