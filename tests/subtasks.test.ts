import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { IndexedDbRepository } from '../src/data/indexedDb';
import { createLifeService } from '../src/services/lifeService';
it('keeps nested checklist IDs stable, allows independent completion and deterministic reordering', async () => {
 const repo = await IndexedDbRepository.open(crypto.randomUUID()); const life = await createLifeService(repo, { getItem: () => null });
 try { const parent = (await life.addTask('Portfolio', { kind: 'checklist' }))!; const a = (await life.addTask('Research', { parentTaskId: parent.id }))!; const b = (await life.addTask('Screens', { parentTaskId: parent.id }))!; const nested = (await life.addTask('Export', { parentTaskId: b.id }))!;
 await life.setCompleted(a.id); expect((await repo.get('tasks', parent.id))?.completed).toBe(false); await life.setCompleted(a.id); expect((await repo.get('tasks', a.id))?.completed).toBe(false);
 await life.editTask(b.id, { title: 'Screenshots' }); await life.reorderTask(b.id, -1); expect((await repo.get('tasks', b.id))?.sortOrder).toBe(0); expect((await repo.get('tasks', a.id))?.sortOrder).toBe(1); expect((await repo.get('tasks', nested.id))?.parentTaskId).toBe(b.id);
 await life.toggleTimer(nested.id); await life.setCompleted(parent.id, true); const snapshot = await life.snapshot(); expect(snapshot.tasks).toHaveLength(0); expect(snapshot.active).toBeNull(); expect(snapshot.activities[0].endTime).toBeTruthy(); expect(await repo.list('tasks')).toHaveLength(4); expect((await repo.list('tasks')).every(t => t.deletedAt && t.syncStatus === 'pending')).toBe(true);
 } finally { life.close(); repo.close(); }
});
