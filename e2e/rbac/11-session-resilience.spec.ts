import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { grantScope, revokeScope } from './support/grant';
import { truncateAppTables, gitRestoreApiData, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * Scenario 11 — session / token resilience.
 *
 * Proves three durable session-security properties of the cookie-only JWT auth
 * surface (HttpOnly `litcal_access_token` + `litcal_id_token`; endpoints served
 * by the FRONTEND origin: /auth/me.php, /auth/refresh.php, /auth/logout.php):
 *
 *   (a) Access-token loss → no silent session survival. Dropping the
 *       `litcal_access_token` cookie (keeping `litcal_id_token`) makes /auth/me
 *       report unauthenticated, and the app's recovery mechanism
 *       (POST /auth/refresh.php) cannot silently restore the session.
 *   (b) Logout then login-as-a-different-user → no stale auth. After clearing
 *       user A's cookies, /auth/me is unauthenticated (no stale A identity); a
 *       fresh user-B session reports B's identity with NO leakage of A.
 *   (c) Grant / revoke is reflected on the very next authorization decision with
 *       NO stale caching, backed by the durable OpenFGA tuple check.
 *
 * ── Empirically pinned behavior (live stack, 2026-06-22) ──────────────────────
 *
 * /auth/me.php and /auth/refresh.php are served by the FRONTEND origin (the
 * HttpOnly cookies have domain=localhost, so they are sent to :3000 and :8000
 * alike). Observed:
 *   - GET /auth/me.php  (valid cookies)        → 200 {authenticated:true, user:{email,roles,...}}
 *   - GET /auth/me.php  (access token removed)  → 200 {authenticated:false}   ← no 401, no auto-refresh
 *   - POST /auth/refresh.php (no refresh token)  → 401 {error:"No refresh token"}
 *
 * So part (a)'s REAL recovery branch is "re-auth required", NOT auto-refresh:
 * me.php proves authentication off the access token alone, and the seeded
 * sessions carry NO `litcal_refresh_token` cookie, so refresh.php cannot mint a
 * new access token. The session does not silently survive — it must re-authenticate.
 *
 * /auth/me surfaces ZITADEL PROJECT ROLES (admin / calendar_editor), NOT the
 * OpenFGA fine-grained scopes (editor@national_calendar:IT). A `grantScope` writes
 * an FGA editor tuple, which therefore does NOT appear in /auth/me. Part (c) thus
 * proves grant/revoke reflection at the FGA-backed AUTHORIZATION surface — the
 * exact `PATCH /data/nation/IT` write that extending.js / scenario 10 exercises —
 * plus the underlying Fga.check, which is the durable backing assertion.
 *
 * Re-runnable from a clean slate (passes twice): afterEach reverts the one IT
 * data write (gitRestoreApiData), truncates app tables, and revokes the dynamic
 * cei-editor grant (idempotent). The .auth/*.json files are never mutated — only
 * in-memory browser contexts are, and each is closed in a finally; every part
 * opens its own fresh actingAs context, so there is no cross-part contamination.
 */

// Frontend origin — serves /auth/me.php + /auth/refresh.php (where the HttpOnly cookies live).
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
// API origin — serves the /data write whose authorization is FGA-scoped (mirrors scenario 10).
const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

// The local stack bind-mounts the API repo; calendar edits land in the host API
// repo's jsondata/sourcedata. Resolution mirrors scenario 10 / gitRestoreApiData.
const API_REPO = process.env.API_REPO_PATH || path.resolve(__dirname, '../../../LiturgicalCalendarAPI');

/**
 * Build a canonical, schema-valid NationalCalendar PATCH body for IT — exactly the
 * structure extending.js assembles, so the write is a genuine authorized round-trip
 * of the existing definition. Copied from scenario 10.
 */
function buildItNationalPayload(): Record<string, unknown> {
    const itDir = path.join(API_REPO, 'jsondata', 'sourcedata', 'calendars', 'nations', 'IT');
    const def = JSON.parse(fs.readFileSync(path.join(itDir, 'IT.json'), 'utf8'));
    const i18nIt = JSON.parse(fs.readFileSync(path.join(itDir, 'i18n', 'it_IT.json'), 'utf8'));
    return {
        litcal: def.litcal,
        settings: def.settings,
        metadata: def.metadata,
        i18n: { it_IT: i18nIt },
    };
}

test('11a — access-token loss: /auth/me unauthenticates and refresh cannot silently recover', async ({ browser }) => {
    const sa = await actingAs(browser, 'super-admin');
    try {
        // ── Baseline: valid session is authenticated ─────────────────────────
        const meOk = await sa.page.request.get(`${FRONTEND}/auth/me.php`);
        expect(meOk.status()).toBe(200);
        const okBody = await meOk.json();
        expect(okBody.authenticated).toBe(true);
        expect(okBody.user.email).toBe(USERS['super-admin'].email);

        // ── Drop ONLY the access token cookie; keep the id token ─────────────
        // (clearCookies + addCookies is version-agnostic; the access token is the
        //  proof-of-authentication that me.php validates.)
        const cookies = await sa.context.cookies();
        await sa.context.clearCookies();
        await sa.context.addCookies(cookies.filter((c) => c.name !== 'litcal_access_token'));

        const remaining = await sa.context.cookies();
        expect(
            remaining.find((c) => c.name === 'litcal_access_token'),
            'litcal_access_token must be gone',
        ).toBeUndefined();
        expect(
            remaining.find((c) => c.name === 'litcal_id_token'),
            'litcal_id_token must still be present',
        ).toBeDefined();

        // ── /auth/me now reports unauthenticated (HTTP 200, no silent survival) ─
        const meGone = await sa.page.request.get(`${FRONTEND}/auth/me.php`);
        expect(meGone.status()).toBe(200);
        const goneBody = await meGone.json();
        expect(goneBody.authenticated).toBe(false);
        expect(goneBody.user, 'no stale user identity when access token is gone').toBeUndefined();

        // ── Recovery mechanism cannot silently restore the session ───────────
        // POST /auth/refresh.php → 401 (no refresh-token cookie) → re-auth required.
        // This is the app's REAL behavior: it does NOT auto-refresh into a still-valid
        // session; the user must re-authenticate.
        const refresh = await sa.page.request.post(`${FRONTEND}/auth/refresh.php`);
        expect(
            refresh.status(),
            'refresh must fail (401) — the session cannot silently survive access-token loss',
        ).toBe(401);
        const refreshBody = await refresh.json();
        expect(refreshBody.error).toBe('No refresh token');

        // ── And /auth/me is still unauthenticated after the failed refresh ───
        const meFinal = await sa.page.request.get(`${FRONTEND}/auth/me.php`);
        expect((await meFinal.json()).authenticated).toBe(false);
    } finally {
        await sa.context.close();
    }
});

test('11b — logout then login as a different user: no stale auth leakage', async ({ browser }) => {
    // ── User A (super-admin): authenticated, then logged out ─────────────────
    const a = await actingAs(browser, 'super-admin');
    try {
        const meA = await a.page.request.get(`${FRONTEND}/auth/me.php`);
        const aBody = await meA.json();
        expect(aBody.authenticated).toBe(true);
        expect(aBody.user.email).toBe(USERS['super-admin'].email);
        expect(aBody.user.roles).toContain('admin');

        // Exercise the REAL logout endpoint (local-only via ?zitadel=false to skip the Zitadel
        // end-session round-trip): it clears litcal_access_token / id_token / refresh_token via
        // Set-Cookie, which the shared request-context cookie jar honors; page.request follows the
        // post-logout redirect back to the frontend.
        const logoutResp = await a.page.request.get(`${FRONTEND}/auth/logout.php?zitadel=false`);
        expect(logoutResp.ok(), `/auth/logout.php should succeed; got ${logoutResp.status()}`).toBe(true);

        const meOut = await a.page.request.get(`${FRONTEND}/auth/me.php`);
        const outBody = await meOut.json();
        expect(outBody.authenticated, 'session is unauthenticated after real /auth/logout.php').toBe(false);
        expect(outBody.user, 'no stale user A identity after logout').toBeUndefined();
    } finally {
        await a.context.close();
    }

    // ── User B (cei-editor): fresh session, B's identity ONLY ────────────────
    const b = await actingAs(browser, 'cei-editor');
    try {
        const meB = await b.page.request.get(`${FRONTEND}/auth/me.php`);
        const bBody = await meB.json();
        expect(bBody.authenticated).toBe(true);
        expect(bBody.user.email).toBe(USERS['cei-editor'].email);
        // No leakage of A: not A's email, not A's `admin` role.
        expect(bBody.user.email).not.toBe(USERS['super-admin'].email);
        expect(bBody.user.roles).toContain('calendar_editor');
        expect(bBody.user.roles, "user A's admin role must not leak into B").not.toContain('admin');
    } finally {
        await b.context.close();
    }
});

test('11c — grant/revoke is reflected on the next authorization decision (no stale caching)', async ({ browser }) => {
    // Clean baseline: cei-editor holds NO editor@national_calendar:IT scope.
    await revokeScope('cei-editor'); // idempotent

    const z = new ZitadelAdmin();
    const fga = new Fga();
    const ceiEditorId = await z.findUserIdByEmail(USERS['cei-editor'].email);
    expect(ceiEditorId, 'cei-editor must be seeded in Zitadel').not.toBeNull();
    const subject = `user:${ceiEditorId}`;

    // /auth/me carries Zitadel roles, NOT FGA scopes — sanity-check the stable role
    // is present and independent of the FGA tuple we are about to toggle.
    {
        const cei = await actingAs(browser, 'cei-editor');
        try {
            const me = await cei.page.request.get(`${FRONTEND}/auth/me.php`);
            const body = await me.json();
            expect(body.authenticated).toBe(true);
            expect(body.user.roles).toContain('calendar_editor');
        } finally {
            await cei.context.close();
        }
    }

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'it-IT',
    };
    const body = buildItNationalPayload();

    // ── Phase 1 — NO scope: FGA false + the IT write is DENIED (403) ─────────
    expect(await fga.check(subject, 'editor', 'national_calendar:IT')).toBe(false);
    {
        const cei = await actingAs(browser, 'cei-editor');
        try {
            const r = await cei.page.request.patch(`${API_BASE}/data/nation/IT`, { headers, data: body });
            expect(
                r.status(),
                `PATCH /data/nation/IT must be DENIED (403) before the grant; got ${r.status()}`,
            ).toBe(403);
        } finally {
            await cei.context.close();
        }
    }

    // ── Phase 2 — GRANT mid-session: FGA true + the very next write is AUTHORIZED (201) ─
    await grantScope('cei-editor');
    expect(await fga.check(subject, 'editor', 'national_calendar:IT')).toBe(true);
    {
        const cei = await actingAs(browser, 'cei-editor');
        try {
            const r = await cei.page.request.patch(`${API_BASE}/data/nation/IT`, { headers, data: body });
            expect(
                r.ok(),
                `PATCH /data/nation/IT must be AUTHORIZED (2xx) immediately after the grant (no stale 403); got ${r.status()}: ${await r.text()}`,
            ).toBe(true);
        } finally {
            await cei.context.close();
        }
    }

    // ── Phase 3 — REVOKE mid-session: FGA false + the next write is DENIED again (403) ─
    await revokeScope('cei-editor');
    expect(await fga.check(subject, 'editor', 'national_calendar:IT')).toBe(false);
    {
        const cei = await actingAs(browser, 'cei-editor');
        try {
            const r = await cei.page.request.patch(`${API_BASE}/data/nation/IT`, { headers, data: body });
            expect(
                r.status(),
                `PATCH /data/nation/IT must be DENIED (403) immediately after the revoke (no stale 201); got ${r.status()}`,
            ).toBe(403);
        } finally {
            await cei.context.close();
        }
    }
});

test.afterEach(async () => {
    // Tear down everything any part may have created so the spec is re-runnable from a
    // clean slate. Run every step regardless of individual failures and surface failures
    // rather than swallowing them — mirrors scenario 10's cleanup.
    //
    //   - gitRestoreApiData(): revert part (c) phase-2's IT national-calendar write
    //     (no-op clean exit for parts a/b which write nothing).
    //   - truncateAppTables(): audit_log row written by the successful PATCH.
    //   - revokeScope('cei-editor'): remove the editor@national_calendar:IT FGA tuple
    //     (idempotent — tolerates already-revoked).
    await settleCleanup('scenario 11 afterEach', [
        gitRestoreApiData(),
        truncateAppTables(),
        revokeScope('cei-editor'),
    ]);
});
