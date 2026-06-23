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
 * Scenario 10 — scoped DATA editing: a user scoped to IT can write the IT
 * national-calendar definition but is DENIED writing the USA one.
 *
 * This proves the `/data`-endpoint write authorization that extending.php /
 * assets/js/extending.js exercises. The UI's "Save" handler
 * (serializeRegionalNationalDataClicked → makeAuthenticatedRequest) issues a
 * `PATCH ${RegionalDataUrl}/nation/{KEY}` with `credentials: 'include'` and a
 * NationalCalendar payload ({ litcal, settings, metadata, i18n }).
 * RegionalDataUrl = `${apiBaseUrl}/data` (src/ApiConfig.php).
 *
 * Authorization is enforced server-side at the API Router (LiturgicalCalendarAPI
 * src/Router.php, route `data`): the pipeline pipes
 *   AuthorizationMiddleware::forCalendarEditor()          (Zitadel role gate)
 *   OpenFgaAuthorizationMiddleware::forCalendarData(...)  (FGA fine-grained)
 * The FGA middleware maps `/data/nation/{id}` + PUT|PATCH → an `editor` check on
 * `national_calendar:{id}`. Both middlewares run BEFORE the handler parses /
 * validates the request body, so the USA denial fires independently of payload
 * shape — the SAME valid body sent by the SAME user is accepted for IT and
 * rejected (403) for US; only the scope differs.
 *
 * Path choice (B): we drive the underlying `/data` write directly via the
 * authenticated page.request context (it carries cei-editor's litcal_access_token
 * / litcal_id_token cookies, identical to what extending.js sends) rather than
 * puppeting the full calendar-definition UI edit. This is the exact request the
 * UI makes and is far less flaky than driving a multi-step DOM edit — mirrors the
 * direct-request approach used by scenario 08.
 *
 * Precondition (seeded on-demand here, NOT by rbac-setup):
 *   - cei-editor: Zitadel calendar_editor role (seeded) + FGA
 *     editor@national_calendar:IT (granted by grantScope below; rbac-setup does
 *     not seed editor tuples).
 *
 * CRITICAL cleanup: the IT PATCH persists to the API repo's jsondata/sourcedata
 * (bind-mounted). afterEach MUST call gitRestoreApiData() to revert it (plus
 * truncateAppTables + revokeScope). The spec is re-runnable from a clean slate.
 */

// API base URL (the same origin the extending.php "Save" XHR fetches to).
const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

// The local stack bind-mounts the API repo; calendar edits land in the host API
// repo's jsondata/sourcedata. Resolution mirrors cleanup.ts / gitRestoreApiData.
const API_REPO = process.env.API_REPO_PATH || path.resolve(__dirname, '../../../LiturgicalCalendarAPI');

/**
 * Build a canonical, schema-valid NationalCalendar PATCH body for IT by reading
 * the stored source files. This is exactly the structure extending.js assembles
 * (litcal/settings/metadata split out from the locale-keyed i18n map), so the
 * write is a genuine authorized round-trip of the existing definition
 * (i18n limited to it_IT).
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

test('10 — scoped data editing: cei-editor writes IT (ok) but is denied USA (403)', async ({ browser }) => {
    // ── Precondition: grant cei-editor its editor@national_calendar:IT scope ──
    // rbac-setup seeds the Zitadel role but NOT the FGA editor tuple.
    await grantScope('cei-editor');

    // Sanity — the FGA editor tuple now EXISTS for cei-editor on IT.
    const z = new ZitadelAdmin();
    const ceiEditorId = await z.findUserIdByEmail(USERS['cei-editor'].email);
    expect(ceiEditorId).not.toBeNull();
    expect(
        await new Fga().check(`user:${ceiEditorId}`, 'editor', 'national_calendar:IT'),
    ).toBe(true);
    // ...and does NOT exist for the USA calendar (cei-editor holds no US scope).
    expect(
        await new Fga().check(`user:${ceiEditorId}`, 'editor', 'national_calendar:US'),
    ).toBe(false);

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // extending.js forwards Accept-Language from the selected calendar locale.
        'Accept-Language': 'it-IT',
    };
    const body = buildItNationalPayload();

    const cei = await actingAs(browser, 'cei-editor');
    try {
        // ── Step 1: IT edit → SUCCESS ────────────────────────────────────────
        // PATCH the IT national-calendar definition (a round-trip of the existing
        // litcal/settings/metadata (i18n limited to it_IT)). cei-editor holds
        // editor@national_calendar:IT → authorized.
        const itResp = await cei.page.request.patch(
            `${API_BASE}/data/nation/IT`,
            { headers, data: body },
        );
        expect(
            itResp.ok(),
            'PATCH /data/nation/IT should succeed (2xx) for cei-editor scoped to IT; got ' + itResp.status() + ': ' + await itResp.text(),
        ).toBe(true);

        // ── Step 2: USA edit → DENIED ────────────────────────────────────────
        // SAME user, SAME valid body, only the target scope differs. cei-editor
        // holds no US scope → the FGA middleware rejects with 403 before the
        // handler ever parses the body.
        const usResp = await cei.page.request.patch(
            `${API_BASE}/data/nation/US`,
            { headers, data: body },
        );
        expect(
            usResp.status(),
            `PATCH /data/nation/US should return 403 for cei-editor (no US scope); got ${usResp.status()}: ${await usResp.text()}`,
        ).toBe(403);
    } finally {
        await cei.context.close();
    }
});

test.afterEach(async () => {
    // Tear down everything this scenario created so the spec is re-runnable from a
    // clean slate. Run every step regardless of individual failures and surface
    // failures rather than swallowing them.
    //
    // gitRestoreApiData() reverts the IT PATCH's write to the bind-mounted API
    // source data — without it the IT.json edit would persist across runs.
    await settleCleanup('scenario 10 afterEach', [
        gitRestoreApiData(), // revert the IT national-calendar source-file edit
        truncateAppTables(), // audit_log row written by the successful PATCH
        revokeScope('cei-editor'), // remove the editor@national_calendar:IT FGA tuple
    ]);
});
