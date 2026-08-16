/**
 * Regression test for the bare-vs-rite-qualified id confusion fixed in
 * fix/rite-qualified-fga-object-ids follow-up.
 *
 * PR #461 made deriveScope() return a rite-qualified OpenFGA object_id
 * (`roman/USA`, `ambrosian/lugano_ch`). That id is correct as an FGA
 * identifier, but two admin-tests.js call sites — authorizedScopeChoices()
 * and the editor's locked-scope derivation — fed that SAME value into
 * #testScopeId, which selectedScope() reads verbatim into
 * `applies_to.national_calendar` / `applies_to.diocesan_calendar`. The API's
 * LitCalTest.json schema constrains those fields to a bare calendar id
 * (CommonDef.json#/definitions/NationalCalendarId), so a rite-qualified value
 * there is rejected with a 422 — this is exactly the regression CI caught
 * (e2e/admin-tests.spec.ts:130 expected "USA", got "roman/USA").
 *
 * These tests exercise the real module (not a reimplementation of its logic)
 * by loading it in jsdom against a fixture that mirrors admin-tests.php,
 * dispatching DOMContentLoaded, and reading the internals it exposes on
 * window.__adminTests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() runs before module imports — admin-tests.js reads
// window.AdminTestsConfig at DOMContentLoaded time (not at import time), but
// bootstrap must exist before the module's top-level
// `bootstrap.Modal.getOrCreateInstance(editorModalEl)` call, which runs
// inside the DOMContentLoaded handler as soon as it's dispatched.
vi.hoisted(() => {
    globalThis.window = globalThis;
    globalThis.bootstrap = {
        Modal: { getOrCreateInstance: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })) },
    };
});

// admin-tests.js imports CalendarSelect/RiteSelect/ApiClient/CalendarSelectFilter
// from an import-map-resolved package that only exists at runtime in the
// browser (see layout/footer.php), not as an npm dependency. vitest.config.js
// aliases the bare specifier to a local inert stub (see
// assets/js/__tests__/stubs/components-js.js) so the module can be loaded
// here at all. None of the tests below exercise a code path that calls into
// it — the fix under test lives entirely in the synchronous id-composition
// logic, not in the CalendarSelect/RiteSelect/ApiClient wiring.

/** Fixture mirroring the ids admin-tests.php renders (see that file for the source of truth). */
const FIXTURE_HTML = `
    <div class="row g-2 align-items-end">
        <input type="text" class="form-control" id="filterTestName" />
        <input type="text" class="form-control" id="filterTestScope" />
        <button type="button" id="refreshTestsBtn">Refresh</button>
        <button type="button" id="createTestBtn">New Test</button>
    </div>
    <span class="badge" id="testsCount">0</span>
    <table><tbody id="testsTableBody"></tbody></table>

    <div class="modal fade" id="testEditorModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header"><h5 id="testEditorModalLabel">Test Definition</h5></div>
                <div class="modal-body">
                    <div id="testEditorAlerts"></div>
                    <form id="testEditorForm" novalidate>
                        <select class="form-select" id="testScopeType">
                            <option value="general_roman_calendar">General Roman Calendar</option>
                            <option value="national_calendar">National Calendar</option>
                            <option value="diocesan_calendar">Diocesan Calendar</option>
                        </select>
                        <div id="testScopeStatic" class="form-text d-none"></div>
                        <div id="testScopeIdMount"></div>
                        <input type="text" class="form-control" id="testEventKey" list="testEventKeyList" />
                        <datalist id="testEventKeyList"></datalist>
                        <small id="derivedTestName"></small>
                        <input type="date" class="form-control" id="baseDate" />
                        <div id="testTypeGroup">
                            <input type="radio" name="testType" id="tt-exact" value="exactCorrespondence">
                            <input type="radio" name="testType" id="tt-since" value="exactCorrespondenceSince">
                            <input type="radio" name="testType" id="tt-until" value="exactCorrespondenceUntil">
                        </div>
                        <textarea class="form-control" id="testDescription"></textarea>
                        <div id="yearsRangeSlider">
                            <input type="range" id="lowerRange" min="1970" max="2050" value="1999" />
                            <input type="range" id="upperRange" min="1970" max="2050" value="2030" />
                        </div>
                        <div id="yearGrid"></div>
                        <div id="yearGridLegend"></div>
                        <div id="assertionsContainer"></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" id="saveTestBtn">Save</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="testCommentModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog"><div class="modal-content">
            <div class="modal-body">
                <input type="hidden" id="commentYear" />
                <textarea class="form-control" id="commentText"></textarea>
            </div>
            <div class="modal-footer"><button type="button" id="saveCommentBtn">Save comment</button></div>
        </div></div>
    </div>

    <div class="modal fade" id="deleteTestModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog"><div class="modal-content">
            <div class="modal-body">
                <div id="deleteTestAlerts"></div>
                <p id="deleteTestConfirmText"></p>
            </div>
            <div class="modal-footer"><button type="button" id="confirmDeleteTestBtn">Delete</button></div>
        </div></div>
    </div>
`;

/**
 * Load admin-tests.js fresh against the fixture DOM and drive it through
 * DOMContentLoaded so its `window.__adminTests` test seam is populated.
 * vi.resetModules() + a fresh dynamic import is required because the module
 * wires everything inside a single `DOMContentLoaded` closure that runs (and
 * populates window.__adminTests) only once per import.
 */
async function loadAdminTests() {
    document.body.innerHTML = FIXTURE_HTML;
    window.AdminTestsConfig = {
        apiUrl: 'http://localhost:8000',
        i18n: {
            loading: 'Loading...', noTests: 'No tests found.', failedToLoad: 'Failed to load.',
            createSuccess: 'Created.', updateSuccess: 'Updated.', deleteSuccess: 'Deleted.',
            saving: 'Saving...', deleting: 'Deleting...', edit: 'Edit', delete: 'Delete',
            confirmDelete: 'Delete "%s"?', generalRomanCalendar: 'General Roman Calendar',
            nationalCalendar: 'National Calendar', diocesanCalendar: 'Diocesan Calendar',
            requiredFields: 'Fill required fields.', denied403: 'Denied.', conflict409: 'Conflict.',
            setYear: 'set pivot year', toggleAssertion: 'toggle', removeYear: 'remove',
            sundayInYear: '%1$s %2$s Sunday', excludedRestore: '%s excluded', testNameLabel: 'Test name:',
            invalidName: 'Invalid name.',
        },
        locale: 'en-US',
    };
    vi.resetModules();
    await import('../admin-tests.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // The DOMContentLoaded handler is synchronous up through the
    // window.__adminTests assignments exercised below, but flush microtasks
    // in case anything scheduled a promise continuation.
    await Promise.resolve();
    return window.__adminTests;
}

describe('admin-tests.js — bare vs. rite-qualified calendar ids', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deriveScope() still returns a rite-qualified FGA object_id (unchanged PR #461 behavior)', async () => {
        const api = await loadAdminTests();
        expect(api.deriveScope({ rite: 'roman', national_calendar: 'USA' }))
            .toEqual({ object_type: 'national_calendar_test', object_id: 'roman/USA' });
        expect(api.deriveScope({ rite: 'ambrosian', diocesan_calendar: 'lugano_ch' }))
            .toEqual({ object_type: 'diocesan_calendar_test', object_id: 'ambrosian/lugano_ch' });
    });

    it('authorizedScopeChoices() strips the rite qualifier before it can reach applies_to', async () => {
        const api = await loadAdminTests();
        api.state.scopes = {
            is_global_admin: false,
            editor: [
                { object_type: 'national_calendar_test', object_id: 'roman/USA', relation: 'editor' },
                { object_type: 'diocesan_calendar_test', object_id: 'ambrosian/lugano_ch', relation: 'editor' },
            ],
            admin: [],
        };
        const choices = api.authorizedScopeChoices();
        expect(choices).toEqual(
            expect.arrayContaining([
                { type: 'national_calendar', id: 'USA' },
                { type: 'diocesan_calendar', id: 'lugano_ch' },
            ])
        );
        // The regression, stated directly: neither choice may carry a '/'.
        choices.forEach((c) => expect(c.id).not.toContain('/'));
    });

    it('deriveLockedScope() (the editor "edit" path) also strips the rite qualifier', async () => {
        const api = await loadAdminTests();
        expect(api.deriveLockedScope({ rite: 'roman', national_calendar: 'USA' }))
            .toEqual({ type: 'national_calendar', id: 'USA' });
        expect(api.deriveLockedScope({ rite: 'ambrosian', diocesan_calendar: 'lugano_ch' }))
            .toEqual({ type: 'diocesan_calendar', id: 'lugano_ch' });
        // No calendar named → rite-level scope, already bare (the rite itself).
        expect(api.deriveLockedScope({ rite: 'ambrosian' }))
            .toEqual({ type: 'general_roman_calendar', id: 'ambrosian' });
    });

    it('selectedScope() round-trips a bare id from #testScopeId straight into applies_to', async () => {
        const api = await loadAdminTests();
        document.getElementById('testScopeType').value = 'national_calendar';
        const hid = document.createElement('input');
        hid.id = 'testScopeId';
        hid.value = 'USA';
        document.getElementById('testScopeIdMount').appendChild(hid);

        expect(api.selectedScope()).toEqual({ national_calendar: 'USA' });
    });

    it('selectedScope() for a diocesan scope emits applies_to.diocesan_calendar bare', async () => {
        const api = await loadAdminTests();
        document.getElementById('testScopeType').value = 'diocesan_calendar';
        const hid = document.createElement('input');
        hid.id = 'testScopeId';
        hid.value = 'lugano_ch';
        document.getElementById('testScopeIdMount').appendChild(hid);

        expect(api.selectedScope()).toEqual({ diocesan_calendar: 'lugano_ch' });
    });
});
