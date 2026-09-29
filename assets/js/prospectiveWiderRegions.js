/**
 * Wider region names and the prospective wider regions (#591, #66).
 *
 * Since API #1007 a wider region is any region with a source file, named by a
 * shape rule, and whether it exists is checked at runtime. The prospective
 * regions — groupings from the Notitiae survey that do not exist yet — come
 * from assets/data/ProspectiveWiderRegions.json via src/ProspectiveWiderRegions.php.
 *
 * Used by widerRegionObjectIdSelect.js, extending.js and NationalCalendarPayload.js.
 */

/**
 * @typedef {object} ProspectiveRegion
 * @property {string} name - Region name, matching WIDER_REGION_NAME_PATTERN
 * @property {string} description - The grouping's full name, or ''
 * @property {string[]} roster - ISO 3166-1 alpha-2 codes of the nations eligible to join
 * @property {string[]} locales - Suggested locales, pre-selected when the region is created
 */

/** The API's WiderRegionName shape rule. */
export const WIDER_REGION_NAME_PATTERN = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;

/**
 * @param {unknown} name - Candidate region name
 * @returns {boolean} Whether it satisfies the API's shape rule
 */
export function isValidWiderRegionName(name) {
    return typeof name === 'string' && WIDER_REGION_NAME_PATTERN.test(name);
}

/**
 * @param {ProspectiveRegion[]|null|undefined} prospective - The prospective regions
 * @param {string} name - Region name, matched exactly
 * @returns {ProspectiveRegion|undefined} The entry, if the name is a prospective region
 */
export function findProspectiveRegion(prospective, name) {
    return (prospective ?? []).find((region) => region.name === name);
}

/**
 * The `national_calendars` map a wider region file holds: English nation name => code.
 * Named as the extending page's payload builder names them (Intl.DisplayNames, English).
 * @param {string[]} roster - ISO 3166-1 alpha-2 codes
 * @returns {Object<string, string>} English name => code
 */
export function rosterToNationalCalendars(roster) {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return Object.fromEntries(
        roster.map((code) => {
            let name = code;
            try {
                name = names.of(code) ?? code;
            } catch {
                // an invalid code keeps itself as its name
            }
            return [name, code];
        }),
    );
}

/**
 * A new region's member nations: those implied by its selected locales, plus
 * every roster nation no locale covers (Brunei, Eswatini, Mauritania have none
 * in the Locales list, and would otherwise be dropped).
 * @param {string[]} roster - ISO 3166-1 alpha-2 codes
 * @param {Object<string, string>} localeMap - English name => code, from the selected locales
 * @returns {Object<string, string>} English name => code, each nation once
 */
export function widerRegionNationalCalendars(roster, localeMap) {
    const result = { ...localeMap };
    const codes = new Set(Object.values(localeMap));
    for (const [name, code] of Object.entries(
        rosterToNationalCalendars(roster),
    )) {
        if (!codes.has(code)) {
            result[name] = code;
            codes.add(code);
        }
    }
    return result;
}

/**
 * @param {string[]} locales - Suggested locales
 * @param {string[]} available - Locales the page offers
 * @returns {string[]} The suggested locales the page offers, in the suggested order
 */
export function offeredLocales(locales, available) {
    const offered = new Set(available);
    return locales.filter((locale) => offered.has(locale));
}
