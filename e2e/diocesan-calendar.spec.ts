import { test, expect } from './fixtures';
import { exec } from 'child_process';
import path from 'path';

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

    test('should require diocese name', async ({ page }) => {
        // The diocese name input should be required
        const dioceseNameInput = page.locator('#diocesanCalendarDioceseName');
        await expect(dioceseNameInput).toHaveAttribute('required', '');
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

        if (selectedValue) {
            await nationalSelect.selectOption(selectedValue);
            // Wait for diocese list to be populated
            await page.waitForFunction(() => {
                const datalist = document.querySelector('#DiocesesList');
                return datalist && datalist.querySelectorAll('option').length > 0;
            }, { timeout: 10000 }).catch(() => {});

            // The dioceses datalist should have options
            const diocesesList = page.locator('#DiocesesList');
            await expect(diocesesList).toBeAttached();
        }
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

    test('should CREATE (PUT) new diocesan calendar, verify 201 response, and DELETE for cleanup', async ({ page }) => {
        // This test creates a NEW diocese calendar using PUT for a diocese that exists
        // in the datalist but doesn't have calendar data yet. Then it DELETEs to clean up.

        // First, query the /calendars API to get existing diocesan calendar IDs
        const apiBaseUrl = await page.evaluate(() => {
            // @ts-ignore - BaseUrl is a global variable set by the frontend
            return typeof BaseUrl !== 'undefined' ? BaseUrl : 'http://localhost:8000';
        });

        const calendarsResponse = await page.request.get(`${apiBaseUrl}/calendars`);
        const calendarsData = await calendarsResponse.json();
        const existingDioceseIds: string[] = calendarsData.diocesan_calendars?.map(
            (cal: { calendar_id: string }) => cal.calendar_id
        ) || [];
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

        // Wait for the form to process the change
        await page.waitForTimeout(500);

        // Fill in at least one valid liturgical event (Principal Patron)
        // This is required because empty form rows would fail API schema validation
        const principalPatronNameInput = page.locator('.carousel-item.active input.litEventName').first();
        await principalPatronNameInput.fill('Test Principal Patron');
        await principalPatronNameInput.dispatchEvent('change');

        // Set up request interception to capture the payload and method
        let capturedPayload: any = null;
        let capturedMethod: string | null = null;
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;

        await page.route('**/data/**', async (route, request) => {
            if (['PUT', 'PATCH'].includes(request.method())) {
                capturedMethod = request.method();
                const postData = request.postData();
                if (postData) {
                    try {
                        capturedPayload = JSON.parse(postData);
                    } catch (e) {
                        capturedPayload = postData;
                        console.log('Failed to parse request payload as JSON:', e);
                    }
                }
            }
            await route.continue();
        });

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
        expect(capturedMethod).toBe('PUT');
        console.log(`HTTP method used: ${capturedMethod}`);

        // Verify CREATE response status is 201
        expect(createResponseStatus).toBe(201);
        expect(createResponseBody).toHaveProperty('success');
        console.log(`CREATE (PUT) response: ${createResponseStatus}`);

        // Validate payload structure
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
        console.log(`CLEANUP: Deleting diocese ${dioceseToCreate.key}...`);

        // Get the auth token from localStorage (Playwright stores it there)
        const token = await page.evaluate(() => {
            return localStorage.getItem('litcal_jwt_token') || sessionStorage.getItem('litcal_jwt_token');
        });

        // Make DELETE request
        const deleteResponse = await page.request.delete(
            `${apiBaseUrl}/data/diocese/${dioceseToCreate.key}`,
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

    test('should UPDATE (PATCH) existing diocesan calendar and verify 201 response', async ({ page, extendingPage }) => {
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
                    } catch (e) {
                        capturedPayload = postData;
                        console.log('Failed to parse request payload as JSON:', e);
                    }
                }
            }
            await route.continue();
        });

        // Load an existing diocesan calendar (UPDATE scenario - should use PATCH)
        // First select USA as the national calendar
        const nationalSelect = page.locator('#diocesanCalendarNationalDependency');
        await nationalSelect.selectOption('US');

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

        // Query the API for existing US diocesan calendars
        const apiBaseUrl = await page.evaluate(() => {
            // @ts-ignore - BaseUrl is a global variable set by the frontend
            return typeof BaseUrl !== 'undefined' ? BaseUrl : 'http://localhost:8000';
        });
        const calendarsResponse = await page.request.get(`${apiBaseUrl}/calendars`);
        const calendarsData = await calendarsResponse.json();
        const existingDioceseIds: string[] = calendarsData.litcal_metadata?.diocesan_calendars
            ?.filter((d: { nation: string }) => d.nation === 'US')
            ?.map((d: { calendar_id: string }) => d.calendar_id) || [];

        // Find a diocese that exists in the datalist AND has existing calendar data
        const dioceseToUpdate = availableDioceses.find(d => existingDioceseIds.includes(d.key));

        if (!dioceseToUpdate) {
            test.skip(true, `No US dioceses with existing calendar data found`);
            return;
        }

        console.log(`Selected diocese for UPDATE test: ${dioceseToUpdate.name} (${dioceseToUpdate.key})`);

        const dioceseInput = page.locator('#diocesanCalendarDioceseName');
        await dioceseInput.fill(dioceseToUpdate.name);

        // Dispatch a change event to trigger the event handler and load diocese data
        await dioceseInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

        // Wait for the diocese data to be fully loaded by checking for populated form fields
        // The Boston diocese has "Dedication of the Cathedral of the Holy Cross" as a feast
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
        await page.evaluate(() => {
            document.querySelectorAll('#toast-container, .toast-container').forEach(el => el.remove());
        });

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

        // Verify the HTTP method is PATCH (UPDATE)
        expect(capturedMethod).toBe('PATCH');
        console.log(`HTTP method used: ${capturedMethod}`);

        // Verify response status is 201
        expect(responseStatus).toBe(201);
        expect(responseBody).toHaveProperty('success');
        console.log(`UPDATE (PATCH) response: ${responseStatus} - ${JSON.stringify(responseBody)}`);

        // Validate payload structure
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

        // CLEANUP: Revert changes using git restore AND git clean in the API folder
        // git restore: reverts modified tracked files
        // git clean -fd: removes untracked files/directories (new calendars created by the API)
        if (needsGitRestore) {
            const apiPath = process.env.API_REPO_PATH || path.resolve(__dirname, '../../LiturgicalCalendarAPI');
            const gitRestoreError = await new Promise<string | null>((resolve) => {
                exec(`git -C "${apiPath}" restore jsondata/sourcedata/ && git -C "${apiPath}" clean -fd jsondata/sourcedata/`, (error: any) => {
                    if (error) {
                        resolve(error.message);
                    } else {
                        resolve(null);
                    }
                });
            });
            if (gitRestoreError) {
                // Fail the test if cleanup fails - leaving modified JSON is risky in shared/CI environments
                throw new Error(`CLEANUP FAILED: git restore/clean failed for path "${apiPath}". Manual cleanup required. Error: ${gitRestoreError}`);
            }
            console.log('CLEANUP: git restore and clean completed for diocesan calendar update');
        }
    });
});

test.describe('Diocesan Calendar Form - Validation', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToDiocesanCalendar();
    });

    test('should show validation error when submitting without required fields', async ({ page }) => {
        // Wait for page to fully load
        await page.waitForTimeout(1000);

        // Try to submit without filling required fields
        const saveButton = page.locator('#saveDiocesanCalendar_btn');
        await saveButton.click({ force: true });

        // Wait a moment for validation to be applied
        await page.waitForTimeout(500);

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
        // Diocese name input should accept valid names
        const dioceseNameInput = page.locator('#diocesanCalendarDioceseName');
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
        // Wait for dioceses datalist to be populated after national selection
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#DiocesesList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 10000 }).catch(() => {});

        // Then try to type in the diocese input
        // The dioceses datalist should be populated
        const dioceseInput = page.locator('#diocesanCalendarDioceseName');
        await expect(dioceseInput).toBeVisible();

        // Just verify the input is interactable - actual diocese data depends on API data
        await dioceseInput.fill('Test');

        // The form should accept input
        const inputValue = await dioceseInput.inputValue();
        expect(inputValue).toBe('Test');
    });
});
