/**
 * Admin Decrees Management Module
 *
 * Handles capability detection via /admin/permissions/check and renders
 * the enriched read-only list of Dicastery for Divine Worship decrees.
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

const config = window.AdminDecreesConfig;

// ---- generic fetch seam ---------------------------------------------------
// Copied verbatim from assets/js/admin-tests.js (adapted: uses config.apiUrl).

/**
 * Fetch JSON from the API with credentials and a 15 s timeout.
 *
 * @param {string} method  HTTP method
 * @param {string} path    Path (appended to config.apiUrl)
 * @param {unknown} [body] Optional JSON body
 * @param {Record<string,string>} [extraHeaders] Additional request headers
 * @returns {Promise<unknown>} Parsed JSON body
 */
async function fetchJson(method, path, body, extraHeaders) {
    const opts = {
        method,
        headers: { Accept: 'application/json', ...extraHeaders },
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

/** @type {Record<number, string>} */
const GRADE_LABELS = {
    7: 'Higher Solemnity',
    6: 'Solemnity',
    5: 'Feast of the Lord',
    4: 'Feast',
    3: 'Memorial',
    2: 'Optional Memorial',
    1: 'Commemoration',
    0: 'Weekday',
};

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
    return GRADE_LABELS[grade] ?? `Grade ${grade}`;
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
            fetchJson('GET', `/decrees/${encodeURIComponent(decreeId)}`, undefined, {
                'Accept-Language': locale,
            }).then((data) => {
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
                    el.textContent = '(error)';
                }
            });
        });
    });
}

// ---- readings panel -------------------------------------------------------

/**
 * Build the lectionary readings collapsible panel.
 *
 * @param {HTMLElement} panel
 * @param {Record<string, {
 *   first_reading?: string,
 *   responsorial_psalm?: string,
 *   gospel_acclamation?: string,
 *   gospel?: string
 * }>} readings  The readings object keyed by locale
 */
function buildReadingsPanel(panel, readings) {
    const dl = document.createElement('dl');
    dl.className = 'row mb-0';

    Object.entries(readings).forEach(([locale, localeReadings]) => {
        if (!localeReadings || typeof localeReadings !== 'object') return;
        const localeHeader = document.createElement('dt');
        localeHeader.className = 'col-12 mt-2 text-muted small';
        localeHeader.textContent = locale;
        dl.appendChild(localeHeader);

        const fields = [
            ['First Reading', localeReadings.first_reading],
            ['Responsorial Psalm', localeReadings.responsorial_psalm],
            ['Gospel Acclamation', localeReadings.gospel_acclamation],
            ['Gospel', localeReadings.gospel],
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
    });
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
    editBtn.setAttribute('aria-label', 'Edit');
    const editIcon = document.createElement('i');
    editIcon.className = 'fas fa-pencil-alt';
    editBtn.appendChild(editIcon);
    btnGroup.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = `btn btn-outline-danger${capabilities.canAdmin ? '' : ' d-none'}`;
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('data-decree-id', decreeId);
    deleteBtn.setAttribute('aria-label', 'Delete');
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

    // ---- translations collapsible
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
        config.locale.replace(/-/g, '_'),
        eventName,
        allLocales
    );
    body.appendChild(transCollapse);

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
        sinceSpan.textContent = `Since ${metadata.since_year}`;
        footer.appendChild(sinceSpan);
    }

    if (metadata && metadata.url) {
        const link = document.createElement('a');
        link.href = metadata.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const linkIcon = document.createElement('i');
        linkIcon.className = 'fas fa-external-link-alt me-1';
        link.appendChild(linkIcon);
        link.appendChild(document.createTextNode('Source'));
        footer.appendChild(link);
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

    // Fetch /decrees (authenticated) and /calendars (public) in parallel.
    // The /calendars endpoint needs no credentials and does not send cookies.
    let data;
    let metadataLocales = null;
    try {
        const [decreesData, metaData] = await Promise.all([
            fetchJson('GET', '/decrees'),
            fetch(config.apiUrl + '/calendars', { headers: { Accept: 'application/json' } })
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
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

    // The request locale in BCP-47 form (e.g. "en-US") — normalise to
    // underscore form (e.g. "en_US") so it can be matched against the
    // metadata locales list which uses underscore separators.
    const requestLocale = config.locale.replace(/-/g, '_');

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

    decrees.forEach((decree) => {
        renderDecreeCard(container, decree, capabilities, allLocales);
    });
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

    if (!container) {
        console.error('decreesContainer not found');
        return;
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
    }

    await loadDecrees(container, capabilities);
});
