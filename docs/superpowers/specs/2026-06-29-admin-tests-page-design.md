# Admin Tests Page — Design

**Date:** 2026-06-29
**Status:** Draft (awaiting review)
**Repos touched:** `LiturgicalCalendarFrontend` (primary), `LiturgicalCalendarAPI`, `UnitTestInterface`

## Summary

Add an `admin-tests` page to the administration area of `LiturgicalCalendarFrontend` so that
holders of the `test_editor` role can **create, edit, delete, and view liturgical test
definitions** directly from the website, without leaving it for the standalone UnitTestInterface
site. The editing UI currently living in `UnitTestInterface/admin.php` is retired; that site keeps
only the live test **runner**.

### Goals

- Full CRUD over test definitions from the main admin area, reusing the existing `/tests` API.
- Permissions reflected exactly in the UI (which tests a user may edit / delete), backed by the
  server's calendar-scoped authorization.
- Single source of truth for test-definition editing.

### Non-goals

- Porting the live test **runner** (WebSocket / `Health` backend). It stays in UnitTestInterface
  for now. (Revisit separately.)
- Building a generalized admin-page factory. Tracked as separate future work (see below).

## Background — current state

- **API already supports test CRUD.** `GET/POST/PUT /tests` and `GET/PATCH/DELETE /tests/{testId}`
  (`Router.php:486–513`, `TestsHandler.php:334–393`), validated against
  `jsondata/schemas/LitCalTest.json`. Test files live in `jsondata/tests/{Name}.json`.
- **Authorization is already calendar-scoped.** Writes require the Zitadel `test_editor` role
  (`AuthorizationMiddleware::forTestEditor`, `Router.php:699`) **and** an OpenFGA relation on the
  test's scope object (`OpenFgaAuthorizationMiddleware::forTestScopes` + `TestScopeResolver`,
  `Router.php:704`): `PUT/PATCH → editor`, `DELETE → admin`. Global admins bypass the FGA checks.
  Scope is derived from the test's `applies_to` (`TestScopeResolver`): diocesan →
  `diocesan_calendar_test:<id>`, national → `national_calendar_test:<id>`, otherwise
  `general_roman_calendar_test:general_roman_calendar`.
- **An editor already exists** in `UnitTestInterface/admin.php` + `assets/js/admin.js`
  (`AccuracyTestDefinition`, save via `PUT /tests` create / `PATCH /tests/{name}` update) +
  `assets/js/AssertionsBuilder.js` (the per-year assertion grid). No DELETE in that UI today.
- **Frontend admin conventions.** The closest analog to a form-CRUD admin page is the *bespoke*
  `admin-permissions.js` (create via `POST`, delete via `DELETE`, dynamic `CalendarSelect`-by-type
  fields, scope gating via an `isGlobalAdmin` config flag + the resource-admin distinction). The
  `createAdminModule` factory (`admin-module-base.js`) is **status-workflow-specific**
  (pending/approved/rejected/revoked, approve/reject actions) and is **not** suitable here. No
  existing page implements a true entity EDIT (PATCH) yet — this page introduces the first.
- There are **no** `admin-decrees/missals/calendars.php` form-CRUD pages today; what exists is
  `missals-editor.php` (inline table) and `decrees.php` (read-only). They are incomplete/piecemeal.

## Decisions

1. **Scope:** CRUD of test *definitions* only; the runner stays in UnitTestInterface.
2. **Permission UX:** Hybrid — list/view all tests for any authenticated user; gate edit/delete
   buttons per-row using the caller's exact scopes; API is the hard backstop.
3. **Old editor:** Retire the editing UI in `UnitTestInterface/admin.php` (single source of truth).
4. **Build approach:** A dedicated `admin-tests` module modeled on `admin-permissions.js` (NOT the
   status-workflow factory), with a clean internal seam between generic CRUD plumbing and
   test-specific logic so it can later seed a shared factory cheaply.
5. **Exact gating:** Add a sibling API endpoint `GET /auth/test-scopes` exposing the caller's
   `editor` and `admin` scopes for the `*_test` object types, so the UI gates precisely for every
   user (including scoped editors who are not admins).

## Architecture

### A. API — `GET /auth/test-scopes` (LiturgicalCalendarAPI)

A new read-only, authenticated endpoint returning the caller's own test scopes. Chosen as a
**sibling** to `/auth/admin-scopes` rather than extending it, so the applications/permissions admin
pages (which call `/auth/admin-scopes`) don't incur the extra OpenFGA `listObjects` calls.

- **Handler:** `src/Handlers/Auth/TestScopesHandler.php` (mirrors `AdminScopesHandler`: derive
  `is_global_admin` from the Zitadel `admin` role; compute scopes via `ResourceAdminService`;
  fail closed to empty arrays when the FGA client is unavailable).
- **Service:** extend `ResourceAdminService` with
  `resolveTestScopes(string $sub): array{editor: list<Scope>, admin: list<Scope>}`, looping the
  three test object types `['national_calendar_test','diocesan_calendar_test',
  'general_roman_calendar_test']` and calling the existing
  `OpenFgaClient::listObjects($fgaUser, 'editor'|'admin', $type)` (`OpenFgaClient.php:299–328`).
  `editor` ⊇ `admin` because the model defines `editor = this ∪ computedUserset(admin)`.
- **Route:** add `GET /auth/test-scopes` behind the same JWT/OIDC auth middleware as
  `/auth/admin-scopes` (authenticated; returns the caller's scopes only — no elevation).
- **Response:**

  ```json
  {
    "is_global_admin": false,
    "editor": [{ "object_type": "national_calendar_test", "object_id": "USA" }],
    "admin":  [{ "object_type": "diocesan_calendar_test", "object_id": "..." }]
  }
  ```

- **Grounding:** test scopes are **independent** of calendar scopes in the current OpenFGA model
  (`scripts/openfga-model.json` test types use only `this` + same-type `computedUserset`; no
  `tupleToUserset` back to calendar objects). See Future work for possible pooling.

### B. Frontend — `admin-tests` page (LiturgicalCalendarFrontend)

- **`admin-tests.php`** — follows the admin-page convention: auth gate
  (`$authHelper->isAuthenticated` + a test-editor/admin/resource-admin check → redirect otherwise);
  renders an `AdminTestsConfig` JSON blob (`apiUrl`, `i18n`, and the page reads scopes at runtime
  from `/auth/test-scopes`); `head.php`/`header.php`/`footer.php` includes; markup for the list
  container and two modals — `#testEditorModal` (create/edit form) and `#deleteTestModal`
  (confirm). A nav entry is added to the admin dashboard/header.
- **`assets/js/admin-tests.js`** — bespoke module (initialized on `DOMContentLoaded`), importing
  `ApiClient` / `CalendarSelect` / `CalendarSelectFilter` like `admin-permissions.js`. Internally
  organized as:
  - **Generic seam** (extraction candidates for the future factory): `fetchJson(method, path,
    body)`, `renderTable(rows, columns)`, `showModalAlert(...)`, `gateByScope(...)`,
    auth/scope bootstrap (`/auth/me` + `/auth/test-scopes`).
  - **Test-specific:** scope grouping for the list, the editor form, and `AssertionsBuilder` glue.
- **`assets/js/AssertionsBuilder.js`** — ported from UnitTestInterface with a tight interface:
  `load(testDefinition)` to populate, `serialize()` to produce the assertions array. The per-year
  assertion grid keyed by `test_type` (exact/variable correspondence) is preserved.
- **List:** `GET /tests` → rows grouped by derived scope (General Roman / `national:<id>` /
  `diocesan:<id>`), columns: name, event_key, description, scope, test_type, year range, actions.
  A client-side name/scope filter keeps the list usable as it grows.
- **Editor form fields:** `name`, `event_key` (datalist sourced from `GET /events`), `description`,
  `test_type`, **scope** (`applies_to`) via the dynamic `CalendarSelect`-by-type approach from
  `admin-permissions.js`, `year_since`/`year_until`, and the assertions grid. Create uses
  `PUT /tests`; edit uses `PATCH /tests/{name}`.
- **Delete:** `#deleteTestModal` → `DELETE /tests/{name}`.
- All requests: `credentials: 'include'`, `Accept`/`Content-Type: application/json`.

#### Editor UX (port the UnitTestInterface editor, modernized)

The editor reproduces the existing UnitTestInterface editing experience so editors keep a familiar
workflow, presented as a stepped modal:

1. **Test type** — four choices with their existing FontAwesome icons: Exact date (`fa-vial`,
   `exactCorrespondence`), Exact date since year (`fa-right-from-bracket`,
   `exactCorrespondenceSince`), Exact date until year (`fa-right-to-bracket`,
   `exactCorrespondenceUntil`), Variable existence by year (`fa-square-root-variable`,
   `variableCorrespondence`). The choice drives the rest of the form.
2. **Liturgical event** — an `<input list>` datalist populated from `GET /events` for the selected
   calendar/locale; options carry `data-month`/`data-day`/`data-grade`. Selecting an event
   auto-fills the description and feeds the base date + Sunday highlighting.
3. **Year range** — the dual-range slider ported as-is from UnitTestInterface
   (`assets/css/multi-range-slider.css`), bounded 1970–2050, feeding `year_since`/`year_until` (for
   the *Since*/*Until* types) and the set of years to assert on.
4. **Base date** — `<input type=date>` pre-filled from the event's fixed `month`/`day` (or Jan 1 of
   the first year); expands to per-year `expected_value` (RFC 3339,
   `YYYY-MM-DDT00:00:00+00:00`).
5. **Per-year assertion cards** — one card per year, each with: the year; the calendar scope; an
   **assertion-type toggle** between `eventExists AND hasExpectedDate` (green) and `eventNotExists`
   (amber) via `fa-repeat`; an editable **expected date** (`fa-pen-to-square`, hidden when
   `eventNotExists`); an editable **assertion sentence**; and an optional **comment**
   (`fa-comment-medical` / `fa-comment-dots`). Per-type behavior: exact = uniform across years;
   since/until = years before/after the pivot forced to `eventNotExists`; variable = each year
   toggled independently. A **year-grid overview** shades Sundays / excluded / pivot years and
   supports click-to-exclude.

**Modernizations vs. the original (preserve the look, reduce risk):**

- **Drop the Isotope dependency** — the year grid is a plain CSS grid (`fitRows` is native
  `grid` / `flex-wrap`); same visual, one fewer third-party library.
- **State-first** — one in-memory test model is the source of truth; the UI renders from it and
  `AssertionsBuilder.serialize()` reads the model (not the DOM, as the original does), matching the
  `load()` / `serialize()` interface. The assertion sentence uses a `<textarea>` rather than
  `contenteditable` for accessibility.

Reuses Bootstrap 5 + FontAwesome (already present in the frontend).

### C. UnitTestInterface — retire the editor

- Remove the test-definition editing UI: `admin.php` editing surfaces and the create/edit/save
  paths in `assets/js/admin.js`; the `AssertionsBuilder.js` there is superseded by the ported copy
  in the frontend. Keep the live runner (`index.php`/`resources.php` + WebSocket backend) intact.
- Replace the old admin entry point with a short notice/redirect pointing editors to the admin
  area page, so existing bookmarks aren't dead ends.
- The `test_editor` role and `/tests` API are unchanged, so the runner is unaffected.

## Permission model & UX

- **Page access** requires the `test_editor` role or admin/resource-admin — it is an admin page.
  Reads are not scope-filtered, so anyone who can reach the page sees **all** tests; the per-row
  gating below governs what they may change.
- **Bootstrap on load:** `GET /auth/me` (for the `test_editor` role) + `GET /auth/test-scopes`
  (`is_global_admin`, `editor[]`, `admin[]`).
- **Per-row gating:** derive each test's scope object from its `applies_to`; show **Edit** when
  `is_global_admin` or the object is in `editor[]`; show **Delete** when `is_global_admin` or the
  object is in `admin[]`.
- **Create:** enabled when the user has the `test_editor` role (or is global admin). The scope
  picker is constrained to scopes the user may edit (`editor[]`), except global admins who may pick
  any scope.
- **Backstop:** the API enforces role + scope regardless; any `403` is surfaced in the modal.

## Error handling

- Client-side: required-field validation before submit; disable the submit button during the
  request; validate assertion rows (year present, expected_value shape) before serialize.
- API responses surfaced in the modal alert area: `400/422` (schema/validation — show the message),
  `401` (open the login modal), `403` (scope/role denied — explain), `404`, `409` (name conflict on
  create). On success, close the modal and reload the list.

## Testing

- **Frontend (Playwright, the repo's e2e stack):** load the page; list renders grouped by scope;
  create → appears; edit → persists; delete → removed; scope-gating hides Edit/Delete for
  out-of-scope rows (drive via a stubbed `/auth/test-scopes` / `/auth/me`). Gate behind the e2e
  path filters already used for `package.json`/JS changes.
- **API:** unit/route tests for `TestScopesHandler` (global admin, scoped editor, scoped admin,
  unauthenticated, FGA-unavailable → empty). Existing `TestsHandler` write tests already cover the
  CRUD authorization.
- **AssertionsBuilder:** unit test for `serialize()`/`load()` round-trip if a JS unit runner is
  available; otherwise covered via the Playwright editor flow.

## Rollout / sequencing

1. API: add `GET /auth/test-scopes` (+ `ResourceAdminService::resolveTestScopes`) and tests; deploy.
2. Frontend: build `admin-tests` page + ported `AssertionsBuilder`; e2e; ship behind the admin nav.
3. UnitTestInterface: retire the editor, leave a redirect/notice to the admin page.

## Future work

- **Coordinated admin-page form-CRUD factory.** decrees/missals/calendars admin are piecemeal and
  incomplete; `admin-tests` is built with a clean generic/specific seam so it can serve as a clean
  reference example. A unified factory (covering form-CRUD *and* the existing status-workflow
  pattern) is a separate initiative with its own spec, studying all real pages — not designed from
  this one example.
- **Pooling calendar-editor and test-editor scopes.** Test-editor scopes are independent of
  calendar scopes today, which is why `/auth/test-scopes` is a dedicated sibling endpoint. Over
  time, calendar-editor and test-editor scopes may be pooled — possibly absorbing test-editor
  scopes into calendar-editor scopes. If that happens, the endpoint/semantics (and the FGA model)
  would be revisited. To be discussed in a GitHub Discussion on the API repo.

## Open items / risks

- Confirm during implementation whether the global `admin` role satisfies
  `AuthorizationMiddleware::forTestEditor` (i.e., whether a global admin without the explicit
  `test_editor` role may write). The client gates on `is_global_admin || has test_editor role`; the
  API is authoritative either way.
- `event_key` datalist depends on `GET /events` returning the event catalog for the chosen scope;
  confirm the shape/locale handling when wiring the field.
- Renaming a test is not an in-place edit — `name` is the resource key for `PATCH/DELETE
  /tests/{name}`, so a rename is delete + recreate. The editor must render `name` read-only when
  editing an existing test.
- (Resolved) Year-range control: port the original custom dual-range slider
  (`multi-range-slider.css`) as-is to preserve the familiar feel — carried over verbatim alongside
  the ported assertion editor.
