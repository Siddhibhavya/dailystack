# My Life (Daily Stack)

A private personal planner, built from the existing Daily Stack PWA.
Phase 1 provides a React/TypeScript shell, IndexedDB storage, safe legacy task migration,
real activity sessions and the existing Google Calendar authorization flow.

```sh
npm ci
npm run dev
```

For offline/PWA checks, run `npm run build` then `npm run preview`.
Run `npm test`, `npm run typecheck` and `npm run test:browser` for verification.

See [Phase 1 architecture and migration](docs/PHASE-1.md) and the
[Firebase sync proposal](docs/FIREBASE-SYNC-PROPOSAL.md).

Cloud sync is disabled. Firebase project and Hosting configuration are unchanged.
Deployment configuration must be reviewed and approved before publishing the new build.
