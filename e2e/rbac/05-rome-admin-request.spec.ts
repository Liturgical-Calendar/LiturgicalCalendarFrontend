import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { submitAccessRequest } from './support/requestAccess';
import { requestVisible, actOnRequest } from './support/review';
import { truncateAppTables } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';
import { seedAndLogin } from './support/seed';

/**
 * Scenario 05 — admin@romamo_it request: diocesan scoping boundary
 *
 * Proves a pending admin@diocesan_calendar:romamo_it request is visible ONLY to
 * rome-admin (admin@romamo_it) and super-admin, and NOT to national admins whose
 * scope is a different object (cei-admin / admin@IT, usccb-admin / admin@US).
 *
 * Visibility matrix:
 *   - rome-admin  (admin@romamo_it) → true   (in-scope by object)
 *   - super-admin                   → true   (global admin)
 *   - cei-admin   (admin@IT)        → false  (different national scope)
 *   - usccb-admin (admin@US)        → false  (different national scope)
 *
 * Requester: grc-editor (editor@general_roman_calendar:temporale, holds NO romamo_it scope).
 * Seeded by rbac-setup; .auth/grc-editor.json exists.
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin:   Zitadel admin role, no FGA scope (global reviewer)
 *   - grc-editor:    Zitadel calendar_editor role, FGA editor@general_roman_calendar:temporale
 *   - rome-admin:    Zitadel calendar_editor role, FGA admin@diocesan_calendar:romamo_it
 *   - usccb-admin:   Zitadel calendar_editor role, FGA admin@national_calendar:US
 *
 * Precondition (created on-demand):
 *   - cei-admin: Zitadel calendar_editor role, FGA admin@national_calendar:IT
 *     (REGISTRATION_USER — not seeded by rbac-setup; seedAndLogin creates it)
 */

test('05 — admin@romamo_it request: rome-admin + super-admin see it; cei-admin + usccb-admin do not', async ({ browser }) => {
    // ── Precondition: seed cei-admin (IT national admin) ─────────────────────
    // cei-admin is a REGISTRATION_USER; rbac-setup does not create it.
    // seedAndLogin provisions the Zitadel account + admin FGA tuple + login state.
    await seedAndLogin('cei-admin');

    // ── Step 1: grc-editor submits a request for admin@diocesan_calendar:romamo_it ──
    const grced = await actingAs(browser, 'grc-editor');
    try {
        await submitAccessRequest(grced.page, {
            requestedRole: 'calendar_editor',
            permission: { objectType: 'diocesan_calendar', objectId: 'romamo_it', relation: 'admin' },
        });
    } finally {
        await grced.context.close();
    }

    // ── Step 2: Scoped visibility matrix ─────────────────────────────────────

    // rome-admin (admin@romamo_it) → must see the request (in-scope by object)
    const romeadm = await actingAs(browser, 'rome-admin');
    try {
        expect(
            await requestVisible(romeadm.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(true);
    } finally {
        await romeadm.context.close();
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

    // cei-admin (admin@IT) → must NOT see the request (different national scope)
    const ceiadm = await actingAs(browser, 'cei-admin');
    try {
        expect(
            await requestVisible(ceiadm.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(false);
    } finally {
        await ceiadm.context.close();
    }

    // usccb-admin (admin@US) → must NOT see the request (different national scope)
    const usccbadm = await actingAs(browser, 'usccb-admin');
    try {
        expect(
            await requestVisible(usccbadm.page, { requesterEmail: USERS['grc-editor'].email }),
        ).toBe(false);
    } finally {
        await usccbadm.context.close();
    }

    // ── Step 3: super-admin approves ─────────────────────────────────────────
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

    // ── Step 4: Assert the FGA tuple admin@diocesan_calendar:romamo_it now exists ──
    const z = new ZitadelAdmin();
    const zid = await z.findUserIdByEmail(USERS['grc-editor'].email);
    expect(zid).not.toBeNull();
    expect(
        await new Fga().check(`user:${zid}`, 'admin', 'diocesan_calendar:romamo_it'),
    ).toBe(true);

    // ── Step 5: Durable DOM evidence — super-admin sees the approved row ──────
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

    const results = await Promise.allSettled([
        truncateAppTables(), // app-table rows created by this scenario
        // Revoke the admin@romamo_it tuple the approval may have written for grc-editor
        grcEditorId
            ? f.delete(`user:${grcEditorId}`, 'admin', 'diocesan_calendar:romamo_it')
            : Promise.resolve(),
        // cei-admin was created on-demand by seedAndLogin — delete it + its admin@IT tuple
        ceiAdminId ? z.deleteUser(ceiAdminId) : Promise.resolve(),
        ceiAdminId
            ? f.delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
            : Promise.resolve(),
    ]);

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
        console.warn(
            'scenario 05 afterEach: cleanup failures:',
            failures.map((r) => String((r as PromiseRejectedResult).reason)),
        );
    }
});
