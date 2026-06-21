import { test, expect } from '@playwright/test';
import { actingAs } from './actingAs';

test('actingAs super-admin is authenticated with the admin role', async ({ browser }) => {
    const { context, page } = await actingAs(browser, 'super-admin');
    // In OIDC mode the frontend validates the litcal_access_token cookie via its own /auth/me.php
    // (the API's /auth/me is HS256/admin-only and rejects Zitadel OIDC tokens).
    await page.goto('/');
    const me = await page.evaluate(async () => {
        const r = await fetch('/auth/me.php', { credentials: 'include', headers: { Accept: 'application/json' } });
        return { status: r.status, body: await r.json() };
    });
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user?.roles ?? me.body.roles).toContain('admin');
    await context.close();
});
