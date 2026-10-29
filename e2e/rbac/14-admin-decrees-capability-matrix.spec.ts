/**
 * Scenario 14 — admin-decrees capability matrix (real FGA)
 *
 * The admin-decrees page (`admin-decrees.php` + `assets/js/admin-decrees.js`) gates its UI on three
 * capability tiers. Reading comes from the role (LiturgicalCalendarAPI #1049): `canView` is
 * `AuthHelper::canViewType('rite_calendar')`, true for a global admin and for every role whose scope
 * includes rite_calendar (calendar_editor, developer). Editing and administering still come from the
 * caller's relation on the FGA object `rite_calendar:roman/decrees` (plus the global-admin bypass):
 *
 *   | Tier        | Granted to                                | UI surface                                              |
 *   | ----------- | ----------------------------------------- | ------------------------------------------------------- |
 *   | canView     | global admin, or a role reading the type  | page + read-only cards                                  |
 *   | canEdit     | global admin, or editor+                  | + "New Decree" button, per-card Edit buttons            |
 *   | canAdmin    | global admin, or admin                    | + per-card Delete buttons, page-level Manage-perms link |
 *   | (no role)   | test_editor (role does not read the type) | redirected to admin-dashboard.php                       |
 *   | (anonymous) | —                                         | redirected off the admin page                           |
 *
 * This spec proves each tier end-to-end against the live stack. Rather than provision ephemeral users, it
 * grants a `rite_calendar:roman/decrees` relation at runtime to existing seeded `calendar_editor` users
 * whose own scopes are on OTHER object types/ids (national/wider_region), so those scopes can never affect
 * the decrees page — which only checks `rite_calendar:roman/decrees`. The FGA model's union semantics mean
 * an `admin` tuple also satisfies the `editor` self-check, so one tuple per user yields the intended tier.
 * The read-only tier needs NO tuple: a calendar_editor whose only scope is elsewhere reads through the role.
 * All tuples are torn down in `afterAll`.
 *
 * Preconditions (seeded by rbac-setup):
 *   - super-admin: Zitadel `admin` role (global bypass); `.auth/super-admin.json` pre-written.
 *   - usccb-admin / europe-editor / rome-editor: Zitadel `calendar_editor` role with a scope on a
 *     non-`rite_calendar` object; `.auth/<id>.json` pre-written.
 *   - tests-editor-noscope: Zitadel `test_editor` role, no tuple; `.auth/tests-editor-noscope.json` pre-written.
 *   - The decrees catalog served by the API must contain at least one decree: the read-only/editor/admin
 *     assertions use `.first()` locators against rendered cards and per-card edit/delete buttons.
 *   - env for the Fga helper: OPENFGA_API_URL / OPENFGA_STORE_ID / OPENFGA_MODEL_ID.
 *   - env for the ZitadelAdmin helper (subject resolution): ZITADEL_ISSUER / ZITADEL_MACHINE_TOKEN /
 *     ZITADEL_ORG_ID / ZITADEL_PROJECT_ID.
 */

import { test, expect, Browser } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * The single FGA object that governs the entire decrees admin surface.
 *
 * Rite-qualified since #955 generalised the rite-level tier: the retired
 * `general_roman_calendar` type was dropped from the model outright at the prune
 * milestone (CatholicOS/cdcf-infra#44), so a tuple naming it is rejected by
 * OpenFGA before any API code runs.
 */
const DECREES_OBJECT = 'rite_calendar:roman/decrees';

/**
 * Seeded calendar_editor users repurposed as decrees editor/admin by a runtime tuple.
 * Each user's pre-existing scope is on a different object type/id, so it does not affect this page.
 * `viewer` is not granted to people any more (API #1049): reading comes from the role.
 */
const GRANTS: Array<{ userKey: string; relation: 'editor' | 'admin' }> = [
    { userKey: 'usccb-admin', relation: 'editor' }, // admin@national_calendar:US    → decrees editor
    { userKey: 'europe-editor', relation: 'admin' }, // editor@wider_region:europe    → decrees admin
];

/** A seeded calendar_editor with NO decrees relation → reads through the role: read-only cards. */
const ROLE_ONLY_USER = 'rome-editor'; // editor@diocesan_calendar:romamo_it

/** A seeded user whose role does not read rite_calendar → redirected off the page. */
const NO_ROLE_USER = 'tests-editor-noscope'; // test_editor, no tuple

async function subOf(email: string): Promise<string> {
    const id = await new ZitadelAdmin().findUserIdByEmail(email);
    if (!id) throw new Error(`admin-decrees matrix: user ${email} is not seeded in Zitadel`);
    return id;
}

/** Card wrappers only (edit/delete buttons also carry data-decree-id). */
const CARD = '#decreesContainer > .col-12[data-decree-id]';

test.describe('admin-decrees capability matrix (real FGA)', () => {
    /** Resolved Zitadel subjects, cached in beforeAll and reused for afterAll teardown. */
    const grantedSubs = new Map<string, string>();

    test.beforeAll(async () => {
        test.setTimeout(60_000);
        const f = new Fga();
        for (const g of GRANTS) {
            const sub = await subOf(USERS[g.userKey].email);
            grantedSubs.set(g.userKey, sub);
            await f.write(`user:${sub}`, g.relation, DECREES_OBJECT);
        }
    });

    test.afterAll(async () => {
        const f = new Fga();
        for (const g of GRANTS) {
            // Reuse the subject resolved in beforeAll; a second Zitadel lookup here could
            // fail transiently and silently skip teardown, leaking the tuple.
            const sub = grantedSubs.get(g.userKey);
            if (sub) await f.delete(`user:${sub}`, g.relation, DECREES_OBJECT).catch(() => {});
        }
    });

    async function open(browser: Browser, userKey: string) {
        const session = await actingAs(browser, userKey);
        await session.page.goto('/admin-decrees.php');
        return session;
    }

    test('global admin sees create, edit, delete, and manage-permissions', async ({ browser }) => {
        const s = await open(browser, 'super-admin');
        try {
            await expect(s.page.locator('#btnCreateDecree')).toBeVisible();
            await expect(s.page.locator('#lnkManagePermissions')).toBeVisible();
            await expect(s.page.locator('[data-action="edit"]').first()).toBeVisible();
            await expect(s.page.locator('[data-action="delete"]').first()).toBeVisible();
        } finally {
            await s.context.close();
        }
    });

    test('decrees admin sees create, edit, delete, and manage-permissions', async ({ browser }) => {
        const s = await open(browser, 'europe-editor');
        try {
            await expect(s.page.locator('#btnCreateDecree')).toBeVisible();
            await expect(s.page.locator('#lnkManagePermissions')).toBeVisible();
            await expect(s.page.locator('[data-action="edit"]').first()).toBeVisible();
            await expect(s.page.locator('[data-action="delete"]').first()).toBeVisible();
        } finally {
            await s.context.close();
        }
    });

    test('decrees editor sees create and edit but not delete or manage-permissions', async ({ browser }) => {
        const s = await open(browser, 'usccb-admin');
        try {
            // Positive signals first (capability applied + cards rendered), then the negatives.
            await expect(s.page.locator('#btnCreateDecree')).toBeVisible();
            await expect(s.page.locator('[data-action="edit"]').first()).toBeVisible();
            // Delete buttons are always rendered but d-none-gated on canAdmin, so assert
            // none are visible (not that none exist).
            await expect(s.page.locator('[data-action="delete"]:visible')).toHaveCount(0);
            await expect(s.page.locator('#lnkManagePermissions')).toBeHidden();
        } finally {
            await s.context.close();
        }
    });

    test('calendar_editor without a decrees tuple sees read-only cards through the role', async ({ browser }) => {
        const s = await open(browser, ROLE_ONLY_USER);
        try {
            await expect(s.page.locator(CARD).first()).toBeVisible(); // canView: cards render
            await expect(s.page.locator('#decreesContainer .alert-warning')).toHaveCount(0);
            await expect(s.page.locator('#btnCreateDecree')).toBeHidden();
            // Edit/delete buttons are always rendered but d-none-gated on canEdit/canAdmin,
            // so assert none are visible (not that none exist).
            await expect(s.page.locator('[data-action="edit"]:visible')).toHaveCount(0);
            await expect(s.page.locator('[data-action="delete"]:visible')).toHaveCount(0);
            await expect(s.page.locator('#lnkManagePermissions')).toBeHidden();
        } finally {
            await s.context.close();
        }
    });

    test('a user whose role does not read decrees is redirected to the dashboard', async ({ browser }) => {
        const s = await open(browser, NO_ROLE_USER);
        try {
            // admin-decrees.php sends a reader-less role to admin-dashboard.php; test_editor
            // passes the dashboard's own gate, so the redirect stops there.
            await expect(s.page).toHaveURL(/admin-dashboard\.php/);
            await expect(s.page.locator(CARD)).toHaveCount(0);
        } finally {
            await s.context.close();
        }
    });

    test('an anonymous visitor is redirected off the admin page', async ({ browser }) => {
        const context = await browser.newContext(); // no storageState → unauthenticated
        const page = await context.newPage();
        try {
            await page.goto('/admin-decrees.php');
            await expect(page).not.toHaveURL(/admin-decrees\.php/);
        } finally {
            await context.close();
        }
    });
});
