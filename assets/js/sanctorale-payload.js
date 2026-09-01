/**
 * Sanctorale write payloads, as pure functions.
 *
 * Separated from sanctorale.js because every correctness question this editor has
 * is a question about the payload, and none of them need a DOM to answer. The
 * governing rule, in all three of its guises:
 *
 *   an empty string is DATA, not absence.
 *
 * - `i18n`: `""` records "this key exists but is not translated yet", which is
 *   what keeps every locale file a complete, diffable inventory.
 * - `grade_display`: `""` is an authored override meaning "show no rank at all"
 *   (AllSouls), distinct from `null` meaning "no override".
 * - readings: a blank citation is curated-as-blank, distinct from a missing key.
 *
 * @module sanctorale-payload
 */

/** A payload that cannot be built, with a message meant for the user. */
export class PayloadError extends Error {}

/** No override: the rank renders from `grade`. Serializes to `null`. */
export const GRADE_DISPLAY_DEFAULT = 'default';

/** An authored override meaning "show no rank at all". Serializes to `""`. */
export const GRADE_DISPLAY_NONE = 'none';

/** An authored override carrying its own text. */
export const GRADE_DISPLAY_CUSTOM = 'custom';

/**
 * The structure properties this editor owns.
 *
 * `calendar` is absent on purpose: the API derives it from the Missal, so it is
 * submitted on create (where the handler requires it) but is never a user edit.
 * `color_ad_libitum` is absent because it is rendered read-only.
 */
export const STRUCTURE_FIELDS = Object.freeze([
    'month', 'day', 'grade', 'grade_display', 'common', 'color', 'is_dominical', 'is_bvm'
]);

/** What `MissalsHandler::buildRow()` insists on when creating an entry. */
export const CREATE_REQUIRED = Object.freeze([
    'month', 'day', 'grade', 'common', 'calendar', 'color'
]);

/**
 * Which of the three states a stored `grade_display` is in.
 *
 * @param {string|null|undefined} value
 * @returns {string} one of the GRADE_DISPLAY_* constants
 */
export function gradeDisplayMode(value) {
    if (value === null || value === undefined) return GRADE_DISPLAY_DEFAULT;
    if (value === '') return GRADE_DISPLAY_NONE;
    return GRADE_DISPLAY_CUSTOM;
}

/**
 * The value a mode serializes to.
 *
 * A custom override whose text has been cleared is `""` — still an override —
 * rather than `null`, because the user chose to override and then chose to show
 * nothing. Only the Default mode yields `null`.
 *
 * @param {string} mode one of the GRADE_DISPLAY_* constants
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function gradeDisplayValue(mode, text) {
    if (mode === GRADE_DISPLAY_DEFAULT) return null;
    if (mode === GRADE_DISPLAY_NONE) return '';
    return text === null || text === undefined ? '' : String(text);
}

/**
 * Value equality for the shapes a structure row holds: scalars, null, and arrays
 * of strings. Deliberately not a general deep-equal — there is nothing else here.
 */
function sameValue(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => item === b[i]);
    }
    return a === b;
}

/**
 * The structure properties that actually changed.
 *
 * Comparison is by value and never by truthiness: `''`, `0` and `false` are all
 * legitimate values here, and `grade_display` moving between `null` and `''` is
 * precisely the edit a truthiness test would silently discard.
 *
 * @param {object} original the entry as loaded
 * @param {object} next the entry as the form now reads
 * @returns {object} a partial entry, possibly empty
 */
export function diffStructure(original, next) {
    const changed = {};
    for (const field of STRUCTURE_FIELDS) {
        const before = original?.[field] ?? null;
        const after = next?.[field] ?? null;
        if (!sameValue(before, after)) {
            changed[field] = next[field];
        }
    }
    return changed;
}
