import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import {
    DISPOSITION_APPLIED,
    DISPOSITION_APPROVED,
    DISPOSITION_SUBMITTED,
    readDisposition
} from '../../assets/js/writeDisposition.js';

/**
 * Which mode the API under test writes source data in — and the assertions that
 * hold the specs to it.
 *
 * Since LiturgicalCalendarAPI #902 a `PUT` / `PATCH` / `DELETE` against
 * `/data/*`, `/decrees/*` or `/tests/*` does not necessarily reach disk. With
 * `SOURCEDATA_CHANGE_REQUESTS=true` the API records the write as a change
 * request awaiting review and answers **2xx** anyway, saying which it did in the
 * response's `disposition` field.
 *
 * That is what issue #502 is about: a spec asserting `response.ok()` passes in
 * BOTH modes, so flipping the shared stack into queue mode turned the write
 * specs green while nothing was being written. The fix is to assert the
 * disposition, not the status code.
 *
 * The vocabulary is NOT redefined here. `readDisposition()` and the
 * `DISPOSITION_*` constants are imported from `assets/js/writeDisposition.js`,
 * the module the app itself branches on (frontend #501), so a spec and the page
 * it tests can never disagree about what "applied" means. That import is why
 * `e2e/tsconfig.json` sets `allowJs` — the module carries JSDoc types.
 *
 * @see e2e/rbac/queue/ — the queue-mode project (`--project=rbac-queue`).
 */

/** How the API under test is expected to handle source-data writes. */
export type WriteMode = 'disk' | 'queue';

/** Writes land in the API repo's `jsondata/sourcedata`. The historical behaviour. */
export const WRITE_MODE_DISK: WriteMode = 'disk';

/** Writes are recorded as change requests awaiting review. Nothing reaches disk. */
export const WRITE_MODE_QUEUE: WriteMode = 'queue';

/** The env var that tells the suite which mode the stack was started in. */
export const WRITE_MODE_ENV = 'E2E_WRITE_MODE';

/**
 * The mode this run expects, from `E2E_WRITE_MODE`.
 *
 * Defaults to `disk`, which is what `docker-compose.yml` starts (its
 * `SOURCEDATA_CHANGE_REQUESTS` passthrough defaults to `false`) and what every
 * project other than `rbac-queue` asserts. An unrecognized value is a hard
 * error rather than a silent fallback: silently reading as `disk` is precisely
 * the failure mode this module exists to remove.
 */
export const WRITE_MODE: WriteMode = ((): WriteMode => {
    const raw = (process.env[WRITE_MODE_ENV] ?? WRITE_MODE_DISK).trim().toLowerCase();
    if (raw !== WRITE_MODE_DISK && raw !== WRITE_MODE_QUEUE) {
        throw new Error(
            `${WRITE_MODE_ENV}="${process.env[WRITE_MODE_ENV]}" is not a write mode. `
            + `Use "${WRITE_MODE_DISK}" (default) or "${WRITE_MODE_QUEUE}".`
        );
    }
    return raw;
})();

/** True when this run expects writes to be queued for review rather than applied. */
export function isQueueMode(): boolean {
    return WRITE_MODE === WRITE_MODE_QUEUE;
}

/** The API origin the specs write to — the same one extending.js fetches. */
export const API_BASE = `${process.env.API_PROTOCOL || 'http'}://${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || '8000'}`;

/**
 * How to say, in a failure message, that the stack is probably in the wrong mode.
 *
 * @param label What the caller was asserting about.
 * @returns The hint appended to the assertion message.
 */
function modeHint(label: string): string {
    return `${label}: this is a DISK-mode assertion. If the stack runs with `
        + 'SOURCEDATA_CHANGE_REQUESTS=true, the write was recorded as a change request and never '
        + `reached disk — run the queue-mode specs (--project=rbac-queue, ${WRITE_MODE_ENV}=queue) `
        + 'instead of this project.';
}

/**
 * Assert that a write actually landed on disk, from its parsed response body.
 *
 * This is the assertion that replaces "the status was 2xx". A queue-mode
 * response is a 2xx carrying `disposition: "submitted"` (or `"approved"`), so
 * only the disposition distinguishes a write that happened from one that was
 * merely accepted for review. A body with no `disposition` at all is `applied`
 * — that is disk mode, and what production `api/v5` still returns.
 *
 * @param body  The parsed response body (an unparseable body is `applied`, per the app helper).
 * @param label What was being written, for the failure message.
 */
export function expectApplied(body: unknown, label: string): void {
    expect(readDisposition(body), modeHint(label)).toBe(DISPOSITION_APPLIED);
}

/**
 * Assert that a write both answered 2xx and actually landed on disk.
 *
 * The two-step message matters: a 403 and a queued 200 are different failures
 * and want different fixes, so the status is asserted first and separately.
 *
 * @param response The API response.
 * @param label    What was being written, for the failure message.
 * @returns The parsed body, for callers that want to assert more about it.
 */
export async function expectWriteApplied(response: APIResponse, label: string): Promise<unknown> {
    expect(
        response.ok(),
        `${label} should succeed (2xx); got ${response.status()}: ${await response.text()}`
    ).toBe(true);
    const body = await parseBody(response);
    expectApplied(body, label);
    return body;
}

/**
 * Assert that a write was QUEUED for review rather than applied — the mirror of
 * {@link expectWriteApplied}, for the `rbac-queue` project.
 *
 * `approved` counts as queued: an auto-approved batch is still a change request
 * awaiting publication, and nothing has reached disk yet either way.
 *
 * @param response The API response.
 * @param label    What was being written, for the failure message.
 * @returns The batch id the API assigned, which is what a review flow acts on.
 */
export async function expectWriteQueued(response: APIResponse, label: string): Promise<string> {
    expect(
        response.ok(),
        `${label} should be accepted (2xx) even in queue mode; got ${response.status()}: ${await response.text()}`
    ).toBe(true);
    const body = await parseBody(response);
    expect(
        [DISPOSITION_SUBMITTED, DISPOSITION_APPROVED],
        `${label}: expected the write to be queued for review, got disposition "${readDisposition(body)}". `
        + 'A body with no disposition means the stack is in DISK mode — start it with '
        + 'SOURCEDATA_CHANGE_REQUESTS=true.'
    ).toContain(readDisposition(body));

    const changeRequest = (body && typeof body === 'object')
        ? (body as { change_request?: { batch_id?: unknown } }).change_request
        : null;
    const batchId = (changeRequest && typeof changeRequest === 'object') ? changeRequest.batch_id : null;
    expect(typeof batchId, `${label}: a queued write must carry change_request.batch_id`).toBe('string');
    return String(batchId);
}

/**
 * The parsed body of a response, or its raw text when it is not JSON.
 *
 * Mirrors what the specs already do by hand around `waitForResponse`, and what
 * `readDisposition()` tolerates: a non-object body simply reads as `applied`.
 *
 * @param response The API response.
 * @returns The parsed JSON body, or the raw text if it does not parse.
 */
export async function parseBody(response: APIResponse): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return await response.text();
    }
}

/**
 * Ask the RUNNING API which mode it is in, rather than trusting the env var.
 *
 * `GET /health` is unauthenticated (LiturgicalCalendarAPI src/Handlers/Ops/HealthHandler.php)
 * and carries a `source_data_writes` block built by
 * `Health::buildSourceDataWriteModeStatus()`. Only one of its four messages means
 * queue mode is actually ON — the flag alone is not enough, since the API falls
 * back to disk (and reports itself misconfigured) when Postgres or OpenFGA is
 * missing. Matching that one message is therefore matching the API's own verdict,
 * not re-deriving it.
 *
 * @param request A Playwright request context (any will do — the endpoint is public).
 * @returns The mode the API reports it is operating in.
 */
export async function apiWriteMode(request: APIRequestContext): Promise<WriteMode> {
    const response = await request.get(`${API_BASE}/health`);
    expect(
        response.status(),
        `GET ${API_BASE}/health must answer 200 for the write-mode probe; got ${response.status()}`
    ).toBe(200);
    const body = await response.json();
    const message = String(body?.source_data_writes?.message ?? '');
    return /recorded as change requests/.test(message) ? WRITE_MODE_QUEUE : WRITE_MODE_DISK;
}

/**
 * Whether a `gitRestoreApiData()` implementation should stop before touching git.
 *
 * In queue mode there is nothing to restore: the write became a row in
 * `sourcedata_change_requests`, and `jsondata/sourcedata` was never touched.
 * Returning quietly would be indistinguishable from a successful restore, which
 * is the ambiguity issue #502 asks to remove — so this SAYS SO on stdout, once
 * per call, naming the caller.
 *
 * Lives here rather than in either cleanup module because there are two
 * `gitRestoreApiData()` implementations with deliberately different fallbacks
 * (see the comments at each), and the queue-mode decision is the one thing they
 * must not disagree about.
 *
 * @param caller Which implementation is asking, for the log line.
 * @returns True when the caller must return without running git.
 */
export function queueModeSkipsGitRestore(caller: string): boolean {
    if (!isQueueMode()) {
        return false;
    }
    console.log(
        `CLEANUP (${caller}): SKIPPED — ${WRITE_MODE_ENV}=${WRITE_MODE_QUEUE}, so the write was recorded `
        + 'as a change request and jsondata/sourcedata was never modified. Nothing to restore.'
    );
    return true;
}
