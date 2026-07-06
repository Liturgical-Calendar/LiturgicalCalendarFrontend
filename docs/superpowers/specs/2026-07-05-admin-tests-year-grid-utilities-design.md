# Admin-Tests Year-Grid Utilities — Design

**Date:** 2026-07-05
**Status:** Approved (brainstorming session)
**Lands in:** PR #379 (`feat/admin-tests-phase2`), extending the phase-2 admin-tests page
**Reference implementation:** `UnitTestInterface/assets/js/admin.js` (`generateYearSpanHtml`,
`computeYearDateAttrs`, the `fa-circle-xmark` / `fa-hammer` / `.deleted` click handlers) and
`UnitTestInterface/assets/css/admin.css` (`.testYearSpan.deleted` striped bar)

## Problem

Acceptance testing of the phase-2 test editor against the old UnitTestInterface editor found the
year-grid overview incomplete:

- no per-year **exclude** affordance (the ⓧ icon that collapses a year to a red/white striped bar,
  click-to-restore);
- no **hammer** affordance (pivot/toggle, with behavior that varies by test type);
- no **Sunday highlighting** (`bg-light` + explanatory tooltip when the event's fixed date falls on
  a Sunday in that year);
- no explanation of what the background colors mean (the old UI never had one either — a legend is
  a new addition).

The model layer needs no schema work: `AssertionsBuilder` already round-trips `excludes`
(`load()` → `setMeta()` → `serialize()`), `generate({ excludedYears })` skips excluded years, and
the API's `LitCalTest` schema defines the `excludes` field.

## Approach

**State-first port** (approach A of the brainstorm). The grid remains a pure projection of
`builder.model`; clicks mutate the model and re-render. The old UI's direct-DOM mutation approach
was rejected because `serialize()` never reads the DOM in phase 2 — DOM-held exclusion state would
silently not serialize, the same class of desync CodeRabbit review round 2 eliminated from
`toggleAssert`.

## Design

### 1. Model layer — `AssertionsBuilder` additions

- `excludeYear(year)` — adds `year` to `model.excludes` (kept sorted, deduped; array created if
  `null`), removes that year's entry from `model.assertions`. Chainable, no-op for unknown years.
- `includeYear(year)` — removes `year` from `model.excludes` (field returns to `null` when the
  array empties), re-creates that year's assertion using the same rules as `generate()`:
  `eventNotExists` when outside the pivot (`year_since`/`year_until`) or when `baseMonthDay` is
  null, otherwise the exact-correspondence assertion with `expected_value` computed from
  `baseMonthDay`. Assertions stay sorted by year. Chainable, no-op if the year is not excluded.
- **Folded-in bug fix:** `regenerate()` in `admin-tests.js` currently calls `generate()` without
  `excludedYears`, so any exclusions would be wiped whenever the event, test type, or slider
  changes. It will pass `excludedYears: builder.model.excludes ?? []`.

### 2. Grid rendering — `renderYearGrid()` extended

Span anatomy: `[🔨?] YEAR [ⓧ]`.

- Hammer (`fa-hammer me-1 opacity-50`, `title="set year"`): omitted for `exactCorrespondence`
  (nothing to pivot or toggle), present for the other three types.
- X-mark (`fa-circle-xmark ms-1 opacity-50`, `title="remove"`): always present on included years.
- Excluded years render as `<span class="testYearSpan year-YYYY deleted">` — no text, no icons.
  CSS ported to `assets/css/admin-tests.css`: red/white 45° `repeating-linear-gradient`, 3px wide,
  32px tall, `cursor: not-allowed` (visually identical to the old UI; a `title` attribute such as
  "2026 excluded — click to restore" is added as an accessibility improvement over the original).

Background classes, all derived from state (never from sibling-sweeping the DOM):

| Class / style        | Meaning                                                 | Derived from                                            |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| default (beige)      | year included, event asserted on its date               | assertion present, `assert = eventExists…`              |
| `bg-light` + tooltip | event's fixed month/day falls on a **Sunday** that year | `builder.baseMonthDay` (port of `computeYearDateAttrs`) |
| `bg-info`            | pivot year                                              | `model.year_since` / `model.year_until`                 |
| `bg-warning`         | year asserted `eventNotExists`                          | that year's `assertion.assert`                          |
| red/white stripes    | year excluded from the test                             | `model.excludes`                                        |

`bg-warning` derivation from assertions replaces the old UI's previous/next-sibling class sweep —
same visual result, single source of truth.

### 3. Interactions — one delegated click handler on `#yearGrid`

Replaces the current whole-span pivot click (ambiguous once spans contain two other targets):

| Click target | Test type     | Action                                  |
| ------------ | ------------- | --------------------------------------- |
| 🔨 hammer    | Since / Until | `builder.setPivot(year)` (existing)     |
| 🔨 hammer    | Variable      | `builder.toggleAssert(year)` (existing) |
| ⓧ x-mark     | any           | `builder.excludeYear(year)`             |
| striped bar  | any           | `builder.includeYear(year)`             |
| span body    | any           | no action                               |

Deliberate improvement over the original: the variable-type hammer is **two-way** (delegates to
`toggleAssert`, which flips both directions), consistent with the per-card toggle buttons. The old
UI's hammer only set `bg-warning` one-way.

After every mutation both the grid **and** the assertion cards re-render
(`builder.render(assertionsContainer)` + `renderYearGrid()`): an excluded year must have no card,
and a restored year's card must reappear.

### 4. Legend — chip row under the grid

Static HTML in `admin-tests.php`, directly beneath `#yearGrid`; five entries, labels
gettext-wrapped with `htmlspecialchars` escaping like the rest of the page:

```text
■ included   □ falls on Sunday   ■ pivot year   ■ event not expected   ┃ excluded (click to restore)
```

Swatches are small chips (`<span class="legend-chip …">`) that reuse the exact classes the grid
spans use (`bg-light`, `bg-info`, `bg-warning`, `deleted`) so legend and grid cannot drift apart.
To make that sharing possible, the ported striped-bar CSS must NOT be ID-scoped the way the
original was (`#yearsToTestGrid > .testYearSpan.deleted`): `admin-tests.css` styles `.deleted` via
a selector that matches both grid spans and legend chips (e.g. `.testYearSpan.deleted,
.legend-chip.deleted`). Chip sizing lives in `admin-tests.css`.

### 5. Error handling

All interactions are pure client-side state changes — nothing network-touching. Guards: clicks
resolving to a year with no matching assertion/exclusion are no-ops (same convention as
`toggleAssert`); `excludeYear` on an already-excluded year and `includeYear` on a non-excluded
year are no-ops.

### 6. Testing

- **Unit (Vitest):** `excludeYear`/`includeYear` round-trip (assertion removed and re-created with
  pivot- and `baseMonthDay`-aware rules); `serialize()` emits `excludes` and drops the key when
  empty; `generate()` + `regenerate()` wiring preserves exclusions across event/type/slider
  changes; `render()`/grid derivation of `bg-warning` from assertions.
- **E2E (chromium smoke spec):** exclude a year → its assertion card disappears and the span
  becomes the striped bar → click the bar → card and full span return; legend row is visible.

## Out of scope

- Retiring the old UnitTestInterface editor (phase 3, separate repo).
- Any API/schema change (none needed).
- Isotope-style animated grid relayout (the old fade/relayout was an Isotope artifact; phase 2
  uses native CSS grid).

## Revision 2 (2026-07-06) — field-test findings

Manual smoke testing against real test definitions surfaced three changes (user-approved):

### R2.1 Year exclusion is implicit — assertion absence is the source of truth

Source test definitions encode year exclusion **implicitly**: e.g. `NativityJohnBaptistTest.json`
(exactCorrespondence) asserts only 2022/2033/2044 — every other year in the span is excluded by
omission. No definition in the corpus has an `excludes` field, the old UnitTestInterface never
emitted one, and — decisively — the schema types `excludes` as `AppliesToOrExcludes` (the same
shape as `applies_to`): it is **calendar-scope** exclusion metadata, not a year list. The original
Task 1 design misused `model.excludes` as a year list, which `serialize()` would have emitted as a
schema-invalid PATCH body (stubbed e2e never hit real validation).

Fix — assertion absence becomes the single source of truth for year exclusion:

- `excludeYear(y)`: removes the year's assertion; never touches `model.excludes`.
- `includeYear(y)`: creates the assertion (pivot- and `baseMonthDay`-aware, `generate()` rules)
  for any year lacking one; no `excludes` bookkeeping.
- `renderYearGrid()`: a year renders striped iff it has no assertion.
- `regenerate()`: derives `excludedYears` as the gaps inside the asserted span
  (`[min(assertedYears), max(assertedYears)]` minus asserted years; empty when there are no
  assertions yet, so the create flow is unaffected) — exclusions survive event/type/slider changes,
  and slider-widening still auto-includes the newly visible years.
- `model.excludes` reverts to schema semantics (calendar scope): loaded and serialized verbatim,
  never mutated by year interactions.
- Task 1's unit tests are rewritten to these semantics.

This also fixes the reported "x only works in Since type": `excludeYear` guarded on assertion
presence, so on sparse loaded tests the gap years' controls silently no-opped — not a type
dependency.

### R2.2 Sunday hint: additive cross overlay replaces bg-light

`bg-light` sat at the bottom of a mutually-exclusive precedence (pivot > not-exists > Sunday), so
the hint vanished exactly where most informative, and was nearly invisible anyway. Replaced by an
**additive overlay**: spans (and the legend chip) get a `sunday` class whose `background-image`
draws a centered upright cross (two linear-gradient bars) in semi-transparent liturgical red
(`rgba(220, 53, 69, 0.30)`). Because `background-image` layers over `background-color`, the cross
composes with beige/`bg-info`/`bg-warning` instead of competing. The background-color precedence
reduces to pivot > not-exists. Tooltip unchanged. Excluded (striped) years carry no Sunday overlay.

### R2.3 Legend

The Sunday legend chip now demonstrates the cross overlay (`legend-chip sunday`) instead of
`bg-light`; label unchanged.

## Revision 3 (2026-07-06) — base date derivation / storage / restoration

Field finding: loading `NativityJohnBaptistTest` left the **Base date** field empty (the old
UnitTestInterface shows June 24). The base date's lifecycle is now defined explicitly:

- **Stored:** nowhere as a dedicated field. The base date is implicit in the assertions'
  `expected_value` dates — every exact assertion shares the same month/day with a per-year year.
- **Derived (model):** `load()` sets `builder.baseMonthDay` to the month/day of the first
  assertion carrying an `expected_value` (existing `#deriveBaseMonthDay`); `null` when no
  assertion has a date. `generate()` sets it from the event catalog's fixed `month`/`day`.
- **Restored (UI):** `openEditor(test)` must populate `#baseDate` with
  `${minAssertedYear}-MM-DD` from `builder.baseMonthDay` — the year component is presentational
  only (the field's change handler expands month/day across every asserted year); empty when
  `baseMonthDay` is `null`. This mirrors UnitTestInterface `admin.js:1070`
  (`#baseDate.value = firstYear + monthDay`).
- **Create flow:** unchanged — `regenerate()` seeds `#baseDate` from the selected event's fixed
  month/day, or leaves it empty for movable feasts (the user sets it manually).
- **Precedence:** on edit, the loaded assertions' dates are authoritative over the event
  catalog's month/day (definitions may deliberately differ, and the catalog fetch is async).

### R3.1 Correction (2026-07-06): base date derives from the CATALOG, not the assertions

R3's "first dated assertion" rule was wrong in intent. The base date's purpose (user-clarified) is
a **Sunday-coincidence assist on the canonical date** — "in which of these years does the event's
canonical date fall on a Sunday" — plus a pre-fill helper for the assertion cards. The assertions
hold _resolved_ dates (possibly transferred, e.g. NativityJohnBaptistTest asserts June 23 in
anticipation years), so deriving the base from them inverts input and output. The old UI reads the
event catalog's `data-month`/`data-day` (June 24) for exactly this reason.

Rule:

- **Edit path:** once the events fetch resolves, `#baseDate` = `minAssertedYear-MM-DD` from the
  catalog entry for the test's `event_key`. Fallback when the event is absent from the catalog or
  has no fixed date: the **mode** (most frequent month/day) of the dated assertions,
  earliest-year tiebreak — strictly better than the old UI's `-01-01` fallback. Empty only when
  neither source yields a date. `builder.baseMonthDay` is set to the same value **without**
  firing the field's change handler (which would rewrite every assertion's date).
- **Model:** `load()`'s internal fallback derivation upgrades from "first dated assertion" to the
  same mode rule.
- The field **remains editable** as the escape hatch for custom pre-fill dates (and for
  all-transfer tests, where restoring toggled years at the transferred date requires setting it
  manually — old-UI-equivalent behavior, now documented).

## Revision 4 (2026-07-06) — assertions normalized to year order at load

Field finding: per-year cards appeared grouped by assert type. Cause: the corpus does not
guarantee assertion order — e.g. `StJaneFrancesDeChantalTest` stores all `eventExists` assertions
first, then the `eventNotExists` block — and `load()` preserved definition order (the old UI's
Isotope layout masked this). Rule: `load()` sorts assertions by year, establishing the model
invariant _assertions are always year-ordered_ (`generate()` already produces sorted output and
`includeYear()` maintains it). This also repairs the R3.1 mode-derivation tiebreak, whose
"earliest seen = earliest year" assumption was false on unsorted input. Serialization order
follows the model, so re-saving a grouped legacy definition normalizes it — an intended cleanup.

## Revision 5 (2026-07-06) — icon semantics per test type; legend spacing

- **Grid action icon by test type:** the hammer's meaning is _set the pivot year_ — it only
  applies to `exactCorrespondenceSince`/`Until`. For `variableCorrespondence` the action is
  _toggle the assertion_, which the per-year cards already express with `fa-repeat` — the grid
  now uses `fa-repeat` there too (new i18n title `toggleAssertion`), deviating deliberately from
  the old UI (hammer everywhere) to preserve semantic consistency. The behavioral hook class
  (`hammerYear`) and the click handler are unchanged — only the visual icon and title vary.
- **Legend spacing:** the legend used `column-gap-3 row-gap-1`, which do not exist in the
  Bootstrap 5.2.x bundled by startbootstrap-sb-admin@7.0.7 (they arrived in 5.3) — the chips
  rendered clumped. Replaced with `gap-3`, which the bundle provides for flex containers.
