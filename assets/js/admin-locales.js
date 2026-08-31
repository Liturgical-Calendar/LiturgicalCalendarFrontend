/**
 * Supported-locale curation.
 *
 * Lists every candidate locale with its readiness, and promotes or demotes it
 * against `POST /admin/locales/{locale}/{promote|demote}` (API #926).
 *
 * Extracted from the inline script in `admin-locales.php` so it can `import`
 * the shared write-disposition helper: a curation write is not necessarily
 * applied to disk, and reporting a queued write as done is exactly the bug
 * #501 fixed everywhere else.
 *
 * @module admin-locales
 */

import { describeWriteOutcome } from './writeDisposition.js';

const config = window.AdminLocalesConfig;

if (!config) {
    console.error('AdminLocalesConfig not found');
}

const { apiUrl, i18n } = config ?? { apiUrl: '', i18n: {} };

const tableBody        = document.getElementById('localesTableBody');
const curationNotice   = document.getElementById('curationNotice');
const refreshBtn       = document.getElementById('refreshBtn');
const detailModalEl    = document.getElementById('detailModal');
const detailModal      = detailModalEl ? new bootstrap.Modal(detailModalEl) : null;
const detailModalTitle = document.getElementById('detailModalTitle');
const detailModalBody  = document.getElementById('detailModalBody');

/**
 * The curation state from the last successful load. Actions read it to decide
 * whether they are permitted at all, so it must never go stale silently — every
 * load() refreshes it, and a failed load leaves it null, which disables actions.
 * @type {?{writable: boolean, mode: string, reason: string}}
 */
let curation = null;

/** How many locales are currently official — the last one may not be demoted. */
let officialCount = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

const badge = (klass, text) => `<span class="badge bg-${klass}">${escapeHtml(text)}</span>`;

/**
 * Why a curation button is disabled, or null when it is enabled.
 *
 * The order matters: an unwritable deployment refuses everything, so it is
 * reported before the per-row reasons that would otherwise mask it.
 *
 * @param {{locale: string, official: boolean, ready: boolean}} row
 * @param {'promote'|'demote'} action
 * @returns {?string}
 */
export function disabledReason(row, action, curationState, officialTotal, strings = i18n) {
    if (!curationState || !curationState.writable) {
        return curationState?.reason || strings.readOnly;
    }
    if (action === 'promote' && !row.ready) {
        return strings.notReadyHint;
    }
    // Demotion is deliberately NOT readiness-gated upstream — removing a locale
    // only loosens enforcement. The one thing it may not do is empty the list.
    if (action === 'demote' && officialTotal <= 1) {
        return strings.lastOfficialHint;
    }
    return null;
}

/**
 * One promote/demote button, or '' when the action does not apply to this row.
 *
 * @param {{locale: string, official: boolean, ready: boolean}} row
 * @param {'promote'|'demote'} action
 */
function actionButton(row, action) {
    const applies = action === 'promote' ? !row.official : row.official;
    if (!applies) return '';

    const why      = disabledReason(row, action, curation, officialCount);
    const label    = action === 'promote' ? i18n.promote : i18n.demote;
    const klass    = action === 'promote' ? 'btn-outline-success' : 'btn-outline-warning';
    const icon     = action === 'promote' ? 'fa-arrow-up' : 'fa-arrow-down';
    // title, not a Bootstrap tooltip: a disabled button does not fire the mouse
    // events Bootstrap's tooltip binds to, so the reason would never be shown.
    const titleAttr = why ? ` title="${escapeHtml(why)}"` : '';

    return `
        <button type="button" class="btn btn-sm ${klass} ms-1"
                data-action="${action}" data-locale="${escapeHtml(row.locale)}"
                ${why ? 'disabled' : ''}${titleAttr}>
            <i class="fas ${icon} me-1"></i>${escapeHtml(label)}
        </button>`;
}

function renderRows(candidates) {
    if (!candidates.length) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-muted text-center py-4">—</td></tr>';
        return;
    }
    tableBody.innerHTML = candidates.map((row) => `
        <tr>
            <td><code>${escapeHtml(row.locale)}</code></td>
            <td>${row.official ? badge('dark', i18n.official) : badge('secondary', i18n.candidate)}</td>
            <td>${row.ready ? badge('success', i18n.ready) : badge('warning text-dark', i18n.notReady)}</td>
            <td class="text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-dark" data-detail="${escapeHtml(row.locale)}">
                    <i class="fas fa-clipboard-check me-1"></i>${escapeHtml(i18n.view)}
                </button>
                ${actionButton(row, 'promote')}${actionButton(row, 'demote')}
            </td>
        </tr>
    `).join('');

    tableBody.querySelectorAll('button[data-detail]').forEach((btn) => {
        btn.addEventListener('click', () => showDetail(btn.dataset.detail));
    });
    tableBody.querySelectorAll('button[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => curate(btn.dataset.locale, btn.dataset.action, btn));
    });
}

/**
 * The API's `curation` block, rendered verbatim so this page never drifts from
 * the server's own account of what a write here means.
 *
 * Three states, not two. `writable` alone is not the question: a writable
 * deployment in `disk` mode applies the change to a file the next deploy
 * overwrites, which the operator needs told just as much as a refusal.
 */
export function curationNoticeVariant(state, strings = i18n) {
    if (!state.writable) {
        return { variant: 'danger', label: strings.readOnly };
    }
    if (state.mode === 'disk') {
        return { variant: 'warning', label: strings.volatile };
    }
    return { variant: 'info', label: strings.reviewed };
}

function renderCurationNotice(state) {
    if (!state) {
        curationNotice.innerHTML = '';
        return;
    }

    const { variant, label } = curationNoticeVariant(state);

    curationNotice.innerHTML = `
        <div class="alert alert-${variant} d-flex align-items-start" role="alert">
            <i class="fas fa-info-circle me-2 mt-1"></i>
            <div><strong>${escapeHtml(label)}</strong> ${escapeHtml(state.reason || '')}</div>
        </div>`;
}

/**
 * Promote or demote one locale.
 *
 * Neither route takes a request body. The response carries a `disposition`, so
 * the outcome is described by the shared helper rather than assuming the write
 * landed — in change-request mode it has only been queued for review.
 */
async function curate(locale, action, button) {
    const original = button.innerHTML;
    button.disabled  = true;
    button.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i>${escapeHtml(i18n.working)}`;

    try {
        const response = await fetch(
            `${apiUrl}/admin/locales/${encodeURIComponent(locale)}/${action}`,
            { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'include' }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            // RFC 9457 problem details: `detail` carries the server's explanation,
            // and for 409/422 it is the specific one (already official, not ready,
            // last official locale) that a generic message would throw away.
            throw new Error(data.detail || data.title || `HTTP ${response.status}`);
        }

        const applied = action === 'promote' ? i18n.promoted : i18n.demoted;
        const outcome = describeWriteOutcome(data, i18n, applied.replace('%s', locale));
        showToast(outcome.message, outcome.severity);
        await load();
    } catch (error) {
        button.disabled  = false;
        button.innerHTML = original;
        showToast(i18n.actionFailed.replace('%s', error.message), 'danger');
    }
}

function showToast(message, type) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

async function showDetail(locale) {
    detailModalTitle.textContent = locale;
    detailModalBody.innerHTML = `<p class="text-muted">${escapeHtml(i18n.loading)}</p>`;
    detailModal.show();

    try {
        const response = await fetch(`${apiUrl}/admin/locales/${encodeURIComponent(locale)}`, {
            headers: { Accept: 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const report = await response.json();
        detailModalBody.innerHTML = (report.checks || []).map((check) => `
            <div class="d-flex align-items-start mb-3">
                <i class="fas ${check.passed
                    ? 'fa-check-circle text-success'
                    : (check.advisory ? 'fa-info-circle text-secondary' : 'fa-times-circle text-warning')} me-2 mt-1"></i>
                <div>
                    <div>
                        <code>${escapeHtml(check.name)}</code>
                        ${check.advisory ? `<span class="badge bg-light text-secondary border ms-1">${escapeHtml(i18n.advisory)}</span>` : ''}
                    </div>
                    <div class="small text-muted">${escapeHtml(check.summary)}</div>
                    ${check.missing && check.missing.length
                        ? `<div class="small mt-1">${escapeHtml(i18n.missing)} <code>${check.missing.map(escapeHtml).join('</code>, <code>')}</code></div>`
                        : ''}
                </div>
            </div>`).join('');
    } catch (error) {
        detailModalBody.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(error.message)}</div>`;
    }
}

async function load() {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-4">${escapeHtml(i18n.loading)}</td></tr>`;
    try {
        const response = await fetch(`${apiUrl}/admin/locales`, {
            headers: { Accept: 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        curation      = payload.curation ?? null;
        officialCount = (payload.official || []).length;
        renderCurationNotice(curation);
        renderRows(payload.candidates || []);
    } catch (error) {
        curation = null;
        tableBody.innerHTML = `<tr><td colspan="4"><div class="alert alert-danger mb-0">${escapeHtml(i18n.loadFailed.replace('%s', error.message))}</div></td></tr>`;
    }
}

// Guarded so this module can be imported by unit tests, and so it is inert if it
// is ever loaded on a page without the table it drives.
if (refreshBtn && tableBody) {
    refreshBtn.addEventListener('click', load);
    load();
}
