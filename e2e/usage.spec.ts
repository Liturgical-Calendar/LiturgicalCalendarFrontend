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

// SubscriptionBuilder renders the URL inside a <code> within its own copy
// <button>, and that <code> carries no id by design -- the component documents
// styling it with a descendant selector -- so this reaches it through the mount
// slot rather than through the id the hand-rolled card used to set.
const subscriptionUrl = (page: Page) =>
    page.locator('#calSubscriptionUrlWrapper code').innerText();

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
            os.map((o) => (o as HTMLOptionElement).value),
        );
        expect(values).not.toContain('lugano_ch');
    });
});
