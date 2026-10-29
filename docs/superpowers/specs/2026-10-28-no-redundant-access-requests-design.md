# No redundant access requests — design

Date: 2026-10-28. Repos: LiturgicalCalendarAPI (enforcement) and LiturgicalCalendarFrontend (messaging).
Frontend branch: `fix/no-redundant-access-requests` (from `development`); the API gets a branch of the same name
from its `development`. One PR per repo, both targeting `development`.

## Why

A user who was granted `admin` on `national_calendar` `roman/FR` could log in later and request exactly the same
access again, producing a new pending request. Nothing stops it: the request form never looks at what the user
already holds, and the API only refuses a second *pending* request for the same **role**
(`AccessRequestRepository::hasPendingRequest()`), not one for permissions already granted.

Unnecessary requests cost reviewers time and make the queue misleading. A request is only meaningful when it asks
for more than the user has. *(Originally "…or will have once their pending requests are approved"; superseded
2026-10-29: pending requests under other roles are not consulted.)*

## The rule

> **Note, 2026-10-29.** Decided after implementation by the user: a request under a different role always goes through,
> even when it repeats a permission pending under another role (e.g. `developer`). The `pending` reason was therefore removed; reasons are `duplicate` then `granted`.

Relations are ranked `viewer` < `editor` < `admin`. A requested permission (object_type, object_id, relation) is
**redundant**, and must not be submitted, when any of these holds:

1. **granted** — the user already holds that relation or a higher one on the object. In the OpenFGA model
   (`CatholicOS/cdcf-infra` `auth/models/LiturgicalCalendar.json`, checked 2026-10-28) every object type the request
   form offers, the three `*_test` types included, nests the tiers the same way: an admin automatically has editor and
   viewer access, an editor automatically has viewer access, and a viewer has neither. (The model expresses this by
   defining "viewer" as anyone given viewer, editor or admin, and "editor" as anyone given editor or admin.) So one
   global ranking is valid for every type, and asking OpenFGA whether the user has the requested tier is exactly
   `OpenFgaClient::check("user:{sub}", relation, "{object_type}:{object_id}") === true`.
2. ~~**pending**~~ — *superseded 2026-10-29, see the note above: other pending requests are no longer consulted.*
   Originally: another of the user's requests with `status = 'pending'` (any role) contains a permission on the same
   object_type + object_id with a relation of equal or higher rank.
3. **duplicate** — another permission in the same submission targets the same object with a higher relation, or
   is the identical triple appearing earlier. Within one submission, a given object keeps only its
   highest-ranked relation (first occurrence when tied).

### The requested role

A request asks for a Zitadel role (`calendar_editor`, `test_editor` or `developer`) as well as permissions, and a user
can hold permissions without the role: today a direct grant from the admin permissions page writes the tuple only, and
a revoke can cascade the role away while other tuples remain. So the redundancy rule never makes a request impossible
for a user who lacks the requested role:

- The API reads the user's roles from the token (`oidc_user.roles`), the same source `AuthorizationMiddleware` gates
  routes on, so "has the role" means exactly what the rest of the API treats as having it. The global `admin` role
  counts as holding every role, as it does in the middleware. *(Changed during planning from a
  `ZitadelService::getUserRoles()` lookup: the token is authoritative for access already and needs no external call.)*
- **User has the role:** the rule above applies as written.
- **User lacks the role:** the permissions are filtered the same way. If none is left, the request is still created,
  with the de-duplicated permissions as submitted (the API requires at least one, and writing a tuple that already
  exists on approval is harmless), so a reviewer can grant the role.
- **No `roles` claim in the token:** treat the role as missing. That errs toward creating the request, in line with
  the anti-goal below.

Only a request for a strictly higher tier than anything held on that object goes through (originally "held or
pending"; superseded 2026-10-29). For example,
holding `editor` and asking for `admin` is allowed; holding `editor` and asking for `viewer` is not.

## Goals

- The API enforces the rule on **create** (`POST /auth/access-requests`) and on **resubmit**
  (`POST /auth/access-requests/{id}/resubmit`). It is authoritative: the frontend cannot be relied on, and only the
  API can see the user's FGA tuples and pending requests.
- Partial success: the valid permissions are submitted and the redundant ones are dropped, with the user told
  which ones were dropped and why.
- If every permission is redundant, nothing is created and the user is told that each one is unnecessary.
- The frontend shows those outcomes clearly, per permission, in the user's language.

## Non-goals (this round)

- Pruning the relation dropdown per row as a calendar is picked. That is a **follow-up** (below), filed as an issue.
- Cleaning up redundant pending requests that already exist (for example the second `roman/FR` admin request). The
  reviewer rejects those by hand.
- Changing the existing "one pending request per role" rule. It stays as it is. The new rule covers what it
  misses: permissions already granted. *(Originally also overlap with pending requests under a different role;
  superseded 2026-10-29: requests under different roles never block each other.)*

## Anti-goals

- Blocking a legitimate upgrade (`viewer` → `editor`, `editor` → `admin`).
- Making access requests impossible while OpenFGA is unreachable. A redundant request is harmless (a reviewer still
  sees it). A blocked legitimate one is not.
- Submitting silently with permissions removed and no explanation.

## API design (LiturgicalCalendarAPI)

### Where

In `AccessRequestHandler`, after the existing per-permission validation and `validateRolePermissionConsistency()`
in both `createRequest()` and `resubmitRequest()`, run one shared filter over `$validatedPermissions`. Put the logic
in a small, unit-testable service (suggested: `Services/AccessRequestRedundancyFilter`), constructed with an
`OpenFgaClient` (via the existing `ResolvesFgaClient` concern) and the `AccessRequestRepository`.

Order of checks: **duplicate** first (collapse within the submission), then **granted**. The first reason that
applies is the one reported. *(Originally duplicate, then pending, then granted; the pending check was removed
2026-10-29.)*

### Pending lookup (superseded 2026-10-29)

*Removed with the `pending` reason: the filter no longer reads other pending requests, and
`getPendingPermissions()` was not kept. The original design follows.*

Add a repository method returning the permissions of the user's pending requests, for example
`getPendingPermissions(string $userId, ?string $excludeRequestId = null): array`. It decodes the `permissions` JSON
of every `status = 'pending'` row for `zitadel_user_id`. On resubmit, pass the request being resubmitted as
`$excludeRequestId`. It is `rejected`, so it would not match anyway, but excluding it states the intent.

### Granted lookup and failure

One FGA `check` per remaining permission, cached per (relation, object) within the call. If a check throws, or
OpenFGA is not configured, that permission is treated as **not granted** (fail open for this filter only) and the
failure is logged, like `ResourceAdminService::logFailure()` does. Respect the wall-clock budget pattern
`ResourceAdminService` uses (`withinBudget()`), so a hung OpenFGA cannot hold the request. Past the budget, the
remaining permissions fail open the same way.

Global admins (Zitadel `admin` role) are treated like everyone else: only FGA tuples count as "granted". A global
admin who requests access gets the same filtering by tuples. *(My call: the role gives them every capability anyway,
so they have no reason to request, and special-casing them adds a path to test for no benefit.)*

### Responses

Each skipped permission is reported as:

```json
{ "object_type": "national_calendar", "object_id": "roman/FR", "relation": "admin", "reason": "granted" }
```

`reason` is one of `granted` | `duplicate`. *(Originally also `pending`; removed 2026-10-29.)*

- **Some kept:** `201 Created`, the request is created with the kept permissions only, and the body gains
  `"skipped_permissions": [ … ]`. The field is present (possibly empty) on every 201.
- **None kept:** `409 Conflict`, nothing is created, and the body is
  `{ "success": false, "message": "…", "skipped_permissions": [ … ] }` with an English message such as
  "You already have, or have already requested, all of the requested permissions." This cannot be a
  `ValidationException`, which carries no data, so build the response directly.
- **Role only:** when the user lacks the role and every permission was redundant, `201 Created` with
  `"skipped_permissions": []` and `"role_only": true`. The frontend tells the user their permissions are already in
  place and the request asks for the role alone. `role_only` is `false` on every other 201.
- **Resubmit:** same rules. Partial → `200` (as today) plus `skipped_permissions`, and the stored permissions become
  the kept ones. None kept → `409`, and the request stays `rejected`, unchanged.

The existing "pending request for this role" check keeps its current place and wording, and runs before the new
filter.

Update the OpenAPI schema (`jsondata/schemas/openapi.json`) for both endpoints: the new 201/200 field and the 409
response. Add PHPUnit tests for the filter service (each reason, ranking, tie-breaking, FGA failure → fail open)
and handler-level tests for 201-partial, 409-all-skipped and resubmit.

## Frontend design (LiturgicalCalendarFrontend)

In `assets/js/permission-requests.js`:

- **201/200 with a non-empty `skipped_permissions`:** show the usual success alert, plus a warning alert listing
  each skipped permission. Use the badge/type/id rendering `summarizePermissions()` already produces, followed by a
  translated reason:
    - `granted` → "You already have this access (or higher)."
    - ~~`pending` → "This access (or higher) is already in one of your pending requests."~~ *Removed 2026-10-29
      with the `pending` reason; an unknown reason falls back to "Not needed."*
    - `duplicate` → "Already covered by another permission in this request."

  The form resets as it does today.
- **201 with `role_only: true`:** show the success alert plus an info alert saying the permissions are already in
  place and the request asks for the role alone.
- **409:** do not reset the form. Show a warning alert with the API message replaced by a translated equivalent and
  the same per-permission list, so the user can change the rows and try again.
- Keep the reason → text mapping and the list rendering in a small pure module (suggested
  `assets/js/skippedPermissions.js`) with a vitest test, matching how `accessRequestPrefill.js` and
  `writeDisposition.js` are split out.
- New strings go into `permission-requests.php`'s `AccessRequestsConfig.i18n` through `_()`, with numbered
  placeholders where a value is interpolated.
- An unknown `reason` value falls back to a generic "Not needed" text rather than failing.

An E2E check belongs in the `rbac` project: a seeded user who holds `editor` on a national calendar requests
`viewer` on it, sees the 409 message and no new pending row appears. Then `admin` plus an already-held permission
creates a request whose stored permissions are the `admin` one alone.

## A direct grant assigns the role (LiturgicalCalendarAPI, separate PR)

Decided by the user: granting a permission directly (`PermissionAdminHandler::grantPermission()`, behind the admin
permissions page) must also give the user the matching Zitadel role, so permissions without a role stop arising.

- The role is the one whose `AccessRequestRepository::ROLE_OBJECT_TYPES` lists the object type and that is not
  `developer`: calendar types → `calendar_editor`, `*_test` types → `test_editor`.
- Assign it only if the user holds no role whose `ROLE_OBJECT_TYPES` already covers the type (`developer` covers all
  of them).
- A role assignment that fails must not undo or fail the tuple write. Report it in the response (for example
  `role_assigned: false` and a warning), and log it.
- **Two Zitadel traps the builder must check, not assume.** First, `ZitadelService::grantRole()` catches errors and
  returns `false`, and the approval path (`AccessRequestAdminHandler::syncZitadelRole()`) ignores that return value
  and marks the role synced, so a failed assignment is currently reported as a success. Second, Zitadel keeps one
  user grant per project, so adding a role for a user who already has a grant may need to update that grant's
  `roleKeys` rather than POST a new one. Verify this against the local Zitadel. If it holds, fix it in
  `ZitadelService` so both the approval path and this new path benefit, and check `syncZitadelRole()`'s handling of
  the return value in the same PR.
- PHPUnit coverage: type → role mapping, user already covered (no call), Zitadel failure (tuple kept, failure
  reported).

## Follow-up (issue, not this PR)

*Superseded by LiturgicalCalendarFrontend#617 (2026-10-29): Relation is pruned by what the user holds only, and a role
that already has a pending request is disabled in the form, pointing to that request. The original text follows.*

Reorder each permission row to **Calendar scope → Calendar ID → Relation** (Relation is first today). Keep
Relation disabled until both scope and ID are chosen, then prune it to the relations still meaningful for that
object (above whatever is granted or pending). That needs an API preflight that returns, for a set of objects, the
highest relation held or pending, for example `POST /auth/access-requests/preflight` reusing the same filter
service. The rows are restored programmatically on resubmit and by `accessRequestPrefill.js`, which sets relation
values directly, so the restore order must follow the new field order.

## Builder's discretion

Names of the service, repository method and JS module; exact English wording of the messages; how the warning
alert is laid out; how far the PHPUnit coverage goes beyond the cases listed.
