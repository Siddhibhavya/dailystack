import { expect, it } from 'vitest';
import { availability, availabilityText } from '../src/services/availability';
import { personalInsights } from '../src/services/insights';
it('exports only availability, merges busy overlaps and respects maybe windows', () => {
 const events = [{ id: 'private', accountId: 'secret', calendarId: 'primary', title: 'Private health appointment', plannedStart: new Date('2026-09-30T09:00:00').toISOString(), plannedEnd: new Date('2026-09-30T10:00:00').toISOString(), allDay: false }];
 const rows = availability(events, '2026-09-30', '2026-09-30', 8, 12, [{ start: new Date('2026-09-30T10:00:00').toISOString(), end: new Date('2026-09-30T11:00:00').toISOString() }]); expect(rows.map(r => r.state)).toEqual(['FREE', 'BUSY', 'MAYBE', 'FREE']); const text = availabilityText(rows); expect(text).not.toContain('Private'); expect(text).not.toContain('secret'); expect(Object.keys(rows[0])).toEqual(['start', 'end', 'state']);
});
it('requires valid ranges and avoids invented insights when history is empty', () => { expect(() => availability([], '2026-09-30', '2026-09-01', 8, 22)).toThrow(); expect(personalInsights([], [], [])).toEqual([]); });
