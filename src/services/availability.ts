import type { CalendarCommitment } from '../domain/models';
export interface AvailabilitySlot { start: string; end: string; state: 'FREE' | 'BUSY' | 'MAYBE' }
export function availability(events: CalendarCommitment[], from: string, to: string, startHour: number, endHour: number, maybe: Array<{ start: string; end: string }> = []): AvailabilitySlot[] {
 const first = new Date(`${from}T00:00:00`); const last = new Date(`${to}T00:00:00`); if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || last < first || (last.getTime() - first.getTime()) / 86400_000 > 31 || startHour < 0 || endHour > 24 || endHour <= startHour) throw new Error('Choose up to 32 days and valid hours.');
 const slots: AvailabilitySlot[] = []; for (const day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
  const start = new Date(day); start.setHours(startHour, 0, 0, 0); const end = new Date(day); end.setHours(endHour, 0, 0, 0);
  const eventTime = (v: string) => Date.parse(v.length === 10 ? `${v}T00:00:00` : v);
  const busy = events.map(e => ({ start: eventTime(e.plannedStart), end: eventTime(e.plannedEnd) })).filter(e => e.start < +end && e.end > +start);
  const possible = maybe.map(e => ({ start: Date.parse(e.start), end: Date.parse(e.end) })).filter(e => e.start < +end && e.end > +start);
  const points = [...new Set([+start, +end, ...[...busy, ...possible].flatMap(e => [Math.max(+start, e.start), Math.min(+end, e.end)])])].sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i++) { const a = points[i]; const b = points[i + 1]; const state = busy.some(e => e.start < b && e.end > a) ? 'BUSY' : possible.some(e => e.start < b && e.end > a) ? 'MAYBE' : 'FREE'; const previous = slots.at(-1); if (previous?.state === state && Date.parse(previous.end) === a) previous.end = new Date(b).toISOString(); else slots.push({ start: new Date(a).toISOString(), end: new Date(b).toISOString(), state }); }
 } return slots;
}
export function availabilityText(slots: AvailabilitySlot[]) { return ['Availability', ...slots.map(s => `${new Date(s.start).toLocaleDateString()} ${new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${s.state}`)].join('\n'); }
export function downloadAvailabilityImage(slots: AvailabilitySlot[]) {
 const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 120 + slots.length * 48; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#22211e'; ctx.font = 'bold 32px sans-serif'; ctx.fillText('Availability', 36, 60); ctx.font = '22px sans-serif'; availabilityText(slots).split('\n').slice(1).forEach((line, i) => ctx.fillText(line, 36, 112 + i * 48)); canvas.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'availability.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
}
