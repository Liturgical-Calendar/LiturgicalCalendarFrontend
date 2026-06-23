import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { USERS } from './users';
import { ZitadelAdmin } from './zitadel';
import { Fga } from './fga';

const exec = promisify(execFile);

// The local stack bind-mounts the API repo, so calendar edits made via extending.php land in
// the host API repo's jsondata/sourcedata. Override with API_REPO_PATH if your checkout differs.
const API_REPO = process.env.API_REPO_PATH || path.resolve(__dirname, '../../../../LiturgicalCalendarAPI');

export async function truncateAppTables(): Promise<void> {
    // The active docker stack is the FRONTEND compose project (this repo root), not the API repo's.
    // Run `docker compose exec` from the frontend repo root so it targets the running `db` service.
    const sql = 'TRUNCATE access_requests, audit_log, user_notification_state RESTART IDENTITY CASCADE;';
    // 30s timeout so a stalled docker process can't hang the cleanup pipeline.
    await exec('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'litcal', '-d', 'litcal', '-c', sql], { timeout: 30000 });
}

export async function deleteAllSeededUsers(): Promise<void> {
    const z = new ZitadelAdmin();
    const f = new Fga();
    for (const id of Object.keys(USERS)) {
        const u = USERS[id];
        const zid = await z.findUserIdByEmail(u.email);
        if (!zid) continue;
        // Tolerant of tuples a scenario dynamically granted/revoked (Fga.delete already swallows
        // not-found), but log real failures rather than swallowing them so a deletion that
        // genuinely fails (and could contaminate later specs) is visible — while still letting
        // the rest of the teardown continue.
        if (u.fga) {
            await f.delete(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`)
                .catch((e) => console.warn(`cleanup: failed to delete tuple for ${u.email}:`, String(e)));
        }
        await z.deleteUser(zid).catch((e) => console.warn(`cleanup: failed to delete user ${u.email}:`, String(e)));
    }
}

/**
 * Revert calendar source-data edits made by scenario 10 (scoped data editing). `git checkout`
 * discards unstaged modifications under jsondata/sourcedata; tolerant of nothing-to-restore.
 * (Untracked new files are not removed — scenario 10 edits existing calendar files.)
 */
export async function gitRestoreApiData(): Promise<void> {
    // `git checkout -- jsondata/sourcedata` discards unstaged modifications; a clean tree
    // exits 0 (no-op, no throw). A throw means a real failure (bad API_REPO_PATH, not a git
    // repo, checkout error) that left scenario-10/11's IT edit unreverted — let it propagate
    // so settleCleanup surfaces it on the run where it happened, rather than masking a dirty
    // tree that bleeds into the next run.
    await exec('git', ['-C', API_REPO, 'checkout', '--', 'jsondata/sourcedata'], { timeout: 30000 });
}

/**
 * Run all cleanup operations to completion (Promise.allSettled — none short-circuits the others),
 * then THROW if any rejected, so a genuine cleanup failure surfaces on the run where it happened
 * instead of silently leaving stale state that makes a LATER run pass vacuously. Ops should each be
 * tolerant of already-clean state (revokeScope / Fga.delete swallow not-found, gitRestoreApiData
 * no-ops on a clean tree) so only a real failure rejects and throws here.
 */
export async function settleCleanup(label: string, ops: Array<Promise<unknown>>): Promise<void> {
    const results = await Promise.allSettled(ops);
    const failures = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => String(r.reason));
    if (failures.length > 0) {
        throw new Error(`${label} cleanup failed:\n  - ${failures.join('\n  - ')}`);
    }
}
