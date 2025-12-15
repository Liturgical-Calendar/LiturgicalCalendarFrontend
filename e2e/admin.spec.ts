import { test, expect } from './fixtures';

/**
 * Tests for the Admin page (admin.php)
 *
 * These tests verify that:
 * 1. The admin interface loads correctly when authenticated
 * 2. The data source dropdown works correctly
 * 3. When "Decrees" is selected, action buttons appear and function correctly
 * 4. Action buttons (Set property, Move event, Create new, Designate Doctor) work
 */

test.describe('Admin Page - Authentication', () => {
    test('should show login required message when not authenticated', async ({ page }) => {
        // Clear storage state to simulate unauthenticated user
        await page.context().clearCookies();

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await page.goto(`${baseUrl}/admin.php`);
        await page.waitForLoadState('networkidle');

        // Login required message should be visible
        const loginMessage = page.locator('#loginRequiredMessage');
        await expect(loginMessage).toBeVisible();

        // Admin interface should be hidden
        const adminInterface = page.locator('#adminInterface');
        await expect(adminInterface).toHaveClass(/d-none/);
    });

    test('should show admin interface when authenticated', async ({ extendingPage, page }) => {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await page.goto(`${baseUrl}/admin.php`);
        await page.waitForLoadState('networkidle');

        // Wait for auth to be checked
        await extendingPage.waitForAuth();

        // Admin interface should be visible
        const adminInterface = page.locator('#adminInterface');
        await expect(adminInterface).not.toHaveClass(/d-none/);

        // Login required message should be hidden
        const loginMessage = page.locator('#loginRequiredMessage');
        await expect(loginMessage).toHaveAttribute('data-requires-no-auth', '');
    });
});

test.describe('Admin Page - Data Source Selection', () => {
    test.beforeEach(async ({ extendingPage, page }) => {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await page.goto(`${baseUrl}/admin.php`);
        await page.waitForLoadState('networkidle');
        await extendingPage.waitForAuth();
    });

    test('should have data source dropdown', async ({ page }) => {
        const dropdown = page.locator('#jsonFileSelect');
        await expect(dropdown).toBeVisible();

        // Should have multiple options
        const options = await dropdown.locator('option').count();
        expect(options).toBeGreaterThan(0);
    });

    test('should show action buttons when Decrees is selected', async ({ page }) => {
        // Select "Decrees" from dropdown
        const dropdown = page.locator('#jsonFileSelect');
        await dropdown.selectOption('decrees');

        // Wait for the interface to update
        await page.waitForLoadState('networkidle');

        // Action buttons should be visible
        const buttonGroup = page.locator('#memorialsFromDecreesBtnGrp');
        await expect(buttonGroup).toBeVisible({ timeout: 10000 });

        // Verify all action buttons are present
        await expect(page.locator('#setPropertyAction')).toBeVisible();
        await expect(page.locator('#moveLiturgicalEventAction')).toBeVisible();
        await expect(page.locator('#newLiturgicalEventAction')).toBeVisible();
        await expect(page.locator('#makeDoctorAction')).toBeVisible();
    });

    test('should hide action buttons when Missal is selected', async ({ page }) => {
        // First select Decrees to show buttons
        const dropdown = page.locator('#jsonFileSelect');
        await dropdown.selectOption('decrees');
        await page.waitForLoadState('networkidle');

        // Verify buttons are visible
        const buttonGroup = page.locator('#memorialsFromDecreesBtnGrp');
        await expect(buttonGroup).toBeVisible({ timeout: 10000 });

        // Now select a missal
        await dropdown.selectOption('missals/EDITIO_TYPICA_1970');
        await page.waitForLoadState('networkidle');

        // Action buttons should be hidden
        await expect(buttonGroup).not.toBeVisible();
    });
});

test.describe('Admin Page - Action Buttons (Decrees)', () => {
    test.beforeEach(async ({ extendingPage, page }) => {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await page.goto(`${baseUrl}/admin.php`);
        await page.waitForLoadState('networkidle');
        await extendingPage.waitForAuth();

        // Select "Decrees" from dropdown
        const dropdown = page.locator('#jsonFileSelect');
        await dropdown.selectOption('decrees');
        await page.waitForLoadState('networkidle');

        // Wait for action buttons to appear
        await page.waitForSelector('#memorialsFromDecreesBtnGrp', { state: 'visible', timeout: 10000 });
    });

    test('Set Property button should open modal', async ({ page }) => {
        // Click the Set Property button
        await page.click('#setPropertyAction');

        // Modal should open
        const modal = page.locator('#setPropertyActionPrompt');
        await expect(modal).toHaveClass(/show/, { timeout: 5000 });

        // Modal should have the event name input
        const eventInput = modal.locator('.existingLiturgicalEventName');
        await expect(eventInput).toBeVisible();

        // Modal should have property select (for setProperty)
        const propertySelect = modal.locator('[name="propertyToChange"]');
        await expect(propertySelect).toBeVisible();

        // Close modal by clicking the X button
        await modal.locator('button.btn-close').click();
        await expect(modal).not.toHaveClass(/show/, { timeout: 5000 });
    });

    test('Move Event button should open modal', async ({ page }) => {
        // Click the Move Event button
        await page.click('#moveLiturgicalEventAction');

        // Modal should open
        const modal = page.locator('#moveLiturgicalEventActionPrompt');
        await expect(modal).toHaveClass(/show/, { timeout: 5000 });

        // Modal should have the event name input
        const eventInput = modal.locator('.existingLiturgicalEventName');
        await expect(eventInput).toBeVisible();

        // Close modal by clicking the X button
        await modal.locator('button.btn-close').click();
        await expect(modal).not.toHaveClass(/show/, { timeout: 5000 });
    });

    test('Create New button should open modal', async ({ page }) => {
        // Click the Create New button
        await page.click('#newLiturgicalEventAction');

        // Modal should open
        const modal = page.locator('#newLiturgicalEventActionPrompt');
        await expect(modal).toHaveClass(/show/, { timeout: 5000 });

        // Modal should have the event name input
        const eventInput = modal.locator('.existingLiturgicalEventName');
        await expect(eventInput).toBeVisible();

        // Close modal by clicking the X button
        await modal.locator('button.btn-close').click();
        await expect(modal).not.toHaveClass(/show/, { timeout: 5000 });
    });

    test('Designate Doctor button should open modal', async ({ page }) => {
        // Click the Make Doctor button
        await page.click('#makeDoctorAction');

        // Modal should open
        const modal = page.locator('#makeDoctorActionPrompt');
        await expect(modal).toHaveClass(/show/, { timeout: 5000 });

        // Modal should have the event name input
        const eventInput = modal.locator('.existingLiturgicalEventName');
        await expect(eventInput).toBeVisible();

        // Close modal by clicking the X button
        await modal.locator('button.btn-close').click();
        await expect(modal).not.toHaveClass(/show/, { timeout: 5000 });
    });

    test('Set Property modal should enable submit when valid event selected', async ({ page, extendingPage }) => {
        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Get a random existing event name
        const existingEventName = await extendingPage.getRandomExistingEventName();
        if (!existingEventName) {
            test.skip(true, 'No existing events in datalist');
            return;
        }

        // Click the Set Property button
        await page.click('#setPropertyAction');
        await page.waitForSelector('#setPropertyActionPrompt.show', { timeout: 5000 });

        // Fill in event name
        const eventInput = page.locator('#setPropertyActionPrompt .existingLiturgicalEventName');
        await eventInput.fill(existingEventName);
        await eventInput.dispatchEvent('change');

        // Wait for submit button to be enabled
        await page.waitForFunction(() => {
            const btn = document.querySelector('#setPropertyButton') as HTMLButtonElement | null;
            return btn && !btn.disabled;
        }, undefined, { timeout: 10000 });

        const submitButton = page.locator('#setPropertyButton');
        await expect(submitButton).toBeEnabled();

        // Close modal
        await page.keyboard.press('Escape');
    });

    test('Move Event modal should enable submit when valid event selected', async ({ page, extendingPage }) => {
        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Get a random existing event name
        const existingEventName = await extendingPage.getRandomExistingEventName();
        if (!existingEventName) {
            test.skip(true, 'No existing events in datalist');
            return;
        }

        // Click the Move Event button
        await page.click('#moveLiturgicalEventAction');
        await page.waitForSelector('#moveLiturgicalEventActionPrompt.show', { timeout: 5000 });

        // Fill in event name
        const eventInput = page.locator('#moveLiturgicalEventActionPrompt .existingLiturgicalEventName');
        await eventInput.fill(existingEventName);
        await eventInput.dispatchEvent('change');

        // Wait for submit button to be enabled
        await page.waitForFunction(() => {
            const btn = document.querySelector('#moveLiturgicalEventButton') as HTMLButtonElement | null;
            return btn && !btn.disabled;
        }, undefined, { timeout: 10000 });

        const submitButton = page.locator('#moveLiturgicalEventButton');
        await expect(submitButton).toBeEnabled();

        // Close modal
        await page.keyboard.press('Escape');
    });

    test('Designate Doctor modal should enable submit when valid event selected', async ({ page, extendingPage }) => {
        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Get a random existing event name
        const existingEventName = await extendingPage.getRandomExistingEventName();
        if (!existingEventName) {
            test.skip(true, 'No existing events in datalist');
            return;
        }

        // Click the Make Doctor button
        await page.click('#makeDoctorAction');
        await page.waitForSelector('#makeDoctorActionPrompt.show', { timeout: 5000 });

        // Fill in event name
        const eventInput = page.locator('#makeDoctorActionPrompt .existingLiturgicalEventName');
        await eventInput.fill(existingEventName);
        await eventInput.dispatchEvent('change');

        // Wait for submit button to be enabled
        await page.waitForFunction(() => {
            const btn = document.querySelector('#designateDoctorButton') as HTMLButtonElement | null;
            return btn && !btn.disabled;
        }, undefined, { timeout: 10000 });

        const submitButton = page.locator('#designateDoctorButton');
        await expect(submitButton).toBeEnabled();

        // Close modal by clicking the X button
        const modal = page.locator('#makeDoctorActionPrompt');
        await modal.locator('button.btn-close').click();
    });
});

test.describe('Admin Page - Save Functionality', () => {
    test.beforeEach(async ({ extendingPage, page }) => {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await page.goto(`${baseUrl}/admin.php`);
        await page.waitForLoadState('networkidle');
        await extendingPage.waitForAuth();
    });

    test('should have save button', async ({ page }) => {
        const saveButton = page.locator('#saveDataBtn');
        await expect(saveButton).toBeVisible();
    });

    test('should have add column button', async ({ page }) => {
        const addColumnButton = page.locator('#addColumnBtn');
        await expect(addColumnButton).toBeVisible();
    });
});
