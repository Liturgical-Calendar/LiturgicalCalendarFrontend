import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { registerAndVerify } from './support/register';
import { submitAccessRequest, resubmitAccessRequest } from './support/requestAccess';
import { requestVisible, actOnRequest } from './support/review';
import { truncateAppTables, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * Scenario 01 — cei-admin self-registers, then requests admin@national_calendar:IT
 *
 * Full scoped-review lifecycle, with REAL Zitadel self-registration prepended:
 *   register+verify → submit → scoped visibility → reject → resubmit → approve → FGA assert
 *
 * cei-admin is a REGISTRATION_USER — NOT seeded by rbac-setup. It creates its own
 * account through the real Zitadel login-v2 UI (registerAndVerify), which leaves the
 * page logged in (litcal_access_token + litcal_id_token cookies). We persist that auth
 * state to .auth/cei-admin.json so a later actingAs() can re-enter the same identity
 * (its first contexts are closed when the spec switches to the admin reviewers).
 *
 * Key contrast with scenario 02: cei-admin has NO admin tuple at submit time, so it
 * cannot review its OWN request — only super-admin (global admin) can see it. usccb-admin
 * (admin@US) must NOT see it (different scope). super-admin drives the reject/approve.
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin:  Zitadel admin role, no FGA scope (global reviewer)
 *   - usccb-admin:  Zitadel calendar_editor role, FGA admin@national_calendar:US
 *
 * Precondition (enforced here): no pre-existing cei-admin Zitadel account — registerAndVerify
 * does not recover if the email already exists, so beforeAll deletes any leftover. This is
 * what makes the spec re-runnable from a clean slate.
 */

const CEI_ADMIN_AUTH = path.join(__dirname, '..', '.auth', 'cei-admin.json');

/**
 * Remove every artefact this scenario creates for cei-admin: its admin@IT FGA tuple,
 * its Zitadel account, and the persisted auth-state file. Used both as a precondition
 * (registerAndVerify fails opaquely if the user already exists) and as teardown.
 */
async function purgeCeiAdmin(): Promise<void> {
    const z = new ZitadelAdmin();
    const f = new Fga();
    // findUserIdByEmail returns null when absent (no throw); Fga.delete tolerates not-found and
    // deleteUser tolerates 404 internally. So we deliberately do NOT swallow here — a genuine
    // failure (Zitadel/OpenFGA unreachable, unexpected status) propagates and surfaces (fails
    // beforeAll, or via settleCleanup in teardown) instead of silently leaving stale state.
    const zid = await z.findUserIdByEmail(USERS['cei-admin'].email);
    if (zid) {
        await f.delete(`user:${zid}`, 'admin', 'national_calendar:roman/IT');
        await z.deleteUser(zid);
    }
    if (fs.existsSync(CEI_ADMIN_AUTH)) {
        fs.rmSync(CEI_ADMIN_AUTH);
    }
}

test.beforeAll(async () => {
    // Precondition: a clean slate. registerAndVerify cannot recover from a pre-existing
    // account, so delete any leftover cei-admin (+ tuple, + stale auth file) first.
    await purgeCeiAdmin();
});

test('01 — cei-admin registers + admin@IT: scoped review lifecycle', async ({ page, browser }) => {
    const cei = USERS['cei-admin'];

    // ── Step 1: cei-admin self-registers through the real Zitadel UI ─────────────
    // RbacUser carries no first/last name; supply them for the registration form.
    // registerAndVerify leaves `page` logged in (auth cookies set on FRONTEND_URL).
    await registerAndVerify(page, {
        email: cei.email,
        password: cei.password,
        firstName: 'Cei',
        lastName: 'Admin',
    });

    // Persist the freshly-authenticated state so a later actingAs('cei-admin') (for the
    // resubmit) can re-enter this identity after the admin-reviewer contexts close.
    await page.context().storageState({ path: CEI_ADMIN_AUTH });

    // ── Step 2: cei-admin submits a request for admin@national_calendar:IT ───────
    await submitAccessRequest(page, {
        requestedRole: 'calendar_editor',
        permission: { objectType: 'national_calendar', objectId: 'IT', relation: 'admin' },
    });

    // ── Step 3: Scoped visibility (cei-admin is NOT yet an IT admin) ─────────────
    // super-admin (global admin) → should see the pending request.
    const sa = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(sa.page, { requesterEmail: cei.email }),
        ).toBe(true);
    } finally {
        await sa.context.close();
    }

    // usccb-admin (admin@US) → must NOT see the IT request (different scope).
    const usccbadm = await actingAs(browser, 'usccb-admin');
    try {
        expect(
            await requestVisible(usccbadm.page, { requesterEmail: cei.email }),
        ).toBe(false);
    } finally {
        await usccbadm.context.close();
    }

    // ── Step 4: super-admin rejects the request (with notes) ─────────────────────
    const saReject = await actingAs(browser, 'super-admin');
    try {
        await actOnRequest(saReject.page, {
            requesterEmail: cei.email,
            action: 'reject',
            notes: 'please narrow the justification',
        });
        // super-admin now sees it in the rejected tab.
        expect(
            await requestVisible(saReject.page, { requesterEmail: cei.email, status: 'rejected' }),
        ).toBe(true);
    } finally {
        await saReject.context.close();
    }

    // ── Step 5: cei-admin revises + resubmits the rejected request ───────────────
    // Re-enter cei-admin via the persisted auth state. Resubmit reuses the rejected
    // row (POST /auth/access-requests/{id}/resubmit) — no new row, honouring the
    // API's one-pending-request-per-(user,role) constraint.
    const ceiResubmit = await actingAs(browser, 'cei-admin');
    try {
        await resubmitAccessRequest(ceiResubmit.page);
    } finally {
        await ceiResubmit.context.close();
    }

    // ── Step 6: super-admin approves the resubmitted request ─────────────────────
    const saApprove = await actingAs(browser, 'super-admin');
    try {
        await actOnRequest(saApprove.page, {
            requesterEmail: cei.email,
            action: 'approve',
            notes: 'approved',
        });
    } finally {
        await saApprove.context.close();
    }

    // ── Step 7: Assert the FGA tuple admin@national_calendar:IT now exists ───────
    const z = new ZitadelAdmin();
    const zid = await z.findUserIdByEmail(cei.email);
    expect(zid).not.toBeNull();
    expect(
        await new Fga().check(`user:${zid}`, 'admin', 'national_calendar:roman/IT'),
    ).toBe(true);

    // ── Step 8: super-admin sees the approval (durable DOM evidence of the grant) ─
    const saFinal = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(saFinal.page, { requesterEmail: cei.email, status: 'approved' }),
        ).toBe(true);
    } finally {
        await saFinal.context.close();
    }
});

test.afterEach(async () => {
    // Tear down everything this scenario created so the spec is re-runnable from a clean
    // slate. Run every step regardless of individual failures (a thrown truncate must not
    // skip the identity/tuple cleanup, or state leaks into other specs).
    await settleCleanup('scenario 01 afterEach', [
        truncateAppTables(), // app-table rows created by this scenario
        purgeCeiAdmin(), // cei-admin Zitadel account + admin@IT tuple + persisted auth file
    ]);
});
