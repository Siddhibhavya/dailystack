import type { ActivitySegment, CalendarCommitment, Observation, Cycle } from '../domain/models';
export function personalInsights(activities: ActivitySegment[], observations: Observation[], cycles: Cycle[], planned: CalendarCommitment[] = []) {
 const results: string[] = []; const finished = activities.filter(a => !a.deletedAt && a.endTime);
 if (finished.length >= 3) { const minutes = Math.round(finished.reduce((n, a) => n + Math.max(0, Date.parse(a.endTime!) - Date.parse(a.startTime)), 0) / 60_000); results.push(`${finished.length} finished activities recorded, with about ${minutes} minutes remembered. Overlapping activities may count twice.`); }
 const checkins = observations.filter(o => !o.deletedAt && o.energy); if (checkins.length >= 3) results.push(`${checkins.filter(o => o.energy === 'very-low' || o.energy === 'low').length} of your ${checkins.length} energy check-ins were low. These are your recorded check-ins, not every day.`);
 const starts = cycles.filter(c => !c.deletedAt).map(c => c.periodStart); const near = checkins.filter(o => starts.some(s => { const days = (Date.parse(o.date) - Date.parse(s)) / 86400_000; return days >= 0 && days <= 3; }));
 if (near.length >= 3 && near.filter(o => o.energy === 'low' || o.energy === 'very-low').length >= 2) results.push('You logged low energy near the beginning of several recorded periods. This is a pattern in the entries, not a medical explanation.');
 const matches = planned.map(p => ({ p, a: finished.find(a => a.title.trim().toLowerCase() === p.title.trim().toLowerCase() && new Date(a.startTime).toDateString() === new Date(p.plannedStart).toDateString()) })).filter(m => m.a);
 if (matches.length) { const early = matches.filter(m => Date.parse(m.a!.endTime!) < Date.parse(m.p.plannedEnd)).length; if (early) results.push(`${early} of today's matching activities ended before the Calendar plan. Calendar stays unchanged.`); }
 return results;
}
