import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { seedUserRecord, loginAndSaveStateAs } from './rbac/support/seed';
import { ZitadelAdmin } from './rbac/support/zitadel';
import type { RbacUser } from './rbac/support/users';

const authFile = path.join(__dirname, '.auth', 'user.json');

/**
 * The single administrator identity the calendar-data specs act as.
 *
 * Zitadel role `admin`, no FGA tuple. That is sufficient for the specs' real PUT/PATCH writes
 * because the API's OpenFgaAuthorizationMiddleware bypasses every OpenFGA check for holders of
 * the `admin` role, so no per-calendar scoping has to be seeded here.
 *
 * DELIBERATELY NOT a member of USERS. rbac.setup.ts opens with deleteAllSeededUsers(), which
 * iterates Object.keys(USERS) and deletes each one — so any identity in that map is destroyed
 * at the start of an rbac run. The `automated` CI selector runs rbac alongside the chromium
 * projects, which is exactly when that would bite. Keeping this record out of USERS makes the
 * collision structurally impossible rather than a matter of project ordering.
 */
const E2E_ADMIN: RbacUser = {
    id: 'e2e-chromium-admin',
    email: 'e2e-chromium-admin+e2e@litcal.test',
    password: 'E2e-Test-Passw0rd!',
    role: 'admin',
    fga: null,
};

/**
 * Authentication setup for the calendar-data Playwright specs.
 *
 * Seeds a Zitadel administrator and logs it in through the real OIDC flow — session API →
 * PKCE authorize → auth-request finalize → token exchange — then writes the resulting
 * `litcal_access_token` / `litcal_id_token` cookies to the storageState the chromium projects
 * declare. This is the same machinery the rbac suite uses (support/seed.ts), so there is one
 * login implementation rather than two.
 *
 * It replaces a login against the API's legacy HS256 `POST /auth/login`. That endpoint's tokens
 * could never satisfy auth/me.php, which validates through JWKS, so Auth.isAuthenticated()
 * stayed false in the browser and every calendar-data spec timed out in waitForAuth() — even
 * though the same token was accepted server-side by AuthHelper. See issue #448.
 */
setup('authenticate', async ({ browser }) => {
    setup.setTimeout(120_000);

    const z = new ZitadelAdmin();

    // The session API needs IAM_LOGIN_CLIENT, which the machine token lacks. Mint a fresh,
    // session-capable PAT for the `login-client` user and delete it when done.
    const loginClientUserId = await z.findUserIdByUsername('login-client');
    if (!loginClientUserId) throw new Error('auth.setup: login-client machine user not found in Zitadel');
    const pat = await z.mintPat(loginClientUserId);

    try {
        const userId = await seedUserRecord(E2E_ADMIN);
        await loginAndSaveStateAs(E2E_ADMIN, pat.token, userId, authFile);
    } finally {
        // Surface (don't swallow) a revocation failure so a leaked ephemeral token is visible,
        // while still not masking a real error from the seeding above.
        await z.deletePat(loginClientUserId, pat.tokenId).catch((e) =>
            console.warn('auth.setup: failed to delete ephemeral PAT (token may persist):', String(e)),
        );
    }

    // Prove the saved state actually authenticates the *browser*, which is what the specs need.
    // Without this the setup passes on a token the client-side check rejects, and the failure
    // resurfaces as 52 separate waitForAuth() timeouts with no indication of the real cause —
    // precisely how #448 presented.
    const context = await browser.newContext({ storageState: authFile });
    try {
        const page = await context.newPage();
        await page.goto(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/extending.php?choice=national`);
        await expect
            .poll(() => page.evaluate(() => {
                // @ts-ignore - Auth is a global object
                return typeof Auth !== 'undefined' && Auth.isAuthenticated() === true;
            }), {
                timeout: 15_000,
                message: 'saved storageState did not authenticate the browser (auth/me.php rejected the token)',
            })
            .toBe(true);
    } finally {
        await context.close();
    }

    console.log(`Authentication setup complete — ${E2E_ADMIN.email} logged in via Zitadel OIDC, state saved to ${authFile}`);
});
