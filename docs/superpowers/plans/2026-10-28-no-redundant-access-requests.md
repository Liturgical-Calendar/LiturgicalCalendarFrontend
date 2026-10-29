# No Redundant Access Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop access requests for permissions a user already holds or has already requested, tell them why, and make
a direct permission grant assign the matching role.

**Architecture:** The API enforces the rule in a small service (`AccessRequestRedundancyFilter`) that
`AccessRequestHandler` runs on create and resubmit. It answers with `skipped_permissions` / `role_only` on 201 or 200,
and with 409 when nothing is left. The frontend renders those outcomes from a pure module. A second API PR makes
`PermissionAdminHandler::grantPermission()` assign the Zitadel role through a new `ZitadelService::ensureRole()`, which
also fixes the approval path's ignored return value.

**Tech Stack:** PHP 8.4, PHPUnit, OpenFGA, Zitadel (API). Vanilla ES modules, Vitest, Playwright, gettext (frontend).

**Spec:** `docs/superpowers/specs/2026-10-28-no-redundant-access-requests-design.md` (frontend repo).

## Global Constraints

> **Note, 2026-10-29.** Decided after implementation by the user: a request under a different role always goes through,
> even when it repeats a permission pending under another role (e.g. `developer`). The `pending` reason was therefore removed; reasons are `duplicate` then `granted`.

- Three PRs, all targeting `development`, in this merge order:
  1. **API PR A:** branch `fix/no-redundant-access-requests` (already created from `origin/development`).
  2. **API PR B:** branch `feat/direct-grant-assigns-role`, from `origin/development`.
  3. **Frontend PR:** branch `fix/no-redundant-access-requests` (current). Frontend CI builds the API from
     `development`, so its E2E spec only passes once API PR A is merged.
- Repos: API = `/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI`; frontend =
  `/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend`.
- Relation rank: `viewer` = 1, `editor` = 2, `admin` = 3, the same for every object type.
- Skip reasons, exactly: `granted` | `pending` | `duplicate`. Check order: duplicate, then pending, then granted. The
  first that applies is reported.
- Response fields, exactly: `skipped_permissions` (array of `{object_type, object_id, relation, reason}`, present on
  every 201/200 from create/resubmit), `role_only` (bool, present on every create 201 and resubmit 200).
- 409 body: `{ "success": false, "message": "You already have, or have already requested, all of the requested
  permissions.", "skipped_permissions": [ … ] }`.
- Fail open: OpenFGA unconfigured, erroring, or past its time budget means "not granted". No `roles` claim means
  "role missing".
- Never use `--no-verify`. API: `composer analyse` (PHPStan level 10), `composer lint`, `composer test`. Frontend:
  `composer lint`, `composer analyse`, `composer lint:md`, `yarn lint`, `yarn typecheck`, `yarn test:unit`.
- Frontend gettext strings use numbered placeholders (`%1$s`). Commits end with the session's Co-Authored-By and
  Claude-Session lines. Do not push until the user asks.

## Review Focus

1. **A pending request stored before #1018 holds a legacy wider-region id** (`roman/Europe`). The comparison must
   still match `roman/europe`. Pending entries go through `AccessRequestRepository::canonicalObjectId()`. Test in
   Task 2.
2. **A pending row's `permissions` JSON holds a malformed entry** (missing keys, unknown relation). It is ignored, not
   fatal. Test in Task 1.
3. **50 permissions with OpenFGA hanging.** The time budget stops checking, and the rest fail open in well under the
   5 s frontend timeout. Test in Task 2.
4. **The global `admin` role in the token** counts as holding the requested role, so an all-redundant request is a
   409, not `role_only`. Test in Task 3.
5. **A resubmit that drops permissions** stores only the kept ones. Reading the request back shows the reduced list.
   Test in Task 3.

---

## API PR A — `fix/no-redundant-access-requests`

### Task 1: Pending permissions of a user

**Files:**

- Modify: `src/Repositories/AccessRequestRepository.php` (add after `hasPendingRequest()`, ~line 600)
- Test: `phpunit_tests/Repositories/AccessRequestRepositoryTest.php`

**Interfaces:**

- Produces: `AccessRequestRepository::getPendingPermissions(string $userId, ?string $excludeRequestId = null): array`
  returning `list<array{object_type: string, object_id: string, relation: string}>`. Only `status = 'pending'` rows
  of that `zitadel_user_id`, all roles. Entries lacking any of the three string keys, or with a relation outside
  `viewer|editor|admin`, are dropped.

- [ ] **Step 1: Write the failing tests** in `AccessRequestRepositoryTest`:
    - `testGetPendingPermissionsReturnsOnlyPendingRowsOfTheUser`: create for `user-a` one pending `calendar_editor`
      request (`editor` on `national_calendar` `roman/IT`) and one `developer` request (`admin` on `roman/FR`), reject
      the second via `reject()`; create one for `user-b`. Assert the result for `user-a` equals
      `[['object_type' => 'national_calendar', 'object_id' => 'roman/IT', 'relation' => 'editor']]`.
    - `testGetPendingPermissionsExcludesTheGivenRequest`: two pending rows of different roles; excluding the first's id
      returns only the second's permissions.
    - `testGetPendingPermissionsSkipsMalformedEntries`: insert a pending row by direct SQL whose `permissions` is
      `[{"object_type":"national_calendar"},{"object_type":"national_calendar","object_id":"roman/IT","relation":"owner"},
      {"object_type":"national_calendar","object_id":"roman/IT","relation":"viewer"}]`. Only the last entry comes back.
- [ ] **Step 2: Run** `vendor/bin/phpunit phpunit_tests/Repositories/AccessRequestRepositoryTest.php --filter
  GetPendingPermissions`. Expected: FAIL, undefined method.
- [ ] **Step 3: Implement** `getPendingPermissions()`: one prepared SELECT of `permissions` (adding
  `AND id <> :exclude` when given), `json_decode` each row, keep well-formed entries.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `composer analyse`. Expected: no errors.
- [ ] **Step 5: Commit** `feat(access-requests): read a user's pending permissions`.

### Task 2: The redundancy filter

**Files:**

- Create: `src/Services/AccessRequestRedundancyFilter.php`
- Test: `phpunit_tests/Services/AccessRequestRedundancyFilterTest.php`

**Interfaces:**

- Consumes: `OpenFgaClient::check(string $user, string $relation, string $object): bool` (throws `RuntimeException`
  on failure); `AccessRequestRepository::canonicalObjectId()`.
- Produces:
    - `final class AccessRequestRedundancyFilter`, constructed with
      `(?OpenFgaClient $fgaClient, ?LoggerInterface $logger = null, ?float $budgetSeconds = null)`. Budget default:
      `ResourceAdminService::FANOUT_BUDGET_SECONDS`. A null client means OpenFGA is not configured: nothing is granted.
    - `public const RELATION_RANK = ['viewer' => 1, 'editor' => 2, 'admin' => 3];`
    - `public function filter(string $sub, array $permissions, array $pendingPermissions): array` returning
      `array{kept: list<Permission>, skipped: list<Permission&array{reason: string}>}`, where `Permission` is
      `array{object_type: string, object_id: string, relation: string}`. `kept` keeps the input order.

**Algorithm** (the tests below pin it):

1. **duplicate:** group the input by `object_type` + `object_id`. Keep the highest-ranked relation per object, at the
   position of its first occurrence among the highest; every other entry is skipped as `duplicate`.
2. **pending:** canonicalize each pending entry. A survivor is skipped as `pending` if a pending entry on the same
   object has rank ≥ its own.
3. **granted:** for each survivor, `check("user:{$sub}", relation, "{type}:{id}")`. True → skipped as `granted`. A
   throw, or the budget already spent, → kept and logged once (the `ResourceAdminService::logFailure()` /
   `withinBudget()` pattern, reimplemented locally: they are private).

- [ ] **Step 1: Write the failing tests.** Build the client from a Guzzle `MockHandler` exactly as
  `ResourceAdminServiceTest::serviceWith()` does (an OpenFGA check response is `{"allowed": true|false}`).
    - `testDuplicateKeepsHighestRelationPerObject`: input `[editor IT, admin IT, viewer FR]`, FGA all false → kept
      `[admin IT, viewer FR]`, skipped `[editor IT duplicate]`.
    - `testIdenticalTriplesKeepTheFirst`: `[editor IT, editor IT]` → one kept, one `duplicate`.
    - `testPendingEqualOrHigherSkips`: pending `[admin IT]`, input `[editor IT]` → skipped `pending`; no FGA call is
      made (the MockHandler queue is empty and must stay unused).
    - `testPendingLowerDoesNotSkip`: pending `[viewer IT]`, input `[admin IT]`, FGA false → kept.
    - `testPendingLegacyWiderRegionIdIsCanonicalized`: pending `[editor wider_region roman/Europe]`, input
      `[editor wider_region roman/europe]` → skipped `pending`. *(Review Focus 1.)*
    - `testGrantedSkips`: FGA true → skipped `granted`.
    - `testFgaErrorFailsOpen`: FGA 500 → kept, one log record.
    - `testNullClientGrantsNothing`: `new AccessRequestRedundancyFilter(null)`, input `[admin IT]` → kept.
    - `testBudgetExhaustedFailsOpen`: `$budgetSeconds = 0.0`, three distinct objects, empty MockHandler queue → all
      kept, no request sent. *(Review Focus 3.)*
- [ ] **Step 2: Run** `vendor/bin/phpunit phpunit_tests/Services/AccessRequestRedundancyFilterTest.php`. Expected:
  FAIL, class not found.
- [ ] **Step 3: Implement** the class per the interface and algorithm.
- [ ] **Step 4: Run** the test file, then `composer analyse`. Expected: PASS, no errors.
- [ ] **Step 5: Commit** `feat(access-requests): filter redundant requested permissions`.

### Task 3: Wire the filter into create and resubmit

**Files:**

- Modify: `src/Handlers/Auth/AccessRequestHandler.php` (constructor ~line 45; `createRequest()` after the
  `hasPendingRequest()` check, ~line 263; `resubmitRequest()` after `validateRolePermissionConsistency()`, ~line 410)
- Test: `phpunit_tests/Handlers/Auth/AccessRequestHandlerTest.php`

**Interfaces:**

- Consumes: Task 1's `getPendingPermissions()`, Task 2's `filter()`.
- Produces: `public function __construct(?OpenFgaClient $fgaClient = null)`. When null, the handler uses
  `OpenFgaClient::fromEnv()` if `OpenFgaClient::isConfigured()`, else passes null to the filter. Response contract
  per Global Constraints.

**Behavior:**

- `$hasRole = in_array($requestedRole, $roles, true) || in_array('admin', $roles, true)`, where `$roles` is
  `$oidcUser['roles'] ?? []`. On resubmit, `$requestedRole` is the stored row's role.
- Filter result `kept` non-empty → store `kept`; `role_only = false`.
- `kept` empty and `!$hasRole` → store the input with only the `duplicate` skips removed; `skipped_permissions = []`,
  `role_only = true`.
- `kept` empty and `$hasRole` → 409 per Global Constraints, nothing stored. On resubmit the row stays `rejected`.
- Create success message unchanged. Resubmit keeps its 200 and existing fields.

- [ ] **Step 1: Write the failing tests.** Inject an `OpenFgaClient` built on a `MockHandler` (reuse the Task 2
  construction; extract it into a small trait under `phpunit_tests/Support/` if both test classes need it). Users get
  `roles` via a new optional `oidcUser()` parameter.
    - `testCreateSkipsGrantedPermissionAndReportsIt`: roles `['calendar_editor']`, input `[viewer IT, admin FR]`, FGA
      `[true, false]` → 201, `skipped_permissions == [[…'roman/IT','viewer','reason' => 'granted']]`,
      `role_only === false`, the stored row's permissions are `[admin FR]` only.
    - `testCreateAllRedundantWithRoleIs409`: roles `['calendar_editor']`, FGA true → 409, `success === false`, one
      skipped entry, no new row for the user.
    - `testCreateAllRedundantWithoutRoleIsRoleOnly`: roles `[]`, FGA true → 201, `role_only === true`,
      `skipped_permissions === []`, permissions stored as submitted.
    - `testCreateGlobalAdminCountsAsHoldingTheRole`: roles `['admin']`, FGA true → 409. *(Review Focus 4.)*
    - `testCreateSkipsPermissionPendingUnderAnotherRole`: seed a pending `developer` request with `admin IT`; then
      `calendar_editor` with `[editor IT, editor FR]`, FGA false → 201, IT skipped as `pending`.
    - `testResubmitStoresOnlyKeptPermissions`: a rejected request with `[viewer IT, admin FR]`; FGA `[true, false]` →
      200, `getById()` shows `[admin FR]`, status `pending`. *(Review Focus 5.)*
    - `testResubmitAllRedundantWithRoleIs409AndStaysRejected`.
    - The existing happy-path tests must still pass unchanged (roles `[]`, no FGA → nothing granted).
- [ ] **Step 2: Run** `vendor/bin/phpunit phpunit_tests/Handlers/Auth/AccessRequestHandlerTest.php`. Expected: the
  new tests FAIL.
- [ ] **Step 3: Implement** per Behavior. Build the 409 with `encodeResponseBody($response, [...],
  StatusCode::CONFLICT)`, not an exception.
- [ ] **Step 4: Run** the test file, `phpunit_tests/Handlers/Auth/AccessRequestHandlerValidationTest.php`, and
  `composer analyse`. Expected: PASS, no errors.
- [ ] **Step 5: Commit** `feat(access-requests): refuse redundant permissions on create and resubmit`.

### Task 4: OpenAPI contract and PR

**Files:**

- Modify: `jsondata/schemas/openapi.json` (`/auth/access-requests` POST ~line 2763,
  `/auth/access-requests/{id}/resubmit` ~line 2989)

- [ ] **Step 1:** Add a `SkippedPermission` component schema (the four fields, `reason` enum
  `granted|pending|duplicate`). On both endpoints' success responses add required `skipped_permissions` (array of it)
  and `role_only` (boolean). Add a `409` response with `success`, `message`, `skipped_permissions`. Describe the rule
  in each operation's `description`.
- [ ] **Step 2: Run** `composer lint:openapi` and `vendor/bin/phpunit phpunit_tests/Schemas`. Expected: no errors,
  PASS. If a schema-conformance test validates handler responses against `openapi.json`, run it too.
- [ ] **Step 3: Run** the full gate: `composer lint && composer analyse && composer test`. Expected: all green.
- [ ] **Step 4: Commit** `docs(openapi): skipped_permissions, role_only and the 409 on access requests`. When the user
  asks, push and open the PR against `development`, linking frontend PR #616's follow-up and this design.

## API PR B — `feat/direct-grant-assigns-role`

### Task 5: `ZitadelService::ensureRole()` and the approval path

**Files:**

- Modify: `src/Services/ZitadelService.php` (add near `grantRole()`, ~line 295)
- Modify: `src/Handlers/Admin/AccessRequestAdminHandler.php` (`syncZitadelRole()`, ~line 507)
- Test: `phpunit_tests/Services/ZitadelServiceTest.php`, `phpunit_tests/Handlers/Admin/AccessRequestAdminHandlerTest.php`

**Interfaces:**

- Consumes: `getUserGrantsWithIds()`, `updateGrant(string $userId, string $grantId, array $roles): bool`,
  `grantRole()`.
- Produces: `public function ensureRole(string $userId, string $role): bool`. Already holds it → true, no write. Has a
  project grant → `updateGrant()` with the grant's roles plus `$role`. No grant → `grantRole()`. Returns the write's
  result.

- [ ] **Step 0: Verify the Zitadel premise** on the local stack (`docker compose up -d`; see frontend CLAUDE.md
  "Docker Stack Operations"): POST a second `/management/v1/users/{id}/grants` for a user who already has a project
  grant, and record the response. If Zitadel accepts it, `ensureRole()` still prefers `updateGrant()` (one grant per
  user keeps `getUserRoles()` simple). Note the observed behavior in the PR body.
- [ ] **Step 1: Write the failing tests** (Guzzle `MockHandler`, as `ZitadelServiceTest` does):
  `testEnsureRoleNoopWhenHeld` (one search response holding the role; no second request), `testEnsureRoleUpdatesExistingGrant`
  (assert the PUT body's `roleKeys` is the union), `testEnsureRoleCreatesGrantWhenNone`, `testEnsureRoleReturnsFalseOnWriteFailure`.
  In `AccessRequestAdminHandlerTest`, an approval whose role write fails records `zitadel_sync_status = 'failed'`.
- [ ] **Step 2: Run** both test files. Expected: FAIL.
- [ ] **Step 3: Implement** `ensureRole()`. Change `syncZitadelRole()` to call it and treat `false` like the caught
  exception: status `failed`, error `'Zitadel role assignment failed'`.
- [ ] **Step 4: Run** both files and `composer analyse`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(zitadel): ensureRole updates an existing grant; approval honours a failed assignment`.

### Task 6: A direct grant assigns the role

**Files:**

- Modify: `src/Handlers/Admin/PermissionAdminHandler.php` (constructor ~line 66; end of `grantPermission()`,
  ~line 472)
- Test: `phpunit_tests/Handlers/Admin/PermissionAdminHandlerTest.php`, `jsondata/schemas/openapi.json`
  (`/admin/permissions` POST)

**Interfaces:**

- Consumes: Task 5's `ensureRole()`; `AccessRequestRepository::ROLE_OBJECT_TYPES`.
- Produces: `public function __construct(?OpenFgaClient $client = null, ?ZitadelService $zitadel = null)`. Response
  gains `role_assigned` (`string|null`: the role name when assigned or already held, null when not applicable or
  Zitadel is not configured) and `role_error` (`string|null`).

**Rule:** the role is `calendar_editor` when the type is in `ROLE_OBJECT_TYPES['calendar_editor']`, and `test_editor`
when it is in `ROLE_OBJECT_TYPES['test_editor']`. Skip when the user's roles (`getUserRoles()`) already include a role
whose `ROLE_OBJECT_TYPES` covers the type (`developer` covers all). It runs after the tuple outbox write. A failure
never changes the 200 or the tuple: set `role_error` and log it.

- [ ] **Step 1: Write the failing tests:** national grant to a user with no roles → `ensureRole(…, 'calendar_editor')`
  called, `role_assigned === 'calendar_editor'`; a `*_test` grant → `test_editor`; a user holding `developer` → no
  call, `role_assigned === 'developer'`; `ensureRole()` false → 200, `role_error` set, tuple still reported. Mock
  `ZitadelService` with `createMock()` (the class is not final).
- [ ] **Step 2: Run** `vendor/bin/phpunit phpunit_tests/Handlers/Admin/PermissionAdminHandlerTest.php`. Expected:
  FAIL.
- [ ] **Step 3: Implement** per Rule and update the OpenAPI response schema.
- [ ] **Step 4: Run** `composer lint:openapi && composer lint && composer analyse && composer test`. Expected: green.
- [ ] **Step 5: Commit** `feat(permissions): a direct grant assigns the matching role`. Push and PR when the user
  asks.

## Frontend PR — `fix/no-redundant-access-requests`

### Task 7: Rendering skipped permissions

**Files:**

- Create: `assets/js/skippedPermissions.js`
- Test: `assets/js/__tests__/skippedPermissions.test.js`

**Interfaces:**

- Produces:
    - `export const SKIP_REASONS = ['granted', 'pending', 'duplicate'];`
    - `export function skipReasonText(reason: string, i18n: object): string`. Returns `i18n.skipGranted`,
      `i18n.skipPending` or `i18n.skipDuplicate`, else `i18n.skipUnknown`.
    - `export function readSubmitOutcome(status: number, body: object): {kind: 'created'|'role_only'|'all_redundant'|'error', skipped: Array}`.
      201/200 with `role_only === true` → `role_only`. 201/200 otherwise → `created`, with `skipped` from
      `skipped_permissions` (an array, else `[]`). 409 with an array `skipped_permissions` → `all_redundant`. Anything
      else → `error`.

- [ ] **Step 1: Write the failing tests:** each reason maps to its key; an unknown reason and `undefined` → `skipUnknown`;
  `readSubmitOutcome` for 201 with skips, 201 with `role_only`, 200 resubmit, 409, 409 without the array (→ `error`),
  and 500 (→ `error`).
- [ ] **Step 2: Run** `yarn vitest run assets/js/__tests__/skippedPermissions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Pure, no DOM.
- [ ] **Step 4: Run** it again plus `yarn lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: read the access-request submit outcome`.

### Task 8: Show the outcome on the request form

**Files:**

- Modify: `assets/js/permission-requests.js` (`submitAccessRequest()` ~line 1031, submit handler ~line 1071,
  `showAlert()` ~line 524)
- Modify: `permission-requests.php` (`AccessRequestsConfig.i18n`, ~line 211)
- Modify: `CLAUDE.md` (one short paragraph under "Important Patterns")

**Interfaces:**

- Consumes: Task 7.
- Produces: i18n keys `skipGranted` "You already have this access (or higher).", `skipPending` "This access (or higher)
  is already in one of your pending requests.", `skipDuplicate` "Already covered by another permission in this
  request.", `skipUnknown` "Not needed.", `skippedHeading` "These permissions were not requested:", `allRedundant` "You
  already have, or have already requested, all of these permissions. Nothing was submitted.", `roleOnly` "You already
  have these permissions; your request asks for the role only."

**Behavior:**

- `submitAccessRequest()` returns `{status, body}` for 2xx and 409, and still throws for other failures.
- `created`: success alert as today. If `skipped` is non-empty, add a warning alert below it with `skippedHeading` and
  one line per skip: the `summarizePermissions([skip])` markup plus the escaped `skipReasonText()`. Reset the form.
- `role_only`: success alert plus an info alert with `roleOnly`. Reset the form.
- `all_redundant`: one warning alert with `allRedundant` and the same list. Do **not** reset; keep resubmit mode if
  active.
- `showAlert()` replaces `formAlerts`. Add an `appendAlert(type, html)` that appends a pre-escaped HTML alert, used
  only for these lists.

- [ ] **Step 1:** Add the i18n keys to `permission-requests.php` through `_()`, `json_encode`d like their neighbours.
- [ ] **Step 2:** Implement the Behavior.
- [ ] **Step 3: Run** `node --check assets/js/permission-requests.js && yarn lint && composer lint && composer analyse`.
  Expected: clean.
- [ ] **Step 4:** Add to `CLAUDE.md`: the API drops permissions already granted, already pending (any role) or
  duplicated, and reports them in `skipped_permissions`. A user lacking the role still gets a `role_only` request, and
  an all-redundant request is a 409. Run `composer lint:md`.
- [ ] **Step 5: Commit** `feat: tell the user which requested permissions were not needed`.

### Task 9: E2E and PR

**Files:**

- Create: `e2e/rbac/19-redundant-access-request.spec.ts` (18 is taken by the navigator spec in PR #616)

**Interfaces:**

- Consumes: `seedAndLogin`/`actingAs`, `grantTuple(zitadelUserId, relation, objectType, objectId)`,
  `ZitadelAdmin.findUserIdByEmail()`, `truncateAppTables`/`settleCleanup`, `USERS['cei-editor']` (seeded with the
  `calendar_editor` role and no tuple).

- [ ] **Step 1: Write the spec.**
    - `test.describe.configure({ mode: 'serial' })`: the second test leaves a pending `calendar_editor` request, which
      would make the first fail on the API's one-pending-request-per-role rule.
    - `beforeAll`: `truncateAppTables()`, then grant `editor` on `national_calendar` `roman/IT` to cei-editor.
    - **Test "requesting viewer on a calendar you edit is refused":** as cei-editor, fill one row (`calendar_editor`,
      national IT, `viewer`) without `submitAccessRequest()`, which expects a new row. Click `#submitBtn`. Expect
      `#formAlerts .alert-warning` to contain the `allRedundant` text and "IT". Expect the request-row count unchanged.
    - **Test "the redundant row is dropped, the upgrade goes through":** two rows, `viewer` IT and `admin` IT. Expect a
      new pending row whose permissions cell shows the admin badge and IT only. Then a warning alert listing IT viewer
      with the duplicate text. (Both rows target IT, so viewer is a `duplicate` of admin.)
    - `afterAll`: `truncateAppTables()` and `settleCleanup()`.
- [ ] **Step 2: Run** `yarn typecheck`. Expected: clean. If the local stack runs the API from API PR A's branch, run
  `yarn playwright test --project=rbac e2e/rbac/19-redundant-access-request.spec.ts`. Expected: PASS. Otherwise it is
  verified by CI after API PR A merges, and the PR body says so.
- [ ] **Step 3: Run** the frontend gate: `composer parallel-lint && composer lint && composer analyse && composer
  lint:md && yarn typecheck && yarn lint && yarn test:unit`. Expected: green.
- [ ] **Step 4: Commit** `test(e2e): redundant access requests are refused (rbac)`.
- [ ] **Step 5:** File the follow-up issue (row order Calendar scope → Calendar ID → Relation, Relation disabled
  until both chosen, pruned via an API preflight) with `gh issue create`. Push and open the PR against `development`
  when the user asks, noting the dependency on API PR A.
