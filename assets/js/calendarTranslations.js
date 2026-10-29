/**
 * The starting `i18n` object of a national or wider region calendar payload.
 *
 * `NationalCalendarPayload` and `WiderRegionPayload` refuse an `i18n` whose
 * locales differ from `metadata.locales`, and so does the API. Event rows only
 * add the locales they carry a name input for, so a calendar with no event rows
 * yet (a new one, or one whose events were all removed) would otherwise send the
 * current localization alone and be refused as soon as it declares a second
 * language.
 *
 * @module calendarTranslations
 */

/**
 * One empty translation map per locale.
 *
 * @param {string[]|undefined} locales `metadata.locales`
 * @returns {Object<string, Object<string, string>>} locale => (event_key => name)
 */
export function emptyTranslations(locales) {
    return Object.fromEntries((locales ?? []).map((locale) => [locale, {}]));
}
