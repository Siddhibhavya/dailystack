import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IndexedDbRepository } from '../src/data/indexedDb';
import { ProductService } from '../src/services/productService';
import { createLifeService, type LifeService } from '../src/services/lifeService';
let repo: IndexedDbRepository; let product: ProductService; let life: LifeService;
beforeEach(async () => { repo = await IndexedDbRepository.open(`product-${crypto.randomUUID()}`); life = await createLifeService(repo, { getItem: () => null }); product = new ProductService(repo, life.deviceId, life.refreshFromRepository); });
afterEach(() => { life.close(); repo.close(); vi.unstubAllGlobals(); });
it('keeps original writing exactly and stores edited writing as a separate revision', async () => {
  const first = await product.journal('  My words.\nExactly like this.  ', 'morning', 'manual');
  const revision = await product.journal('New writing', 'evening', 'manual', first.id);
  expect((await repo.get('journals', first.id))?.originalTranscription).toBe('  My words.\nExactly like this.  ');
  expect(revision.revisionOf).toBe(first.id); expect(await repo.list('journals')).toHaveLength(2);
});
it('requires confirmation before journal suggestions create observations or tasks', async () => {
  await product.journal("I'm tired. I have a headache. I need to buy groceries.", 'morning', 'manual');
  const suggestions = await repo.list('suggestions'); expect(suggestions).toHaveLength(3);
  expect(await repo.list('observations')).toHaveLength(0); expect(await repo.list('tasks')).toHaveLength(0); expect(await repo.list('memories')).toHaveLength(0);
  const task = suggestions.find(s => s.kind === 'task')!; await Promise.all([product.decideSuggestion(task.id, true), product.decideSuggestion(task.id, true)]);
  expect(await repo.list('tasks')).toHaveLength(1);
  await product.decideSuggestion(suggestions.find(s => s.kind === 'symptom')!.id, false); expect(await repo.list('observations')).toHaveLength(0);
});
it('creates, edits, splits and tombstones actual activities without Calendar writes', async () => {
  const activity = await product.activity('College', '2026-09-30T09:00:00.000Z', '2026-09-30T18:00:00.000Z');
  await product.activity('College', activity.startTime, '2026-09-30T16:30:00.000Z', activity.id);
  await product.splitActivity(activity.id, '2026-09-30T12:00:00.000Z');
  const rows = await repo.list('activities'); expect(rows).toHaveLength(2); expect(rows.find(r => r.id === activity.id)?.endTime).toBe('2026-09-30T12:00:00.000Z');
  await product.deleteActivity(activity.id); expect((await repo.get('activities', activity.id))?.deletedAt).toBeTruthy(); expect((await life.snapshot()).activities).toHaveLength(1);
});
it('rejects invalid splits and prevents edits to a running timer', async () => {
  await life.addTask('Draw'); const task = (await life.snapshot()).tasks[0]; await life.toggleTimer(task.id); const active = (await repo.list('activities'))[0];
  await expect(product.deleteActivity(active.id)).rejects.toThrow('Pause');
  await life.toggleTimer(task.id); await expect(product.splitActivity(active.id, '2000-01-01T00:00:00.000Z')).rejects.toThrow('inside');
  await expect(product.activity('Wrong times', '2026-09-30T18:00:00.000Z', '2026-09-30T09:00:00.000Z')).rejects.toThrow('end after');
});
it('imports validated cycle history atomically, preserves source metadata and skips existing dates on retries', async () => {
 const text = JSON.stringify([{ periodStart: '2026-01-01', periodEnd: '2026-01-06' }, { periodStart: '2026-03-01', symptoms: ['cramps'] }, { periodStart: '2026-02-30' }]);
 expect(await product.importCycles(text)).toBe(2); expect(await product.importCycles(text)).toBe(0); expect((await repo.list('cycles')).every(c => c.importedFrom?.startsWith('json:'))).toBe(true); expect(await product.importCycles(JSON.stringify([{ periodStart: '2026-01-01' }]))).toBe(0);
});
it('retains cycle records when feature visibility is disabled and excludes photos from cloud categories', async () => {
 await product.add('cycles', { periodStart: '2026-09-01', notes: '', flow: [], symptoms: [] }); await product.savePreferences({ modules: { cycle: true, food: true, meTime: true, hydration: true } }); await product.savePreferences({ modules: { cycle: false, food: true, meTime: true, hydration: true } }); expect((await product.snapshot()).cycles).toHaveLength(1); expect((await product.preferences()).modules.cycle).toBe(false);
 const { SYNC_TABLES } = await import('../src/services/syncRecords'); expect(SYNC_TABLES).not.toContain('photos');
});
