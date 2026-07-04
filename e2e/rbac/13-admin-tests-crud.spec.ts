/**
 * Scenario 13 — admin-tests CRUD (real RBAC)
 *
 * Proves that:
 *   - A national test_editor scoped to IT can create a test within scope and
 *     is denied an Edit button on out-of-scope (general_roman) rows.
 *   - A global admin (super-admin) can delete any test.
 *
 * The `test_editor` Zitadel role is not pre-seeded by rbac-setup (it is
 * earned through the access-request workflow, as spec 12 demonstrates). To
 * exercise real CRUD, `beforeAll` provisions an ephemeral user
 * (`test-editor-it`) with that role + an FGA `editor` tuple on
 * `national_calendar_test:IT`, then logs in headlessly and writes
 * `e2e/.auth/test-editor-it.json` so `actingAs` can load the session.
 *
 * `afterAll` tears everything down:
 *   - Deletes the ephemeral Zitadel user + FGA tuple.
 *   - Truncates audit_log rows created by the API write operations.
 *   - Removes the transient auth state file.
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin: Zitadel `admin` role; `.auth/super-admin.json` pre-written.
 *   - login-client: Zitadel machine user with IAM PAT-issuance rights.
 */

import { test, expect, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { truncateAppTables, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { oidcLogin } from './support/seed';

// ── Constants ─────────────────────────────────────────────────────────────────

/** National calendar whose test scope is exercised. IT is used because spec 12
 *  already references `national_calendar_test:IT`, keeping harness coverage consistent. */
const NATION          = 'IT';

/** Test name satisfying the API schema: `^(?:[a-z_]+?_){0,1}[A-Z][a-zA-Z1-9]+[0-9]{0,2}(?:_vigil)?Test$` */
const TEST_NAME       = 'PlaywrightScopedNationalTest';

/** Event key present in the General Roman Calendar (and therefore in every national
 *  calendar that extends it). Avoids having to seed national-specific events.
 *  NB: the API's real key is `StIgnatiusLoyola` (no "Of") — see
 *  jsondata/sourcedata/missals/propriumdesanctis_1970. An unmatched key makes the
 *  editor silently skip generation and the API reject the empty payload with 400. */
const EVENT_KEY       = 'StIgnatiusLoyola';

/** Key used for `.auth/${id}.json` lookup by `actingAs`. Must be unique across
 *  all seeded users so it does not collide with rbac-setup-provisioned files. */
const EDITOR_USER_ID  = 'test-editor-it';
const EDITOR_EMAIL    = `${EDITOR_USER_ID}+e2e@litcal.test`;
const EDITOR_PASSWORD = 'E2e-Test-Passw0rd!'; // shared test password (mirrors other e2e users)

/** Pre-seeded by rbac-setup; Zitadel `admin` role bypasses all API role checks. */
const GLOBAL_ADMIN_ID = 'super-admin';

/** API base URL — same env convention as spec 08; domain=localhost cookies in a
 *  storageState are sent to the API port, so an authenticated request context
 *  built from `.auth/super-admin.json` can call protected API routes directly. */
const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

// Resolved in beforeAll; used in afterAll cleanup even if a test partially fails.
let editorZitadelId: string | null = null;

/** Path where actingAs(browser, EDITOR_USER_ID) expects the auth state file. */
// NB: this spec lives in e2e/rbac/ (one level above support/), so the shared
// e2e/.auth/ directory that actingAs() reads from is '../.auth' — NOT '../../.auth'.
const authFilePath = path.join(__dirname, '..', '.auth', `${EDITOR_USER_ID}.json`);

// ── Spec ──────────────────────────────────────────────────────────────────────

test.describe('admin-tests CRUD (real RBAC)', () => {

    // ── Provisioning ──────────────────────────────────────────────────────────

    test.beforeAll(async () => {
        // Extend timeout: Zitadel user creation + OIDC headless login can take ~30 s.
        test.setTimeout(120_000);

        const z = new ZitadelAdmin();
        const f = new Fga();

        // Mint an ephemeral session-capable PAT for the login-client machine user
        // (required by the OIDC headless session flow — mirrors rbac.setup.ts pattern).
        const loginClientUserId = await z.findUserIdByUsername('login-client');
        if (!loginClientUserId) {
            throw new Error('scenario 13 beforeAll: login-client machine user not found in Zitadel');
        }
        const { tokenId: patId, token: loginClientToken } = await z.mintPat(loginClientUserId);

        try {
            // Idempotent teardown: remove any stale test-editor-it user left by a
            // previous failed run so re-runs start from a clean slate.
            const staleId = await z.findUserIdByEmail(EDITOR_EMAIL);
            if (staleId) {
                await f.delete(`user:${staleId}`, 'editor', `national_calendar_test:${NATION}`)
                    .catch(() => {}); // tolerate already-absent tuple
                await z.deleteUser(staleId);
            }

            // 1. Create Zitadel user with the `test_editor` project role.
            //    grantProjectRole accepts any role string; `test_editor` is the
            //    role checked by AuthorizationMiddleware::forTestEditor() in the API.
            editorZitadelId = await z.createVerifiedUser({
                email: EDITOR_EMAIL,
                password: EDITOR_PASSWORD,
                firstName: EDITOR_USER_ID,
                lastName: 'E2E',
            });
            await z.grantProjectRole(editorZitadelId, 'test_editor');

            // 2. Write the FGA `editor` tuple on national_calendar_test:IT.
            //    Mirrors the tuple that the access-request approval flow would write
            //    after a `test_editor` request is reviewed (see spec 12 for that flow).
            await f.write(`user:${editorZitadelId}`, 'editor', `national_calendar_test:${NATION}`);

            // 3. Headless OIDC login → write .auth/test-editor-it.json.
            //    Mirrors the logic in loginAndSaveState() from support/seed.ts.
            //    The `test_editor` role is baked into the token because the role was
            //    granted to the user BEFORE this login call.
            const { accessToken, idToken } = await oidcLogin(
                EDITOR_EMAIL,
                EDITOR_PASSWORD,
                loginClientToken,
                editorZitadelId,
            );
            const cookieBase = {
                domain: 'localhost', path: '/', expires: -1,
                httpOnly: true, secure: false, sameSite: 'Lax' as const,
            };
            const cookies = [{ name: 'litcal_access_token', value: accessToken, ...cookieBase }];
            if (idToken) cookies.push({ name: 'litcal_id_token', value: idToken, ...cookieBase });
            fs.mkdirSync(path.dirname(authFilePath), { recursive: true });
            fs.writeFileSync(authFilePath, JSON.stringify({ cookies, origins: [] }, null, 2));
        } finally {
            // Always revoke the ephemeral login-client PAT.
            await z.deletePat(loginClientUserId, patId).catch((e) =>
                console.warn(
                    'scenario 13 beforeAll: PAT revocation failed (token may persist):',
                    String(e),
                ),
            );
        }
    });

    // ── Test 1: scoped editor creates a test within scope ──────────────────────

    test('scoped national test_editor creates within scope and is denied Edit outside', async ({ browser }) => {
        const tei = await actingAs(browser, EDITOR_USER_ID);
        try {
            await tei.page.goto('/admin-tests.php');
            await expect(tei.page.locator('#testsTableBody')).toBeVisible();

            // Open the create modal.
            await tei.page.locator('#createTestBtn').click();
            await tei.page.locator('#tt-exact').check({ force: true });
            await tei.page.locator('#testName').fill(TEST_NAME);

            // Select national_calendar scope. syncScopeIdField() asynchronously mounts
            // a CalendarSelect with id="testScopeId" — wait for it before selecting.
            await tei.page.locator('#testScopeType').selectOption('national_calendar');
            await expect(tei.page.locator('#testScopeId')).toBeVisible();
            await tei.page.locator('#testScopeId').selectOption(NATION);

            // Fill the event key and dispatch the change event (triggers datalist reload).
            await tei.page.locator('#testEventKey').fill(EVENT_KEY);
            await tei.page.locator('#testEventKey').dispatchEvent('change');

            // The editor auto-fills the description once the event key matches the
            // loaded /events catalog — assert it BEFORE saving so a key/catalog
            // mismatch fails here (the true cause) rather than at the row check.
            await expect(tei.page.locator('#testDescription')).not.toHaveValue('');

            // Save → expect the new row to appear in the table.
            await tei.page.locator('#saveTestBtn').click();
            await expect(tei.page.locator('tr', { hasText: TEST_NAME })).toBeVisible();

            // Out-of-scope gating (client-side FGA gate from GET /auth/test-scopes):
            // any existing general-roman-scoped row must NOT show an Edit button to
            // this nationally-scoped editor. The scope column renders the i18n label
            // "General Roman Calendar" (not the object_type literal), and the API
            // repo ships GRC-scoped definitions in jsondata/tests, so at least one
            // such row must exist — assert it, so this gating check can never be
            // silently skipped.
            const grcRow = tei.page.locator('tr', { hasText: 'General Roman' }).first();
            await expect(grcRow).toBeVisible();
            await expect(grcRow.getByRole('button', { name: 'Edit' })).toHaveCount(0);
        } finally {
            await tei.context.close();
        }
    });

    // ── Test 2: global admin deletes the test created above ───────────────────

    test('global admin can delete any test', async ({ browser }) => {
        const adm = await actingAs(browser, GLOBAL_ADMIN_ID);
        try {
            await adm.page.goto('/admin-tests.php');
            const row = adm.page.locator('tr', { hasText: TEST_NAME });
            // Fail with a clear message if Test 1 did not create the row.
            await expect(row).toBeVisible();
            await row.getByRole('button', { name: 'Delete' }).click();
            await adm.page.locator('#confirmDeleteTestBtn').click();
            await expect(adm.page.locator('tr', { hasText: TEST_NAME })).toHaveCount(0);
        } finally {
            await adm.context.close();
        }
    });

    // ── Cleanup ───────────────────────────────────────────────────────────────

    test.afterAll(async () => {
        const z = new ZitadelAdmin();
        const f = new Fga();

        const cleanupOps: Array<Promise<unknown>> = [
            // Purge audit_log rows written by the PUT /tests and DELETE /tests calls.
            truncateAppTables(),
            // Best-effort removal of the created test definition via the API, so a
            // failed Test 2 cannot orphan it. Test definitions are files under the
            // API's jsondata/tests/ (not DB rows), so truncateAppTables cannot reach
            // them — and a leftover file reds every subsequent run with a
            // duplicate-name conflict on PUT /tests. Uses the pre-seeded super-admin
            // session; a 404 (already deleted by Test 2) is a successful no-op.
            (async () => {
                const api = await request.newContext({
                    storageState: path.join(__dirname, '..', '.auth', `${GLOBAL_ADMIN_ID}.json`),
                });
                try {
                    await api.delete(`${API_BASE}/tests/${encodeURIComponent(TEST_NAME)}`);
                } finally {
                    await api.dispose();
                }
            })(),
        ];

        // Remove the ephemeral test_editor user + FGA tuple.
        // Fall back to email lookup if beforeAll failed before assigning editorZitadelId.
        const uid = editorZitadelId ?? await z.findUserIdByEmail(EDITOR_EMAIL).catch(() => null);
        if (uid) {
            // Fga.delete tolerates "not found" — safe if test 2 already deleted the tuple.
            cleanupOps.push(
                f.delete(`user:${uid}`, 'editor', `national_calendar_test:${NATION}`),
            );
            // ZitadelAdmin.deleteUser tolerates 404 — safe on re-runs where the user is absent.
            cleanupOps.push(z.deleteUser(uid));
        }

        await settleCleanup('scenario 13 afterAll', cleanupOps);

        // Remove the transient auth state file written by beforeAll.
        // Best-effort: a missing file on a first/failed run is not an error.
        try { fs.unlinkSync(authFilePath); } catch { /* absent — nothing to remove */ }
    });
});
