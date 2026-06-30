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
import { AssertionsBuilder, TestType } from './AssertionsBuilder.js';

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
        const res = await fetch(apiUrl + path, opts);
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            // non-JSON body — data stays null
        }
        if (!res.ok) {
            throw { status: res.status, body: data };
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

    loadTests();
});
