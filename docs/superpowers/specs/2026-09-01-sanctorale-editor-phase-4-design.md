# Sanctorale Editor — Phase 4 Design (editing)

Phase 4 of frontend issue #503. Phases 1–3 shipped the read-only viewer in PR #512; this document
covers only the editing layer and the retirement of the page it replaces.

Parent design: `docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md`. Implementation
context carried forward: `docs/superpowers/HANDOFF-sanctorale-phase-4.md`. Read both first — what
follows does not repeat what a missal file is, why the view is composed, or why month tabs won.

## What phase 4 delivers

Parity with `missals-editor.php` and past it: editing an entry's structure, its name in every
locale, and its lectionary readings; creating a new `event_key`; deleting one. Delivered in a
single branch, because parity is what makes retiring the old editor a decision rather than a
deferral — and this design retires it.

## The write surface

```text
PUT    /missals/{rite}/{missal_id}/{event_key}   create   201
PATCH  /missals/{rite}/{missal_id}/{event_key}   update   200
DELETE /missals/{rite}/{missal_id}/{event_key}   remove   200
```

`MissalWritePayload` (`jsondata/schemas/LitCalMissalWritePayload.json`), `additionalProperties:
false`. Nothing is required at the top level so `PATCH` can be genuinely partial; the handler
requires the full structure set on `PUT` and at least one changed field on `PATCH`.

```text
event_key  month  day  grade  grade_display  common  calendar  color
color_ad_libitum  is_dominical  is_bvm  i18n  readings
```

Three server-side behaviours shape the client, and each removes work the handoff expected:

- **The API fans out.** `MissalsHandler::fanOutKey()` writes a new key into every locale file of
  the target folder with an empty placeholder, and never overwrites an entry that already exists.
  The parent design's "creating a key must reach every locale file" invariant is upheld by the
  server. **No client-side fan-out.**
- **`calendar` is derived.** `resolveSanctoraleTarget()` computes it from the Missal, so a row
  cannot be filed under a calendar its own Missal never applies to. The field renders read-only.
- **`event_key` is immutable.** The handler refuses a body whose `event_key` disagrees with the
  path, because a rename orphans the i18n and lectionary sidecars permanently. No rename affordance.

## Decisions

1. **Editing lives in the existing detail modal**, which already renders Structure / Names /
   Readings. Each section grows inputs where permitted and keeps today's rendering where not.
   Create opens the same modal empty. This follows `admin-decrees.php`, the parent design's model.
2. **Affordances are gated per row, on that row's Missal** — not once per page. See below; this is
   the single largest departure from `admin-decrees.php` and it is forced by the API.
3. **A new key's target Missal is chosen explicitly**, defaulting to the newest applicable edition.
   Adding a saint to `US_2011` and adding one to the 1970 editio typica are different acts.
4. **`missals-editor.php` retires in this branch.**
5. **Payload construction is a separate, pure module.** Every trap in this design is a
   payload-shaping trap, so the tests belong somewhere they can be written without a DOM.

## Architecture

| File                              | Change                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- |
| `assets/js/sanctorale.js`         | Viewer unchanged in shape; gains form rendering and write wiring          |
| `assets/js/sanctorale-payload.js` | **New.** Pure: payload building, the PATCH diff, validation               |
| `assets/js/capabilities.js`       | **New.** FGA self-check generalized over `{objectType, objectId}`, cached |
| `sanctorale.php`                  | Modal footer, create button, form markup, new `SanctoraleConfig` strings  |

The parent design argued for two files, not five, and that reasoning holds for the viewer. It does
not hold for the write layer: `sanctorale-payload.js` earns a boundary because it is pure, is where
the correctness lives, and is testable only if it has no DOM. `capabilities.js` earns one because
the same self-check is wanted per Missal rather than once per page.

`admin-decrees.js` keeps its own private `detectCapabilities()`. Migrating it onto the shared module
is explicitly out of scope in the parent design, and it is RBAC-critical code covered only by the
`rbac` e2e project — not something to disturb in a branch about a different page.

## Capability gating, per Missal

`OpenFgaAuthorizationMiddleware::forMissals()` authorizes a sanctorale write against the Missal, not
against the page:

| Missal                            | FGA object                             |
| --------------------------------- | -------------------------------------- |
| Editio typica (`region === base`) | `general_roman_calendar:{MISSAL_ID}`   |
| National edition                  | `national_calendar:{rite}/{region}`    |

The separator is `/` (`RiteScopedObjectId::SEPARATOR`), so the object id needs encoding in the check
query. Relations follow `DEFAULT_RELATION_MAP`: `PUT` and `PATCH` require `editor`, `DELETE`
requires `admin`.

`applicableMissals()` already yields the editions in scope, so the page checks `editor` and `admin`
for each, in parallel, memoized per rite + calendar, with `isGlobalAdmin` short-circuiting. Then:

- a row shows **edit** when the user is editor on `row._missalId`, and **delete** when admin on it;
- **create** is offered when the user is editor on at least one applicable edition, and the Missal
  picker lists only those.

The consequence is intended and visible: a curator granted `national_calendar:roman/US` sees edit
controls on the `US_2011` rows and none on the 1970 rows beside them, in the same table.

## The modal

Header: the `event_key`, the Missal badge, and the existing `overrides {missal}` annotation where
`_overrides` is set. Footer: Cancel / Save, and Delete for admins.

### Structure

Month, day, grade, common (≤ 3), color (≥ 1), `is_dominical`, `is_bvm`. `calendar` is read-only.
`color_ad_libitum` renders read-only — only the Ambrosian rite uses it, its `when` vocabulary is a
single closed value today, and an editor for it is speculative.

`grade_display` gets a **tri-state control**, because a text input cannot express its three states
and collapsing them writes `null` over an authored decision:

```text
Rank display  [ Default (from grade) ▾ ]   → null   no override
              [ Show no rank           ]   → ""     authored; this is AllSouls
              [ Custom text…           ]   → "…"    reveals a text input
```

### Names

One input per locale, ordered by the `coverage` map from `GET /missals/{rite}/{missal_id}/i18n`,
badged `translated` / `empty` / `missing` exactly as the viewer badges them today. An empty input
submits `""`, never `null` and never omission: `""` is how the corpus records "this key exists and
is not translated yet", which is what keeps each locale file a complete, diffable inventory.

### Readings

The existing locale × schema-tab layout, with an input per reading field. A blank field stays blank,
because a curated-blank citation is distinct from a missing key — `AllSouls` carries three schemata
whose every field is `""`.

`readings_tier` decides the panel. It is per-Missal, and every write response returns it. Before any
write the panel needs no guess: editability is settled by `lectionary_available`, which the viewer
already reads and which is false for a rite with no corpus, and the `missal` / `rite` distinction only
selects an advisory note — it is read off the `tier.tier` badge the lectionary response already
carries for the tier holding the entry.

| Tier     | Meaning                                   | Panel                                            |
| -------- | ----------------------------------------- | ------------------------------------------------ |
| `missal` | The edition has its own lectionary folder | Editable; writes to that edition                 |
| `rite`   | Falls back to the rite `sanctorum` corpus | Editable, with a note that the corpus is shared  |
| `none`   | No corpus at all (Ambrosian, API #957)    | Read-only note; the payload omits `readings`     |

The `rite` note is not decoration: that corpus is shared by every Roman Missal, so editing readings
on a 1970 row edits data the 2002 and 2008 editions also read. The handler rejects a payload
carrying `readings` when the tier is `none`, so omission is required rather than polite.

### Saving

`PATCH` carries only what changed, diffed against what was loaded — unchanged locales are absent
from `i18n` and `readings` entirely. This is not an optimization: `fanOutKey()` stages only files
whose content actually changed, so a minimal payload is what keeps a queued change request to one
file for a reviewer to read instead of fourteen identical ones.

## Create and delete

**Create** opens the modal empty with two extra controls: the Missal picker (applicable editions,
newest first, restricted to those the user may edit) and an `event_key` input validated against the
schema's `EventKey` pattern. Both disappear once the entry exists. `PUT` requires the full structure
set and at least one locale in `i18n`.

**Delete** is admin-only and confirms by naming the edition, since deleting from the winning edition
reveals whatever it overrode. The response carries `readings_retained`; when true, the readings
survived because another Missal still declares the key, and the UI says so — silence there reads as
a bug.

## Write path and error handling

- **A separate `writeJson()`.** The viewer's `getJson()` uses `credentials: 'omit'` because the
  `/missals` and `/lectionary` reads are public and answer with a wildcard CORS header a browser
  refuses to pair with credentials. The write routes echo the validated origin and set
  `allowCredentials`, so they need `credentials: 'include'`. The read helper is not reused.
- **`applied` is the only disposition that may mutate local state.** Every response goes through
  `describeWriteOutcome()` from `assets/js/writeDisposition.js`. On `submitted` or `approved` the
  toast reports the batch id and the composed table is left untouched. This page is the only editor
  that has never had to think about queue mode; issue #501 fixed it everywhere else.
- **`409` renders inline, in the Structure tab.** `assertKeyIdentity()` refuses a row that would
  make one `event_key` denote two different saints, and composes a message naming the disagreeing
  editions and dates. That belongs beside the month and day inputs that caused it, not in a toast.
- **`403` re-runs capability detection** before reporting, since the likeliest cause is a grant
  changing under a long-lived page.

## Retiring `missals-editor.php`

Five places change:

1. `missals-editor.php` and `assets/js/missals-editor.js` — deleted.
2. `e2e/missals-editor.spec.ts` — deleted. It has no route mocks and no git-restore, and passes
   because of the very 405 that issue #503 reported.
3. `includes/admin-blocks.php` — the sanctorale block's `editUrl` becomes `sanctorale.php`.
4. `layout/header.php` — `missals-editor` leaves the sidebar's active-page list.
5. `includes/common.php` and `.gitignore`'s allowlist — the page leaves both.

This closes issue #503 outright: the filed bug was that page's unreachable success path.

## Testing

**vitest**, over `sanctorale-payload.js`:

- the PATCH diff: unchanged fields, unchanged locales, and a no-op edit all absent from the payload
- `grade_display` round-tripping all three states, including `""` surviving as `""`
- an untranslated name submitting `""` rather than `null` or omission
- a curated-blank reading surviving a round trip
- `readings_tier: 'none'` omitting `readings` entirely
- `PUT` refusing to build without the full structure set and one locale

and over `capabilities.js`: the Missal → FGA object mapping for both tiers, including the `/`
separator and its encoding.

**Playwright**: affordances gated per row for a scoped (non-admin) identity — the assertion no unit
test can make — plus a PATCH, a PUT and a DELETE asserted through `expectWriteApplied()` from
`e2e/support/writeMode.ts`, so a queued write cannot pass as an applied one.

**Browser verification against the live stack.** Phases 1–3 found five defects this way that no
linter or unit test would have caught, and none of the bootstrap, loaders, hash handling or render
pipeline is unit-testable. Budget for it; reuse `e2e/.auth/user.json`, refreshing with
`yarn playwright test --project=setup` when the state has expired.

## Dependencies and known-bad data

| Issue             | Effect on phase 4                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API #958          | `Assumption` carries Sts Peter and Paul's readings in 5 of 6 locales; `hr` holds the correct citations. An editor shows this to whoever opens it. Not fixed here, but the editor is the natural place to fix it. |
| API #957          | The Ambrosian rite has no lectionary corpus, which is what `readings_tier: 'none'` exists to express.                                                                                                            |
| components-js #97 | `ReadingsRenderer` is still unexported, so the hand-copied schema vocabulary stays. Delete it if #97 lands.                                                                                                      |

## Out of scope

`moveEvent`, `createNewFromExisting` and mobile (`strtotime`) events, which belong to the national
calendar editor and are argued at length in the parent design. Adding a locale to a Missal — the
handler refuses an unknown locale rather than creating the file, and changing the advertised locale
set is a separate act. Editing `color_ad_libitum`. Migrating `admin-decrees.js` onto
`capabilities.js`.

## Decisions log

- **Edit in the detail modal over a separate edit modal or page** — the modal already renders the
  three domains an entry has; a second surface would duplicate that and drift from it.
- **Per-row gating over per-page** — forced by `forMissals()`, which authorizes against the Missal.
  A single page-level `canEdit` would either over-offer (edit buttons that 403) or under-offer
  (hiding edits the user may in fact make), and the composed view mixes editions by construction.
- **A tri-state control over a text input for `grade_display`** — three states, three controls. A
  text input has two, and the collapse writes `null` over `""`.
- **An explicit Missal picker on create over inferring the target** — inferring is right most of the
  time and silently wrong when a curator means a national edition while viewing General Roman.
- **A minimal diffed PATCH over sending the whole entry** — `fanOutKey()` stages only changed files,
  so the diff size is what a reviewer of a queued change request actually reads.
- **Retire `missals-editor.php` now rather than keep it alongside** — the parent design said
  "alongside until parity", and phase 4 is parity. Keeping a page whose Save can only ever 405 is
  the bug #503 reported.
- **No client-side i18n fan-out** — the parent design's invariant, discharged by the server in
  `fanOutKey()`. Building it client-side would duplicate it and could only disagree.
