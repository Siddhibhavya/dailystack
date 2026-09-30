import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type Auth } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, documentId, getDocsFromServer, initializeFirestore, limit, memoryLocalCache, onSnapshot, orderBy, query, runTransaction, startAfter, type Firestore, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { CloudTransport, SyncAccount } from './syncEngine';
import { canonicalRecord, cleanRecord, reconcile, validSyncRecord, type SyncRecord, type SyncTable } from './syncRecords';
export class FirebaseIdentity {
  constructor(private auth: Auth) {}
  subscribe(listener: (account: SyncAccount | null) => void) {
    return onAuthStateChanged(this.auth, user => listener(user ? { uid: user.uid, email: user.email } : null));
  }
  async signIn() {
    await setPersistence(this.auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // No Calendar scopes: this sign-in only authorizes private My Life cloud data.
    await signInWithPopup(this.auth, provider);
  }
  signOut() { return signOut(this.auth); }
}
export class FirestoreTransport implements CloudTransport {
  constructor(private db: Firestore) {}
  private records(uid: string, table: SyncTable) { return collection(this.db, 'users', uid, table); }
  async pull(uid: string, table: SyncTable): Promise<SyncRecord[]> {
    const records: SyncRecord[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const page = await getDocsFromServer(query(this.records(uid, table), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(200)));
      for (const item of page.docs) {
        const value = item.data();
        if (value.id !== item.id || !validSyncRecord(table, value)) throw new Error('Cloud record validation failed.');
        records.push(value);
      }
      if (page.size < 200) break;
      cursor = page.docs[page.docs.length - 1];
    }
    return records;
  }
  async exchange(uid: string, table: SyncTable, local: SyncRecord) {
    if (!validSyncRecord(table, local)) throw new Error('Local record validation failed.');
    const ref = doc(this.records(uid, table), local.id);
    return runTransaction(this.db, async tx => {
      const snapshot = await tx.get(ref);
      const remote = snapshot.exists() ? snapshot.data() : undefined;
      if (remote && !validSyncRecord(table, remote)) throw new Error('Cloud record validation failed.');
      const result = await reconcile(table, local, remote);
      // Read all deterministic conflict-copy IDs before any writes. Retries are idempotent.
      const copies = await Promise.all(result.copies.map(async copy => {
        const copyRef = doc(this.records(uid, 'journals'), copy.id);
        const existing = await tx.get(copyRef);
        if (existing.exists() && canonicalRecord(existing.data() as SyncRecord) !== canonicalRecord(copy)) throw new Error('Conflict-copy collision. Writing is preserved locally.');
        return { copy, copyRef, exists: existing.exists() };
      }));
      for (const { copy, copyRef, exists } of copies) if (!exists) tx.set(copyRef, cleanRecord(copy));
      if (!remote || canonicalRecord(remote) !== canonicalRecord(result.record) || remote.syncStatus !== result.record.syncStatus) tx.set(ref, cleanRecord(result.record));
      return result;
    });
  }
  watch(uid: string, table: SyncTable, changed: () => void, failed: () => void) {
    return onSnapshot(this.records(uid, table), { includeMetadataChanges: true }, snapshot => { if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) changed(); }, () => failed());
  }
}
export interface FirebaseCloud { identity: FirebaseIdentity; transport: FirestoreTransport }
export function createFirebaseCloud(): FirebaseCloud | null {
  const env = import.meta.env;
  const config: FirebaseOptions = { apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) return null;
  const app = initializeApp(config);
  const auth = getAuth(app);
  // Firestore's cache is memory-only. Application records and pending changes live
  // exclusively in our deliberate IndexedDB repository, including across reloads.
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  // Emulator mode is explicit, development-only, and always points to loopback.
  if (env.DEV && env.VITE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { identity: new FirebaseIdentity(auth), transport: new FirestoreTransport(db) };
}
