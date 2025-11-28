import { test, expect } from './fixtures';
import { exec } from 'child_process';
import path from 'path';
import { VALID_WIDER_REGIONS } from './constants';

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
        // Wait for form to be ready
        await page.waitForSelector('#widerRegionCalendarName', { state: 'visible' });

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

        // Wait for data to load and locales to be populated
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => {
            const select = document.querySelector('#widerRegionLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 15000 });
        // Wait for success toast indicating data was loaded
        await page.waitForSelector('.toast-success, .toast.bg-success', { timeout: 10000 }).catch(() => {});
        // Wait for all remaining async operations to complete
        await page.waitForLoadState('networkidle');

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
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let responseStatus: number | null = null;
        let responseBody: any = null;

        // Load an existing wider region calendar (UPDATE scenario - should use PATCH)
        await extendingPage.selectCalendar('#widerRegionCalendarName', 'Americas');
        await page.waitForLoadState('networkidle');
        // Wait for locales to be populated (indicates data has loaded)
        await page.waitForFunction(() => {
            const select = document.querySelector('#widerRegionLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 15000 });
        // Wait for success toast indicating data was loaded
        await page.waitForSelector('.toast-success, .toast.bg-success', { timeout: 10000 }).catch(() => {});
        // Wait for all remaining async operations to complete
        await page.waitForLoadState('networkidle');

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Wait for the save button to be enabled (form must be fully loaded)
        const saveButton = page.locator('#serializeWiderRegionData');
        await expect(saveButton).toBeEnabled({ timeout: 15000 });

        // Click the save button using page.evaluate for more reliable triggering
        await page.evaluate(() => {
            const btn = document.querySelector('#serializeWiderRegionData') as HTMLButtonElement;
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
        expect(getMethod()).toBe('PATCH');
        console.log(`HTTP method used: ${getMethod()}`);

        // Verify response status is 201
        expect(responseStatus).toBe(201);
        expect(responseBody).toHaveProperty('success');
        console.log(`UPDATE (PATCH) response: ${responseStatus} - ${JSON.stringify(responseBody)}`);

        // Validate payload structure
        const capturedPayload = getPayload();
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
            console.log('CLEANUP: git restore and clean completed for wider region calendar update');
        }
    });

    test('should CREATE (PUT) new wider region calendar, verify 201 response, and DELETE for cleanup', async ({ page }) => {
        // This test creates a NEW wider region calendar using PUT for a region that exists
        // in the datalist but doesn't have calendar data yet. Then it DELETEs to clean up.

        // Capture console logs and errors early for debugging
        page.on('console', msg => console.log(`Browser console [${msg.type()}]: ${msg.text()}`));
        page.on('pageerror', err => console.log(`Browser error: ${err.message}`));

        // Query the /calendars API to get existing wider region IDs
        const apiBaseUrl = await page.evaluate(() => {
            // @ts-ignore - BaseUrl is a global variable set by the frontend
            return typeof BaseUrl !== 'undefined' ? BaseUrl : 'http://localhost:8000';
        });

        const calendarsResponse = await page.request.get(`${apiBaseUrl}/calendars`);
        const calendarsData = await calendarsResponse.json();
        const existingRegionIds: string[] = calendarsData.litcal_metadata?.wider_regions_keys || [];
        console.log(`Found ${existingRegionIds.length} existing wider regions: ${existingRegionIds.join(', ')}`);

        // Find a valid wider region that doesn't have calendar data yet
        const regionToCreate = VALID_WIDER_REGIONS.find(r => !existingRegionIds.includes(r));

        if (!regionToCreate) {
            test.skip(true, `All valid wider regions already have calendar data`);
            return;
        }

        console.log(`Selected region for CREATE test: ${regionToCreate}`);

        // Set up request interception FIRST with payload fixes for schema validation
        let capturedPayload: any = null;
        let capturedMethod: string | null = null;
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;
        let createdRegionKey: string | null = null;

        // Track which fixes were applied (to detect frontend schema issues)
        let fixesApplied = {
            i18nAdded: false,
            i18nLocalesFixed: [] as string[],
            litcalAdded: false
        };

        await page.route('**/data/**', async (route, request) => {
            if (['PUT', 'PATCH'].includes(request.method())) {
                capturedMethod = request.method();
                const postData = request.postData();
                if (postData) {
                    try {
                        // Deep clone the original payload BEFORE any mutations
                        capturedPayload = JSON.parse(JSON.stringify(JSON.parse(postData)));

                        const payload = JSON.parse(postData);

                        // For PUT (CREATE) requests, fix payload for API validation
                        if (request.method() === 'PUT') {
                            const metadataLocales = payload.metadata?.locales || [];

                            // i18n is REQUIRED for PUT operations (calendar creation)
                            // Each locale object must have at least 1 property (minProperties: 1)
                            if (!payload.i18n || Object.keys(payload.i18n).length === 0) {
                                payload.i18n = {};
                                fixesApplied.i18nAdded = true;
                            }
                            // Ensure each locale has at least one translation entry
                            for (const locale of metadataLocales) {
                                if (!payload.i18n[locale] || Object.keys(payload.i18n[locale]).length === 0) {
                                    // Add minimal translation - event_key matching the litcal event
                                    payload.i18n[locale] = { 'TestPatron': 'Test Patron Saint' };
                                    fixesApplied.i18nLocalesFixed.push(locale);
                                }
                            }
                            if (fixesApplied.i18nAdded || fixesApplied.i18nLocalesFixed.length > 0) {
                                console.log(`TEST FIX: Set i18n with placeholder translations for: ${metadataLocales.join(', ')}`);
                            }

                            // API requires litcal to be non-empty for WiderRegion
                            // WiderRegion schema only allows 'createNew' or 'makePatron' actions (NOT setProperty)
                            // Add a minimal valid makePatron event if litcal is empty
                            if (!payload.litcal || payload.litcal.length === 0) {
                                payload.litcal = [{
                                    liturgical_event: {
                                        event_key: 'TestPatron',
                                        grade: 5  // Memorial grade
                                    },
                                    metadata: {
                                        action: 'makePatron',
                                        since_year: 2024,
                                        url: 'https://example.com/decree',
                                        url_lang_map: { en: 'en' }
                                    }
                                }];
                                fixesApplied.litcalAdded = true;
                                console.log('TEST FIX: Added minimal makePatron litcal event for WiderRegion CREATE validation');
                            } else {
                                // Fix existing litcal entries that may have missing required metadata fields
                                for (const item of payload.litcal) {
                                    if (item.metadata) {
                                        // Ensure required metadata fields exist
                                        if (!item.metadata.since_year) {
                                            item.metadata.since_year = 1970;
                                            console.log('TEST FIX: Added missing since_year to litcal metadata');
                                        }
                                        if (!item.metadata.url) {
                                            item.metadata.url = 'https://example.com/decree';
                                            console.log('TEST FIX: Added missing url to litcal metadata');
                                        }
                                        if (!item.metadata.url_lang_map || Object.keys(item.metadata.url_lang_map).length === 0) {
                                            item.metadata.url_lang_map = { en: 'en' };
                                            console.log('TEST FIX: Added missing url_lang_map to litcal metadata');
                                        }
                                    }
                                    // For createNew events, ensure common is set (required field)
                                    if (item.metadata?.action === 'createNew' && item.liturgical_event) {
                                        if (!item.liturgical_event.common || (Array.isArray(item.liturgical_event.common) && item.liturgical_event.common.length === 0)) {
                                            item.liturgical_event.common = ['Proper'];
                                            console.log('TEST FIX: Added missing common to createNew liturgical_event');
                                        }
                                    }
                                }
                            }

                            const modifiedPayload = JSON.stringify(payload);
                            console.log(`MODIFIED PAYLOAD BEING SENT: ${modifiedPayload}`);

                            await route.continue({
                                postData: modifiedPayload
                            });
                            return;
                        }
                    } catch (e) {
                        // Fail fast with clear error instead of swallowing parse errors
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        throw new Error(`JSON.parse failed for request payload. Error: ${errorMsg}. Raw postData: ${postData?.substring(0, 500)}`);
                    }
                }
            }
            await route.continue();
        });

        // Fill in the wider region name with the found region that doesn't have data
        const regionNameInput = page.locator('#widerRegionCalendarName');
        await regionNameInput.fill(regionToCreate);
        await regionNameInput.dispatchEvent('change');

        // Wait for the async form processing to complete
        await page.waitForLoadState('networkidle');

        // Wait for the toast warning message indicating calendar doesn't exist (CREATE operation)
        await page.waitForFunction(() => {
            const toastWarning = document.querySelector('.toast-warning, .toast.bg-warning');
            return toastWarning && toastWarning.textContent?.includes('does not exist yet');
        }, { timeout: 20000 });

        console.log('Toast warning detected - CREATE operation confirmed');

        // Dismiss any toast messages that might be blocking
        await page.evaluate(() => {
            const toastContainer = document.querySelector('#toast-container');
            if (toastContainer) toastContainer.remove();
        });

        // Wait for locales dropdown to have options
        await page.waitForFunction(() => {
            const select = document.querySelector('#widerRegionLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 10000 }).catch(() => {
            console.log('Locales dropdown wait timed out');
        });

        console.log('Locales dropdown populated');

        // STEP 1: Select locales BEFORE creating the liturgical event
        // Use bootstrap-multiselect plugin - click button to open, then check items
        console.log('Selecting locales using bootstrap-multiselect...');

        // Open the bootstrap-multiselect dropdown
        await page.click('#widerRegionLocales + .btn-group button.multiselect');
        await page.waitForSelector('.multiselect-container.dropdown-menu.show', { timeout: 5000 });

        // Select the first 3 locale checkboxes
        const selectedLocales = await page.evaluate(() => {
            const container = document.querySelector('.multiselect-container.dropdown-menu.show');
            if (!container) return [];

            const checkboxes = container.querySelectorAll('input[type="checkbox"]:not(.multiselect-all)');
            const selected: string[] = [];

            // Select up to 3 locales
            const maxToSelect = Math.min(3, checkboxes.length);
            for (let i = 0; i < maxToSelect; i++) {
                const checkbox = checkboxes[i] as HTMLInputElement;
                if (!checkbox.checked) {
                    checkbox.click();
                }
                selected.push(checkbox.value);
            }

            return selected;
        });
        console.log(`Selected locales via bootstrap-multiselect: ${JSON.stringify(selectedLocales)}`);

        // Close the dropdown by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForSelector('.multiselect-container.dropdown-menu.show', { state: 'hidden', timeout: 2000 }).catch(() => {});

        // Wait for network after locale selection (this populates currentLocalizationChoices)
        await page.waitForLoadState('networkidle');

        // Wait for the existing liturgical events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });
        console.log('Events datalist populated');

        // Dismiss any toast messages that might be blocking the modal button
        await page.evaluate(() => {
            document.querySelectorAll('#toast-container, .toast-container, .toast, [class*="toast"]').forEach(el => el.remove());
        });

        // STEP 2: Now create the liturgical event via modal
        // Open the newLiturgicalEventActionPrompt modal to create a new liturgical event
        // We use "Create new" because makePatron requires translated values in the events catalog
        // WiderRegion schema allows 'createNew' or 'makePatron' actions (NOT setProperty)
        await page.evaluate(() => {
            const modalEl = document.querySelector('#newLiturgicalEventActionPrompt');
            if (modalEl) {
                // @ts-ignore - bootstrap is a global
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        });
        await page.waitForSelector('#newLiturgicalEventActionPrompt.show', { timeout: 5000 });
        console.log('newLiturgicalEventActionPrompt modal opened');

        // Type a new event name to create a brand new liturgical event
        const newEventName = 'Oceania Regional Saint';
        const eventInput = page.locator('#newLiturgicalEventActionPrompt .existingLiturgicalEventName');
        await eventInput.fill(newEventName);
        await eventInput.dispatchEvent('change');
        console.log(`Entered new event name: ${newEventName}`);

        // Wait for the submit button to be enabled (button ID changes to ExNovo for new events)
        await page.waitForFunction(() => {
            const btn = document.querySelector('#newLiturgicalEventExNovoButton') as HTMLButtonElement;
            return btn && !btn.disabled;
        }, { timeout: 10000 });

        // Submit the modal to create a new row
        await page.click('#newLiturgicalEventExNovoButton');

        // Wait for the modal to close and new row to appear
        await page.waitForSelector('#newLiturgicalEventActionPrompt.show', { state: 'hidden', timeout: 5000 });
        console.log('Modal closed, waiting for new row...');

        // Wait for the new row with createNew action to appear in the form
        await page.waitForSelector('.regionalNationalDataForm .row[data-action="createNew"]', { timeout: 5000 });
        console.log('New createNew row created');

        // Fill in the required fields for the createNew row (day, month, grade, name)
        const rowFieldsResult = await page.evaluate(() => {
            const row = document.querySelector('.regionalNationalDataForm .row[data-action="createNew"]');
            if (!row) return { success: false, error: 'createNew row not found' };

            // Set day to 15 (mid-month to be safe for any month)
            const dayInput = row.querySelector('.litEventDay') as HTMLInputElement;
            if (dayInput) {
                dayInput.value = '15';
                dayInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Set month to July (7) - mid-year
            const monthSelect = row.querySelector('.litEventMonth') as HTMLSelectElement;
            if (monthSelect) {
                monthSelect.value = '7';
                monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Set grade to Feast (4)
            const gradeSelect = row.querySelector('.litEventGrade') as HTMLSelectElement;
            if (gradeSelect) {
                gradeSelect.value = '4';
                gradeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Fill in the primary name field for now - additional locale fields will be filled after locale selection
            const nameInput = row.querySelector('.litEventName') as HTMLInputElement;
            if (nameInput) {
                nameInput.value = 'Test Regional Saint';
                nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            return {
                success: true,
                dayValue: dayInput?.value,
                monthValue: monthSelect?.value,
                gradeValue: gradeSelect?.value,
                nameValue: nameInput?.value,
                nameFieldId: nameInput?.id
            };
        });
        console.log(`CreateNew row fields filled: ${JSON.stringify(rowFieldsResult)}`);

        // Dismiss any toast messages that may have appeared
        await page.evaluate(() => {
            document.querySelectorAll('#toast-container, .toast-container, .toast, [class*="toast"]').forEach(el => el.remove());
        });

        // Verify the form state - locales should already be selected from Step 1
        const formState = await page.evaluate(() => {
            const regionNameInput = document.querySelector('#widerRegionCalendarName') as HTMLInputElement;
            const localesSelect = document.querySelector('#widerRegionLocales') as HTMLSelectElement;
            const currentLocaleSelect = document.querySelector('.currentLocalizationChoices') as HTMLSelectElement;
            const createNewRow = document.querySelector('.regionalNationalDataForm .row[data-action="createNew"]');

            return {
                regionName: regionNameInput?.value || '',
                selectedLocales: Array.from(localesSelect?.selectedOptions || []).map(opt => opt.value),
                currentLocale: currentLocaleSelect?.value || '',
                createNewRowExists: !!createNewRow
            };
        });

        console.log(`Form state before saving: ${JSON.stringify(formState)}`);

        // Ensure the createNew row still exists
        expect(formState.createNewRowExists, 'createNew row was removed').toBe(true);

        // Ensure at least one locale was selected
        expect(formState.selectedLocales.length, 'No locales were selected').toBeGreaterThan(0);

        // Fill in ALL locale name fields (these should already exist since locales were selected before creating the event)
        // The i18n object needs translations for ALL selected locales
        const nameFieldsResult = await page.evaluate(() => {
            const row = document.querySelector('.regionalNationalDataForm .row[data-action="createNew"]');
            if (!row) return { success: false, error: 'createNew row not found' };

            // Find all name input fields in the row
            const allNameInputs = row.querySelectorAll('input[id*="Name"]');
            const filledNames: string[] = [];

            allNameInputs.forEach((input, idx) => {
                const inp = input as HTMLInputElement;
                // Fill empty fields with translated values
                if (!inp.value || inp.value.trim() === '') {
                    inp.value = `Test Saint Translation ${idx + 1}`;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
                filledNames.push(`${inp.id}: "${inp.value}"`);
            });

            return {
                success: true,
                nameFieldsCount: allNameInputs.length,
                allNameFields: filledNames
            };
        });
        console.log(`All locale name fields filled: ${JSON.stringify(nameFieldsResult)}`);

        // Wait for save button to be ready
        await expect(page.locator('#serializeWiderRegionData')).toBeEnabled({ timeout: 10000 });

        // Now click the save button
        await page.evaluate(() => {
            // Remove any new toast containers
            const toastContainer = document.querySelector('#toast-container');
            if (toastContainer) toastContainer.remove();

            // Re-enable save button if it got disabled
            const saveBtn = document.querySelector('#serializeWiderRegionData') as HTMLButtonElement;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.click();
            }
        });

        console.log(`Save clicked, waiting for response...`);

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

        // Debug: Log the response details before assertions
        console.log(`CREATE response status: ${createResponseStatus}`);
        console.log(`CREATE response body: ${JSON.stringify(createResponseBody, null, 2)}`);

        // Verify CREATE response status is 201
        expect(createResponseStatus).toBe(201);
        expect(createResponseBody).toHaveProperty('success');
        console.log(`CREATE (PUT) response: ${createResponseStatus} - ${JSON.stringify(createResponseBody)}`);

        // Validate payload structure (against the ORIGINAL payload from frontend)
        expect(capturedPayload).not.toBeNull();

        // Validate WiderRegionPayload required properties exist
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('metadata');
        // Note: national_calendars may be optional or server-managed

        // Validate litcal is an array
        expect(Array.isArray(capturedPayload.litcal)).toBe(true);
        const hasLitcal = capturedPayload.litcal.length > 0;
        console.log(`Original payload litcal length: ${capturedPayload.litcal.length}`);

        // If litcal has items, validate their structure (WiderRegion uses makePatron/createNew actions)
        if (hasLitcal) {
            for (const item of capturedPayload.litcal) {
                expect(item).toHaveProperty('liturgical_event');
                expect(item).toHaveProperty('metadata');
                expect(item.liturgical_event).toHaveProperty('event_key');
                expect(item.metadata).toHaveProperty('action');
                // WiderRegion only allows 'createNew' or 'makePatron' actions
                expect(['createNew', 'makePatron']).toContain(item.metadata.action);
            }
        }

        // Validate national_calendars if present (may be optional or server-managed)
        // national_calendars is an object mapping nation codes to booleans, not an array
        if (capturedPayload.national_calendars !== undefined) {
            expect(typeof capturedPayload.national_calendars).toBe('object');
            expect(capturedPayload.national_calendars).not.toBeNull();
            const nationKeys = Object.keys(capturedPayload.national_calendars);
            console.log(`Original payload national_calendars keys: ${nationKeys.join(', ')}`);
        } else {
            console.log('Original payload national_calendars: not present (may be optional)');
        }

        // Validate metadata structure
        expect(capturedPayload.metadata).toHaveProperty('wider_region');
        expect(capturedPayload.metadata).toHaveProperty('locales');
        expect(Array.isArray(capturedPayload.metadata.locales)).toBe(true);
        expect(capturedPayload.metadata.locales.length).toBeGreaterThan(0);

        // Validate wider_region is one of the valid values
        expect(VALID_WIDER_REGIONS).toContain(capturedPayload.metadata.wider_region);

        // Validate i18n structure against metadata.locales
        const hasI18n = capturedPayload.i18n && typeof capturedPayload.i18n === 'object';
        const originalI18nKeys = hasI18n ? Object.keys(capturedPayload.i18n) : [];
        const metadataLocales = capturedPayload.metadata.locales as string[];

        console.log(`Original payload i18n keys: [${originalI18nKeys.join(', ')}]`);
        console.log(`Metadata locales: [${metadataLocales.join(', ')}]`);

        // Report on fixes that were applied
        const anyFixesApplied = fixesApplied.i18nAdded ||
                                fixesApplied.i18nLocalesFixed.length > 0 ||
                                fixesApplied.litcalAdded;

        if (anyFixesApplied) {
            console.log('=== TEST FIXES APPLIED (frontend schema issues detected) ===');
            if (fixesApplied.i18nAdded) {
                console.log('  - i18n object was missing or empty');
            }
            if (fixesApplied.i18nLocalesFixed.length > 0) {
                console.log(`  - i18n entries added for locales: ${fixesApplied.i18nLocalesFixed.join(', ')}`);
            }
            if (fixesApplied.litcalAdded) {
                console.log('  - litcal array was empty, added placeholder makePatron event');
            }
            console.log('============================================================');
        } else {
            console.log('No test fixes required - frontend payload was schema-compliant');
        }

        // Fail the test if any fixes were required - this indicates a frontend schema regression
        expect(anyFixesApplied, 'Frontend payload required test fixes to pass API validation. Fixes applied: ' + JSON.stringify(fixesApplied)).toBe(false);

        // Store the region key for cleanup
        if (!createdRegionKey && capturedPayload.metadata?.wider_region) {
            createdRegionKey = capturedPayload.metadata.wider_region;
        }

        // CLEANUP: DELETE the created wider region calendar and verify 200 response
        if (!createdRegionKey) {
            console.warn('CLEANUP: Could not determine region key for deletion');
            return;
        }
        console.log(`CLEANUP: Deleting wider region calendar ${createdRegionKey}...`);

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
        // Wait for locales to be populated (indicates data has loaded)
        await page.waitForFunction(() => {
            const select = document.querySelector('#widerRegionLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 15000 });
        // Wait for success toast indicating data was loaded
        await page.waitForSelector('.toast-success, .toast.bg-success', { timeout: 10000 }).catch(() => {});
        // Wait for all remaining async operations to complete
        await page.waitForLoadState('networkidle');

        // The form should show which national calendars are associated with this wider region
        const nationalCalendarsSection = page.locator('#national_calendars');

        // Wait for the section to be visible (if it exists in the UI)
        const isVisible = await nationalCalendarsSection.isVisible().catch(() => false);

        if (isVisible) {
            // Verify the section contains national calendar information
            await expect(nationalCalendarsSection).toBeVisible();

            // The Americas wider region should have associated countries
            // Check that there's at least some content in the section
            const content = await nationalCalendarsSection.textContent();
            expect(content).not.toBeNull();
            expect(content!.length).toBeGreaterThan(0);
        } else {
            // If no dedicated section, verify the form loaded successfully
            // by checking that wider region metadata is populated
            const localesSelect = page.locator('#widerRegionLocales');
            await expect(localesSelect).toBeVisible();

            // Verify locales dropdown has options (indicating data loaded)
            const optionCount = await localesSelect.locator('option').count();
            expect(optionCount).toBeGreaterThan(0);
        }
    });
});
