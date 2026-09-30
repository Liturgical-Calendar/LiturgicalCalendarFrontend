/**
 * Wider region ids/labels and the prospective wider regions (#591, #66, #1018).
 *
 * Since API #1018 a wider region is identified by a permanent, lowercase kebab-case
 * id, with a label resolved per the request's locale. A wider region is any region
 * with a source file, and whether it exists is checked at runtime. The prospective
 * regions — groupings from the Notitiae survey that do not exist yet — come from
 * assets/data/ProspectiveWiderRegions.json via src/ProspectiveWiderRegions.php.
 *
 * Used by widerRegionObjectIdSelect.js, extending.js and NationalCalendarPayload.js.
 */

/**
 * @typedef {object} ProspectiveRegion
 * @property {string} id - Region id, matching WIDER_REGION_ID_PATTERN
 * @property {string} label - The region's label in the request's language
 * @property {Object<string,string>} labels - Region label by locale key (see labelKeyForLocale)
 * @property {string|null} m49 - UN M.49 area code, when the region is a continent
 * @property {string} description - The grouping's full name, or ''
 * @property {string[]} roster - ISO 3166-1 alpha-2 codes of the nations eligible to join
 * @property {string[]} locales - Suggested locales, pre-selected when the region is created
 */

/** The API's WiderRegionId rule (#1018): lowercase kebab-case, permanent once the region exists. */
export const WIDER_REGION_ID_PATTERN = /^[a-z]+(-[a-z]+)*$/;

/**
 * @param {unknown} id - Candidate region id
 * @returns {boolean} Whether it satisfies the API's id rule
 */
export function isValidWiderRegionId(id) {
    return typeof id === 'string' && WIDER_REGION_ID_PATTERN.test(id);
}

/**
 * A region's id; an API older than #1018 publishes only `name`.
 * @param {{id?: string, name?: string}} region - A `litcal_metadata.wider_regions` item
 * @returns {string} The id
 */
export function regionId(region) {
    return region.id ?? region.name;
}

/**
 * A region's label in the request's language; an API older than #1018 publishes only `name`.
 * @param {{label?: string, name?: string}} region - A `litcal_metadata.wider_regions` item
 * @returns {string} The label
 */
export function regionLabel(region) {
    return region.label ?? region.name;
}

/**
 * The `metadata.labels` key a locale's label is stored under: its language, plus its script when it has one.
 * @param {string} locale - e.g. `it_CH`, `zh_Hans_SG`, `zh-Hant-TW`
 * @returns {string} e.g. `it`, `zh_Hans`, `zh_Hant`
 */
export function labelKeyForLocale(locale) {
    const parsed = new Intl.Locale(String(locale).replaceAll('_', '-'));
    return parsed.script
        ? `${parsed.language}_${parsed.script}`
        : parsed.language;
}

/**
 * Words derived from an id, the API's last-resort label.
 * @param {string} id - e.g. `german-language-area`
 * @returns {string} e.g. `German Language Area`
 */
export function idToWords(id) {
    return id
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * The script a locale that names none is written in, by language and then region ('' = any other region).
 *
 * Mirrors the API's `WiderRegionLabels::DEFAULT_SCRIPTS`: PHP intl exposes no addLikelySubtags, so this carries
 * the one CLDR likely-subtags fact `resolveLabel()` needs, for the one multi-script language among the regions'
 * locales. Chinese is Traditional in Taiwan, Hong Kong and Macao (`zh_TW` → `zh_Hant_TW`) and Simplified elsewhere
 * (`zh`, `zh_CN` → `zh_Hans_…`).
 */
const DEFAULT_SCRIPTS = {
    zh: { TW: 'Hant', HK: 'Hant', MO: 'Hant', '': 'Hans' },
};

/**
 * A locale's language and script, as the API's `WiderRegionLabels::languageAndScript()` reads them: parsed
 * directly from the locale's own subtags, with no likely-subtags expansion.
 * @param {string} locale - e.g. `it_IT`, `zh_Hans_SG`, `zh-TW`
 * @returns {[string, string]} Lowercase language, and title-case script ('' when the locale names none)
 */
function languageAndScript(locale) {
    const parsed = new Intl.Locale(String(locale).replaceAll('_', '-'));
    const script = parsed.script ?? '';
    return [
        parsed.language.toLowerCase(),
        script
            ? script.charAt(0).toUpperCase() + script.slice(1).toLowerCase()
            : '',
    ];
}

/**
 * Whether `labels` has a `{language}_{X}` key for a script X other than `script`.
 * @param {Object<string, string>} labels
 * @param {string} language
 * @param {string} script
 * @returns {boolean}
 */
function hasOtherScript(labels, language, script) {
    const prefix = `${language}_`;
    return Object.keys(labels).some(
        (key) => key.startsWith(prefix) && key !== `${language}_${script}`,
    );
}

/**
 * A region's label for a UI locale. Mirrors the API's `WiderRegionLabels::resolve()`: its language plus script,
 * then its language, then `en`, then words derived from the id.
 *
 * A locale naming no script takes its language's default script (`DEFAULT_SCRIPTS`), so `zh_TW` tries `zh_Hant`
 * first. The bare-language candidate is skipped when the locale has a script (given or inferred) and the labels
 * map holds a `{language}_{X}` key for a *different* script X: that other script's text would be a worse guess
 * than English.
 *
 * The UN M.49 tier is a frontend-only addition, not in the API: for a continent whose region has not stored a
 * label in the UI language yet, it tries before falling back to words derived from the id.
 * @param {Object<string, string>|null|undefined} labels - `metadata.labels`
 * @param {string} uiLocale - e.g. `it_IT`, `zh_TW`
 * @param {string} id - The region id
 * @param {string|null} [m49] - UN M.49 area code, e.g. `002`
 * @returns {string} The label
 */
export function resolveLabel(labels, uiLocale, id, m49 = null) {
    const map = labels ?? {};
    const candidates = [];
    if (uiLocale) {
        const [language, explicitScript] = languageAndScript(uiLocale);
        let script = explicitScript;
        if (script === '') {
            const defaults = DEFAULT_SCRIPTS[language] ?? {};
            const region = (
                new Intl.Locale(
                    String(uiLocale).replaceAll('_', '-'),
                ).region ?? ''
            ).toUpperCase();
            script = defaults[region] ?? defaults[''] ?? '';
        }
        if (script !== '') candidates.push(`${language}_${script}`);
        if (script === '' || !hasOtherScript(map, language, script))
            candidates.push(language);
    }
    candidates.push('en');

    for (const key of candidates) {
        if (typeof map[key] === 'string' && map[key] !== '') return map[key];
    }
    if (m49) {
        try {
            const name = new Intl.DisplayNames(
                [uiLocale.replaceAll('_', '-')],
                { type: 'region' },
            ).of(m49);
            if (name && name !== m49)
                return name.charAt(0).toUpperCase() + name.slice(1);
        } catch {
            // an unknown locale or code falls through to the id words
        }
    }
    return idToWords(id);
}

/**
 * @param {ProspectiveRegion[]|null|undefined} prospective - The prospective regions
 * @param {string} id - Region id, matched exactly
 * @returns {ProspectiveRegion|undefined} The entry, if the id is a prospective region
 */
export function findProspectiveRegion(prospective, id) {
    return (prospective ?? []).find((region) => region.id === id);
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
