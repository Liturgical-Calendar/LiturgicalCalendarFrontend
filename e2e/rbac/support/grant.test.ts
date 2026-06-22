import { test, expect } from '@playwright/test';
import { grantScope, revokeScope } from './grant';
import { seedUser } from './seed';
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('grantScope writes the user\'s defined tuple; revokeScope removes it', async () => {
    const f = new Fga();
    const z = new ZitadelAdmin();
    // cei-editor is seeded WITHOUT its tuple (Task 1). grantScope adds it as a precondition.
    const id = await seedUser('cei-editor');
    const u = USERS['cei-editor'].fga!;
    try {
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(false);
        await grantScope('cei-editor');
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(true);
        await grantScope('cei-editor'); // idempotent — must not throw
        await revokeScope('cei-editor');
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(false);
    } finally {
        await z.deleteUser(id).catch(() => {});
        await f.delete(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`).catch(() => {});
    }
});
