import { useState } from 'react';
import type { Journal, JournalSuggestion } from '../domain/models';
import type { ProductService } from '../services/productService';
import { JournalComposer } from './JournalComposer';
import { AddButton } from './Controls';
export function JournalScreen({ entries, suggestions, product, act }: { entries: Journal[]; suggestions: JournalSuggestion[]; product: ProductService; act: (fn: () => Promise<unknown>) => void }) {
  const [editing, setEditing] = useState<Journal | 'new' | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  return <section className="paper-section"><div className="section-heading"><h1>Journal</h1><AddButton aria-label="Write a journal entry" onClick={() => setEditing('new')} /></div>
    {editing && <JournalComposer product={product} original={editing === 'new' ? undefined : editing} done={() => setEditing(null)} />}
    {!entries.length && <p className="muted">Morning thoughts. Evening stories. A little record of your life.</p>}
    {[...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(entry => <article className="journal-page" key={entry.id}><p className="eyebrow">{entry.kind} · {entry.date}{entry.revisionOf ? ' · saved version' : ''}{entry.syncStatus === 'conflict' ? ' · writing preserved for review' : ''}</p><p className="journal-text">{entry.originalTranscription}</p>
      <button onClick={() => setEditing(entry)}>Edit writing</button><button onClick={() => { if (window.confirm('Remove this journal from view? It remains recoverable in your backup.')) act(() => product.remove('journals', entry.id)); }}>Remove</button>
      {suggestions.some(s => s.journalId === entry.id && s.status === 'suggested') && <div className="suggestion-list"><h3>A few things you might want to log</h3>{suggestions.filter(s => s.journalId === entry.id && s.status === 'suggested').map(s => <div key={s.id}><label>{s.kind}<input value={edits[s.id] ?? s.value} onChange={e => setEdits(old => ({ ...old, [s.id]: e.target.value }))} /></label><button onClick={() => act(() => product.decideSuggestion(s.id, true, edits[s.id]))}>Confirm</button><button onClick={() => act(() => product.decideSuggestion(s.id, false))}>Ignore</button></div>)}</div>}
    </article>)}
  </section>;
}
