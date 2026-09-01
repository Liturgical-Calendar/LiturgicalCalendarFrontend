import { test, expect, APIResponse, Response as PageResponse } from '@playwright/test';
import { execFile } from 'child_process';
import * as path from 'path';
import { expectWriteApplied } from './support/writeMode';
import { gitRestoreApiData } from './fixtures';

/**
 * `expectWriteApplied()` is typed against Playwright's `APIResponse` (the type
 * `page.request.get()` etc. return), but the writes here are driven through the
 * real UI and captured with `page.waitForResponse()`, which resolves Playwright's
 * page-level `Response` instead — a different interface. The two are NOT the same
 * type, but they ARE behaviourally identical for the four methods
 * `expectWriteApplied()` actually calls (`ok()`, `status()`, `json()`, `text()`),
 * so this cast bridges them rather than duplicating that function's logic.
 */
function asApiResponse(response: PageResponse): APIResponse {
    return response as unknown as APIResponse;
}

/**
 * The sanctorale editor's write path, against the live stack.
 *
 * Two things only a browser can assert. First, that a write actually reached
 * disk: with `SOURCEDATA_CHANGE_REQUESTS` on, a queued write answers the same
 * 2xx and a bare `response.ok()` passes while nothing was written (issue
 * #502) — every write assertion here goes through `expectWriteApplied()`
 * instead. Second, that per-Missal affordance gating actually hides Edit for
 * a Missal a caller may not touch — but proving that for real needs a SCOPED
 * (non-global-admin) identity, which this project's default `chromium`
 * storageState is not. That half lives in `e2e/rbac/16-sanctorale-editor-gating.spec.ts`
 * instead, under `--project=rbac`, using a runtime FGA grant on an existing
 * seeded `calendar_editor` — see that file's own doc comment for why. This
 * file runs as the seeded global admin and therefore only exercises writes,
 * not gating: an admin sees Edit everywhere, so a gating assertion here would
 * pass for the wrong reason.
 *
 * FIXTURE CORRECTION: an earlier draft of this suite targeted
 * `/missals/roman/US_2011/StIsidore`, which does not exist — `StIsidore` is
 * declared only by `propriumdesanctis_1970`, and `US_2011` declares a
 * DIFFERENT key, `StIsidoreFarmer`, for a different saint. In fact no Roman
 * missal shares a single `event_key` with the 1970 typica at all, so the
 * "US_2011 overrides 1970" premise was false throughout. Verified directly
 * against the running API (`GET /missals/roman/{missal}`) before writing
 * this spec. The real fixtures used below:
 *   - `StIsidoreFarmer` — declared ONLY by `US_2011`, so editing or reading it
 *     cannot disturb any override relationship. Used for the plain-edit and
 *     no-op-save cases.
 *   - `StPeterClaver` — declared by `EDITIO_TYPICA_2002`, `US_2011` AND
 *     `IT_1983`. Under the US calendar, `US_2011` (year 2011) wins over
 *     `EDITIO_TYPICA_2002` (year 2002) in `compose()`'s "later wins" rule.
 *     Deleting it from `US_2011` therefore does NOT remove the row — it
 *     reverts the composed table to the `EDITIO_TYPICA_2002` definition, and
 *     the "override" badge disappears. That is the case worth asserting.
 *   - `E2ETestSaint` — a key that exists nowhere, for the create case, then
 *     deleted (plainly — nothing else declares it, so the row disappears).
 *
 * CLEANUP — two layers, because one alone is not enough:
 *   1. `gitRestoreApiData()` (git restore + git clean -fd on
 *      jsondata/sourcedata/ in the bind-mounted API repo) undoes the file
 *      writes themselves.
 *   2. That is NOT sufficient on its own: the API caches `/missals` reads
 *      in-process (APCu; a prior task in this plan described it as "Redis"
 *      colloquially, but `src/ApcuCache.php` is what actually backs it), and
 *      a `git restore` does not invalidate that cache. A prior task in this
 *      plan observed the API serving a stale `/missals` body after a `git
 *      checkout` until `docker compose restart litcal-api` ran. So this
 *      spec's `afterAll` restarts the `litcal-api` container after the git
 *      restore and polls `/calendars` until the API answers again, and then
 *      logs whether that restart succeeded. In an environment without a
 *      `litcal-api` docker service (e.g. a bare `php -S` webServer with no
 *      docker stack), that restart attempt fails and is caught — the git
 *      restore still ran, but the in-process cache would then only clear
 *      itself when that PHP process cycles on its own. Said here plainly
 *      rather than left silent, per this task's own instructions.
 */

const REPO_ROOT = path.resolve(__dirname, '..');
const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

function run(cmd: string, args: string[], opts: { cwd?: string; timeout?: number } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { cwd: opts.cwd, timeout: opts.timeout ?? 60000 }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function waitForApi(timeoutMs = 30000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${API_BASE}/calendars`);
            if (res.ok) return true;
        } catch {
            // keep polling
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

/**
 * Restart the `litcal-api` docker service so its in-process `/missals` cache
 * (APCu) drops the stale bodies `gitRestoreApiData()` cannot invalidate on
 * its own (see the file doc comment). Tolerant of there being no docker
 * stack at all — this is a best-effort second cleanup layer, not a
 * requirement for `gitRestoreApiData()` itself to have worked.
 */
async function bustMissalsCache(): Promise<void> {
    try {
        await run('docker', ['compose', 'restart', 'litcal-api'], { cwd: REPO_ROOT, timeout: 60000 });
        const healthy = await waitForApi();
        console.log(
            healthy
                ? 'CLEANUP: litcal-api restarted and answering again — /missals cache cleared.'
                : 'CLEANUP WARNING: litcal-api restart issued but the API did not answer within 30s.'
        );
    } catch (e) {
        console.warn(
            'CLEANUP WARNING: could not restart litcal-api (no docker stack, or docker not reachable). '
            + 'The git restore above still ran, but the API\'s in-process /missals cache may still serve '
            + `a stale body until that process cycles on its own. Error: ${String(e)}`
        );
    }
}

/** The month each fixture key lives on, per `GET /missals/roman/{missal}` (verified live). */
const MONTH: Record<string, number> = {
    StIsidoreFarmer: 5,
    StPeterClaver: 9,
    E2ETestSaint: 5
};

/** The row for one composed event key, in whichever month is currently rendered. */
function rowFor(page: import('@playwright/test').Page, eventKey: string) {
    return page.locator('#sanctoraleTableBody tr', { hasText: eventKey });
}

/**
 * Deep-link straight to the month a fixture lives on and wait for its row.
 *
 * `#rite=roman&calendar=US&month=N` is read by `readHash()` before the page's
 * own `init()` fetches anything, so this is a real, fresh `GET` cycle — not a
 * dependency on the app's client-side `state.month`/search-box bookkeeping.
 */
async function openMonth(page: import('@playwright/test').Page, eventKey: string) {
    await page.goto(`/sanctorale.php#rite=roman&calendar=US&month=${MONTH[eventKey]}`);
    await expect(rowFor(page, eventKey)).toBeVisible();
}

/**
 * Re-verify server state with a FRESH hard navigation after a write, rather
 * than trusting the SPA's own in-place `reload()`.
 *
 * `saveEntry()`/`deleteEntry()` await `reload()` only AFTER the write's own
 * fetch resolves, and `page.waitForResponse()` resolves on that fetch alone —
 * so anything driven off client-side state right after `await write` can run
 * before that in-place `reload()` has actually finished re-fetching. A hard
 * navigation sidesteps that race entirely: by the time this spec's `await
 * expectWriteApplied()` has returned, the write already landed server-side,
 * so a brand new page load is guaranteed to see it (or its absence), with no
 * dependency on the app's own reload timing.
 */
async function reopenMonth(page: import('@playwright/test').Page, eventKey: string) {
    await page.goto(`/sanctorale.php#rite=roman&calendar=US&month=${MONTH[eventKey]}`);
}

test.describe.serial('sanctorale editor write path', () => {
    test.afterAll(async () => {
        await gitRestoreApiData();
        await bustMissalsCache();
    });

    test('a no-op save reports it inline and issues no request', async ({ page }) => {
        await openMonth(page, 'StIsidoreFarmer');
        await rowFor(page, 'StIsidoreFarmer').locator('button[data-edit-key]').click();
        await page.waitForSelector('#entryDay');

        let patchIssued = false;
        page.on('request', (r) => {
            if (r.method() === 'PATCH') patchIssued = true;
        });
        await page.click('#saveEntryBtn');

        await expect(page.locator('#entryFormError')).not.toBeEmpty();
        expect(patchIssued).toBe(false);
    });

    test('a structure edit is applied, not merely accepted', async ({ page }) => {
        await openMonth(page, 'StIsidoreFarmer');
        await rowFor(page, 'StIsidoreFarmer').locator('button[data-edit-key]').click();
        await page.waitForSelector('#entryDay');

        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/StIsidoreFarmer') && r.request().method() === 'PATCH');
        await page.fill('#entryDay', '20');
        await page.click('#saveEntryBtn');
        await expectWriteApplied(asApiResponse(await write), 'PATCH StIsidoreFarmer');

        await reopenMonth(page, 'StIsidoreFarmer');
        const row = rowFor(page, 'StIsidoreFarmer');
        await expect(row).toBeVisible();
        await expect(row.locator('td').first()).toHaveText('20');
    });

    test('creating fans a new key into the target Missal', async ({ page }) => {
        await page.goto('/sanctorale.php#rite=roman&calendar=US');
        await expect(page.locator('#newEntryBtn')).toBeVisible();
        await page.click('#newEntryBtn');
        await page.waitForSelector('#entryEventKey');

        await page.fill('#entryEventKey', 'E2ETestSaint');
        await page.selectOption('#entryMonth', '5');
        await page.fill('#entryDay', '20');
        await page.selectOption('#entryGrade', '3');
        await page.selectOption('#entryCommon', ['Pastors']);
        await page.selectOption('#entryColor', ['white']);
        await page.fill('#entryNames input[data-locale="en_US"]', 'E2E Test Saint');

        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/E2ETestSaint') && r.request().method() === 'PUT');
        await page.click('#saveEntryBtn');
        await expectWriteApplied(asApiResponse(await write), 'PUT E2ETestSaint');

        await reopenMonth(page, 'E2ETestSaint');
        await expect(rowFor(page, 'E2ETestSaint')).toBeVisible();
    });

    test('deleting a plain entry removes it entirely', async ({ page }) => {
        await openMonth(page, 'E2ETestSaint');
        await rowFor(page, 'E2ETestSaint').locator('button[data-edit-key]').click();
        await page.waitForSelector('#deleteEntryBtn:not(.d-none)');

        page.on('dialog', (d) => d.accept());
        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/E2ETestSaint') && r.request().method() === 'DELETE');
        await page.click('#deleteEntryBtn');
        await expectWriteApplied(asApiResponse(await write), 'DELETE E2ETestSaint');

        await reopenMonth(page, 'E2ETestSaint');
        await expect(rowFor(page, 'E2ETestSaint')).toHaveCount(0);
    });

    test('deleting an override reverts the row to the earlier edition, not away', async ({ page }) => {
        await openMonth(page, 'StPeterClaver');

        const before = rowFor(page, 'StPeterClaver');
        await expect(before).toContainText('US_2011');
        await expect(before.locator('.badge', { hasText: 'override' })).toBeVisible();

        await before.locator('button[data-edit-key]').click();
        await page.waitForSelector('#deleteEntryBtn:not(.d-none)');

        page.on('dialog', (d) => d.accept());
        const write = page.waitForResponse((r) =>
            r.url().includes('/missals/roman/US_2011/StPeterClaver') && r.request().method() === 'DELETE');
        await page.click('#deleteEntryBtn');
        await expectWriteApplied(asApiResponse(await write), 'DELETE StPeterClaver');

        await reopenMonth(page, 'StPeterClaver');

        // The row survives — EDITIO_TYPICA_2002 (and IT_1983) still declare this
        // key — but it now composes from the earlier edition, and is no longer
        // flagged as an override of anything.
        const after = rowFor(page, 'StPeterClaver');
        await expect(after).toBeVisible();
        await expect(after).toContainText('EDITIO_TYPICA_2002');
        await expect(after).not.toContainText('US_2011');
        await expect(after.locator('.badge', { hasText: 'override' })).toHaveCount(0);
    });
});
