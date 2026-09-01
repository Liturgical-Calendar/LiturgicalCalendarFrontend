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

/**
 * The `event_key` grammar, copied verbatim from the `EventKey` definition in the
 * API's `jsondata/schemas/CommonDef.json` — minus its anchors, so it can serve
 * both an HTML `pattern=` attribute (which anchors implicitly) and a `RegExp`.
 *
 * Kept as one exported constant because a client rule that merely resembles the
 * schema is worse than none: too permissive and the curator fills the whole form
 * before an opaque 400 comes back; too restrictive and a legal key —
 * `StJohnBaptist_vigil`, `StPaul_2` — cannot be entered at all.
 *
 * The grammar in words: an optional lowercase `word_word_` prefix, then a
 * PascalCase run of at least two characters beginning with a capital, then an
 * optional `_<digits>` disambiguator, then an optional `_vigil`.
 */
export const EVENT_KEY_PATTERN = '([a-z]+_[a-z]+_)?[A-Z][a-zA-Z0-9]+(?:[A-Z][a-zA-Z0-9]+)*(?:_\\d+)?(?:_vigil)?';

/**
 * Whether a proposed `event_key` satisfies the schema.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isValidEventKey(value) {
    return new RegExp(`^${EVENT_KEY_PATTERN}$`).test(value);
}

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

/**
 * Structural equality for a locale map's values: a name (string) or a readings
 * entry (a possibly-nested object of strings).
 */
function sameEntry(a, b) {
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (a === null || b === null || a === undefined || b === undefined) return a === b;
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
    return aKeys.every((k) => sameEntry(a[k], b[k]));
}

/** True for a value that says nothing: '' for a name, all-blank for a readings entry. */
function isBlankEntry(value) {
    if (value === '' || value === null || value === undefined) return true;
    if (typeof value === 'object') return Object.values(value).every(isBlankEntry);
    return false;
}

/**
 * The locales whose value changed.
 *
 * Two asymmetries, both deliberate:
 *
 * - Clearing a value yields `''`, never omission. Omitting the locale would leave
 *   the stored value in place, so a user who deleted a name would see it return.
 * - A locale that was ABSENT and is still blank yields nothing. `fanOutKey()`
 *   fills a new key into every locale file itself, and proposing fourteen
 *   identical blanks would only lengthen the diff a reviewer reads.
 *
 * @param {Object<string, any>} original
 * @param {Object<string, any>} next
 * @returns {Object<string, any>} a partial map, possibly empty
 */
export function diffLocaleMap(original, next) {
    const changed = {};
    for (const [locale, value] of Object.entries(next ?? {})) {
        const had = Object.prototype.hasOwnProperty.call(original ?? {}, locale);
        if (!had && isBlankEntry(value)) continue;
        if (had && sameEntry(original[locale], value)) continue;
        changed[locale] = value;
    }
    return changed;
}

/**
 * A minimal PATCH body.
 *
 * Minimal is not an optimization: `fanOutKey()` stages only files whose content
 * actually changed, so the payload's size is exactly the size of the change
 * request a reviewer has to read.
 *
 * @param {object} args
 * @param {{structure: object, i18n: object, readings?: object}} args.original
 * @param {{structure: object, i18n: object, readings?: object}} args.next
 * @param {'missal'|'rite'|'none'} args.readingsTier
 * @returns {object}
 * @throws {PayloadError} when nothing changed
 */
export function buildPatch({ original, next, readingsTier }) {
    const payload = diffStructure(original.structure, next.structure);

    const names = diffLocaleMap(original.i18n, next.i18n);
    if (Object.keys(names).length > 0) {
        payload.i18n = names;
    }

    // A rite with no corpus has nowhere to write; the handler refuses a payload
    // that carries `readings` for such a Missal.
    if (readingsTier !== 'none') {
        const readings = diffLocaleMap(original.readings, next.readings);
        if (Object.keys(readings).length > 0) {
            payload.readings = readings;
        }
    }

    if (Object.keys(payload).length === 0) {
        throw new PayloadError('nothing changed');
    }
    return payload;
}

/**
 * A complete PUT body.
 *
 * `calendar` is carried even though no user edits it: `buildRow()` requires it
 * and refuses a value that is not the target Missal's own, so a row can never be
 * filed under a calendar its own Missal never applies to.
 *
 * `grade_display` is omitted when there is no override and carried when there is
 * one — including when the override is `''`, which is an authored decision to
 * show no rank rather than an unset field.
 *
 * @param {object} args
 * @param {string} args.eventKey used for the message only; the URL owns the key
 * @param {{structure: object, i18n: object, readings?: object}} args.next
 * @param {'missal'|'rite'|'none'} args.readingsTier
 * @returns {object}
 * @throws {PayloadError} when a required field or the last locale is missing
 */
export function buildCreate({ eventKey, next, readingsTier }) {
    const structure = next.structure ?? {};

    const missing = CREATE_REQUIRED.filter((field) => {
        const value = structure[field];
        return value === null || value === undefined
            || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length > 0) {
        throw new PayloadError(
            `\`${eventKey}\` cannot be created without: ${missing.join(', ')}`
        );
    }

    const payload = {};
    for (const field of [...CREATE_REQUIRED, 'is_dominical', 'is_bvm']) {
        if (structure[field] !== null && structure[field] !== undefined) {
            payload[field] = structure[field];
        }
    }
    if (structure.grade_display !== null && structure.grade_display !== undefined) {
        payload.grade_display = structure.grade_display;
    }

    const names = next.i18n ?? {};
    if (Object.keys(names).length === 0) {
        throw new PayloadError(`\`${eventKey}\` needs a name in at least one locale`);
    }
    payload.i18n = names;

    if (readingsTier !== 'none') {
        const readings = next.readings ?? {};
        const meaningful = Object.fromEntries(
            Object.entries(readings).filter(([, entry]) => !isBlankEntry(entry))
        );
        if (Object.keys(meaningful).length > 0) {
            payload.readings = meaningful;
        }
    }

    return payload;
}
