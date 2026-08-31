import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { USERS } from './users';
import { ZitadelAdmin } from './zitadel';
import { Fga } from './fga';
import { queueModeSkipsGitRestore } from '../../support/writeMode';

const exec = promisify(execFile);

// The local stack bind-mounts the API repo, so calendar edits made via extending.php land in
// the host API repo's jsondata/sourcedata. Override with API_REPO_PATH if your checkout differs.
const API_REPO = process.env.API_REPO_PATH || path.resolve(__dirname, '../../../../LiturgicalCalendarAPI');

export async function truncateAppTables(): Promise<void> {
    // The active docker stack is the FRONTEND compose project (this repo root), not the API repo's.
    // Run `docker compose exec` from the frontend repo root so it targets the running `db` service.
    //
    // sourcedata_change_requests is in the list even though the disk-mode projects never write to
    // it (issue #502). In queue mode EVERY /data, /decrees and /tests write becomes a row there
    // instead of a file, and gitRestoreApiData() — which is what cleans up after a disk-mode write
    // — cannot reach a database row. Without this the batches accumulate across runs, and a
    // resubmission of the same resource supersedes the leftovers rather than starting clean, so a
    // later run's assertions are made against a queue it did not build.
    //
    // The table is created by the API's src/Migrations (#902) and litcal-migrate runs before
    // litcal-api is allowed to serve, so it always exists on a stack this suite can talk to; a
    // "relation does not exist" here means the API image predates #902 and the queue-mode project
    // cannot work anyway.
    const sql = 'TRUNCATE access_requests, audit_log, sourcedata_change_requests, user_notification_state RESTART IDENTITY CASCADE;';
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
 *
 * Deliberately NOT consolidated with the second implementation in `e2e/fixtures.ts` (issue #502
 * asked whether to): the two differ in their fallbacks on purpose. This one no-ops on an absent
 * `.git`; that one throws, because a misconfigured API_REPO_PATH there means an untracked
 * calendar file created by a CREATE test is silently left behind. What they must NOT disagree
 * about is queue mode, which is why that single decision is shared — see queueModeSkipsGitRestore().
 */
export async function gitRestoreApiData(): Promise<void> {
    // In queue mode nothing was written to disk to restore. Say so rather than exiting 0 and
    // looking like a successful restore (issue #502).
    if (queueModeSkipsGitRestore('rbac/support/cleanup')) return;
    // No-op when the API repo isn't a local git checkout — e.g. a stack whose API runs ONLY as a
    // container, where the calendar edits live in ephemeral container state rather than in a
    // host-tracked working tree (nothing to restore, and `git -C <absent>` would error). CI does
    // check the API repo out (e2e.yml sets API_REPO_PATH), so this path is a local-stack concern.
    // Where it IS present (local dev with the bind-mounted source), discard the edit and let
    // a real `git checkout` failure propagate so settleCleanup surfaces a dirty tree.
    if (!fs.existsSync(path.join(API_REPO, '.git'))) return;
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
