# Admin Decrees Interface — Design

**Date:** 2026-07-12
**Status:** Implemented (Frontend #400, coordinated with API #708)
**Repo:** LiturgicalCalendarFrontend
**Files:** `admin-decrees.php`, `assets/js/admin-decrees.js`, `assets/js/DecreePayload.js`,
`includes/admin-decrees-card.php`, `includes/admin-blocks.php`
**Companion spec:** `LiturgicalCalendarAPI/docs/superpowers/specs/2026-07-11-decrees-write-paths-design.md`
(the API contract this interface consumes)

This document specifies the observable objectives and behaviours of the admin-decrees interface in enough
detail to rebuild it from scratch. It consolidates every refinement made across Frontend #400. Where a
behaviour depends on the API, the dependency is stated explicitly; the API's own contract lives in the
companion spec.

## Objectives

1. Let system admins and calendar editors **view, create, edit, and delete** Dicastery for Divine Worship
   decrees that modify the General Roman Calendar, replacing hand-editing of `jsondata/sourcedata/decrees/`.
2. Present decree data **fully and correctly localized**: the event name and lectionary readings in every
   defined language, not just the page locale.
3. Make the editor **guide the author toward correct, complete data** — deterministic identifiers, the
   right fields per action, the languages that matter seeded by default, and fast client-side validation
   that mirrors the server.
4. Keep decree data **publicly readable** (it is published magisterial record) while gating all mutation
   and the admin surface behind authentication + fine-grained permissions.

## Scope and non-goals

- **In scope:** the `admin-decrees.php` page, its decree cards, and the editor/delete modals.
- **Non-goals:** no new permission-management UI (deep-links to the existing `admin-permissions.php`);
  decree `description` is single-language by design and never translated; the public component libraries
  that consume `GET /decrees` are unaffected.

## Architecture and conventions

- **Page:** `admin-decrees.php` renders the static shell (page toolbar, the empty `#decreesContainer`, the
  editor and delete modals, and the datalists) and emits `window.AdminDecreesConfig` (API URL, page locale
  in BCP-47 form, `isGlobalAdmin`, `userSub`, and a gettext-populated `i18n` string bag).
- **Script loading:** the repo's `layout/footer.php` auto-includes `assets/js/{pageName}.js` as a
  `type="module"` script with a `filemtime` cache-buster (`?v=…`). Admin pages therefore add **no** explicit
  `<script>` tag — doing so creates a second module (different URL once the query string diverges) and
  double-executes the page, appending every card twice.
- **ES modules** with named exports; pure logic (payload construction, the action↔suffix map, validation)
  lives in `DecreePayload.js` and is unit-tested in isolation.
- **Localization:** all UI chrome uses gettext compiled into `AdminDecreesConfig.i18n`. Client-side
  *validation-error* strings are currently English-only (they mirror the server's English messages and
  would move to gettext together).

## Locale handling

- The page UI locale is `AdminDecreesConfig.locale` (BCP-47, e.g. `en-US`); its **primary subtag** (`en`)
  is the *base locale* used throughout.
- The decrees list is fetched with `Accept-Language: <page locale>` so card names — and the locale **labels**
  in the translations panel — agree. (Omitting the header lets the browser's own Accept-Language drive the
  response, which mislabels e.g. an Italian name as the `en` row.)
- Dates are formatted with `Intl.DateTimeFormat` in UTC; language display names use `Intl.DisplayNames` in
  the page locale, falling back to the uppercased code.

## Capability model and gating

Three FGA relations on the object `general_roman_calendar:decrees`, plus the global-admin bypass, define
three capability tiers. Capabilities are detected on load via three parallel self-checks against
`GET /admin/permissions/check` (which is exempt from requiring resource-admin rights for a caller checking
their own `sub`).

| Capability | Granted to                                 | Interface effect                                             |
| ---------- | ------------------------------------------ | ------------------------------------------------------------ |
| `canView`  | global admin, or `viewer`/`editor`/`admin` | see the page and the read-only enriched cards                |
| `canEdit`  | global admin, or `editor`/`admin`          | "New Decree" button; per-card Edit button                    |
| `canAdmin` | global admin, or `admin`                   | per-card Delete button; page-level "Manage permissions" link |

Gating rules:

- **Dashboard card** (`admin-dashboard.php`): renders only when `isAdmin || (calendar_editor && FGA
  viewer-or-above)`; the same self-check the page uses. The card and page use the same scroll icon
  (`fa-scroll`).
- **No access** (`!canView`): the page shows a muted "no permission" notice instead of cards.
- **Manage permissions is page-level, not per-card.** Permissions are resource-level — one FGA object
  governs all decrees — so a per-card link wrongly implies per-decree grants. A single button beside
  "New Decree" (shown when `canAdmin`) deep-links to
  `admin-permissions.php?object_type=general_roman_calendar&object_id=decrees`.

## Read view — the decree cards

`GET /decrees` (public, `credentials: 'omit'`) returns `litcal_decrees[]`. Each renders as a Bootstrap card.
`GET /calendars` (parallel) supplies the GRC-live locale list used as the translation/readings minimum.

**Card structure:** header (localized event name + `decree_id`, plus Edit/Delete buttons gated by
capability), body (badges, details, collapsible Translations and Readings panels), footer (metadata + source
links).

**Event badges and details** reflect the `liturgical_event`: grade label, liturgical color(s) as colored
badges, `type` (fixed/mobile); the resolved date (fixed `day`/`month`, or a human rendering of mobile
`strtotime`); `common`; and the decree `description`.

**Translations panel** (collapsible, shown **only for name-bearing decrees** — `createNew`, `makeDoctor`,
`setProperty:name`; a grade change has no translatable name):

- The request-locale name shows immediately.
- On first expand, `GET /decrees/{id}` is fetched once; every entry of its aggregated `i18n` map is listed
  (locale label + name), request locale first, the rest sorted, empty translations skipped.
- **Fallback** for an API without the aggregated map: probe each GRC-known locale individually
  (`GET /decrees/{id}` per locale) and list those — the source of the earlier per-locale behaviour.

**Readings panel** (collapsible, **tabbed per locale**): one Bootstrap pill tab per supported locale, the
page locale active and populated from the list response; other locales lazily fetched on first expand
(shared per-decree/per-locale fetch cache, also used by the translations panel — the two never double-fetch
the same URL). A locale with no readings shows a muted "No readings defined for this locale yet" note. The
toggle always appears for `createNew` decrees (readings are guaranteed by the write contract), and otherwise
only when the event carries readings.

**Source links** (footer) — depends on the URL shape (see the API spec's *Metadata* section):

- **No `%s` placeholder:** a single "Source" link to the URL.
- **`%s` + `url_lang_map`:** one link per language (the `urls_langs`), each the URL with `%s` expanded to
  that language's Vatican token, labelled with the language's display name (`Intl.DisplayNames`, page
  locale). A link whose href would still contain `%s` is never emitted.
- **`%s` but no map:** a plain "Source" label (no dead link).

Only `http:`/`https:` URLs become links (scheme is validated before assigning `href`).

## Editor modal

Opened for **create** ("New Decree") or **edit** (per-card Edit). Modal-CRUD conventions follow
`admin-tests.js`: `fetchJson` with `credentials: 'include'` for writes, modal alert region, double-submit
guard.

### Field order

1. `event_key` + `action` (side by side).
2. **Derived Decree ID hint** (read-only, below those two fields).
3. Decree date, protocol, since-year.
4. Description.
5. Source URL (+ multilingual switch and, when on, the `url_lang_map` editor).
6. Action-specific blocks: event details (createNew), common (createNew + makeDoctor), grade
   (setProperty:grade), Translations (i18n), Lectionary readings.

### Derived, non-editable `decree_id`

The `decree_id` is **never hand-typed**. It is derived deterministically as `{event_key}_{suffix}` and shown
as a read-only hint (a hidden field carries the value for submission):

| Action              | Suffix       |
| ------------------- | ------------ |
| `createNew`         | `Create`     |
| `makeDoctor`        | `Doctor`     |
| `setProperty:name`  | `NameChange` |
| `setProperty:grade` | `Upgrade`    |

Matches the schema regex `^[A-Z][A-Za-z]+_(Upgrade|Create|NameChange|Doctor)$`. A grade change is always
`_Upgrade` (no downgrades exist yet; widening to `_Downgrade` would require an API schema change and is
deferred). In **create** mode the hint updates live as `event_key`/`action` change; in **edit** mode the id
is pinned to the existing value (the PATCH path param) and never re-derived.

### Create vs edit modes — immutable identity as static hints

`event_key` and `action` are immutable on a PATCH (changing `event_key` orphans i18n/readings entries;
changing `action` would change the derived id). On **edit** they are therefore shown as **static text hints**,
not as an editable input and a greyed-out select (which read as "looks editable but does nothing"). The
underlying input/select keep their value (hidden via `d-none`) so collection still submits them. On **create**
both are editable fields. (This mirrors how the tests editor pins a locked scope.)

### Action-driven field visibility

Selecting an action reveals exactly the blocks that action's payload allows:

| Action              | Event details | Common | Grade | Translations (i18n) | Readings         |
| ------------------- |:-------------:|:------:|:-----:|:-------------------:|:----------------:|
| `createNew`         | ✓             | ✓      |       | ✓                   | ✓ (required PUT) |
| `makeDoctor`        |               | ✓      |       | ✓                   |                  |
| `setProperty:name`  |               |        |       | ✓                   |                  |
| `setProperty:grade` |               |        | ✓     |                     |                  |

### Translations (i18n) rows — GRC-live minimum + all defined

- A locked **base row** for the page locale, plus one row per additional locale.
- **Minimum:** the GRC-live locales (from `/calendars`, e.g. `en, fr, it, la, nl`) are always seeded — as
  **empty rows** when no translation exists — in both create and edit. This nudges the author to provide the
  languages that matter most.
- **All defined:** on edit, every locale present in the decree's aggregated `i18n` map also gets a row,
  pre-filled — including locales **outside** the GRC-live set (`es, pt, pl, hr, id, sk, vi, …`).
- **Any locale addable:** the row's locale field is a datalist-backed text input (`#isoLangDatalist`, all 184
  ISO 639-1 codes labelled with their display name in the page locale), so any language can be added.
- Empty rows contribute nothing on collection (blank names are skipped).

### Lectionary readings groups — GRC-live minimum + all defined

Same locale model as i18n: one readings group (first reading, responsorial psalm, optional second reading,
gospel acclamation, gospel) per GRC-live locale (the minimum, empty when absent) unioned with every locale
that has defined readings, base locale first. Locale fields are the same ISO datalist inputs.

### Source URL block

- A single URL field, plus a **"Source available in multiple languages"** switch (default off).
- **Off:** just the URL.
- **On:** the URL takes a `%s` placeholder and a **`url_lang_map` editor** appears — dynamic rows of
  *(ISO 639-1 language ▸ Vatican token)* with a live **preview** expanding `%s` per language.
  - The **language** field is the `#isoLangDatalist` input (any ISO 639-1 code). A pre-selected code outside
    the offered list is preserved (edit round-trips never silently drop a mapping).
  - The **token** field is bound to a per-language suggestion datalist (`#urlCodes-{iso}`) built from the
    Vatican tokens actually used for that language across current decrees (see below) — suggestions only,
    never a constraint; it rebinds as the language changes.
  - **Duplicate ISO** rows are detected at save time and block submission with a per-duplicate validation
    error (they would otherwise silently overwrite).
- On **edit**, the switch auto-activates when the decree has a `url_lang_map` or a `%s` URL, and the rows
  are prefilled.

**Vatican-token suggestions are dynamic, not hardcoded.** After each list load, the distinct tokens used per
ISO language are aggregated from the current decrees' `url_lang_map` values into `#urlCodes-{iso}` datalists.
A token saved for the first time appears in the suggestions on the next open. (The API's old hardcoded token
enum was dropped precisely because it was only a snapshot; see the API spec.)

### Data loading (edit)

1. Fetch `GET /decrees/{id}` once (page locale, `credentials: 'omit'`).
2. If it returns the aggregated `i18n`/`readings` maps, prefill directly from them — one request, all
   translations.
3. **Fallback** (older API with no maps): probe each GRC-live locale individually via the shared fetch cache
   and synthesize the maps, so create/edit stay consistent with the card panel regardless of API version.

### Validation (client mirror of the server; server remains authoritative)

Before submission, `DecreePayload.js` checks the per-action sidecar matrix (i18n required for name-bearing
actions and must include the base locale; i18n rejected for grade changes; readings required on `createNew`
create; `createNew` requires color + common; `makeDoctor` requires common), plus:

- **URL `%s`/map consistency:** a `%s` URL without a `url_lang_map`, or a map without `%s`, is flagged.
- **Duplicate `url_lang_map` ISO** codes are flagged and block submission.

### Save and delete

- **Save:** PUT (create, expect 201) or PATCH (update) `/decrees/{id}` with the built payload. On success:
  toast, close modal, reload the list. On failure: render the error in the modal alert region.
- **Delete:** confirmation modal, then `DELETE /decrees/{id}`; toast + reload on success.
- **Error surfaces** parse RFC 7807 `problem+json` (`detail`): 401 → session-expired with a login link;
  403 → permission-denied; 400/409 → the server's specific message verbatim; other → generic + server
  detail.

## Payload construction (`DecreePayload.js`)

`collectFormValues(form)` reads the DOM into a form bag; `buildDecreePayload(bag)` produces the write body:
the decree fields, a per-action `liturgical_event` shape (createNew full; `setProperty:grade`
`{event_key, calendar, grade}`; `setProperty:name` `{event_key, calendar}`; `makeDoctor`
`{event_key, calendar, common[]}`), `metadata` (`action`, optional `property`, `since_year`, `url`, and
`url_lang_map` when present), and the `i18n`/`readings` sidecars only for the actions that permit them.
`deriveDecreeId(eventKey, action)` and `validateDecreePayload(payload, baseLocale, isCreate)` are pure and
exported for testing.

## API contract dependencies

| The interface needs…                            | Provided by (API #708)                           |
| ----------------------------------------------- | ------------------------------------------------ |
| List of decrees, request-locale name + readings | `GET /decrees` (Accept-Language)                 |
| One decree with **all** translations + readings | `GET /decrees/{id}` aggregated `i18n`/`readings` |
| Any ISO 639-1 `url_lang_map` key with any token | loosened `DecreeLangs` schema                    |
| Create / update / delete                        | `PUT`/`PATCH`/`DELETE /decrees/{id}` (JWT+FGA)   |
| Capability detection (self-check)               | `GET /admin/permissions/check`                   |
| GRC-live locale minimum                         | `GET /calendars` `litcal_metadata.locales`       |

## Conventions and gotchas

- **CORS:** public reads use `credentials: 'omit'` (the endpoint serves a wildcard
  `Access-Control-Allow-Origin`, which browsers reject on credentialed requests); writes use
  `credentials: 'include'` (cookie JWT).
- **No explicit page `<script>` tag** (footer auto-include handles it; a duplicate double-renders).
- **Module cache-busting** via `filemtime` `?v=` on the auto-include, so a rebuilt container never serves
  fresh HTML with stale JS.
- Reused DOM handlers are re-bound by cloning the node (dropping stale listeners) when the editor re-opens.

## Decisions log

| Decision                       | Choice                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| `decree_id` editability        | Derived from `event_key`+action; read-only hint, hidden field     |
| Grade-change suffix            | Always `_Upgrade` (no downgrades yet; widening deferred)          |
| Immutable identity on edit     | `event_key` + `action` shown as static hints, not disabled fields |
| Source URL placement           | Below description                                                 |
| `url_lang_map` language picker | ISO 639-1 datalist (any language), not GRC-restricted             |
| `url_lang_map` token field     | Free text with dynamic per-language suggestion datalist           |
| Duplicate `url_lang_map` ISO   | Blocking validation error at save                                 |
| Translation/readings locales   | GRC-live minimum (empty rows) + all defined; any locale addable   |
| Editor translation source      | Aggregated single-GET, with per-locale probing fallback           |
| Manage-permissions link        | Page-level (resource-scoped), not per card                        |
