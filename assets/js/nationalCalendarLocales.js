/**
 * Which locales a new national calendar may declare.
 *
 * A national calendar can only be created in a language whose General Roman
 * Calendar, Decrees and Lectionary are translated. The API does not enforce it
 * yet (LiturgicalCalendarAPI#994), so the extending page does. Its proxy is the
 * `/calendars` `metadata.locales` list: the officially supported languages, each
 * of which passed the API's readiness check to be promoted there.
 *
 * Only the base language counts: `fr_FR` and `fr_CA` are official because `fr`
 * is, while `br_FR` (Breton) is not, although it is spoken in France too.
 *
 * @module nationalCalendarLocales
 */

/**
 * @param {string} locale e.g. `fr_FR`, `sr_Latn_BA` or `fr-CA`
 * @returns {string} its language subtag, e.g. `fr`
 */
export function baseLanguage(locale) {
    return String(locale ?? '').split(/[-_]/)[0].toLowerCase();
}

/**
 * @param {string} locale
 * @param {string[]} officialLocales `litcal_metadata.locales`
 * @returns {boolean}
 */
export function isOfficialLocale(locale, officialLocales) {
    return (officialLocales ?? []).includes(baseLanguage(locale));
}

/**
 * @param {string[]} locales
 * @param {string[]} officialLocales `litcal_metadata.locales`
 * @returns {string[]} those of `locales` whose language is not official, in order
 */
export function unofficialLocales(locales, officialLocales) {
    return (locales ?? []).filter((locale) => !isOfficialLocale(locale, officialLocales));
}

const escapeHtml = (text) => String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * The `<option>`s of a new national calendar's locales select: every locale of
 * the nation is offered, the official ones selected, the others left unselected
 * and labelled as not yet available.
 *
 * They stay selectable rather than disabled: the choice is the curator's, and
 * the page names what blocks it (see unofficialLocales()) instead of hiding it.
 *
 * @param {Array<[string, string]>} regionLocales `[locale, display name]` pairs
 * @param {string[]} officialLocales `litcal_metadata.locales`
 * @param {string} notYetAvailableLabel appended to an unofficial locale's name
 * @returns {string} the options' HTML
 */
export function newNationalCalendarLocaleOptions(regionLocales, officialLocales, notYetAvailableLabel) {
    return (regionLocales ?? []).map(([locale, displayName]) => {
        const official = isOfficialLocale(locale, officialLocales);
        const label = official ? displayName : `${displayName} (${notYetAvailableLabel})`;
        return `<option value="${escapeHtml(locale)}"${official ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
}
