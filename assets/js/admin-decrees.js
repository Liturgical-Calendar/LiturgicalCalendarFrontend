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

import { DecreeAction, buildDecreePayload, validateDecreePayload, deriveDecreeId } from './DecreePayload.js';

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

// ---- per-locale decree fetch cache ----------------------------------------

/**
 * Per-locale liturgical_event cache: decree_id → locale → Promise<object|null>.
 * Shared by the translations and readings panels so a decree's representation
 * in a given locale is fetched at most once, no matter which panel asks first.
 *
 * @type {Map<string, Map<string, Promise<object|null>>>}
 */
const eventLocaleCache = new Map();

/**
 * Fetch a decree's liturgical_event as localized for the given locale,
 * deduplicating concurrent and repeated requests via eventLocaleCache.
 * A failed fetch is evicted from the cache so a later expand can retry.
 *
 * @param {string} decreeId
 * @param {string} locale
 * @returns {Promise<object|null>}
 */
function fetchEventForLocale(decreeId, locale) {
    if (!eventLocaleCache.has(decreeId)) {
        eventLocaleCache.set(decreeId, new Map());
    }
    const perDecree = eventLocaleCache.get(decreeId);
    if (!perDecree.has(locale)) {
        // Per-locale decree fetch is public — omit credentials. DecreesHandler serves
        // wildcard ACAO, and browsers reject wildcard ACAO on credentialed requests.
        const promise = fetchJson('GET', `/decrees/${encodeURIComponent(decreeId)}`, undefined, {
            'Accept-Language': locale,
        }, 'omit').then((data) => (
            data && typeof data === 'object'
                && data.liturgical_event && typeof data.liturgical_event === 'object'
                ? data.liturgical_event
                : null
        ));
        promise.catch(() => perDecree.delete(locale));
        perDecree.set(locale, promise);
    }
    return perDecree.get(locale);
}

// ---- translations panel ---------------------------------------------------

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
    const list = document.createElement('ul');
    list.className = 'list-group list-group-flush';
    panel.appendChild(list);

    const addItem = (locale, name, cls) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        const locSpan = document.createElement('span');
        locSpan.className = 'text-muted small me-2';
        locSpan.textContent = locale;
        const nameSpan = document.createElement('span');
        if (cls) nameSpan.className = cls;
        nameSpan.textContent = name;
        item.appendChild(locSpan);
        item.appendChild(nameSpan);
        list.appendChild(item);
        return nameSpan;
    };

    // Show the request-locale name immediately (already known from the list).
    addItem(reqLocale, reqName);

    // On first expand, fetch the enriched decree and list every defined
    // translation from its i18n map. If the API returns no i18n map (older
    // deployment), fall back to lazily probing the known locales one by one.
    let fetched = false;
    panel.addEventListener('show.bs.collapse', () => {
        if (fetched) return;
        fetched = true;
        fetchJson('GET', `/decrees/${encodeURIComponent(decreeId)}`, undefined, { 'Accept-Language': config.locale }, 'omit')
            .then((data) => {
                const i18n = data && typeof data === 'object' && data.i18n && typeof data.i18n === 'object'
                    ? data.i18n
                    : null;
                if (i18n) {
                    list.replaceChildren();
                    const ordered = [reqLocale, ...Object.keys(i18n).filter((k) => k !== reqLocale).sort()];
                    ordered.forEach((loc) => {
                        const name = typeof i18n[loc] === 'string' && i18n[loc] !== ''
                            ? i18n[loc]
                            : ( loc === reqLocale ? reqName : '' );
                        if (name) addItem(loc, name);
                    });
                    return;
                }
                // Fallback: probe the GRC-known locales individually.
                allLocales.filter((l) => l !== reqLocale).forEach((locale) => {
                    const nameSpan = addItem(locale, '…', 'text-muted fst-italic small');
                    fetchEventForLocale(decreeId, locale).then((event) => {
                        nameSpan.className = '';
                        nameSpan.textContent = ( event && typeof event.name === 'string' ? event.name : '' ) || '—';
                    }).catch(() => {
                        nameSpan.className = 'text-danger small';
                        nameSpan.textContent = config.i18n.errorText ?? '(error)';
                    });
                });
            })
            .catch(() => {
                // Leave just the request-locale entry.
            });
    });
}

// ---- readings panel -------------------------------------------------------

/**
 * Render the flat readings fields of one locale into a tab pane,
 * replacing any previous content (placeholder spinner or stale data).
 * Empty fields are skipped; an entirely empty locale gets a muted note.
 *
 * @param {HTMLElement} pane
 * @param {Record<string, unknown>|null|undefined} readings  Flat readings object for one locale
 */
function renderReadingsFields(pane, readings) {
    pane.replaceChildren();
    const dl = document.createElement('dl');
    dl.className = 'row mb-0';
    const fields = readings && typeof readings === 'object'
        ? [
            [config.i18n.firstReading, readings.first_reading],
            [config.i18n.responsorialPsalm, readings.responsorial_psalm],
            [config.i18n.secondReading, readings.second_reading],
            [config.i18n.gospelAcclamation, readings.gospel_acclamation],
            [config.i18n.gospel, readings.gospel],
        ]
        : [];
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
    if (dl.children.length === 0) {
        const note = document.createElement('p');
        note.className = 'text-muted fst-italic small mb-0';
        note.textContent = config.i18n.noReadings ?? '—';
        pane.appendChild(note);
        return;
    }
    pane.appendChild(dl);
}

/**
 * Build the lectionary readings collapsible panel as a per-locale tabbed view.
 *
 * The request-locale tab is populated immediately from the list response;
 * the other locales are fetched lazily (via the shared eventLocaleCache)
 * the first time the panel is expanded — same pattern as the translations panel.
 *
 * @param {HTMLElement} panel
 * @param {string}      decreeId
 * @param {string}      reqLocale   Current page locale (readings already fetched)
 * @param {Record<string, unknown>|null} reqReadings  Flat readings for reqLocale
 * @param {string[]}    allLocales  All supported locales to offer as tabs
 */
function buildReadingsPanel(panel, decreeId, reqLocale, reqReadings, allLocales) {
    const locales = allLocales.includes(reqLocale) ? allLocales : [reqLocale, ...allLocales];
    const idBase  = `readings-${CSS.escape(decreeId)}`;

    const nav = document.createElement('ul');
    nav.className = 'nav nav-pills nav-sm mb-2';
    nav.setAttribute('role', 'tablist');
    panel.appendChild(nav);

    const content = document.createElement('div');
    content.className = 'tab-content';
    panel.appendChild(content);

    /** @type {Map<string, HTMLElement>} */
    const localePanes = new Map();

    locales.forEach((locale) => {
        const active = locale === reqLocale;
        const paneId = `${idBase}-${CSS.escape(locale)}`;

        const navItem = document.createElement('li');
        navItem.className = 'nav-item';
        navItem.setAttribute('role', 'presentation');
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = `nav-link py-0 px-2 small${active ? ' active' : ''}`;
        tabBtn.id = `${paneId}-tab`;
        tabBtn.setAttribute('data-bs-toggle', 'pill');
        tabBtn.setAttribute('data-bs-target', `#${paneId}`);
        tabBtn.setAttribute('role', 'tab');
        tabBtn.setAttribute('aria-controls', paneId);
        tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
        tabBtn.textContent = locale;
        navItem.appendChild(tabBtn);
        nav.appendChild(navItem);

        const pane = document.createElement('div');
        pane.className = `tab-pane fade${active ? ' show active' : ''}`;
        pane.id = paneId;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', `${paneId}-tab`);
        content.appendChild(pane);
        localePanes.set(locale, pane);

        if (active) {
            renderReadingsFields(pane, reqReadings);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'text-muted fst-italic small';
            placeholder.textContent = '…';
            pane.appendChild(placeholder);
        }
    });

    // Fetch readings for other locales lazily when the panel is first shown
    let fetched = false;
    panel.addEventListener('show.bs.collapse', () => {
        if (fetched) return;
        fetched = true;
        locales.filter((l) => l !== reqLocale).forEach((locale) => {
            fetchEventForLocale(decreeId, locale).then((event) => {
                const pane = localePanes.get(locale);
                if (pane) {
                    renderReadingsFields(pane, event ? event.readings : null);
                }
            }).catch(() => {
                const pane = localePanes.get(locale);
                if (pane) {
                    pane.replaceChildren();
                    const err = document.createElement('span');
                    err.className = 'text-danger small';
                    err.textContent = config.i18n.errorText ?? '(error)';
                    pane.appendChild(err);
                }
            });
        });
    });
}

// ---- card rendering helpers -----------------------------------------------

/**
 * Build the card header element containing the event title, decree_id, and
 * action buttons (edit/delete) gated on capabilities.
 *
 * @param {string} decreeId
 * @param {string} eventName
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 * @returns {HTMLElement}
 */
function buildCardHeader(decreeId, eventName, capabilities) {
    const header = document.createElement('div');
    header.className = 'card-header d-flex justify-content-between align-items-start gap-2';

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
    return header;
}

/**
 * Build the badges row (grade, colors, type, common) for a liturgical event.
 *
 * @param {object|null|undefined} event  The liturgical_event object
 * @returns {HTMLElement}
 */
function buildEventBadges(event) {
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
    return badgesDiv;
}

/**
 * Append the date line and description paragraph to a card body.
 *
 * @param {HTMLElement} body
 * @param {string}      dateString  Result of renderEventDate(); empty string → skip
 * @param {string|null|undefined} description
 */
function buildEventDetails(body, dateString, description) {
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

    if (description) {
        const descEl = document.createElement('p');
        descEl.className = 'mb-2';
        descEl.textContent = description;
        body.appendChild(descEl);
    }
}

/**
 * Append the translations collapsible section to the card body.
 * Only called for name-bearing decrees (createNew, makeDoctor, setProperty:name).
 *
 * @param {HTMLElement} body
 * @param {string}      decreeId
 * @param {string}      eventName
 * @param {string[]}    allLocales
 */
function buildTranslationsSection(body, decreeId, eventName, allLocales) {
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

/**
 * Append the readings collapsible section to the card body.
 * Called for createNew decrees (readings are guaranteed by the write contract)
 * and for any other decree whose event carries a readings object.
 *
 * @param {HTMLElement} body
 * @param {object|null} readings    The event.readings object for the page locale
 * @param {string}      decreeId
 * @param {string[]}    allLocales  All supported locales, one readings tab each
 */
function buildReadingsSection(body, readings, decreeId, allLocales) {
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
    buildReadingsPanel(
        readCollapse,
        decreeId,
        config.locale.split('-')[0].toLowerCase(),
        readings,
        allLocales
    );
    body.appendChild(readCollapse);
}

/**
 * Lazily-built Intl.DisplayNames for the UI locale (language names), or false
 * when the environment lacks Intl.DisplayNames.
 *
 * @type {Intl.DisplayNames|false|null}
 */
let langDisplayNames = null;

/**
 * Human-readable language name for an ISO 639-1 code in the UI locale, falling
 * back to the uppercased code when it cannot be resolved.
 *
 * @param {string} iso
 * @returns {string}
 */
function languageDisplayName(iso) {
    if (langDisplayNames === null) {
        try {
            langDisplayNames = new Intl.DisplayNames([config.locale], { type: 'language' });
        } catch {
            langDisplayNames = false;
        }
    }
    if (langDisplayNames) {
        try {
            return langDisplayNames.of(iso) || iso.toUpperCase();
        } catch {
            return iso.toUpperCase();
        }
    }
    return iso.toUpperCase();
}

/**
 * Return the URL only if it is an http(s) URL, else null (blocks javascript:
 * and other unsafe schemes before assigning to href).
 *
 * @param {string} url
 * @returns {string|null}
 */
function safeHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? url : null;
    } catch {
        return null;
    }
}

/**
 * Build an external-link anchor (new tab, noopener) with an optional leading
 * icon and the given text.
 *
 * @param {string}  href
 * @param {string}  text
 * @param {boolean} [withIcon=false]
 * @returns {HTMLAnchorElement}
 */
function buildExternalLink(href, text, withIcon = false) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (withIcon) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-external-link-alt me-1';
        a.appendChild(icon);
    }
    a.appendChild(document.createTextNode(text));
    return a;
}

/**
 * Build the source-link footer element for a decree's metadata:
 * - No %s placeholder: a single "Source" link to the URL.
 * - %s placeholder + url_lang_map: one link per language (the urls_langs),
 *   each the URL with %s expanded to that language's Vatican code, labelled
 *   with the language's display name.
 * - %s placeholder but no map: a plain "Source" label (no dead link).
 *
 * @param {object} metadata  The decree metadata (url, url_lang_map)
 * @returns {HTMLElement}
 */
function buildSourceLinks(metadata) {
    const url = metadata.url;
    const hasPlaceholder = url.includes('%s');
    const langMap = (metadata.url_lang_map && typeof metadata.url_lang_map === 'object'
        && Object.keys(metadata.url_lang_map).length > 0)
        ? metadata.url_lang_map
        : null;

    // Single real URL (no placeholder): one "Source" link.
    if (!hasPlaceholder) {
        const safe = safeHttpUrl(url);
        if (safe !== null) {
            return buildExternalLink(safe, config.i18n.sourceLink, true);
        }
        const span = document.createElement('span');
        span.textContent = config.i18n.sourceLink;
        return span;
    }

    // Placeholder with a language map: list the per-language expanded URLs.
    if (langMap) {
        const wrap = document.createElement('span');
        wrap.className = 'd-inline-flex flex-wrap gap-2 align-items-center';
        const label = document.createElement('span');
        const labelIcon = document.createElement('i');
        labelIcon.className = 'fas fa-external-link-alt me-1';
        label.appendChild(labelIcon);
        label.appendChild(document.createTextNode(`${config.i18n.sourceLink}:`));
        wrap.appendChild(label);
        Object.entries(langMap).forEach(([iso, code]) => {
            const safe = safeHttpUrl(url.replace(/%s/g, code));
            if (safe === null) return;
            wrap.appendChild(buildExternalLink(safe, languageDisplayName(iso)));
        });
        return wrap;
    }

    // Placeholder but no map: cannot expand to a real URL — plain label only.
    const span = document.createElement('span');
    span.textContent = config.i18n.sourceLink;
    return span;
}

/**
 * Build the card footer element containing decree metadata (date, protocol,
 * since_year, source link).
 *
 * @param {string|null|undefined} decreeDate
 * @param {string|null|undefined} protocol
 * @param {object|null|undefined} metadata
 * @returns {HTMLElement}
 */
function buildCardFooter(decreeDate, protocol, metadata) {
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
        footer.appendChild(buildSourceLinks(metadata));
    }

    return footer;
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

    card.appendChild(buildCardHeader(decreeId, eventName, capabilities));

    // ---- card body
    const body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);

    body.appendChild(buildEventBadges(event));
    buildEventDetails(body, dateString, description);

    // ---- translations collapsible (only for name-bearing decrees: a grade
    // change does not touch the event name, so there is nothing to translate)
    const meta = decree.metadata || {};
    const nameBearing = meta.action === 'createNew' || meta.action === 'makeDoctor'
        || ( meta.action === 'setProperty' && meta.property === 'name' );
    if (nameBearing) {
        buildTranslationsSection(body, decreeId, eventName, allLocales);
    }

    // ---- readings collapsible: always for createNew decrees (the write contract
    // guarantees readings exist in at least the base locale, even when the page
    // locale's translation is still empty), otherwise only when readings exist
    const hasReadings = event && event.readings && typeof event.readings === 'object'
        && Object.keys(event.readings).length > 0;
    if (hasReadings || meta.action === 'createNew') {
        buildReadingsSection(body, hasReadings ? event.readings : null, decreeId, allLocales);
    }

    card.appendChild(buildCardFooter(decreeDate, protocol, metadata));
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
            // Fetch names in the page UI locale so card names + translation-panel
            // labels agree (without this the browser's own Accept-Language drives
            // the response and the request-locale label can mismatch the value).
            fetchJson('GET', '/decrees', undefined, { 'Accept-Language': config.locale }, 'omit'),
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

    // GRC-live locales (primary-language form) — the minimum set seeded as
    // empty i18n/readings rows in the editor. Falls back to the request locale.
    grcLiveLocales = [...new Set((metadataLocales ?? [requestLocale]).map(primaryLang))];

    // Aggregate known Vatican URL codes per language for the code datalists.
    // Rebuilt on every load, so a code saved in a prior write shows up here.
    urlCodeSuggestions = aggregateUrlCodeSuggestions(decrees);
    rebuildUrlCodeDatalists();

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
 * GRC-live locales (primary-language form, e.g. ['en','fr','it','la','nl']),
 * captured from /calendars metadata by loadDecrees. Seeded as the minimum set
 * of i18n/readings rows in the editor.
 *
 * @type {string[]}
 */
let grcLiveLocales = [];

/**
 * Primary language subtag of a locale, lowercased (e.g. 'en-US' → 'en').
 *
 * @param {string} locale
 * @returns {string}
 */
function primaryLang(locale) {
    return String(locale).split(/[-_]/)[0].toLowerCase();
}

/**
 * Map of decree_id → full decree object, populated by loadDecrees.
 * Used by the edit button to pre-fill the editor modal without an extra fetch.
 *
 * @type {Map<string, object>}
 */
const decreeMap = new Map();

/**
 * Known Vatican URL codes per ISO 639-1 language, aggregated from the current
 * decrees' url_lang_map values. Powers the per-language datalist on the code
 * field so authors can reuse existing codes without being constrained to them;
 * a newly-saved code appears here after the list reloads.
 *
 * @type {Record<string, string[]>}
 */
let urlCodeSuggestions = {};

/**
 * Aggregate the distinct Vatican URL codes used for each ISO 639-1 language
 * across a decree list's url_lang_map entries.
 *
 * @param {object[]} decrees  Decrees from GET /decrees
 * @returns {Record<string, string[]>}  iso → sorted distinct codes
 */
export function aggregateUrlCodeSuggestions(decrees) {
    /** @type {Record<string, Set<string>>} */
    const sets = {};
    decrees.forEach((decree) => {
        const map = decree && decree.metadata && decree.metadata.url_lang_map;
        if (!map || typeof map !== 'object') return;
        Object.entries(map).forEach(([iso, code]) => {
            if (typeof code !== 'string' || code === '') return;
            (sets[iso] ??= new Set()).add(code);
        });
    });
    /** @type {Record<string, string[]>} */
    const out = {};
    Object.entries(sets).forEach(([iso, codes]) => {
        out[iso] = [...codes].sort();
    });
    return out;
}

/**
 * Rebuild the hidden per-language <datalist> elements (#urlCodes-{iso}) from
 * urlCodeSuggestions so the url_lang_map code inputs can suggest existing codes.
 */
function rebuildUrlCodeDatalists() {
    const host = document.getElementById('urlCodeDatalists');
    if (!host) return;
    host.replaceChildren();
    Object.entries(urlCodeSuggestions).forEach(([iso, codes]) => {
        if (!/^[a-z]{2}$/.test(iso)) return;
        const dl = document.createElement('datalist');
        dl.id = `urlCodes-${iso}`;
        codes.forEach((code) => {
            const opt = document.createElement('option');
            opt.value = code;
            dl.appendChild(opt);
        });
        host.appendChild(dl);
    });
}

/**
 * Build a locale field (datalist-backed text input) for an i18n / readings row.
 * Bound to #isoLangDatalist so any ISO 639-1 language is selectable — decree
 * translations are not restricted to the General Roman Calendar's live locales.
 *
 * @param {string} [selected]  Pre-filled locale value
 * @returns {HTMLInputElement}
 */
function buildLocaleField(selected) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control form-control-sm';
    input.name = 'i18n_locale[]';
    input.setAttribute('list', 'isoLangDatalist');
    input.setAttribute('autocomplete', 'off');
    input.placeholder = config.i18n.selectLocale;
    if (selected) input.value = selected;
    return input;
}

/**
 * Add an i18n row (locale + name) to #i18nRows.
 *
 * @param {HTMLElement} container  #i18nRows
 * @param {string}      [locale]   Pre-filled locale
 * @param {string}      [name]     Pre-filled name
 */
function addI18nRow(container, locale, name) {
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2 i18n-row';

    const localCol = document.createElement('div');
    localCol.className = 'col-md-3';
    const locSel = buildLocaleField(locale);
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

// ---- derived decree_id + URL language-code map ----------------------------

/**
 * Recompute the derived decree_id ({event_key}_{suffix}) and mirror it into
 * both the hidden `decree_id` field and the visible hint. No-op unless the
 * form is in create mode — on edit, the decree_id is fixed to the existing
 * value (see prefillDecreeFields) and must not be re-derived.
 *
 * @param {HTMLFormElement} form
 */
function syncDerivedDecreeId(form) {
    if (form.dataset.mode !== 'create') return;
    const eventKey = form.querySelector('[name="event_key"]')?.value.trim() ?? '';
    const action   = form.querySelector('[name="action"]')?.value ?? '';
    const id = deriveDecreeId(eventKey, action);
    const hidden = form.querySelector('[name="decree_id"]');
    if (hidden) hidden.value = id;
    const hint = document.getElementById('decreeIdHint');
    if (hint) hint.textContent = id || '—';
}

/**
 * Re-render the live URL preview: each url_lang_map row expands the `%s`
 * placeholder in the source URL to its Vatican code. Skipped entirely when
 * the URL has no `%s`.
 *
 * @param {HTMLFormElement} form
 */
function updateUrlPreview(form) {
    const preview = document.getElementById('urlLangMapPreview');
    if (!preview) return;
    preview.replaceChildren();
    const urlEl = form.querySelector('[name="url"]');
    const url = urlEl ? urlEl.value.trim() : '';
    if (!url.includes('%s')) return;
    form.querySelectorAll('.url-lang-row').forEach((row) => {
        const iso = row.querySelector('[name="url_lang_iso[]"]')?.value.trim();
        const code = row.querySelector('[name="url_lang_code[]"]')?.value.trim();
        if (!iso || !code) return;
        const li = document.createElement('li');
        const isoSpan = document.createElement('span');
        isoSpan.className = 'text-muted me-1';
        isoSpan.textContent = `${iso}:`;
        li.appendChild(isoSpan);
        li.appendChild(document.createTextNode(url.replace(/%s/g, code)));
        preview.appendChild(li);
    });
}

/**
 * Add a url_lang_map row (ISO 639-1 language ▸ Vatican URL code) to
 * #urlLangMapRows and wire preview refresh + removal.
 *
 * The language field is a datalist-backed text input (#isoLangDatalist,
 * rendered server-side with every ISO 639-1 code labelled in the UI locale),
 * so any two-letter code is selectable — searchable by code or by name —
 * independent of the GRC-supported locale set.
 *
 * @param {HTMLElement} container  #urlLangMapRows
 * @param {string}      [iso]      Pre-filled ISO 639-1 code
 * @param {string}      [code]     Pre-filled Vatican code
 */
export function addUrlLangRow(container, iso, code) {
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2 url-lang-row align-items-center';

    const isoCol = document.createElement('div');
    isoCol.className = 'col-md-4';
    const isoInput = document.createElement('input');
    isoInput.type = 'text';
    isoInput.className = 'form-control form-control-sm';
    isoInput.name = 'url_lang_iso[]';
    isoInput.setAttribute('list', 'isoLangDatalist');
    isoInput.setAttribute('autocomplete', 'off');
    isoInput.placeholder = config.i18n.selectLocale;
    if (iso) isoInput.value = iso;
    isoCol.appendChild(isoInput);

    const arrowCol = document.createElement('div');
    arrowCol.className = 'col-auto text-muted';
    const arrow = document.createElement('i');
    arrow.className = 'fas fa-arrow-right';
    arrowCol.appendChild(arrow);

    const codeCol = document.createElement('div');
    codeCol.className = 'col';
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'form-control form-control-sm';
    codeInput.name = 'url_lang_code[]';
    codeInput.setAttribute('autocomplete', 'off');
    codeInput.placeholder = config.i18n.langCodeVatican;
    if (code) codeInput.value = code;
    codeCol.appendChild(codeInput);

    // Point the code field at the per-language datalist (#urlCodes-{iso}) of
    // historically-used Vatican codes, refreshed as the language changes.
    const syncCodeList = () => {
        const key = isoInput.value.trim().toLowerCase();
        if (/^[a-z]{2}$/.test(key) && document.getElementById(`urlCodes-${key}`)) {
            codeInput.setAttribute('list', `urlCodes-${key}`);
        } else {
            codeInput.removeAttribute('list');
        }
    };
    syncCodeList();

    const rmCol = document.createElement('div');
    rmCol.className = 'col-auto';
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'btn btn-sm btn-outline-danger';
    rmBtn.title = config.i18n.removeRow;
    const rmIcon = document.createElement('i');
    rmIcon.className = 'fas fa-times';
    rmBtn.appendChild(rmIcon);
    rmCol.appendChild(rmBtn);

    row.appendChild(isoCol);
    row.appendChild(arrowCol);
    row.appendChild(codeCol);
    row.appendChild(rmCol);
    container.appendChild(row);

    const form = container.closest('form');
    const refresh = () => { if (form) updateUrlPreview(form); };
    isoInput.addEventListener('input', () => { syncCodeList(); refresh(); });
    codeInput.addEventListener('input', refresh);
    rmBtn.addEventListener('click', () => { row.remove(); refresh(); });
}

/**
 * Build a readings group (per-locale) and append it to #readingsGroups.
 *
 * @param {HTMLElement} container  #readingsGroups
 * @param {string}      [locale]   Pre-filled locale
 */
function addReadingsGroup(container, locale) {
    const group = document.createElement('div');
    group.className = 'border rounded p-3 mb-3 readings-group';

    // Locale field header row
    const headerRow = document.createElement('div');
    headerRow.className = 'row g-2 mb-3 align-items-center';

    const locCol = document.createElement('div');
    locCol.className = 'col-md-4';
    const locSel = buildLocaleField(locale);
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
/**
 * Detect duplicate ISO codes among the url_lang_map rows (only when the
 * multilingual switch is on). collectFormValues keys url_lang_map by ISO, so a
 * repeated ISO would silently overwrite the earlier row's Vatican code; surface
 * it as a blocking validation error instead.
 *
 * @param {HTMLElement} root  The form (or a wrapper)
 * @returns {string[]}  one error message per duplicated ISO code
 */
export function findUrlLangDuplicateErrors(root) {
    const multilangEl = root.querySelector('[name="url_multilang"]');
    if (!multilangEl || !multilangEl.checked) return [];
    const seen  = new Set();
    const dupes = new Set();
    root.querySelectorAll('.url-lang-row').forEach((row) => {
        const isoEl = row.querySelector('[name="url_lang_iso[]"]');
        const iso   = isoEl ? isoEl.value.trim().toLowerCase() : '';
        if (!/^[a-z]{2}$/.test(iso)) return;
        if (seen.has(iso)) {
            dupes.add(iso);
        } else {
            seen.add(iso);
        }
    });
    return [...dupes].map(
        (iso) => `Duplicate language code "${iso}" in the source URL languages — each language may appear only once`
    );
}

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

    // url_lang_map: only when the multilingual switch is on. Each row maps an
    // ISO 639-1 code to a Vatican URL code; blank rows are ignored.
    const urlLangMap = {};
    const multilangEl = root.querySelector('[name="url_multilang"]');
    if (multilangEl && multilangEl.checked) {
        root.querySelectorAll('.url-lang-row').forEach((row) => {
            const isoEl = row.querySelector('[name="url_lang_iso[]"]');
            const codeEl = row.querySelector('[name="url_lang_code[]"]');
            const iso = isoEl ? isoEl.value.trim().toLowerCase() : '';
            const code = codeEl ? codeEl.value.trim() : '';
            // Keep only valid two-letter ISO 639-1 keys (matches the API schema);
            // free-typed text that never resolved to a code is dropped.
            if (/^[a-z]{2}$/.test(iso) && code) urlLangMap[iso] = code;
        });
    }

    return {
        action,
        decree_id:       val('decree_id'),
        decree_date:     val('decree_date'),
        decree_protocol: val('decree_protocol'),
        description:     val('description'),
        event_key:       val('event_key'),
        since_year:      val('since_year'),
        url:             val('url'),
        url_lang_map:    Object.keys(urlLangMap).length > 0 ? urlLangMap : undefined,
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
 * rejects it with 400). In edit mode event_key and action are shown as static
 * hints, not editable fields (see prefillDecreeFields / showDecreeIdentityStatic),
 * so the immutable values cannot be changed accidentally.
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
 * Reset the editor form to a clean state: clears the form, alerts, modal
 * title, base-locale option, extra i18n rows, and readings groups.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLElement}     alertBox
 * @param {HTMLElement|null} label
 * @param {boolean}         isCreate
 * @param {string}          baseLocale
 */
function resetEditorForm(form, alertBox, label, isCreate, baseLocale) {
    form.reset();
    alertBox.replaceChildren();

    if (label) {
        label.textContent = isCreate ? config.i18n.newDecree : config.i18n.editDecree;
    }

    // Set base locale option value and text on the disabled select
    const baseLocaleOpt = document.getElementById('i18nBaseLocaleOption');
    if (baseLocaleOpt) {
        baseLocaleOpt.value       = baseLocale;
        baseLocaleOpt.textContent = baseLocale;
    }

    // Clear dynamic i18n rows (keep only base row)
    const i18nRows = document.getElementById('i18nRows');
    if (i18nRows) {
        i18nRows.querySelectorAll('.i18n-row:not([data-base-row="true"])').forEach((r) => r.remove());
    }

    // Clear readings groups
    const readingsGroups = document.getElementById('readingsGroups');
    if (readingsGroups) {
        readingsGroups.replaceChildren();
    }

    // Reset the derived decree_id hint
    const idHint = document.getElementById('decreeIdHint');
    if (idHint) idHint.textContent = '—';

    // Reset the URL multilingual switch, its rows, and the preview
    const multilangEl = document.getElementById('decreeUrlMultilang');
    if (multilangEl) multilangEl.checked = false;
    const urlLangBlock = document.getElementById('urlLangMapBlock');
    if (urlLangBlock) urlLangBlock.classList.add('d-none');
    const urlLangRows = document.getElementById('urlLangMapRows');
    if (urlLangRows) urlLangRows.replaceChildren();
    const urlLangPreview = document.getElementById('urlLangMapPreview');
    if (urlLangPreview) urlLangPreview.replaceChildren();

    // Default to editable identity fields (create mode); edit mode swaps to static
    showDecreeIdentityFields(form);
}

/**
 * Show event_key and action as editable form controls (create mode): reveal
 * the input/select and hide the static hints.
 *
 * @param {HTMLFormElement} form
 */
function showDecreeIdentityFields(form) {
    const ekInput  = form.querySelector('#decreeEventKey');
    const ekStatic = document.getElementById('decreeEventKeyStatic');
    const actSel   = form.querySelector('#decreeAction');
    const actStat  = document.getElementById('decreeActionStatic');
    if (ekInput)  { ekInput.classList.remove('d-none'); ekInput.readOnly = false; }
    if (ekStatic) { ekStatic.textContent = ''; ekStatic.classList.add('d-none'); }
    if (actSel)   { actSel.classList.remove('d-none'); actSel.disabled = false; }
    if (actStat)  { actStat.textContent = ''; actStat.classList.add('d-none'); }
}

/**
 * Show event_key and action as static text hints (edit mode): hide the
 * input/select and reveal the static hints. The input/select keep their
 * name and value so collectFormValues still reads them for the PATCH.
 *
 * @param {HTMLFormElement} form
 * @param {string}          eventKey     The immutable event_key
 * @param {string}          actionLabel  The action's localized display label
 */
function showDecreeIdentityStatic(form, eventKey, actionLabel) {
    const ekInput  = form.querySelector('#decreeEventKey');
    const ekStatic = document.getElementById('decreeEventKeyStatic');
    const actSel   = form.querySelector('#decreeAction');
    const actStat  = document.getElementById('decreeActionStatic');
    if (ekInput)  ekInput.classList.add('d-none');
    if (ekStatic) { ekStatic.textContent = eventKey || '—'; ekStatic.classList.remove('d-none'); }
    if (actSel)   actSel.classList.add('d-none');
    if (actStat)  { actStat.textContent = actionLabel || '—'; actStat.classList.remove('d-none'); }
}

/**
 * Fill in readings groups inside the editor from a readings object.
 * Handles both flat (GET response) and locale-keyed (write round-trip) shapes.
 *
 * @param {HTMLElement}       readingsGroups  The #readingsGroups container
 * @param {object}            readings        The event.readings object
 * @param {string[]}          locales         Available locales
 * @param {string}            baseLocale      Base locale for flat shape
 */
export function prefillReadingsGroups(readingsGroups, readings, baseLocale, grcLive = grcLiveLocales) {
    const fillGroupFields = (group, localeReadings) => {
        const fillField = (name, value) => {
            const inp = group.querySelector(`[name="${name}"]`);
            if (inp && value) inp.value = value;
        };
        fillField('first_reading[]',      localeReadings.first_reading);
        fillField('responsorial_psalm[]', localeReadings.responsorial_psalm);
        fillField('second_reading[]',     localeReadings.second_reading);
        fillField('gospel_acclamation[]', localeReadings.gospel_acclamation);
        fillField('gospel[]',             localeReadings.gospel);
    };

    // Normalize a flat (single-locale) readings object to a locale-keyed map.
    const src = readings && typeof readings === 'object' ? readings : {};
    const isFlat = 'first_reading' in src || 'responsorial_psalm' in src
                   || 'gospel_acclamation' in src || 'gospel' in src;
    const map = isFlat ? { [baseLocale]: src } : src;

    // Seed a group for every GRC-live locale (the minimum) plus every locale
    // that actually has readings, base locale first, the rest sorted.
    const others = new Set([...grcLive, ...Object.keys(map)]);
    others.delete(baseLocale);
    const ordered = [baseLocale, ...[...others].sort()];
    ordered.forEach((locale) => {
        addReadingsGroup(readingsGroups, locale);
        const groups = readingsGroups.querySelectorAll('.readings-group');
        const group  = groups[groups.length - 1];
        const r      = map[locale];
        if (group && r && typeof r === 'object') fillGroupFields(group, r);
    });
}

/**
 * Pre-fill the i18n rows: set the base-locale row and add one row per other
 * locale in the GRC-live minimum set unioned with every locale that has a
 * defined translation. Empty rows are seeded for locales without a translation.
 *
 * @param {Record<string,string>|null|undefined} i18nMap  locale → name
 * @param {string}                               baseLocale
 * @param {string}                               [fallbackName]  base-locale name when i18nMap lacks it
 */
export function prefillI18nRows(i18nMap, baseLocale, fallbackName, grcLive = grcLiveLocales) {
    const i18nRows = document.getElementById('i18nRows');
    if (!i18nRows) return;
    const map = (i18nMap && typeof i18nMap === 'object') ? i18nMap : {};

    const baseNameInput = i18nRows.querySelector('.i18n-row[data-base-row="true"] [name="i18n_name[]"]');
    if (baseNameInput) {
        const baseName = typeof map[baseLocale] === 'string' ? map[baseLocale] : '';
        baseNameInput.value = baseName || fallbackName || '';
    }

    const others = new Set([...grcLive, ...Object.keys(map)]);
    others.delete(baseLocale);
    [...others].sort().forEach((locale) => {
        addI18nRow(i18nRows, locale, typeof map[locale] === 'string' ? map[locale] : '');
    });
}

/**
 * Pre-fill the decree-level fields of the editor form (decree_id, event_key
 * readonly state, date, protocol, description, and metadata action/since_year/url).
 *
 * @param {HTMLFormElement} form
 * @param {object}          decree
 * @param {Function}        setVal  `(name, value) => void` helper bound to `form`
 */
function prefillDecreeFields(form, decree, setVal) {
    // decree_id is a hidden field + hint. On edit it is pinned to the existing
    // value (the PATCH path param) and is never re-derived from event_key/action.
    const decreeIdEl = form.querySelector('[name="decree_id"]');
    if (decreeIdEl) decreeIdEl.value = decree.decree_id ?? '';
    const idHint = document.getElementById('decreeIdHint');
    if (idHint) idHint.textContent = decree.decree_id || '—';

    // event_key is immutable on edit (PATCH must NOT change it; the API rejects
    // with 400 and instructs DELETE + PUT instead). Keep its value in the input
    // for the payload, but display it as a static hint rather than a field.
    const eventKey = (decree.liturgical_event && decree.liturgical_event.event_key)
        ? decree.liturgical_event.event_key
        : '';

    setVal('decree_date',     decree.decree_date);
    setVal('decree_protocol', decree.decree_protocol);
    setVal('description',     decree.description);

    // Pre-select the action; it is immutable on edit (changing it would change
    // the derived decree_id, which a PATCH cannot do). Shown as a static hint.
    let actionLabel = '';
    const meta = decree.metadata;
    if (meta) {
        const actionValue = reverseMapAction(meta.action, meta.property);
        const actionEl = form.querySelector('[name="action"]');
        if (actionEl) {
            actionEl.value = actionValue;
            const selected = actionEl.selectedOptions && actionEl.selectedOptions[0];
            actionLabel = selected ? selected.textContent.trim() : actionValue;
        }
        if (meta.since_year) setVal('since_year', meta.since_year);
        if (meta.url)        setVal('url',        meta.url);
    }

    showDecreeIdentityStatic(form, eventKey, actionLabel);
}

/**
 * Pre-fill the URL multilingual switch and url_lang_map rows from a decree.
 * Activated when the decree carries a url_lang_map (or its URL contains `%s`).
 *
 * @param {HTMLFormElement} form
 * @param {object}          decree
 */
function prefillUrlLangMap(form, decree) {
    const meta = decree.metadata || {};
    const langMap = (meta.url_lang_map && typeof meta.url_lang_map === 'object')
        ? meta.url_lang_map
        : null;
    const hasPlaceholder = typeof meta.url === 'string' && meta.url.includes('%s');
    if (!langMap && !hasPlaceholder) return;

    const toggle = document.getElementById('decreeUrlMultilang');
    const block  = document.getElementById('urlLangMapBlock');
    const rows   = document.getElementById('urlLangMapRows');
    if (toggle) toggle.checked = true;
    if (block)  block.classList.remove('d-none');
    if (rows) {
        rows.replaceChildren();
        if (langMap) {
            Object.entries(langMap).forEach(([iso, code]) => addUrlLangRow(rows, iso, code));
        }
    }
    updateUrlPreview(form);
}

/**
 * Pre-fill the liturgical-event fields of the editor form (event_key value,
 * grade/grade_set, color multi-select, day/month, strtotime with JSON round-trip,
 * event_type radio, and common_text).
 *
 * @param {HTMLFormElement} form
 * @param {object}          ev     `decree.liturgical_event`
 * @param {Function}        setVal `(name, value) => void` helper bound to `form`
 */
function prefillEventFields(form, ev, setVal) {
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
    if (ev.day !== undefined)   setVal('day',   ev.day);
    if (ev.month !== undefined) setVal('month', ev.month);

    // Pre-fill strtotime (mobile events); objects are round-tripped via JSON
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
}

/**
 * Pre-fill the editor form from an existing decree object. When the decree
 * carries aggregated i18n/readings maps (from the enriched single-decree GET),
 * every defined translation and readings locale is prefilled; otherwise it
 * falls back to the single request-locale name/readings.
 *
 * @param {HTMLFormElement} form
 * @param {object}          decree
 * @param {string}          baseLocale
 */
function prefillFromDecree(form, decree, baseLocale) {
    const setVal = (name, value) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el && value !== undefined && value !== null) el.value = value;
    };

    prefillDecreeFields(form, decree, setVal);
    prefillUrlLangMap(form, decree);

    const ev = decree.liturgical_event;
    if (ev) {
        prefillEventFields(form, ev, setVal);
    }

    // i18n rows: prefer the aggregated map, fall back to the single event name.
    prefillI18nRows(decree.i18n, baseLocale, ev ? ev.name : '');

    // Readings groups: prefer the aggregated readings map, fall back to the
    // single request-locale flat readings on liturgical_event.
    const readingsGroups = document.getElementById('readingsGroups');
    if (readingsGroups) {
        const readingsSource = (decree.readings && typeof decree.readings === 'object')
            ? decree.readings
            : ( ev && ev.readings && typeof ev.readings === 'object' ? ev.readings : {} );
        prefillReadingsGroups(readingsGroups, readingsSource, baseLocale);
    }
}

/**
 * Wire button event handlers for the editor modal: fixed/mobile toggle,
 * add i18n row, add readings group, and save.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLElement|null} saveBtn
 * @param {HTMLElement}      alertBox
 * @param {string}           baseLocale
 * @param {boolean}          isCreate
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 */
function wireEditorActions(form, saveBtn, alertBox, baseLocale, isCreate, capabilities) {
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
    const checkedRadio = form.querySelector('[name="event_type"]:checked');
    syncDateType(checkedRadio ? checkedRadio.value : 'fixed');

    // Add i18n row button (clone to remove old listeners)
    const addI18nBtn = document.getElementById('addI18nRow');
    if (addI18nBtn) {
        const newBtn = addI18nBtn.cloneNode(true);
        addI18nBtn.parentNode.replaceChild(newBtn, addI18nBtn);
        newBtn.addEventListener('click', () => {
            const rows = document.getElementById('i18nRows');
            if (rows) addI18nRow(rows);
        });
    }

    // Add readings group button (clone to remove old listeners)
    const addReadingsBtn = document.getElementById('addReadingsGroup');
    if (addReadingsBtn) {
        const newBtn = addReadingsBtn.cloneNode(true);
        addReadingsBtn.parentNode.replaceChild(newBtn, addReadingsBtn);
        newBtn.addEventListener('click', () => {
            const groups = document.getElementById('readingsGroups');
            if (groups) addReadingsGroup(groups);
        });
    }

    // URL multilingual switch (clone to remove old listeners). Reveals the
    // url_lang_map editor and seeds a first empty row when turned on.
    const multilangToggle = document.getElementById('decreeUrlMultilang');
    if (multilangToggle) {
        const newToggle = multilangToggle.cloneNode(true);
        multilangToggle.parentNode.replaceChild(newToggle, multilangToggle);
        newToggle.addEventListener('change', () => {
            const block = document.getElementById('urlLangMapBlock');
            const rows  = document.getElementById('urlLangMapRows');
            if (block) block.classList.toggle('d-none', !newToggle.checked);
            if (newToggle.checked && rows && rows.children.length === 0) {
                addUrlLangRow(rows);
            }
            updateUrlPreview(form);
        });
    }

    // Add url_lang_map row button (clone to remove old listeners)
    const addUrlLangBtn = document.getElementById('addUrlLangRow');
    if (addUrlLangBtn) {
        const newBtn = addUrlLangBtn.cloneNode(true);
        addUrlLangBtn.parentNode.replaceChild(newBtn, addUrlLangBtn);
        newBtn.addEventListener('click', () => {
            const rows = document.getElementById('urlLangMapRows');
            if (rows) addUrlLangRow(rows);
        });
    }

    // Refresh the URL preview when the source URL itself changes
    const urlInput = form.querySelector('[name="url"]');
    if (urlInput) {
        const newUrlInput = urlInput.cloneNode(true);
        urlInput.parentNode.replaceChild(newUrlInput, urlInput);
        newUrlInput.addEventListener('input', () => updateUrlPreview(form));
    }

    // Keep the derived decree_id hint in sync as the event_key changes.
    // (The action <select> is handled by the persistent listener wired at
    // startup — see the DOMContentLoaded handler.) `oninput` assignment
    // replaces rather than stacks, so re-opening the modal is safe.
    const eventKeyInput = form.querySelector('[name="event_key"]');
    if (eventKeyInput) {
        eventKeyInput.oninput = () => syncDerivedDecreeId(form);
    }

    // Wire save button (clone to remove old listeners)
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', async () => {
            newSaveBtn.disabled = true;
            try {
                alertBox.replaceChildren();
                const formValues = collectFormValues(form);
                const payload    = buildDecreePayload(formValues);
                // Duplicate url_lang_map ISO rows collapse silently in
                // collectFormValues (later overwrites earlier), so surface them
                // as a blocking validation error before submission.
                const errors     = [
                    ...findUrlLangDuplicateErrors(form),
                    ...validateDecreePayload(payload, baseLocale, isCreate),
                ];

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
}

/**
 * Open the editor modal for create or edit.
 *
 * @param {object|null} decree       Existing decree object (null for create)
 * @param {string[]}    locales      Available locales for i18n/readings selects
 * @param {{canView: boolean, canEdit: boolean, canAdmin: boolean}} capabilities
 */
async function openEditorModal(decree, capabilities) {
    const modal    = document.getElementById('decreeEditorModal');
    const form     = document.getElementById('decreeEditorForm');
    const alertBox = document.getElementById('decreeEditorAlerts');
    const label    = document.getElementById('decreeEditorModalLabel');
    const saveBtn  = document.getElementById('saveDecreeBtn');
    const isCreate = !decree;

    if (!modal || !form || !alertBox) return;

    const baseLocale = config.locale.split('-')[0].toLowerCase();

    resetEditorForm(form, alertBox, label, isCreate, baseLocale);

    // Mode gates the derived-id sync: only create mode re-derives decree_id.
    form.dataset.mode = isCreate ? 'create' : 'edit';

    if (decree) {
        // Fetch the enriched decree (all translations + readings across locales)
        // so every defined translation can be prefilled. Fall back to the cached
        // list entry (single request-locale name) if the fetch fails or an older
        // API returns no i18n/readings maps.
        let full = decree;
        try {
            const fetched = await fetchJson(
                'GET',
                `/decrees/${encodeURIComponent(decree.decree_id)}`,
                undefined,
                { 'Accept-Language': config.locale },
                'omit'
            );
            if (fetched && typeof fetched === 'object') full = fetched;
        } catch {
            // keep the cached decree
        }
        prefillFromDecree(form, full, baseLocale);
    } else {
        // Creating: event_key and action are editable fields (both feed the
        // derived decree_id); resetEditorForm already restored the field view.
        // Initialize the derived-id hint (empty event_key → placeholder).
        syncDerivedDecreeId(form);

        // Seed the GRC-live minimum: empty i18n rows and readings groups.
        prefillI18nRows(null, baseLocale, '');
        const readingsGroups = document.getElementById('readingsGroups');
        if (readingsGroups) prefillReadingsGroups(readingsGroups, {}, baseLocale);
    }

    wireEditorActions(form, saveBtn, alertBox, baseLocale, isCreate, capabilities);

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

    // Wire action-change visibility toggling + derived decree_id sync
    if (form) {
        const actionEl = form.querySelector('[name="action"]');
        if (actionEl) {
            actionEl.addEventListener('change', () => {
                applyActionVisibility(actionEl.value, form);
                syncDerivedDecreeId(form);
            });
        }
    }

    const capabilities = await capabilitiesPromise;

    // No-access guard
    if (!capabilities.canView) {
        showAlert(container, 'warning', config.i18n.noAccess);
        return;
    }

    // Permissions are resource-level: one page-level manage link for FGA admins
    const permsLink = document.getElementById('lnkManagePermissions');
    if (capabilities.canAdmin && permsLink) {
        permsLink.classList.remove('d-none');
    }

    // Show create button for editors
    if (capabilities.canEdit && createBtn) {
        createBtn.classList.remove('d-none');
        createBtn.addEventListener('click', () => {
            openEditorModal(null, capabilities);
        });
    }

    // Wire edit buttons via event delegation on the container
    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit"]');
        if (editBtn && capabilities.canEdit) {
            const decreeId = editBtn.getAttribute('data-decree-id');
            const decree   = decreeMap.get(decreeId) ?? { decree_id: decreeId };
            openEditorModal(decree, capabilities);
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
