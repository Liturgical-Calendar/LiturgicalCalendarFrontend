/**
 * Wider region picker for the `wider_region` permission scope (#591).
 *
 * It used to offer a fixed list of five continents. Since API #1007 a wider
 * region is any region with a source file, so this picker offers the regions
 * that exist (from /calendars) and the prospective ones that do not yet
 * (assets/data/ProspectiveWiderRegions.json), split into two groups, so that an
 * admin can be granted `admin` on a region before creating it — the same
 * reasoning as the nation picker (nationObjectIdSelect.js, API #669).
 *
 * Option values are bare region names; region names are proper nouns and are
 * not localized.
 *
 * Used by permission-requests.js and admin-permissions.js.
 */

/** The permission scope this picker serves. */
export const WIDER_REGION_TYPE = 'wider_region';

/**
 * @typedef {import('./prospectiveWiderRegions.js').ProspectiveRegion} ProspectiveRegion
 */

/**
 * @typedef {object} WiderRegionSelectOptions
 * @property {ProspectiveRegion[]} prospective - The prospective regions, sorted by name
 * @property {object[]|null} existing - `litcal_metadata.wider_regions`, or null when metadata failed to load
 *   (the prospective regions are then listed without groups)
 * @property {string} locale - UI locale, for sorting the existing regions
 * @property {string} className - Class attribute for the <select>
 * @property {string} [id] - Id attribute for the <select>
 * @property {object} i18n - Labels
 * @property {string} i18n.placeholder - Text of the disabled empty option
 * @property {string} i18n.existingGroup - Label of the existing-regions <optgroup>
 * @property {string} i18n.newGroup - Label of the not-yet-created <optgroup>
 */

/**
 * @param {string} name - Region name
 * @param {string[]} codes - Member nation codes, possibly empty
 * @param {string} [description] - The grouping's full name, shown as a tooltip
 * @returns {HTMLOptionElement} The option
 */
function regionOption(name, codes, description = '') {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = codes.length > 0 ? `${name} (${codes.join(', ')})` : name;
    if (description !== '') o.title = description;
    return o;
}

/**
 * The nations an existing region lists: its roster, else (an API that publishes
 * no roster) the nations whose calendar declares it, else none.
 * @param {object} region - A `litcal_metadata.wider_regions` item
 * @returns {string[]} ISO codes
 */
function existingCodes(region) {
    if (Array.isArray(region.roster)) return region.roster;
    if (Array.isArray(region.national_calendars))
        return region.national_calendars;
    return [];
}

/**
 * @param {string} label - Group label
 * @param {HTMLOptionElement[]} options - Its options
 * @returns {HTMLOptGroupElement} The group
 */
function optgroup(label, options) {
    const group = document.createElement('optgroup');
    group.label = label;
    group.append(...options);
    return group;
}

/**
 * Build the region <select> for the `wider_region` scope.
 * @param {WiderRegionSelectOptions} opts - Options
 * @returns {HTMLSelectElement} The built select
 */
export function buildWiderRegionObjectIdSelect({
    prospective,
    existing,
    locale,
    className,
    id,
    i18n,
}) {
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

    const prospectiveOption = (region) =>
        regionOption(region.name, region.roster, region.description);

    if (!Array.isArray(existing)) {
        select.append(...prospective.map(prospectiveOption));
        return select;
    }

    const collator = new Intl.Collator(locale);
    const existingOptions = [...existing]
        .sort((a, b) => collator.compare(a.name, b.name))
        .map((region) => regionOption(region.name, existingCodes(region)));
    if (existingOptions.length > 0) {
        select.appendChild(optgroup(i18n.existingGroup, existingOptions));
    }

    const existingNames = new Set(existing.map((region) => region.name));
    const newOptions = prospective
        .filter((region) => !existingNames.has(region.name))
        .map(prospectiveOption);
    if (newOptions.length > 0) {
        select.appendChild(optgroup(i18n.newGroup, newOptions));
    }

    return select;
}

/**
 * Build the region <select> from a page config and the resolved ApiClient.
 *
 * The prospective regions and labels come from the page config
 * (`config.prospectiveWiderRegions`, `config.i18n`), the existing regions from
 * the client's metadata — `null` when the client failed to initialize, which
 * leaves the list ungrouped rather than empty.
 * @param {object} config - The page config (AccessRequestsConfig / AdminPermissionsConfig)
 * @param {object|false} client - The resolved ApiClient, or false if init failed
 * @param {{locale: string, className: string, id?: string}} opts - Locale and attributes
 * @returns {HTMLSelectElement} The built select
 */
export function buildWiderRegionObjectIdSelectFromConfig(
    config,
    client,
    { locale, className, id },
) {
    const i18n = config.i18n || {};
    return buildWiderRegionObjectIdSelect({
        prospective: config.prospectiveWiderRegions || [],
        existing: client?._metadata?.wider_regions ?? null,
        locale,
        className,
        id,
        i18n: {
            placeholder: i18n.selectCalendarId || 'Select calendar ID...',
            existingGroup:
                i18n.existingWiderRegions || 'Existing wider regions',
            newGroup:
                i18n.newWiderRegions || 'New wider regions (not yet created)',
        },
    });
}
