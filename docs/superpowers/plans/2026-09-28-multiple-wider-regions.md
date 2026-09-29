# Multiple Wider Regions (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the extending page place a national calendar in several wider regions and save them as
`metadata.wider_regions`, aligned with LiturgicalCalendarAPI#1005.

**Architecture:** A new pure module, `widerRegions.js`, owns every read of the two API shapes (`wider_regions` /
legacy `wider_region`, and each region's `roster`) and the broadest-first ordering. The single text input becomes a
bootstrap-multiselect filled from that module; the payload class, the new-nation default and the wider-region edit
rights switch from one region to a list.

**Tech Stack:** Vanilla ES modules, jQuery + bootstrap-multiselect, PHP 8.4 templates with gettext, vitest (jsdom),
Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-multiple-wider-regions-design.md`

## Global Constraints

- Wider region name shape, as the API checks it: `^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$`.
- Order: broadest first — by roster length, descending, then by name; a region with no roster sorts by name after
  those with one.
- A region the nation already declares is always offered and kept selected, even if its roster no longer lists the
  nation or the region is not in `/calendars`.
- Reads accept both API shapes; saves send only `metadata.wider_regions`, never `wider_region`.
- The PR merges only after LiturgicalCalendarAPI#1005 is in the API's `development` branch.
- New UI strings go through `includes/messages.php` with `_()`; numbered placeholders if any (`%1$s`).
- Never skip git hooks (`--no-verify`); do not push without the user's request.
- JS unit tests: `yarn vitest run <file>`; all: `yarn test:unit`. Lint: `yarn lint`, `composer lint`,
  `composer lint:md`.

## Review Focus

1. **An API without #1005** (only `wider_region`, no `roster`): a loaded calendar must show its one region selected,
   and every region must be offered. → Task 1 tests `nationWiderRegions()` on the legacy shape and
   `eligibleWiderRegions()` with no roster.
2. **A declared region missing from `/calendars`** (deleted or renamed): it must stay offered and selected, not vanish
   and be dropped on save. → Task 1 test "keeps a declared region that /calendars does not list".
3. **A multi-word region name** (`Middle East`) must pass the payload check and order correctly. → Task 3 test.
4. **Switching nations** (Ireland, then Australia): the second nation must not inherit the first one's regions.
   → Task 6 E2E default test asserts Australia ends with none selected.
5. **A nation on no roster, declaring nothing:** the control is empty and the save sends `[]`, which the API accepts.
   → Task 1 (`eligibleWiderRegions()` returns `[]`) and Task 3 (payload accepts `[]`).

---

## File structure

| File                                                           | Responsibility                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `assets/js/widerRegions.js` (create)                           | Read both API shapes; order and filter regions for a nation     |
| `assets/js/__tests__/widerRegions.test.js`                     | Unit tests for the above                                        |
| `assets/js/widerRegionForNation.js` (modify)                   | `widerRegionsForNation()`: the default regions of a new nation  |
| `assets/js/__tests__/widerRegionForNation.test.js`             | Unit tests, rewritten for the list                              |
| `assets/js/NationalCalendarPayload.js` (modify)                | Validate and carry `metadata.wider_regions`                     |
| `assets/js/__tests__/NationalCalendarPayload.test.js` (create) | Unit tests for the metadata validation                          |
| `assets/js/widerRegionEditRights.js` (modify)                  | Membership as lists (`declaredRegions`)                         |
| `assets/js/__tests__/widerRegionEditRights.test.js` (modify)   | Tests for list membership                                       |
| `extending.php`, `includes/messages.php` (modify)              | The `<select multiple>` control and its strings                 |
| `assets/js/extending.js` (modify)                              | Wire the control: init, fill on load, default, save, membership |
| `e2e/national-calendar.spec.ts` (modify)                       | E2E for the control and the payload                             |

---

### Task 1: `widerRegions.js` — read both API shapes, order and filter

**Files:**

- Create: `assets/js/widerRegions.js`
- Test: `assets/js/__tests__/widerRegions.test.js`

**Interfaces:**

- Produces:
    - `nationWiderRegions(item: object|undefined): string[]`
    - `widerRegionRoster(region: object|undefined): string[]|null`
    - `orderWiderRegions(names: string[], regions: object[]|undefined): string[]`
    - `eligibleWiderRegions(nation: string, regions: object[]|undefined, declared: string[]): string[]`
    - Region items are `/calendars` `litcal_metadata.wider_regions[]`: `{ name: string, roster?: string[], … }`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { eligibleWiderRegions, nationWiderRegions, orderWiderRegions, widerRegionRoster } from '../widerRegions.js';

// Shaped like `litcal_metadata.wider_regions` from /calendars after API #1005, trimmed.
const REGIONS = [
    { name: 'Nordic', roster: ['DK', 'FI', 'IS', 'NO', 'SE'] },
    { name: 'Americas', roster: ['AR', 'BR', 'CA', 'MX', 'US', 'VE'] },
    { name: 'Europe', roster: ['AT', 'DE', 'DK', 'FI', 'IE', 'IT', 'NO', 'SE'] }
];

describe('nationWiderRegions', () => {
    it('reads the list', () => {
        expect(nationWiderRegions({ wider_regions: ['Europe', 'Nordic'] })).toEqual(['Europe', 'Nordic']);
        expect(nationWiderRegions({ wider_regions: [] })).toEqual([]);
    });

    it('reads the legacy string as a one-element list', () => {
        expect(nationWiderRegions({ wider_region: 'Europe' })).toEqual(['Europe']);
    });

    it('prefers the list when both are present', () => {
        expect(nationWiderRegions({ wider_regions: ['Europe', 'Nordic'], wider_region: 'Europe' })).toEqual(['Europe', 'Nordic']);
    });

    it('reads nothing from an empty string, a missing field or a missing item', () => {
        expect(nationWiderRegions({ wider_region: '' })).toEqual([]);
        expect(nationWiderRegions({})).toEqual([]);
        expect(nationWiderRegions(undefined)).toEqual([]);
    });
});

describe('widerRegionRoster', () => {
    it('reads the roster, or null when the API does not publish one', () => {
        expect(widerRegionRoster(REGIONS[0])).toEqual(['DK', 'FI', 'IS', 'NO', 'SE']);
        expect(widerRegionRoster({ name: 'Europe' })).toBeNull();
        expect(widerRegionRoster(undefined)).toBeNull();
    });
});

describe('orderWiderRegions', () => {
    it('puts the broadest region first', () => {
        expect(orderWiderRegions(['Nordic', 'Europe'], REGIONS)).toEqual(['Europe', 'Nordic']);
    });

    it('breaks a tie by name, and puts regions with no roster last, by name', () => {
        const regions = [{ name: 'B', roster: ['X'] }, { name: 'A', roster: ['Y'] }, { name: 'D' }, { name: 'C' }];
        expect(orderWiderRegions(['D', 'B', 'C', 'A'], regions)).toEqual(['A', 'B', 'C', 'D']);
    });
});

describe('eligibleWiderRegions', () => {
    it('offers the regions whose roster lists the nation, broadest first', () => {
        expect(eligibleWiderRegions('SE', REGIONS, [])).toEqual(['Europe', 'Nordic']);
        expect(eligibleWiderRegions('VE', REGIONS, [])).toEqual(['Americas']);
    });

    it('offers nothing to a nation on no roster that declares nothing', () => {
        expect(eligibleWiderRegions('AU', REGIONS, [])).toEqual([]);
    });

    it('keeps a declared region its roster no longer lists', () => {
        expect(eligibleWiderRegions('IT', REGIONS, ['Americas'])).toEqual(['Europe', 'Americas']);
    });

    it('keeps a declared region that /calendars does not list', () => {
        expect(eligibleWiderRegions('SE', REGIONS, ['Scandinavia'])).toEqual(['Europe', 'Nordic', 'Scandinavia']);
    });

    it('offers every region when the API publishes no roster', () => {
        const legacy = [{ name: 'Europe' }, { name: 'Americas' }];
        expect(eligibleWiderRegions('SE', legacy, [])).toEqual(['Americas', 'Europe']);
        expect(eligibleWiderRegions('SE', undefined, ['Europe'])).toEqual(['Europe']);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run assets/js/__tests__/widerRegions.test.js`
Expected: FAIL — `Failed to resolve import "../widerRegions.js"`.

- [ ] **Step 3: Write the module**

```js
/**
 * A national calendar's wider regions, as the API publishes them.
 *
 * Since LiturgicalCalendarAPI#1005 a national calendar declares a list of wider
 * regions (`wider_regions`), and each region in `/calendars` publishes its
 * `roster`: the nations eligible to declare it, calendar or not. Before it, a
 * nation declared one region (`wider_region`) and no roster was published. Every
 * read of either shape goes through this module, so the page works against both.
 *
 * @module widerRegions
 */

/**
 * The wider regions a national calendar declares.
 *
 * @param {object|undefined} item a `/calendars` national calendar item, or a calendar's `metadata`
 * @returns {string[]} most general first; empty when it declares none
 */
export function nationWiderRegions(item) {
    if (Array.isArray(item?.wider_regions)) return [...item.wider_regions];
    const legacy = item?.wider_region;
    return typeof legacy === 'string' && legacy !== '' ? [legacy] : [];
}

/**
 * The nations eligible to declare a wider region.
 *
 * @param {object|undefined} region a `/calendars` wider region item
 * @returns {string[]|null} ISO 3166-1 alpha-2 codes, or null when the API does not publish them
 */
export function widerRegionRoster(region) {
    return Array.isArray(region?.roster) ? region.roster : null;
}

/**
 * Wider region names, broadest first: by the length of their roster, then by name;
 * a region with no roster sorts by name after those with one. Overlapping regions
 * do not redefine the same celebration, so this order only has to be stable.
 *
 * @param {string[]} names
 * @param {object[]|undefined} regions `/calendars` `wider_regions`
 * @returns {string[]}
 */
export function orderWiderRegions(names, regions) {
    const size = new Map((regions ?? []).map(region => [region.name, widerRegionRoster(region)?.length ?? -1]));
    return [...names].sort((a, b) => ((size.get(b) ?? -1) - (size.get(a) ?? -1)) || a.localeCompare(b));
}

/**
 * The wider regions to offer a nation: those whose roster lists it, and every
 * region it already declares (so saving never drops a stored membership), broadest
 * first. When the API publishes no roster, every region is offered, and the API's
 * own check (422) is the guard.
 *
 * @param {string} nation ISO 3166-1 alpha-2 code
 * @param {object[]|undefined} regions `/calendars` `wider_regions`
 * @param {string[]} declared the regions the nation's calendar declares
 * @returns {string[]}
 */
export function eligibleWiderRegions(nation, regions, declared) {
    const all = regions ?? [];
    const withRoster = all.some(region => widerRegionRoster(region) !== null);
    const offered = all
        .filter(region => !withRoster || (widerRegionRoster(region) ?? []).includes(nation))
        .map(region => region.name);
    return orderWiderRegions([...new Set([...offered, ...declared])], all);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest run assets/js/__tests__/widerRegions.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Lint and commit**

```bash
yarn lint
git add assets/js/widerRegions.js assets/js/__tests__/widerRegions.test.js
git commit -m "feat(extending): read a nation's wider regions from either API shape (#1005)"
```

---

### Task 2: `widerRegionsForNation()` — every region a new nation belongs to

**Files:**

- Modify: `assets/js/widerRegionForNation.js` (whole file)
- Test: `assets/js/__tests__/widerRegionForNation.test.js` (whole file)

**Interfaces:**

- Consumes: `widerRegionRoster`, `orderWiderRegions` (Task 1).
- Produces: `widerRegionsForNation(widerRegions: object[]|undefined, nation: string): string[]`. The old
  `widerRegionForNation()` stays as a thin wrapper so the page keeps working until Task 5 switches its one caller and
  removes it.

- [ ] **Step 1: Rewrite the tests**

```js
import { describe, it, expect } from 'vitest';
import { widerRegionsForNation } from '../widerRegionForNation.js';

// After API #1005: each region publishes its roster.
const WITH_ROSTER = [
    { name: 'Americas', locales: ['en_CA', 'es_MX'], roster: ['CA', 'MX', 'US'] },
    { name: 'Europe', locales: ['it_IT'], roster: ['DK', 'IE', 'IT', 'SE'] },
    { name: 'Nordic', locales: [], roster: ['DK', 'SE'] }
];

// Before it: membership can only be inferred from the region subtag of each region's locales.
const WITHOUT_ROSTER = [
    { name: 'Americas', locales: ['en_CA', 'en_US', 'es_MX', 'fr_CA', 'pt_BR'] },
    { name: 'Asia', locales: ['zh_CN', 'ja_JP'] },
    { name: 'Europe', locales: ['de_AT', 'hr_HR', 'it_IT', 'nl_NL', 'fr_FR'] }
];

describe('widerRegionsForNation, from rosters', () => {
    it('suggests every region whose roster lists the nation, broadest first', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'SE')).toEqual(['Europe', 'Nordic']);
        expect(widerRegionsForNation(WITH_ROSTER, 'MX')).toEqual(['Americas']);
    });

    it('accepts a lowercase nation code', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'ie')).toEqual(['Europe']);
    });

    it('suggests nothing for a nation on no roster', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'AU')).toEqual([]);
    });
});

describe('widerRegionsForNation, without rosters', () => {
    it('infers the region from the region subtag of its locales', () => {
        expect(widerRegionsForNation(WITHOUT_ROSTER, 'JP')).toEqual(['Asia']);
        // fr_CA places Canada in the Americas; French does not place it in Europe.
        expect(widerRegionsForNation(WITHOUT_ROSTER, 'CA')).toEqual(['Americas']);
    });

    it('suggests every region that lists the nation', () => {
        const overlapping = [...WITHOUT_ROSTER, { name: 'Oceania', locales: ['en_US'] }];
        expect(widerRegionsForNation(overlapping, 'US')).toEqual(['Americas', 'Oceania']);
    });
});

it('suggests nothing without a nation or without metadata', () => {
    expect(widerRegionsForNation(WITH_ROSTER, '')).toEqual([]);
    expect(widerRegionsForNation(undefined, 'MX')).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run assets/js/__tests__/widerRegionForNation.test.js`
Expected: FAIL — `widerRegionsForNation is not a function` (the module still exports `widerRegionForNation`).

- [ ] **Step 3: Rewrite the module**

```js
/**
 * The wider regions a new national calendar most likely belongs to.
 *
 * Since LiturgicalCalendarAPI#1005, `/calendars` publishes each region's
 * `roster`, the nations eligible to declare it, so the answer is every region
 * whose roster lists the nation. An older API publishes no roster; membership is
 * then inferred from the region subtag of each region's `locales` (`es_MX` places
 * Mexico in the Americas). Either way it is a default for the form, not a rule:
 * the curator can change it, and the API has the last word.
 *
 * @module widerRegionForNation
 */

import { orderWiderRegions, widerRegionRoster } from './widerRegions.js';

/**
 * @param {Array<{name: string, locales?: string[], roster?: string[]}>} widerRegions `litcal_metadata.wider_regions`
 * @param {string} nation ISO 3166-1 alpha-2 code, e.g. `MX`
 * @returns {string[]} the regions the nation belongs to, broadest first; empty when none
 */
export function widerRegionsForNation(widerRegions, nation) {
    const target = String(nation ?? '').toUpperCase();
    const regions = widerRegions ?? [];
    if (target === '') return [];
    const withRoster = regions.some(region => widerRegionRoster(region) !== null);
    const matches = regions.filter(region => withRoster
        ? (widerRegionRoster(region) ?? []).includes(target)
        : (region.locales ?? []).some(locale => locale.split(/[_-]/).pop().toUpperCase() === target));
    return orderWiderRegions(matches.map(region => region.name), regions);
}

/**
 * The single region of a new nation, for the page's one-region input until it
 * becomes a multiselect; '' when there is none or more than one.
 *
 * @deprecated Removed in the same change that replaces the input.
 * @param {Array<{name: string, locales?: string[], roster?: string[]}>} widerRegions
 * @param {string} nation
 * @returns {string}
 */
export function widerRegionForNation(widerRegions, nation) {
    const regions = widerRegionsForNation(widerRegions, nation);
    return regions.length === 1 ? regions[0] : '';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest run assets/js/__tests__/widerRegionForNation.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
yarn lint
git add assets/js/widerRegionForNation.js assets/js/__tests__/widerRegionForNation.test.js
git commit -m "feat(extending): suggest every wider region a new nation belongs to (#1005)"
```

---

### Task 3: `NationalCalendarPayload` carries `wider_regions`

**Files:**

- Modify: `assets/js/NationalCalendarPayload.js` — `NationalCalendarPayloadMetadata` (constructor, around lines
  664-727) and the `export` block at the end of the file
- Test: `assets/js/__tests__/NationalCalendarPayload.test.js` (create)

**Interfaces:**

- Produces: `NationalCalendarPayloadMetadata` is exported; its instances carry `wider_regions: string[]` and no
  `wider_region`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { NationalCalendarPayloadMetadata } from '../NationalCalendarPayload.js';

const base = { nation: 'SE', locales: ['sv_SE'], missals: [] };

describe('NationalCalendarPayloadMetadata wider_regions', () => {
    it('carries a list of wider regions, in the order given', () => {
        const metadata = new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Europe', 'Nordic'] });
        expect(metadata.wider_regions).toEqual(['Europe', 'Nordic']);
        expect(metadata).not.toHaveProperty('wider_region');
    });

    it('accepts no wider region', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: [] }).wider_regions).toEqual([]);
    });

    it('accepts a name of several words', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Middle East'] }).wider_regions)
            .toEqual(['Middle East']);
    });

    it('requires the list', () => {
        expect(() => new NationalCalendarPayloadMetadata(base)).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: 'Europe' })).toThrow(/wider_regions/);
    });

    it('rejects a duplicate or a malformed name', () => {
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Europe', 'Europe'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['europe'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Middle  East'] })).toThrow(/wider_regions/);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run assets/js/__tests__/NationalCalendarPayload.test.js`
Expected: FAIL — `NationalCalendarPayloadMetadata is not a constructor` (not exported).

- [ ] **Step 3: Change the class**

In the constructor's JSDoc, replace the `metadata.wider_region` line with:

```js
     * @param {string[]} metadata.wider_regions The wider regions the calendar inherits from, most general first; may be empty.
```

Replace the required-property check:

```js
        if (
            false === metadata.hasOwnProperty('nation')
            || false === metadata.hasOwnProperty('locales')
            || false === metadata.hasOwnProperty('wider_regions')
            || false === metadata.hasOwnProperty('missals')
        ) {
            throw new Error('`metadata.nation`, `metadata.locales`, `metadata.wider_regions`, and `metadata.missals` parameters are required');
        }
```

Replace the whole `wider_region` string check and five-name regex (the block from
`if (typeof metadata.wider_region !== 'string')` through the `re2` test's closing brace) with:

```js
        // The API's shape for a wider region name; whether the region exists, and
        // lists this nation, is the API's own check (422 on save).
        const widerRegionName = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;
        if (
            false === Array.isArray(metadata.wider_regions)
            || metadata.wider_regions.some(name => typeof name !== 'string' || false === widerRegionName.test(name))
            || new Set(metadata.wider_regions).size !== metadata.wider_regions.length
        ) {
            throw new Error('`metadata.wider_regions` parameter must be an array of distinct wider region names');
        }
```

Replace the assignment `this.wider_region = metadata.wider_region;` with:

```js
        this.wider_regions = [...metadata.wider_regions];
```

Replace the export block at the end of the file:

```js
export {
    NationalCalendarPayload,
    NationalCalendarPayloadMetadata
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest run assets/js/__tests__/NationalCalendarPayload.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
yarn lint
git add assets/js/NationalCalendarPayload.js assets/js/__tests__/NationalCalendarPayload.test.js
git commit -m "feat(extending): a national calendar payload carries wider_regions (#1005)"
```

---

### Task 4: wider-region edit rights follow every region of a nation

**Files:**

- Modify: `assets/js/widerRegionEditRights.js` — the `WiderRegionMembership` typedef and its caveat (around lines
  28-37), and `nationMayJoinWiderRegion()` (around lines 60-73)
- Test: `assets/js/__tests__/widerRegionEditRights.test.js` — the `describe('wider region membership', …)` block

**Interfaces:**

- Produces: `WiderRegionMembership` is `{ members: string[], declaredRegions: Object<string, string[]> }`
  (`declaredRegion` is removed). `nationMayJoinWiderRegion(nation, region, membership)` keeps its signature.

- [ ] **Step 1: Update the fixtures and add the failing tests**

In the `describe('wider region membership', …)` block, replace the two fixture lines with:

```js
    const DECLARED = { CA: ['Americas'], US: ['Americas'], IT: ['Europe'], SE: ['Europe', 'Nordic'] };
    const AMERICAS = { members: ['CA', 'US'], declaredRegions: DECLARED };
    const EUROPE = { members: ['IT', 'HU', 'SE'], declaredRegions: DECLARED };
    const NORDIC = { members: ['SE'], declaredRegions: DECLARED };
```

and add, inside the same block:

```js
    it('lets an editor of a nation in two regions write its locales to both', () => {
        const swedenEditor = { isGlobalAdmin: false, nations: ['SE'], widerRegions: [] };
        expect(editsWiderRegionLocale(swedenEditor, 'Europe', 'sv_SE', EUROPE)).toBe(true);
        expect(editsWiderRegionLocale(swedenEditor, 'Nordic', 'sv_SE', NORDIC)).toBe(true);
    });

    it('admits a nation to a region it declares, even off that region\'s roster', () => {
        expect(nationMayJoinWiderRegion('SE', 'Nordic', { members: [], declaredRegions: DECLARED })).toBe(true);
    });

    it('keeps out a nation that declares only other regions', () => {
        expect(nationMayJoinWiderRegion('SE', 'Americas', AMERICAS)).toBe(false);
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run assets/js/__tests__/widerRegionEditRights.test.js`
Expected: FAIL — "keeps out a nation that declares only other regions" and "admits a nation to a region it declares"
fail, because `nationMayJoinWiderRegion()` still reads the removed `declaredRegion`.

- [ ] **Step 3: Change the module**

Replace the `WiderRegionMembership` typedef and its comment with:

```js
/**
 * What the page knows of wider region membership. Since LiturgicalCalendarAPI#1005
 * `/calendars` publishes each region's `roster`, so `members` is the region's full
 * list of eligible nations. Against an older API it is only the loaded region's own
 * list, and a nation that belongs to another region only by that region's list is
 * treated here as unassigned; the API has the last word.
 *
 * @typedef {Object} WiderRegionMembership
 * @property {string[]} members ISO codes on the region's roster
 * @property {Object<string, string[]>} declaredRegions nation => the wider regions its national calendar declares
 */
```

Replace `nationMayJoinWiderRegion()` and its doc comment with:

```js
/**
 * Whether a nation may take part in `region`: it is on the region's roster, or it
 * declares this region, or, as far as the page knows, it declares no region at all.
 *
 * @param {string} nation
 * @param {string} region
 * @param {?WiderRegionMembership} membership
 * @returns {boolean}
 */
export function nationMayJoinWiderRegion(nation, region, membership) {
    if ((membership?.members ?? []).includes(nation)) return true;
    const declared = membership?.declaredRegions?.[nation] ?? [];
    return declared.length === 0 || declared.includes(region);
}
```

Also update the module's top comment where it says "only when the nation belongs to this region, or to no region yet"
— it stays true; no change needed beyond checking it still reads correctly.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest run assets/js/__tests__/widerRegionEditRights.test.js`
Expected: PASS (all, including the 3 new tests).

- [ ] **Step 5: Commit**

```bash
yarn lint
git add assets/js/widerRegionEditRights.js assets/js/__tests__/widerRegionEditRights.test.js
git commit -m "feat(extending): wider-region edit rights follow every region of a nation (#1005)"
```

(`extending.js` still builds `declaredRegion`; Task 5 Step 7 switches it.)

---

### Task 5: the wider regions multiselect on the extending page

**Files:**

- Modify: `extending.php` — the `#associatedWiderRegion` block (around lines 437-458)
- Modify: `includes/messages.php` — after `'Wider Region'` (around line 246) and the
  `'Tooltip - Wider Region association'` entry (around line 402)
- Modify: `assets/js/extending.js` — the import (line 40), `defaultWiderRegionForNewNation()` (lines ~78-87), the
  holy-days multiselect init and the form reset listener (lines ~819-833), `updateRegionalCalendarForm()` (the
  `#associatedWiderRegion` assignment, line ~1749), `buildNationalCalendarPayload()` (lines ~2785-2806), and
  `widerRegionMembership()` (lines ~3210-3222)

**Interfaces:**

- Consumes: `nationWiderRegions`, `eligibleWiderRegions`, `widerRegionRoster` (Task 1); `widerRegionsForNation`
  (Task 2); `NationalCalendarPayload` metadata `wider_regions` (Task 3); `declaredRegions` (Task 4).
- Produces: a `<select id="associatedWiderRegions" multiple>` (the E2E specs of Task 6 target this id and the
  multiselect button `#associatedWiderRegions ~ .btn-group button.multiselect`).

- [ ] **Step 1: Add the strings**

In `includes/messages.php`, after the `'Wider Region'` entry:

```php
    /** translators: label of the list of wider regions a national calendar inherits from */
    'Wider regions'                                   => _('Wider regions'),
```

Replace the `'Tooltip - Wider Region association'` entry with:

```php
    /** translators: tooltip of the wider regions of a national calendar */
    'Tooltip - Wider regions association'             => _('The wider regions whose data this national calendar inherits. Only the wider regions that list this nation are offered.'),
```

Run `grep -rn "Tooltip - Wider Region association" --include=*.php --include=*.js .` — expected: no other use.

- [ ] **Step 2: Replace the control in `extending.php`**

Replace the block from `<?php $wrTooltip = htmlspecialchars(` through the national form's `</datalist>` with:

```php
                                        <?php $wrTooltip = htmlspecialchars(
                                            $messages['Tooltip - Wider regions association'],
                                            ENT_QUOTES | ENT_SUBSTITUTE,
                                            'UTF-8'
                                        ); ?>
                                        <label for="associatedWiderRegions"><?php
                                            echo $messages['Wider regions'];
                                        ?><i class="fas fa-info-circle ms-2 text-black"
                                            style="--bs-text-opacity: .3;" role="button"
                                            title="<?php echo $wrTooltip; ?>"></i></label>
                                        <?php // Filled per nation by extending.js: the regions whose roster lists it. ?>
                                        <select class="form-select" id="associatedWiderRegions" multiple="multiple" disabled></select>
```

Leave the wider-region form's own `#WiderRegionsList` datalist (around line 187) untouched: it belongs to
`#widerRegionCalendarName`.

- [ ] **Step 3: Initialise the multiselect and refresh it on reset**

After the `$('#nationalCalendarSettingHolydays').multiselect({ … });` call, add:

```js
    $('#associatedWiderRegions').multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        },
        maxHeight: 250
    });
```

In the `#nationalCalendarSettingsForm` `reset` listener, change the deferred refresh to redraw both:

```js
        setTimeout(() => {
            $('#nationalCalendarSettingHolydays').multiselect('refresh');
            $('#associatedWiderRegions').multiselect('refresh');
        });
```

- [ ] **Step 4: Add the fill helper and the new-nation default**

Replace the import on line 40, and delete the deprecated `widerRegionForNation()` wrapper (added in Task 2) from
`assets/js/widerRegionForNation.js`:

```js
import { widerRegionsForNation } from './widerRegionForNation.js';
import { eligibleWiderRegions, nationWiderRegions, widerRegionRoster } from './widerRegions.js';
```

Replace `defaultWiderRegionForNewNation()` and its comment with:

```js
/**
 * Fill the national calendar's wider regions control for `nation`: the regions
 * whose roster lists it, plus those it declares, broadest first, with `selected`
 * ones selected. The options are rebuilt for every nation, so one nation's
 * regions never carry over to the next.
 *
 * @param {string} nation ISO 3166-1 alpha-2 code
 * @param {string[]} selected the regions to select
 */
const fillWiderRegionsControl = (nation, selected) => {
    const select = document.querySelector('#associatedWiderRegions');
    if (!select) return;
    const names = eligibleWiderRegions(nation, LitCalMetadata.wider_regions, selected);
    select.replaceChildren(...names.map(name => new Option(name, name, false, selected.includes(name))));
    $(select).multiselect('rebuild');
};

/**
 * Default the wider regions of a national calendar being created: every region
 * whose roster lists the nation. Called after the settings form has been reset.
 */
const defaultWiderRegionsForNewNation = () => {
    fillWiderRegionsControl(API.key, widerRegionsForNation(LitCalMetadata.wider_regions, API.key));
};
```

Rename both call sites (`grep -n "defaultWiderRegionForNewNation" assets/js/extending.js`) to
`defaultWiderRegionsForNewNation()`.

- [ ] **Step 5: Fill the control when a national calendar loads**

In `updateRegionalCalendarForm()`, replace

```js
            document.querySelector('#associatedWiderRegion').value = metadata.wider_region;
```

with

```js
            fillWiderRegionsControl(API.key, nationWiderRegions(metadata));
```

- [ ] **Step 6: Save the list**

In `buildNationalCalendarPayload()`, replace

```js
    const widerRegion = document.querySelector('#associatedWiderRegion').value;
```

with

```js
    // Option order is already broadest first (fillWiderRegionsControl), which is the order the API applies.
    const widerRegions = Array.from(document.querySelector('#associatedWiderRegions').selectedOptions, ({ value }) => value);
```

and in the returned `metadata`, replace `wider_region: widerRegion,` with `wider_regions: widerRegions,`.

- [ ] **Step 7: Build membership from lists**

Replace `widerRegionMembership()` and its comment with:

```js
/**
 * Wider region membership as far as the page can know it: the region's roster
 * (from /calendars, or the loaded region file on an API that does not publish
 * it), and the regions each existing national calendar declares. See
 * WiderRegionMembership in widerRegionEditRights.js.
 *
 * @returns {import('./widerRegionEditRights.js').WiderRegionMembership}
 */
const widerRegionMembership = () => {
    const region = (LitCalMetadata.wider_regions ?? []).find(({ name }) => name === currentWiderRegion());
    return {
        members: widerRegionRoster(region) ?? loadedWiderRegionMembers,
        declaredRegions: Object.fromEntries(
            (LitCalMetadata.national_calendars ?? [])
                .map(item => [item.calendar_id, nationWiderRegions(item)])
                .filter(([, regions]) => regions.length > 0)
        )
    };
};
```

- [ ] **Step 8: Check nothing still reads the old control or field**

Run: `grep -n "associatedWiderRegion[^s]\|associatedWiderRegion$\|widerRegionForNation(\|declaredRegion\b" assets/js/*.js extending.php`
Expected: no output.

- [ ] **Step 9: Run the unit suite, the linters, and PHP checks**

```bash
node --check assets/js/extending.js
yarn test:unit
yarn lint
composer lint && composer parallel-lint && composer analyse
```

Expected: all pass.

- [ ] **Step 10: Look at it in the browser**

`extending.php` is bind-mounted as a single file, so recreate the container first:
`docker compose up -d --force-recreate litcal-frontend`. Open `/extending.php?choice=national`, logged in, and check:
the "Wider regions" multiselect is disabled until a nation is chosen; `IT` shows Europe selected; a new nation such as
`IE` starts with the regions whose roster lists it (Europe only against an API with #1005; against one without it,
Europe from the `en_IE` locale); `AU` starts with none. The control's enabled/disabled state follows the rest of the
settings form.

- [ ] **Step 11: Commit**

```bash
git add extending.php includes/messages.php assets/js/extending.js
git commit -m "feat(extending): a national calendar's wider regions as a multiselect (#1005)"
```

---

### Task 6: E2E specs

**Gate:** needs an API with #1005 at the stack's `litcal-api`. The local stack builds the API from
`../LiturgicalCalendarAPI`, which is on `development`; run this task once #1005 is merged there
(`git -C ../LiturgicalCalendarAPI pull && docker compose up -d --build --force-recreate litcal-api`). Writing the specs
can happen earlier; running them cannot.

**Files:**

- Modify: `e2e/national-calendar.spec.ts` — the UPDATE test's metadata assertions (around lines 166-180), the CREATE
  test's form-filling (around lines 388-397 and 430), the "default the wider region" test (lines 530-542), and "should
  have wider region selection" (lines 615-619)

**Interfaces:**

- Consumes: `#associatedWiderRegions` and its multiselect button (Task 5); `metadata.wider_regions` in the payload
  (Task 3).

- [ ] **Step 1: The UPDATE test asserts `wider_regions`**

Replace

```ts
            expect(capturedPayload.metadata).toHaveProperty('wider_region');
```

with

```ts
            expect(capturedPayload.metadata).toHaveProperty('wider_regions');
            expect(capturedPayload.metadata).not.toHaveProperty('wider_region');
```

and replace the two lines

```ts
            // Validate wider_region is one of the allowed values
            expect(VALID_WIDER_REGIONS).toContain(capturedPayload.metadata.wider_region);
```

with

```ts
            // The save carries the calendar's stored regions, unchanged: nothing here edits them.
            expect(capturedPayload.metadata.wider_regions).toEqual(stored.metadata.wider_regions);
```

`stored` is fetched earlier in the same test (`/data/nation/US?locale=en_US`). If `VALID_WIDER_REGIONS` is no longer
used in this file, remove it from the import on line 2.

- [ ] **Step 2: The CREATE test keeps the defaulted regions**

In the `page.evaluate` that sets form values, replace the block starting `// Set wider region dynamically from available
options` (the `widerRegionInput` lookup through its closing brace) with:

```ts
            // The wider regions keep their default: the regions whose roster lists the nation. Forcing
            // one that does not list it would be refused by the API (422).
            const widerRegionsSelect = document.querySelector('#associatedWiderRegions') as HTMLSelectElement;
            const widerRegions = widerRegionsSelect ? Array.from(widerRegionsSelect.selectedOptions, o => o.value) : [];
```

and in the object it returns, replace `widerRegion: widerRegionInput?.value || '',` with
`widerRegions: widerRegions,`.

- [ ] **Step 3: The default test works on the multiselect**

Replace the "should default the wider region of a new national calendar" test with:

```ts
    test('should default the wider regions of a new national calendar', async ({ page, extendingPage }) => {
        // English-language nations, so the General Roman Calendar is translated and the page
        // reaches its create path. Ireland has no calendar yet and is on Europe's roster.
        const selected = () => page.locator('#associatedWiderRegions')
            .evaluate((el: HTMLSelectElement) => Array.from(el.selectedOptions, o => o.value));

        await extendingPage.selectCalendar('#nationalCalendarName', 'IE');
        await expect.poll(selected, { timeout: 15000 }).toEqual(['Europe']);

        // No wider region lists Australia, so nothing is selected, and Ireland's regions do not linger.
        await extendingPage.selectCalendar('#nationalCalendarName', 'AU');
        await expect.poll(selected, { timeout: 15000 }).toEqual([]);
    });
```

- [ ] **Step 4: The presence test targets the multiselect**

Replace the body of "should have wider region selection" with:

```ts
        await expect(page.locator('#associatedWiderRegions')).toHaveAttribute('multiple', 'multiple');
        await expect(page.locator('#associatedWiderRegions ~ .btn-group button.multiselect')).toBeVisible();
```

- [ ] **Step 5: Typecheck, then run the national specs**

```bash
yarn typecheck
yarn playwright test e2e/national-calendar.spec.ts e2e/wider-region-calendar.spec.ts --project=chromium
```

Expected: all pass; the CREATE test may still skip on a nation whose language is not officially supported, as before.

- [ ] **Step 6: Commit**

```bash
git add e2e/national-calendar.spec.ts
git commit -m "test(e2e): a national calendar's wider regions as a list (#1005)"
```

---

### Task 7: finish

- [ ] **Step 1: Full checks**

```bash
yarn test:unit && yarn lint && yarn typecheck && composer lint && composer parallel-lint && composer analyse && composer lint:md
```

- [ ] **Step 2: Update `CLAUDE.md`**

No section describes the wider-region field today, so nothing needs changing unless the implementation added a
convention worth recording; if so, one short paragraph under "Important Patterns".

- [ ] **Step 3: Hand back to the user**

Do not push. Report the commits, test results, and that the PR must wait for LiturgicalCalendarAPI#1005 to reach the
API's `development` branch.
