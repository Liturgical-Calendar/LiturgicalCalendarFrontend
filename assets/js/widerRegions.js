/**
 * A national calendar's wider regions, as the API publishes them.
 *
 * Since LiturgicalCalendarAPI#1005 a national calendar declares a list of wider
 * regions (`wider_regions`), and each region in `/calendars` publishes its
 * `roster`: the nations eligible to declare it, calendar or not. Before it, a
 * nation declared one region (`wider_region`) and no roster was published. Every
 * read of either shape goes through this module, so the page works against both.
 *
 * @module widerRegions
 */

/**
 * The wider regions a national calendar declares.
 *
 * @param {object|undefined} item a `/calendars` national calendar item, or a calendar's `metadata`
 * @returns {string[]} most general first; empty when it declares none
 */
export function nationWiderRegions(item) {
    if (Array.isArray(item?.wider_regions)) return [...item.wider_regions];
    const legacy = item?.wider_region;
    return typeof legacy === 'string' && legacy !== '' ? [legacy] : [];
}

/**
 * The nations eligible to declare a wider region.
 *
 * @param {object|undefined} region a `/calendars` wider region item
 * @returns {string[]|null} ISO 3166-1 alpha-2 codes, or null when the API does not publish them
 */
export function widerRegionRoster(region) {
    return Array.isArray(region?.roster) ? region.roster : null;
}

/**
 * Wider region names, broadest first: by the length of their roster, then by name;
 * a region with no roster sorts by name after those with one. Overlapping regions
 * do not redefine the same celebration, so this order only has to be stable.
 *
 * @param {string[]} names
 * @param {object[]|undefined} regions `/calendars` `wider_regions`
 * @returns {string[]}
 */
export function orderWiderRegions(names, regions) {
    const size = new Map((regions ?? []).map(region => [region.name, widerRegionRoster(region)?.length ?? -1]));
    return [...names].sort((a, b) => ((size.get(b) ?? -1) - (size.get(a) ?? -1)) || a.localeCompare(b));
}

/**
 * The wider regions to offer a nation: those whose roster lists it, and every
 * region it already declares (so saving never drops a stored membership), broadest
 * first. When the API publishes no roster, every region is offered, and the API's
 * own check (422) is the guard.
 *
 * @param {string} nation ISO 3166-1 alpha-2 code
 * @param {object[]|undefined} regions `/calendars` `wider_regions`
 * @param {string[]} declared the regions the nation's calendar declares
 * @returns {string[]}
 */
export function eligibleWiderRegions(nation, regions, declared) {
    const all = regions ?? [];
    const withRoster = all.some(region => widerRegionRoster(region) !== null);
    const offered = all
        .filter(region => !withRoster || (widerRegionRoster(region) ?? []).includes(nation))
        .map(region => region.name);
    return orderWiderRegions([...new Set([...offered, ...declared])], all);
}

/**
 * Every wider region each nation belongs to: those its national calendar
 * declares, and those whose roster lists it, calendar or not. This is the API's
 * own reading of membership (#999), which refuses a nation's locale in a region
 * when the nation belongs to other regions but not to this one. Without published
 * rosters, only the declared regions are known.
 *
 * @param {object[]|undefined} nationalCalendars `/calendars` `national_calendars`
 * @param {object[]|undefined} regions `/calendars` `wider_regions`
 * @returns {Object<string, string[]>} nation => its regions, broadest first; nations in no region are left out
 */
export function widerRegionsByNation(nationalCalendars, regions) {
    const byNation = {};
    const add = (nation, name) => {
        byNation[nation] ??= [];
        if (!byNation[nation].includes(name)) byNation[nation].push(name);
    };
    for (const item of nationalCalendars ?? []) {
        for (const name of nationWiderRegions(item)) add(item.calendar_id, name);
    }
    for (const region of regions ?? []) {
        for (const nation of widerRegionRoster(region) ?? []) add(nation, region.name);
    }
    for (const nation of Object.keys(byNation)) {
        byNation[nation] = orderWiderRegions(byNation[nation], regions);
    }
    return byNation;
}
