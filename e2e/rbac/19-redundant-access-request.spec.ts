/**
 * Scenario 19 — redundant access requests are refused (API #1047, frontend Task 8)
 *
 * The API drops the permissions of an access request that are already redundant, and answers 409
 * when nothing is left to ask for. permission-requests.js reads that outcome and tells the user:
 *
 *   - all redundant  → a warning (`allRedundant` + the skipped list); nothing is stored and the form
 *                      is kept as it was.
 *   - partly redundant → the request is created with the remaining permissions, and a warning
 *                      (`skippedHeading` + the skipped list) names each dropped permission and why.
 *
 * Preconditions:
 *   - cei-editor is seeded by rbac-setup with the `calendar_editor` role and NO FGA tuple; beforeAll
 *     grants it editor@national_calendar:roman/IT, and afterAll takes that tuple away again.
 *   - The two tests run in order (serial): the second leaves a pending `calendar_editor` request,
 *     which would make the first fail on the API's one-pending-request-per-role rule.
 *
 * Every user-facing string is read from the page's own `window.AccessRequestsConfig.i18n`, so the
 * assertions hold whatever locale the page renders in.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { grantTuple } from './support/grant';
import { truncateAppTables, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS, ROMAN } from './support/users';

const IT_OBJECT_ID = `${ROMAN}/IT`;

type I18n = Record<string, string>;

/** The localized strings permission-requests.php hands to permission-requests.js. */
async function readI18n(page: Page): Promise<I18n> {
    return page.evaluate(
        () => (window as unknown as { AccessRequestsConfig: { i18n: I18n } }).AccessRequestsConfig.i18n,
    );
}

/** The user's own request rows, once the initial list load has settled. */
async function settledRequestRows(page: Page): Promise<Locator> {
    await expect(page.locator('#existingRequestsBody .fa-spinner')).toHaveCount(0);
    return page.locator('#existingRequestsBody tr[id^="request-"]');
}

/**
 * Fill one permission row for a national calendar. Mirrors submitAccessRequest() in
 * ./support/requestAccess: object type first, so the object-id control is populated before
 * we select from it.
 */
async function fillNationalRow(row: Locator, nation: string, relation: 'viewer' | 'editor' | 'admin'): Promise<void> {
    await expect(row).toBeVisible();
    await row.locator('.perm-object-type').selectOption('national_calendar');
    const objectIdControl = row.locator('.perm-object-id');
    await objectIdControl.waitFor({ state: 'visible' });
    await objectIdControl.selectOption(nation);
    await row.locator('.perm-relation').selectOption(relation);
}

test.describe('19 — redundant access requests', () => {
    test.describe.configure({ mode: 'serial' });

    /** cei-editor's Zitadel subject, resolved once and reused for teardown. */
    let ceiEditorSub: string | null = null;

    test.beforeAll(async () => {
        await truncateAppTables();
        ceiEditorSub = await new ZitadelAdmin().findUserIdByEmail(USERS['cei-editor'].email);
        if (!ceiEditorSub) throw new Error('scenario 19: cei-editor is not seeded in Zitadel');
        await grantTuple(ceiEditorSub, 'editor', 'national_calendar', IT_OBJECT_ID);
    });

    test.afterAll(async () => {
        await settleCleanup('scenario 19 afterAll', [
            truncateAppTables(),
            // Reuse the subject resolved in beforeAll; leaving editor@IT behind would make
            // scenario 02's editor@IT request redundant on the next run.
            ceiEditorSub
                ? new Fga().delete(`user:${ceiEditorSub}`, 'editor', `national_calendar:${IT_OBJECT_ID}`)
                : Promise.resolve(),
        ]);
    });

    test('requesting viewer on a calendar you edit is refused', async ({ browser }) => {
        const { context, page } = await actingAs(browser, 'cei-editor');
        try {
            await page.goto('/permission-requests.php');
            const i18n = await readI18n(page);

            // Not submitAccessRequest(): it waits for a new request row, and none must appear.
            await page.check('input[name="requested_role"][value="calendar_editor"]');
            await fillNationalRow(page.locator('#permissionRows .card').first(), 'IT', 'viewer');

            const requestRows = await settledRequestRows(page);
            const rowsBefore = await requestRows.count();

            await page.click('#submitBtn');

            const warning = page.locator('#formAlerts .alert-warning');
            await expect(warning).toBeVisible();
            await expect(warning).toContainText(i18n.allRedundant);
            await expect(warning).toContainText(i18n.skipGranted);
            await expect(warning).toContainText('IT');
            await expect(page.locator('#formAlerts .alert-success')).toHaveCount(0);

            // The form is kept for the user to change.
            await expect(page.locator('#submitBtn')).toBeEnabled();
            await expect(page.locator('#permissionRows .card')).toHaveCount(1);

            // Nothing was stored: the list is unchanged, also after a fresh load from the API.
            await expect(requestRows).toHaveCount(rowsBefore);
            await page.reload();
            await expect(await settledRequestRows(page)).toHaveCount(rowsBefore);
        } finally {
            await context.close();
        }
    });

    test('the redundant row is dropped, the upgrade goes through', async ({ browser }) => {
        const { context, page } = await actingAs(browser, 'cei-editor');
        try {
            await page.goto('/permission-requests.php');
            const i18n = await readI18n(page);

            // Selecting the role auto-adds the first row; the second one is added by hand.
            await page.check('input[name="requested_role"][value="calendar_editor"]');
            await fillNationalRow(page.locator('#permissionRows .card').nth(0), 'IT', 'viewer');
            await page.click('#addPermissionBtn');
            await fillNationalRow(page.locator('#permissionRows .card').nth(1), 'IT', 'admin');

            const requestRows = await settledRequestRows(page);
            const rowsBefore = await requestRows.count();

            await page.click('#submitBtn');

            // A new pending request, carrying only the admin permission on IT.
            await expect(requestRows).toHaveCount(rowsBefore + 1);
            const pendingRow = requestRows.filter({ hasText: i18n.statusPending });
            await expect(pendingRow).toHaveCount(1);
            const permissionsCell = pendingRow.locator('td').nth(1);
            await expect(permissionsCell.locator('.badge')).toHaveCount(1);
            await expect(permissionsCell.locator('.badge')).toHaveText(i18n.admin);
            await expect(permissionsCell.locator('code')).toHaveCount(1);
            await expect(permissionsCell.locator('code')).toContainText('IT');

            // The dropped viewer row is listed as a duplicate of the admin one (the API checks
            // duplicates before grants, so it is not reported as already granted).
            const warning = page.locator('#formAlerts .alert-warning');
            await expect(warning).toHaveCount(1);
            await expect(warning).toContainText(i18n.skippedHeading);
            await expect(warning).toContainText(i18n.skipDuplicate);
            await expect(warning.locator('li')).toHaveCount(1);
            await expect(warning.locator('li .badge')).toHaveText(i18n.viewer);
            await expect(warning.locator('li code')).toContainText('IT');
        } finally {
            await context.close();
        }
    });
});
