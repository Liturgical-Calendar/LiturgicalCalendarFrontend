/**
 * The wider region a new national calendar most likely belongs to.
 *
 * `/calendars` announces each wider region's `locales`, and the region subtag of
 * a locale is a nation: `es_MX` places Mexico in the Americas. That is the only
 * membership the API publishes, so it is a default for the form, not a rule —
 * a nation with no locale in any wider region (Hungary, today) gets none, and
 * the curator picks one by hand as before.
 *
 * @module widerRegionForNation
 */

/**
 * @param {Array<{name: string, locales?: string[]}>} widerRegions `litcal_metadata.wider_regions`
 * @param {string} nation ISO 3166-1 alpha-2 code, e.g. `MX`
 * @returns {string} the one wider region whose locales include the nation, or ''
 *          when none does, or when several do and the choice is the curator's
 */
export function widerRegionForNation(widerRegions, nation) {
    const target = String(nation ?? '').toUpperCase();
    if (target === '') return '';
    const matches = (widerRegions ?? []).filter(({ locales }) =>
        (locales ?? []).some((locale) => locale.split(/[_-]/).pop().toUpperCase() === target));
    return matches.length === 1 ? matches[0].name : '';
}
