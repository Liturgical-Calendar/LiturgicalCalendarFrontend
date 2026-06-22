import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { submitAccessRequest } from './support/requestAccess';
import { requestVisible, actOnRequest } from './support/review';
import { revokeScope } from './support/grant';
import { seedAndLogin } from './support/seed';
import { truncateAppTables } from './support/cleanup';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * Scenario 09 — revoke-after-grant lifecycle
 *
 * Asserts that revoking an approved access-request:
 *   1. Removes the FGA editor tuple from OpenFGA.
 *   2. Moves the request row to the 'revoked' status tab on admin-permissions.php.
 *   3. Shows the revoked badge on the requester's permission-requests.php.
 *   4. Does NOT remove the Zitadel calendar_editor role — so cei-editor still
 *      reaches admin-dashboard.php and sees all six calendar blocks (no scope-
 *      based card hiding: same behaviour documented in scenario 07).
 *
 * Preconditions (created on-demand):
 *   - cei-admin: Zitadel calendar_editor role, FGA admin@national_calendar:IT
 *     (REGISTRATION_USER — not seeded by rbac-setup; seedAndLogin creates it)
 *
 * Preconditions (seeded by rbac-setup):
 *   - cei-editor: Zitadel calendar_editor role, NO FGA editor tuple initially
 *   - super-admin: Zitadel admin role, no FGA scope
 *
 * Notification surface note:
 *   When a request is revoked the API writes an `access_request_reviewed`
 *   notification (status: 'revoked') to user_notification_state for the
 *   requester. The notification bell on any frontend page fetches
 *   /auth/notifications when the dropdown opens and renders a fa-ban icon
 *   with "Your access was revoked". This is asserted below via the bell
 *   dropdown.
 */

const CALENDAR_BLOCK_IDS = [
    'temporale', 'sanctorale', 'decrees', 'widerregion', 'national', 'diocesan',
] as const;

test('09 — revoke-after-grant: FGA tuple removed and request shows revoked status', async ({ browser }) => {
    // ── Precondition: seed cei-admin (IT admin) ───────────────────────────────
    await seedAndLogin('cei-admin');

    // ── Step 1: cei-editor submits request for editor@national_calendar:IT ────
    const ceied = await actingAs(browser, 'cei-editor');
    try {
        await submitAccessRequest(ceied.page, {
            requestedRole: 'calendar_editor',
            permission: { objectType: 'national_calendar', objectId: 'IT', relation: 'editor' },
        });
    } finally {
        await ceied.context.close();
    }

    // ── Step 2: cei-admin approves the request ────────────────────────────────
    const ceiadm = await actingAs(browser, 'cei-admin');
    try {
        await actOnRequest(ceiadm.page, {
            requesterEmail: USERS['cei-editor'].email,
            action: 'approve',
            notes: 'ok',
        });
    } finally {
        await ceiadm.context.close();
    }

    // ── Step 3: Sanity — FGA tuple now EXISTS ─────────────────────────────────
    const z = new ZitadelAdmin();
    const ceiEditorId = await z.findUserIdByEmail(USERS['cei-editor'].email);
    expect(ceiEditorId).not.toBeNull();
    expect(
        await new Fga().check(`user:${ceiEditorId}`, 'editor', 'national_calendar:IT'),
    ).toBe(true);

    // ── Step 4: cei-admin revokes the grant ───────────────────────────────────
    const ceiadm2 = await actingAs(browser, 'cei-admin');
    try {
        await actOnRequest(ceiadm2.page, {
            requesterEmail: USERS['cei-editor'].email,
            action: 'revoke',
            notes: 'revoked',
        });
    } finally {
        await ceiadm2.context.close();
    }

    // ── Step 5: CORE — FGA tuple is REMOVED ──────────────────────────────────
    expect(
        await new Fga().check(`user:${ceiEditorId}`, 'editor', 'national_calendar:IT'),
    ).toBe(false);

    // ── Step 6: CORE — request row appears in 'revoked' tab (admin view) ─────
    const ceiadm3 = await actingAs(browser, 'cei-admin');
    try {
        expect(
            await requestVisible(ceiadm3.page, {
                requesterEmail: USERS['cei-editor'].email,
                status: 'revoked',
            }),
        ).toBe(true);
    } finally {
        await ceiadm3.context.close();
    }

    // ── Step 7: Secondary — requester sees revoked badge on permission-requests.php ──
    // The bg-secondary badge with fa-ban icon is rendered for any revoked request
    // (permission-requests.js statusInfo map, line 78). This is a durable DOM assertion.
    const ceied2 = await actingAs(browser, 'cei-editor');
    try {
        await ceied2.page.goto('/permission-requests.php');
        await expect(ceied2.page.locator('#existingRequestsBody .fa-spinner')).toHaveCount(0);
        // A revoked row carries a bg-secondary badge with the fa-ban icon.
        await expect(
            ceied2.page.locator('#existingRequestsBody .badge.bg-secondary i.fa-ban'),
        ).toBeVisible();

        // ── Step 8: Secondary — notification bell shows revoked notification ─
        // Click the bell dropdown; fetchNotifications() fires on 'show.bs.dropdown'.
        // The API writes the notification synchronously on revoke, so it is present.
        // Selector: #notificationsList .fa-ban.text-warning (notifications.js _renderReviewedRequest)
        await ceied2.page.click('#notificationsDropdown');
        await expect(
            ceied2.page.locator('#notificationsList .fa-ban.text-warning'),
        ).toBeVisible({ timeout: 5000 });
    } finally {
        await ceied2.context.close();
    }

    // ── Step 9: Secondary — cei-editor still reaches dashboard (role intact) ──
    // Revoking the FGA tuple does NOT remove the Zitadel calendar_editor role.
    // cei-editor therefore still passes the dashboard gate and sees all six
    // calendar blocks (no scope-based card hiding — matches scenario 07 matrix).
    const ceied3 = await actingAs(browser, 'cei-editor');
    try {
        await ceied3.page.goto('/admin-dashboard.php');
        await expect(ceied3.page.locator('.admin-dashboard-heading')).toBeVisible();
        for (const id of CALENDAR_BLOCK_IDS) {
            await expect(ceied3.page.locator(`.admin-block[data-block-id="${id}"]`)).toBeVisible();
        }
        // The resource-admin "Access Requests to Review" card must NOT appear
        // (cei-editor holds no admin FGA tuple).
        await expect(ceied3.page.locator('.admin-block:has(i.fa-inbox)')).toHaveCount(0);
    } finally {
        await ceied3.context.close();
    }
});

test.afterEach(async () => {
    // Tear down everything this scenario created. Run every step regardless of
    // individual failures (a thrown truncate must not skip the identity/tuple
    // cleanup, or state leaks into other specs), and surface failures rather
    // than swallowing them.
    const z = new ZitadelAdmin();
    const ceiAdminId = await z.findUserIdByEmail(USERS['cei-admin'].email).catch(() => null);

    const results = await Promise.allSettled([
        truncateAppTables(), // app-table rows created by this scenario
        revokeScope('cei-editor'), // FGA editor tuple the approval may have written
        // cei-admin was created on-demand by seedAndLogin — delete it + its admin tuple.
        ceiAdminId ? z.deleteUser(ceiAdminId) : Promise.resolve(),
        ceiAdminId
            ? new Fga().delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
            : Promise.resolve(),
        fs.promises.rm(path.join(__dirname, '..', '.auth', 'cei-admin.json'), { force: true }),
    ]);

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
        console.warn(
            'scenario 09 afterEach: cleanup failures:',
            failures.map((f) => String((f as PromiseRejectedResult).reason)),
        );
    }
});
