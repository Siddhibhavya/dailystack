import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, collection, initializeFirestore, memoryLocalCache, setDoc, terminate, writeBatch, type Firestore } from 'firebase/firestore';
import { IndexedDbRepository } from '../../src/data/indexedDb';
import { createLifeService } from '../../src/services/lifeService';
import { FirestoreTransport } from '../../src/services/firebaseCloud';
import { SyncEngine } from '../../src/services/syncEngine';
import { metadata, type Journal, type Task } from '../../src/domain/models';
import { ProductService } from '../../src/services/productService';
let environment: RulesTestEnvironment;
const apps: FirebaseApp[] = [];
const databases: Firestore[] = [];
let owner: string;
let db: Firestore;
async function client() {
  const app = initializeApp({ apiKey: 'demo-only-not-a-production-key', projectId: 'demo-my-life', authDomain: 'demo-my-life.firebaseapp.com' }, `test-client-${crypto.randomUUID()}`);
  apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const token = JSON.stringify({ sub: 'my-life-test-owner', email: 'owner@example.test', email_verified: true, name: 'Test Owner' });
  const account = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
  const store = initializeFirestore(app, { localCache: memoryLocalCache() }); connectFirestoreEmulator(store, '127.0.0.1', 8080); databases.push(store);
  return { auth, uid: account.user.uid, store };
}
function newTask(): Task { return { ...metadata(crypto.randomUUID()), title: 'Emulator task', completed: false, notes: '', priority: false, important: false, legacyElapsedSeconds: 0 }; }
beforeAll(async () => {
  if (process.env.GCLOUD_PROJECT !== 'demo-my-life' || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Refusing cloud tests outside demo-my-life emulators.');
  const a = await client(); owner = a.uid; db = a.store;
  const rules = readFileSync('firestore.rules', 'utf8').replace(/request.auth.uid == '[^']+';/, `request.auth.uid == '${owner}';`);
  environment = await initializeTestEnvironment({ projectId: 'demo-my-life', firestore: { host: '127.0.0.1', port: 8080, rules } });
});
beforeEach(async () => environment.clearFirestore());
afterAll(async () => { for (const store of databases) await terminate(store); for (const app of apps) await deleteApp(app); await environment?.cleanup(); });
describe('private Firestore security boundary', () => {
  it('allows only the approved owner to create and read valid records under their UID', async () => {
    const task = newTask(); const ref = doc(db, 'users', owner, 'tasks', task.id);
    await assertSucceeds(setDoc(ref, task)); expect((await assertSucceeds(getDoc(ref))).data()?.title).toBe(task.title);
  });
  it('synchronizes new product categories and nested checklist records through independent devices', async () => {
    const first = await client(); const second = await client(); const a = await IndexedDbRepository.open(crypto.randomUUID()); const b = await IndexedDbRepository.open(crypto.randomUUID());
    const life = await createLifeService(a, { getItem: () => null }); const product = new ProductService(a, life.deviceId, () => {}); const engines = [new SyncEngine(a, new FirestoreTransport(first.store), () => {}, () => true), new SyncEngine(b, new FirestoreTransport(second.store), () => {}, () => true)];
    try {
      const categories = { preferences: true, tasks: true, projects: true, meals: true, hydration: true, careRoutines: true, careLogs: true, observations: true, cycles: true, symptoms: true, reminders: true };
      for (const engine of engines) { await engine.initialize(); await engine.setAccount({ uid: owner, email: null }); await engine.setPolicy({ enabled: true, categories }); }
      await product.savePreferences({ preferredName: 'Test name', onboardingComplete: true }); const parent = (await life.addTask('Memo', { kind: 'checklist' }))!; const child = (await life.addTask('Child', { parentTaskId: parent.id }))!; await life.setCompleted(child.id);
      await product.add('meals', { kind: 'lunch', time: new Date().toISOString(), description: 'Test meal', notes: '', protein: 'unsure', fibre: 'yes' }); await product.add('hydration', { time: new Date().toISOString(), glasses: 1 }); const routine = await product.add('careRoutines', { title: 'Test routine', timeOfDay: 'morning', enabled: true }); await product.add('careLogs', { date: '2026-09-30', routineId: routine.id, status: 'done' }); await product.add('cycles', { periodStart: '2026-09-01', flow: [], notes: '', symptoms: ['test symptom'] }); await product.add('observations', { date: '2026-09-30', energy: 'low', symptoms: [] });
      await engines[0].syncNow(); await engines[1].syncNow(); expect((await b.get('tasks', child.id))?.completed).toBe(true); expect((await b.get('tasks', child.id))?.parentTaskId).toBe(parent.id); expect(await b.list('meals')).toHaveLength(1); expect(await b.list('cycles')).toHaveLength(1); expect((await b.list('preferences'))[0].onboardingComplete).toBe(true); expect(engines.map(e => e.getSnapshot().issue)).toEqual([null, null]);
    } finally { engines.forEach(e => e.close()); life.close(); a.close(); b.close(); }
  });
  it('denies unauthenticated reads and writes', async () => {
    const task = newTask(); const guest = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'users', owner, 'tasks', task.id))); await assertFails(setDoc(doc(guest, 'users', owner, 'tasks', task.id), task));
  });
  it('denies other UIDs, including attempts to read, list, write and delete owner data', async () => {
    const task = newTask(); await setDoc(doc(db, 'users', owner, 'tasks', task.id), task);
    const outsider = environment.authenticatedContext('other-user').firestore();
    await assertFails(getDoc(doc(outsider, 'users', owner, 'tasks', task.id)));
    await assertFails(getDocs(collection(outsider, 'users', owner, 'tasks')));
    await assertFails(setDoc(doc(outsider, 'users', owner, 'tasks', task.id), task));
    await assertFails(deleteDoc(doc(outsider, 'users', owner, 'tasks', task.id)));
    await assertSucceeds(setDoc(doc(outsider, 'users', 'other-user', 'tasks', task.id), task));
  });
  it('rejects owner writes to another UID and unknown/global collections', async () => {
    const task = newTask();
    await assertFails(setDoc(doc(db, 'users', 'other-user', 'tasks', task.id), task));
    await assertFails(setDoc(doc(db, 'tasks', task.id), task));
    await assertFails(setDoc(doc(db, 'users', owner, 'calendarMetadata', task.id), task));
  });
  it('rejects invalid IDs, schema fields, metadata and changed creation time', async () => {
    const task = newTask(); const ref = doc(db, 'users', owner, 'tasks', task.id);
    await assertFails(setDoc(ref, { ...task, id: crypto.randomUUID() }));
    await assertFails(setDoc(ref, { ...task, privateToken: 'dummy' }));
    await assertFails(setDoc(ref, { ...task, version: 0 }));
    await assertFails(setDoc(ref, { ...task, completed: 'true' }));
    await setDoc(ref, task);
    await assertFails(setDoc(ref, { ...task, createdAt: '2000-01-01T00:00:00.000Z' }));
  });
  it('allows tombstones but forbids hard deletion or resurrection', async () => {
    const task = newTask(); const ref = doc(db, 'users', owner, 'tasks', task.id); await setDoc(ref, task);
    await assertFails(deleteDoc(ref));
    await assertSucceeds(setDoc(ref, { ...task, version: 2, deletedAt: new Date().toISOString() }));
    await assertFails(setDoc(ref, { ...task, version: 999, updatedAt: '2030-01-01T00:00:00.000Z' }));
  });
  it('keeps original journal text immutable and permits separate recoverable revisions', async () => {
    const j: Journal = { ...metadata(crypto.randomUUID()), originalTranscription: 'Original test writing', source: 'manual', kind: 'general', date: '2026-09-30' };
    const ref = doc(db, 'users', owner, 'journals', j.id); await setDoc(ref, j);
    await assertFails(setDoc(ref, { ...j, originalTranscription: 'Replacement writing', version: 2 }));
    const copy = { ...j, id: crypto.randomUUID(), revisionOf: j.id, originalTranscription: 'Other test writing', syncStatus: 'conflict' };
    await assertSucceeds(setDoc(doc(db, 'users', owner, 'journals', copy.id), copy));
  });
});
describe('real Firebase Auth and Firestore two-device harness', () => {
  it('pulls all pages of a category and does not duplicate stable IDs', async () => {
    const transport = new FirestoreTransport(db);
    const records = Array.from({ length: 205 }, () => newTask());
    await environment.withSecurityRulesDisabled(async context => {
      const admin = context.firestore();
      const batch = writeBatch(admin);
      for (const record of records) batch.set(doc(admin, 'users', owner, 'tasks', record.id), record);
      await batch.commit();
    });
    const fetched = await transport.pull(owner, 'tasks');
    expect(fetched).toHaveLength(205); expect(new Set(fetched.map(r => r.id)).size).toBe(205);
  });
  it('signs both devices into the same emulator Google identity and converges offline changes, journal conflicts and tombstones', async () => {
    const first = await client(); const second = await client(); expect(first.uid).toBe(second.uid); expect(first.uid).toBe(owner);
    const a = await IndexedDbRepository.open(`emulator-a-${crypto.randomUUID()}`); const b = await IndexedDbRepository.open(`emulator-b-${crypto.randomUUID()}`);
    const lifeA = await createLifeService(a, { getItem: () => null }); const lifeB = await createLifeService(b, { getItem: () => null });
    let online = true;
    const engineA = new SyncEngine(a, new FirestoreTransport(first.store), () => {}, () => online);
    const engineB = new SyncEngine(b, new FirestoreTransport(second.store), () => {}, () => online);
    try {
      for (const engine of [engineA, engineB]) { await engine.initialize(); await engine.setAccount({ uid: owner, email: null }); await engine.setPolicy({ enabled: true, categories: { tasks: true, journals: true, activities: true } }); }
      await lifeA.addTask('Task A'); await lifeA.addTask('Task B'); await engineA.syncNow(); await engineB.syncNow();
      const [one, two] = await a.list('tasks'); expect(await b.list('tasks')).toHaveLength(2);
      online = false; await lifeA.editTask(one.id, { title: 'Phone edit' }); await lifeB.editTask(two.id, { title: 'Tablet edit' });
      await engineA.syncNow(); expect(engineA.getSnapshot().status).toBe('Offline');
      online = true; await engineA.syncNow(); await engineB.syncNow(); await engineA.syncNow();
      expect((await a.list('tasks')).map(t => t.title).sort()).toEqual(['Phone edit', 'Tablet edit']);
      const shared = (await a.get('tasks', one.id))!;
      await a.commit([{ table: 'tasks', value: { ...shared, title: 'Earlier offline edit', updatedAt: '2027-01-01T09:00:00.000Z', version: shared.version + 1 } }]);
      await b.commit([{ table: 'tasks', value: { ...shared, title: 'Later offline edit', updatedAt: '2027-01-01T10:00:00.000Z', version: shared.version + 1, deviceId: lifeB.deviceId } }]);
      await Promise.all([engineA.syncNow(), engineB.syncNow()]); await engineA.syncNow(); await engineB.syncNow();
      expect((await a.get('tasks', one.id))?.title).toBe('Later offline edit'); expect((await b.get('tasks', one.id))?.title).toBe('Later offline edit');
      const j: Journal = { ...metadata(lifeA.deviceId), kind: 'general', source: 'manual', date: '2026-09-30', originalTranscription: 'Original test journal' };
      await a.commit([{ table: 'journals', value: j }]); await engineA.syncNow(); await engineB.syncNow();
      await a.commit([{ table: 'journals', value: { ...j, originalTranscription: 'Phone test writing', version: 2 } }]);
      await b.commit([{ table: 'journals', value: { ...j, originalTranscription: 'Tablet test writing', version: 2, deviceId: lifeB.deviceId } }]);
      await engineA.syncNow(); await engineB.syncNow(); await engineA.syncNow(); await engineB.syncNow();
      expect((await b.list('journals')).map(r => r.originalTranscription).sort()).toEqual(['Original test journal', 'Phone test writing', 'Tablet test writing']);
      online = false;
      await lifeA.setCompleted(one.id, true);
      await lifeB.editTask(one.id, { title: 'Offline old edit' });
      online = true; await engineA.syncNow(); await engineB.syncNow();
      expect((await b.get('tasks', one.id))?.deletedAt).not.toBeNull();
      await engineB.setAccount(null); await signOut(second.auth);
      expect(await b.list('tasks')).toHaveLength(2); expect(engineB.getSnapshot().account).toBeNull();
      expect(engineA.getSnapshot().issue).toBeNull();
    } finally { engineA.close(); engineB.close(); lifeA.close(); lifeB.close(); a.close(); b.close(); }
  });
});
