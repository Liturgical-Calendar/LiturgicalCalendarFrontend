import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { grantScope, revokeScope } from './support/grant';
import { settleCleanup } from './support/cleanup';

/**
 * Scenario 18 — the particular calendars navigator hub (extending.php with no `choice`, #66)
 * scoped to a national calendar editor.
 *
 * cei-editor is not seeded with its `editor@national_calendar:roman/IT` FGA tuple by
 * rbac.setup.ts (only `admin`-relation users get a tuple at seed time — see
 * e2e/rbac/support/seed.ts), so it is granted here, as scenario 17 does for the same
 * user/tuple, and revoked afterwards. No calendar source data is written by this spec, so
 * there is nothing for gitRestoreApiData() to revert.
 *
 * With that grant, cei-editor is editor of Italy's national calendar (which has a Missal
 * edition, IT_1983) and, being editor of a member nation of the `europe` wider region
 * without being editor of the region itself, gets Europe's `translate` action rather than
 * `edit` (particularCalendarsTree.js buildRegionNode()). France (FR) has no national
 * calendar yet and cei-editor holds no rights on it, so it offers only `request` — and it is
 * on europe's `roster` (confirmed against the live stack), so it appears under Europe in
 * "Show all".
 *
 * Assertions that depend on which calendars/editions/regions happen to exist on a given
 * stack are guarded with `test.skip()`, mirroring e2e/permission-pickers.spec.ts:21-22.
 */

const API_BASE_URL = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

/** `litcal_metadata` from `GET /calendars`. */
async function litcalMetadata(page: Page): Promise<Record<string, unknown>> {
    return (await (await page.request.get(`${API_BASE_URL}/calendars`)).json()).litcal_metadata ?? {};
}

/** The `region` codes with a published edition in `GET /missals/roman`. */
async function missalRegions(page: Page): Promise<string[]> {
    const missals = (await (await page.request.get(`${API_BASE_URL}/missals/roman`)).json()).litcal_missals ?? [];
    return missals.map((m: { region: string }) => m.region);
}

test.describe('particular calendars navigator — national calendar editor', () => {
    test.beforeAll(async () => {
        await grantScope('cei-editor');
    });

    test.afterAll(async () => {
        await settleCleanup('scenario 18', [revokeScope('cei-editor')]);
    });

    test('My calendars lists Italy with Edit and Proper of Saints, and drops the Netherlands', async ({ browser }) => {
        const cei = await actingAs(browser, 'cei-editor');
        const { page } = cei;
        try {
            const [metadata, missalRegionList] = await Promise.all([litcalMetadata(page), missalRegions(page)]);
            const nationalKeys = (metadata.national_calendars_keys as string[] | undefined) ?? [];
            test.skip(!nationalKeys.includes('IT'), 'Italy has no national calendar on this stack');
            test.skip(!missalRegionList.includes('IT'), '/missals/roman lists no edition for IT on this stack');

            await page.goto('/extending.php');
            await page.waitForLoadState('networkidle');
            await page.waitForSelector('#particularCalendarsNavigator .pcn-accordion, #particularCalendarsNavigator .pcn-empty', { timeout: 15000 });

            const myCalendars = page.locator('.pcn-view-toggle button', { hasText: 'My calendars' });
            await expect(myCalendars).toHaveAttribute('aria-pressed', 'true');

            const europe = page.locator('.accordion-item[data-kind="region"][data-id="europe"]');
            await expect(europe).toBeVisible();

            const italy = europe.locator('[data-kind="nation"][data-id="IT"]').first();
            await expect(italy).toBeVisible();
            await expect(italy.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
            await expect(italy.getByRole('link', { name: /Proper of Saints \(IT_1983\)/ })).toBeVisible();

            // The Netherlands is not cei-editor's and has no `mine` descendant, so it is
            // dropped entirely from "My calendars" (filterMine()).
            await expect(europe.locator('[data-kind="nation"][data-id="NL"]')).toHaveCount(0);
        } finally {
            await cei.context.close();
        }
    });

    test('My calendars lists Europe with Translate', async ({ browser }) => {
        const cei = await actingAs(browser, 'cei-editor');
        const { page } = cei;
        try {
            const metadata = await litcalMetadata(page);
            const regions = (metadata.wider_regions as Array<{ id?: string; name?: string; national_calendars?: string[]; roster?: string[] }> | undefined) ?? [];
            const europeMeta = regions.find((r) => (r.id ?? r.name) === 'europe');
            test.skip(!europeMeta, 'The europe wider region does not exist on this stack');

            const europeMembers = [...(europeMeta?.national_calendars ?? []), ...(europeMeta?.roster ?? [])];
            test.skip(!europeMembers.includes('IT'), 'Italy does not declare the europe wider region on this stack');

            await page.goto('/extending.php');
            await page.waitForLoadState('networkidle');
            await page.waitForSelector('#particularCalendarsNavigator .pcn-accordion, #particularCalendarsNavigator .pcn-empty', { timeout: 15000 });

            const europe = page.locator('.accordion-item[data-kind="region"][data-id="europe"]');
            await expect(europe).toBeVisible();
            // "My calendars" opens an accordion holding a `mine` node by default.
            await expect(europe.getByRole('link', { name: 'Translate' })).toBeVisible({ timeout: 15000 });
        } finally {
            await cei.context.close();
        }
    });

    test('Show all lists France with Request access, and it lands on the prefilled form', async ({ browser }) => {
        const cei = await actingAs(browser, 'cei-editor');
        const { page } = cei;
        try {
            const metadata = await litcalMetadata(page);
            const nationalKeys = (metadata.national_calendars_keys as string[] | undefined) ?? [];
            test.skip(nationalKeys.includes('FR'), 'France already has a national calendar on this stack');

            await page.goto('/extending.php');
            await page.waitForLoadState('networkidle');
            await page.waitForSelector('#particularCalendarsNavigator .pcn-accordion, #particularCalendarsNavigator .pcn-empty', { timeout: 15000 });

            await page.locator('.pcn-view-toggle button', { hasText: 'Show all' }).click();
            const showAll = page.locator('.pcn-view-toggle button', { hasText: 'Show all' });
            await expect(showAll).toHaveAttribute('aria-pressed', 'true');

            const europe = page.locator('.accordion-item[data-kind="region"][data-id="europe"]');
            await europe.locator('.accordion-button').click();

            const france = europe.locator('[data-kind="nation"][data-id="FR"]').first();
            await expect(france).toBeVisible();
            const requestLink = france.getByRole('link', { name: 'Request access' });
            await expect(requestLink).toBeVisible();

            await requestLink.click();
            await page.waitForURL(/permission-requests\.php\?/);
            await page.waitForLoadState('networkidle');

            await expect(page.locator('input[name="requested_role"][value="calendar_editor"]')).toBeChecked({ timeout: 15000 });
            const row = page.locator('#permissionRows .card').first();
            await expect(row.locator('.perm-object-type')).toHaveValue('national_calendar', { timeout: 15000 });
            await expect(row.locator('.perm-object-id')).toBeVisible({ timeout: 15000 });
            await expect(row.locator('.perm-object-id')).toHaveValue('FR');
        } finally {
            await cei.context.close();
        }
    });
});
