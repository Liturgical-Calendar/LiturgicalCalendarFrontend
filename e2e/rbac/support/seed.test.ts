import { test, expect } from '@playwright/test';
import { seedUser } from './seed';
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('seedUser grants role for all; writes FGA tuple only for admins', async () => {
    const f = new Fga();
    const z = new ZitadelAdmin();

    // editor: account + role, but NO FGA tuple (it is requested via UI in scenarios)
    const editorId = await seedUser('cei-editor');
    const e = USERS['cei-editor'].fga!;
    try {
        expect(editorId).toMatch(/^\d+$/);
        expect(await f.check(`user:${editorId}`, e.relation, `${e.objectType}:${e.objectId}`)).toBe(false);
    } finally {
        await z.deleteUser(editorId).catch(() => {});
    }

    // admin: account + role + FGA admin tuple
    const adminId = await seedUser('usccb-admin');
    const a = USERS['usccb-admin'].fga!;
    try {
        expect(await f.check(`user:${adminId}`, a.relation, `${a.objectType}:${a.objectId}`)).toBe(true);
    } finally {
        await z.deleteUser(adminId).catch(() => {});
        await f.delete(`user:${adminId}`, a.relation, `${a.objectType}:${a.objectId}`).catch(() => {});
    }
});
