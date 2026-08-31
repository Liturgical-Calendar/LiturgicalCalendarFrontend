import { test, expect } from '@playwright/test';
import {
    WRITE_MODE,
    WRITE_MODE_DISK,
    WRITE_MODE_ENV,
    expectApplied,
    isQueueMode,
    queueModeSkipsGitRestore
} from '../../support/writeMode';

/**
 * Pure-logic checks on `e2e/support/writeMode.ts` — the module that decides
 * whether a write actually landed (issue #502).
 *
 * It lives HERE, under rbac/support, purely because that is the directory the
 * `rbac-support` project matches (`rbac/support/*.test.ts`); the module itself is
 * shared with the non-rbac calendar specs and so cannot live under rbac/.
 *
 * Unlike its neighbours these need no stack at all: nothing below opens a browser
 * or touches Zitadel, OpenFGA or Postgres.
 */

test('a body with no disposition is applied — that is disk mode, and pre-#902 APIs', () => {
    expectApplied({ success: 'Calendar data updated' }, 'no-disposition body');
    expectApplied('', 'empty (DELETE) body');
    expectApplied(null, 'absent body');
});

test('an explicit applied disposition is applied', () => {
    expectApplied({ success: 'ok', disposition: 'applied' }, 'applied body');
});

test('a queued write is NOT applied, whatever its status code said', () => {
    // The exact shape LiturgicalCalendarAPI #902 answers a queue-mode PATCH with:
    // a 2xx, the handler's unconditional `success` string, and a change request.
    const queued = {
        success:        'Calendar data updated',
        disposition:    'submitted',
        change_request: { batch_id: 'b-1', review_status: 'submitted', auto_approved: false }
    };
    expect(() => expectApplied(queued, 'queued PATCH')).toThrow();
    expect(() => expectApplied({ ...queued, disposition: 'approved' }, 'auto-approved PATCH')).toThrow();
});

test('an unrecognized disposition is not treated as applied', () => {
    expect(() => expectApplied({ disposition: 'teleported' }, 'unknown disposition')).toThrow();
});

test('an unset E2E_WRITE_MODE means disk — the default the disk-mode projects rely on', () => {
    // Conditional so this file still passes if the whole suite is ever run with
    // E2E_WRITE_MODE=queue; what it guards is the DEFAULT, since every project but
    // rbac-queue leaves the variable unset and a silent drift to queue would turn
    // gitRestoreApiData() into a no-op for the specs that need it most.
    test.skip(process.env[WRITE_MODE_ENV] !== undefined, `${WRITE_MODE_ENV} is set for this run`);
    expect(WRITE_MODE).toBe(WRITE_MODE_DISK);
});

test('the git-restore skip tracks the write mode, and says so only in queue mode', () => {
    expect(queueModeSkipsGitRestore('writeMode.test')).toBe(isQueueMode());
});
