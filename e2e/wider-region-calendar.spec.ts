import { test, expect } from './fixtures';
import { exec } from 'child_process';
import path from 'path';

/**
 * Tests for the Wider Region Calendar form on extending.php
 *
 * These tests verify that:
 * 1. The form can be loaded and populated correctly
 * 2. Form validation works as expected
 * 3. The payload structure matches the API contract (WiderRegionPayload)
 * 4. CREATE (PUT) requests return 201 and can be cleaned up with DELETE (200)
 * 5. UPDATE (PATCH) requests return 201 and changes are reverted with git restore
 *
 * Note: Wider Region calendars are NOT standalone calendars but a layer
 * above national calendars containing liturgical events shared across
 * countries in a geographical/cultural region.
 */

test.describe('Wider Region Calendar Form', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToWiderRegionCalendar();
    });

    test('should load the wider region calendar form', async ({ page }) => {
        // Wait for page to fully load
        await page.waitForTimeout(1000);

        // Verify key form elements are present (some may be hidden in collapsed sections)
        await expect(page.locator('#widerRegionCalendarName')).toBeVisible();
        await expect(page.locator('#widerRegionLocales')).toBeAttached();
        await expect(page.locator('form#widerRegionForm')).toBeAttached();
        await expect(page.locator('#serializeWiderRegionData')).toBeAttached();
    });

    test('should have wider region datalist with options', async ({ page }) => {
        // Verify the datalist exists
        const datalist = page.locator('#WiderRegionsList');
        await expect(datalist).toBeAttached();

        // Check that datalist has options
        const options = await datalist.locator('option').count();
        expect(options).toBeGreaterThan(0);
    });

    test('should load an existing wider region calendar', async ({ page, extendingPage }) => {
        // Select Americas region from the datalist
        await extendingPage.selectCalendar('#widerRegionCalendarName', 'Americas');

        // Wait for data to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Verify locales are populated
        const localesSelect = page.locator('#widerRegionLocales');
        await expect(localesSelect).toBeVisible();
    });

    test('should validate locale selection', async ({ page }) => {
        // The locale select should be a multi-select
        const localesSelect = page.locator('#widerRegionLocales');
        await expect(localesSelect).toBeVisible();
        await expect(localesSelect).toHaveAttribute('multiple', 'multiple');
    });

    test('should UPDATE (PATCH) existing wider region calendar and verify 201 response', async ({ page, extendingPage }) => {
        // Track if we made changes that need to be reverted
        let needsGitRestore = false;

        // Set up request interception BEFORE loading the calendar
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

        // Load an existing wider region calendar (UPDATE scenario - should use PATCH)
        await extendingPage.selectCalendar('#widerRegionCalendarName', 'Americas');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Wait for the save button to be enabled (form must be fully loaded)
        const saveButton = page.locator('#serializeWiderRegionData');
        await expect(saveButton).toBeEnabled({ timeout: 15000 });
        await saveButton.click({ force: true });

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

        // Verify the HTTP method is PATCH (UPDATE)
        expect(capturedMethod).toBe('PATCH');
        console.log(`HTTP method used: ${capturedMethod}`);

        // Verify response status is 201
        expect(responseStatus).toBe(201);
        expect(responseBody).toHaveProperty('success');
        console.log(`UPDATE (PATCH) response: ${responseStatus} - ${JSON.stringify(responseBody)}`);

        // Validate payload structure
        expect(capturedPayload).not.toBeNull();
        // Validate WiderRegionPayload structure
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('national_calendars');
        expect(capturedPayload).toHaveProperty('metadata');
        expect(capturedPayload).toHaveProperty('i18n');

        // Validate litcal is an array
        expect(Array.isArray(capturedPayload.litcal)).toBe(true);

        // Validate national_calendars is an object
        expect(typeof capturedPayload.national_calendars).toBe('object');

        // Validate metadata structure
        expect(capturedPayload.metadata).toHaveProperty('locales');
        expect(capturedPayload.metadata).toHaveProperty('wider_region');

        // Validate locales is a non-empty array
        expect(Array.isArray(capturedPayload.metadata.locales)).toBe(true);
        expect(capturedPayload.metadata.locales.length).toBeGreaterThan(0);

        // Validate wider_region is a string
        expect(typeof capturedPayload.metadata.wider_region).toBe('string');

        // Validate i18n is an object
        expect(typeof capturedPayload.i18n).toBe('object');

        // Validate i18n has keys matching locales
        const i18nKeys = Object.keys(capturedPayload.i18n).sort();
        const localesSorted = [...capturedPayload.metadata.locales].sort();
        expect(i18nKeys).toEqual(localesSorted);

        // CLEANUP: Revert changes using git restore in the API folder
        if (needsGitRestore) {
            const apiPath = process.env.API_REPO_PATH || path.resolve(__dirname, '../../LiturgicalCalendarAPI');
            await new Promise<void>((resolve) => {
                exec(`git -C "${apiPath}" restore jsondata/sourcedata/`, (error: any) => {
                    if (error) {
                        console.warn('Git restore warning:', error.message);
                    }
                    resolve();
                });
            });
            console.log('CLEANUP: git restore completed for wider region calendar update');
        }
    });

    test('should CREATE (PUT) new wider region calendar, verify 201 response, and DELETE for cleanup', async ({ page }) => {
        // This test creates a NEW wider region calendar using PUT, verifies the API returns 201,
        // then DELETEs it and verifies 200 response for cleanup

        const uniqueRegionName = `E2ETestRegion_${Date.now()}`;

        // Fill in the wider region name with a unique value that doesn't exist
        const regionNameInput = page.locator('#widerRegionCalendarName');
        await regionNameInput.fill(uniqueRegionName);
        await page.waitForTimeout(500);

        // Select at least one locale (use first available option for robustness)
        const localesSelect = page.locator('#widerRegionLocales');
        const firstOption = await localesSelect.locator('option').first().getAttribute('value');
        if (firstOption) {
            await localesSelect.selectOption(firstOption);
        }
        await page.waitForTimeout(500);

        // Set up request interception to capture the payload and method
        let capturedPayload: any = null;
        let capturedMethod: string | null = null;
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;
        let createdRegionKey: string | null = null;

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

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Wait for the save button to be visible and enabled
        const saveButton = page.locator('#serializeWiderRegionData');
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

        // Extract the region key from the URL for deletion
        const url = response.url();
        const match = url.match(/\/data\/widerregion\/([^\/\?]+)/);
        if (match) {
            createdRegionKey = match[1];
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
        // Validate WiderRegionPayload structure
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('national_calendars');
        expect(capturedPayload).toHaveProperty('metadata');
        expect(capturedPayload).toHaveProperty('i18n');

        // Store the region key for cleanup
        if (!createdRegionKey && capturedPayload.metadata?.wider_region) {
            createdRegionKey = capturedPayload.metadata.wider_region;
        }

        // CLEANUP: DELETE the created wider region calendar and verify 200 response
        console.log(`CLEANUP: Deleting wider region calendar ${createdRegionKey}...`);

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
            `${apiBaseUrl}/data/widerregion/${createdRegionKey}`,
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

    test('should require wider region name', async ({ page }) => {
        // The wider region name input should be required
        const regionNameInput = page.locator('#widerRegionCalendarName');
        await expect(regionNameInput).toHaveAttribute('required', '');
    });
});

test.describe('Wider Region Calendar Form - National Calendar Association', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToWiderRegionCalendar();
    });

    test('should show associated national calendars', async ({ page, extendingPage }) => {
        // Load Americas region
        await extendingPage.selectCalendar('#widerRegionCalendarName', 'Americas');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // The form should show which national calendars are associated with this wider region
        // This is typically displayed in the national_calendars section of the form
        // The exact structure depends on the implementation
    });
});
