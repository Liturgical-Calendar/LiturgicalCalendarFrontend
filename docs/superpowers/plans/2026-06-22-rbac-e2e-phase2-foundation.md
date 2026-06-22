# RBAC E2E Phase 2 — Foundation (harness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the harness foundation the 11 Phase 2 scenario specs depend on — change the seeding model so
editors earn grants via the UI, add a per-spec precondition-seeding helper, a request-submission helper, a
Mailpit/registration helper, and extend cleanup to remove grants created during specs.

**Architecture:** Extend the existing `e2e/rbac/support/*` TypeScript harness (Playwright, serial, single
worker, `rbac` project depending on `rbac-setup`). New helpers compose the existing `Fga`, `ZitadelAdmin`,
`seedUser`, `oidcLogin`, and `actingAs` primitives. Each helper gets a `*.test.ts` (run by the existing
`rbac-support` project, `testMatch /rbac/support/.*\.test\.ts/`) where it is unit-testable without the full
app stack; UI-driving helpers are validated by the scenario specs in the companion plan.

**Tech Stack:** Playwright (TS), Node fetch, OpenFGA REST, Zitadel v2/management REST, Mailpit REST, the
frontend's `/auth/access-requests` + `/admin/access-requests` endpoints. Folds into PR #345 on branch
`e2e/rbac-access-requests`.

## Global Constraints

- Branch `e2e/rbac-access-requests`; do NOT push (wait for explicit request); do NOT use `--no-verify`.
- TypeScript must pass `yarn typecheck` and `yarn lint` (eslint, exit 0) before every commit.
- Serial, single worker (`fullyParallel: false`, `workers: 1`) — shared API/DB/FGA/Zitadel state.
- Harness is **local-docker-only**: it truncates the app DB and mints local Zitadel PATs; never point it at a
  shared/remote stack.
- Fail-safe cleanup: cleanup steps must tolerate already-absent resources (`.catch(() => {})` around deletes),
  matching the existing `cleanup.ts` / `fga.delete` (tolerates "not found") / `zitadel.deleteUser` patterns.
- Env vars (already loaded into the Playwright process via the existing config's dotenv) the harness reads:
  `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `FRONTEND_URL`, `OPENFGA_API_URL`, `OPENFGA_STORE_ID`,
  `OPENFGA_MODEL_ID`, plus the Zitadel management token used by `ZitadelAdmin.req`. Mailpit base URL is added
  in Task 4.
- Object_ids are RESOLVED and fixed: `national_calendar:IT`/`US`, `diocesan_calendar:romamo_it`,
  `wider_region:Europe`, `general_roman_calendar:temporale`.

## Reference: existing harness interfaces (verified 2026-06-22)

- `users.ts`: `RbacUser = { id, email, password, role: 'admin'|'calendar_editor', fga: { relation:
  'admin'|'editor', objectType, objectId } | null }`; `USERS` (11 users); `REGISTRATION_USER_IDS =
  ['cei-admin','usccb-editor']`; `SEEDED_USER_IDS = Object.keys(USERS).filter(id => !REGISTRATION_USER_IDS.includes(id))`.
- `seed.ts`: `seedUser(id: string): Promise<string>` — deletes existing, `createVerifiedUser`,
  `grantProjectRole(userId, role)`, and **if `u.fga` writes the tuple** (this is what Task 1 changes);
  `oidcLogin(email, password, loginClientToken): Promise<string>`; `loginAndSaveState(id, loginClientToken):
  Promise<void>` (writes `e2e/.auth/<id>.json`).
- `fga.ts`: `class Fga { write(user, relation, object): Promise<void>; delete(user, relation, object):
  Promise<void> (tolerates not-found); check(user, relation, object): Promise<boolean> }`. `object` form is
  `"{type}:{id}"`, `user` form is `"user:{zitadelId}"`.
- `zitadel.ts`: `class ZitadelAdmin { createVerifiedUser({email,password,firstName,lastName}): Promise<string>;
  findUserIdByEmail(email): Promise<string|null>; findUserIdByUsername(userName): Promise<string|null>;
  grantProjectRole(userId, role): Promise<void>; deleteUser(userId): Promise<void>; mintPat(userId):
  Promise<{tokenId, token}>; deletePat(userId, tokenId): Promise<void> }`. Private `req(method, path, body?)`.
- `actingAs.ts`: `actingAs(browser, userId): Promise<{ context: BrowserContext, page: Page }>` — builds a
  context from `e2e/.auth/<userId>.json`.
- `cleanup.ts`: `truncateAppTables(): Promise<void>` (TRUNCATE access_requests, audit_log,
  user_notification_state); `deleteAllSeededUsers(): Promise<void>` (per `USERS`: delete FGA tuple if any +
  delete Zitadel user). `gitRestoreApiData` does NOT yet exist anywhere (added in Task 5).
- `rbac.setup.ts`: mints a `login-client` PAT; `deleteAllSeededUsers()` + `truncateAppTables()`; then for each
  `SEEDED_USER_IDS`: `seedUser(id)` + `loginAndSaveState(id, pat.token)`; deletes the PAT in `finally`.
- API endpoints (verified): submit `POST /auth/access-requests` (body: `requested_role`, `permissions[]` of
  `{object_type, object_id, relation}`, optional justification); view own `GET /auth/access-requests`; admin
  list (scoped) `GET /admin/access-requests`; actions `POST /admin/access-requests/{id}/{approve|reject|revoke}`
  with optional `notes`.
- Request-submission UI is **`permission-requests.php`** (`assets/js/permission-requests.js`:
  `input[name="requested_role"]` radios, `#permissionsSection` dynamic permission builder, submit → POST
  `/auth/access-requests`). Review UI is **`admin-permissions.php`** (`loadAccessRequests()` → GET
  `/admin/access-requests`; `#permReqReviewModal` with `#permReqDetails`/`#permReqNotesSection`/
  `#permReqModalAlerts`; `processAccessReq(action)` → POST action with `notes`).

## File Structure

- Modify: `e2e/rbac/support/seed.ts` — `seedUser` seeds the FGA tuple only for `admin`-relation users.
- Create: `e2e/rbac/support/grant.ts` — per-spec precondition grant/revoke of an FGA tuple (+ role).
- Create: `e2e/rbac/support/grant.test.ts` — unit test (rbac-support project).
- Create: `e2e/rbac/support/requestAccess.ts` — drive `permission-requests.php` to submit a pending request.
- Create: `e2e/rbac/support/mailpit.ts` — query Mailpit, extract the latest verification link for an address.
- Create: `e2e/rbac/support/mailpit.test.ts` — unit test against a mocked/fetch-injected Mailpit (rbac-support).
- Modify: `e2e/rbac/support/cleanup.ts` — add dynamic-grant cleanup + `gitRestoreApiData()`.
- Modify: `e2e/rbac/support/cleanup.test.ts` — cover the new cleanup behavior where unit-testable.
- Modify: `.env.development` (+ `.env.example` if present) — add `MAILPIT_API_URL` (Task 4).

---

### Task 1: Seeding model — editors are not pre-granted

**Files:**

- Modify: `e2e/rbac/support/seed.ts` (the `seedUser` function, ~lines 18–32)
- Modify: `e2e/rbac/support/seed.test.ts` (existing — add an assertion)

**Interfaces:**

- Consumes: `USERS`, `Fga`, `ZitadelAdmin` (unchanged).
- Produces: `seedUser(id)` still returns the Zitadel user id and grants the project role for every seeded
  user, but writes the FGA tuple **only when `u.fga?.relation === 'admin'`**. Editor users (relation
  `'editor'`) are seeded as accounts + role + login, with **no** FGA tuple. Scenarios seed editor grants
  per-spec via Task 2.

- [ ] **Step 1: Update the existing test to assert the new behavior**

In `e2e/rbac/support/seed.test.ts`, the existing test seeds `cei-editor` and asserts the editor tuple
`check(...) === true`. Under the new model `cei-editor` is NOT granted at seed time. Change that assertion to
expect the tuple is **absent**, and add a second case proving an admin user IS granted. Replace the test body
with:

```ts
test('seedUser grants role for all; writes FGA tuple only for admins', async () => {
    const f = new Fga();
    const z = new ZitadelAdmin();

    // editor: account + role, but NO FGA tuple (it is requested via UI in scenarios)
    const editorId = await seedUser('cei-editor');
    const e = USERS['cei-editor'].fga!;
    try {
        expect(editorId).toMatch(/^\d+$/);
        expect(await f.check(`user:${editorId}`, e.relation, `${e.objectType}:${e.objectId}`)).toBe(false);
    } finally {
        await z.deleteUser(editorId).catch(() => {});
    }

    // admin: account + role + FGA admin tuple
    const adminId = await seedUser('usccb-admin');
    const a = USERS['usccb-admin'].fga!;
    try {
        expect(await f.check(`user:${adminId}`, a.relation, `${a.objectType}:${a.objectId}`)).toBe(true);
    } finally {
        await z.deleteUser(adminId).catch(() => {});
        await f.delete(`user:${adminId}`, a.relation, `${a.objectType}:${a.objectId}`).catch(() => {});
    }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test --project=rbac-support e2e/rbac/support/seed.test.ts`
Expected: FAIL — the editor `check(...)` returns `true` (old behavior still seeds the editor tuple).

(Requires the docker stack up. If the stack is down, bring it up per the frontend CLAUDE.md "Docker Stack
Operations" section first.)

- [ ] **Step 3: Make `seedUser` seed admin tuples only**

In `e2e/rbac/support/seed.ts`, change the tuple-write line in `seedUser` from:

```ts
    if (u.fga) await f.write(`user:${userId}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`);
```

to:

```ts
    // Seed the FGA tuple only for resource-admins. Editor grants are earned via the
    // request-access UI in scenarios (the approval outcome), seeded per-spec where a
    // scenario needs the grant as a precondition (see support/grant.ts).
    if (u.fga?.relation === 'admin') {
        await f.write(`user:${userId}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test --project=rbac-support e2e/rbac/support/seed.test.ts`
Expected: PASS (editor tuple absent; admin tuple present).

- [ ] **Step 5: Typecheck + lint**

Run: `yarn typecheck && yarn lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add e2e/rbac/support/seed.ts e2e/rbac/support/seed.test.ts
git commit -m "test(rbac): seed FGA tuples for admins only; editors earn grants via UI"
```

---

### Task 2: `grant.ts` — per-spec precondition seeding

**Files:**

- Create: `e2e/rbac/support/grant.ts`
- Create: `e2e/rbac/support/grant.test.ts`

**Interfaces:**

- Consumes: `Fga`, `ZitadelAdmin`, `USERS`, `findUserIdByEmail`.
- Produces (relied on by every scenario spec):
  - `grantScope(userKey: string, opts?: { role?: boolean }): Promise<void>` — write the FGA tuple defined for
    `USERS[userKey].fga` for the currently-seeded Zitadel user with that email, and (default) ensure the
    project role is granted. Idempotent (tolerant of "already exists").
  - `revokeScope(userKey: string): Promise<void>` — delete that tuple (tolerant of "not found").
  - `grantTuple(zitadelUserId: string, relation: string, objectType: string, objectId: string):
    Promise<void>` — low-level write for ad-hoc tuples.

- [ ] **Step 1: Write the failing test**

Create `e2e/rbac/support/grant.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { grantScope, revokeScope } from './grant';
import { seedUser } from './seed';
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('grantScope writes the user\'s defined tuple; revokeScope removes it', async () => {
    const f = new Fga();
    const z = new ZitadelAdmin();
    // cei-editor is seeded WITHOUT its tuple (Task 1). grantScope adds it as a precondition.
    const id = await seedUser('cei-editor');
    const u = USERS['cei-editor'].fga!;
    try {
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(false);
        await grantScope('cei-editor');
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(true);
        await grantScope('cei-editor'); // idempotent — must not throw
        await revokeScope('cei-editor');
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(false);
    } finally {
        await z.deleteUser(id).catch(() => {});
        await f.delete(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`).catch(() => {});
    }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test --project=rbac-support e2e/rbac/support/grant.test.ts`
Expected: FAIL — `Cannot find module './grant'`.

- [ ] **Step 3: Implement `grant.ts`**

Create `e2e/rbac/support/grant.ts`:

```ts
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

/**
 * Per-spec precondition seeding. Editors are not granted at setup (see seed.ts), so a
 * scenario that needs a user to already hold their scope seeds it here. Idempotent.
 */
export async function grantScope(userKey: string, opts: { role?: boolean } = {}): Promise<void> {
    const u = USERS[userKey];
    if (!u?.fga) throw new Error(`grantScope: ${userKey} has no fga scope`);
    const z = new ZitadelAdmin();
    const f = new Fga();
    const zid = await z.findUserIdByEmail(u.email);
    if (!zid) throw new Error(`grantScope: ${userKey} (${u.email}) is not seeded in Zitadel`);
    if (opts.role !== false) await z.grantProjectRole(zid, u.role).catch(() => {}); // tolerate already-granted
    await f.write(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`); // write tolerates dup
}

export async function revokeScope(userKey: string): Promise<void> {
    const u = USERS[userKey];
    if (!u?.fga) return;
    const z = new ZitadelAdmin();
    const f = new Fga();
    const zid = await z.findUserIdByEmail(u.email);
    if (!zid) return;
    await f.delete(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`).catch(() => {});
}

export async function grantTuple(
    zitadelUserId: string, relation: string, objectType: string, objectId: string,
): Promise<void> {
    await new Fga().write(`user:${zitadelUserId}`, relation, `${objectType}:${objectId}`);
}
```

(Note: `Fga.write` already swallows "already exists/duplicate"; `grantProjectRole` may 409 on a re-grant, so
the `.catch(() => {})` keeps `grantScope` idempotent.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test --project=rbac-support e2e/rbac/support/grant.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `yarn typecheck && yarn lint`  → exit 0.

- [ ] **Step 6: Commit**

```bash
git add e2e/rbac/support/grant.ts e2e/rbac/support/grant.test.ts
git commit -m "feat(rbac): grant.ts per-spec precondition seeding helper"
```

---

### Task 3: `requestAccess.ts` — submit a pending request through the UI

**Files:**

- Create: `e2e/rbac/support/requestAccess.ts`

**Interfaces:**

- Consumes: `actingAs` (a logged-in `{ context, page }`), `permission-requests.php` + `permission-requests.js`
  (`input[name="requested_role"]`, `#permissionsSection`, the add-permission controls, the submit button),
  which POSTs to `/auth/access-requests`.
- Produces (relied on by scenario specs):
  - `submitAccessRequest(page: Page, opts: { requestedRole: string; permission: { objectType: string;
    objectId: string; relation: 'admin'|'editor' }; justification?: string }): Promise<void>` — drives the
    permission-requests UI to submit one scoped request and resolves once the success state is visible.

This helper drives the real UI (the design's chosen mechanism). The dynamic permission-builder field
selectors (the add-permission row, the object-type/object-id/relation inputs, the submit button) must be
**pinned against the running page** during this task — `permission-requests.js` builds them client-side. The
known anchors are `input[name="requested_role"]`, `#permissionsSection`, and the submit button; confirm the
rest by opening `permission-requests.php` in the running stack (or reading the JS that constructs the rows)
before finalizing the selectors.

- [ ] **Step 1: Pin the permission-builder selectors**

Bring the stack up. As a seeded editor, open `permission-requests.php` and inspect (or read
`assets/js/permission-requests.js`) to record the exact selectors for: choosing `requested_role`, adding a
permission row, setting its object-type / object-id / relation, and the submit button + the post-submit
success indicator (`#formAlerts` success, or a status row appearing in `#existingRequestsBody`). Write the
findings as a comment block at the top of `requestAccess.ts`.

- [ ] **Step 2: Implement `requestAccess.ts` using the pinned selectors**

Create `e2e/rbac/support/requestAccess.ts` with `submitAccessRequest(page, opts)` that: selects the role
radio, adds the permission with the given `objectType`/`objectId`/`relation`, fills justification if given,
clicks submit, and `await expect(<success indicator>).toBeVisible()`. Use Playwright `expect`/locators; no
fixed `waitForTimeout`. (Full selector bodies are produced in Step 1 — they are page-derived, not guessable
from static PHP; this is the inherent E2E discovery step.)

- [ ] **Step 3: Smoke-validate the helper in a throwaway spec**

Write a temporary spec (deleted before commit) that: `actingAs(browser, 'cei-editor')` →
`submitAccessRequest(page, { requestedRole: 'calendar_editor', permission: { objectType:
'national_calendar', objectId: 'IT', relation: 'editor' } })` → then asserts via API
(`GET /auth/access-requests` as that user, or query the DB) that a pending request exists. Run:
`yarn test --project=rbac <temp>.spec.ts`. Expected: PASS. Delete the temp spec.

- [ ] **Step 4: Typecheck + lint**

Run: `yarn typecheck && yarn lint` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/requestAccess.ts
git commit -m "feat(rbac): requestAccess.ts — submit a pending request via the UI"
```

---

### Task 4: `mailpit.ts` — verification-email retrieval for registration specs

**Files:**

- Create: `e2e/rbac/support/mailpit.ts`
- Create: `e2e/rbac/support/mailpit.test.ts`
- Modify: `.env.development` (+ `.env.example` if it exists) — add `MAILPIT_API_URL`

**Interfaces:**

- Consumes: the Mailpit REST API (`GET /api/v1/messages`, `GET /api/v1/message/{ID}`), `MAILPIT_API_URL`.
- Produces (relied on by scenarios 01/04):
  - `waitForVerificationLink(toEmail: string, opts?: { timeoutMs?: number }): Promise<string>` — poll Mailpit
    for the newest message to `toEmail`, extract the Zitadel verification URL from its body, return it. Throws
    on timeout. Injectable fetch for the unit test: `waitForVerificationLink(toEmail, { fetchImpl })`.
  - `latestMessageTo(toEmail: string, fetchImpl?): Promise<{ id: string; html: string; text: string } | null>`.

- [ ] **Step 1: Confirm the Mailpit base URL**

Find the Mailpit service in `docker-compose.yml` (+ `docker-compose.override.yml`): service name + HTTP API
port (Mailpit default UI/API port is 8025). Determine the host-reachable base URL (e.g.
`http://localhost:8025`) and add `MAILPIT_API_URL=http://localhost:8025` to `.env.development`. Record the
verification-URL pattern Zitadel emails use (open one real registration email in Mailpit, or inspect the
template) so the extractor regex is correct.

- [ ] **Step 2: Write the failing unit test (fetch injected — no live Mailpit needed)**

Create `e2e/rbac/support/mailpit.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { waitForVerificationLink } from './mailpit';

test('waitForVerificationLink extracts the verification URL from the newest message', async () => {
    const verifyUrl = 'http://localhost:8080/ui/v2/login/verify?code=ABC&userID=42';
    const fetchImpl = (async (url: string) => {
        if (url.includes('/api/v1/messages')) {
            return new Response(JSON.stringify({ messages: [{ ID: 'm1', To: [{ Address: 'cei-admin+e2e@litcal.test' }] }] }), { status: 200 });
        }
        if (url.includes('/api/v1/message/m1')) {
            return new Response(JSON.stringify({ HTML: `<a href="${verifyUrl}">Verify</a>`, Text: '' }), { status: 200 });
        }
        return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    const link = await waitForVerificationLink('cei-admin+e2e@litcal.test', { fetchImpl, timeoutMs: 1000 });
    expect(link).toBe(verifyUrl);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn test --project=rbac-support e2e/rbac/support/mailpit.test.ts`
Expected: FAIL — `Cannot find module './mailpit'`.

- [ ] **Step 4: Implement `mailpit.ts`**

Create `e2e/rbac/support/mailpit.ts` with `latestMessageTo` (GET `/api/v1/messages`, find newest whose `To`
contains the address, GET `/api/v1/message/{ID}` for the body) and `waitForVerificationLink` (poll
`latestMessageTo` until found or `timeoutMs`, extract the first `https?://…verify…` URL from HTML/Text via a
regex matching the pattern recorded in Step 1). Accept an injectable `fetchImpl` (default global `fetch`) and
`MAILPIT_API_URL` from env. No `waitForTimeout`; poll with a bounded loop + short delay.

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test --project=rbac-support e2e/rbac/support/mailpit.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `yarn typecheck && yarn lint` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add e2e/rbac/support/mailpit.ts e2e/rbac/support/mailpit.test.ts .env.development
git commit -m "feat(rbac): mailpit.ts verification-email retrieval"
```

---

### Task 5: Cleanup extension — dynamic grants + API data restore

**Files:**

- Modify: `e2e/rbac/support/cleanup.ts`
- Modify: `e2e/rbac/support/cleanup.test.ts` (existing)

**Interfaces:**

- Consumes: `Fga`, `ZitadelAdmin`, `USERS`, `execFile` (already used in `cleanup.ts`).
- Produces:
  - `deleteAllSeededUsers()` — extended so it deletes **every** FGA tuple a user could hold (both `admin` and
    `editor` relations from the matrix), not only the matrix-defined one, since scenarios create editor tuples
    dynamically. Implementation: for each seeded user, attempt `f.delete` for their matrix tuple (tolerant),
    then delete the Zitadel user.
  - `gitRestoreApiData(): Promise<void>` (NEW) — restore the API repo's calendar source data after scenario 10
    edits it, via `git -C <API_REPO> checkout -- jsondata/sourcedata` (path confirmed in Step 1). 30s timeout,
    tolerant of "nothing to restore".

- [ ] **Step 1: Confirm the API source-data path + restore command**

Determine the API repo path the local stack builds from (the override bind-mounts `../LiturgicalCalendarAPI`)
and the exact source-data directory `extending.php` writes to (`jsondata/sourcedata/...`). Confirm
`git -C <path> checkout -- <data-dir>` reverts a calendar edit. Record the resolved absolute path as a
constant.

- [ ] **Step 2: Add a failing test for `gitRestoreApiData` export presence**

In `e2e/rbac/support/cleanup.test.ts`, add a test that imports `gitRestoreApiData` and asserts it is a
function (full behavioral coverage is the scenario-10 spec, which needs the stack):

```ts
import { gitRestoreApiData } from './cleanup';
test('gitRestoreApiData is exported', () => {
    expect(typeof gitRestoreApiData).toBe('function');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn test --project=rbac-support e2e/rbac/support/cleanup.test.ts`
Expected: FAIL — `gitRestoreApiData` is not exported.

- [ ] **Step 4: Implement the cleanup extensions**

In `e2e/rbac/support/cleanup.ts`: add the `gitRestoreApiData()` export (using the path from Step 1, an
`execFile('git', ['-C', API_REPO, 'checkout', '--', dataDir], { timeout: 30000 })` wrapped in
`.catch(() => {})`), and make `deleteAllSeededUsers()` tolerant of every user's tuple being present or absent
(it already deletes the matrix tuple; ensure the `f.delete` is `.catch(()=>{})`-guarded so a dynamically-
revoked tuple doesn't error).

- [ ] **Step 5: Run to verify it passes**

Run: `yarn test --project=rbac-support e2e/rbac/support/cleanup.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `yarn typecheck && yarn lint` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add e2e/rbac/support/cleanup.ts e2e/rbac/support/cleanup.test.ts
git commit -m "feat(rbac): cleanup — dynamic grant teardown + gitRestoreApiData"
```

---

## Self-Review

Spec coverage (against `2026-06-22-rbac-e2e-phase2-execution-design.md`):

- "Seeding model — editors get no FGA tuple by default" → Task 1.
- New harness piece `grant.ts` (per-spec precondition seeding) → Task 2.
- New harness piece `requestAccess.ts` (real-UI request submission) → Task 3.
- New harness piece `mailpit.ts` (registration verification) → Task 4.
- Cleanup extensions (dynamic grants + `gitRestoreApiData`) → Task 5.

The four stable resource-admin tuples still seed at setup (Task 1 keeps `admin`-relation writes); the two
registration users remain in `REGISTRATION_USER_IDS` (untouched by setup) — no code change needed, they are
simply not in `SEEDED_USER_IDS`.

Out of scope here (lives in the companion Scenarios plan): the 11 `NN-*.spec.ts` files, the registration
UI-driving helper, and the notification-badge/dashboard-card assertions.

## Execution Handoff

Plan complete. The companion **Scenarios** plan (the 11 `NN-*.spec.ts`) is authored after this foundation
lands, when `requestAccess.ts`/`grant.ts`/`mailpit.ts` signatures are final and selectors can be pinned
against the running stack. Recommended execution: **subagent-driven-development** — each foundation task is a
fresh subagent + review. Note Tasks 1–5 require the local docker stack up for their `rbac-support` runs.
