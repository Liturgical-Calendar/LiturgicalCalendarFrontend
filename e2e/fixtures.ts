import { test as base, expect, Page } from '@playwright/test';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test fixtures for LiturgicalCalendar extending.php form tests.
 * Provides helper methods for common form interactions.
 */

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

    const error = await new Promise<string | null>((resolve) => {
        exec(`git -C "${apiPath}" restore jsondata/sourcedata/ && git -C "${apiPath}" clean -fd jsondata/sourcedata/`, (err: any) => {
            resolve(err?.message || null);
        });
    });
    if (error) {
        throw new Error(`CLEANUP FAILED: git restore/clean failed for path "${apiPath}". Manual cleanup required. Error: ${error}`);
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
    }

    /**
     * Navigate to the wider region calendar form
     */
    async goToWiderRegionCalendar() {
        await this.page.goto(`${this.baseUrl}/extending.php?choice=widerRegion`);
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Navigate to the diocesan calendar form
     */
    async goToDiocesanCalendar() {
        await this.page.goto(`${this.baseUrl}/extending.php?choice=diocesan`);
        await this.page.waitForLoadState('networkidle');
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
    }> {
        const capturedRequests: CapturedRequest[] = [];

        await this.page.route('**/data/**', async (route, request) => {
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
        });

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
            )
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
