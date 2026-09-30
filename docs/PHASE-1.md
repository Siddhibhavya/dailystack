# My Life — Phase 1 foundation

Work folder: `C:\Users\Admin\OneDrive\Documents\DAILYME`.
Base: Daily Stack app branch `claude/todo-widget-timer-checklist-ir5iwa`, commit `f4d7dd9`.
The original checkout is preserved in `C:\Users\Admin\dailystack`.

## Architecture

React + TypeScript + Vite was chosen because the planned screens share local state,
forms, reusable components and asynchronous services. There is no UI framework,
Next.js, native wrapper, cloud SDK or AI dependency.

```
React UI → LifeService → Repository interface → IndexedDbRepository
React UI → CalendarService → existing Google Identity Services + Calendar API
Future synchronization transport → repository changes, category policy, conflict review
```

`src/domain/models.ts` holds typed tasks, projects, activity segments, journals,
cycles, observations, memory lifecycle records and reminders. Local schema version
1 creates dedicated object stores and metadata indexes. Storage is replaceable through
`Repository`; UI does not call IndexedDB or Firestore.

Synchronized entities use UUIDs, creation/update dates, device identity, pending sync
status, revision versions and deletion tombstones. Pending means ready for a future
sync implementation, not that an upload is running. Nothing is uploaded in Phase 1.

`syncContracts.ts` defines a future transport and opt-in category policy. Structured
conflicts use deterministic timestamp/version/device ordering. Journal text conflicts
retain both versions for review. A future engine must also detect concurrent revisions
using its last acknowledged version, reconcile local pending edits before applying
remote changes, and persist its cursors in the same transaction as received records.
Clock differences are a known limitation of timestamp ordering.

## Migration and recovery

Only the existing `dailystack_widget_todos` and `dailystack_active_timer` values are
read. They are never removed or rewritten. Existing OAuth client ID and theme keys
continue to be used by their own services.

When legacy records exist, a banner offers export before import. The import itself
saves an exact recovery snapshot in IndexedDB before validating or writing tasks.
Invalid data stops import; its original and snapshot remain available. The user can
download the snapshot even when validation fails.

Import validates IDs, titles, completion flags and nonnegative elapsed time. Both
`done` (actual existing format) and `completed` are supported. Tasks receive UUIDs
and preserve their legacy IDs, titles, completion values and elapsed seconds.
An atomic import marker prevents duplicates between tabs. Read-back verification
checks tasks and the active legacy timer; a verified marker makes re-import a no-op.
Interrupted verification can be retried. New task writes are disabled while import
is pending.

Historical elapsed seconds remain in `legacyElapsedSeconds`. No historical activity
sessions are invented. A running old timer continues as legacy time until stopped.
Subsequent starts create real segments. Starting another task, completion, and removal
close the active segment atomically. Removed tasks retain a tombstone and session history.
BroadcastChannel refreshes other tabs; an atomic timer check rejects stale tab writes.

Settings exports all local records, including tombstones and original task strings.
OAuth settings and tokens are excluded. Restore/import of that full backup is not
implemented yet. Browser storage is not encrypted by this app and remains tied to
the browser profile and origin. Clearing site data can remove IndexedDB, including
its recovery snapshots; download a separate backup before deployment or data changes.
Data on an existing hosted origin does not appear automatically on localhost.

## Calendar

Existing GIS OAuth token flow and scope are preserved. OAuth client ID stays in its
existing localStorage key. Tokens remain in memory; expiry requires reconnection.
Calendar reads cover today's primary-calendar events, including every API page.
HTTP errors are surfaced, partial lists are discarded, old requests are cancelled,
and generation checks prevent late responses from reappearing after disconnect.
Reads use `cache: no-store`; offline and failed refreshes clear live event results.
Returning to the page and day rollover refresh live commitments.

Calendar data is planned life only. No event automatically creates actual activity.
The task Calendar button previews an explicit 30-minute addition; without a valid
token it opens the existing prefilled Google Calendar page. No automatic event edit
or deletion exists. Network failures during creation are reported without automatic
retry to avoid duplicate events with an uncertain server result.

Live Google OAuth has NOT been verified with the user's real account. Multiple
calendars/accounts and an explicitly labelled offline Calendar snapshot are deferred.

## PWA and deployment

Build output is `dist/`. The build generates a service worker cache version from
asset contents and precaches the exact bundled JS, CSS, shell, manifest and icons.
It never caches authenticated requests, OAuth/token routes, arbitrary cross-origin
GETs or unknown same-origin endpoints. Navigation uses the network with a precached
shell fallback. Cleanup touches only `my-life-app-*` and the known unsafe
`dailystack-v1` cache. Activation happens after successful precaching.

The root worker is also replaced with the same safe policy, but the production app
must be served from the build output to get the bundled assets. Development does
not register a worker. Installed users need the new worker delivered on their existing
origin; close old tabs and reopen after updating if an old bundle is still visible.

`.firebaserc` and `firebase.json` are unchanged. **Do not run `firebase deploy` with
the old root Hosting configuration**: it would serve development source and could
include development documents. A proposal to serve only `dist/` requires separate
approval before changing Firebase configuration. No site has been deployed.
Existing PWA icons and the original `/index.html` install identity are retained;
final My Life artwork is deferred.

## Running and verification

```
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run test:browser
npm run preview -- --port 4173
```

Browser tests use the installed Chrome in isolated temporary profiles and block Google
sign-in network calls. They never access the user's browser storage/account. They
check mobile 390×844, tablet portrait 768×1024, tablet landscape 1024×768 and desktop
1440×900, along with legacy import, export, task/timer reload and offline editing.
No lint configuration exists; strict TypeScript and tests provide the current checks.

## Scope and manual checks

Today, Calendar, Journal, Projects and Insights are primary navigation. Secondary
areas are accessible through a separate menu. Phone uses bottom navigation; tablet
uses a sidebar and independent content composition. The cat is a replaceable SVG slot.
Journal, Insights, Cycle, Reminders, Me Time and memory screens are shells. No voice
capture, journal editor, predictions, alarms, AI model or native packaging is present.

Manually test installation on phone/tablet, original-site migration with a downloaded
backup, timers across suspension/reload, light/dark themes, Google consent and primary
Calendar read, explicit event creation, expiry/reconnection and disconnect. Check
CacheStorage contains app assets only, and try reopening/editing tasks offline.

Stop after Phase 1 review. Firebase sync and later product features require another phase.
