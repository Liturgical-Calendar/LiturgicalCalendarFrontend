import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { registerAndVerify } from './support/register';
import { submitAccessRequest } from './support/requestAccess';
import { requestVisible, actOnRequest } from './support/review';
import { seedAndLogin } from './support/seed';
import { truncateAppTables, settleCleanup } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * Scenario 04 — usccb-editor self-registers, then requests editor@national_calendar:US
 *
 * The last registration scenario: it fuses scenario 01's real Zitadel self-registration
 * mechanics with scenario 02's resource-admin-approval lifecycle.
 *
 *   register+verify → submit → scoped visibility matrix → in-scope admin grants → FGA assert
 *
 * usccb-editor is a REGISTRATION_USER — NOT seeded by rbac-setup. It creates its own account
 * through the real Zitadel login-v2 UI (registerAndVerify), which leaves `page` logged in
 * (litcal_access_token + litcal_id_token cookies). We persist that auth state to
 * .auth/usccb-editor.json so a later actingAs('usccb-editor') could re-enter the identity.
 *
 * Unlike scenario 01 (whose registrant had NO in-scope admin and so was driven by super-admin),
 * here usccb-admin (admin@US) IS the in-scope resource-admin and grants the editor@US request
 * on its own resource — exactly like scenario 02's cei-admin approving editor@IT.
 *
 * Visibility matrix (scoping is by {object_type, object_id}, relation-agnostic):
 *   - usccb-admin (admin@US) → true   (in-scope by object)
 *   - super-admin            → true   (global admin)
 *   - cei-admin   (admin@IT) → false  (out-of-scope — different object)
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin:  Zitadel admin role, no FGA scope (global reviewer)
 *   - usccb-admin:  Zitadel calendar_editor role, FGA admin@national_calendar:US
 *
 * Precondition (created on-demand):
 *   - cei-admin: Zitadel calendar_editor role, FGA admin@national_calendar:IT
 *     (REGISTRATION_USER — not seeded by rbac-setup; seedAndLogin creates it). Needed so the
 *     out-of-scope (false) assertion exercises a real IT admin rather than a missing user.
 *
 * Precondition (enforced here): no pre-existing usccb-editor Zitadel account — registerAndVerify
 * does not recover if the email already exists, so beforeAll deletes any leftover. This is what
 * makes the spec re-runnable from a clean slate.
 */

const USCCB_EDITOR_AUTH = path.join(__dirname, '..', '.auth', 'usccb-editor.json');

/**
 * Remove every artefact this scenario creates for usccb-editor: its editor@US FGA tuple,
 * its Zitadel account, and the persisted auth-state file. Used both as a precondition
 * (registerAndVerify fails opaquely if the user already exists) and as teardown.
 */
async function purgeUsccbEditor(): Promise<void> {
    const z = new ZitadelAdmin();
    const f = new Fga();
    // findUserIdByEmail returns null when absent (no throw); Fga.delete tolerates not-found and
    // deleteUser tolerates 404 internally. So we deliberately do NOT swallow here — a genuine
    // failure (Zitadel/OpenFGA unreachable, unexpected status) propagates and surfaces (fails
    // beforeAll, or via settleCleanup in teardown) instead of silently leaving stale state.
    const zid = await z.findUserIdByEmail(USERS['usccb-editor'].email);
    if (zid) {
        await f.delete(`user:${zid}`, 'editor', 'national_calendar:US');
        await z.deleteUser(zid);
    }
    if (fs.existsSync(USCCB_EDITOR_AUTH)) {
        fs.rmSync(USCCB_EDITOR_AUTH);
    }
}

test.beforeAll(async () => {
    // Precondition: a clean slate. registerAndVerify cannot recover from a pre-existing
    // account, so delete any leftover usccb-editor (+ tuple, + stale auth file) first.
    await purgeUsccbEditor();
});

test('04 — usccb-editor registers + editor@US: resource-admin grant', async ({ page, browser }) => {
    const editor = USERS['usccb-editor'];

    // ── Precondition: seed cei-admin (IT admin) ──────────────────────────────────
    // cei-admin is a REGISTRATION_USER; rbac-setup does not create it. seedAndLogin
    // provisions the Zitadel account + admin@IT FGA tuple + login state, so the
    // out-of-scope visibility assertion exercises a real IT admin.
    await seedAndLogin('cei-admin');

    // ── Step 1: usccb-editor self-registers through the real Zitadel UI ───────────
    // RbacUser carries no first/last name; supply them for the registration form.
    // registerAndVerify leaves `page` logged in (auth cookies set on FRONTEND_URL).
    await registerAndVerify(page, {
        ...editor,
        firstName: 'Usccb',
        lastName: 'Editor',
    });

    // Persist the freshly-authenticated state so a later actingAs('usccb-editor') could
    // re-enter this identity after the admin-reviewer contexts close.
    await page.context().storageState({ path: USCCB_EDITOR_AUTH });

    // ── Step 2: usccb-editor submits a request for editor@national_calendar:US ─────
    await submitAccessRequest(page, {
        requestedRole: 'calendar_editor',
        permission: { objectType: 'national_calendar', objectId: 'US', relation: 'editor' },
    });

    // ── Step 3: Scoped visibility matrix ──────────────────────────────────────────
    // super-admin (global admin) → should see the pending request.
    const sa = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(sa.page, { requesterEmail: editor.email }),
        ).toBe(true);
    } finally {
        await sa.context.close();
    }

    // cei-admin (admin@IT) → must NOT see the US request (different scope).
    const ceiadm = await actingAs(browser, 'cei-admin');
    try {
        expect(
            await requestVisible(ceiadm.page, { requesterEmail: editor.email }),
        ).toBe(false);
    } finally {
        await ceiadm.context.close();
    }

    // usccb-admin (admin@US) → must see the request (in-scope by object) and grants it.
    const usccbadm = await actingAs(browser, 'usccb-admin');
    try {
        expect(
            await requestVisible(usccbadm.page, { requesterEmail: editor.email }),
        ).toBe(true);

        // ── Step 4: usccb-admin (in-scope resource-admin) approves the request ────
        await actOnRequest(usccbadm.page, {
            requesterEmail: editor.email,
            action: 'approve',
            notes: 'ok',
        });
    } finally {
        await usccbadm.context.close();
    }

    // ── Step 5: Assert the FGA tuple editor@national_calendar:US now exists ───────
    const z = new ZitadelAdmin();
    const zid = await z.findUserIdByEmail(editor.email);
    expect(zid).not.toBeNull();
    expect(
        await new Fga().check(`user:${zid}`, 'editor', 'national_calendar:US'),
    ).toBe(true);

    // ── Step 6: super-admin sees the approval (durable DOM evidence of the grant) ─
    const saFinal = await actingAs(browser, 'super-admin');
    try {
        expect(
            await requestVisible(saFinal.page, { requesterEmail: editor.email, status: 'approved' }),
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
    const ceiAdminId = await z.findUserIdByEmail(USERS['cei-admin'].email).catch(() => null);

    await settleCleanup('scenario 04 afterEach', [
        truncateAppTables(), // app-table rows created by this scenario
        purgeUsccbEditor(), // usccb-editor Zitadel account + editor@US tuple + persisted auth file
        // cei-admin was created on-demand by seedAndLogin — delete it + its admin@IT tuple.
        ceiAdminId ? z.deleteUser(ceiAdminId) : Promise.resolve(),
        ceiAdminId
            ? new Fga().delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
            : Promise.resolve(),
    ]);
});
