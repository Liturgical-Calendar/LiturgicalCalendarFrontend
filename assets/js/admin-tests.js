/**
 * admin-tests page module. Bespoke (not the status-workflow factory), modeled
 * on admin-permissions.js. Internal seam: generic CRUD plumbing vs.
 * test-specific logic, so it can later seed a shared admin-page factory.
 */
import {
    ApiClient,
    CalendarSelect,
    CalendarSelectFilter,
} from '@liturgical-calendar/components-js';
import { AssertionsBuilder, TestType, AssertType } from './AssertionsBuilder.js';

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

    /** Mirror TestScopeResolver: derive a test's scope object from applies_to. */
    function deriveScope(appliesTo) {
        if (appliesTo && appliesTo.diocesan_calendar) {
            return { object_type: 'diocesan_calendar_test', object_id: appliesTo.diocesan_calendar };
        }
        if (appliesTo && appliesTo.national_calendar) {
            return { object_type: 'national_calendar_test', object_id: appliesTo.national_calendar };
        }
        return { object_type: 'general_roman_calendar_test', object_id: 'general_roman_calendar' };
    }

    function gateByScope(scopeObj, scopes) {
        return scopes.some((s) => s.object_type === scopeObj.object_type && s.object_id === scopeObj.object_id);
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
        if (s.object_type === 'national_calendar_test') return `${i18n.nationalCalendar}: ${s.object_id}`;
        if (s.object_type === 'diocesan_calendar_test') return `${i18n.diocesanCalendar}: ${s.object_id}`;
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
    window.__adminTests = { state, fetchJson, deriveScope, gateByScope, showModalAlert, loadTests, renderTableRows, AssertionsBuilder, TestType, CalendarSelect, CalendarSelectFilter, ApiClient };

    // ---- editor -----------------------------------------------------------

    const editorModalEl = document.getElementById('testEditorModal');
    const editorModal = bootstrap.Modal.getOrCreateInstance(editorModalEl);
    const builder = new AssertionsBuilder({ locale: config.locale });
    let events = [];

    function selectedTestType() {
        return document.querySelector('input[name="testType"]:checked')?.value ?? TestType.ExactCorrespondence;
    }

    /**
     * Three-state scope reading so the save flow can tell an explicit choice
     * apart from an incomplete one:
     *   null      — the user explicitly selected General Roman Calendar
     *   undefined — a scoped type is selected but no calendar ID is picked yet
     *   object    — a concrete { national_calendar | diocesan_calendar: id }
     */
    function selectedScope() {
        const type = document.getElementById('testScopeType').value;
        if (type === 'general_roman_calendar') return null;
        const idEl = document.getElementById('testScopeId');
        const id = idEl ? idEl.value : '';
        return id ? { [type]: id } : undefined;
    }

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

    function renderYearGrid() {
        const grid = document.getElementById('yearGrid');
        const { minYear, maxYear } = sliderYears();
        grid.innerHTML = '';
        for (let y = minYear; y <= maxYear; y++) {
            const span = document.createElement('span');
            span.className = `testYearSpan year-${y}`;
            span.dataset.year = String(y);
            span.textContent = String(y);
            grid.appendChild(span);
        }
        const pivot = builder.model.test_type === TestType.ExactCorrespondenceSince
            ? builder.model.year_since
            : builder.model.test_type === TestType.ExactCorrespondenceUntil
                ? builder.model.year_until
                : null;
        if (pivot !== null) {
            grid.querySelectorAll('.testYearSpan').forEach((span) => {
                const y = Number(span.dataset.year);
                if (y === pivot) span.classList.add('bg-info');
                else if (builder.model.test_type === TestType.ExactCorrespondenceSince ? y < pivot : y > pivot) {
                    span.classList.add('bg-warning');
                }
            });
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
        builder.generate({ event, minYear, maxYear, pivotYear: pivot });
        document.getElementById('testDescription').value = builder.model.description;
        document.getElementById('baseDate').value = event.month && event.day
            ? `${minYear}-${String(event.month).padStart(2, '0')}-${String(event.day).padStart(2, '0')}`
            : '';
        builder.render(document.getElementById('assertionsContainer'));
        renderYearGrid();
    }

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
        builder.baseMonthDay = { month: m, day: d };
        builder.model.assertions.forEach((a) => {
            if (a.assert === AssertType.EventTypeExact) {
                builder.setExpectedDate(
                    a.year,
                    `${String(a.year).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+00:00`,
                );
            }
        });
        builder.render(assertionsContainer);
    });

    // For Since/Until types, clicking a year in the overview grid sets the pivot
    // (year_since / year_until) and re-splits the assertions around it.
    document.getElementById('yearGrid').addEventListener('click', (ev) => {
        const span = ev.target.closest('.testYearSpan');
        if (!span) return;
        const tt = selectedTestType();
        if (tt !== TestType.ExactCorrespondenceSince && tt !== TestType.ExactCorrespondenceUntil) return;
        builder.setPivot(Number(span.dataset.year));
        builder.render(assertionsContainer);
        renderYearGrid();
    });

    async function syncScopeIdField() {
        const type = document.getElementById('testScopeType').value;
        const mount = document.getElementById('testScopeIdMount');
        mount.innerHTML = '';
        if (type === 'national_calendar' || type === 'diocesan_calendar') {
            const client = await ApiClient.init(apiUrl).catch(() => null);
            if (!client) return;
            const filter = type === 'national_calendar'
                ? CalendarSelectFilter.NATIONAL_CALENDARS
                : CalendarSelectFilter.DIOCESAN_CALENDARS;
            const sel = new CalendarSelect(config.locale).filter(filter).allowNull(true).class('form-select').id('testScopeId');
            sel.appendTo(mount);
        }
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
        const nameEl = document.getElementById('testName');
        if (test) {
            builder.load(test);
            nameEl.value = test.name;
            nameEl.setAttribute('readonly', '');
            const typeRadio = document.querySelector(`input[name="testType"][value="${test.test_type}"]`);
            if (typeRadio) typeRadio.checked = true;
            document.getElementById('testEventKey').value = test.event_key;
            document.getElementById('testDescription').value = test.description;
            const scope = deriveScope(test.applies_to);
            const typeSel = document.getElementById('testScopeType');
            typeSel.value = scope.object_type === 'national_calendar_test' ? 'national_calendar'
                : scope.object_type === 'diocesan_calendar_test' ? 'diocesan_calendar'
                : 'general_roman_calendar';
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
                renderYearGrid();
            }
            loadEvents(test.applies_to)
                .then(() => builder.render(assertionsContainer))
                .catch((err) => showModalAlert(editorModalEl, 'danger', err.message ?? i18n.failedToLoad));
        } else {
            builder.load({ name: '', event_key: '', description: '', test_type: TestType.ExactCorrespondence, assertions: [] });
            nameEl.value = '';
            nameEl.removeAttribute('readonly');
            document.getElementById('tt-exact').checked = true;
            document.getElementById('testEventKey').value = '';
            document.getElementById('testDescription').value = '';
            document.getElementById('testScopeType').value = 'general_roman_calendar';
            assertionsContainer.innerHTML = '';
            loadEvents(null).catch((err) => showModalAlert(editorModalEl, 'danger', err.message ?? i18n.failedToLoad));
        }
        await syncScopeIdField();
        if (test) {
            // Preselect the loaded test's calendar in the freshly-mounted select so
            // selectedScope() round-trips applies_to instead of silently rescoping
            // the test to General Roman (or 403ing a scoped editor).
            const scope = deriveScope(test.applies_to);
            const idEl = document.getElementById('testScopeId');
            if (idEl && scope.object_type !== 'general_roman_calendar_test') {
                idEl.value = scope.object_id;
            }
        }
        editorModal.show();
    }

    document.getElementById('createTestBtn').addEventListener('click', () => openEditor(null));
    document.getElementById('testsTableBody').addEventListener('click', (ev) => {
        const editBtn = ev.target.closest('.editTestBtn');
        if (editBtn) {
            const test = state.tests.find((t) => t.name === editBtn.dataset.name);
            if (test) openEditor(test);
        }
    });

    document.getElementById('saveTestBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveTestBtn');
        const nameEl = document.getElementById('testName');
        if (!nameEl.checkValidity() || !document.getElementById('testEventKey').value) {
            showModalAlert(editorModalEl, 'warning', i18n.requiredFields);
            return;
        }
        // undefined = scoped type without an ID picked yet → when editing, keep
        // the test's existing applies_to; null = explicit General Roman → clear
        // any previous scope (this must NOT fall back to the old applies_to).
        const chosen = selectedScope();
        const scopePayload = chosen === undefined
            ? (state.editing ? builder.model.applies_to : null)
            : chosen;
        builder.setMeta({
            name: nameEl.value,
            event_key: document.getElementById('testEventKey').value,
            description: document.getElementById('testDescription').value,
            test_type: selectedTestType(),
            applies_to: scopePayload,
        });
        const payload = builder.serialize();
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = i18n.saving;
        try {
            if (state.editing) {
                await fetchJson('PATCH', `/tests/${encodeURIComponent(state.editing)}`, payload);
            } else {
                await fetchJson('PUT', '/tests', payload);
            }
            editorModal.hide();
            await loadTests();
        } catch (err) {
            const msg = err.status === 403 ? i18n.denied403
                : err.status === 409 ? i18n.conflict409
                : (err.body && err.body.message) ? err.body.message : i18n.failedToLoad;
            showModalAlert(editorModalEl, 'danger', msg);
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    // ---- delete -----------------------------------------------------------

    const deleteModalEl = document.getElementById('deleteTestModal');
    const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    let deleteTarget = null;

    document.getElementById('testsTableBody').addEventListener('click', (ev) => {
        const delBtn = ev.target.closest('.deleteTestBtn');
        if (!delBtn) return;
        deleteTarget = delBtn.dataset.name;
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
            await fetchJson('DELETE', `/tests/${encodeURIComponent(deleteTarget)}`);
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
