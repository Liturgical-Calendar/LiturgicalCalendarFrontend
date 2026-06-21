import { test, expect } from '@playwright/test';
import { ZitadelAdmin } from './zitadel';

test('create, find, grant role, delete a verified user', async () => {
    const z = new ZitadelAdmin();
    const email = `zit-probe+e2e@litcal.test`;
    // clean slate
    const existing = await z.findUserIdByEmail(email);
    if (existing) await z.deleteUser(existing);

    const id = await z.createVerifiedUser({ email, password: 'E2e-Test-Passw0rd!', firstName: 'Zit', lastName: 'Probe' });
    expect(id).toMatch(/^\d+$/);
    expect(await z.findUserIdByEmail(email)).toBe(id);

    await z.grantProjectRole(id, 'calendar_editor'); // must not throw
    await z.deleteUser(id);
    expect(await z.findUserIdByEmail(email)).toBeNull();
});
