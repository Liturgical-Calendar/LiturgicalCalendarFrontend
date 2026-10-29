# Retire `viewer` for people — design

Date: 2026-10-29. Issue: LiturgicalCalendarAPI#1049. Repos: LiturgicalCalendarAPI and LiturgicalCalendarFrontend. One PR
per repo, both targeting `development`. Frontend branch: `feat/retire-viewer-for-people`. Follow-up: LiturgicalCalendarAPI#1050
(API keys through OpenFGA, with `can_read` / `can_write` capabilities).

## Why

A `viewer` tuple on a calendar resource means almost nothing for a person. Calendar data is public, and editing needs
`editor` or `admin`. Its only effect is a read-only view of some admin pages:

- the Temporale viewer and the Decrees card (`includes/admin-blocks.php`, `admin-dashboard.php`, `admin-decrees.js`);
- the test-definition cards (`AuthHelper::canViewAnyResourceOfType(...)` in `admin-dashboard.php`).

Granting a tuple per resource just to read data that is public anyway is friction. It also clutters the request form,
the grant page and the review queue with requests that change nothing anyone can do.

## The decision (from the user)

1. **Read access comes from the role, not from tuples.** A person can view a resource of type T read-only in the admin
   area if they hold a role whose scope includes T. The scope is `AccessRequestRepository::ROLE_OBJECT_TYPES`, the same
   table that already decides which role a request needs, which role a direct grant assigns, and which role a revoke
   cascades:
    - `calendar_editor` reads the calendar types: `national_calendar`, `diocesan_calendar`, `wider_region` and
      `rite_calendar` (temporale, sanctorale, decrees, supported locales).
    - `test_editor` reads the test types: `national_calendar_test`, `diocesan_calendar_test` and `rite_calendar_test`.
    - `developer` reads every type, since its scope already covers them all.
    - The global `admin` role reads everything, as today.
2. **A role is only earned through write access.** A person gets a role only by being given `editor` or `admin` on at
   least one resource, through an approved request or a direct grant (LiturgicalCalendarAPI#1048). Someone with no write
   access anywhere has no role and sees no admin data. Their view is the public site.
3. **`viewer` is no longer offered to, or accepted for, people.**
    - The request form's Relation dropdown offers only `editor` and `admin`.
    - The admin grant page offers only `editor` and `admin`.
    - The API refuses `viewer` in access requests (create and resubmit) and in direct grants. The grant endpoint only
      accepts `user:` subjects today, so it refuses `viewer` outright.
4. **Existing data.**
    - Every `viewer` tuple held by a person (`user:*`) is deleted.
    - `viewer` entries are removed from pending access requests. A pending request left with no permissions is rejected
      with a note saying read access now comes with the role, so they should request `editor` or `admin` on the
      calendars they want to work on.
    - Approved and rejected requests stay unchanged, as history.
    - A person who held a role only through `viewer` access loses that role once their `viewer` tuples are gone. This
      covers an approved viewer-only request, or a direct `viewer` grant made before #1048. Otherwise they would keep
      read access to the role's whole scope without ever having had write access anywhere, contradicting decision 2.
5. **`viewer` stays in the OpenFGA model**, for applications. Moving API-key authorization into OpenFGA, and adding
   computed `can_read` / `can_write` relations so code checks capabilities rather than relations, is LiturgicalCalendarAPI#1050.
   Neither is part of this work.

## Goals

- A person holding a role sees every admin page for that role's types in read-only mode, with no per-resource grant.
- `viewer` cannot be requested or granted for a person, and none remain after the sweep.
- The capability checks in code read as "can view" (any role covering the type) and "can edit" (`editor` or `admin` on
  that resource), not as relation names.

## Non-goals

- Renaming the OpenFGA relations. `viewer`, `editor` and `admin` stay. Labels shown to people may say "Read" / "Write"
  later, but this work changes no labels.
- Gating any public API read.
- API keys and applications (LiturgicalCalendarAPI#1050).

## Anti-goals

- A person who could see a read-only admin page before the deploy and still holds the role losing that view.
- A person losing write access. Only `viewer` tuples are touched.
- A sweep that deletes tuples or rewrites requests without a dry-run listing first.

## API design (LiturgicalCalendarAPI)

### Refusing `viewer` from people

- `AccessRequestHandler::VALID_RELATIONS` becomes `['admin', 'editor']`. A `viewer` permission in a create or resubmit
  body is a validation error (400), with a message saying read access comes with the role. The redundancy filter
  (#1047) keeps ranking `viewer` below `editor`, because the model still has it, but it never sees one from a request.
- `PermissionAdminHandler` refuses `relation: viewer` on grant with the same kind of 400. Revoking an existing
  `viewer` tuple stays allowed, so an admin can clean up by hand.
- OpenAPI: the relation enums for the access-request bodies and the grant body lose `viewer`. Descriptions say why.

### Read access by role

The only API read path that consults `viewer` today is `/auth/dashboard-scopes`
(`ResourceAdminService::resolveViewerScopes()`), which lists, per type, the objects where the caller is viewer or
higher. It stays as it is: it still correctly reports objects where the caller is `editor` or `admin`, and the frontend
stops depending on it for read access (below). No API endpoint gates a read on `viewer`.

### The sweep

A script under `bin/` (or wherever the existing reconcilers are invoked), modelled on `ResourceTuplePurgeReconciler` and
`CascadeReconciler`:

- **Dry run by default.** Without `--apply` it lists every `viewer` tuple on a `user:` subject, and every pending request
  that contains `viewer`, with what it would do to each.
- **With `--apply`:**
    - deletes each `user:*` `viewer` tuple through the outbox (`DELETE_TUPLE`), so a failed delete is retried rather than
      lost;
    - rewrites each pending request's `permissions` without the `viewer` entries;
    - rejects a pending request left empty, with the review note from decision 4 and a system reviewer id such as
      `system:viewer-retirement`, the way `cascadeRevokeByRole()` records `system:cascade`;
    - then, for each person whose `viewer` tuples it deleted, calls `RoleCascadeService::maybeCascadeRoleRevoke()` for
      each role they hold. Since LiturgicalCalendarAPI#1048 the cascade counts only `editor` and `admin` tuples for
      `calendar_editor` and `test_editor`. For `developer` it counts every tuple, and none are left once the viewers
      are deleted. So a role held only through `viewer` is revoked in Zitadel, and its approved requests are marked
      revoked, while a role backed by write access stays. The dry run lists these role revocations in their own
      section, so they can be reviewed before `--apply`;
    - writes one audit-log entry per change.
- **Idempotent.** A second run finds nothing to do.
- Listing `viewer` tuples: use OpenFGA `read` with a type filter and keep only `user:` subjects. Do not enumerate users.

A Doctrine migration is the wrong tool here: it cannot safely call OpenFGA, and the change must be reviewable before it
applies.

### Release order

1. API PR: refuse `viewer` from people, and add the sweep. Deploy.
2. Frontend PR: role-based read, and drop `viewer` from the forms. Deploy.
3. Run the sweep in production: dry run, review the listing, then `--apply`.

Until step 3 nobody loses anything they use. After step 2 read access no longer depends on `viewer` tuples, so deleting
them changes nothing anyone sees.

## Frontend design (LiturgicalCalendarFrontend)

### Read access by role

`AuthHelper` gets one rule: can the caller view type T? True when they hold the global `admin` role, or any role whose
scope includes T. The frontend needs the role → types table, so mirror `ROLE_OBJECT_TYPES` the way
`permission-requests.js` already mirrors it in `roleObjectTypes`, kept in one PHP place and passed to JS through config.

- `canViewResource($type, $id)`, `canViewRiteCalendarResource($rite, $sub)` and `canViewAnyResourceOfType(...$types)`
  all answer from that rule. The object id no longer matters for reading. Keep the method names, so the call sites in
  `admin-dashboard.php` and `includes/admin-blocks.php` need no change.
- `admin-dashboard.php:147` (the Decrees card for a non-admin) already checks `hasRole('calendar_editor')`. Under the new
  rule `developer` also reads decrees, so make it use the rule rather than one role name.
- `admin-decrees.js`: `canView` comes from the same rule, passed in through the page config, instead of a
  `/admin/permissions/check` call with `viewer`. `canEdit` and `canAdmin` keep their `editor` / `admin` checks.

### Dropping `viewer` from the forms

- `permission-requests.js`: the Relation dropdown offers `editor` and `admin` only. When a rejected request is refilled
  for resubmit, `viewer` rows are dropped and an info alert says why: read access now comes with the role. If that
  leaves no rows, one empty row is added. The display maps (`relationNames`, `relationBadgeClasses`) keep `viewer`, so
  history still renders.
- `admin-permissions.php` / `admin-permissions.js`: both grant forms drop the `viewer` option. Display maps keep it for
  existing rows.
- `skippedPermissions.js` and #618's messages are unaffected.

### Interaction with #617

Issue #617 prunes Relation to tiers strictly above what the user holds. With only `editor` and `admin` offered, that becomes:
hide `editor` when the user already holds it. Note this on #617 when this ships.

### Tests

- Vitest: the role → types rule, where JS needs it.
- PHPUnit (frontend): `AuthHelper`'s view methods for each role, global admin, and no role.
- E2E (`rbac`): these specs use `viewer` today and need rewriting:
    - **01, 03, 04, 05:** request flows that choose `viewer`. Switch them to `editor`, or assert the option is gone.
    - **07, 14, 15:** dashboard matrices that grant `viewer` to test read-only cards. Assert read-only access from the
      role instead, and add a case for a role holder with no tuple on that resource.
    - **08:** negative auth. Check what it asserts about `viewer`.
    - **09:** revoke after grant.
    - **19 (#618):** the redundant-request spec requests `viewer` on a calendar the user edits. That becomes a 400, so
      rework the first case around `editor` held, `editor` requested.
    - `support/requestAccess.ts`.

## Settled during review

- **The complete list of read checks that use `viewer`:** `AuthHelper::canViewResource()`,
  `canViewRiteCalendarResource()` and `canViewAnyResourceOfType()`, plus `admin-decrees.js`'s `canView`. Checked: the
  Sanctorale page's `capabilities.js` decides edit, create and delete only, and no other page reads `viewer_scopes` or
  calls `/admin/permissions/check` with `viewer`.
- **Roles come from the token**, as they already do for every write the API gates. A role revoked by a cascade stops
  granting read access when the person's token next refreshes. That is the same lag write access has today, and it is
  accepted.
- **A type that no role lists** (for example the removed `general_roman_calendar*` types) is not viewable by anyone but
  a global admin. _(My call.)_ `AuthHelperDashboardScopesTest`'s `general_roman_calendar` cases are rewritten for
  `rite_calendar`.
- **The frontend's copy of the role → types table** lives once in PHP, with a comment pointing to
  `AccessRequestRepository::ROLE_OBJECT_TYPES`. `permission-requests.js` reads it from config rather than keeping its
  own `roleObjectTypes`. _(My call: no cross-repo drift test, because the frontend CI cannot read the API source.)_
- **`developer` reads decrees and temporale too**, because its scope covers every type. _(My reading of decision 1.)_
- **A request or resubmit containing any `viewer` permission is refused as a whole** with a 400. The frontend never
  sends one, because it drops `viewer` rows before resubmit.

## Builder's discretion

Where the sweep script lives and its exact flags; the exact English of the 400 messages, the rejection note and the
resubmit info alert; whether the role → types table reaches JS through `AccessRequestsConfig` or a shared config; how
the E2E matrices are reorganised, as long as each read-only card is covered for each role.
