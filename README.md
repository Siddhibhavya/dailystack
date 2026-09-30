# My Life (Daily Stack)

A private personal planner, built from the existing Daily Stack PWA.
Phase 1 provides a React/TypeScript shell, IndexedDB storage, safe legacy task migration,
real activity sessions and the existing Google Calendar authorization flow.
Phase 2 adds optional private Firebase synchronization through the same local repository.

```sh
npm ci
npm run dev
```

For offline/PWA checks, run `npm run build` then `npm run preview`.
Run `npm test`, `npm run typecheck` and `npm run test:browser` for verification.

See [Phase 1 architecture and migration](docs/PHASE-1.md) and the
[Firebase sync proposal](docs/FIREBASE-SYNC-PROPOSAL.md).
See [Phase 2 implementation, security and device testing](docs/PHASE-2.md) for current sync behavior.

Cloud sync starts off for every category. The existing Firebase project is retained.
Phase 2 Hosting and owner-only Firestore rules have been deployed with explicit
approval. Sign in with the intended My Life account and opt into categories on
each device. See the Phase 2 report for the phone/tablet verification flow.
