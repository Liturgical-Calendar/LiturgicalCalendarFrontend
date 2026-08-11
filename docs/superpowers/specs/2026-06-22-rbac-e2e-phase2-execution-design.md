# RBAC E2E Phase 2 — Execution Design

**Date:** 2026-06-22
**Repo:** LiturgicalCalendarFrontend
**Branch:** `e2e/rbac-access-requests` (folds into PR #345)
**Supersedes/extends:** [`2026-06-21-frontend-rbac-e2e-design.md`](2026-06-21-frontend-rbac-e2e-design.md) (original 11-scenario design)
**Depends on:** scoped-admin-review feature — API merged to `development` (PR #656); frontend on PR #345
(see [`2026-06-21-scoped-admin-review-design.md`](2026-06-21-scoped-admin-review-design.md))

## Goal

Implement the full **11-scenario** Playwright suite from the original E2E design through the **real UI**,
proving the registration → access-request → review → approval → RBAC-scoping lifecycle and the
resource-admin scoping the scoped-admin-review feature now enables. The suite folds into PR #345.

## Why this is now buildable

The original design's scenarios assumed resource-admins could _review through the UI_. They could not — the
frontend locked them out — which is why Phase 2 paused to build the scoped-admin-review feature. That
feature is now merged (API on `development` via #656; frontend on #345), so every scenario that depends on a
resource-admin seeing/acting on a scoped request is unblocked. This document records the decisions that turn
the original design into an executable plan; the scenario _intent_ is unchanged from the original design.

## Decisions (this round)

- **Scope:** all 11 scenarios from the original design's "Scenario specs" section.
- **Request creation: real UI flow.** When a scenario says "X requests Y", X logs in and submits through
  `request-access.php`. The requested grant is the **approval outcome**, not a pre-seeded tuple. Requester
  users are therefore **not** pre-seeded with the grant they request.
- **Per-spec precondition seeding** (already the original design's principle): each spec seeds only the
  grants it needs as preconditions (e.g. scenario 02 seeds `cei-admin = admin@IT` so an IT admin exists to
  review), then drives the UI. Specs remain independent and order-free.
- **Target:** fold into PR #345 (same branch). Accepted tradeoff: #345 becomes a large PR.
- **Run mode:** serial, single worker (shared API/DB/FGA/Zitadel state), matching the existing config.

## Seeding model

Three user classes in the `users.ts` matrix (11 users — unchanged matrix; what changes is _what gets
seeded when_):

The 11 users split by **how they enter the system** (the two `REGISTRATION_USER_IDS` —
`cei-admin`, `usccb-editor` — are never seeded; everyone else is) and **whether their FGA grant is seeded
or earned via the UI**:

- **Global admin** — `super-admin`. Seeded: Zitadel account + `admin` role + login session. Grant: n/a
  (global role).
- **Seeded resource-admins** — `usccb-admin`, `rome-admin`, `grc-admin`, `europe-admin`. Seeded: account +
  `calendar_editor` role + login + their `admin` FGA tuple (stable, seeded at setup; lets them review).
- **Seeded requester-editors** — `cei-editor`, `rome-editor`, `grc-editor`, `europe-editor`. Seeded:
  account + `calendar_editor` role + login, **no FGA tuple**. Grant is earned via `request-access.php`
  in-spec (the approval outcome); a spec needing it as a _precondition_ (e.g. scenario 10) seeds it
  explicitly.
- **Registration users** — `cei-admin`, `usccb-editor`. **Not seeded at all**: they drive the real Zitadel
  self-registration UI + Mailpit verification in-spec (scenarios 01/04). When a _later_ spec needs
  `cei-admin` to already be an IT admin (e.g. scenario 02), it seeds `cei-admin = admin@IT` as a
  precondition.

`rbac.setup.ts` seeds accounts + roles + per-user `storageState` (so `actingAs(user)` works for every
seeded user); it stops pre-seeding editor FGA tuples; it seeds the four stable resource-admin tuples and
leaves the two registration users untouched.

## New / changed harness pieces

1. **`support/requestAccess.ts`** (new) — submit a pending request as a logged-in user by driving
   `request-access.php` (select resource/role, submit, assert it lands as pending). The precondition for
   every review scenario. Returns the created request's identifying info where the UI/DOM exposes it.
2. **`support/grant.ts`** (new, or extend `seed.ts`) — per-spec precondition seeding of an arbitrary
   `(user, relation, objectType, objectId)` FGA tuple + the project role, composing the existing
   `Fga.write()` and `ZitadelAdmin.grantProjectRole()` primitives. Idempotent.
3. **`support/mailpit.ts`** (new) — query the Mailpit REST API, find the latest verification email for an
   address, extract the verification link. Used by the 2 real-registration scenarios. **Highest-risk piece**
   (real registration UI + cross-org Zitadel fix + email round-trip).
4. **`cleanup.ts`** (extend) — beyond truncating `access_requests`/`audit_log`/`user_notification_state`
   and deleting seeded users + their _seeded_ tuples, it must remove FGA tuples + role grants **created
   during specs** (approval outcomes) and run `gitRestoreApiData()` to revert scenario 10's calendar edits.
   Approach: derive tuples-to-delete from the matrix + any per-spec grants, and reset API source data via the
   existing git-restore mechanism the original design references.

## Scenarios (11)

Intent per the original design's "Scenario specs"; adjustments noted for the now-built feature. Each spec is
independent and seeds its own preconditions.

1. **01 — `cei-admin` requests `admin`@IT (real registration).** Register via UI → Mailpit verify → first
   login → request `admin`@IT → assert **only `super-admin`** sees it (cei-admin is not yet an IT admin) →
   (a) super-admin rejects → (b) cei-admin revises + resubmits → (c) super-admin approves → assert the FGA
   tuple + role now exist.
2. **02 — `cei-editor` requests `edit`@IT** (precond: seed `cei-admin = admin@IT`). Assert **both**
   `super-admin` and `cei-admin` see it via the scoped review UI, `usccb-admin` does **not** → cei-admin
   rejects → super-admin sees the rejection → cei-editor revises → cei-admin grants → super-admin sees the
   grant. _(Exercises the scoped-admin-review feature head-on.)_
3. **03 — `usccb-admin` requests `admin`@USA** (real or seeded-precondition admin). Assert **`cei-admin`
   does NOT see it**, only `super-admin` → super-admin grants.
4. **04 — `usccb-editor` requests `edit`@USA (real registration).** Register via UI + Mailpit → request →
   `usccb-admin` + `super-admin` see it, `cei-admin` does not → usccb-admin grants → super-admin sees it.
5. **05 — `rome-admin` requests `admin`@romamo_it.** Only `super-admin` sees → grants.
6. **06 — `rome-editor` requests `edit`@romamo_it** (precond: seed `rome-admin = admin@romamo_it`).
   `super-admin` + `rome-admin` see it, `cei-admin`/`usccb-admin` do not → rome-admin grants → super-admin
   sees it.
7. **07 — dashboard card scoping.** Per-user matrix assertions on `.admin-block` cards: which render, scope
   narrowing (Sanctorale → `IT_`/`US_`/Latin; National → IT/USA; Diocesan → romamo_it; GRC; Europe), and the
   resource-admin **"Access Requests to Review"** card + that the global-only FGA-tuple section is hidden for
   resource-admins (the feature's dashboard/gate behavior). Extends the existing smoke spec.
8. **08 — negative authorization.** `cei-admin` attempts to approve a USA request, open a USA-scoped card,
   and edit the USA calendar → all denied (403 / hidden). Mirror of 03–06.
9. **09 — revoke-after-grant lifecycle.** An admin revokes a granted permission → FGA tuple/role removed,
   dashboard cards disappear, a `revoked` notification is delivered.
10. **10 — scoped data editing** (precond: seed `cei-editor = edit@IT`). cei-editor edits the IT national
    calendar via `extending.php` and succeeds; the same edit against USA fails. Reverted by
    `gitRestoreApiData()`.
11. **11 — session/token resilience.** Cookie/session expiry + refresh mid-flow; logout then login as a
    different user; a grant/revoke is reflected on the next `/auth/me` without stale caching.

## Determinism, cleanup, isolation

- Serial, single worker. `rbac.setup.ts` seeds accounts + logins; per-spec hooks seed preconditions and
  create requests via UI; `globalTeardown` + per-spec `afterEach` clean.
- Cleanup removes: truncated app tables, the run's FGA tuples (seeded **and** approval-created), Zitadel test
  users, and reverts API source data (`gitRestoreApiData()`).
- Namespacing: all seeded emails use the `<role>+e2e@litcal.test` pattern so cleanup never touches real data.

## Risks & sequencing

1. **Registration specs (01/04)** are the fragile, highest-effort part (real Zitadel registration UI +
   cross-org fix + Mailpit). Build `mailpit.ts` and one registration spec first to de-risk before the rest.
2. **Cleanup of approval-created grants** must be reliable or state leaks between specs — build/verify the
   cleanup extension early.
3. **Scenario 10** mutates API source data; depends on `gitRestoreApiData()` working against the running
   stack (API built from the local repo).
4. **Stack readiness:** the local docker stack must run the scoped-admin-review feature (API now on
   `development` via #656; frontend branch has it) — recreate `litcal-api`/`litcal-frontend` before running.
5. **PR size:** folding 11 specs + 3 new helpers + cleanup changes into #345 makes it large; reviewers should
   expect that.

## Build order (for the plan)

1. Seeding-model change (`rbac.setup.ts` stops seeding editor tuples) + `grant.ts` precondition helper +
   cleanup extension. **Foundation — everything depends on it.**
2. `requestAccess.ts` + scenario 02 (the headline scoped-review lifecycle) as the first real scenario.
3. `mailpit.ts` + scenario 01 (registration) to de-risk the fragile path early.
4. Remaining scoped-review scenarios (03–06), then dashboard cards (07), negative auth (08), revoke (09),
   scoped data editing (10), session resilience (11).

## Out of scope (this round)

- A CI workflow / required check (suite stays local-run; structured to be CI-ready).
- Performance/load testing; testing Zitadel itself.
- API-level assertions already covered by the API PHPUnit suite (exercised here only through the UI).
- Any new product behavior — this is test coverage of the already-built feature.
