import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Authentication setup for Playwright tests.
 * Authenticates directly via the API and stores the token in browser storage.
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

    // Authenticate directly via API
    const loginResponse = await page.request.post(`${apiUrl}/auth/login`, {
        data: {
            username,
            password
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!loginResponse.ok()) {
        const errorText = await loginResponse.text();
        throw new Error(`Login failed: ${loginResponse.status()} - ${errorText}`);
    }

    const loginData = await loginResponse.json();

    if (!loginData.access_token) {
        throw new Error('Login response did not contain access_token');
    }

    // Store the tokens in the browser's localStorage/sessionStorage
    // Note: We use localStorage instead of sessionStorage because Playwright's
    // storageState captures localStorage more reliably across test runs.
    // sessionStorage can have issues with origin capture in some scenarios.
    await page.evaluate((tokens) => {
        // Store access token in both localStorage and sessionStorage for compatibility
        localStorage.setItem('litcal_jwt_token', tokens.access_token);
        sessionStorage.setItem('litcal_jwt_token', tokens.access_token);
        // Store refresh token if available
        if (tokens.refresh_token) {
            localStorage.setItem('litcal_refresh_token', tokens.refresh_token);
            sessionStorage.setItem('litcal_refresh_token', tokens.refresh_token);
        }
    }, loginData);

    // Verify authentication by checking if Auth.isAuthenticated() returns true
    const isAuthenticated = await page.evaluate(() => {
        // Check if the token is stored and valid
        const token = sessionStorage.getItem('litcal_jwt_token');
        if (!token) return false;

        try {
            // Decode and check expiration
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            const now = Math.floor(Date.now() / 1000);
            return payload.exp > now;
        } catch {
            return false;
        }
    });

    expect(isAuthenticated).toBe(true);

    // Save the authentication state (includes localStorage and sessionStorage)
    await page.context().storageState({ path: authFile });

    console.log('Authentication setup complete');
});
