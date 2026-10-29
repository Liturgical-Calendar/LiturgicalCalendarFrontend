/**
 * Scenario 15 — dashboard Tests-card matrix (role x FGA test scope)
 *
 * Reading comes from the role (LiturgicalCalendarAPI #1049): for non-admins the Tests card
 * renders when a role they hold reads the test types — test_editor or developer
 * (AuthHelper::ROLE_READABLE_TYPES). A tuple on a *_test object neither grants nor is
 * needed for it. (Before #1049, issue #399 also required a viewer-or-above tuple.)
 *
 * Matrix:
 *   - tests-editor (test_editor + editor@national_calendar_test:IT)  → card visible
 *   - tests-editor-noscope (test_editor, no tuple)                    → card visible
 *   - cei-editor (calendar_editor, no tuple: its role does not read
 *     the test types)                                                 → card hidden
 *
 * Preconditions (seeded by rbac-setup):
 *   - tests-editor: Zitadel test_editor role, no FGA tuple at seed time; this spec
 *     grants editor@national_calendar_test:IT at runtime (FGA is evaluated live,
 *     unlike Zitadel roles which are baked into the login token).
 *   - tests-editor-noscope: Zitadel test_editor role, never granted any tuple.
 *   - cei-editor: Zitadel calendar_editor role, no FGA tuple at seed time.
 */

import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { grantScope, revokeScope } from './support/grant';

// Scoped to the dashboard admin-block card, not layout/header.php's own nav-link to the
// same href (`.nav-link[href="admin-tests.php"]`), which renders independently of the
// per-user gating asserted here and would otherwise make the plain href selector
// ambiguous (strict-mode violation: 2 matches).
const TESTS_CARD_LINK = '.admin-block a[href="admin-tests.php"]';
const HEADING = '.admin-dashboard-heading';

test.describe.serial('15 — dashboard Tests-card matrix', () => {
    test.beforeAll(async () => {
        // editor@national_calendar_test:IT — the tuple is not what shows the card (the role
        // is); granting it proves a scoped test_editor still sees it.
        await grantScope('tests-editor', { role: false });
    });

    test.afterAll(async () => {
        await revokeScope('tests-editor');
    });

    test('test_editor WITH a test scope sees the Tests card', async ({ browser }) => {
        const { context, page } = await actingAs(browser, 'tests-editor');
        try {
            await page.goto('/admin-dashboard.php');
            await expect(page.locator(HEADING)).toBeVisible();
            await expect(page.locator(TESTS_CARD_LINK)).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test('test_editor WITHOUT a test scope sees the Tests card through the role', async ({ browser }) => {
        const { context, page } = await actingAs(browser, 'tests-editor-noscope');
        try {
            await page.goto('/admin-dashboard.php');
            await expect(page.locator(HEADING)).toBeVisible();
            await expect(page.locator(TESTS_CARD_LINK)).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test('calendar_editor (role does not read the test types) does NOT see the Tests card', async ({ browser }) => {
        const { context, page } = await actingAs(browser, 'cei-editor');
        try {
            await page.goto('/admin-dashboard.php');
            await expect(page.locator(HEADING)).toBeVisible();
            await expect(page.locator(TESTS_CARD_LINK)).toHaveCount(0);
        } finally {
            await context.close();
        }
    });
});
