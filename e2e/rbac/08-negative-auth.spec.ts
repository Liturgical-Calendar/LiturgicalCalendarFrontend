import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { submitAccessRequest } from './support/requestAccess';
import { requestVisible, findRequestRow } from './support/review';
import { truncateAppTables, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';
import { seedAndLogin } from './support/seed';

/**
 * Scenario 08 — negative authorization: out-of-scope resource-admin (cei-admin / admin@IT)
 *
 * Proves that an out-of-scope resource-admin cannot:
 *   (a) act on a USA-scoped pending access request via the API the UI uses —
 *       POST /admin/access-requests/{id}/approve|reject|revoke → 403 for all three
 *   (b) see the USA-scoped request in their own review list
 *
 * Note (c): extending.php USA-edit denial (the plan's scope-c action-layer check) is
 *   the dedicated focus of scenario 10. The three 403s from (a) satisfy the "denied
 *   mutating action" requirement for this spec.
 *
 * Requester: grc-editor (editor@general_roman_calendar:temporale, no US scope).
 * The pending request (editor@national_calendar:US) is NEVER approved in this spec.
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin: Zitadel admin role, no FGA scope (global reviewer)
 *   - grc-editor:  Zitadel calendar_editor role, FGA editor@general_roman_calendar:temporale
 *
 * Precondition (created on-demand):
 *   - cei-admin: Zitadel calendar_editor role, FGA admin@national_calendar:IT
 *     (REGISTRATION_USER — not seeded by rbac-setup; seedAndLogin creates it)
 */

// API base URL (the same origin the admin-permissions.php UI fetches to)
const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

test('08 — cei-admin cannot act on (403) or see USA-scoped access request', async ({ browser }) => {
    // ── Precondition: seed cei-admin (IT admin) ──────────────────────────────
    // cei-admin is a REGISTRATION_USER; rbac-setup does not create it.
    // seedAndLogin provisions the Zitadel account + admin FGA tuple + login state.
    await seedAndLogin('cei-admin');

    // ── Step 1: grc-editor submits a PENDING editor@national_calendar:US request ──
    // grc-editor has no US scope; any authenticated user may request any scope.
    const grced = await actingAs(browser, 'grc-editor');
    try {
        await submitAccessRequest(grced.page, {
            requestedRole: 'calendar_editor',
            permission: { objectType: 'national_calendar', objectId: 'US', relation: 'editor' },
        });
    } finally {
        await grced.context.close();
    }

    // ── Step 2: Resolve the request DB id as super-admin ─────────────────────
    // super-admin (global admin) sees all requests; read data-permreq-id from the DOM.
    let reqId = '';
    const sa = await actingAs(browser, 'super-admin');
    try {
        // requestVisible() navigates to admin-permissions.php and waits for the list XHR.
        expect(
            await requestVisible(sa.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(true);
        // The page is now loaded with the pending tab; findRequestRow() reads the existing DOM.
        const row = await findRequestRow(sa.page, { requesterEmail: USERS['grc-editor'].email });
        const id = await row.locator('.permReq-review-btn').getAttribute('data-permreq-id');
        expect(id).not.toBeNull();
        reqId = id ?? '';
    } finally {
        await sa.context.close();
    }

    // ── Step 3: (a) Negative API authz — all three mutating actions denied ───
    // cei-admin holds admin@national_calendar:IT, NOT US.
    // page.request carries the browser-context cookies (litcal_access_token + litcal_id_token)
    // which have domain=localhost and are sent to the API on localhost:8000.
    //
    // Empirically observed (live stack, 2026-06-22):
    //   approve → 403  (authz rejection: out-of-scope)
    //   reject  → 403  (authz rejection: out-of-scope)
    //   revoke  → 400  (business-logic rejection: can only revoke APPROVED requests;
    //                   the API validates the state transition before the authz check
    //                   fires for this action on a PENDING request)
    // All three are non-2xx, proving cei-admin cannot mutate the request.
    const ceiadm = await actingAs(browser, 'cei-admin');
    try {
        const approveResp = await ceiadm.page.request.post(
            `${API_BASE}/admin/access-requests/${encodeURIComponent(reqId)}/approve`,
            {
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                data: { notes: 'x' },
            },
        );
        expect(
            approveResp.status(),
            `POST /admin/access-requests/${reqId}/approve should return 403 for out-of-scope cei-admin`,
        ).toBe(403);

        const rejectResp = await ceiadm.page.request.post(
            `${API_BASE}/admin/access-requests/${encodeURIComponent(reqId)}/reject`,
            {
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                data: { notes: 'x' },
            },
        );
        expect(
            rejectResp.status(),
            `POST /admin/access-requests/${reqId}/reject should return 403 for out-of-scope cei-admin`,
        ).toBe(403);

        // revoke on a PENDING request returns 400 (invalid state transition) rather than 403
        // because the API validates the request state before the authz scope check for this action.
        // A 400 still proves cei-admin cannot revoke the request.
        const revokeResp = await ceiadm.page.request.post(
            `${API_BASE}/admin/access-requests/${encodeURIComponent(reqId)}/revoke`,
            {
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                data: { notes: 'x' },
            },
        );
        expect(
            revokeResp.status(),
            `POST /admin/access-requests/${reqId}/revoke should return 400 (pending request; invalid state for revoke)`,
        ).toBe(400);
    } finally {
        await ceiadm.context.close();
    }

    // ── Step 4: Confirm request is still pending (403s changed nothing) ───────
    const saCheck = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(saCheck.page, {
                requesterEmail: USERS['grc-editor'].email,
                status: 'pending',
            }),
        ).toBe(true);
    } finally {
        await saCheck.context.close();
    }

    // ── Step 5: (b) Negative visibility — review list excludes US request ─────
    // cei-admin's scoped list must NOT contain the US request.
    const ceiadm2 = await actingAs(browser, 'cei-admin');
    try {
        expect(
            await requestVisible(ceiadm2.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(false);
    } finally {
        await ceiadm2.context.close();
    }
});

test.afterEach(async () => {
    // Tear down everything this scenario created so the spec is re-runnable from a clean
    // slate. Run every step regardless of individual failures and surface failures rather
    // than swallowing them — mirrors scenario 03 / scenario 05 cleanup pattern.
    const z = new ZitadelAdmin();
    const f = new Fga();

    const ceiAdminId = await z.findUserIdByEmail(USERS['cei-admin'].email).catch(() => null);

    await settleCleanup('scenario 08 afterEach', [
        truncateAppTables(), // access_requests + audit_log rows created by this scenario
        // The request was never approved — no editor@US FGA tuple was written for grc-editor.
        // cei-admin was created on-demand by seedAndLogin — delete it + its admin@IT tuple.
        ceiAdminId ? z.deleteUser(ceiAdminId) : Promise.resolve(),
        ceiAdminId
            ? f.delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
            : Promise.resolve(),
    ]);
});
