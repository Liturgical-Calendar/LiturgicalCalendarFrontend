# Design: a national calendar in more than one wider region (frontend)

Frontend alignment with LiturgicalCalendarAPI#1005, which lets a national calendar declare an ordered list of wider
regions (`metadata.wider_regions`) instead of one (`metadata.wider_region`). The API side is specified in the API
repository's `docs/superpowers/specs/2026-09-28-multiple-wider-regions-design.md` (branch
`feat/1005-multiple-wider-regions`); this document covers only what the frontend changes.

## 1. Background

A national calendar inherits from the wider regions it belongs to: Sweden, for instance, from Europe (its patrons) and
from the Nordic episcopal conference (its shared celebrations). Until #1005 the API allowed one region per nation, and
the extending page mirrors that with a single text input.

### 1.1 What the frontend does today

- **The control.** `extending.php` renders `#associatedWiderRegion`, a free-text `<input>` with a datalist of
  `wider_regions_keys`. `updateRegionalCalendarForm()` fills it from `metadata.wider_region` when a national calendar
  loads (`extending.js`, `document.querySelector('#associatedWiderRegion').value = metadata.wider_region`).
- **The default.** For a new national calendar, `defaultWiderRegionForNewNation()` fills it from
  `widerRegionForNation()` (`assets/js/widerRegionForNation.js`), which infers membership from the region subtag of each
  region's `locales` and answers only when exactly one region matches.
- **The save.** `buildNationalCalendarPayload()` reads the input into `metadata.wider_region`, and
  `NationalCalendarPayload` (`assets/js/NationalCalendarPayload.js`) requires it to be a string matching a hard-coded
  `Americas|Europe|Asia|Africa|Oceania`.
- **Edit rights.** `widerRegionMembership()` (`extending.js`) builds `declaredRegion`, nation → the one region its
  national calendar declares, from `/calendars`, and `widerRegionEditRights.js` compares it with `===`. The same module
  documents that the page cannot see other regions' member lists, which `/calendars` does not publish.

### 1.2 What the API publishes after #1005

In `/calendars` (`litcal_metadata`):

- each `national_calendars[]` item carries `wider_regions`: string[], ordered most general first, always present,
  possibly empty; plus the deprecated `wider_region` string only when the list has exactly one entry;
- each `wider_regions[]` item carries
    - `roster`: string[], sorted ISO 3166-1 alpha-2 codes of every nation eligible to join the region (the region file's
      `national_calendars` map), calendar or not;
    - `national_calendars`: string[], sorted codes of the nations that have a calendar and declare the region; a subset of
      `roster` when the data is consistent.

`GET /data/nation/{nation}` returns `metadata.wider_regions`, plus the deprecated `wider_region` when the nation has
exactly one region.

`PUT` / `PATCH /data/nation/{nation}` accept `metadata.wider_regions`. Each declared region must exist and its roster must
list the nation, or the API answers **422**. A legacy single-string `PATCH` to a nation already in two or more regions
is **422** too.

## 2. Goals

- A curator can place a national calendar in any number of wider regions, choosing among those that list the nation.
- A new national calendar starts in every region that lists it.
- Saving sends `wider_regions`; nothing is lost from a calendar that declares more than one region.
- A national calendar editor's wider-region translation rights (#999) follow every region the nation belongs to.

## 3. Non-goals

- The region → nation → diocese navigation of #66. It builds on the same `roster`, in its own change.
- New wider region data (Nordic, Southern Africa, …) and the `Asia` region's source and members (API #1006).
- The wider-region form itself: `WiderRegionPayload`'s `metadata.wider_region` is the region's own name, not a
  membership, and does not change.
- Choosing the order of a nation's regions (section 4).

## 4. Decision: a multiselect, ordered automatically

The single input becomes a multiselect like the page's Locales and Holy days of obligation controls, and the curator does
not order the regions: they are saved broadest first, by roster size, then by name.

The API applies regions in the declared order, so a later region could override an earlier one. That does not happen in
practice: a wider region carries one or two patrons and a few shared celebrations, and two regions of one nation do not
redefine the same celebration. So the order only needs to be deterministic, and "broadest first" also matches the API's
"most general first" convention.

Rejected: an ordered list with move-up/move-down controls, and a multiselect plus a separate order control. Both ask the
curator for a decision that has no practical effect.

## 5. Components

### 5.1 `wider_regions` helpers (`assets/js/widerRegions.js`, new)

Pure functions over `/calendars` and `/data` shapes, so they work against the API before and after #1005:

- `nationWiderRegions(item)`: a national calendar item's or `metadata`'s regions as a list: `wider_regions` if it is an
  array, else `[wider_region]` if that is a non-empty string, else `[]`.
- `widerRegionRoster(region)`: a `/calendars` region item's `roster`, or `null` when the API does not publish it.
- `orderWiderRegions(names, regions)`: `names` sorted broadest first: by the length of each region's roster, descending,
  then by name; a region with no roster sorts by name after those with one.
- `eligibleWiderRegions(nation, regions, declared)`: the region names offered for `nation`: those whose roster lists it,
  plus every name in `declared` (so a stored membership is never hidden, even one the roster no longer lists), ordered
  with `orderWiderRegions()`. When no region publishes a roster, every region is offered.

### 5.2 The control (`extending.php`, `extending.js`)

- `#associatedWiderRegion` (input + datalist) becomes `#associatedWiderRegions`, a `<select multiple>` initialised with
  bootstrap-multiselect the way `#nationalCalendarSettingHolydays` is, and disabled/enabled with the rest of the national
  settings form.
- Its options are rebuilt whenever a national calendar is loaded or created, from `eligibleWiderRegions()` for that
  nation and its declared regions, with the declared ones selected.
- The label becomes "Wider regions" (a new translatable string); the info tooltip explains that only regions listing the
  nation are offered.
- A region already declared but no longer listed by its roster is still offered and selected; the API will refuse it on
  save with a 422 naming it, which is shown like any other save error.

### 5.3 The default for a new nation (`assets/js/widerRegionForNation.js`)

`widerRegionForNation()` becomes `widerRegionsForNation()`, returning a list:

- every region whose roster lists the nation, ordered with `orderWiderRegions()`;
- when no region publishes a roster, today's inference from the region subtag of each region's `locales`, now returning
  every match instead of only a single one.

`defaultWiderRegionForNewNation()` selects that list, and still only on an empty control.

### 5.4 The save (`assets/js/extending.js`, `assets/js/NationalCalendarPayload.js`)

- `buildNationalCalendarPayload()` sends `metadata.wider_regions`: the selected options in option order, which is already
  broadest first. It no longer sends `wider_region`.
- `NationalCalendarPayload` requires `metadata.wider_regions` to be an array of unique strings, each matching the API's
  name shape `^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$`, possibly empty. The hard-coded five-name list is removed: whether a
  region exists and lists the nation is the API's check (422).

### 5.5 Edit rights (`assets/js/widerRegionEditRights.js`, `extending.js`)

- `WiderRegionMembership.declaredRegion` (nation → string) becomes `declaredRegions` (nation → string[]), built with
  `nationWiderRegions()`.
- `WiderRegionMembership.members` comes from the region's `roster` in `/calendars` when published, instead of only from
  the loaded region file. The module's caveat that the page cannot see other regions' member lists then no longer holds,
  and is rewritten to say when it still applies (an API without `roster`).
- `nationMayJoinWiderRegion(nation, region, membership)` keeps its rule, with lists: the nation is on the region's roster,
  or it declares no region, or its declared regions include this one.

## 6. Compatibility and sequencing

- Reading tolerates both API shapes (section 5.1), so the page keeps loading calendars on an API without #1005.
- Saving does not: today's API requires `metadata.wider_region` and rejects unknown metadata properties, so a payload
  with `wider_regions` is refused. The frontend PR therefore merges only after LiturgicalCalendarAPI#1005 is in the API's
  `development` branch, and deploys after the API. The frontend's E2E job builds the API from `development`, so its E2E
  run cannot pass before that either.
- Once this ships, together with the component-library follow-ups, the API can drop the deprecated `wider_region`.

## 7. Testing

- **Unit (vitest):**
    - `widerRegions.js`: `nationWiderRegions()` for the new, legacy and missing shapes; `orderWiderRegions()` by roster size
      and name; `eligibleWiderRegions()` with rosters, without, and with a declared region the roster lacks.
    - `widerRegionsForNation()`: from rosters, several matches; the locale-subtag fallback.
    - `NationalCalendarPayload`: accepts an empty list and several names; rejects a string, duplicates, and a malformed
      name.
    - `widerRegionEditRights.js`: a nation in two regions may write locales to both; a nation declaring only another
      region may not.
- **E2E (Playwright):**
    - "should default the wider region of a new national calendar" becomes "…wider regions…": Ireland (on Europe's roster)
      starts with Europe selected; Australia, on no roster, with none.
    - The national calendar UPDATE test asserts `metadata.wider_regions` in the captured payload, equal to the stored
      list, and no `wider_region`.
    - A nation in two regions needs a second region that lists it in the test data. None exists yet, so multi-region
      behaviour is covered by unit tests until one does.

## 8. Follow-ups

- **liturgy-components-js:** `typedefs.js` gains `wider_regions` on the national calendar item and `roster` and
  `national_calendars` on the region item; a note says the nation-level `wider_regions` (names) is not the top-level
  `wider_regions` (region objects).
- **liturgy-components-php:** `Models/Index/NationalCalendar.php` and `WiderRegion.php` gain the same fields.
- **Frontend #66:** the region → nation breadcrumb, using `roster`.

## 9. Risks

- **The API contract moves during its review.** The `/calendars` fields are not yet committed on the API branch. The
  helpers in section 5.1 isolate the field names, so a rename touches one module.
- **A stored membership the roster no longer lists** makes every save of that calendar fail with 422 until a curator
  deselects it. The control keeps it visible (section 5.2) so the error names something the curator can see and fix.
