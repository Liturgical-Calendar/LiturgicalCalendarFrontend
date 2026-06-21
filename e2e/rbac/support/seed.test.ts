import { test, expect } from '@playwright/test';
import { seedUser } from './seed';
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('seedUser creates user, grants role, writes scoped tuple', async () => {
    const id = await seedUser('cei-editor');
    expect(id).toMatch(/^\d+$/);
    const f = new Fga();
    const u = USERS['cei-editor'].fga!;
    expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(true);
    // cleanup
    await new ZitadelAdmin().deleteUser(id);
    await f.delete(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`);
});
