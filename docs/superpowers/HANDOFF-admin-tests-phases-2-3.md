# Handoff — admin-tests feature, phases 2 & 3

Continue a multi-phase feature: porting test-definition editing into the LiturgicalCalendar admin
frontend. **Phase 1 is done; pick up phases 2 and 3.**

## Read this first (source of truth)

The design spec covering all three phases lives in this repo on branch `feature/admin-tests-page`:

```text
docs/superpowers/specs/2026-06-29-admin-tests-page-design.md
```

Read it fully before doing anything — it has the locked decisions, the Editor UX section, and an
Open items list. Also check the auto-loaded `MEMORY.md` entries, especially "Shared checkout,
concurrent agents", "API runs in Docker", and the WebSocket gotchas.

## Status

- **Phase 1 (API) — DONE & MERGED.** `GET /auth/test-scopes` is live on `development`
  (PR #678, merge commit `3e264ea6`). It returns
  `{ is_global_admin: bool, editor: [{object_type, object_id}], admin: [{object_type, object_id}] }`
  where `object_type` is one of `national_calendar_test`, `diocesan_calendar_test`,
  `general_roman_calendar_test`. Use it for the frontend's exact gating: show **Edit** when
  `is_global_admin` OR the test's scope object is in `editor`; show **Delete** when `is_global_admin`
  OR it is in `admin`. Test-definition CRUD already exists: `GET /tests` (list), `PUT /tests`
  (create), `PATCH /tests/{name}` (edit), `DELETE /tests/{name}` (delete); writes require the Zitadel
  `test_editor` role plus scoped OpenFGA.
- **Phase 2 (frontend admin-tests page)** and **Phase 3 (UnitTestInterface editor retirement)** —
  NOT STARTED. Their implementation plans have not been written yet (only phase 1's plan existed).

## What to do

1. Use the `superpowers:writing-plans` skill to write the phase 2 plan from the spec, then the
   phase 3 plan. Save under `docs/superpowers/plans/` (phase 2 → this frontend repo; phase 3 →
   the UnitTestInterface repo). Bite-sized TDD, no placeholders, real code.
2. Execute each via `superpowers:subagent-driven-development` **in an isolated git worktree** (the
   user requires worktrees). Branch off `development`; copy gitignored env files if tests need them;
   run a baseline test before starting. Use a cheap model for transcription tasks, mid-tier for
   reviewers, the most-capable model for the final whole-branch review.
3. Per phase: open a PR to `development`, then ask the user before merging.

## Locked decisions (in the spec — do not re-litigate)

- **Scope:** test-definition CRUD only; the live WebSocket test RUNNER stays in UnitTestInterface.
- **Permission UX:** page gated to `test_editor`/admin; full unscoped list; per-row edit/delete
  gated via `/auth/test-scopes`; the API is the backstop.
- **Build:** a dedicated `admin-tests.php` + `assets/js/admin-tests.js` module modeled on the
  bespoke `admin-permissions.js` (NOT the `createAdminModule` factory — that is status-workflow
  only). Keep a clean generic/specific seam (it seeds a future coordinated admin-page factory — a
  separate initiative; do NOT build it now).
- **Editor:** faithfully port the UnitTestInterface editor — test-type buttons + icons, the
  `/events` datalist (`data-month`/`data-day`/`data-grade`), base date, per-year assertion cards
  with the `eventExists AND hasExpectedDate` ↔ `eventNotExists` toggle and color coding — with two
  modernizations: (a) drop Isotope, use native CSS grid for the year grid; (b) state-first model
  (`serialize()` reads the model, not the DOM); use `<textarea>` not `contenteditable`. The
  year-range control: PORT the dual-range slider as-is from UnitTestInterface
  (`assets/css/multi-range-slider.css`). `name` is the resource key, so render it read-only when
  editing an existing test.
- **Phase 3:** remove editing from UnitTestInterface `admin.php`/`admin.js`/`AssertionsBuilder.js`;
  KEEP the runner (`index.php`/`resources.php` + WS backend); leave a redirect/notice pointing to
  the new admin page.

## Source references (gathered while writing the spec)

- **Frontend pattern to mirror:** `admin-permissions.php` + `assets/js/admin-permissions.js`
  (bespoke form-CRUD: create modal, dynamic `CalendarSelect`-by-type, `isGlobalAdmin`/
  `isResourceAdmin` gating, `ApiClient`/`CalendarSelect` imports, `/auth/me` cookie auth). Layout:
  `layout/head.php`, `header.php`, `footer.php`; config injected as a `window.*Config` JSON blob.
- **Editor to port:** in the UnitTestInterface repo — `admin.php`, `assets/js/admin.js`,
  `assets/js/AssertionsBuilder.js`, `assets/css/multi-range-slider.css`, `components/NewTestModal.php`.
  Assertion shape: `{year:int, expected_value:RFC3339|null, assert:'eventNotExists'|'eventExists
AND hasExpectedDate', assertion:string, comment?:string}`. `LitCalTest` fields: `name`,
  `event_key`, `description`, `test_type` (`exactCorrespondence`|`variableCorrespondence`),
  `assertions`, `applies_to`/`excludes`, `year_since`/`year_until`. Schema:
  API repo `jsondata/schemas/LitCalTest.json`.
- **Open items from the spec to resolve during implementation:** (a) does the global `admin` role
  satisfy `AuthorizationMiddleware::forTestEditor` (can a global admin write without the explicit
  `test_editor` role)? (b) the exact `/events` response shape for the `event_key` datalist.

## Conventions & hazards

- The **API repo's main checkout is shared by other concurrent agents** — never `git checkout` or
  commit in a shared main checkout; create your worktree FIRST and work only there (`git push` is
  safe). Check `git worktree list` and for other agents before touching any repo. Phases 2–3 are
  frontend + UnitTestInterface, so likely no API-repo work — but apply the same worktree discipline.
- PR target is always `development`. Signed commits (GPG — the user may need to unlock the passphrase;
  never disable signing). Do not skip git hooks. Lint all `.md` (markdownlint). Frontend e2e is
  Playwright.
- A future scope-pooling question (calendar-editor vs test-editor scopes) is tracked in org
  Discussion #676 — out of scope.

Start by reading the spec, confirm your understanding of phases 2 and 3 with the user, then write
the phase 2 plan.
