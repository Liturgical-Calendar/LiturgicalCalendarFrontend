import { test, expect, gitRestoreApiData } from './fixtures';
import { expectApplied } from './support/writeMode';

/**
 * Tests for the National Calendar form on extending.php
 *
 * These tests verify that:
 * 1. The form can be loaded and populated correctly
 * 2. Form validation works as expected
 * 3. The payload structure matches the API contract (NationalCalendarPayload)
 * 4. CREATE (PUT) requests return 201 and can be cleaned up with DELETE (200)
 * 5. UPDATE (PATCH) requests return 200 and changes are reverted with git restore
 *
 * DISK MODE ONLY — see the header of diocesan-calendar.spec.ts. Each write asserts
 * its `disposition` as well as its status, so a queue-mode stack cannot turn these
 * green without anything being written (issue #502).
 */

const API_BASE_URL = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

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

    test('should UPDATE (PATCH) existing national calendar and verify 200 response', async ({ page, extendingPage }) => {
        // Load an existing calendar (UPDATE scenario - should use PATCH)
        // The datalist uses ISO country codes as values (e.g., "US" not "USA")
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');
        // Wait for save button to be enabled (indicates data has loaded)
        await expect(page.locator('#serializeNationalCalendarData')).toBeEnabled({ timeout: 10000 });

        // Dismiss any toast messages that might be blocking
        await extendingPage.dismissToasts();

        // Track if we made changes that need to be reverted
        let needsGitRestore = false;

        // Set up request interception to capture the payload and method
        const { getPayload, getMethod } = await extendingPage.interceptDataRequests();
        let responseStatus: number | null = null;
        let responseBody: any = null;

        // Wait for the save button to be enabled (form must be fully loaded)
        const saveButton = page.locator('#serializeNationalCalendarData');
        await expect(saveButton).toBeEnabled({ timeout: 15000 });

        // Dismiss any toast notifications that might be blocking the button
        await extendingPage.dismissToasts();

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
            // Any 2xx means the API accepted the write, so something may need restoring. Pinning this
            // to one exact status defeats the try/finally below: a run against an API that answers a
            // different 2xx (a deploy where API #913 has not landed yet still answers 201) writes to
            // the source data, fails the assertion, and then restores nothing.
            needsGitRestore = response.ok();
        } catch (e) {
            console.log('No PUT/PATCH response received:', e);
        }

        // Wrap assertions in try/finally to ensure cleanup runs even if assertions fail
        try {
            // Verify the HTTP method is PATCH (UPDATE)
            expect(getMethod()).toBe('PATCH');
            console.log(`HTTP method used: ${getMethod()}`);

            // Verify response status is 200 — PATCH updates an existing calendar (API #913).
            // PUT, which creates, still answers 201; see the CREATE test below.
            expect(responseStatus).toBe(200);
            expect(responseBody).toHaveProperty('success');
            // ...and that it LANDED. `success` is emitted in queue mode too, where the write is
            // only a change request and gitRestoreApiData() has nothing to revert (issue #502).
            expectApplied(responseBody, 'PATCH /data/ (national UPDATE)');
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

            // The API writes the calendar file wholesale, so a setting missing from
            // the payload is deleted. US stores its holy days of obligation: the save
            // must carry them, exactly as stored, since nothing here changed them.
            const stored = await (await page.request.get(`${API_BASE_URL}/data/nation/US?locale=en_US`)).json();
            expect(stored.settings.holydays_of_obligation).toBeDefined();
            expect(capturedPayload.settings.holydays_of_obligation).toEqual(stored.settings.holydays_of_obligation);

            // Validate metadata structure
            expect(capturedPayload.metadata).toHaveProperty('nation');
            expect(capturedPayload.metadata).toHaveProperty('locales');
            expect(capturedPayload.metadata).toHaveProperty('wider_regions');
            expect(capturedPayload.metadata).not.toHaveProperty('wider_region');
            expect(capturedPayload.metadata).toHaveProperty('missals');

            // Validate nation is a 2-letter ISO code
            expect(capturedPayload.metadata.nation).toMatch(/^[A-Z]{2}$/);

            // Validate locales is a non-empty array
            expect(Array.isArray(capturedPayload.metadata.locales)).toBe(true);
            expect(capturedPayload.metadata.locales.length).toBeGreaterThan(0);

            // The save carries the calendar's stored regions, unchanged: nothing here edits them.
            expect(capturedPayload.metadata.wider_regions).toEqual(stored.metadata.wider_regions);

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

        // Fill in the national calendar input with the ISO code from the found nation
        const calendarNameInput = page.locator('#nationalCalendarName');
        await calendarNameInput.fill(nationToCreate.key);
        await calendarNameInput.dispatchEvent('change');

        // Wait for the async form processing to complete
        // The form fetches events, then checks if calendar exists, and shows a toast warning
        await page.waitForLoadState('networkidle');

        // Wait for either "calendar-not-found" (can proceed) or "missing-translations" (must skip)
        // Using data attributes is more robust than text matching (works regardless of locale)
        const toastResult = await Promise.race([
            page.waitForSelector('[data-toast-type="calendar-not-found"]', { timeout: 20000 })
                .then(() => 'calendar-not-found' as const),
            page.waitForSelector('[data-toast-type="missing-translations"]', { timeout: 20000 })
                .then(() => 'missing-translations' as const)
        ]).catch(() => 'timeout' as const);

        if (toastResult === 'missing-translations') {
            console.log('Missing translations toast detected - skipping CREATE test');
            test.skip(true, `Translations missing for ${nationToCreate.name} (${nationToCreate.key}) locale - cannot test CREATE`);
            return;
        }

        if (toastResult === 'timeout') {
            // Neither toast appeared - check if buttons are disabled
            const buttonsEnabled = await extendingPage.waitForActionButtonsEnabled(5000);
            if (!buttonsEnabled) {
                test.skip(true, `Form not ready for ${nationToCreate.name} - buttons disabled (possible translation issue)`);
                return;
            }
            // Buttons enabled but no toast - proceed anyway
            console.warn('Expected toast not detected but buttons are enabled - proceeding');
        } else {
            console.log('Calendar-not-found toast detected - CREATE operation confirmed');
        }

        // Dismiss any toastr toast messages first to prevent blocking
        await page.evaluate(() => {
            const toastContainer = document.querySelector('#toast-container');
            if (toastContainer) {
                toastContainer.remove();
            }
        });

        console.log('Toast dismissed, waiting for locales dropdown...');

        // Wait for locales dropdown to have options
        const localesPopulated = await page.waitForFunction(() => {
            const select = document.querySelector('#nationalCalendarLocales') as HTMLSelectElement;
            return select && select.options.length > 0;
        }, { timeout: 10000 })
            .then(() => true)
            .catch(() => false);
        if (!localesPopulated) {
            console.warn('Locales dropdown wait timed out - continuing');
        }

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

        // Open the modal and create a new liturgical event
        // We use "Create new" instead of "setProperty" because setProperty requires
        // translated values to be available in the events catalog
        const newEventName = 'Test National Saint';
        await extendingPage.createNewEventViaModal(newEventName);

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

            // The wider regions keep their default: the regions whose roster lists the nation. Forcing
            // one that does not list it would be refused by the API (422).
            const widerRegionsSelect = document.querySelector('#associatedWiderRegions') as HTMLSelectElement;
            const widerRegions = widerRegionsSelect ? Array.from(widerRegionsSelect.selectedOptions, o => o.value) : [];

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

            // Get values for logging (don't force enable or click here)
            return {
                widerRegions: widerRegions,
                selectedLocales: selectedLocales,
                currentLocale: currentLocaleSelect?.value || '',
                epiphany: epiphanyEl?.value || '',
                ascension: ascensionEl?.value || '',
                corpusChristi: corpusChristiEl?.value || ''
            };
        });

        // Wait for save button to be enabled by frontend validation
        const saveButton = page.locator('.serializeRegionalNationalData');
        await expect(saveButton).toBeEnabled({ timeout: 10000 });

        // Click save button
        await saveButton.click();

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
        // ...and that the calendar exists rather than sitting in a review queue — otherwise the
        // DELETE cleanup below removes nothing and is still answered 200 (issue #502).
        expectApplied(createResponseBody, 'PUT /data/ (national CREATE)');
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
        // A queued deletion answers 200 too, and leaves the calendar on disk to red the next run.
        expectApplied(deleteResult.body, 'DELETE /data/nation (cleanup)');
    });

    test('should default the wider regions of a new national calendar', async ({ page, extendingPage }) => {
        // English-language nations, so the General Roman Calendar is translated and the page
        // reaches its create path. Ireland has no calendar yet and is on Europe's roster.
        const selected = () => page.locator('#associatedWiderRegions')
            .evaluate((el: HTMLSelectElement) => Array.from(el.selectedOptions, o => o.value));

        await extendingPage.selectCalendar('#nationalCalendarName', 'IE');
        await expect.poll(selected, { timeout: 15000 }).toEqual(['Europe']);

        // No wider region lists Australia, so nothing is selected, and Ireland's regions do not linger.
        await extendingPage.selectCalendar('#nationalCalendarName', 'AU');
        await expect.poll(selected, { timeout: 15000 }).toEqual([]);
    });

    test('a new national calendar selects only its officially supported locales, and names any other one selected', async ({ page, extendingPage }) => {
        // France has five regional ICU locales (br, ca, fr, gsw, oc); today only French is an
        // officially supported language (issue #566). Expectations follow the live list, so
        // promoting another of them does not break the test.
        const calendars = await (await page.request.get(`${API_BASE_URL}/calendars`)).json();
        const metadata = calendars.litcal_metadata ?? {};
        const official: string[] = metadata.locales ?? [];
        test.skip((metadata.national_calendars_keys ?? []).includes('FR'), 'France already has a national calendar, so it is not created here');
        const isOfficial = (locale: string) => official.includes(locale.split('_')[0]);

        await extendingPage.selectCalendar('#nationalCalendarName', 'FR');
        const select = page.locator('#nationalCalendarLocales');
        const options = () => select.evaluate((el: HTMLSelectElement) => Array.from(el.options, o => o.value));
        const selected = () => select.evaluate((el: HTMLSelectElement) => Array.from(el.selectedOptions, o => o.value));
        await expect.poll(async () => (await options()).length, { timeout: 15000 }).toBeGreaterThan(1);
        const all = await options();
        expect(all).toContain('fr_FR');
        await expect.poll(selected).toEqual(all.filter(isOfficial));
        await expect(page.locator('#currentLocalizationNational')).toHaveValue('fr_FR');

        const unsupported = all.find(locale => !isOfficial(locale));
        test.skip(!unsupported, 'Every locale of France is officially supported now');

        const toggle = async (locale: string, on: boolean) => select.evaluate((el: HTMLSelectElement, [value, state]) => {
            (el.querySelector(`option[value="${value}"]`) as HTMLOptionElement).selected = state as boolean;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, [locale, on] as const);

        const feedback = page.locator('#nationalCalendarLocalesFeedback');
        const save = page.locator('#serializeNationalCalendarData');
        await expect(feedback).toBeHidden();

        await toggle(unsupported!, true);
        await expect(feedback).toBeVisible();
        await expect(feedback).toContainText(unsupported!);
        await expect(feedback).not.toContainText('fr_FR');
        await expect(feedback.locator('a[href="translations.php"]')).toBeVisible();
        await expect(save).toBeDisabled();

        await toggle(unsupported!, false);
        await expect(feedback).toBeHidden();
        await expect(save).toBeEnabled();
    });

    test('a new national calendar opens in its most spoken officially supported language', async ({ page, extendingPage }) => {
        // German is Switzerland's most spoken language but is not officially supported, so
        // the calendar is created in French rather than blocked on German (issue #566).
        const calendars = await (await page.request.get(`${API_BASE_URL}/calendars`)).json();
        const metadata = calendars.litcal_metadata ?? {};
        test.skip((metadata.national_calendars_keys ?? []).includes('CH'), 'Switzerland already has a national calendar');
        test.skip((metadata.locales ?? []).includes('de'), 'German is officially supported now, so nothing is skipped over');

        await extendingPage.selectCalendar('#nationalCalendarName', 'CH');
        await expect(page.locator('[data-toast-type="calendar-not-found"]')).toBeAttached({ timeout: 15000 });
        await expect(page.locator('[data-toast-type="missing-translations"]')).toHaveCount(0);
        await expect(page.locator('#currentLocalizationNational')).toHaveValue('fr_CH');
        const selected = await page.locator('#nationalCalendarLocales')
            .evaluate((el: HTMLSelectElement) => Array.from(el.selectedOptions, o => o.value));
        expect(selected).toContain('fr_CH');
        expect(selected).not.toContain('de_CH');
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
        await expect(page.locator('#associatedWiderRegions')).toHaveAttribute('multiple', 'multiple');
        await expect(page.locator('#associatedWiderRegions ~ .btn-group button.multiselect')).toBeVisible();
    });

    test('should have published Roman Missals section', async ({ page }) => {
        // Verify missals section exists (may be hidden in collapsed section)
        const missalsSection = page.locator('#publishedRomanMissalList');
        await expect(missalsSection).toBeAttached();
    });
});

test.describe('National Calendar Form - Action Buttons', () => {
    test.beforeEach(async ({ extendingPage }) => {
        await extendingPage.goToNationalCalendar();
    });

    test('should have all action buttons visible when calendar is loaded', async ({ page, extendingPage }) => {
        // Load an existing calendar
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');

        // Wait for action buttons to be enabled (translations loaded)
        await extendingPage.waitForButtonsEnabled('.litcalActionButton', 15000);

        // Verify all action buttons are visible
        await expect(page.locator('#makePatronAction')).toBeVisible();
        await expect(page.locator('#setPropertyAction')).toBeVisible();
        await expect(page.locator('#moveLiturgicalEventAction')).toBeVisible();
        await expect(page.locator('#newLiturgicalEventAction')).toBeVisible();
    });

    test('Set Property button should open modal and add setProperty row', async ({ page, extendingPage }) => {
        // Load an existing calendar
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');

        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Wait for action buttons to be enabled
        await extendingPage.waitForButtonsEnabled('.litcalActionButton', 15000);

        // Dismiss any toasts
        await extendingPage.dismissToasts();

        // Get a random existing event name
        const existingEventName = await extendingPage.getRandomExistingEventName();
        if (!existingEventName) {
            test.skip(true, 'No existing events in datalist');
            return;
        }
        console.log(`Using existing event: ${existingEventName}`);

        // Count existing setProperty rows before
        const existingCount = await page.locator('.regionalNationalDataForm .row[data-action="setProperty"]').count();

        // Use the setProperty modal helper
        await extendingPage.setPropertyViaModal(existingEventName, 'name');

        // Verify a new row was created (count increased)
        const newCount = await page.locator('.regionalNationalDataForm .row[data-action="setProperty"]').count();
        expect(newCount).toBeGreaterThan(existingCount);
        console.log(`Set Property row successfully created (count: ${existingCount} -> ${newCount})`);
    });

    test('Move Event button should open modal and add moveEvent row', async ({ page, extendingPage }) => {
        // Load an existing calendar
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');

        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Wait for action buttons to be enabled
        await extendingPage.waitForButtonsEnabled('.litcalActionButton', 15000);

        // Dismiss any toasts
        await extendingPage.dismissToasts();

        // Get a random existing event name
        const existingEventName = await extendingPage.getRandomExistingEventName();
        if (!existingEventName) {
            test.skip(true, 'No existing events in datalist');
            return;
        }
        console.log(`Using existing event: ${existingEventName}`);

        // Count existing moveEvent rows before
        const existingCount = await page.locator('.regionalNationalDataForm .row[data-action="moveEvent"]').count();

        // Use the moveEvent modal helper
        await extendingPage.moveEventViaModal(existingEventName);

        // Verify a new row was created (count increased)
        const newCount = await page.locator('.regionalNationalDataForm .row[data-action="moveEvent"]').count();
        expect(newCount).toBeGreaterThan(existingCount);
        console.log(`Move Event row successfully created (count: ${existingCount} -> ${newCount})`);
    });

    test('Make Patron button should open modal and add makePatron row', async ({ page, extendingPage }) => {
        // Load an existing calendar
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');

        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Wait for action buttons to be enabled
        await extendingPage.waitForButtonsEnabled('.litcalActionButton', 15000);

        // Dismiss any toasts
        await extendingPage.dismissToasts();

        // An EXISTING event key, the way the setProperty and moveEvent tests above
        // already do it. Designating a patron means designating one of the
        // calendar's liturgical events, so `retrieveExistingLiturgicalEvent()`
        // throws for a key the events catalog does not carry, and no row is added.
        //
        // This used to invent `TestPatron_${Date.now()}`, and passed only while
        // the events catalog had not finished loading: the lookup is skipped
        // entirely while `EventsLoader.lastRequestPath` is still ''. That race is
        // what made the test green — it never exercised the makePatron path with
        // a loaded catalog, which is the only state a user is ever in.
        const patronName = await extendingPage.getRandomExistingEventName();
        if (!patronName) {
            test.skip(true, 'No existing events in datalist');
            return;
        }
        console.log(`Using existing event: ${patronName}`);

        // Count existing makePatron rows before
        const existingCount = await page.locator('.regionalNationalDataForm .row[data-action="makePatron"]').count();

        // Use the makePatron modal helper
        await extendingPage.makePatronViaModal(patronName);

        // Verify a new row was created (count increased)
        const newCount = await page.locator('.regionalNationalDataForm .row[data-action="makePatron"]').count();
        expect(newCount).toBeGreaterThan(existingCount);
        console.log(`Make Patron row successfully created (count: ${existingCount} -> ${newCount})`);
    });

    test('Create New button should open modal and add createNew row', async ({ page, extendingPage }) => {
        // Load an existing calendar
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');

        // Wait for existing events datalist to be populated
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });

        // Wait for action buttons to be enabled
        await extendingPage.waitForButtonsEnabled('.litcalActionButton', 15000);

        // Dismiss any toasts
        await extendingPage.dismissToasts();

        // Use the createNew modal helper
        const newEventName = 'Test New Saint';

        // Count existing createNew rows before
        const existingCount = await page.locator('.regionalNationalDataForm .row[data-action="createNew"]').count();

        await extendingPage.createNewEventViaModal(newEventName);

        // Verify a new row was created (count increased)
        const newCount = await page.locator('.regionalNationalDataForm .row[data-action="createNew"]').count();
        expect(newCount).toBeGreaterThan(existingCount);
        console.log(`Create New row successfully created (count: ${existingCount} -> ${newCount})`);
    });

    test('a translation containing double quotes renders intact in its locale input', async ({ page, extendingPage }) => {
        // Names are stored as typed, so translationTemplate() must escape a stored
        // translation where it becomes a `value="…"` attribute: unescaped, the `"`
        // would end the attribute and truncate the name (or inject markup).
        const quoted = 'Saint André "le frère" Bessette, religieux';
        await page.route('**/data/nation/CA/fr_CA', async (route) => {
            const response = await route.fetch();
            const names = await response.json();
            await route.fulfill({ response, json: { ...names, StAndreBessette: quoted } });
        });

        await extendingPage.selectCalendar('#nationalCalendarName', 'CA');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('.regionalNationalDataForm input[data-locale="fr_CA"]').filter({ has: page.locator(`xpath=self::*[@value='${quoted}']`) }))
            .toHaveCount(1, { timeout: 15000 });
    });

    test('the holy days of obligation multiselect shows the stored setting', async ({ page, extendingPage }) => {
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');
        const stored = (await (await page.request.get(`${API_BASE_URL}/data/nation/US?locale=en_US`)).json()).settings.holydays_of_obligation;

        const select = page.locator('#nationalCalendarSettingHolydays');
        await expect(select).toBeEnabled({ timeout: 15000 });
        await expect(page.locator('#nationalCalendarSettingHolydays ~ .btn-group button.multiselect')).toBeEnabled();
        const selected = await select.evaluate((el: HTMLSelectElement) => Array.from(el.selectedOptions, (o) => o.value));
        expect(selected.sort()).toEqual(Object.keys(stored).filter((key) => stored[key]).sort());
        expect(selected).toContain('Christmas');
        expect(selected).not.toContain('Epiphany');
    });

    test('Create New keeps an apostrophe in the name and mints a clean event key', async ({ page, extendingPage }) => {
        // The modal's value used to be escapeHtml()'d before use as data: the name
        // field showed "d&#x27;Arc" and createEventKey() minted `SainteJeanneDXArc`.
        await extendingPage.selectCalendar('#nationalCalendarName', 'US');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => {
            const datalist = document.querySelector('#existingLiturgicalEventsList');
            return datalist && datalist.querySelectorAll('option').length > 0;
        }, { timeout: 15000 });
        await extendingPage.waitForButtonsEnabled('.litcalActionButton', 15000);
        await extendingPage.dismissToasts();

        const eventName = "Sainte Jeanne d'Arc, vierge, patronne secondaire de la France";
        await extendingPage.createNewEventViaModal(eventName);

        const row = page.locator('.regionalNationalDataForm .row[data-action="createNew"]').last();
        await expect(row.locator('.litEventName').first()).toHaveValue(eventName);
        await expect(row.locator('.litEventEventKey')).toHaveValue('SainteJeanneDArc');
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
