# Admin Dashboard Relation-Aware Card Gating — Design

**Date:** 2026-07-12
**Issue:** [Liturgical-Calendar/LiturgicalCalendarFrontend#399](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/issues/399)
**Repos touched:** LiturgicalCalendarAPI (new endpoint), LiturgicalCalendarFrontend (gating)

## Problem

Admin-dashboard cards are gated purely on Zitadel roles. A user holding the `test_editor` role but no
test-scope OpenFGA relation still sees the Tests card, and only discovers they cannot do anything after
entering the page. The Decrees card ships an interim per-card client-side `/admin/permissions/check`
script (one fetch per card, visible flash) that was explicitly marked for replacement by a batched check.

## Goal

Cards reflect what the user can actually do: Zitadel roles remain the coarse outer gate, OpenFGA
relations refine visibility. All relation checks for the dashboard happen server-side at render time,
in **one** API round-trip.

## Decisions (from brainstorming)

- Small API addition approved: new batched `GET /auth/dashboard-scopes` endpoint (Approach 1).
- Gating happens server-side during render; the interim client-side script is deleted.
- Fail closed: on any scopes-fetch error, relation-gated cards are hidden. Global admins are
  unaffected (their visibility derives from the token role only).
- Scope: Tests card, Decrees card/block, and Temporale block. The Sanctorale (missals-editor) block is
  **excluded** — the missals editor extends to any `calendar_editor`, so it stays role-gated only.
  Wider Region / National / Diocesan blocks are unchanged. Access Requests card keeps its rule but
  reads from the new batched payload. In-page capability logic (`admin-tests.js`, `admin-decrees.js`)
  is out of scope.

## Section 1 — API: `GET /auth/dashboard-scopes`

New `DashboardScopesHandler` in `src/Handlers/Auth/`, modeled on `AdminScopesHandler`:
GET-only, JSON, `allowCredentials`, `Cache-Control: no-store`, requires `oidc_user` (401 otherwise).

Response shape:

```json
{
    "is_global_admin": false,
    "is_resource_admin": false,
    "admin_scopes": [ { "object_type": "national_calendar", "object_id": "NL" } ],
    "viewer_scopes": {
        "general_roman_calendar": [ "temporale", "decrees" ],
        "national_calendar_test": [ "NL" ],
        "diocesan_calendar_test": [],
        "general_roman_calendar_test": []
    }
}
```

- `is_global_admin`, `is_resource_admin`, `admin_scopes`: same semantics as `/auth/admin-scopes`,
  computed via the existing `ResourceAdminService::resolveScopes()`.
- New `ResourceAdminService::resolveViewerScopes(string $sub): array<string, list<string>>` —
  one `listObjects(viewer)` call per type over a new constant
  `VIEWER_OBJECT_TYPES = ['general_roman_calendar', 'national_calendar_test', 'diocesan_calendar_test', 'general_roman_calendar_test']`.
  In the FGA model `viewer` is a union including `editor` and `admin`, so a single `viewer` query is
  exactly "viewer or above". Fails closed: any FGA transport error yields all-empty lists.
- `is_global_admin` is honored from the token even when OpenFGA is unavailable.
- Router: add `dashboard-scopes` to the `/auth` sub-route dispatch and to the OIDC-protected auth
  route list.
- Update `jsondata/schemas/openapi.json` (`composer lint:openapi` must pass).
- `/auth/admin-scopes` and `/auth/test-scopes` are untouched (other consumers exist:
  `admin-permissions.php`, `admin-tests.php`, `auth.js`, `notifications.js`, `admin-tests.js`).

## Section 2 — Frontend gating

### AuthHelper additions

Mirror the existing `loadAdminScopes()` pattern: server-side Guzzle call to
`{API_INTERNAL_URL|apiBaseUrl}/auth/dashboard-scopes`, forwarding the session cookies, memoized per
request, injectable client for tests, fail closed on any error.

- `dashboardScopes(): array` — full payload
  (`is_global_admin`, `is_resource_admin`, `admin_scopes`, `viewer_scopes`).
- `canViewResource(string $objectType, string $objectId): bool` — true if global admin OR
  `$objectId` is present in `viewer_scopes[$objectType]`.
- `canViewAnyResourceOfType(string ...$objectTypes): bool` — true if global admin OR any of the
  listed types has a non-empty viewer scope list.
- `public static fetchDashboardScopes(string $apiBaseUrl, ?string $cookieHeader, ?Client $client = null): array`
  — fetch + parse + fail-closed, mirroring `fetchAdminScopes()`.

The loader is lazy: it fires only when a gate consults it. All gates short-circuit on `$isAdmin`
(token role), so a global admin's dashboard render performs **zero** scopes calls; every other user
performs exactly **one**.

### Card gating matrix (non-admin rules; global admins always see their cards)

| Card / block                                        | Visibility rule for non-admins                                            |
|-----------------------------------------------------|---------------------------------------------------------------------------|
| Temporale block (admin-blocks grid)                 | `calendar_editor` role AND viewer+ on `general_roman_calendar:temporale`  |
| Decrees block (grid) and dedicated Decrees card     | `calendar_editor` role AND viewer+ on `general_roman_calendar:decrees`    |
| Tests card                                          | `test_editor` role AND viewer+ on any `*_test` object                     |
| Access Requests card                                | unchanged rule, read from `dashboardScopes()['is_resource_admin']`        |
| Sanctorale, Wider Region, National, Diocesan blocks | unchanged (role-gated as today)                                           |
| Users, Applications, Permissions cards              | unchanged (`isAdmin` only)                                                |

### Mechanics

- `includes/admin-blocks.php`: each block config gains a `visible` condition (computed with
  `$isAdmin` / `$authHelper` from the including page); blocks with `visible === false` are skipped.
  Untouched blocks default to visible.
- `admin-dashboard.php`: the non-admin section branches fold the relation check into the branch
  condition, so no empty "Administration" heading renders when the card is hidden.
- `includes/admin-decrees-card.php`: delete the interim inline `<script>` and the
  `data-fga-gate` / `data-user-sub` attributes; the card renders only when the server-side gate passed.
- No new user-visible strings (no i18n changes).

## Section 3 — Error handling, testing, rollout

### Error handling

- Fail closed: fetch error, timeout, non-200, or malformed body → empty scopes →
  relation-gated cards hidden. Role-only cards and global-admin visibility unaffected.
- Guzzle timeouts identical to `fetchAdminScopes()`: 5 s total, 2 s connect.

### Testing

- **API (PHPUnit):** new handler test mirroring `AdminScopesHandler` coverage — 401 when
  unauthenticated; `is_global_admin` from token; viewer/admin scope resolution with a mocked
  `OpenFgaClient`; fail-closed (empty scopes) when the FGA client throws.
- **Frontend (PHPUnit):** `fetchDashboardScopes()` parsing and fail-closed behavior;
  `canViewResource()` / `canViewAnyResourceOfType()` logic including the global-admin bypass.
- **Frontend (Playwright e2e):** dashboard card-visibility matrix by FGA grant, following the
  admin-decrees capability-matrix pattern: `test_editor` without any test scope sees no Tests card;
  with a viewer grant sees it; `calendar_editor` without decrees/temporale viewer sees neither the
  Decrees card nor the Temporale block; global admin sees everything.

### Rollout

Two PRs, both targeting `development` in their respective repos:

1. **API:** `DashboardScopesHandler` + `resolveViewerScopes()` + router + OpenAPI + tests.
2. **Frontend:** `AuthHelper` additions + card gating + interim-script deletion + tests. Lands after
   the API PR merges (the local docker stack builds the API from the sibling repo, so local e2e works
   before the API PR merges upstream).
