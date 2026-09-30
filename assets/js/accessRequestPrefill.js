/**
 * Parses the access-request form's deep-link query string
 * (`?object_type=...&object_id=...`) into a prefill for its first permission
 * row.
 *
 * The link is built by `actionUrl()` in `particularCalendarsTree.js` (the
 * navigator hub's "Request access" action), which only ever names one of the
 * three calendar-scoped types the `calendar_editor` role allows and a
 * rite-qualified id in the form `qualifyObjectId()` composes
 * (`riteScopedObjectId.js`: `<roman|ambrosian>/<calendarId>`). Anything else
 * — an unknown `object_type`, a missing/empty `object_id`, or an id that
 * doesn't look rite-qualified — is treated as "no prefill" rather than an
 * error: the form simply opens untouched.
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
 * A rite-qualified object id: `<roman|ambrosian>/<calendarId>`. Mirrors the
 * id shape `qualifyObjectId()` composes and `parseRiteQualifiedId()` accepts
 * in `riteScopedObjectId.js`.
 * @type {RegExp}
 */
const OBJECT_ID_PATTERN = /^(roman|ambrosian)\/[A-Za-z0-9_-]{1,64}$/;

/**
 * @param {string} search - `location.search`, with or without its leading `?`
 * @returns {{object_type: string, object_id: string}|null} The prefill, or
 *   `null` when the query names no valid prefill.
 */
export function parseAccessRequestPrefill(search) {
    const params = new URLSearchParams(search ?? '');

    const objectType = params.get('object_type');
    if (!PREFILLABLE_OBJECT_TYPES.includes(objectType)) return null;

    const objectId = params.get('object_id');
    if (typeof objectId !== 'string' || !OBJECT_ID_PATTERN.test(objectId)) return null;

    return { object_type: objectType, object_id: objectId };
}
