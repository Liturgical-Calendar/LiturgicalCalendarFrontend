/**
 * Scenario 15 — dashboard Tests-card matrix (test_editor role x FGA test scope)
 *
 * Issue #399: the Tests card renders for non-admins only when the user holds the
 * test_editor role AND a viewer-or-above relation on at least one *_test object
 * (checked server-side via GET /auth/dashboard-scopes).
 *
 * Preconditions (seeded by rbac-setup):
 *   - tests-editor: Zitadel test_editor role, no FGA tuple at seed time; this spec
 *     grants editor@national_calendar_test:IT at runtime (FGA is evaluated live,
 *     unlike Zitadel roles which are baked into the login token).
 *   - tests-editor-noscope: Zitadel test_editor role, never granted any tuple.
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
        // editor@national_calendar_test:IT — editor satisfies the viewer-or-above gate.
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

    test('test_editor WITHOUT a test scope does NOT see the Tests card', async ({ browser }) => {
        const { context, page } = await actingAs(browser, 'tests-editor-noscope');
        try {
            await page.goto('/admin-dashboard.php');
            await expect(page.locator(HEADING)).toBeVisible();
            await expect(page.locator(TESTS_CARD_LINK)).toHaveCount(0);
        } finally {
            await context.close();
        }
    });
});
