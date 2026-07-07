# Test Definition dialog redesign — deterministic name + field reorder

**Date:** 2026-07-07
**Component:** `admin-tests.php` (editor modal markup) + `assets/js/admin-tests.js` (behavior)
**Status:** Approved design

## Problem

The Test Definition editor exposes a free-text **Name** field, even though a test's
name is fully determined by convention. The field order also doesn't match the
natural authoring flow, and the scope is a free picker for every user regardless of
their actual permissions.

## Naming convention (authority)

The canonical rule, defined by the JSON schema `LitCalTest.json` and used by the
UnitTestInterface app, is:

```text
name = event_key + 'Test'
```

Schema pattern (`LitCalTest.json`, name property):

```text
^(?:[a-z_]+?_){0,1}[A-Z][a-zA-Z1-9]+[0-9]{0,2}(?:_vigil)?Test$
```

Diocesan/national event keys already embed their scope prefix (e.g.
`rotter_nl_HLaurentius…`), so `event_key + 'Test'` is correct for every scope. The
scope itself is carried separately in `applies_to`, not encoded into the name a
second time.

## Goals

1. The Name is **derived**, never typed. Remove the visible Name input.
2. Reorder the editor fields to match the authoring flow.
3. Constrain the Scope field to the user's actual permissions.
4. Lock the identity-bearing fields (scope + event) when editing an existing test.

Non-goals: changing the API, the assertions builder logic, or the events catalog
endpoints. The scope→events reactivity already exists and is retained.

## Design

### 1. Name — derived and hidden

- Remove the Name label + `#testName` input from the editor modal.
- Under the **Liturgical event** field, show read-only helper text: the derived
  test name (e.g. `Test name: NativityJohnBaptistTest`), updated whenever the
  selected event changes. This is display-only, not a form control.
- On **create** save: `name = eventKeyInput.value + 'Test'`, replacing the current
  `name: nameEl.value` in the save handler (`admin-tests.js:657`).
- On **edit** save: name is unchanged — it is the identifier (`PATCH /tests/{name}`).
- Validation (`admin-tests.js:645`) no longer references the name input. It
  requires: an event key is selected, a description is present, and — as a guard
  against a hand-typed event key not in the catalog — the derived name matches the
  schema regex above.

### 2. Field order

New order in the editor modal markup:

1. **Scope**
2. **Liturgical event** (with the derived-name helper text beneath it)
3. **Base date**
4. **Test type** (governs the suggested description and the year-grid chip behavior)
5. **Description**
6. **Year range** (slider + chips + legend)
7. **Per-year assertions**

JS references elements by `id`, so reordering the markup does not affect behavior;
IDs are unchanged.

### 3. Scope RBAC (Option 1)

Scopes come from `GET /auth/test-scopes` as
`{ is_global_admin, editor: [{object_type, object_id}], admin: [...] }`.

- **Global admin** → current full picker (scope-type select + `CalendarSelect`).
- **Non-global admin** → authorized scopes = `editor ∪ admin` (deduped):
  - **Exactly one** authorized scope → render it as **static read-only text**
    (e.g. "Diocese: rotter_nl"), pre-set as the scope. No control.
  - **Several** → a `<select>` limited to just those authorized scopes (not the
    full calendar catalog).

The selected scope still feeds `selectedScope()` / the save payload's `applies_to`.

### 4. Edit-mode locking

When editing an existing test, **Scope** and **Liturgical event** are read-only
(so the derived name cannot drift). Base date, Test type, Description, year range,
and assertions remain editable.

### 5. Retained behavior

`reloadEventsThenRegenerate` (admin-tests.js:533-544) already reloads the events
datalist when the scope type or scope id changes. This is kept; only its position
in the DOM moves.

## Testing (`e2e/admin-tests.spec.ts`)

Existing tests that must be migrated (they reference the removed `#testName`):

- "create flow submits a PUT…" — remove the `#testName` fill; assert the PUT body
  `name` equals `event_key + 'Test'` (derived), not a typed value.
- "edit flow renders name read-only…" — rename to reflect the new invariant: assert
  Scope and Liturgical event are read-only on edit (the name field no longer exists).

New tests:

- Create: selecting an event sets the derived-name helper text and the PUT body name.
- Scope RBAC: a single-scope non-admin sees static scope text (no select); a
  multi-scope non-admin sees a select limited to their scopes.
- Field order: assert the DOM order of the labelled fields.

## i18n

Removing the Name label. New strings ("Test name:" helper, any scope static-text
label) are added as `_()` calls and flow through the normal gettext extraction →
Weblate; no manual `.po` edits.

## Risk / rollback

Markup reorder + JS-localized behavior change, all behind the existing editor modal.
Reversible by reverting the two files. The API contract is unchanged (still
`PUT /tests` / `PATCH /tests/{name}` with the same schema-shaped body).
