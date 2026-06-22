import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { submitAccessRequest, resubmitAccessRequest } from './support/requestAccess';
import { requestVisible, actOnRequest } from './support/review';
import { revokeScope } from './support/grant';
import { seedAndLogin } from './support/seed';
import { truncateAppTables } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * Scenario 02 — cei-editor requests editor@national_calendar:IT
 *
 * Full scoped-review lifecycle:
 *   submit → scoped visibility → reject → resubmit → approve → FGA/role assert
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin:  Zitadel admin role, no FGA scope
 *   - cei-editor:   Zitadel calendar_editor role, NO FGA tuple (earned via request)
 *   - usccb-admin:  Zitadel calendar_editor role, FGA admin@national_calendar:US
 *
 * Precondition (created on-demand):
 *   - cei-admin: Zitadel calendar_editor role, FGA admin@national_calendar:IT
 *     (REGISTRATION_USER — not seeded by rbac-setup; seedAndLogin creates it)
 */

test('02 — cei-editor edit@IT: scoped review lifecycle', async ({ browser }) => {
    // ── Precondition: seed cei-admin (IT admin) ──────────────────────────────
    // cei-admin is a REGISTRATION_USER; rbac-setup does not create it.
    // seedAndLogin provisions the Zitadel account + admin FGA tuple + login state.
    await seedAndLogin('cei-admin');

    // ── Step 1: cei-editor submits a request for editor@national_calendar:IT ─
    const ceied = await actingAs(browser, 'cei-editor');
    try {
        await submitAccessRequest(ceied.page, {
            requestedRole: 'calendar_editor',
            permission: { objectType: 'national_calendar', objectId: 'IT', relation: 'editor' },
        });
    } finally {
        await ceied.context.close();
    }

    // ── Step 2: Scoped visibility ─────────────────────────────────────────────
    // super-admin (global admin) → should see the request
    const sa = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(sa.page, { requesterEmail: USERS['cei-editor'].email }),
        ).toBe(true);
    } finally {
        await sa.context.close();
    }

    // cei-admin (admin@IT) → should see the request (scoped to IT)
    const ceiadm = await actingAs(browser, 'cei-admin');
    try {
        expect(
            await requestVisible(ceiadm.page, { requesterEmail: USERS['cei-editor'].email }),
        ).toBe(true);

        // ── Step 3: cei-admin rejects the request ────────────────────────────
        await actOnRequest(ceiadm.page, {
            requesterEmail: USERS['cei-editor'].email,
            action: 'reject',
            notes: 'fix scope',
        });
    } finally {
        await ceiadm.context.close();
    }

    // usccb-admin (admin@US) → must NOT see the IT request (different scope)
    const usccbadm = await actingAs(browser, 'usccb-admin');
    try {
        expect(
            await requestVisible(usccbadm.page, { requesterEmail: USERS['cei-editor'].email }),
        ).toBe(false);
    } finally {
        await usccbadm.context.close();
    }

    // ── Step 4: super-admin sees the rejection ────────────────────────────────
    const sa2 = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(sa2.page, {
                requesterEmail: USERS['cei-editor'].email,
                status: 'rejected',
            }),
        ).toBe(true);
    } finally {
        await sa2.context.close();
    }

    // ── Step 5: cei-editor revises and resubmits the rejected request ─────────
    // The resubmit flow: goto permission-requests.php, click .resubmit-btn on the
    // rejected row (openResubmitForm pre-fills form + sets #submitBtn to Resubmit
    // mode), click #submitBtn → POSTs to /auth/access-requests/{id}/resubmit →
    // request returns to pending (same row, no new row added).
    const ceied2 = await actingAs(browser, 'cei-editor');
    try {
        await resubmitAccessRequest(ceied2.page);
    } finally {
        await ceied2.context.close();
    }

    // ── Step 6: cei-admin approves the resubmitted request ───────────────────
    const ceiadm2 = await actingAs(browser, 'cei-admin');
    try {
        await actOnRequest(ceiadm2.page, {
            requesterEmail: USERS['cei-editor'].email,
            action: 'approve',
            notes: 'ok',
        });
    } finally {
        await ceiadm2.context.close();
    }

    // ── Step 7: Assert FGA tuple + role now exist for cei-editor ─────────────
    const z = new ZitadelAdmin();
    const zid = await z.findUserIdByEmail(USERS['cei-editor'].email);
    expect(zid).not.toBeNull();
    expect(
        await new Fga().check(`user:${zid}`, 'editor', 'national_calendar:IT'),
    ).toBe(true);

    // ── Step 8: super-admin sees the approval ─────────────────────────────────
    const sa3 = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(sa3.page, {
                requesterEmail: USERS['cei-editor'].email,
                status: 'approved',
            }),
        ).toBe(true);
    } finally {
        await sa3.context.close();
    }
});

test.afterEach(async () => {
    // Remove app-table rows created by this scenario.
    await truncateAppTables();

    // Revoke any FGA editor tuple that the approval may have written for cei-editor.
    await revokeScope('cei-editor');

    // Delete cei-admin — it was created on-demand by seedAndLogin and must be torn
    // down so it does not bleed into other specs.
    const z = new ZitadelAdmin();
    const ceiAdminId = await z.findUserIdByEmail(USERS['cei-admin'].email);
    if (ceiAdminId) {
        await z.deleteUser(ceiAdminId).catch(() => {});
        await new Fga()
            .delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
            .catch(() => {});
    }
});
