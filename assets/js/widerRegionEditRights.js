/**
 * Who may change what in a wider region calendar.
 *
 * A wider region is a layer shared by several nations, and its translations are
 * per nation: `en_CA` and `fr_CA` of the Americas are Canada's to maintain. So:
 *
 * - a global admin, or an editor of the wider region itself, edits all of it;
 * - an editor of a national calendar edits only the region's translations into
 *   that nation's locales (and may add such a locale), and nothing else — and only
 *   when the nation belongs to this region, or to no region yet: an editor of
 *   Canada may not write Canadian locales into Europe, while an editor of
 *   Venezuela, in no region yet, may add es_VE to the Americas.
 *
 * The API enforces the same rule on `PUT /data/widerregion/{region}/{locale}`;
 * this module is what lets the page show it, instead of offering controls whose
 * writes would come back 403.
 *
 * @module widerRegionEditRights
 */

/**
 * @typedef {Object} CalendarEditRights
 * @property {boolean} isGlobalAdmin
 * @property {string[]} nations      ISO codes of the national calendars the user edits, e.g. `CA`
 * @property {string[]} widerRegions names of the wider regions the user edits, e.g. `Americas`
 */

/**
 * What the page knows of wider region membership. Partial by nature: the API also
 * reads every other region's member list, which `/calendars` does not publish, so
 * a nation that belongs to another region only by that region's own list (Hungary,
 * in Europe) is treated here as unassigned, and the API has the last word.
 *
 * @typedef {Object} WiderRegionMembership
 * @property {string[]} members       ISO codes the loaded region lists in its `national_calendars`
 * @property {Object<string, string>} declaredRegion nation => the `wider_region` its national calendar declares
 */

/**
 * The nation a locale names, or '' when it names none: `fr_CA` → `CA`,
 * `es_419` → '' (a region, not a nation), `en` → ''.
 *
 * @param {string} locale
 * @returns {string}
 */
export function nationOfLocale(locale) {
    const last = String(locale ?? '').split(/[_-]/).pop() ?? '';
    return /^[A-Z]{2}$/.test(last) && last !== String(locale) ? last : '';
}

/**
 * @param {?CalendarEditRights} rights
 * @param {string} region
 * @returns {boolean}
 */
export function editsWholeWiderRegion(rights, region) {
    return rights?.isGlobalAdmin === true || (rights?.widerRegions ?? []).includes(region);
}

/**
 * Whether a nation may take part in `region`: it is one of the region's members,
 * or, as far as the page knows, a member of no other region.
 *
 * @param {string} nation
 * @param {string} region
 * @param {?WiderRegionMembership} membership
 * @returns {boolean}
 */
export function nationMayJoinWiderRegion(nation, region, membership) {
    if ((membership?.members ?? []).includes(nation)) return true;
    const declared = membership?.declaredRegion?.[nation];
    return !declared || declared === region;
}

/**
 * @param {?CalendarEditRights} rights
 * @param {string} region
 * @param {string} locale
 * @param {?WiderRegionMembership} [membership]
 * @returns {boolean}
 */
export function editsWiderRegionLocale(rights, region, locale, membership = null) {
    if (editsWholeWiderRegion(rights, region)) return true;
    const nation = nationOfLocale(locale);
    return nation !== ''
        && (rights?.nations ?? []).includes(nation)
        && nationMayJoinWiderRegion(nation, region, membership);
}

/**
 * The per-locale writes a national editor's save turns into: one
 * `PUT /data/widerregion/{region}/{locale}` per locale they may write.
 *
 * @param {Object<string, Object<string, string>>} i18n the save's collected translations, by locale
 * @param {?CalendarEditRights} rights
 * @param {string} region
 * @param {?WiderRegionMembership} [membership]
 * @returns {Array<{locale: string, names: Object<string, string>}>}
 */
export function localeWrites(i18n, rights, region, membership = null) {
    return Object.entries(i18n ?? {})
        .filter(([locale]) => editsWiderRegionLocale(rights, region, locale, membership))
        .map(([locale, names]) => ({ locale, names }));
}
