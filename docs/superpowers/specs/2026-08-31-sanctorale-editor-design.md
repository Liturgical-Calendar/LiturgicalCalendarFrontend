# Sanctorale Editor — Design

Replaces the missals editor (frontend issue #503) with a rite-aware sanctorale browser and, once the
API catches up, an editor that treats structure, translations and lectionary readings as one subject.

Status: design approved, phase 1 not yet implemented.

## Problem

`assets/js/missals-editor.js` issues `PUT` requests to routes the API documents as `GET`-only, so its
405 branch is the only branch that ever runs and its success branch is unreachable. That is the filed
symptom. The underlying problem is larger: the page presents each Roman Missal as a flat table of rows,
which is neither what a missal is nor what anyone needs to edit.

Two facts drive this redesign.

**A missal file is a delta, not a sanctorale.** Measured against the current source data:

| Missal                      | Events | New vs 1970 | Shared with 1970 |
| --------------------------- | -----: | ----------: | ---------------: |
| `propriumdesanctis_1970`    |    187 |           — |                — |
| `propriumdesanctis_2002`    |     19 |          19 |                0 |
| `propriumdesanctis_2008`    |      3 |           3 |                0 |
| `propriumdesanctis_IT_1983` |      8 |           8 |                0 |
| `propriumdesanctis_US_2011` |     14 |          13 |                1 |

"The 2008 Missal" is a three-row file. A per-missal table can only ever show an increment, never a
sanctorale, which is why the current page is confusing in a way no amount of polish fixes.

**An event is three co-located files joined on `event_key`.** For the 1970 missal the join is total —
187 structure rows, 187 i18n keys, and a sanctorale lectionary covering all 187 with zero missing. The
name "sanctorale editor" is therefore not a rename; the directories are literally `propriumdesanctis_*`
and the join already exists in the data.

## What the data actually is

```text
rite/{roman,ambrosian}/
  missals/{missal}/{missal}.json          structure: month, day, event_key, grade, common, calendar, color
  missals/{missal}/i18n/{locale}.json     one name per event_key      (14 locales for 1970)
  missals/{missal}/lectionary/{locale}.json   per-missal readings     (national missals ONLY)
  lectionary/sanctorum/{locale}.json      rite-level readings          (6 locales: en fr hr it la nl)
```

Four properties of this layout constrain the design:

- **The lectionary has two tiers.** Rite-level `sanctorum/` applies to everything; a per-missal
  `lectionary/` directory exists only for the two national missals (`IT_1983`, `US_2011`).
  `RomanMissal::$lectionaryPath` maps exactly those two. Editio typica missals carry no readings of
  their own, and `CalendarHandler.php:1631` records that Latin missals have none at all.
- **Locale coverage is asymmetric.** 14 name locales against 6 reading locales. "Has a name, has no
  readings" is a normal state and must render as one, not as an error.
- **Empty is not absent.** `propriumdesanctis_US_2011/lectionary/en_US.json` carries `StIsidore` with
  all four reading fields as `""`. That placeholder convention is deliberate: it keeps the locale files
  a complete, diffable inventory of what still needs translating. The UI must distinguish "curated as
  empty" from "no entry here".
- **Ambrosian has no lectionary at all** (`CalendarHandler.php:1056`), and its sanctorale file is
  `propriumdesanctis.json` inside a `propriumdesanctis_2024/` directory, breaking the
  `{dir}/{dir}.json` convention every Roman missal follows (API issue #940).

## Decisions

1. **A new page, `sanctorale.php`, alongside `missals-editor.php`.** The old page is retired only once
   the new one is at parity. Until then it keeps working for whoever depends on it.
2. **Composition is scoped by rite + calendar.** The user picks a rite and a calendar (General Roman,
   or a nation/diocese), and sees the sanctorale that actually applies there. This is why the
   `StIsidore` collision never surfaces as a contradiction: the two entries live in different calendar
   scopes and are never composed together.
3. **The detail view is `event_key`-centric.** Every layer defining the key, every name locale, every
   reading locale, in one panel. This matches the data's own join and is the shape the eventual
   create-a-new-key workflow needs.
4. **Model on `admin-decrees.php`, not on a fresh design.** That page already solves this exact problem
   for the sibling resource, down to per-locale translation and readings panels.

## Scope and non-goals

In scope: browsing the composed sanctorale, inspecting one event across all its locales, and — once the
API allows — editing structure, names and readings.

Not in scope: the temporale (`propriumdetempore`), the decrees interface (already exists), lectionary
cycles other than `sanctorum`, and any change to how the API composes calendars.

## Architecture and conventions

The page follows the existing admin-page shape: a PHP entry point for gating and markup, an ES module
under `assets/js/`, and shared partials under `includes/`.

```text
sanctorale.php                       gating + markup shell
assets/js/sanctorale.js              page controller
assets/js/sanctorale-compose.js      layer composition, pure, unit-testable
assets/js/sanctorale-locales.js      per-locale probe + cache (modelled on admin-decrees.js)
includes/sanctorale-i18n.php         translatable strings
```

Composition is a **pure function** in its own module so it can be unit-tested without a DOM or a
network: given the rite, the calendar, and the set of missal deltas, it returns the composed event list
with each row's originating layer. That boundary is the single most valuable one here — the layering
rules are where the subtlety lives, and they should be testable in isolation.

### Selection: the `CalendarResourcePicker` exception

The obvious move is the `CalendarResourcePicker` meta-component. It does not fit. It rejects
`CalendarSelectFilter.NONE` and turns the empty option into a **disabled placeholder**, but this page
needs a **selectable** empty option meaning "the rite-level calendar" — exactly the exception already
documented for `assets/js/usage.js` and raised upstream as liturgy-components-js#42.

So this page hand-wires `RiteSelect` + `CalendarSelect`, and must use **both** wires:

```javascript
calendarSelect.linkToRiteSelect(riteSelect);
apiClient.listenTo(riteSelect);
```

Wiring only the first fails **silently**: the form reads `ambrosian` while every request still goes to
`/calendar/roman/`. This is the documented trap the meta-components exist to prevent, and skipping the
second line is the single most likely way to get this page subtly wrong.

### Locale handling — probe, don't wait

`admin-decrees.js` already handles a single-locale API: `fetchEventForLocale()` issues one request per
locale with an `Accept-Language` header, results are cached as per-locale promises that evict on
failure, and `probeLocaleMaps()` assembles `{i18n, readings}` in parallel — used as a fallback whenever
the API returns no aggregated maps.

The sanctorale reuses that pattern verbatim for **names**, which means API issue #941 (all-locales i18n)
is an **optimization, not a blocker**: names can be assembled today by probing
`GET /missals/{missal_id}` once per locale. Panels load lazily on first expand, as decrees does.

Readings cannot be probed, because no route returns them in any locale. That is the one hard blocker.

## API contract dependencies

| Issue | Route                              | Blocks      | Notes                                                |
| ----- | ---------------------------------- | ----------- | ---------------------------------------------------- |
| #941  | all-locales i18n for a missal      | nothing     | optimization — probing works today                   |
| #942  | `GET` sanctorale lectionary        | **phase 3** | hard blocker; no readings are readable in any locale |
| #943  | `PUT`/`PATCH /missals/{missal_id}` | **phase 4** | must route through the `SourceDataWriter` seam       |
| #939  | `StIsidore` collision              | nothing     | surfaced by the UI; fix is data, not code            |
| #940  | Ambrosian filename convention      | nothing     | enumerator must not assume `{dir}/{dir}.json`        |

All three route issues are specified to mirror `DecreesHandler`, which already enforces the invariants
this data needs — notably `DecreesHandler.php:762` rejecting `event_key` changes because they orphan
i18n and lectionary entries permanently, and `:837` garbage-collecting keys across every locale file.

## Phasing

1. **Unblocked now.** Guard the unguarded `response.json()` at `missals-editor.js:760` so an empty body
   is not reported as a failed save, and stop the Save button from claiming an outcome it cannot reach.
   This is issue #503 item 3 and is worth doing regardless of everything below.
2. **Unblocked now.** `sanctorale.php` with the composed browser: rite + calendar selection, the
   composed event list with layer provenance, and the `event_key` detail view showing structure and all
   names via per-locale probing. No readings.
3. **After #942.** The readings panel, both tiers, with the tier that answered made explicit.
4. **After #943.** Editing: structure, names, readings; creating a key writes it into **every** locale
   file including empty ones; queued writes report `disposition` through the shared helper from #501
   rather than a second implementation.

## Error handling

- **Ambrosian readings**: the panel renders "not available for this rite", never an error and never an
  empty state indistinguishable from "nothing curated".
- **A missing locale file** is distinct from **a key absent from a present file**, which is distinct
  from **a key present with empty values**. Three states, three renderings.
- **Probe failures degrade per locale.** One locale failing to load must not blank the panel; the cache
  evicts that entry so a retry is possible, exactly as `admin-decrees.js` does.
- **Composition with no layers** (a calendar with nothing of its own) shows the inherited sanctorale,
  not an empty table.

## Testing

Unit (vitest), which is where the value is concentrated:

- composition: additive layers, the override case, and layer provenance per row
- the three locale states above, for both names and readings
- the two lectionary tiers, including which tier answered
- Ambrosian degradation

E2E (Playwright): rite switching actually repartitions the calendar list **and** redirects requests —
the assertion that catches the missing `apiClient.listenTo(riteSelect)` wire, which no unit test can.

## Out of scope

Editing the temporale; migrating `admin-decrees.php` onto shared modules extracted from this work
(worth doing later, not now); and any change to `missals-editor.php` beyond phase 1's honesty fixes.

## Decisions log

- **Composed view over per-missal view** — a per-missal table cannot show a sanctorale, which is the
  thing users actually want to see.
- **Rite + calendar over a missal stack** — national missals do not sit on a single timeline, so a
  stack is ambiguous for exactly the missals most likely to be edited.
- **New page over in-place rewrite** — lets the old editor keep working, and avoids a big-bang cutover
  on a page whose write path has never worked.
- **Probe locales rather than wait for #941** — the decrees page proves the pattern, and it moves the
  read-only phase from blocked to shippable.
