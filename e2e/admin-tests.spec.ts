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
        let patchBody: Record<string, unknown> | null = null;
        await page.route('**/tests/UsaNationalTest', (r: Route) => {
            if (r.request().method() === 'PATCH') {
                patchBody = r.request().postDataJSON() as Record<string, unknown>;
                patched = true;
                return r.fulfill({ json: {} });
            }
            return r.continue();
        });
        await page.goto('/admin-tests.php');
        await page.locator('tr', { hasText: 'UsaNationalTest' }).getByRole('button', { name: 'Edit' }).click();
        await expect(page.locator('#testName')).toHaveAttribute('readonly', '');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => patched).toBe(true);
        expect(patchBody!.applies_to).toEqual({ national_calendar: 'USA' });
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

test.describe('admin-tests year grid (stubbed)', () => {
    test('spans carry hammer/x icons and Sunday highlighting', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        // btn-check inputs use pointer-events:none; click the label, not the input
        await page.locator('label[for="tt-variable"]').click();
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('change');

        const span2005 = page.locator('#yearGrid .testYearSpan.year-2005');
        await expect(span2005).toBeVisible();
        // variable type → action icon present as fa-repeat ("toggle assertion",
        // same semantic as the card toggle — spec R5); x always present;
        // 2005-07-31 is a Sunday
        await expect(span2005.locator('.hammerYear')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-repeat')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCount(0);
        await expect(span2005.locator('.removeYear')).toHaveCount(1);
        await expect(span2005).toHaveClass(/sunday/);
        // since type → the icon is the pivot hammer (spec R5)
        await page.locator('label[for="tt-since"]').click();
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-repeat')).toHaveCount(0);
        // exactCorrespondence type → no action icon at all
        await page.locator('label[for="tt-exact"]').click();
        await expect(span2005.locator('.hammerYear')).toHaveCount(0);
        await expect(span2005.locator('.removeYear')).toHaveCount(1);
    });

    test('exclude collapses to the striped bar and restore brings the card back', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        // btn-check inputs use pointer-events:none; click the label, not the input
        await page.locator('label[for="tt-variable"]').click();
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('change');

        const span2005 = page.locator('#yearGrid .testYearSpan.year-2005');
        await expect(span2005).toBeVisible();

        // exclude: card disappears, span collapses to the striped bar
        // dispatchEvent is used because Playwright's physical click on <i> inside a
        // scrollable modal does not synthesize a click event (mousedown+mouseup fire
        // but the browser cancels click due to scroll-container interaction).
        await span2005.locator('.removeYear').dispatchEvent('click');
        await expect(span2005).toHaveClass(/deleted/);
        await expect(page.locator('.assertion-card[data-year="2005"]')).toHaveCount(0);

        // restore: deleted span collapses to 3px width — dispatchEvent is more
        // reliable than a physical click on such a small hit area inside a modal.
        await span2005.dispatchEvent('click');
        await expect(span2005).not.toHaveClass(/deleted/);
        await expect(page.locator('.assertion-card[data-year="2005"]')).toHaveCount(1);
    });

    test('sparse loaded test renders gap years striped and x works on asserted years', async ({ page }) => {
        const sparse = {
            litcal_tests: [{
                name: 'SparseTest', event_key: 'StIgnatiusOfLoyola',
                description: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31",
                test_type: 'exactCorrespondence',
                // deliberately transferred dates (July 30) that DISAGREE with the
                // catalog's canonical July 31 — the base date must show the catalog
                // value (spec R3.1: catalog wins over assertions-mode fallback)
                assertions: [2022, 2033, 2044].map((year) => ({
                    year, expected_value: `${year}-07-30T00:00:00+00:00`,
                    assert: 'eventExists AND hasExpectedDate',
                    assertion: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31",
                })),
            }],
        };
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        // Register the sparse override AFTER stubEditor so it takes precedence
        // (Playwright uses last-registered-first-matched for route handlers).
        await page.route('**/tests', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: sparse }) : r.continue()));
        await page.goto('/admin-tests.php');
        await page.locator('.editTestBtn[data-name="SparseTest"]').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        // base date restored as minAssertedYear + the CATALOG's canonical
        // month/day (spec R3.1) — July 31 wins over the assertions' July 30
        await expect(page.locator('#baseDate')).toHaveValue('2022-07-31');
        // gap year renders striped, asserted year renders normally
        await expect(page.locator('#yearGrid .testYearSpan.year-2025')).toHaveClass(/deleted/);
        const span2033 = page.locator('#yearGrid .testYearSpan.year-2033');
        await expect(span2033).not.toHaveClass(/deleted/);
        // x-mark on an asserted year collapses it to the striped bar
        await span2033.locator('.removeYear').dispatchEvent('click');
        await expect(span2033).toHaveClass(/deleted/);
        await expect(page.locator('.assertion-card[data-year="2033"]')).toHaveCount(0);
        // clicking the striped gap year restores it
        await page.locator('#yearGrid .testYearSpan.year-2025').dispatchEvent('click');
        await expect(page.locator('#yearGrid .testYearSpan.year-2025')).not.toHaveClass(/deleted/);
        await expect(page.locator('.assertion-card[data-year="2025"]')).toHaveCount(1);
    });

    test('legend row is visible with all five chips', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        const legend = page.locator('#yearGridLegend');
        await expect(legend).toBeVisible();
        await expect(legend.locator('.legend-chip')).toHaveCount(5);
        await expect(legend.locator('.legend-chip.deleted')).toHaveCount(1);
        await expect(legend.locator('.legend-chip.sunday')).toHaveCount(1);
    });
});
