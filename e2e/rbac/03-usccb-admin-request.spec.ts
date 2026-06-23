import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { submitAccessRequest } from './support/requestAccess';
import { requestVisible, actOnRequest } from './support/review';
import { truncateAppTables, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';
import { seedAndLogin } from './support/seed';

/**
 * Scenario 03 — admin@USA request: scoping boundary
 *
 * Proves a pending admin@national_calendar:US request is NOT visible to an out-of-scope
 * resource-admin (cei-admin / admin@IT), while in-scope admins see it and can act on it.
 *
 * Visibility matrix:
 *   - cei-admin  (admin@IT) → false  ← headline assertion (the scoping boundary)
 *   - usccb-admin (admin@US) → true  (in-scope by object)
 *   - super-admin            → true  (global admin)
 *
 * Requester: grc-editor (editor@general_roman_calendar:temporale, no US scope).
 * Seeded by rbac-setup; .auth/grc-editor.json exists.
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin:   Zitadel admin role, no FGA scope (global reviewer)
 *   - grc-editor:    Zitadel calendar_editor role, FGA editor@general_roman_calendar:temporale
 *   - usccb-admin:   Zitadel calendar_editor role, FGA admin@national_calendar:US
 *
 * Precondition (created on-demand):
 *   - cei-admin: Zitadel calendar_editor role, FGA admin@national_calendar:IT
 *     (REGISTRATION_USER — not seeded by rbac-setup; seedAndLogin creates it)
 */

test('03 — admin@USA request not visible to cei-admin (out-of-scope IT admin)', async ({ browser }) => {
    // ── Precondition: seed cei-admin (IT admin) ──────────────────────────────
    // cei-admin is a REGISTRATION_USER; rbac-setup does not create it.
    // seedAndLogin provisions the Zitadel account + admin FGA tuple + login state.
    await seedAndLogin('cei-admin');

    // ── Step 1: grc-editor submits a request for admin@national_calendar:US ──
    const grced = await actingAs(browser, 'grc-editor');
    try {
        await submitAccessRequest(grced.page, {
            requestedRole: 'calendar_editor',
            permission: { objectType: 'national_calendar', objectId: 'US', relation: 'admin' },
        });
    } finally {
        await grced.context.close();
    }

    // ── Step 2: Scoped visibility matrix ──────────────────────────────────────

    // cei-admin (admin@IT) → must NOT see the US request (different scope — headline assertion)
    const ceiadm = await actingAs(browser, 'cei-admin');
    try {
        expect(
            await requestVisible(ceiadm.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(false);
    } finally {
        await ceiadm.context.close();
    }

    // usccb-admin (admin@US) → must see the request (in-scope by object)
    const usccbadm = await actingAs(browser, 'usccb-admin');
    try {
        expect(
            await requestVisible(usccbadm.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(true);
    } finally {
        await usccbadm.context.close();
    }

    // super-admin (global admin) → must see the request
    const sa = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(sa.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(true);
    } finally {
        await sa.context.close();
    }

    // ── Step 3: super-admin approves ──────────────────────────────────────────
    const saApprove = await actingAs(browser, 'super-admin');
    try {
        await actOnRequest(saApprove.page, {
            requesterEmail: USERS['grc-editor'].email,
            action: 'approve',
            notes: 'ok',
        });
    } finally {
        await saApprove.context.close();
    }

    // ── Step 4: Assert the FGA tuple admin@national_calendar:US now exists ───
    const z = new ZitadelAdmin();
    const zid = await z.findUserIdByEmail(USERS['grc-editor'].email);
    expect(zid).not.toBeNull();
    expect(
        await new Fga().check(`user:${zid}`, 'admin', 'national_calendar:US'),
    ).toBe(true);

    // ── Step 5: Durable DOM evidence — super-admin sees the approval ──────────
    const saFinal = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(saFinal.page, {
                requesterEmail: USERS['grc-editor'].email,
                status: 'approved',
            }),
        ).toBe(true);
    } finally {
        await saFinal.context.close();
    }
});

test.afterEach(async () => {
    // Tear down everything this scenario created so the spec is re-runnable from a clean
    // slate. Run every step regardless of individual failures (a thrown truncate must not
    // skip the identity/tuple cleanup, or state leaks into other specs), and surface
    // failures rather than swallowing them.
    const z = new ZitadelAdmin();
    const f = new Fga();

    const [grcEditorId, ceiAdminId] = await Promise.all([
        z.findUserIdByEmail(USERS['grc-editor'].email).catch(() => null),
        z.findUserIdByEmail(USERS['cei-admin'].email).catch(() => null),
    ]);

    await settleCleanup('scenario 03 afterEach', [
        truncateAppTables(), // app-table rows created by this scenario
        // Revoke the admin@US tuple the approval may have written for grc-editor
        grcEditorId
            ? f.delete(`user:${grcEditorId}`, 'admin', 'national_calendar:US')
            : Promise.resolve(),
        // cei-admin was created on-demand by seedAndLogin — delete it + its admin@IT tuple
        ceiAdminId ? z.deleteUser(ceiAdminId) : Promise.resolve(),
        ceiAdminId
            ? f.delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
            : Promise.resolve(),
    ]);
});
