# Admin Tests Page (Phase 2 — Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `admin-tests` page to `LiturgicalCalendarFrontend` that lets `test_editor`/admin users create, edit, delete, and view liturgical test
definitions via the existing `/tests` API, faithfully porting the UnitTestInterface editor (state-first, native CSS grid, no Isotope).

**Architecture:** A dedicated `admin-tests.php` (auth-gated page, config blob, list + two modals) plus a bespoke native-ESM module
`assets/js/admin-tests.js` (modeled on `admin-permissions.js`, with a clean generic/specific seam) and a ported, **state-first**
`assets/js/AssertionsBuilder.js` whose in-memory model is the single source of truth (`load()` populates it, `serialize()` reads it — never the DOM).
Per-row Edit/Delete buttons are gated against the caller's scopes from `GET /auth/test-scopes` (live since Phase 1); the API is the hard backstop.

**Tech Stack:** PHP 8.1+ (page), native ES modules (no bundler; importmap resolves `@liturgical-calendar/components-js`), Bootstrap 5 + FontAwesome 7
(already loaded), gettext (`_()`) for i18n, Vitest (new dev-dependency) for AssertionsBuilder unit tests, Playwright for e2e (route-stubbed specs in
`e2e/` + one real-seeded spec in `e2e/rbac/`).

## Global Constraints

- **Branch/PR:** work on the feature branch in an isolated git worktree; PR targets `development`, never `stable`. Commits are GPG-signed; never `--no-verify`.
- **No bundler:** `assets/js/admin-tests.js` is loaded automatically as `<script type="module">` by `layout/footer.php` (it is NOT in the non-module
  list `['admin-applications','admin-role-requests']`). `assets/css/admin-tests.css` is auto-loaded by `layout/head.php`. Do not edit footer/head
  loaders for these two files.
- **Imports:** `import { ApiClient, CalendarSelect, CalendarSelectFilter } from '@liturgical-calendar/components-js';` and `import {
  AssertionsBuilder, TestType, AssertType } from './AssertionsBuilder.js';`.
- **All API calls:** `credentials: 'include'`, `Accept: application/json`, and `Content-Type: application/json` on writes. Base URL from `window.AdminTestsConfig.apiUrl`.
- **RFC 3339 dates:** `expected_value` is always `YYYY-MM-DDT00:00:00+00:00` (UTC midnight) or `null`. Compute via `new Date(Date.UTC(year, month-1,
  day)).toISOString().split('T')[0] + 'T00:00:00+00:00'`.
- **Test name pattern (schema):** `^(?:[a-z_]+?_){0,1}[A-Z][a-zA-Z1-9]+[0-9]{0,2}(?:_vigil)?Test$`. `name` is the resource key for `PATCH/DELETE
  /tests/{name}` → render it **read-only when editing**.
- **Test types:** `exactCorrespondence`, `exactCorrespondenceSince` (requires `year_since`), `exactCorrespondenceUntil` (requires `year_until`),
  `variableCorrespondence`. Schema: `exactCorrespondence` and `variableCorrespondence` share the base shape (no pivot year); Since/Until each require
  their pivot year.
- **Assert shapes (schema):** `eventNotExists` → `expected_value: null`; `eventExists AND hasExpectedDate` → `expected_value: <RFC3339 string>`.
  Required keys per assertion: `year`, `expected_value`, `assert`, `assertion`. `comment` is optional.
- **Slider bounds:** 1970–2050 (the ported dual-range slider).
- **Markdown:** run `yarn lint:md` on any `.md` touched.
- **Lint:** run `yarn lint` (eslint) on JS changes before committing.
- **Toolchain:** this repo uses **Yarn 4 with the `node_modules` linker** (`.yarnrc.yml` sets `nodeLinker: node-modules`; it switched off PnP because
  Vite 7.2+/Playwright crash under PnP — which is exactly why Vitest works here). Use `yarn` for everything (`yarn install`, `yarn add -D <pkg>`,
  `yarn test:unit`, `yarn lint`, `yarn playwright test …`). Never use `npm`/`npx`/`package-lock.json`. After adding a dependency, commit `package.json`
  and `yarn.lock` only (`node_modules/`, `.yarn/*`, `.pnp.*` are git-ignored). The lockfile enforces `npmMinimalAgeGate: "7d"` (no packages published in
  the last 7 days) — the pinned `vitest`/`jsdom` versions below are old enough to satisfy it.

---

## File Structure

**Create:**

- `assets/js/AssertionsBuilder.js` — ported, state-first assertion model + renderer. Public API: `load()`, `generate()`, `serialize()`, `render()`, and mutators.
- `assets/js/admin-tests.js` — page module (bootstrap, list, editor glue, CRUD).
- `assets/css/multi-range-slider.css` — dual-range slider, ported verbatim from UnitTestInterface.
- `assets/css/admin-tests.css` — `@import`s the slider CSS + page-specific grid styles (auto-loaded by head.php).
- `admin-tests.php` — the page.
- `vitest.config.js` — Vitest config (jsdom env).
- `assets/js/__tests__/AssertionsBuilder.test.js` — unit tests.
- `e2e/admin-tests.spec.ts` — Playwright route-stubbed specs (gating + CRUD).
- `e2e/rbac/13-admin-tests-crud.spec.ts` — Playwright real-seeded spec (end-to-end confidence).

**Modify:**

- `includes/common.php:245` — add `'admin-tests'` to `$adminPages`.
- `layout/header.php` — add the sidebar nav link.
- `admin-dashboard.php` — add the dashboard card.
- `package.json` — add Vitest dev-dependency + `test:unit` script.

---

## Interfaces (authoritative signatures used across tasks)

`AssertionsBuilder` (in `assets/js/AssertionsBuilder.js`):

```text
new AssertionsBuilder({ locale = 'en' } = {})

// state (single source of truth)
.model = {
  name, event_key, description, test_type,
  applies_to: null | { national_calendar: id } | { diocesan_calendar: id },
  excludes:   null | object,
  year_since: null | number,
  year_until: null | number,
  assertions: Assertion[]   // {year, expected_value, assert, assertion, comment?}
}
.baseMonthDay = null | { month: number, day: number }
.event        = null | { event_key, name, grade, grade_lcl, month, day }

load(def): this                       // populate model from a LitCalTest object
setMeta({name, event_key, description, test_type, applies_to, excludes}): this
generate({ event, minYear, maxYear, pivotYear = null, excludedYears = [] }): this
serialize(): object                   // schema-valid LitCalTest
toggleAssert(year): this
setExpectedDate(year, iso): this
setAssertionText(year, text): this
setComment(year, text /* '' clears */): this
excludeYear(year): this
setPivot(year): this                  // re-split eventNotExists/eventExists for Since/Until
render(container): void               // build native-grid DOM into container
```

Enums exported: `TestType`, `AssertType`, `LitGrade`, plus `Assertion` class.

`admin-tests.js` generic seam (extraction candidates for a future factory):

```text
fetchJson(method, path, body?): Promise<any>      // wraps fetch with credentials + headers, throws {status, body}
gateByScope(scopeObj, scopes): boolean
deriveScope(appliesTo): { object_type, object_id }
renderTableRows(tests, scopesState): void
showModalAlert(modalEl, type, message): void
```

---

### Task 1: Vitest harness + AssertionsBuilder module scaffold

**Files:**

- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `assets/js/AssertionsBuilder.js`
- Test: `assets/js/__tests__/AssertionsBuilder.test.js`

**Interfaces:**

- Produces: a runnable `yarn test:unit`; the `AssertionsBuilder` module exporting `TestType`, `AssertType`, `LitGrade`, `Assertion`.

- [ ] **Step 1: Add Vitest dev-dependency and script**

Edit `package.json`: add to `devDependencies` (keep alphabetical where the file is) `"vitest": "^2.1.8"` and `"jsdom": "^25.0.1"`, and add to `scripts`:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 2: Create `vitest.config.js`**

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['assets/js/__tests__/**/*.test.js'],
        globals: true,
    },
});
```

- [ ] **Step 3: Install and write the failing test**

Run: `yarn install`

Create `assets/js/__tests__/AssertionsBuilder.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { TestType, AssertType, LitGrade, Assertion } from '../AssertionsBuilder.js';

describe('enums', () => {
    it('exposes the four test types', () => {
        expect(TestType.ExactCorrespondence).toBe('exactCorrespondence');
        expect(TestType.ExactCorrespondenceSince).toBe('exactCorrespondenceSince');
        expect(TestType.ExactCorrespondenceUntil).toBe('exactCorrespondenceUntil');
        expect(TestType.VariableCorrespondence).toBe('variableCorrespondence');
    });

    it('exposes the two assert types', () => {
        expect(AssertType.EventNotExists).toBe('eventNotExists');
        expect(AssertType.EventTypeExact).toBe('eventExists AND hasExpectedDate');
    });

    it('maps liturgical grades to strings', () => {
        expect(LitGrade.toString(LitGrade.FEAST)).toBe('FEAST');
    });
});

describe('Assertion', () => {
    it('omits comment when not provided', () => {
        const a = new Assertion(2024, null, AssertType.EventNotExists, 'x');
        expect('comment' in a).toBe(false);
        expect(a.year).toBe(2024);
    });

    it('keeps comment when provided', () => {
        const a = new Assertion(2024, null, AssertType.EventNotExists, 'x', 'note');
        expect(a.comment).toBe('note');
    });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `yarn test:unit`
Expected: FAIL — cannot resolve `../AssertionsBuilder.js` (module not created yet).

- [ ] **Step 5: Create the module with enums + Assertion**

Create `assets/js/AssertionsBuilder.js`:

```javascript
/**
 * State-first Assertions Builder for the admin-tests editor.
 * The in-memory model is the single source of truth; serialize() reads the
 * model, never the DOM. Ported from UnitTestInterface (Isotope removed,
 * contenteditable replaced by <textarea>).
 * @module AssertionsBuilder
 */

export const TestType = Object.freeze({
    ExactCorrespondence:      'exactCorrespondence',
    ExactCorrespondenceSince: 'exactCorrespondenceSince',
    ExactCorrespondenceUntil: 'exactCorrespondenceUntil',
    VariableCorrespondence:   'variableCorrespondence',
});

export const AssertType = Object.freeze({
    EventNotExists: 'eventNotExists',
    EventTypeExact: 'eventExists AND hasExpectedDate',
});

export const LitGrade = Object.freeze({
    WEEKDAY: 0, COMMEMORATION: 1, OPTIONAL_MEMORIAL: 2, MEMORIAL: 3,
    FEAST: 4, FEAST_OF_THE_LORD: 5, SOLEMNITY: 6, HIGHER_SOLEMNITY: 7,
    stringVals: ['weekday', 'commemoration', 'optional memorial', 'Memorial',
        'FEAST', 'FEAST OF THE LORD', 'SOLEMNITY', 'HIGHER SOLEMNITY'],
    toString: (n) => LitGrade.stringVals[parseInt(n, 10)],
});

/**
 * A single per-year assertion. `comment` is only set when non-empty so it is
 * omitted from serialization (matching the schema's optional `comment`).
 */
export class Assertion {
    constructor(year, expected_value, assert, assertion, comment = null) {
        this.year = year;
        this.expected_value = expected_value;
        this.assert = assert;
        this.assertion = assertion;
        if (comment !== null && comment !== '') {
            this.comment = comment;
        }
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn test:unit`
Expected: PASS (all three enum tests + both Assertion tests).

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock vitest.config.js assets/js/AssertionsBuilder.js assets/js/__tests__/AssertionsBuilder.test.js
git commit -m "test(admin-tests): scaffold Vitest + AssertionsBuilder enums and Assertion"
```

---

### Task 2: AssertionsBuilder — `load()` / `setMeta()` / `serialize()` round-trip

**Files:**

- Modify: `assets/js/AssertionsBuilder.js`
- Test: `assets/js/__tests__/AssertionsBuilder.test.js`

**Interfaces:**

- Consumes: `TestType`, `AssertType`, `Assertion` from Task 1.
- Produces: `AssertionsBuilder` class with `model`, `load(def)`, `setMeta(meta)`, `serialize()`. `serialize()` returns a schema-valid `LitCalTest`:
  always `{name, event_key, description, test_type, assertions}`; includes `year_since` only for `exactCorrespondenceSince`, `year_until` only for
  `exactCorrespondenceUntil`, `applies_to`/`excludes` only when set; each assertion includes `comment` only when present.

- [ ] **Step 1: Write the failing tests**

Append to `assets/js/__tests__/AssertionsBuilder.test.js`:

```javascript
import { AssertionsBuilder } from '../AssertionsBuilder.js';

const sampleExact = {
    name: 'StIgnatiusOfLoyolaTest',
    event_key: 'StIgnatiusOfLoyola',
    description: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31",
    test_type: 'exactCorrespondence',
    applies_to: { national_calendar: 'USA' },
    assertions: [
        { year: 2024, expected_value: '2024-07-31T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31" },
        { year: 2025, expected_value: '2025-07-31T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31", comment: 'note' },
    ],
};

const sampleSince = {
    name: 'SomeFeastTest',
    event_key: 'SomeFeast',
    description: "The FEAST of 'Some Feast' should fall on March 19",
    test_type: 'exactCorrespondenceSince',
    year_since: 2026,
    assertions: [
        { year: 2025, expected_value: null, assert: 'eventNotExists', assertion: "The FEAST of 'Some Feast' should not exist on March 19" },
        { year: 2026, expected_value: '2026-03-19T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The FEAST of 'Some Feast' should fall on March 19" },
    ],
};

describe('load + serialize round-trip', () => {
    it('round-trips an exactCorrespondence test (applies_to + comment preserved)', () => {
        const out = new AssertionsBuilder().load(sampleExact).serialize();
        expect(out).toEqual(sampleExact);
    });

    it('round-trips an exactCorrespondenceSince test (year_since preserved)', () => {
        const out = new AssertionsBuilder().load(sampleSince).serialize();
        expect(out).toEqual(sampleSince);
    });

    it('omits year_since/year_until/applies_to/excludes when not applicable', () => {
        const out = new AssertionsBuilder().load({
            name: 'BareTest', event_key: 'Bare', description: 'd',
            test_type: 'exactCorrespondence',
            assertions: [{ year: 2024, expected_value: null, assert: 'eventNotExists', assertion: 'd' }],
        }).serialize();
        expect('year_since' in out).toBe(false);
        expect('year_until' in out).toBe(false);
        expect('applies_to' in out).toBe(false);
        expect('excludes' in out).toBe(false);
    });

    it('setMeta updates name/description/event_key/test_type without touching assertions', () => {
        const b = new AssertionsBuilder().load(sampleExact);
        b.setMeta({ name: 'RenamedTest', description: 'new desc', test_type: 'variableCorrespondence' });
        const out = b.serialize();
        expect(out.name).toBe('RenamedTest');
        expect(out.description).toBe('new desc');
        expect(out.test_type).toBe('variableCorrespondence');
        expect(out.assertions).toHaveLength(2);
    });

    it('derives baseMonthDay from the first eventExists assertion', () => {
        const b = new AssertionsBuilder().load(sampleExact);
        expect(b.baseMonthDay).toEqual({ month: 7, day: 31 });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit`
Expected: FAIL — `AssertionsBuilder is not a constructor` / `.load is not a function`.

- [ ] **Step 3: Implement the class core**

Append to `assets/js/AssertionsBuilder.js`:

```javascript
const EMPTY_MODEL = () => ({
    name: '',
    event_key: '',
    description: '',
    test_type: TestType.ExactCorrespondence,
    applies_to: null,
    excludes: null,
    year_since: null,
    year_until: null,
    assertions: [],
});

export class AssertionsBuilder {
    constructor({ locale = 'en' } = {}) {
        this.locale = locale;
        this.model = EMPTY_MODEL();
        this.baseMonthDay = null;
        this.event = null;
    }

    /** Populate the model from an existing LitCalTest definition. */
    load(def) {
        this.model = EMPTY_MODEL();
        this.model.name = def.name ?? '';
        this.model.event_key = def.event_key ?? '';
        this.model.description = def.description ?? '';
        this.model.test_type = def.test_type ?? TestType.ExactCorrespondence;
        this.model.applies_to = def.applies_to ?? null;
        this.model.excludes = def.excludes ?? null;
        this.model.year_since = def.year_since ?? null;
        this.model.year_until = def.year_until ?? null;
        this.model.assertions = (def.assertions ?? []).map(
            (a) => new Assertion(a.year, a.expected_value, a.assert, a.assertion, a.comment ?? null)
        );
        this.baseMonthDay = AssertionsBuilder.#deriveBaseMonthDay(this.model.assertions);
        return this;
    }

    /** Update editor-form metadata (never touches the assertions array). */
    setMeta({ name, event_key, description, test_type, applies_to, excludes } = {}) {
        if (name !== undefined) this.model.name = name;
        if (event_key !== undefined) this.model.event_key = event_key;
        if (description !== undefined) this.model.description = description;
        if (test_type !== undefined) this.model.test_type = test_type;
        if (applies_to !== undefined) this.model.applies_to = applies_to;
        if (excludes !== undefined) this.model.excludes = excludes;
        return this;
    }

    /** Produce a schema-valid LitCalTest object from the model. */
    serialize() {
        const m = this.model;
        const out = {
            name: m.name,
            event_key: m.event_key,
            description: m.description,
            test_type: m.test_type,
        };
        if (m.applies_to) out.applies_to = m.applies_to;
        if (m.excludes) out.excludes = m.excludes;
        if (m.test_type === TestType.ExactCorrespondenceSince && m.year_since !== null) {
            out.year_since = m.year_since;
        }
        if (m.test_type === TestType.ExactCorrespondenceUntil && m.year_until !== null) {
            out.year_until = m.year_until;
        }
        out.assertions = m.assertions.map((a) => {
            const item = {
                year: a.year,
                expected_value: a.expected_value,
                assert: a.assert,
                assertion: a.assertion,
            };
            if ('comment' in a) item.comment = a.comment;
            return item;
        });
        return out;
    }

    static #deriveBaseMonthDay(assertions) {
        const first = assertions.find((a) => a.expected_value);
        if (!first) return null;
        const d = new Date(first.expected_value);
        if (Number.isNaN(d.getTime())) return null;
        return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    }
}
```

> Note on key order: `serialize()` emits `applies_to`/`excludes` before `year_since`/`year_until`. The round-trip tests use `toEqual`
> (order-insensitive); the sample objects above also list keys in that order for readability.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: PASS (round-trip, omission, setMeta, baseMonthDay).

- [ ] **Step 5: Commit**

```bash
git add assets/js/AssertionsBuilder.js assets/js/__tests__/AssertionsBuilder.test.js
git commit -m "feat(admin-tests): AssertionsBuilder model load/setMeta/serialize round-trip"
```

---

### Task 3: AssertionsBuilder — `generate()` per test type

**Files:**

- Modify: `assets/js/AssertionsBuilder.js`
- Test: `assets/js/__tests__/AssertionsBuilder.test.js`

**Interfaces:**

- Consumes: model from Task 2.
- Produces: `generate({ event, minYear, maxYear, pivotYear, excludedYears })` that rebuilds `model.assertions` over `[minYear, maxYear]` (skipping
  `excludedYears`), sets `model.description`, `baseMonthDay`, and `model.year_since`/`year_until` from `pivotYear`. Rules: ExactCorrespondence → all
  `EventTypeExact`; Since → years `< pivot` are `EventNotExists`; Until → years `> pivot` are `EventNotExists`; Variable → all `EventTypeExact`
  (toggled later per-year). `event` shape: `{ event_key, name, grade, grade_lcl, month, day }`.

- [ ] **Step 1: Write the failing tests**

Append to the test file:

```javascript
const event = { event_key: 'StIgnatiusOfLoyola', name: 'Saint Ignatius of Loyola', grade: 3, grade_lcl: 'Memorial', month: 7, day: 31 };

describe('generate', () => {
    it('exactCorrespondence: every year asserts eventExists with a UTC midnight date', () => {
        const b = new AssertionsBuilder({ locale: 'en' });
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondence' });
        b.generate({ event, minYear: 2023, maxYear: 2025 });
        const out = b.serialize();
        expect(out.assertions.map((a) => a.year)).toEqual([2023, 2024, 2025]);
        expect(out.assertions.every((a) => a.assert === 'eventExists AND hasExpectedDate')).toBe(true);
        expect(out.assertions[1].expected_value).toBe('2024-07-31T00:00:00+00:00');
        expect(out.description).toBe("The Memorial of 'Saint Ignatius of Loyola' should fall on July 31");
    });

    it('exactCorrespondenceSince: years before the pivot assert eventNotExists', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondenceSince' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2025 });
        const out = b.serialize();
        expect(out.year_since).toBe(2025);
        expect(out.assertions.find((a) => a.year === 2024).assert).toBe('eventNotExists');
        expect(out.assertions.find((a) => a.year === 2024).expected_value).toBe(null);
        expect(out.assertions.find((a) => a.year === 2025).assert).toBe('eventExists AND hasExpectedDate');
        expect(out.assertions.find((a) => a.year === 2024).assertion)
            .toBe("The Memorial of 'Saint Ignatius of Loyola' should not exist on July 31");
    });

    it('exactCorrespondenceUntil: years after the pivot assert eventNotExists', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondenceUntil' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2025 });
        const out = b.serialize();
        expect(out.year_until).toBe(2025);
        expect(out.assertions.find((a) => a.year === 2026).assert).toBe('eventNotExists');
        expect(out.assertions.find((a) => a.year === 2025).assert).toBe('eventExists AND hasExpectedDate');
    });

    it('skips excluded years', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondence' });
        b.generate({ event, minYear: 2023, maxYear: 2025, excludedYears: [2024] });
        expect(b.serialize().assertions.map((a) => a.year)).toEqual([2023, 2025]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit`
Expected: FAIL — `.generate is not a function`.

- [ ] **Step 3: Implement `generate()` + helpers**

Add these methods inside the `AssertionsBuilder` class (before the closing brace):

```javascript
    /** Build description text from an event, e.g. "The Memorial of 'X' should fall on July 31". */
    static #describe(event, locale) {
        const grade = event.grade_lcl ?? '';
        let onDate = 'the expected date';
        if (event.month && event.day) {
            const d = new Date(Date.UTC(1970, Number(event.month) - 1, Number(event.day)));
            onDate = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
        }
        return `The ${grade} of '${event.name}' should fall on ${onDate}`;
    }

    /** RFC 3339 UTC-midnight string for an event's month/day in a given year. */
    static #expectedValue(year, month, day) {
        const iso = new Date(Date.UTC(year, Number(month) - 1, Number(day))).toISOString();
        return `${iso.split('T')[0]}T00:00:00+00:00`;
    }

    /**
     * Rebuild the assertions array from an event, a year range, and the test type.
     * @param {{event:object, minYear:number, maxYear:number, pivotYear?:number|null, excludedYears?:number[]}} opts
     */
    generate({ event, minYear, maxYear, pivotYear = null, excludedYears = [] }) {
        this.event = event;
        this.baseMonthDay = (event.month && event.day)
            ? { month: Number(event.month), day: Number(event.day) }
            : null;
        const description = AssertionsBuilder.#describe(event, this.locale);
        this.model.description = description;
        this.model.event_key = event.event_key;

        this.model.year_since = null;
        this.model.year_until = null;
        if (this.model.test_type === TestType.ExactCorrespondenceSince) {
            this.model.year_since = pivotYear;
        } else if (this.model.test_type === TestType.ExactCorrespondenceUntil) {
            this.model.year_until = pivotYear;
        }

        const notExistsAssertion = description.replace('should fall on', 'should not exist on');
        const excluded = new Set(excludedYears.map(Number));
        const assertions = [];
        for (let year = minYear; year <= maxYear; year++) {
            if (excluded.has(year)) continue;
            let notExists = false;
            if (this.model.test_type === TestType.ExactCorrespondenceSince && pivotYear !== null) {
                notExists = year < pivotYear;
            } else if (this.model.test_type === TestType.ExactCorrespondenceUntil && pivotYear !== null) {
                notExists = year > pivotYear;
            }
            if (notExists || !this.baseMonthDay) {
                assertions.push(new Assertion(year, null, AssertType.EventNotExists, notExistsAssertion));
            } else {
                const ev = AssertionsBuilder.#expectedValue(year, this.baseMonthDay.month, this.baseMonthDay.day);
                assertions.push(new Assertion(year, ev, AssertType.EventTypeExact, description));
            }
        }
        this.model.assertions = assertions;
        return this;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: PASS (all four generate tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/AssertionsBuilder.js assets/js/__tests__/AssertionsBuilder.test.js
git commit -m "feat(admin-tests): AssertionsBuilder.generate per-test-type assertion rules"
```

---

### Task 4: AssertionsBuilder — per-year mutators

**Files:**

- Modify: `assets/js/AssertionsBuilder.js`
- Test: `assets/js/__tests__/AssertionsBuilder.test.js`

**Interfaces:**

- Produces: `toggleAssert(year)`, `setExpectedDate(year, iso)`, `setAssertionText(year, text)`, `setComment(year, text)`, `excludeYear(year)`,
  `setPivot(year)`. `toggleAssert` flips an assertion between `EventTypeExact` (restoring `expected_value` from `baseMonthDay`) and `EventNotExists`
  (null + sentence swap). `setComment('')` removes the comment.

- [ ] **Step 1: Write the failing tests**

Append:

```javascript
describe('mutators', () => {
    const build = () => {
        const b = new AssertionsBuilder();
        b.setMeta({ test_type: 'variableCorrespondence' });
        b.generate({ event, minYear: 2024, maxYear: 2026 });
        return b;
    };

    it('toggleAssert flips eventExists -> eventNotExists and back', () => {
        const b = build();
        b.toggleAssert(2025);
        let a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventNotExists');
        expect(a.expected_value).toBe(null);
        expect(a.assertion).toContain('should not exist on');
        b.toggleAssert(2025);
        a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventExists AND hasExpectedDate');
        expect(a.expected_value).toBe('2025-07-31T00:00:00+00:00');
        expect(a.assertion).toContain('should fall on');
    });

    it('setExpectedDate updates the RFC3339 value', () => {
        const b = build();
        b.setExpectedDate(2024, '2024-08-01T00:00:00+00:00');
        expect(b.model.assertions.find((x) => x.year === 2024).expected_value).toBe('2024-08-01T00:00:00+00:00');
    });

    it('setAssertionText and setComment work; empty comment removes it', () => {
        const b = build();
        b.setAssertionText(2024, 'custom sentence');
        expect(b.model.assertions.find((x) => x.year === 2024).assertion).toBe('custom sentence');
        b.setComment(2024, 'a note');
        expect(b.model.assertions.find((x) => x.year === 2024).comment).toBe('a note');
        b.setComment(2024, '');
        expect('comment' in b.model.assertions.find((x) => x.year === 2024)).toBe(false);
    });

    it('excludeYear removes the assertion', () => {
        const b = build();
        b.excludeYear(2025);
        expect(b.model.assertions.map((x) => x.year)).toEqual([2024, 2026]);
    });

    it('setPivot re-splits a Since test', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ test_type: 'exactCorrespondenceSince' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2024 });
        b.setPivot(2026);
        expect(b.model.year_since).toBe(2026);
        expect(b.model.assertions.find((x) => x.year === 2024).assert).toBe('eventNotExists');
        expect(b.model.assertions.find((x) => x.year === 2026).assert).toBe('eventExists AND hasExpectedDate');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit`
Expected: FAIL — `.toggleAssert is not a function`.

- [ ] **Step 3: Implement the mutators**

Add inside the class:

```javascript
    #find(year) {
        return this.model.assertions.find((a) => a.year === year) ?? null;
    }

    toggleAssert(year) {
        const a = this.#find(year);
        if (!a) return this;
        if (a.assert === AssertType.EventTypeExact) {
            a.assert = AssertType.EventNotExists;
            a.expected_value = null;
            a.assertion = a.assertion.replace('should fall on', 'should not exist on');
        } else {
            a.assert = AssertType.EventTypeExact;
            if (this.baseMonthDay) {
                a.expected_value = AssertionsBuilder.#expectedValue(year, this.baseMonthDay.month, this.baseMonthDay.day);
            }
            a.assertion = a.assertion.replace('should not exist on', 'should fall on');
        }
        return this;
    }

    setExpectedDate(year, iso) {
        const a = this.#find(year);
        if (a) a.expected_value = iso;
        return this;
    }

    setAssertionText(year, text) {
        const a = this.#find(year);
        if (a) a.assertion = text;
        return this;
    }

    setComment(year, text) {
        const a = this.#find(year);
        if (!a) return this;
        if (text === '' || text === null || text === undefined) {
            delete a.comment;
        } else {
            a.comment = text;
        }
        return this;
    }

    excludeYear(year) {
        this.model.assertions = this.model.assertions.filter((a) => a.year !== year);
        return this;
    }

    setPivot(year) {
        if (this.model.test_type === TestType.ExactCorrespondenceSince) {
            this.model.year_since = year;
        } else if (this.model.test_type === TestType.ExactCorrespondenceUntil) {
            this.model.year_until = year;
        }
        this.model.assertions.forEach((a) => {
            const notExists = this.model.test_type === TestType.ExactCorrespondenceSince
                ? a.year < year
                : a.year > year;
            const isNot = a.assert === AssertType.EventNotExists;
            if (notExists !== isNot) {
                this.toggleAssert(a.year);
            }
        });
        return this;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: PASS (all mutator tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/AssertionsBuilder.js assets/js/__tests__/AssertionsBuilder.test.js
git commit -m "feat(admin-tests): AssertionsBuilder per-year mutators (toggle/date/comment/exclude/pivot)"
```

---

### Task 5: AssertionsBuilder — `render()` native CSS grid

**Files:**

- Modify: `assets/js/AssertionsBuilder.js`
- Test: `assets/js/__tests__/AssertionsBuilder.test.js`

**Interfaces:**

- Produces: `render(container)` clears `container` and appends one card per assertion. Each card carries `data-year`, a `.assert` span showing
  `assert`, a `.toggleAssert` button (`fa-repeat`), a `.expectedValue` span with `data-value`, an `.editDate` button (`fa-pen-to-square`, `disabled`
  when no date), a **`<textarea class="assertionText">`** (NOT contenteditable) holding the sentence, and a `.comment` button (`fa-comment-dots` when
  a comment exists, else `fa-comment-medical`). Color classes: `bg-success text-white` (exists) / `bg-warning text-dark` (not-exists). Cards live in a
  parent with class `assertions-grid` (native CSS grid).

- [ ] **Step 1: Write the failing tests (jsdom)**

Append:

```javascript
describe('render', () => {
    it('renders one card per assertion with textarea, toggle, and color classes', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ test_type: 'variableCorrespondence' });
        b.generate({ event, minYear: 2024, maxYear: 2025 });
        b.toggleAssert(2025); // make 2025 eventNotExists
        const container = document.createElement('div');
        b.render(container);

        const cards = container.querySelectorAll('[data-year]');
        expect(cards).toHaveLength(2);

        const card2024 = container.querySelector('[data-year="2024"]');
        expect(card2024.querySelector('.assert').textContent).toBe('eventExists AND hasExpectedDate');
        expect(card2024.querySelector('textarea.assertionText')).not.toBeNull();
        expect(card2024.querySelector('.toggleAssert')).not.toBeNull();
        expect(card2024.querySelector('.expectedValue').getAttribute('data-value')).toBe('2024-07-31T00:00:00+00:00');

        const card2025 = container.querySelector('[data-year="2025"]');
        expect(card2025.querySelector('.assert').textContent).toBe('eventNotExists');
        expect(card2025.querySelector('.editDate').classList.contains('disabled')).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit`
Expected: FAIL — `.render is not a function`.

- [ ] **Step 3: Implement `render()`**

Add inside the class:

```javascript
    #formatDate(iso) {
        if (!iso) return '---';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '---';
        return new Intl.DateTimeFormat(this.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
    }

    render(container) {
        container.innerHTML = '';
        container.classList.add('assertions-grid');

        this.model.assertions.forEach((a) => {
            const notExists = a.assert === AssertType.EventNotExists;
            const bg = notExists ? 'bg-warning' : 'bg-success';
            const fg = notExists ? 'text-dark' : 'text-white';

            const card = document.createElement('div');
            card.className = `assertion-card d-flex flex-column border ${bg} ${fg}`;
            card.dataset.year = String(a.year);

            const yearP = document.createElement('p');
            yearP.className = 'text-center mb-0 fw-bold testYear';
            yearP.textContent = String(a.year);
            card.appendChild(yearP);

            // ASSERT THAT row
            const assertRow = document.createElement('div');
            assertRow.className = 'd-flex justify-content-between align-items-center px-1 border-bottom';
            const assertLabel = document.createElement('span');
            assertLabel.className = 'fw-bold small';
            assertLabel.textContent = 'ASSERT:';
            const assertVal = document.createElement('span');
            assertVal.className = 'assert small text-end';
            assertVal.textContent = a.assert;
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'btn btn-xs btn-danger ms-1 toggleAssert';
            toggleBtn.innerHTML = '<i class="fas fa-repeat" aria-hidden="true"></i>';
            assertRow.append(assertLabel, assertVal, toggleBtn);
            card.appendChild(assertRow);

            // EXPECT VALUE row
            const dateRow = document.createElement('div');
            dateRow.className = 'd-flex justify-content-between align-items-center px-1 border-bottom';
            const dateLabel = document.createElement('span');
            dateLabel.className = 'fw-bold small';
            dateLabel.textContent = 'DATE:';
            const dateVal = document.createElement('span');
            dateVal.className = 'expectedValue small';
            dateVal.setAttribute('data-value', a.expected_value ?? '');
            dateVal.textContent = this.#formatDate(a.expected_value);
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = `btn btn-xs editDate ms-1${a.expected_value ? ' btn-danger' : ' btn-secondary disabled'}`;
            editBtn.disabled = !a.expected_value;
            editBtn.innerHTML = '<i class="fas fa-pen-to-square" aria-hidden="true"></i>';
            dateRow.append(dateLabel, dateVal, editBtn);
            card.appendChild(dateRow);

            // ASSERTION textarea + comment button
            const textRow = document.createElement('div');
            textRow.className = 'd-flex flex-column p-1';
            const textHeader = document.createElement('div');
            textHeader.className = 'd-flex justify-content-between align-items-center';
            const textLabel = document.createElement('span');
            textLabel.className = 'fw-bold small';
            textLabel.textContent = 'ASSERTION:';
            const hasComment = 'comment' in a;
            const commentBtn = document.createElement('button');
            commentBtn.type = 'button';
            commentBtn.className = `btn btn-xs comment ms-1 ${hasComment ? 'btn-dark' : 'btn-secondary'}`;
            commentBtn.title = hasComment ? a.comment : 'add a comment';
            commentBtn.innerHTML = hasComment
                ? '<i class="fas fa-comment-dots" aria-hidden="true"></i>'
                : '<i class="fas fa-comment-medical" aria-hidden="true"></i>';
            textHeader.append(textLabel, commentBtn);
            const textarea = document.createElement('textarea');
            textarea.className = 'form-control form-control-sm assertionText';
            textarea.rows = 2;
            textarea.value = a.assertion;
            textRow.append(textHeader, textarea);
            card.appendChild(textRow);

            container.appendChild(card);
        });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: PASS.

- [ ] **Step 5: Run eslint and commit**

Run: `yarn lint`
Expected: no errors in `assets/js/AssertionsBuilder.js`.

```bash
git add assets/js/AssertionsBuilder.js assets/js/__tests__/AssertionsBuilder.test.js
git commit -m "feat(admin-tests): AssertionsBuilder.render native CSS grid with textarea cards"
```

---

### Task 6: Ported slider + page CSS

**Files:**

- Create: `assets/css/multi-range-slider.css`
- Create: `assets/css/admin-tests.css`

**Interfaces:**

- Produces: `assets/css/admin-tests.css` (auto-loaded by `head.php` for `pageName === 'admin-tests'`), which `@import`s the slider CSS and adds the
  `.assertions-grid` / `.year-grid` native grid styles.

- [ ] **Step 1: Copy the slider CSS verbatim**

Copy the file as-is:

```bash
cp ../UnitTestInterface/assets/css/multi-range-slider.css assets/css/multi-range-slider.css
```

> If the relative path differs, the source is `UnitTestInterface/assets/css/multi-range-slider.css` (314 lines, CSS-custom-property dual-range
> slider). Copy it byte-for-byte; do not modify.

- [ ] **Step 2: Create `assets/css/admin-tests.css`**

```css
@import url('multi-range-slider.css');

/* Per-year assertion cards: native CSS grid (replaces Isotope fitRows). */
.assertions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
}

.assertion-card {
    border-radius: 0.25rem;
    overflow: hidden;
}

.assertion-card .assertionText {
    resize: vertical;
}

/* Year-range overview grid (Sundays / excluded / pivot shading). */
.year-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.year-grid .testYearSpan {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--bs-border-color);
    border-radius: 0.25rem;
    cursor: default;
    user-select: none;
}

.year-grid .testYearSpan.deleted {
    opacity: 0.3;
}

.btn-xs {
    padding: 0.1rem 0.3rem;
    font-size: 0.75rem;
    line-height: 1.2;
}
```

- [ ] **Step 3: Verify the import resolves**

Run: `node -e "const fs=require('fs'); const c=fs.readFileSync('assets/css/admin-tests.css','utf8'); if(!/multi-range-slider\.css/.test(c))
process.exit(1); fs.accessSync('assets/css/multi-range-slider.css'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add assets/css/multi-range-slider.css assets/css/admin-tests.css
git commit -m "feat(admin-tests): port dual-range slider CSS + native grid page styles"
```

---

### Task 7: `admin-tests.php` page, nav registration, dashboard card

**Files:**

- Create: `admin-tests.php`
- Modify: `includes/common.php:245`
- Modify: `layout/header.php`
- Modify: `admin-dashboard.php`
- Test: `e2e/admin-tests.spec.ts`

**Interfaces:**

- Produces: a reachable, auth-gated page exposing `window.AdminTestsConfig = { apiUrl, isGlobalAdmin, hasTestEditor, locale, i18n: {...} }`, a list
  container `#testsTableBody` with `#testsCount`, filters `#filterTestName` / `#filterTestScope` / `#refreshTestsBtn` / `#createTestBtn`, a
  `#testEditorModal`, and a `#deleteTestModal`. Mirrors `admin-permissions.php` structure.

- [ ] **Step 1: Write the failing Playwright smoke spec**

Create `e2e/admin-tests.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// Uses the shared authenticated storage state (e2e/.auth/user.json) from the
// chromium project; that user is an admin in the dev environment.
test.describe('admin-tests page', () => {
    test('renders the page shell with list and modals', async ({ page }) => {
        await page.goto('/admin-tests.php');
        await expect(page.locator('#testsTableBody')).toBeVisible();
        await expect(page.locator('#createTestBtn')).toBeVisible();
        await expect(page.locator('#testEditorModal')).toHaveCount(1);
        await expect(page.locator('#deleteTestModal')).toHaveCount(1);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium`
Expected: FAIL — `admin-tests.php` 404s / locators not found.

> Requires the frontend dev server + API running per the repo's Playwright `webServer` config. If the environment is not bootable in this worktree,
> mark the run as "expected fail" and proceed; it will pass once the page exists and the stack is up.

- [ ] **Step 3: Register the page name**

Edit `includes/common.php` line 245 — add `'admin-tests'`:

```php
$adminPages = ['admin-dashboard', 'missals-editor', 'extending', 'temporale', 'decrees', 'admin-users', 'admin-role-requests', 'admin-applications', 'admin-permissions', 'admin-tests', 'developer-dashboard'];
```

- [ ] **Step 4: Create `admin-tests.php`**

```php
<?php

/**
 * Admin Tests Management Page
 *
 * Allows test_editor / admin users to create, edit, delete, and view
 * liturgical test definitions via the /tests API. Per-row edit/delete are
 * gated against the caller's scopes from GET /auth/test-scopes; the API is
 * the hard backstop.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// This is an admin page: test editors, global admins, and resource-admins may
// enter. Per-row gating (below, in JS) governs what each user may change.
$isGlobalAdmin   = $authHelper->hasRole('admin');
$hasTestEditor   = $authHelper->hasRole('test_editor');
$isResourceAdmin = $authHelper->isResourceAdmin();

if (!$isGlobalAdmin && !$hasTestEditor && !$isResourceAdmin) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $testsTitle    = _('Test Definitions');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($testsTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>
    <div id="layoutSidenav_content">
        <main>
            <div class="container-fluid px-4">
                <h1 class="mt-4"><?php echo htmlspecialchars(_('Test Definitions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h1>
                <p class="text-muted"><?php echo htmlspecialchars(_('Create, edit, and delete liturgical accuracy test definitions.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></p>

                <!-- Filters -->
                <div class="card shadow mb-4">
                    <div class="card-body">
                        <div class="row g-2 align-items-end">
                            <div class="col-md-4">
                                <label class="form-label" for="filterTestName"><?php echo _('Filter by name'); ?></label>
                                <input type="text" class="form-control" id="filterTestName" />
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="filterTestScope"><?php echo _('Filter by scope'); ?></label>
                                <input type="text" class="form-control" id="filterTestScope" placeholder="USA, diocese id, ..." />
                            </div>
                            <div class="col-md-4 text-end">
                                <button type="button" class="btn btn-outline-secondary" id="refreshTestsBtn">
                                    <i class="fas fa-rotate"></i> <?php echo _('Refresh'); ?>
                                </button>
                                <button type="button" class="btn btn-primary" id="createTestBtn" data-requires-auth>
                                    <i class="fas fa-plus"></i> <?php echo _('New Test'); ?>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tests table -->
                <div class="card shadow mb-4">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span><?php echo _('Tests'); ?></span>
                        <span class="badge bg-secondary" id="testsCount">0</span>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm table-hover align-middle">
                                <thead>
                                    <tr>
                                        <th><?php echo _('Name'); ?></th>
                                        <th><?php echo _('Event'); ?></th>
                                        <th><?php echo _('Scope'); ?></th>
                                        <th><?php echo _('Type'); ?></th>
                                        <th><?php echo _('Years'); ?></th>
                                        <th class="text-end"><?php echo _('Actions'); ?></th>
                                    </tr>
                                </thead>
                                <tbody id="testsTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        <?php include_once('./layout/footer.php'); ?>
    </div>

    <!-- Editor modal -->
    <div class="modal fade" id="testEditorModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="testEditorModalLabel"><?php echo _('Test Definition'); ?></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="testEditorAlerts"></div>
                    <form id="testEditorForm" novalidate>
                        <!-- Step 1: test type -->
                        <div class="mb-3">
                            <label class="form-label fw-bold"><?php echo _('Test type'); ?></label>
                            <div class="btn-group d-flex flex-wrap" role="group" id="testTypeGroup">
                                <input type="radio" class="btn-check" name="testType" id="tt-exact" value="exactCorrespondence" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-exact"><i class="fas fa-vial me-1"></i><?php echo _('Exact date'); ?></label>
                                <input type="radio" class="btn-check" name="testType" id="tt-since" value="exactCorrespondenceSince" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-since"><i class="fas fa-right-from-bracket me-1"></i><?php echo _('Exact since year'); ?></label>
                                <input type="radio" class="btn-check" name="testType" id="tt-until" value="exactCorrespondenceUntil" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-until"><i class="fas fa-right-to-bracket me-1"></i><?php echo _('Exact until year'); ?></label>
                                <input type="radio" class="btn-check" name="testType" id="tt-variable" value="variableCorrespondence" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-variable"><i class="fas fa-square-root-variable me-1"></i><?php echo _('Variable by year'); ?></label>
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="testName"><?php echo _('Name'); ?></label>
                                <input type="text" class="form-control" id="testName" pattern="^(?:[a-z_]+?_){0,1}[A-Z][a-zA-Z1-9]+[0-9]{0,2}(?:_vigil)?Test$" required />
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="testScopeType"><?php echo _('Scope'); ?></label>
                                <select class="form-select" id="testScopeType">
                                    <option value="general_roman_calendar"><?php echo _('General Roman Calendar'); ?></option>
                                    <option value="national_calendar"><?php echo _('National Calendar'); ?></option>
                                    <option value="diocesan_calendar"><?php echo _('Diocesan Calendar'); ?></option>
                                </select>
                                <div id="testScopeIdMount" class="mt-2"></div>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="testEventKey"><?php echo _('Liturgical event'); ?></label>
                                <input type="text" class="form-control" id="testEventKey" list="testEventKeyList" required />
                                <datalist id="testEventKeyList"></datalist>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="testDescription"><?php echo _('Description'); ?></label>
                                <textarea class="form-control" id="testDescription" rows="2" required></textarea>
                            </div>
                        </div>

                        <!-- Step 3: year range -->
                        <div class="mt-3">
                            <label class="form-label fw-bold"><?php echo _('Year range'); ?></label>
                            <div class="range-slider flat" id="yearsRangeSlider"
                                 style="--min:1970; --max:2050; --value-a:1999; --value-b:2030; --text-value-a:'1999'; --text-value-b:'2030';">
                                <input type="range" id="lowerRange" min="1970" max="2050" value="1999" />
                                <output></output>
                                <input type="range" id="upperRange" min="1970" max="2050" value="2030" />
                                <output></output>
                                <div class="range-slider__progress"></div>
                            </div>
                            <div class="year-grid mt-2" id="yearGrid"></div>
                        </div>

                        <!-- Step 4: base date -->
                        <div class="mt-3 col-md-4">
                            <label class="form-label" for="baseDate"><?php echo _('Base date'); ?></label>
                            <input type="date" class="form-control" id="baseDate" min="1970-01-01" max="2050-12-31" />
                        </div>

                        <!-- Step 5: per-year assertions -->
                        <div class="mt-3">
                            <label class="form-label fw-bold"><?php echo _('Per-year assertions'); ?></label>
                            <div id="assertionsContainer"></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo _('Cancel'); ?></button>
                    <button type="button" class="btn btn-primary" id="saveTestBtn" data-requires-auth><?php echo _('Save'); ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Comment modal -->
    <div class="modal fade" id="testCommentModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><?php echo _('Assertion comment'); ?></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="commentYear" />
                    <textarea class="form-control" id="commentText" rows="3"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo _('Cancel'); ?></button>
                    <button type="button" class="btn btn-primary" id="saveCommentBtn"><?php echo _('Save comment'); ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete modal -->
    <div class="modal fade" id="deleteTestModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><?php echo _('Delete Test'); ?></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="deleteTestAlerts"></div>
                    <p id="deleteTestConfirmText"></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo _('Cancel'); ?></button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteTestBtn" data-requires-auth><?php echo _('Delete'); ?></button>
                </div>
            </div>
        </div>
    </div>

    <script>
        window.AdminTestsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            isGlobalAdmin: <?php echo json_encode($isGlobalAdmin); ?>,
            hasTestEditor: <?php echo json_encode($hasTestEditor); ?>,
            locale: <?php echo json_encode($i18n->LOCALE); ?>,
            i18n: {
                loading: <?php echo json_encode(_('Loading...')); ?>,
                noTests: <?php echo json_encode(_('No tests found.')); ?>,
                failedToLoad: <?php echo json_encode(_('Failed to load tests. Please try again later.')); ?>,
                createSuccess: <?php echo json_encode(_('Test created successfully.')); ?>,
                updateSuccess: <?php echo json_encode(_('Test updated successfully.')); ?>,
                deleteSuccess: <?php echo json_encode(_('Test deleted successfully.')); ?>,
                saving: <?php echo json_encode(_('Saving...')); ?>,
                deleting: <?php echo json_encode(_('Deleting...')); ?>,
                edit: <?php echo json_encode(_('Edit')); ?>,
                delete: <?php echo json_encode(_('Delete')); ?>,
                confirmDelete: <?php echo json_encode(_('Are you sure you want to delete the test "%s"?')); ?>,
                generalRomanCalendar: <?php echo json_encode(_('General Roman Calendar')); ?>,
                nationalCalendar: <?php echo json_encode(_('National Calendar')); ?>,
                diocesanCalendar: <?php echo json_encode(_('Diocesan Calendar')); ?>,
                requiredFields: <?php echo json_encode(_('Please fill in all required fields.')); ?>,
                denied403: <?php echo json_encode(_('You do not have permission to perform this action.')); ?>,
                conflict409: <?php echo json_encode(_('A test with that name already exists.')); ?>
            }
        };
    </script>
</body>
</html>
```

> `$apiBaseUrl` is set by `includes/common.php` (same variable `admin-permissions.php` uses in its config blob).

- [ ] **Step 5: Add the sidebar nav link**

In `layout/header.php`, inside the admin sidebar block (the `if ($isAdminPage)` calendar-role section), add — directly after the existing `decrees.php` nav link:

```php
                        <?php if ($authHelper->hasRole('test_editor') || $authHelper->hasRole('admin') || $authHelper->isResourceAdmin()) : ?>
                        <a class="nav-link<?php echo $currentPage === 'admin-tests' ? ' active' : ''; ?>" href="admin-tests.php">
                            <i class="sb-nav-link-icon fas fa-fw fa-vial text-info"></i>
                            <span><?php echo _('Test Definitions'); ?></span>
                        </a>
                        <?php endif; ?>
```

> Match the surrounding indentation in `header.php`. Place it where it reads naturally (e.g., after Decrees, or under a dedicated heading if one fits the existing structure).

- [ ] **Step 6: Add the dashboard card**

In `admin-dashboard.php`, inside the Administration section (the `if ($isAdmin)` row of admin cards, alongside Users/Permissions/Applications), add a
card. Gate it on test-editor/admin:

```php
                <?php if ($isAdmin || $authHelper->hasRole('test_editor')) : ?>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card border-left-info shadow h-100 py-2">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-vial fa-2x text-info me-3"></i>
                                <div>
                                    <div class="h5 mb-0 fw-bold"><?php echo _('Test Definitions'); ?></div>
                                    <div class="small text-muted"><?php echo _('Manage liturgical accuracy tests'); ?></div>
                                </div>
                            </div>
                            <a href="admin-tests.php" class="btn btn-sm btn-info mt-3"><?php echo _('Open'); ?></a>
                        </div>
                    </div>
                </div>
                <?php endif; ?>
```

> Match the exact card markup of the sibling admin cards in `admin-dashboard.php` (the snippet above is sb-admin-consistent but align
> classes/structure to the real neighbors). Confirm `$isAdmin` is the variable used in that section; if the file uses `$isGlobalAdmin`, use that
> instead.

- [ ] **Step 7: Re-run the smoke spec**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium`
Expected: PASS — page shell, list container, and both modals present.

> If the stack cannot boot in this worktree, instead verify with PHP lint: `php -l admin-tests.php` (Expected: `No syntax errors detected`) and defer the Playwright run to CI.

- [ ] **Step 8: Commit**

```bash
git add admin-tests.php includes/common.php layout/header.php admin-dashboard.php e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): admin-tests.php page, nav link, dashboard card, smoke spec"
```

---

### Task 8: `admin-tests.js` — bootstrap, list, per-row scope gating

**Files:**

- Create: `assets/js/admin-tests.js`
- Test: `e2e/admin-tests.spec.ts` (extend)

**Interfaces:**

- Consumes: `window.AdminTestsConfig`; `GET /tests` → `{ litcal_tests: LitCalTest[] }`; `GET /auth/test-scopes` → `{ is_global_admin, editor:
  [{object_type, object_id}], admin: [...] }`.
- Produces: generic seam `fetchJson`, `gateByScope`, `deriveScope`, `renderTableRows`, `showModalAlert`; on load, fetches scopes + tests and renders
  rows with per-row Edit/Delete buttons gated by scope.

- [ ] **Step 1: Write the failing route-stubbed gating spec**

Append to `e2e/admin-tests.spec.ts`:

```typescript
const sampleTests = {
    litcal_tests: [
        { name: 'GrcOnlyTest', event_key: 'StX', description: 'd', test_type: 'exactCorrespondence', assertions: [{ year: 2024, expected_value: null, assert: 'eventNotExists', assertion: 'd' }] },
        { name: 'UsaNationalTest', event_key: 'StY', description: 'd', test_type: 'exactCorrespondence', applies_to: { national_calendar: 'USA' }, assertions: [{ year: 2024, expected_value: null, assert: 'eventNotExists', assertion: 'd' }] },
    ],
};

async function stub(page, scopes) {
    await page.route('**/auth/test-scopes', (r) => r.fulfill({ json: scopes }));
    await page.route('**/auth/me', (r) => r.fulfill({ json: { authenticated: true, roles: ['test_editor'] } }));
    await page.route('**/tests', (r) => {
        if (r.request().method() === 'GET') return r.fulfill({ json: sampleTests });
        return r.continue();
    });
}

test.describe('admin-tests gating (stubbed)', () => {
    test('scoped editor sees Edit only on the USA test, no Delete', async ({ page }) => {
        await stub(page, { is_global_admin: false, editor: [{ object_type: 'national_calendar_test', object_id: 'USA' }], admin: [] });
        await page.goto('/admin-tests.php');
        const usaRow = page.locator('tr', { hasText: 'UsaNationalTest' });
        const grcRow = page.locator('tr', { hasText: 'GrcOnlyTest' });
        await expect(usaRow.getByRole('button', { name: 'Edit' })).toBeVisible();
        await expect(usaRow.getByRole('button', { name: 'Delete' })).toHaveCount(0);
        await expect(grcRow.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    });

    test('global admin sees Edit and Delete on every row', async ({ page }) => {
        await stub(page, { is_global_admin: true, editor: [], admin: [] });
        await page.goto('/admin-tests.php');
        await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(2);
        await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(2);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g gating`
Expected: FAIL — no rows / buttons (module not created).

- [ ] **Step 3: Create `assets/js/admin-tests.js` (bootstrap + list)**

```javascript
/**
 * admin-tests page module. Bespoke (not the status-workflow factory), modeled
 * on admin-permissions.js. Internal seam: generic CRUD plumbing vs.
 * test-specific logic, so it can later seed a shared admin-page factory.
 */
import {
    ApiClient,
    CalendarSelect,
    CalendarSelectFilter,
} from '@liturgical-calendar/components-js';
import { AssertionsBuilder, TestType } from './AssertionsBuilder.js';

document.addEventListener('DOMContentLoaded', () => {
    const config = window.AdminTestsConfig;
    if (!config) {
        console.error('AdminTestsConfig not found');
        return;
    }
    const { apiUrl, i18n } = config;

    // ---- generic seam -----------------------------------------------------

    async function fetchJson(method, path, body) {
        const opts = {
            method,
            headers: { Accept: 'application/json' },
            credentials: 'include',
        };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(apiUrl + path, opts);
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) {
            throw { status: res.status, body: data };
        }
        return data;
    }

    /** Mirror TestScopeResolver: derive a test's scope object from applies_to. */
    function deriveScope(appliesTo) {
        if (appliesTo && appliesTo.diocesan_calendar) {
            return { object_type: 'diocesan_calendar_test', object_id: appliesTo.diocesan_calendar };
        }
        if (appliesTo && appliesTo.national_calendar) {
            return { object_type: 'national_calendar_test', object_id: appliesTo.national_calendar };
        }
        return { object_type: 'general_roman_calendar_test', object_id: 'general_roman_calendar' };
    }

    function gateByScope(scopeObj, scopes) {
        return scopes.some((s) => s.object_type === scopeObj.object_type && s.object_id === scopeObj.object_id);
    }

    function showModalAlert(modalEl, type, message) {
        const area = modalEl.querySelector('[id$="Alerts"]');
        if (!area) return;
        area.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">`
            + `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
    }

    // ---- state ------------------------------------------------------------

    const state = {
        tests: [],
        scopes: { is_global_admin: false, editor: [], admin: [] },
        editing: null,
    };

    function scopeLabel(appliesTo) {
        const s = deriveScope(appliesTo);
        if (s.object_type === 'national_calendar_test') return `${i18n.nationalCalendar}: ${s.object_id}`;
        if (s.object_type === 'diocesan_calendar_test') return `${i18n.diocesanCalendar}: ${s.object_id}`;
        return i18n.generalRomanCalendar;
    }

    function yearRange(test) {
        const years = test.assertions.map((a) => a.year);
        return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';
    }

    function canEdit(test) {
        return state.scopes.is_global_admin || gateByScope(deriveScope(test.applies_to), state.scopes.editor);
    }

    function canDelete(test) {
        return state.scopes.is_global_admin || gateByScope(deriveScope(test.applies_to), state.scopes.admin);
    }

    function renderTableRows() {
        const tbody = document.getElementById('testsTableBody');
        const nameFilter = document.getElementById('filterTestName').value.trim().toLowerCase();
        const scopeFilter = document.getElementById('filterTestScope').value.trim().toLowerCase();
        const rows = state.tests.filter((t) => {
            const matchesName = !nameFilter || t.name.toLowerCase().includes(nameFilter);
            const matchesScope = !scopeFilter || scopeLabel(t.applies_to).toLowerCase().includes(scopeFilter);
            return matchesName && matchesScope;
        });
        document.getElementById('testsCount').textContent = String(rows.length);
        tbody.innerHTML = '';
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${i18n.noTests}</td></tr>`;
            return;
        }
        rows.forEach((t) => {
            const tr = document.createElement('tr');
            const editBtn = canEdit(t)
                ? `<button type="button" class="btn btn-sm btn-outline-primary editTestBtn" data-name="${t.name}"><i class="fas fa-pen"></i> ${i18n.edit}</button>`
                : '';
            const delBtn = canDelete(t)
                ? `<button type="button" class="btn btn-sm btn-outline-danger deleteTestBtn ms-1" data-name="${t.name}"><i class="fas fa-trash"></i> ${i18n.delete}</button>`
                : '';
            tr.innerHTML = `
                <td><code>${t.name}</code></td>
                <td>${t.event_key}</td>
                <td>${scopeLabel(t.applies_to)}</td>
                <td>${t.test_type}</td>
                <td>${yearRange(t)}</td>
                <td class="text-end">${editBtn}${delBtn}</td>`;
            tbody.appendChild(tr);
        });
    }

    async function loadTests() {
        const tbody = document.getElementById('testsTableBody');
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${i18n.loading}</td></tr>`;
        try {
            const [scopes, testsResp] = await Promise.all([
                fetchJson('GET', '/auth/test-scopes').catch(() => ({ is_global_admin: false, editor: [], admin: [] })),
                fetchJson('GET', '/tests'),
            ]);
            state.scopes = scopes;
            state.tests = testsResp.litcal_tests ?? [];
            renderTableRows();
        } catch (err) {
            console.error('Failed to load tests', err);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${i18n.failedToLoad}</td></tr>`;
        }
    }

    document.getElementById('refreshTestsBtn').addEventListener('click', loadTests);
    document.getElementById('filterTestName').addEventListener('input', renderTableRows);
    document.getElementById('filterTestScope').addEventListener('input', renderTableRows);

    // Expose internals for later tasks (editor/delete wiring appended below).
    window.__adminTests = { state, fetchJson, deriveScope, gateByScope, showModalAlert, loadTests, renderTableRows, AssertionsBuilder, TestType, CalendarSelect, CalendarSelectFilter, ApiClient };

    loadTests();
});
```

> `window.__adminTests` is a deliberate seam so Tasks 9–10 can append editor/delete wiring in the same file without a giant single step. When Task 10
> is complete, this debug handle may be trimmed to only what the e2e specs rely on.

- [ ] **Step 4: Run the gating spec to verify it passes**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g gating`
Expected: PASS — scoped editor sees one Edit and no Delete; global admin sees two of each.

- [ ] **Step 5: Lint and commit**

Run: `yarn lint`

```bash
git add assets/js/admin-tests.js e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): admin-tests.js bootstrap, list, per-row scope gating"
```

---

### Task 9: `admin-tests.js` — editor modal (create + edit), events datalist, slider, AssertionsBuilder glue

**Files:**

- Modify: `assets/js/admin-tests.js`
- Test: `e2e/admin-tests.spec.ts` (extend)

**Interfaces:**

- Consumes: `AssertionsBuilder` (Tasks 1–5), `CalendarSelect`/`CalendarSelectFilter`/`ApiClient`, generic seam from Task 8; `GET /events[ /nation/{id}
  | /diocese/{id} ]` → `{ litcal_events: [{event_key, name, grade, grade_lcl, month, day}] }`; `PUT /tests` (create), `PATCH /tests/{name}` (edit).
- Produces: a working editor that opens for create/edit, builds the datalist + slider + per-year cards from the model, and submits. `name` is read-only when editing.

- [ ] **Step 1: Write the failing create/edit specs**

Append to `e2e/admin-tests.spec.ts`:

```typescript
const grcEvents = {
    litcal_events: [
        { event_key: 'StIgnatiusOfLoyola', name: 'Saint Ignatius of Loyola', grade: 3, grade_lcl: 'Memorial', month: 7, day: 31 },
    ],
};

async function stubEditor(page, scopes) {
    await stub(page, scopes);
    await page.route('**/events**', (r) => r.fulfill({ json: grcEvents }));
}

test.describe('admin-tests editor (stubbed)', () => {
    test('create flow submits a PUT with a schema-shaped body', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        let putBody = null;
        await page.route('**/tests', (r) => {
            if (r.request().method() === 'PUT') {
                putBody = r.request().postDataJSON();
                return r.fulfill({ json: { ...putBody } });
            }
            return r.fulfill({ json: sampleTests });
        });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await page.locator('#tt-exact').check({ force: true });
        await page.locator('#testName').fill('StIgnatiusOfLoyolaTest');
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('change');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => putBody && putBody.name).toBe('StIgnatiusOfLoyolaTest');
        expect(putBody.test_type).toBe('exactCorrespondence');
        expect(putBody.assertions.length).toBeGreaterThan(0);
        expect(putBody.assertions[0].assert).toBe('eventExists AND hasExpectedDate');
    });

    test('edit flow renders name read-only and submits PATCH', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        let patched = false;
        await page.route('**/tests/UsaNationalTest', (r) => {
            if (r.request().method() === 'PATCH') { patched = true; return r.fulfill({ json: {} }); }
            return r.continue();
        });
        await page.goto('/admin-tests.php');
        await page.locator('tr', { hasText: 'UsaNationalTest' }).getByRole('button', { name: 'Edit' }).click();
        await expect(page.locator('#testName')).toHaveAttribute('readonly', '');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => patched).toBe(true);
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g editor`
Expected: FAIL — clicking New/Edit does nothing yet.

- [ ] **Step 3: Append editor wiring to `assets/js/admin-tests.js`**

Insert the following inside the `DOMContentLoaded` callback, before the final `loadTests();` line (it reuses `fetchJson`, `state`, `i18n`, `apiUrl`,
`config`, and the imported classes):

```javascript
    // ---- editor -----------------------------------------------------------

    const editorModalEl = document.getElementById('testEditorModal');
    const editorModal = bootstrap.Modal.getOrCreateInstance(editorModalEl);
    const builder = new AssertionsBuilder({ locale: config.locale });
    let events = [];

    function selectedTestType() {
        return document.querySelector('input[name="testType"]:checked')?.value ?? TestType.ExactCorrespondence;
    }

    function selectedScope() {
        const type = document.getElementById('testScopeType').value;
        if (type === 'general_roman_calendar') return null;
        const idEl = document.getElementById('testScopeId');
        const id = idEl ? idEl.value : '';
        return id ? { [type]: id } : null;
    }

    function eventsPath(appliesTo) {
        if (appliesTo && appliesTo.diocesan_calendar) return `/events/diocese/${appliesTo.diocesan_calendar}`;
        if (appliesTo && appliesTo.national_calendar) return `/events/nation/${appliesTo.national_calendar}`;
        return '/events';
    }

    async function loadEvents(appliesTo) {
        const res = await fetch(apiUrl + eventsPath(appliesTo), {
            headers: { Accept: 'application/json', 'Accept-Language': config.locale },
            credentials: 'include',
        });
        const json = await res.json();
        events = json.litcal_events ?? [];
        const datalist = document.getElementById('testEventKeyList');
        datalist.innerHTML = '';
        events.forEach((e) => {
            const opt = document.createElement('option');
            opt.value = e.event_key;
            opt.textContent = `${e.name} (${e.grade_lcl})`;
            if (e.month != null) opt.dataset.month = String(e.month);
            if (e.day != null) opt.dataset.day = String(e.day);
            if (e.grade != null) opt.dataset.grade = String(e.grade);
            datalist.appendChild(opt);
        });
    }

    function sliderYears() {
        const a = Number(document.getElementById('lowerRange').value);
        const b = Number(document.getElementById('upperRange').value);
        return { minYear: Math.min(a, b), maxYear: Math.max(a, b) };
    }

    function renderYearGrid() {
        const grid = document.getElementById('yearGrid');
        const { minYear, maxYear } = sliderYears();
        grid.innerHTML = '';
        for (let y = minYear; y <= maxYear; y++) {
            const span = document.createElement('span');
            span.className = `testYearSpan year-${y}`;
            span.dataset.year = String(y);
            span.textContent = String(y);
            grid.appendChild(span);
        }
    }

    function regenerate() {
        const event = events.find((e) => e.event_key === document.getElementById('testEventKey').value);
        if (!event) return;
        const { minYear, maxYear } = sliderYears();
        const tt = selectedTestType();
        builder.setMeta({ test_type: tt, applies_to: selectedScope() });
        const pivot = (tt === TestType.ExactCorrespondenceSince || tt === TestType.ExactCorrespondenceUntil)
            ? minYear
            : null;
        builder.generate({ event, minYear, maxYear, pivotYear: pivot });
        document.getElementById('testDescription').value = builder.model.description;
        document.getElementById('baseDate').value = event.month && event.day
            ? `${minYear}-${String(event.month).padStart(2, '0')}-${String(event.day).padStart(2, '0')}`
            : '';
        builder.render(document.getElementById('assertionsContainer'));
        renderYearGrid();
    }

    document.getElementById('testEventKey').addEventListener('change', regenerate);
    document.querySelectorAll('input[name="testType"]').forEach((el) => el.addEventListener('change', regenerate));
    document.getElementById('lowerRange').addEventListener('change', regenerate);
    document.getElementById('upperRange').addEventListener('change', regenerate);

    // sync slider CSS custom properties as the user drags
    ['lowerRange', 'upperRange'].forEach((id, idx) => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            const prop = idx === 0 ? '--value-a' : '--value-b';
            const textProp = idx === 0 ? '--text-value-a' : '--text-value-b';
            el.parentNode.style.setProperty(prop, el.value);
            el.parentNode.style.setProperty(textProp, `"${el.value}"`);
        });
    });

    // per-year card interactions (event-delegated on the assertions container)
    const assertionsContainer = document.getElementById('assertionsContainer');
    assertionsContainer.addEventListener('click', (ev) => {
        const card = ev.target.closest('[data-year]');
        if (!card) return;
        const year = Number(card.dataset.year);
        if (ev.target.closest('.toggleAssert')) {
            builder.toggleAssert(year);
            builder.render(assertionsContainer);
        } else if (ev.target.closest('.comment')) {
            document.getElementById('commentYear').value = String(year);
            const a = builder.model.assertions.find((x) => x.year === year);
            document.getElementById('commentText').value = a && 'comment' in a ? a.comment : '';
            bootstrap.Modal.getOrCreateInstance(document.getElementById('testCommentModal')).show();
        }
    });
    assertionsContainer.addEventListener('change', (ev) => {
        const card = ev.target.closest('[data-year]');
        if (!card) return;
        const year = Number(card.dataset.year);
        if (ev.target.matches('.assertionText')) {
            builder.setAssertionText(year, ev.target.value);
        }
    });
    document.getElementById('saveCommentBtn').addEventListener('click', () => {
        const year = Number(document.getElementById('commentYear').value);
        builder.setComment(year, document.getElementById('commentText').value);
        builder.render(assertionsContainer);
        bootstrap.Modal.getInstance(document.getElementById('testCommentModal')).hide();
    });

    async function syncScopeIdField() {
        const type = document.getElementById('testScopeType').value;
        const mount = document.getElementById('testScopeIdMount');
        mount.innerHTML = '';
        if (type === 'national_calendar' || type === 'diocesan_calendar') {
            const client = await ApiClient.init(apiUrl).catch(() => null);
            if (!client) return;
            const filter = type === 'national_calendar'
                ? CalendarSelectFilter.NATIONAL_CALENDARS
                : CalendarSelectFilter.DIOCESAN_CALENDARS;
            const sel = new CalendarSelect(config.locale).filter(filter).allowNull(true).class('form-select').id('testScopeId');
            sel.appendTo(mount);
        }
    }
    document.getElementById('testScopeType').addEventListener('change', () => { syncScopeIdField(); regenerate(); });

    function openEditor(test) {
        state.editing = test ? test.name : null;
        document.getElementById('testEditorAlerts').innerHTML = '';
        const nameEl = document.getElementById('testName');
        if (test) {
            builder.load(test);
            nameEl.value = test.name;
            nameEl.setAttribute('readonly', '');
            document.querySelector(`input[name="testType"][value="${test.test_type}"]`).checked = true;
            document.getElementById('testEventKey').value = test.event_key;
            document.getElementById('testDescription').value = test.description;
            const scope = deriveScope(test.applies_to);
            const typeSel = document.getElementById('testScopeType');
            typeSel.value = scope.object_type === 'national_calendar_test' ? 'national_calendar'
                : scope.object_type === 'diocesan_calendar_test' ? 'diocesan_calendar'
                : 'general_roman_calendar';
            loadEvents(test.applies_to).then(() => builder.render(assertionsContainer));
        } else {
            builder.load({ name: '', event_key: '', description: '', test_type: TestType.ExactCorrespondence, assertions: [] });
            nameEl.value = '';
            nameEl.removeAttribute('readonly');
            document.getElementById('tt-exact').checked = true;
            document.getElementById('testEventKey').value = '';
            document.getElementById('testDescription').value = '';
            document.getElementById('testScopeType').value = 'general_roman_calendar';
            assertionsContainer.innerHTML = '';
            loadEvents(null);
        }
        syncScopeIdField();
        editorModal.show();
    }

    document.getElementById('createTestBtn').addEventListener('click', () => openEditor(null));
    document.getElementById('testsTableBody').addEventListener('click', (ev) => {
        const editBtn = ev.target.closest('.editTestBtn');
        if (editBtn) {
            const test = state.tests.find((t) => t.name === editBtn.dataset.name);
            if (test) openEditor(test);
        }
    });

    document.getElementById('saveTestBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveTestBtn');
        const nameEl = document.getElementById('testName');
        if (!nameEl.checkValidity() || !document.getElementById('testEventKey').value) {
            showModalAlert(editorModalEl, 'warning', i18n.requiredFields);
            return;
        }
        builder.setMeta({
            name: nameEl.value,
            event_key: document.getElementById('testEventKey').value,
            description: document.getElementById('testDescription').value,
            test_type: selectedTestType(),
            applies_to: selectedScope(),
        });
        const payload = builder.serialize();
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = i18n.saving;
        try {
            if (state.editing) {
                await fetchJson('PATCH', `/tests/${encodeURIComponent(state.editing)}`, payload);
            } else {
                await fetchJson('PUT', '/tests', payload);
            }
            editorModal.hide();
            await loadTests();
        } catch (err) {
            const msg = err.status === 403 ? i18n.denied403
                : err.status === 409 ? i18n.conflict409
                : (err.body && err.body.message) ? err.body.message : i18n.failedToLoad;
            showModalAlert(editorModalEl, 'danger', msg);
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });
```

- [ ] **Step 4: Run the editor specs to verify they pass**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g editor`
Expected: PASS — PUT body is schema-shaped; edit renders `name` read-only and fires PATCH.

- [ ] **Step 5: Lint and commit**

Run: `yarn lint`

```bash
git add assets/js/admin-tests.js e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): editor modal — events datalist, slider, AssertionsBuilder glue, create/edit"
```

---

### Task 10: `admin-tests.js` — delete flow

**Files:**

- Modify: `assets/js/admin-tests.js`
- Test: `e2e/admin-tests.spec.ts` (extend)

**Interfaces:**

- Consumes: generic seam; `DELETE /tests/{name}`.
- Produces: delete-confirm modal wiring that fires `DELETE /tests/{name}` and reloads the list.

- [ ] **Step 1: Write the failing delete spec**

Append:

```typescript
test.describe('admin-tests delete (stubbed)', () => {
    test('confirms and fires DELETE', async ({ page }) => {
        await stub(page, { is_global_admin: true, editor: [], admin: [] });
        let deleted = false;
        await page.route('**/tests/GrcOnlyTest', (r) => {
            if (r.request().method() === 'DELETE') { deleted = true; return r.fulfill({ json: {} }); }
            return r.continue();
        });
        await page.goto('/admin-tests.php');
        await page.locator('tr', { hasText: 'GrcOnlyTest' }).getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('#deleteTestModal')).toBeVisible();
        await page.locator('#confirmDeleteTestBtn').click();
        await expect.poll(() => deleted).toBe(true);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g delete`
Expected: FAIL — Delete button does nothing.

- [ ] **Step 3: Append delete wiring**

Insert before the final `loadTests();`:

```javascript
    // ---- delete -----------------------------------------------------------

    const deleteModalEl = document.getElementById('deleteTestModal');
    const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    let deleteTarget = null;

    document.getElementById('testsTableBody').addEventListener('click', (ev) => {
        const delBtn = ev.target.closest('.deleteTestBtn');
        if (!delBtn) return;
        deleteTarget = delBtn.dataset.name;
        document.getElementById('deleteTestAlerts').innerHTML = '';
        document.getElementById('deleteTestConfirmText').textContent = i18n.confirmDelete.replace('%s', deleteTarget);
        deleteModal.show();
    });

    document.getElementById('confirmDeleteTestBtn').addEventListener('click', async () => {
        if (!deleteTarget) return;
        const btn = document.getElementById('confirmDeleteTestBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = i18n.deleting;
        try {
            await fetchJson('DELETE', `/tests/${encodeURIComponent(deleteTarget)}`);
            deleteModal.hide();
            await loadTests();
        } catch (err) {
            const msg = err.status === 403 ? i18n.denied403 : (err.body && err.body.message) ? err.body.message : i18n.failedToLoad;
            showModalAlert(deleteModalEl, 'danger', msg);
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });
```

- [ ] **Step 4: Run the delete spec to verify it passes**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g delete`
Expected: PASS.

- [ ] **Step 5: Run the full stubbed suite, lint, commit**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium`
Expected: all specs PASS.

Run: `yarn lint`

```bash
git add assets/js/admin-tests.js e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): delete-confirm flow (DELETE /tests/{name})"
```

---

### Task 11: Real-seeded RBAC e2e spec

**Files:**

- Create: `e2e/rbac/13-admin-tests-crud.spec.ts`

**Interfaces:**

- Consumes: the existing RBAC harness — `e2e/rbac/support/` (`actingAs`, `grant`, `seed`, `cleanup`) and the `rbac` Playwright project (`dependencies:
  ['rbac-setup']`). Model on `e2e/rbac/12-test-editor-scoped-test-request.spec.ts`.
- Produces: a real end-to-end spec where a seeded `test_editor` with a scoped FGA `editor` tuple creates/edits a test in their scope and is denied
  outside it; a global admin deletes.

- [ ] **Step 1: Read the canonical examples**

Open and read for exact helper signatures and setup:

```bash
sed -n '1,80p' e2e/rbac/12-test-editor-scoped-test-request.spec.ts
sed -n '1,60p' e2e/rbac/support/grant.ts
sed -n '1,60p' e2e/rbac/support/actingAs.ts
```

- [ ] **Step 2: Write the spec, modeled on spec 12**

Create `e2e/rbac/13-admin-tests-crud.spec.ts`. Use the same imports, `actingAs`/`grant` helpers, and seeded users that spec 12 uses. The flow:

```typescript
import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { grant } from './support/grant';

// Mirror spec 12's seeded users and helper signatures exactly. The user names
// below are placeholders for the real seeded identities in support/seed.ts —
// substitute the actual constants used by spec 12.

test.describe('admin-tests CRUD (real RBAC)', () => {
    test('scoped national test_editor can create within scope and is denied outside', async ({ page }) => {
        await grant({ user: 'USCCB_EDITOR', relation: 'editor', object: 'national_calendar_test:USA' });
        await actingAs(page, 'USCCB_EDITOR');

        await page.goto('/admin-tests.php');
        await expect(page.locator('#testsTableBody')).toBeVisible();

        // Create within scope (national_calendar: USA)
        await page.locator('#createTestBtn').click();
        await page.locator('#tt-exact').check({ force: true });
        await page.locator('#testName').fill('PlaywrightUsaScopedTest');
        await page.locator('#testScopeType').selectOption('national_calendar');
        // select USA in the mounted CalendarSelect (#testScopeId)
        await page.locator('#testScopeId').selectOption('USA');
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('change');
        await page.locator('#saveTestBtn').click();
        await expect(page.locator('tr', { hasText: 'PlaywrightUsaScopedTest' })).toBeVisible();

        // A General-Roman-scoped row offers no Edit button to this scoped editor
        const grcRow = page.locator('tr', { hasText: 'general_roman' }).first();
        if (await grcRow.count()) {
            await expect(grcRow.getByRole('button', { name: 'Edit' })).toHaveCount(0);
        }
    });

    test('global admin can delete any test', async ({ page }) => {
        await actingAs(page, 'GLOBAL_ADMIN');
        await page.goto('/admin-tests.php');
        const row = page.locator('tr', { hasText: 'PlaywrightUsaScopedTest' });
        await row.getByRole('button', { name: 'Delete' }).click();
        await page.locator('#confirmDeleteTestBtn').click();
        await expect(page.locator('tr', { hasText: 'PlaywrightUsaScopedTest' })).toHaveCount(0);
    });
});
```

> The `actingAs`/`grant`/user-constant names above MUST be replaced with the exact symbols spec 12 imports. Do not invent helper signatures — copy
> spec 12's. If spec 12 seeds via a different mechanism (e.g., `seed.ts` fixtures), follow that instead. Add a `cleanup` afterAll if spec 12 does.

- [ ] **Step 3: Run the rbac spec**

Run: `yarn playwright test e2e/rbac/13-admin-tests-crud.spec.ts --project=rbac`
Expected: PASS (requires the docker RBAC infra the `rbac-setup` project brings up).

> If the RBAC infra is not available in this worktree, mark as deferred-to-CI and note it in the PR description; the stubbed specs (Tasks 8–10) provide the fast gate.

- [ ] **Step 4: Commit**

```bash
git add e2e/rbac/13-admin-tests-crud.spec.ts
git commit -m "test(admin-tests): real-seeded RBAC e2e for scoped CRUD"
```

---

### Task 12: Docs, markdownlint, and final review

**Files:**

- Modify: `docs/superpowers/plans/2026-06-29-admin-tests-page-phase2.md` (check off steps as completed)
- Possibly create: a short `docs/` note if the repo documents admin pages (only if such an index exists)

- [ ] **Step 1: Run the full unit + stubbed-e2e gates**

Run: `yarn test:unit`
Expected: all AssertionsBuilder tests PASS.

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium`
Expected: all stubbed specs PASS.

- [ ] **Step 2: Lint everything touched**

Run: `yarn lint`
Run: `yarn lint:md`
Expected: no errors.

- [ ] **Step 3: Verify no Isotope / contenteditable leaked into the port**

Run: `grep -rnE "isotope|contenteditable" assets/js/AssertionsBuilder.js assets/js/admin-tests.js`
Expected: no matches (state-first port complete).

- [ ] **Step 4: Commit any doc updates**

```bash
git add docs/superpowers/plans/2026-06-29-admin-tests-page-phase2.md
git commit -m "docs(admin-tests): mark phase 2 plan steps complete"
```

---

## Self-Review

**Spec coverage:**

- Dedicated `admin-tests.php` + `assets/js/admin-tests.js` modeled on `admin-permissions.js` (not the factory) → Tasks 7, 8.
- Generic/specific seam (`fetchJson`, `gateByScope`, `deriveScope`, `renderTableRows`, `showModalAlert`) → Task 8.
- List grouped/filterable by scope; columns name/event_key/scope/test_type/years/actions → Task 8.
- Per-row Edit (editor scope) / Delete (admin scope) gating from `/auth/test-scopes`; API backstop (403 surfaced) → Tasks 8, 9, 10.
- Ported editor: test-type buttons + icons (`fa-vial`/`fa-right-from-bracket`/`fa-right-to-bracket`/`fa-square-root-variable`), `/events` datalist
  with `data-month/day/grade`, base date, dual-range slider (`multi-range-slider.css` verbatim), per-year cards with `eventExists AND hasExpectedDate
  ↔ eventNotExists` toggle + color coding → Tasks 3, 5, 6, 9.
- Modernizations: Isotope dropped (native CSS grid), state-first (`serialize()` reads the model), `<textarea>` not contenteditable → Tasks 2–5 (+ Task 12 grep gate).
- `name` read-only when editing; rename = delete+recreate → Task 9.
- Create `PUT /tests`, edit `PATCH /tests/{name}`, delete `DELETE /tests/{name}` → Tasks 9, 10.
- Error handling (400/422/401/403/404/409, disable submit during request, required-field validation) → Tasks 9, 10.
- Testing: Vitest unit (AssertionsBuilder), Playwright route-stubbed (gating + CRUD), one real-seeded RBAC spec → Tasks 1–5, 8–11.
- Nav entry + dashboard card + `$adminPages` registration → Task 7.

**Placeholder scan:** The two intentional "match the real neighbor" notes (header.php nav placement, admin-dashboard.php card markup, and the rbac
helper symbol names in Task 11) are flagged explicitly because the exact surrounding markup/symbols must be read from the live files at execution
time; the code provided is concrete and runnable, with the read-the-canonical-file step included. No `TODO`/`implement later`/empty-handler
placeholders remain.

**Type consistency:** `AssertionsBuilder` method names (`load`, `setMeta`, `generate`, `serialize`, `toggleAssert`, `setExpectedDate`,
`setAssertionText`, `setComment`, `excludeYear`, `setPivot`, `render`) are used consistently across Tasks 2–9. `deriveScope`/`gateByScope`/`fetchJson`
signatures match between definition (Task 8) and use (Tasks 9, 10). Assertion shape (`year`, `expected_value`, `assert`, `assertion`, optional
`comment`) matches the schema and the serialize/round-trip tests.

## Open items carried from the spec (resolve during execution)

- **Global admin vs. `forTestEditor`:** the client gates Create on `isGlobalAdmin || hasTestEditor`; the API is authoritative. No client change needed
  regardless of the answer — but confirm a global admin can actually `PUT` (if not, they'll get a 403 which the editor surfaces).
- **`/events` shape per scope:** the datalist assumes `{ litcal_events: [{event_key, name, grade, grade_lcl, month, day}] }` from `/events`,
  `/events/nation/{id}`, `/events/diocese/{id}`. Confirm `month`/`day` are present for fixed-date events when wiring Task 9 (the base-date prefill
  depends on them).
