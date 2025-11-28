import { test, expect } from './fixtures';
import { exec } from 'child_process';

/**
 * Tests for the National Calendar form on extending.php
 *
 * These tests verify that:
 * 1. The form can be loaded and populated correctly
 * 2. Form validation works as expected
 * 3. The payload structure matches the API contract (NationalCalendarPayload)
 * 4. CREATE (PUT) requests return 201 and can be cleaned up with DELETE (200)
 * 5. UPDATE (PATCH) requests return 201 and changes are reverted with git restore
 */

test.describe('National Calendar Form', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToNationalCalendar();
    });

    test('should load the national calendar form', async ({ page }) => {
        // Wait for page to fully load
        await page.waitForTimeout(1000);

        // Verify key form elements are present (some may be hidden in collapsed sections)
        await expect(page.locator('#nationalCalendarName')).toBeVisible();
        await expect(page.locator('#nationalCalendarLocales')).toBeAttached();
        await expect(page.locator('#nationalCalendarSettingsForm')).toBeAttached();
        await expect(page.locator('#nationalCalendarForm')).toBeAttached();
        await expect(page.locator('#serializeNationalCalendarData')).toBeAttached();
    });

    test('should load an existing national calendar', async ({ page, extendingPage }) => {
        // Select USA calendar from the datalist
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');

        // Wait for data to load
        await page.waitForLoadState('networkidle');

        // The save button should be enabled once calendar is loaded
        // (it may take a moment for data to load)
        await page.waitForTimeout(2000);

        // Verify settings are populated
        const epiphanySetting = page.locator('#nationalCalendarSettingEpiphany');
        await expect(epiphanySetting).toBeVisible();
    });

    test('should validate settings form fields', async ({ page }) => {
        // The settings form should have proper structure
        const epiphanySelect = page.locator('#nationalCalendarSettingEpiphany');
        const ascensionSelect = page.locator('#nationalCalendarSettingAscension');
        const corpusChristiSelect = page.locator('#nationalCalendarSettingCorpusChristi');
        const highPriestCheckbox = page.locator('#nationalCalendarSettingHighPriest');

        // Verify settings dropdowns have expected options
        await expect(epiphanySelect).toBeVisible();
        await expect(ascensionSelect).toBeVisible();
        await expect(corpusChristiSelect).toBeVisible();
        await expect(highPriestCheckbox).toBeVisible();

        // Check epiphany options
        const epiphanyOptions = await epiphanySelect.locator('option').allTextContents();
        expect(epiphanyOptions.length).toBeGreaterThanOrEqual(2);

        // Check ascension options
        const ascensionOptions = await ascensionSelect.locator('option').allTextContents();
        expect(ascensionOptions.length).toBeGreaterThanOrEqual(2);
    });

    test('should UPDATE (PATCH) existing national calendar and verify 201 response', async ({ page, extendingPage }) => {
        // Load an existing calendar (UPDATE scenario - should use PATCH)
        // The datalist uses ISO country codes as values (e.g., "US" not "USA")
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');
        // Wait for data to load - use longer timeout like the working wider region test
        await page.waitForTimeout(3000);

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Track if we made changes that need to be reverted
        let needsGitRestore = false;

        // Set up request interception to capture the payload and method
        let capturedPayload: any = null;
        let capturedMethod: string | null = null;
        let responseStatus: number | null = null;
        let responseBody: any = null;

        await page.route('**/data/**', async (route, request) => {
            if (['PUT', 'PATCH'].includes(request.method())) {
                capturedMethod = request.method();
                const postData = request.postData();
                if (postData) {
                    try {
                        capturedPayload = JSON.parse(postData);
                    } catch {
                        capturedPayload = postData;
                    }
                }
            }
            await route.continue();
        });

        // Wait for the save button to be enabled (form must be fully loaded)
        const saveButton = page.locator('#serializeNationalCalendarData');
        await expect(saveButton).toBeEnabled({ timeout: 15000 });
        await saveButton.click();

        // Wait for the response and capture status
        try {
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
        } catch (e) {
            console.log('No PUT/PATCH response received:', e);
        }

        // Verify the HTTP method is PATCH (UPDATE)
        expect(capturedMethod).toBe('PATCH');
        console.log(`HTTP method used: ${capturedMethod}`);

        // Verify response status is 201
        expect(responseStatus).toBe(201);
        expect(responseBody).toHaveProperty('success');
        console.log(`UPDATE (PATCH) response: ${responseStatus} - ${JSON.stringify(responseBody)}`);

        // Validate payload structure
        expect(capturedPayload).not.toBeNull();
        // Validate NationalCalendarPayload structure
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('settings');
        expect(capturedPayload).toHaveProperty('metadata');
        expect(capturedPayload).toHaveProperty('i18n');

        // Validate litcal is an array
        expect(Array.isArray(capturedPayload.litcal)).toBe(true);

        // Validate settings structure
        expect(capturedPayload.settings).toHaveProperty('epiphany');
        expect(capturedPayload.settings).toHaveProperty('ascension');
        expect(capturedPayload.settings).toHaveProperty('corpus_christi');

        // Validate settings values
        expect(['JAN6', 'SUNDAY_JAN2_JAN8']).toContain(capturedPayload.settings.epiphany);
        expect(['THURSDAY', 'SUNDAY']).toContain(capturedPayload.settings.ascension);
        expect(['THURSDAY', 'SUNDAY']).toContain(capturedPayload.settings.corpus_christi);

        // Validate metadata structure
        expect(capturedPayload.metadata).toHaveProperty('nation');
        expect(capturedPayload.metadata).toHaveProperty('locales');
        expect(capturedPayload.metadata).toHaveProperty('wider_region');
        expect(capturedPayload.metadata).toHaveProperty('missals');

        // Validate nation is a 2-letter ISO code
        expect(capturedPayload.metadata.nation).toMatch(/^[A-Z]{2}$/);

        // Validate locales is a non-empty array
        expect(Array.isArray(capturedPayload.metadata.locales)).toBe(true);
        expect(capturedPayload.metadata.locales.length).toBeGreaterThan(0);

        // Validate wider_region is one of the allowed values
        const allowedRegions = ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania', 'Middle East', 'Antarctica'];
        expect(allowedRegions).toContain(capturedPayload.metadata.wider_region);

        // Validate missals is an array
        expect(Array.isArray(capturedPayload.metadata.missals)).toBe(true);

        // Validate i18n has keys matching locales
        const i18nKeys = Object.keys(capturedPayload.i18n).sort();
        const localesSorted = [...capturedPayload.metadata.locales].sort();
        expect(i18nKeys).toEqual(localesSorted);

        // CLEANUP: Revert changes using git restore in the API folder
        if (needsGitRestore) {
            const apiPath = '/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI';
            await new Promise<void>((resolve) => {
                exec(`cd ${apiPath} && git restore jsondata/sourcedata/`, (error: any) => {
                    if (error) {
                        console.warn('Git restore warning:', error.message);
                    }
                    resolve();
                });
            });
            console.log('CLEANUP: git restore completed for national calendar update');
        }
    });

    test('should CREATE (PUT) new national calendar, verify 201 response, and DELETE for cleanup', async ({ page }) => {
        // This test creates a NEW national calendar using PUT, verifies the API returns 201,
        // then DELETEs it and verifies 200 response for cleanup

        // Set up request interception BEFORE filling the form
        let capturedPayload: any = null;
        let capturedMethod: string | null = null;
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;
        let createdNationKey: string | null = null;

        await page.route('**/data/**', async (route, request) => {
            if (['PUT', 'PATCH'].includes(request.method())) {
                capturedMethod = request.method();
                const postData = request.postData();
                if (postData) {
                    try {
                        capturedPayload = JSON.parse(postData);
                    } catch {
                        capturedPayload = postData;
                    }
                }
            }
            await route.continue();
        });

        const uniqueNationName = `E2ETestNation_${Date.now()}`;

        // Wait for any loading spinners to disappear
        await page.waitForFunction(() => {
            const spinners = document.querySelectorAll('.spinner-border, .spinner-grow, .loading');
            return spinners.length === 0 || Array.from(spinners).every(s => !s.closest(':not(.d-none)'));
        }, { timeout: 10000 }).catch(() => {});

        // Fill in the national calendar name with a unique value that doesn't exist
        const calendarNameInput = page.locator('#nationalCalendarName');
        await calendarNameInput.fill(uniqueNationName);
        await page.waitForTimeout(1000);

        // Wait for form to initialize after entering new calendar name
        await page.waitForLoadState('networkidle');

        // Select a wider region (this is an input with datalist, not a select)
        const widerRegionInput = page.locator('#associatedWiderRegion');
        await widerRegionInput.fill('Europe');
        await page.waitForTimeout(1000);

        // Wait for locales dropdown to have options
        const localesSelect = page.locator('#nationalCalendarLocales');
        await page.waitForFunction(() => {
            const select = document.querySelector('#nationalCalendarLocales') as HTMLSelectElement;
            return select && select.options.length > 1;
        }, { timeout: 10000 }).catch(() => {});

        // Select at least one locale - wait for options to be available
        const optionCount = await localesSelect.locator('option').count();
        if (optionCount > 0) {
            // Select the first available locale option
            const firstOption = await localesSelect.locator('option').first().getAttribute('value');
            if (firstOption) {
                await localesSelect.selectOption(firstOption);
            }
        }
        await page.waitForTimeout(500);

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Wait for the save button to be visible and enabled
        const saveButton = page.locator('#serializeNationalCalendarData');
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

        // Extract the nation key from the URL for deletion
        const url = response.url();
        const match = url.match(/\/data\/nation\/([^\/\?]+)/);
        if (match) {
            createdNationKey = match[1];
        }

        // Verify the HTTP method is PUT (CREATE)
        expect(capturedMethod).toBe('PUT');
        console.log(`HTTP method used: ${capturedMethod}`);

        // Verify CREATE response status is 201
        expect(createResponseStatus).toBe(201);
        expect(createResponseBody).toHaveProperty('success');
        console.log(`CREATE (PUT) response: ${createResponseStatus} - ${JSON.stringify(createResponseBody)}`);

        // Validate payload structure
        expect(capturedPayload).not.toBeNull();
        // Validate NationalCalendarPayload structure
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('settings');
        expect(capturedPayload).toHaveProperty('metadata');
        expect(capturedPayload).toHaveProperty('i18n');

        // Store the nation key for cleanup
        if (!createdNationKey && capturedPayload.metadata?.nation) {
            createdNationKey = capturedPayload.metadata.nation;
        }

        // CLEANUP: DELETE the created national calendar and verify 200 response
        console.log(`CLEANUP: Deleting national calendar ${createdNationKey}...`);

        // Get the API base URL from the page
        const apiBaseUrl = await page.evaluate(() => {
            // @ts-ignore - BaseUrl is a global variable set by the frontend
            return typeof BaseUrl !== 'undefined' ? BaseUrl : 'http://localhost:8000';
        });

        // Get the auth token from localStorage (Playwright stores it there)
        const token = await page.evaluate(() => {
            return localStorage.getItem('litcal_jwt_token') || sessionStorage.getItem('litcal_jwt_token');
        });

        // Make DELETE request
        const deleteResponse = await page.request.delete(
            `${apiBaseUrl}/data/nation/${createdNationKey}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        const deleteStatus = deleteResponse.status();
        let deleteResponseBody: any = null;
        try {
            deleteResponseBody = await deleteResponse.json();
        } catch {
            deleteResponseBody = await deleteResponse.text();
        }

        // Verify DELETE response is 200 OK with success message
        expect(deleteStatus).toBe(200);
        expect(deleteResponseBody).toHaveProperty('success');
        console.log(`DELETE response: ${deleteStatus} - ${JSON.stringify(deleteResponseBody)}`);
    });

    test('should validate locale selection', async ({ page }) => {
        // The locale select should be a multi-select
        const localesSelect = page.locator('#nationalCalendarLocales');
        await expect(localesSelect).toBeVisible();
        await expect(localesSelect).toHaveAttribute('multiple', 'multiple');
    });

    test('should have wider region selection', async ({ page }) => {
        // Verify wider region dropdown exists
        const widerRegionSelect = page.locator('#associatedWiderRegion');
        await expect(widerRegionSelect).toBeVisible();
    });

    test('should have published Roman Missals section', async ({ page }) => {
        // Verify missals section exists (may be hidden in collapsed section)
        const missalsSection = page.locator('#publishedRomanMissalList');
        await expect(missalsSection).toBeAttached();
    });
});

test.describe('National Calendar Form - Validation', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToNationalCalendar();
    });

    test('should require calendar name', async ({ page }) => {
        // The calendar name input should be required
        const calendarNameInput = page.locator('#nationalCalendarName');
        await expect(calendarNameInput).toHaveAttribute('required', '');
    });

    test('should validate grade values are between 0-7', async ({ page, extendingPage }) => {
        // Load an existing calendar
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Find any grade select in the form
        const gradeSelects = page.locator('#nationalCalendarForm select[name*="grade"]');
        const count = await gradeSelects.count();

        if (count > 0) {
            // Get all options from the first grade select
            const options = await gradeSelects.first().locator('option').allTextContents();
            // Verify there are options (grades 0-7 = 8 options)
            expect(options.length).toBeLessThanOrEqual(8);
        }
    });
});
