/**
 * Parses the access-request form's deep-link query string
 * (`?object_type=...&object_id=...[&relation=admin]`) into a prefill for its
 * first permission row.
 *
 * The link is built by `actionUrl()` in `particularCalendarsTree.js` (the
 * navigator hub's "Request access" action), which only ever names one of the
 * three calendar-scoped types the `calendar_editor` role allows and a
 * rite-qualified id in the form `qualifyObjectId()` composes
 * (`riteScopedObjectId.js`: `<roman|ambrosian>/<calendarId>`). Anything else
 * — an unknown `object_type`, a missing/empty `object_id`, an id that
 * doesn't look rite-qualified, or a non-Roman rite on a Roman-only type
 * (`national_calendar`, `wider_region` — mirrors `ROMAN_ONLY_OBJECT_TYPES` in
 * `riteScopedObjectId.js`), or a `relation` other than `editor`/`admin` — is
 * treated as "no prefill" rather than an error:
 * the form simply opens untouched. No coercion: an invalid rite is rejected,
 * never silently rewritten to `roman`.
 *
 * Dependency-free (no `@liturgical-calendar/components-js` import) like
 * `riteScopedObjectId.js`, so it can be unit-tested without the browser
 * importmap that supplies that package at runtime.
 *
 * @module accessRequestPrefill
 */

/**
 * The object types the navigator's "Request access" link can name — the
 * three calendar scopes the `calendar_editor` role covers. Kept as a literal
 * list rather than imported from each picker module (`nationObjectIdSelect.js`,
 * `dioceseObjectIdPicker.js`, `widerRegionObjectIdSelect.js`) to keep this
 * module dependency-free; permission-requests.js still cross-checks the
 * result against `roleObjectTypes.calendar_editor`, the source of truth.
 * @type {ReadonlyArray<string>}
 */
export const PREFILLABLE_OBJECT_TYPES = Object.freeze([
    'national_calendar',
    'diocesan_calendar',
    'wider_region',
]);

/**
 * Of `PREFILLABLE_OBJECT_TYPES`, the ones that exist under the Roman rite
 * only. Mirrors `ROMAN_ONLY_OBJECT_TYPES` in `riteScopedObjectId.js` (minus
 * `national_calendar_test`, which this module never prefills). The Ambrosian
 * rite has no national tier and no wider regions, so an id qualified with any
 * other rite for one of these types names nothing the API would accept.
 * @type {ReadonlyArray<string>}
 */
const ROMAN_ONLY_OBJECT_TYPES = Object.freeze(['national_calendar', 'wider_region']);

/**
 * A rite-qualified object id: `<roman|ambrosian>/<calendarId>`. Mirrors the
 * id shape `qualifyObjectId()` composes and `parseRiteQualifiedId()` accepts
 * in `riteScopedObjectId.js`. The rite is captured so it can be checked
 * against `ROMAN_ONLY_OBJECT_TYPES` below.
 * @type {RegExp}
 */
const OBJECT_ID_PATTERN = /^(roman|ambrosian)\/([A-Za-z0-9_-]{1,64})$/;

/**
 * The relations a prefill may request. `actionUrl()` names `admin` on a
 * calendar not yet created (creating one needs admin, API #669) and no
 * relation otherwise, which means `editor`.
 * @type {ReadonlyArray<string>}
 */
const PREFILLABLE_RELATIONS = Object.freeze(['editor', 'admin']);

/** The relation a prefill requests when the query names none. */
const DEFAULT_RELATION = 'editor';

/**
 * @param {string} search - `location.search`, with or without its leading `?`
 * @returns {{object_type: string, object_id: string, relation: string}|null}
 *   The prefill, or `null` when the query names no valid prefill.
 */
export function parseAccessRequestPrefill(search) {
    const params = new URLSearchParams(search ?? '');

    const objectType = params.get('object_type');
    if (!PREFILLABLE_OBJECT_TYPES.includes(objectType)) return null;

    const objectId = params.get('object_id');
    const match = typeof objectId === 'string' ? OBJECT_ID_PATTERN.exec(objectId) : null;
    if (!match) return null;

    const [, rite] = match;
    if (ROMAN_ONLY_OBJECT_TYPES.includes(objectType) && rite !== 'roman') return null;

    const relation = params.get('relation') ?? DEFAULT_RELATION;
    if (!PREFILLABLE_RELATIONS.includes(relation)) return null;

    return { object_type: objectType, object_id: objectId, relation };
}
