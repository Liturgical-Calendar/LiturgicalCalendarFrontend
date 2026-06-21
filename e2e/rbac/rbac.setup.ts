import { test as setup } from '@playwright/test';
import { truncateAppTables, deleteAllSeededUsers } from './support/cleanup';
import { seedUser, loginAndSaveState } from './support/seed';
import { SEEDED_USER_IDS } from './support/users';
import { ZitadelAdmin } from './support/zitadel';

setup('seed rbac users', async () => {
    setup.setTimeout(180_000);
    const z = new ZitadelAdmin();

    // The session API needs IAM_LOGIN_CLIENT, which the machine token lacks. Mint a fresh,
    // session-capable PAT for the `login-client` user and delete it when done.
    const loginClientUserId = await z.findUserIdByUsername('login-client');
    if (!loginClientUserId) throw new Error('login-client machine user not found in Zitadel');
    const pat = await z.mintPat(loginClientUserId);

    try {
        await deleteAllSeededUsers();
        await truncateAppTables();
        for (const id of SEEDED_USER_IDS) {
            await seedUser(id);
            await loginAndSaveState(id, pat.token);
        }
    } finally {
        await z.deletePat(loginClientUserId, pat.tokenId);
    }
});
