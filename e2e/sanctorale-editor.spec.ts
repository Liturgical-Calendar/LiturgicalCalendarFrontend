import { APIResponse, Response as PageResponse } from '@playwright/test';
import { execFile } from 'child_process';
import * as path from 'path';
import { expectWriteApplied } from './support/writeMode';
// `test` comes from ./fixtures, not from @playwright/test, for the
// browserDiagnostics auto fixture: on a failure it prints what the page was
// doing into the job log, which is the only place a nightly-only,
// firefox/webkit-only failure can be read without downloading the report.
import { test, expect, gitRestoreApiData, setNumberInput } from './fixtures';

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
 * CLEANUP — two layers, because WHERE the write landed depends on the stack:
 *   1. `gitRestoreApiData()` (git restore + git clean -fd on
 *      jsondata/sourcedata/) undoes the write when the API reads the repo off
 *      disk — a local stack whose `docker-compose.override.yml` bind-mounts
 *      ../LiturgicalCalendarAPI, or a bare `php -S` API run from a checkout.
 *   2. `resetApiContainer()` undoes it when the API does NOT. In CI it does
 *      not: `litcal-api` declares no volume and is built from `#development`
 *      into its image (see docker-compose.yml, and docker-compose.ci.yml,
 *      which deliberately rebuilds only the frontend). Its `jsondata/` lives
 *      in the container's writable layer, so the checkout `gitRestoreApiData()`
 *      repairs — `${{ github.workspace }}/api-repo`, which only the host
 *      playwright process reads — has nothing to do with what the browser just
 *      wrote through the API.
 *
 *      `docker compose restart` does NOT undo it either: a restart keeps the
 *      writable layer, so it published the written value rather than reverting
 *      it. `up -d --force-recreate` discards that layer, which restores the
 *      image's pristine data AND drops the API's in-process `/missals` cache
 *      (APCu, `src/ApcuCache.php`) in the same step — that cache is the reason
 *      a bare restore was never enough even on a bind-mounted stack.
 *
 * Getting this wrong is invisible in the project that runs FIRST and fatal in
 * every project after it: the edit case below moves StIsidoreFarmer from day 15
 * to day 20, so on a second run the day is already 20, the editor correctly
 * reports "Nothing has changed", and no PATCH is issued. That is what made this
 * spec look firefox/webkit-specific — chromium-ci-auth simply got there first.
 * The delete cases have the same shape: they remove keys that only a real
 * restore puts back.
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

/** As `run()`, but resolves with the command's stdout. */
function runCapture(cmd: string, args: string[], opts: { cwd?: string; timeout?: number } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { cwd: opts.cwd, timeout: opts.timeout ?? 60000 }, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}

/**
 * Whether the API under test is a `litcal-api` container this spec can recreate.
 *
 * Decides how a failed cleanup is reported, so it has to fail SAFE: anything
 * that is not a running container id — no docker, no compose, no such service —
 * reads as "not containerised", which is the tolerant branch. The worst a wrong
 * answer here can do is warn where it should have thrown, which is exactly the
 * behaviour this replaces.
 */
async function apiIsContainerised(): Promise<boolean> {
    try {
        const out = await runCapture('docker', ['compose', 'ps', '-q', 'litcal-api'], {
            cwd: REPO_ROOT,
            timeout: 30000
        });
        return out.trim() !== '';
    } catch {
        return false;
    }
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
 * Put the API's source data back by recreating the `litcal-api` container.
 *
 * NOT best-effort where it matters. On a containerised stack this is the ONLY
 * layer that undoes what the browser wrote — `gitRestoreApiData()` repairs a
 * checkout that container never reads — so a failure here leaves day 20 on
 * StIsidoreFarmer and a deleted StPeterClaver for every project that runs
 * next, which then fail for reasons that have nothing to do with them. That is
 * precisely the misdiagnosis this spec's history is made of, so it THROWS,
 * the way `gitRestoreApiData()` already does and for the same reason.
 *
 * Tolerant only where tolerance is correct: with no `litcal-api` container to
 * recreate, the API under test is a bind-mounted or bare `php -S` one, the git
 * restore above was the whole cleanup, and there is nothing to fail about.
 *
 * @throws when the stack runs the API as a container and it could not be
 *         recreated, or did not answer afterwards
 */
async function resetApiContainer(): Promise<void> {
    const containerised = await apiIsContainerised();

    try {
        // --force-recreate, not `restart`: a restart keeps the container's
        // writable layer, so the writes this spec just made through the API
        // survive it. Recreating from the image is what actually puts the
        // source data back — and it drops the APCu /missals cache with it.
        await run('docker', ['compose', 'up', '-d', '--force-recreate', 'litcal-api'], {
            cwd: REPO_ROOT,
            timeout: 120000
        });
    } catch (e) {
        if (containerised) {
            throw new Error(
                'CLEANUP FAILED: litcal-api is running as a container but could not be recreated, so '
                + 'the source data this spec wrote through the API is still in place. Every later '
                + `project will read it. Error: ${String(e)}`
            );
        }
        console.warn(
            'CLEANUP: no litcal-api container to recreate, so the git restore above was the whole '
            + `cleanup — correct for a bind-mounted or bare php -S API. (${String(e)})`
        );
        return;
    }

    if (false === await waitForApi()) {
        throw new Error(
            'CLEANUP FAILED: litcal-api was recreated but did not answer /calendars within 30s. '
            + 'Whether the source data was restored is unknown, and the stack the remaining projects '
            + 'need is down.'
        );
    }
    console.log('CLEANUP: litcal-api recreated and answering again — source data and /missals cache reset.');
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
        await resetApiContainer();
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
        // setNumberInput rather than fill(): StIsidoreFarmer already reads 15
        // here, and fill() cannot be trusted to REPLACE a number input's value —
        // see the helper. Its own toHaveValue() check is what makes the edit a
        // stated precondition instead of an assumption.
        await setNumberInput(page, '#entryDay', '20');
        await page.click('#saveEntryBtn');
        // The editor refuses an edit by writing the reason into #entryFormError
        // and issuing no request — exactly what the no-op test above asserts. So
        // a bare `await write` turns every refusal into the same opaque
        // waitForResponse timeout, which says nothing about WHY. Read the page's
        // own message first: on a save that goes through this is empty and costs
        // nothing.
        await expect(page.locator('#entryFormError')).toBeEmpty();
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
        // Empty here, so fill() would happen to work — but only by luck, and the
        // create form is one default away from carrying a day.
        await setNumberInput(page, '#entryDay', '20');
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
