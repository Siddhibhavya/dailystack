# My Life — private multi-device sync

## Current scope

The Phase 2 implementation has no commits or pushes. Hosting was deployed with
explicit approval on September 30, 2026. Owner-only Firestore rules were published
after the intended account UID was supplied and nine emulator tests passed. The existing project is `dailystack-f3496`. The
registered My Life web app and Standard Firestore database in `asia-south1` (Mumbai)
were verified through read-only CLI commands. Google Auth and authorized domains
were configured by the owner. Real Google sign-in and phone/tablet use remain manual
checks. Production rules permit only the approved owner UID under its own user path.
An unauthenticated live REST check returned HTTP 403.

Phase 3 product features and Miku animations have not been started. Miku's artwork,
vectors, layer structure and character specification are unchanged.

## Architecture

UI → LifeService → Repository → IndexedDB

SyncEngine ↔ Repository; SyncTransport → FirestoreTransport → private Firestore.
FirebaseIdentity manages My Life sign-in separately from CalendarService's existing
Google Identity Services consent. UI reads domain data only from IndexedDB.

The Phase 1 transport contract was extended with authenticated UID and transactional
exchange rather than creating another repository or offline database. The database
schema remains version 1: the existing stores already support all categories. Added
metadata records (`syncPolicy`, `cloudOwner`, `lastSync`) do not rewrite user records
or remove localStorage originals, recovery backups, or migration markers.

`compareAndCommit` is an atomic IndexedDB check-and-write. A network acknowledgement
cannot replace an edit that occurred while the request was in flight. LifeService
notifies the UI and sync engine after local saves, including cross-tab changes.
Remote completion or closure repairs this device's active timer without inventing
historical sessions or dropping accumulated legacy time.

## Firebase configuration

One runtime dependency: `firebase` 12.19.0. One development dependency:
`@firebase/rules-unit-testing` 5.0.2. No analytics is initialized.

The existing web app's configuration is in ignored `.env.local`. `.env.example`
lists empty configuration names. No service account, OAuth secret, access token,
refresh token, or private record is in source code. Firebase web configuration is
used by the browser SDK and becomes part of the local build; it is not an Admin SDK
credential. Authentication sessions belong to the Firebase Auth SDK and are not
included in notebook exports.

Firestore uses `memoryLocalCache()` explicitly. Its transient memory cache is
transport state, not a second persistent application database. Pending changes,
records, tombstones, category preferences, installation identity and ownership stay
in the application's IndexedDB. See the official [memory cache reference](https://firebase.google.com/docs/reference/js/firestore.memorylocalcache).

Firebase Auth Google sign-in requests identity only, with account selection. It
does not add or replace Calendar scopes. Auth persistence supports reloads; blocked
popups/cancelled sign-in show a short retry message while local editing continues.
Calendar's current token flow supplies no verified account email, so Settings says
that explicitly instead of inventing an identity or equating the accounts.

## Cloud schema and rules

`users/{ownerUid}/{category}/{stableRecordUuid}`

Categories: tasks, projects, activities, journals, cycles, observations, memories,
reminders. Calendar events, OAuth credentials, installation metadata, recovery
backups and photos are never copied into these collections. Model-only categories
are supported without adding their future product screens.

`firestore.rules` requires both matching authenticated UID ownership and a single
approved owner UID. Unknown collections/default access and hard deletion are denied.
Rules validate record IDs, required metadata, allowed fields, payload types and
basic bounds, reject resurrection, keep creation timestamps stable and forbid
replacement of original journal text. Collection identity is enforced by path and
record ID. Nested cycle flow/symptom lists have size/type checks, not full semantic
validation of historical cycle dates; that belongs to the future domain importer.

The supplied owner UID is configured in the published rules. Tests substitute a
synthetic Auth emulator user's UID only in the emulator's rules. No permissive
production or emulator rules are used. All cloud tests refuse to run outside the
`demo-my-life` emulator environment.

### Production setup completed

The user registered the web app, enabled Google Auth, authorized the app domains,
and created Firestore in Mumbai. After the user authorized deployment and supplied
the intended owner UID, the Phase 2 app and owner-only rules were published.

Rules-only deployments use `firebase.rules.json`, leaving the Hosting-only
`firebase.json` separate. No compound indexes are required. Category sync remains
opt-in on each device. Real-account phone/tablet verification is still required.

No Firebase project, OAuth configuration, database location or Hosting site needs
replacement. HTTPS is supplied by the existing Firebase Hosting origin.

## Sync algorithm

Each local domain write immediately commits with the existing pending/version/device
metadata. It never awaits Firestore. The engine runs after authentication, local
writes (600 ms debounce), startup/resume, reconnect, and manual Sync now. The
manual action does not set the app's blocking local-save state.

Only opted-in categories create realtime listeners. A server snapshot signals a
debounced reconciliation; cached snapshots do not masquerade as live data. There
is no timer polling. Listener errors preserve local use. Disabling a category or
signing out removes its listeners and invalidates the running reconciliation.
An already sent transaction can finish, but no new requests are issued by the
cancelled cycle and its response cannot overwrite local data afterward.

For each allowed category:

1. Pull server records in pages of 200 ordered by stable ID.
2. Validate payloads; form the union of local and remote IDs, including tombstones.
3. For unequal or local-only records, run a Firestore transaction that reads the
   latest server revision and reconciles before writing. Transactions retry safely
   if another device changes that document.
4. Apply results and journal copies atomically to IndexedDB only if the expected
   local record has not changed. A newer local edit stays pending for the next pass.
5. Refresh UI from the local repository, not Firestore.

Local-only + empty cloud uploads eligible records. Cloud-only + empty device
hydrates locally. Mixed notebooks reconcile by ID; neither notebook is replaced.
Invalid or failed records remain recoverable locally and unrelated valid records
continue. Category-level network failures leave that category intact. Retry uses
bounded exponential delay (maximum 60 seconds, five automatic retries). A reconnect,
resume, new edit or manual sync can retry after that.

Full paginated category reads intentionally replace timestamp cursors in this
initial single-user implementation. They avoid missed older offline writes, clock
skew and data omitted after re-enabling a category. This costs more reads than an
incremental change feed; batching and debounce keep it reasonable for a small
notebook, and an indexed change feed is a future optimization. No cursor can
silently strand a pending edit. Interrupted/reloaded cycles repeat safely using
stable IDs, pending metadata and idempotent transactions.

## Conflicts and deletion

Structured records use the Phase 1 deterministic comparator: updatedAt, version,
deviceId, then canonical payload. syncStatus is excluded from payload comparison
because it is local transport bookkeeping. Deletion always takes precedence over
a live revision of the same ID, even with a later clock timestamp. Restoring a
deleted object would create a new ID; restoration UI is not in this phase.

Journal text is immutable in its existing cloud document. Differing text creates
a new conflict copy with `revisionOf` pointing to the original and `conflict`
status. The copy's stable UUID is derived from SHA-256 of the original revision;
retrying does not multiply copies. The original text and all differing writing
remain recoverable, including sequential text edits. There is no automatic text
merge. Settings indicates conflicts; full notebook export contains originals,
revisions and tombstones for review. A dedicated editing/conflict-resolution
screen waits for the Journal product implementation.

Two structured revisions with the same ID but incompatible creation metadata fail
safely rather than overwriting immutable history. Both local and cloud versions
are retained and sync shows an issue. Ordinary structured conflict losers follow
the stated deterministic last-write rule, not journal preservation.

Tombstones are retained indefinitely initially. Cleanup should later require all
known installations to acknowledge a deletion plus a retention window and backup;
an indefinitely offline device must reconcile against retained deletion history.

## Category preferences and ownership

All categories and master sync start OFF, following Phase 1's established default.
Preferences are installation-local: opt in separately on the phone and tablet.
They persist offline and across reloads. Turning sync off stops upload/download;
it does not erase already uploaded data.

Cycles and observations require both their own category and Symptoms to be enabled
before any reads/listeners or writes. This conservative whole-category restriction
prevents embedded symptom data leaking through a different setting. Splitting
symptoms into a separate domain table is deferred until product logging exists.
Meals, self-care and photo categories remain unavailable rather than uploading
unimplemented records or inventing product features.

The first My Life sign-in binds this local notebook to its UID, even when sync is
off. Another account cannot read or upload this notebook. Sign out retains all
records, timers, backups, preferences and the binding. Return to the original
account to resume. Account transfer, clearing local data and merging notebooks
from different accounts require future explicit recovery flows; none is automatic.

## Test and recovery procedures

`npm test` — local storage, migration, timers, Calendar, cache policy, sync contract,
and independent two-device IndexedDB sync tests.

`npm run typecheck`, `npm run build`, `npm run test:browser` — types, production
bundle and responsive/offline browser checks. No lint is configured.

`npm run test:emulator` — needs Firebase CLI and Java 21 on PATH (or the locally
installed development JDK). Starts only Auth and Firestore in `demo-my-life`, runs
security tests and the two-device real SDK harness, then stops. It neither reads
nor writes production Firestore. The harness creates two independent IndexedDB
databases and Firebase clients, authenticates the same synthetic identity, tests
independent edits/conflicts/deletions, and verifies sign-out retains local records.

Keep notebook exports private. Export remains an independent recovery mechanism;
cloud sync is not a backup. Import/restore is still deferred. Do not share exports
in bug reports. Error/status messages contain no journal, symptom or token contents.

### Manual phone/tablet test after approved rules and deployment

1. Export the current phone notebook first. Sign into My Life on both devices with
   the same Google identity. Calendar may use a different account.
2. Enable master sync and Tasks/Projects/Actual timeline on each device. Leave
   sensitive categories off unless intentionally testing them.
3. Create two phone tasks, start/stop a timer, tap Sync now. Tablet should receive
   those stable IDs and activity sessions without starting a tablet timer.
4. Put both devices offline. Edit Task A on the phone and Task B on the tablet.
   Reload each offline; verify the edits are retained. Reconnect and sync; both
   edits should appear on both devices.
5. Edit the same task independently offline. Reconnect in both orders; both devices
   should converge to the documented deterministic winner.
6. Delete on the phone while tablet is offline. Edit its old copy on tablet,
   reconnect, and verify it stays deleted while its tombstone remains in export.
7. Turn one category off. Changes must stay local there. Turn it back on and verify
   backlog reconciliation. Opt into journal/body/cycle only intentionally; their
   schemas can be exercised through the test harness until product UI exists.
8. Sign out. Local tasks/timers still work offline. A different account should show
   the notebook ownership message and must not upload its contents.
9. Test Calendar connect/consent, paginated read, an explicitly requested event,
   error handling and disconnect with the real account. No task should create an
   event by itself. Calendar permission and My Life account remain distinct.

### Limits

Real Google account consent and installed phone/tablet behavior cannot be proven
by emulator or desktop layout tests. Browser pop-up/storage restrictions, cloud
quotas, network access and owner rule publication need manual verification. PWA
background suspension pauses sync; it resumes when the app opens or regains focus.
No dependable background alarms, native wrapper, AI, voice, meal analysis or cat
animation were added.

Last-write ordering assumes reasonably correct device clocks. A clock far in the
future can dominate ordinary edits; tombstones still prevent resurrection. Importing
the same legacy localStorage list independently on two installations can create
different UUIDs and duplicate tasks, rather than deleting apparently similar items.
The Firebase SDK increases the complete JavaScript bundle from about 82 KB to
246 KB gzip (the complete bundle is about 820 KB minified); Vite reports its large-chunk advisory.
Lazy loading/splitting can improve startup later without changing repository behavior.

## Verification results

- 64 unit tests pass, including all original Phase 1 tests.
- 9 emulator tests pass: security boundary, schema/immutability, 205-record
  pagination, Auth identity, two independent local databases, concurrent edits,
  journal conflict preservation, deletion and sign-out.
- 10 browser checks pass: original navigation/tasks/timers at four layouts,
  legacy recovery/offline reload, Settings at four layouts, and offline preferences
  plus task editing. Generated screenshots are in ignored `test-results/`.
- TypeScript and production build pass. No lint script is configured.
- Credential-pattern review of changed source found no matches. `.env.local` is
  ignored. Calendar service, Miku assets/specification and service-worker source
  have no diff; cache tests now also cover Firebase/Auth endpoints.

An emulator expansion exposed an in-flight manual-sync race. The engine now drains
requested follow-up passes and a regression test verifies records created during
an older request are processed before the manual sync returns. A pagination fixture
timeout was corrected by seeding its 205 records in a batch rather than 205 separate
streaming writes. The final emulator run passed all tests.

## Files

New: `firebaseCloud.ts`, `syncEngine.ts`, `syncRecords.ts`, `SyncSettings.tsx`,
`firestore.rules`, `firebase.emulators.json`, `.env.example`, emulator runner,
unit/emulator/browser sync tests, separate Vitest configurations, this report.

Updated: repository interface/IndexedDB atomic reconciliation, existing transport
contract, LifeService notification/timer recovery, app startup/Settings composition,
small Settings CSS additions, dependency manifests, credential/cache ignore rules,
cache privacy tests, the storage test's repository stub, README and the historical
proposal's supersession note.

`firebase.json`'s change to deploy `dist` and the `.firebase/` ignore entry predate
this phase's work; they came from the earlier explicitly approved Hosting deployment.
No Phase 2 changes have been committed or pushed. The Phase 2 Hosting build was
deployed with explicit approval. A fresh Chrome phone-sized browser verified HTTP
200, Phase 2 Settings, enabled sign-in, sync off by default, no horizontal overflow
and no page errors. The subsequent owner-only rule deployment completed after all nine emulator
tests passed. The supplied UID is now configured and those rules
are published. Real-account sign-in and live device synchronization remain manual
checks; no production personal records were created by the deployment smoke test.

## Rules publication

After the user supplied the owner UID, `firebase.rules.json` was added for a
separate rules-only deployment. `firebase deploy --config firebase.rules.json
--only firestore:rules --project dailystack-f3496 --non-interactive` compiled and
released `firestore.rules` successfully. No application data, OAuth configuration
or Hosting assets were modified by this rules-only deployment. A live anonymous
read of a nonexistent task path was denied with HTTP 403. Actual phone/tablet
sync with the owner account still needs the manual procedure above. Category sync
continues to default off. Phase 3 is on hold. No commit or push was performed.
