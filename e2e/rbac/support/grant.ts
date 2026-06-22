import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

/**
 * Per-spec precondition seeding. Editors are not granted at setup (see seed.ts), so a
 * scenario that needs a user to already hold their scope seeds it here. Idempotent.
 */
export async function grantScope(userKey: string, opts: { role?: boolean } = {}): Promise<void> {
    const u = USERS[userKey];
    if (!u?.fga) throw new Error(`grantScope: ${userKey} has no fga scope`);
    const z = new ZitadelAdmin();
    const f = new Fga();
    const zid = await z.findUserIdByEmail(u.email);
    if (!zid) throw new Error(`grantScope: ${userKey} (${u.email}) is not seeded in Zitadel`);
    if (opts.role !== false) await z.grantProjectRole(zid, u.role).catch(() => {}); // tolerate already-granted
    await f.write(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`); // write tolerates dup
}

export async function revokeScope(userKey: string): Promise<void> {
    const u = USERS[userKey];
    if (!u?.fga) return;
    const z = new ZitadelAdmin();
    const f = new Fga();
    const zid = await z.findUserIdByEmail(u.email);
    if (!zid) return;
    await f.delete(`user:${zid}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`).catch(() => {});
}

export async function grantTuple(
    zitadelUserId: string, relation: string, objectType: string, objectId: string,
): Promise<void> {
    await new Fga().write(`user:${zitadelUserId}`, relation, `${objectType}:${objectId}`);
}
