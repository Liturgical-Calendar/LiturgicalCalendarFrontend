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
        // Nothing is excluded from CI any more: every other chromium spec needs a
        // login and so lives in `chromium-ci-auth` below. Keep that split intact —
        // a spec belongs here ONLY if its page renders without authentication.
        {
            name: 'chromium-ci',
            testMatch: /(usage|liturgyOfAnyDay)\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
            },
        },
        // The auth-requiring counterpart to `chromium-ci`: the three calendar-data
        // specs that issue #448 blocked, unblocked by auth.setup.ts's migration to
        // the Zitadel OIDC flow, plus admin-tests (issue #453).
        //
        // Kept as a SEPARATE project rather than merged into `chromium-ci`, because
        // half of that project's value is declaring no storageState: a Zitadel
        // outage cannot take those 22 tests down alongside `rbac`. Folding these
        // in would hand that property back.
        //
        // admin-tests belongs HERE, not in `chromium-ci`, even though it stubs
        // /auth/me and /auth/test-scopes: those are client-side route interceptions
        // and cannot reach admin-tests.php's server-side guard, which 302s an
        // unauthenticated request to index.php before any markup renders.
        {
            name: 'chromium-ci-auth',
            testMatch: /(diocesan-calendar|national-calendar|wider-region-calendar|admin-tests)\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
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
            // rbac/queue/ is the queue-mode counterpart below, and must NOT run here:
            // these specs assume writes reach disk. Without this the testMatch above
            // would swallow them.
            testIgnore: /rbac\/queue\//,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['rbac-setup'],
        },
        // Queue mode — the API records /data, /decrees and /tests writes as change
        // requests awaiting review instead of writing files (LiturgicalCalendarAPI #902,
        // SOURCEDATA_CHANGE_REQUESTS=true).
        //
        // A SEPARATE project rather than a flag flipped on the existing stack, because
        // the two modes want opposite assertions of the same request: every other
        // project asserts a write was APPLIED, these assert it was QUEUED. Sharing one
        // project would mean branching each assertion on an env var — which is how
        // issue #502 happened, since a 2xx satisfies both.
        //
        // It lives under `rbac` because a review flow needs two identities: an editor
        // who submits and an admin who decides. rbac-setup is the only seed that
        // provisions distinct users, hence the same dependency as `rbac`.
        //
        // NOT added to any .github/workflows/e2e.yml project set: CI starts the stack
        // in disk mode. The specs here skip themselves unless E2E_WRITE_MODE=queue, so
        // the `all` branch (which passes no --project) stays green anyway; Q0 asserts
        // the live API agrees before any flow spec runs.
        {
            name: 'rbac-queue',
            testMatch: /rbac\/queue\/.*\.spec\.ts/,
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
