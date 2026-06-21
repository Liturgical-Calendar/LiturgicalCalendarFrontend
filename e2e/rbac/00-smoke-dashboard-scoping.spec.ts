import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';

test('super-admin sees the admin section; cei-editor does not', async ({ browser }) => {
    // ── super-admin (Zitadel role: admin) ────────────────────────────────────
    // admin-dashboard.php renders the Administration section (Users, Permissions,
    // Applications, Role Requests cards) only when $isAdmin is true (line 62).
    // The Users card always contains a[href="admin-users.php"] (line 79).
    const sa = await actingAs(browser, 'super-admin');
    try {
        await sa.page.goto('/admin-dashboard.php');
        await expect(sa.page.locator('a[href="admin-users.php"]')).toBeVisible();
    } finally {
        await sa.context.close();
    }

    // ── cei-editor (Zitadel role: calendar_editor, FGA editor@national_calendar:IT)
    // $isAdmin is false → the Administration section is NOT rendered.
    // But $hasCalendarRole is true → the calendar blocks (admin-blocks.php) ARE rendered,
    // including the National card with data-block-id="national" (line 87 of admin-blocks.php).
    const ed = await actingAs(browser, 'cei-editor');
    try {
        await ed.page.goto('/admin-dashboard.php');
        await expect(ed.page.locator('a[href="admin-users.php"]')).toHaveCount(0);
        await expect(ed.page.locator('.admin-block[data-block-id="national"]')).toBeVisible();
    } finally {
        await ed.context.close();
    }
});
