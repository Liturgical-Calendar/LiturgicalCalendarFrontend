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
        // not-found, but guard so one stray tuple can't abort the whole teardown).
        if (u.fga) {
            await f.delete(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`).catch(() => {});
        }
        await z.deleteUser(zid).catch(() => {});
    }
}

/**
 * Revert calendar source-data edits made by scenario 10 (scoped data editing). `git checkout`
 * discards unstaged modifications under jsondata/sourcedata; tolerant of nothing-to-restore.
 * (Untracked new files are not removed — scenario 10 edits existing calendar files.)
 */
export async function gitRestoreApiData(): Promise<void> {
    await exec('git', ['-C', API_REPO, 'checkout', '--', 'jsondata/sourcedata'], { timeout: 30000 })
        .catch(() => {});
}
