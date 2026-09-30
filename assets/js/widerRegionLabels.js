/**
 * The wider region label-fields UI: one field per language a region's member countries speak
 * (API #1018 `metadata.labels`, keyed by `labelKeyForLocale()` — a language, or a language plus
 * script for a language written in more than one, e.g. `zh_Hans`).
 *
 * Each field is preceded by a fixed-width cell holding the flags of the member countries that
 * speak that language, so the input column stays aligned whatever the number of flags. `en`
 * (the General Roman Calendar's own language) is always the first field, with no flags when the
 * region has no English-speaking member.
 *
 * @module widerRegionLabels
 */

import { labelKeyForLocale } from './prospectiveWiderRegions.js';

/** Flags shown before a `.wr-label-more` counter cuts in. */
export const FLAG_LIMIT = 4;

/**
 * Returns a string containing the emoji flag for the given country code.
 * The country code must be a two-character string.
 * If the country code is not a string or its length is not 2, an empty string is returned.
 * @param {string} countryCode - two-character country code
 * @returns {string} emoji flag for the given country code
 */
export const country2flag = (countryCode) =>
    typeof countryCode === 'string' && countryCode.length === 2
        ? countryCode.toUpperCase().replace(/./g, letter =>
            String.fromCodePoint((letter.charCodeAt(0) % 32) + 0x1F1E5)
        )
        : '';

/**
 * The label fields a set of locales calls for: one per distinct `labelKeyForLocale()` key, each
 * carrying the ISO 3166-1 alpha-2 region codes of the locales that share it. `en` is always
 * present first, even with no locales at all, since it is the General Roman Calendar's own
 * language. A locale with no region subtag (e.g. `de`) still adds its key, with no region.
 * @param {string[]} locales - e.g. `['de_DE', 'it_IT', 'de_AT', 'zh_Hans_SG']`
 * @returns {Array<{key: string, regions: string[]}>} fields in first-seen order, `en` first
 */
export function labelFieldsFor(locales) {
    const order = ['en'];
    const regionsByKey = { en: [] };
    for (const locale of locales ?? []) {
        const key = labelKeyForLocale(locale);
        if (!(key in regionsByKey)) {
            regionsByKey[key] = [];
            order.push(key);
        }
        const region = new Intl.Locale(String(locale).replaceAll('_', '-')).region;
        if (region && !regionsByKey[key].includes(region)) {
            regionsByKey[key].push(region);
        }
    }
    return order.map((key) => ({ key, regions: regionsByKey[key] }));
}

/**
 * The visible text for a field's key cell: the language upper-cased, the script (if any) left
 * as-is (already title-case from `labelKeyForLocale()`), joined by a space instead of `_`.
 * @param {string} key - e.g. `de`, `zh_Hans`
 * @returns {string} e.g. `DE`, `ZH Hans`
 */
function keyText(key) {
    const [language, ...script] = key.split('_');
    return [language.toUpperCase(), ...script].join(' ');
}

/**
 * Builds a field's flag cell: up to `FLAG_LIMIT` flags, or `FLAG_LIMIT - 1` flags plus a
 * `.wr-label-more` counter for the rest. A field with no regions (the General Roman Calendar's
 * `en`, when the region has no English-speaking member) shows a globe instead.
 * @param {string[]} regions - ISO 3166-1 alpha-2 codes
 * @param {(code: string) => string} regionName - a country's display name
 * @param {{more?: string}} i18n - `more` is a `+%d` template
 * @returns {HTMLSpanElement}
 */
function buildFlagsCell(regions, regionName, i18n) {
    const cell = document.createElement('span');
    cell.className = 'wr-label-flags noto-color-emoji-regular';
    if (regions.length === 0) {
        cell.appendChild(document.createTextNode('\u{1F310}'));
        return cell;
    }
    const shown = regions.length <= FLAG_LIMIT ? regions : regions.slice(0, FLAG_LIMIT - 1);
    const remaining = regions.length - shown.length;
    cell.title = regions.map(regionName).join(', ');
    cell.appendChild(document.createTextNode(shown.map(country2flag).join('')));
    if (remaining > 0) {
        const more = document.createElement('span');
        more.className = 'wr-label-more';
        more.textContent = (i18n.more ?? '+%d').replace('%d', String(remaining));
        cell.appendChild(more);
    }
    return cell;
}

/**
 * Builds one `.wr-label-row`: the flags cell, the key label, and the text input. A field with no
 * stored value but a suggestion is pre-filled with the suggestion, marked `wr-label-suggested`
 * (cleared on the field's first `input` event) and titled `i18n.suggested`. A stored value wins
 * over a suggestion.
 * @param {{key: string, regions: string[]}} field
 * @param {Object<string, string>} values
 * @param {Object<string, string>} suggestions
 * @param {Object<string, string>} placeholders
 * @param {(code: string) => string} regionName
 * @param {{more?: string, suggested?: string}} i18n
 * @returns {HTMLDivElement}
 */
function buildRow(field, values, suggestions, placeholders, regionName, i18n) {
    const { key, regions } = field;
    const row = document.createElement('div');
    row.className = 'wr-label-row';
    row.appendChild(buildFlagsCell(regions, regionName, i18n));

    const label = document.createElement('label');
    label.className = 'wr-label-key font-monospace';
    label.htmlFor = `widerRegionLabel_${key}`;
    label.textContent = keyText(key);
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control form-control-sm';
    input.id = `widerRegionLabel_${key}`;
    input.dataset.labelKey = key;
    if (placeholders?.[key]) {
        input.placeholder = placeholders[key];
    }

    const value = values?.[key];
    const suggestion = suggestions?.[key];
    if (value) {
        input.value = value;
    } else if (suggestion) {
        input.value = suggestion;
        input.classList.add('wr-label-suggested');
        if (i18n.suggested) {
            input.title = i18n.suggested;
        }
        input.addEventListener('input', () => {
            input.classList.remove('wr-label-suggested');
        }, { once: true });
    }
    row.appendChild(input);

    return row;
}

/**
 * Builds the `#widerRegionLabels` grid of label fields.
 * @param {object} args
 * @param {Array<{key: string, regions: string[]}>} args.fields - from `labelFieldsFor()`
 * @param {Object<string, string>} [args.values] - stored labels, keyed by label key
 * @param {Object<string, string>} [args.suggestions] - M.49-derived suggestions, keyed by label key
 * @param {Object<string, string>} [args.placeholders] - input placeholders, keyed by label key
 * @param {(code: string) => string} args.regionName - a country's display name
 * @param {{more?: string, suggested?: string}} [args.i18n]
 * @returns {HTMLDivElement}
 */
export function buildWiderRegionLabelFields({
    fields,
    values = {},
    suggestions = {},
    placeholders = {},
    regionName,
    i18n = {},
}) {
    const container = document.createElement('div');
    container.id = 'widerRegionLabels';
    for (const field of fields) {
        container.appendChild(buildRow(field, values, suggestions, placeholders, regionName, i18n));
    }
    return container;
}

/**
 * M.49-derived label suggestions for a set of label keys: each key's `Intl.DisplayNames` region
 * name for the M.49 area code, capitalised. A key whose ICU has no better name than the code
 * itself, or that fails to construct as a locale, is omitted.
 * @param {string[]} keys - label keys, e.g. `['en', 'fr', 'it', 'de']`
 * @param {string} m49 - UN M.49 area code, e.g. `'150'`
 * @returns {Object<string, string>}
 */
export function m49Suggestions(keys, m49) {
    const result = {};
    for (const key of keys ?? []) {
        try {
            const displayNames = new Intl.DisplayNames([key.replaceAll('_', '-')], { type: 'region' });
            const name = displayNames.of(m49);
            if (name && name !== m49) {
                result[key] = name.charAt(0).toUpperCase() + name.slice(1);
            }
        } catch {
            // Omit: not a constructible locale, or ICU has no better name than the code.
        }
    }
    return result;
}

/**
 * Reads the stored labels back out of a built label-fields container.
 * @param {ParentNode} container
 * @returns {Object<string, string>} trimmed, non-empty values only, keyed by label key
 */
export function collectLabels(container) {
    const labels = {};
    container.querySelectorAll('[data-label-key]').forEach((input) => {
        const value = input.value.trim();
        if (value) {
            labels[input.dataset.labelKey] = value;
        }
    });
    return labels;
}

/**
 * Reads every field of a built label-fields container, empty ones included.
 * @param {ParentNode} container
 * @returns {Array<{key: string, value: string, suggested: boolean}>} `suggested` while the field
 *   still holds an untouched suggestion
 */
export function readLabelInputs(container) {
    return Array.from(container.querySelectorAll('[data-label-key]'), (input) => ({
        key: input.dataset.labelKey,
        value: input.value,
        suggested: input.classList.contains('wr-label-suggested'),
    }));
}

/**
 * The values and suggestions to rebuild the label fields with, when the fields change (the
 * selected locales did). A field that existed before holds the user's current value — typed or
 * emptied — which wins over both the stored label and the suggestion; a field still holding an
 * untouched suggestion is recomputed as a suggestion. Only a key with no field before falls back
 * to the stored label, then to the suggestion.
 * @param {Object<string, string>} stored - The labels the region was loaded or prefilled with
 * @param {Object<string, string>} suggestions - Suggestions for the new fields
 * @param {Array<{key: string, value: string, suggested: boolean}>} current - From `readLabelInputs()`
 * @returns {{values: Object<string, string>, suggestions: Object<string, string>}}
 */
export function rebuiltLabelState(stored, suggestions, current) {
    const values = { ...stored };
    const remainingSuggestions = { ...suggestions };
    for (const { key, value, suggested } of current) {
        if (suggested) {
            delete values[key];
        } else {
            values[key] = value.trim();
            delete remainingSuggestions[key];
        }
    }
    return { values, suggestions: remainingSuggestions };
}

/**
 * The label keys the API accepts for a region with these locales (`WiderRegionLabels::allowedKeys()`):
 * `en`, and for each locale its language plus, when it names a script, its language and script.
 * @param {string[]} locales - e.g. `['ja_JP', 'zh_Hans_CN']`
 * @returns {Set<string>} e.g. `en`, `ja`, `zh`, `zh_Hans`
 */
function allowedLabelKeys(locales) {
    const keys = new Set(['en']);
    for (const locale of locales ?? []) {
        const key = labelKeyForLocale(locale);
        keys.add(key.split('_')[0]);
        keys.add(key);
    }
    return keys;
}

/**
 * The labels a whole-region save sends. `metadata.labels` replaces the stored map, and the page
 * renders one field per `labelFieldsFor()` key, so a stored label under a key with no field (a
 * bare `zh` beside a `zh_Hans` field) would be deleted by a save that sent only the fields. Such
 * a label is carried over while the selected locales still allow its key, and dropped once they
 * do not (the API would reject it). A key that has a field takes the field's trimmed value, and
 * an emptied field drops its key.
 * @param {Array<{key: string, value: string}>} fieldValues - From `readLabelInputs()`
 * @param {Object<string, string>} storedLabels - The labels the region was loaded with
 * @param {string[]} locales - The selected locales
 * @returns {Object<string, string>} Non-empty labels, keyed by label key
 */
export function labelsToSave(fieldValues, storedLabels, locales) {
    const allowed = allowedLabelKeys(locales);
    const withField = new Set(fieldValues.map(({ key }) => key));
    const labels = {};
    for (const [key, value] of Object.entries(storedLabels ?? {})) {
        if (!withField.has(key) && allowed.has(key) && typeof value === 'string' && value.trim() !== '') {
            labels[key] = value.trim();
        }
    }
    for (const { key, value } of fieldValues) {
        const trimmed = value.trim();
        if (trimmed !== '') labels[key] = trimmed;
    }
    return labels;
}
