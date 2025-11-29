import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Authentication setup for Playwright tests.
 *
 * Uses a hybrid approach for maximum compatibility:
 * 1. HttpOnly cookie-based authentication (preferred, more secure) - cookies are set
 *    by the API and automatically included in subsequent requests via credentials: 'include'
 * 2. Token storage in localStorage/sessionStorage - required because the frontend's
 *    JavaScript code reads tokens from storage to build Authorization headers
 *
 * Playwright's storageState captures both cookies and localStorage, persisting
 * them across test runs.
 *
 * NOTE: The localStorage/sessionStorage token storage inherits XSS exposure risks,
 * similar to the main app's assets/js/auth.js. This is intentional for backward
 * compatibility with the current frontend implementation. See docs/AUTHENTICATION_ROADMAP.md
 * Phase 2.5 for the plan to migrate to full cookie-only authentication, which will
 * allow removing these storage writes once the frontend stops reading tokens from storage.
 */
setup('authenticate', async ({ page }) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiUrl = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;

    if (!username || !password) {
        throw new Error('TEST_USERNAME and TEST_PASSWORD must be set in environment variables');
    }

    // First, navigate to the frontend to establish the browser context
    await page.goto(`${frontendUrl}/extending.php?choice=national`);
    await page.waitForLoadState('networkidle');

    // Authenticate via fetch with credentials: 'include' to ensure cookies are set
    // Also capture the token response for localStorage storage
    const loginResponse = await page.evaluate(async (credentials) => {
        const response = await fetch(`${credentials.apiUrl}/auth/login`, {
            method: 'POST',
            credentials: 'include', // Include cookies for HttpOnly cookie authentication
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                username: credentials.username,
                password: credentials.password
            })
        });

        if (!response.ok) {
            const text = await response.text();
            return { ok: false, status: response.status, error: text };
        }

        const data = await response.json();

        // Store tokens in localStorage/sessionStorage for frontend JavaScript compatibility
        // The frontend's auth.js reads from these to build Authorization headers
        if (data.access_token) {
            localStorage.setItem('litcal_jwt_token', data.access_token);
            sessionStorage.setItem('litcal_jwt_token', data.access_token);
        }
        if (data.refresh_token) {
            localStorage.setItem('litcal_refresh_token', data.refresh_token);
            sessionStorage.setItem('litcal_refresh_token', data.refresh_token);
        }

        return { ok: true, status: response.status, data };
    }, { apiUrl, username, password });

    if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.status} - ${loginResponse.error}`);
    }

    // Assert access_token is present - fail fast on schema/contract regressions
    // rather than surfacing later via 401s in actual tests
    if (!loginResponse.data?.access_token) {
        throw new Error('Login response missing access_token - API contract may have changed');
    }

    // Verify authentication by making a request to an authenticated endpoint
    // This verifies both cookie-based auth and that tokens are properly stored
    const authCheck = await page.evaluate(async (apiUrl) => {
        try {
            const response = await fetch(`${apiUrl}/auth/me`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            return { ok: response.ok, status: response.status };
        } catch (e) {
            return { ok: false, status: 0, error: String(e) };
        }
    }, apiUrl);

    expect(authCheck.ok).toBe(true);

    // Save the authentication state (includes cookies and localStorage)
    await page.context().storageState({ path: authFile });

    console.log('Authentication setup complete');
});
