# Prospective wider regions: pickers and extending chooser

- **Issues:** #591 (permission pickers hard-code the five continental wider regions), part of #66 (predefined lists of
  wider regions, nations, dioceses)
- **Depends on:** LiturgicalCalendarAPI #1007 (merged): wider region names are a shape rule, `/calendars` publishes
  each region's `roster` and `national_calendars`
- **Branch:** `feat/prospective-wider-regions` → `development`

## Goal

Every place in the frontend that lets a user choose a wider region offers exactly:

1. the wider regions that **exist** (from `/calendars` `litcal_metadata.wider_regions`), and
2. the **prospective** wider regions that do not exist yet, taken from a curated list grounded in the Notitiae survey
   (the #66 comment "What the Notitiae survey says about wider regions"),

told apart, so that an admin can be granted or can request rights on a region before creating it, and can then create
it with its member nations pre-filled. The five hard-coded continents (`Americas`, `Europe`, `Asia`, `Africa`,
`Oceania`) disappear from the code.

## Out of scope

- The region → nation → diocese breadcrumb navigation that replaces the three sidebar entries (#66 proper). It gets its
  own spec and builds on the data introduced here.
- An API route to rename an existing wider region (to be filed separately in the API repo).
- The East Indies region (API #1006): its members are not settled.
- Existing regions' `PATCH` payload: `buildWiderRegionPayload` rebuilds `national_calendars` from the selected locales
  only, so a member nation with no locale in the list is dropped on save. Recorded here, not changed.
- Localizing region names. They stay proper nouns, as today.

## Part 1: prospective-region data

### `assets/data/ProspectiveWiderRegions.json`

Hand-curated. Shape:

```json
{
    "wider_regions": [
        {
            "name": "Nordic",
            "description": "Nordic Episcopal Conference",
            "roster": ["DK", "SE", "NO", "FI", "IS"],
            "locales": ["da_DK", "sv_SE", "nb_NO", "fi_FI", "is_IS"],
            "sources": ["N2012-…"],
            "note": null
        }
    ]
}
```

- `name` must match the API's `WiderRegionName` rule `^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$`.
- `roster` holds ISO 3166-1 alpha-2 codes, the nations eligible to join the region.
- `locales` holds the suggested locales pre-selected when the region is created. Only locales the frontend offers
  (`$SystemLocalesWithRegion`) have any effect; others are ignored at runtime.
- `sources` holds Notitiae register entry ids (`LiturgicalCalendarAPI/docs/decrees/notitiae-register.json`, field
  `id`) that attest the grouping's shared calendar.
- `note` is free text for caveats, or `null`.

Entries (the groupings of three or more nations from the survey; two-nation conferences, historical Yugoslavia and the
Latin Patriarchate of Jerusalem are deliberately left out):

| `name`                                      | `description`                                                             | `roster`       |
| ------------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| Nordic                                      | Nordic Episcopal Conference                                               | DK SE NO FI IS |
| Southern Africa                             | Southern African Catholic Bishops' Conference                             | ZA BW SZ       |
| North Africa                                | Regional Episcopal Conference of North Africa                             | DZ TN MA LY    |
| Senegal Mauritania Cabo Verde Guinea Bissau | Episcopal Conference of Senegal, Mauritania, Cabo Verde and Guinea-Bissau | SN MR CV GW    |
| Malaysia Singapore Brunei                   | Catholic Bishops' Conference of Malaysia, Singapore and Brunei            | MY SG BN       |
| German Language Area                        | Regionalkalender für das deutsche Sprachgebiet                            | DE AT CH LU    |

German Language Area carries a `note`: the diocese of Bolzano-Bressanone (IT) follows the regional calendar, but a
roster can only list whole nations.

The `sources` ids are looked up in the register during implementation (the survey rows in the #66 comment give the
counts per grouping). The names can change freely until a region is created.

### `src/ProspectiveWiderRegions.php`

Modelled on `src/CatholicNations.php`:

- `ProspectiveWiderRegions::all(string $source = self::DEFAULT_SOURCE): array` returns the entries as
  `list<array{name: string, description: string, roster: list<string>, locales: list<string>}>`, sorted by `name`.
- An entry is dropped (not fatal) when its `name` fails the shape rule, its `roster` is empty, or any roster code is not
  `^[A-Z]{2}$`. `description` defaults to `''`, `locales` to `[]`. `sources` and `note` are not passed to the browser.
- An unreadable file or a missing `wider_regions` array throws `\RuntimeException`, as `CatholicNations` does.

## Part 2: permission pickers (#591)

### `assets/js/prospectiveWiderRegions.js`

Pure helpers, shared by the pickers and the extending page:

- `WIDER_REGION_NAME_PATTERN`: the shape rule. `NationalCalendarPayload.js` imports it instead of keeping its own regex.
- `isValidWiderRegionName(name)`.
- `findProspectiveRegion(prospective, name)`: the entry, or `undefined`.
- `rosterToNationalCalendars(roster)`: `{ "English name": "CODE" }`, the map the API expects, named with
  `Intl.DisplayNames(['en'], { type: 'region' })` (falling back to the code).

### `assets/js/widerRegionObjectIdSelect.js`

Mirrors `nationObjectIdSelect.js`:

- `buildWiderRegionObjectIdSelect({ prospective, existing, locale, className, id, i18n })` returns a required
  `<select>` with a disabled placeholder and two `<optgroup>`s:
    - **Existing wider regions:** `existing` (the region objects from `litcal_metadata.wider_regions`), sorted with
      `Intl.Collator(locale)`, labelled with the name and the region's `roster` (falling back to `national_calendars`).
    - **New wider regions (not yet created):** the prospective entries whose `name` is not among the existing names.
- Option value is the bare region name, so `qualifyObjectId()` and restoring a saved grant behave as today.
- Option label: `Nordic (DK, SE, NO, FI, IS)`; the `description`, when present, goes in the option's `title`.
- When `existing` is `null` (metadata failed to load), the prospective entries are listed without groups, as the nation
  picker does.
- `buildWiderRegionObjectIdSelectFromConfig(config, client, { locale, className, id })` reads
  `config.prospectiveWiderRegions`, `client?._metadata?.wider_regions ?? null` and the labels from `config.i18n`.

### Page wiring

- `assets/js/admin-permissions.js` and `assets/js/permission-requests.js`: delete `WIDER_REGIONS`; the `wider_region`
  branch of `buildStaticGrantObjectId()` / `buildStaticObjectIdSelect()` mounts the new select (using
  `mount.replaceChildren`, as `mountNationObjectIdSelect` does).
- `admin-permissions.php` and `permission-requests.php`: inject `prospectiveWiderRegions` into the page config and two
  translatable labels, `existingWiderRegions` ("Existing wider regions") and `newWiderRegions` ("New wider regions (not
  yet created)").

## Part 3: extending page wider-region chooser

- **Datalist** (`extending.php`, `#WiderRegionsList`): keeps the `{name} - {locale}` options of existing regions and
  adds one option per prospective region not yet created, value `{name}`, label `{name} ({roster}) — not yet created`
  (translatable suffix). The page gets `ProspectiveWiderRegions` as a JS global declared in `eslint.config.mjs`.
- **Key validation** (`extending.js`, the `API` proxy's `key` case): the hard-coded continent check is replaced by
  `isValidWiderRegionName()`. A valid name missing from `LitCalMetadata.wider_regions_keys` sets `method = 'PUT'`, as
  the `nation` branch does. An invalid name logs an error and is rejected, as today.
- **Pre-fill on create** (`fetchRegionalCalendarData`, the "does not exist yet" branch for `widerregion`): when the
  name is a prospective region, select its suggested `locales` in `#widerRegionLocales` (the ones the select offers),
  rebuild the current-localization choices from them, and seed `loadedWiderRegionMembers` with its `roster`, so the
  edit-rights membership check sees the region's nations before it exists.
- **Payload** (`buildWiderRegionPayload`): when `API.method === 'PUT'` and the name is a prospective region,
  `national_calendars` is the union of `rosterToNationalCalendars(roster)` and the locale-derived map. Otherwise
  unchanged.

## Part 4: tests and docs

- **PHPUnit** `tests/ProspectiveWiderRegionsTest.php`: the shipped file loads and every entry passes; entries with a
  bad name, an empty roster or a malformed code are dropped; an unreadable file and a file without `wider_regions`
  throw.
- **E2E**
    - `e2e/constants.ts`: `VALID_WIDER_REGIONS` and `WiderRegion` are replaced by `WIDER_REGION_NAME_PATTERN`.
    - `e2e/wider-region-calendar.spec.ts`: the create test takes the first prospective region (read from
      `assets/data/ProspectiveWiderRegions.json`) that `wider_regions_keys` does not list, falling back to a generated
      pattern-valid name; it asserts the roster nations are in the captured payload's `national_calendars`. The saved-name
      assertion checks the pattern.
    - A picker spec (in the existing permission-requests suite): the `wider_region` scope shows both groups, lists every
      existing region, does not list `Africa`/`Oceania` unless they exist, and never lists a region in both groups.
- **Docs:** CLAUDE.md "Calendar Schema Differences" drops the five-continent sentence in favour of the shape rule and a
  pointer to `assets/data/ProspectiveWiderRegions.json`.

## Risks

- A prospective name, once created, is fixed until the API can rename regions.
- `Intl.DisplayNames` English names must match the API's expectations for `national_calendars` keys; the extending page
  already relies on this.
