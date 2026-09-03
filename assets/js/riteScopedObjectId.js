/**
 * The `<rite>/<calendarId>` form of an OpenFGA object id.
 *
 * Port of the API's `LiturgicalCalendar\Api\Services\RiteScopedObjectId`
 * (LiturgicalCalendarAPI #785 for the test scopes, #786/#788 for the data
 * resource types). The API is the authority; this module exists so the three
 * frontend surfaces that COMPOSE object ids — the access-request form
 * (`permission-requests.js`), the admin grant modal (`admin-permissions.js`)
 * and the admin-tests scope gate (`admin-tests.js`) — all compose the same
 * thing, instead of each growing its own string concatenation.
 *
 * A calendar id alone does not identify a calendar: the API's source tree is
 * partitioned by rite (`jsondata/sourcedata/rite/{rite}/calendars/...`), so
 * nothing stops the same diocese being defined under both rites. `lugano_ch`
 * only HAPPENS to be Ambrosian-only today. A grant on the bare id would be
 * ambiguous, and would silently widen to cover a Roman `lugano_ch` the moment
 * one existed. Hence:
 *
 *   diocesan_calendar:ambrosian/lugano_ch   diocesan_calendar_test:ambrosian/lugano_ch
 *   national_calendar:roman/US              national_calendar_test:roman/US
 *   wider_region:roman/Europe               rite_calendar:ambrosian/temporale
 *
 * `rite_calendar` (API #955) is the tier ABOVE nations, wider regions and
 * dioceses — the calendar belonging to a rite as a whole. It generalises
 * `general_roman_calendar`, which modelled that tier as though only the Roman
 * rite had one, and its ids are qualified for the same reason every other
 * calendar-naming type's are: `temporale` is a sub-resource KIND, one per rite,
 * not a unique id.
 *
 * `general_roman_calendar` and `general_roman_calendar_test` are RETIRED. The
 * prune milestone removed both from the FGA model outright
 * (CatholicOS/cdcf-infra#44), so nothing can be granted, checked or written on
 * them any more — this module composes no id for either. They survive only as
 * DISPLAY labels, because stored access requests and `audit_log` rows keep the
 * old names, permanently in the audit log's case; the ids on those historical
 * rows are bare, and are rendered as stored rather than qualified.
 * `rite_calendar_test` is the exception that proves the rule — its id IS the
 * rite (`rite_calendar_test:ambrosian`), so it is bare too.
 *
 * This module is deliberately dependency-free (no `@liturgical-calendar/components-js`
 * import) so it can be unit-tested without the browser importmap that supplies
 * that package at runtime.
 *
 * @module riteScopedObjectId
 */

/**
 * Separates the rite from the calendar id.
 *
 * `/` is safe in an OpenFGA object id — only whitespace, `:`, `#` and `*`
 * carry meaning there — and reads as the hierarchy it is: rite over calendar.
 * Mirrors `RiteScopedObjectId::SEPARATOR`.
 * @type {string}
 */
export const RITE_SEPARATOR = '/';

/** @type {string} The Roman rite id. Mirrors the API's `Rite::ROMAN`. */
export const ROMAN_RITE = 'roman';

/** @type {string} The Ambrosian rite id. Mirrors the API's `Rite::AMBROSIAN`. */
export const AMBROSIAN_RITE = 'ambrosian';

/**
 * Every rite the API knows about. Mirrors `LiturgicalCalendar\Api\Enum\Rite`.
 *
 * Used only for PARSING: an id whose prefix names no known rite is treated as
 * unqualified rather than as a rite called something else — the same rule
 * `RiteScopedObjectId::parse()` applies via `Rite::tryFrom()`.
 * @type {ReadonlyArray<string>}
 */
export const KNOWN_RITES = Object.freeze([ROMAN_RITE, AMBROSIAN_RITE]);

/**
 * Object types whose id names a calendar, and is therefore rite-qualified.
 * Mirrors the two branches of `AccessRequestRepository::isValidObjectIdForType()`
 * that call the parser.
 * @type {ReadonlyArray<string>}
 */
export const RITE_QUALIFIED_OBJECT_TYPES = Object.freeze([
    'national_calendar',
    'diocesan_calendar',
    'wider_region',
    'national_calendar_test',
    'diocesan_calendar_test',
    'rite_calendar',
]);

/**
 * Rite-qualified types that exist under the Roman rite ONLY.
 *
 * `roman/` is structurally correct for these, not a guess: the Ambrosian rite
 * has no national tier and no wider regions, and the API rejects
 * `national_calendar:ambrosian/*` and `wider_region:ambrosian/*` outright
 * (`isValidObjectIdForType()`; `RegionalDataParams::validateRiteCompatibility()`).
 * Only the diocesan tier and the rite tier itself exist under more than one rite.
 * @type {ReadonlyArray<string>}
 */
export const ROMAN_ONLY_OBJECT_TYPES = Object.freeze([
    'national_calendar',
    'wider_region',
    'national_calendar_test',
]);

/**
 * Whether this object type's ids carry a `<rite>/` prefix.
 * @param {string} objectType - An OpenFGA object type.
 * @returns {boolean} True when ids of this type are rite-qualified.
 */
export function isRiteQualifiedObjectType(objectType) {
    return RITE_QUALIFIED_OBJECT_TYPES.includes(objectType);
}

/**
 * Split a rite-qualified object id back into its rite and calendar id.
 *
 * Returns null when the id is NOT rite-qualified — an unmigrated legacy id
 * such as a bare `rotter_nl`, or a prefix that names no known rite. Callers
 * decide what an unqualified id means for them. Mirrors
 * `RiteScopedObjectId::parse()`.
 *
 * @param {string} objectId - The raw object id.
 * @returns {{rite: string, id: string}|null} The split, or null when unqualified.
 */
export function parseRiteQualifiedId(objectId) {
    if (typeof objectId !== 'string') return null;
    const idx = objectId.indexOf(RITE_SEPARATOR);
    if (idx === -1) return null;
    const rite = objectId.slice(0, idx);
    const id = objectId.slice(idx + RITE_SEPARATOR.length);
    if (!KNOWN_RITES.includes(rite) || id === '') return null;
    return { rite, id };
}

/**
 * The rite a given object type's id must carry.
 *
 * For the Roman-only types the answer is `roman` whatever the caller passes —
 * the caller has no say, because the API has none either. For
 * `diocesan_calendar` / `diocesan_calendar_test` the rite is the diocese's own,
 * which the caller must supply (in practice from the `/calendars` metadata,
 * via the `RiteSelect` the diocesan CalendarSelect is linked to).
 *
 * @param {string} objectType - An OpenFGA object type.
 * @param {string} [rite] - The rite the UI announced for this calendar.
 * @returns {string} The rite to qualify with.
 */
export function riteForObjectType(objectType, rite) {
    if (ROMAN_ONLY_OBJECT_TYPES.includes(objectType)) return ROMAN_RITE;
    return KNOWN_RITES.includes(rite) ? rite : ROMAN_RITE;
}

/**
 * Compose the object id to send to the API for this type.
 *
 * Idempotent: an id that already carries a known rite prefix is returned
 * unchanged, so a value round-tripped out of the API and back in is not
 * double-qualified. Types with bare ids (`rite_calendar_test`, whose id IS the
 * rite; the retired `general_roman_calendar` pair, which can still arrive on a
 * historical row; and anything unknown) pass through untouched — qualifying
 * those would invent a rite for a resource that has none, and would rewrite a
 * stored historical id into one its own type never validated.
 *
 * @param {string} objectType - An OpenFGA object type.
 * @param {string} objectId - The bare calendar id as chosen in the UI.
 * @param {string} [rite] - The rite the UI announced for this calendar.
 * @returns {string} The object id in the form the API validates.
 */
export function qualifyObjectId(objectType, objectId, rite) {
    if (!isRiteQualifiedObjectType(objectType)) return objectId;
    if (typeof objectId !== 'string' || objectId === '') return objectId;
    if (parseRiteQualifiedId(objectId) !== null) return objectId;
    return riteForObjectType(objectType, rite) + RITE_SEPARATOR + objectId;
}

/**
 * Split any stored object id into its rite and bare calendar id, tolerating
 * legacy unqualified ids.
 *
 * Grants written before the API migration carry bare ids, and the API keeps
 * accepting them for the whole migration window — so anything READ back (an
 * existing tuple, a stored access request, a `/auth/test-scopes` entry) may be
 * in either form. Unqualified ids resolve to the Roman rite, which is what the
 * API's own migration infers for every type but the diocesan one, and the only
 * rite that existed when those ids were written.
 *
 * For a type with bare ids the whole id is returned as `id`, with `rite` set to
 * the Roman rite so callers can compare uniformly.
 *
 * @param {string} objectType - An OpenFGA object type.
 * @param {string} objectId - The raw object id, qualified or not.
 * @returns {{rite: string, id: string}} The rite and the bare calendar id.
 */
export function splitObjectId(objectType, objectId) {
    const raw = typeof objectId === 'string' ? objectId : '';
    if (!isRiteQualifiedObjectType(objectType)) {
        return { rite: ROMAN_RITE, id: raw };
    }
    const parsed = parseRiteQualifiedId(raw);
    return parsed === null ? { rite: ROMAN_RITE, id: raw } : parsed;
}

/**
 * The calendar id with any rite qualifier stripped — for display, and for
 * pre-filling a UI control whose option values are bare calendar ids.
 * Mirrors `RiteScopedObjectId::calendarId()`.
 *
 * @param {string} objectType - An OpenFGA object type.
 * @param {string} objectId - The raw object id, qualified or not.
 * @returns {string} The bare calendar id.
 */
export function bareCalendarId(objectType, objectId) {
    return splitObjectId(objectType, objectId).id;
}

/**
 * Whether two object ids of the same type name the same resource, across the
 * qualified/unqualified boundary.
 *
 * The comparison a permission gate needs while both forms are in circulation:
 * a legacy `national_calendar_test:IT` grant still authorizes a test whose
 * scope now derives as `national_calendar_test:roman/IT`.
 *
 * @param {string} objectType - The OpenFGA object type both ids belong to.
 * @param {string} a - One object id.
 * @param {string} b - The other object id.
 * @returns {boolean} True when both name the same rite and calendar.
 */
export function sameObjectId(objectType, a, b) {
    const left = splitObjectId(objectType, a);
    const right = splitObjectId(objectType, b);
    return left.rite === right.rite && left.id === right.id;
}

/** @type {string} The rite-level calendar object type. Mirrors `RiteCalendarObjectIds::TYPE`. */
export const RITE_CALENDAR_TYPE = 'rite_calendar';

/**
 * The `rite_calendar` sub-resources that are not missal editions.
 *
 * Mirrors `RiteCalendarObjectIds::FIXED_IDS`. `temporale` exists for both rites
 * (each has its own `propriumdetempore`); `decrees` and `supported_locales` are
 * Roman-only, because only `rite/roman/decrees` exists and
 * `supportedLocales.json` is itself keyed `general_roman_calendar` at its top
 * level.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const RITE_CALENDAR_FIXED_IDS = Object.freeze({
    [ROMAN_RITE]: Object.freeze(['temporale', 'decrees', 'supported_locales']),
    [AMBROSIAN_RITE]: Object.freeze(['temporale']),
});

/*
 * `legacyRiteCalendarObject()` and `LEGACY_RITE_CALENDAR_TYPE` lived here, giving
 * the pre-#955 object that denoted the same resource as a `rite_calendar` one.
 * Both are gone at the prune milestone, mirroring the API dropping
 * `RiteCalendarObjectIds::legacyCounterpart()` (LiturgicalCalendarAPI#970): the
 * `general_roman_calendar` type was removed from the FGA model outright
 * (CatholicOS/cdcf-infra#44), so the pairing has nothing left to point at.
 *
 * Note this is NOT a licence to drop the type from DISPLAY maps. Stored access
 * requests and `audit_log` rows keep the old names, permanently in the audit
 * log's case — see the objectTypeNames maps in admin-permissions.js and
 * permission-requests.js, which deliberately still carry both spellings.
 */
