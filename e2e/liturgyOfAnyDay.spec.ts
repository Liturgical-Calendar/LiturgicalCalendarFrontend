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
    // Scoped to the events wrapper, not the whole `#liturgyOfAnyDay` widget: the
    // widget's subtree also contains the date header (`#dateElement`, rendered
    // synchronously in the constructor before any fetch) and the static
    // "Day"/"Month"/"Year" input labels, all of which are non-empty even if the
    // API call fails and zero events ever render. Verified against the live page
    // (see task-1-report.md "Fix round 1"): the events wrapper is the `.card-body`
    // div that is a direct child of `#liturgyOfAnyDay`, and each rendered event
    // gets its own `<h3>` title -- a `<h3>` only exists here when a genuine event
    // rendered, so asserting on it (rather than on non-empty text, which the "No
    // liturgical events found" fallback paragraph would also satisfy) is what
    // actually discriminates "real content rendered" from "container is present".
    test('the widget shows liturgical content for the default selection', async ({
        page,
    }) => {
        await openPage(page);
        const eventsWrapper = page.locator('#liturgyOfAnyDay > .card-body');
        await expect
            .poll(() => eventsWrapper.locator('h3').count(), {
                timeout: 20000,
            })
            .toBeGreaterThan(0);
        const title = await eventsWrapper.locator('h3').first().innerText();
        expect(title.trim().length).toBeGreaterThan(0);
    });

    // Deliberately selects the day input by id but leaves the year input alone: the
    // year input currently renders as `#year-2`, a library-generated suffix that
    // the conversion may legitimately change. Asserting on it would make this
    // test fail for a cosmetic reason and undermine its authority.
    //
    // No network assertion here: the day/month/year controls filter the
    // already-fetched full-year calendar data client-side (LiturgyOfAnyDay's
    // `change` handlers call `#handleDateChange()` -> `#renderEvents()`). Only a
    // year change, or a change that crosses the December 31st year_type boundary,
    // triggers a new `/calendar` request. Verified directly against the running
    // page: changing `#day` within the same year fires zero requests. Asserting
    // `urls.length > 0` here would fail against the very implementation this test
    // is meant to characterize, so instead this checks what actually happens on a
    // day change -- the rendered event content updates to reflect the new date.
    //
    // Scoped to the events wrapper (see comment above), not the whole widget:
    // comparing the whole widget's text would trivially differ before/after
    // because the date header alone changes ("Tuesday, August 11" -> whatever the
    // new date is) even if the event content underneath stayed stale.
    //
    // The target day is computed from the input's current value (`(current % 28)
    // + 1`) rather than hardcoded: the day input defaults to today's actual day
    // of month, so a hardcoded target (e.g. 15) would be a no-op -- and this test
    // would then fail for a reason unrelated to any regression -- on whatever day
    // of the month it happens to equal the hardcoded value.
    test('changing the date updates the rendered content', async ({
        page,
    }) => {
        await openPage(page);
        const eventsWrapper = page.locator('#liturgyOfAnyDay > .card-body');
        await expect
            .poll(() => eventsWrapper.locator('h3').count(), {
                timeout: 20000,
            })
            .toBeGreaterThan(0);
        const before = await eventsWrapper.innerText();

        // #day is <input type="number"> and #month is a <select> — verified
        // against the running page. Do not use selectOption() on #day.
        const dayLocator = page.locator('#day');
        const currentDay = parseInt(await dayLocator.inputValue(), 10);
        const targetDay = (currentDay % 28) + 1;
        await dayLocator.fill(String(targetDay));
        await dayLocator.dispatchEvent('change');

        await expect
            .poll(() => eventsWrapper.locator('h3').count(), {
                timeout: 20000,
            })
            .toBeGreaterThan(0);
        await expect
            .poll(async () => eventsWrapper.innerText(), { timeout: 15000 })
            .not.toBe(before);
    });
});

test.describe('liturgyOfAnyDay - styling', () => {
    // Regression guard for the post-mount `*InputConfig()` calls in
    // assets/js/liturgyOfAnyDay.js: DayViewer shares one resolved theme object
    // across all three date controls, so nothing in the theme bag can give
    // `#month` (a `<select>`) a different class than `#day`/the year input
    // (both `<input>`s). Verified live before the fix: all three rendered with
    // `class=""`.
    test('the date controls carry their Bootstrap classes', async ({ page }) => {
        await openPage(page);
        await expect(page.locator('#day')).toHaveClass(/form-control/);
        await expect(page.locator('#month')).toHaveClass(/form-select/);
        // The year input's id carries a library-generated suffix (`#year-2`)
        // that is explicitly non-contractual, so it is located by position
        // instead of by id: it is the last `type="number"` input in the widget.
        const yearInput = page
            .locator('#liturgyOfAnyDay input[type="number"]')
            .last();
        await expect(yearInput).toHaveClass(/form-control/);
    });

    test('the date header and a rendered event carry their theme classes', async ({
        page,
    }) => {
        await openPage(page);
        await expect(
            page.locator('#liturgyOfAnyDay > .card-header'),
        ).toHaveClass(/card-header/);
        const eventsWrapper = page.locator('#liturgyOfAnyDay > .card-body');
        await expect
            .poll(() => eventsWrapper.locator('h3').count(), { timeout: 20000 })
            .toBeGreaterThan(0);
        await expect(
            eventsWrapper.locator('.liturgy-event').first(),
        ).toHaveClass(/liturgy-event/);
    });
});

test.describe('liturgyOfAnyDay - localization', () => {
    // The library's Messages cover 83 languages; this guards against the whole
    // page silently falling back to English. "Giorno" was read off the live
    // page with `currentLocale=it` set (see final-fix-report.md), not guessed.
    test('the it locale renders localized labels', async ({ page, context }) => {
        await context.addCookies([
            { name: 'currentLocale', value: 'it', url: BASE },
        ]);
        await openPage(page);
        await expect(page.locator('label[for="day"]')).toHaveText('Giorno');
    });
});
