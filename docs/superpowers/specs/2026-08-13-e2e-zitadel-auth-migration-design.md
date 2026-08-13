# E2E Auth Migration to Zitadel OIDC — Design

**Date:** 2026-08-13
**Repo:** LiturgicalCalendarFrontend
**Branch:** `ci/automate-chromium-ci` (folded into PR #452)
**Issue:** #448

## Goal

Migrate `e2e/auth.setup.ts` off the API's legacy HS256 `POST /auth/login` and onto the Zitadel OIDC
flow already proven by the `rbac` project, so the four calendar-data specs blocked at
`ExtendingPageHelper.waitForAuth()` pass again — and can then join the automated CI selector added by
PR #452.

Alongside it, close a latent bug in `auth/me.php` that the investigation surfaced.

## Context

`auth/me.php:52` validates `litcal_access_token` exclusively through `OidcClient::validateToken()`.
`e2e/auth.setup.ts` obtains its token from the API's `POST /auth/login`, which issues an HS256 token.
JWKS validation can never accept that shape, so `auth/me.php` returns `authenticated:false`,
`Auth.isAuthenticated()` (a pure cache read at `assets/js/auth.js:404`) stays `false`, and
`waitForAuth()` can only time out.

The same token is accepted **server-side**, because `AuthHelper` has a legacy HS256 fallback that
`auth/me.php` lacks. The two validation paths have drifted. Full diagnosis in issue #448.

## Decisions

### 1. The HS256 question: config-gated fallback only

Issue #448 left open whether HS256 `POST /auth/login` is meant to remain supported. The answer turns
on a distinction the issue did not draw — there are **two** different fallbacks behind "add HS256 to
`auth/me.php`", and the gates make it visible:

| Condition                             | `AuthHelper::getInstance()`     | `auth/me.php`                           |
| ------------------------------------- | ------------------------------- | --------------------------------------- |
| OIDC **not configured**               | falls through to HS256 (`:183`) | **bails** `authenticated:false` (`:44`) |
| OIDC configured, validation **fails** | falls through to HS256          | bails `Token validation failed`         |

Row one is a latent bug, independent of the tests. If Zitadel were dropped — `ZITADEL_ISSUER` /
`ZITADEL_CLIENT_ID` unset — `AuthHelper` would authenticate users and pages would render, while
`auth/me.php` told the client nobody is logged in. That is the #448 symptom reached through config
rather than token shape.

**Decision: implement (a), the config-gated fallback, and not (b), the validation-failure fallback.**

- **(a)** When `OidcClient::isConfigured()` is false, validate via `AuthHelper`'s legacy HS256 path.
  Mirrors `AuthHelper::getInstance():174-182`'s gate exactly. Delivers the drop-Zitadel escape hatch.
  Loosens nothing in a Zitadel deployment.
- **(b)** Falling back when OIDC _is_ configured but validation fails would mean any `JWT_SECRET`-signed
  token is accepted by a live Zitadel deployment. It is also the change that would have "fixed" the
  tests without migrating them — and since the tests migrate regardless, it buys nothing.

Response shape is unchanged (`authenticated`, `user`, `roles`), so `assets/js/auth.js` needs no change.

### 2. The E2E identity lives outside `USERS`

`deleteAllSeededUsers()` (`e2e/rbac/support/cleanup.ts:26`) iterates **every** key of `USERS`, and
`rbac.setup.ts` calls it. Reusing `super-admin`, or adding a new member to `USERS`, would let
`rbac-setup` delete the chromium project's identity mid-run — precisely when both projects are
selected, which is what the `automated` selector does.

So the chromium identity is an `E2E_ADMIN` record defined **outside** `USERS`. rbac cleanup then
structurally cannot reach it. `seedUser` / `loginAndSaveState` are split into record-taking cores plus
the existing key-taking wrappers, giving both projects one implementation (as #448 asked) with no
churn across the 16 rbac specs. `loginAndSaveState` gains an optional output path so the state can
land at `e2e/.auth/user.json`, leaving every spec unchanged.

### 3. No FGA tuples are needed

`E2E_ADMIN` carries Zitadel role `admin` and `fga: null`.
`OpenFgaAuthorizationMiddleware.php:140-141` in the API bypasses **all** OpenFGA checks for users
holding the `admin` role, so the specs that assert real `201`s on `PUT` / `PATCH` authorize with zero
tuples. This settles step 2 of #448's sketch, which flagged it as unconfirmed.

### 4. CI: a second project, not an expanded `chromium-ci`

The four unblocked specs cannot join `chromium-ci` without giving it `storageState` and
`dependencies: ['setup']`, which would destroy the property PR #452 argued for: that a Zitadel failure
cannot take it down alongside `rbac`. They also cannot use the existing `chromium` project, which
still drags in `admin-tests` and its 7 pre-existing failures (issue #453).

So a **`chromium-ci-auth`** project holds the four, with the storageState and setup dependency, and
joins the `automated` selector alongside `rbac` + `chromium-ci`. `chromium-ci` stays auth-free; the
failure domains stay separate.

## Work

1. `auth/me.php` — config-gated HS256 fallback via `AuthHelper`.
2. `e2e/rbac/support/seed.ts` — record-taking cores + optional output path.
3. `e2e/auth.setup.ts` — rewritten onto the headless OIDC flow with `E2E_ADMIN`.
4. `playwright.config.ts` — add `chromium-ci-auth`.
5. `.github/workflows/e2e.yml` — add it to `automated`; refresh the header, which still cites
   `TEST_USERNAME` / `TEST_PASSWORD` and issue #353.
6. Remove dead `TEST_USERNAME` / `TEST_PASSWORD` from `.env.example` and `CLAUDE.md`.

## Found during implementation

Fixing the auth migration made `missals-editor` reachable for the first time, and it immediately
failed 10 of 14. Neither cause was auth; both were pre-existing bugs that #448 had been hiding,
in the same way #453's failures hid behind `admin-tests`. Both are fixed here, because
`missals-editor` cannot join CI otherwise.

- **`assets/js/missals-editor.js`** sent `credentials: 'include'` on the data-source read. Both
  `MissalsUrl` and `DecreesUrl` answer with `Access-Control-Allow-Origin: *`, which browsers
  refuse to pair with credentialed requests — exactly the rule the frontend `CLAUDE.md` states.
  The fetch never resolved, so selecting "Decrees" left the action buttons hidden and the editor
  silently did nothing. Anywhere the frontend and API are cross-origin, that data source was
  broken. One word; it fixed 9 of the 10 failures.
- **`missals-editor.spec.ts:15`** asserted an unauthenticated visitor sees `#loginRequiredMessage`.
  `missals-editor.php` redirects such a request to `index.php` before rendering anything, so that
  markup could never be served — dead code, asserted by a test. The assertion now checks the
  redirect and the markup is removed.

## Acceptance

- `yarn test:chromium` authenticates through Zitadel with no call to the API's HS256 `/auth/login`.
- The four migrated specs pass, including the `201`-asserting write tests.
- `rbac` and `chromium-ci` remain green, and `rbac-setup` cannot delete the chromium identity.
- Automated coverage rises from 54 to 106 tests.

## Verified

Against the local docker stack, after repairing two unrelated local-environment faults (Zitadel had
no host port binding because NVIDIA Broadcast held `127.0.0.1:8080`; `.env`/`.env.development`
pointed at an OpenFGA store that no longer existed).

- `--project=setup` passes, including its new in-browser `Auth.isAuthenticated()` assertion.
- `--project=chromium-ci-auth` — 52 tests, all passing (3 skipped by design).
- `--project=chromium-ci` — 22 passing, unchanged.
- `--project=rbac` — 32 passing, so the `seed.ts` refactor is behaviour-preserving.
- `auth/me.php` exercised directly in both configurations: with OIDC unconfigured a valid HS256
  token authenticates and a malformed one does not; with OIDC configured the **same** token is
  rejected, confirming the fallback did not widen the live-deployment surface.
