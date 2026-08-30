import { test, expect } from '@playwright/test';
import { WRITE_MODE, WRITE_MODE_ENV, WRITE_MODE_QUEUE, apiWriteMode, isQueueMode } from '../../support/writeMode';

/**
 * Scenario Q0 — the `rbac-queue` project's precondition.
 *
 * Everything else in this directory (the submit → approve / reject / withdraw /
 * double-decide / auto-approve flows, still to be written) presumes the API is
 * recording source-data writes as change requests. Run against a disk-mode stack
 * those specs would not fail cleanly — they would write real files and then look
 * for a review queue that stays empty, which is issue #502's failure mode with
 * the modes swapped.
 *
 * So this runs first, alphabetically, and asserts the two things every later
 * queue spec depends on:
 *
 *   1. This run DECLARES queue mode (`E2E_WRITE_MODE=queue`).
 *   2. The API AGREES. The flag alone does not settle it: SourceDataWriteMode
 *      falls back to disk, and reports itself misconfigured, when Postgres or
 *      OpenFGA is missing — so the live `GET /health` verdict is what counts.
 *
 * The whole project skips (rather than fails) when queue mode was not declared,
 * so `playwright test` with no `--project` — which the `all` branch of
 * .github/workflows/e2e.yml runs — stays green on the default disk-mode stack.
 * Turning queue mode on is deliberate, in both the stack and the env:
 *
 *     SOURCEDATA_CHANGE_REQUESTS=true docker compose up -d --force-recreate litcal-api
 *     E2E_WRITE_MODE=queue yarn playwright test --project=rbac-queue
 */
test.describe('Q0 — queue mode precondition', () => {
    test.skip(
        !isQueueMode(),
        `the rbac-queue project needs ${WRITE_MODE_ENV}=${WRITE_MODE_QUEUE} (got "${WRITE_MODE}") `
        + 'and a stack started with SOURCEDATA_CHANGE_REQUESTS=true'
    );

    test('the API records source-data writes as change requests', async ({ request }) => {
        expect(
            await apiWriteMode(request),
            `${WRITE_MODE_ENV}=${WRITE_MODE_QUEUE} was declared, but GET /health reports the API is `
            + 'still writing source data to disk. Set SOURCEDATA_CHANGE_REQUESTS=true on the '
            + 'litcal-api service and recreate it — compose only re-reads .env on create, so a '
            + '`restart` leaves the old value in place. If /health calls itself misconfigured '
            + 'instead, the flag is set but Postgres or OpenFGA is not reachable, and the API has '
            + 'deliberately fallen back to disk.'
        ).toBe(WRITE_MODE_QUEUE);
    });
});
