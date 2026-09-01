/**
 * Sanctorale viewer.
 *
 * A Roman Missal file is a DELTA, not a sanctorale: `propriumdesanctis_2008` is
 * three rows. So this page composes the missal layers that apply to a chosen
 * rite and calendar, badges each row with the layer that supplied it, and groups
 * the result by month — which is what a reader means by "the sanctorale".
 *
 * See docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md.
 *
 * Read-only. Editing lands separately, against
 * `PUT|PATCH|DELETE /missals/{missal_id}/{event_key}` (API #943).
 *
 * @module sanctorale
 */

import { detectMissalCapabilities } from './capabilities.js';

const config = window.SanctoraleConfig;

if (!config) {
    console.error('SanctoraleConfig not found');
}

const { apiUrl, locale, i18n } = config ?? { apiUrl: '', locale: 'en', i18n: {} };

/**
 * The region carrying a rite's base missals — the editions that apply to every
 * calendar in that rite, as opposed to a national missal that applies to one.
 *
 * Needed because the marker is not uniform: the Roman typical editions carry the
 * Vatican's `VA`, while the Ambrosian edition carries `AMBROSIAN`, which is not a
 * nation code at all. A rite whose catalogue has only one region needs no entry
 * here — see baseRegionFor().
 */
const RITE_BASE_REGION = { roman: 'VA', ambrosian: 'AMBROSIAN' };

const el = (id) => document.getElementById(id);

const dom = {
    rite:        el('riteSelect'),
    calendar:    el('calendarSelect'),
    locale:      el('localeSelect'),
    from:        el('fromSelect'),
    search:      el('sanctoraleSearch'),
    tabs:        el('monthTabs'),
    tableBody:   el('sanctoraleTableBody'),
    notice:      el('sanctoraleNotice'),
    detailModal: el('detailModal'),
    detailTitle: el('detailModalTitle'),
    detailBody:  el('detailModalBody'),
    newEntry:    el('newEntryBtn')
};

const state = {
    rite: 'roman',
    calendar: '',
    missals: [],
    baseRegion: null,
    metadata: null,
    /** The locale the celebration names are requested in, as a BCP-47 tag. */
    nameLocale: '',
    /** Show only celebrations contributed by this missal; '' means all. */
    fromMissal: '',
    composed: [],
    month: new Date().getUTCMonth() + 1,
    search: '',
    capabilities: new Map()
};

/** i18n payloads are per missal and never change within a session. */
const i18nCache = new Map();

/**
 * Bumped whenever the selection changes. Loading a catalogue and composing a
 * sanctorale are several awaits apart, so without this a slow request for an
 * abandoned selection can still commit its results over the current one.
 */
let selectionSeq = 0;

/** The same guard for the detail modal, which is opened per celebration. */
let detailSeq = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

/**
 * Month names in the page's own locale.
 *
 * `timeZone: 'UTC'` per the project-wide rule: without it a date constructed at
 * midnight UTC can format as the previous month west of Greenwich.
 */
const monthName = (m) => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2001, m - 1, 1)));

class HttpError extends Error {
    constructor(status, path) {
        super(`HTTP ${status} for ${path}`);
        this.status = status;
    }
}

/**
 * Fetch JSON from the API.
 *
 * `credentials` defaults to `'omit'`: the `/missals`, `/lectionary` and
 * `/calendars` reads this drives are public and answer `Access-Control-Allow-Origin: *`,
 * which a browser refuses to pair with credentials. `checkAllowed()` below is the
 * one caller that passes `'include'` explicitly — `/admin/permissions/check` is an
 * authenticated endpoint and answers 401 without a cookie.
 *
 * @param {string} path
 * @param {Record<string,string>} [headers]
 * @param {'omit'|'include'} [credentials]
 * @returns {Promise<object>}
 */
async function getJson(path, headers = {}, credentials = 'omit') {
    const response = await fetch(`${apiUrl}${path}`, {
        headers: { Accept: 'application/json', ...headers },
        credentials
    });
    if (!response.ok) {
        throw new HttpError(response.status, path);
    }
    return response.json();
}

/** What the user may do to a Missal; unknown Missals are read-only. */
function capabilityFor(missalId) {
    return state.capabilities.get(missalId) ?? { canEdit: false, canDelete: false };
}

/**
 * A failed write, carrying the API's own parsed body.
 *
 * The body matters: `assertKeyIdentity()` composes a 409 naming the editions and
 * dates that disagree, and that message is more useful beside the inputs that
 * caused it than a status code ever is.
 */
export class ApiWriteError extends Error {
    constructor(status, body) {
        super(`HTTP ${status}`);
        this.status = status;
        this.body = body;
    }
}

/** The address of one sanctorale entry. Every segment is encoded on its own. */
export function entryPath(rite, missalId, eventKey) {
    return `/missals/${encodeURIComponent(rite)}/${encodeURIComponent(missalId)}/${encodeURIComponent(eventKey)}`;
}

/**
 * Issue a write.
 *
 * Separate from getJson() and not a wrapper over it, because the two disagree on
 * the one setting that matters: the `/missals` and `/lectionary` reads are public
 * and answer `Access-Control-Allow-Origin: *`, which a browser refuses to pair
 * with credentials, while the write routes echo the validated origin and set
 * `allowCredentials`. A shared helper would have to be right about both.
 *
 * An unparseable body is `null`, never a throw: reading an empty 204 as a failure
 * is the bug issue #503 filed against the old editor.
 *
 * @param {'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path from entryPath()
 * @param {object} [body]
 * @returns {Promise<object|null>}
 * @throws {ApiWriteError}
 */
export async function writeJson(method, path, body) {
    const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new ApiWriteError(response.status, data);
    }
    return data;
}

/**
 * The missals that apply to a calendar, oldest first.
 *
 * Data-driven rather than hardcoded: the typical editions carry region `VA` and
 * apply everywhere, and a national missal applies only to its own region. Sorting
 * by year is what makes "later wins" meaningful in compose().
 *
 * @param {Array<object>} missals
 * @param {string} calendar Region code, or '' for the General Roman calendar.
 */
/**
 * BCP-47 form. The metadata spells locales with underscores (`en_US`), which is
 * the gettext/ICU convention; `Accept-Language` and `Intl` both want hyphens.
 */
export const toBcp47 = (tag) => String(tag ?? '').replace(/_/g, '-');

/**
 * The locales a calendar is actually published in, from `/calendars` metadata.
 *
 * Three sources, because the metadata keeps three: the General Roman calendar's
 * own `locales`, an Ambrosian entry under `ambrosian_calendars`, and one entry
 * per nation under `national_calendars`. A national calendar publishes only its
 * own locales — US_2011 exists in `en_US` alone — so offering the General Roman
 * list there would advertise translations that do not exist.
 *
 * @param {object} metadata `litcal_metadata`
 * @param {string} rite
 * @param {string} calendar Region code, or '' for the rite's base calendar.
 * @returns {string[]} BCP-47 tags
 */
export function localesFor(metadata, rite, calendar) {
    if (!metadata) return [];

    if (rite === 'ambrosian') {
        const entry = (metadata.ambrosian_calendars ?? [])
            .find((c) => c.rite === 'ambrosian') ?? (metadata.ambrosian_calendars ?? [])[0];
        return (entry?.locales ?? []).map(toBcp47);
    }

    if (calendar) {
        const nation = (metadata.national_calendars ?? [])
            .find((c) => c.calendar_id === calendar);
        // A region with no national calendar entry still composes from the typical
        // editions, so fall back to the General Roman list rather than to nothing.
        if (nation) return (nation.locales ?? []).map(toBcp47);
    }

    return (metadata.locales ?? []).map(toBcp47);
}

/** The locale to preselect: the page's own if published, else the first offered. */
export function preferredLocale(available, pageLocale) {
    if (!available.length) return '';
    const page = toBcp47(pageLocale).toLowerCase();
    const exact = available.find((l) => l.toLowerCase() === page);
    if (exact) return exact;
    // en-US should settle for en when en-US is not published, and vice versa.
    const base = page.split('-')[0];
    const related = available.find((l) => l.toLowerCase().split('-')[0] === base);
    return related ?? available[0];
}

/**
 * The liturgical rank, as "number - name".
 *
 * The rows carry `grade` as a bare integer and no `grade_lcl`, so the name comes
 * from the page's own translated list rather than from the API. The number is
 * kept alongside it because it is what the data actually holds, what the schema
 * validates, and what a curator comparing two editions is looking at.
 *
 * `grade_display` is deliberately NOT folded in here — it is a display override,
 * a different fact, and it gets its own field. See gradeDisplayOf().
 *
 * @param {{grade?: number}} row
 * @param {Record<string,string>} strings
 */
export function formatGrade(row, strings) {
    const grade = row?.grade;
    const name  = strings?.grades?.[String(grade)];
    return name ? `${grade} - ${name}` : String(grade ?? '');
}

/**
 * The display override, or `null` when the celebration has none.
 *
 * THREE states, not two, and the difference is load-bearing:
 *
 * - **absent / null** — no override; show the rank.
 * - **`''`** — an authored override meaning "show no rank at all". `AllSouls` is
 *   the example: a Solemnity that is conventionally displayed without a rank, and
 *   `CalendarHandler` writes `''` for it explicitly. A HIGHER_SOLEMNITY is cleared
 *   to `''` the same way, since it carries no displayable grade of its own.
 * - **a non-empty string** — show that instead, e.g. US_2011's "National Holiday".
 *
 * Collapsing the empty string into "no override" would silently discard an
 * authored decision, and — once editing lands — write `null` back over a `''` the
 * curator meant. The write payload types the field as `string | null` for exactly
 * this reason.
 *
 * @param {{grade_display?: ?string}} row
 * @returns {?string} `null` for no override, otherwise the override (possibly '')
 */
export function gradeDisplayOf(row) {
    const override = row?.grade_display;
    return typeof override === 'string' ? override.trim() : null;
}

/**
 * Whether a locale's readings are nested one level into schemas.
 *
 * Some celebrations offer alternative sets rather than one: AllSouls carries
 * `schema_one`, `schema_two` and `schema_three`, each a complete set. The flat
 * shape maps reading names to citations; the nested shape maps schema names to
 * those maps. Same predicate, and same name, as ReadingsRenderer's in
 * liturgy-components-js — see the note on renderReadings().
 *
 * @param {Record<string, unknown>} entry
 */
export function hasNestedSchemas(entry) {
    const values = Object.values(entry ?? {});
    return values.length > 0 && values.every((v) => v !== null && typeof v === 'object');
}

/**
 * Canonical order first, then anything unexpected, so a new key still shows.
 *
 * Copied from ReadingsRenderer.readingOrder in liturgy-components-js so the two
 * agree on both order and vocabulary. Nesting is not only the schema_* triple:
 * Assumption, StsPeterPaulAp and NativityJohnBaptist nest as vigil/day, which is
 * the shape that actually carries content today.
 */
const SCHEMA_ORDER = [
    'vigil', 'night', 'dawn', 'day', 'evening',
    'schema_one', 'schema_two', 'schema_three',
    'easter_season', 'outside_easter_season'
];

/**
 * The schemas present across a tier's locales, in a stable order.
 *
 * A union rather than the first locale's keys: a locale missing one schema must
 * not remove that schema's tab for every other locale.
 */
export function schemaKeysOf(entries) {
    const seen = new Set();
    for (const entry of Object.values(entries ?? {})) {
        if (hasNestedSchemas(entry)) {
            Object.keys(entry).forEach((k) => seen.add(k));
        }
    }
    const known = SCHEMA_ORDER.filter((k) => seen.has(k));
    const extra = [...seen].filter((k) => !SCHEMA_ORDER.includes(k)).sort();
    return [...known, ...extra];
}

export function baseRegionFor(missals, rite) {
    const regions = [...new Set(missals.map((m) => m.region))];
    // A rite with a single region has no national missals to distinguish, so every
    // one of its missals is a base missal. This is what makes the Ambrosian rite
    // work without special-casing it at the call site.
    if (regions.length <= 1) {
        return regions[0] ?? null;
    }
    return RITE_BASE_REGION[rite] ?? regions[0];
}

export function applicableMissals(missals, calendar, baseRegion) {
    return missals
        .filter((m) => m.region === baseRegion || (calendar !== '' && m.region === calendar))
        .sort((a, b) => (a.year_published ?? 0) - (b.year_published ?? 0));
}

/**
 * Flatten the missal layers into one sanctorale.
 *
 * Keyed by `event_key`, later missal wins, and every row remembers which layer
 * supplied it. Overrides are rare but real — US_2011 redefines StIsidore — and a
 * reader cannot make sense of the result without being told where a row came from.
 *
 * @param {Array<{missal: object, rows: Array<object>}>} layers oldest first
 */
export function compose(layers) {
    const byKey = new Map();
    for (const { missal, rows } of layers) {
        for (const row of rows) {
            byKey.set(row.event_key, {
                ...row,
                _missalId: missal.missal_id,
                _missalYear: missal.year_published,
                _overrides: byKey.has(row.event_key) ? byKey.get(row.event_key)._missalId : null
            });
        }
    }
    return [...byKey.values()].sort((a, b) => (a.month - b.month) || (a.day - b.day));
}

/**
 * Narrow to the celebrations a single missal contributes, or all of them.
 *
 * The count this yields for a missal is what it contributes to the COMPOSED
 * sanctorale, which is not always its own row count: where a later edition
 * overrides an earlier one, the row belongs to the later. That is the honest
 * number for "what comes from this edition", and it is the point of the filter.
 */
export function filterByMissal(composed, missalId) {
    return missalId ? composed.filter((r) => r._missalId === missalId) : composed;
}

/** Rows for one month, day-ordered, narrowed by the search term. */
export function rowsFor(composed, month, search) {
    const needle = search.trim().toLowerCase();
    return composed.filter((r) => r.month === month && matches(r, needle));
}

function matches(row, needle) {
    if (!needle) return true;
    return String(row.name ?? '').toLowerCase().includes(needle)
        || String(row.event_key ?? '').toLowerCase().includes(needle);
}

/**
 * Which months contain a search hit, so a search can move the reader to a month
 * that actually has one. Tabs hide eleven twelfths of the data from the browser's
 * own find; without this the search would silently miss most of it.
 */
export function monthsWithHits(composed, search) {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return [...new Set(composed.filter((r) => matches(r, needle)).map((r) => r.month))].sort((a, b) => a - b);
}

function renderTabs(visible) {
    const counts = new Map();
    for (const row of visible) {
        counts.set(row.month, (counts.get(row.month) ?? 0) + 1);
    }
    const hits = new Set(monthsWithHits(visible, state.search));

    dom.tabs.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const count  = counts.get(m) ?? 0;
        const active = m === state.month;
        // A sparse month reads as "3", not as a broken page.
        const badgeClass = hits.has(m) ? 'bg-primary' : 'bg-secondary';
        return `
            <li class="nav-item">
                <button class="nav-link ${active ? 'active' : ''}" data-month="${m}" type="button">
                    ${escapeHtml(monthName(m))}
                    <span class="badge ${badgeClass} ms-1">${count}</span>
                </button>
            </li>`;
    }).join('');

    dom.tabs.querySelectorAll('button[data-month]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.month = Number(btn.dataset.month);
            syncHash();
            render();
        });
    });
}

function renderTable(visible) {
    const rows = rowsFor(visible, state.month, state.search);
    if (!rows.length) {
        const empty = state.search ? i18n.noSearchHits : i18n.noEntries;
        dom.tableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">${escapeHtml(empty)}</td></tr>`;
        return;
    }
    dom.tableBody.innerHTML = rows.map((row) => `
        <tr>
            <td class="text-nowrap">${row.day}</td>
            <td>${escapeHtml(row.name ?? row.event_key)}</td>
            <td><code class="small">${escapeHtml(row.event_key)}</code></td>
            <td>
                <span class="badge bg-light text-dark border" title="${escapeHtml(i18n.fromMissal)}">${escapeHtml(row._missalId)}</span>
                ${row._overrides ? `<span class="badge bg-warning text-dark ms-1" title="${escapeHtml(i18n.overridesTitle)}">${escapeHtml(i18n.overrides)}</span>` : ''}
            </td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-dark"
                        data-event-key="${escapeHtml(row.event_key)}" data-missal="${escapeHtml(row._missalId)}">
                    <i class="fas fa-magnifying-glass me-1"></i>${escapeHtml(i18n.view)}
                </button>
                ${capabilityFor(row._missalId).canEdit ? `
                <button type="button" class="btn btn-sm btn-outline-primary ms-1"
                        data-edit-key="${escapeHtml(row.event_key)}" data-missal="${escapeHtml(row._missalId)}">
                    <i class="fas fa-pen me-1"></i>${escapeHtml(i18n.edit)}
                </button>` : ''}
            </td>
        </tr>`).join('');

    dom.tableBody.querySelectorAll('button[data-event-key]').forEach((btn) => {
        btn.addEventListener('click', () => showDetail(btn.dataset.eventKey, btn.dataset.missal));
    });
    dom.tableBody.querySelectorAll('button[data-edit-key]').forEach((btn) => {
        btn.addEventListener('click', () => showDetail(btn.dataset.editKey, btn.dataset.missal, true));
    });
}

function notice(variant, html) {
    dom.notice.innerHTML = html
        ? `<div class="alert alert-${variant}" role="alert">${html}</div>`
        : '';
}

function render() {
    const visible = filterByMissal(state.composed, state.fromMissal);
    renderTabs(visible);
    renderTable(visible);
}

/**
 * Offer each contributing missal, oldest first, with how many celebrations it
 * contributes. Selecting one is how a reader sees an edition's delta at a glance.
 */
function renderFromOptions() {
    const counts = new Map();
    for (const row of state.composed) {
        counts.set(row._missalId, (counts.get(row._missalId) ?? 0) + 1);
    }
    const ordered = applicableMissals(state.missals, state.calendar, state.baseRegion)
        .filter((m) => counts.has(m.missal_id));

    dom.from.innerHTML = [
        `<option value="">${escapeHtml(i18n.allMissals)} (${state.composed.length})</option>`
    ].concat(ordered.map((m) =>
        `<option value="${escapeHtml(m.missal_id)}">${escapeHtml(m.missal_id)} (${counts.get(m.missal_id)})</option>`
    )).join('');

    // A rite or calendar change can retire the selected missal entirely.
    if (state.fromMissal && !counts.has(state.fromMissal)) {
        state.fromMissal = '';
    }
    dom.from.value = state.fromMissal;
}

// ---------------------------------------------------------------- detail view

/**
 * One event across every layer that defines it: structure, all its names, and
 * its readings from whichever lectionary tiers carry them.
 */
async function showDetail(eventKey, missalId) {
    // Opening B while A is still loading must not let A render into B's modal.
    const seq = ++detailSeq;
    dom.detailTitle.textContent = eventKey;
    dom.detailBody.innerHTML = `<p class="text-muted">${escapeHtml(i18n.loading)}</p>`;
    bootstrap.Modal.getOrCreateInstance(dom.detailModal).show();

    const row = state.composed.find((r) => r.event_key === eventKey);

    // Names and readings are independent: a rite with no lectionary still has
    // names, so one failing must not blank the other.
    const [names, readings] = await Promise.allSettled([
        loadI18n(missalId),
        getJson(`/lectionary/${encodeURIComponent(state.rite)}/sanctorale/${encodeURIComponent(eventKey)}`)
    ]);

    if (seq !== detailSeq) return;

    dom.detailBody.innerHTML = [
        renderStructure(row),
        names.status === 'fulfilled'
            ? renderNames(names.value, eventKey)
            : `<div class="alert alert-warning">${escapeHtml(i18n.namesUnavailable)}</div>`,
        renderReadingsOutcome(readings)
    ].join('');
}

/**
 * A celebration with no curated readings answers 404, which is the SAME status a
 * bad event key gets. Reporting that as "could not load" would tell a reader the
 * request failed when in truth there is simply nothing there yet — so the two are
 * separated here, and only a non-404 is treated as a failure.
 *
 * @param {PromiseSettledResult<object>} settled
 */
export function renderReadingsOutcome(settled, strings = i18n) {
    if (settled.status === 'fulfilled') {
        return renderReadings(settled.value, strings);
    }
    if (settled.reason instanceof HttpError && settled.reason.status === 404) {
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(strings.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(strings.noReadingsForEvent)}</div>`;
    }
    return `<div class="alert alert-warning">${escapeHtml(strings.readingsUnavailable)}</div>`;
}

export { HttpError };

async function loadI18n(missalId) {
    const cacheKey = `${state.rite}/${missalId}`;
    if (!i18nCache.has(cacheKey)) {
        i18nCache.set(cacheKey, await getJson(
            `/missals/${encodeURIComponent(state.rite)}/${encodeURIComponent(missalId)}/i18n`
        ));
    }
    return i18nCache.get(cacheKey);
}

function renderStructure(row) {
    if (!row) return '';
    const field = (label, value) => `
        <div class="col-6 col-md-4 mb-2">
            <div class="small text-muted">${escapeHtml(label)}</div>
            <div>${escapeHtml(value)}</div>
        </div>`;
    // Rendered only when the data actually carries an override — on almost every
    // celebration there is none, and an empty field would be noise. An override of
    // '' is still an override: it says the rank is deliberately not displayed.
    const override = gradeDisplayOf(row);
    const overrideLabel = override === '' ? i18n.displaysAsNothing : override;

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.structure)}</h6>
        <div class="row mb-3">
            ${field(i18n.date, `${monthName(row.month)} ${row.day}`)}
            ${field(i18n.grade, formatGrade(row, i18n))}
            ${override !== null ? field(i18n.displaysAs, overrideLabel) : ''}
            ${field(i18n.calendarField, row.calendar)}
            ${field(i18n.color, (row.color ?? []).join(', '))}
            ${field(i18n.common, (row.common ?? []).join(', '))}
            ${field(i18n.fromMissal, row._missalId)}
        </div>`;
}

/**
 * Names per locale, using the coverage map the API precomputes.
 *
 * Three states, not two: `translated`, `empty` (curated as blank on purpose) and
 * `missing` (no entry at all). Collapsing empty into missing would misreport
 * deliberate blanks as gaps.
 */
function renderNames(payload, eventKey) {
    const coverage = payload.coverage?.[eventKey] ?? { translated: [], empty: [], missing: [] };
    const rows = (payload.locales ?? []).map((loc) => {
        const value = payload.i18n?.[loc]?.[eventKey];
        let stateBadge;
        if (coverage.missing?.includes(loc)) {
            stateBadge = `<span class="badge bg-danger">${escapeHtml(i18n.missingLabel)}</span>`;
        } else if (coverage.empty?.includes(loc)) {
            stateBadge = `<span class="badge bg-warning text-dark">${escapeHtml(i18n.emptyLabel)}</span>`;
        } else {
            stateBadge = `<span class="badge bg-success">${escapeHtml(i18n.translatedLabel)}</span>`;
        }
        return `
            <tr>
                <td class="text-nowrap"><code>${escapeHtml(loc)}</code></td>
                <td>${escapeHtml(value ?? '')}</td>
                <td class="text-end">${stateBadge}</td>
            </tr>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.names)}
            <span class="badge bg-light text-dark border ms-1">${(payload.locales ?? []).length}</span>
        </h6>
        <table class="table table-sm mb-3"><tbody>${rows}</tbody></table>`;
}

/**
 * Readings, tier by tier.
 *
 * `lectionary_available: false` is a first-class answer, not an error — the
 * Ambrosian rite has no sanctorale lectionary at all — so it renders the API's
 * own message rather than an empty table that reads as a bug.
 */
/** One locale's readings as table rows: reading name on the left, citation right. */
function readingRows(entries, schema, strings) {
    return Object.entries(entries ?? {}).map(([loc, entry]) => {
        const readings = schema ? entry?.[schema] : entry;
        if (!readings || typeof readings !== 'object') return '';
        return `
            <tr>
                <td class="text-nowrap align-top"><code>${escapeHtml(loc)}</code></td>
                <td>${Object.entries(readings).map(([k, v]) => `
                    <div class="small"><span class="text-muted">${escapeHtml(k)}:</span> ${escapeHtml(v)}</div>`).join('')}</td>
            </tr>`;
    }).join('') || `<tr><td class="text-muted small">${escapeHtml(strings.noEntries)}</td></tr>`;
}

/**
 * Readings, tier by tier.
 *
 * `lectionary_available: false` is a first-class answer, not an error — the
 * Ambrosian rite has no sanctorale lectionary at all — so it renders the API's
 * own message rather than an empty table that reads as a bug.
 *
 * Where a celebration offers alternative schemas, they become TABS rather than
 * more nesting. The table already varies by locale; stacking three schemas inside
 * that turns six rows into eighteen and makes comparing one language against
 * another impossible, which is the thing the locale table exists to do. Tabs keep
 * locale as the axis you read down and schema as the one you switch between.
 *
 * The schema labels match ReadingsRenderer in liturgy-components-js ("Schema I",
 * "Schema II", "Schema III") so the two agree. That renderer solves this problem
 * already but is not exported from the package entry point, so it cannot be
 * imported here — raised upstream; consolidate if it is exported.
 */
function renderReadings(payload, strings = i18n) {
    if (payload.lectionary_available === false) {
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(strings.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(payload.message || strings.noLectionary)}</div>`;
    }

    const tiers = (payload.readings ?? []).map((tier, i) => {
        const entries = tier.entries ?? {};
        const schemas = schemaKeysOf(entries);
        const without = tier.locales_without_entry ?? [];
        const blank   = tier.locales_with_empty_entry ?? [];

        const badge = `
            <span class="badge bg-dark">${escapeHtml(tier.tier)}</span>
            <code class="small ms-1">${escapeHtml(tier.source_id)}</code>`;

        const table = (schema) => `
            <table class="table table-sm mb-1"><tbody>${readingRows(entries, schema, strings)}</tbody></table>`;

        let body;
        if (schemas.length) {
            const tabId = (k) => `readings-t${i}-${k.replace(/[^a-z0-9]/gi, '')}`;
            body = `
                <ul class="nav nav-pills nav-sm mb-2" role="tablist">
                    ${schemas.map((k, n) => `
                        <li class="nav-item" role="presentation">
                            <button class="nav-link btn-sm py-1 px-2 ${n === 0 ? 'active' : ''}" type="button"
                                    data-bs-toggle="tab" data-bs-target="#${tabId(k)}" role="tab">
                                ${escapeHtml(strings.schemas?.[k] ?? k)}
                            </button>
                        </li>`).join('')}
                </ul>
                <div class="tab-content">
                    ${schemas.map((k, n) => `
                        <div class="tab-pane fade ${n === 0 ? 'show active' : ''}" id="${tabId(k)}" role="tabpanel">
                            ${table(k)}
                        </div>`).join('')}
                </div>`;
        } else {
            body = table(null);
        }

        return `
            <div class="mb-3">
                <div class="mb-1 d-flex align-items-center gap-2 flex-wrap">${badge}</div>
                ${body}
                ${blank.length ? `<div class="small text-muted">${escapeHtml(strings.emptyLabel)}: <code>${blank.map(escapeHtml).join('</code>, <code>')}</code></div>` : ''}
                ${without.length ? `<div class="small text-muted">${escapeHtml(strings.missingLabel)}: <code>${without.map(escapeHtml).join('</code>, <code>')}</code></div>` : ''}
            </div>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(strings.readings)}</h6>
        ${tiers || `<div class="text-muted small">${escapeHtml(strings.noEntries)}</div>`}`;
}

// -------------------------------------------------------------------- loading

async function loadMetadata() {
    if (state.metadata) return;
    const payload = await getJson('/calendars');
    state.metadata = payload.litcal_metadata ?? payload ?? null;
}

async function loadCatalogue(seq = selectionSeq) {
    // Rite-scoped since API #953. The unprefixed `/missals` still answers, but it
    // means `roman`, so asking for it explicitly is what makes the rite selector real.
    const payload = await getJson(`/missals/${encodeURIComponent(state.rite)}`);
    if (seq !== selectionSeq) return;
    state.missals = payload.litcal_missals ?? payload ?? [];
    state.baseRegion = baseRegionFor(state.missals, state.rite);

    const regions = [...new Set(state.missals.map((m) => m.region))]
        .filter((r) => r !== state.baseRegion)
        .sort();

    const baseLabel = state.rite === 'ambrosian' ? i18n.ambrosianCalendar : i18n.generalRoman;
    dom.calendar.innerHTML = [`<option value="">${escapeHtml(baseLabel)}</option>`]
        .concat(regions.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`))
        .join('');
    // A rite change can invalidate the selected nation, so fall back to the base.
    if (state.calendar && !regions.includes(state.calendar)) {
        state.calendar = '';
    }
    dom.calendar.value = state.calendar;
    renderLocaleOptions();

    // Capabilities are per Missal, so they are refreshed whenever the applicable
    // set changes — which is on every rite or calendar change, not once per page.
    state.capabilities = await detectMissalCapabilities({
        missals: applicableMissals(state.missals, state.calendar, state.baseRegion),
        rite: state.rite,
        baseRegion: state.baseRegion,
        userSub: config?.userSub ?? '',
        isGlobalAdmin: config?.isGlobalAdmin === true,
        checkAllowed: async (path) => {
            const result = await getJson(path, {}, 'include');
            return result !== null && typeof result === 'object' && result.allowed === true;
        }
    });
    dom.newEntry?.classList.toggle(
        'd-none',
        ![...state.capabilities.values()].some((c) => c.canEdit)
    );
}

/**
 * Offer the locales this calendar publishes, and keep the current choice only if
 * it survives the change — switching to a national calendar that publishes one
 * locale must not leave a stale, unpublished one selected.
 */
function renderLocaleOptions() {
    const available = localesFor(state.metadata, state.rite, state.calendar);
    const display = (tag) => {
        try {
            return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag;
        } catch {
            return tag;
        }
    };

    if (!available.includes(state.nameLocale)) {
        state.nameLocale = preferredLocale(available, locale);
    }
    dom.locale.innerHTML = available
        .map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(display(l))} (${escapeHtml(l)})</option>`)
        .join('');
    dom.locale.value = state.nameLocale;
    dom.locale.disabled = available.length <= 1;
}

async function loadSanctorale(seq = selectionSeq) {
    notice('', '');

    const applicable = applicableMissals(state.missals, state.calendar, state.baseRegion);
    if (!applicable.length) {
        state.composed = [];
        renderFromOptions();
        notice('info', escapeHtml(i18n.noMissals));
        render();
        return;
    }
    dom.tableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">${escapeHtml(i18n.loading)}</td></tr>`;

    try {
        const layers = await Promise.all(applicable.map(async (missal) => ({
            missal,
            rows: await getJson(
                `/missals/${encodeURIComponent(state.rite)}/${encodeURIComponent(missal.missal_id)}`,
                // The API merges the celebration name for the negotiated locale, so
                // this header is what makes the picker do anything at all.
                state.nameLocale ? { 'Accept-Language': state.nameLocale } : {}
            )
        })));
        if (seq !== selectionSeq) return;
        state.composed = compose(layers);
        renderFromOptions();
        render();
    } catch (error) {
        if (seq !== selectionSeq) return;
        state.composed = [];
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
        render();
    }
}

function syncHash() {
    // Addressable so a link can name a month, and so a reload keeps the reader
    // where they were rather than snapping back to the current month.
    const params = new URLSearchParams();
    params.set('rite', state.rite);
    if (state.calendar) params.set('calendar', state.calendar);
    if (state.nameLocale) params.set('locale', state.nameLocale);
    if (state.fromMissal) params.set('from', state.fromMissal);
    params.set('month', String(state.month));
    history.replaceState(null, '', `#${params.toString()}`);
}

function readHash() {
    const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const month  = Number(params.get('month'));
    if (params.get('rite')) state.rite = params.get('rite');
    // Assigned unconditionally, defaulting to empty. syncHash omits these when they
    // are unset, so testing for presence would let an in-page link to the base
    // calendar silently keep whichever nation happened to be selected before.
    state.calendar   = params.get('calendar') ?? '';
    state.fromMissal = params.get('from') ?? '';
    state.nameLocale = params.get('locale') ?? '';
    if (month >= 1 && month <= 12) state.month = month;
}

/**
 * Reload catalogue and sanctorale for the current selection.
 *
 * The token is taken once, here, so every await below belongs to THIS selection:
 * a slower request for a selection the reader has already moved on from returns
 * to a bumped token and commits nothing.
 */
async function reload() {
    const seq = ++selectionSeq;
    try {
        await loadMetadata();
        await loadCatalogue(seq);
        if (seq !== selectionSeq) return;
        renderLocaleOptions();
        await loadSanctorale(seq);
        if (seq !== selectionSeq) return;
        // The URL last, once loadCatalogue and renderLocaleOptions have had their
        // say: a nation that does not exist in the new rite is dropped, and the
        // locale may have been re-derived. Writing the hash before that leaves it
        // describing a selection the page is not showing.
        syncHash();
    } catch (error) {
        if (seq !== selectionSeq) return;
        // Clear before reporting. Otherwise a failed Ambrosian load leaves the
        // previous rite's celebrations on screen underneath an error saying the
        // load failed, which is a worse lie than showing nothing.
        state.missals    = [];
        state.baseRegion = null;
        state.composed   = [];
        renderFromOptions();
        render();
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
    }
}

/** Recompose without refetching the catalogue: the rite has not changed. */
async function recompose() {
    const seq = ++selectionSeq;
    try {
        await loadSanctorale(seq);
        if (seq !== selectionSeq) return;
        // renderFromOptions may have retired the selected edition; drop it from
        // the URL rather than leaving a filter there that no longer applies.
        syncHash();
    } catch (error) {
        if (seq !== selectionSeq) return;
        state.composed = [];
        renderFromOptions();
        render();
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
    }
}

async function init() {
    readHash();
    // A failed catalogue must not abort init: the listeners below are what let the
    // reader pick another rite or retry, and skipping them strands the page dead.
    let catalogueFailed = false;
    try {
        await loadMetadata();
        await loadCatalogue();
    } catch (error) {
        catalogueFailed = true;
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
    }
    dom.rite.value = state.rite;

    dom.rite.addEventListener('change', () => {
        state.rite = dom.rite.value;
        syncHash();
        // Each rite has its own catalogue, so this is a reload, not a recompose.
        reload();
    });
    dom.calendar.addEventListener('change', () => {
        state.calendar = dom.calendar.value;
        renderLocaleOptions();
        syncHash();
        recompose();
    });
    dom.locale.addEventListener('change', () => {
        state.nameLocale = dom.locale.value;
        syncHash();
        // Names are merged server-side, so a locale change is a refetch.
        recompose();
    });
    dom.from.addEventListener('change', () => {
        state.fromMissal = dom.from.value;
        syncHash();
        // Purely a view filter over data already composed — no request needed.
        render();
    });
    dom.search.addEventListener('input', () => {
        state.search = dom.search.value;
        // Move to a month that actually contains a hit, otherwise the reader
        // searches and is shown an empty month they happened to be standing on.
        // Honours the From filter, so a search inside a filtered view cannot jump
        // to a month the filter has emptied.
        const hits = monthsWithHits(filterByMissal(state.composed, state.fromMissal), state.search);
        if (hits.length && !hits.includes(state.month)) {
            state.month = hits[0];
            syncHash();
        }
        render();
    });

    // A hash change is a SAME-DOCUMENT navigation: the module does not re-run, so
    // without this a deep link followed from this very page silently does nothing
    // — the reader clicks a link naming another rite or month and sees no change.
    window.addEventListener('hashchange', () => {
        const before = `${state.rite}|${state.calendar}|${state.nameLocale}`;
        readHash();
        dom.rite.value     = state.rite;
        dom.calendar.value = state.calendar;
        if (`${state.rite}|${state.calendar}|${state.nameLocale}` !== before) {
            reload();
        } else {
            dom.from.value = state.fromMissal;
            render();
        }
    });

    if (!catalogueFailed) {
        await loadSanctorale();
        // A deep link can name a calendar, locale or edition that this rite does
        // not have. Rewrite it once, so the URL matches what is actually shown and
        // copying it out of the address bar reproduces this page.
        syncHash();
    }
}

// Guarded so the module can be imported by unit tests, and so it is inert if
// ever loaded on a page without the table it drives.
if (dom.tableBody && dom.tabs) {
    init();
}
