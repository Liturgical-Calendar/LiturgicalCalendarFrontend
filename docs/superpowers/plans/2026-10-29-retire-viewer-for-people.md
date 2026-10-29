# Retire `viewer` for People Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People read admin data through the role they hold, not through `viewer` tuples. `viewer` can no longer be
requested or granted for a person, and a sweep removes what already exists.

**Architecture:**

- **API.**
    - Requests and grants refuse `viewer`.
    - `AccessRequestRepository` gains `replacePendingPermissions()`.
    - A `ViewerRetirementSweep` service, run by a CLI script, does the cleanup:
        - deletes `user:*` `viewer` tuples, through the outbox on failure;
        - strips `viewer` from pending requests, rejecting any left empty;
        - cascades away roles held only through `viewer`.
- **Frontend.**
    - One `AuthHelper` rule maps role to readable types, and every read check uses it.
    - The forms stop offering `viewer`.
    - The rbac E2E specs are rewritten around role-based reading.

**Tech Stack:** PHP 8.4, PHPUnit, OpenFGA, Zitadel, PostgreSQL (API). PHP 8.4, vanilla ES modules, Vitest, Playwright,
gettext (frontend).

**Spec:** `docs/superpowers/specs/2026-10-29-retire-viewer-for-people-design.md` (frontend repo, branch
`feat/retire-viewer-for-people`). Issue: LiturgicalCalendarAPI#1049.

## Global Constraints

- **Two PRs, both targeting `development`.**
    - API: branch `feat/retire-viewer-for-people` from `origin/development`. Merge it first.
    - Frontend: branch `feat/retire-viewer-for-people`, the current branch, which carries the design and this plan.
    - Frontend CI builds the API from `development`, so the rewritten E2E specs pass only after the API PR merges.
- **Repos.**
    - API: `/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI`
    - Frontend: `/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend`
- **Role → readable types** is exactly `AccessRequestRepository::ROLE_OBJECT_TYPES`:
    - `calendar_editor`: `national_calendar`, `diocesan_calendar`, `wider_region`, `rite_calendar`;
    - `test_editor`: `national_calendar_test`, `diocesan_calendar_test`, `rite_calendar_test`;
    - `developer`: all seven;
    - global `admin`: everything.
- **Relations a person may request or be granted:** `editor`, `admin`. Revoking an existing `viewer` stays allowed.
- **`viewer` stays in the OpenFGA model** and in the display maps, so history still renders.
- **Sweep runs.** Dry run by default, `--apply` to change anything. Idempotent. One audit-log entry per change. The
  reviewer id is `system:viewer-retirement`.
- **Rejection note** for an emptied pending request: "Read access now comes with the role. Please request editor or
  admin access on the calendars you want to work on."
- **Tooling.** Never use `--no-verify`.
    - API gate: `composer analyse`, `composer lint`, `composer lint:openapi`, focused PHPUnit files.
    - Frontend gate: `composer lint`, `composer analyse`, `composer lint:md`, `yarn lint`, `yarn typecheck`,
      `yarn test:unit`.
    - Emphasis is written `_x_`, strong `**x**` (MD049/MD050).
- **Commits and pushes.** Commits end with the session's Co-Authored-By and Claude-Session lines. Push each round's
  commits together in one push, then check CodeRabbit's rate-limit notice (frontend `CLAUDE.md`).
- **Postgres and Docker are not available locally.** DB-backed tests are written and left for CI. Say so in the reports.

## Rulings

- **A `developer`-only user keeps `developer-dashboard.php` as their home.** The `admin-dashboard.php` redirect for
  users without a calendar role is unchanged. The read rule still lets them open the read-only pages it covers
  (Decrees) directly. Changing their home page is a separate decision, and is flagged in the PR body.
- **Pages that only require a login keep their entry rules:** `temporale.php`, `sanctorale.php`, `extending.php`. The
  hub must stay reachable for role-less users, because "Request access" lives there. Only checks that use `viewer` today
  are rewired.

## Review Focus

1. **A person holding `editor` on one object and `viewer` on another.** The sweep deletes the `viewer` tuple and keeps
   their role. Test in Task 3.
2. **More than one page of tuples.** `readTuples` must follow `continuation_token` until it is empty. Test in Task 3,
   with two pages.
3. **A pending request with both `viewer` and `editor`.** It keeps `editor` and stays pending, not rejected. Test in
   Task 3.
4. **The dry run writes nothing:** no FGA write, no DB write, no Zitadel call. Test in Task 3.
5. **Resubmitting a rejected viewer-only request** leaves one empty row and an info alert, not zero rows. Test in Task 5
   (Vitest for the pure part), and the E2E in Task 6 if it is cheap.

---

## API PR: `feat/retire-viewer-for-people`

### Task 1: Refuse `viewer` from people

**Files:**

- Modify: `src/Handlers/Auth/AccessRequestHandler.php` (`VALID_RELATIONS` line 50; validation ~342, ~508)
- Modify: `src/Handlers/Admin/PermissionAdminHandler.php` (grant validation ~967; `VALID_RELATIONS` line 55 also feeds the
  list filter ~316 and revoke)
- Modify: `jsondata/schemas/openapi.json` (relation enums of the access-request bodies and the grant body)
- Test: `phpunit_tests/Handlers/Auth/AccessRequestHandlerValidationTest.php`,
  `phpunit_tests/Handlers/Admin/PermissionAdminHandlerTest.php`

**Interfaces:**

- Produces:
    - **Access requests:** create and resubmit answer 400 for any `viewer` permission, with the message "The viewer
      relation can no longer be requested: read access comes with the role. Request editor or admin instead."
    - **Grants:** `POST /admin/permissions` answers 400 for `relation: viewer`, saying read access comes with the role.
    - **Unchanged:** revoke and list still accept `viewer`.

- [ ] **Step 1: Write the failing tests.**
    - `testCreateRejectsViewer` and `testResubmitRejectsViewer`: a body with `[viewer IT, editor FR]` → 400 naming
      `viewer`, and nothing stored. Put them in the validation test if it is DB-free; otherwise in the handler test.
    - `testGrantRejectsViewer`: 400, no tuple written (the MockHandler queue stays unused).
    - `testRevokeStillAcceptsViewer`: a revoke of `viewer` proceeds.
- [ ] **Step 2: Run** the focused files. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
    - `AccessRequestHandler::VALID_RELATIONS` becomes `['admin', 'editor']`, with the `viewer`-specific message above.
    - In `PermissionAdminHandler`, refuse `viewer` in the grant path only, and keep `VALID_RELATIONS` for list and
      revoke.
    - Remove `viewer` from the two request-body enums and the grant-body enum in OpenAPI. Keep it wherever a response
      or a revoke body describes stored data.
- [ ] **Step 4: Run** the focused tests, `composer lint:openapi` and `composer analyse`. Expected: green, DB tests
      skipped.
- [ ] **Step 5: Commit** `feat(permissions): viewer can no longer be requested or granted for a person (#1049)`.

### Task 2: Rewrite a pending request's permissions

**Files:**

- Modify: `src/Repositories/AccessRequestRepository.php` (next to `resubmit()`, ~line 896)
- Test: `phpunit_tests/Repositories/AccessRequestRepositoryTest.php`

**Interfaces:**

- Produces: `public function replacePendingPermissions(string $id, array $permissions): bool`.
    - It updates `permissions` (JSONB) only when the row's `status = 'pending'`, and returns whether a row changed.
    - `$permissions` is `list<array{object_type: string, object_id: string, relation: string}>`.

- [ ] **Step 1: Write the failing tests.**
    - `testReplacePendingPermissionsUpdatesAPendingRow`: compare with `assertEquals`, because JSONB reorders keys.
    - `testReplacePendingPermissionsLeavesOtherStatusesAlone`: a rejected row is unchanged and the call returns false.
- [ ] **Step 2: Implement** with one prepared `UPDATE … WHERE id = :id AND status = 'pending'` and
      `CAST(:permissions AS jsonb)`, mirroring `resubmit()`.
- [ ] **Step 3: Run** the file and `composer analyse`. Expected: skipped locally, no PHPStan errors.
- [ ] **Step 4: Commit** `feat(access-requests): replace a pending request's permissions`.

### Task 3: The sweep

**Files:**

- Create: `src/Services/ViewerRetirementSweep.php`
- Create: `scripts/retire-viewer-tuples.php`, modelled on `scripts/migrate-test-tuples.php`: CLI-only guard,
  `--dry-run` (the default) or `--apply`, env loading, exit codes.
- Test: `phpunit_tests/Services/ViewerRetirementSweepTest.php`

**Interfaces:**

- Consumes:
    - `OpenFgaClient::readTuples(string $user, string $object, ?string $relation, ?int $limit, ?string $continuationToken)`,
      which returns `{tuples, next_continuation_token}`;
    - `OpenFgaClient::deleteTuple()`;
    - `AccessRequestRepository::getPending()`, `replacePendingPermissions()` (Task 2), `reject()`;
    - `ZitadelService::getUserRoles()`;
    - `RoleCascadeService::maybeCascadeRoleRevoke(string $userId, string $role): bool`;
    - `OutboxRepository::insertBatch()` with `OutboxNotifier::notify()`;
    - `AuditLogRepository::log(?string $userId, string $action, string $resourceType, ?string $resourceId, ?array $details)`.
- Produces: `final class ViewerRetirementSweep`.
    - Constructor: the collaborators above, plus `?LoggerInterface`.
    - `public function plan(): ViewerRetirementPlan` returns three lists: `viewerTuples` (`{user, object}`),
      `pendingRequests` (`{id, user, keep: list<Permission>, action: 'rewrite'|'reject'}`) and `roleRevocations`
      (`{user, role}`). It makes no writes.
    - `public function apply(ViewerRetirementPlan $plan): array` returns per-item outcome counts.
    - `ViewerRetirementPlan` is a small readonly value class, in the same file or next to it.

**Algorithm:**

1. **Read the tuples.** Page through an unfiltered read, `readTuples('', '', null, 100, $token)`, until the token is
   empty. Empty `$user` and `$object` and a null `$relation` make the wrapper send no `tuple_key`, which reads the whole
   store: OpenFGA rejects a tuple key that has a relation but no object. The sweep itself keeps only the tuples whose
   relation is `viewer` and whose user starts with `user:`.
2. **Find the pending requests to change.** Read every pending request. For each one containing `viewer`, drop those
   entries. What is left decides the action: `rewrite`, or `reject` when nothing is left.
3. **Find the roles to revoke**, for each user who has a `viewer` tuple:
    - Take each role they hold (`getUserRoles`) that is in `ROLE_OBJECT_TYPES`.
    - For `calendar_editor` and `test_editor`, list the role only when the user has no committed `editor` or `admin`
      tuple in the role's types, and no queued `editor` or `admin` write for those types in the outbox. Use the same
      checks as `RoleCascadeService::maybeCascadeRoleRevoke()`: `userHasAnyTupleInRoleScope()` and
      `OutboxRepository::hasPendingWrite()`.
    - For `developer`, list it when the user has no other tuple in its types besides the `viewer` tuples being deleted.
4. **Apply.** Delete each tuple. A benign "not found" counts as done. Any other failure enqueues an outbox
   `DELETE_TUPLE`, the way `RoleCascadeService::deleteTuplesInRoleScope()` does. Then rewrite or reject each pending
   request, using the reviewer id and note from Global Constraints. Then call `maybeCascadeRoleRevoke()` for each listed
   role, which re-checks before revoking. Write one audit entry per change.

- [ ] **Step 1: Write the failing tests** (FGA via `MockOpenFgaClientTrait`, Zitadel and repositories via `createMock`).
    - `testPlanFollowsContinuationTokens`: two pages, and both pages' `user:` viewers are listed. _(Review Focus 2.)_
    - `testPlanIgnoresNonUserSubjects`: an `application:x` viewer tuple is not listed.
    - `testPlanRewritesMixedPendingRequest`: `[viewer IT, editor FR]` → `rewrite` keeping `[editor FR]`.
      _(Review Focus 3.)_
    - `testPlanRejectsViewerOnlyPendingRequest`.
    - `testPlanKeepsRoleBackedByEditor`: viewer on IT and editor on FR → no role revocation. _(Review Focus 1.)_
    - `testPlanRevokesViewerOnlyRole`.
    - `testPlanMakesNoWrites`: every write method is mocked with `expects($this->never())`. _(Review Focus 4.)_
    - `testApplyDeletesRewritesRejectsAndCascades`: the calls happen in the algorithm's order, with the global reviewer
      id and note.
    - `testApplyEnqueuesOutboxOnDeleteFailure`.
    - `testApplyIsIdempotent`: a second `plan()` on the post-apply state is empty.
- [ ] **Step 2: Run.** Expected: FAIL (class missing).
- [ ] **Step 3: Implement** the class, then the script, which prints the three plan sections and the apply counts.
- [ ] **Step 4: Run** the test file, then `php -l scripts/retire-viewer-tuples.php`, `composer analyse` and
      `composer lint`.
- [ ] **Step 5: Commit** `feat(rbac): sweep that retires viewer tuples held by people (#1049)`.

### Task 4: API PR

- [ ] **Step 1: Run** the full gate (`composer lint && composer analyse && composer lint:openapi && composer test`).
      Report failures from DB or server availability separately.
- [ ] **Step 2: Push and open the PR** against `development`. The body names #1049, gives the release order (API →
      frontend → dry run → `--apply`), states the `developer`-dashboard ruling, and says DB tests first run in CI.

## Frontend PR: `feat/retire-viewer-for-people`

### Task 5: Read access by role, and forms without `viewer`

**Files:**

- Modify: `src/AuthHelper.php` (`canViewResource` 381, `canViewRiteCalendarResource` 402, `canViewAnyResourceOfType` 411)
- Modify: `admin-dashboard.php` (147, 159), `includes/admin-blocks.php` (29, 55), `admin-decrees.php` (25-31, config ~620),
  `assets/js/admin-decrees.js` (`detectCapabilities` ~107)
- Modify: `permission-requests.php` (config), `assets/js/permission-requests.js` (`roleObjectTypes` 167, relation options
  ~634, `populateRowsFromStoredPermissions` ~930)
- Modify: `admin-permissions.php` (options at 106 and 304)
- Modify: `CLAUDE.md` (one paragraph under "Important Patterns")
- Test: `tests/AuthHelperDashboardScopesTest.php`, a new `assets/js/__tests__/storedPermissionRows.test.js` if the
  restore filter is extracted

**Interfaces:**

- Produces:
    - **`AuthHelper::ROLE_READABLE_TYPES`**, a public const mirroring `ROLE_OBJECT_TYPES`, with a comment pointing to
      it.
    - **`AuthHelper::canViewType(string $objectType): bool`** is true for a global `admin`, or when any held role lists
      the type.
    - **The three `canView*` methods** keep their signatures and answer from `canViewType`. The object id no longer
      matters for reading.
    - **`AuthHelper::readableTypes(): list<string>`** is for pages that pass the rule to JS.
    - **`admin-decrees.js`** reads `config.canView` from `AdminDecreesConfig` instead of calling
      `/admin/permissions/check` with `viewer`. `canEdit` and `canAdmin` keep their `editor` and `admin` checks.
    - **`permission-requests.js`** reads `config.roleObjectTypes` from `AccessRequestsConfig`, built from
      `AuthHelper::ROLE_READABLE_TYPES` with the display order kept.

- [ ] **Step 1: Write the failing tests.**
    - `AuthHelperDashboardScopesTest` covers `canViewType`, and `canViewResource` returns the same answer for any
      object id:
        - `calendar_editor` reads `rite_calendar` and not `national_calendar_test`;
        - `test_editor` the reverse;
        - `developer` reads both;
        - no role reads nothing;
        - a global admin reads everything;
        - an unknown type reads nothing for everyone except a global admin.
    - Rewrite the `general_roman_calendar` cases for `rite_calendar`.
    - Add a pure function `dropViewerRows(permissions): {kept, dropped}` (in `skippedPermissions.js`, or a new small
      module) with Vitest tests. A viewer-only list gives `kept: []` and `dropped: 1`; a mixed list keeps the editor
      entry.
- [ ] **Step 2: Implement** the `AuthHelper` rule, then rewire the read checks:
    - `admin-dashboard.php:147` becomes `canViewRiteCalendarResource('roman', 'decrees')` for non-admins, with no role
      name;
    - `:159`'s tests card uses `canViewAnyResourceOfType` alone;
    - `admin-blocks.php` 29 and 55 drop the `hasRole('calendar_editor')` half;
    - `admin-decrees.php` admits `canViewType('rite_calendar')` instead of `admin || calendar_editor`, and passes
      `canView` in its config.
- [ ] **Step 3: Implement the forms.**
    - Relation options become `editor` and `admin`, in both `permission-requests.js` and `admin-permissions.php`.
    - `roleObjectTypes` comes from config.
    - On resubmit, `dropViewerRows` runs before the rows are built. When it dropped any, an info alert shows the new
      i18n key `viewerDropped`: "Viewer access is no longer requested: your role gives read access. The viewer rows were
      removed." When nothing is kept, one empty row is added.
    - Keep `viewer` in the display maps.
- [ ] **Step 4: Add the CLAUDE.md paragraph.** Reading comes from the role (`AuthHelper::canViewType`). `viewer` is
      neither offered nor accepted for people, and stays in the model for applications (#1050).
- [ ] **Step 5: Run** `composer test`, `composer analyse`, `composer lint`, `yarn lint`, `yarn test:unit` and
      `composer lint:md`. Expected: green.
- [ ] **Step 6: Commit** `feat: read access comes from the role; viewer is no longer offered (#1049)`.

### Task 6: E2E rewrite and frontend PR

**Files:**

- Modify:
    - `e2e/rbac/01-cei-admin-register-request.spec.ts`
    - `03-usccb-admin-request.spec.ts`
    - `04-usccb-editor-register-request.spec.ts`
    - `05-rome-admin-request.spec.ts`
    - `07-dashboard-card-scoping.spec.ts`
    - `08-negative-auth.spec.ts`
    - `09-revoke-after-grant.spec.ts`
    - `14-admin-decrees-capability-matrix.spec.ts`
    - `15-dashboard-tests-card-matrix.spec.ts`
    - `19-redundant-access-request.spec.ts`
    - `support/requestAccess.ts`

- [ ] **Step 1: Rewrite each spec.**
    - **01, 03, 04, 05:** any `viewer` choice becomes `editor`, or the spec asserts that the option is absent.
    - **07, 14, 15:** replace `viewer` grants with the role alone. Each read-only card must be visible to a role holder
      who has no tuple on that resource, and still hidden for someone with no role.
    - **08, 09:** keep their intent and swap `viewer` for `editor` where they only needed some tuple.
    - **19:** the first case grants `editor` on IT and requests `editor` on IT, which still gives a 409 with
      `allRedundant`. The second case asks for `editor` and `admin` on IT, so `editor` is listed as a `duplicate`.
- [ ] **Step 2: Run** `yarn typecheck`, then `yarn playwright test --list --project=rbac`. Expected: clean, and every
      rewritten test is listed.
- [ ] **Step 3: Run** the frontend gate and commit `test(e2e): rbac specs read through the role, not viewer (#1049)`.
- [ ] **Step 4: Push and open the PR** against `development`. The body names #1049 and LiturgicalCalendarAPI's PR, says
      the E2E needs the API PR merged first, and repeats the release order and the `developer`-dashboard ruling. Comment on
      #617 that Relation pruning now only has to hide `editor` when it is already held.
