import { execFile } from 'child_process';
import { promisify } from 'util';
import { USERS } from './users';
import { ZitadelAdmin } from './zitadel';
import { Fga } from './fga';

const exec = promisify(execFile);

export async function truncateAppTables(): Promise<void> {
	// The active docker stack is the FRONTEND compose project (this repo root), not the API repo's.
	// Run `docker compose exec` from the frontend repo root so it targets the running `db` service.
	const sql = 'TRUNCATE access_requests, audit_log, user_notification_state RESTART IDENTITY CASCADE;';
	await exec('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'litcal', '-d', 'litcal', '-c', sql]);
}

export async function deleteAllSeededUsers(): Promise<void> {
	const z = new ZitadelAdmin();
	const f = new Fga();
	for (const id of Object.keys(USERS)) {
		const u = USERS[id];
		const zid = await z.findUserIdByEmail(u.email);
		if (!zid) continue;
		if (u.fga) await f.delete(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`);
		await z.deleteUser(zid);
	}
}
