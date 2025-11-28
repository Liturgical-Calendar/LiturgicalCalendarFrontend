import { test as base, expect, Page } from '@playwright/test';

/**
 * Test fixtures for LiturgicalCalendar extending.php form tests.
 * Provides helper methods for common form interactions.
 */

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
     * Intercept PUT/PATCH requests to /data/** endpoints and capture payload.
     * Used for validating form submissions in CREATE/UPDATE tests.
     * @returns Object with getters for captured payload and method
     */
    async interceptDataRequests(): Promise<{
        getPayload: () => any;
        getMethod: () => string | null;
    }> {
        let capturedPayload: any = null;
        let capturedMethod: string | null = null;

        await this.page.route('**/data/**', async (route, request) => {
            if (['PUT', 'PATCH'].includes(request.method())) {
                capturedMethod = request.method();
                const postData = request.postData();
                if (postData) {
                    try {
                        capturedPayload = JSON.parse(postData);
                    } catch (e) {
                        // Fail fast with clear error instead of swallowing parse errors
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        throw new Error(`JSON.parse failed for request payload. Error: ${errorMsg}. Raw postData: ${postData?.substring(0, 500)}`);
                    }
                }
            }
            await route.continue();
        });

        return {
            getPayload: () => capturedPayload,
            getMethod: () => capturedMethod
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
