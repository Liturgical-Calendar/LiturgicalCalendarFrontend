# Frontend RBAC / Access-Request E2E Test Suite — Design

**Date:** 2026-06-21
**Repo:** LiturgicalCalendarFrontend
**Branch:** `e2e/rbac-access-requests` (worktree, based on PR #339 `feat/general-roman-calendar-object-type`)

## Goal

A Playwright end-to-end suite that exercises the full **registration → access-request → approval →
RBAC-scoping** lifecycle through the real UI, proving that resource-admin scoping (who sees / can act on
which request, and which admin-dashboard cards each user sees) behaves correctly across national,
diocesan, wider-region, and General Roman calendar resources.

The suite also regression-guards the cross-org Zitadel registration fix (`ZITADEL_ORG_ID` org scope +
the org-domain-suffix login-name setting) that unblocked registering an email already present in another
organization.

## Context (current state)

- The frontend already uses **Playwright** (`e2e/`, `playwright.config.ts`) with a `setup` project
  (`auth.setup.ts`) that logs in **one** user via `POST /auth/login` with `TEST_USERNAME`/`TEST_PASSWORD`,
  saving `storageState` to `e2e/.auth/user.json`. It **bypasses Zitadel registration** entirely.
- The stack is the API's `docker-compose` (Postgres, Zitadel, OpenFGA, Mailpit, Adminer) plus the API and
  frontend PHP servers (started by Playwright's `webServer`).
- Resource-admin scoping of "who sees which access request" is implemented in the API by
  `AccessRequestAdminHandler::filterByAdminAccess` (FGA `check` fan-out) on `GET /admin/access-requests`,
  already covered by PHPUnit tests (issue #633). This suite exercises the same logic through the UI.
- **PR #339** adds the `general_roman_calendar` object type and touches `permission-requests.php/js` and
  `admin-permissions.php/js`. This suite is based on PR #339 so the GRC scenarios are testable now; it
  rebases onto `development` after PR #339 merges.

## Decisions (from brainstorming)

- **User provisioning:** hybrid — seed most users programmatically; drive the real Zitadel registration UI
  for a couple of representative users.
- **Run target:** local-first now, structured to be CI-ready later (no CI workflow built in this round).
- **Worktree base:** off PR #339's branch so GRC works immediately.
- **Extra coverage (all selected):** negative authorization, revoke-after-grant lifecycle, scoped data
  editing, session/token resilience.

## Architecture

```text
e2e/
  rbac/
    support/
      users.ts        the 11-user matrix — single source of truth (id, email, role, FGA tuple, scope)
      seed.ts         thin TS client → invokes the PHP seeder over HTTP/CLI; returns created identities
      actingAs.ts     fixture: open a BrowserContext from a given user's saved storageState
      mailpit.ts      query the Mailpit API; extract verification links for registration specs
      cleanup.ts      truncate app tables, delete seeded Zitadel users + FGA tuples
    rbac.setup.ts     global setup: seed users, log each in, save per-user storageState
    01-cei-admin-request.spec.ts ... 11-session-resilience.spec.ts
  .auth/<user>.json   per-user sessions (gitignored)
```

- A **new Playwright project `rbac`** with its own setup dependency (`rbac.setup.ts`), leaving the existing
  single-user specs and `auth.setup.ts` untouched.
- The **seeder lives in the API repo** as a small PHP script that reuses `ZitadelService`, `OpenFgaClient`,
  and the repositories — Zitadel/FGA logic stays in one place instead of being reimplemented in TypeScript.
  `seed.ts` invokes it and receives the created user identities (ids, emails).
- `actingAs(user)` returns a `BrowserContext` built from that user's `storageState`; a spec acting as
  several users opens several contexts.

## Seed matrix (`users.ts`)

All users live in the **LiturgicalCalendar Zitadel org**. Project role is `calendar_editor` unless noted.
"FGA tuple" is the scoped permission written to OpenFGA.

| User            | Zitadel role     | FGA tuple                                  | Scope            |
|-----------------|------------------|--------------------------------------------|------------------|
| `super-admin`   | `admin` (global) | —                                          | everything       |
| `cei-admin`     | calendar_editor  | `admin`  @ `national_calendar:IT`          | IT national      |
| `cei-editor`    | calendar_editor  | `editor` @ `national_calendar:IT`          | IT national      |
| `usccb-admin`   | calendar_editor  | `admin`  @ `national_calendar:USA`         | USA national     |
| `usccb-editor`  | calendar_editor  | `editor` @ `national_calendar:USA`         | USA national     |
| `rome-admin`    | calendar_editor  | `admin`  @ `diocesan_calendar:romamo_it`   | Rome diocese     |
| `rome-editor`   | calendar_editor  | `editor` @ `diocesan_calendar:romamo_it`   | Rome diocese     |
| `grc-admin`     | calendar_editor  | `admin`  @ `general_roman_calendar`        | GRC (PR 339)     |
| `grc-editor`    | calendar_editor  | `editor` @ `general_roman_calendar`        | GRC (PR 339)     |
| `europe-admin`  | calendar_editor  | `admin`  @ `wider_region:EU`               | Europe region    |
| `europe-editor` | calendar_editor  | `editor` @ `wider_region:EU`               | Europe region    |

Exact object_ids (`EU` vs `Europe`, the GRC key and whether GRC has sub-resources such as `temporale` /
`decrees` / Latin-edition missals) are pinned from the API source data and PR #339 during implementation.

## Seeding & registration mechanism

- **Seeded users (9 of 11):** the seeder creates the Zitadel user (email pre-verified, known password),
  writes the FGA tuple, and grants the role. `rbac.setup.ts` logs each in via `POST /auth/login` and saves
  `storageState`. Deterministic and fast.
- **Real-registration specs (2):** `cei-admin` and `usccb-editor` are NOT pre-seeded. Their specs drive the
  actual Zitadel self-registration UI, read the verification email from **Mailpit**, and complete first
  login — regression-guarding the cross-org registration fix. Requires the org-domain-suffix login-name
  setting (already enabled) and a reachable Mailpit.
- **Idempotency:** the seeder is upsert-style (delete-then-create by email) so re-runs start clean.

## Scenario specs

Each spec is **independent**: it seeds its own precondition grants rather than depending on a prior spec
having run, so order does not matter and any spec runs alone.

1. **01 — cei-admin requests `admin`@IT** (real registration): register → request → assert **only
   super-admin** sees it (cei-admin is not yet an IT admin) → (a) super-admin rejects → (b) cei-admin
   revises + resubmits → (c) super-admin approves → assert the FGA tuple and role now exist.
2. **02 — cei-editor requests `edit`@IT** (precondition: cei-admin is admin@IT): assert **both** super-admin
   and cei-admin see it, usccb-admin does not → (a) cei-admin rejects → (b) super-admin sees the rejection →
   (c) cei-editor revises → (d) cei-admin grants → (e) super-admin sees the grant.
3. **03 — usccb-admin requests `admin`@USA**: assert **cei-admin does NOT see it**, only super-admin →
   super-admin grants.
4. **04 — usccb-editor requests `edit`@USA**: usccb-admin + super-admin see it, cei-admin does not →
   usccb-admin grants → super-admin sees the grant.
5. **05 — rome-admin requests `admin`@romamo_it**: only super-admin sees → grants.
6. **06 — rome-editor requests `edit`@romamo_it**: super-admin + rome-admin see it, cei-admin/usccb-admin do
   not → rome-admin grants → super-admin sees the grant.
7. **07 — dashboard card scoping**: per-user matrix assertions on the `.admin-block` cards: which render,
   narrowing (Sanctorale → `IT_` / `US_` / Latin missals; National → IT / USA; Diocesan → romamo_it), and
   that **admins additionally see Users + Permissions cards scoped to their resource** while editors do not;
   super-admin sees all cards unrestricted. Includes the GRC (Temporale/Decrees/Latin missals) and Europe
   rows.
8. **08 — negative authorization**: cei-admin attempts to approve/grant a USA request, open a USA-scoped
   card, and edit the USA calendar → all denied (403 / hidden). The mirror of scenarios 3–6.
9. **09 — revoke-after-grant lifecycle**: an admin revokes a granted permission → the user's FGA tuple/role
   is removed, their dashboard cards disappear, and they receive a `revoked` notification.
10. **10 — scoped data editing**: cei-editor edits the IT national calendar via `extending.php` and it
    succeeds; the same edit against USA fails. Reuses the existing `gitRestoreApiData()` cleanup.
11. **11 — session/token resilience**: cookie/session expiry + refresh mid-flow; logout then login as a
    different user; a grant/revoke is reflected on the next `/auth/me` without stale caching.

## Determinism, cleanup, isolation

- **Serial, single worker** (matches the existing config — shared API/DB/FGA state).
- **`globalSetup` seeds; `globalTeardown` + per-spec `afterEach` clean:** truncate `access_requests`,
  notification-state, and `audit_log`; delete the run's FGA tuples and Zitadel test users; run
  `gitRestoreApiData()` for any calendar edits.
- **Namespacing:** all seeded emails use a dedicated test pattern (e.g. `<role>+e2e@<test-domain>`) so
  cleanup targets them precisely and never touches real users.
- **Independent specs** via per-spec precondition seeding (no inter-spec ordering dependency).

## Worktree, structure, CI-readiness

- **Worktree:** new branch `e2e/rbac-access-requests` based on PR #339's tip, in a sibling directory; the
  other agent's checkout is untouched. Rebase onto `development` after PR #339 merges and retarget the PR to
  `development`.
- **Env:** new `.env` keys for the seeder (Zitadel mgmt token + org id, FGA store/model ids, Mailpit URL) —
  all already present in the stack configuration.
- **CI-ready:** seeding is fully scripted and idempotent and the stack is the existing `docker-compose`, so a
  later CI job is "boot compose → seed → `playwright test --project=rbac`" with no rewrite. The CI workflow
  is not built in this round.

## Risks & dependencies

1. **GRC specs depend on PR #339** — green only on this branch until PR #339 merges.
2. **Admin notification surfacing:** confirm during implementation which endpoint the admin bell uses
   (`/admin/access-requests` scoped list vs a notifications route); the scoping logic itself is the
   #633-tested `filterByAdminAccess`.
3. **Real-registration specs** depend on the org-domain-suffix login-name setting (enabled) and a reachable
   Mailpit.
4. **Europe / GRC object_ids** need pinning from the API source data and PR #339.

## Out of scope (this round)

- Building a CI workflow / required check.
- Performance/load testing.
- Testing Zitadel itself (only our integration with it).
- API-level assertions already covered by the API PHPUnit suite (e.g. `filterByAdminAccess` unit coverage
  from #633) — those are exercised here only indirectly through the UI.
