# DayViewer Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Replace the 257 hand-wired lines of `assets/js/liturgyOfAnyDay.js` with one `DayViewer.mountInto()` call, without changing what the page does.

**Architecture:** Write a characterization Playwright spec against the CURRENT hand-wired page first, so it
pins existing behaviour. Then convert the JS to `DayViewer` and prove the same spec still passes, unchanged.
`liturgyOfAnyDay.php` gains only a `$messages` block for one new error string; its four containers already
match `DayViewer`'s four slot names.

**Tech Stack:** liturgy-components-js 2.2.0 (CDN import map in production, `assets/components-js` symlink in dev), vanilla ES modules, Playwright, PHP 8.4 with gettext.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-11-dayviewer-adoption-design.md`. Read it before starting.
- **The characterization spec must be written and passing BEFORE any change to `liturgyOfAnyDay.js`,
  and must not be edited afterwards.** A test written against converted code proves only that the new
  code does what it does.
- **Use `showToast(message, 'danger')`, NOT `toastr`.** Raw toastr is loaded only for
  `['index', 'extending', 'usage', 'missals-editor', 'admin-dashboard', 'examples']`
  (`layout/footer.php:125`); `liturgyOfAnyDay` is not among them. `window.showToast(message, type)`
  from `assets/js/toast.js` is loaded for every page at `layout/footer.php:87`.
- **`label()` is one-shot.** The theme bag calls it. After mounting, `viewer.<child>.label({...})`
  throws `Label has already been set`. Custom label text goes through the per-child `labelText` theme
  key. `id()` is NOT one-shot and may be set after the mount.
- **Do not modify** `composer.json`, `package.json`, `composer.lock`, `vendor/`, or any lint/format
  config.
- **Do not convert** `usage.js` or `index.js`. They are deliberately out of scope.
- **gettext:** numbered placeholders (`%1$s`) if any format string is added.
- **Never `git commit --no-verify`.**
- **Element ids that must survive the conversion:** `riteSelect`, `calendarSelect`, `apiOptionsLocale`,
  `liturgyOfAnyDay`. These four are set explicitly by our code.
- **The date-control ids are library-generated and are NOT contractual.** They currently render as
  `day`, `month` and `year-2` — that suffix is the library's own de-duplication, not something we set.
  Do not assert on them, and do not treat a change there as a regression.
- **`DayViewer`'s public getters, verified against `src/MetaComponents/DayViewer.js`:** `riteSelect`,
  `calendarSelect`, `localeInput`, `liturgy`, `selectedLocale`. Use exactly these names.

## File Structure

| File                                     | Responsibility                                                  |
| ---------------------------------------- | --------------------------------------------------------------- |
| `e2e/liturgyOfAnyDay.spec.ts` (new)      | Characterization test. Written in Task 1, unchanged thereafter. |
| `assets/js/liturgyOfAnyDay.js` (rewrite) | One `DayViewer.mountInto()` call plus error routing.            |
| `liturgyOfAnyDay.php` (modify)           | Adds a `$messages` block and the `const Messages` script.       |
| `CLAUDE.md` (modify)                     | Records the meta-component pattern and what stays hand-wired.   |

---

### Task 1: Characterization spec against the CURRENT page

Nothing is converted in this task. The spec must pass against today's hand-wired implementation; that
is what makes it evidence later.

**Files:**

- Create: `e2e/liturgyOfAnyDay.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `e2e/liturgyOfAnyDay.spec.ts`, which Task 2 must leave byte-identical.

- [ ] **Step 1: Confirm the page works before writing anything**

The docker stack is already running (frontend `http://localhost:3000`, API `http://localhost:8000`).

```bash
curl -s http://localhost:3000/liturgyOfAnyDay.php | grep -c 'id="riteSelectContainer"'
```

Expected: `1`. If it is `0`, stop and report — the page is broken before you started.

- [ ] **Step 2: Write the spec**

Create `e2e/liturgyOfAnyDay.spec.ts`:

```ts
import { test, expect, Page } from '@playwright/test';

/**
 * Characterization tests for liturgyOfAnyDay.php.
 *
 * Written against the hand-wired implementation and deliberately NOT edited when
 * that implementation is replaced by the DayViewer meta-component, so that the
 * same assertions prove the conversion preserved behaviour.
 */

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

/** Opens the page and waits for the client-rendered controls to exist. */
async function openPage(page: Page): Promise<void> {
    await page.goto(`${BASE}/liturgyOfAnyDay.php`);
    await page.waitForSelector('#riteSelect', {
        state: 'visible',
        timeout: 20000,
    });
    await page.waitForSelector('#calendarSelect', { state: 'visible' });
}

test.describe('liturgyOfAnyDay - controls render', () => {
    test('all four children mount into their containers', async ({ page }) => {
        await openPage(page);
        await expect(
            page.locator('#riteSelectContainer #riteSelect'),
        ).toBeVisible();
        await expect(
            page.locator('#calendarSelectContainer #calendarSelect'),
        ).toBeVisible();
        await expect(
            page.locator('#localeSelectContainer #apiOptionsLocale'),
        ).toBeVisible();
        await expect(
            page.locator('#liturgyOfAnyDayContainer #liturgyOfAnyDay'),
        ).toBeVisible();
    });

    test('the rite select offers roman and ambrosian', async ({ page }) => {
        await openPage(page);
        const values = await page.$$eval('#riteSelect option', (os) =>
            os.map((o) => (o as HTMLOptionElement).value),
        );
        expect(values).toContain('roman');
        expect(values).toContain('ambrosian');
    });

    test('the locale input is populated', async ({ page }) => {
        await openPage(page);
        const count = await page.locator('#apiOptionsLocale option').count();
        expect(count).toBeGreaterThan(0);
        const value = await page.locator('#apiOptionsLocale').inputValue();
        expect(value).not.toBe('');
    });
});

test.describe('liturgyOfAnyDay - rite repartitions the calendar list', () => {
    test('ambrosian drops the national tier and offers its own dioceses', async ({
        page,
    }) => {
        await openPage(page);
        await page.selectOption('#riteSelect', 'ambrosian');
        await expect
            .poll(() =>
                page
                    .locator(
                        '#calendarSelect option[data-calendartype="national"]',
                    )
                    .count(),
            )
            .toBe(0);
        const values = await page.$$eval('#calendarSelect option', (os) =>
            os.map((o) => (o as HTMLOptionElement).value),
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

    test('switching back to roman restores the national tier', async ({
        page,
    }) => {
        await openPage(page);
        await page.selectOption('#riteSelect', 'ambrosian');
        await page.selectOption('#riteSelect', 'roman');
        await expect
            .poll(() =>
                page
                    .locator(
                        '#calendarSelect option[data-calendartype="national"]',
                    )
                    .count(),
            )
            .toBeGreaterThan(0);
        const values = await page.$$eval('#calendarSelect option', (os) =>
            os.map((o) => (o as HTMLOptionElement).value),
        );
        expect(values).not.toContain('lugano_ch');
    });
});

test.describe('liturgyOfAnyDay - the rite reaches the request', () => {
    // The failure mode DayViewer exists to prevent: the form reads `ambrosian`
    // while every request still goes to /calendar/roman/. Only a network
    // assertion can see this — the DOM looks correct either way.
    test('choosing the ambrosian rite produces an /calendar/ambrosian request', async ({
        page,
    }) => {
        await openPage(page);
        const urls: string[] = [];
        page.on('request', (r) => {
            if (r.url().includes('/calendar')) urls.push(r.url());
        });

        await page.selectOption('#riteSelect', 'ambrosian');
        await expect
            .poll(
                () =>
                    urls.some((u) => /\/calendar\/ambrosian(\/|\?|$)/.test(u)),
                {
                    timeout: 15000,
                },
            )
            .toBe(true);
        expect(
            urls.some((u) => /\/calendar\/roman\/(nation|diocese)\//.test(u)),
        ).toBe(false);
    });
});

test.describe('liturgyOfAnyDay - renders events', () => {
    test('the widget shows liturgical content for the default selection', async ({
        page,
    }) => {
        await openPage(page);
        const widget = page.locator('#liturgyOfAnyDay');
        await expect
            .poll(async () => (await widget.innerText()).trim().length, {
                timeout: 20000,
            })
            .toBeGreaterThan(0);
    });

    // Deliberately selects the day input by id but the year input by role: the
    // year input currently renders as `#year-2`, a library-generated suffix that
    // the conversion may legitimately change. Asserting on it would make this
    // test fail for a cosmetic reason and undermine its authority.
    test('changing the date re-fetches and still renders content', async ({
        page,
    }) => {
        await openPage(page);
        const widget = page.locator('#liturgyOfAnyDay');
        await expect
            .poll(async () => (await widget.innerText()).trim().length, {
                timeout: 20000,
            })
            .toBeGreaterThan(0);

        const urls: string[] = [];
        page.on('request', (r) => {
            if (r.url().includes('/calendar')) urls.push(r.url());
        });

        // #day is <input type="number"> and #month is a <select> — verified
        // against the running page. Do not use selectOption() on #day.
        await page.locator('#day').fill('15');
        await page.locator('#day').dispatchEvent('change');

        await expect
            .poll(() => urls.length, { timeout: 15000 })
            .toBeGreaterThan(0);
        await expect
            .poll(async () => (await widget.innerText()).trim().length, {
                timeout: 20000,
            })
            .toBeGreaterThan(0);
    });
});
```

- [ ] **Step 3: Type-check**

Run: `yarn typecheck`

Expected: clean.

- [ ] **Step 4: Run the spec against the CURRENT implementation**

Run: `yarn test:chromium e2e/liturgyOfAnyDay.spec.ts`

Expected: all 8 tests pass (plus the `setup` project's own test, which reports separately).

Do NOT use `yarn test:ci:chromium` — the docker stack already holds ports 3000 and 8000, and
`test:ci` tries to start its own servers and fails with "port already used".

**If a test fails here, the assertion is wrong, not the page.** Fix the test until it passes against
the current code. That is the entire point of this task — do not "fix" the page.

- [ ] **Step 5: Clear Playwright artifacts before committing**

Playwright writes `.md` files into the gitignored `test-results/` and `playwright-report/`, and
markdownlint's glob does not respect `.gitignore`, so the pre-commit hook will fail on them
(see issue #447):

```bash
rm -rf test-results playwright-report
```

- [ ] **Step 6: Commit**

```bash
git add e2e/liturgyOfAnyDay.spec.ts
git commit -m "test: characterize liturgyOfAnyDay.php before the DayViewer conversion

Written against the hand-wired implementation so the same assertions can
prove the conversion preserved behaviour. Includes a network-level assertion
that the Ambrosian rite reaches the request URL -- the silent failure mode
DayViewer exists to prevent, which no DOM assertion can detect."
```

---

### Task 2: Convert to DayViewer

**Files:**

- Rewrite: `assets/js/liturgyOfAnyDay.js`
- Modify: `liturgyOfAnyDay.php`

**Interfaces:**

- Consumes: `e2e/liturgyOfAnyDay.spec.ts` from Task 1 — must pass unchanged.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the error string to `liturgyOfAnyDay.php`**

The file has no `$messages` block. Add one after the `include_once` on line 13, following the pattern
at `usage.php:9-27`:

```php
include_once 'includes/common.php';

$messages = [
    /** translators: error shown when the liturgy page's calendar controls fail to load */
    'Failed to load' => _('Could not load the liturgy controls. Please try again later.'),
];

?><!doctype html>
```

- [ ] **Step 2: Expose it to JavaScript**

`liturgyOfAnyDay.php` has no `const Messages` script. Add one immediately before the footer include,
mirroring `usage.php:419-421`. Find the `include_once('./layout/footer.php');` line and insert above it:

```php
    <script>
        const Messages = <?php echo json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    </script>
```

- [ ] **Step 3: Verify the PHP renders**

`liturgyOfAnyDay.php` is a top-level PHP file, bind-mounted individually in docker, so an editor that
writes via temp+rename leaves the container serving the old inode:

```bash
docker compose up -d --force-recreate litcal-frontend
curl -s http://localhost:3000/liturgyOfAnyDay.php | grep -c "const Messages"
```

Expected: `1`.

- [ ] **Step 4: Rewrite `assets/js/liturgyOfAnyDay.js`**

Replace the ENTIRE file with:

```js
/**
 * Liturgy of Any Day - using the DayViewer meta-component.
 *
 * DayViewer bundles the RiteSelect, CalendarSelect, ApiOptions locale input and
 * LiturgyOfAnyDay widget that this page previously wired by hand, including the
 * rite's two-wire requirement: linkToRiteSelect() alone rebuilds the calendar
 * list but does NOT turn the rite into a path segment, so a hand-wired page can
 * read `ambrosian` while every request still goes to /calendar/roman/.
 *
 * The label text that used to come from a hand-rolled 12-language map now comes
 * from the library's own Messages, which covers 83 languages.
 */

import { ApiClient, DayViewer } from '@liturgical-calendar/components-js';

const initializePage = async () => {
    const apiClient = await ApiClient.init(BaseUrl);

    const viewer = await DayViewer.mountInto(
        {
            rite: '#riteSelectContainer',
            calendar: '#calendarSelectContainer',
            locale: '#localeSelectContainer',
            liturgy: '#liturgyOfAnyDayContainer',
        },
        {
            locale: currentLocale.language,
            apiClient,
            theme: {
                select: 'form-select',
                label: 'form-label',
                liturgy: { class: 'card shadow m-2' },
                dateControls: {
                    labelClass: 'form-label',
                    wrapperClass: 'col-md',
                },
            },
            onError: (error) => {
                console.error(`Liturgy of any day: ${error.message}`);
                showToast(Messages['Failed to load'], 'danger');
            },
        },
    );

    // ids are not theme keys, and id() is not one-shot -- unlike label(), which
    // the theme bag has already called on each child.
    viewer.riteSelect.id('riteSelect');
    viewer.calendarSelect.id('calendarSelect');
    viewer.localeInput.id('apiOptionsLocale');
    viewer.liturgy.id('liturgyOfAnyDay');
};

const startPage = () => {
    initializePage().catch((error) => {
        console.error(
            `Could not initialize the liturgy of any day page: ${error.message}`,
        );
        showToast(Messages['Failed to load'], 'danger');
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPage);
} else {
    startPage();
}
```

- [ ] **Step 5: Add the new globals to ESLint**

`showToast` and `Messages` are already declared in `eslint.config.mjs`. `currentLocale` and `BaseUrl`
are too. Confirm rather than assume:

```bash
grep -E "showToast|Messages|currentLocale|BaseUrl" eslint.config.mjs
```

Expected: all four present. If any is missing, add it to the `globals` block as `"readonly"` (or
`"writable"` for `currentLocale`, matching the existing entry).

- [ ] **Step 6: Lint and type-check**

Run: `yarn lint && yarn typecheck && composer lint`

Expected: all clean.

- [ ] **Step 7: Run the UNCHANGED characterization spec**

```bash
docker compose up -d --force-recreate litcal-frontend
yarn test:chromium e2e/liturgyOfAnyDay.spec.ts
```

Expected: the same 8 tests pass.

**Do not edit the spec to make it pass.** If a test fails, the conversion is wrong. Report the failure
with the assertion and the actual value. The most likely genuine mismatches, and what they mean:

- `#apiOptionsLocale` missing → `viewer.localeInput` is not the right getter name; check
  `docs/meta-components.md` in the library repo for the actual getter.
- `Label has already been set` thrown → something called `label()` after the theme bag did. Move that
  text into the per-child `labelText` theme key.
- The ambrosian network assertion fails → the rite is not reaching the request. This is the exact bug
  the component is supposed to prevent; report it rather than working around it.

- [ ] **Step 8: Verify the deleted translation map really is replaced**

The 86-line map is gone. Prove the labels are still localized rather than falling back to English:

```bash
cat > i18n-check.tmp.mjs <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addCookies([{ name: 'currentLocale', value: 'it', domain: 'localhost', path: '/' }]);
const p = await ctx.newPage();
await p.goto('http://localhost:3000/liturgyOfAnyDay.php', { waitUntil: 'networkidle' });
await p.waitForSelector('#riteSelect', { state: 'visible', timeout: 20000 });
const labels = await p.$$eval('label', (ls) => ls.map((l) => l.textContent.trim()).filter(Boolean));
console.log('labels:', labels);
await b.close();
EOF
node i18n-check.tmp.mjs; rm -f i18n-check.tmp.mjs
```

Expected: Italian label text (e.g. "Rito", "Lingua"), not English. Record the actual output in your
report. If the labels are English, the library's `Messages` is not being reached — report it.

- [ ] **Step 9: Confirm the line count actually dropped**

```bash
wc -l assets/js/liturgyOfAnyDay.js
```

Expected: roughly 60 lines, down from 257. Record the real number.

- [ ] **Step 10: Clear Playwright artifacts and commit**

```bash
rm -rf test-results playwright-report
git add assets/js/liturgyOfAnyDay.js liturgyOfAnyDay.php
git commit -m "refactor: mount liturgyOfAnyDay.php through the DayViewer meta-component

Replaces 257 lines of hand-wiring with one DayViewer.mountInto() call. The
library now owns the rite's two-wire requirement -- linkToRiteSelect() alone
rebuilds the calendar list but does not turn the rite into a path segment --
along with the locale-matching cascade and the label text that came from a
hand-rolled 12-language map, against the library's 83.

Mount failures now reach the user through showToast() instead of only the
console. toastr is not loaded on this page; showToast is loaded on all pages.

The characterization spec added in the previous commit passes unchanged."
```

---

### Task 3: Documentation

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Record the pattern**

In `CLAUDE.md`, under `## Important Patterns`, immediately after the `### PHP vs JS components`
subsection added previously, insert:

```markdown
### Meta-components

liturgy-components-js 2.2.0 ships two meta-components that bundle wiring this repo used to
re-derive by hand:

- **`DayViewer`** — the whole "liturgy of any day" page. Used by `assets/js/liturgyOfAnyDay.js`.
- **`CalendarResourcePicker`** — a `RiteSelect` plus a filtered `CalendarSelect`, for choosing a
  national or diocesan resource id.

Prefer them over hand-wiring. A `RiteSelect` needs **two** wires — `linkToRiteSelect()` AND
`apiClient.listenTo(riteSelect)` — and wiring only the first fails silently: the form reads
`ambrosian` while every request still goes to `/calendar/roman/`. The meta-components own that.

Two call sites stay hand-wired on purpose:

- `assets/js/usage.js` — `CalendarResourcePicker` rejects `CalendarSelectFilter.NONE` and makes the
  empty option a disabled placeholder. The subscription card needs an all-calendars list and a
  _selectable_ empty option meaning the rite-level calendar. Asked upstream as
  liturgy-components-js#42.
- `assets/js/index.js` — a PathBuilder/API-explorer page; neither meta-component models it.

Two API notes: the theme bag's keys are HTML roles (`select`, `label`, `input`, `wrapper`) with
per-child overrides named for the public getters; and `label()` is **one-shot**, so once the theme
bag has themed a child, custom label text must go through the per-child `labelText` key rather than
`viewer.<child>.label({ text })`, which throws. `id()` is not one-shot.
```

- [ ] **Step 2: Format and lint**

```bash
rm -rf test-results playwright-report
yarn format:md && composer lint:md && yarn lint:md
```

Expected: no issues. `format:md` must touch only `CLAUDE.md`. If it reformats anything else, stop and
report rather than committing the churn.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the meta-component pattern and what stays hand-wired"
```

---

## Final verification

- [ ] **Run every gate**

```bash
composer parallel-lint && composer lint && composer analyse && composer test
yarn lint && yarn typecheck && yarn test:unit
rm -rf test-results playwright-report && composer lint:md && yarn lint:md
yarn test:chromium e2e/liturgyOfAnyDay.spec.ts
yarn test:chromium e2e/usage.spec.ts
```

The `usage.spec.ts` run is a regression check: both pages share `layout/footer.php`'s import map, which
this branch already bumped to v2.2.0.

- [ ] **Confirm the deliverables**

- `e2e/liturgyOfAnyDay.spec.ts` is byte-identical to its Task 1 commit
  (`git diff <task-1-sha> -- e2e/liturgyOfAnyDay.spec.ts` is empty).
- `assets/js/liturgyOfAnyDay.js` no longer contains `translations`, `linkToRiteSelect`, or `listenTo`.
- The four ids `riteSelect`, `calendarSelect`, `apiOptionsLocale`, `liturgyOfAnyDay` still exist in the
  rendered page.
- Labels render in Italian under an `it` locale cookie.
- `usage.php` still produces rite-explicit subscription URLs.
