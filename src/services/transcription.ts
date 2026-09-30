export interface TranscriptionSession { stop(): void }
export interface TranscriptionProvider { available(): boolean; start(onText: (text: string) => void, onEnd: () => void, onIssue: (message: string) => void): TranscriptionSession }
interface SpeechResultEvent { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
interface BrowserRecognition { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: SpeechResultEvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void; abort(): void }
type RecognitionConstructor = new () => BrowserRecognition;
function recognition() { const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }; return w.SpeechRecognition ?? w.webkitSpeechRecognition; }
export class BrowserSpeechProvider implements TranscriptionProvider {
  available() { return typeof window !== 'undefined' && Boolean(recognition()); }
  start(onText: (text: string) => void, onEnd: () => void, onIssue: (message: string) => void) {
    const Constructor = recognition(); if (!Constructor) throw new Error('Voice is unavailable in this browser. Write instead.');
    const speech = new Constructor(); speech.lang = navigator.language || 'en-IN'; speech.continuous = true; speech.interimResults = true;
    speech.onresult = e => onText(Array.from(e.results).map(result => result[0].transcript).join(' '));
    speech.onend = onEnd;
    speech.onerror = () => { onIssue('Voice did not finish. Your words are still here; you can keep writing.'); onEnd(); };
    speech.start();
    return { stop() { speech.onresult = null; speech.onend = null; speech.onerror = null; speech.stop(); onEnd(); } };
  }
}
