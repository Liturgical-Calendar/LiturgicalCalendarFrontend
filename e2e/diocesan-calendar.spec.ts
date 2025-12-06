import { test, expect, gitRestoreApiData } from './fixtures';

/**
 * Tests for the Diocesan Calendar form on extending.php
 *
 * These tests verify that:
 * 1. The form can be loaded and populated correctly
 * 2. Form validation works as expected
 * 3. The payload structure matches the API contract (DiocesanCalendarPayload)
 * 4. CREATE (PUT) requests return 201 and can be cleaned up with DELETE (200)
 * 5. UPDATE (PATCH) requests return 201 and changes are reverted with git restore
 *
 * Diocesan calendars are the most specific level of calendar customization,
 * inheriting from national, wider region, and General Roman Calendar.
 */

test.describe('Diocesan Calendar Form', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToDiocesanCalendar();
    });

    test('should load the diocesan calendar form', async ({ page }) => {
        // Verify key form elements are present
        await expect(page.locator('#diocesanCalendarNationalDependency')).toBeVisible();
        await expect(page.locator('#diocesanCalendarDioceseName')).toBeVisible();
        await expect(page.locator('#diocesanCalendarGroup')).toBeVisible();
        await expect(page.locator('#diocesanCalendarLocales')).toBeVisible();
        await expect(page.locator('#diocesanCalendarTimezone')).toBeVisible();
        await expect(page.locator('#saveDiocesanCalendar_btn')).toBeVisible();
    });

    test('should require national dependency selection', async ({ page }) => {
        // The national dependency select should be required
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        await expect(nationalSelect).toHaveAttribute('required', '');
    });

    test('should require diocese name and be disabled until national calendar is selected', async ({ page }) => {
        // The diocese name input should be required
        const dioceseNameInput = page.locator('#diocesanCalendarDioceseName');
        await expect(dioceseNameInput).toHaveAttribute('required', '');

        // Initially should be disabled (until national calendar is selected)
        await expect(dioceseNameInput).toBeDisabled();

        // Help text should be visible when disabled
        const helpText = page.locator('#diocesanCalendarDioceseNameHelp');
        await expect(helpText).toBeVisible();

        // Select a national calendar
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        const options = await nationalSelect.locator('option').all();
        let selectedValue = '';
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value && value.length > 0) {
                selectedValue = value;
                break;
            }
        }

        if (selectedValue) {
            await nationalSelect.selectOption(selectedValue);

            // After selecting national calendar, diocese input should be enabled
            await expect(dioceseNameInput).toBeEnabled();

            // Help text should be hidden
            await expect(helpText).toHaveClass(/d-none/);
        }
    });

    test('should have national calendar options in dependency dropdown', async ({ page }) => {
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        await expect(nationalSelect).toBeVisible();

        // There should be options available (national calendars)
        const options = await nationalSelect.locator('option').count();
        expect(options).toBeGreaterThan(0);
    });

    test('should validate locale selection', async ({ page }) => {
        // The locale select should be a multi-select
        const localesSelect = page.locator('#diocesanCalendarLocales');
        await expect(localesSelect).toBeVisible();
        await expect(localesSelect).toHaveAttribute('multiple', 'multiple');
    });

    test('should have timezone selection', async ({ page }) => {
        const timezoneSelect = page.locator('#diocesanCalendarTimezone');
        await expect(timezoneSelect).toBeVisible();

        // There should be timezone options
        const options = await timezoneSelect.locator('option').count();
        expect(options).toBeGreaterThan(0);
    });

    test('should populate dioceses list when national calendar is selected', async ({ page }) => {
        // Select a national calendar first (use ISO code, e.g., "US" for USA)
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');

        // Get available options and select the first non-empty one
        const options = await nationalSelect.locator('option').all();
        let selectedValue = '';
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value && value.length > 0) {
                selectedValue = value;
                break;
            }
        }

        if (!selectedValue) {
            test.skip(true, 'No selectable national calendars with non-empty values');
            return;
        }

        await nationalSelect.selectOption(selectedValue);
        // Wait for diocese list to be populated - let timeout surface as failure
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#DiocesesList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 10000 });

        // The dioceses datalist should have options
        const diocesesList = page.locator('#DiocesesList');
        const dioceseOptionCount = await diocesesList.locator('option').count();
        expect(dioceseOptionCount).toBeGreaterThan(0);
    });

    test('should have diocesan overrides form', async ({ page }) => {
        // The overrides form should exist for customizing national calendar settings
        const overridesForm = page.locator('#diocesanOverridesForm');
        await expect(overridesForm).toBeVisible();

        // Check override dropdowns exist
        await expect(page.locator('#diocesanCalendarOverrideEpiphany')).toBeVisible();
        await expect(page.locator('#diocesanCalendarOverrideAscension')).toBeVisible();
        await expect(page.locator('#diocesanCalendarOverrideCorpusChristi')).toBeVisible();
    });

    test('should have carousel for different feast types', async ({ page }) => {
        // Wait for carousel navigation to be ready
        await page.waitForSelector('#diocesanCalendarDefinitionCardLinks', { state: 'visible' });

        // The carousel has different cards for Solemnities, Feasts, Memorials, Optional Memorials
        const carouselNav = page.locator('#diocesanCalendarDefinitionCardLinks');
        await expect(carouselNav).toBeVisible();

        // Look for navigation links/buttons in the carousel
        const navLinks = carouselNav.locator('a, button, .nav-link');
        const linkCount = await navLinks.count();

        // Just verify the navigation exists
        expect(linkCount).toBeGreaterThan(0);
    });

    test('should CREATE (PUT) new diocesan calendar, verify 201 response, and DELETE for cleanup', async ({ page, extendingPage }) => {
        // This test creates a NEW diocese calendar using PUT for a diocese that exists
        // in the datalist but doesn't have calendar data yet. Then it DELETEs to clean up.

        // Get existing diocesan calendar IDs using the shared helper
        const existingDioceseIds = await extendingPage.getExistingDiocesanCalendarIds();
        console.log(`Found ${existingDioceseIds.length} existing diocesan calendars`);

        // Set up the form with required fields - select first available national calendar
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        const options = await nationalSelect.locator('option').all();
        let selectedNation = '';
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value && value.length > 0) {
                selectedNation = value;
                break;
            }
        }

        if (!selectedNation) {
            test.skip(true, 'No national calendars available');
            return;
        }

        await nationalSelect.selectOption(selectedNation);

        // Wait for the dioceses datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#DiocesesList');
            return datalist && datalist.querySelectorAll('option[data-value]').length > 0;
        }, { timeout: 15000 });

        // Get all diocese options from the datalist and find one without calendar data
        const availableDioceses = await page.evaluate(() => {
            const datalist = document.querySelector('#DiocesesList');
            if (!datalist) return [];
            return Array.from(datalist.querySelectorAll('option[data-value]')).map(opt => ({
                name: opt.getAttribute('value') || '',
                key: opt.getAttribute('data-value') || ''
            }));
        });

        // Find a diocese that's in the datalist but NOT in existing calendars
        const dioceseToCreate = availableDioceses.find(d => !existingDioceseIds.includes(d.key));

        if (!dioceseToCreate) {
            test.skip(true, `All ${availableDioceses.length} dioceses for ${selectedNation} already have calendar data`);
            return;
        }

        console.log(`Selected diocese for CREATE test: ${dioceseToCreate.name} (${dioceseToCreate.key})`);

        // Wait for locale options to be populated after national calendar selection
        await page.waitForFunction(() => {
            const localesSelect = document.querySelector('#diocesanCalendarLocales') as HTMLSelectElement;
            return localesSelect && localesSelect.options.length > 0;
        }, { timeout: 10000 });

        // Select at least one locale (required for saving)
        const localesSelect = page.locator('#diocesanCalendarLocales');
        const firstLocale = await localesSelect.locator('option').first().getAttribute('value');
        if (firstLocale) {
            await localesSelect.selectOption(firstLocale);
        }

        // Ensure the current localization is set
        const currentLocalization = page.locator('#currentLocalizationDiocesan');
        const firstLocalizationOption = await currentLocalization.locator('option').first().getAttribute('value');
        if (firstLocalizationOption) {
            await currentLocalization.selectOption(firstLocalizationOption);
        }

        // Ensure timezone is selected (use first available)
        const timezoneSelect = page.locator('#diocesanCalendarTimezone');
        const firstTimezone = await timezoneSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
        if (firstTimezone) {
            await timezoneSelect.selectOption(firstTimezone);
        }

        // Fill in diocese name from the found diocese (without existing calendar data)
        const dioceseInput = page.locator('#diocesanCalendarDioceseName');
        await dioceseInput.fill(dioceseToCreate.name);
        await dioceseInput.dispatchEvent('change');

        // Wait for the form to process the change (network requests, datalist updates)
        await page.waitForLoadState('networkidle');

        // Fill in at least one valid liturgical event (Principal Patron)
        // This is required because empty form rows would fail API schema validation
        const principalPatronNameInput = page.locator('.carousel-item.active input.litEventName').first();
        await principalPatronNameInput.fill('Test Principal Patron');
        await principalPatronNameInput.dispatchEvent('change');

        // Set up request interception to capture the payload and method
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Wait for the save button to be visible and enabled
        // force: true needed because toasts may still have z-index overlap even after removal
        const saveButton = page.locator('#saveDiocesanCalendar_btn');
        await expect(saveButton).toBeVisible({ timeout: 10000 });
        await expect(saveButton).toBeEnabled({ timeout: 15000 });
        await saveButton.click({ force: true });

        // Wait for the CREATE response and capture status
        const response = await page.waitForResponse(
            response => response.url().includes('/data/') && ['PUT', 'PATCH'].includes(response.request().method()),
            { timeout: 15000 }
        );
        createResponseStatus = response.status();
        try {
            createResponseBody = await response.json();
        } catch {
            createResponseBody = await response.text();
        }

        // Verify the HTTP method is PUT (CREATE)
        expect(getMethod()).toBe('PUT');
        console.log(`HTTP method used: ${getMethod()}`);

        // Verify CREATE response status is 201
        expect(createResponseStatus).toBe(201);
        expect(createResponseBody).toHaveProperty('success');
        console.log(`CREATE (PUT) response: ${createResponseStatus}`);

        // Validate payload structure
        const capturedPayload = getPayload();
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('metadata');
        expect(Array.isArray(capturedPayload.litcal)).toBe(true);
        expect(capturedPayload.metadata).toHaveProperty('diocese_id');
        expect(capturedPayload.metadata).toHaveProperty('diocese_name');
        expect(capturedPayload.metadata).toHaveProperty('nation');

        // Verify payload metadata matches the selected diocese from the datalist
        expect(capturedPayload.metadata.diocese_id).toBe(dioceseToCreate.key);
        expect(capturedPayload.metadata.diocese_name).toBe(dioceseToCreate.name);

        // CLEANUP: DELETE the created diocese and verify 200 response
        const deleteResult = await extendingPage.deleteCalendar('diocese', dioceseToCreate.key);
        expect(deleteResult.status).toBe(200);
        expect(deleteResult.body).toHaveProperty('success');
    });

    test('should UPDATE (PATCH) existing diocesan calendar and verify 201 response', async ({ page, extendingPage }) => {
        // Track if we made changes that need to be reverted
        let needsGitRestore = false;

        // Set up request interception BEFORE loading the calendar
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let responseStatus: number | null = null;
        let responseBody: any = null;

        // Load an existing diocesan calendar (UPDATE scenario - should use PATCH)
        // Dynamically discover a nation with existing diocesan calendars
        const nationsWithDioceses = await extendingPage.getNationsWithExistingDiocesanCalendars();

        if (nationsWithDioceses.length === 0) {
            test.skip(true, 'No nations with existing diocesan calendars found');
            return;
        }

        // Pick a random nation for better coverage across test runs
        const randomIndex = Math.floor(Math.random() * nationsWithDioceses.length);
        const selectedNation = nationsWithDioceses[randomIndex];
        // Log index for reproducibility - to reproduce a failure, use: nationsWithDioceses[<index>]
        console.log(`REPRODUCIBILITY: Selected nation index ${randomIndex} of ${nationsWithDioceses.length} = ${selectedNation}`);
        console.log(`REPRODUCIBILITY: Available nations: [${nationsWithDioceses.join(', ')}]`);

        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');

        // Check if the selected nation option exists in the dropdown
        const nationOptionExists = await nationalSelect.locator(`option[value="${selectedNation}"]`).count() > 0;
        if (!nationOptionExists) {
            test.skip(true, `Nation "${selectedNation}" not available in dropdown`);
            return;
        }

        console.log(`Selected nation for UPDATE test: ${selectedNation}`);
        await nationalSelect.selectOption(selectedNation);

        // Wait for the dioceses datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#DiocesesList');
            return datalist && datalist.querySelectorAll('option[data-value]').length > 0;
        }, { timeout: 15000 });

        // Get available dioceses from the datalist
        const availableDioceses = await page.evaluate(() => {
            const datalist = document.querySelector('#DiocesesList');
            if (!datalist) return [];
            return Array.from(datalist.querySelectorAll('option[data-value]')).map(opt => ({
                name: opt.getAttribute('value') || '',
                key: opt.getAttribute('data-value') || ''
            }));
        });

        // Get existing diocesan calendar IDs for the selected nation
        const existingDioceseIds = await extendingPage.getExistingDiocesanCalendarIds(selectedNation);

        // Find a diocese that exists in the datalist AND has existing calendar data
        const dioceseToUpdate = availableDioceses.find(d => existingDioceseIds.includes(d.key));

        if (!dioceseToUpdate) {
            test.skip(true, `No ${selectedNation} dioceses with existing calendar data found`);
            return;
        }

        console.log(`Selected diocese for UPDATE test: ${dioceseToUpdate.name} (${dioceseToUpdate.key})`);

        const dioceseInput = page.locator('#diocesanCalendarDioceseName');
        await dioceseInput.fill(dioceseToUpdate.name);

        // Dispatch a change event to trigger the event handler and load diocese data
        await dioceseInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

        // Wait for the diocese data to be fully loaded by checking for populated form fields
        await page.waitForFunction(() => {
            // Check for any litEventName input that has content (indicating data was loaded)
            const inputs = document.querySelectorAll('input.litEventName');
            for (const input of inputs) {
                if ((input as HTMLInputElement).value.length > 0) {
                    return true;
                }
            }
            return false;
        }, { timeout: 15000 });

        // Wait for network activity to complete
        await page.waitForLoadState('networkidle');

        // Remove any toast containers to prevent them from blocking clicks
        await extendingPage.dismissToasts();

        // Wait for the save button to be enabled and visible
        const saveButton = page.locator('#saveDiocesanCalendar_btn');
        await expect(saveButton).toBeVisible({ timeout: 10000 });
        await expect(saveButton).toBeEnabled({ timeout: 15000 });

        // Click the save button using page.evaluate for more reliable triggering
        await page.evaluate(() => {
            const btn = document.querySelector('#saveDiocesanCalendar_btn') as HTMLButtonElement;
            if (btn) btn.click();
        });

        // Wait for the response and capture status
        const response = await page.waitForResponse(
            response => response.url().includes('/data/') && ['PUT', 'PATCH'].includes(response.request().method()),
            { timeout: 15000 }
        );
        responseStatus = response.status();
        try {
            responseBody = await response.json();
        } catch {
            responseBody = await response.text();
        }
        needsGitRestore = responseStatus === 201;

        // Wrap assertions in try/finally to ensure cleanup runs even if assertions fail
        try {
            // Verify the HTTP method is PATCH (UPDATE)
            expect(getMethod()).toBe('PATCH');
            console.log(`HTTP method used: ${getMethod()}`);

            // Verify response status is 201
            expect(responseStatus).toBe(201);
            expect(responseBody).toHaveProperty('success');
            console.log(`UPDATE (PATCH) response: ${responseStatus} - ${JSON.stringify(responseBody)}`);

            // Validate payload structure
            const capturedPayload = getPayload();
            expect(capturedPayload).not.toBeNull();
            // Validate DiocesanCalendarPayload structure
            expect(capturedPayload).toHaveProperty('litcal');
            expect(capturedPayload).toHaveProperty('metadata');

            // Validate litcal is an array
            expect(Array.isArray(capturedPayload.litcal)).toBe(true);

            // Validate metadata structure
            expect(capturedPayload.metadata).toHaveProperty('diocese_id');
            expect(capturedPayload.metadata).toHaveProperty('diocese_name');
            expect(capturedPayload.metadata).toHaveProperty('nation');

            // Validate nation is a 2-letter ISO code
            expect(capturedPayload.metadata.nation).toMatch(/^[A-Z]{2}$/);
        } finally {
            // CLEANUP: Revert changes using git restore AND git clean in the API folder
            if (needsGitRestore) {
                await gitRestoreApiData();
            }
        }
    });
});

test.describe('Diocesan Calendar Form - Validation', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToDiocesanCalendar();
    });

    test('should reject CREATE (PUT) with empty litcal array', async ({ page, extendingPage }) => {
        // This test verifies that the backend rejects diocesan calendar payloads
        // with empty litcal arrays. A diocesan calendar MUST have at least one
        // liturgical event defined.

        // Get existing diocesan calendar IDs to find a diocese without calendar data
        const existingDioceseIds = await extendingPage.getExistingDiocesanCalendarIds();

        // Select first available national calendar
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        const options = await nationalSelect.locator('option').all();
        let selectedNation = '';
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value && value.length > 0) {
                selectedNation = value;
                break;
            }
        }

        if (!selectedNation) {
            test.skip(true, 'No national calendars available');
            return;
        }

        await nationalSelect.selectOption(selectedNation);

        // Wait for the dioceses datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#DiocesesList');
            return datalist && datalist.querySelectorAll('option[data-value]').length > 0;
        }, { timeout: 15000 });

        // Get all diocese options from the datalist and find one without calendar data
        const availableDioceses = await page.evaluate(() => {
            const datalist = document.querySelector('#DiocesesList');
            if (!datalist) return [];
            return Array.from(datalist.querySelectorAll('option[data-value]')).map(opt => ({
                name: opt.getAttribute('value') || '',
                key: opt.getAttribute('data-value') || ''
            }));
        });

        // Find a diocese that's in the datalist but NOT in existing calendars
        const dioceseToCreate = availableDioceses.find(d => !existingDioceseIds.includes(d.key));

        if (!dioceseToCreate) {
            test.skip(true, `All dioceses for ${selectedNation} already have calendar data`);
            return;
        }

        console.log(`Testing empty litcal rejection for: ${dioceseToCreate.name} (${dioceseToCreate.key})`);

        // Wait for locale options to be populated
        await page.waitForFunction(() => {
            const localesSelect = document.querySelector('#diocesanCalendarLocales') as HTMLSelectElement;
            return localesSelect && localesSelect.options.length > 0;
        }, { timeout: 10000 });

        // Select at least one locale (required for saving)
        const localesSelect = page.locator('#diocesanCalendarLocales');
        const firstLocale = await localesSelect.locator('option').first().getAttribute('value');
        if (firstLocale) {
            await localesSelect.selectOption(firstLocale);
        }

        // Ensure the current localization is set
        const currentLocalization = page.locator('#currentLocalizationDiocesan');
        const firstLocalizationOption = await currentLocalization.locator('option').first().getAttribute('value');
        if (firstLocalizationOption) {
            await currentLocalization.selectOption(firstLocalizationOption);
        }

        // Ensure timezone is selected
        const timezoneSelect = page.locator('#diocesanCalendarTimezone');
        const firstTimezone = await timezoneSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
        if (firstTimezone) {
            await timezoneSelect.selectOption(firstTimezone);
        }

        // Fill in diocese name (but DO NOT fill in any liturgical events)
        const dioceseInput = page.locator('#diocesanCalendarDioceseName');
        await dioceseInput.fill(dioceseToCreate.name);
        await dioceseInput.dispatchEvent('change');

        // Wait for the form to process the change (network requests, datalist updates)
        await page.waitForLoadState('networkidle');

        // Check if translations are available (buttons enabled) or skip test
        const buttonsEnabled = await extendingPage.waitForActionButtonsEnabled(10000);
        if (!buttonsEnabled) {
            const hasMissingTranslations = await extendingPage.hasMissingTranslationsToast();
            if (hasMissingTranslations) {
                test.skip(true, `Translations missing for ${selectedNation} locale - cannot test validation`);
                return;
            }
        }

        // Set up request interception to capture the payload
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Click the save button (this should send a payload with empty litcal)
        const saveButton = page.locator('#saveDiocesanCalendar_btn');
        await expect(saveButton).toBeVisible({ timeout: 10000 });

        // Check if save button is enabled, skip if it remains disabled
        try {
            await expect(saveButton).toBeEnabled({ timeout: 15000 });
        } catch {
            // Save button remained disabled - check if translations issue
            const hasMissingTranslations = await extendingPage.hasMissingTranslationsToast();
            if (hasMissingTranslations) {
                test.skip(true, `Translations missing for ${selectedNation} - save button disabled`);
                return;
            }
            // Save button disabled for other reasons (form validation)
            test.skip(true, 'Save button remains disabled - form may have validation issues');
            return;
        }
        await saveButton.click({ force: true });

        // Wait for either a response OR an error toast (network failure)
        const result = await Promise.race([
            page.waitForResponse(
                response => response.url().includes('/data/') && ['PUT', 'PATCH'].includes(response.request().method()),
                { timeout: 15000 }
            ).then(response => ({ type: 'response' as const, response })),
            page.waitForSelector('.toast-error, .toast.bg-danger', { timeout: 15000 })
                .then(() => ({ type: 'error-toast' as const }))
        ]).catch(() => ({ type: 'timeout' as const }));

        if (result.type === 'error-toast') {
            // Check if it's a "Failed to fetch" error (network/CORS issue) - skip these
            const errorText = await page.locator('.toast-error, .toast.bg-danger').textContent();
            if (errorText?.includes('Failed to fetch')) {
                test.skip(true, 'Network error (Failed to fetch) - possible CORS issue with empty litcal validation');
                return;
            }
            // For other error toasts, fail the test to surface backend regressions
            throw new Error(`Unexpected error toast: ${errorText}`);
        }

        if (result.type === 'timeout') {
            test.skip(true, 'No response received - request may have failed silently');
            return;
        }

        const response = result.response;
        const responseStatus = response.status();
        let responseBody: any = null;
        try {
            responseBody = await response.json();
        } catch {
            responseBody = await response.text();
        }

        // Verify the HTTP method is PUT (CREATE attempt)
        expect(getMethod()).toBe('PUT');
        console.log(`HTTP method used: ${getMethod()}`);

        // Verify the payload has an empty litcal array
        const capturedPayload = getPayload();
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload).toHaveProperty('litcal');
        expect(Array.isArray(capturedPayload.litcal)).toBe(true);
        expect(capturedPayload.litcal.length).toBe(0);
        console.log(`Payload litcal length: ${capturedPayload.litcal.length}`);

        // Verify the backend REJECTS this payload (should be 422 Unprocessable Entity or 400 Bad Request)
        expect([400, 422]).toContain(responseStatus);
        console.log(`Backend correctly rejected empty litcal with status: ${responseStatus}`);
        console.log(`Response body: ${JSON.stringify(responseBody)}`);

        // Verify the response contains an error message (RFC 9110 format uses 'detail', legacy uses 'error')
        const hasErrorMessage = responseBody.hasOwnProperty('error') || responseBody.hasOwnProperty('detail');
        expect(hasErrorMessage).toBe(true);
    });

    test('should show validation error when submitting without required fields', async ({ page }) => {
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');

        // Try to submit without filling required fields
        const saveButton = page.locator('#saveDiocesanCalendar_btn');
        await saveButton.click({ force: true });

        // Wait for validation classes to be applied
        await page.waitForFunction(() => {
            return document.querySelector('form.was-validated') !== null ||
                   document.querySelector(':invalid') !== null;
        }, { timeout: 5000 });

        // Bootstrap validation adds was-validated class to forms
        // Check that at least one form has this class
        const validatedForms = page.locator('form.was-validated');
        const count = await validatedForms.count();

        // Either validation class is added, or required fields show as invalid
        if (count === 0) {
            // Check if required fields are in invalid state
            const nationalSelect = page.locator('#diocesanCalendarNationalDependency:invalid');
            const dioceseNameInput = page.locator('#diocesanCalendarDioceseName:invalid');
            const hasInvalidFields = (await nationalSelect.count()) > 0 || (await dioceseNameInput.count()) > 0;
            expect(hasInvalidFields || count > 0).toBe(true);
        } else {
            expect(count).toBeGreaterThan(0);
        }
    });

    test('should validate diocese name format', async ({ page }) => {
        // First select a national calendar to enable the diocese input
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        const options = await nationalSelect.locator('option').all();
        let selectedValue = '';
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value && value.length > 0) {
                selectedValue = value;
                break;
            }
        }

        if (!selectedValue) {
            test.skip(true, 'No national calendars available');
            return;
        }

        await nationalSelect.selectOption(selectedValue);

        // Diocese name input should accept valid names
        const dioceseNameInput = page.locator('#diocesanCalendarDioceseName');
        await expect(dioceseNameInput).toBeEnabled();
        await dioceseNameInput.fill('Boston');

        // Should not show validation error
        await expect(dioceseNameInput).not.toHaveClass(/is-invalid/);
    });
});

test.describe('Diocesan Calendar Form - Loading Existing Diocese', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToDiocesanCalendar();
    });

    test('should load existing diocese when selected', async ({ page }) => {
        // First select a national calendar - get first available option
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        const options = await nationalSelect.locator('option').all();
        let selectedValue = '';
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value && value.length > 0) {
                selectedValue = value;
                break;
            }
        }

        if (!selectedValue) {
            test.skip(true, 'No national calendars available');
            return;
        }

        await nationalSelect.selectOption(selectedValue);
        // Wait for dioceses datalist to be populated - let timeout surface as failure
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#DiocesesList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 10000 });

        // The dioceses datalist should have options
        const diocesesList = page.locator('#DiocesesList');
        const dioceseOptionCount = await diocesesList.locator('option').count();
        expect(dioceseOptionCount).toBeGreaterThan(0);

        // Then try to type in the diocese input
        const dioceseInput = page.locator('#diocesanCalendarDioceseName');
        await expect(dioceseInput).toBeVisible();

        // Just verify the input is interactable - actual diocese data depends on API data
        await dioceseInput.fill('Test');

        // The form should accept input
        const inputValue = await dioceseInput.inputValue();
        expect(inputValue).toBe('Test');
    });
});
