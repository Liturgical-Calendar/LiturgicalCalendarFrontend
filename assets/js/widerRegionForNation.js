/**
 * The wider regions a new national calendar most likely belongs to.
 *
 * Since LiturgicalCalendarAPI#1005, `/calendars` publishes each region's
 * `roster`, the nations eligible to declare it, so the answer is every region
 * whose roster lists the nation. An older API publishes no roster; membership is
 * then inferred from the region subtag of each region's `locales` (`es_MX` places
 * Mexico in the Americas). Either way it is a default for the form, not a rule:
 * the curator can change it, and the API has the last word.
 *
 * @module widerRegionForNation
 */

import { orderWiderRegions, widerRegionRoster } from './widerRegions.js';
import { regionId } from './prospectiveWiderRegions.js';

/**
 * @param {Array<{id?: string, name?: string, locales?: string[], roster?: string[]}>} widerRegions `litcal_metadata.wider_regions`
 * @param {string} nation ISO 3166-1 alpha-2 code, e.g. `MX`
 * @returns {string[]} ids of the regions the nation belongs to, broadest first; empty when none
 */
export function widerRegionsForNation(widerRegions, nation) {
    const target = String(nation ?? '').toUpperCase();
    const regions = widerRegions ?? [];
    if (target === '') return [];
    const withRoster = regions.some(region => widerRegionRoster(region) !== null);
    const matches = regions.filter(region => withRoster
        ? (widerRegionRoster(region) ?? []).includes(target)
        : (region.locales ?? []).some(locale => locale.split(/[_-]/).pop().toUpperCase() === target));
    return orderWiderRegions(matches.map(region => regionId(region)), regions);
}

