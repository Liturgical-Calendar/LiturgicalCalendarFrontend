/**
 * admin-tests page module. Bespoke (not the status-workflow factory), modeled
 * on admin-permissions.js. Internal seam: generic CRUD plumbing vs.
 * test-specific logic, so it can later seed a shared admin-page factory.
 */
import {
    ApiClient,
    CalendarSelect,
    CalendarSelectFilter,
    RiteSelect,
    Rite,
} from '@liturgical-calendar/components-js';
import { AssertionsBuilder, TestType, AssertType } from './AssertionsBuilder.js';
import { ROMAN_RITE, bareCalendarId, qualifyObjectId, sameObjectId, splitObjectId } from './riteScopedObjectId.js';

/**
 * Reads the admin-tests scope picker's current selection and builds the
 * `applies_to` scope object a create/update payload must carry.
 *
 * `applies_to.rite` is REQUIRED by `LitCalTest.json` (API #785) — omitting it
 * (or omitting `applies_to` altogether for the General Roman case) is a 422.
 * The rite is never guessed: General Roman is definitionally Roman; a
 * national calendar is always Roman (the Ambrosian rite has no national
 * tier — `RiteProperties[Rite.AMBROSIAN].hasNationalTier === false`); a
 * diocesan calendar's rite is read from whatever announced it — the linked
 * `RiteSelect` (`#testScopeRite`) when the full picker is showing one, or a
 * hidden `#testScopeRite` mirror the locked/pinned scope paths set from the
 * server-supplied `applies_to.rite` or the FGA scope's own rite-qualified id.
 *
 * Exported (rather than nested in the DOMContentLoaded closure, like every
 * other helper in this module) purely so it is unit-testable in isolation —
 * mirrors the pattern admin-decrees.js already uses for its pure helpers.
 *
 * Three-state return so the save flow can tell an explicit choice apart from
 * an incomplete one:
 *   undefined — a scoped type is selected but no calendar ID is picked yet
 *   object    — a concrete scope: `{ rite }` for General Roman, or
 *               `{ rite, national_calendar | diocesan_calendar: id }`
 *
 * @returns {undefined|{rite: string, national_calendar?: string, diocesan_calendar?: string}}
 */
export function selectedScope() {
    const type = document.getElementById('testScopeType').value;
    if (type === 'general_roman_calendar') return { rite: Rite.ROMAN };
    const idEl = document.getElementById('testScopeId');
    const id = idEl ? idEl.value : '';
    if (!id) return undefined;
    if (type === 'diocesan_calendar') {
        const riteEl = document.getElementById('testScopeRite');
        return { rite: riteEl ? riteEl.value : Rite.ROMAN, diocesan_calendar: id };
    }
    // national_calendar: the Ambrosian rite has no national tier, so every
    // national calendar is Roman.
    return { rite: Rite.ROMAN, national_calendar: id };
}

document.addEventListener('DOMContentLoaded', () => {
    const config = window.AdminTestsConfig;
    if (!config) {
        console.error('AdminTestsConfig not found');
        return;
    }
    const { apiUrl, i18n } = config;

    // ---- generic seam -----------------------------------------------------

    async function fetchJson(method, path, body) {
        const opts = {
            method,
            headers: { Accept: 'application/json' },
            credentials: 'include',
        };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        // Abort after 15s so a stalled Save/Delete can't hang its modal
        // indefinitely (same AbortController pattern as auth.js admin-scopes).
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        let res;
        try {
            res = await fetch(apiUrl + path, { ...opts, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            // non-JSON body — data stays null
        }
        if (!res.ok) {
            // A real Error (not a plain object) so callers get a stack trace;
            // status/body carry the API detail the catch handlers switch on.
            const err = new Error(`HTTP ${res.status}: ${method} ${path}`);
            err.status = res.status;
            err.body = data;
            throw err;
        }
        return data;
    }

    /**
     * Mirror TestScopeResolver::mapAppliesTo(): derive a test's scope object
     * from applies_to.
     *
     *   { rite, diocesan_calendar } → diocesan_calendar_test:<rite>/<id>
     *   { rite, national_calendar } → national_calendar_test:<rite>/<id>
     *   { rite }                    → rite_calendar_test:<rite>
     *   absent                      → rite_calendar_test:roman
     *
     * `rite_calendar_test` generalises the old `general_roman_calendar_test`,
     * whose fixed id `general_roman_calendar` denoted exactly the Roman
     * rite-level calendar; gateByScope() below still honours that older type so
     * pre-migration grants keep authorizing.
     */
    function deriveScope(appliesTo) {
        const rite = (appliesTo && appliesTo.rite) || ROMAN_RITE;
        if (appliesTo && appliesTo.diocesan_calendar) {
            return {
                object_type: 'diocesan_calendar_test',
                object_id: qualifyObjectId('diocesan_calendar_test', appliesTo.diocesan_calendar, rite),
            };
        }
        if (appliesTo && appliesTo.national_calendar) {
            // qualifyObjectId() pins national scopes to `roman` whatever the
            // test declares: the Ambrosian rite has no national tier, and the
            // API rejects `national_calendar_test:ambrosian/*` outright. A test
            // carrying that impossible pair is gated shut rather than matched
            // against a scope that could never have been granted.
            return {
                object_type: 'national_calendar_test',
                object_id: qualifyObjectId('national_calendar_test', appliesTo.national_calendar, rite),
            };
        }
        // No calendar named: the scope is the rite-level calendar, whose id IS
        // the rite — bare, not rite-qualified.
        return { object_type: 'rite_calendar_test', object_id: rite };
    }

    /**
     * The `{ type, id }` pair renderScopeControl()'s `pin()` needs to lock the
     * scope UI to an existing test's own scope, for the editor's "editing"
     * path. `id` MUST be a bare calendar id: it ends up in #testScopeId and
     * from there in selectedScope()'s `{ [type]: id }`, which becomes
     * `applies_to.national_calendar` / `applies_to.diocesan_calendar` on save
     * — never the rite-qualified FGA object id deriveScope() returns.
     *
     * @param {object} appliesTo - A test's `applies_to`.
     * @returns {{type: string, id: string}} The locked scope for the editor UI.
     */
    function deriveLockedScope(appliesTo) {
        const scope = deriveScope(appliesTo);
        return {
            type: scope.object_type === 'national_calendar_test' ? 'national_calendar'
                : scope.object_type === 'diocesan_calendar_test' ? 'diocesan_calendar'
                    : 'general_roman_calendar',
            id: bareCalendarId(scope.object_type, scope.object_id),
            // Straight from the server-supplied test, not re-derived: this is the
            // one scope-UI path where the ground truth is already in hand. It has
            // to survive into #testScopeRite, because on save it addresses the
            // test (/tests/{rite}/{name}) as well as populating applies_to.rite.
            rite: (appliesTo && appliesTo.rite) || ROMAN_RITE,
        };
    }

    /**
     * Whether one of the caller's granted scopes covers this test's scope.
     *
     * Tolerant of both pre-migration forms, because a grant written before
     * LiturgicalCalendarAPI #785 is still live and still authorizes on the API
     * side: an unqualified `national_calendar_test:IT` is read as Roman, and
     * `general_roman_calendar_test:general_roman_calendar` is the Roman
     * rite-level calendar under its former type name.
     */
    function gateByScope(scopeObj, scopes) {
        return scopes.some((s) => {
            if (
                scopeObj.object_type === 'rite_calendar_test'
                && s.object_type === 'general_roman_calendar_test'
            ) {
                return scopeObj.object_id === ROMAN_RITE;
            }
            return s.object_type === scopeObj.object_type
                && sameObjectId(scopeObj.object_type, s.object_id, scopeObj.object_id);
        });
    }

    function showModalAlert(modalEl, type, message) {
        const area = modalEl.querySelector('[id$="Alerts"]');
        if (!area) return;
        area.innerHTML = '';
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.setAttribute('role', 'alert');
        alert.textContent = message;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'alert');
        alert.appendChild(closeBtn);
        area.appendChild(alert);
    }

    // ---- state ------------------------------------------------------------

    const state = {
        tests: [],
        scopes: { is_global_admin: false, editor: [], admin: [] },
        editing: null,
    };

    function scopeLabel(appliesTo) {
        const s = deriveScope(appliesTo);
        // Labels show the bare calendar id: the `roman/` in `roman/IT` is an
        // authorization-model detail, not something to put in front of a user.
        if (s.object_type === 'national_calendar_test') {
            return `${i18n.nationalCalendar}: ${bareCalendarId(s.object_type, s.object_id)}`;
        }
        if (s.object_type === 'diocesan_calendar_test') {
            return `${i18n.diocesanCalendar}: ${bareCalendarId(s.object_type, s.object_id)}`;
        }
        return i18n.generalRomanCalendar;
    }

    function yearRange(test) {
        const years = test.assertions.map((a) => a.year);
        return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';
    }

    function canEdit(test) {
        return state.scopes.is_global_admin || gateByScope(deriveScope(test.applies_to), state.scopes.editor);
    }

    function canDelete(test) {
        return state.scopes.is_global_admin || gateByScope(deriveScope(test.applies_to), state.scopes.admin);
    }

    /**
     * The rite a test belongs to. `applies_to.rite` is required by
     * `LitCalTest.json`, but tests written before that requirement are still on
     * disk, and the API resolves those to the Roman partition — so mirror that
     * fallback rather than refusing to address them.
     */
    function testRite(test) {
        return (test && test.applies_to && test.applies_to.rite) || ROMAN_RITE;
    }

    /**
     * A single test's address. The rite segment is REQUIRED (API #787): the
     * corpus is partitioned by rite, so a name alone no longer identifies a
     * test — `/tests/{name}` is a 400, and on writes the FGA scope resolver
     * fails closed with a 403 before the body is ever validated.
     */
    function testPath(rite, name) {
        return `/tests/${encodeURIComponent(rite)}/${encodeURIComponent(name)}`;
    }

    function renderTableRows() {
        const tbody = document.getElementById('testsTableBody');
        const nameFilter = document.getElementById('filterTestName').value.trim().toLowerCase();
        const scopeFilter = document.getElementById('filterTestScope').value.trim().toLowerCase();
        const rows = state.tests.filter((t) => {
            const matchesName = !nameFilter || t.name.toLowerCase().includes(nameFilter);
            const matchesScope = !scopeFilter || scopeLabel(t.applies_to).toLowerCase().includes(scopeFilter);
            return matchesName && matchesScope;
        });
        document.getElementById('testsCount').textContent = String(rows.length);
        tbody.innerHTML = '';
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${i18n.noTests}</td></tr>`;
            return;
        }
        rows.forEach((t) => {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            const code = document.createElement('code');
            code.textContent = t.name;
            nameTd.appendChild(code);

            const eventTd = document.createElement('td');
            eventTd.textContent = t.event_key;

            const scopeTd = document.createElement('td');
            scopeTd.textContent = scopeLabel(t.applies_to);

            const typeTd = document.createElement('td');
            typeTd.textContent = t.test_type;

            const yearsTd = document.createElement('td');
            yearsTd.textContent = yearRange(t);

            const actionsTd = document.createElement('td');
            actionsTd.className = 'text-end';
            if (canEdit(t)) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'btn btn-sm btn-outline-primary editTestBtn';
                editBtn.dataset.name = t.name;
                // Name alone is ambiguous now that the corpus is partitioned by
                // rite: the same test name can exist under both. Carry the rite
                // so the row resolves to exactly the test it renders.
                editBtn.dataset.rite = testRite(t);
                const ei = document.createElement('i');
                ei.className = 'fas fa-pen';
                editBtn.append(ei, document.createTextNode(' ' + i18n.edit));
                actionsTd.appendChild(editBtn);
            }
            if (canDelete(t)) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'btn btn-sm btn-outline-danger deleteTestBtn ms-1';
                delBtn.dataset.name = t.name;
                delBtn.dataset.rite = testRite(t);
                const di = document.createElement('i');
                di.className = 'fas fa-trash';
                delBtn.append(di, document.createTextNode(' ' + i18n.delete));
                actionsTd.appendChild(delBtn);
            }

            tr.append(nameTd, eventTd, scopeTd, typeTd, yearsTd, actionsTd);
            tbody.appendChild(tr);
        });
    }

    async function loadTests() {
        const tbody = document.getElementById('testsTableBody');
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${i18n.loading}</td></tr>`;
        try {
            const [scopes, testsResp] = await Promise.all([
                fetchJson('GET', '/auth/test-scopes').catch(() => ({ is_global_admin: false, editor: [], admin: [] })),
                fetchJson('GET', '/tests'),
            ]);
            state.scopes = scopes;
            state.tests = testsResp.litcal_tests ?? [];
            renderTableRows();
        } catch (err) {
            console.error('Failed to load tests', err);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${i18n.failedToLoad}</td></tr>`;
        }
    }

    document.getElementById('refreshTestsBtn').addEventListener('click', loadTests);
    document.getElementById('filterTestName').addEventListener('input', renderTableRows);
    document.getElementById('filterTestScope').addEventListener('input', renderTableRows);

    // Expose internals for later tasks (editor/delete wiring appended below).
    window.__adminTests = { state, fetchJson, deriveScope, deriveLockedScope, gateByScope, showModalAlert, loadTests, renderTableRows, AssertionsBuilder, TestType, CalendarSelect, CalendarSelectFilter, RiteSelect, ApiClient };
    // selectedScope and authorizedScopeChoices are defined further down in
    // this closure; attached to the same exposed object once available so
    // tests can reach them without a full DOM/component round-trip through
    // openEditor()/renderScopeControl().

    // ---- editor -----------------------------------------------------------

    const editorModalEl = document.getElementById('testEditorModal');
    const editorModal = bootstrap.Modal.getOrCreateInstance(editorModalEl);
    const builder = new AssertionsBuilder({ locale: config.locale });
    let events = [];

    function selectedTestType() {
        return document.querySelector('input[name="testType"]:checked')?.value ?? TestType.ExactCorrespondence;
    }

    // selectedScope() now lives at module scope (it has to emit a rite, and a
    // pure function is the only way to test that without a DOM round-trip);
    // re-exposed here so the window.__adminTests seam keeps working.
    window.__adminTests.selectedScope = selectedScope;

    function eventsPath(appliesTo) {
        if (appliesTo && appliesTo.diocesan_calendar) return `/events/diocese/${appliesTo.diocesan_calendar}`;
        if (appliesTo && appliesTo.national_calendar) return `/events/nation/${appliesTo.national_calendar}`;
        return '/events';
    }

    async function loadEvents(appliesTo) {
        // The events catalog is public — omit credentials. EventsHandler serves a
        // wildcard Access-Control-Allow-Origin, and browsers reject wildcard ACAO
        // on credentialed requests (breaks the split-origin docker e2e stack).
        const res = await fetch(apiUrl + eventsPath(appliesTo), {
            headers: { Accept: 'application/json', 'Accept-Language': config.locale },
        });
        if (!res.ok) {
            // Surface the failure to the callers' .catch/showModalAlert handlers
            // instead of silently rendering an empty events datalist.
            throw new Error(`${i18n.failedToLoad} (HTTP ${res.status})`);
        }
        const json = await res.json();
        events = json.litcal_events ?? [];
        const datalist = document.getElementById('testEventKeyList');
        datalist.innerHTML = '';
        events.forEach((e) => {
            const opt = document.createElement('option');
            opt.value = e.event_key;
            opt.textContent = `${e.name} (${e.grade_lcl})`;
            if (e.month != null) opt.dataset.month = String(e.month);
            if (e.day != null) opt.dataset.day = String(e.day);
            if (e.grade != null) opt.dataset.grade = String(e.grade);
            datalist.appendChild(opt);
        });
    }

    function sliderYears() {
        const a = Number(document.getElementById('lowerRange').value);
        const b = Number(document.getElementById('upperRange').value);
        return { minYear: Math.min(a, b), maxYear: Math.max(a, b) };
    }

    /**
     * Port of UnitTestInterface's computeYearDateAttrs: title + Sunday flag
     * for the event's fixed date in the given year (empty when the event has
     * no fixed month/day).
     */
    function yearDateAttrs(year) {
        if (!builder.baseMonthDay) return { title: '', sunday: false };
        const d = new Date(
            Date.UTC(year, builder.baseMonthDay.month - 1, builder.baseMonthDay.day),
        );
        const sunday = d.getUTCDay() === 0;
        const fmt = new Intl.DateTimeFormat(config.locale, {
            dateStyle: 'long',
            timeZone: 'UTC',
        });
        const title = sunday
            ? i18n.sundayInYear
                .replace('%1$s', String(year))
                .replace('%2$s', fmt.format(d))
            : fmt.format(d);
        return { title, sunday };
    }

    function renderYearGrid() {
        const grid = document.getElementById('yearGrid');
        const { minYear, maxYear } = sliderYears();
        const tt = builder.model.test_type;
        // Excluded = assertion absence. The length guard prevents an all-striped
        // grid in the create flow before the first generation.
        const asserted = new Set(builder.model.assertions.map((a) => a.year));
        const notExists = new Set(
            builder.model.assertions
                .filter((a) => a.assert === AssertType.EventNotExists)
                .map((a) => a.year),
        );
        const pivot =
            tt === TestType.ExactCorrespondenceSince
                ? builder.model.year_since
                : tt === TestType.ExactCorrespondenceUntil
                    ? builder.model.year_until
                    : null;
        grid.innerHTML = '';
        for (let y = minYear; y <= maxYear; y++) {
            const span = document.createElement('span');
            span.className = `testYearSpan year-${y}`;
            span.dataset.year = String(y);
            if (builder.model.assertions.length > 0 && !asserted.has(y)) {
                span.classList.add('deleted');
                span.title = i18n.excludedRestore.replace('%s', String(y));
                grid.appendChild(span);
                continue;
            }
            // Icon semantics per test type: Since/Until = hammer ("set the
            // pivot year"); ExactCorrespondence = fa-repeat ("toggle
            // assertion", matching the per-year cards' toggle button). The
            // behavioral hook class (hammerYear) is shared — only the
            // visual icon and title differ.
            const isPivot = tt === TestType.ExactCorrespondenceSince || tt === TestType.ExactCorrespondenceUntil;
            const actionIcon = document.createElement('i');
            actionIcon.className = `fas ${isPivot ? 'fa-hammer' : 'fa-repeat'} me-1 opacity-50 hammerYear`;
            actionIcon.setAttribute('role', 'button');
            actionIcon.setAttribute('aria-hidden', 'true');
            actionIcon.title = isPivot ? i18n.setYear : i18n.toggleAssertion;
            span.appendChild(actionIcon);
            span.appendChild(document.createTextNode(String(y)));
            const xmark = document.createElement('i');
            xmark.className = 'fas fa-circle-xmark ms-1 opacity-50 removeYear';
            xmark.setAttribute('role', 'button');
            xmark.setAttribute('aria-hidden', 'true');
            xmark.title = i18n.removeYear;
            span.appendChild(xmark);
            const { title, sunday } = yearDateAttrs(y);
            if (title) span.title = title;
            // Background-color precedence: pivot > not-exists. Sunday is an
            // additive cross overlay (background-image) that composes over any
            // background-color instead of competing in a precedence chain.
            if (y === pivot) {
                span.classList.add('bg-info');
            } else if (notExists.has(y)) {
                span.classList.add('bg-warning');
            }
            if (sunday) span.classList.add('sunday');
            grid.appendChild(span);
        }
    }

    function regenerate() {
        const event = events.find((e) => e.event_key === document.getElementById('testEventKey').value);
        if (!event) return;
        const { minYear, maxYear } = sliderYears();
        const tt = selectedTestType();
        builder.setMeta({ test_type: tt, applies_to: selectedScope() });
        const pivot = (tt === TestType.ExactCorrespondenceSince || tt === TestType.ExactCorrespondenceUntil)
            ? minYear
            : null;
        // Exclusions = assertion absence: derive excludedYears from gaps inside
        // the asserted span so they survive event/type/slider changes. Years
        // outside [lo, hi] are never added, so slider-widening auto-includes
        // newly visible years.
        const assertedYears = builder.model.assertions.map((a) => a.year);
        const excludedYears = [];
        if (assertedYears.length) {
            const lo = Math.min(...assertedYears);
            const hi = Math.max(...assertedYears);
            const assertedSet = new Set(assertedYears);
            for (let y = Math.max(minYear, lo); y <= Math.min(maxYear, hi); y++) {
                if (!assertedSet.has(y)) excludedYears.push(y);
            }
        }
        builder.generate({
            event,
            minYear,
            maxYear,
            pivotYear: pivot,
            excludedYears,
        });
        document.getElementById('testDescription').value = builder.model.description;
        document.getElementById('baseDate').value = event.month && event.day
            ? `${minYear}-${String(event.month).padStart(2, '0')}-${String(event.day).padStart(2, '0')}`
            : '';
        builder.render(document.getElementById('assertionsContainer'));
        renderYearGrid();
    }

    document.getElementById('testEventKey').addEventListener('input', updateDerivedName);
    document.getElementById('testEventKey').addEventListener('change', regenerate);
    document.querySelectorAll('input[name="testType"]').forEach((el) => el.addEventListener('change', regenerate));
    document.getElementById('lowerRange').addEventListener('change', regenerate);
    document.getElementById('upperRange').addEventListener('change', regenerate);

    // sync slider CSS custom properties as the user drags
    ['lowerRange', 'upperRange'].forEach((id, idx) => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            const prop = idx === 0 ? '--value-a' : '--value-b';
            const textProp = idx === 0 ? '--text-value-a' : '--text-value-b';
            el.parentNode.style.setProperty(prop, el.value);
            el.parentNode.style.setProperty(textProp, `"${el.value}"`);
        });
    });

    // per-year card interactions (event-delegated on the assertions container)
    const assertionsContainer = document.getElementById('assertionsContainer');
    assertionsContainer.addEventListener('click', (ev) => {
        const card = ev.target.closest('[data-year]');
        if (!card) return;
        const year = Number(card.dataset.year);
        if (ev.target.closest('.toggleAssert')) {
            builder.toggleAssert(year);
            builder.render(assertionsContainer);
            // The year chip's "event (not) expected" styling derives from the
            // assertion's assert type, so re-render the grid to keep it in sync.
            renderYearGrid();
        } else if (ev.target.closest('.comment')) {
            document.getElementById('commentYear').value = String(year);
            const a = builder.model.assertions.find((x) => x.year === year);
            document.getElementById('commentText').value = a && 'comment' in a ? a.comment : '';
            bootstrap.Modal.getOrCreateInstance(document.getElementById('testCommentModal')).show();
        } else if (ev.target.closest('.editDate')) {
            const dateVal = card.querySelector('.expectedValue');
            const current = (dateVal.getAttribute('data-value') || '').split('T')[0];
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'form-control form-control-sm';
            input.value = current;
            dateVal.replaceChildren(input);
            input.focus();
            input.addEventListener('change', () => {
                if (input.value) {
                    builder.setExpectedDate(year, `${input.value}T00:00:00+00:00`);
                }
                builder.render(assertionsContainer);
            });
            input.addEventListener('blur', () => builder.render(assertionsContainer));
        }
    });
    assertionsContainer.addEventListener('change', (ev) => {
        const card = ev.target.closest('[data-year]');
        if (!card) return;
        const year = Number(card.dataset.year);
        if (ev.target.matches('.assertionText')) {
            builder.setAssertionText(year, ev.target.value);
        }
    });
    document.getElementById('saveCommentBtn').addEventListener('click', () => {
        const year = Number(document.getElementById('commentYear').value);
        builder.setComment(year, document.getElementById('commentText').value);
        builder.render(assertionsContainer);
        bootstrap.Modal.getInstance(document.getElementById('testCommentModal')).hide();
    });

    // The base date drives per-year expected values. For events without a fixed
    // month/day (movable feasts) this is the ONLY way to seed dates: setting it
    // updates baseMonthDay so toggleAssert can restore dates, and refreshes every
    // eventExists assertion to the new month/day in its own year.
    document.getElementById('baseDate').addEventListener('change', (ev) => {
        const v = ev.target.value; // YYYY-MM-DD
        if (!v) return;
        const [, m, d] = v.split('-').map(Number);
        // Re-anchor the model to the new base date: the expected dates, the
        // suggested description, and every per-year assertion's suggested text
        // all follow from the base month/day.
        builder.rebaseDate({ month: m, day: d });
        document.getElementById('testDescription').value = builder.model.description;
        builder.render(assertionsContainer);
        // The year-grid chips derive their Sunday overlay/title from baseMonthDay
        // (via yearDateAttrs), so re-render the grid too.
        renderYearGrid();
    });

    // Year-grid interactions (ported from UnitTestInterface, state-first):
    //   hammer  → Since/Until: set the pivot; ExactCorrespondence: toggle that year
    //   x-mark  → exclude the year (collapses to the striped bar)
    //   striped bar → restore the year
    //   span body   → no action (the icons are the affordances)
    document.getElementById('yearGrid').addEventListener('click', (ev) => {
        const span = ev.target.closest('.testYearSpan');
        if (!span) return;
        const year = Number(span.dataset.year);
        if (span.classList.contains('deleted')) {
            builder.includeYear(year);
        } else if (ev.target.closest('.removeYear')) {
            builder.excludeYear(year);
        } else if (ev.target.closest('.hammerYear')) {
            const tt = selectedTestType();
            if (
                tt === TestType.ExactCorrespondenceSince ||
                tt === TestType.ExactCorrespondenceUntil
            ) {
                builder.setPivot(year);
            } else {
                builder.toggleAssert(year);
            }
        } else {
            return;
        }
        builder.render(assertionsContainer);
        renderYearGrid();
    });

    async function syncScopeIdField() {
        const type = document.getElementById('testScopeType').value;
        const mount = document.getElementById('testScopeIdMount');
        mount.innerHTML = '';
        if (type === 'national_calendar' || type === 'diocesan_calendar') {
            // See permission-requests.js: swallowing a failure here leaves the
            // mount empty, which is indistinguishable from "still loading".
            // A newer syncScopeIdField() may have run while we were awaiting, in
            // which case it has already cleared the mount and rendered the control
            // for the current scope. Appending anything now would stack a stale
            // #testScopeId on top of it. Matches the guards in
            // permission-requests.js and admin-permissions.js.
            const isStale = () => document.getElementById('testScopeType')?.value !== type;
            try {
                const client = await ApiClient.init(apiUrl).catch(() => null);
                if (!client) throw new Error('ApiClient initialization failed');
                if (isStale()) return;
                const isNational = type === 'national_calendar';
                const filter = isNational
                    ? CalendarSelectFilter.NATIONAL_CALENDARS
                    : CalendarSelectFilter.DIOCESAN_CALENDARS;
                // The Ambrosian rite has no national tier: a `nations` filtered select
                // under it holds only the rite-level calendar and hides itself, which
                // would strand the admin with no way to fill a required field. So the
                // rite select is offered for diocesan scopes only, where the Ambrosian
                // rite does have calendars (Lugano, Bergamo, Milano, Novara).
                //
                // It must be in the DOM before linkToRiteSelect() below, which attaches
                // its change listener to this element.
                let riteSelect = null;
                if (!isNational) {
                    riteSelect = new RiteSelect(config.locale).class('form-select mb-2').id('testScopeRite');
                    riteSelect.appendTo(mount);
                }
                const sel = new CalendarSelect(config.locale).filter(filter).allowNull(true).class('form-select').id('testScopeId');
                sel.appendTo(mount);
                if (riteSelect) {
                    sel.linkToRiteSelect(riteSelect);
                }
            } catch (err) {
                console.error(`[admin-tests] Could not build the calendar select for scope type "${type}":`, err);
                if (isStale()) return;
                const failed = document.createElement('select');
                failed.className = 'form-select is-invalid';
                failed.id = 'testScopeId';
                failed.disabled = true;
                failed.dataset.loadFailed = 'true';
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Could not load calendars — try reloading the page';
                opt.selected = true;
                failed.appendChild(opt);
                mount.appendChild(failed);
            }
        }
    }

    // ---- Deterministic name + scope-constrained controls --------------------
    // Convention (LitCalTest.json): a test's name is its event_key + 'Test'.
    const TEST_NAME_RE = /^(?:[a-z_]+?_){0,1}[A-Z][a-zA-Z1-9]+[0-9]{0,2}(?:_vigil)?Test$/;

    function derivedName() {
        const ev = document.getElementById('testEventKey').value.trim();
        return ev ? `${ev}Test` : '';
    }
    function updateDerivedName() {
        const name = derivedName();
        document.getElementById('derivedTestName').textContent =
            name ? `${i18n.testNameLabel} ${name}` : '';
    }

    function scopeChoiceLabel(type, id) {
        if (type === 'national_calendar') return `${i18n.nationalCalendar}: ${id}`;
        if (type === 'diocesan_calendar') return `${i18n.diocesanCalendar}: ${id}`;
        return i18n.generalRomanCalendar;
    }

    /** Deduped scopes the current non-admin user may author tests for. */
    function authorizedScopeChoices() {
        const seen = new Set();
        const choices = [];
        [...(state.scopes.editor || []), ...(state.scopes.admin || [])].forEach((s) => {
            const type = s.object_type === 'diocesan_calendar_test' ? 'diocesan_calendar'
                : s.object_type === 'national_calendar_test' ? 'national_calendar'
                    : 'general_roman_calendar';
            // `applies_to` (via #testScopeId → selectedScope()) holds bare
            // calendar ids, never FGA object ids — strip the rite qualifier
            // s.object_id carries (e.g. `roman/USA`) before it reaches there.
            // The rite it was stripped of is kept: it is the only place the
            // rite of an authorized scope is known, and #testScopeRite has to
            // carry it back into applies_to.rite and the request path on save.
            const { rite, id } = splitObjectId(s.object_type, s.object_id);
            // Dedupe on the NORMALIZED id, not the raw object_id. The API's tuple
            // migration is copy-then-prune, so during the migration window a legacy
            // bare grant (`national_calendar_test:USA`) and its migrated twin
            // (`national_calendar_test:roman/USA`) both exist — two tuples naming
            // one calendar. Keying on the raw id would offer the user the same
            // calendar twice, with identical labels.
            const key = `${type}:${id}`;
            if (seen.has(key)) return;
            seen.add(key);
            choices.push({ type, id, rite });
        });
        return choices;
    }
    window.__adminTests.authorizedScopeChoices = authorizedScopeChoices;

    // Configure the scope UI to one of three modes and guarantee that afterwards
    // #testScopeType (value) and, for scoped types, #testScopeId (value) reflect
    // the selection, so selectedScope() keeps working unchanged:
    //   locked (edit)   → static text, scope pinned to the test's own scope
    //   global admin    → full picker (type select + CalendarSelect)
    //   one authorized  → static text, pinned to that single scope
    //   many authorized → a select limited to those scopes
    async function renderScopeControl(locked) {
        const typeSel = document.getElementById('testScopeType');
        const mount = document.getElementById('testScopeIdMount');
        const staticEl = document.getElementById('testScopeStatic');
        mount.innerHTML = '';
        staticEl.textContent = '';
        staticEl.classList.add('d-none');

        // `rite` mirrors the locked/pinned scope's rite into a hidden
        // `#testScopeRite` input, the same id the linked RiteSelect uses in the
        // full-picker (global admin) path — so selectedScope() can read it
        // uniformly regardless of which of the three scope-UI modes rendered it.
        const pin = (type, id, rite) => {
            typeSel.value = type;
            typeSel.classList.add('d-none');
            typeSel.disabled = true;
            staticEl.textContent = scopeChoiceLabel(type, id);
            staticEl.classList.remove('d-none');
            if (type !== 'general_roman_calendar' && id) {
                const hid = document.createElement('input');
                hid.type = 'hidden';
                hid.id = 'testScopeId';
                hid.value = id;
                mount.appendChild(hid);
                const hidRite = document.createElement('input');
                hidRite.type = 'hidden';
                hidRite.id = 'testScopeRite';
                hidRite.value = rite || Rite.ROMAN;
                mount.appendChild(hidRite);
            }
        };

        if (locked) { pin(locked.type, locked.id, locked.rite); return; }

        if (state.scopes.is_global_admin) {
            typeSel.classList.remove('d-none');
            typeSel.disabled = false;
            await syncScopeIdField();
            return;
        }

        const choices = authorizedScopeChoices();
        if (choices.length <= 1) {
            if (choices[0]) pin(choices[0].type, choices[0].id, choices[0].rite);
            return;
        }

        // Multiple authorized scopes → a select limited to them. The pre-existing
        // #testScopeIdMount 'change' listener reloads the events catalog; this
        // listener only syncs the hidden scope fields, and being on the event
        // target it fires before the mount's bubble-phase listener.
        typeSel.classList.add('d-none');
        typeSel.disabled = true;
        const sel = document.createElement('select');
        sel.className = 'form-select';
        sel.id = 'scopeChoice';
        choices.forEach((c, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = scopeChoiceLabel(c.type, c.id);
            sel.appendChild(opt);
        });
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.id = 'testScopeId';
        const hidRite = document.createElement('input');
        hidRite.type = 'hidden';
        hidRite.id = 'testScopeRite';
        const applyChoice = () => {
            const c = choices[Number(sel.value)] || choices[0];
            typeSel.value = c.type;
            hid.value = c.type === 'general_roman_calendar' ? '' : c.id;
            hidRite.value = c.rite;
        };
        sel.addEventListener('change', () => { applyChoice(); updateDerivedName(); });
        mount.appendChild(sel);
        mount.appendChild(hid);
        mount.appendChild(hidRite);
        applyChoice();
    }
    // Reload the /events datalist for the currently selected scope, then rebuild
    // the assertions. Used whenever the scope changes, since national/diocesan
    // calendars expose events the General Roman list does not.
    function reloadEventsThenRegenerate() {
        return loadEvents(selectedScope())
            .then(regenerate)
            .catch((err) => showModalAlert(editorModalEl, 'danger', err.message ?? i18n.failedToLoad));
    }
    document.getElementById('testScopeType').addEventListener('change', () => {
        syncScopeIdField();
        reloadEventsThenRegenerate();
    });
    // When a specific national/diocesan calendar is picked in the mounted
    // CalendarSelect, its change event bubbles to the mount — reload its events.
    document.getElementById('testScopeIdMount').addEventListener('change', reloadEventsThenRegenerate);

    async function openEditor(test) {
        state.editing = test ? test.name : null;
        document.getElementById('testEditorAlerts').innerHTML = '';
        const eventEl = document.getElementById('testEventKey');
        if (test) {
            builder.load(test);
            const typeRadio = document.querySelector(`input[name="testType"][value="${test.test_type}"]`);
            if (typeRadio) typeRadio.checked = true;
            eventEl.value = test.event_key;
            // Scope + event are the test's identity (name = event_key + 'Test'),
            // so the event is read-only on edit. Scope is locked below.
            eventEl.setAttribute('readonly', '');
            updateDerivedName();
            document.getElementById('testDescription').value = test.description;
            // Fix 4: Seed slider from loaded test assertions before any slider change fires
            const years = test.assertions.map((a) => a.year);
            if (years.length) {
                const lo = Math.min(...years);
                const hi = Math.max(...years);
                const lower = document.getElementById('lowerRange');
                const upper = document.getElementById('upperRange');
                lower.value = String(lo);
                upper.value = String(hi);
                const slider = lower.parentNode;
                slider.style.setProperty('--value-a', String(lo));
                slider.style.setProperty('--text-value-a', `"${lo}"`);
                slider.style.setProperty('--value-b', String(hi));
                slider.style.setProperty('--text-value-b', `"${hi}"`);
                // Provisional base date (spec R3/R3.1): load() derived
                // baseMonthDay as the MODE of the dated assertions — shown
                // until the events catalog resolves below, which is the
                // authoritative source (the canonical date; assertions hold
                // resolved, possibly transferred dates). The year component is
                // presentational only; the field's change handler expands
                // month/day across every asserted year.
                document.getElementById('baseDate').value = builder.baseMonthDay
                    ? `${String(lo).padStart(4, '0')}-${String(builder.baseMonthDay.month).padStart(2, '0')}-${String(builder.baseMonthDay.day).padStart(2, '0')}`
                    : '';
                renderYearGrid();
            }
            loadEvents(test.applies_to)
                .then(() => {
                    // Catalog override (spec R3.1): the base date is a Sunday-
                    // coincidence assist on the event's CANONICAL month/day, so
                    // the catalog wins over the assertions-mode fallback when it
                    // knows the event's fixed date. Set the field value and
                    // builder.baseMonthDay directly — dispatching 'change' here
                    // would rewrite every assertion's expected_value.
                    const catalogEvent = events.find((e) => e.event_key === test.event_key);
                    if (catalogEvent && catalogEvent.month && catalogEvent.day && years.length) {
                        const lo = Math.min(...years);
                        builder.baseMonthDay = { month: Number(catalogEvent.month), day: Number(catalogEvent.day) };
                        document.getElementById('baseDate').value =
                            `${String(lo).padStart(4, '0')}-${String(catalogEvent.month).padStart(2, '0')}-${String(catalogEvent.day).padStart(2, '0')}`;
                        renderYearGrid(); // Sunday crosses re-derive from the canonical date
                    }
                    builder.render(assertionsContainer);
                })
                .catch((err) => showModalAlert(editorModalEl, 'danger', err.message ?? i18n.failedToLoad));
        } else {
            builder.load({ name: '', event_key: '', description: '', test_type: TestType.ExactCorrespondence, assertions: [] });
            document.getElementById('tt-exact').checked = true;
            eventEl.value = '';
            eventEl.removeAttribute('readonly');
            updateDerivedName();
            document.getElementById('testDescription').value = '';
            document.getElementById('testScopeType').value = 'general_roman_calendar';
            assertionsContainer.innerHTML = '';
            loadEvents(null).catch((err) => showModalAlert(editorModalEl, 'danger', err.message ?? i18n.failedToLoad));
        }
        // Scope UI: locked to the test's own scope when editing; otherwise
        // constrained to the user's permissions (full picker for global admins).
        let lockedScope = null;
        if (test) {
            lockedScope = deriveLockedScope(test.applies_to);
        }
        await renderScopeControl(lockedScope);
        editorModal.show();
    }

    document.getElementById('createTestBtn').addEventListener('click', () => openEditor(null));
    document.getElementById('testsTableBody').addEventListener('click', (ev) => {
        const editBtn = ev.target.closest('.editTestBtn');
        if (editBtn) {
            const test = state.tests.find(
                (t) => t.name === editBtn.dataset.name && testRite(t) === editBtn.dataset.rite
            );
            if (test) openEditor(test);
        }
    });

    /**
     * The warning to show instead of saving, or null when the editor is
     * fillable-and-filled. Only the derived name can be *invalid* (as opposed
     * to missing), so an empty event key reads as "required", not "malformed".
     */
    function editorValidationMessage(eventKey, name, hasDescription) {
        if (eventKey && !TEST_NAME_RE.test(name)) return i18n.invalidName;
        if (!eventKey || !hasDescription || !TEST_NAME_RE.test(name)) return i18n.requiredFields;
        return null;
    }

    /**
     * The `applies_to` to send. `selectedScope()` returns undefined for a scoped
     * type with no calendar ID picked yet → when editing, keep the test's
     * existing scope; when creating, fall back to null so an incomplete pick
     * fails loudly at the API rather than silently resolving to General Roman.
     * Every other return is already a concrete, rite-carrying scope object.
     */
    function scopePayloadForSave() {
        const chosen = selectedScope();
        if (chosen !== undefined) return chosen;
        return state.editing ? builder.model.applies_to : null;
    }

    /** The most specific message we can show for a failed create/update. */
    function saveErrorMessage(err) {
        if (err.status === 403) return i18n.denied403;
        if (err.status === 409) return i18n.conflict409;
        return (err.body && err.body.message) ? err.body.message : i18n.failedToLoad;
    }

    document.getElementById('saveTestBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveTestBtn');
        const eventKey = document.getElementById('testEventKey').value.trim();
        // Name is derived from the event key, never typed (schema convention
        // name = event_key + 'Test'). On edit it's the immutable identifier.
        const name = state.editing || `${eventKey}Test`;
        const hasDescription = document.getElementById('testDescription').value.trim() !== '';
        const invalid = editorValidationMessage(eventKey, name, hasDescription);
        if (invalid) {
            showModalAlert(editorModalEl, 'warning', invalid);
            return;
        }
        const scopePayload = scopePayloadForSave();
        builder.setMeta({
            name,
            event_key: eventKey,
            description: document.getElementById('testDescription').value,
            test_type: selectedTestType(),
            applies_to: scopePayload,
        });
        const payload = builder.serialize();
        // The path segment and applies_to.rite must name the same rite — the API
        // rejects a write whose address contradicts its body, since the directory
        // is the address and applies_to is the content. Reading the rite off the
        // payload we are about to send is what keeps the two from diverging.
        const rite = (scopePayload && scopePayload.rite) || ROMAN_RITE;
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = i18n.saving;
        try {
            const method = state.editing ? 'PATCH' : 'PUT';
            await fetchJson(method, testPath(rite, state.editing || payload.name), payload);
            editorModal.hide();
            await loadTests();
        } catch (err) {
            showModalAlert(editorModalEl, 'danger', saveErrorMessage(err));
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    // ---- delete -----------------------------------------------------------

    const deleteModalEl = document.getElementById('deleteTestModal');
    const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    let deleteTarget = null;
    let deleteTargetRite = ROMAN_RITE;

    document.getElementById('testsTableBody').addEventListener('click', (ev) => {
        const delBtn = ev.target.closest('.deleteTestBtn');
        if (!delBtn) return;
        deleteTarget = delBtn.dataset.name;
        deleteTargetRite = delBtn.dataset.rite || ROMAN_RITE;
        document.getElementById('deleteTestAlerts').innerHTML = '';
        document.getElementById('deleteTestConfirmText').textContent = i18n.confirmDelete.replace('%s', deleteTarget);
        deleteModal.show();
    });

    document.getElementById('confirmDeleteTestBtn').addEventListener('click', async () => {
        if (!deleteTarget) return;
        const btn = document.getElementById('confirmDeleteTestBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = i18n.deleting;
        try {
            await fetchJson('DELETE', testPath(deleteTargetRite, deleteTarget));
            deleteModal.hide();
            await loadTests();
        } catch (err) {
            const msg = err.status === 403 ? i18n.denied403 : (err.body && err.body.message) ? err.body.message : i18n.failedToLoad;
            showModalAlert(deleteModalEl, 'danger', msg);
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    loadTests();
});
