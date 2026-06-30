import { test, expect } from '@playwright/test';

// Uses the shared authenticated storage state (e2e/.auth/user.json) from the
// chromium project; that user is an admin in the dev environment.
test.describe('admin-tests page', () => {
    test('renders the page shell with list and modals', async ({ page }) => {
        await page.goto('/admin-tests.php');
        await expect(page.locator('#testsTableBody')).toBeVisible();
        await expect(page.locator('#createTestBtn')).toBeVisible();
        await expect(page.locator('#testEditorModal')).toHaveCount(1);
        await expect(page.locator('#deleteTestModal')).toHaveCount(1);
    });
});
