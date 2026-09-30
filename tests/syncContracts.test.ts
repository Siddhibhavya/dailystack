import { expect, it } from 'vitest';
import { metadata, DEFAULT_SYNC_POLICY, type Journal } from '../src/domain/models';
import { canSync, journalConflict, structuredWinner } from '../src/services/syncContracts';
it('keeps all cloud categories off until explicitly enabled', () => {
  expect(canSync(DEFAULT_SYNC_POLICY, 'journals')).toBe(false);
  expect(canSync({ enabled: true, categories: { tasks: true } }, 'journals')).toBe(false);
  expect(canSync({ enabled: true, categories: { tasks: true } }, 'tasks')).toBe(true);
});
it('uses the same structured winner in either merge order, including tombstones', () => {
  const a = metadata('a', '2026-09-30T10:00:00Z'); const b = { ...a, deviceId: 'b', deletedAt: '2026-09-30T10:00:00Z' };
  expect(structuredWinner(a, b)).toEqual(structuredWinner(b, a)); expect(structuredWinner(a, b).deletedAt).not.toBeNull();
});
it('preserves both conflicting original journal texts for review', () => {
  const left: Journal = { ...metadata('a'), kind: 'general', originalTranscription: 'My first thoughts', source: 'manual', date: '2026-09-30' };
  const right = { ...left, deviceId: 'b', originalTranscription: 'My other thoughts' };
  expect(journalConflict(left, right)).toEqual({ versions: [left, right], needsReview: true });
});
it('breaks identical-metadata ties consistently between tabs on the same device', () => {
  const a = { ...metadata('same-device'), title: 'A' }; const b = { ...a, title: 'B' };
  expect(structuredWinner(a, b)).toEqual(structuredWinner(b, a));
});
