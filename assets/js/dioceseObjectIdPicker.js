/**
 * Diocese picker for the `diocesan_calendar` permission scope.
 *
 * A `CalendarSelect` filtered to diocesan calendars lists only the dioceses
 * whose calendar already exists, so a diocesan liturgy office could never
 * request (or be granted) the `admin` access it needs to CREATE its diocese's
 * calendar (issue #563; #562 did the same for the national scope).
 *
 * But not every diocese may be offered: a diocesan calendar can only be
 * created once the national calendar it depends on exists (extending.php's
 * "Depends on national calendar" lists only those). So for the Roman rite the
 * picker is two steps — a nation that already has a national calendar, then
 * one of its dioceses, split into the calendars that exist and those still to
 * be created. When a national calendar is created later, its dioceses become
 * requestable on their own, because the nations come from live metadata.
 *
 * The Ambrosian rite has no national tier and no list of prospective
 * dioceses, so under it the nation step is hidden and only its existing
 * diocesan calendars are offered.
 *
 * Option values are bare diocese ids (`albany_us`), as the CalendarSelect's
 * were, so `qualifyObjectId()` and the restore paths treat both alike.
 *
 * Used by permission-requests.js and admin-permissions.js.
 */

/** The permission scope this picker serves. */
export const DIOCESAN_CALENDAR_TYPE = 'diocesan_calendar';

/** The rite whose dioceses have a national tier and a list of prospective dioceses. */
const ROMAN_RITE = 'roman';

/** The Vatican has a national calendar but no dioceses to offer (as in extending.php). */
const NATIONS_WITHOUT_DIOCESES = new Set(['VA']);

/** The Latin-rite dioceses of the world, by nation: the list extending.php and the API validate against. */
export const WORLD_DIOCESES_URL = 'assets/data/WorldDiocesesByNation.json';

/**
 * @typedef {object} Diocese
 * @property {string} id - Diocese id, e.g. `albany_us`
 * @property {string} name - Display name
 */

/**
 * Index the WorldDiocesesByNation data by nation.
 * @param {object} json - The parsed WorldDiocesesByNation.json
 * @returns {Map<string, Diocese[]>} Upper-case ISO 3166-1 alpha-2 code => its dioceses
 */
export function diocesesByNation(json) {
    const byNation = new Map();
    for (const entry of json?.catholic_dioceses_latin_rite ?? []) {
        if (typeof entry?.country_iso !== 'string' || !Array.isArray(entry.dioceses)) continue;
        const dioceses = entry.dioceses
            .filter(d => typeof d?.diocese_id === 'string' && typeof d?.diocese_name === 'string')
            .map(d => ({ id: d.diocese_id, name: d.diocese_name }));
        byNation.set(entry.country_iso.toUpperCase(), dioceses);
    }
    return byNation;
}

let worldDioceses = null;

/**
 * The world's dioceses by nation, fetched once per page.
 *
 * Only the "not yet created" group depends on it, so a failed fetch resolves to
 * null rather than rejecting: the picker still offers the existing calendars, says
 * the rest could not be loaded, and can call this again to retry.
 * @param {typeof fetch} [fetchImpl] - For tests
 * @returns {Promise<Map<string, Diocese[]>|null>} See diocesesByNation(); null when it failed
 */
export function loadWorldDioceses(fetchImpl = globalThis.fetch) {
    worldDioceses ??= fetchImpl(WORLD_DIOCESES_URL, { headers: { Accept: 'application/json' } })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(diocesesByNation)
        .catch(err => {
            console.error('[dioceseObjectIdPicker] Could not load the list of dioceses:', err);
            worldDioceses = null; // let a retry, or a later mount, try again
            return null;
        });
    return worldDioceses;
}

/**
 * @param {string} code - ISO 3166-1 alpha-2 code
 * @param {string} locale - UI locale
 * @returns {string} The nation's display name, else the bare code
 */
function nationName(code, locale) {
    try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
        return code;
    }
}

/**
 * @param {string} value - Option value
 * @param {string} text - Option text
 * @returns {HTMLOptionElement} The option
 */
function option(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
}

/**
 * @param {string} text - Placeholder text
 * @returns {HTMLOptionElement} A disabled, selected empty option
 */
function placeholder(text) {
    const o = option('', text);
    o.disabled = true;
    o.selected = true;
    return o;
}

/**
 * @param {string} label - Group label
 * @param {Diocese[]} dioceses - Its dioceses
 * @returns {HTMLOptGroupElement} The group
 */
function group(label, dioceses) {
    const g = document.createElement('optgroup');
    g.label = label;
    for (const d of dioceses) g.appendChild(option(d.id, d.name));
    return g;
}

/**
 * The existing diocesan calendars of a rite, from `/calendars` metadata.
 * @param {object} metadata - `litcal_metadata`
 * @param {string} rite - e.g. `roman`
 * @returns {Array<Diocese & {nation: string}>} Its calendars
 */
function existingDiocesanCalendars(metadata, rite) {
    return (metadata?.diocesan_calendars ?? [])
        .filter(c => (c.rite ?? ROMAN_RITE) === rite && typeof c.calendar_id === 'string')
        .map(c => ({ id: c.calendar_id, name: c.diocese || c.calendar_id, nation: String(c.nation ?? '').toUpperCase() }));
}

/**
 * The nations whose dioceses may be offered: those with a national calendar, and
 * with dioceses to offer (a listed one, or an existing Roman diocesan calendar).
 * @param {object} metadata - `litcal_metadata`
 * @param {Map<string, Diocese[]>} dioceses - See diocesesByNation()
 * @param {string} locale - UI locale
 * @returns {Array<[string, string]>} `[code, name]`, sorted by name
 */
export function nationsWithDioceses(metadata, dioceses, locale) {
    const withExisting = new Set(existingDiocesanCalendars(metadata, ROMAN_RITE).map(c => c.nation));
    const collator = new Intl.Collator(locale);
    return (metadata?.national_calendars_keys ?? [])
        .map(code => String(code).toUpperCase())
        .filter(code => !NATIONS_WITHOUT_DIOCESES.has(code))
        .filter(code => (dioceses.get(code)?.length ?? 0) > 0 || withExisting.has(code))
        .map(code => [code, nationName(code, locale)])
        .sort((a, b) => collator.compare(a[1], b[1]));
}

/**
 * A nation's dioceses, split into existing calendars and those not yet created.
 * @param {object} metadata - `litcal_metadata`
 * @param {Map<string, Diocese[]>} dioceses - See diocesesByNation()
 * @param {string} nation - ISO 3166-1 alpha-2 code
 * @param {string} locale - UI locale, for the collation
 * @returns {{existing: Diocese[], created: Diocese[]}} `created` holds those not yet created
 */
export function diocesesOfNation(metadata, dioceses, nation, locale) {
    const collator = new Intl.Collator(locale);
    const byName = (a, b) => collator.compare(a.name, b.name);
    const existing = existingDiocesanCalendars(metadata, ROMAN_RITE).filter(c => c.nation === nation);
    const existingIds = new Set(existing.map(c => c.id));
    return {
        existing: existing.map(({ id, name }) => ({ id, name })).sort(byName),
        created:  (dioceses.get(nation) ?? []).filter(d => !existingIds.has(d.id)).sort(byName)
    };
}

/**
 * The nation of a diocese id: from its existing calendar, else from the diocese
 * list, else from the id's own country suffix (`albany_us` => `US`).
 * @param {object} metadata - `litcal_metadata`
 * @param {Map<string, Diocese[]>} dioceses - See diocesesByNation()
 * @param {string} id - Diocese id
 * @returns {string} ISO 3166-1 alpha-2 code, or '' when none can be told
 */
export function nationOfDiocese(metadata, dioceses, id) {
    const calendar = (metadata?.diocesan_calendars ?? []).find(c => c.calendar_id === id);
    if (calendar?.nation) return String(calendar.nation).toUpperCase();
    for (const [nation, list] of dioceses) {
        if (list.some(d => d.id === id)) return nation;
    }
    const suffix = /_([a-z]{2})$/i.exec(id);
    return suffix ? suffix[1].toUpperCase() : '';
}

/**
 * @typedef {object} DiocesePickerOptions
 * @property {HTMLElement} mount - Where the picker goes; its content is replaced
 * @property {HTMLSelectElement} riteEl - The rite select (already in `mount`'s tree or not);
 *   it is kept as the first child, and its `change` repartitions the picker
 * @property {HTMLElement[]} [riteNodes] - The rite select with any label/wrapper it came with,
 *   placed first in `mount`; defaults to `[riteEl]`
 * @property {object} metadata - `litcal_metadata` from the ApiClient
 * @property {Map<string, Diocese[]>|null} dioceses - See diocesesByNation(); null when the list
 *   could not be loaded, in which case only existing calendars are offered, with a notice
 * @property {() => Promise<Map<string, Diocese[]>|null>} [loadDioceses] - Retries the load from
 *   that notice (see loadWorldDioceses()); without it the notice offers no retry
 * @property {{className: string, id?: string, label?: {text: string, className: string}}} nation
 *   - Attributes of the nation select, and its optional <label>
 * @property {{className: string, id?: string}} diocese - Attributes of the diocese select
 * @property {object} i18n - Labels
 * @property {string} i18n.selectNation - Placeholder of the nation select
 * @property {string} i18n.selectDiocese - Placeholder of the diocese select
 * @property {string} i18n.existingGroup - Label of the existing-calendars <optgroup>
 * @property {string} i18n.newGroup - Label of the not-yet-created <optgroup>
 * @property {string} i18n.diocesesUnavailable - Notice shown when the list could not be loaded
 * @property {string} i18n.retry - Label of the notice's retry button
 */

/**
 * @typedef {object} DiocesePicker
 * @property {HTMLSelectElement} nationEl - The nation select
 * @property {HTMLSelectElement} dioceseEl - The diocese select (the object id)
 * @property {(rite: string, id: string) => void} restore - Select a stored diocese, nation included
 */

/**
 * Mount the diocese picker.
 * @param {DiocesePickerOptions} opts - Options
 * @returns {DiocesePicker} The mounted picker
 */
export function mountDioceseObjectIdPicker({ mount, riteEl, riteNodes, metadata, dioceses, loadDioceses, locale, nation, diocese, i18n }) {
    let known = dioceses ?? new Map();
    let listMissing = dioceses === null;

    const nationEl = document.createElement('select');
    nationEl.className = nation.className;
    if (nation.id) nationEl.id = nation.id;

    const dioceseEl = document.createElement('select');
    dioceseEl.className = diocese.className;
    if (diocese.id) dioceseEl.id = diocese.id;
    dioceseEl.required = true;

    // The nation step, with its label, is one unit to show or hide.
    const nationWrapper = document.createElement('div');
    if (nation.label) {
        const label = document.createElement('label');
        label.className = nation.label.className;
        label.textContent = nation.label.text;
        if (nation.id) label.htmlFor = nation.id;
        nationWrapper.appendChild(label);
    }
    nationWrapper.appendChild(nationEl);

    // Shown while the list of prospective dioceses is missing: the existing
    // calendars are still offered, and the rest can be fetched again.
    const unavailable = document.createElement('div');
    unavailable.className = 'form-text text-warning dioceses-unavailable';
    unavailable.setAttribute('role', 'status');
    unavailable.append(i18n.diocesesUnavailable);
    let retryBtn = null;
    if (loadDioceses) {
        retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn btn-link btn-sm p-0 ms-1 align-baseline';
        retryBtn.textContent = i18n.retry;
        unavailable.append(retryBtn);
    }

    // Replace, not append: an earlier mount for an overlapping scope change
    // must not leave a second object-id control behind.
    mount.replaceChildren(...(riteNodes ?? [riteEl]), nationWrapper, dioceseEl, unavailable);

    const renderDioceses = () => {
        dioceseEl.replaceChildren(placeholder(i18n.selectDiocese));
        if (riteEl.value !== ROMAN_RITE) {
            for (const d of existingDiocesanCalendars(metadata, riteEl.value).sort((a, b) => a.name.localeCompare(b.name, locale))) {
                dioceseEl.appendChild(option(d.id, d.name));
            }
            dioceseEl.disabled = false;
            return;
        }
        if (!nationEl.value) {
            dioceseEl.disabled = true;
            return;
        }
        const { existing, created } = diocesesOfNation(metadata, known, nationEl.value, locale);
        if (existing.length > 0) dioceseEl.appendChild(group(i18n.existingGroup, existing));
        if (created.length > 0) dioceseEl.appendChild(group(i18n.newGroup, created));
        dioceseEl.disabled = false;
    };

    const renderNations = () => {
        const roman = riteEl.value === ROMAN_RITE;
        nationWrapper.hidden = !roman;
        // Only the Roman rite has prospective dioceses to miss.
        unavailable.hidden = !(roman && listMissing);
        nationEl.required = roman;
        nationEl.disabled = !roman;
        nationEl.replaceChildren(placeholder(i18n.selectNation));
        if (roman) {
            for (const [code, name] of nationsWithDioceses(metadata, known, locale)) {
                nationEl.appendChild(option(code, `${name} (${code})`));
            }
        }
        renderDioceses();
    };

    riteEl.addEventListener('change', renderNations);
    nationEl.addEventListener('change', renderDioceses);
    renderNations();

    retryBtn?.addEventListener('click', async () => {
        retryBtn.disabled = true;
        const loaded = await loadDioceses();
        retryBtn.disabled = false;
        if (loaded === null) return;
        // Rebuild with the full list, keeping what was already chosen.
        const [nationValue, dioceseValue] = [nationEl.value, dioceseEl.value];
        known = loaded;
        listMissing = false;
        renderNations();
        nationEl.value = nationValue;
        renderDioceses();
        dioceseEl.value = dioceseValue;
    });

    return {
        nationEl,
        dioceseEl,
        restore(rite, id) {
            if (rite && riteEl.value !== rite) {
                riteEl.value = rite;
                renderNations();
            }
            if (riteEl.value === ROMAN_RITE) {
                nationEl.value = nationOfDiocese(metadata, known, id);
                renderDioceses();
            }
            dioceseEl.value = id;
        }
    };
}
