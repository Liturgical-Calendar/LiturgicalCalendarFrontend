# RBAC E2E Phase 2 — Scenario Specs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **PREREQUISITE:** the Foundation plan (`2026-06-22-rbac-e2e-phase2-foundation.md`) must be fully landed —
> this plan consumes `seedUser` (admins-only tuples), `grantScope`/`revokeScope`/`grantTuple` (grant.ts),
> `submitAccessRequest` (requestAccess.ts), `waitForVerificationLink` (mailpit.ts), and the cleanup extensions.

**Goal:** Implement the 11 Playwright scenario specs that prove the registration → access-request → review →
approval → RBAC-scoping lifecycle through the real UI, exercising the merged scoped-admin-review feature.

**Architecture:** Each spec is an independent `e2e/rbac/NN-<name>.spec.ts` in the `rbac` project (serial,
single worker, depends on `rbac-setup`). Specs compose the foundation helpers plus two new UI-driver helpers
(`support/review.ts` for the admin review UI, `support/register.ts` for Zitadel self-registration). Specs
seed their own preconditions and clean up after themselves.

**Tech Stack:** Playwright (TS), the foundation helpers, `actingAs`, `Fga`/`ZitadelAdmin` for assertions, the
`/auth/access-requests` + `/admin/access-requests` endpoints, `permission-requests.php` (submit) and
`admin-permissions.php` (review).

## Global Constraints

- Branch `e2e/rbac-access-requests`; do NOT push without explicit request; never `--no-verify`.
- `yarn typecheck` + `yarn lint` exit 0 before every commit. Specs run via `yarn test --project=rbac <file>`.
- Serial, single worker; the local docker stack must be up (and built from the API branch/`development` that
  contains the scoped-admin-review feature — recreate `litcal-api`/`litcal-frontend` if needed).
- No fixed `waitForTimeout`; use Playwright `expect`/locator auto-waiting and the helpers' bounded polling.
- Each spec is INDEPENDENT and order-free: it seeds its own preconditions and cleans up in `afterEach`/
  `finally`. Never depend on another spec having run.
- Scoping facts the specs assert (from the feature design): a resource-admin sees only requests whose every
  permission targets a resource they hold `admin` on; the global admin (`super-admin`) sees all; a request is
  scoped to its permission's `{object_type, object_id}`.
- Fixed object_ids: `national_calendar:IT`/`US`, `diocesan_calendar:romamo_it`, `wider_region:Europe`,
  `general_roman_calendar:temporale`. Registration users: `cei-admin`, `usccb-editor`.

## Shared spec conventions (apply to every scenario task)

Every spec file follows this skeleton (imports trimmed per spec):

```ts
import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { grantScope, revokeScope } from './support/grant';
import { submitAccessRequest } from './support/requestAccess';
import { findRequestRow, requestVisible, actOnRequest } from './support/review';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';
import { truncateAppTables, gitRestoreApiData } from './support/cleanup';

test.afterEach(async () => {
    // Remove any pending/approved requests created this spec; revoke dynamic editor grants;
    // restore API data if a scenario edited it. Seeded users + admin tuples persist across the suite.
    await truncateAppTables();
    // revokeScope(...) for any editor whose grant this spec created (per-spec list);
    // gitRestoreApiData() only in scenario 10.
});
```

**Assertion primitives (used throughout):**

- "User X sees request R" → act as X, `await page.goto('/admin-permissions.php')`,
  `expect(await requestVisible(page, { requesterEmail: USERS[r].email })).toBe(true)` (and `false` for the
  negative case). `requestVisible`/`findRequestRow` are pinned in Task 1.
- "FGA tuple + role now exist for user U at scope" — resolve the Zitadel id by email, then assert the tuple
  (`.toBe(true)`; after revoke, `.toBe(false)`):

  ```ts
  const zid = await new ZitadelAdmin().findUserIdByEmail(USERS[U].email);
  expect(await new Fga().check(`user:${zid}`, relation, `${type}:${id}`)).toBe(true);
  ```

- "Request has status S in the list" → `requestVisible(page, { requesterEmail, status: S })` (the review list
  supports a status filter via `GET /admin/access-requests?status=...`).

---

### Task 1: `support/review.ts` — admin review-UI driver

**Files:**

- Create: `e2e/rbac/support/review.ts`

**Interfaces:**

- Consumes: `admin-permissions.php` review section + `assets/js/admin-permissions.js`
  (`loadAccessRequests()` → `GET /admin/access-requests`; the review list container; per-request rows;
  `#permReqReviewModal` with `#permReqDetails`, `#permReqNotesSection` (the notes textarea),
  `#permReqModalAlerts`; the approve/reject/revoke buttons; `processAccessReq(action)` → `POST
  /admin/access-requests/{id}/{action}` with `notes`).
- Produces (relied on by Tasks 2–13):
  - `requestVisible(page: Page, q: { requesterEmail: string; status?: string }): Promise<boolean>` — navigate/
    reload the review list (optionally with the status filter) and return whether a row for that requester is
    present.
  - `findRequestRow(page: Page, q: { requesterEmail: string }): Promise<Locator>` — the row locator.
  - `actOnRequest(page: Page, q: { requesterEmail: string; action: 'approve'|'reject'|'revoke'; notes?:
    string }): Promise<void>` — open the row's review modal, fill notes if given, click the action button,
    and await the success state + list refresh.

- [ ] **Step 1: Pin the review-UI selectors**

With the stack up, act as `super-admin`, seed one pending request (`actingAs('cei-editor')` +
`submitAccessRequest(... editor@IT)`), open `admin-permissions.php`, and record the exact selectors: the
review-list container, the per-row selector + how a row encodes/identifies the request (requester email text,
`data-*` id), the control that opens `#permReqReviewModal` for a row, the modal's approve/reject/revoke
buttons, the notes textarea inside `#permReqNotesSection`, and the post-action success indicator
(`#permReqModalAlerts` success / the row disappearing). Read `admin-permissions.js`
`loadAccessRequests()`/`renderAccessReqDetails()`/`processAccessReq()` to confirm DOM structure. Record as a
header comment.

- [ ] **Step 2: Implement `review.ts` with the pinned selectors**

Create `e2e/rbac/support/review.ts` exporting `requestVisible`, `findRequestRow`, `actOnRequest` per the
Interfaces, using Playwright locators + `expect` auto-wait (reload the list via `page.goto`/a refresh control;
no fixed sleeps). `actOnRequest` opens the modal, fills `#permReqNotesSection` textarea when `notes` is given,
clicks the action, and `await expect(<success>).toBeVisible()`.

- [ ] **Step 3: Smoke-validate in a throwaway spec**

Temp spec: seed a pending `editor@IT` request as `cei-editor`; act as `super-admin`;
`expect(await requestVisible(page, { requesterEmail: USERS['cei-editor'].email })).toBe(true)`;
`actOnRequest(page, { requesterEmail: USERS['cei-editor'].email, action: 'approve', notes: 'ok' })`; assert
the FGA tuple now exists. Run `yarn test --project=rbac <temp>.spec.ts` → PASS. Delete the temp spec.

- [ ] **Step 4: Typecheck + lint + commit**

```bash
yarn typecheck && yarn lint
git add e2e/rbac/support/review.ts
git commit -m "feat(rbac): review.ts — admin access-request review-UI driver"
```

---

### Task 2: Scenario 02 — `cei-editor` requests edit@IT (headline scoped review lifecycle)

**Files:**

- Create: `e2e/rbac/02-cei-editor-edit-request.spec.ts`

**Interfaces:** consumes `grantScope`, `submitAccessRequest`, `actingAs`, `review.ts`, `Fga`, `ZitadelAdmin`,
`USERS`.

This is the headline spec — exercise it first to validate `review.ts` + the whole loop.

- [ ] **Step 1: Write the spec**

Precondition: seed `cei-admin = admin@IT` (`grantScope('cei-admin')` — cei-admin is a registration user, so
this seeds the precondition admin tuple + role for an already-existing Zitadel account; if cei-admin is not
present as a Zitadel account in this independent spec, create+login it first via the foundation seeding path).
Then:

1. `actingAs('cei-editor')` → `submitAccessRequest(page, { requestedRole: 'calendar_editor', permission: {
   objectType: 'national_calendar', objectId: 'IT', relation: 'editor' } })`.
2. Assert visibility: act as `super-admin` → `requestVisible(cei-editor)` true; act as `cei-admin` →
   `requestVisible(cei-editor)` true; act as `usccb-admin` → `requestVisible(cei-editor)` **false**.
3. `cei-admin` rejects: `actOnRequest({ requesterEmail: cei-editor, action: 'reject', notes: 'fix scope' })`.
4. `super-admin` sees the rejection: `requestVisible(cei-editor, { status: 'rejected' })` true.
5. `cei-editor` revises + resubmits (re-`submitAccessRequest`, or the revise affordance — pin during impl).
6. `cei-admin` grants: `actOnRequest({ requesterEmail: cei-editor, action: 'approve', notes: 'ok' })`.
7. Assert the FGA tuple `editor@national_calendar:IT` + the role now exist for cei-editor.
8. `super-admin` sees the grant: `requestVisible(cei-editor, { status: 'approved' })` true.

`afterEach`: `truncateAppTables()`; `revokeScope('cei-editor')`; `revokeScope('cei-admin')`.

- [ ] **Step 2: Run the spec**

Run: `yarn test --project=rbac e2e/rbac/02-cei-editor-edit-request.spec.ts`
Expected: PASS. Iterate selectors/timing against the live stack until green (the E2E red-green loop).

- [ ] **Step 3: Typecheck + lint + commit**

```bash
yarn typecheck && yarn lint
git add e2e/rbac/02-cei-editor-edit-request.spec.ts
git commit -m "test(rbac): 02 — cei-editor edit@IT scoped review lifecycle"
```

---

### Task 3: `support/register.ts` — Zitadel self-registration driver

**Files:**

- Create: `e2e/rbac/support/register.ts`

**Interfaces:**

- Consumes: the registration entry point (from `request-access.php`/login — pinned in Step 1), `mailpit.ts`
  `waitForVerificationLink`, the cross-org env (`ZITADEL_ORG_ID`, org-domain-suffix login-name setting).
- Produces (relied on by scenarios 01/04):
  - `registerAndVerify(page: Page, user: { email: string; password: string; firstName: string; lastName:
    string }): Promise<void>` — drive the Zitadel self-registration UI, retrieve the verification link from
    Mailpit, complete verification, and leave the user able to log in.

- [ ] **Step 1: Pin the registration flow**

With the stack up, manually walk the self-registration UI a registration user would use (from
`request-access.php` or the login page's "register" link): record the form field selectors (email, password,
given/family name), the submit control, and how the Zitadel verification email's link completes verification
(does it auto-verify on visit, or require a code entry?). Confirm the cross-org registration succeeds for an
email pattern `<id>+e2e@litcal.test`. Record as a header comment.

- [ ] **Step 2: Implement `register.ts`** using the pinned selectors + `waitForVerificationLink(email)` to
  fetch + visit/complete the verification link.

- [ ] **Step 3: Smoke-validate** in a temp spec: `registerAndVerify(page, USERS['cei-admin'])` then assert the
  user can log in (e.g. `oidcLogin` succeeds, or `findUserIdByEmail` returns an id and a login lands an
  authenticated `/auth/me.php`). Run → PASS. Delete temp spec. Clean up the created user.

- [ ] **Step 4: Typecheck + lint + commit**

```bash
yarn typecheck && yarn lint
git add e2e/rbac/support/register.ts
git commit -m "feat(rbac): register.ts — Zitadel self-registration + Mailpit verify driver"
```

---

### Task 4: Scenario 01 — `cei-admin` registers, requests admin@IT

**Files:**

- Create: `e2e/rbac/01-cei-admin-register-request.spec.ts`

- [ ] **Step 1: Write the spec** (real registration; cei-admin is NOT seeded):

1. `registerAndVerify(page, USERS['cei-admin'])`; log in (save state or drive login UI).
2. As cei-admin, `submitAccessRequest(page, { requestedRole: 'calendar_editor', permission: { objectType:
   'national_calendar', objectId: 'IT', relation: 'admin' } })`.
3. Assert **only `super-admin`** sees it (cei-admin is not yet an IT admin): act as `super-admin` →
   `requestVisible(cei-admin)` true; act as `usccb-admin` → false. (cei-admin cannot review their own request
   into existence — they have no admin tuple yet.)
4. `super-admin` rejects (`notes`), cei-admin revises + resubmits, `super-admin` approves.
5. Assert the FGA tuple `admin@national_calendar:IT` + role now exist for cei-admin.

`afterEach`: `truncateAppTables()`; delete the cei-admin Zitadel user + its tuple (it was created in-spec).

- [ ] **Step 2: Run** `yarn test --project=rbac e2e/rbac/01-cei-admin-register-request.spec.ts` → PASS
  (iterate; registration is the most timing-sensitive — allow Mailpit polling).

- [ ] **Step 3: Typecheck + lint + commit**

```bash
git add e2e/rbac/01-cei-admin-register-request.spec.ts
git commit -m "test(rbac): 01 — cei-admin registration + admin@IT request lifecycle"
```

---

### Task 5: Scenario 03 — `usccb-admin` requests admin@USA

**Files:** Create `e2e/rbac/03-usccb-admin-request.spec.ts`

- [ ] **Step 1: Write the spec.** usccb-admin is a seeded resource-admin (already admin@US). For a *pending*
  admin@US **request**, use a not-yet-US-admin requester (per the original design's intent, usccb-admin
  requesting *additional* admin scope; if that's not meaningful, request as a fresh applicant for admin@US).
  Concretely: act as a seeded editor without US scope (e.g. `grc-editor`) and
  `submitAccessRequest(... admin@national_calendar:US)`. Assert **`cei-admin` does NOT see it** (IT admin),
  only `super-admin` does → `super-admin` approves → assert the tuple now exists for the requester.
  `afterEach`: truncate + revoke the requester's US tuple.

  (Resolve the "who requests admin@US" requester during impl so the request is in-scope for usccb-admin/
  super-admin but out-of-scope for cei-admin — the assertion target is the cei-admin-can't-see scoping.)

- [ ] **Step 2: Run → PASS.**
- [ ] **Step 3: commit** `test(rbac): 03 — admin@USA request not visible to cei-admin`.

---

### Task 6: Scenario 04 — `usccb-editor` registers, requests edit@USA

**Files:** Create `e2e/rbac/04-usccb-editor-register-request.spec.ts`

- [ ] **Step 1: Write the spec.** Precondition: seed `usccb-admin = admin@US` (already seeded at setup).
  `registerAndVerify(page, USERS['usccb-editor'])` (registration user) → request `edit@US` → assert
  `usccb-admin` + `super-admin` see it, `cei-admin` does not → `usccb-admin` grants → assert tuple+role exist
  → `super-admin` sees the grant. `afterEach`: truncate + delete usccb-editor user/tuple.
- [ ] **Step 2: Run → PASS.**
- [ ] **Step 3: commit** `test(rbac): 04 — usccb-editor registration + edit@USA grant`.

---

### Task 7: Scenario 05 — `rome-admin` requests admin@romamo_it

**Files:** Create `e2e/rbac/05-rome-admin-request.spec.ts`

- [ ] **Step 1:** Pending admin@`diocesan_calendar:romamo_it` request (requester per the same pattern as Task
  5). Assert only `super-admin` sees it → grants → tuple exists. `afterEach`: truncate + revoke.
- [ ] **Step 2: Run → PASS.** **Step 3: commit** `test(rbac): 05 — admin@romamo_it request, super-admin only`.

---

### Task 8: Scenario 06 — `rome-editor` requests edit@romamo_it

**Files:** Create `e2e/rbac/06-rome-editor-request.spec.ts`

- [ ] **Step 1:** Precondition `rome-admin = admin@romamo_it` (seeded at setup). `actingAs('rome-editor')` →
  request `edit@romamo_it` → assert `super-admin` + `rome-admin` see it, `cei-admin`/`usccb-admin` do not →
  `rome-admin` grants → `super-admin` sees the grant. `afterEach`: truncate + `revokeScope('rome-editor')`.
- [ ] **Step 2: Run → PASS.** **Step 3: commit** `test(rbac): 06 — rome-editor edit@romamo_it scoped review`.

---

### Task 9: Scenario 07 — dashboard card scoping matrix

**Files:** Create `e2e/rbac/07-dashboard-card-scoping.spec.ts`

**Interfaces:** consumes `actingAs`, the `.admin-block` card selectors + the resource-admin "Access Requests
to Review" card (from `admin-dashboard.php`/`admin-blocks.php`), `Auth`/page DOM.

- [ ] **Step 1: Pin the card selectors + per-role expectations.** Read `admin-dashboard.php` +
  `admin-blocks.php`: record each card's `data-block-id`/href and the gating conditional (`$isAdmin`,
  `$isResourceAdmin`, `$hasCalendarRole`, scope checks). Build the expected per-user matrix: which cards each
  of `super-admin`, `cei-admin`, `cei-editor`, `usccb-admin`, `grc-admin`, `europe-admin` sees, scope
  narrowing (National → IT vs USA; Diocesan → romamo_it; GRC; Europe), and that resource-admins see the
  "Access Requests to Review" card while editors do not and the global FGA-tuple section is hidden.
- [ ] **Step 2: Write the spec** asserting the matrix per user (extends the existing
  `00-smoke-dashboard-scoping.spec.ts` patterns; this is the full matrix). Precondition: `grantScope` for any
  editor whose card-visibility depends on holding a scope. `afterEach`: revoke those.
- [ ] **Step 3: Run → PASS.** **Step 4: commit** `test(rbac): 07 — dashboard card scoping matrix`.

---

### Task 10: Scenario 08 — negative authorization

**Files:** Create `e2e/rbac/08-negative-auth.spec.ts`

- [ ] **Step 1: Write the spec.** Seed a pending `edit@US` request (requester as in Task 5). As `cei-admin`
  (IT admin): (a) attempt to approve the US request via the API the UI uses
  (`POST /admin/access-requests/{id}/approve` through `page.request` with cei-admin's session) → expect 403;
  (b) assert the US request is **not visible** in cei-admin's review list; (c) attempt to open a USA-scoped
  dashboard card / edit the USA calendar via `extending.php` → denied/hidden. `afterEach`: truncate + revoke.
- [ ] **Step 2: Run → PASS.** **Step 3: commit** `test(rbac): 08 — negative authorization (cei-admin vs USA)`.

---

### Task 11: Scenario 09 — revoke-after-grant lifecycle

**Files:** Create `e2e/rbac/09-revoke-after-grant.spec.ts`

- [ ] **Step 1: Write the spec.** Precondition: `grantScope('cei-editor')` (cei-editor already edit@IT) and a
  corresponding approved request row (seed via submit+approve, or seed the approved request). As `cei-admin`
  (or `super-admin`), `actOnRequest({ requesterEmail: cei-editor, action: 'revoke', notes: 'revoked' })`.
  Assert: the FGA tuple + role are **removed** (`Fga.check(...) === false`); cei-editor's dashboard cards for
  IT disappear (act as cei-editor, assert the National-IT card is gone); a `revoked` notification is delivered
  (assert via cei-editor's notification surface — `/auth/access-requests/status` or the bell — pin during
  impl). `afterEach`: truncate + ensure tuple removed.
- [ ] **Step 2: Run → PASS.** **Step 3: commit** `test(rbac): 09 — revoke-after-grant lifecycle`.

---

### Task 12: Scenario 10 — scoped data editing

**Files:** Create `e2e/rbac/10-scoped-data-editing.spec.ts`

**Interfaces:** consumes `grantScope`, `actingAs`, `extending.php` edit flow, `gitRestoreApiData`.

- [ ] **Step 1: Pin the `extending.php` edit flow** (calendar selection, an edit, save, success indicator) for
  the IT national calendar; confirm the same against USA is blocked for a user scoped only to IT.
- [ ] **Step 2: Write the spec.** Precondition `grantScope('cei-editor')` (edit@IT). As cei-editor: edit the
  IT national calendar via `extending.php` → assert success; attempt the same edit against USA → assert
  failure (403/hidden). `afterEach`: `truncateAppTables()`; `revokeScope('cei-editor')`; **`gitRestoreApiData()`**.
- [ ] **Step 3: Run → PASS** (verify `gitRestoreApiData` reverts the edit — re-run must start clean).
- [ ] **Step 4: commit** `test(rbac): 10 — scoped data editing (IT ok, USA denied)`.

---

### Task 13: Scenario 11 — session/token resilience

**Files:** Create `e2e/rbac/11-session-resilience.spec.ts`

- [ ] **Step 1: Write the spec.** (a) Cookie/session expiry + refresh mid-flow: clear/expire the
  `litcal_access_token` cookie and assert the app refreshes or redirects to re-auth correctly; (b) logout then
  log in as a different user (act as A, log out, act as B) — assert no stale auth state; (c) a grant/revoke is
  reflected on the next `/auth/me` without stale caching: `grantScope`/`revokeScope` a user mid-session and
  assert the change surfaces after a reload. `afterEach`: truncate + revoke any dynamic grants.
- [ ] **Step 2: Run → PASS.** **Step 3: commit** `test(rbac): 11 — session/token resilience`.

---

## Self-Review

Spec coverage — every scenario in `2026-06-22-rbac-e2e-phase2-execution-design.md` maps to a task:
01→Task 4, 02→Task 2, 03→Task 5, 04→Task 6, 05→Task 7, 06→Task 8, 07→Task 9, 08→Task 10, 09→Task 11,
10→Task 12, 11→Task 13; the review-UI driver (Task 1) and registration driver (Task 3) are the shared helpers
the design's "new harness pieces" implied beyond the foundation. Build order matches the design: review.ts +
scenario 02 first, then register.ts + scenario 01, then the rest.

Interface consistency: every spec consumes only foundation exports (`grantScope`/`revokeScope`/`grantTuple`,
`submitAccessRequest`, `waitForVerificationLink`, `truncateAppTables`/`gitRestoreApiData`) + the two new
drivers (`requestVisible`/`findRequestRow`/`actOnRequest`, `registerAndVerify`) + `Fga`/`ZitadelAdmin`/`USERS`.
Names match across tasks.

Known E2E discovery points (not placeholders — the inherent red-green loop): the exact DOM selectors for the
review list/modal (Task 1 Step 1), the permission-builder (Foundation Task 3), the registration UI (Task 3
Step 1), the `extending.php` edit flow (Task 12 Step 1), and the revoke notification surface (Task 11) are
pinned against the running stack in the cited steps, then frozen in the helper/spec.

Open item to resolve at impl: the "who requests admin@US / admin@romamo_it" requester for scenarios 03/05
(must be in-scope for the target admin + super-admin, out-of-scope for cei-admin) — pick a seeded editor
lacking that scope; noted in each task.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-rbac-e2e-phase2-scenarios.md`. Execute **after**
the Foundation plan lands, via **subagent-driven-development** (fresh subagent per task + review), with the
docker stack up. Tasks 1 and 3 (the UI drivers) gate the scenarios that consume them — do them in the listed
order (review.ts → 02 → register.ts → 01 → 03–11).
