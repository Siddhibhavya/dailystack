import type { JournalSuggestion } from '../domain/models';
export type Suggestion = Pick<JournalSuggestion, 'kind' | 'value'>;
export interface ExtractionProvider { suggest(text: string): Promise<Suggestion[]> }
/** Small deterministic suggestions only; never modifies Calendar or persistent memory. */
export const extractSuggestions: ExtractionProvider = { async suggest(text) {
  const suggestions: Suggestion[] = [];
  if (/\b(i am|i'm|i feel)\s+(very )?(tired|exhausted)\b/i.test(text)) suggestions.push({ kind: 'energy', value: 'low' });
  if (/\b(i have|i've got|my)\s+(a )?(headache|migraine|cramps)\b/i.test(text)) suggestions.push({ kind: 'symptom', value: text.match(/headache|migraine|cramps/i)![0].toLowerCase() });
  const task = text.match(/\b(i need to|remind me to)\s+([^.!?\n]{3,140})/i);
  if (task) suggestions.push({ kind: 'task', value: task[2].trim() });
  return suggestions;
} };
