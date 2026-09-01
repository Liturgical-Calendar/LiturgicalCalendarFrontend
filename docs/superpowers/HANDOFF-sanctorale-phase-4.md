# Sanctorale editor — handoff for phase 4 (editing)

> **Status: superseded — this is a PRE-IMPLEMENTATION handoff, kept as a historical record.**
>
> Phase 4 shipped in PR #523. `missals-editor.php` is retired, and BOTH the admin dashboard card's
> **View** and **Edit** buttons now route to `sanctorale.php` (`includes/admin-blocks.php`).
>
> Everything below records what was known _before_ phase 4 was built, including its open questions.
> Read any statement describing the current state — the file table, the retirement question, the
> dashboard card's Edit target — as a description of the pre-phase-4 world, not of the code today.
> It is deliberately NOT rewritten: what the implementer did not yet know is the point of the document.

Phases 1–3 shipped in PR #512 (merged 2026-09-01). Issue #503 stays **open** for this phase.

Design: `docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md`. Read it first — this document
covers only what a phase-4 implementer needs that the design does not already say, plus what changed
while phases 1–3 were built.

## What exists now

| File                                     | Lines | What it is                                                                         |
| ---------------------------------------- | ----: | ---------------------------------------------------------------------------------- |
| `sanctorale.php`                         |   209 | Markup shell, auth gate, and `window.SanctoraleConfig` (every translatable string) |
| `assets/js/sanctorale.js`                |   910 | The page, auto-loaded as a module by `layout/footer.php`                           |
| `assets/js/__tests__/sanctorale.test.js` |   392 | 53 tests over the exported pure functions                                          |

A read-only viewer: rite + calendar + language selection, the composed sanctorale grouped into month
tabs with counts, cross-month search, a "From" filter over contributing editions, and a detail modal
showing structure, every name locale, and readings tier by tier with schema tabs.

Reachable from the admin dashboard card's **View** button and the sidebar's **Sanctorale** entry. The
card's **Edit** button still points at `missals-editor.php`, which is what phase 4 replaces.

## The write surface

```text
PUT    /missals/{rite}/{missal_id}/{event_key}   create      201
PATCH  /missals/{rite}/{missal_id}/{event_key}   update      200
DELETE /missals/{rite}/{missal_id}/{event_key}   remove      200
```

`MissalWritePayload` (`jsondata/schemas/LitCalMissalWritePayload.json`), `additionalProperties: false`,
nothing required at the top level so `PATCH` can be partial:

```text
event_key  month  day  grade  grade_display  common  calendar  color
color_ad_libitum  is_dominical  is_bvm  i18n  readings
```

`i18n` is `{locale: string}` with `minProperties: 1`. `readings` is per locale, and the API decides the
tier: a national edition's own lectionary folder when it has one, the rite-level `sanctorum` corpus when
it does not — the same tiers `GET /lectionary/{rite}/sanctorale` reports back.

## Traps, in the order you will hit them

**Writes are credentialed; reads are not.** The viewer fetches with `credentials: 'omit'` because the
`/missals` and `/lectionary` reads are public and answer with a wildcard CORS header, which a browser
refuses to pair with credentials. The write routes set `allowCredentials = true` and echo the validated
origin, so they need `credentials: 'include'`. `getJson()` as it stands is the read helper; do not simply
reuse it for writes.

**Every write can be queued rather than applied.** `MissalsHandler` uses the `WritesSourceData` concern,
so a response may carry `disposition: "submitted"` and no file has changed. Use `describeWriteOutcome()`
from `assets/js/writeDisposition.js` — already imported by `admin-tests.js`, `admin-decrees.js` and
`extending.js` — and never mutate local state on anything but `applied`. Reporting a queued write as
saved is the bug #501 fixed everywhere else, and this page is currently the only editor that has never
had to think about it.

**An empty string is data, not absence.** This bites in three separate places:

- `i18n` — `""` records "this key exists but is not translated yet", which is what keeps every locale
  file a complete, diffable inventory. The schema documents this explicitly.
- `grade_display` — `""` is an authored override meaning "show no rank at all" (`AllSouls`), distinct
  from `null` meaning "no override". `gradeDisplayOf()` already models the three states; a write must
  preserve them, and the payload types the field `string | null` for exactly this reason.
- readings — a blank citation is curated-as-blank, distinct from a missing key. `AllSouls` carries three
  schemata whose every field is `""`.

Collapsing any of these into "empty" writes `null` over a decision somebody made.

**Creating a key must reach every locale file.** The design's original invariant. Check whether the API
now fans this out itself — the payload takes a whole `i18n` map, which suggests it does — before building
client-side fan-out that duplicates it.

**`event_key` is immutable.** `DecreesHandler:762` records why for the sibling resource: renaming orphans
the i18n and lectionary entries permanently. Expect the same rule here; do not offer a rename.

## Decisions phases 1–3 made that phase 4 inherits

- **A missal file is a delta.** Editing an entry means editing it _in one edition_. The row's
  `_missalId` says which, and the "From" filter exists so a curator can see one edition's contribution
  in isolation. An edit UI that hides which layer it is writing to will be wrong.
- **Later editions override earlier ones on the same `event_key`.** `US_2011` redefines `StIsidore`.
  Editing the composed row must write to the edition that _won_, not the one that first defined it.
- **The sanctorale and the national calendar stay separate.** `moveEvent`, `createNewFromExisting` and
  mobile events (`strtotime`) belong to the national calendar editor. Do not grow them here; the spec
  argues the case at length.
- **Plain selectors, not components-js pickers**, and the reasons are recorded in the spec's decision log.

## Reusable surface

`assets/js/sanctorale.js` exports these as pure functions, all unit-tested, all safe to import:

```text
toBcp47  localesFor  preferredLocale  formatGrade  gradeDisplayOf
hasNestedSchemas  schemaKeysOf  baseRegionFor  applicableMissals
compose  filterByMissal  rowsFor  monthsWithHits  renderReadingsOutcome  HttpError
```

The module's bootstrap is guarded (`if (dom.tableBody && dom.tabs)`) so importing it under vitest runs
nothing. Keep that property.

## Verification that worked

The pure functions are unit-testable and were tested. Everything else — the bootstrap, the loaders, the
hash handling, the render pipeline — is not, and was verified by driving a real browser with the repo's
own Playwright against the live local stack, reusing `e2e/.auth/user.json` (refresh it with
`yarn playwright test --project=setup`; the states expire).

That is how five defects were found that no linter or unit test would have caught: deep links silently
doing nothing, a hash that described a pre-normalisation selection, stale rite data surviving a failed
load, `[object Object]` where readings nest, and the Assumption carrying the wrong readings entirely.
**Budget for browser verification; it is where the bugs were.**

## Open, and relevant

| Issue             | Why it matters here                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API #958          | `Assumption` carries Sts Peter and Paul's readings in 5 of 6 locales. A readings editor will show this to whoever opens it. `hr` is correct and holds the right citations. |
| components-js #97 | `ReadingsRenderer` is not exported, so this page carries a hand-copied duplicate of its schema vocabulary and order. If it is exported, delete the copy.                   |

`AllSouls`'s three blank schemata are noted in #958 as a separate observation: nothing is broken, the
readings are simply uncurated, and an editor is the natural place to fix that.

## What is deliberately not decided

Whether `missals-editor.php` is retired when phase 4 lands, or kept. The design says "alongside until
parity", and parity is exactly what phase 4 delivers — so this becomes a live question rather than a
deferred one. The dashboard card's Edit button and the `!missals-editor.php` entry in `.gitignore`'s
allowlist are the two places that change if it goes.
