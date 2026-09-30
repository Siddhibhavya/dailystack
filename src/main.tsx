import { createRoot } from 'react-dom/client';
import { App } from './App';
import { IndexedDbRepository } from './data/indexedDb';
import { createLifeService } from './services/lifeService';
import { CalendarService } from './services/calendarService';
import './styles/tokens.css';
import './styles/app.css';
async function start() {
  const repository = await IndexedDbRepository.open();
  const life = await createLifeService(repository, localStorage);
  const calendar = new CalendarService(localStorage);
  createRoot(document.getElementById('root')!).render(<App life={life} calendar={calendar} />);
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
