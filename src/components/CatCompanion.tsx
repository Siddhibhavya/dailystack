import type { ReactNode } from 'react';
export type CatState = 'idle' | 'sleeping' | 'listening' | 'eating' | 'drinking' | 'working' | 'outside' | 'gentle' | 'celebrating';
/** Replace the asset slot with an illustration, Lottie or Rive renderer later. */
export function CatCompanion({ state = 'idle', asset }: { state?: CatState; asset?: ReactNode }) {
  return <div className="cat-companion" data-state={state} role="img" aria-label={`Cat companion, ${state}`}>
    {asset ?? <svg viewBox="0 0 220 170" aria-hidden="true">
      <path d="M163 126c47 12 40-51 23-36" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M56 96c-17 18-14 46 7 48h83c30-5 30-41 10-54" fill="var(--cat-fill)" stroke="currentColor" strokeWidth="3" />
      <path d="M57 73 52 29 85 49c15-7 35-7 51 0l32-20-4 44c10 40-20 52-55 52S46 108 57 73Z" fill="var(--cat-fill)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="m62 45 3 18 13-8m72 0 10-10-2 19" fill="none" stroke="var(--rose)" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="75" cy="98" rx="8" ry="5" fill="var(--rose)" />
      <ellipse cx="143" cy="98" rx="8" ry="5" fill="var(--rose)" />
      <path d="M78 83q7 8 14 0m35 0q7 8 14 0m-38 15 6 4 6-4m-6 4v7m0-1q-9 8-14 0m14 0q9 8 14 0M60 95l-22-4m22 10-23 4m124-10 20-4m-20 10 20 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M84 132v12m44-12v12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="m99 124 10 4 10-4-2 10-8-4-8 4Z" fill="var(--strawberry)" />
    </svg>}
  </div>;
}
