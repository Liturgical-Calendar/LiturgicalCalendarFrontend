# Scoped Admin-Review for Resource-Admins — Design

**Date:** 2026-06-21
**Repos:** LiturgicalCalendarAPI (PHP API) + LiturgicalCalendarFrontend (PHP frontend)
**Related:** unblocks the Phase 2 RBAC E2E suite (`docs/superpowers/specs/2026-06-21-frontend-rbac-e2e-design.md`)

## Goal

Let a **resource-admin** — a user who holds an OpenFGA `admin` tuple on some resource (e.g. `cei-admin` →
`admin@national_calendar:IT`) but does **not** hold the global Zitadel `admin` role — review the
access-requests scoped to the resources they administer: view them, and approve / reject / revoke them,
through the existing admin UI, with a notification badge for their pending review queue.

## Context (why this is needed)

The API already supports resource-admins end-to-end:

- `GET /admin/access-requests` filters the list to what the caller administers via
  `AccessRequestAdminHandler::filterByAdminAccess()` (`src/Handlers/Admin/AccessRequestAdminHandler.php`
  ~lines 1003–1040): a global admin sees all; a resource-admin sees only requests whose every permission
  tuple targets a resource they hold `admin` on; a plain editor sees none.
- approve / reject / revoke enforce the same via `requireAdminForAllResources()` (~lines 957–991).

The **frontend** is the only thing locking resource-admins out:

- `admin-permissions.php` (the sole access-request review UI) redirects anyone without the global `admin`
  role (lines 20–26: `$isAdmin = $authHelper->hasRole('admin'); if (!$isAdmin) { header('Location:
  admin-dashboard.php'); exit; }`).
- `admin-dashboard.php` renders the admin section (incl. the "Role Requests" / "Permissions" cards that
  link to `admin-permissions.php`) only inside `if ($isAdmin)` — so resource-admins see no entry point.
- `notifications.js` fixes its mode at init to `Auth.hasRole('admin') ? 'admin' : 'user'`, so a
  resource-admin gets the personal-inbox bell, never the review-queue bell.
- Nothing exposes a user's resource-admin status to the frontend: `auth/me.php` returns roles only.

This feature closes that frontend gap. No new authorization model is introduced — the API's existing
FGA-scoped checks remain the enforcement boundary.

## Capability scope

Resource-admins get **access-request review only**: view + approve / reject / revoke the requests scoped
to resources they administer, plus a scoped pending-review notification badge. They do **not** get the raw
FGA permission-tuple management UI, global user management, or scoped data-editing entry points.

## Architecture

A small API addition exposes the caller's admin status/scopes; the existing admin notifications endpoint is
widened to resource-admins with a scoped count; the frontend uses that signal to admit resource-admins to
the existing review UI (hiding the global-only sections), add a dashboard entry, and switch the
notification bell to the scoped review queue.

```text
LiturgicalCalendarAPI
  GET /auth/admin-scopes            (NEW)  → { is_global_admin, is_resource_admin, admin_scopes[] }
  GET /admin/notifications          (WIDEN) → resource-admins allowed; scoped pending count + items

LiturgicalCalendarFrontend
  src/AuthHelper.php                 → isResourceAdmin(): bool, adminScopes(): array   (calls /auth/admin-scopes)
  assets/js/auth.js                  → Auth.isResourceAdmin(): Promise<bool>           (calls /auth/admin-scopes)
  admin-permissions.php              → gate admits global OR resource admin; FGA-tuple section global-only
  admin-dashboard.php                → "Access Requests to Review" card for resource-admins
  assets/js/notifications.js         → mode = (admin role || resource-admin) ? 'admin' : 'user'
```

## Components

### 1. API — `GET /auth/admin-scopes` (new)

OIDC-protected (same middleware group as the other `/auth/*` routes). Computes, for the authenticated
user (`oidc_user['sub']`):

- `is_global_admin`: the `admin` role is present in the token (reuse `OidcAuthMiddleware::isAdmin` /
  `hasRole($oidcUser, 'admin')`).
- `admin_scopes`: union of `OpenFgaClient::listObjects("user:{sub}", "admin", $type)` over the
  admin-capable object types `national_calendar`, `diocesan_calendar`, `wider_region`,
  `general_roman_calendar`, returned as `[{ object_type, object_id }]`.
- `is_resource_admin`: `admin_scopes` is non-empty.

Response shape:

```json
{
  "is_global_admin": false,
  "is_resource_admin": true,
  "admin_scopes": [
    { "object_type": "national_calendar", "object_id": "IT" }
  ]
}
```

New handler `src/Handlers/Auth/AdminScopesHandler.php`, registered in the Router's OIDC-protected `auth`
group alongside `access-requests` / `notifications`. If OpenFGA is unavailable, return
`is_resource_admin: false` with an empty `admin_scopes` (fail closed) and `is_global_admin` still derived
from the token.

### 2. API — widen `GET /admin/notifications`

Today `src/Handlers/Admin/NotificationsHandler.php` requires the global `admin` role and counts ALL pending
access-requests (`countPending()`, unscoped) plus applications. Change:

- **Admit resource-admins** (global admin OR resource-admin); others stay rejected.
- **Global admin:** behavior unchanged (unscoped `pending_access_requests`, `pending_applications`, items).
- **Resource-admin:** `pending_access_requests` = count of pending requests they administer (scoped via the
  same logic as `filterByAdminAccess`); `items` = those scoped requests (capped at 5, `url` =
  `admin-permissions.php`); `pending_applications` = 0 (applications stay a global-admin concern);
  `total` = the scoped access-request count.

The scoping logic is shared so the badge count and the review list agree. Extract the per-request
"does this admin administer every resource in the request" predicate (currently inside
`AccessRequestAdminHandler::filterByAdminAccess`) into a reusable helper (e.g. a method on
`AccessRequestRepository` or a small service) consumed by both handlers, rather than duplicating it.

### 3. Frontend — `src/AuthHelper.php`

Add two methods, memoized per request, that call `GET /auth/admin-scopes` server-side with the user's
session cookie:

- `isResourceAdmin(): bool`
- `adminScopes(): array` (list of `['object_type' => ..., 'object_id' => ...]`)

These sit beside the existing `hasRole()` / `hasPermission()` (`src/AuthHelper.php` ~lines 282–296). A
single fetch populates both; on error, fail closed (`false` / `[]`).

### 4. Frontend — `assets/js/auth.js`

Add `Auth.isResourceAdmin(): Promise<boolean>` that fetches `GET /auth/admin-scopes` once and caches the
result (mirroring the existing auth-state caching). Used by `notifications.js`.

### 5. Frontend — `admin-permissions.php` gate + section guard

- Gate: admit when `$authHelper->hasRole('admin') || $authHelper->isResourceAdmin()` (else redirect to
  `admin-dashboard.php` as today). Compute `$isGlobalAdmin = $authHelper->hasRole('admin')` for use below.
- The page has two sections. The **FGA permission-tuple management** section stays global-admin-only:
  wrap its markup in `if ($isGlobalAdmin)` and skip its JS initialization for resource-admins. The
  **access-requests review** section renders for both; its data (`GET /admin/access-requests`) and actions
  (approve / reject / revoke) are already scoped by the API for resource-admins, so no logic change beyond
  not assuming a global admin.

### 6. Frontend — `admin-dashboard.php` entry card

Add an "Access Requests to Review" card linking to `admin-permissions.php`, shown when
`$authHelper->isResourceAdmin() && !$authHelper->hasRole('admin')` (global admins already have the full
admin section with its "Role Requests" / "Permissions" cards, so the new card is for resource-admins only).
Resource-admins are `calendar_editor`, so they already pass the dashboard's `$hasCalendarRole` gate.

### 7. Frontend — `assets/js/notifications.js` mode

Change the init mode decision (currently `this._mode = Auth.hasRole('admin') ? 'admin' : 'user'`,
~line 55) to: `'admin'` when `Auth.hasRole('admin') || await Auth.isResourceAdmin()`, else `'user'`.
Resource-admins thus poll `/admin/notifications` (now scoped) and get the review-queue bell + badge. This
mirrors the existing trade-off for global admins (review queue instead of personal inbox; a resource-admin
still sees their own request outcomes on `permission-requests.php`). The `seen` POST remains user-mode only.

## Data flow

1. On any authenticated page, the frontend `AuthHelper` resolves `isResourceAdmin()` from
   `GET /auth/admin-scopes` (server-side).
2. `admin-dashboard.php` shows the review card to resource-admins; `admin-permissions.php` admits them and
   hides the global-only tuple section.
3. The review section calls `GET /admin/access-requests` → API returns the scoped list. Approve / reject /
   revoke call the existing endpoints → API enforces `requireAdminForAllResources`.
4. `notifications.js` resolves `Auth.isResourceAdmin()`, enters admin mode, and polls
   `/admin/notifications` → API returns the scoped pending count + items.

## Error handling

- `/auth/admin-scopes` and the widened `/admin/notifications` fail closed when OpenFGA is unavailable
  (treat as not-a-resource-admin; global-admin status still honored from the token).
- Frontend gates fail closed: if `isResourceAdmin()` cannot be resolved, the user is treated as a
  non-admin (redirected from `admin-permissions.php`, no card, user-mode bell).

## Security

Hiding the FGA-tuple UI from resource-admins is **not** the security boundary — the API
(`PermissionAdminHandler`, which already checks `isResourceAdmin` per tuple op) and the access-request
admin endpoints (`filterByAdminAccess` / `requireAdminForAllResources`) remain the enforcement points. The
frontend changes only widen *who the UI lets in* and *what it shows*; every privileged action is still
authorized server-side against OpenFGA. `/auth/admin-scopes` returns scopes for the authenticated caller
only.

## Testing

- **API (PHPUnit):** `/auth/admin-scopes` for a global admin (`is_global_admin: true`), a resource-admin
  (`is_resource_admin: true` + correct `admin_scopes`), and a plain editor (both false, empty scopes).
  Widened `/admin/notifications`: resource-admin gets a scoped count (only their requests, no
  applications); global admin unchanged; plain editor rejected.
- **Frontend:** this feature **unblocks Phase 2 E2E** — resource-admin scoping becomes UI-testable
  (cei-admin sees + approves cei-editor's IT request; usccb-admin does not see it; the review-queue badge
  reflects only scoped pending requests).

## Out of scope (YAGNI)

- Raw FGA permission-tuple management for resource-admins (stays global-admin-only).
- Global user management / applications review for resource-admins.
- Scoped data-editing entry points (calendar editing) gated by FGA scope on the dashboard.
- A combined notification mode showing both personal inbox and review queue (resource-admins get the
  review-queue bell, matching global-admin behavior).

## Enables

With resource-admins able to review through the UI, the Phase 2 RBAC E2E scenarios (resource-admin
request-visibility scoping, approve/reject/revise/revoke lifecycle across scopes) become testable through
the real UI as the design spec intended.
