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
 *   Calendar section (includes/admin-blocks.php, ALWAYS rendered for any calendar-role
 *   holder — see the gate below): six cards, each
 *       .admin-block[data-block-id="<id>"]
 *   with ids: temporale, sanctorale, decrees, widerregion, national, diocesan.
 *
 *   Global admin section (admin-dashboard.php L62, gated on `$isAdmin`): contains the
 *   Users / Role Requests / Applications / Permissions cards. Unique durable markers:
 *       a[href="admin-users.php"]          (only in the $isAdmin block)
 *       a[href="admin-applications.php"]   (only in the $isAdmin block)
 *   `a[href="admin-permissions.php"]` is NOT unique — it also backs the resource-admin
 *   review card (L160) — so it is deliberately not used to identify the global section.
 *
 *   Resource-admin review card (admin-dashboard.php L143, gated on
 *   `!$isAdmin && $authHelper->isResourceAdmin()`): the only `.admin-block` carrying the
 *   fa-inbox icon →
 *       .admin-block:has(i.fa-inbox)        ("Access Requests to Review")
 *
 * ── Gating (admin-dashboard.php) ──
 *   - L15  unauthenticated            → redirect to index.php
 *   - L24  $hasCalendarRole = admin | calendar_editor | test_editor
 *   - L29  !$hasCalendarRole          → redirect to developer-dashboard.php
 *           ⇒ every user that REACHES the dashboard renders ALL SIX calendar cards.
 *   - L62  $isAdmin                   → global admin section (admin-users/applications/…)
 *   - L143 !$isAdmin && isResourceAdmin() → single "Access Requests to Review" card
 *   `isResourceAdmin()` (src/AuthHelper.php) is true when the user holds an `admin` FGA
 *   tuple on ANY resource (national/diocesan/general_roman/wider_region). All *-admin
 *   users hold such a tuple; cei-editor holds none (editor grants are earned via UI).
 *
 * ── Empirically-confirmed per-user matrix (durable DOM) ──
 *   user          | 6 calendar cards | global admin section | review card (fa-inbox)
 *   --------------|------------------|----------------------|-----------------------
 *   super-admin   | visible          | VISIBLE              | hidden (gated on !$isAdmin)
 *   cei-admin     | visible          | hidden               | VISIBLE
 *   cei-editor    | visible          | hidden               | hidden
 *   usccb-admin   | visible          | hidden               | VISIBLE
 *   grc-admin     | visible          | hidden               | VISIBLE
 *   europe-admin  | visible          | hidden               | VISIBLE
 *
 * ── NOTE on "scope narrowing" (IT vs USA, romamo_it, GRC, Europe) ──
 *   The dashboard does NOT narrow calendar-CARD visibility by scope. admin-blocks.php
 *   renders all six cards unconditionally for every calendar-role holder, and the
 *   client JS (assets/js/admin-dashboard.js) only toggles per-card EDIT BUTTONS /
 *   COUNT BADGES, never the cards themselves. So cei-admin (IT), usccb-admin (US),
 *   grc-admin and europe-admin all see an IDENTICAL set of cards — scope enforcement
 *   lives downstream (extending.php / the API), not in card visibility. This spec
 *   therefore asserts the real, observable behaviour and explicitly verifies that all
 *   resource-admins see the same card set (no scope-based card hiding), rather than a
 *   per-scope card subset that the running app does not implement.
 *
 * Preconditions (seeded by rbac-setup): super-admin, cei-editor, usccb-admin,
 *   grc-admin, europe-admin (.auth/<id>.json each).
 * Precondition (created on-demand): cei-admin is a REGISTRATION_USER — not seeded by
 *   rbac-setup; seedAndLogin provisions it (Zitadel account + admin@IT tuple + .auth),
 *   and afterAll purges it.
 */

const CALENDAR_BLOCK_IDS = ['temporale', 'sanctorale', 'decrees', 'widerregion', 'national', 'diocesan'] as const;

const SEL = {
    heading: '.admin-dashboard-heading',
    calendarBlock: (id: string) => `.admin-block[data-block-id="${id}"]`,
    globalUsers: 'a[href="admin-users.php"]',
    globalApplications: 'a[href="admin-applications.php"]',
    reviewCard: '.admin-block:has(i.fa-inbox)',
} as const;

interface Expected {
    globalAdminSection: boolean; // Users + Applications cards ($isAdmin block)
    reviewCard: boolean; // "Access Requests to Review" (!$isAdmin && isResourceAdmin)
}

const MATRIX: Record<string, Expected> = {
    'super-admin': { globalAdminSection: true, reviewCard: false },
    'cei-admin': { globalAdminSection: false, reviewCard: true },
    'cei-editor': { globalAdminSection: false, reviewCard: false },
    'usccb-admin': { globalAdminSection: false, reviewCard: true },
    'grc-admin': { globalAdminSection: false, reviewCard: true },
    'europe-admin': { globalAdminSection: false, reviewCard: true },
};

async function assertMatrix(page: Page, expected: Expected): Promise<void> {
    await page.goto('/admin-dashboard.php');

    // Sanity gate: confirm we actually landed on the dashboard (not redirected to
    // index.php / developer-dashboard.php) before asserting card visibility.
    await expect(page.locator(SEL.heading)).toBeVisible();

    // All six calendar cards render for every calendar-role holder (no scope hiding).
    for (const id of CALENDAR_BLOCK_IDS) {
        await expect(page.locator(SEL.calendarBlock(id))).toBeVisible();
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
