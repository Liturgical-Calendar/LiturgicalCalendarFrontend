# Admin Decrees Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `decrees.php` to a permission-gated `admin-decrees.php` with enriched viewing and full decree CRUD against the API's new `PUT/PATCH/DELETE /decrees/{decree_id}`
endpoints.

**Architecture:** Clone the `admin-tests.php` + `assets/js/admin-tests.js` pattern: server-side role gate, capability detection via `GET /admin/permissions/check` on
`general_roman_calendar:decrees`, modal-based action-driven editor, HttpOnly-cookie fetches. Pure payload-building logic lives in a standalone ES module with vitest coverage.

**Tech Stack:** PHP 8.1+ (gettext i18n), vanilla ES modules, Bootstrap 5 modals, vitest.

## Global Constraints

- API spec of record: LiturgicalCalendarAPI `docs/superpowers/specs/2026-07-11-decrees-write-paths-design.md`.
- Sidecar matrix (client mirrors server, server is authoritative): i18n required for `createNew`/`makeDoctor`/`setProperty:name` and must include the page locale's base locale;
  i18n forbidden for `setProperty:grade`; readings required on create only for `createNew`, forbidden on create otherwise, optional on edit.
- All API fetches: `credentials: 'include'`, `Accept: application/json`, 15 s `AbortController` timeout (copy `fetchJson` from `assets/js/admin-tests.js`).
- Page visibility: `isAdmin || (hasRole('calendar_editor') && FGA viewer-or-above on general_roman_calendar:decrees)`.
- Buttons: create/edit for editor+; delete + "manage permissions" link for admin relation / global admin only.
- `vendor/bin/phpcs`, `yarn lint`, `yarn test:unit` green before each commit; never `--no-verify`.
- Work in worktree `~/development/LiturgicalCalendar/wt-front-admin-decrees`, branch `feature/admin-decrees`.

---

### Task 1: Decree payload builder module (pure logic, vitest)

**Files:**

- Create: `assets/js/DecreePayload.js`
- Test: `assets/js/__tests__/DecreePayload.test.js`

**Interfaces:**

- Produces (consumed by Task 4):
    - `DecreeAction` — frozen enum `{ CreateNew: 'createNew', SetPropertyGrade: 'setProperty:grade', SetPropertyName: 'setProperty:name', MakeDoctor: 'makeDoctor' }`
    - `buildDecreePayload(form)` — `form` is a plain object (see test below); returns the API payload object
    - `validateDecreePayload(payload, baseLocale, isCreate)` — returns `string[]` of error messages (empty = valid), mirroring the server matrix

- [ ] **Step 1: Write the failing tests**

```javascript
import { describe, it, expect } from 'vitest';
import {
    DecreeAction,
    buildDecreePayload,
    validateDecreePayload,
} from '../DecreePayload.js';

const createNewForm = () => ({
    action: DecreeAction.CreateNew,
    decree_id: 'StTest_Create',
    decree_date: '2025-01-01',
    decree_protocol: 'Prot. N. 1/25',
    description: 'Test decree.',
    event_key: 'StTest',
    event_type: 'fixed',
    day: 14,
    month: 2,
    grade: 2,
    color: ['white'],
    common: ['Pastors'],
    since_year: 2025,
    url: 'https://www.vatican.va/test.html',
    i18n: { en: 'Saint Test' },
    readings: {
        en: {
            first_reading: 'Genesis 1:1',
            responsorial_psalm: 'Psalm 1',
            gospel_acclamation: 'John 1:1',
            gospel: 'John 1:1-14',
        },
    },
});

describe('buildDecreePayload', () => {
    it('builds a fixed-date createNew payload with day/month and no strtotime', () => {
        const p = buildDecreePayload(createNewForm());
        expect(p.decree_id).toBe('StTest_Create');
        expect(p.liturgical_event.day).toBe(14);
        expect(p.liturgical_event.month).toBe(2);
        expect(p.liturgical_event).not.toHaveProperty('strtotime');
        expect(p.metadata.action).toBe('createNew');
        expect(p.metadata).not.toHaveProperty('property');
        expect(p.i18n.en).toBe('Saint Test');
    });

    it('builds a mobile createNew payload with strtotime and no day/month', () => {
        const form = {
            ...createNewForm(),
            event_type: 'mobile',
            strtotime: 'Monday after Pentecost',
        };
        delete form.day;
        delete form.month;
        const p = buildDecreePayload(form);
        expect(p.liturgical_event.strtotime).toBe('Monday after Pentecost');
        expect(p.liturgical_event).not.toHaveProperty('day');
    });

    it('splits setProperty actions into action + property', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            action: DecreeAction.SetPropertyGrade,
            i18n: undefined,
            readings: undefined,
        });
        expect(p.metadata.action).toBe('setProperty');
        expect(p.metadata.property).toBe('grade');
        expect(p).not.toHaveProperty('i18n');
        expect(p).not.toHaveProperty('readings');
    });
});

describe('validateDecreePayload', () => {
    it('accepts a complete createNew payload on create', () => {
        expect(
            validateDecreePayload(
                buildDecreePayload(createNewForm()),
                'en',
                true,
            ),
        ).toEqual([]);
    });

    it('requires i18n with the base locale for name-bearing actions', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            i18n: { it: 'San Test' },
        });
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.some((e) => e.includes('en'))).toBe(true);
    });

    it('rejects i18n for setProperty:grade', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            action: DecreeAction.SetPropertyGrade,
            readings: undefined,
        });
        expect(validateDecreePayload(p, 'en', false).length).toBeGreaterThan(0);
    });

    it('requires readings on create only for createNew', () => {
        const noReadings = buildDecreePayload({
            ...createNewForm(),
            readings: undefined,
        });
        expect(
            validateDecreePayload(noReadings, 'en', true).length,
        ).toBeGreaterThan(0);
        expect(validateDecreePayload(noReadings, 'en', false)).toEqual([]);
    });

    it('rejects readings on create for makeDoctor', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            action: DecreeAction.MakeDoctor,
        });
        expect(validateDecreePayload(p, 'en', true).length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit assets/js/__tests__/DecreePayload.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```javascript
/**
 * Pure payload construction + client-side mirror of the API's per-action
 * sidecar matrix for decree writes. The server (DecreeWritePayloadGuard)
 * remains authoritative; this exists for fast form feedback.
 */
export const DecreeAction = Object.freeze({
    CreateNew: 'createNew',
    SetPropertyGrade: 'setProperty:grade',
    SetPropertyName: 'setProperty:name',
    MakeDoctor: 'makeDoctor',
});

const splitAction = (action) => {
    const [name, property] = action.split(':');
    return property ? { action: name, property } : { action: name };
};

export const buildDecreePayload = (form) => {
    const { action, property } = splitAction(form.action);
    const liturgical_event = {
        event_key: form.event_key,
        calendar: 'GENERAL ROMAN',
        ...(form.event_type === 'mobile'
            ? { strtotime: form.strtotime, type: 'mobile' }
            : {
                  day: Number(form.day),
                  month: Number(form.month),
                  type: 'fixed',
              }),
        ...(form.grade !== undefined ? { grade: Number(form.grade) } : {}),
        ...(form.color ? { color: form.color } : {}),
        ...(form.common ? { common: form.common } : {}),
    };
    const payload = {
        decree_id: form.decree_id,
        decree_date: form.decree_date,
        decree_protocol: form.decree_protocol,
        description: form.description,
        liturgical_event,
        metadata: {
            action,
            ...(property ? { property } : {}),
            since_year: Number(form.since_year),
            url: form.url,
        },
    };
    if (form.i18n && Object.keys(form.i18n).length > 0) {
        payload.i18n = form.i18n;
    }
    if (form.readings && Object.keys(form.readings).length > 0) {
        payload.readings = form.readings;
    }
    return payload;
};

export const validateDecreePayload = (payload, baseLocale, isCreate) => {
    const errors = [];
    const { action, property } = payload.metadata;
    const nameBearing =
        action === 'createNew' ||
        action === 'makeDoctor' ||
        (action === 'setProperty' && property === 'name');

    if (nameBearing) {
        if (!payload.i18n || Object.keys(payload.i18n).length === 0) {
            errors.push(
                `Action "${action}" requires at least one translated event name (i18n)`,
            );
        } else if (!(baseLocale in payload.i18n)) {
            errors.push(
                `The i18n object must include an entry for your locale "${baseLocale}"`,
            );
        }
    } else if (payload.i18n) {
        errors.push(
            'A grade change does not affect the event name: remove the i18n translations',
        );
    }

    if (isCreate) {
        if (action === 'createNew' && !payload.readings) {
            errors.push(
                'A new liturgical event must define its lectionary readings',
            );
        }
        if (action !== 'createNew' && payload.readings) {
            errors.push(
                `Action "${action}" does not accept readings on creation; correct readings via an edit instead`,
            );
        }
    }
    return errors;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit assets/js/__tests__/DecreePayload.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Lint + commit**

```bash
yarn lint assets/js/DecreePayload.js assets/js/__tests__/DecreePayload.test.js
git add assets/js/DecreePayload.js assets/js/__tests__/DecreePayload.test.js
git commit -m "feat: decree payload builder with client-side sidecar matrix"
```

---

### Task 2: admin-decrees.php page + dashboard card + decrees.php removal

**Files:**

- Create: `admin-decrees.php` (start from a copy of `admin-tests.php`, strip test-specific markup)
- Create: `includes/admin-decrees-card.php` (clone `includes/admin-tests-card.php`, retitle)
- Modify: `admin-dashboard.php` (include the card in the `$isAdmin` block and in a new `calendar_editor` block)
- Delete: `decrees.php`
- Modify: `layout/header.php` (or wherever the nav references `decrees.php` — `grep -rn "decrees.php" layout/ includes/ *.php` and update every hit to `admin-decrees.php`)

**Interfaces:**

- Produces: `window.AdminDecreesConfig = { apiUrl, locale, isGlobalAdmin, i18n: {...} }` consumed by Tasks 3-5.

- [ ] **Step 1: Create the page skeleton**

`admin-decrees.php` structure (mirror `admin-tests.php` exactly for the boilerplate — auth block, header include, config script, footer include):

```php
<?php
require_once 'includes/common.php';

if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}
$isAdmin        = $authHelper->hasRole('admin');
$isCalendarEditor = $authHelper->hasRole('calendar_editor');
if (!$isAdmin && !$isCalendarEditor) {
    header('Location: admin-dashboard.php');
    exit;
}
// NOTE: the FGA viewer-or-above check happens client-side on load (Task 3);
// users with the role but no relation get an empty-state message, and the
// dashboard card (which performs the same check) will not have shown a link.
```

Body: a heading, an empty `<div id="decreesContainer" class="row g-3"></div>`, a `<button id="btnCreateDecree" class="btn btn-primary d-none">` and the editor/delete modals (Task
4 fills the form internals; scaffold empty `<div class="modal" id="decreeEditorModal">` / `#decreeDeleteModal` shells now). Config script before the footer:

```php
<script>
window.AdminDecreesConfig = {
    apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
    locale: <?php echo json_encode($i18n->LOCALE); ?>,
    isGlobalAdmin: <?php echo json_encode($isAdmin); ?>,
    i18n: {
        loading:        <?php echo json_encode(_('Loading…')); ?>,
        noAccess:       <?php echo json_encode(_('You do not have permission to view decrees administration.')); ?>,
        loadFailed:     <?php echo json_encode(_('Could not load decrees from the API.')); ?>,
        confirmDelete:  <?php echo json_encode(_('Are you sure you want to delete this decree? This action cannot be undone.')); ?>,
        created:        <?php echo json_encode(_('Decree created.')); ?>,
        updated:        <?php echo json_encode(_('Decree updated.')); ?>,
        deleted:        <?php echo json_encode(_('Decree deleted.')); ?>,
        managePerms:    <?php echo json_encode(_('Manage permissions')); ?>,
        translations:   <?php echo json_encode(_('Translations')); ?>,
        readings:       <?php echo json_encode(_('Lectionary readings')); ?>
    }
};
</script>
<script type="module" src="assets/js/admin-decrees.js"></script>
```

- [ ] **Step 2: Dashboard card**

`includes/admin-decrees-card.php`: copy `includes/admin-tests-card.php`, change title to `_('Decrees')`, description to `_('Create, edit and delete decrees of the Dicastery for
Divine Worship')`, link to `admin-decrees.php`, icon `fas fa-scroll`. In `admin-dashboard.php` include it inside the existing `$isAdmin` card grid AND add, after the
`test_editor` block (~line 126), a parallel block:

```php
<?php if (!$isAdmin && $authHelper->hasRole('calendar_editor')) : ?>
    <?php include('./includes/admin-decrees-card.php'); ?>
<?php endif; ?>
```

The card itself contains a `data-fga-gate="general_roman_calendar:decrees"` attribute; a small inline script in the card include hides the card when the capability check (same
endpoint as Task 3) returns no viewer relation and the user is not a global admin. (This is the interim per-card check; batching is tracked in frontend issue #399.)

- [ ] **Step 3: Remove decrees.php and update references**

```bash
grep -rn "decrees.php" --include="*.php" . | grep -v vendor | grep -v admin-decrees
```

Update every hit (nav menus, sitemaps) to point at `admin-decrees.php`, then `git rm decrees.php`. Check `.gitignore`/`.dockerignore`: per project memory, root PHP pages need `!`
entries in BOTH files — add `!admin-decrees.php` alongside the existing `!admin-tests.php` entries (verify with `grep admin-tests .gitignore .dockerignore`).

- [ ] **Step 4: Lint + commit**

```bash
vendor/bin/phpcs admin-decrees.php includes/admin-decrees-card.php admin-dashboard.php
git add -A
git commit -m "feat: admin-decrees page scaffold, dashboard card, retire public decrees.php"
```

---

### Task 3: Capability detection + enriched read-only view

**Files:**

- Create: `assets/js/admin-decrees.js`

**Interfaces:**

- Consumes: `window.AdminDecreesConfig` (Task 2); API `GET /decrees` (now including `liturgical_event.readings`), `GET /admin/permissions/check`.
- Produces: `capabilities = { canView, canEdit, canAdmin }` module state consumed by Task 4-5 wiring.

- [ ] **Step 1: Implement capability detection and list rendering**

Core of `assets/js/admin-decrees.js` (fetchJson copied verbatim from `admin-tests.js`):

```javascript
const config = window.AdminDecreesConfig;
const RESOURCE = 'general_roman_calendar:decrees';

async function detectCapabilities() {
    if (config.isGlobalAdmin) {
        return { canView: true, canEdit: true, canAdmin: true };
    }
    const check = (relation) =>
        fetchJson(
            'GET',
            `/admin/permissions/check?object_type=general_roman_calendar&object_id=decrees&relation=${relation}`,
        )
            .then((r) => r.allowed === true)
            .catch(() => false);
    const [viewer, editor, admin] = await Promise.all([
        check('viewer'),
        check('editor'),
        check('admin'),
    ]);
    return {
        canView: viewer || editor || admin,
        canEdit: editor || admin,
        canAdmin: admin,
    };
}
```

Verify the exact query-parameter names of `/admin/permissions/check` against the API's `PermissionAdminHandler` (read its `handleCheck` method — parameters may be `user`,
`relation`, `object`) and adapt; the response key is `allowed`.

Render flow: `capabilities.canView === false` → show `config.i18n.noAccess` alert and stop. Otherwise `GET /decrees`, render one Bootstrap card per decree into
`#decreesContainer`: decree id + localized `liturgical_event.name` as title; badges for grade/color/type/common; `month/day` or the raw `strtotime` object rendered as
`"{day_of_the_week} {relative_time} {event_key}"`; collapsible section listing all translations (fetch each locale? NO — show the request-locale name only, plus an on-demand
fetch of `GET /decrees/{id}` with different `Accept-Language` when the user expands the translations panel); collapsible readings section from `liturgical_event.readings`;
metadata footer (decree_date, protocol, source URL). Edit/delete buttons rendered but hidden (`d-none`) unless `canEdit`/`canAdmin`; "manage permissions" link
(`admin-permissions.php?object_type=general_roman_calendar&object_id=decrees`) shown when `canAdmin`.

- [ ] **Step 2: Manual verification**

Run: `php -S localhost:3000` with the API dev server running, log in as a global admin, open `http://localhost:3000/admin-decrees.php`.
Expected: cards render with names, event details, readings; create button visible.

- [ ] **Step 3: Lint + commit**

```bash
yarn lint assets/js/admin-decrees.js
git add assets/js/admin-decrees.js
git commit -m "feat: capability-gated enriched decrees listing"
```

---

### Task 4: Action-driven editor modal

**Files:**

- Modify: `admin-decrees.php` (fill the `#decreeEditorModal` form)
- Modify: `assets/js/admin-decrees.js` (form wiring)

**Interfaces:**

- Consumes: `DecreeAction`, `buildDecreePayload`, `validateDecreePayload` (Task 1); `capabilities` (Task 3).

- [ ] **Step 1: Build the modal form**

Form fields in `#decreeEditorModal` (Bootstrap grid, every label gettext-wrapped):

- Action select (`#decreeAction`): four options mapping to `DecreeAction` values.
- Common fields: `decree_id` (text, pattern `^[A-Z][A-Za-z]+_(Upgrade|Create|NameChange|Doctor)$`, readonly when editing), `decree_date` (date input), `decree_protocol` (text),
  `description` (textarea), `event_key` (text), `since_year` (number), `url` (url input).
- `createNew`-only block (`.action-createNew`): fixed/mobile radio; fixed → `day` + `month` number inputs; mobile → `strtotime` text input; `grade` select (0-7), `color`
  multi-select (white/red/green/purple/rose), `common` multi-select.
- `setProperty:grade`-only block: `grade` select.
- i18n block (`.needs-i18n`): repeatable rows of locale select + name text input; page locale row pre-added and required.
- Readings block (`.needs-readings`): per-locale group of `first_reading`, `responsorial_psalm`, `second_reading` (optional), `gospel_acclamation`, `gospel` text inputs.

JS toggling: on `#decreeAction` change, show/hide blocks:

```javascript
const MATRIX = {
    createNew: { i18n: true, readingsOnCreate: true },
    makeDoctor: { i18n: true, readingsOnCreate: false },
    'setProperty:name': { i18n: true, readingsOnCreate: false },
    'setProperty:grade': { i18n: false, readingsOnCreate: false },
};
```

On submit: `buildDecreePayload(collectForm())` → `validateDecreePayload(payload, baseLocale(config.locale), isCreate)` → show errors in the modal alert region, or proceed to Task
5's save.

- [ ] **Step 2: Manual verification**

Open the modal for each of the four actions.
Expected: exactly the blocks from `MATRIX` are visible per action; submitting an incomplete createNew shows the matrix errors inline.

- [ ] **Step 3: Lint + commit**

```bash
vendor/bin/phpcs admin-decrees.php && yarn lint assets/js/admin-decrees.js
git add admin-decrees.php assets/js/admin-decrees.js
git commit -m "feat: action-driven decree editor modal"
```

---

### Task 5: CRUD wiring

**Files:**

- Modify: `assets/js/admin-decrees.js`

**Interfaces:**

- Consumes: API `PUT/PATCH /decrees/{decree_id}` (payload from Task 1 builder), `DELETE /decrees/{decree_id}`.

- [ ] **Step 1: Implement save + delete**

```javascript
async function saveDecree(payload, isCreate) {
    const method = isCreate ? 'PUT' : 'PATCH';
    await fetchJson(
        method,
        `/decrees/${encodeURIComponent(payload.decree_id)}`,
        payload,
    );
    showToast(isCreate ? config.i18n.created : config.i18n.updated);
    await reloadDecrees();
}

async function deleteDecree(decreeId) {
    await fetchJson('DELETE', `/decrees/${encodeURIComponent(decreeId)}`);
    showToast(config.i18n.deleted);
    await reloadDecrees();
}
```

Edit flow pre-fills the form from the fetched decree (`GET /decrees/{id}`): reverse-map `metadata.action` + `metadata.property` to the `DecreeAction` select value; i18n block
pre-filled with the current locale's name (other locales fetched on demand as in Task 3); readings block pre-filled from `liturgical_event.readings`. Delete flow:
`#decreeDeleteModal` confirmation with `config.i18n.confirmDelete`, wired only when `capabilities.canAdmin`.

Error surface: `fetchJson` failures render the API's error body message in the modal alert region (401 → session-expired message linking to login; 403 → permission message;
400/409 → the server's validation text verbatim — it is specific enough to act on).

- [ ] **Step 2: Manual end-to-end verification**

Against a local API running the `feature/decrees-write-paths` branch: create a `StTest_Create` decree, verify it appears with readings, edit its description, delete it. Verify a
`calendar_editor` user with only `editor` relation sees no delete button, and a plain authenticated user gets the no-access state.
Expected: all four flows behave; API data files return to original state after the delete.

- [ ] **Step 3: Full checks + commit**

```bash
yarn lint && yarn test:unit && vendor/bin/phpcs admin-decrees.php
git add assets/js/admin-decrees.js
git commit -m "feat: decree CRUD wiring with capability-gated actions"
```

---

### Task 6: Final verification + PR

- [ ] **Step 1: Full suite**

Run: `composer test 2>/dev/null || true; yarn lint && yarn test:unit && composer analyse`
Expected: green (composer test may be skipped if no PHP unit changes; analyse must pass).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feature/admin-decrees
gh pr create --base development --title "feat: admin-decrees page with decree CRUD (migrates decrees.php)" \
  --body "Implements the frontend half of LiturgicalCalendarAPI docs/superpowers/specs/2026-07-11-decrees-write-paths-design.md. Depends on the API PR feature/decrees-write-paths. Refs #399 (interim per-card FGA gate)."
```

Expected: PR opened; note in the PR body that it must merge together with (or after) the API PR.
