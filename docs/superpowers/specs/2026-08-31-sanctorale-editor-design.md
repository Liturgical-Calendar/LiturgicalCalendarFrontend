# Sanctorale Editor — Design

Replaces the missals editor (frontend issue #503) with a rite-aware sanctorale browser and, once the
API catches up, an editor that treats structure, translations and lectionary readings as one subject.

Status: phases 1-3 implemented (the read-only viewer). Phase 4, editing, is not started.

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
5. **Entries are grouped by month, one tab per month, day-ordered within.** The month is the group
   title. See "Layout — month grouping" below for the three constraints this imposes.

## Scope and non-goals

In scope: browsing the composed sanctorale, inspecting one event across all its locales, and — once the
API allows — editing structure, names and readings.

Not in scope: the temporale (`propriumdetempore`), the decrees interface (already exists), lectionary
cycles other than `sanctorum`, and any change to how the API composes calendars.

## Architecture and conventions

The page follows the existing admin-page shape: a PHP entry point for gating and markup, an ES module
under `assets/js/`, and shared partials under `includes/`.

```text
sanctorale.php             markup shell + window.SanctoraleConfig (translatable strings)
assets/js/sanctorale.js    the page, loaded as a module by layout/footer.php's same-name convention
```

**Shipped as two files, not five.** The design first split composition and locale handling into their
own modules. Composition stayed worth isolating and did — but as _exported pure functions_
(`baseRegionFor`, `applicableMissals`, `compose`, `rowsFor`, `monthsWithHits`) rather than a separate
file, with the bootstrap guarded so the module imports cleanly under vitest. That buys the same
testability without a module boundary that nothing else crosses.

The other two never earned their existence. `sanctorale-locales.js` was to hold a per-locale probe that
Issue #941 made unnecessary (see below), and `includes/sanctorale-i18n.php` would have split the translatable
strings away from the page that declares them, which no sibling admin page does — they live in the
`window.SanctoraleConfig` block, as `admin-decrees.php` and `admin-locales.php` do.

### Selection: the `CalendarResourcePicker` exception

The obvious move is the `CalendarResourcePicker` meta-component. It does not fit. It rejects
`CalendarSelectFilter.NONE` and turns the empty option into a **disabled placeholder**, but this page
needs a **selectable** empty option meaning "the rite-level calendar" — exactly the exception already
documented for `assets/js/usage.js` and raised upstream as liturgy-components-js#42.

**What shipped instead: plain selectors driven by the catalogue itself.** The only calendars that
change the composed output are the `region` values `/missals/{rite}` already names — `VA`, `IT`, `US`
for the Roman rite — so a `CalendarSelect` would list about a hundred entries of which two alter
anything. The **scoping decision is unchanged**: composition is still by rite and calendar. Only the
widget is plainer.

Issue #953 has since landed, so both rites now resolve: `/missals/{rite}` is the catalogue and the Ambrosian
edition is reachable. Its region is `AMBROSIAN` rather than a nation code, which is why the base region
is resolved per rite (`baseRegionFor`) instead of being the constant `VA` the first draft assumed — a
rite whose catalogue holds a single region is entirely base, which covers Ambrosian without a special
case. Should this be revisited in favour of the components, the wiring below is the trap to avoid:

```javascript
calendarSelect.linkToRiteSelect(riteSelect);
apiClient.listenTo(riteSelect);
```

Wiring only the first fails **silently**: the form reads `ambrosian` while every request still goes to
`/calendar/roman/`. This is the documented trap the meta-components exist to prevent.

Note the second wire is about `ApiClient` redirection. The viewer issues its own `fetch` calls and uses
no `ApiClient`, so even under the component route it would need the rite as a value, not as a redirect —
which is a further reason the plain selector costs nothing here.

### Layout — month grouping

Entries are grouped by month, with the month as each group's title, ordered by day within the group.
The primary navigation is **one tab per month**.

Tabs suit the composed view specifically: a composed sanctorale has all twelve months populated (187
events across 12 months for the General Roman calendar, roughly 15 per tab, which is a comfortable
page). It is only the raw delta files that are sparse, and those are never the primary view.

Three constraints follow, and none of them are optional:

- **Search must span every month.** Tabs hide eleven twelfths of the data from the browser's own find.
  The page needs a search that matches across all months and switches to the tab holding the hit.
  Without it, tabs are a downgrade on the flat table they replace.
- **Each tab carries a count badge.** A month with three entries then reads as "3", not as a broken
  page — which matters most in exactly the sparse cases the composed view is meant to smooth over.
- **Month is stable within this editor, and grouping uses the sanctorale's own month/day.** An earlier
  draft of this design claimed grouping had to use a composed effective date because a national calendar
  can move an event. That was wrong, and the error is worth recording: `moveEvent` lives in the national
  calendar file and is edited by a different page. The sanctorale is fixed-date by construction. The only
  case that moves a row between tabs is a curator **correcting the date in the missal itself**, which is
  an ordinary edit — but the UI must still follow the row to its new tab rather than leaving the user on
  the tab it just left.

Month names are localized with `Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })` —
`timeZone: 'UTC'` per the project-wide rule, since omitting it is how off-by-one date bugs enter.
`AssertionsBuilder.js:161` is the existing precedent for this call in the repo.

Tab state belongs in the URL fragment alongside the event anchor, so a link can address a specific
event and land on the right tab.

### Locale handling — one request per missal

**Superseded.** This section originally specified probing one locale at a time with an `Accept-Language`
header, the way `admin-decrees.js` does when the API returns no aggregated maps, and argued that this
made #941 an optimisation rather than a blocker. The reasoning was sound for the API as it stood.

Issue #941 then shipped something better: `GET /missals/{rite}/{missal_id}/i18n` returns every locale in one
response **plus a precomputed `coverage` map**, giving `translated` / `empty` / `missing` per event key.
So the page issues one request per missal, caches it per rite and missal, and reads all three states off
`coverage` rather than inferring them. No probing, no fan-out, and the distinction between a
deliberately blank translation and an absent one comes from the server instead of being guessed at.

The probe remains the right fallback pattern for any resource that has no aggregated route, which is
what `admin-decrees.js` still faces.

## Relationship to the national calendar editor

The sanctorale and the national calendar are separate resources edited by separate pages, and they
should stay that way. The reason is not convention; the two files have genuinely different data models.

```jsonc
// missals/propriumdesanctis_US_2011/…   — a fixed-date declaration
{ "month": 5, "day": 15, "event_key": "StIsidore", "grade": 2, "common": [...] }

// calendars/nations/US/US.json          — a computed event with no date at all
{ "liturgical_event": { "event_key": "ThanksgivingDay", "grade": 3,
                        "strtotime": "fourth thursday of november" },
  "metadata": { "action": "createNew", "since_year": 1970 } }

// calendars/nations/US/US.json          — an operation over the sanctorale
{ "liturgical_event": { "event_key": "StVincentDeacon", "day": 23, "month": 1 },
  "metadata": { "action": "moveEvent", "missal": "US_2011",
                "reason": "National Day of Prayer for the Unborn", "since_year": 2011 } }
```

`ThanksgivingDay` cannot be expressed in the sanctorale schema — it has no month or day. And every
`moveEvent` carries `missal: "US_2011"`, pointing back **at** the sanctorale: the national calendar file
is a layer of operations over the sanctorale, not a parallel store of events. `US.json` holds 8 entries
in total (`moveEvent` ×4, `createNew` ×2, `makePatron` ×1, `setProperty` ×1) against the US_2011
sanctorale's 14, and the two sets do not overlap.

Two consequences:

- **A merged national schema is rejected.** It would have to hold three incompatible shapes in one
  array — fixed-date declarations, `strtotime` computed events, and operations carrying `reason` and
  `since_year` — and it would destroy the property that makes the sanctorale groupable by month.
- **The editors should be linked, not merged.** A curator working on a national calendar today must
  visit two pages with no signpost between them. The sanctorale view should annotate entries that a
  national calendar moves or overrides — read-only, with a link to the national calendar editor — so the
  separation stays honest without the sanctorale silently disagreeing with the calendar it feeds.

Note the action is spelled **`moveEvent`**. `moveFeast` appears nowhere in the API source and only in
frontend prose; the full action set is `setProperty`, `createNew`, `createNewFromExisting`, `moveEvent`,
`makeDoctor`, `makePatron` (`assets/js/FormControls.js:87`).

## API contract dependencies

| Issue | Route                                        | State      | Notes                                                  |
| ----- | -------------------------------------------- | ---------- | ------------------------------------------------------ |
| #941  | `GET /missals/{id}/i18n`                     | **merged** | returns every locale plus a precomputed `coverage` map |
| #942  | `GET /lectionary/{rite}/sanctorale`          | **merged** | rite-scoped; carries `lectionary_available`            |
| #943  | `PUT/PATCH/DELETE /missals/{id}/{event_key}` | **merged** | phase 4 only; not used by the viewer                   |
| #953  | `/missals` is Roman-only                     | open       | the Ambrosian sanctorale on disk is unreachable        |
| #939  | `StIsidore` collision                        | open       | surfaced by the viewer's override badge                |
| #940  | Ambrosian filename convention                | open       | blocks #953's enumerator                               |

All three route issues are specified to mirror `DecreesHandler`, which already enforces the invariants
this data needs — notably `DecreesHandler.php:762` rejecting `event_key` changes because they orphan
i18n and lectionary entries permanently, and `:837` garbage-collecting keys across every locale file.

## Phasing

1. **Unblocked now.** Guard the unguarded `response.json()` at `missals-editor.js:760` so an empty body
   is not reported as a failed save, and stop the Save button from claiming an outcome it cannot reach.
   This is issue #503 item 3 and is worth doing regardless of everything below.
2. **Done.** `sanctorale.php` with the composed browser: rite + calendar selection, the
   composed event list with layer provenance, and the `event_key` detail view showing structure and all
   names via per-locale probing. No readings.
3. **Done.** The readings panel, both tiers, with the tier that answered made explicit.
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
- month grouping: day ordering within a month, and a date correction moving a row to another tab

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
- **Month tabs over a single scrolling list** — the composed view is uniformly populated, so tabs give
  a comfortable page size; accepted only because cross-month search and per-tab counts remove the two
  things that would otherwise make tabs worse than the flat table.
- **Plain selectors over components-js pickers** — the scoping stayed rite + calendar; only the widget
  changed, because `/missals` is Roman-only and just two of ~100 calendars alter the composition.
- **`/missals/{id}/i18n` replaced the per-locale probe entirely** — #941 shipped a `coverage` map
  (`translated` / `empty` / `missing` per event), so the decrees-style probing the design planned for
  is not needed: one request per missal returns every locale and all three states precomputed.
- ~~**Probe locales rather than wait for #941**~~ — **superseded.** #941 shipped an aggregated route
  with a `coverage` map, so one request per missal replaced the fan-out entirely.
