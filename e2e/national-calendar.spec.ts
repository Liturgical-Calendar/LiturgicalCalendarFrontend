import { test, expect, gitRestoreApiData } from './fixtures';
import { VALID_WIDER_REGIONS } from './constants';

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
        // Wait for form to be ready
        await page.waitForSelector('#nationalCalendarName', { state: 'visible' });

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

        // Wait for settings form to be populated (indicates data has loaded)
        const epiphanySetting = page.locator('#nationalCalendarSettingEpiphany');
        await expect(epiphanySetting).toBeVisible({ timeout: 10000 });
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
        // Wait for save button to be enabled (indicates data has loaded)
        await expect(page.locator('#serializeNationalCalendarData')).toBeEnabled({ timeout: 10000 });

        // Dismiss any toast messages that might be blocking
        await page.locator('.toast-container, #toast-container').evaluate(el => el?.remove()).catch(() => {});

        // Track if we made changes that need to be reverted
        let needsGitRestore = false;

        // Set up request interception to capture the payload and method
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let responseStatus: number | null = null;
        let responseBody: any = null;

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
            expect(VALID_WIDER_REGIONS).toContain(capturedPayload.metadata.wider_region);

            // Validate missals is an array
            expect(Array.isArray(capturedPayload.metadata.missals)).toBe(true);

            // Validate i18n has keys matching locales
            const i18nKeys = Object.keys(capturedPayload.i18n).sort();
            const localesSorted = [...capturedPayload.metadata.locales].sort();
            expect(i18nKeys).toEqual(localesSorted);
        } finally {
            // CLEANUP: Revert changes using git restore AND git clean in the API folder
            if (needsGitRestore) {
                await gitRestoreApiData();
            }
        }
    });

    test('should CREATE (PUT) new national calendar, verify 201 response, and DELETE for cleanup', async ({ page, extendingPage }) => {
        // This test creates a NEW national calendar using PUT for a nation that exists
        // in the datalist but doesn't have calendar data yet. Then it DELETEs to clean up.

        // Query the /calendars API to get existing national calendar IDs
        const apiBaseUrl = await page.evaluate(() => {
            // @ts-ignore - BaseUrl is a global variable set by the frontend
            return typeof BaseUrl !== 'undefined' ? BaseUrl : 'http://localhost:8000';
        });

        const calendarsResponse = await page.request.get(`${apiBaseUrl}/calendars`);
        const calendarsData = await calendarsResponse.json();
        const existingNationIds: string[] = calendarsData.litcal_metadata?.national_calendars?.map(
            (cal: { calendar_id: string }) => cal.calendar_id
        ) || [];
        console.log(`Found ${existingNationIds.length} existing national calendars: ${existingNationIds.join(', ')}`);

        // Get all nation options from the datalist and find one without calendar data
        // The datalist has <option value="ISO_CODE">Country Name</option>
        const availableNations = await page.evaluate(() => {
            const datalist = document.querySelector('#nationalCalendarsList');
            if (!datalist) return [];
            return Array.from(datalist.querySelectorAll('option[value]')).map(opt => ({
                name: opt.textContent || opt.getAttribute('value') || '',
                key: opt.getAttribute('value') || ''
            }));
        });

        console.log(`Found ${availableNations.length} nations in datalist`);

        // Find a nation that's in the datalist but NOT in existing calendars
        const nationToCreate = availableNations.find(n => !existingNationIds.includes(n.key));

        if (!nationToCreate) {
            test.skip(true, `All ${availableNations.length} nations already have calendar data`);
            return;
        }

        console.log(`Selected nation for CREATE test: ${nationToCreate.name} (${nationToCreate.key})`);

        // Set up request interception to capture the payload using shared fixture
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let createResponseStatus: number | null = null;
        let createResponseBody: any = null;

        // Capture console logs and errors for debugging
        page.on('console', msg => console.log(`Browser console [${msg.type()}]: ${msg.text()}`));
        page.on('pageerror', err => console.log(`Browser error: ${err.message}`));

        // Fill in the national calendar input with the ISO code from the found nation
        const calendarNameInput = page.locator('#nationalCalendarName');
        await calendarNameInput.fill(nationToCreate.key);
        await calendarNameInput.dispatchEvent('change');

        // Wait for the async form processing to complete
        // The form fetches events, then checks if calendar exists, and shows a toast warning
        await page.waitForLoadState('networkidle');

        // Wait for the toast with data-toast-type="calendar-not-found" indicating CREATE operation
        // Using data attribute is more robust than text matching (works regardless of locale)
        await page.waitForSelector('[data-toast-type="calendar-not-found"]', { timeout: 20000 });

        console.log('Toast warning detected - CREATE operation confirmed');

        // Dismiss any toastr toast messages first to prevent blocking
        await page.evaluate(() => {
            const toastContainer = document.querySelector('#toast-container');
            if (toastContainer) {
                toastContainer.remove();
            }
        });

        console.log('Toast dismissed, waiting for locales dropdown...');

        // Wait for locales dropdown to have options
        await page.waitForFunction(() => {
            const select = document.querySelector('#nationalCalendarLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 10000 }).catch(() => {
            console.log('Locales dropdown wait timed out');
        });

        // Check available options
        const localeOptions = await page.evaluate(() => {
            const select = document.querySelector('#nationalCalendarLocales') as HTMLSelectElement;
            return select ? Array.from(select.options).map(o => o.value) : [];
        });
        console.log(`Available locales: ${JSON.stringify(localeOptions)}`);

        // Leave all locales selected (don't modify the bootstrap-multiselect)
        // The form should serialize i18n for all selected locales
        const selectedLocales = await page.evaluate(() => {
            const selectEl = document.querySelector('#nationalCalendarLocales') as HTMLSelectElement;
            if (!selectEl) return [];
            return Array.from(selectEl.selectedOptions).map(opt => opt.value);
        });
        console.log(`Locales currently selected: ${JSON.stringify(selectedLocales)}`);

        // Wait for ALL network activity to complete before proceeding
        // This ensures the async fetchRegionCalendarData and all related requests are done
        console.log('Waiting for network idle...');
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.warn('Network idle timeout after 30s - continuing, but this may indicate slow API or network issues');
        });

        // Wait for save button to be attached (indicates form is ready)
        await expect(page.locator('#serializeNationalCalendarData')).toBeAttached({ timeout: 10000 });

        // Dismiss any toast messages
        await extendingPage.dismissToasts();

        console.log('Network idle, now adding a liturgical event via action prompt modal...');

        // Wait for the existing liturgical events datalist to be populated
        // This is required for the setProperty action to work
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });
        console.log('Events datalist populated');

        // Dismiss any toast messages that might be blocking the modal button
        await extendingPage.dismissToasts();

        // Open the newLiturgicalEventActionPrompt modal to create a new liturgical event
        // We use "Create new" instead of "setProperty" because setProperty requires
        // translated values to be available in the events catalog
        const modalOpened = await page.evaluate(() => {
            const modalEl = document.querySelector('#newLiturgicalEventActionPrompt');
            if (!modalEl) {
                console.error('Modal element #newLiturgicalEventActionPrompt not found in DOM');
                return false;
            }
            // @ts-ignore - bootstrap is a global
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            return true;
        });
        if (!modalOpened) {
            console.log('Modal element not found');
        }
        await page.waitForSelector('#newLiturgicalEventActionPrompt.show', { timeout: 5000 });
        console.log('newLiturgicalEventActionPrompt modal opened');

        // Type a new event name to create a brand new liturgical event
        // The input is not required, so typing any name will enable the button
        const newEventName = 'Test National Saint';
        const eventInput = page.locator('#newLiturgicalEventActionPrompt .existingLiturgicalEventName');
        await eventInput.fill(newEventName);
        await eventInput.dispatchEvent('change');
        console.log(`Entered new event name: ${newEventName}`);

        // Wait for either submit button to be enabled
        // Note: The button ID changes dynamically based on whether the event exists:
        // - newLiturgicalEventFromExistingButton: if event exists in list
        // - newLiturgicalEventExNovoButton: if creating a brand new event
        await page.waitForFunction(() => {
            const exNovo = document.querySelector('#newLiturgicalEventExNovoButton') as HTMLButtonElement | null;
            const existing = document.querySelector('#newLiturgicalEventFromExistingButton') as HTMLButtonElement | null;
            return (exNovo && !exNovo.disabled) || (existing && !existing.disabled);
        }, { timeout: 10000 });

        // Click whichever button is enabled
        const exNovoEnabled = await page.evaluate(() => {
            const btn = document.querySelector('#newLiturgicalEventExNovoButton') as HTMLButtonElement | null;
            return btn && !btn.disabled;
        });
        const submitSelector = exNovoEnabled
            ? '#newLiturgicalEventExNovoButton'
            : '#newLiturgicalEventFromExistingButton';
        await page.click(submitSelector);

        // Wait for the modal to close and new row to appear
        await page.waitForSelector('#newLiturgicalEventActionPrompt.show', { state: 'hidden', timeout: 5000 });
        console.log('Modal closed, waiting for new row...');

        // Wait for the new row with createNew action to appear in the form
        await page.waitForSelector('.regionalNationalDataForm .row[data-action="createNew"]', { timeout: 5000 });
        console.log('New createNew row created');

        // Fill in the required fields for the createNew row
        // The form requires: event_key, name, color, grade, day, month, common
        await page.evaluate(() => {
            const row = document.querySelector('.regionalNationalDataForm .row[data-action="createNew"]');
            if (!row) return;

            // Set day to 15 (mid-month to be safe for any month)
            const dayInput = row.querySelector('.litEventDay') as HTMLInputElement;
            if (dayInput) {
                dayInput.value = '15';
                dayInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Set month to June (6)
            const monthSelect = row.querySelector('.litEventMonth') as HTMLSelectElement;
            if (monthSelect) {
                monthSelect.value = '6';
                monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Set grade to Memorial (3)
            const gradeSelect = row.querySelector('.litEventGrade') as HTMLSelectElement;
            if (gradeSelect) {
                gradeSelect.value = '3';
                gradeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        console.log('CreateNew row fields filled (day, month, grade)');

        // Dismiss any toast messages that may have appeared
        await extendingPage.dismissToasts();

        console.log('Now setting form values and clicking save...');

        // Set form fields (locale already selected via bootstrap-multiselect before creating event)
        const formValuesSet = await page.evaluate(() => {
            // Remove any toast containers that might block
            const toastContainer = document.querySelector('#toast-container');
            if (toastContainer) toastContainer.remove();

            // Set wider region dynamically from available options
            const widerRegionInput = document.querySelector('#associatedWiderRegion') as HTMLInputElement;
            if (widerRegionInput) {
                // Use the first available option from the datalist or keep existing value
                const datalist = document.querySelector('#WiderRegionsList') as HTMLDataListElement;
                const firstOption = datalist?.querySelector('option')?.getAttribute('value');
                widerRegionInput.value = firstOption || widerRegionInput.value || 'Americas';
                widerRegionInput.dispatchEvent(new Event('input', { bubbles: true }));
                widerRegionInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Log selected locales (leave all selected, don't modify)
            const localesSelect = document.querySelector('#nationalCalendarLocales') as HTMLSelectElement;
            const selectedLocales = localesSelect
                ? Array.from(localesSelect.selectedOptions).map(opt => opt.value)
                : [];
            console.log(`Selected locales at save time: ${JSON.stringify(selectedLocales)}`);

            // Log the current localization select value
            const currentLocaleSelect = document.querySelector('.currentLocalizationChoices') as HTMLSelectElement;
            console.log(`Current localization: ${currentLocaleSelect?.value || 'none'}`);

            // Set settings - get specific values from options
            const epiphanyEl = document.querySelector('#nationalCalendarSettingEpiphany') as HTMLSelectElement;
            const ascensionEl = document.querySelector('#nationalCalendarSettingAscension') as HTMLSelectElement;
            const corpusChristiEl = document.querySelector('#nationalCalendarSettingCorpusChristi') as HTMLSelectElement;

            if (epiphanyEl && epiphanyEl.options.length > 1) {
                epiphanyEl.value = epiphanyEl.options[1].value;
                epiphanyEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (ascensionEl && ascensionEl.options.length > 1) {
                ascensionEl.value = ascensionEl.options[1].value;
                ascensionEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (corpusChristiEl && corpusChristiEl.options.length > 1) {
                corpusChristiEl.value = corpusChristiEl.options[1].value;
                corpusChristiEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Enable save button
            const saveBtn = document.querySelector('.serializeRegionalNationalData') as HTMLButtonElement;
            if (saveBtn) {
                saveBtn.disabled = false;
            }

            // Get values BEFORE clicking (for logging)
            const values = {
                widerRegion: widerRegionInput?.value || '',
                selectedLocales: selectedLocales,
                currentLocale: currentLocaleSelect?.value || '',
                epiphany: epiphanyEl?.value || '',
                ascension: ascensionEl?.value || '',
                corpusChristi: corpusChristiEl?.value || ''
            };

            // Click the save button immediately - synchronously in the same JS execution
            if (saveBtn) {
                saveBtn.click();
            }

            return values;
        });

        console.log(`Form values set and save clicked: ${JSON.stringify(formValuesSet)}`);

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

        // Debug: Log the actual payload sent and response received
        console.log(`DEBUG - Captured payload: ${JSON.stringify(getPayload(), null, 2)}`);
        console.log(`DEBUG - Response status: ${createResponseStatus}`);
        console.log(`DEBUG - Response body: ${JSON.stringify(createResponseBody, null, 2)}`);

        // Verify the HTTP method is PUT (CREATE)
        expect(getMethod()).toBe('PUT');
        console.log(`HTTP method used: ${getMethod()}`);

        // Verify CREATE response status is 201
        expect(createResponseStatus).toBe(201);
        expect(createResponseBody).toHaveProperty('success');
        console.log(`CREATE (PUT) response: ${createResponseStatus}`);

        // Validate payload structure (against the ORIGINAL payload from frontend)
        const capturedPayload = getPayload();
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload).toHaveProperty('litcal');
        expect(capturedPayload).toHaveProperty('settings');
        expect(capturedPayload).toHaveProperty('metadata');

        // Validate metadata structure
        expect(capturedPayload.metadata).toHaveProperty('nation');
        expect(capturedPayload.metadata).toHaveProperty('locales');
        expect(Array.isArray(capturedPayload.metadata.locales)).toBe(true);
        expect(capturedPayload.metadata.locales.length).toBeGreaterThan(0);

        // Validate i18n structure against metadata.locales
        // The original payload should have i18n with keys for each locale
        const hasI18n = capturedPayload.i18n && typeof capturedPayload.i18n === 'object';
        const originalI18nKeys = hasI18n ? Object.keys(capturedPayload.i18n) : [];
        const metadataLocales = capturedPayload.metadata.locales as string[];

        // Log i18n state from original payload
        console.log(`Original payload i18n keys: [${originalI18nKeys.join(', ')}]`);
        console.log(`Metadata locales: [${metadataLocales.join(', ')}]`);

        // Validate i18n keys match metadata.locales for CREATE
        if (hasI18n) {
            const i18nKeysSorted = [...originalI18nKeys].sort();
            const localesSorted = [...metadataLocales].sort();
            expect(i18nKeysSorted).toEqual(localesSorted);
        }

        // Validate litcal structure from original payload
        const hasLitcal = Array.isArray(capturedPayload.litcal);
        const originalLitcalLength = hasLitcal ? capturedPayload.litcal.length : 0;
        console.log(`Original payload litcal length: ${originalLitcalLength}`);

        // If litcal has items, validate their structure
        if (originalLitcalLength > 0) {
            for (const item of capturedPayload.litcal) {
                expect(item).toHaveProperty('liturgical_event');
                expect(item).toHaveProperty('metadata');
                expect(item.liturgical_event).toHaveProperty('event_key');
                expect(item.metadata).toHaveProperty('action');
            }
        }

        // CLEANUP: DELETE the created national calendar and verify 200 response
        const deleteResult = await extendingPage.deleteCalendar('nation', nationToCreate.key);
        expect(deleteResult.status).toBe(200);
        expect(deleteResult.body).toHaveProperty('success');
    });

    test('should validate locale selection', async ({ page }) => {
        // Wait for form to load
        await page.waitForLoadState('networkidle');
        // The locale select should be a multi-select
        const localesSelect = page.locator('#nationalCalendarLocales');
        await expect(localesSelect).toBeVisible({ timeout: 10000 });
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
        // Wait for save button to be enabled (indicates data has loaded)
        await expect(page.locator('#serializeNationalCalendarData')).toBeEnabled({ timeout: 10000 });

        // Find any grade select in the form
        const gradeSelects = page.locator('#nationalCalendarForm select[name*="grade"]');
        const count = await gradeSelects.count();

        if (count > 0) {
            // Get all option values from the first grade select
            const optionValues = await gradeSelects.first().locator('option').evaluateAll(
                options => options.map(opt => (opt as HTMLOptionElement).value)
            );

            // Verify there is at least one option
            expect(optionValues.length).toBeGreaterThan(0);
            // Verify there are at most 8 options (grades 0-7)
            expect(optionValues.length).toBeLessThanOrEqual(8);

            // Verify all option values are valid grade numbers (0-7)
            const validGrades = ['0', '1', '2', '3', '4', '5', '6', '7'];
            for (const value of optionValues) {
                // Skip empty option if present
                if (value === '') continue;
                expect(validGrades).toContain(value);
            }
        }
    });
});
