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
 *   admin-blocks.php: sanctorale/widerregion/national/diocesan render unconditionally for
 *   any calendar-role holder. temporale and decrees are each narrowed to:
 *       $isAdmin || $authHelper->canViewRiteCalendarResource('roman', ...)
 *   and reading comes from the role (LiturgicalCalendarAPI #1049): that call is true for
 *   every role whose scope includes rite_calendar (AuthHelper::ROLE_READABLE_TYPES —
 *   calendar_editor and developer), whatever tuples the user holds. `isResourceAdmin()`
 *   (src/AuthHelper.php, via dashboardScopes()) is true when the user holds an `admin`
 *   FGA tuple on ANY resource (national/diocesan/rite_calendar/wider_region).
 *
 * ── NOTE on read access (issue #399, then API #1049) ──
 *   #399 narrowed Temporale and Decrees to users holding a viewer-or-above tuple on the
 *   rite-level object. #1049 retired `viewer` for people: every calendar_editor now sees
 *   both cards through the role alone — including cei-editor, usccb-admin and
 *   europe-admin, none of whom holds a tuple on rite_calendar:roman/decrees. The
 *   negative case is a calendar-role holder whose role does NOT read rite_calendar:
 *   tests-editor-noscope (test_editor, no tuple) lands on the dashboard but sees
 *   neither card.
 *
 * Preconditions (seeded by rbac-setup): super-admin, cei-editor, usccb-admin,
 *   grc-admin, europe-admin, tests-editor-noscope (.auth/<id>.json each).
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

const ALL_CALENDAR_BLOCKS = [...ALWAYS_VISIBLE, 'temporale', 'decrees'] as const;

const MATRIX: Record<string, Expected> = {
    // Global admin: role bypasses all FGA gates — all six blocks.
    'super-admin': { visibleBlocks: [...ALL_CALENDAR_BLOCKS], hiddenBlocks: [], globalAdminSection: true, reviewCard: false },
    // calendar_editors read rite_calendar through the role (API #1049): all six blocks,
    // although none of them holds a tuple on rite_calendar:roman/decrees (and only
    // grc-admin holds one on rite_calendar:roman/temporale).
    'cei-admin': { visibleBlocks: [...ALL_CALENDAR_BLOCKS], hiddenBlocks: [], globalAdminSection: false, reviewCard: true },
    'cei-editor': { visibleBlocks: [...ALL_CALENDAR_BLOCKS], hiddenBlocks: [], globalAdminSection: false, reviewCard: false },
    'usccb-admin': { visibleBlocks: [...ALL_CALENDAR_BLOCKS], hiddenBlocks: [], globalAdminSection: false, reviewCard: true },
    'grc-admin': { visibleBlocks: [...ALL_CALENDAR_BLOCKS], hiddenBlocks: [], globalAdminSection: false, reviewCard: true },
    'europe-admin': { visibleBlocks: [...ALL_CALENDAR_BLOCKS], hiddenBlocks: [], globalAdminSection: false, reviewCard: true },
    // test_editor, no tuple: reaches the dashboard, but its role does not read rite_calendar,
    // so temporale + decrees stay hidden.
    'tests-editor-noscope': { visibleBlocks: [...ALWAYS_VISIBLE], hiddenBlocks: ['temporale', 'decrees'], globalAdminSection: false, reviewCard: false },
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
                ? f.delete(`user:${ceiAdminId}`, 'admin', 'national_calendar:roman/IT')
                : Promise.resolve(),
            fs.promises.rm(path.join(__dirname, '..', '.auth', 'cei-admin.json'), { force: true }),
        ]);
    });
});
