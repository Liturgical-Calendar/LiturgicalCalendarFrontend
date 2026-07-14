import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { actingAs } from './support/actingAs';
import { seedAndLogin } from './support/seed';
import { settleCleanup } from './support/cleanup';
import { ZitadelAdmin } from './support/zitadel';
import { Fga } from './support/fga';
import { USERS } from './support/users';

/**
 * Scenario 07 — admin-dashboard card visibility matrix
 *
 * Asserts which `.admin-block` cards each role sees on /admin-dashboard.php, using
 * durable DOM (data-block-id / href / icon-class locators), not text/toasts.
 *
 * ── Pinned selectors (derived from admin-dashboard.php + includes/admin-blocks.php) ──
 *   Calendar section (includes/admin-blocks.php): six possible cards, each
 *       .admin-block[data-block-id="<id>"]
 *   with ids: temporale, sanctorale, decrees, widerregion, national, diocesan.
 *
 *   Global admin section (admin-dashboard.php L62, gated on `$isAdmin`): contains the
 *   Users / Applications / Permissions cards. Unique durable markers:
 *       a[href="admin-users.php"]          (only in the $isAdmin block)
 *       a[href="admin-applications.php"]   (only in the $isAdmin block)
 *   `a[href="admin-permissions.php"]` is NOT unique — it also backs the resource-admin
 *   review card (L167) — so it is deliberately not used to identify the global section.
 *
 *   Resource-admin review card (admin-dashboard.php L150, gated on
 *   `!$isAdmin && $authHelper->dashboardScopes()['is_resource_admin']`): the only
 *   `.admin-block` carrying the fa-inbox icon →
 *       .admin-block:has(i.fa-inbox)        ("Access Requests to Review")
 *
 * ── Gating (admin-dashboard.php + includes/admin-blocks.php) ──
 *   - L15  unauthenticated            → redirect to index.php
 *   - L24  $hasCalendarRole = admin | calendar_editor | test_editor
 *   - L29  !$hasCalendarRole          → redirect to developer-dashboard.php
 *   - L62  $isAdmin                   → global admin section (admin-users/applications/…)
 *   - L150 !$isAdmin && dashboardScopes()['is_resource_admin'] → "Access Requests to
 *          Review" card
 *
 *   admin-blocks.php (#399, relation-aware gating): sanctorale/widerregion/national/
 *   diocesan render unconditionally for any calendar-role holder. temporale and decrees,
 *   however, are each independently narrowed to:
 *       $isAdmin || ($authHelper->hasRole('calendar_editor') && canViewResource(...))
 *   i.e. non-admins additionally need viewer-or-above on
 *   general_roman_calendar:temporale (for the Temporale card) and
 *   general_roman_calendar:decrees (for the Decrees card). `isResourceAdmin()`
 *   (src/AuthHelper.php, via dashboardScopes()) is true when the user holds an `admin`
 *   FGA tuple on ANY resource (national/diocesan/general_roman/wider_region).
 *
 * ── NOTE on scope narrowing (issue #399) ──
 *   Prior to #399, the dashboard did not narrow calendar-CARD visibility by scope at
 *   all — all six cards rendered unconditionally for every calendar-role holder. The
 *   server-side `/auth/dashboard-scopes` endpoint (AuthHelper::dashboardScopes()) now
 *   narrows Temporale and Decrees specifically: a calendar_editor whose only FGA
 *   relation is on a national/diocesan/wider_region object (e.g. cei-admin on IT,
 *   usccb-admin on US, europe-admin on Europe) holds no viewer-or-above relation on
 *   general_roman_calendar, so temporale and decrees are both hidden for them. Only
 *   grc-admin (admin@general_roman_calendar:temporale) satisfies the Temporale gate —
 *   an `admin` relation on an FGA object also satisfies viewer-or-above self-checks —
 *   but even grc-admin's tuple is scoped to the `temporale` object id, not `decrees`,
 *   so decrees remains hidden for grc-admin too. The remaining four blocks
 *   (sanctorale/widerregion/national/diocesan) are unaffected by #399 and stay
 *   role-gated only, so they render for every user in the matrix below.
 *
 * Preconditions (seeded by rbac-setup): super-admin, cei-editor, usccb-admin,
 *   grc-admin, europe-admin (.auth/<id>.json each).
 * Precondition (created on-demand): cei-admin is a REGISTRATION_USER — not seeded by
 *   rbac-setup; seedAndLogin provisions it (Zitadel account + admin@IT tuple + .auth),
 *   and afterAll purges it.
 */

const SEL = {
    heading: '.admin-dashboard-heading',
    calendarBlock: (id: string) => `.admin-block[data-block-id="${id}"]`,
    globalUsers: 'a[href="admin-users.php"]',
    globalApplications: 'a[href="admin-applications.php"]',
    reviewCard: '.admin-block:has(i.fa-inbox)',
} as const;

interface Expected {
    visibleBlocks: readonly string[];
    hiddenBlocks: readonly string[];
    globalAdminSection: boolean; // Users + Applications cards ($isAdmin block)
    reviewCard: boolean; // "Access Requests to Review" (!$isAdmin && isResourceAdmin)
}

const ALWAYS_VISIBLE = ['sanctorale', 'widerregion', 'national', 'diocesan'] as const;

const MATRIX: Record<string, Expected> = {
    // Global admin: role bypasses all FGA gates — all six blocks.
    'super-admin': { visibleBlocks: [...ALWAYS_VISIBLE, 'temporale', 'decrees'], hiddenBlocks: [], globalAdminSection: true, reviewCard: false },
    // calendar_editors WITHOUT any general_roman_calendar relation: temporale + decrees hidden.
    'cei-admin': { visibleBlocks: [...ALWAYS_VISIBLE], hiddenBlocks: ['temporale', 'decrees'], globalAdminSection: false, reviewCard: true },
    'cei-editor': { visibleBlocks: [...ALWAYS_VISIBLE], hiddenBlocks: ['temporale', 'decrees'], globalAdminSection: false, reviewCard: false },
    'usccb-admin': { visibleBlocks: [...ALWAYS_VISIBLE], hiddenBlocks: ['temporale', 'decrees'], globalAdminSection: false, reviewCard: true },
    // admin@general_roman_calendar:temporale → temporale visible (viewer via admin), decrees still hidden.
    'grc-admin': { visibleBlocks: [...ALWAYS_VISIBLE, 'temporale'], hiddenBlocks: ['decrees'], globalAdminSection: false, reviewCard: true },
    'europe-admin': { visibleBlocks: [...ALWAYS_VISIBLE], hiddenBlocks: ['temporale', 'decrees'], globalAdminSection: false, reviewCard: true },
};

async function assertMatrix(page: Page, expected: Expected): Promise<void> {
    await page.goto('/admin-dashboard.php');

    // Sanity gate: confirm we actually landed on the dashboard (not redirected to
    // index.php / developer-dashboard.php) before asserting card visibility.
    await expect(page.locator(SEL.heading)).toBeVisible();

    for (const id of expected.visibleBlocks) {
        await expect(page.locator(SEL.calendarBlock(id))).toBeVisible();
    }
    for (const id of expected.hiddenBlocks) {
        await expect(page.locator(SEL.calendarBlock(id))).toHaveCount(0);
    }

    // Global admin section (global FGA-tuple management): super-admin only.
    if (expected.globalAdminSection) {
        await expect(page.locator(SEL.globalUsers)).toBeVisible();
        await expect(page.locator(SEL.globalApplications)).toBeVisible();
    } else {
        await expect(page.locator(SEL.globalUsers)).toHaveCount(0);
        await expect(page.locator(SEL.globalApplications)).toHaveCount(0);
    }

    // Resource-admin "Access Requests to Review" card.
    if (expected.reviewCard) {
        await expect(page.locator(SEL.reviewCard)).toBeVisible();
    } else {
        await expect(page.locator(SEL.reviewCard)).toHaveCount(0);
    }
}

test.describe.serial('07 — dashboard card scoping matrix', () => {
    test.beforeAll(async () => {
        // cei-admin is a REGISTRATION_USER (no .auth/cei-admin.json from rbac-setup).
        // seedAndLogin provisions the Zitadel account + admin@national_calendar:IT tuple
        // and writes the login storageState so actingAs(browser, 'cei-admin') works.
        await seedAndLogin('cei-admin');
    });

    for (const userId of Object.keys(MATRIX)) {
        test(`${userId} — card visibility`, async ({ browser }) => {
            const { context, page } = await actingAs(browser, userId);
            try {
                await assertMatrix(page, MATRIX[userId]);
            } finally {
                await context.close();
            }
        });
    }

    test.afterAll(async () => {
        // Purge the on-demand cei-admin (Zitadel user + admin@IT tuple + .auth file) so the
        // spec is re-runnable from a clean slate. Run every step regardless of individual
        // failures, and surface (don't swallow) any cleanup error.
        const z = new ZitadelAdmin();
        const f = new Fga();
        const ceiAdminId = await z.findUserIdByEmail(USERS['cei-admin'].email).catch(() => null);

        await settleCleanup('scenario 07 afterAll', [
            ceiAdminId ? z.deleteUser(ceiAdminId) : Promise.resolve(),
            ceiAdminId
                ? f.delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:IT')
                : Promise.resolve(),
            fs.promises.rm(path.join(__dirname, '..', '.auth', 'cei-admin.json'), { force: true }),
        ]);
    });
});
