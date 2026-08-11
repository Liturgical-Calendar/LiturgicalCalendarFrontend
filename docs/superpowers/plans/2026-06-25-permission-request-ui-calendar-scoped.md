# Permission-Request UI — Calendar-Scoped Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the fine-grained permission UI (`permission-requests.php` and
`admin-permissions.php`) so each permission row is Relation-first with a
"Calendar ID" control that is a real picker, and so it offers the three new
calendar-scoped test object types (`national_calendar_test`,
`diocesan_calendar_test`, `general_roman_calendar_test`) instead of the removed
flat `test_definition`.

**Architecture:** Hybrid Calendar ID control. For calendar-backed scopes
(`national_calendar`, `diocesan_calendar`, and their `_test` twins) the UI
mounts a `CalendarSelect` instance from the already-loaded
`@liturgical-calendar/components-js` package (cached, localized country/diocese
names, diocese grouping handled for us). For the three non-calendar scopes
(`wider_region`, `general_roman_calendar`, `general_roman_calendar_test`) the UI
builds a small native `<select>` from static lists. Both kinds of control render
a `<select class="… perm-object-id">` (or `#grantObjectId`), so existing
value-reading and e2e selectors keep working. The package is initialized once
per page via `ApiClient.init(BaseUrl)`.

**Tech Stack:** Vanilla ES modules (page scripts already load as
`type="module"`; importmap already emitted),
`@liturgical-calendar/components-js` (`ApiClient`, `CalendarSelect`,
`CalendarSelectFilter`), Bootstrap 5 markup, PHP gettext (`_()`) strings
pre-rendered into per-page `window.*Config.i18n` JSON, Playwright e2e + manual
Chrome for verification, ESLint + `tsc` (e2e) + `composer lint`/`parallel-lint`
gates.

## Global Constraints

- **No build step / no bundler.** Page scripts load as `type="module"`
  (`layout/footer.php:166-173`); the importmap mapping
  `@liturgical-calendar/components-js` is already emitted for every page except
  `examples` (`layout/footer.php:134`). No `footer.php` change is required.
- **Package init:** `CalendarSelect` throws unless `ApiClient.init(BaseUrl)` has
  resolved first (`ApiClient._metadata` must be populated). Initialize once at
  module load and gate Calendar ID construction on that promise. `BaseUrl` and
  `LITCAL_LOCALE` / `currentLocale` are existing globals.
- **Object-type sets must mirror the API verbatim**
  (`AccessRequestRepository::ROLE_OBJECT_TYPES`, post-merge of API PR #666):
    - `calendar_editor`: `national_calendar`, `diocesan_calendar`, `wider_region`,
      `general_roman_calendar`
    - `test_editor`: `national_calendar_test`, `diocesan_calendar_test`,
      `general_roman_calendar_test`
    - `developer`: `national_calendar`, `diocesan_calendar`, `wider_region`,
      `national_calendar_test`, `diocesan_calendar_test`,
      `general_roman_calendar_test`, `general_roman_calendar`
- **Scope → Calendar ID source:**
    - `national_calendar`, `national_calendar_test` →
      `CalendarSelect().filter(CalendarSelectFilter.NATIONAL_CALENDARS)` (option
      value = nation code, e.g. `IT`)
    - `diocesan_calendar`, `diocesan_calendar_test` →
      `CalendarSelect().filter(CalendarSelectFilter.DIOCESAN_CALENDARS)` (option
      value = diocese calendar_id, grouped by nation)
    - `wider_region` → static `['Americas','Europe','Asia','Africa','Oceania']`
      (value = label = name)
    - `general_roman_calendar` → static `GRC_OBJECT_IDS` (`temporale`,
      `EDITIO_TYPICA_1970`, `EDITIO_TYPICA_2002`, `EDITIO_TYPICA_2008`, `decrees`)
    - `general_roman_calendar_test` → single fixed option value
      `general_roman_calendar` (auto-selected)
- **`GRC_OBJECT_IDS` keys** must stay in sync with API
  `AccessRequestRepository::GRC_OBJECT_IDS`. They remain duplicated in
  `permission-requests.js` and `admin-permissions.js` (existing convention, with
  a sync comment). `WIDER_REGIONS` is likewise a small inline constant in both.
- **Every Calendar ID control renders an element with class `perm-object-id`**
  (request rows) or **id `grantObjectId`** (admin grant modal) so
  `collectPermissions()` / grant submit read `.value` unchanged.
- **Import specifier:** `@liturgical-calendar/components-js` (exports include
  `ApiClient`, `CalendarSelect`, `CalendarSelectFilter` — confirmed in
  `dist/index.js`).
- **Field order:** Relation → Calendar scope → Calendar ID. **Labels:** "Object
  Type" → **"Calendar scope"**, "Object ID" → **"Calendar ID"** (gettext source
  strings).
- **Translations are owned by Weblate**, not hand-edited `.po` files. Add `_()`
  source strings + regenerate `i18n/litcal.pot`; untranslated msgids fall back
  to English at runtime.
- **Pre-commit hooks must pass** (never `--no-verify`). Do not push until the
  user asks.

---

### Task 1: `permission-requests.php` — relabel + new i18n keys

**Files:**

- Modify: `permission-requests.php` (inline `window.AccessRequestsConfig.i18n`
  block, ~lines 226-256)

**Interfaces:**

- Produces i18n keys consumed by Task 2: `calendarScope`, `calendarId`,
  `selectCalendarScope`, `selectCalendarId`, `testsNational`, `testsDiocesan`,
  `testsGeneralRoman`.

- [ ] **Step 1: Add the relabeled + new i18n strings**

In `permission-requests.php`, inside the `i18n: { ... }` object, add these keys
(keep the existing `objectType`/`objectId`/`selectObjectId` keys — the
existing-requests table renderer still uses `objectType`/`objectId` until Task 2
migrates the row labels; `selectObjectId` is superseded by `selectCalendarId`):

```php
        calendarScope: <?php echo json_encode(_('Calendar scope'), $jsonFlags); ?>,
        calendarId: <?php echo json_encode(_('Calendar ID'), $jsonFlags); ?>,
        selectCalendarScope: <?php echo json_encode(_('Select calendar scope...'), $jsonFlags); ?>,
        selectCalendarId: <?php echo json_encode(_('Select calendar ID...'), $jsonFlags); ?>,
        testsNational: <?php echo json_encode(_('National Calendar Tests'), $jsonFlags); ?>,
        testsDiocesan: <?php echo json_encode(_('Diocesan Calendar Tests'), $jsonFlags); ?>,
        testsGeneralRoman: <?php echo json_encode(_('General Roman Calendar Tests'), $jsonFlags); ?>,
```

- [ ] **Step 2: PHP syntax + lint**

Run: `composer parallel-lint && composer lint` Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add permission-requests.php
git commit -m "feat(permissions): add Calendar scope/ID + scoped-test i18n strings"
```

---

### Task 2: `permission-requests.js` — package import, scoped types, hybrid Calendar ID, reorder

**Files:**

- Modify: `assets/js/permission-requests.js` (top-of-file import; const maps
  ~lines 49-98; `syncRowObjectIdField` ~lines 114-155; `addPermissionRow` ~lines
  212-275; `collectPermissions` ~lines 316-340; existing-requests renderer
  `objectTypeNames` ~line 353)

**Interfaces:**

- Consumes from package: `ApiClient`, `CalendarSelect`, `CalendarSelectFilter`.
- Consumes from Task 1: the new `config.i18n` keys.

- [ ] **Step 1: Add the package import and ApiClient init gate**

At the very top of the file (module top-level, before the existing IIFE), add:

```js
import {
    ApiClient,
    CalendarSelect,
    CalendarSelectFilter,
} from '@liturgical-calendar/components-js';

// Initialize the API client once; CalendarSelect requires this to have resolved.
const apiClientReady = ApiClient.init(BaseUrl)
    .then((client) => (client instanceof ApiClient ? client : false))
    .catch((err) => {
        console.error(
            'Failed to initialize ApiClient for permission fields:',
            err,
        );
        return false;
    });
```

- [ ] **Step 2: Replace `objectTypeNames` and `roleObjectTypes` with the scoped
      types; add `WIDER_REGIONS`**

Replace the `objectTypeNames` block (lines 49-55) with:

```js
// Object type ("Calendar scope") display names
const objectTypeNames = {
    national_calendar: config.i18n.nationalCalendar,
    diocesan_calendar: config.i18n.diocesanCalendar,
    wider_region: config.i18n.widerRegion,
    general_roman_calendar: config.i18n.generalRomanCalendar,
    national_calendar_test: config.i18n.testsNational,
    diocesan_calendar_test: config.i18n.testsDiocesan,
    general_roman_calendar_test: config.i18n.testsGeneralRoman,
};
```

Replace `roleObjectTypes` (lines 94-98) with the API-mirrored sets:

```js
// Object types allowed per role (mirror AccessRequestRepository::ROLE_OBJECT_TYPES)
const roleObjectTypes = {
    calendar_editor: [
        'national_calendar',
        'diocesan_calendar',
        'wider_region',
        'general_roman_calendar',
    ],
    test_editor: [
        'national_calendar_test',
        'diocesan_calendar_test',
        'general_roman_calendar_test',
    ],
    developer: [
        'national_calendar',
        'diocesan_calendar',
        'wider_region',
        'national_calendar_test',
        'diocesan_calendar_test',
        'general_roman_calendar_test',
        'general_roman_calendar',
    ],
};
```

Immediately after the existing `GRC_OBJECT_IDS` array (lines 85-91, keep it),
add the wider-region constant:

```js
// The five wider-region names (object_id for the wider_region scope).
// Keep in sync with the API; these are not localized (proper nouns).
const WIDER_REGIONS = ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania'];
```

- [ ] **Step 3: Replace `syncRowObjectIdField` with the hybrid builder**

Replace the whole `syncRowObjectIdField(row, objectType)` function (lines
~122-155) with the version below. Calendar scopes mount a `CalendarSelect`; the
three static scopes build a native `<select>`. Both end with an element carrying
class `perm-object-id` inside the row's `.perm-objid-mount` cell.

```js
const NATIONAL_FILTER_TYPES = ['national_calendar', 'national_calendar_test'];
const DIOCESAN_FILTER_TYPES = ['diocesan_calendar', 'diocesan_calendar_test'];

/**
 * Build a native <select class="form-select form-select-sm perm-object-id">
 * for the three non-calendar scopes (wider_region / GRC / GRC test).
 */
function buildStaticObjectIdSelect(objectType) {
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm perm-object-id';
    select.required = true;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent =
        config.i18n.selectCalendarId || 'Select calendar ID...';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    let entries = [];
    if (objectType === 'wider_region') {
        entries = WIDER_REGIONS.map((name) => ({ value: name, label: name }));
    } else if (objectType === 'general_roman_calendar') {
        entries = GRC_OBJECT_IDS.map((o) => ({ value: o.id, label: o.label }));
    } else if (objectType === 'general_roman_calendar_test') {
        entries = [
            {
                value: 'general_roman_calendar',
                label: config.i18n.testsGeneralRoman,
            },
        ];
    }
    for (const e of entries) {
        const o = document.createElement('option');
        o.value = e.value;
        o.textContent = e.label;
        select.appendChild(o);
    }
    // Auto-select the single fixed GRC-test id.
    if (objectType === 'general_roman_calendar_test') {
        select.value = 'general_roman_calendar';
    }
    return select;
}

/**
 * Rebuild the Calendar ID control for a row based on the chosen scope.
 * Calendar-backed scopes mount a CalendarSelect; the rest use a native select.
 */
async function syncRowObjectIdField(row, objectType) {
    const mount = row.querySelector('.perm-objid-mount');
    if (!mount) return;
    mount.innerHTML = '';

    if (
        NATIONAL_FILTER_TYPES.includes(objectType) ||
        DIOCESAN_FILTER_TYPES.includes(objectType)
    ) {
        const client = await apiClientReady;
        if (!client) return; // init failed; leave empty (validation will block submit)
        // Guard against a rapid scope change that already replaced the mount.
        if (
            !row.isConnected ||
            row.querySelector('.perm-object-type').value !== objectType
        )
            return;
        const filter = NATIONAL_FILTER_TYPES.includes(objectType)
            ? CalendarSelectFilter.NATIONAL_CALENDARS
            : CalendarSelectFilter.DIOCESAN_CALENDARS;
        const calSelect = new CalendarSelect(LITCAL_LOCALE)
            .filter(filter)
            .allowNull(true)
            .class('form-select form-select-sm perm-object-id');
        calSelect.appendTo(mount);
    } else {
        mount.appendChild(buildStaticObjectIdSelect(objectType));
    }
}
```

- [ ] **Step 4: Reorder the row to Relation → Calendar scope → Calendar ID;
      relabel; add the mount cell**

In `addPermissionRow()` (`row.innerHTML = ...`, lines ~226-259), replace the
template so the order/labels are correct and the Calendar ID cell is an empty
`.perm-objid-mount` (populated by `syncRowObjectIdField`):

```js
row.innerHTML = `
        <div class="card-body py-2 px-3">
            <div class="row g-2 align-items-end">
                <div class="col-md-3">
                    <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.relation)}</label>
                    <select class="form-select form-select-sm perm-relation" required>
                        <option value="">${escapeHtml(config.i18n.selectRelation)}</option>
                        <option value="admin">${escapeHtml(config.i18n.admin)}</option>
                        <option value="viewer">${escapeHtml(config.i18n.viewer)}</option>
                        <option value="editor">${escapeHtml(config.i18n.editor)}</option>
                        <option value="deleter">${escapeHtml(config.i18n.deleter)}</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.calendarScope)}</label>
                    <select class="form-select form-select-sm perm-object-type" required>
                        ${buildObjectTypeOptions()}
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.calendarId)}</label>
                    <div class="perm-objid-mount"></div>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-outline-danger btn-sm w-100 remove-perm-btn"
                            title="${escapeHtml(config.i18n.remove)}"
                            aria-label="${escapeHtml(config.i18n.remove)}">
                        <i class="fas fa-trash-alt" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
```

The existing `.perm-object-type` `change` handler (~line 270) already calls
`syncRowObjectIdField(row, e.target.value)`; it now returns a promise — calling
it fire-and-forget is fine (no `await` needed at the call site). Leave that
wiring.

- [ ] **Step 5: Update the scope-select placeholder text**

In `buildObjectTypeOptions()` (lines ~195-202), change the placeholder string to
the new key:

```js
let html =
    '<option value="">' +
    escapeHtml(config.i18n.selectCalendarScope) +
    '</option>';
```

- [ ] **Step 6: Guard `collectPermissions` against an unpopulated Calendar ID**

In `collectPermissions()` (lines ~316-340), replace the object-id read so a row
with no chosen Calendar ID is treated as invalid rather than throwing:

```js
const objectIdEl = row.querySelector('.perm-object-id');
const objectId = objectIdEl ? objectIdEl.value.trim() : '';
```

(Leave the subsequent
`if (!objectType || !objectId || !relation) { return null; }` check intact.)

- [ ] **Step 7: Syntax + lint**

Run: `node --check assets/js/permission-requests.js && yarn lint` Expected: no
errors.

- [ ] **Step 8: Commit**

```bash
git add assets/js/permission-requests.js
git commit -m "feat(permissions): relation-first rows + hybrid CalendarSelect/static Calendar ID + scoped test types"
```

---

### Task 3: `admin-permissions.php` — scoped types in filter + grant modal, relabel, reorder

**Files:**

- Modify: `admin-permissions.php` (filter object-type `<select>` ~lines 76-81;
  grant-modal object-type `<select>` ~lines 289-295; grant-modal labels ~lines
  288, 299; reorder grant-modal controls; `window.AdminPermissionsConfig.i18n`
  blocks ~lines 372, 412)

**Interfaces:**

- Produces i18n keys consumed by Task 4: `calendarScope`, `calendarId`,
  `selectCalendarId`, `testsNational`, `testsDiocesan`, `testsGeneralRoman`.

- [ ] **Step 1: Replace `test_definition` with the three scoped types in both
      selects**

In the **filter** object-type select (line 80) and the **grant-modal**
object-type select (line 294), replace the single `test_definition` `<option>`
with:

```php
                        <option value="national_calendar_test"><?php echo htmlspecialchars(_('National Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="diocesan_calendar_test"><?php echo htmlspecialchars(_('Diocesan Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="general_roman_calendar_test"><?php echo htmlspecialchars(_('General Roman Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
```

- [ ] **Step 2: Relabel + reorder the grant modal to Relation → Calendar scope →
      Calendar ID**

Reorder the three grant-modal control blocks (object-type ~288-295, object-id
~299-300, relation ~305-310) so Relation precedes Calendar scope precedes
Calendar ID. Change the object-type `<label>` (line 288) to
`_('Calendar scope')`, its placeholder option (line 290) to
`_('Select calendar scope...')`, and the object-id `<label>` (line 299) to
`_('Calendar ID')`. Wrap the object-id input in a mount so JS can swap controls;
replace the `<input id="grantObjectId">` (lines 299-300) markup with:

```php
                        <label for="grantObjectId" class="form-label"><?php echo htmlspecialchars(_('Calendar ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <div id="grantObjectIdMount">
                            <select class="form-select" id="grantObjectId" required>
                                <option value="" disabled selected><?php echo htmlspecialchars(_('Select calendar ID...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            </select>
                        </div>
```

(Keep element ids `grantObjectType`, `grantObjectId`, `grantRelation` so
existing JS reads keep working.)

- [ ] **Step 3: Add new i18n keys to both `AdminPermissionsConfig.i18n` blocks**

In each `i18n: { ... }` block (~line 372 and ~line 412), add:

```php
                calendarScope: <?php echo json_encode(_('Calendar scope')); ?>,
                calendarId: <?php echo json_encode(_('Calendar ID')); ?>,
                selectCalendarId: <?php echo json_encode(_('Select calendar ID...')); ?>,
                testsNational: <?php echo json_encode(_('National Calendar Tests')); ?>,
                testsDiocesan: <?php echo json_encode(_('Diocesan Calendar Tests')); ?>,
                testsGeneralRoman: <?php echo json_encode(_('General Roman Calendar Tests')); ?>,
```

- [ ] **Step 4: PHP syntax + lint**

Run: `composer parallel-lint && composer lint` Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add admin-permissions.php
git commit -m "feat(admin-permissions): scoped test types + Calendar scope/ID labels"
```

---

### Task 4: `admin-permissions.js` — package import, scoped names, hybrid grant Calendar ID

**Files:**

- Modify: `assets/js/admin-permissions.js` (top-of-file import; `GRC_OBJECT_IDS`
  ~lines 45-51; `syncObjectIdField` ~lines 54-88; `objectTypeNames` ~lines
  106-111; init/listener wiring ~line 510)

**Interfaces:**

- Consumes from package: `ApiClient`, `CalendarSelect`, `CalendarSelectFilter`.
- Consumes from Task 3: new `config.i18n` keys.

- [ ] **Step 1: Add the package import + ApiClient init gate**

At the top of the file (module top-level), add the same import +
`apiClientReady` promise as Task 2 Step 1.

- [ ] **Step 2: Update `objectTypeNames`; add `WIDER_REGIONS` (keep
      `GRC_OBJECT_IDS`)**

Replace `objectTypeNames` (lines 106-111) with the same scoped map as Task 2
Step 2 (national/diocesan/wider_region/general_roman_calendar + the three
`_test` types → `config.i18n.testsNational/testsDiocesan/testsGeneralRoman`;
remove `test_definition`). After `GRC_OBJECT_IDS` (lines 45-51, keep it) add the
same `WIDER_REGIONS` constant as Task 2 Step 2.

- [ ] **Step 3: Replace `syncObjectIdField` with the hybrid builder (single
      grant control)**

Replace `syncObjectIdField(objectType)` (lines 54-88) with a version that swaps
the contents of `#grantObjectIdMount`. Calendar scopes mount a `CalendarSelect`
with `.class('form-select').id('grantObjectId')`; static scopes build a native
`<select id="grantObjectId" class="form-select">`:

```js
const NATIONAL_FILTER_TYPES = ['national_calendar', 'national_calendar_test'];
const DIOCESAN_FILTER_TYPES = ['diocesan_calendar', 'diocesan_calendar_test'];

function buildStaticGrantObjectId(objectType) {
    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = 'grantObjectId';
    select.required = true;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent =
        config.i18n.selectCalendarId || 'Select calendar ID...';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    let entries = [];
    if (objectType === 'wider_region') {
        entries = WIDER_REGIONS.map((name) => ({ value: name, label: name }));
    } else if (objectType === 'general_roman_calendar') {
        entries = GRC_OBJECT_IDS.map((o) => ({ value: o.id, label: o.label }));
    } else if (objectType === 'general_roman_calendar_test') {
        entries = [
            {
                value: 'general_roman_calendar',
                label: config.i18n.testsGeneralRoman,
            },
        ];
    }
    for (const e of entries) {
        const o = document.createElement('option');
        o.value = e.value;
        o.textContent = e.label;
        select.appendChild(o);
    }
    if (objectType === 'general_roman_calendar_test') {
        select.value = 'general_roman_calendar';
    }
    return select;
}

async function syncObjectIdField(objectType) {
    const mount = document.getElementById('grantObjectIdMount');
    if (!mount) return;
    mount.innerHTML = '';
    if (
        NATIONAL_FILTER_TYPES.includes(objectType) ||
        DIOCESAN_FILTER_TYPES.includes(objectType)
    ) {
        const client = await apiClientReady;
        if (!client) return;
        if (grantObjectType.value !== objectType) return; // scope changed again meanwhile
        const filter = NATIONAL_FILTER_TYPES.includes(objectType)
            ? CalendarSelectFilter.NATIONAL_CALENDARS
            : CalendarSelectFilter.DIOCESAN_CALENDARS;
        new CalendarSelect(LITCAL_LOCALE)
            .filter(filter)
            .allowNull(true)
            .class('form-select')
            .id('grantObjectId')
            .appendTo(mount);
    } else {
        mount.appendChild(buildStaticGrantObjectId(objectType));
    }
}
```

(The grant submit handler reads `document.getElementById('grantObjectId').value`
— unchanged. The `grantObjectType` change listener at ~line 510 already calls
`syncObjectIdField(e.target.value)`; the now-async function is fine called
fire-and-forget. The reset path that does
`document.getElementById('grantObjectId').value = ''` still works on the
rendered select.)

- [ ] **Step 4: Syntax + lint**

Run: `node --check assets/js/admin-permissions.js && yarn lint` Expected: no
errors.

- [ ] **Step 5: Commit**

```bash
git add assets/js/admin-permissions.js
git commit -m "feat(admin-permissions): hybrid CalendarSelect/static grant Calendar ID + scoped types"
```

---

### Task 5: E2E support + i18n template

**Files:**

- Modify: `e2e/rbac/support/requestAccess.ts` (`objectType` union ~lines 31-33;
  object-id interaction)
- Modify: `i18n/litcal.pot` (regenerated)

**Interfaces:**

- Widens a TypeScript union and switches the object-id interaction to
  `selectOption` (the control is now always a `<select>`).

- [ ] **Step 1: Widen the objectType union**

In `e2e/rbac/support/requestAccess.ts`, extend the union:

```ts
objectType: 'national_calendar' |
    'diocesan_calendar' |
    'wider_region' |
    'general_roman_calendar' |
    'national_calendar_test' |
    'diocesan_calendar_test' |
    'general_roman_calendar_test';
```

- [ ] **Step 2: Ensure the object-id interaction uses `selectOption`**

In `submitAccessRequest` (lines ~39-77), the Calendar ID control is now always a
`<select>` (CalendarSelect-rendered or static). If the helper currently
`.fill()`s `.perm-object-id`, change it to wait for the option then select it:

```ts
const objectIdControl = row.locator('.perm-object-id');
await objectIdControl.waitFor({ state: 'visible' });
await objectIdControl.selectOption(opts.permission.objectId);
```

(Selecting by value works because option values are the nation code / diocese id
/ region / GRC id as appropriate.)

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck` Expected: no errors.

- [ ] **Step 4: Regenerate the gettext template**

Regenerate `i18n/litcal.pot` so the new msgids are present ("Calendar scope",
"Calendar ID", "Select calendar scope...", "Select calendar ID...", "National
Calendar Tests", "Diocesan Calendar Tests", "General Roman Calendar Tests"). Use
the project's existing extraction tooling if present; otherwise:

```bash
find . -name '*.php' -not -path './vendor/*' -not -path './.yarn/*' \
  | xargs xgettext --from-code=UTF-8 --keyword=_ --language=PHP \
      --omit-header --sort-output -o i18n/litcal.pot.new
```

Confirm `i18n/litcal.pot.new` contains the new msgids, reconcile into
`i18n/litcal.pot` (preserve existing header/structure), then remove the `.new`
file. Do **not** edit per-language `.po` files — Weblate owns those.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/requestAccess.ts i18n/litcal.pot
git commit -m "test(e2e): scoped test object types + select-based Calendar ID; refresh i18n template"
```

---

### Task 6: Integration verification (local stack) + e2e scope coverage

**Files:**

- Modify: `e2e/rbac/` — extend or add one spec asserting a `test_editor` request
  against a scoped test type (reuse `submitAccessRequest`).

- [ ] **Step 1: Bring up the local stack and confirm scoped types**

Ensure the docker stack (Postgres, Zitadel, OpenFGA, API on merged
`development`, frontend) is healthy:

```bash
curl -s http://localhost:8000/calendars | jq '.litcal_metadata | keys'
```

Expected: includes `national_calendars`, `diocesan_calendars`, `wider_regions`.

- [ ] **Step 2: Manual Chrome smoke**

On `permission-requests.php`, for each role verify field order Relation →
Calendar scope → Calendar ID and that:

- **test_editor** scope offers exactly National/Diocesan/General Roman Calendar
  Tests; National Calendar Tests mounts a CalendarSelect of nations (localized
  names); Diocesan Calendar Tests mounts a grouped diocese CalendarSelect;
  General Roman Calendar Tests shows the single fixed id.
- **calendar_editor** offers the four calendar scopes; `wider_region` shows the
  five regions; `general_roman_calendar` shows the five GRC ids.
- **developer** offers all seven scopes. Then verify the same behavior in the
  `admin-permissions.php` grant modal.

- [ ] **Step 3: Add an e2e assertion for a scoped test request**

Add/extend an rbac spec driving
`submitAccessRequest(page, { requestedRole: 'test_editor', permission: { objectType: 'national_calendar_test', objectId: 'IT', relation: 'editor' } })`
and asserting the request row appears. Confirm the CalendarSelect-rendered
option for `IT` is present before `selectOption`.

- [ ] **Step 4: Run the e2e suite (chromium)**

Run: `yarn test:ci:chromium` Expected: PASS (or the targeted rbac specs pass).

- [ ] **Step 5: Final gates + commit**

Run:
`composer parallel-lint && composer lint && yarn lint && yarn typecheck && composer lint:md:fix`
Expected: all green.

```bash
git add -A
git commit -m "test(e2e): cover scoped test-type permission request"
```

---

## Self-Review

**Spec coverage (design §"Part 4 — Frontend changes"):**

1. Field order Relation → Calendar scope → Calendar ID → Task 2 Step 4, Task 3
   Step 2. ✓
2. Object ID as a real picker for every type → Task 2 Step 3 (CalendarSelect for
   national/diocesan + `_test`; static select for wider_region/GRC/GRC-test) and
   Task 4 Step 3. ✓
3. Labels "Calendar scope"/"Calendar ID"; scope lists the three test types per
   role → Tasks 1-4. ✓
4. GRC ids in sync across files + API; wider regions inline constant → Task 2/4
   (`GRC_OBJECT_IDS` kept with sync comment, `WIDER_REGIONS` added). ✓

- `general_roman_calendar_test` single fixed id, auto-selected → Task 2/4
  builders. ✓
- Object-type sets mirror API `ROLE_OBJECT_TYPES` → Task 2 Step 2 (verbatim from
  merged API). ✓
- Package already cached/consistent; no `/calendars` fetch in our code
  (CalendarSelect owns it); no footer/importmap change (already emitted). ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to" — each code step
shows complete code. The xgettext command in Task 5 is concrete with a reconcile
step.

**Type/identifier consistency:** `apiClientReady` promise defined identically in
Tasks 2 & 4; `NATIONAL_FILTER_TYPES`/`DIOCESAN_FILTER_TYPES`, `WIDER_REGIONS`,
`GRC_OBJECT_IDS` referenced consistently; every Calendar ID control carries
class `perm-object-id` (rows) or id `grantObjectId` (grant modal); i18n keys
(`calendarScope`, `calendarId`, `selectCalendarScope`, `selectCalendarId`,
`testsNational`, `testsDiocesan`, `testsGeneralRoman`) defined in Tasks 1/3 and
consumed in Tasks 2/4.

**Risk notes:**

- **Per-row CalendarSelect lifecycle:** `syncRowObjectIdField` is async (awaits
  `apiClientReady`); a stale-scope guard
  (`row.querySelector('.perm-object-type').value !== objectType`) prevents a
  late async build from overwriting a newer selection. `apiClientReady` resolves
  at page load, so the await is effectively instant by the time the user
  interacts.
- **No JS unit framework** in the frontend; the dynamic logic (CalendarSelect)
  is already covered by the package's own tests, and the new static-list
  builders are verified by Playwright e2e + manual Chrome — consistent with the
  project's e2e-only test strategy.
- **`CalendarSelect.appendTo(mount)`** appends the rendered `<select>` into the
  mount; reading `.perm-object-id`/`#grantObjectId` `.value` is unchanged for
  submission.
