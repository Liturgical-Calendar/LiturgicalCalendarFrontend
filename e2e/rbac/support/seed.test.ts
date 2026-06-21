import { test, expect } from '@playwright/test';
import { seedUser } from './seed';
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('seedUser creates user, grants role, writes scoped tuple', async () => {
    const id = await seedUser('cei-editor');
    const f = new Fga();
    const u = USERS['cei-editor'].fga!;
    try {
        expect(id).toMatch(/^\d+$/);
        expect(await f.check(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`)).toBe(true);
    } finally {
        // Always clean up, even if an assertion above fails, so a failed run
        // doesn't leave an orphaned user + tuple that poisons later runs.
        await new ZitadelAdmin().deleteUser(id).catch(() => {});
        await f.delete(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`).catch(() => {});
    }
});
