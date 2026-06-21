import { test, expect } from '@playwright/test';
import { truncateAppTables, deleteAllSeededUsers } from './cleanup';
import { seedUser } from './seed';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('deleteAllSeededUsers removes a seeded user', async () => {
	await seedUser('rome-editor');
	await deleteAllSeededUsers();
	expect(await new ZitadelAdmin().findUserIdByEmail(USERS['rome-editor'].email)).toBeNull();
});

test('truncateAppTables runs without error', async () => {
	await truncateAppTables();
});
