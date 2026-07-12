/**
 * Admin Decrees Management Module
 *
 * Handles capability detection via /admin/permissions/check and renders
 * the enriched read-only list of Dicastery for Divine Worship decree definitions.
 * Edit/delete/create buttons are gated on canEdit/canAdmin capabilities.
 *
 * Task 4 wires the editor modal; Task 5 wires CRUD operations. This
 * module exports `capabilities` and rendering helpers so later tasks
 * can import them without re-implementing.
 *
 * All user-visible strings coming from the API are set via .textContent
 * (never via innerHTML) to prevent XSS from unexpected API data.
 *
 * @module admin-decrees
 */

import { DecreeAction, buildDecreePayload, validateDecreePayload } from './DecreePayload.js';

const config = window.AdminDecreesConfig;

// ---- generic fetch seam ---------------------------------------------------
// Copied verbatim from assets/js/admin-tests.js (adapted: uses config.apiUrl).

/**
 * Fetch JSON from the API with a 15 s timeout.
 *
 * @param {string} method  HTTP method
 * @param {string} path    Path (appended to config.apiUrl)
 * @param {unknown} [body] Optional JSON body
 * @param {Record<string,string>} [extraHeaders] Additional request headers
 * @param {'include'|'omit'} [credentials] Credentials mode (default: 'include')
 * @returns {Promise<unknown>} Parsed JSON body
 */
async function fetchJson(method, path, body, extraHeaders, credentials = 'include') {
    const opts = {
        method,
        headers: { Accept: 'application/json', ...extraHeaders },
        credentials,
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
        res = await fetch(config.apiUrl + path, { ...opts, signal: controller.signal });
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

// ---- capability detection -------------------------------------------------

/**
 * Detect the current user's capabilities for decree management.
 *
 * Global admins short-circuit to full access. Otherwise three parallel
 * FGA self-checks determine viewer / editor / admin relations.
 *
 * @returns {Promise<{canView: boolean, canEdit: boolean, canAdmin: boolean}>}
 */
export async function detectCapabilities() {
    if (config.isGlobalAdmin) {
        return { canView: true, canEdit: true, canAdmin: true };
    }
    const userSub = config.userSub || '';
    if (!userSub) {
        // No sub available — cannot call self-check; deny all.
        return { canView: false, canEdit: false, canAdmin: false };
    }
    const check = (relation) => fetchJson(
        'GET',
        `/admin/permissions/check?user=${encodeURIComponent(userSub)}&object_type=general_roman_calendar&object_id=decrees&relation=${relation}`
    ).then((r) => r !== null && typeof r === 'object' && r.allowed === true).catch(() => false);
    const [viewer, editor, admin] = await Promise.all([
        check('viewer'),
        check('editor'),
        check('admin'),
    ]);
    return { canView: viewer || editor || admin, canEdit: editor || admin, canAdmin: admin };
}

// ---- grade / color label helpers ------------------------------------------

/**
 * Return grade labels from config.i18n.gradeLabels (server-localized), falling back
 * to a built-in map if gradeLabels is not available (e.g. in tests).
 *
 * @param {number} grade
 * @returns {string}
 */
const _FALLBACK_GRADE_LABELS = {
    7: 'Higher Solemnity',
    6: 'Solemnity',
    5: 'Feast of the Lord',
    4: 'Feast',
    3: 'Memorial',
    2: 'Optional Memorial',
    1: 'Commemoration',
    0: 'Weekday',
};

/**
 * Get the grade label for a numeric grade value.
 * Prefers config.i18n.gradeLabels (PHP-localized), falls back to built-in map.
 *
 * @param {number} grade
 * @returns {string}
 */
function getGradeLabel(grade) {
    const labels = (config && config.i18n && config.i18n.gradeLabels) ? config.i18n.gradeLabels : _FALLBACK_GRADE_LABELS;
    return labels[grade] ?? `Grade ${grade}`;
}

/** Bootstrap bg- colour for each liturgical colour value. */
const COLOR_BG = {
    white:  'light',
    red:    'danger',
    green:  'success',
    purple: 'secondary',
    rose:   'warning',
    gold:   'warning',
};

/**
 * Return a human-readable grade label for a numeric grade.
 *
 * Exported so it can be unit-tested independently.
 *
 * @param {number|undefined} grade
 * @returns {string}
 */
export function gradeLabel(grade) {
    if (grade === undefined || grade === null) return '';
    return getGradeLabel(grade);
}

/**
 * Return the Bootstrap bg- suffix for a liturgical colour string.
 *
 * Exported so it can be unit-tested independently.
 *
 * @param {string} color
 * @returns {string}
 */
export function colorBgClass(color) {
    return COLOR_BG[color] ?? 'secondary';
}

// ---- date rendering helpers -----------------------------------------------

/** Month names (1-indexed) for the request locale. */
const MONTH_NAMES = (() => {
    const fmt = new Intl.DateTimeFormat(config.locale, { month: 'long', timeZone: 'UTC' });
    const names = {};
    for (let m = 1; m <= 12; m++) {
        const d = new Date(Date.UTC(2000, m - 1, 1));
        names[m] = fmt.format(d);
    }
    return names;
})();

/**
 * Render the date info from a liturgical_event object into a human-readable
 * string. Returns a plain string safe to set as textContent.
 *
 * Defensive: never throws — falls back to JSON if the shape is unexpected.
 *
 * Exported for unit testing.
 *
 * @param {{type?: string, day?: number, month?: number, strtotime?: unknown}} event
 * @returns {string}
 */
export function renderEventDate(event) {
    if (!event || typeof event !== 'object') return '';
    if (event.type === 'fixed' || (event.day !== undefined && event.month !== undefined)) {
        const monthName = MONTH_NAMES[event.month] ?? `Month ${event.month}`;
        return `${monthName} ${event.day}`;
    }
    if (event.strtotime !== undefined) {
        const st = event.strtotime;
        if (st !== null && typeof st === 'object') {
            // Relative form: {day_of_the_week, relative_time, event_key}
            const parts = [];
            if (st.day_of_the_week) parts.push(st.day_of_the_week);
            if (st.relative_time)   parts.push(st.relative_time);
            if (st.event_key)       parts.push(st.event_key);
            return parts.length > 0 ? parts.join(' ') : JSON.stringify(st);
        }
        if (typeof st === 'string') return st;
        return JSON.stringify(st);
    }
    return '';
}

// ---- DOM helpers ----------------------------------------------------------

/**
 * Create a Bootstrap badge element.
 *
 * @param {string} text   Display text
 * @param {string} [cls]  bg-* class suffix (default 'secondary')
 * @returns {HTMLSpanElement}
 */
function makeBadge(text, cls) {
    const span = document.createElement('span');
    span.className = `badge bg-${cls ?? 'secondary'} me-1`;
    span.textContent = text;
    return span;
}

/**
 * Create a dismissible Bootstrap alert and append it to a container.
 *
 * @param {HTMLElement} container
 * @param {'danger'|'warning'|'info'|'success'} type
 * @param {string} message
 */
function showAlert(container, type, message) {
    const div = document.createElement('div');
    div.className = `alert alert-${type} alert-dismissible fade show`;
    div.setAttribute('role', 'alert');
    div.textContent = message;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-close';
    btn.setAttribute('data-bs-dismiss', 'alert');
    div.appendChild(btn);
    container.appendChild(div);
}

// ---- translations panel ---------------------------------------------------

/**
 * Translation cache: decree_id → locale → localized name.
 * The request-locale entry is pre-populated from the list response.
 *
 * @type {Map<string, Map<string, string>>}
 */
const translationCache = new Map();

/**
 * Populate the translations collapsible panel with the available locales.
 * Known locales (from API metadata) are fetched on demand when the panel
 * is first expanded; the request-locale name is pre-populated.
 *
 * @param {HTMLElement}   panel      The collapsible div
 * @param {string}        decreeId   The decree_id
 * @param {string}        reqLocale  Current page locale (pre-fetched name)
 * @param {string}        reqName    The localized name in reqLocale
 * @param {string[]}      allLocales All supported locales to offer
 */
function buildTranslationsPanel(panel, decreeId, reqLocale, reqName, allLocales) {
    // Pre-populate request-locale in cache
    if (!translationCache.has(decreeId)) {
        translationCache.set(decreeId, new Map());
    }
    const cache = translationCache.get(decreeId);
    cache.set(reqLocale, reqName);

    const list = document.createElement('ul');
    list.className = 'list-group list-group-flush';
    panel.appendChild(list);

    // Show already-known request locale immediately
    const knownItem = document.createElement('li');
    knownItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    const knownLocaleSpan = document.createElement('span');
    knownLocaleSpan.className = 'text-muted small me-2';
    knownLocaleSpan.textContent = reqLocale;
    const knownNameSpan = document.createElement('span');
    knownNameSpan.textContent = reqName;
    knownItem.appendChild(knownLocaleSpan);
    knownItem.appendChild(knownNameSpan);
    list.appendChild(knownItem);

    // For each other locale, create a placeholder item that fetches on expand
    const otherLocales = allLocales.filter((l) => l !== reqLocale);
    /** @type {Map<string, HTMLLIElement>} */
    const localeItems = new Map();

    otherLocales.forEach((locale) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        const localeSpan = document.createElement('span');
        localeSpan.className = 'text-muted small me-2';
        localeSpan.textContent = locale;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-muted fst-italic small';
        nameSpan.textContent = '…';
        item.appendChild(localeSpan);
        item.appendChild(nameSpan);
        list.appendChild(item);
        localeItems.set(locale, nameSpan);
    });

    // Fetch names for other locales lazily when the panel is first shown
    let fetched = false;
    panel.addEventListener('show.bs.collapse', () => {
        if (fetched) return;
        fetched = true;
        otherLocales.forEach((locale) => {
            if (cache.has(locale)) {
                const el = localeItems.get(locale);
                if (el) {
                    el.className = '';
                    el.textContent = cache.get(locale);
                }
                return;
            }
            // Per-locale decree fetch is public — omit credentials. DecreesHandler serves
            // wildcard ACAO, and browsers reject wildcard ACAO on credentialed requests.
            fetchJson('GET', `/decrees/${encodeURIComponent(decreeId)}`, undefined, {
                'Accept-Language': locale,
            }, 'omit').then((data) => {
                const name = data
                    && typeof data === 'object'
                    && data.liturgical_event
                    && typeof data.liturgical_event.name === 'string'
                    ? data.liturgical_event.name
                    : '';
                cache.set(locale, name);
                const el = localeItems.get(locale);
                if (el) {
                    el.className = '';
                    el.textContent = name || '—';
                }
            }).catch(() => {
                const el = localeItems.get(locale);
                if (el) {
                    el.className = 'text-danger small';
                    el.textContent = config.i18n.errorText ?? '(error)';
                }
            });
        });
    });
}

// ---- readings panel -------------------------------------------------------

/**
 * Build the lectionary readings collapsible panel.
 *
 * Handles both flat shape {first_reading?, responsorial_psalm?, gospel_acclamation?, gospel?}
 * (from a GET response) and locale-keyed shape {locale: {first_reading?, ...}}
 * (from a prior write round-trip).
 *
 * @param {HTMLElement} panel
 * @param {Record<string, unknown>} readings  The readings object (flat or locale-keyed)
 */
function buildReadingsPanel(panel, readings) {
    const dl = document.createElement('dl');
    dl.className = 'row mb-0';

    const isFlat = 'first_reading' in readings || 'responsorial_psalm' in readings
                   || 'gospel_acclamation' in readings || 'gospel' in readings;

    const renderFields = (localeReadings) => {
        const fields = [
            [config.i18n.firstReading, localeReadings.first_reading],
            [config.i18n.responsorialPsalm, localeReadings.responsorial_psalm],
            [config.i18n.secondReading, localeReadings.second_reading],
            [config.i18n.gospelAcclamation, localeReadings.gospel_acclamation],
            [config.i18n.gospel, localeReadings.gospel],
        ];
        fields.forEach(([label, value]) => {
            if (!value) return;
            const dt = document.createElement('dt');
            dt.className = 'col-sm-4 fw-normal text-muted';
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.className = 'col-sm-8';
            dd.textContent = value;
            dl.appendChild(dt);
            dl.appendChild(dd);
        });
    };

    if (isFlat) {
        renderFields(readings);
    } else {
        Object.entries(readings).forEach(([locale, localeReadings]) => {
            if (!localeReadings || typeof localeReadings !== 'object') return;
            const localeHeader = document.createElement('dt');
            localeHeader.className = 'col-12 mt-2 text-muted small';
            localeHeader.textContent = locale;
            dl.appendChild(localeHeader);
            renderFields(localeReadings);
        });
    }
    panel.appendChild(dl);
}

// ---- card rendering -------------------------------------------------------

/**
 * Build a Bootstrap card for a single decree and append it to the container.
 *
 * Exported so Task 4/5 can call it after a create/update operation to refresh
 * a single card without re-rendering the whole list.
 *
 * @param {HTMLElement} container     The #decreesContainer element
 * @param {object}      decree        Decree object from GET /decrees
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 * @param {string[]}    allLocales    All supported locales for translations panel
 */
export function renderDecreeCard(container, decree, capabilities, allLocales) {
    const {
        decree_id: decreeId,
        decree_date: decreeDate,
        decree_protocol: protocol,
        description,
        liturgical_event: event,
        metadata,
    } = decree;

    const eventName  = (event && event.name) ? event.name : decreeId;
    const dateString = renderEventDate(event);

    // ---- wrapper column
    const col = document.createElement('div');
    col.className = 'col-12';
    col.setAttribute('data-decree-id', decreeId);

    // ---- card
    const card = document.createElement('div');
    card.className = 'card shadow-sm';
    col.appendChild(card);

    // ---- card header: title + action buttons
    const header = document.createElement('div');
    header.className = 'card-header d-flex justify-content-between align-items-start gap-2';
    card.appendChild(header);

    const titleBlock = document.createElement('div');
    titleBlock.className = 'flex-grow-1';

    const titleEl = document.createElement('h5');
    titleEl.className = 'mb-0';
    titleEl.textContent = eventName;
    titleBlock.appendChild(titleEl);

    const idSmall = document.createElement('small');
    idSmall.className = 'text-muted';
    idSmall.textContent = decreeId;
    titleBlock.appendChild(idSmall);
    header.appendChild(titleBlock);

    // Action buttons (hidden unless canEdit/canAdmin)
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group btn-group-sm flex-shrink-0';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = `btn btn-outline-primary${capabilities.canEdit ? '' : ' d-none'}`;
    editBtn.setAttribute('data-action', 'edit');
    editBtn.setAttribute('data-decree-id', decreeId);
    editBtn.setAttribute('aria-label', config.i18n.editAriaLabel ?? 'Edit');
    const editIcon = document.createElement('i');
    editIcon.className = 'fas fa-pencil-alt';
    editBtn.appendChild(editIcon);
    btnGroup.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = `btn btn-outline-danger${capabilities.canAdmin ? '' : ' d-none'}`;
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('data-decree-id', decreeId);
    deleteBtn.setAttribute('aria-label', config.i18n.deleteAriaLabel ?? 'Delete');
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fas fa-trash';
    deleteBtn.appendChild(deleteIcon);
    btnGroup.appendChild(deleteBtn);

    header.appendChild(btnGroup);

    // ---- card body
    const body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);

    // Badges row: grade / color / type / common
    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'mb-2';

    if (event) {
        if (event.grade !== undefined) {
            badgesDiv.appendChild(makeBadge(gradeLabel(event.grade), 'primary'));
        }
        if (Array.isArray(event.color)) {
            event.color.forEach((c) => {
                const span = makeBadge(c, colorBgClass(c));
                // Ensure legibility on light badges
                if (c === 'white') span.classList.add('text-dark', 'border');
                badgesDiv.appendChild(span);
            });
        }
        if (event.type) {
            badgesDiv.appendChild(makeBadge(event.type, event.type === 'fixed' ? 'info' : 'warning'));
        }
        if (Array.isArray(event.common)) {
            event.common.forEach((c) => badgesDiv.appendChild(makeBadge(c, 'secondary')));
        }
    }
    body.appendChild(badgesDiv);

    // Date detail line
    if (dateString) {
        const dateLine = document.createElement('p');
        dateLine.className = 'mb-2 text-muted';
        const dateIcon = document.createElement('i');
        dateIcon.className = 'fas fa-calendar-alt me-1';
        dateLine.appendChild(dateIcon);
        const dateText = document.createElement('span');
        dateText.textContent = dateString;
        dateLine.appendChild(dateText);
        body.appendChild(dateLine);
    }

    // Description
    if (description) {
        const descEl = document.createElement('p');
        descEl.className = 'mb-2';
        descEl.textContent = description;
        body.appendChild(descEl);
    }

    // ---- translations collapsible (only for name-bearing decrees: a grade
    // change does not touch the event name, so there is nothing to translate)
    const meta = decree.metadata || {};
    const nameBearing = meta.action === 'createNew' || meta.action === 'makeDoctor'
        || ( meta.action === 'setProperty' && meta.property === 'name' );
    if (nameBearing) {
        const transCollapseId = `trans-${CSS.escape(decreeId)}`;
        const transToggle = document.createElement('button');
        transToggle.type = 'button';
        transToggle.className = 'btn btn-sm btn-outline-secondary me-2 mb-2';
        transToggle.setAttribute('data-bs-toggle', 'collapse');
        transToggle.setAttribute('data-bs-target', `#${transCollapseId}`);
        transToggle.setAttribute('aria-expanded', 'false');
        transToggle.setAttribute('aria-controls', transCollapseId);
        const transIcon = document.createElement('i');
        transIcon.className = 'fas fa-language me-1';
        transToggle.appendChild(transIcon);
        transToggle.appendChild(document.createTextNode(config.i18n.translations));
        body.appendChild(transToggle);

        const transCollapse = document.createElement('div');
        transCollapse.className = 'collapse mb-2';
        transCollapse.id = transCollapseId;
        buildTranslationsPanel(
            transCollapse,
            decreeId,
            config.locale.split('-')[0].toLowerCase(),
            eventName,
            allLocales
        );
        body.appendChild(transCollapse);
    }

    // ---- readings collapsible (only when readings exist)
    if (event && event.readings && typeof event.readings === 'object'
        && Object.keys(event.readings).length > 0) {
        const readCollapseId = `readings-${CSS.escape(decreeId)}`;
        const readToggle = document.createElement('button');
        readToggle.type = 'button';
        readToggle.className = 'btn btn-sm btn-outline-secondary mb-2';
        readToggle.setAttribute('data-bs-toggle', 'collapse');
        readToggle.setAttribute('data-bs-target', `#${readCollapseId}`);
        readToggle.setAttribute('aria-expanded', 'false');
        readToggle.setAttribute('aria-controls', readCollapseId);
        const readIcon = document.createElement('i');
        readIcon.className = 'fas fa-book-open me-1';
        readToggle.appendChild(readIcon);
        readToggle.appendChild(document.createTextNode(config.i18n.readings));
        body.appendChild(readToggle);

        const readCollapse = document.createElement('div');
        readCollapse.className = 'collapse mb-2';
        readCollapse.id = readCollapseId;
        buildReadingsPanel(readCollapse, event.readings);
        body.appendChild(readCollapse);
    }

    // ---- card footer: metadata
    const footer = document.createElement('div');
    footer.className = 'card-footer text-muted small d-flex flex-wrap gap-3 align-items-center';

    if (decreeDate) {
        const dateSpan = document.createElement('span');
        const dateIcon2 = document.createElement('i');
        dateIcon2.className = 'fas fa-file-alt me-1';
        dateSpan.appendChild(dateIcon2);
        dateSpan.appendChild(document.createTextNode(decreeDate));
        footer.appendChild(dateSpan);
    }

    if (protocol) {
        const protSpan = document.createElement('span');
        protSpan.textContent = protocol;
        footer.appendChild(protSpan);
    }

    if (metadata && metadata.since_year) {
        const sinceSpan = document.createElement('span');
        sinceSpan.textContent = config.i18n.sinceYear.replace('%s', metadata.since_year);
        footer.appendChild(sinceSpan);
    }

    if (metadata && metadata.url) {
        let safeUrl = null;
        try {
            const parsed = new URL(metadata.url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                safeUrl = metadata.url;
            }
        } catch {
            // invalid URL — render as text only
        }
        if (safeUrl !== null) {
            const link = document.createElement('a');
            link.href = safeUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            const linkIcon = document.createElement('i');
            linkIcon.className = 'fas fa-external-link-alt me-1';
            link.appendChild(linkIcon);
            link.appendChild(document.createTextNode(config.i18n.sourceLink));
            footer.appendChild(link);
        } else {
            footer.appendChild(document.createTextNode(config.i18n.sourceLink));
        }
    }

    if (capabilities.canAdmin) {
        const permsLink = document.createElement('a');
        permsLink.href = 'admin-permissions.php?object_type=general_roman_calendar&object_id=decrees';
        const permsIcon = document.createElement('i');
        permsIcon.className = 'fas fa-user-shield me-1';
        permsLink.appendChild(permsIcon);
        permsLink.appendChild(document.createTextNode(config.i18n.managePerms));
        footer.appendChild(permsLink);
    }

    card.appendChild(footer);
    container.appendChild(col);
}

// ---- list loading ---------------------------------------------------------

/**
 * Canonical locale key for dedup comparisons: lowercase with underscores.
 *
 * @param {string} locale
 * @returns {string}
 */
function canonicalLocale(locale) {
    return locale.toLowerCase().replace(/-/g, '_');
}

/**
 * Fetch and render the full list of decrees.
 *
 * Fetches GET /decrees and GET /calendars in parallel. The /calendars
 * response provides `litcal_metadata.locales` — the full list of supported
 * locales used to populate the per-decree translations panel. Falls back to
 * [requestLocale] when the metadata fetch fails.
 *
 * @param {HTMLElement} container
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 */
async function loadDecrees(container, capabilities) {
    // Show a loading spinner while fetching
    const spinner = document.createElement('div');
    spinner.className = 'col-12 text-center py-4';
    spinner.setAttribute('id', 'decreesLoadingSpinner');
    const spinnerDiv = document.createElement('div');
    spinnerDiv.className = 'spinner-border text-primary';
    spinnerDiv.setAttribute('role', 'status');
    const srSpan = document.createElement('span');
    srSpan.className = 'visually-hidden';
    srSpan.textContent = config.i18n.loading;
    spinnerDiv.appendChild(srSpan);
    spinner.appendChild(spinnerDiv);
    container.appendChild(spinner);

    // Fetch /decrees (public) and /calendars (public) in parallel.
    // The /decrees endpoint is public — omit credentials. DecreesHandler serves a
    // wildcard Access-Control-Allow-Origin, and browsers reject wildcard ACAO
    // on credentialed requests.
    let data;
    let metadataLocales = null;
    try {
        const metaController = new AbortController();
        const metaTimeoutId = setTimeout(() => metaController.abort(), 15000);
        const [decreesData, metaData] = await Promise.all([
            fetchJson('GET', '/decrees', undefined, {}, 'omit'),
            fetch(config.apiUrl + '/calendars', {
                credentials: 'omit',
                headers:     { Accept: 'application/json' },
                signal:      metaController.signal,
            })
                .then((r) => { clearTimeout(metaTimeoutId); return r.ok ? r.json() : null; })
                .catch(() => { clearTimeout(metaTimeoutId); return null; }),
        ]);
        data = decreesData;
        if (
            metaData
            && metaData.litcal_metadata
            && Array.isArray(metaData.litcal_metadata.locales)
            && metaData.litcal_metadata.locales.length > 0
        ) {
            metadataLocales = metaData.litcal_metadata.locales;
        }
    } catch (err) {
        container.removeChild(spinner);
        showAlert(container, 'danger', config.i18n.loadFailed);
        console.error('Failed to load decrees:', err);
        return;
    }

    container.removeChild(spinner);

    const decrees = (data && Array.isArray(data.litcal_decrees)) ? data.litcal_decrees : [];

    if (decrees.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'col-12 text-muted text-center py-4';
        empty.textContent = config.i18n.noDecrees;
        container.appendChild(empty);
        return;
    }

    // The request locale in BCP-47 form (e.g. "en-US") — extract base language
    // code (e.g. "en") so it can be matched against the metadata locales list.
    const requestLocale = config.locale.split('-')[0].toLowerCase();

    // Build allLocales from metadata, deduplicating against the request locale
    // by comparing canonical (lowercase + underscore) forms, but keeping each
    // entry's original value for the Accept-Language header.
    let allLocales;
    if (metadataLocales) {
        const reqCanon = canonicalLocale(requestLocale);
        // Include request locale first (original form), then all others whose
        // canonical form differs from the request locale's canonical form.
        allLocales = [
            requestLocale,
            ...metadataLocales.filter((l) => canonicalLocale(l) !== reqCanon),
        ];
    } else {
        allLocales = [requestLocale];
    }

    // Store for modal use
    modalAllLocales = allLocales;

    // Build the decree map for edit pre-fill
    decreeMap.clear();
    decrees.forEach((decree) => {
        if (decree.decree_id) {
            decreeMap.set(decree.decree_id, decree);
        }
        renderDecreeCard(container, decree, capabilities, allLocales);
    });
}

// ---- editor modal ---------------------------------------------------------

/**
 * Visibility matrix: for each action, which blocks are shown.
 * keys: i18n (needs-i18n block), common (needs-common block), readingsOnCreate (needs-readings block).
 *
 * @type {Record<string, {i18n: boolean, common: boolean, readingsOnCreate: boolean}>}
 */
const MATRIX = {
    [DecreeAction.CreateNew]:        { i18n: true,  common: true,  readingsOnCreate: true  },
    [DecreeAction.MakeDoctor]:       { i18n: true,  common: true,  readingsOnCreate: false },
    [DecreeAction.SetPropertyName]:  { i18n: true,  common: false, readingsOnCreate: false },
    [DecreeAction.SetPropertyGrade]: { i18n: false, common: false, readingsOnCreate: false },
};

/**
 * Apply MATRIX visibility to modal blocks based on the selected action.
 *
 * Exported for unit testing.
 *
 * @param {string} action  One of the DecreeAction values
 * @param {HTMLElement} form  The form element containing the blocks
 */
export function applyActionVisibility(action, form) {
    const rule = MATRIX[action] ?? { i18n: false, common: false, readingsOnCreate: false };

    // createNew-only event details block
    const createNewBlocks = form.querySelectorAll('.action-createNew');
    createNewBlocks.forEach((el) => {
        el.classList.toggle('d-none', action !== DecreeAction.CreateNew);
    });

    // setProperty:grade-only block
    const gradeBlocks = form.querySelectorAll('.action-setPropertyGrade');
    gradeBlocks.forEach((el) => {
        el.classList.toggle('d-none', action !== DecreeAction.SetPropertyGrade);
    });

    // common block (needs-common) — shown for createNew and makeDoctor
    const commonBlocks = form.querySelectorAll('.needs-common');
    commonBlocks.forEach((el) => {
        el.classList.toggle('d-none', !rule.common);
    });

    // i18n block (needs-i18n)
    const i18nBlocks = form.querySelectorAll('.needs-i18n');
    i18nBlocks.forEach((el) => {
        el.classList.toggle('d-none', !rule.i18n);
    });

    // readings block (needs-readings)
    const readingsBlocks = form.querySelectorAll('.needs-readings');
    readingsBlocks.forEach((el) => {
        el.classList.toggle('d-none', !rule.readingsOnCreate);
    });
}

/**
 * Locale list sourced from the /calendars metadata response.
 * Populated after loadDecrees resolves; reused for i18n/readings locale selects.
 *
 * @type {string[]}
 */
let modalAllLocales = [];

/**
 * Map of decree_id → full decree object, populated by loadDecrees.
 * Used by the edit button to pre-fill the editor modal without an extra fetch.
 *
 * @type {Map<string, object>}
 */
const decreeMap = new Map();

/**
 * Build a locale <select> option list for an i18n row.
 *
 * @param {string[]} locales  Available locales
 * @param {string}   [selected]  Pre-selected locale value
 * @returns {HTMLSelectElement}
 */
function buildLocaleSelect(locales, selected) {
    const sel = document.createElement('select');
    sel.className = 'form-select form-select-sm';
    sel.name = 'i18n_locale[]';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = config.i18n.selectLocale;
    sel.appendChild(placeholder);

    locales.forEach((locale) => {
        const opt = document.createElement('option');
        opt.value = locale;
        opt.textContent = locale;
        if (locale === selected) opt.selected = true;
        sel.appendChild(opt);
    });
    return sel;
}

/**
 * Add an i18n row (locale + name) to #i18nRows.
 *
 * @param {HTMLElement} container  #i18nRows
 * @param {string[]}    locales    Available locales
 * @param {string}      [locale]   Pre-selected locale
 * @param {string}      [name]     Pre-filled name
 */
function addI18nRow(container, locales, locale, name) {
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2 i18n-row';

    const localCol = document.createElement('div');
    localCol.className = 'col-md-3';
    const locSel = buildLocaleSelect(locales, locale);
    localCol.appendChild(locSel);

    const nameCol = document.createElement('div');
    nameCol.className = 'col-md-8';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-control form-control-sm';
    nameInput.name = 'i18n_name[]';
    nameInput.value = name ?? '';
    nameCol.appendChild(nameInput);

    const rmCol = document.createElement('div');
    rmCol.className = 'col-md-1 d-flex align-items-center';
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'btn btn-sm btn-outline-danger';
    rmBtn.title = config.i18n.removeRow;
    const rmIcon1 = document.createElement('i');
    rmIcon1.className = 'fas fa-times';
    rmBtn.appendChild(rmIcon1);
    rmBtn.addEventListener('click', () => row.remove());
    rmCol.appendChild(rmBtn);

    row.appendChild(localCol);
    row.appendChild(nameCol);
    row.appendChild(rmCol);
    container.appendChild(row);
}

/**
 * Build a readings group (per-locale) and append it to #readingsGroups.
 *
 * @param {HTMLElement} container  #readingsGroups
 * @param {string[]}    locales    Available locales
 * @param {string}      [locale]   Pre-selected locale
 */
function addReadingsGroup(container, locales, locale) {
    const group = document.createElement('div');
    group.className = 'border rounded p-3 mb-3 readings-group';

    // Locale select header row
    const headerRow = document.createElement('div');
    headerRow.className = 'row g-2 mb-3 align-items-center';

    const locCol = document.createElement('div');
    locCol.className = 'col-md-4';
    const locSel = buildLocaleSelect(locales, locale);
    locSel.name = 'readings_locale[]';
    locCol.appendChild(locSel);

    const rmBtnCol = document.createElement('div');
    rmBtnCol.className = 'col-md-auto ms-auto';
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'btn btn-sm btn-outline-danger';
    rmBtn.title = config.i18n.removeRow;
    const rmIcon2 = document.createElement('i');
    rmIcon2.className = 'fas fa-times';
    rmBtn.appendChild(rmIcon2);
    rmBtn.addEventListener('click', () => group.remove());
    rmBtnCol.appendChild(rmBtn);

    headerRow.appendChild(locCol);
    headerRow.appendChild(rmBtnCol);
    group.appendChild(headerRow);

    // Reading fields
    const readingFields = [
        { name: 'first_reading[]',      label: config.i18n.firstReading,      required: true  },
        { name: 'responsorial_psalm[]', label: config.i18n.responsorialPsalm, required: true  },
        { name: 'second_reading[]',     label: config.i18n.secondReading,     required: false },
        { name: 'gospel_acclamation[]', label: config.i18n.gospelAcclamation, required: true  },
        { name: 'gospel[]',             label: config.i18n.gospel,            required: true  },
    ];

    readingFields.forEach(({ name, label, required }) => {
        const fieldRow = document.createElement('div');
        fieldRow.className = 'row g-2 mb-2 align-items-center';

        const labelCol = document.createElement('div');
        labelCol.className = 'col-md-4';
        const labelEl = document.createElement('label');
        labelEl.className = 'col-form-label col-form-label-sm';
        labelEl.textContent = label;
        labelCol.appendChild(labelEl);

        const inputCol = document.createElement('div');
        inputCol.className = 'col-md-8';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.name = name;
        if (!required) {
            input.placeholder = `(${config.i18n.secondReading})`;
        }
        inputCol.appendChild(input);

        fieldRow.appendChild(labelCol);
        fieldRow.appendChild(inputCol);
        group.appendChild(fieldRow);
    });

    container.appendChild(group);
}

/**
 * Collect form values from a root element and return a plain object
 * compatible with buildDecreePayload().
 *
 * Pure function — receives a root DOM element (the form or a wrapper),
 * reads named inputs, and returns a plain-object form bag.
 * Exported for unit testing.
 *
 * @param {HTMLElement} root
 * @returns {{
 *   action: string,
 *   decree_id: string,
 *   decree_date: string,
 *   decree_protocol: string,
 *   description: string,
 *   event_key: string,
 *   since_year: string,
 *   url: string,
 *   event_type: string,
 *   day: string,
 *   month: string,
 *   strtotime: string,
 *   grade: string,
 *   color: string[],
 *   common: string[],
 *   i18n: Record<string, string>,
 *   readings: Record<string, {first_reading: string, responsorial_psalm: string, second_reading?: string, gospel_acclamation: string, gospel: string}>
 * }}
 */
export function collectFormValues(root) {
    /** @param {string} name @returns {string} */
    const val = (name) => {
        const el = root.querySelector(`[name="${name}"]`);
        return el ? el.value.trim() : '';
    };

    // Determine effective action (for grade, read from the visible block)
    const action = val('action');

    // Grade: action-createNew uses #eventGradeCreate, action-setPropertyGrade uses #eventGradeSet
    let grade;
    if (action === DecreeAction.SetPropertyGrade) {
        grade = val('grade_set');
    } else {
        grade = val('grade');
    }

    // Color: multi-select
    const colorEl = root.querySelector('[name="color"]');
    const color = colorEl
        ? Array.from(colorEl.selectedOptions).map((o) => o.value).filter(Boolean)
        : [];

    // Common: free-text with comma separation
    const commonText = val('common_text');
    const common = commonText
        ? commonText.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    // i18n rows
    const i18n = {};
    // Base locale row (disabled select — read from the option text, not value)
    const baseLocaleOpt = root.querySelector('#i18nBaseLocaleOption');
    const baseLocaleValue = baseLocaleOpt ? baseLocaleOpt.value : '';
    const baseNameInput = root.querySelector('.i18n-row[data-base-row="true"] [name="i18n_name[]"]');
    if (baseLocaleValue && baseNameInput && baseNameInput.value.trim()) {
        i18n[baseLocaleValue] = baseNameInput.value.trim();
    }
    // Additional i18n rows (not base)
    const addlI18nRows = root.querySelectorAll('.i18n-row:not([data-base-row="true"])');
    addlI18nRows.forEach((row) => {
        const locSel = row.querySelector('[name="i18n_locale[]"]');
        const nameInp = row.querySelector('[name="i18n_name[]"]');
        const locale = locSel ? locSel.value : '';
        const name = nameInp ? nameInp.value.trim() : '';
        if (locale && name) {
            i18n[locale] = name;
        }
    });

    // Readings groups
    const readings = {};
    const readingGroups = root.querySelectorAll('.readings-group');
    readingGroups.forEach((group) => {
        const locSel = group.querySelector('[name="readings_locale[]"]');
        const locale = locSel ? locSel.value : '';
        if (!locale) return;

        const getField = (name) => {
            const inp = group.querySelector(`[name="${name}"]`);
            return inp ? inp.value.trim() : '';
        };

        const entry = {
            first_reading:      getField('first_reading[]'),
            responsorial_psalm: getField('responsorial_psalm[]'),
            gospel_acclamation: getField('gospel_acclamation[]'),
            gospel:             getField('gospel[]'),
        };
        const secondReading = getField('second_reading[]');
        if (secondReading) {
            entry.second_reading = secondReading;
        }
        readings[locale] = entry;
    });

    return {
        action,
        decree_id:       val('decree_id'),
        decree_date:     val('decree_date'),
        decree_protocol: val('decree_protocol'),
        description:     val('description'),
        event_key:       val('event_key'),
        since_year:      val('since_year'),
        url:             val('url'),
        event_type:      (() => {
            const checked = root.querySelector('[name="event_type"]:checked');
            return checked ? checked.value : 'fixed';
        })(),
        day:             val('day'),
        month:           val('month'),
        strtotime:       val('strtotime'),
        grade,
        color,
        common,
        i18n:            Object.keys(i18n).length > 0 ? i18n : undefined,
        readings:        Object.keys(readings).length > 0 ? readings : undefined,
    };
}

// ---- toast helper ------------------------------------------------------------

/**
 * Show a brief Bootstrap toast with the given message.
 * Falls back to a dismissible alert in #decreesContainer if the toast element
 * is absent (no-Bootstrap environment, e.g. tests).
 *
 * @param {string} message
 */
function showToast(message) {
    const toastEl = document.getElementById('decreeToast');
    if (toastEl && typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const body = toastEl.querySelector('.toast-body');
        if (body) body.textContent = message;
        bootstrap.Toast.getOrCreateInstance(toastEl).show();
    } else {
        // Fallback: dismissible alert appended to the main container
        const container = document.getElementById('decreesContainer');
        if (container) showAlert(container, 'success', message);
    }
}

// ---- action reverse-mapping helper ------------------------------------------

/**
 * Reverse-map metadata.action + metadata.property back to a DecreeAction value.
 *
 * API stores `{action: 'setProperty', property: 'grade'}` whereas the form
 * select uses the compound value `'setProperty:grade'`. This function
 * recombines them so the editor select can be pre-selected correctly.
 *
 * Exported for unit testing.
 *
 * @param {string}            action    metadata.action from the decree
 * @param {string|undefined}  property  metadata.property from the decree
 * @returns {string}  One of the DecreeAction values, or the bare action string
 *                    when no matching compound form exists.
 */
export function reverseMapAction(action, property) {
    if (property) {
        return `${action}:${property}`;
    }
    return action;
}

// ---- CRUD operations ---------------------------------------------------------

/**
 * Render a modal error message for API failures.
 *
 * Status-specific messages:
 * - 401: session-expired with a link back to the login page
 * - 403: permission-denied message
 * - 400 / 409: verbatim server text (specific enough to act on)
 * - other: generic message + server text if available
 *
 * @param {HTMLElement} alertBox  The modal alert region element
 * @param {Error & {status?: number, body?: unknown}} err  Error from fetchJson
 */
function renderFetchError(alertBox, err) {
    const status = err.status;
    const serverMsg = (err.body && typeof err.body === 'object' && typeof err.body.detail === 'string')
        ? err.body.detail
        : (typeof err.body === 'string' ? err.body : null);

    const div = document.createElement('div');
    div.className = 'alert alert-danger alert-dismissible fade show';
    div.setAttribute('role', 'alert');

    if (status === 401) {
        div.textContent = config.i18n.sessionExpired + ' ';
        const link = document.createElement('a');
        link.href = 'index.php';
        link.textContent = config.i18n.loginLink;
        div.appendChild(link);
    } else if (status === 403) {
        div.textContent = config.i18n.permissionDenied;
    } else if (status === 400 || status === 409) {
        div.textContent = serverMsg ?? err.message;
    } else {
        div.textContent = err.message;
        if (serverMsg) {
            const detail = document.createElement('span');
            detail.className = 'd-block small mt-1';
            detail.textContent = serverMsg;
            div.appendChild(detail);
        }
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-close';
    btn.setAttribute('data-bs-dismiss', 'alert');
    div.appendChild(btn);
    alertBox.appendChild(div);
}

/**
 * Reload the decrees list: clear the container and call loadDecrees again.
 *
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 */
async function reloadDecrees(capabilities) {
    const container = document.getElementById('decreesContainer');
    if (!container) return;
    container.replaceChildren();
    await loadDecrees(container, capabilities);
}

/**
 * Save a decree via PUT (create) or PATCH (update).
 *
 * On success: shows a toast, closes the modal, and reloads the list.
 * On failure: renders the error in the modal alert region.
 *
 * IMPORTANT: PATCH must not change liturgical_event.event_key (the API
 * rejects it with 400). The event_key input is made readonly in edit mode
 * (see openEditorModal) to prevent this from being triggered accidentally.
 *
 * @param {object}  payload      Built payload from buildDecreePayload()
 * @param {boolean} isCreate     true → PUT /decrees/{id} (201 expected)
 * @param {HTMLElement} alertBox Modal alert region
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 * @returns {Promise<void>}
 */
async function saveDecree(payload, isCreate, alertBox, capabilities) {
    const method = isCreate ? 'PUT' : 'PATCH';
    try {
        await fetchJson(method, `/decrees/${encodeURIComponent(payload.decree_id)}`, payload, {
            'Accept-Language': config.locale,
        });
        // Close editor modal before showing toast (Bootstrap modal may steal focus)
        const modalEl = document.getElementById('decreeEditorModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }
        showToast(isCreate ? config.i18n.created : config.i18n.updated);
        await reloadDecrees(capabilities);
    } catch (err) {
        renderFetchError(alertBox, err);
    }
}

/**
 * Delete a decree after confirmation.
 *
 * @param {string} decreeId
 * @param {HTMLElement} deleteAlertBox  The delete modal alert region
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 * @returns {Promise<void>}
 */
async function deleteDecree(decreeId, deleteAlertBox, capabilities) {
    try {
        await fetchJson('DELETE', `/decrees/${encodeURIComponent(decreeId)}`);
        // Close delete modal
        const deleteModalEl = document.getElementById('decreeDeleteModal');
        if (deleteModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
        }
        showToast(config.i18n.deleted);
        await reloadDecrees(capabilities);
    } catch (err) {
        renderFetchError(deleteAlertBox, err);
    }
}

/**
 * Open the editor modal for create or edit.
 *
 * @param {object|null} decree       Existing decree object (null for create)
 * @param {string[]}    locales      Available locales for i18n/readings selects
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 */
function openEditorModal(decree, locales, capabilities) {
    const modal    = document.getElementById('decreeEditorModal');
    const form     = document.getElementById('decreeEditorForm');
    const alertBox = document.getElementById('decreeEditorAlerts');
    const label    = document.getElementById('decreeEditorModalLabel');
    const saveBtn  = document.getElementById('saveDecreeBtn');
    const isCreate = !decree;

    if (!modal || !form || !alertBox) return;

    // Reset form and alerts
    form.reset();
    alertBox.replaceChildren();

    // Update modal title
    if (label) {
        label.textContent = isCreate ? config.i18n.newDecree : config.i18n.editDecree;
    }

    // Set base locale option value and text on the disabled select
    const baseLocaleOpt = document.getElementById('i18nBaseLocaleOption');
    const baseLocale = config.locale.split('-')[0].toLowerCase();
    if (baseLocaleOpt) {
        baseLocaleOpt.value       = baseLocale;
        baseLocaleOpt.textContent = baseLocale;
    }

    // Clear dynamic i18n rows (keep only base row)
    const i18nRows = document.getElementById('i18nRows');
    if (i18nRows) {
        const addlRows = i18nRows.querySelectorAll('.i18n-row:not([data-base-row="true"])');
        addlRows.forEach((r) => r.remove());
    }

    // Clear readings groups
    const readingsGroups = document.getElementById('readingsGroups');
    if (readingsGroups) {
        readingsGroups.replaceChildren();
    }

    // Populate from existing decree if editing
    if (decree) {
        const setVal = (name, value) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el && value !== undefined && value !== null) el.value = value;
        };

        // decree_id is readonly when editing (prevents PATCH from changing the ID)
        const decreeIdEl = form.querySelector('[name="decree_id"]');
        if (decreeIdEl) {
            decreeIdEl.value    = decree.decree_id ?? '';
            decreeIdEl.readOnly = true;
        }

        // event_key is readonly when editing: PATCH must NOT change event_key
        // (API rejects with 400 and instructs DELETE + PUT instead).
        // Only set readonly if the decree actually has a liturgical_event.event_key;
        // if missing, leave it editable to allow assignment.
        const eventKeyEl = form.querySelector('[name="event_key"]');
        if (eventKeyEl) {
            eventKeyEl.readOnly = Boolean(decree.liturgical_event && decree.liturgical_event.event_key);
        }

        setVal('decree_date',     decree.decree_date);
        setVal('decree_protocol', decree.decree_protocol);
        setVal('description',     decree.description);

        // Pre-select action from metadata via reverse-mapping
        const meta = decree.metadata;
        if (meta) {
            const actionValue = reverseMapAction(meta.action, meta.property);
            const actionEl = form.querySelector('[name="action"]');
            if (actionEl) {
                actionEl.value = actionValue;
            }
            if (meta.since_year) setVal('since_year', meta.since_year);
            if (meta.url)        setVal('url',        meta.url);
        }

        const ev = decree.liturgical_event;
        if (ev) {
            setVal('event_key', ev.event_key);
            if (ev.grade !== undefined) {
                setVal('grade',     ev.grade);
                setVal('grade_set', ev.grade);
            }
            if (Array.isArray(ev.color)) {
                const colorEl = form.querySelector('[name="color"]');
                if (colorEl) {
                    Array.from(colorEl.options).forEach((opt) => {
                        opt.selected = ev.color.includes(opt.value);
                    });
                }
            }

            // Pre-fill day and month (fixed events)
            if (ev.day !== undefined) setVal('day', ev.day);
            if (ev.month !== undefined) setVal('month', ev.month);

            // Pre-fill strtotime (mobile events)
            if (ev.strtotime !== undefined) {
                const strtotimeStr = (ev.strtotime !== null && typeof ev.strtotime === 'object')
                    ? JSON.stringify(ev.strtotime)
                    : String(ev.strtotime);
                setVal('strtotime', strtotimeStr);
            }

            // Pre-select event_type radio (fixed or mobile)
            const eventType = ev.type === 'mobile' ? 'mobile' : 'fixed';
            const radioToCheck = form.querySelector(`[name="event_type"][value="${eventType}"]`);
            if (radioToCheck) radioToCheck.checked = true;

            // Pre-fill common
            if (Array.isArray(ev.common) && ev.common.length > 0) {
                setVal('common_text', ev.common.join(', '));
            }

            // Pre-fill i18n base row with the request-locale name
            if (ev.name) {
                const baseNameInput = i18nRows
                    ? i18nRows.querySelector('.i18n-row[data-base-row="true"] [name="i18n_name[]"]')
                    : null;
                if (baseNameInput) {
                    baseNameInput.value = ev.name;
                }
            }

            // Pre-fill readings groups from liturgical_event.readings when present
            if (ev.readings && typeof ev.readings === 'object') {
                const isFlat = 'first_reading' in ev.readings || 'responsorial_psalm' in ev.readings
                               || 'gospel_acclamation' in ev.readings || 'gospel' in ev.readings;
                if (isFlat && readingsGroups) {
                    // Flat shape (GET response): create one group for the base locale
                    addReadingsGroup(readingsGroups, locales, baseLocale);
                    const groups = readingsGroups.querySelectorAll('.readings-group');
                    const group = groups[groups.length - 1];
                    if (group) {
                        const fillField = (name, value) => {
                            const inp = group.querySelector(`[name="${name}"]`);
                            if (inp && value) inp.value = value;
                        };
                        fillField('first_reading[]',      ev.readings.first_reading);
                        fillField('responsorial_psalm[]', ev.readings.responsorial_psalm);
                        fillField('gospel_acclamation[]', ev.readings.gospel_acclamation);
                        fillField('gospel[]',             ev.readings.gospel);
                    }
                } else if (!isFlat) {
                    // Locale-keyed shape (from a prior write round-trip)
                    Object.entries(ev.readings).forEach(([locale, localeReadings]) => {
                        if (!localeReadings || typeof localeReadings !== 'object') return;
                        if (readingsGroups) {
                            addReadingsGroup(readingsGroups, locales, locale);
                            // The group was just appended — grab it and fill in values
                            const groups = readingsGroups.querySelectorAll('.readings-group');
                            const group = groups[groups.length - 1];
                            if (!group) return;
                            const fillField = (name, value) => {
                                const inp = group.querySelector(`[name="${name}"]`);
                                if (inp && value) inp.value = value;
                            };
                            fillField('first_reading[]',      localeReadings.first_reading);
                            fillField('responsorial_psalm[]', localeReadings.responsorial_psalm);
                            fillField('second_reading[]',     localeReadings.second_reading);
                            fillField('gospel_acclamation[]', localeReadings.gospel_acclamation);
                            fillField('gospel[]',             localeReadings.gospel);
                        }
                    });
                }
            }
        }
    } else {
        // Creating: decree_id and event_key are editable
        const decreeIdEl = form.querySelector('[name="decree_id"]');
        if (decreeIdEl) decreeIdEl.readOnly = false;
        const eventKeyEl = form.querySelector('[name="event_key"]');
        if (eventKeyEl) eventKeyEl.readOnly = false;

        // Pre-add a base-locale readings group for createNew
        addReadingsGroup(readingsGroups, locales, baseLocale);
    }

    // Apply initial visibility
    const actionEl = form.querySelector('[name="action"]');
    const initialAction = actionEl ? actionEl.value : DecreeAction.CreateNew;
    applyActionVisibility(initialAction, form);

    // Fixed/mobile radio toggle
    const eventTypeRadios = form.querySelectorAll('[name="event_type"]');
    const fixedDateInputs  = document.getElementById('fixedDateInputs');
    const mobileDateInput  = document.getElementById('mobileDateInput');

    const syncDateType = (value) => {
        if (fixedDateInputs) fixedDateInputs.classList.toggle('d-none', value !== 'fixed');
        if (mobileDateInput)  mobileDateInput.classList.toggle('d-none',  value !== 'mobile');
    };
    eventTypeRadios.forEach((radio) => {
        radio.addEventListener('change', () => syncDateType(radio.value));
    });
    // Set initial state
    const checkedRadio = form.querySelector('[name="event_type"]:checked');
    syncDateType(checkedRadio ? checkedRadio.value : 'fixed');

    // Add i18n row button
    const addI18nBtn = document.getElementById('addI18nRow');
    if (addI18nBtn) {
        // Clone to remove old listeners
        const newBtn = addI18nBtn.cloneNode(true);
        addI18nBtn.parentNode.replaceChild(newBtn, addI18nBtn);
        newBtn.addEventListener('click', () => {
            const rows = document.getElementById('i18nRows');
            if (rows) addI18nRow(rows, locales);
        });
    }

    // Add readings group button
    const addReadingsBtn = document.getElementById('addReadingsGroup');
    if (addReadingsBtn) {
        const newBtn = addReadingsBtn.cloneNode(true);
        addReadingsBtn.parentNode.replaceChild(newBtn, addReadingsBtn);
        newBtn.addEventListener('click', () => {
            const groups = document.getElementById('readingsGroups');
            if (groups) addReadingsGroup(groups, locales);
        });
    }

    // Wire save button
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', async () => {
            newSaveBtn.disabled = true;
            try {
                alertBox.replaceChildren();
                const formValues = collectFormValues(form);
                const payload    = buildDecreePayload(formValues);
                const errors     = validateDecreePayload(payload, baseLocale, isCreate);

                if (errors.length > 0) {
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-danger';
                    alertDiv.setAttribute('role', 'alert');
                    const heading = document.createElement('p');
                    heading.className = 'fw-semibold mb-1';
                    heading.textContent = config.i18n.validationErrors;
                    alertDiv.appendChild(heading);
                    const ul = document.createElement('ul');
                    ul.className = 'mb-0';
                    errors.forEach((msg) => {
                        const li = document.createElement('li');
                        li.textContent = msg;
                        ul.appendChild(li);
                    });
                    alertDiv.appendChild(ul);
                    alertBox.appendChild(alertDiv);
                    return;
                }

                await saveDecree(payload, isCreate, alertBox, capabilities);
            } finally {
                newSaveBtn.disabled = false;
            }
        });
    }

    // Show modal via Bootstrap
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(modal).show();
    }
}

// ---- module capabilities export -------------------------------------------

/**
 * Resolved capabilities for this page session.
 * Tasks 4 and 5 import this to gate save/delete logic.
 *
 * @type {Promise<{canView: boolean, canEdit: boolean, canAdmin: boolean}>}
 */
export const capabilitiesPromise = detectCapabilities();

// ---- entry point ----------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    if (!config) {
        console.error('AdminDecreesConfig not found');
        return;
    }

    const container  = document.getElementById('decreesContainer');
    const createBtn  = document.getElementById('btnCreateDecree');
    const form       = document.getElementById('decreeEditorForm');

    if (!container) {
        console.error('decreesContainer not found');
        return;
    }

    // Wire action-change visibility toggling
    if (form) {
        const actionEl = form.querySelector('[name="action"]');
        if (actionEl) {
            actionEl.addEventListener('change', () => {
                applyActionVisibility(actionEl.value, form);
            });
        }
    }

    const capabilities = await capabilitiesPromise;

    // No-access guard
    if (!capabilities.canView) {
        showAlert(container, 'warning', config.i18n.noAccess);
        return;
    }

    // Show create button for editors
    if (capabilities.canEdit && createBtn) {
        createBtn.classList.remove('d-none');
        createBtn.addEventListener('click', () => {
            openEditorModal(null, modalAllLocales, capabilities);
        });
    }

    // Wire edit buttons via event delegation on the container
    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit"]');
        if (editBtn && capabilities.canEdit) {
            const decreeId = editBtn.getAttribute('data-decree-id');
            const decree   = decreeMap.get(decreeId) ?? { decree_id: decreeId };
            openEditorModal(decree, modalAllLocales, capabilities);
        }
    });

    // Wire delete buttons via event delegation (admin-only)
    if (capabilities.canAdmin) {
        const deleteModal      = document.getElementById('decreeDeleteModal');
        const deleteConfirmBtn = document.getElementById('confirmDeleteDecreeBtn');
        const deleteConfirmText = document.getElementById('decreeDeleteConfirmText');
        const deleteAlertBox   = document.getElementById('decreeDeleteAlerts');

        // Clicking a delete button opens the confirmation modal
        container.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('[data-action="delete"]');
            if (!deleteBtn) return;
            const decreeId = deleteBtn.getAttribute('data-decree-id');

            if (deleteConfirmText) {
                deleteConfirmText.textContent = `${config.i18n.confirmDelete} (${decreeId})`;
            }
            if (deleteAlertBox) {
                deleteAlertBox.replaceChildren();
            }

            // Wire (or re-wire) the confirm button for this specific decree
            if (deleteConfirmBtn) {
                const newConfirmBtn = deleteConfirmBtn.cloneNode(true);
                deleteConfirmBtn.parentNode.replaceChild(newConfirmBtn, deleteConfirmBtn);
                newConfirmBtn.addEventListener('click', () => {
                    deleteDecree(decreeId, deleteAlertBox, capabilities);
                });
            }

            if (deleteModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                bootstrap.Modal.getOrCreateInstance(deleteModal).show();
            }
        });
    }

    await loadDecrees(container, capabilities);
});
