import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { grantScope, revokeScope } from './support/grant';
import { gitRestoreApiData, settleCleanup } from './support/cleanup';
import { expectWriteApplied } from '../support/writeMode';

/**
 * Scenario 17 — a national calendar editor maintains their own nation's
 * translations of a wider region, and nothing else of it.
 *
 * A wider region is shared by several nations, and its translations are per
 * nation: europe's `it_IT` is Italy's. So an editor of `national_calendar:roman/IT`
 * (cei-editor) may write europe's `it_IT` through
 * `PUT /data/widerregion/europe/it_IT` — authorized by
 * `OpenFgaAuthorizationMiddleware::forWiderRegionLocale()`, editor on the wider
 * region OR on the locale's nation — but not `fr_FR`, and not the whole-region
 * PATCH. The page shows the same rule (assets/js/widerRegionEditRights.js): every
 * other nation's locale and field is locked, and Save sends the per-locale PUT.
 *
 * cei-editor's editor tuple on IT is granted here and revoked after, as in
 * scenario 10. The it_IT write is a round-trip of the stored translations, and
 * gitRestoreApiData() reverts it all the same. DISK MODE ONLY, like scenario 10:
 * the writes assert their disposition.
 */

const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;
const API_REPO = process.env.API_REPO_PATH || path.resolve(__dirname, '../../../LiturgicalCalendarAPI');
const EUROPE_DIR = path.join(API_REPO, 'jsondata', 'sourcedata', 'rite', 'roman', 'calendars', 'wider_regions', 'europe');

const europeTranslations = (locale: string): Record<string, string> =>
    JSON.parse(fs.readFileSync(path.join(EUROPE_DIR, 'i18n', `${locale}.json`), 'utf8'));

test.describe('wider region translations by nation', () => {
    test.beforeAll(async () => {
        await grantScope('cei-editor');
    });

    test.afterAll(async () => {
        await settleCleanup('scenario 17', [revokeScope('cei-editor'), gitRestoreApiData()]);
    });

    test('the API lets an editor of Italy write europe\'s it_IT and nothing else', async ({ browser }) => {
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        const cei = await actingAs(browser, 'cei-editor');
        try {
            const own = await cei.page.request.put(`${API_BASE}/data/widerregion/europe/it_IT`, {
                headers, data: europeTranslations('it_IT')
            });
            await expectWriteApplied(own, 'PUT /data/widerregion/europe/it_IT for an editor of IT');

            const other = await cei.page.request.put(`${API_BASE}/data/widerregion/europe/fr_FR`, {
                headers, data: europeTranslations('fr_FR')
            });
            expect(other.status(), `PUT fr_FR should be 403 for an editor of IT; got ${other.status()}: ${await other.text()}`).toBe(403);

            // The whole region is not theirs: the PATCH still needs editor on the wider region.
            const whole = await cei.page.request.patch(`${API_BASE}/data/widerregion/europe`, {
                headers: { ...headers, 'Accept-Language': 'it-IT' }, data: {}
            });
            expect(whole.status(), `PATCH /data/widerregion/europe should be 403; got ${whole.status()}`).toBe(403);
        } finally {
            await cei.context.close();
        }
    });

    test('an editor of Italy, a European nation, may not write into the Americas', async ({ browser }) => {
        // Membership, not just the nation grant: Italy belongs to europe, so the fallback
        // that lets a national editor write their own locale does not reach americas.
        const cei = await actingAs(browser, 'cei-editor');
        const { page } = cei;
        try {
            const put = await page.request.put(`${API_BASE}/data/widerregion/americas/it_IT`, {
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                data: { OurLadyOfGuadalupe: 'Nostra Signora di Guadalupe' }
            });
            expect(put.status(), `PUT americas/it_IT should be 403; got ${put.status()}: ${await put.text()}`).toBe(403);

            await page.goto('/extending.php?choice=widerRegion');
            const regionInput = page.locator('#widerRegionCalendarName');
            await regionInput.fill('americas - en_US');
            await regionInput.press('Enter');
            await regionInput.blur();
            await expect(page.locator('#widerRegionEditRightsNotice')).toBeVisible({ timeout: 20000 });
            const itOption = page.locator('#widerRegionLocales option[value="it_IT"]');
            if (await itOption.count() > 0) {
                await expect(itOption).toHaveAttribute('disabled', /.*/);
            }
            await expect(page.locator('#widerRegionForm .litEventName').first()).toBeDisabled();
        } finally {
            await cei.context.close();
        }
    });

    test('the editor locks what an editor of Italy may not change, and saves it_IT alone', async ({ browser }) => {
        const cei = await actingAs(browser, 'cei-editor');
        const { page } = cei;
        try {
            await page.goto('/extending.php?choice=widerRegion');
            const regionInput = page.locator('#widerRegionCalendarName');
            await regionInput.fill('europe - it_IT');
            await regionInput.press('Enter');
            await regionInput.blur();

            const notice = page.locator('#widerRegionEditRightsNotice');
            await expect(notice).toBeVisible({ timeout: 20000 });
            await expect(notice).toContainText('it_IT');

            // Italy's locale is selectable; France's is not.
            await expect(page.locator('#widerRegionLocales option[value="it_IT"]')).not.toHaveAttribute('disabled', /.*/);
            await expect(page.locator('#widerRegionLocales option[value="fr_FR"]')).toHaveAttribute('disabled', /.*/);

            // The current locale is it_IT, so its name fields are editable; every other
            // nation's translation field is locked, and so is every structural control.
            const nameInputs = page.locator('#widerRegionForm .litEventName');
            expect(await nameInputs.count()).toBeGreaterThan(0);
            await expect(nameInputs.first()).toBeEnabled();
            await expect(page.locator('#widerRegionForm input[data-locale="fr_FR"]').first()).toBeDisabled();
            for (const button of await page.locator('.litcalActionButton').all()) {
                await expect(button).toBeDisabled();
            }

            let patchSent = false;
            page.on('request', (r) => {
                if (r.method() === 'PATCH' && r.url().includes('/data/widerregion/')) patchSent = true;
            });
            // Save is enabled once every one of europe's 30-odd locales has loaded; a
            // toast from that load can sit over it, so clear them before clicking.
            const save = page.locator('#serializeWiderRegionData');
            await expect(save).toBeEnabled({ timeout: 20000 });
            await page.evaluate(() => document.querySelectorAll('#toast-container').forEach((t) => t.remove()));
            const put = page.waitForResponse((r) =>
                r.url().endsWith('/data/widerregion/europe/it_IT') && r.request().method() === 'PUT');
            await save.click();
            const response = await put;
            expect(response.status(), await response.text()).toBe(200);
            const body = await response.json();
            expect(body.disposition).toBe('applied');
            expect(patchSent).toBe(false);
        } finally {
            await cei.context.close();
        }
    });
});
