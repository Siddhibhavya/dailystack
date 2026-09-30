import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { AccountRepository } from '../src/data/accountRepository';
import { createLifeService } from '../src/services/lifeService';
it('isolates local notebooks by Firebase UID while preserving the original notebook', async () => {
  const repo = await AccountRepository.open();
  const life = await createLifeService(repo, { getItem: () => null });
  try {
    await repo.selectAccount('user-a'); await life.addTask('A private task');
    await repo.selectAccount('user-b'); expect((await life.snapshot()).tasks).toHaveLength(0); expect(repo.legacyAllowed()).toBe(false);
    await life.addTask('B private task'); await repo.selectAccount('user-a');
    expect((await life.snapshot()).tasks.map(t => t.title)).toEqual(['A private task']);
    await repo.selectAccount('user-b'); expect((await life.snapshot()).tasks.map(t => t.title)).toEqual(['B private task']);
  } finally { life.close(); repo.close(); }
});
