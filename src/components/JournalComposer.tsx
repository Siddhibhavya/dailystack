import { useEffect, useRef, useState } from 'react';
import type { ProductService } from '../services/productService';
import { BrowserSpeechProvider, type TranscriptionSession } from '../services/transcription';
import type { Journal } from '../domain/models';
import { Pill } from './Controls';
export function JournalComposer({ product, voice = false, original, done }: { product: ProductService; voice?: boolean; original?: Journal; done: () => void }) {
  const [text, setText] = useState(original?.originalTranscription ?? '');
  const [kind, setKind] = useState<Journal['kind']>(original?.kind ?? (new Date().getHours() >= 18 ? 'evening' : 'morning'));
  const [listening, setListening] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const session = useRef<TranscriptionSession | null>(null);
  const usedVoice = useRef(false);
  useEffect(() => () => { session.current?.stop(); }, []);
  const start = () => {
    if (listening) { session.current?.stop(); return; }
    setIssue(null); const speech = new BrowserSpeechProvider();
    if (!speech.available()) { setIssue('Voice is unavailable here. Write instead.'); return; }
    const prefix = text;
    try { usedVoice.current = true; setListening(true); session.current = speech.start(words => setText(`${prefix}${prefix ? '\n' : ''}${words}`), () => setListening(false), setIssue); }
    catch { setListening(false); setIssue('Microphone access did not start. You can keep writing.'); }
  };
  return <form className="life-form" onSubmit={e => { e.preventDefault(); session.current?.stop(); setSaving(true); setIssue(null); void product.journal(text, kind, usedVoice.current ? 'voice' : 'manual', original?.revisionOf ?? original?.id).then(done).catch(() => setIssue('Could not save. Your draft is still here. Try again.')).finally(() => setSaving(false)); }}>
    <h2>{kind === 'evening' ? 'How was your day?' : kind === 'morning' ? 'Morning. How are you feeling?' : 'A little note.'}</h2>
    <div className="pill-row">{(['morning', 'evening', 'general'] as const).map(k => <Pill key={k} selected={kind === k} onClick={() => setKind(k)}>{k}</Pill>)}</div>
    <label>Your words<textarea autoFocus={!voice} value={text} onChange={e => setText(e.target.value)} rows={7} maxLength={200000} placeholder="Whatever is on your mind." /></label>
    <p className="small muted">Your words are kept as written. Any possible suggestions wait for you to confirm them.</p>
    {voice && !listening && <p className="small muted">Browser speech may use your browser provider's online service. Only start if you're comfortable with that; writing works offline.</p>}
    <button type="button" onClick={start} aria-pressed={listening}>{listening ? 'Stop listening' : 'Talk'}</button><button disabled={!text.trim() || saving}>Save journal</button>
    {original && <p className="small muted">This saves a new version. The original writing stays recoverable.</p>}{issue && <p role="status">{issue}</p>}
  </form>;
}
