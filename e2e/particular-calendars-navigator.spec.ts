import { test, expect } from './fixtures';

/**
 * Tests for the particular calendars navigator hub (extending.php with no `choice`, #66) and
 * its deep links, run as the single global admin the `chromium` project logs in as
 * (see e2e/auth.setup.ts).
 *
 * The tree it renders is driven by live `/calendars` and `/missals/roman` data — IT has a
 * Missal edition (IT_1983) and belongs to the `europe` wider region, NL belongs to `europe`
 * too but has no Missal edition, and FR has no national calendar yet but is on europe's
 * roster (all confirmed against the local stack, not assumed). These tests read only; they
 * submit no PUT/PATCH/POST and need no git restore.
 */

test.describe('Particular Calendars Navigator (hub)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/extending.php');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#particularCalendarsNavigator .pcn-accordion, #particularCalendarsNavigator .pcn-empty', { timeout: 15000 });
    });

    test('defaults to Show all, with Italy (Edit, Proper of Saints) and the Netherlands (Edit, no-Missal note) under Europe', async ({ page }) => {
        const showAll = page.locator('.pcn-view-toggle button', { hasText: 'Show all' });
        const myCalendars = page.locator('.pcn-view-toggle button', { hasText: 'My calendars' });
        await expect(showAll).toHaveAttribute('aria-pressed', 'true');
        await expect(myCalendars).toHaveAttribute('aria-pressed', 'false');

        const europe = page.locator('.accordion-item[data-kind="region"][data-id="europe"]');
        await expect(europe).toBeVisible();
        await europe.locator('.accordion-button').click();

        const italy = europe.locator('[data-kind="nation"][data-id="IT"]').first();
        await expect(italy).toBeVisible();
        await expect(italy.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
        await expect(italy.getByRole('link', { name: /Proper of Saints \(IT_1983\)/ })).toBeVisible();

        const netherlands = europe.locator('[data-kind="nation"][data-id="NL"]').first();
        await expect(netherlands).toBeVisible();
        await expect(netherlands.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
        await expect(netherlands.locator('.pcn-note')).toHaveText(/No national Missal data/);
    });
});

test.describe('Particular Calendars Navigator deep links', () => {
    test('?choice=national&calendar=IT loads Italy’s national settings', async ({ page }) => {
        await page.goto('/extending.php?choice=national&calendar=IT');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('#nationalCalendarName')).toHaveValue('IT');
        await expect(page.locator('#nationalCalendarSettingEpiphany')).toHaveValue('JAN6', { timeout: 15000 });
        await expect(page.locator('#nationalCalendarSettingAscension')).toHaveValue('SUNDAY');
        await expect(page.locator('#overlay')).toBeHidden({ timeout: 15000 });
    });

    test('?choice=widerRegion&calendar=europe&locale=it_IT loads Europe in it_IT', async ({ page }) => {
        await page.goto('/extending.php?choice=widerRegion&calendar=europe&locale=it_IT');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('#widerRegionCalendarName')).toHaveValue('europe - it_IT', { timeout: 15000 });
        await expect(page.locator('#widerRegionForm .litEventName').first()).toBeVisible({ timeout: 20000 });
        await expect(page.locator('#overlay')).toBeHidden({ timeout: 20000 });
    });

    test('an invalid deep link (malformed calendar id) shows "Calendar not found" and leaves the overlay hidden', async ({ page }) => {
        // "I@T" fails particularCalendarsTree.js's CALENDAR_ID_PATTERN, so parseDeepLink()
        // itself returns null before any opener runs.
        await page.goto('/extending.php?choice=national&calendar=I%40T');
        await page.waitForLoadState('networkidle');

        const toast = page.locator('.toast-error, .toast.bg-danger');
        await expect(toast).toBeVisible({ timeout: 10000 });
        await expect(toast).toContainText('Calendar not found');
        await expect(page.locator('#overlay')).toBeHidden({ timeout: 10000 });
    });

    test('an unknown calendar (well-formed but not offered) shows "Calendar not found" and leaves the overlay hidden', async ({ page }) => {
        // "ZZ" satisfies CALENDAR_ID_PATTERN but is a reserved, user-assigned ISO 3166-1
        // code the national datalist never offers, so openNationalDeepLink() returns false.
        await page.goto('/extending.php?choice=national&calendar=ZZ');
        await page.waitForLoadState('networkidle');

        const toast = page.locator('.toast-error, .toast.bg-danger');
        await expect(toast).toBeVisible({ timeout: 10000 });
        await expect(toast).toContainText('Calendar not found');
        await expect(page.locator('#overlay')).toBeHidden({ timeout: 10000 });
    });
});

test.describe('Particular Calendars sidebar entry', () => {
    test('has exactly one entry, linking to extending.php', async ({ page }) => {
        await page.goto('/extending.php');
        await page.waitForLoadState('networkidle');

        const entries = page.locator('a.nav-link[href="extending.php"]');
        await expect(entries).toHaveCount(1);
        await expect(entries.first()).toContainText('Particular Calendars');
    });
});

test.describe('Particular Calendars Navigator — Request access deep link', () => {
    test('permission-requests.php?object_type=national_calendar&object_id=roman/FR preselects national_calendar FR', async ({ page }) => {
        await page.goto('/permission-requests.php?object_type=national_calendar&object_id=roman/FR');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('input[name="requested_role"][value="calendar_editor"]')).toBeChecked({ timeout: 15000 });

        const row = page.locator('#permissionRows .card').first();
        await expect(row.locator('.perm-object-type')).toHaveValue('national_calendar', { timeout: 15000 });
        await expect(row.locator('.perm-object-id')).toBeVisible({ timeout: 15000 });
        await expect(row.locator('.perm-object-id')).toHaveValue('FR');
    });
});
