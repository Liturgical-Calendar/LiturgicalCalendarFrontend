import { test, expect } from './fixtures';
import { isValidWiderRegionId } from '../assets/js/prospectiveWiderRegions.js';

/**
 * The Calendar ID pickers of the access-request form (permission-requests.php).
 *
 * The diocesan scope used to be a CalendarSelect of existing diocesan calendars,
 * so a diocese could not request the `admin` access needed to CREATE its calendar
 * (issue #563). It now offers, for the Roman rite, the dioceses of every nation
 * that has a national calendar — which a diocesan calendar depends on — split
 * into existing calendars and those not yet created. Nothing here is submitted.
 */

const API_BASE_URL = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

test.describe('Access request form — diocesan calendar picker', () => {
    test('offers not-yet-created dioceses, only of nations with a national calendar', async ({ page }) => {
        const metadata = (await (await page.request.get(`${API_BASE_URL}/calendars`)).json()).litcal_metadata;
        const nationalKeys: string[] = metadata.national_calendars_keys;
        const existingDioceses: string[] = metadata.diocesan_calendars_keys;
        test.skip(!nationalKeys.includes('US'), 'The United States has no national calendar on this stack');
        test.skip(existingDioceses.includes('albany_us'), 'Albany already has a diocesan calendar on this stack');

        await page.goto('/permission-requests.php');
        await page.check('input[name="requested_role"][value="calendar_editor"]');
        const row = page.locator('#permissionRows .card').first();
        await row.locator('.perm-object-type').selectOption('diocesan_calendar');

        const nation = row.locator('.perm-object-nation');
        const diocese = row.locator('.perm-object-id');
        await expect(nation).toBeVisible({ timeout: 15000 });
        await expect(diocese).toBeDisabled();

        const nations = await nation.locator('option:not([value=""])').evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value));
        expect(nations).toContain('US');
        expect(nations).not.toContain('VA');
        for (const code of nations) {
            expect(nationalKeys, `${code} is offered, so it must have a national calendar`).toContain(code);
        }

        await nation.selectOption('US');
        await expect(diocese).toBeEnabled();
        const groupOf = (id: string) => diocese.locator(`option[value="${id}"]`).evaluate(o => (o.parentElement as HTMLOptGroupElement).label);
        expect(await groupOf('albany_us')).toMatch(/not yet created/i);
        if (existingDioceses.includes('boston_us')) {
            expect(await groupOf('boston_us')).toMatch(/existing/i);
        }
        await diocese.selectOption('albany_us');
        await expect(diocese).toHaveValue('albany_us');
    });

    test('says when the dioceses without a calendar could not be loaded, and retries', async ({ page }) => {
        const metadata = (await (await page.request.get(`${API_BASE_URL}/calendars`)).json()).litcal_metadata;
        test.skip(!metadata.national_calendars_keys.includes('US'), 'The United States has no national calendar on this stack');
        test.skip(metadata.diocesan_calendars_keys.includes('albany_us'), 'Albany already has a diocesan calendar on this stack');

        // The first load of the diocese list fails; every later one goes through.
        let failed = false;
        await page.route('**/assets/data/WorldDiocesesByNation.json', async (route) => {
            if (!failed) {
                failed = true;
                await route.fulfill({ status: 503, body: 'unavailable' });
                return;
            }
            await route.continue();
        });

        await page.goto('/permission-requests.php');
        await page.check('input[name="requested_role"][value="calendar_editor"]');
        const row = page.locator('#permissionRows .card').first();
        await row.locator('.perm-object-type').selectOption('diocesan_calendar');

        const notice = row.locator('.dioceses-unavailable');
        await expect(notice).toBeVisible({ timeout: 15000 });
        await row.locator('.perm-object-nation').selectOption('US');
        await expect(row.locator('.perm-object-id option[value="albany_us"]')).toHaveCount(0);

        await notice.getByRole('button').click();
        await expect(notice).toBeHidden();
        await expect(row.locator('.perm-object-nation')).toHaveValue('US');
        await expect(row.locator('.perm-object-id option[value="albany_us"]')).toHaveCount(1);
    });

    test('offers only existing calendars under the Ambrosian rite, with no nation step', async ({ page }) => {
        const metadata = (await (await page.request.get(`${API_BASE_URL}/calendars`)).json()).litcal_metadata;
        const ambrosian: string[] = (metadata.diocesan_calendars ?? [])
            .filter((c: { rite?: string }) => c.rite === 'ambrosian')
            .map((c: { calendar_id: string }) => c.calendar_id);
        test.skip(!ambrosian.includes('lugano_ch'), 'Lugano has no Ambrosian calendar on this stack');

        await page.goto('/permission-requests.php');
        await page.check('input[name="requested_role"][value="calendar_editor"]');
        const row = page.locator('#permissionRows .card').first();
        await row.locator('.perm-object-type').selectOption('diocesan_calendar');
        await expect(row.locator('.perm-object-nation')).toBeVisible({ timeout: 15000 });

        await row.locator('.perm-object-rite').selectOption('ambrosian');
        await expect(row.locator('.perm-object-nation')).toBeHidden();
        const diocese = row.locator('.perm-object-id');
        await expect(diocese).toBeEnabled();
        await diocese.selectOption('lugano_ch');
        await expect(diocese).toHaveValue('lugano_ch');
    });
});

test.describe('Access request form — wider region picker', () => {
    test('offers existing wider regions and prospective ones, told apart, keyed by id (#591, #1018)', async ({
        page,
    }) => {
        const metadata = (
            await (await page.request.get(`${API_BASE_URL}/calendars`)).json()
        ).litcal_metadata;
        const existingRegions: string[] = (metadata.wider_regions ?? []).map(
            (r: { id?: string; name?: string }) => r.id ?? r.name,
        );

        await page.goto('/permission-requests.php');
        await page.check(
            'input[name="requested_role"][value="calendar_editor"]',
        );
        const row = page.locator('#permissionRows .card').first();
        await row.locator('.perm-object-type').selectOption('wider_region');

        const select = row.locator('.perm-object-id');
        await expect(select).toBeVisible({ timeout: 15000 });

        const offered = await select
            .locator('option:not([value=""])')
            .evaluateAll((opts) =>
                opts.map((o) => ({
                    value: (o as HTMLOptionElement).value,
                    text: o.textContent ?? '',
                    group: (o.parentElement as HTMLOptGroupElement).label ?? '',
                })),
            );
        const offeredIds = offered.map((o) => o.value);

        for (const id of existingRegions) {
            expect(
                offered.find((o) => o.value === id)?.group,
                `${id} exists`,
            ).toMatch(/existing/i);
        }

        expect(offeredIds, 'nordic is offered').toContain('nordic');
        const nordic = offered.find((o) => o.value === 'nordic');
        expect(
            nordic?.text.startsWith('Nordic Countries'),
            `nordic's option text ("${nordic?.text}") starts with the resolved English label`,
        ).toBe(true);
        if (!existingRegions.includes('nordic')) {
            expect(nordic?.group).toMatch(/not yet created/i);
        }

        for (const continent of ['africa', 'oceania']) {
            expect(
                offeredIds,
                `${continent} is offered, prospective or existing`,
            ).toContain(continent);
        }

        for (const id of offeredIds) {
            expect(
                isValidWiderRegionId(id),
                `option value "${id}" satisfies the wider region id rule`,
            ).toBe(true);
        }

        expect(new Set(offeredIds).size, 'no region is listed twice').toBe(
            offeredIds.length,
        );

        await select.selectOption('nordic');
        await expect(select).toHaveValue('nordic');
    });
});
