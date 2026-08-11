# Rite Selector and Rite-Aware Subscription URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Give `usage.php`'s calendar-subscription card a rite selector, and make the subscription URL it builds rite-explicit.

**Architecture:** The subscription card's dropdown moves from the server-rendered PHP `CalendarSelect` to the
JS `CalendarSelect` + `RiteSelect` from liturgy-components-js, linked with `linkToRiteSelect()` so the
calendar list repartitions when the rite changes. The URL model (`CalendarType`, `RequestPayload`,
`CurrentEndpoint`) is extracted out of `usage.js` into a dependency-free module so it can be unit-tested, and
gains a rite path segment. Finally the now-unused PHP-components bootstrap is gated to the one page that still
needs it.

**Tech Stack:** PHP 8.4, vanilla ES6 modules, liturgy-components-js 2.1.0 (CDN importmap, or
`assets/components-js` symlink in dev), Vitest + jsdom for unit tests, Playwright for e2e.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-11-usage-rite-selector-design.md`. Read it before starting.
- **The rite segment is always emitted, `roman` included.** `/calendar/roman/nation/IT`, never `/calendar/nation/IT`.
- **The rite segment goes immediately after the API base and before `/{calendarType}/{calendarId}`.**
  `CurrentEndpoint.apiBase` already ends in `/calendar`, so the result is `/calendar/roman/nation/IT`.
  Appending the rite later yields `/calendar/nation/IT/roman`, which the API rejects.
- **`liturgical-calendar/components` stays in `composer.json` at `^4.2`.** It is load-bearing for the embedded PHP example, which skips its own autoloader. Do not remove it.
- **`includes/common.php`'s `ApiClient::getInstance()` block is not deleted, only gated.** The embedded PHP example uses that singleton.
- **gettext uses numbered placeholders** (`%1$s`, not `%s`) if any new format string is added.
- **Never `git commit --no-verify`.** Pre-commit hooks run `composer lint` and `composer lint:md`.
- **`assets/js/subscriptionUrl.js` must not import from `@liturgical-calendar/components-js`.** That package
  is not in `node_modules` — it resolves only via the browser importmap — so a Vitest test importing it
  transitively would fail. The rite crosses the boundary as a plain string.

## File Structure

| File                                                | Responsibility                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `assets/js/subscriptionUrl.js` (new)                | Pure URL model: `CalendarType`, `RequestPayload`, `CurrentEndpoint`. No imports, no DOM, no globals. |
| `assets/js/__tests__/subscriptionUrl.test.js` (new) | Vitest coverage of URL composition.                                                                  |
| `assets/js/usage.js` (modify)                       | Imports the URL model and the JS components; builds and wires the selects.                           |
| `usage.php` (modify)                                | Drops the PHP `CalendarSelect`; renders two empty containers and two new label strings.              |
| `includes/common.php` (modify)                      | Gates the PHP-components bootstrap to `examples.php`.                                                |
| `e2e/usage.spec.ts` (new)                           | Playwright coverage of the rendered page.                                                            |

---

### Task 1: Extract the URL model into a testable module

Pure refactor — no behaviour change. `usage.js` currently defines `CalendarType`, `RequestPayload` and
`CurrentEndpoint` inline, with `CurrentEndpoint.apiBase` reading the `CalendarUrl` global. Moving them out
lets Task 2 unit-test the rite segment without a browser.

**Files:**

- Create: `assets/js/subscriptionUrl.js`
- Create: `assets/js/__tests__/subscriptionUrl.test.js`
- Modify: `assets/js/usage.js:1-59` (remove the three definitions), `assets/js/usage.js:223` (set `apiBase`)

**Interfaces:**

- Consumes: nothing.
- Produces: `CalendarType` (frozen object, `NATIONAL: 'nation'`, `DIOCESAN: 'diocese'`); `RequestPayload`
  (class with static fields `epiphany`, `ascension`, `corpus_christi`, `eternal_high_priest`, `locale`,
  `return_type = 'ICS'`, `year_type = 'CIVIL'`); `CurrentEndpoint` (class with static fields `apiBase = ''`,
  `calendarType = null`, `calendarId = null`, `calendarYear = null`, and static method `serialize(): string`).

- [ ] **Step 1: Write the failing test**

Create `assets/js/__tests__/subscriptionUrl.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
    CalendarType,
    RequestPayload,
    CurrentEndpoint,
} from '../subscriptionUrl.js';

const reset = () => {
    CurrentEndpoint.apiBase = 'https://example.test/calendar';
    CurrentEndpoint.calendarType = null;
    CurrentEndpoint.calendarId = null;
    CurrentEndpoint.calendarYear = null;
    RequestPayload.epiphany = null;
    RequestPayload.ascension = null;
    RequestPayload.corpus_christi = null;
    RequestPayload.eternal_high_priest = null;
    RequestPayload.locale = null;
    RequestPayload.return_type = 'ICS';
    RequestPayload.year_type = 'CIVIL';
};

describe('CurrentEndpoint.serialize', () => {
    beforeEach(reset);

    it('emits the bare base with its query parameters when nothing is selected', () => {
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits a national calendar path', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = 'IT';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/nation/IT?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits a diocesan calendar path', () => {
        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId = 'romamo_it';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/diocese/romamo_it?return_type=ICS&year_type=CIVIL',
        );
    });

    it('omits the calendar segment when the id is null', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = null;
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar?return_type=ICS&year_type=CIVIL',
        );
    });

    it('skips null and empty payload fields', () => {
        RequestPayload.locale = '';
        RequestPayload.epiphany = 'JAN6';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar?epiphany=JAN6&return_type=ICS&year_type=CIVIL',
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:unit assets/js/__tests__/subscriptionUrl.test.js`

Expected: FAIL — `Failed to resolve import "../subscriptionUrl.js"`.

- [ ] **Step 3: Create the module**

Create `assets/js/subscriptionUrl.js` by moving the definitions from `assets/js/usage.js:1-59` verbatim, with
one change: `apiBase` becomes a plain static field instead of a getter reading the `CalendarUrl` global, so
the module has no global dependency and the test can set it.

```js
/**
 * The subscription URL model for usage.php's calendar-subscription card.
 *
 * Deliberately free of imports, DOM access and globals: `usage.js` injects
 * `CurrentEndpoint.apiBase` at startup, and the rite arrives as a plain string.
 * `@liturgical-calendar/components-js` resolves only through the browser
 * importmap, so importing it here would break the Vitest suite.
 */

/**
 * Enum CalendarType
 * Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = Object.freeze({
    NATIONAL: 'nation',
    DIOCESAN: 'diocese',
});

/**
 * Represents the query parameters for the API /calendar endpoint request
 */
class RequestPayload {
    static epiphany = null;
    static ascension = null;
    static corpus_christi = null;
    static eternal_high_priest = null;
    static locale = null;
    static return_type = 'ICS';
    static year_type = 'CIVIL';
}

/**
 * Class CurrentEndpoint
 * Builds the full endpoint URL used as the calendar subscription URL.
 */
class CurrentEndpoint {
    /** @type {string} Set by usage.js from the CalendarUrl global; already ends in `/calendar`. */
    static apiBase = '';
    static calendarType = null;
    static calendarId = null;
    static calendarYear = null;

    static serialize = () => {
        let currentEndpoint = CurrentEndpoint.apiBase;
        if (
            CurrentEndpoint.calendarType !== null &&
            CurrentEndpoint.calendarId !== null
        ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if (CurrentEndpoint.calendarYear !== null) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        const parameters = [];
        for (const key in RequestPayload) {
            if (RequestPayload[key] !== null && RequestPayload[key] !== '') {
                parameters.push(
                    key + '=' + encodeURIComponent(RequestPayload[key]),
                );
            }
        }
        const urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${currentEndpoint}${urlParams}`;
    };
}

export { CalendarType, RequestPayload, CurrentEndpoint };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:unit assets/js/__tests__/subscriptionUrl.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 5: Wire `usage.js` to the new module**

In `assets/js/usage.js`, delete lines 1–59 (the `CalendarType`, `RequestPayload` and `CurrentEndpoint` definitions and their doc comments) and replace them with:

```js
import {
    CalendarType,
    RequestPayload,
    CurrentEndpoint,
} from './subscriptionUrl.js';
```

Then, inside the `DOMContentLoaded` handler, set the base **before** the existing `updateSubscriptionURL()` call:

```js
document.addEventListener('DOMContentLoaded', () => {
    CurrentEndpoint.apiBase = CalendarUrl;
    handleHashChange();
    updateSubscriptionURL();
```

`RequestPayload` is imported because `CurrentEndpoint.serialize()` closes over the module's own copy; the
import in `usage.js` keeps the symbol available should later code set a payload field. If ESLint reports it as
unused, drop it from the import list.

- [ ] **Step 6: Verify nothing regressed**

Run: `yarn lint && yarn test:unit`

Expected: ESLint clean, all unit tests pass.

Then, with the docker stack up, confirm the page still renders the same URL as before:

```bash
docker compose up -d --force-recreate litcal-frontend
curl -s http://localhost:3000/usage.php | grep -c 'id="calSubscriptionUrl"'
```

Expected: `1`.

- [ ] **Step 7: Commit**

```bash
git add assets/js/subscriptionUrl.js assets/js/__tests__/subscriptionUrl.test.js assets/js/usage.js
git commit -m "refactor: extract the subscription URL model out of usage.js

Moves CalendarType, RequestPayload and CurrentEndpoint into their own
module so the URL composition can be unit-tested without a browser, and
makes apiBase an injected field rather than a read of the CalendarUrl
global. No behaviour change."
```

---

### Task 2: Add the rite segment to the URL model

**Files:**

- Modify: `assets/js/subscriptionUrl.js`
- Modify: `assets/js/__tests__/subscriptionUrl.test.js`

**Interfaces:**

- Consumes: `CurrentEndpoint`, `RequestPayload`, `CalendarType` from Task 1.
- Produces: `CurrentEndpoint.rite` — a static string field defaulting to `'roman'`, emitted as a path segment on every `serialize()` call.

- [ ] **Step 1: Write the failing tests**

Add to `assets/js/__tests__/subscriptionUrl.test.js`. Also add `CurrentEndpoint.rite = 'roman';` to the `reset()` helper so each test starts from the default.

```js
describe('CurrentEndpoint rite segment', () => {
    beforeEach(reset);

    it('defaults to the roman rite', () => {
        expect(CurrentEndpoint.rite).toBe('roman');
    });

    it('emits the roman segment explicitly', () => {
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits the rite before a national calendar', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = 'IT';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman/nation/IT?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits the ambrosian rite before a diocesan calendar', () => {
        CurrentEndpoint.rite = 'ambrosian';
        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId = 'lugano_ch';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/ambrosian/diocese/lugano_ch?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits the rite alone for the ambrosian rite-level calendar', () => {
        CurrentEndpoint.rite = 'ambrosian';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/ambrosian?return_type=ICS&year_type=CIVIL',
        );
    });

    it('keeps the year after the calendar segment', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = 'IT';
        CurrentEndpoint.calendarYear = 2026;
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman/nation/IT/2026?return_type=ICS&year_type=CIVIL',
        );
    });
});
```

The five tests written in Task 1 now expect the pre-rite URLs, so update their expectations to include `/roman`:

- `.../calendar?return_type=...` becomes `.../calendar/roman?return_type=...`
- `.../calendar/nation/IT?...` becomes `.../calendar/roman/nation/IT?...`
- `.../calendar/diocese/romamo_it?...` becomes `.../calendar/roman/diocese/romamo_it?...`
- the "omits the calendar segment" and "skips null and empty payload fields" cases likewise gain `/roman`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test:unit assets/js/__tests__/subscriptionUrl.test.js`

Expected: FAIL — the rite tests report `undefined` for `CurrentEndpoint.rite`, and the updated Task 1 expectations report a missing `/roman` segment.

- [ ] **Step 3: Implement the rite segment**

In `assets/js/subscriptionUrl.js`, add the field and emit it first:

```js
    /**
     * The liturgical rite, as a plain string (`'roman'` / `'ambrosian'`) rather
     * than the components-js `Rite` enum, which this module cannot import.
     *
     * Emitted unconditionally, `roman` included. The API's
     * `Router::extractRiteSegment()` accepts the explicit spelling and treats
     * `/calendar/roman/nation/IT` and `/calendar/nation/IT` as the same request,
     * so rite-explicit URLs are the default from here on and users transition
     * onto them. URLs already pasted into calendar apps keep resolving.
     *
     * @type {string}
     */
    static rite = 'roman';
```

and in `serialize()`, immediately after `let currentEndpoint = CurrentEndpoint.apiBase;`:

```js
// Before the calendar segment, never after: apiBase already ends in
// `/calendar`, and `/calendar/nation/IT/roman` is not a route.
currentEndpoint += `/${CurrentEndpoint.rite}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test:unit assets/js/__tests__/subscriptionUrl.test.js`

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add assets/js/subscriptionUrl.js assets/js/__tests__/subscriptionUrl.test.js
git commit -m "feat: make the subscription URL rite-explicit

Adds a rite path segment between the API base and the calendar segment,
emitted for every rite including roman. Rite-explicit URLs become the
default so users transition onto them rather than leaving roman an
implicit special case; the implicit spelling keeps resolving, so URLs
already pasted into calendar apps are unaffected."
```

---

### Task 3: Replace the PHP CalendarSelect with the JS components

**Files:**

- Modify: `usage.php:1-22` (drop the import and construction, add two label strings), `usage.php:134-142` (containers)
- Modify: `assets/js/usage.js`

**Interfaces:**

- Consumes: `CurrentEndpoint` from Task 2.
- Produces: DOM ids `#riteSelect` and `#calendarSelect`, and containers `#riteSelectContainer` and `#calendarSelectContainer`, which Task 5's e2e spec selects on.

- [ ] **Step 1: Strip the PHP component out of `usage.php`**

Delete line 3 (`use LiturgicalCalendar\Components\CalendarSelect;`) and line 7 (`$CalendarSelect = new CalendarSelect(['locale' => $i18n->LOCALE]);`).

Add two entries to the `$messages` array so the labels stay in gettext rather than being duplicated in a JS translation map:

```php
    /** translators: label for dropdown to select which calendar to subscribe to */
    'Select calendar'          => _('Select calendar'),
    /** translators: label for dropdown to select the liturgical rite (Roman or Ambrosian) */
    'Select rite'              => _('Select rite'),
```

- [ ] **Step 2: Replace the rendered select with containers**

Replace the `<div class="form-group col-md">` block at `usage.php:134-142` — the one containing `echo $CalendarSelect ... ->getSelect();` — with:

```html
<div class="form-group col-md" id="riteSelectContainer"></div>
<div class="form-group col-md" id="calendarSelectContainer"></div>
```

- [ ] **Step 3: Verify the page still loads without the PHP component**

```bash
docker compose up -d --force-recreate litcal-frontend
curl -s http://localhost:3000/usage.php | grep -ciE "fatal error|uncaught"
curl -s http://localhost:3000/usage.php | grep -c 'id="calendarSelectContainer"'
```

Expected: `0` errors, `1` container. The dropdown is absent at this point — Step 4 supplies it.

- [ ] **Step 4: Build the components in `usage.js`**

Add to the import block at the top of `assets/js/usage.js`:

```js
import {
    ApiClient,
    CalendarSelect,
    RiteSelect,
    Rite,
} from '@liturgical-calendar/components-js';
```

Add this function above the `DOMContentLoaded` handler:

```js
/**
 * Builds the rite and calendar selects and wires them to the subscription URL.
 *
 * The two selects are linked so that changing the rite repartitions the calendar
 * list: the Ambrosian rite has no national tier and a different set of diocesan
 * calendars, so a selection under one rite is never carried into the other.
 */
const buildCalendarControls = async () => {
    await ApiClient.init(BaseUrl);

    const lang = currentLocale.language;

    // Must be in the DOM before linkToRiteSelect() below, which reads its
    // element to attach the rite-change listener.
    const riteSelect = new RiteSelect(lang)
        .class('form-select')
        .id('riteSelect')
        .label({ text: Messages['Select rite'], class: 'form-label' });
    riteSelect.appendTo('#riteSelectContainer');

    const calendarSelect = new CalendarSelect(lang)
        .class('form-select')
        .id('calendarSelect')
        .label({ text: Messages['Select calendar'], class: 'form-label' })
        .allowNull(true);
    calendarSelect.appendTo('#calendarSelectContainer');

    calendarSelect.linkToRiteSelect(riteSelect);

    // Default to the rite-level calendar rather than the first nation, so the
    // card opens on the General Roman Calendar.
    calendarSelect._domElement.value = '';

    document.getElementById('riteSelect').addEventListener('change', (ev) => {
        CurrentEndpoint.rite = ev.target.value;
        updateSubscriptionURL();
    });
    document
        .getElementById('calendarSelect')
        .addEventListener('change', updateSubscriptionURL);

    updateSubscriptionURL();
};
```

- [ ] **Step 5: Replace the old change listener with the async build**

In the `DOMContentLoaded` handler at the bottom of `assets/js/usage.js`, delete the trailing block:

```js
// Event: Calendar select change
const calendarSelect = document.getElementById('calendarSelect');
if (calendarSelect) {
    calendarSelect.addEventListener('change', updateSubscriptionURL);
}
```

and replace it with:

```js
// The selects are built asynchronously, so their change listeners are
// attached inside buildCalendarControls() once the elements exist.
buildCalendarControls().catch((error) => {
    console.error(
        `Could not build the calendar subscription controls: ${error.message}`,
    );
});
```

`updateSubscriptionURL()` is still called earlier in the handler; it returns early when `#calendarSelect` is absent, so the pre-build call is harmless.

- [ ] **Step 6: Set the initial rite from the enum**

`CurrentEndpoint.rite` defaults to the string `'roman'`. Assert that this matches the library's enum by
setting it explicitly at the top of `buildCalendarControls()`, right after `await ApiClient.init(BaseUrl);`:

```js
CurrentEndpoint.rite = Rite.ROMAN;
```

- [ ] **Step 7: Verify in a browser**

```bash
docker compose up -d --force-recreate litcal-frontend
yarn lint
```

Then run this throwaway script from the repo root (it needs the project's `node_modules` to resolve `playwright`):

```js
// verify.tmp.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:3000/usage.php', {
    waitUntil: 'networkidle',
});
await page.click('button[data-bs-target="#calSubscription"]');
await page.waitForSelector('#calendarSelect', { state: 'visible' });
const read = () => page.locator('#calSubscriptionUrl').innerText();
console.log('roman, empty   ->', await read());
await page.selectOption('#calendarSelect', 'IT');
console.log('roman, IT      ->', await read());
await page.selectOption('#riteSelect', 'ambrosian');
console.log('ambrosian      ->', await read());
await page.selectOption('#calendarSelect', 'lugano_ch');
console.log('ambr, lugano   ->', await read());
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
```

Run: `node verify.tmp.mjs && rm verify.tmp.mjs`

Expected:

```text
roman, empty   -> http://localhost:8000/calendar/roman?return_type=ICS&year_type=CIVIL
roman, IT      -> http://localhost:8000/calendar/roman/nation/IT?return_type=ICS&year_type=CIVIL
ambrosian      -> http://localhost:8000/calendar/ambrosian?return_type=ICS&year_type=CIVIL
ambr, lugano   -> http://localhost:8000/calendar/ambrosian/diocese/lugano_ch?return_type=ICS&year_type=CIVIL
errors: none
```

- [ ] **Step 8: Commit**

```bash
git add usage.php assets/js/usage.js
git commit -m "feat: add a rite selector to the calendar subscription card

Replaces the server-rendered PHP CalendarSelect with the JS CalendarSelect
and RiteSelect, linked so the calendar list repartitions when the rite
changes -- the Ambrosian rite has no national tier and a different set of
diocesan calendars, neither of which a server-rendered select can reflect
without a round trip.

allowNull makes the rite-level calendar selectable, so the General Roman
Calendar and the Ambrosian Calendar can now be subscribed to; previously
only a nation or a diocese could."
```

---

### Task 4: Gate the PHP-components bootstrap to `examples.php`

With Task 3 landed, nothing in the frontend's own pages uses the PHP components. The bootstrap survives only
for the embedded PHP example, which resolves the host's singleton because its own `ApiClient::getInstance()`
sits inside a `$directAccess` branch that does not run when included.

**Files:**

- Modify: `includes/common.php:290-338`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm the block has no other consumer**

```bash
grep -rn '\$httpClient\|\$cache\|\$logger\|\$filesystemAdapter' --include=*.php . \
  | grep -v '^./vendor\|^./examples\|^./includes/common.php'
```

Expected: no output. If anything appears, stop and reassess — the gate would break it.

- [ ] **Step 2: Wrap the bootstrap**

In `includes/common.php`, wrap lines **290–338**: from the `try {` that opens `$logger = new
Logger('liturgical-calendar');` down to and including the `]);` that closes `ApiClient::getInstance([`.

Note there is a second, unrelated `try {` at line 200 — do not start there. Do **not** wrap the `$logsDir`
setup at lines 276–288; it runs unconditionally and the wrapped block reads `$logsDir` from it.

Verified: no `$logger`, `$cache` or `$httpClient` reference appears after line 338 in this file, so nothing below the gate breaks.

Add a comment recording why the gate is safe:

```php
// The PHP components library is configured only for the embedded PHP example
// (examples.php?example=PHP). That example detects it is being included rather
// than requested directly, skips its own autoloader and its own
// ApiClient::getInstance(), and resolves both from this host — see
// examples/php/index.php. No other page consumes $logger, $cache or
// $httpClient, and every page that declares $apiClient immediately reassigns
// it with LiturgicalCalendar\Frontend\ApiClient, a different class.
if ('examples' === basename($_SERVER['SCRIPT_FILENAME'], '.php')) {
    // ... existing logger / cache / httpClient / ApiClient block, unchanged ...
}
```

Indent the wrapped block by one level. Do not change any statement inside it.

- [ ] **Step 3: Verify the example still works and other pages are unaffected**

```bash
docker compose up -d --force-recreate litcal-frontend

# The example must still render its calendar
curl -s -X POST "http://localhost:3000/examples.php?example=PHP" \
  -d "rite=roman&national_calendar=IT&year=2026" | grep -c '<table id="LitCalTable">'

# Every page must stay error-free
for f in $(ls *.php | grep -v phpstan-bootstrap); do
  errs=$(curl -s "http://localhost:3000/$f" | grep -ciE "Fatal error|Uncaught|Warning:</b>")
  printf "%-28s errors:%s\n" "$f" "$errs"
done
```

Expected: `1` for the table, and `errors:0` for every page.

- [ ] **Step 4: Run the PHP gates**

Run: `composer parallel-lint && composer lint && composer analyse && composer test`

Expected: all clean, 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add includes/common.php
git commit -m "perf: gate the PHP-components bootstrap to the page that uses it

The Monolog logger, filesystem cache adapter, production Guzzle client and
ApiClient singleton were constructed on all 19 pages but consumed by one:
the embedded PHP example, which skips its own autoloader and singleton when
included and resolves both from the host. Nothing outside common.php reads
\$httpClient, \$cache or \$logger."
```

---

### Task 5: Permanent Playwright coverage

`usage.php` has broken twice from library changes with no test to catch it. This spec locks in the rite behaviour and the URL shape.

**Files:**

- Create: `e2e/usage.spec.ts`

**Interfaces:**

- Consumes: `#riteSelect`, `#calendarSelect`, `#calSubscriptionUrl` and the accordion toggle `button[data-bs-target="#calSubscription"]` from Task 3.
- Produces: nothing.

- [ ] **Step 1: Write the spec**

Create `e2e/usage.spec.ts`:

```ts
import { test, expect, Page } from '@playwright/test';

/**
 * Tests for the calendar subscription card on usage.php.
 *
 * The card's rite and calendar selects are rendered client-side by
 * liturgy-components-js, and the subscription URL is rite-explicit: the rite
 * segment is emitted for every rite, `roman` included.
 */

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

/** Opens usage.php and expands the collapsed subscription accordion. */
async function openSubscriptionCard(page: Page): Promise<void> {
    await page.goto(`${BASE}/usage.php`);
    await page.waitForLoadState('networkidle');
    await page.click('button[data-bs-target="#calSubscription"]');
    await page.waitForSelector('#calendarSelect', { state: 'visible' });
    await page.waitForSelector('#riteSelect', { state: 'visible' });
}

const subscriptionUrl = (page: Page) =>
    page.locator('#calSubscriptionUrl').innerText();

test.describe('usage.php - calendar subscription URL', () => {
    test('both selects render client-side', async ({ page }) => {
        await openSubscriptionCard(page);
        await expect(page.locator('#riteSelect')).toBeVisible();
        await expect(page.locator('#calendarSelect')).toBeVisible();
    });

    test('the roman rite-level calendar is selectable and rite-explicit', async ({
        page,
    }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#calendarSelect', '');
        expect(await subscriptionUrl(page)).toContain('/calendar/roman?');
    });

    test('a roman national calendar carries the explicit rite', async ({
        page,
    }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#calendarSelect', 'IT');
        expect(await subscriptionUrl(page)).toContain(
            '/calendar/roman/nation/IT?',
        );
    });

    test('a roman diocesan calendar carries the explicit rite', async ({
        page,
    }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#calendarSelect', 'romamo_it');
        expect(await subscriptionUrl(page)).toContain(
            '/calendar/roman/diocese/romamo_it?',
        );
    });

    test('the ambrosian rite-level calendar', async ({ page }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#riteSelect', 'ambrosian');
        await page.selectOption('#calendarSelect', '');
        expect(await subscriptionUrl(page)).toContain('/calendar/ambrosian?');
    });

    test('an ambrosian diocese', async ({ page }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#riteSelect', 'ambrosian');
        await page.selectOption('#calendarSelect', 'lugano_ch');
        expect(await subscriptionUrl(page)).toContain(
            '/calendar/ambrosian/diocese/lugano_ch?',
        );
    });

    test('every emitted URL carries an explicit rite segment', async ({
        page,
    }) => {
        await openSubscriptionCard(page);
        for (const [rite, calendar] of [
            ['roman', ''],
            ['roman', 'IT'],
            ['ambrosian', ''],
            ['ambrosian', 'lugano_ch'],
        ]) {
            await page.selectOption('#riteSelect', rite);
            await page.selectOption('#calendarSelect', calendar);
            expect(await subscriptionUrl(page)).toMatch(
                /\/calendar\/(roman|ambrosian)(\/|\?)/,
            );
        }
    });

    test('the query parameters are preserved', async ({ page }) => {
        await openSubscriptionCard(page);
        const url = await subscriptionUrl(page);
        expect(url).toContain('return_type=ICS');
        expect(url).toContain('year_type=CIVIL');
    });
});

test.describe('usage.php - rite repartitions the calendar list', () => {
    test('the ambrosian rite drops the national tier and offers its own dioceses', async ({
        page,
    }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#riteSelect', 'ambrosian');

        const nationalCount = await page
            .locator('#calendarSelect option[data-calendartype="national"]')
            .count();
        expect(nationalCount).toBe(0);

        const values = await page.$$eval('#calendarSelect option', (os) =>
            os.map((o) => o.value),
        );
        for (const diocese of [
            'milano_it',
            'bergam_it',
            'novara_it',
            'lugano_ch',
        ]) {
            expect(values).toContain(diocese);
        }
    });

    test('switching back to the roman rite restores the national tier', async ({
        page,
    }) => {
        await openSubscriptionCard(page);
        await page.selectOption('#riteSelect', 'ambrosian');
        await page.selectOption('#riteSelect', 'roman');

        const nationalCount = await page
            .locator('#calendarSelect option[data-calendartype="national"]')
            .count();
        expect(nationalCount).toBeGreaterThan(0);

        const values = await page.$$eval('#calendarSelect option', (os) =>
            os.map((o) => o.value),
        );
        expect(values).not.toContain('lugano_ch');
    });
});
```

- [ ] **Step 2: Type-check the spec**

Run: `yarn typecheck`

Expected: clean.

- [ ] **Step 3: Run the spec**

Run: `yarn test:ci:chromium e2e/usage.spec.ts`

Expected: 10 tests pass.

If the `data-calendartype` assertions fail, check the `switch` in `updateSubscriptionURL()` in
`assets/js/usage.js`: its cases must read `'national'` / `'diocesan'`. components-js 2.1.0 and components-php
v4 emit those short forms, not the older `nationalcalendar` / `diocesancalendar`.

- [ ] **Step 4: Run the whole suite for regressions**

Run: `yarn test:ci:chromium`

Expected: no new failures relative to the pre-change baseline. Record any pre-existing failures rather than fixing them here.

- [ ] **Step 5: Commit**

```bash
git add e2e/usage.spec.ts
git commit -m "test: cover the rite selector and subscription URL on usage.php

usage.php has broken twice from components library changes with no test to
catch it. Locks in the rite-explicit URL shape across rite x
{rite-level, nation, diocese}, and the repartitioning of the calendar list
when the rite changes."
```

---

### Task 6: Documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `.serena/memories/project_overview.md`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Record the pattern in `CLAUDE.md`**

Under `## Important Patterns`, after the "Accept-Language Header and CalendarSelect" subsection, add:

```markdown
### Rite awareness

The API routes a rite as a bare path segment between `calendar` and any nation or
diocese pair — `/calendar/ambrosian/diocese/lugano_ch`. There is no
`/calendar/rite/{rite}` spelling and no query parameter.

`usage.php` emits the segment for **every** rite, `roman` included, so users
transition onto rite-explicit URLs. The implicit spelling keeps resolving, so
subscription URLs already pasted into calendar apps are unaffected.

The Ambrosian rite has no national tier and its own set of diocesan calendars
(`milano_it`, `bergam_it`, `novara_it`, `lugano_ch`), so a `CalendarSelect` must
be linked to a `RiteSelect` — via `calendarSelect.linkToRiteSelect(riteSelect)`,
or `ApiOptions.linkToCalendarSelect().linkToRiteSelect()` when an `ApiOptions`
form is already present — to repartition its list when the rite changes.

### PHP vs JS components

Frontend pages use **liturgy-components-js**. The PHP library
(`liturgical-calendar/components`) is a dependency solely for the embedded PHP
example: `examples/php/index.php` detects that it is being included rather than
requested directly, skips its own autoloader and its own `ApiClient` singleton,
and resolves both from the host. `includes/common.php` therefore keeps its
`ApiClient::getInstance()` bootstrap, gated to `examples.php`. Do not remove the
composer dependency — the example crashes without it.
```

- [ ] **Step 2: Update the Serena memory**

In `.serena/memories/project_overview.md`, the PHP deps line already reads `^4.2`. Append a clause to the
`liturgy-components-js` bullet noting that frontend pages use the JS library and the PHP one serves the
embedded example only.

- [ ] **Step 3: Format and lint**

Run: `yarn format:md && composer lint:md`

Expected: no issues.

`.prettierrc` (`tabWidth: 4`, `singleQuote: true`) and `.markdownlint.yaml`
(`MD007: indent: 4`) agree, so the tree is already a fixed point of both tools:
`format:md` must touch only the files this task edited. If it reformats
anything else, something regressed in those configs — investigate rather than
committing the churn.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .serena/memories/project_overview.md
git commit -m "docs: record rite awareness and the PHP/JS component split"
```

---

## Final verification

- [ ] **Run every gate**

```bash
composer parallel-lint && composer lint && composer analyse && composer test
yarn lint && yarn typecheck && yarn test:unit
composer lint:md
yarn test:ci:chromium
```

- [ ] **Confirm the deliverables**

- The subscription card shows a rite select and a calendar select, both client-rendered.
- Selecting Ambrosian repartitions the calendar list and reaches all four Ambrosian dioceses.
- Every subscription URL carries an explicit rite segment.
- The General Roman Calendar and the Ambrosian Calendar are both subscribable.
- `examples.php?example=PHP` still renders a calendar.
- `usage.php` contains no reference to `LiturgicalCalendar\Components`.
