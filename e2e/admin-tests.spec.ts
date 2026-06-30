import { test, expect, type Page, type Route } from '@playwright/test';

// Uses the shared authenticated storage state (e2e/.auth/user.json) from the
// chromium project; that user is an admin in the dev environment.
test.describe('admin-tests page', () => {
    test('renders the page shell with list and modals', async ({ page }) => {
        await page.goto('/admin-tests.php');
        await expect(page.locator('#testsTableBody')).toBeVisible();
        await expect(page.locator('#createTestBtn')).toBeVisible();
        await expect(page.locator('#testEditorModal')).toHaveCount(1);
        await expect(page.locator('#deleteTestModal')).toHaveCount(1);
    });
});

const sampleTests = {
    litcal_tests: [
        { name: 'GrcOnlyTest', event_key: 'StX', description: 'd', test_type: 'exactCorrespondence', assertions: [{ year: 2024, expected_value: null, assert: 'eventNotExists', assertion: 'd' }] },
        { name: 'UsaNationalTest', event_key: 'StY', description: 'd', test_type: 'exactCorrespondence', applies_to: { national_calendar: 'USA' }, assertions: [{ year: 2024, expected_value: null, assert: 'eventNotExists', assertion: 'd' }] },
    ],
};

type TestScopes = { is_global_admin: boolean; editor: { object_type: string; object_id: string }[]; admin: { object_type: string; object_id: string }[] };

async function stub(page: Page, scopes: TestScopes): Promise<void> {
    await page.route('**/auth/test-scopes', (r: Route) => r.fulfill({ json: scopes }));
    await page.route('**/auth/me', (r: Route) => r.fulfill({ json: { authenticated: true, roles: ['test_editor'] } }));
    await page.route('**/tests', (r: Route) => {
        if (r.request().method() === 'GET') return r.fulfill({ json: sampleTests });
        return r.continue();
    });
}

test.describe('admin-tests gating (stubbed)', () => {
    test('scoped editor sees Edit only on the USA test, no Delete', async ({ page }) => {
        await stub(page, { is_global_admin: false, editor: [{ object_type: 'national_calendar_test', object_id: 'USA' }], admin: [] });
        await page.goto('/admin-tests.php');
        const usaRow = page.locator('tr', { hasText: 'UsaNationalTest' });
        const grcRow = page.locator('tr', { hasText: 'GrcOnlyTest' });
        await expect(usaRow.getByRole('button', { name: 'Edit' })).toBeVisible();
        await expect(usaRow.getByRole('button', { name: 'Delete' })).toHaveCount(0);
        await expect(grcRow.getByRole('button', { name: 'Edit' })).toHaveCount(0);
        await expect(grcRow.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    });

    test('global admin sees Edit and Delete on every row', async ({ page }) => {
        await stub(page, { is_global_admin: true, editor: [], admin: [] });
        await page.goto('/admin-tests.php');
        await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(2);
        await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(2);
    });
});

const grcEvents = {
    litcal_events: [
        { event_key: 'StIgnatiusOfLoyola', name: 'Saint Ignatius of Loyola', grade: 3, grade_lcl: 'Memorial', month: 7, day: 31 },
    ],
};

async function stubEditor(page: Page, scopes: TestScopes): Promise<void> {
    await stub(page, scopes);
    await page.route('**/events**', (r: Route) => r.fulfill({ json: grcEvents }));
}

test.describe('admin-tests editor (stubbed)', () => {
    test('create flow submits a PUT with a schema-shaped body', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        let putBody: Record<string, unknown> | null = null;
        await page.route('**/tests', (r: Route) => {
            if (r.request().method() === 'PUT') {
                putBody = r.request().postDataJSON() as Record<string, unknown>;
                return r.fulfill({ json: { ...putBody } });
            }
            return r.fulfill({ json: sampleTests });
        });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await page.locator('#tt-exact').check({ force: true });
        await page.locator('#testName').fill('StIgnatiusOfLoyolaTest');
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('change');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => putBody && putBody['name']).toBe('StIgnatiusOfLoyolaTest');
        expect(putBody!['test_type']).toBe('exactCorrespondence');
        expect((putBody!['assertions'] as unknown[]).length).toBeGreaterThan(0);
        expect((putBody!['assertions'] as Array<{ assert: string }>)[0].assert).toBe('eventExists AND hasExpectedDate');
    });

    test('edit flow renders name read-only and submits PATCH', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        let patched = false;
        await page.route('**/tests/UsaNationalTest', (r: Route) => {
            if (r.request().method() === 'PATCH') { patched = true; return r.fulfill({ json: {} }); }
            return r.continue();
        });
        await page.goto('/admin-tests.php');
        await page.locator('tr', { hasText: 'UsaNationalTest' }).getByRole('button', { name: 'Edit' }).click();
        await expect(page.locator('#testName')).toHaveAttribute('readonly', '');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => patched).toBe(true);
    });
});

test.describe('admin-tests delete (stubbed)', () => {
    test('confirms and fires DELETE', async ({ page }) => {
        await stub(page, { is_global_admin: true, editor: [], admin: [] });
        let deleted = false;
        await page.route('**/tests/GrcOnlyTest', (r) => {
            if (r.request().method() === 'DELETE') { deleted = true; return r.fulfill({ json: {} }); }
            return r.continue();
        });
        await page.goto('/admin-tests.php');
        await page.locator('tr', { hasText: 'GrcOnlyTest' }).getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('#deleteTestModal')).toBeVisible();
        await page.locator('#confirmDeleteTestBtn').click();
        await expect.poll(() => deleted).toBe(true);
    });
});
