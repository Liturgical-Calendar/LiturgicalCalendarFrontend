/**
 * Nation picker for the `national_calendar` permission scope.
 *
 * A `CalendarSelect` filtered to national calendars lists only the nations
 * whose calendar already exists, which made it impossible to request (or
 * grant) the `admin` access needed to CREATE one — the API accepts a
 * prospective nation for exactly that purpose (API #669). This picker offers
 * every nation that can have a calendar, split into the calendars that exist
 * and those still to be created, so the requester and the reviewer can both
 * see which kind of grant it is.
 *
 * Option values are bare ISO 3166-1 alpha-2 codes, as the CalendarSelect's
 * were, so `qualifyObjectId()` and the restore paths treat both alike.
 *
 * Used by permission-requests.js and admin-permissions.js.
 */

/**
 * @typedef {object} NationSelectOptions
 * @property {Object<string, string>} nations - Nation code => display name, in display order
 *   (the prospective nations; see src/CatholicNations.php)
 * @property {string[]|null} existingIds - Nation codes that already have a national calendar,
 *   or null when that is unknown (metadata failed to load); the list is then not grouped
 * @property {string} locale - UI locale, for naming an existing nation missing from `nations`
 * @property {string} className - Class attribute for the <select>
 * @property {string} [id] - Id attribute for the <select>
 * @property {object} i18n - Labels
 * @property {string} i18n.placeholder - Text of the disabled empty option
 * @property {string} i18n.existingGroup - Label of the existing-calendars <optgroup>
 * @property {string} i18n.newGroup - Label of the not-yet-created <optgroup>
 */

/**
 * Display name for a nation code: from the server-built list, else from the
 * browser's ICU data (the Vatican has a national calendar but no Latin-rite
 * diocese list entry), else the bare code.
 * @param {string} code - ISO 3166-1 alpha-2 code
 * @param {Object<string, string>} nations - Nation code => display name
 * @param {string} locale - UI locale
 * @returns {string} The display name
 */
function nationName(code, nations, locale) {
    if (Object.hasOwn(nations, code)) {
        return nations[code];
    }
    try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
        return code;
    }
}

/**
 * @param {string} code - ISO 3166-1 alpha-2 code
 * @param {string} name - Display name
 * @returns {HTMLOptionElement} The option
 */
function nationOption(code, name) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = `${name} (${code})`;
    return o;
}

/**
 * Build the nation <select> for the `national_calendar` scope.
 * @param {NationSelectOptions} opts - Options
 * @returns {HTMLSelectElement} The built select
 */
export function buildNationObjectIdSelect({ nations, existingIds, locale, className, id, i18n }) {
    const select = document.createElement('select');
    select.className = className;
    if (id) select.id = id;
    select.required = true;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = i18n.placeholder;
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    if (!Array.isArray(existingIds)) {
        for (const [code, name] of Object.entries(nations)) {
            select.appendChild(nationOption(code, name));
        }
        return select;
    }

    const existing = new Set(existingIds);
    const collator = new Intl.Collator(locale);
    const existingEntries = [...existing]
        .map(code => [code, nationName(code, nations, locale)])
        .sort((a, b) => collator.compare(a[1], b[1]));

    if (existingEntries.length > 0) {
        const group = document.createElement('optgroup');
        group.label = i18n.existingGroup;
        for (const [code, name] of existingEntries) {
            group.appendChild(nationOption(code, name));
        }
        select.appendChild(group);
    }

    const newEntries = Object.entries(nations).filter(([code]) => !existing.has(code));
    if (newEntries.length > 0) {
        const group = document.createElement('optgroup');
        group.label = i18n.newGroup;
        for (const [code, name] of newEntries) {
            group.appendChild(nationOption(code, name));
        }
        select.appendChild(group);
    }

    return select;
}
