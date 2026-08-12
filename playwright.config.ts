import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.development (same as the app)
dotenv.config({ path: path.resolve(__dirname, '.env.development') });

/**
 * Playwright configuration for LiturgicalCalendarFrontend
 * Tests the extending.php forms that submit PUT/PATCH requests to the API
 */
export default defineConfig({
    testDir: './e2e',
    /* Run tests serially - these tests modify shared API state (calendars)
     * and parallel execution causes race conditions and flaky failures */
    fullyParallel: false,
    workers: 1,
    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Reporter to use */
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list']
    ],
    /* Shared settings for all the projects below */
    use: {
        /* Base URL for the frontend */
        baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',

        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',

        /* Take screenshots on failure */
        screenshot: 'only-on-failure',

        /* Default timeout for actions */
        actionTimeout: 10000,
    },

    /* Configure projects for major browsers */
    projects: [
        // Setup project to authenticate
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Use authenticated state
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
            testIgnore: /rbac\//,
        },
        // The subset of the `chromium` specs that CI can run green TODAY, so the
        // automated triggers guard something instead of nothing.
        //
        // It exists as its own project rather than a `--grep` in the workflow so
        // that the CI-ready set is declared in one reviewable place, and adding a
        // spec to CI is a one-line change here.
        //
        // Deliberately NO `storageState` and NO `dependencies: ['setup']`: every
        // spec listed here is for a page that needs no login. That also makes this
        // project immune to the auth breakage tracked in issue #448, which is what
        // keeps the rest of `chromium` out of CI.
        //
        // Everything still excluded, and why — re-check before adding any of them:
        //   diocesan-calendar, national-calendar, wider-region-calendar,
        //   missals-editor  — call waitForAuth(); blocked on #448.
        //   admin-tests     — 7 of 17 fail for an unrelated, PRE-EXISTING reason
        //                     (verified identical on 780921d0, before any of this
        //                     work). Needs its own diagnosis, not inclusion here.
        {
            name: 'chromium-ci',
            testMatch: /(usage|liturgyOfAnyDay)\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
            },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
            testIgnore: /rbac\//,
        },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
            testIgnore: /rbac\//,
        },
        {
            // Unit/integration tests for the support modules (users/zitadel/fga/seed/cleanup).
            // They run against the live stack but do NOT need the full seed, so no dependency.
            name: 'rbac-support',
            testMatch: /rbac\/support\/.*\.test\.ts/,
        },
        {
            name: 'rbac-setup',
            testMatch: /rbac\/rbac\.setup\.ts/,
        },
        {
            name: 'rbac',
            testMatch: /rbac\/.*\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['rbac-setup'],
        },
    ],

    /* Run servers before starting the tests */
    webServer: [
        {
            // Start API server first (foreground mode for Playwright)
            // NOTE: PHP_CLI_SERVER_WORKERS=6 uses POSIX-style env assignment (Linux/macOS only)
            // For Windows, use cross-env or set the env var separately
            command: `PHP_CLI_SERVER_WORKERS=6 php -S ${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'} -t public`,
            cwd: process.env.API_REPO_PATH || path.resolve(__dirname, '../LiturgicalCalendarAPI'),
            url: `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}/calendars`,
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            // Start frontend server
            // Extract host:port from FRONTEND_URL or use defaults
            command: `php -S ${new URL(process.env.FRONTEND_URL || 'http://localhost:3000').host}`,
            url: process.env.FRONTEND_URL || 'http://localhost:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 60 * 1000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
    ],

    /* Global timeout */
    timeout: 60000,

    /* Expect timeout */
    expect: {
        timeout: 10000,
    },
});
