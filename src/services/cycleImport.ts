import type { Cycle, Metadata } from '../domain/models';
export type CycleInput = Omit<Cycle, keyof Metadata>;
export function validDay(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateCycle(value: unknown): value is CycleInput {
 if (!value || typeof value !== 'object') return false; const r = value as Record<string, unknown>;
 return validDay(r.periodStart) && (r.periodEnd === undefined || validDay(r.periodEnd) && r.periodEnd >= r.periodStart) && typeof r.notes === 'string' && Array.isArray(r.symptoms) && r.symptoms.every(s => typeof s === 'string' && s.length <= 300) && Array.isArray(r.flow) && r.flow.every(f => f && validDay(f.date) && ['light', 'medium', 'heavy'].includes(f.level));
}
export function previewCycleImport(text: string) {
 const parsed: unknown = JSON.parse(text); if (!Array.isArray(parsed) || parsed.length > 5000) throw new Error('Use a JSON array with up to 5,000 cycle records.');
 const valid: CycleInput[] = []; const rejected: number[] = []; const seen = new Set<string>();
 parsed.forEach((row, index) => { const clean = row && typeof row === 'object' ? { periodStart: row.periodStart, ...(row.periodEnd ? { periodEnd: row.periodEnd } : {}), notes: row.notes ?? '', symptoms: row.symptoms ?? [], flow: row.flow ?? [], importedFrom: 'user-json-import' } : row; if (!validateCycle(clean) || seen.has(clean.periodStart)) rejected.push(index + 1); else { valid.push(clean); seen.add(clean.periodStart); } });
 const dates = valid.flatMap(r => [r.periodStart, r.periodEnd ?? r.periodStart]).sort();
 return { detected: parsed.length, valid, rejected, from: dates[0], to: dates.at(-1) };
}
