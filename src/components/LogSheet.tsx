import { useEffect, useRef } from 'react';
import { LineIcon, logKinds, type LogKind } from './HomeScreen';
import type { ProductService } from '../services/productService';
import { JournalComposer } from './JournalComposer';
import { FoodForm, BodyForm } from './CareForms';
import { ActivityForm } from './TimelineScreen';
export function LogSheet({ kind, close, select, navigate, product, cycleEnabled = true }: { kind: LogKind | 'choose'; close: () => void; select: (kind: LogKind) => void; navigate: (screen: string) => void; product: ProductService; cycleEnabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); return () => { dialog.current?.close(); }; }, []);
  return <dialog ref={dialog} className="log-sheet" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}><div className="sheet-handle" /><button className="sheet-close" onClick={close} aria-label="Close log">×</button>
    {kind === 'Talk' || kind === 'Note' ? <JournalComposer product={product} voice={kind === 'Talk'} done={() => { close(); navigate('Journal'); }} /> : kind === 'Something I did' ? <ActivityForm product={product} done={close} /> : kind === 'choose' ? <><p className="eyebrow">A moment from your life</p><h2>What are we logging?</h2><div className="log-options">{logKinds.filter(option => cycleEnabled || option !== 'Period').map(option => <button key={option} onClick={() => select(option)}><LineIcon kind={option} /><span>{option}</span><span aria-hidden="true">↗</span></button>)}</div></> : kind === 'Food' ? <FoodForm product={product} done={close} /> : kind === 'Body / mood' ? <BodyForm product={product} done={close} /> : <><h2>Period</h2><button onClick={() => { close(); navigate('Cycle'); }}>Open cycle log</button></>}
  </dialog>;
}
