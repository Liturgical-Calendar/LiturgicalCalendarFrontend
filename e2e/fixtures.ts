import { test as base, expect, Page } from '@playwright/test';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test fixtures for LiturgicalCalendar extending.php form tests.
 * Provides helper methods for common form interactions.
 */

/**
 * Run a git command using execFile to avoid shell injection.
 * @param args - Array of git arguments (without 'git' itself)
 * @returns Promise that resolves to null on success, or error message on failure
 */
function runGitCommand(args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
        execFile('git', args, (err) => {
            resolve(err?.message || null);
        });
    });
}

/**
 * Restore and clean API sourcedata directory using git.
 * This reverts modified tracked files and removes untracked files/directories.
 * Used for cleanup after CREATE tests that modify API data.
 * @throws Error if path is invalid, not a git repo, or git restore/clean fails
 */
export async function gitRestoreApiData(): Promise<void> {
    const apiPath = process.env.API_REPO_PATH || path.resolve(__dirname, '../../LiturgicalCalendarAPI');

    // Safety check: verify path exists and is a git repository
    // This prevents accidental cleanup if API_REPO_PATH is misconfigured
    if (!fs.existsSync(apiPath)) {
        throw new Error(`CLEANUP FAILED: API path "${apiPath}" does not exist. Check API_REPO_PATH environment variable.`);
    }
    const gitDir = path.join(apiPath, '.git');
    if (!fs.existsSync(gitDir)) {
        throw new Error(`CLEANUP FAILED: "${apiPath}" is not a git repository (no .git directory). Check API_REPO_PATH environment variable.`);
    }

    // Run git restore (revert modified tracked files)
    const restoreError = await runGitCommand(['-C', apiPath, 'restore', 'jsondata/sourcedata/']);
    if (restoreError) {
        throw new Error(`CLEANUP FAILED: git restore failed for path "${apiPath}". Manual cleanup required. Error: ${restoreError}`);
    }

    // Run git clean (remove untracked files/directories)
    const cleanError = await runGitCommand(['-C', apiPath, 'clean', '-fd', 'jsondata/sourcedata/']);
    if (cleanError) {
        throw new Error(`CLEANUP FAILED: git clean failed for path "${apiPath}". Manual cleanup required. Error: ${cleanError}`);
    }

    console.log('CLEANUP: git restore and clean completed');
}

/**
 * Captured request data from interceptDataRequests
 */
export interface CapturedRequest {
    url: string;
    method: string;
    payload: any;
}

export interface ExtendingPageFixtures {
    extendingPage: ExtendingPageHelper;
}

/**
 * Helper class for interacting with the extending.php page forms.
 */
export class ExtendingPageHelper {
    readonly page: Page;
    readonly baseUrl: string;

    constructor(page: Page) {
        this.page = page;
        this.baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    }

    /**
     * Navigate to the national calendar form
     */
    async goToNationalCalendar() {
        await this.page.goto(`${this.baseUrl}/extending.php?choice=national`);
        await this.page.waitForLoadState('networkidle');
        await this.waitForAuth();
    }

    /**
     * Navigate to the wider region calendar form
     */
    async goToWiderRegionCalendar() {
        await this.page.goto(`${this.baseUrl}/extending.php?choice=widerRegion`);
        await this.page.waitForLoadState('networkidle');
        await this.waitForAuth();
    }

    /**
     * Navigate to the diocesan calendar form
     */
    async goToDiocesanCalendar() {
        await this.page.goto(`${this.baseUrl}/extending.php?choice=diocesan`);
        await this.page.waitForLoadState('networkidle');
        await this.waitForAuth();
    }

    /**
     * Wait for auth check to complete and user to be authenticated.
     * This waits for the user menu to be visible (indicating login was verified).
     */
    async waitForAuth() {
        await this.page.waitForFunction(() => {
            // @ts-ignore - Auth is a global object
            return typeof Auth !== 'undefined' && Auth.isAuthenticated() === true;
        }, undefined, { timeout: 10000 });
    }

    /**
     * Select a calendar from the datalist input
     */
    async selectCalendar(inputSelector: string, calendarName: string) {
        const input = this.page.locator(inputSelector);
        await input.fill(calendarName);
        await input.press('Enter');
        // Wait for calendar data to load
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Select a locale from a multi-select
     */
    async selectLocale(selectSelector: string, locale: string) {
        const select = this.page.locator(selectSelector);
        await select.selectOption(locale);
    }

    /**
     * Set a dropdown value
     */
    async setDropdown(selector: string, value: string) {
        await this.page.locator(selector).selectOption(value);
    }

    /**
     * Set a checkbox value
     */
    async setCheckbox(selector: string, checked: boolean) {
        const checkbox = this.page.locator(selector);
        if (checked) {
            await checkbox.check();
        } else {
            await checkbox.uncheck();
        }
    }

    /**
     * Fill a text input
     */
    async fillInput(selector: string, value: string) {
        await this.page.locator(selector).fill(value);
    }

    /**
     * Click a button and wait for response
     */
    async clickButton(selector: string) {
        await this.page.locator(selector).click();
    }

    /**
     * Get the API base URL from the page's global BaseUrl variable.
     */
    async getApiBaseUrl(): Promise<string> {
        return this.page.evaluate(() => {
            // @ts-ignore - BaseUrl is a global variable set by the frontend
            return typeof BaseUrl !== 'undefined' ? BaseUrl : 'http://localhost:8000';
        });
    }

    /**
     * Get available translation locales from LitCalMetadata.
     * These are the locales for which the General Roman Calendar has been translated.
     * @returns Array of locale codes (e.g., ['en', 'it', 'fr', 'es', 'de', ...])
     */
    async getAvailableTranslations(): Promise<string[]> {
        return this.page.evaluate(() => {
            // LitCalMetadata is a global variable set by the frontend from /calendars API
            const metadata = (window as any).LitCalMetadata;
            return metadata && metadata.locales ? metadata.locales : [];
        });
    }

    /**
     * Check if a locale has available translations.
     * @param locale - The locale to check (e.g., 'en', 'fr', 'pt')
     * @returns True if translations are available
     */
    async hasTranslationsForLocale(locale: string): Promise<boolean> {
        const availableTranslations = await this.getAvailableTranslations();
        // Check for exact match or language prefix match (e.g., 'pt' matches 'pt_BR')
        const langPrefix = locale.split(/[-_]/)[0].toLowerCase();
        return availableTranslations.some(t => {
            const tPrefix = t.split(/[-_]/)[0].toLowerCase();
            return t.toLowerCase() === locale.toLowerCase() || tPrefix === langPrefix;
        });
    }

    /**
     * Wait for buttons matching a selector to be enabled.
     * Useful for checking if translations are available or form controls are ready.
     * @param selector - CSS selector for the buttons to check (default: '.litcalActionButton')
     * @param timeout - Maximum time to wait in milliseconds
     * @returns True if all matching buttons are enabled, false if any are disabled or on timeout
     */
    async waitForButtonsEnabled(selector = '.litcalActionButton', timeout = 10000): Promise<boolean> {
        try {
            await this.page.waitForFunction((sel) => {
                const buttons = document.querySelectorAll(sel);
                return buttons.length > 0 && Array.from(buttons).every(btn => !(btn as HTMLButtonElement).disabled);
            }, selector, { timeout });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Wait for action buttons to be enabled (indicating translations are available).
     * @param timeout - Maximum time to wait in milliseconds
     * @returns True if buttons are enabled, false if they're disabled (translations missing)
     * @deprecated Use waitForButtonsEnabled() with a selector instead
     */
    async waitForActionButtonsEnabled(timeout = 10000): Promise<boolean> {
        return this.waitForButtonsEnabled('.litcalActionButton', timeout);
    }

    /**
     * Check if a "missing translations" toast is visible.
     * @returns True if the missing translations toast is present
     */
    async hasMissingTranslationsToast(): Promise<boolean> {
        const toast = this.page.locator('[data-toast-type="missing-translations"]');
        return toast.isVisible().catch(() => false);
    }

    /**
     * Get existing diocesan calendar IDs from the /calendars API.
     * @param nationFilter - Optional 2-letter ISO code to filter by nation
     * @returns Array of diocesan calendar IDs
     */
    async getExistingDiocesanCalendarIds(nationFilter?: string): Promise<string[]> {
        const apiBaseUrl = await this.getApiBaseUrl();
        const response = await this.page.request.get(`${apiBaseUrl}/calendars`);
        const data = await response.json();

        // API returns diocesan_calendars nested under litcal_metadata
        // Each entry has calendar_id and nation (2-letter ISO code) properties
        const diocesanCalendars: Array<{ calendar_id: string; nation: string }> =
            data.litcal_metadata?.diocesan_calendars || [];

        if (nationFilter) {
            return diocesanCalendars
                .filter(d => d.nation === nationFilter)
                .map(d => d.calendar_id);
        }

        return diocesanCalendars.map(d => d.calendar_id);
    }

    /**
     * Get nation codes that have existing diocesan calendars.
     * @returns Array of unique 2-letter ISO nation codes with existing diocesan data
     */
    async getNationsWithExistingDiocesanCalendars(): Promise<string[]> {
        const apiBaseUrl = await this.getApiBaseUrl();
        const response = await this.page.request.get(`${apiBaseUrl}/calendars`);
        const data = await response.json();

        const diocesanCalendars: Array<{ calendar_id: string; nation: string }> =
            data.litcal_metadata?.diocesan_calendars || [];

        // Extract unique nation codes
        const nations = [...new Set(diocesanCalendars.map(d => d.nation))];
        return nations;
    }

    /**
     * Wait for API response after form submission
     */
    async waitForApiResponse(urlPattern: RegExp | string, timeout = 30000) {
        return this.page.waitForResponse(
            response => {
                if (typeof urlPattern === 'string') {
                    return response.url().includes(urlPattern);
                }
                return urlPattern.test(response.url());
            },
            { timeout }
        );
    }

    /**
     * Intercept and capture API requests for validation.
     * Returns both the captured requests array and an unroute function for cleanup.
     */
    async interceptApiRequest(urlPattern: RegExp | string): Promise<{
        requests: { url: string; method: string; postData: string | null }[];
        unroute: () => Promise<void>;
    }> {
        const requests: { url: string; method: string; postData: string | null }[] = [];

        const handler = async (route: import('@playwright/test').Route, request: import('@playwright/test').Request) => {
            requests.push({
                url: request.url(),
                method: request.method(),
                postData: request.postData()
            });
            await route.continue();
        };
        await this.page.route(urlPattern, handler);

        return {
            requests,
            unroute: () => this.page.unroute(urlPattern, handler)
        };
    }

    /**
     * Intercept PUT/PATCH requests to /data/** endpoints and capture payloads.
     * Used for validating form submissions in CREATE/UPDATE tests.
     * @param urlFilter - Optional URL substring or RegExp to filter captured requests
     * @returns Object with methods to access captured requests
     */
    async interceptDataRequests(urlFilter?: string | RegExp): Promise<{
        getPayload: () => any;
        getMethod: () => string | null;
        getAllRequests: () => CapturedRequest[];
        getRequestByUrl: (urlMatch: string | RegExp) => CapturedRequest | undefined;
        unroute: () => Promise<void>;
    }> {
        const capturedRequests: CapturedRequest[] = [];
        const pattern = '**/data/**';

        const handler = async (route: import('@playwright/test').Route, request: import('@playwright/test').Request) => {
            if (['PUT', 'PATCH'].includes(request.method())) {
                const url = request.url();

                // Apply URL filter if provided
                if (urlFilter) {
                    const matches = typeof urlFilter === 'string'
                        ? url.includes(urlFilter)
                        : urlFilter.test(url);
                    if (!matches) {
                        await route.continue();
                        return;
                    }
                }

                const postData = request.postData();
                let payload: any = null;
                if (postData) {
                    try {
                        payload = JSON.parse(postData);
                    } catch (e) {
                        // Fail fast with clear error instead of swallowing parse errors
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        throw new Error(`JSON.parse failed for request payload. Error: ${errorMsg}. Raw postData: ${postData?.substring(0, 500)}`);
                    }
                }

                capturedRequests.push({
                    url,
                    method: request.method(),
                    payload
                });
            }
            await route.continue();
        };
        await this.page.route(pattern, handler);

        return {
            // Backward compatible: get last captured payload/method
            getPayload: () => capturedRequests.length > 0
                ? capturedRequests[capturedRequests.length - 1].payload
                : null,
            getMethod: () => capturedRequests.length > 0
                ? capturedRequests[capturedRequests.length - 1].method
                : null,
            // New: access all captured requests
            getAllRequests: () => capturedRequests,
            // New: find specific request by URL
            getRequestByUrl: (urlMatch: string | RegExp) => capturedRequests.find(r =>
                typeof urlMatch === 'string' ? r.url.includes(urlMatch) : urlMatch.test(r.url)
            ),
            // Cleanup: remove the route handler
            unroute: () => this.page.unroute(pattern, handler)
        };
    }

    /**
     * Get toast notification text
     */
    async getToastMessage(): Promise<string | null> {
        const toast = this.page.locator('.toast-message').first();
        if (await toast.isVisible({ timeout: 5000 })) {
            return toast.textContent();
        }
        return null;
    }

    /**
     * Dismiss all toast notifications to prevent them from blocking UI interactions.
     * Removes toast containers and individual toast elements.
     */
    async dismissToasts(): Promise<void> {
        await this.page.evaluate(() => {
            document.querySelectorAll('#toast-container, .toast-container, .toast, .toast-message, .toast-success, .toast-warning, .toast-error, .toast-info')
                .forEach(el => el.remove());
        });
    }

    /**
     * Delete a calendar via the API and verify success.
     * Centralizes the DELETE cleanup pattern used after CREATE tests.
     *
     * Uses HttpOnly cookie-based authentication:
     * - Cookies are automatically included via Playwright's storageState
     * - No need for Authorization header or localStorage/sessionStorage access
     *
     * @param type - Calendar type: 'nation', 'diocese', or 'widerregion'
     * @param key - The calendar identifier (e.g., 'US', 'boston_us', 'Americas')
     * @returns Object with status, body, and success flag
     */
    async deleteCalendar(type: 'nation' | 'diocese' | 'widerregion', key: string): Promise<{
        status: number;
        body: any;
        success: boolean;
    }> {
        console.log(`CLEANUP: Deleting ${type} calendar ${key}...`);

        const apiBaseUrl = await this.getApiBaseUrl();

        // Make DELETE request via page.evaluate with credentials: 'include'
        // This ensures HttpOnly cookies are sent with the request
        const result = await this.page.evaluate(async ({ apiBaseUrl, type, key }) => {
            const response = await fetch(`${apiBaseUrl}/data/${type}/${key}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const status = response.status;
            // Read body as text first (can only consume response body once)
            const text = await response.text();
            let body: any = text;
            try {
                body = JSON.parse(text);
            } catch {
                // Keep raw text if JSON parsing fails
            }

            return { status, body };
        }, { apiBaseUrl, type, key });

        console.log(`DELETE response: ${result.status} - ${JSON.stringify(result.body)}`);

        // Check for successful response:
        // - Status must be 200
        // - Body must have a truthy 'success' property (string message or boolean true)
        // This correctly rejects { success: false } or { success: '' }
        return {
            status: result.status,
            body: result.body,
            success: result.status === 200 && !!result.body?.success
        };
    }

    /**
     * Wait for a select element to have options populated.
     * @param selector - CSS selector for the select element
     * @param minOptions - Minimum number of options required (default: 1)
     * @param timeout - Maximum time to wait in milliseconds
     * @returns True if select has required options, false on timeout
     */
    async waitForSelectPopulated(selector: string, minOptions = 1, timeout = 15000): Promise<boolean> {
        try {
            await this.page.waitForFunction(({ sel, min }) => {
                const element = document.querySelector(sel);
                // Defensive check: ensure element is actually a <select>
                if (!element || element.tagName !== 'SELECT') {
                    return false;
                }
                return (element as HTMLSelectElement).options.length >= min;
            }, { sel: selector, min: minOptions }, { timeout });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Wait for a toast notification to appear.
     * @param type - Toast type: 'success', 'error', 'warning', 'info', or custom selector
     * @param timeout - Maximum time to wait in milliseconds
     * @returns True if toast appeared, false on timeout
     */
    async waitForToast(type: 'success' | 'error' | 'warning' | 'info' | string = 'success', timeout = 10000): Promise<boolean> {
        const selectorMap: Record<string, string> = {
            success: '.toast-success, .toast.bg-success',
            error: '.toast-error, .toast.bg-danger',
            warning: '.toast-warning, .toast.bg-warning',
            info: '.toast-info, .toast.bg-info'
        };
        const selector = selectorMap[type] || type;

        return this.page.waitForSelector(selector, { timeout })
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Wait for calendar data to fully load after selecting a calendar.
     * Waits for network idle, locales dropdown population, and optional success toast.
     * @param localesSelector - CSS selector for the locales dropdown (e.g., '#widerRegionLocales')
     * @param timeout - Maximum time to wait for locales in milliseconds
     */
    async waitForCalendarDataLoad(localesSelector: string, timeout = 15000): Promise<void> {
        await this.page.waitForLoadState('networkidle');

        // Wait for locales dropdown to be populated - fail fast if it doesn't populate
        const populated = await this.waitForSelectPopulated(localesSelector, 1, timeout);
        if (!populated) {
            throw new Error(`Locales dropdown "${localesSelector}" was not populated within ${timeout}ms - calendar data may have failed to load`);
        }

        // Wait for success toast (non-blocking)
        const toastAppeared = await this.waitForToast('success', 10000);
        if (!toastAppeared) {
            console.warn('Success toast not detected within timeout - continuing');
        }

        // Final wait for any remaining async operations
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Create a new liturgical event via the modal dialog.
     * Opens the modal programmatically, enters the event name, clicks the appropriate submit button,
     * and waits for the new row to appear.
     * @param eventName - The name for the new event
     * @param formSelector - CSS selector for the form where the new row will appear (default: '.regionalNationalDataForm')
     * @returns Promise that resolves when the new row is created
     */
    async createNewEventViaModal(eventName: string, formSelector = '.regionalNationalDataForm'): Promise<void> {
        // Open the modal programmatically via Bootstrap API
        const modalOpened = await this.page.evaluate(() => {
            const modalEl = document.querySelector('#newLiturgicalEventActionPrompt');
            if (!modalEl) {
                console.error('Modal element #newLiturgicalEventActionPrompt not found in DOM');
                return false;
            }
            // @ts-ignore - bootstrap is a global
            if (typeof bootstrap === 'undefined') {
                console.error('Bootstrap is not available');
                return false;
            }
            // @ts-ignore - bootstrap is a global (checked above)
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            return true;
        });
        if (!modalOpened) {
            throw new Error('Failed to open newLiturgicalEventActionPrompt modal');
        }
        await this.page.waitForSelector('#newLiturgicalEventActionPrompt.show', { timeout: 5000 });
        console.log('newLiturgicalEventActionPrompt modal opened');

        // Fill in the event name
        const eventInput = this.page.locator('#newLiturgicalEventActionPrompt .existingLiturgicalEventName');
        await eventInput.fill(eventName);
        await eventInput.dispatchEvent('change');
        console.log(`Entered new event name: ${eventName}`);

        // Wait for either submit button to be enabled
        await this.page.waitForFunction(() => {
            const exNovo = document.querySelector('#newLiturgicalEventExNovoButton') as HTMLButtonElement | null;
            const existing = document.querySelector('#newLiturgicalEventFromExistingButton') as HTMLButtonElement | null;
            return (exNovo && !exNovo.disabled) || (existing && !existing.disabled);
        }, undefined, { timeout: 10000 });

        // Click whichever button is enabled
        const exNovoEnabled = await this.page.evaluate(() => {
            const btn = document.querySelector('#newLiturgicalEventExNovoButton') as HTMLButtonElement | null;
            return btn && !btn.disabled;
        });
        const existingEnabled = await this.page.evaluate(() => {
            const btn = document.querySelector('#newLiturgicalEventFromExistingButton') as HTMLButtonElement | null;
            return btn && !btn.disabled;
        });

        // Defensive check: ensure at least one button is available
        if (!exNovoEnabled && !existingEnabled) {
            console.error('Neither #newLiturgicalEventExNovoButton nor #newLiturgicalEventFromExistingButton found or enabled');
            throw new Error('Failed to find an enabled submit button in newLiturgicalEventActionPrompt modal');
        }

        const submitSelector = exNovoEnabled
            ? '#newLiturgicalEventExNovoButton'
            : '#newLiturgicalEventFromExistingButton';
        console.log(`Clicking submit button: ${submitSelector}`);
        await this.page.click(submitSelector);

        // Wait for modal to close and new row to appear
        await this.page.waitForSelector('#newLiturgicalEventActionPrompt.show', { state: 'hidden', timeout: 5000 });
        console.log('Modal closed, waiting for new row...');

        await this.page.waitForSelector(`${formSelector} .row[data-action="createNew"]`, { timeout: 5000 });
        console.log('New createNew row created');
    }

    /**
     * Check if form has validation errors
     */
    async hasValidationErrors(): Promise<boolean> {
        const invalidFields = this.page.locator('.is-invalid');
        return (await invalidFields.count()) > 0;
    }

    /**
     * Get validation error messages
     */
    async getValidationErrors(): Promise<string[]> {
        const errors: string[] = [];
        const feedbackElements = this.page.locator('.invalid-feedback:visible');
        const count = await feedbackElements.count();
        for (let i = 0; i < count; i++) {
            const text = await feedbackElements.nth(i).textContent();
            if (text) errors.push(text);
        }
        return errors;
    }

    /**
     * Add a new liturgical event row
     */
    async addNewEventRow(formSelector: string) {
        const addButton = this.page.locator(`${formSelector} .add-row-btn, ${formSelector} [data-action="add-row"]`).first();
        if (await addButton.isVisible()) {
            await addButton.click();
        }
    }

    /**
     * Fill event row data
     */
    async fillEventRow(rowIndex: number, data: {
        eventKey?: string;
        day?: number;
        month?: number;
        grade?: number;
        color?: string[];
        common?: string[];
        sinceYear?: number;
        untilYear?: number;
    }) {
        const row = this.page.locator(`tr[data-row-index="${rowIndex}"], .event-row:nth-child(${rowIndex + 1})`).first();

        if (data.eventKey) {
            await row.locator('[name*="event_key"], [data-field="event_key"]').fill(data.eventKey);
        }
        if (data.day !== undefined) {
            await row.locator('[name*="day"], [data-field="day"]').fill(String(data.day));
        }
        if (data.month !== undefined) {
            await row.locator('[name*="month"], [data-field="month"]').selectOption(String(data.month));
        }
        if (data.grade !== undefined) {
            await row.locator('[name*="grade"], [data-field="grade"]').selectOption(String(data.grade));
        }
        if (data.sinceYear !== undefined) {
            await row.locator('[name*="since_year"], [data-field="since_year"]').fill(String(data.sinceYear));
        }
        if (data.untilYear !== undefined) {
            await row.locator('[name*="until_year"], [data-field="until_year"]').fill(String(data.untilYear));
        }
    }
}

/**
 * Extended test fixture with ExtendingPageHelper
 */
export const test = base.extend<ExtendingPageFixtures>({
    extendingPage: async ({ page }, use) => {
        const helper = new ExtendingPageHelper(page);
        await use(helper);
    },
});

export { expect };
