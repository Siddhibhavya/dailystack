# Firebase sync proposal — approval required

Historical Phase 1 proposal. The locally implemented Phase 2 architecture and
reviewable rules are now documented in [PHASE-2.md](PHASE-2.md). Its production
publication remains pending. The text below records the original proposal.

This is documentation only. No Firebase SDK, Auth configuration, Firestore database,
rules deployment or Hosting configuration change has been added. The current project
binding remains untouched. Existing Google Calendar OAuth is a separate integration.

## Manual Console actions, only after approval

1. In the existing Firebase project, review its current apps, enabled services and
   existing rules. Register a web app if one does not already exist. Its client config
   must be supplied through local environment settings; no service-account or OAuth
   secret belongs in a browser bundle.
2. Enable Firebase Authentication with Google sign-in, choose the support email, and
   authorize only the intended app domains. Enable localhost explicitly if testing it.
3. Sign in with the intended owner account and record its Firebase Auth UID. Restrict
   the rules to that UID. A Google sign-in provider by itself does not enforce a single
   app owner.
4. Create Firestore in production mode and choose the data location deliberately.
   Review cost/quota settings. Do not start with public test rules.
5. Replace the owner placeholder in the proposed rules and verify them with Firebase
   Emulator tests before deployment. Deploy only after a separate approval.
6. Approve a Hosting change from repository root to `dist/`, then review the build
   output before deploying. Keep the existing project, site and origin.

OAuth Console: keep the current Calendar client and authorized origins. Firebase Auth
does not replace Calendar API consent. Any new preview origin needs explicit authorization
in that existing web OAuth client for real Calendar tests.

## Proposed rules (not deployed)

The owner placeholder deliberately grants no real account access. Replace it only in
an approved implementation. UID checks limit authenticated access; Firestore Admin SDKs
can bypass these rules and therefore need separate IAM control.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function owner(userId) {
      return request.auth != null
        && request.auth.uid == 'REPLACE_WITH_APPROVED_OWNER_UID'
        && userId == request.auth.uid;
    }
    function validRecord(recordId) {
      return request.resource.data.id == recordId
        && request.resource.data.createdAt is string
        && request.resource.data.updatedAt is string
        && request.resource.data.deviceId is string
        && request.resource.data.version is int
        && request.resource.data.version > 0
        && (request.resource.data.deletedAt == null
          || request.resource.data.deletedAt is string);
    }
    function structuredCategory(category) {
      return category in ['tasks', 'projects', 'activities', 'cycles',
        'observations', 'memories', 'reminders', 'calendarMetadata'];
    }
    match /users/{userId}/{category}/{recordId} {
      allow read: if owner(userId) && structuredCategory(category);
      allow create: if owner(userId) && structuredCategory(category)
        && validRecord(recordId);
      allow update: if owner(userId) && structuredCategory(category)
        && validRecord(recordId)
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.version > resource.data.version;
      allow delete: if false;
    }
    match /users/{userId}/journals/{recordId} {
      allow read: if owner(userId);
      allow create: if owner(userId) && validRecord(recordId)
        && request.resource.data.originalTranscription is string;
      // Text revisions/conflicts are new documents; metadata/tombstones may update.
      allow update: if owner(userId) && validRecord(recordId)
        && request.resource.data.originalTranscription == resource.data.originalTranscription
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.version > resource.data.version;
      allow delete: if false;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

Future implementation must validate per-entity payloads, UUID formats, lengths and
time ranges, and transactionally merge competing revisions. Rules above describe the
owner boundary and immutable journal text, not a completed conflict/sync engine.
Meal photo storage requires its own private Storage rules and approval.

Sync stays opt-in, with category exclusion before both upload and download. Journals,
cycles, symptoms and meal photos must be separately configurable. An observation
containing symptoms must not be sent when symptom sync is off; split such fields into
their own records or require both categories before upload. Disabling a category must
also stop listeners; removal of copies already uploaded needs explicit user action.

No Console actions are needed to test the local Phase 1 application. Approval is
needed before implementing these cloud/deployment changes.

Reference: https://firebase.google.com/docs/rules/basics
