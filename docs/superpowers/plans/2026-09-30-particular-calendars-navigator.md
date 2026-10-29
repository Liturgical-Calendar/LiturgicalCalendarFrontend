# Particular Calendars Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `extending.php` (no `choice`) into a navigator of wider regions → nations → dioceses that shows each
user "My calendars" first, lets them browse everything, and offers Edit / Create / Translate / Proper of Saints /
Request access per item, deep-linking into the existing forms (#66).

**Architecture:** A pure, unit-tested tree model (`assets/js/particularCalendarsTree.js`) turns public metadata,
prospective lists, national Missal editions and the user's rite-qualified grants into nodes with actions. A PHP helper
(`src/NavigatorData.php`) shapes the grants and Missal editions server-side. A thin renderer
(`assets/js/particularCalendarsNavigator.js`) draws the hub; `extending.js` learns to load a calendar from the query
string and to show a breadcrumb; the sidebar collapses to one entry; the access-request form accepts a prefilled
scope.

**Tech Stack:** PHP 8.4 (PHPUnit, PHPStan, phpcs), vanilla ES modules (Vitest + jsdom), Bootstrap 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-particular-calendars-navigator-design.md`

## Global Constraints

- Grants are rite-qualified exactly as the API scopes them: `roman/IT`, `roman/roma_it`, `ambrosian/lugano_ch`,
  `roman/europe`. Admin implies editor. Rights do not cascade between regions, nations and dioceses.
- A nation's two editors: the national calendar (`extending.php?choice=national&calendar={ISO}`) and, only when
  `/missals/{rite}` lists an edition with `region === ISO`, the Proper of Saints (`sanctorale.php#rite={rite}&calendar={ISO}`).
  Both are authorised by `national_calendar:{rite}/{ISO}`.
- The three forms keep their behaviour; the navigator only links to them.
- New UI strings via gettext (`includes/messages.php` → `Messages`, or `_()` in PHP pages), numbered placeholders.
- PHP: single quotes, short arrays, aligned `=>`; `composer lint`, `composer analyse` clean.
- JS: ES modules, JSDoc on exports; lint with `node_modules/.bin/eslint .` and test with `node_modules/.bin/vitest run`
  (`yarn lint` / `yarn test:unit` are broken in this checkout for an environmental reason — do not repair them).
- Top-level PHP files are single-file bind mounts: after editing one, `docker compose up -d --no-deps --force-recreate litcal-frontend`.
- Commits: never `--no-verify`, quoted heredoc, no push; trailer lines given in each dispatch.

## Review Focus

1. **A nation in several regions** (Sweden: Europe, Nordic) appears under each, and its actions are identical in
   both places. Pinned in Task 1.
2. **A diocese admin whose nation has no calendar**: the diocese offers Create disabled with reason
   `nation-missing`, and the nation offers Request access. Pinned in Task 1.
3. **Italy vs the Netherlands**: Italy offers Proper of Saints (IT_1983); the Netherlands offers only the national
   calendar, with the "no national Missal data" note. Pinned in Tasks 1 and 3.
4. **A malformed or unknown deep link** (`?choice=national&calendar=../x`, an unknown region) shows an error toast
   and leaves the form empty, never a stuck overlay. Pinned in Task 4.
5. **The WorldDioceses fetch failing** on nation expansion: created dioceses still show, with a retry. Pinned in
   Task 3.

---

### Task 1: Tree model

**Files:**

- Create: `assets/js/particularCalendarsTree.js`
- Test: `assets/js/__tests__/particularCalendarsTree.test.js`

**Interfaces — Produces** (named exports):

- `buildNavigatorTree({ metadata, prospectiveRegions, nations, missals, rights, dioceses, uiLocale }): NavigatorNode[]`
    - `metadata`: `/calendars` `litcal_metadata` (`national_calendars[{calendar_id, wider_regions?, wider_region?}]`,
      `diocesan_calendars[{calendar_id, diocese, nation, rite}]`, `wider_regions[{id?, name, label?, roster?, national_calendars?, locales}]`)
    - `prospectiveRegions`: `[{ id, label, roster }]` (from `ProspectiveWiderRegions::all()`)
    - `nations`: `{ ISO: display name }` (from `CatholicNations::localized()`)
    - `missals`: `{ ISO: string[] }` national Missal editions by nation (from `NavigatorData::nationalMissals()`)
    - `rights`: `NavigatorRights` `{ isGlobalAdmin, admin: {national_calendar, diocesan_calendar, wider_region}, editor: {…} }`
      (arrays of rite-qualified ids)
    - `dioceses`: `Map<ISO, {id, name}[]>` of loaded not-yet-created candidates (may be empty)
    - `uiLocale`: for sorting and `Intl.DisplayNames` fallbacks
- `filterMine(nodes): NavigatorNode[]`
- `nationDioceses(nation, worldDioceses): {id, name}[]` (from the `diocesesByNation` Map)
- `parseDeepLink(search: string): { choice, calendar, locale, rite } | null`
- `actionUrl(node, action, context): string`
- `NavigatorNode`: `{ kind: 'region'|'nation'|'diocese'|'group', id, rite, label, exists, actions, disabledReason?, missals?, note?, mine, context?, children, childrenPending? }`
    - `id`: region id, ISO code, or bare diocese id; `rite`: `'roman'`|`'ambrosian'`; group ids `no-region`, `ambrosian`
    - `actions`: subset of `['edit','create','sanctorale','translate','request']`
    - `note`: `'no-missal'` on a nation without Missal editions

- [ ] **Step 1: Write the failing tests** — fixtures: metadata with national IT (wider_regions ['europe']), NL
      (['europe']), SE absent; regions `europe` (roster IT NL SE DE), prospective `nordic` (roster SE DK) and `africa`
      (roster KE); diocesan calendars `roma_it` (IT, roman), `lugano_ch` (CH, ambrosian); nations map incl. IT NL SE DK
      DE KE FR CH; missals `{ IT: ['IT_1983'] }`. Cases:
    - structure: regions sorted by label (existing then prospective); SE appears under europe and nordic with the same
      actions; FR (in no roster) is in `no-region`; `lugano_ch` is under `ambrosian`; `roma_it` is under IT; a Map entry
      `IT → [{id:'torino_it',name:'Torino'}]` adds `torino_it` (exists false) under IT, and a created id is never
      duplicated;
    - global admin: every existing node has `edit`, every missing one `create`; IT also `sanctorale`; NL has
      `note: 'no-missal'` and no `sanctorale`;
    - national editor of IT (`editor.national_calendar: ['roman/IT']`): IT `['edit','sanctorale']`; europe
      `['translate']`; NL `['request']`; `roma_it` `['request']`;
    - national admin of a missing nation (`admin.national_calendar: ['roman/DK']`): DK `['create']`;
    - diocese admin `roman/torino_it` with IT missing from national_calendars (use a fixture without IT): `torino_it`
      `create` with `disabledReason: 'nation-missing'`; Ambrosian dioceses never get `nation-missing`;
    - admin on prospective region `roman/nordic`: nordic `['create']`;
    - `mine` true exactly on nodes with an action other than `request`; `filterMine` keeps them and their ancestors,
      ancestors marked `context: true`, and drops empty groups;
    - `parseDeepLink`: `?choice=national&calendar=IT` → `{choice:'national', calendar:'IT', locale:null, rite:'roman'}`;
      region with locale; diocesan with `rite=ambrosian`; invalid choice, calendar failing `^[A-Za-z0-9_-]{1,64}$`, or
      unknown rite → `null`;
    - `actionUrl`: each row of the spec's action→URL table, URL-encoded; `request` →
      `permission-requests.php?object_type=national_calendar&object_id=roman%2FIT` (region → `wider_region`, diocese →
      `diocesan_calendar` with its rite).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Rules (write small named helpers, JSDoc on exports):
    - `has(list, rite, id)` → `list?.includes(`${rite}/${id}`)`; `canEdit` = global || editor || admin; `canCreate` =
      global || admin.
    - Region members: `roster ?? national_calendars ?? []`; region id `id ?? name`, label `label ?? name`; prospective
      regions whose id already exists are skipped.
    - Nation label: `nations[ISO]` else `Intl.DisplayNames([uiLocale],{type:'region'}).of(ISO)` else ISO.
    - Nation exists: `national_calendars` has `calendar_id === ISO`. Actions: exists → `edit` if canEdit; missing →
      `create` if canCreate; `sanctorale` if `missals[ISO]?.length` and canEdit; none of these → `request`.
    - Region actions: exists → `edit` if canEdit on `wider_region`; else `translate` if the user edits (editor/admin
      national) any member nation, or any nation whose `wider_regions`/`wider_region` declares it; missing → `create` if
      canCreate; else `request`.
    - Diocese (Roman): exists = in `diocesan_calendars` for that nation; `create` gets `disabledReason:'nation-missing'`
      when the nation has no calendar. Ambrosian dioceses come from `diocesan_calendars` with `rite === 'ambrosian'`.
    - `childrenPending: true` on a nation whose dioceses Map entry is absent.
    - `parseDeepLink` accepts `choice ∈ {widerRegion, national, diocesan}`, `rite ∈ {roman, ambrosian}` (default
      `roman`), `locale` matching `^[a-z]{2,3}(_[A-Za-z]{4})?(_[A-Z]{2})?$` or absent.
- [ ] **Step 4:** `node_modules/.bin/vitest run assets/js/__tests__/particularCalendarsTree.test.js && node_modules/.bin/eslint .` → PASS.
- [ ] **Step 5: Commit** — `feat: particular calendars navigator tree model (#66)`

---

### Task 2: Server data (rights and Missal editions)

**Files:**

- Create: `src/NavigatorData.php`
- Test: `tests/NavigatorDataTest.php`

**Interfaces — Produces:**

- `NavigatorData::rights(array $dashboardScopes): array` →
  `['isGlobalAdmin' => bool, 'admin' => [type => list<string>], 'editor' => [type => list<string>]]` for the three types
  `national_calendar`, `diocesan_calendar`, `wider_region` only. `admin_scopes` in dashboard scopes is
  `list<{object_type, object_id}>`; `editor_scopes` is `[type => list<id>]` (read `AuthHelper::dashboardScopes()` and its
  typedef to confirm the exact shapes before coding, and match them). Admin ids are also added to `editor`.
- `NavigatorData::nationalMissals(array $missalsResponse): array<string, list<string>>` — from `/missals/{rite}`
  `litcal_missals[]`: `region` matching `^[A-Z]{2}$` and not `VA` → `missal_id`s, sorted.

- [ ] **Step 1:** PHPUnit: rights with admin+editor overlap, other object types dropped, non-string ids dropped,
      empty/unauthenticated scopes; missals from a fixture with VA/IT/US/AMBROSIAN regions → `['IT' => ['IT_1983'], 'US' => ['US_2011']]`;
      malformed entries skipped.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (final class, static methods, PHPStan-typed arrays).
- [ ] **Step 4:** `vendor/bin/phpunit tests/NavigatorDataTest.php && composer lint && composer analyse` → PASS.
- [ ] **Step 5: Commit** — `feat: navigator rights and national Missal editions (#66)`

---

### Task 3: The hub page

**Files:**

- Modify: `extending.php` (no-`choice` branch), `includes/messages.php` (navigator strings), `layout/footer.php` (load the
  navigator module on the hub), `assets/css/extending.css`
- Create: `assets/js/particularCalendarsNavigator.js`
- Modify: `assets/js/extending.js` (guard its form initialisation when there is no `choice`, if needed)
- Test: `assets/js/__tests__/particularCalendarsNavigator.test.js`

**Interfaces — Consumes:** Task 1 exports; `NavigatorData` (Task 2); `ProspectiveWiderRegions::all($i18n->LOCALE)`,
`CatholicNations::localized($i18n->LOCALE)`, `loadWorldDioceses()` / `diocesesByNation` from `dioceseObjectIdPicker.js`.
**Produces:** `renderNavigator(container, { tree, view, filter, messages, onToggleView, onExpandNation })` (exported
for tests) and the page wiring.

Requirements:

1. **Server**: when `$_GET['choice']` is absent, `extending.php` skips the events fetch (not needed on the hub),
   fetches `/missals/roman` with the same `ApiClient` (`fetchJsonWithKey(..., 'litcal_missals')`; on failure, pass `{}`
   and log), and emits `window.ParticularCalendarsConfig = { metadata, prospectiveRegions, nations, missals, rights, uiLocale, messages }`
   (`JSON_HEX_*` flags) plus a `<div id="particularCalendarsNavigator">`. The `choice` branches are untouched.
2. **Footer**: load `assets/js/particularCalendarsNavigator.js` as a module on the `extending` page when `choice` is
   absent (cache-busted with `filemtime` like the other page scripts). If `extending.js` throws or logs errors on the
   hub (check the browser console with the stack up), guard its form-only initialisation behind `if (choice)`.
3. **Renderer**:
    - toolbar: a two-button group "My calendars" / "Show all" (default: global admin → Show all, else My calendars;
      choice remembered in `sessionStorage`, wrapped in try/catch) and a text filter (case-insensitive on labels,
      keeping ancestors of matches);
    - a Bootstrap accordion per region/group; inside, a list of nations; each nation row: status dot (● exists /
      ○ not yet created, with visually-hidden text), label, ISO code, the "no national Missal data" note when
      `note === 'no-missal'`, and action buttons (`<a class="btn btn-sm">` with `actionUrl`); a disabled Create shows
      the `disabledReason` message as `title` and visually-hidden text;
    - a nation is expandable to its dioceses; on first expansion call `loadWorldDioceses()`, rebuild the tree with the
      nation's `nationDioceses`, re-render; on failure show "Could not load the dioceses" with a Retry button, still
      listing the created dioceses;
    - empty "My calendars": a message and a button that switches to Show all;
    - labels for actions: Edit, Create, Translate, Proper of Saints ({missal ids}), Request access.
4. **Strings** (`includes/messages.php`, translators comments like siblings): My calendars, Show all, Filter,
   Not yet created, Created, Edit, Create, Translate, Proper of Saints (%s), Request access, No national Missal data:
   the national calendar alone defines it, Create the national calendar first, Nations in no wider region,
   Ambrosian rite, Could not load the dioceses, Retry, You have no particular calendars yet, Browse all calendars.
5. **CSS**: status dots, compact rows, action buttons aligned right; wraps on small screens.

- [ ] **Step 1:** jsdom tests for `renderNavigator`: My calendars vs Show all output for an IT editor; Proper of
      Saints button only on IT; NL note; disabled Create has its reason; filter keeps ancestors; empty state button calls
      `onToggleView`; expansion failure shows Retry. Run → FAIL.
- [ ] **Step 2:** Implement renderer + page wiring + PHP + footer + CSS + strings.
- [ ] **Step 3:** `node_modules/.bin/vitest run && node_modules/.bin/eslint . && node --check assets/js/extending.js && composer lint && composer analyse && composer parallel-lint`;
      recreate `litcal-frontend`. The page needs an OIDC login, so the browser check is Task 7's E2E; here, confirm
      the emitted config by rendering the branch's JSON-building code in isolation (e.g. a PHPUnit-free `php -r` call of
      `NavigatorData` on fixtures) and report what you checked.
- [ ] **Step 4: Commit** — `feat: particular calendars navigator hub (#66)`

---

### Task 4: Deep links into the forms

**Files:** Modify `assets/js/extending.js`; Test: `assets/js/__tests__/particularCalendarsTree.test.js` (parser already
tested) plus any new pure helper's test.

Requirements:

- On load, if `parseDeepLink(location.search)` returns a value whose `choice` matches the page's `choice`:
    - `widerRegion`: set `#widerRegionCalendarName` to `{calendar}` (or `{calendar} - {locale}`) and dispatch `change`
      exactly as a user edit does (reuse the path `regionalNationalCalendarNameChanged` takes);
    - `national`: select the nation in the national form's calendar control and dispatch `change`;
    - `diocesan`: select the rite (`rite`), then the national dependency select to the diocese's nation (from
      `LitCalMetadata.diocesan_calendars`, or for a not-yet-created diocese from `loadWorldDioceses()`'s Map), then
      the diocese input, dispatching the same events as the UI.
- The deep link runs only after the form's own initial data (metadata, controls) is ready; find the existing
  readiness point (e.g. after the multiselects are initialised) and hook there.
- A `null` parse (invalid), a choice mismatch, or a calendar not found for that choice (and not creatable, e.g. a
  diocese id unknown to both metadata and WorldDioceses) shows `toastr.error(Messages['Calendar not found'])` and
  leaves the form empty; the `#overlay` must not stay visible.
- Put any new logic in small named functions; pure lookups (e.g. `dioceseNation(id, metadata, worldDioceses)`) go into
  `particularCalendarsTree.js` with unit tests.

- [ ] Steps: failing tests for the pure helpers → implement → `vitest`, `eslint`, `node --check` → commit
      `feat: deep links into the particular calendar forms (#66)`.

---

### Task 5: Breadcrumb on each form

**Files:** Modify `extending.php` (a `<nav aria-label="breadcrumb" id="particularCalendarsBreadcrumb">` above each
form), `assets/js/extending.js`; add a pure `breadcrumbSegments({ choice, calendar, locale, rite, metadata, uiLocale })`
to `particularCalendarsTree.js` with tests.

- Segments per the spec's Part 5 (region form; national form with one link per region the nation belongs to;
  diocesan form Roman vs Ambrosian). Each segment `{ label, href|null }`; the last has no link. Labels from metadata
  (region `label ?? name`, nation display name, diocese `diocese` name).
- Rebuilt whenever the loaded calendar changes (hook the same place the form learns its new `API.key`).

- [ ] Steps: failing tests for `breadcrumbSegments` → implement → checks → commit
      `feat: breadcrumb on the particular calendar forms (#66)`.

---

### Task 6: Sidebar, dashboard cards, prefilled access requests

**Files:** Modify `layout/header.php`, `includes/admin-blocks.php`, `permission-requests.php` (only if config needs it),
`assets/js/permission-requests.js`.

- Sidebar: replace the three "Particular Calendars" links with one `extending.php` link (icon `fa-sitemap`, label
  `_('Particular Calendars')`), active when `$currentPage === 'extending'`; keep `$sidebarHasCalendarRole`.
- `includes/admin-blocks.php`: the wider-region/national/diocesan cards' `viewUrl`/`editUrl` → `extending.php`.
- Access requests: on `DOMContentLoaded`, if the query has `object_type` in the page's known scope types and a
  non-empty `object_id`, check the `calendar_editor` role radio if the scope requires it, add the first permission
  row, and restore it with `restorePermissionRow(row, { object_type, object_id, relation: 'editor' })`; unknown types
  are ignored. Extract the query parsing into a small exported pure function with a unit test.

- [ ] Steps: unit test for the parser → implement → `vitest`, `eslint`, `composer lint`, `composer analyse` → recreate
      `litcal-frontend` → commit `feat: one Particular Calendars entry; prefilled access requests (#66)`.

---

### Task 7: E2E

**Files:** Create `e2e/particular-calendars-navigator.spec.ts`; Create `e2e/rbac/18-particular-calendars-navigator.spec.ts`
(numbering: next free number in `e2e/rbac/`).

- chromium (admin): the hub shows Show all by default with Europe › Italy; Italy has Edit and "Proper of Saints
  (IT_1983)"; the Netherlands has Edit and the no-Missal note; `?choice=national&calendar=IT` loads IT's form (the
  national settings populated); `?choice=widerRegion&calendar=europe&locale=it_IT` loads Europe in it_IT; an invalid
  deep link shows the toast and no overlay; the sidebar has one Particular Calendars entry; Request access (use a
  scope the admin lacks? admins have all — instead open `permission-requests.php?object_type=national_calendar&object_id=roman/FR`
  directly) preselects national_calendar FR.
- rbac (`cei-editor`): My calendars lists Italy (Edit, Proper of Saints) and Europe (Translate); Show all lists France
  with Request access; clicking Request access lands on the prefilled form.
- Run with the stack up: `yarn playwright test e2e/particular-calendars-navigator.spec.ts --project=chromium` and
  `yarn playwright test --project=rbac e2e/rbac/18-particular-calendars-navigator.spec.ts`; re-run a failure once to
  separate flakes; `yarn typecheck`.
- [ ] Commit `test(e2e): particular calendars navigator (#66)`.

---

### Task 8: Docs and full verification

- [ ] CLAUDE.md: a short "Particular calendars navigator" subsection (hub, deep-link parameters, the two editors per
      nation, rights are per calendar), and update any sidebar/entry-point mentions of the three `choice` links.
- [ ] Full suite: `composer parallel-lint && composer lint:fix && composer analyse && composer test && composer lint:md:fix`,
      `yarn typecheck && node_modules/.bin/eslint . && node_modules/.bin/vitest run`; revert fixer changes to files this
      branch never touched.
- [ ] Commit `docs: particular calendars navigator (#66)`.
