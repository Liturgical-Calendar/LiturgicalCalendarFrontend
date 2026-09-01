import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { Fga } from './support/fga';
import { ZitadelAdmin } from './support/zitadel';
import { USERS } from './support/users';

/**
 * Scenario 16 — sanctorale editor: per-Missal affordance gating (real FGA)
 *
 * `sanctorale.php` composes several Missal editions into one table
 * (`assets/js/sanctorale.js`'s `compose()`), and a curator's Edit button is
 * gated per ROW, not per page: `capabilityFor(row._missalId)` decides
 * whether that row's `data-edit-key` button renders at all
 * (`renderTable()`). A curator scoped to `editor@national_calendar:roman/US`
 * must see Edit on the `US_2011` rows and NOT on the `EDITIO_TYPICA_1970`
 * rows sitting beside them in the SAME rendered table. No unit test can
 * assert this — it is a DOM-rendering decision driven by a live
 * `/admin/permissions/check` round trip per Missal
 * (`assets/js/capabilities.js`'s `detectMissalCapabilities()`).
 *
 * This does NOT belong in `e2e/sanctorale-editor.spec.ts` (the write-path
 * suite, `--project=chromium`): that project's storageState is the seeded
 * GLOBAL admin, whose `isGlobalAdmin` bypass in `detectMissalCapabilities()`
 * shows Edit on every Missal unconditionally. A gating assertion run as that
 * identity would pass whether or not the gating logic works at all — the
 * exact trap this task was warned against. Proving the gate needs a genuinely
 * SCOPED, non-global-admin identity, which only the `rbac` project's seeded
 * users provide.
 *
 * The relations are NOT uniform across the verbs, and this spec pins that too.
 * `OpenFgaAuthorizationMiddleware::forMissals()` passes no relation-map override,
 * so missals take `DEFAULT_RELATION_MAP` verbatim: `PATCH` => `editor`, but
 * `PUT` (create) and `DELETE` => `admin`. A holder of exactly
 * `editor@national_calendar:roman/US` must therefore see the row's Edit button
 * AND NOT `#newEntryBtn`, AND NOT `#deleteEntryBtn` once the editor modal is
 * open. Those two negative assertions are the ones whose absence let a
 * create-gated-on-`editor` bug ship green — without them the spec passes whether
 * create is gated on `editor` or on `admin`.
 *
 * No seeded `calendar_editor` carries a plain `editor@national_calendar:roman/US`
 * tuple as part of the regular seed (`usccb-admin` carries `admin@national_calendar:roman/US`,
 * which also satisfies `canEdit` via `detectMissalCapabilities()`'s "admin implies
 * editor" rule, but is a coarser grant than the one this scenario is named for;
 * `usccb-editor` — the one seeded user with exactly `editor@` on this object — is a
 * `REGISTRATION_USER`, excluded from `SEEDED_USER_IDS` and provisioned only by its
 * own self-registration spec). Rather than depend on either of those, this spec
 * grants the tuple itself at RUNTIME to `cei-editor` — a seeded `calendar_editor`
 * whose own pre-existing scope is `editor@national_calendar:roman/IT`, a
 * DIFFERENT object, so it cannot affect this page — and tears the tuple down in
 * `afterAll`. Mirrors the pattern `e2e/rbac/14-admin-decrees-capability-matrix.spec.ts`
 * already established for the same reason.
 *
 * Fixtures (verified against the live API, `GET /missals/roman/{missal}` —
 * see `e2e/sanctorale-editor.spec.ts`'s doc comment for the full correction):
 *   - `StIsidoreFarmer` (May 15) — declared only by `US_2011`.
 *   - `StJosephWorker` (May 1) — declared only by `EDITIO_TYPICA_1970`, and not
 *     overridden by any later edition. Composing the US calendar for May pulls
 *     in both rows in the SAME table view, which is what this scenario needs.
 *
 * Preconditions (seeded by rbac-setup): `cei-editor` — Zitadel `calendar_editor`
 * role; `.auth/cei-editor.json` pre-written.
 * env for the Fga helper: OPENFGA_API_URL / OPENFGA_STORE_ID / OPENFGA_MODEL_ID.
 * env for the ZitadelAdmin helper (subject resolution): ZITADEL_ISSUER /
 * ZITADEL_MACHINE_TOKEN / ZITADEL_ORG_ID / ZITADEL_PROJECT_ID.
 *
 * Read-only: this spec issues no write against `/missals`, so it needs no
 * `gitRestoreApiData()` — only the runtime FGA tuple needs teardown.
 */

const GRANT_OBJECT = 'national_calendar:roman/US';
const GRANT_USER_KEY = 'cei-editor';

async function subOf(email: string): Promise<string> {
    const id = await new ZitadelAdmin().findUserIdByEmail(email);
    if (!id) throw new Error(`sanctorale gating: user ${email} is not seeded in Zitadel`);
    return id;
}

test.describe('sanctorale editor gating', () => {
    let grantedSub: string | null = null;

    test.beforeAll(async () => {
        test.setTimeout(60_000);
        const f = new Fga();
        grantedSub = await subOf(USERS[GRANT_USER_KEY].email);
        await f.write(`user:${grantedSub}`, 'editor', GRANT_OBJECT);
    });

    test.afterAll(async () => {
        if (!grantedSub) return;
        const f = new Fga();
        await f.delete(`user:${grantedSub}`, 'editor', GRANT_OBJECT)
            .catch((e) => console.warn(`cleanup: failed to delete runtime grant for ${GRANT_USER_KEY}:`, String(e)));
        const stillGranted = await f.check(`user:${grantedSub}`, 'editor', GRANT_OBJECT).catch(() => null);
        console.log(
            stillGranted === false
                ? `CLEANUP: runtime grant editor@${GRANT_OBJECT} for ${GRANT_USER_KEY} revoked and verified gone.`
                : `CLEANUP WARNING: post-teardown check for editor@${GRANT_OBJECT} on ${GRANT_USER_KEY} returned ${String(stillGranted)}, expected false.`
        );
    });

    test('a scoped editor sees Edit on their own edition only, in the same table', async ({ browser }) => {
        const session = await actingAs(browser, GRANT_USER_KEY);
        try {
            await session.page.goto('/sanctorale.php#rite=roman&calendar=US&month=5');

            const usRow = session.page.locator('#sanctoraleTableBody tr', { hasText: 'StIsidoreFarmer' });
            await expect(usRow).toBeVisible();
            await expect(usRow).toContainText('US_2011');
            await expect(usRow.locator('button[data-edit-key]')).toBeVisible();

            const typicaRow = session.page.locator('#sanctoraleTableBody tr', { hasText: 'StJosephWorker' });
            await expect(typicaRow).toBeVisible();
            await expect(typicaRow).toContainText('EDITIO_TYPICA_1970');
            await expect(typicaRow.locator('button[data-edit-key]')).toHaveCount(0);
        } finally {
            await session.context.close();
        }
    });

    test('a scoped editor is offered neither create nor delete, because both are admin', async ({ browser }) => {
        const session = await actingAs(browser, GRANT_USER_KEY);
        try {
            await session.page.goto('/sanctorale.php#rite=roman&calendar=US&month=5');

            const usRow = session.page.locator('#sanctoraleTableBody tr', { hasText: 'StIsidoreFarmer' });
            await expect(usRow.locator('button[data-edit-key]')).toBeVisible();

            // `#newEntryBtn` is server-rendered `d-none` and revealed only by
            // refreshCapabilities() finding a CREATE capability. Awaiting the Edit
            // button above means capabilities have already resolved, so a still
            // hidden button here is a decision, not a race.
            await expect(session.page.locator('#newEntryBtn')).toBeHidden();

            // Delete is `admin` too. Open the editor on the one row this identity
            // may edit and confirm the footer offers Save without Delete.
            await usRow.locator('button[data-edit-key]').click();
            await expect(session.page.locator('#detailModalFooter')).toBeVisible();
            await expect(session.page.locator('#saveEntryBtn')).toBeVisible();
            await expect(session.page.locator('#deleteEntryBtn')).toBeHidden();
        } finally {
            await session.context.close();
        }
    });
});
