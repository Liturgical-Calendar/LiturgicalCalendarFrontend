# Sanctorale Editor Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
  superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
  tracking.

**Goal:** Turn the read-only sanctorale viewer into an editor — structure, names and readings per entry, plus create and delete — and retire `missals-editor.php`.

**Architecture:** The viewer's detail modal grows editable sections. All payload shaping moves into a new pure
module (`sanctorale-payload.js`) where it can be unit-tested without a DOM, and the per-Missal FGA self-check
moves into another (`capabilities.js`). `sanctorale.js` keeps the DOM, the loaders and the write transport.

**Tech Stack:** Vanilla ES modules, Bootstrap 5, PHP 8.4 page shell with gettext, vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-sanctorale-editor-phase-4-design.md` (parent: `docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md`)

## Global Constraints

- **Branch:** `feat/503-sanctorale-editor-phase-4`, cut from `development`. PRs target `development`, never `main`.
- **Never use `--no-verify`.** Pre-commit runs `composer lint` and `composer lint:md`; fix and re-commit instead of bypassing.
- **Do not push after committing.** Wait for the user to ask.
- **Reads use `credentials: 'omit'`; writes use `credentials: 'include'`.** The `/missals` and `/lectionary`
  reads answer with wildcard CORS, which a browser refuses to pair with credentials. `getJson()` is never reused
  for a write.
- **`applied` is the only disposition that may mutate local state.** Every write response goes through `describeWriteOutcome()` from `assets/js/writeDisposition.js`.
- **Empty string is data, never absence.** In `i18n` (untranslated), in `grade_display` (`""` means show no
  rank), and in a reading citation (curated as blank). Never send `null` where `""` was authored, and never omit
  a field that was explicitly cleared.
- **`event_key` is immutable.** No rename affordance anywhere.
- **PUT requires `month`, `day`, `grade`, `common`, `calendar`, `color`.** `calendar` is not editable but IS
  submitted, and must equal the Missal's own calendar label or the handler refuses the row.
- **FGA relations:** `PUT`/`PATCH` need `editor`; `DELETE` needs `admin`.
- **`sanctorale` is in neither the toastr nor the bootstrap-multiselect page list** in `layout/head.php` and
  `layout/footer.php`. Use the global `window.showToast` from `assets/js/toast.js` and plain `<select
  multiple>`. Do not add the page to those lists.
- **JS globals are declared in `eslint.config.mjs`,** not in inline comments.
- **Numbered gettext placeholders** in PHP: `sprintf(_('… %1$d … %2$s'), …)`.

---

### Task 1: Per-Missal capability detection

**Files:**

- Create: `assets/js/capabilities.js`
- Test: `assets/js/__tests__/capabilities.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `missalFgaObject(missal, rite, baseRegion) -> {objectType: string, objectId: string}`;
  `capabilityCheckPath({userSub, objectType, objectId, relation}) -> string`;
  `detectMissalCapabilities({missals, rite, baseRegion, userSub, isGlobalAdmin, checkAllowed}) ->
  Promise<Map<string, {canEdit: boolean, canDelete: boolean}>>`; constants `RELATION_EDITOR`, `RELATION_ADMIN`.

- [ ] **Step 1: Write the failing test**

Create `assets/js/__tests__/capabilities.test.js`:

```javascript
/**
 * Per-Missal FGA objects.
 *
 * A sanctorale write is authorized against the MISSAL, not the page, so a
 * composed view can mix editions the user may edit with editions they may not.
 * Getting the object wrong fails open or fails closed silently, so it is pinned.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    missalFgaObject, capabilityCheckPath, detectMissalCapabilities,
    RELATION_EDITOR, RELATION_ADMIN
} from '../capabilities.js';

const VA_1970 = { missal_id: 'EDITIO_TYPICA_1970', region: 'VA', year_published: 1970 };
const US_2011 = { missal_id: 'US_2011', region: 'US', year_published: 2011 };
const AMBR = { missal_id: 'EDITIO_TYPICA_2024', region: 'AMBROSIAN', year_published: 2024 };

describe('missalFgaObject', () => {
    it('maps an editio typica onto general_roman_calendar, by missal id', () => {
        expect(missalFgaObject(VA_1970, 'roman', 'VA'))
            .toEqual({ objectType: 'general_roman_calendar', objectId: 'EDITIO_TYPICA_1970' });
    });

    it('maps a national edition onto its rite-qualified national calendar', () => {
        expect(missalFgaObject(US_2011, 'roman', 'VA'))
            .toEqual({ objectType: 'national_calendar', objectId: 'roman/US' });
    });

    it('treats a single-region rite as entirely base', () => {
        // The Ambrosian edition IS the base of its rite, so it is a GRC object even
        // though AMBROSIAN is not a nation code.
        expect(missalFgaObject(AMBR, 'ambrosian', 'AMBROSIAN'))
            .toEqual({ objectType: 'general_roman_calendar', objectId: 'EDITIO_TYPICA_2024' });
    });
});

describe('capabilityCheckPath', () => {
    it('encodes the separator in a rite-qualified object id', () => {
        // The separator is a literal '/', which would otherwise read as a path segment.
        const path = capabilityCheckPath({
            userSub: 'user|1', objectType: 'national_calendar',
            objectId: 'roman/US', relation: RELATION_EDITOR
        });
        expect(path).toContain('object_id=roman%2FUS');
        expect(path).toContain('user=user%7C1');
        expect(path).toContain('relation=editor');
        expect(path.startsWith('/admin/permissions/check?')).toBe(true);
    });
});

describe('detectMissalCapabilities', () => {
    it('grants everything to a global admin without issuing a single check', async () => {
        const checkAllowed = vi.fn();
        const caps = await detectMissalCapabilities({
            missals: [VA_1970, US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: true, checkAllowed
        });
        expect(checkAllowed).not.toHaveBeenCalled();
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canDelete: true });
    });

    it('denies everything when there is no subject to check', async () => {
        const checkAllowed = vi.fn();
        const caps = await detectMissalCapabilities({
            missals: [VA_1970], rite: 'roman', baseRegion: 'VA',
            userSub: '', isGlobalAdmin: false, checkAllowed
        });
        expect(checkAllowed).not.toHaveBeenCalled();
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: false, canDelete: false });
    });

    it('resolves each Missal independently, so a scoped grant is scoped', async () => {
        // This is the whole point: editor on US_2011, nothing on the 1970 typica.
        const checkAllowed = async (path) =>
            path.includes('object_id=roman%2FUS') && path.includes(`relation=${RELATION_EDITOR}`);
        const caps = await detectMissalCapabilities({
            missals: [VA_1970, US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canDelete: false });
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: false, canDelete: false });
    });

    it('treats a failing check as a denial rather than propagating', async () => {
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false,
            checkAllowed: async () => { throw new Error('network'); }
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: false, canDelete: false });
    });

    it('admin implies edit, so a delete-capable user is never shown a read-only row', async () => {
        const checkAllowed = async (path) => path.includes(`relation=${RELATION_ADMIN}`);
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canDelete: true });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run assets/js/__tests__/capabilities.test.js`
Expected: FAIL — `Failed to resolve import "../capabilities.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `assets/js/capabilities.js`:

```javascript
/**
 * Per-Missal capability detection.
 *
 * A sanctorale write is authorized against the MISSAL, not against the page:
 * `OpenFgaAuthorizationMiddleware::forMissals()` maps an editio typica onto
 * `general_roman_calendar:{MISSAL_ID}` and a national edition onto
 * `national_calendar:{rite}/{region}`. The composed view mixes editions by
 * construction, so a single page-level `canEdit` would either offer edits that
 * 403 or hide edits the user may in fact make.
 *
 * @module capabilities
 */

/** `PUT` and `PATCH` require this relation (OpenFga DEFAULT_RELATION_MAP). */
export const RELATION_EDITOR = 'editor';

/** `DELETE` requires this one. */
export const RELATION_ADMIN = 'admin';

/**
 * The FGA object a write against this Missal is authorized on.
 *
 * A Missal in the rite's base region is one of that rite's typical editions and
 * carries a fixed id on `general_roman_calendar` — bare, like `temporale` and
 * `decrees`, because Missal ids are unique across rites. Anything else is a
 * national edition, governed by the national calendar it was approved for, whose
 * id DOES need a rite qualifier because nation codes are not unique across rites.
 *
 * @param {{missal_id: string, region: string}} missal
 * @param {string} rite
 * @param {?string} baseRegion From baseRegionFor(); a single-region rite is all base.
 * @returns {{objectType: string, objectId: string}}
 */
export function missalFgaObject(missal, rite, baseRegion) {
    if (missal.region === baseRegion) {
        return { objectType: 'general_roman_calendar', objectId: missal.missal_id };
    }
    // RiteScopedObjectId::SEPARATOR is a literal '/'.
    return { objectType: 'national_calendar', objectId: `${rite}/${missal.region}` };
}

/**
 * The self-check URL for one (object, relation) pair.
 *
 * URLSearchParams is what encodes the `/` in a rite-qualified object id; built by
 * hand it would read as a path segment and check the wrong object.
 *
 * @param {{userSub: string, objectType: string, objectId: string, relation: string}} params
 * @returns {string}
 */
export function capabilityCheckPath({ userSub, objectType, objectId, relation }) {
    const query = new URLSearchParams({
        user: userSub,
        object_type: objectType,
        object_id: objectId,
        relation
    });
    return `/admin/permissions/check?${query.toString()}`;
}

/**
 * What the user may do to each Missal in scope.
 *
 * Checks run in parallel across Missals and relations. A failed check is a
 * denial, not an exception: a network blip must not blank a page whose read half
 * succeeded, and hiding a control the user has is recoverable while offering one
 * they do not have is a 403 in their face.
 *
 * @param {object} args
 * @param {Array<{missal_id: string, region: string}>} args.missals
 * @param {string} args.rite
 * @param {?string} args.baseRegion
 * @param {string} args.userSub
 * @param {boolean} args.isGlobalAdmin
 * @param {(path: string) => Promise<boolean>} args.checkAllowed
 * @returns {Promise<Map<string, {canEdit: boolean, canDelete: boolean}>>}
 */
export async function detectMissalCapabilities({
    missals, rite, baseRegion, userSub, isGlobalAdmin, checkAllowed
}) {
    const capabilities = new Map();

    if (isGlobalAdmin) {
        for (const missal of missals) {
            capabilities.set(missal.missal_id, { canEdit: true, canDelete: true });
        }
        return capabilities;
    }

    if (!userSub) {
        for (const missal of missals) {
            capabilities.set(missal.missal_id, { canEdit: false, canDelete: false });
        }
        return capabilities;
    }

    const ask = async (object, relation) => {
        try {
            return await checkAllowed(capabilityCheckPath({ userSub, ...object, relation })) === true;
        } catch {
            return false;
        }
    };

    const settled = await Promise.all(missals.map(async (missal) => {
        const object = missalFgaObject(missal, rite, baseRegion);
        const [editor, admin] = await Promise.all([
            ask(object, RELATION_EDITOR),
            ask(object, RELATION_ADMIN)
        ]);
        // Admin implies editor, mirroring the FGA model's own relation hierarchy.
        return [missal.missal_id, { canEdit: editor || admin, canDelete: admin }];
    }));

    for (const [missalId, capability] of settled) {
        capabilities.set(missalId, capability);
    }
    return capabilities;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run assets/js/__tests__/capabilities.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add assets/js/capabilities.js assets/js/__tests__/capabilities.test.js
git commit -m "feat(sanctorale): detect write capability per Missal"
```

---

### Task 2: Payload module — the `grade_display` tri-state and the structure diff

**Files:**

- Create: `assets/js/sanctorale-payload.js`
- Test: `assets/js/__tests__/sanctorale-payload.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `PayloadError`; `GRADE_DISPLAY_DEFAULT` / `GRADE_DISPLAY_NONE` / `GRADE_DISPLAY_CUSTOM`;
  `gradeDisplayMode(value) -> string`; `gradeDisplayValue(mode, text) -> string|null`; `STRUCTURE_FIELDS`;
  `CREATE_REQUIRED`; `diffStructure(original, next) -> object`.

- [ ] **Step 1: Write the failing test**

Create `assets/js/__tests__/sanctorale-payload.test.js`:

```javascript
/**
 * Sanctorale write payloads.
 *
 * Every trap in this editor is a payload-shaping trap, and they share one shape:
 * an empty string is DATA, not absence. Collapsing it writes null over a decision
 * somebody made, in three separate places. They are pinned here.
 */
import { describe, it, expect } from 'vitest';
import {
    gradeDisplayMode, gradeDisplayValue, diffStructure,
    GRADE_DISPLAY_DEFAULT, GRADE_DISPLAY_NONE, GRADE_DISPLAY_CUSTOM
} from '../sanctorale-payload.js';

describe('grade_display is three states, not two', () => {
    it('reads null as "no override"', () => {
        expect(gradeDisplayMode(null)).toBe(GRADE_DISPLAY_DEFAULT);
    });

    it('reads "" as an authored "show no rank"', () => {
        // AllSouls. A text input cannot tell this apart from "not filled in",
        // which is why the control is a select.
        expect(gradeDisplayMode('')).toBe(GRADE_DISPLAY_NONE);
    });

    it('reads text as a custom override', () => {
        expect(gradeDisplayMode('National Holiday')).toBe(GRADE_DISPLAY_CUSTOM);
    });

    it('writes each mode back to its own value', () => {
        expect(gradeDisplayValue(GRADE_DISPLAY_DEFAULT, 'ignored')).toBeNull();
        expect(gradeDisplayValue(GRADE_DISPLAY_NONE, 'ignored')).toBe('');
        expect(gradeDisplayValue(GRADE_DISPLAY_CUSTOM, 'National Holiday')).toBe('National Holiday');
    });

    it('round-trips all three states without collapsing any into another', () => {
        for (const value of [null, '', 'National Holiday']) {
            expect(gradeDisplayValue(gradeDisplayMode(value), value)).toBe(value);
        }
    });

    it('treats an emptied custom field as "show no rank", never as null', () => {
        // The user chose "Custom text" and cleared it. That is still an override.
        expect(gradeDisplayValue(GRADE_DISPLAY_CUSTOM, '')).toBe('');
    });
});

describe('diffStructure', () => {
    const original = {
        month: 5, day: 15, grade: 3, grade_display: null,
        common: ['Pastors'], calendar: 'US', color: ['white'],
        is_dominical: false, is_bvm: false
    };

    it('is empty when nothing changed', () => {
        expect(diffStructure(original, { ...original })).toEqual({});
    });

    it('carries only what changed', () => {
        expect(diffStructure(original, { ...original, day: 16 })).toEqual({ day: 16 });
    });

    it('compares arrays by value, not by identity', () => {
        expect(diffStructure(original, { ...original, common: ['Pastors'] })).toEqual({});
        expect(diffStructure(original, { ...original, color: ['white', 'red'] }))
            .toEqual({ color: ['white', 'red'] });
    });

    it('reports a grade_display of "" as a change from null', () => {
        // The change that matters most and the one a truthiness test would drop.
        expect(diffStructure(original, { ...original, grade_display: '' }))
            .toEqual({ grade_display: '' });
    });

    it('reports a grade_display returning to null as a change from ""', () => {
        const authored = { ...original, grade_display: '' };
        expect(diffStructure(authored, { ...authored, grade_display: null }))
            .toEqual({ grade_display: null });
    });

    it('ignores fields it does not own, so calendar is never proposed as an edit', () => {
        // calendar is derived by the API from the Missal; it is submitted on PUT
        // and must never appear in a PATCH as if a user had changed it.
        expect(diffStructure(original, { ...original, calendar: 'IT' })).toEqual({});
    });

    it('treats a boolean flip as a change even when flipping to false', () => {
        const dominical = { ...original, is_dominical: true };
        expect(diffStructure(dominical, { ...dominical, is_dominical: false }))
            .toEqual({ is_dominical: false });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run assets/js/__tests__/sanctorale-payload.test.js`
Expected: FAIL — `Failed to resolve import "../sanctorale-payload.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `assets/js/sanctorale-payload.js`:

```javascript
/**
 * Sanctorale write payloads, as pure functions.
 *
 * Separated from sanctorale.js because every correctness question this editor has
 * is a question about the payload, and none of them need a DOM to answer. The
 * governing rule, in all three of its guises:
 *
 *   an empty string is DATA, not absence.
 *
 * - `i18n`: `""` records "this key exists but is not translated yet", which is
 *   what keeps every locale file a complete, diffable inventory.
 * - `grade_display`: `""` is an authored override meaning "show no rank at all"
 *   (AllSouls), distinct from `null` meaning "no override".
 * - readings: a blank citation is curated-as-blank, distinct from a missing key.
 *
 * @module sanctorale-payload
 */

/** A payload that cannot be built, with a message meant for the user. */
export class PayloadError extends Error {}

/** No override: the rank renders from `grade`. Serializes to `null`. */
export const GRADE_DISPLAY_DEFAULT = 'default';

/** An authored override meaning "show no rank at all". Serializes to `""`. */
export const GRADE_DISPLAY_NONE = 'none';

/** An authored override carrying its own text. */
export const GRADE_DISPLAY_CUSTOM = 'custom';

/**
 * The structure properties this editor owns.
 *
 * `calendar` is absent on purpose: the API derives it from the Missal, so it is
 * submitted on create (where the handler requires it) but is never a user edit.
 * `color_ad_libitum` is absent because it is rendered read-only.
 */
export const STRUCTURE_FIELDS = Object.freeze([
    'month', 'day', 'grade', 'grade_display', 'common', 'color', 'is_dominical', 'is_bvm'
]);

/** What `MissalsHandler::buildRow()` insists on when creating an entry. */
export const CREATE_REQUIRED = Object.freeze([
    'month', 'day', 'grade', 'common', 'calendar', 'color'
]);

/**
 * Which of the three states a stored `grade_display` is in.
 *
 * @param {string|null|undefined} value
 * @returns {string} one of the GRADE_DISPLAY_* constants
 */
export function gradeDisplayMode(value) {
    if (value === null || value === undefined) return GRADE_DISPLAY_DEFAULT;
    if (value === '') return GRADE_DISPLAY_NONE;
    return GRADE_DISPLAY_CUSTOM;
}

/**
 * The value a mode serializes to.
 *
 * A custom override whose text has been cleared is `""` — still an override —
 * rather than `null`, because the user chose to override and then chose to show
 * nothing. Only the Default mode yields `null`.
 *
 * @param {string} mode one of the GRADE_DISPLAY_* constants
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function gradeDisplayValue(mode, text) {
    if (mode === GRADE_DISPLAY_DEFAULT) return null;
    if (mode === GRADE_DISPLAY_NONE) return '';
    return text === null || text === undefined ? '' : String(text);
}

/**
 * Value equality for the shapes a structure row holds: scalars, null, and arrays
 * of strings. Deliberately not a general deep-equal — there is nothing else here.
 */
function sameValue(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => item === b[i]);
    }
    return a === b;
}

/**
 * The structure properties that actually changed.
 *
 * Comparison is by value and never by truthiness: `''`, `0` and `false` are all
 * legitimate values here, and `grade_display` moving between `null` and `''` is
 * precisely the edit a truthiness test would silently discard.
 *
 * @param {object} original the entry as loaded
 * @param {object} next the entry as the form now reads
 * @returns {object} a partial entry, possibly empty
 */
export function diffStructure(original, next) {
    const changed = {};
    for (const field of STRUCTURE_FIELDS) {
        const before = original?.[field] ?? null;
        const after = next?.[field] ?? null;
        if (!sameValue(before, after)) {
            changed[field] = next[field];
        }
    }
    return changed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run assets/js/__tests__/sanctorale-payload.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add assets/js/sanctorale-payload.js assets/js/__tests__/sanctorale-payload.test.js
git commit -m "feat(sanctorale): model grade_display as three states, not two"
```

---

### Task 3: Payload module — locale maps, `buildPatch`, `buildCreate`

**Files:**

- Modify: `assets/js/sanctorale-payload.js`
- Test: `assets/js/__tests__/sanctorale-payload.test.js` (append)

**Interfaces:**

- Consumes: Task 2's `PayloadError`, `diffStructure`, `CREATE_REQUIRED`.
- Produces: `diffLocaleMap(original, next) -> object`; `buildPatch({original, next, readingsTier}) -> object`;
  `buildCreate({eventKey, next, readingsTier}) -> object`. `next` is always `{structure: object, i18n: object,
  readings?: object}`. Both throw `PayloadError`.

- [ ] **Step 1: Write the failing test**

Append to `assets/js/__tests__/sanctorale-payload.test.js`:

```javascript
import {
    diffLocaleMap, buildPatch, buildCreate, PayloadError
} from '../sanctorale-payload.js';

describe('diffLocaleMap', () => {
    it('carries only the locales that changed', () => {
        expect(diffLocaleMap({ en: 'Isidore', it: 'Isidoro' }, { en: 'St Isidore', it: 'Isidoro' }))
            .toEqual({ en: 'St Isidore' });
    });

    it('treats clearing a name as a change to "", never as a removal', () => {
        // "" is how the corpus records "not translated yet". Omitting the locale
        // would leave the old name in place; sending null would break the schema.
        expect(diffLocaleMap({ de: 'Isidor' }, { de: '' })).toEqual({ de: '' });
    });

    it('treats filling in a previously blank name as a change', () => {
        expect(diffLocaleMap({ de: '' }, { de: 'Isidor' })).toEqual({ de: 'Isidor' });
    });

    it('treats a locale absent from the original as a change when it has a value', () => {
        expect(diffLocaleMap({}, { nl: 'Isidorus' })).toEqual({ nl: 'Isidorus' });
    });

    it('does not propose a blank for a locale that was already absent', () => {
        // The API fans a new key out into every locale file itself; proposing
        // fourteen identical blanks would only lengthen a reviewer's diff.
        expect(diffLocaleMap({}, { nl: '' })).toEqual({});
    });

    it('compares nested readings entries structurally', () => {
        const before = { en: { first_reading: 'Sir 3:1', gospel: 'Mt 5:1' } };
        expect(diffLocaleMap(before, { en: { first_reading: 'Sir 3:1', gospel: 'Mt 5:1' } }))
            .toEqual({});
        expect(diffLocaleMap(before, { en: { first_reading: 'Sir 3:1', gospel: 'Mt 6:1' } }))
            .toEqual({ en: { first_reading: 'Sir 3:1', gospel: 'Mt 6:1' } });
    });

    it('keeps a curated-blank reading blank', () => {
        // AllSouls carries three schemata whose every field is "".
        const before = { en: { first_reading: '', gospel: '' } };
        expect(diffLocaleMap(before, { en: { first_reading: '', gospel: '' } })).toEqual({});
    });
});

describe('buildPatch', () => {
    const original = {
        structure: {
            month: 5, day: 15, grade: 3, grade_display: null,
            common: ['Pastors'], calendar: 'US', color: ['white'],
            is_dominical: false, is_bvm: false
        },
        i18n: { en_US: 'Saint Isidore' },
        readings: { en_US: { first_reading: 'Sir 3:1', gospel: 'Mt 5:1' } }
    };

    const unchanged = () => ({
        structure: { ...original.structure },
        i18n: { ...original.i18n },
        readings: { en_US: { ...original.readings.en_US } }
    });

    it('refuses a no-op rather than recording an empty change', () => {
        // The API refuses this too; catching it here keeps a pointless change
        // request out of a reviewer's queue.
        expect(() => buildPatch({ original, next: unchanged(), readingsTier: 'missal' }))
            .toThrow(PayloadError);
    });

    it('sends only the structure field that changed', () => {
        const next = unchanged();
        next.structure.day = 16;
        expect(buildPatch({ original, next, readingsTier: 'missal' })).toEqual({ day: 16 });
    });

    it('omits i18n entirely when no name changed', () => {
        const next = unchanged();
        next.structure.grade = 4;
        expect(buildPatch({ original, next, readingsTier: 'missal' }))
            .not.toHaveProperty('i18n');
    });

    it('sends only the locales that changed', () => {
        const next = unchanged();
        next.i18n.en_US = 'St Isidore the Farmer';
        expect(buildPatch({ original, next, readingsTier: 'missal' }))
            .toEqual({ i18n: { en_US: 'St Isidore the Farmer' } });
    });

    it('omits readings when the rite has no lectionary to write to', () => {
        // readings_tier 'none' is the Ambrosian rite. The handler REJECTS a
        // payload carrying readings there, so omission is required, not polite.
        const next = unchanged();
        next.readings.en_US.gospel = 'Mt 6:1';
        next.structure.day = 16;
        const payload = buildPatch({ original, next, readingsTier: 'none' });
        expect(payload).not.toHaveProperty('readings');
        expect(payload).toEqual({ day: 16 });
    });

    it('sends readings when the tier is the rite-level corpus', () => {
        const next = unchanged();
        next.readings.en_US.gospel = 'Mt 6:1';
        expect(buildPatch({ original, next, readingsTier: 'rite' }))
            .toEqual({ readings: { en_US: { first_reading: 'Sir 3:1', gospel: 'Mt 6:1' } } });
    });

    it('never carries event_key or calendar', () => {
        const next = unchanged();
        next.structure.day = 16;
        const payload = buildPatch({ original, next, readingsTier: 'missal' });
        expect(payload).not.toHaveProperty('event_key');
        expect(payload).not.toHaveProperty('calendar');
    });
});

describe('buildCreate', () => {
    const complete = {
        structure: {
            month: 5, day: 15, grade: 3, grade_display: null,
            common: ['Pastors'], calendar: 'US', color: ['white'],
            is_dominical: false, is_bvm: false
        },
        i18n: { en_US: 'Saint Isidore' }
    };

    it('carries the whole entry, including the derived calendar', () => {
        // PUT is create-or-replace: buildRow() requires month, day, grade,
        // common, calendar and color, and refuses a calendar that is not the
        // Missal's own.
        const payload = buildCreate({ eventKey: 'StIsidore', next: complete, readingsTier: 'missal' });
        expect(payload).toMatchObject({
            month: 5, day: 15, grade: 3, common: ['Pastors'],
            calendar: 'US', color: ['white'], i18n: { en_US: 'Saint Isidore' }
        });
    });

    it('carries an authored grade_display of "" rather than dropping it', () => {
        const next = { ...complete, structure: { ...complete.structure, grade_display: '' } };
        expect(buildCreate({ eventKey: 'AllSouls', next, readingsTier: 'rite' }).grade_display).toBe('');
    });

    it('omits grade_display when there is no override', () => {
        expect(buildCreate({ eventKey: 'StIsidore', next: complete, readingsTier: 'missal' }))
            .not.toHaveProperty('grade_display');
    });

    it('names every missing required field at once', () => {
        const next = { structure: { month: 5, calendar: 'US' }, i18n: { en_US: 'x' } };
        expect(() => buildCreate({ eventKey: 'StIsidore', next, readingsTier: 'missal' }))
            .toThrow(/day.*grade.*common.*color/s);
    });

    it('requires at least one locale, since the schema sets minProperties 1', () => {
        expect(() => buildCreate({ eventKey: 'StIsidore', next: { ...complete, i18n: {} }, readingsTier: 'missal' }))
            .toThrow(PayloadError);
    });

    it('accepts a single blank name as a locale, because blank is a value', () => {
        const next = { ...complete, i18n: { en_US: '' } };
        expect(buildCreate({ eventKey: 'StIsidore', next, readingsTier: 'missal' }).i18n)
            .toEqual({ en_US: '' });
    });

    it('never carries event_key, which the URL owns', () => {
        expect(buildCreate({ eventKey: 'StIsidore', next: complete, readingsTier: 'missal' }))
            .not.toHaveProperty('event_key');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run assets/js/__tests__/sanctorale-payload.test.js`
Expected: FAIL — `diffLocaleMap is not a function` and the same for `buildPatch` / `buildCreate`.

- [ ] **Step 3: Write minimal implementation**

Append to `assets/js/sanctorale-payload.js`:

```javascript
/**
 * Structural equality for a locale map's values: a name (string) or a readings
 * entry (a possibly-nested object of strings).
 */
function sameEntry(a, b) {
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (a === null || b === null || a === undefined || b === undefined) return a === b;
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
    return aKeys.every((k) => sameEntry(a[k], b[k]));
}

/** True for a value that says nothing: '' for a name, all-blank for a readings entry. */
function isBlankEntry(value) {
    if (value === '' || value === null || value === undefined) return true;
    if (typeof value === 'object') return Object.values(value).every(isBlankEntry);
    return false;
}

/**
 * The locales whose value changed.
 *
 * Two asymmetries, both deliberate:
 *
 * - Clearing a value yields `''`, never omission. Omitting the locale would leave
 *   the stored value in place, so a user who deleted a name would see it return.
 * - A locale that was ABSENT and is still blank yields nothing. `fanOutKey()`
 *   fills a new key into every locale file itself, and proposing fourteen
 *   identical blanks would only lengthen the diff a reviewer reads.
 *
 * @param {Object<string, any>} original
 * @param {Object<string, any>} next
 * @returns {Object<string, any>} a partial map, possibly empty
 */
export function diffLocaleMap(original, next) {
    const changed = {};
    for (const [locale, value] of Object.entries(next ?? {})) {
        const had = Object.prototype.hasOwnProperty.call(original ?? {}, locale);
        if (!had && isBlankEntry(value)) continue;
        if (had && sameEntry(original[locale], value)) continue;
        changed[locale] = value;
    }
    return changed;
}

/**
 * A minimal PATCH body.
 *
 * Minimal is not an optimization: `fanOutKey()` stages only files whose content
 * actually changed, so the payload's size is exactly the size of the change
 * request a reviewer has to read.
 *
 * @param {object} args
 * @param {{structure: object, i18n: object, readings?: object}} args.original
 * @param {{structure: object, i18n: object, readings?: object}} args.next
 * @param {'missal'|'rite'|'none'} args.readingsTier
 * @returns {object}
 * @throws {PayloadError} when nothing changed
 */
export function buildPatch({ original, next, readingsTier }) {
    const payload = diffStructure(original.structure, next.structure);

    const names = diffLocaleMap(original.i18n, next.i18n);
    if (Object.keys(names).length > 0) {
        payload.i18n = names;
    }

    // A rite with no corpus has nowhere to write; the handler refuses a payload
    // that carries `readings` for such a Missal.
    if (readingsTier !== 'none') {
        const readings = diffLocaleMap(original.readings, next.readings);
        if (Object.keys(readings).length > 0) {
            payload.readings = readings;
        }
    }

    if (Object.keys(payload).length === 0) {
        throw new PayloadError('nothing changed');
    }
    return payload;
}

/**
 * A complete PUT body.
 *
 * `calendar` is carried even though no user edits it: `buildRow()` requires it
 * and refuses a value that is not the target Missal's own, so a row can never be
 * filed under a calendar its own Missal never applies to.
 *
 * `grade_display` is omitted when there is no override and carried when there is
 * one — including when the override is `''`, which is an authored decision to
 * show no rank rather than an unset field.
 *
 * @param {object} args
 * @param {string} args.eventKey used for the message only; the URL owns the key
 * @param {{structure: object, i18n: object, readings?: object}} args.next
 * @param {'missal'|'rite'|'none'} args.readingsTier
 * @returns {object}
 * @throws {PayloadError} when a required field or the last locale is missing
 */
export function buildCreate({ eventKey, next, readingsTier }) {
    const structure = next.structure ?? {};

    const missing = CREATE_REQUIRED.filter((field) => {
        const value = structure[field];
        return value === null || value === undefined
            || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length > 0) {
        throw new PayloadError(
            `\`${eventKey}\` cannot be created without: ${missing.join(', ')}`
        );
    }

    const payload = {};
    for (const field of [...CREATE_REQUIRED, 'is_dominical', 'is_bvm']) {
        if (structure[field] !== null && structure[field] !== undefined) {
            payload[field] = structure[field];
        }
    }
    if (structure.grade_display !== null && structure.grade_display !== undefined) {
        payload.grade_display = structure.grade_display;
    }

    const names = next.i18n ?? {};
    if (Object.keys(names).length === 0) {
        throw new PayloadError(`\`${eventKey}\` needs a name in at least one locale`);
    }
    payload.i18n = names;

    if (readingsTier !== 'none') {
        const readings = next.readings ?? {};
        const meaningful = Object.fromEntries(
            Object.entries(readings).filter(([, entry]) => !isBlankEntry(entry))
        );
        if (Object.keys(meaningful).length > 0) {
            payload.readings = meaningful;
        }
    }

    return payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run assets/js/__tests__/sanctorale-payload.test.js`
Expected: PASS, 34 tests total in the file.

- [ ] **Step 5: Commit**

```bash
git add assets/js/sanctorale-payload.js assets/js/__tests__/sanctorale-payload.test.js
git commit -m "feat(sanctorale): build minimal PATCH and complete PUT payloads"
```

---

### Task 4: The write transport

**Files:**

- Modify: `assets/js/sanctorale.js` (add after `getJson`, around line 110)
- Test: `assets/js/__tests__/sanctorale-write.test.js`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `ApiWriteError` (with `.status` and `.body`); `entryPath(rite, missalId, eventKey) -> string`;
  `writeJson(method, path, body) -> Promise<object|null>`. All exported from `sanctorale.js`.

- [ ] **Step 1: Write the failing test**

Create `assets/js/__tests__/sanctorale-write.test.js`:

```javascript
/**
 * The write transport.
 *
 * Reads and writes differ in a way that is invisible until it fails: the reads
 * are public and answer with a wildcard CORS header a browser refuses to pair
 * with credentials, while the writes echo the validated origin and require them.
 * So `getJson` cannot be reused, and this pins the difference.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

let writeJson, entryPath, ApiWriteError;

beforeAll(async () => {
    global.window = global.window ?? {};
    ({ writeJson, entryPath, ApiWriteError } = await import('../sanctorale.js'));
});

afterEach(() => { vi.unstubAllGlobals(); });

const respond = (status, body, ok = status < 400) => vi.fn(async () => ({
    ok, status,
    json: async () => {
        if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
        return body;
    }
}));

describe('entryPath', () => {
    it('addresses one entry, rite first', () => {
        expect(entryPath('roman', 'US_2011', 'StIsidore'))
            .toBe('/missals/roman/US_2011/StIsidore');
    });

    it('encodes each segment separately', () => {
        expect(entryPath('roman', 'US 2011', 'St/Isidore'))
            .toBe('/missals/roman/US%202011/St%2FIsidore');
    });
});

describe('writeJson', () => {
    it('sends credentials, which the read helper must never do', () => {
        const fetchMock = respond(200, { success: 'ok' });
        vi.stubGlobal('fetch', fetchMock);
        return writeJson('PATCH', '/missals/roman/US_2011/StIsidore', { day: 16 }).then(() => {
            const [, init] = fetchMock.mock.calls[0];
            expect(init.credentials).toBe('include');
            expect(init.method).toBe('PATCH');
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(JSON.parse(init.body)).toEqual({ day: 16 });
        });
    });

    it('sends no body when there is none, so DELETE stays bodyless', async () => {
        const fetchMock = respond(200, { success: 'gone' });
        vi.stubGlobal('fetch', fetchMock);
        await writeJson('DELETE', '/missals/roman/US_2011/StIsidore');
        expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });

    it('returns null for an empty body instead of reporting a success as a failure', async () => {
        // This is issue #503 item 3, the bug the old editor shipped: an unguarded
        // response.json() on a 204 throws, is caught, and surfaces as "failed to save".
        vi.stubGlobal('fetch', respond(204, undefined));
        await expect(writeJson('DELETE', '/missals/roman/US_2011/StIsidore')).resolves.toBeNull();
    });

    it('throws an ApiWriteError carrying the parsed body, so a 409 can be shown', async () => {
        const conflict = { error: 'StIsidore is declared on 4/4 by EDITIO_TYPICA_1970' };
        vi.stubGlobal('fetch', respond(409, conflict, false));
        await expect(writeJson('PATCH', '/missals/roman/US_2011/StIsidore', { day: 16 }))
            .rejects.toMatchObject({ status: 409, body: conflict });
    });

    it('still throws when an error response has no parseable body', async () => {
        vi.stubGlobal('fetch', respond(403, undefined, false));
        await expect(writeJson('PATCH', '/missals/roman/US_2011/StIsidore', { day: 16 }))
            .rejects.toBeInstanceOf(ApiWriteError);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run assets/js/__tests__/sanctorale-write.test.js`
Expected: FAIL — `writeJson is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `assets/js/sanctorale.js`, immediately after `getJson()`:

```javascript
/**
 * A failed write, carrying the API's own parsed body.
 *
 * The body matters: `assertKeyIdentity()` composes a 409 naming the editions and
 * dates that disagree, and that message is more useful beside the inputs that
 * caused it than a status code ever is.
 */
export class ApiWriteError extends Error {
    constructor(status, body) {
        super(`HTTP ${status}`);
        this.status = status;
        this.body = body;
    }
}

/** The address of one sanctorale entry. Every segment is encoded on its own. */
export function entryPath(rite, missalId, eventKey) {
    return `/missals/${encodeURIComponent(rite)}/${encodeURIComponent(missalId)}/${encodeURIComponent(eventKey)}`;
}

/**
 * Issue a write.
 *
 * Separate from getJson() and not a wrapper over it, because the two disagree on
 * the one setting that matters: the `/missals` and `/lectionary` reads are public
 * and answer `Access-Control-Allow-Origin: *`, which a browser refuses to pair
 * with credentials, while the write routes echo the validated origin and set
 * `allowCredentials`. A shared helper would have to be right about both.
 *
 * An unparseable body is `null`, never a throw: reading an empty 204 as a failure
 * is the bug issue #503 filed against the old editor.
 *
 * @param {'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path from entryPath()
 * @param {object} [body]
 * @returns {Promise<object|null>}
 * @throws {ApiWriteError}
 */
export async function writeJson(method, path, body) {
    const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new ApiWriteError(response.status, data);
    }
    return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run` (the whole suite, to confirm the new exports break nothing)
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add assets/js/sanctorale.js assets/js/__tests__/sanctorale-write.test.js
git commit -m "feat(sanctorale): add a credentialed write transport"
```

---

### Task 5: The page shell — config, strings and markup

**Files:**

- Modify: `sanctorale.php` (auth config near line 135; markup near lines 96–130)

**Interfaces:**

- Consumes: nothing.
- Produces: `window.SanctoraleConfig.isGlobalAdmin` (bool), `.userSub` (string), and the `i18n` keys named
  below. DOM ids: `#newEntryBtn`, `#detailModalFooter`, `#saveEntryBtn`, `#deleteEntryBtn`, `#entryFormError`.

- [ ] **Step 1: Add the auth fields and the write strings**

In `sanctorale.php`, inside `window.SanctoraleConfig`, after `locale:`, add — matching `admin-decrees.php:623-624`:

```php
            isGlobalAdmin: <?php echo json_encode($isAdmin, JSON_HEX_TAG); ?>,
            userSub:       <?php echo json_encode($authHelper->sub ?? '', JSON_HEX_TAG); ?>,
```

Then inside `i18n`, before `loadFailed`, add:

```php
                edit:               <?php echo json_encode(_('Edit'), JSON_HEX_TAG); ?>,
                save:               <?php echo json_encode(_('Save'), JSON_HEX_TAG); ?>,
                cancel:             <?php echo json_encode(_('Cancel'), JSON_HEX_TAG); ?>,
                deleteLabel:        <?php echo json_encode(_('Delete'), JSON_HEX_TAG); ?>,
                newEntry:           <?php echo json_encode(_('New celebration'), JSON_HEX_TAG); ?>,
                targetMissal:       <?php echo json_encode(_('Add to Missal'), JSON_HEX_TAG); ?>,
                eventKeyLabel:      <?php echo json_encode(_('Event key'), JSON_HEX_TAG); ?>,
                <?php // The key ties the structure row to its name and readings in every locale,
                      // so the API refuses to rename one: it would orphan all of them. ?>
                eventKeyHint:       <?php echo json_encode(_('Letters and digits only. This cannot be changed later.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the event key ?>
                confirmDelete:      <?php echo json_encode(_('Delete %s from this Missal? Its name and readings go with it.'), JSON_HEX_TAG); ?>,
                <?php // The rite-level corpus is shared by every Missal of the rite, so this
                      // edit is not confined to the edition being edited. ?>
                readingsShared:     <?php echo json_encode(_('These readings live in the rite-wide lectionary, shared by every Missal of this rite.'), JSON_HEX_TAG); ?>,
                readingsNotWritable: <?php echo json_encode(_('This rite has no lectionary, so readings cannot be edited here.'), JSON_HEX_TAG); ?>,
                <?php // Reported after a delete when another Missal still declares the key, so
                      // the readings deliberately survived. Silence here reads as a bug. ?>
                readingsRetained:   <?php echo json_encode(_('The readings were kept: another Missal still declares this celebration.'), JSON_HEX_TAG); ?>,
                gradeDisplayDefault: <?php echo json_encode(_('Default (from grade)'), JSON_HEX_TAG); ?>,
                gradeDisplayNone:   <?php echo json_encode(_('Show no rank'), JSON_HEX_TAG); ?>,
                gradeDisplayCustom: <?php echo json_encode(_('Custom text…'), JSON_HEX_TAG); ?>,
                noChanges:          <?php echo json_encode(_('Nothing has changed.'), JSON_HEX_TAG); ?>,
                saved:              <?php echo json_encode(_('Saved.'), JSON_HEX_TAG); ?>,
                created:            <?php echo json_encode(_('Celebration created.'), JSON_HEX_TAG); ?>,
                deleted:            <?php echo json_encode(_('Celebration deleted.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the error reported by the API ?>
                saveFailed:         <?php echo json_encode(_('Could not save: %s'), JSON_HEX_TAG); ?>,
                permissionDenied:   <?php echo json_encode(_('You do not have permission to change this Missal.'), JSON_HEX_TAG); ?>,
                conflictTitle:      <?php echo json_encode(_('This clashes with another Missal'), JSON_HEX_TAG); ?>,
                <?php // The four strings describeWriteOutcome() needs; each takes one %s.
                      // A write is not necessarily applied to disk: with
                      // SOURCEDATA_CHANGE_REQUESTS enabled it is queued for review and the
                      // API answers the SAME 2xx. See assets/js/writeDisposition.js. ?>
                <?php // translators: %s is the change request batch id ?>
                writeSubmitted:     <?php echo json_encode(_('Queued for review as batch %s. Nothing has been written yet.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the change request batch id ?>
                writeApproved:      <?php echo json_encode(_('Approved as batch %s, awaiting publication.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is a comma-separated list of batch ids ?>
                writeSuperseded:    <?php echo json_encode(_('Earlier batches folded in: %s.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the unrecognized disposition value ?>
                writeUnknown:       <?php echo json_encode(_('The server reported an unrecognized outcome (%s); nothing local was changed.'), JSON_HEX_TAG); ?>,
```

- [ ] **Step 2: Add the create button and the modal footer**

In `sanctorale.php`, replace the `<div id="sanctoraleNotice"></div>` line with:

```php
    <div class="d-flex justify-content-between align-items-center mb-2">
        <div id="sanctoraleNotice" class="flex-grow-1"></div>
        <?php // Hidden by default and revealed only when the user may edit at least one
              // applicable Missal. NOT data-requires-auth: that global handler reveals on
              // ANY authentication, and creating an entry needs an editor grant on a
              // specific Missal — see admin-decrees.php's identical note. ?>
        <button type="button" class="btn btn-primary btn-sm d-none ms-2" id="newEntryBtn">
            <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('New celebration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
    </div>
```

In the same file, replace the modal's closing `</div>` block so the modal body is followed by a footer:

```php
                <div class="modal-body" id="detailModalBody"></div>
                <div class="modal-footer d-none" id="detailModalFooter">
                    <div id="entryFormError" class="text-danger small me-auto"></div>
                    <button type="button" class="btn btn-outline-danger d-none" id="deleteEntryBtn">
                        <i class="fas fa-trash me-1"></i><?php echo htmlspecialchars(_('Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="saveEntryBtn">
                        <?php echo htmlspecialchars(_('Save'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
```

- [ ] **Step 3: Verify the page still renders and lints**

Run: `composer parallel-lint && composer lint:fix && composer analyse`
Expected: no errors. Then load `http://localhost:3000/sanctorale.php` and confirm the table still renders and the new footer is hidden.

- [ ] **Step 4: Commit**

```bash
git add sanctorale.php
git commit -m "feat(sanctorale): add the editor's markup, config and strings"
```

---

### Task 6: Capability detection wiring and per-row affordances

**Files:**

- Modify: `assets/js/sanctorale.js` — `dom` (line 38), `state` (line 52), `renderTable` (line 372), `loadCatalogue` (line 667)

**Interfaces:**

- Consumes: Task 1's `detectMissalCapabilities`; Task 5's `#newEntryBtn`, `config.userSub`, `config.isGlobalAdmin`.
- Produces: `state.capabilities` (a `Map<string, {canEdit, canDelete}>`); `capabilityFor(missalId) -> {canEdit,
  canDelete}`; an Edit button per row carrying `data-edit-key` and `data-missal`.

- [ ] **Step 1: Wire detection into the catalogue load**

Add the import at the top of `assets/js/sanctorale.js`:

```javascript
import { detectMissalCapabilities } from './capabilities.js';
```

Add to `dom`: `newEntry: el('newEntryBtn')`. Add to `state`: `capabilities: new Map()`.

Add a helper beside `getJson`:

```javascript
/** What the user may do to a Missal; unknown Missals are read-only. */
function capabilityFor(missalId) {
    return state.capabilities.get(missalId) ?? { canEdit: false, canDelete: false };
}
```

At the end of `loadCatalogue()`, after `state.missals` and `state.baseRegion` are set and the sequence guard has passed:

```javascript
    // Capabilities are per Missal, so they are refreshed whenever the applicable
    // set changes — which is on every rite or calendar change, not once per page.
    state.capabilities = await detectMissalCapabilities({
        missals: applicableMissals(state.missals, state.calendar, state.baseRegion),
        rite: state.rite,
        baseRegion: state.baseRegion,
        userSub: config?.userSub ?? '',
        isGlobalAdmin: config?.isGlobalAdmin === true,
        checkAllowed: async (path) => {
            const result = await getJson(path);
            return result !== null && typeof result === 'object' && result.allowed === true;
        }
    });
    dom.newEntry?.classList.toggle(
        'd-none',
        ![...state.capabilities.values()].some((c) => c.canEdit)
    );
```

- [ ] **Step 2: Add the per-row Edit button**

In `renderTable`, replace the actions cell with:

```javascript
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-dark"
                        data-event-key="${escapeHtml(row.event_key)}" data-missal="${escapeHtml(row._missalId)}">
                    <i class="fas fa-magnifying-glass me-1"></i>${escapeHtml(i18n.view)}
                </button>
                ${capabilityFor(row._missalId).canEdit ? `
                <button type="button" class="btn btn-sm btn-outline-primary ms-1"
                        data-edit-key="${escapeHtml(row.event_key)}" data-missal="${escapeHtml(row._missalId)}">
                    <i class="fas fa-pen me-1"></i>${escapeHtml(i18n.edit)}
                </button>` : ''}
            </td>
```

and add the listener beside the existing one:

```javascript
    dom.tableBody.querySelectorAll('button[data-edit-key]').forEach((btn) => {
        btn.addEventListener('click', () => showDetail(btn.dataset.editKey, btn.dataset.missal, true));
    });
```

- [ ] **Step 3: Verify in the browser**

Run the local stack, log in as a global admin, and confirm every row shows Edit. Then log in as a user with
`editor` on `national_calendar:roman/US` only, select the US calendar, and confirm **only** the `US_2011` rows
show Edit while the 1970/2002/2008 rows beside them do not. This is the assertion the whole design turns on.

Run: `yarn lint && yarn vitest run`
Expected: clean, and the existing suite still passes.

- [ ] **Step 4: Commit**

```bash
git add assets/js/sanctorale.js
git commit -m "feat(sanctorale): gate edit affordances per Missal, per row"
```

---

### Task 7: The Structure tab — inputs, save, and the 409

**Files:**

- Modify: `assets/js/sanctorale.js` — `showDetail` (line 444), `renderStructure` (line 503)

**Interfaces:**

- Consumes: Tasks 2–4 (`gradeDisplayMode`, `gradeDisplayValue`, `buildPatch`, `writeJson`, `entryPath`, `ApiWriteError`), Task 6 (`capabilityFor`), Task 5's footer ids.
- Produces: `editState` module-level object `{eventKey, missalId, editing, readingsTier, original, capability}`;
  `readStructureForm() -> object`; `renderStructureForm(row) -> string`; `saveEntry()`; `reportWrite(data,
  appliedMessage) -> WriteOutcome`.

- [ ] **Step 1: Add the disposition reporter and the edit state**

Add the import:

```javascript
import { describeWriteOutcome } from './writeDisposition.js';
import {
    gradeDisplayMode, gradeDisplayValue, buildPatch, buildCreate,
    STRUCTURE_FIELDS, PayloadError
} from './sanctorale-payload.js';
```

Add beside `state`:

```javascript
/**
 * What the modal is currently editing. Separate from `state`, which is about the
 * composed view: this is torn down and rebuilt every time the modal opens.
 */
const editState = {
    eventKey: null,
    missalId: null,
    creating: false,
    editing: false,
    readingsTier: 'rite',
    /** The entry as loaded, which every diff is taken against. */
    original: { structure: {}, i18n: {}, readings: {} },
    capability: { canEdit: false, canDelete: false }
};

/**
 * Report what the API DID with a write, and say whether local state may follow.
 *
 * A response may carry `disposition: "submitted"` with nothing written, and the
 * handler's `success` string is built in both modes — so echoing it would tell an
 * editor their work was saved when it was only queued.
 *
 * @returns {{applied: boolean, message: string, severity: string}}
 */
function reportWrite(data, appliedMessage) {
    const outcome = describeWriteOutcome(data, i18n, appliedMessage);
    if (typeof window.showToast === 'function') {
        window.showToast(outcome.message, outcome.severity);
    } else {
        notice(outcome.severity === 'success' ? 'success' : 'info', escapeHtml(outcome.message));
    }
    return outcome;
}
```

- [ ] **Step 2: Render the Structure tab as a form**

Add beside `renderStructure`:

```javascript
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COLORS = ['white', 'red', 'green', 'purple', 'rose', 'morello', 'black'];

/**
 * The editable Structure panel.
 *
 * `calendar` is shown but not editable: the API derives it from the Missal and
 * refuses a row whose calendar is not the Missal's own. It is still submitted on
 * create, where `buildRow()` requires it.
 *
 * `grade_display` is a SELECT, not a text input, because the field has three
 * states and a text input has two. See sanctorale-payload.js.
 */
function renderStructureForm(row) {
    const mode = gradeDisplayMode(row?.grade_display);
    const option = (value, label, selected) =>
        `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.structure)}</h6>
        <div class="row g-3 mb-3">
            <div class="col-6 col-md-3">
                <label class="form-label small" for="entryMonth">${escapeHtml(i18n.date)}</label>
                <select class="form-select" id="entryMonth">
                    ${MONTHS.map((m) => option(String(m), monthName(m), m === row?.month)).join('')}
                </select>
            </div>
            <div class="col-6 col-md-2">
                <label class="form-label small" for="entryDay">&nbsp;</label>
                <input type="number" min="1" max="31" class="form-control" id="entryDay"
                       value="${escapeHtml(row?.day ?? '')}">
            </div>
            <div class="col-12 col-md-3">
                <label class="form-label small" for="entryGrade">${escapeHtml(i18n.grade)}</label>
                <select class="form-select" id="entryGrade">
                    ${Object.entries(i18n.grades ?? {}).map(([value, label]) =>
                        option(value, label, Number(value) === row?.grade)).join('')}
                </select>
            </div>
            <div class="col-12 col-md-4">
                <label class="form-label small" for="entryGradeDisplayMode">${escapeHtml(i18n.displaysAs)}</label>
                <select class="form-select" id="entryGradeDisplayMode">
                    ${option('default', i18n.gradeDisplayDefault, mode === 'default')}
                    ${option('none', i18n.gradeDisplayNone, mode === 'none')}
                    ${option('custom', i18n.gradeDisplayCustom, mode === 'custom')}
                </select>
                <input type="text" class="form-control mt-1 ${mode === 'custom' ? '' : 'd-none'}"
                       id="entryGradeDisplayText" value="${escapeHtml(mode === 'custom' ? row.grade_display : '')}">
            </div>
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryCommon">${escapeHtml(i18n.common)}</label>
                <select class="form-select" id="entryCommon" multiple size="6">
                    ${(config.commons ?? []).map((c) =>
                        option(c, c, (row?.common ?? []).includes(c))).join('')}
                </select>
            </div>
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryColor">${escapeHtml(i18n.color)}</label>
                <select class="form-select" id="entryColor" multiple size="6">
                    ${COLORS.map((c) => option(c, c, (row?.color ?? []).includes(c))).join('')}
                </select>
                <div class="form-check mt-2">
                    <input class="form-check-input" type="checkbox" id="entryIsDominical"
                           ${row?.is_dominical ? 'checked' : ''}>
                    <label class="form-check-label small" for="entryIsDominical">is_dominical</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="entryIsBvm"
                           ${row?.is_bvm ? 'checked' : ''}>
                    <label class="form-check-label small" for="entryIsBvm">is_bvm</label>
                </div>
            </div>
            <div class="col-12">
                <div class="small text-muted">${escapeHtml(i18n.calendarField)}</div>
                <div><code>${escapeHtml(row?.calendar ?? editState.calendarLabel ?? '')}</code></div>
            </div>
        </div>`;
}

/** The Structure panel's current values, in payload shape. */
function readStructureForm() {
    const selected = (id) => [...(el(id)?.selectedOptions ?? [])].map((o) => o.value);
    return {
        month: Number(el('entryMonth')?.value),
        day: Number(el('entryDay')?.value),
        grade: Number(el('entryGrade')?.value),
        grade_display: gradeDisplayValue(el('entryGradeDisplayMode')?.value, el('entryGradeDisplayText')?.value),
        common: selected('entryCommon'),
        color: selected('entryColor'),
        calendar: editState.original.structure.calendar ?? editState.calendarLabel ?? '',
        is_dominical: el('entryIsDominical')?.checked === true,
        is_bvm: el('entryIsBvm')?.checked === true
    };
}
```

Add the `commons` list to `sanctorale.php`'s config, from the schema's `LitCommon` enum (33 values, `Proper` first):

```php
            commons: <?php echo json_encode([
                'Proper', 'Dedication of a Church', 'Blessed Virgin Mary', 'Martyrs', 'Pastors',
                'Doctors', 'Virgins', 'Holy Men and Women',
                'Martyrs:For One Martyr', 'Martyrs:For Several Martyrs', 'Martyrs:For Missionary Martyrs',
                'Martyrs:For One Missionary Martyr', 'Martyrs:For Several Missionary Martyrs',
                'Martyrs:For a Virgin Martyr', 'Martyrs:For a Holy Woman Martyr',
                'Pastors:For a Pope', 'Pastors:For a Bishop', 'Pastors:For One Pastor',
                'Pastors:For Several Pastors', 'Pastors:For Founders of a Church',
                'Pastors:For One Founder', 'Pastors:For Several Founders', 'Pastors:For Missionaries',
                'Virgins:For One Virgin', 'Virgins:For Several Virgins',
                'Holy Men and Women:For Several Saints', 'Holy Men and Women:For One Saint',
                'Holy Men and Women:For an Abbot', 'Holy Men and Women:For a Monk',
                'Holy Men and Women:For a Nun', 'Holy Men and Women:For Religious',
                'Holy Men and Women:For Those Who Practiced Works of Mercy',
                'Holy Men and Women:For Educators', 'Holy Men and Women:For Holy Women'
            ], JSON_HEX_TAG); ?>,
```

- [ ] **Step 3: Open the modal in edit mode and save**

Change `showDetail(eventKey, missalId)` to `showDetail(eventKey, missalId, editing = false)`, record the edit state, choose the renderer, and toggle the footer:

```javascript
    editState.eventKey = eventKey;
    editState.missalId = missalId;
    editState.creating = false;
    editState.capability = capabilityFor(missalId);
    editState.editing = editing && editState.capability.canEdit;
    editState.original = { structure: { ...row }, i18n: {}, readings: {} };

    dom.detailFooter.classList.toggle('d-none', !editState.editing);
    dom.deleteEntry.classList.toggle('d-none', !editState.capability.canDelete);
    dom.formError.textContent = '';
```

and in the body assembly, use `editState.editing ? renderStructureForm(row) : renderStructure(row)`.

Add the `d-none` toggle for the custom text input:

```javascript
    el('entryGradeDisplayMode')?.addEventListener('change', (event) => {
        el('entryGradeDisplayText')?.classList.toggle('d-none', event.target.value !== 'custom');
    });
```

Add the save handler:

```javascript
/**
 * Save the modal.
 *
 * Local state is updated ONLY when the write reached disk. In queue mode the
 * response carries the proposed payload rather than a stored resource, so
 * writing it into `state.composed` would show the user an entry the server may
 * never store.
 */
async function saveEntry() {
    dom.formError.textContent = '';
    const next = {
        structure: readStructureForm(),
        i18n: readNamesForm(),
        readings: readReadingsForm()
    };

    let payload;
    try {
        payload = editState.creating
            ? buildCreate({ eventKey: editState.eventKey, next, readingsTier: editState.readingsTier })
            : buildPatch({ original: editState.original, next, readingsTier: editState.readingsTier });
    } catch (error) {
        if (error instanceof PayloadError) {
            dom.formError.textContent = error.message === 'nothing changed' ? i18n.noChanges : error.message;
            return;
        }
        throw error;
    }

    const path = entryPath(state.rite, editState.missalId, editState.eventKey);
    try {
        const data = await writeJson(editState.creating ? 'PUT' : 'PATCH', path, payload);
        const outcome = reportWrite(data, editState.creating ? i18n.created : i18n.saved);
        bootstrap.Modal.getOrCreateInstance(dom.detailModal).hide();
        if (outcome.applied) {
            await reload();
        }
    } catch (error) {
        if (!(error instanceof ApiWriteError)) throw error;
        if (error.status === 409) {
            // assertKeyIdentity() composes a message naming the editions and dates
            // that disagree. It belongs beside the day and month that caused it.
            dom.formError.textContent = `${i18n.conflictTitle}: ${error.body?.error ?? ''}`;
            return;
        }
        if (error.status === 403) {
            // The likeliest cause is a grant changing under a long-lived page.
            await loadCatalogue();
            dom.formError.textContent = i18n.permissionDenied;
            return;
        }
        dom.formError.textContent = i18n.saveFailed.replace('%s', error.body?.error ?? error.message);
    }
}
```

Add to `dom`: `detailFooter: el('detailModalFooter')`, `saveEntry: el('saveEntryBtn')`, `deleteEntry:
el('deleteEntryBtn')`, `formError: el('entryFormError')`, and in `init()`:
`dom.saveEntry?.addEventListener('click', saveEntry);`.

- [ ] **Step 4: Verify against the live stack**

Open a `US_2011` entry as a user with editor on it, change the day, save, and confirm: the toast reports
applied, the table re-renders with the new day, and the row moves to the correct month tab if the month
changed. Then change nothing and save — expect "Nothing has changed" inline, and no request.

Run: `yarn lint && yarn vitest run`

- [ ] **Step 5: Commit**

```bash
git add assets/js/sanctorale.js sanctorale.php
git commit -m "feat(sanctorale): edit an entry's structure"
```

---

### Task 8: The Names tab

**Files:**

- Modify: `assets/js/sanctorale.js` — `renderNames` (line 536), `showDetail`

**Interfaces:**

- Consumes: Task 7's `editState`, `saveEntry`.
- Produces: `renderNamesForm(payload, eventKey) -> string`; `readNamesForm() -> Object<string,string>`. Inputs carry `data-locale`.

- [ ] **Step 1: Render names as inputs**

```javascript
/**
 * Names per locale, editable.
 *
 * Every locale the Missal publishes gets an input, including the ones with no
 * entry: `fanOutKey()` will create them, and a curator filling one in is the
 * normal way a translation arrives. An empty input submits `""` — the corpus's
 * own record of "exists, not translated yet" — and never null or omission.
 */
function renderNamesForm(payload, eventKey) {
    const coverage = payload.coverage?.[eventKey] ?? { translated: [], empty: [], missing: [] };
    const rows = (payload.locales ?? []).map((loc) => {
        const value = payload.i18n?.[loc]?.[eventKey] ?? '';
        const badge = coverage.missing?.includes(loc)
            ? `<span class="badge bg-danger">${escapeHtml(i18n.missingLabel)}</span>`
            : coverage.empty?.includes(loc)
                ? `<span class="badge bg-warning text-dark">${escapeHtml(i18n.emptyLabel)}</span>`
                : `<span class="badge bg-success">${escapeHtml(i18n.translatedLabel)}</span>`;
        return `
            <tr>
                <td class="text-nowrap align-middle"><code>${escapeHtml(loc)}</code></td>
                <td><input type="text" class="form-control form-control-sm"
                           data-locale="${escapeHtml(loc)}" value="${escapeHtml(value)}"></td>
                <td class="text-end align-middle">${badge}</td>
            </tr>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.names)}
            <span class="badge bg-light text-dark border ms-1">${(payload.locales ?? []).length}</span>
        </h6>
        <table class="table table-sm mb-3"><tbody id="entryNames">${rows}</tbody></table>`;
}

/** The Names panel's current values. An empty input is '', which is a value. */
function readNamesForm() {
    const names = {};
    document.querySelectorAll('#entryNames input[data-locale]').forEach((input) => {
        names[input.dataset.locale] = input.value;
    });
    return names;
}
```

- [ ] **Step 2: Record the originals so the diff has something to compare**

In `showDetail`, once the names payload has resolved:

```javascript
    if (names.status === 'fulfilled') {
        // Only locales the file actually carries an entry for. A locale that is
        // ABSENT stays absent in the original, which is what lets diffLocaleMap
        // tell "cleared to blank" apart from "never had one".
        const coverage = names.value.coverage?.[eventKey] ?? {};
        for (const loc of names.value.locales ?? []) {
            if (coverage.missing?.includes(loc)) continue;
            editState.original.i18n[loc] = names.value.i18n?.[loc]?.[eventKey] ?? '';
        }
    }
```

and use `editState.editing ? renderNamesForm(names.value, eventKey) : renderNames(names.value, eventKey)`.

- [ ] **Step 3: Verify against the live stack**

Open a 1970 entry with 14 locales as a global admin. Change one name, save, and confirm the request body
carries **only that locale**. Then clear a translated name, save, and confirm the body carries `{"<loc>": ""}`
— not a removal, not `null`. Reload and confirm the name reads as blank with the `blank` badge, not `missing`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/sanctorale.js
git commit -m "feat(sanctorale): edit an entry's name in every locale"
```

---

### Task 9: The Readings tab

**Files:**

- Modify: `assets/js/sanctorale.js` — `readingRows` (line 571), `renderReadings` (line 602), `showDetail`

**Interfaces:**

- Consumes: Task 7's `editState`.
- Produces: `renderReadingsForm(payload) -> string`; `readReadingsForm() -> Object<string,object>`;
  `editState.readingsTier` set from the payload. Inputs carry `data-locale`, `data-schema` and `data-field`.

- [ ] **Step 1: Set the tier and render readings as inputs**

```javascript
/**
 * Readings per locale, editable.
 *
 * The tier decides what this panel may do, and the three cases are genuinely
 * different rather than degrees of the same one:
 *
 * - `missal` — the edition has its own lectionary folder; the write stays inside it.
 * - `rite`   — the write lands in the rite-wide `sanctorum` corpus, which every
 *              Missal of the rite reads. The note says so; a curator editing a
 *              1970 reading is editing what 2002 and 2008 also see.
 * - `none`   — the rite has no corpus at all (Ambrosian, API #957). Read-only,
 *              and the payload omits `readings` entirely: the handler REJECTS a
 *              body that carries it.
 */
function renderReadingsForm(payload) {
    if (payload.lectionary_available === false) {
        editState.readingsTier = 'none';
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(i18n.readingsNotWritable)}</div>`;
    }

    const tiers = payload.readings ?? [];
    editState.readingsTier = tiers.some((t) => t.tier === 'missal') ? 'missal' : 'rite';

    const panels = tiers.map((tier) => {
        const entries = tier.entries ?? {};
        const schemas = schemaKeysOf(entries);
        const field = (loc, schema, name, value) => `
            <div class="col-12 col-md-6 mb-2">
                <label class="form-label small text-muted">${escapeHtml(name)}</label>
                <input type="text" class="form-control form-control-sm"
                       data-locale="${escapeHtml(loc)}" data-schema="${escapeHtml(schema ?? '')}"
                       data-field="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}">
            </div>`;

        const localeBlock = (loc, schema) => {
            const readings = schema ? entries[loc]?.[schema] : entries[loc];
            if (!readings || typeof readings !== 'object') return '';
            return `
                <div class="mb-2"><code class="small">${escapeHtml(loc)}</code>
                    <div class="row">${Object.entries(readings)
                        .map(([name, value]) => field(loc, schema, name, value)).join('')}</div>
                </div>`;
        };

        const body = schemas.length
            ? schemas.map((schema) => `
                <div class="mb-3">
                    <div class="fw-semibold small mb-1">${escapeHtml(i18n.schemas?.[schema] ?? schema)}</div>
                    ${Object.keys(entries).map((loc) => localeBlock(loc, schema)).join('')}
                </div>`).join('')
            : Object.keys(entries).map((loc) => localeBlock(loc, null)).join('');

        return `
            <div class="mb-3">
                <div class="mb-1"><span class="badge bg-dark">${escapeHtml(tier.tier)}</span>
                    <code class="small ms-1">${escapeHtml(tier.source_id)}</code></div>
                ${tier.tier === 'rite'
                    ? `<div class="alert alert-warning py-1 px-2 small">${escapeHtml(i18n.readingsShared)}</div>` : ''}
                ${body}
            </div>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.readings)}</h6>
        <div id="entryReadings">${panels}</div>`;
}

/**
 * The Readings panel's values, rebuilt into the nested shape the API stores.
 * A blank input stays blank: a curated-as-blank citation is a decision.
 */
function readReadingsForm() {
    const readings = {};
    document.querySelectorAll('#entryReadings input[data-locale]').forEach((input) => {
        const { locale, schema, field } = input.dataset;
        readings[locale] = readings[locale] ?? {};
        if (schema) {
            readings[locale][schema] = readings[locale][schema] ?? {};
            readings[locale][schema][field] = input.value;
        } else {
            readings[locale][field] = input.value;
        }
    });
    return readings;
}
```

- [ ] **Step 2: Record the readings originals**

In `showDetail`, once the readings payload has resolved and only when it is fulfilled:

```javascript
    if (readings.status === 'fulfilled') {
        for (const tier of readings.value.readings ?? []) {
            for (const [loc, entry] of Object.entries(tier.entries ?? {})) {
                editState.original.readings[loc] = entry;
            }
        }
    } else {
        // A 404 means nothing is curated yet, which is a normal state, not a
        // failure — but there is then no original to diff against.
        editState.original.readings = {};
    }
```

and use `editState.editing ? renderReadingsForm(readings.value) : renderReadingsOutcome(readings)` — guarding
the fulfilled case, since `renderReadingsOutcome` also handles the 404.

- [ ] **Step 3: Verify against the live stack**

Open `AllSouls` (three schemata, every field `""`). Confirm every field renders as an empty input under its
own schema heading, save without changes, and expect "Nothing has changed" — **not** a payload full of blanks.
Then fill one citation, save, and confirm the body carries only that locale. Open an Ambrosian entry and
confirm the panel is read-only and a structure-only save sends no `readings` key.

- [ ] **Step 4: Commit**

```bash
git add assets/js/sanctorale.js
git commit -m "feat(sanctorale): edit an entry's readings, tier by tier"
```

---

### Task 10: Creating an entry

**Files:**

- Modify: `assets/js/sanctorale.js` — `init()`, `showDetail`

**Interfaces:**

- Consumes: Tasks 7–9 (`editState`, `saveEntry`, the three form renderers), Task 6 (`state.capabilities`), Task 5 (`#newEntryBtn`).
- Produces: `showCreate()`; DOM ids `#entryTargetMissal`, `#entryEventKey`.

- [ ] **Step 1: Add the create dialog**

```javascript
/**
 * Open the modal to create an entry.
 *
 * Two controls exist here and nowhere else. The Missal picker, because adding a
 * saint to US_2011 and adding one to the 1970 typica are different acts and the
 * UI must make the curator say which — it lists only editions they may edit. And
 * the event_key input, because the key is set once: the API refuses to rename
 * one, since a rename orphans its name and readings in every locale permanently.
 */
function showCreate() {
    const editable = applicableMissals(state.missals, state.calendar, state.baseRegion)
        .filter((m) => capabilityFor(m.missal_id).canEdit)
        .reverse(); // newest first; applicableMissals sorts oldest-first for compose()

    if (editable.length === 0) return;

    editState.eventKey = '';
    editState.missalId = editable[0].missal_id;
    editState.creating = true;
    editState.editing = true;
    editState.capability = capabilityFor(editState.missalId);
    editState.original = { structure: {}, i18n: {}, readings: {} };
    editState.calendarLabel = calendarLabelFor(editState.missalId);
    editState.readingsTier = 'rite';

    dom.detailTitle.textContent = i18n.newEntry;
    dom.detailFooter.classList.remove('d-none');
    dom.deleteEntry.classList.add('d-none');
    dom.formError.textContent = '';

    dom.detailBody.innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryTargetMissal">${escapeHtml(i18n.targetMissal)}</label>
                <select class="form-select" id="entryTargetMissal">
                    ${editable.map((m) => `<option value="${escapeHtml(m.missal_id)}">${escapeHtml(m.missal_id)}</option>`).join('')}
                </select>
            </div>
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryEventKey">${escapeHtml(i18n.eventKeyLabel)}</label>
                <input type="text" class="form-control" id="entryEventKey" pattern="[A-Za-z0-9]+">
                <div class="form-text">${escapeHtml(i18n.eventKeyHint)}</div>
            </div>
        </div>
        ${renderStructureForm(null)}
        ${renderNamesForm(namesPayloadFor(editState.missalId), '')}`;

    el('entryTargetMissal')?.addEventListener('change', (event) => {
        editState.missalId = event.target.value;
        editState.capability = capabilityFor(editState.missalId);
        editState.calendarLabel = calendarLabelFor(editState.missalId);
        showCreate.refreshNames?.();
    });

    bootstrap.Modal.getOrCreateInstance(dom.detailModal).show();
}

/**
 * The calendar label a Missal's rows carry.
 *
 * `buildRow()` refuses a payload whose `calendar` is not the Missal's own, and
 * every applicable Missal has at least one composed row to read it off.
 */
function calendarLabelFor(missalId) {
    return state.composed.find((r) => r._missalId === missalId)?.calendar ?? '';
}
```

- [ ] **Step 2: Capture the event key on save**

In `saveEntry`, before building the payload:

```javascript
    if (editState.creating) {
        editState.eventKey = el('entryEventKey')?.value.trim() ?? '';
        if (!/^[A-Za-z0-9]+$/.test(editState.eventKey)) {
            dom.formError.textContent = i18n.eventKeyHint;
            return;
        }
    }
```

Wire the button in `init()`: `dom.newEntry?.addEventListener('click', showCreate);`

- [ ] **Step 3: Verify against the live stack**

Create an entry in `US_2011` with a name in `en_US` only. Confirm: 201, the toast reports applied, the table
shows the new row on the right month tab, and the entry's detail shows the key present in every locale file —
blank in the ones you did not fill, which is `fanOutKey()` doing its job. Then create a key that another
Missal declares on a **different** date and confirm the 409 renders inline beside the day input rather than as
a toast.

- [ ] **Step 4: Commit**

```bash
git add assets/js/sanctorale.js
git commit -m "feat(sanctorale): create a celebration in a chosen Missal"
```

---

### Task 11: Deleting an entry

**Files:**

- Modify: `assets/js/sanctorale.js` — `init()`

**Interfaces:**

- Consumes: Task 7's `editState`, `reportWrite`; Task 5's `#deleteEntryBtn`.
- Produces: `deleteEntry()`.

- [ ] **Step 1: Add the delete handler**

```javascript
/**
 * Delete the open entry.
 *
 * Admin-only, and confirmed by naming the Missal: deleting from the edition that
 * WON reveals whatever it overrode, so the row does not disappear, it changes.
 *
 * `readings_retained` is reported when true. The rite-level corpus is shared, so
 * a key another Missal still declares keeps its readings — and a curator who
 * deleted an entry and found its readings intact would otherwise read that as a
 * failed delete.
 */
async function deleteEntry() {
    const confirmed = window.confirm(i18n.confirmDelete.replace('%s', editState.eventKey));
    if (!confirmed) return;

    const path = entryPath(state.rite, editState.missalId, editState.eventKey);
    try {
        const data = await writeJson('DELETE', path);
        const outcome = reportWrite(data, i18n.deleted);
        bootstrap.Modal.getOrCreateInstance(dom.detailModal).hide();
        if (outcome.applied) {
            if (data?.readings_retained === true && typeof window.showToast === 'function') {
                window.showToast(i18n.readingsRetained, 'info');
            }
            await reload();
        }
    } catch (error) {
        if (!(error instanceof ApiWriteError)) throw error;
        dom.formError.textContent = error.status === 403
            ? i18n.permissionDenied
            : i18n.saveFailed.replace('%s', error.body?.error ?? error.message);
    }
}
```

Wire it in `init()`: `dom.deleteEntry?.addEventListener('click', deleteEntry);`

Note: `window.confirm` is a browser modal. It is used here rather than a Bootstrap dialog because it matches
`admin-tests.js`'s existing `confirmDelete` pattern, and because it is the only dialog on this page. If the
e2e run needs it suppressed, Playwright's `page.on('dialog')` handles it.

- [ ] **Step 2: Verify against the live stack**

Delete a `US_2011` entry that **overrides** a 1970 entry (`StIsidore`) as an admin. Confirm the row does not
vanish but reverts to the 1970 definition with the override badge gone. Confirm the readings-retained note
appears, since 1970 still declares the key. Then delete an entry no other Missal declares and confirm the note
does not appear.

- [ ] **Step 3: Commit**

```bash
git add assets/js/sanctorale.js
git commit -m "feat(sanctorale): delete a celebration, reporting retained readings"
```

---

### Task 12: Retire `missals-editor.php`

**Files:**

- Delete: `missals-editor.php`, `assets/js/missals-editor.js`, `e2e/missals-editor.spec.ts`
- Modify: `includes/admin-blocks.php:39`, `layout/header.php:265`, `layout/head.php:34`, `layout/footer.php:143,148`, `includes/common.php:303`, `.gitignore`

**Interfaces:**

- Consumes: Tasks 7–11 (parity is the precondition).
- Produces: nothing.

- [ ] **Step 1: Delete the page and its assets**

```bash
git rm missals-editor.php assets/js/missals-editor.js e2e/missals-editor.spec.ts
```

- [ ] **Step 2: Repoint every reference**

- `includes/admin-blocks.php` — the sanctorale block's `'editUrl' => 'missals-editor.php'` becomes
  `'sanctorale.php'`, and the two-line comment above it about "the only thing that can edit until the sanctorale
  editor lands" goes with it.
- `layout/header.php:265` — `in_array($currentPage, ['sanctorale', 'missals-editor'], true)` becomes `'sanctorale' === $currentPage`.
- `layout/footer.php` — remove `'missals-editor'` from **both** the bootstrap-multiselect list (line 143) and the toastr list (line 148).
- `layout/head.php` — remove it from the multiselect stylesheet list if present.
- `includes/common.php:303` — remove `'missals-editor'` from the page list.
- `.gitignore` — remove the `!missals-editor.php` allowlist entry.

- [ ] **Step 3: Verify nothing still references it**

Run: `grep -rn "missals-editor" --include='*.php' --include='*.js' --include='*.ts' --include='*.md' . | grep -v node_modules | grep -v '^./docs/'`
Expected: no hits outside `docs/` (the design documents record the history on purpose).

Run: `composer parallel-lint && composer lint:fix && composer analyse && yarn lint`
Expected: clean.

- [ ] **Step 4: Confirm the dashboard in a browser**

Load `admin-dashboard.php` and confirm the Sanctorale card's Edit button opens `sanctorale.php`, and that the sidebar's Sanctorale entry is still marked active on that page.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sanctorale): retire the missals editor

Closes #503."
```

---

### Task 13: E2E coverage

**Files:**

- Create: `e2e/sanctorale-editor.spec.ts`
- Modify: `playwright.config.ts` if the spec needs a project it is not already picked up by

**Interfaces:**

- Consumes: `expectWriteApplied` from `e2e/support/writeMode.ts`; `gitRestoreApiData()` from `e2e/fixtures.ts`.
- Produces: nothing.

- [ ] **Step 1: Write the spec**

```typescript
/**
 * The sanctorale editor's write path.
 *
 * Two things only a browser can assert. First, that affordances are gated per
 * Missal: the composed table mixes editions, and a scoped grant must light up
 * one edition's rows and not its neighbours'. Second, that a write actually
 * reached disk — with SOURCEDATA_CHANGE_REQUESTS on, a queued write answers the
 * same 2xx and `response.ok()` passes while nothing was written (issue #502).
 */
import { test, expect } from '@playwright/test';
import { expectWriteApplied } from './support/writeMode';
import { gitRestoreApiData } from './fixtures';

test.describe('sanctorale editor', () => {
    test.afterAll(async () => { await gitRestoreApiData(); });

    test('a scoped editor sees Edit on their own edition only', async ({ page }) => {
        await page.goto('/sanctorale.php');
        await page.selectOption('#calendarSelect', 'US');
        await page.waitForSelector('#sanctoraleTableBody tr');

        const us = page.locator('tr', { has: page.locator('span.badge', { hasText: 'US_2011' }) });
        const typica = page.locator('tr', { has: page.locator('span.badge', { hasText: 'EDITIO_TYPICA_1970' }) });

        await expect(us.first().locator('button[data-edit-key]')).toBeVisible();
        await expect(typica.first().locator('button[data-edit-key]')).toHaveCount(0);
    });

    test('a structure edit is applied, not merely accepted', async ({ page }) => {
        await page.goto('/sanctorale.php');
        await page.selectOption('#calendarSelect', 'US');
        await page.locator('button[data-edit-key="StIsidore"]').click();

        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/StIsidore') && r.request().method() === 'PATCH');
        await page.fill('#entryDay', '16');
        await page.click('#saveEntryBtn');
        await expectWriteApplied(await write, 'PATCH StIsidore');

        await expect(page.locator('tr', { hasText: 'StIsidore' }).first()).toContainText('16');
    });

    test('a no-op save reports it inline and issues no request', async ({ page }) => {
        await page.goto('/sanctorale.php');
        await page.selectOption('#calendarSelect', 'US');
        await page.locator('button[data-edit-key="StIsidore"]').click();

        let requested = false;
        page.on('request', (r) => { if (r.method() === 'PATCH') requested = true; });
        await page.click('#saveEntryBtn');

        await expect(page.locator('#entryFormError')).not.toBeEmpty();
        expect(requested).toBe(false);
    });

    test('creating fans the key out into every locale file', async ({ page }) => {
        await page.goto('/sanctorale.php');
        await page.selectOption('#calendarSelect', 'US');
        await page.click('#newEntryBtn');

        await page.fill('#entryEventKey', 'E2ETestSaint');
        await page.selectOption('#entryMonth', '5');
        await page.fill('#entryDay', '20');
        await page.selectOption('#entryGrade', '3');
        await page.selectOption('#entryCommon', ['Pastors']);
        await page.selectOption('#entryColor', ['white']);
        await page.fill('#entryNames input[data-locale="en_US"]', 'E2E Test Saint');

        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/E2ETestSaint') && r.request().method() === 'PUT');
        await page.click('#saveEntryBtn');
        await expectWriteApplied(await write, 'PUT E2ETestSaint');

        await expect(page.locator('tr', { hasText: 'E2ETestSaint' })).toBeVisible();
    });

    test('deleting reports whether the readings survived', async ({ page }) => {
        await page.goto('/sanctorale.php');
        await page.selectOption('#calendarSelect', 'US');
        page.on('dialog', (d) => d.accept());
        await page.locator('button[data-edit-key="E2ETestSaint"]').click();

        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/E2ETestSaint') && r.request().method() === 'DELETE');
        await page.click('#deleteEntryBtn');
        await expectWriteApplied(await write, 'DELETE E2ETestSaint');

        await expect(page.locator('tr', { hasText: 'E2ETestSaint' })).toHaveCount(0);
    });
});
```

- [ ] **Step 2: Run the spec**

Run: `yarn test:ci:chromium --grep "sanctorale editor"`
Expected: PASS. If the scoped-editor test fails because the seeded identity is a global admin, seed the grant
the `rbac` project's setup uses and move that one test under `--project=rbac`.

- [ ] **Step 3: Commit**

```bash
git add e2e/sanctorale-editor.spec.ts
git commit -m "test(sanctorale): cover the editor's write path end to end"
```

---

### Task 14: Live-stack verification and the final check

**Files:** none — this task produces findings, and fixes for whatever it finds.

**Interfaces:**

- Consumes: everything.
- Produces: a verified page.

- [ ] **Step 1: Refresh the stored auth state**

Run: `yarn playwright test --project=setup`
Expected: `e2e/.auth/user.json` written. The states expire; a stale one fails every authenticated navigation in a way that looks like a page bug.

- [ ] **Step 2: Walk the page against the live stack**

Drive a real browser and confirm each of these, which is where phases 1–3's five defects were found:

- Deep-link into an entry (`#event=StIsidore`) and confirm the modal opens on the right month tab.
- Switch rite to Ambrosian mid-edit; confirm no stale Roman data survives, the readings panel is read-only, and the capability set is refreshed rather than carried over.
- Open `Assumption` and confirm the readings shown are the ones the API returns — API #958 means five of six
  locales carry Sts Peter and Paul's readings. **Do not "fix" this in the frontend**; confirm it renders
  faithfully and leave it.
- Confirm no `[object Object]` anywhere a reading nests.
- Change an entry's month, save, and confirm the row follows to its new tab rather than leaving the user on the tab it left.

- [ ] **Step 3: Run the full check**

Run: `composer parallel-lint && composer lint:fix && composer analyse && composer lint:md:fix && yarn typecheck && yarn format:md && yarn lint && yarn vitest run`
Expected: all clean.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(sanctorale): <what the browser found>"
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the write surface and its three server-side
behaviours (Tasks 3, 4, 10), per-Missal gating (Tasks 1, 6), the modal's three domains (Tasks 7, 8, 9), the
tri-state (Task 2), create and delete (Tasks 10, 11), the write path and its four error branches (Tasks 4, 7),
retirement (Task 12), testing (Tasks 1–4 unit, 13 e2e, 14 browser). The spec's "Out of scope" items appear
nowhere, which is correct.

**Type consistency.** `editState` is introduced in Task 7 and read in 8–11 with the same shape throughout.
`readingsTier` is `'missal' | 'rite' | 'none'` in the payload module, in `editState`, and in every test.
`capabilityFor()` returns `{canEdit, canDelete}` everywhere. `writeJson(method, path, body)` and
`entryPath(rite, missalId, eventKey)` keep their Task 4 signatures in Tasks 7, 10 and 11.
