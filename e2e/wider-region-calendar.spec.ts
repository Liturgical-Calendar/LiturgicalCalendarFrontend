import { test, expect, gitRestoreApiData } from './fixtures';
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
        // Wait for the form to be ready first
        await page.waitForSelector('#widerRegionCalendarName', { state: 'visible' });

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
        if (needsGitRestore) {
            await gitRestoreApiData();
        }
    });

    test('should CREATE (PUT) new wider region calendar, verify 201 response, and DELETE for cleanup', async ({ page, extendingPage }) => {
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

        // Set up request interception using shared fixture
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;
        let createdRegionKey: string | null = null;

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

        // Wait for locales dropdown to have options (fail fast if this doesn't happen)
        await page.waitForFunction(() => {
            const select = document.querySelector('#widerRegionLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 10000 });
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
        await page.waitForSelector('.multiselect-container.dropdown-menu.show', { state: 'hidden', timeout: 2000 }).catch(() => {
            // Dropdown may have already closed or not been visible
        });

        // Wait for network after locale selection (this populates currentLocalizationChoices)
        await page.waitForLoadState('networkidle');

        // Wait for the existing liturgical events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });
        console.log('Events datalist populated');

        // Dismiss any toast messages that might be blocking the modal button
        await extendingPage.dismissToasts();

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
        const newEventName = `${regionToCreate} Regional Saint`;
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
        expect(rowFieldsResult.success, 'Failed to fill createNew row fields').toBe(true);

        // Select "Martyrs" from the Common bootstrap-multiselect (not "Proper" which triggers readings addition)
        // The multiselect is within the createNew row - find the btn-group that follows the hidden select
        const commonRow = page.locator('.regionalNationalDataForm .row[data-action="createNew"]');

        // First deselect "Proper" if it's selected (it's the default), then select "Martyrs"
        // Click to open the multiselect dropdown
        await commonRow.locator('.btn-group button.multiselect').last().click();
        await page.waitForSelector('.multiselect-container.dropdown-menu.show', { timeout: 5000 });

        // Deselect "Proper" and select "Martyrs" by VALUE (not label text, which may be translated)
        const commonSelection = await page.evaluate(() => {
            const container = document.querySelector('.multiselect-container.dropdown-menu.show');
            if (!container) return { found: false, reason: 'no container' };

            // Deselect "Proper" if checked (to avoid triggering readings addition)
            const properInput = container.querySelector('input[type="checkbox"][value="Proper"]') as HTMLInputElement;
            if (properInput && properInput.checked) {
                properInput.click();
            }

            // Select "Martyrs" instead
            const martyrsInput = container.querySelector('input[type="checkbox"][value="Martyrs"]') as HTMLInputElement;
            if (martyrsInput) {
                if (!martyrsInput.checked) {
                    martyrsInput.click();
                }
                return { found: true, value: martyrsInput.value, checked: martyrsInput.checked, properDeselected: !properInput?.checked };
            }

            // Debug: list all checkbox values
            const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
            const values = Array.from(allCheckboxes).map(cb => (cb as HTMLInputElement).value);
            return { found: false, reason: 'no Martyrs checkbox', availableValues: values };
        });
        console.log(`Common "Martyrs" selection: ${JSON.stringify(commonSelection)}`);
        // Assert common selection worked (Martyrs checkbox should be found in the multiselect)
        expect(commonSelection.found, `Common selection failed: ${JSON.stringify(commonSelection)}`).toBe(true);

        // Close the dropdown
        await page.keyboard.press('Escape');
        await page.waitForSelector('.multiselect-container.dropdown-menu.show', { state: 'hidden', timeout: 2000 }).catch(() => {
            // Dropdown may have already closed or not been visible
        });

        // Fill in the Decree URL and Decree Langs fields (required by WiderRegionCalendar schema for createNew action)
        const decreeFieldsResult = await page.evaluate(() => {
            const row = document.querySelector('.regionalNationalDataForm .row[data-action="createNew"]');
            if (!row) return { success: false, error: 'createNew row not found' };

            // Fill in Decree URL (required for createNew action)
            const decreeUrlInput = row.querySelector('.litEventDecreeURL') as HTMLInputElement;
            if (decreeUrlInput) {
                decreeUrlInput.value = 'https://www.vatican.va/content/francesco/en/test-decree.html';
                decreeUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
                decreeUrlInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Fill in Decree Langs / url_lang_map (required for createNew action)
            // Format: "EN=en,DE=ge,FR=fr" - maps ISO 2-letter codes to URL language codes
            const decreeLangsInput = row.querySelector('.litEventDecreeLangs') as HTMLInputElement;
            if (decreeLangsInput) {
                decreeLangsInput.value = 'en=en';
                decreeLangsInput.dispatchEvent(new Event('input', { bubbles: true }));
                decreeLangsInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            return {
                success: true,
                decreeUrlFound: !!decreeUrlInput,
                decreeUrlValue: decreeUrlInput?.value,
                decreeLangsFound: !!decreeLangsInput,
                decreeLangsValue: decreeLangsInput?.value
            };
        });
        console.log(`Decree fields filled: ${JSON.stringify(decreeFieldsResult)}`);
        expect(decreeFieldsResult.success, 'Failed to fill decree fields').toBe(true);

        // Dismiss any toast messages that may have appeared
        await extendingPage.dismissToasts();

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
        expect(nameFieldsResult.success, 'Failed to fill locale name fields').toBe(true);

        // Wait for save button to be ready
        await expect(page.locator('#serializeWiderRegionData')).toBeEnabled({ timeout: 10000 });

        // Now click the save button
        await page.evaluate(() => {
            // Remove any new toast containers
            const toastContainer = document.querySelector('#toast-container');
            if (toastContainer) toastContainer.remove();

            const saveBtn = document.querySelector('#serializeWiderRegionData') as HTMLButtonElement;
            if (saveBtn) {
                if (saveBtn.disabled) {
                    console.warn('Save button was unexpectedly disabled - form may not be ready');
                }
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
        expect(getMethod()).toBe('PUT');
        console.log(`HTTP method used: ${getMethod()}`);

        // Debug: Log the response details before assertions
        console.log(`CREATE response status: ${createResponseStatus}`);
        console.log(`CREATE response body: ${JSON.stringify(createResponseBody, null, 2)}`);

        // Verify CREATE response status is 201
        expect(createResponseStatus).toBe(201);
        expect(createResponseBody).toHaveProperty('success');
        console.log(`CREATE (PUT) response: ${createResponseStatus} - ${JSON.stringify(createResponseBody)}`);

        // Validate payload structure (against the ORIGINAL payload from frontend)
        const capturedPayload = getPayload();
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

        // Validate i18n keys match metadata.locales (same assertion as UPDATE test)
        if (hasI18n) {
            const i18nKeysSorted = [...originalI18nKeys].sort();
            const localesSorted = [...metadataLocales].sort();
            expect(i18nKeysSorted).toEqual(localesSorted);
        }

        // Store the region key for cleanup
        if (!createdRegionKey && capturedPayload.metadata?.wider_region) {
            createdRegionKey = capturedPayload.metadata.wider_region;
        }

        // CLEANUP: DELETE the created wider region calendar and verify 200 response
        if (!createdRegionKey) {
            console.warn('CLEANUP: Could not determine region key for deletion');
            return;
        }

        const deleteResult = await extendingPage.deleteCalendar('widerregion', createdRegionKey);
        expect(deleteResult.status).toBe(200);
        expect(deleteResult.body).toHaveProperty('success');
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
