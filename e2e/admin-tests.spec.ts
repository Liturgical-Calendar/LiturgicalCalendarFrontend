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

/**
 * Matches BOTH `/tests` (the collection the page GETs to fill its list) and
 * `/tests/{rite}/{name}` (what create PUTs and edit PATCHes to, see testPath()
 * in admin-tests.js). The rite segment is required on every item path since API
 * #787 partitioned the corpus by rite; the one-segment form is still matched so
 * a regression back to `/tests/{name}` is caught by the URL assertions below
 * rather than escaping the stub.
 *
 * A glob of `**​/tests` misses the item paths, which is not a benign miss: the
 * request escapes the stub entirely and reaches the real API, so a "stubbed" create
 * test both asserts against a null body and can write through to real data. A glob of
 * `**​/tests/**` has the mirror problem — it would stop matching the collection GET.
 */
const TESTS_ROUTE = /\/tests(?:\/[^/?#]+){0,2}(?:[?#]|$)/;

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
        let putUrl: string | null = null;
        await page.route(TESTS_ROUTE, (r: Route) => {
            if (r.request().method() === 'PUT') {
                putUrl = r.request().url();
                putBody = r.request().postDataJSON() as Record<string, unknown>;
                return r.fulfill({ json: { ...putBody } });
            }
            return r.fulfill({ json: sampleTests });
        });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await page.locator('#tt-exact').check({ force: true });
        // No Name input exists — the name is derived from the event key.
        await expect(page.locator('#testName')).toHaveCount(0);
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('input');
        await expect(page.locator('#derivedTestName')).toContainText('StIgnatiusOfLoyolaTest');
        await page.locator('#testEventKey').dispatchEvent('change');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => putBody && putBody['name']).toBe('StIgnatiusOfLoyolaTest');
        // Pin the PATH, not just the body. TESTS_ROUTE deliberately matches the
        // collection and the item paths alike so one handler can serve the collection
        // GET as well, which means a regression back to PUT-ing the collection — or
        // back to the rite-less /tests/{name} the API now 400s — would otherwise still
        // be intercepted and still pass. That drift is what #453 was about.
        expect(putUrl).toMatch(/\/tests\/roman\/StIgnatiusOfLoyolaTest$/);
        expect(putBody!['test_type']).toBe('exactCorrespondence');
        expect((putBody!['assertions'] as unknown[]).length).toBeGreaterThan(0);
        expect((putBody!['assertions'] as Array<{ assert: string }>)[0].assert).toBe('eventExists AND hasExpectedDate');
    });

    test('edit flow locks scope + event and submits PATCH', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        let patched = false;
        let patchBody: Record<string, unknown> | null = null;
        // The sample test declares no applies_to.rite (a pre-#787 file), so the page
        // addresses it under the Roman partition — the same fallback the API applies.
        await page.route('**/tests/roman/UsaNationalTest', (r: Route) => {
            if (r.request().method() === 'PATCH') {
                patchBody = r.request().postDataJSON() as Record<string, unknown>;
                patched = true;
                return r.fulfill({ json: {} });
            }
            return r.continue();
        });
        await page.goto('/admin-tests.php');
        await page.locator('tr', { hasText: 'UsaNationalTest' }).getByRole('button', { name: 'Edit' }).click();
        // Name field is gone; scope + event are the locked identity of the test.
        await expect(page.locator('#testName')).toHaveCount(0);
        await expect(page.locator('#testEventKey')).toHaveAttribute('readonly', '');
        await expect(page.locator('#testScopeStatic')).toContainText('USA');
        await expect(page.locator('#testScopeType')).toBeHidden();
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => patched).toBe(true);
        // `rite` is REQUIRED by LitCalTest.json (API #785) — a body without it is a
        // 422. It stays `roman` here because the Ambrosian rite has no national tier.
        expect(patchBody!.applies_to).toEqual({ rite: 'roman', national_calendar: 'USA' });
        expect(patchBody!.name).toBe('UsaNationalTest');
    });
});

test.describe('admin-tests scope RBAC (stubbed)', () => {
    test('single-scope editor: scope is static text (no picker), PUT carries it', async ({ page }) => {
        await stubEditor(page, { is_global_admin: false, editor: [{ object_type: 'national_calendar_test', object_id: 'USA' }], admin: [] });
        let putBody: Record<string, unknown> | null = null;
        let putUrl: string | null = null;
        await page.route(TESTS_ROUTE, (r: Route) => {
            if (r.request().method() === 'PUT') { putUrl = r.request().url(); putBody = r.request().postDataJSON() as Record<string, unknown>; return r.fulfill({ json: {} }); }
            return r.fulfill({ json: sampleTests });
        });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        // One authorized scope → static text, no scope-type select, no choice select.
        await expect(page.locator('#testScopeStatic')).toContainText('USA');
        await expect(page.locator('#testScopeType')).toBeHidden();
        await expect(page.locator('#scopeChoice')).toHaveCount(0);
        await page.locator('#tt-exact').check({ force: true });
        await page.locator('#testEventKey').fill('StIgnatiusOfLoyola');
        await page.locator('#testEventKey').dispatchEvent('change');
        await page.locator('#saveTestBtn').click();
        await expect.poll(() => putBody && putBody['applies_to']).toEqual({ rite: 'roman', national_calendar: 'USA' });
        // As above: TESTS_ROUTE matches the collection path too, so assert the write
        // actually went to the rite-qualified item endpoint.
        expect(putUrl).toMatch(/\/tests\/roman\/StIgnatiusOfLoyolaTest$/);
    });

    test('multi-scope editor: a select limited to the authorized scopes', async ({ page }) => {
        await stubEditor(page, {
            is_global_admin: false,
            editor: [{ object_type: 'national_calendar_test', object_id: 'USA' }],
            admin: [{ object_type: 'diocesan_calendar_test', object_id: 'romamo_it' }],
        });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        // Several authorized scopes → a limited <select>, not static text or the full picker.
        await expect(page.locator('#scopeChoice')).toBeVisible();
        await expect(page.locator('#testScopeType')).toBeHidden();
        await expect(page.locator('#scopeChoice option')).toHaveCount(2);
        await expect(page.locator('#scopeChoice')).toContainText('USA');
        await expect(page.locator('#scopeChoice')).toContainText('romamo_it');
    });

    test('editor fields follow the intended document order', async ({ page }) => {
        await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        // Scope → event → base date → test type → description → year grid → assertions.
        const inOrder = await page.evaluate(() => {
            const ids = ['testScopeType', 'testEventKey', 'baseDate', 'testTypeGroup', 'testDescription', 'yearGrid', 'assertionsContainer'];
            const els = ids.map((id) => document.getElementById(id));
            for (let i = 1; i < els.length; i++) {
                const prev = els[i - 1];
                const cur = els[i];
                if (!prev || !cur) return false;
                if (!(prev.compareDocumentPosition(cur) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
            }
            return true;
        });
        expect(inOrder).toBe(true);
    });
});

test.describe('admin-tests delete (stubbed)', () => {
    test('confirms and fires DELETE', async ({ page }) => {
        await stub(page, { is_global_admin: true, editor: [], admin: [] });
        let deleted = false;
        await page.route('**/tests/roman/GrcOnlyTest', (r) => {
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

/**
 * Shared create-modal boilerplate for the year-grid tests: stub routes as a
 * global admin, open the editor, pick the exactCorrespondence test type, and select
 * an event so the grid regenerates.
 *
 * This used to pick a `tt-variable` control. Commit 2db2eb92 merged
 * variableCorrespondence INTO exactCorrespondence, removing that control (the page
 * now offers only tt-exact / tt-since / tt-until), and the merged type carries the
 * former variable behaviour — see the icon semantics asserted below.
 */
async function openExactEditor(page: Page, eventKey: string): Promise<void> {
    await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
    await page.goto('/admin-tests.php');
    await page.locator('#createTestBtn').click();
    await expect(page.locator('#testEditorModal')).toBeVisible();
    // btn-check inputs use pointer-events:none; click the label, not the input
    await page.locator('label[for="tt-exact"]').click();
    await page.locator('#testEventKey').fill(eventKey);
    await page.locator('#testEventKey').dispatchEvent('change');
}

test.describe('admin-tests year grid (stubbed)', () => {
    test('spans carry hammer/x icons and Sunday highlighting', async ({ page }) => {
        await openExactEditor(page, 'StIgnatiusOfLoyola');

        const span2005 = page.locator('#yearGrid .testYearSpan.year-2005');
        await expect(span2005).toBeVisible();
        // exactCorrespondence (non-pivot) → action icon is fa-repeat ("toggle
        // assertion", same semantic as the card toggle — spec R5); x always present;
        // 2005-07-31 is a Sunday
        await expect(span2005.locator('.hammerYear')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-repeat')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCount(0);
        await expect(span2005.locator('.removeYear')).toHaveCount(1);
        await expect(span2005).toHaveClass(/sunday/);
        // since type → the icon is the pivot hammer (spec R5), hidden until
        // the span is hovered (spec R6: pivot is an exclusive state)
        await page.locator('label[for="tt-since"]').click();
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-repeat')).toHaveCount(0);
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCSS('opacity', '0');
        await span2005.hover();
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCSS('opacity', '0.5');
        // until type → the other pivot type, same hammer affordance
        await page.locator('label[for="tt-until"]').click();
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-repeat')).toHaveCount(0);
        // back to exactCorrespondence → the non-pivot repeat icon returns, and unlike
        // the hammer it is not hover-gated (only .fa-hammer is opacity-0 until hover).
        // This assertion used to expect NO icon at all, which was the pre-2db2eb92
        // behaviour: the merge gave exactCorrespondence the former variable semantics.
        await page.locator('label[for="tt-exact"]').click();
        await expect(span2005.locator('.hammerYear.fa-repeat')).toHaveCount(1);
        await expect(span2005.locator('.hammerYear.fa-hammer')).toHaveCount(0);
        await expect(span2005.locator('.removeYear')).toHaveCount(1);
    });

    test('changing the base date re-anchors Sunday chips, description, and assertions', async ({ page }) => {
        await openExactEditor(page, 'StIgnatiusOfLoyola');

        // Default base date is 07-31: 2005-07-31 is a Sunday, 2006-07-31 is not,
        // and the suggested text reads "... July 31".
        const span2005 = page.locator('#yearGrid .testYearSpan.year-2005');
        const span2006 = page.locator('#yearGrid .testYearSpan.year-2006');
        await expect(span2005).toHaveClass(/sunday/);
        await expect(span2006).not.toHaveClass(/sunday/);
        await expect(page.locator('#testDescription')).toHaveValue(/July 31/);

        // Move the base date to 08-06 (only month/day matter): 2005-08-06 is a
        // Saturday and 2006-08-06 is a Sunday, so the highlight must flip, and the
        // suggested description + each per-year card's assertion re-anchor to 08-06.
        await page.locator('#baseDate').fill('2005-08-06');
        await page.locator('#baseDate').dispatchEvent('change');

        await expect(span2005).not.toHaveClass(/sunday/);
        await expect(span2006).toHaveClass(/sunday/);
        await expect(page.locator('#testDescription')).toHaveValue(/August 6/);
        const card2005Text = page.locator('.assertion-card[data-year="2005"] .assertionText');
        await expect(card2005Text).toHaveValue(/August 6/);
        await expect(card2005Text).not.toHaveValue(/July 31/);
    });

    test('toggling a dateless event assertion to Exact enables the date editor', async ({ page }) => {
        await stub(page, { is_global_admin: true, editor: [], admin: [] });
        // Event catalog whose event has NO fixed month/day (a movable feast).
        await page.route('**/events**', (r: Route) => r.fulfill({ json: { litcal_events: [
            { event_key: 'MovableFeastX', name: 'Movable Feast X', grade: 4, grade_lcl: 'Feast' },
        ] } }));
        await page.goto('/admin-tests.php');
        await page.locator('#createTestBtn').click();
        await expect(page.locator('#testEditorModal')).toBeVisible();
        await page.locator('label[for="tt-exact"]').click();
        await page.locator('#testEventKey').fill('MovableFeastX');
        await page.locator('#testEventKey').dispatchEvent('change');
        const editBtn = page.locator('.assertion-card[data-year="2005"] .editDate');
        await expect(editBtn).toBeDisabled();
        await page.locator('.assertion-card[data-year="2005"] .toggleAssert').dispatchEvent('click');
        await expect(editBtn).toBeEnabled();
    });

    test('toggling a per-year card assert updates the year chip styling', async ({ page }) => {
        await openExactEditor(page, 'StIgnatiusOfLoyola');
        const chip2005 = page.locator('#yearGrid .testYearSpan.year-2005');
        // Exact assertion → "event expected" (no not-expected warning background).
        await expect(chip2005).not.toHaveClass(/bg-warning/);
        // Toggle the CARD's assert to eventNotExists → the chip must reflect it.
        await page.locator('.assertion-card[data-year="2005"] .toggleAssert').dispatchEvent('click');
        await expect(chip2005).toHaveClass(/bg-warning/);
        // Toggle back to eventExists → the warning background clears.
        await page.locator('.assertion-card[data-year="2005"] .toggleAssert').dispatchEvent('click');
        await expect(chip2005).not.toHaveClass(/bg-warning/);
    });

    test('exclude collapses to the striped bar and restore brings the card back', async ({ page }) => {
        await openExactEditor(page, 'StIgnatiusOfLoyola');

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
