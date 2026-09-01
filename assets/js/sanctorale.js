/**
 * Sanctorale viewer.
 *
 * A Roman Missal file is a DELTA, not a sanctorale: `propriumdesanctis_2008` is
 * three rows. So this page composes the missal layers that apply to a chosen
 * rite and calendar, badges each row with the layer that supplied it, and groups
 * the result by month — which is what a reader means by "the sanctorale".
 *
 * See docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md.
 *
 * The same modal is also the editor: opened from a row's Edit button it renders
 * the entry as a form and writes it back with
 * `PUT|PATCH|DELETE /missals/{rite}/{missal_id}/{event_key}`. Which rows offer
 * that button is decided per Missal by capabilities.js; what the API actually DID
 * with a write is decided by writeDisposition.js, because a change request queued
 * for review answers the SAME 2xx as a write that reached disk — so only an
 * `applied` disposition may touch local state.
 *
 * @module sanctorale
 */

import { ReadingsRenderer } from '@liturgical-calendar/components-js';
import { detectMissalCapabilities } from './capabilities.js';
import { describeWriteOutcome } from './writeDisposition.js';
import {
    gradeDisplayMode,
    gradeDisplayValue,
    buildPatch,
    buildCreate,
    isValidEventKey,
    EVENT_KEY_PATTERN,
    PayloadError
} from './sanctorale-payload.js';

const config = window.SanctoraleConfig;

if (!config) {
    console.error('SanctoraleConfig not found');
}

const { apiUrl, locale, i18n } = config ?? { apiUrl: '', locale: 'en', i18n: {} };

/**
 * The region carrying a rite's base missals — the editions that apply to every
 * calendar in that rite, as opposed to a national missal that applies to one.
 *
 * Needed because the marker is not uniform: the Roman typical editions carry the
 * Vatican's `VA`, while the Ambrosian edition carries `AMBROSIAN`, which is not a
 * nation code at all. A rite whose catalogue has only one region needs no entry
 * here — see baseRegionFor().
 */
const RITE_BASE_REGION = { roman: 'VA', ambrosian: 'AMBROSIAN' };

const el = (id) => document.getElementById(id);

const dom = {
    rite:        el('riteSelect'),
    calendar:    el('calendarSelect'),
    locale:      el('localeSelect'),
    from:        el('fromSelect'),
    search:      el('sanctoraleSearch'),
    tabs:        el('monthTabs'),
    tableBody:   el('sanctoraleTableBody'),
    notice:      el('sanctoraleNotice'),
    detailModal: el('detailModal'),
    detailTitle: el('detailModalTitle'),
    detailBody:  el('detailModalBody'),
    detailFooter: el('detailModalFooter'),
    saveEntry:   el('saveEntryBtn'),
    deleteEntry: el('deleteEntryBtn'),
    formError:   el('entryFormError'),
    newEntry:    el('newEntryBtn')
};

const state = {
    rite: 'roman',
    calendar: '',
    missals: [],
    baseRegion: null,
    metadata: null,
    /** The locale the celebration names are requested in, as a BCP-47 tag. */
    nameLocale: '',
    /** Show only celebrations contributed by this missal; '' means all. */
    fromMissal: '',
    composed: [],
    month: new Date().getUTCMonth() + 1,
    search: '',
    capabilities: new Map(),
    /**
     * The event_key the detail modal is currently open on, mirrored into the
     * hash as `event=` so a link can address one celebration and land on its
     * month tab. Empty when no modal is open. See showDetail(), showCreate()
     * and the `hidden.bs.modal` listener in init().
     */
    event: ''
};

/**
 * The shape a blank readings entry starts out as.
 *
 * `ReadingsFerial`'s four keys are exactly `MissalsHandler::emptyReadings()` —
 * the placeholder the API itself fans out into every readings locale file on the
 * first write to an entry, and what the corpus already stores for an uncurated
 * one (all fourteen US_2011 entries carry exactly this in both of their
 * lectionary files). Defaulting to it means the form proposes the shape the API
 * would have written anyway; a curator whose celebration needs another one picks
 * it from the shape select, which is built from the schema rather than from a
 * list here — see `loadReadingsShapes()`.
 */
const DEFAULT_READINGS_SHAPE = 'ReadingsFerial';

/**
 * What the modal is currently editing. Separate from `state`, which is about the
 * composed view: this is torn down and rebuilt every time the modal opens.
 */
const editState = {
    eventKey: null,
    missalId: null,
    creating: false,
    editing: false,
    readingsTier: 'rite',
    /**
     * The readings shape the write target's panel is currently offering, and the
     * shape chosen for each slot of it when that shape is a nested one.
     *
     * One shape for the whole tier rather than one per locale: a celebration has
     * the same readings structure in every language it is curated in — only the
     * citations differ — so a per-locale shape would let a curator author a file
     * set the corpus has no example of and `SourceReadings` would then reject
     * unevenly, locale by locale.
     */
    readingsShape: DEFAULT_READINGS_SHAPE,
    readingsSlotShapes: {},
    /** The locales the readings write target carries, for rendering blanks. */
    readingsLocales: [],
    /**
     * The calendar a NEW entry belongs to. An existing entry carries its own, so
     * this is only ever consulted when creating one, where no row exists to read.
     */
    calendarLabel: null,
    /** The entry as loaded, which every diff is taken against. */
    original: { structure: {}, i18n: {}, readings: {} },
    capability: { canEdit: false, canCreate: false, canDelete: false }
};

/**
 * Report what the API DID with a write, and say whether local state may follow.
 *
 * A response may carry `disposition: "submitted"` with nothing written, and the
 * handler's `success` string is built in both modes — so echoing it would tell an
 * editor their work was saved when it was only queued.
 *
 * @param {object|null} data the parsed response body
 * @param {string} appliedMessage what to say when the write reached disk
 * @returns {{applied: boolean, message: string, severity: string}}
 */
function reportWrite(data, appliedMessage) {
    const outcome = describeWriteOutcome(data, i18n, appliedMessage);
    // `window.showToast` is the shared helper layout/footer.php loads globally
    // (assets/js/toast.js); an ES module declaration never lands on `window`, so
    // its absence is a real possibility and falls back to the page notice.
    if (typeof window.showToast === 'function') {
        window.showToast(outcome.message, outcome.severity);
    } else {
        notice(outcome.severity === 'success' ? 'success' : 'info', escapeHtml(outcome.message));
    }
    return outcome;
}

/** i18n payloads are per missal and never change within a session. */
const i18nCache = new Map();

/**
 * Bumped whenever the selection changes. Loading a catalogue and composing a
 * sanctorale are several awaits apart, so without this a slow request for an
 * abandoned selection can still commit its results over the current one.
 */
let selectionSeq = 0;

/** The same guard for the detail modal, which is opened per celebration. */
let detailSeq = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

/**
 * Month names in the page's own locale.
 *
 * `timeZone: 'UTC'` per the project-wide rule: without it a date constructed at
 * midnight UTC can format as the previous month west of Greenwich.
 */
const monthName = (m) => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2001, m - 1, 1)));

class HttpError extends Error {
    constructor(status, path) {
        super(`HTTP ${status} for ${path}`);
        this.status = status;
    }
}

/**
 * Fetch JSON from the API.
 *
 * `credentials` defaults to `'omit'`: the `/missals`, `/lectionary` and
 * `/calendars` reads this drives are public and answer `Access-Control-Allow-Origin: *`,
 * which a browser refuses to pair with credentials. `checkAllowed()` below is the
 * one caller that passes `'include'` explicitly — `/admin/permissions/check` is an
 * authenticated endpoint and answers 401 without a cookie.
 *
 * @param {string} path
 * @param {Record<string,string>} [headers]
 * @param {'omit'|'include'} [credentials]
 * @returns {Promise<object>}
 */
async function getJson(path, headers = {}, credentials = 'omit') {
    const response = await fetch(`${apiUrl}${path}`, {
        headers: { Accept: 'application/json', ...headers },
        credentials
    });
    if (!response.ok) {
        throw new HttpError(response.status, path);
    }
    return response.json();
}

/**
 * What the user may do to a Missal; unknown Missals are read-only.
 *
 * Three capabilities, not one, because the API's relation map is not uniform:
 * `PATCH` (edit) needs `editor` while `PUT` (create) and `DELETE` both need
 * `admin`. See capabilities.js's module docblock.
 */
function capabilityFor(missalId) {
    return state.capabilities.get(missalId) ?? { canEdit: false, canCreate: false, canDelete: false };
}

/**
 * A failed write, carrying the API's own parsed body.
 *
 * The body matters: `assertKeyIdentity()` composes a 409 naming the editions and
 * dates that disagree, and that message is more useful beside the inputs that
 * caused it than a status code ever is.
 */
export class ApiWriteError extends Error {
    constructor(status, body) {
        super(`HTTP ${status}`);
        this.status = status;
        this.body = body;
    }
}

/** The address of one sanctorale entry. Every segment is encoded on its own. */
export function entryPath(rite, missalId, eventKey) {
    return `/missals/${encodeURIComponent(rite)}/${encodeURIComponent(missalId)}/${encodeURIComponent(eventKey)}`;
}

/**
 * Issue a write.
 *
 * Separate from getJson() and not a wrapper over it, because the two disagree on
 * the one setting that matters: the `/missals` and `/lectionary` reads are public
 * and answer `Access-Control-Allow-Origin: *`, which a browser refuses to pair
 * with credentials, while the write routes echo the validated origin and set
 * `allowCredentials`. A shared helper would have to be right about both.
 *
 * An unparseable body is `null`, never a throw: reading an empty 204 as a failure
 * is the bug issue #503 filed against the old editor.
 *
 * @param {'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path from entryPath()
 * @param {object} [body]
 * @returns {Promise<object|null>}
 * @throws {ApiWriteError}
 */
export async function writeJson(method, path, body) {
    const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        // Unparseable or empty (e.g. a 204) body resolves to `null` — not a failure. See #503.
    }

    if (!response.ok) {
        throw new ApiWriteError(response.status, data);
    }
    return data;
}

/**
 * The missals that apply to a calendar, oldest first.
 *
 * Data-driven rather than hardcoded: the typical editions carry region `VA` and
 * apply everywhere, and a national missal applies only to its own region. Sorting
 * by year is what makes "later wins" meaningful in compose().
 *
 * @param {Array<object>} missals
 * @param {string} calendar Region code, or '' for the General Roman calendar.
 */
/**
 * BCP-47 form. The metadata spells locales with underscores (`en_US`), which is
 * the gettext/ICU convention; `Accept-Language` and `Intl` both want hyphens.
 */
export const toBcp47 = (tag) => String(tag ?? '').replace(/_/g, '-');

/**
 * The locales a calendar is actually published in, from `/calendars` metadata.
 *
 * Three sources, because the metadata keeps three: the General Roman calendar's
 * own `locales`, an Ambrosian entry under `ambrosian_calendars`, and one entry
 * per nation under `national_calendars`. A national calendar publishes only its
 * own locales — US_2011 exists in `en_US` alone — so offering the General Roman
 * list there would advertise translations that do not exist.
 *
 * @param {object} metadata `litcal_metadata`
 * @param {string} rite
 * @param {string} calendar Region code, or '' for the rite's base calendar.
 * @returns {string[]} BCP-47 tags
 */
export function localesFor(metadata, rite, calendar) {
    if (!metadata) return [];

    if (rite === 'ambrosian') {
        const entry = (metadata.ambrosian_calendars ?? [])
            .find((c) => c.rite === 'ambrosian') ?? (metadata.ambrosian_calendars ?? [])[0];
        return (entry?.locales ?? []).map(toBcp47);
    }

    if (calendar) {
        const nation = (metadata.national_calendars ?? [])
            .find((c) => c.calendar_id === calendar);
        // A region with no national calendar entry still composes from the typical
        // editions, so fall back to the General Roman list rather than to nothing.
        if (nation) return (nation.locales ?? []).map(toBcp47);
    }

    return (metadata.locales ?? []).map(toBcp47);
}

/** The locale to preselect: the page's own if published, else the first offered. */
export function preferredLocale(available, pageLocale) {
    if (!available.length) return '';
    const page = toBcp47(pageLocale).toLowerCase();
    const exact = available.find((l) => l.toLowerCase() === page);
    if (exact) return exact;
    // en-US should settle for en when en-US is not published, and vice versa.
    const base = page.split('-')[0];
    const related = available.find((l) => l.toLowerCase().split('-')[0] === base);
    return related ?? available[0];
}

/**
 * The liturgical rank, as "number - name".
 *
 * The rows carry `grade` as a bare integer and no `grade_lcl`, so the name comes
 * from the page's own translated list rather than from the API. The number is
 * kept alongside it because it is what the data actually holds, what the schema
 * validates, and what a curator comparing two editions is looking at.
 *
 * `grade_display` is deliberately NOT folded in here — it is a display override,
 * a different fact, and it gets its own field. See gradeDisplayOf().
 *
 * @param {{grade?: number}} row
 * @param {Record<string,string>} strings
 */
export function formatGrade(row, strings) {
    const grade = row?.grade;
    const name  = strings?.grades?.[String(grade)];
    return name ? `${grade} - ${name}` : String(grade ?? '');
}

/**
 * The display override, or `null` when the celebration has none.
 *
 * THREE states, not two, and the difference is load-bearing:
 *
 * - **absent / null** — no override; show the rank.
 * - **`''`** — an authored override meaning "show no rank at all". `AllSouls` is
 *   the example: a Solemnity that is conventionally displayed without a rank, and
 *   `CalendarHandler` writes `''` for it explicitly. A HIGHER_SOLEMNITY is cleared
 *   to `''` the same way, since it carries no displayable grade of its own.
 * - **a non-empty string** — show that instead, e.g. US_2011's "National Holiday".
 *
 * Collapsing the empty string into "no override" would silently discard an
 * authored decision, and — once editing lands — write `null` back over a `''` the
 * curator meant. The write payload types the field as `string | null` for exactly
 * this reason.
 *
 * @param {{grade_display?: ?string}} row
 * @returns {?string} `null` for no override, otherwise the override (possibly '')
 */
export function gradeDisplayOf(row) {
    const override = row?.grade_display;
    return typeof override === 'string' ? override.trim() : null;
}

/**
 * Whether a locale's readings are nested one level into schemas.
 *
 * Some celebrations offer alternative sets rather than one: AllSouls carries
 * `schema_one`, `schema_two` and `schema_three`, each a complete set. The flat
 * shape maps reading names to citations; the nested shape maps schema names to
 * those maps.
 *
 * Delegates to `ReadingsRenderer.hasNestedSchemas`, the static form the library
 * added in 2.10.0 precisely so a consumer rendering readings its own way can
 * reach the predicate without constructing a renderer whose markup it does not
 * want. Re-exported under this page's own name because the modules and tests
 * here already address it that way — the implementation is the library's.
 *
 * @param {Record<string, unknown>} entry
 */
export function hasNestedSchemas(entry) {
    return ReadingsRenderer.hasNestedSchemas(entry ?? {});
}

/**
 * Canonical order first, then anything unexpected, so a new key still shows.
 *
 * Read from `ReadingsRenderer.massLabels` rather than restated here. This page
 * used to carry a hand-copied list because the renderer was not exported from
 * the package entry point; liturgy-components-js#97 exported it in 2.10.0, and
 * the library derives its own nested-schema keys from these same labels — so
 * reading the labels' keys is reading the whole schema vocabulary, render order
 * included, from the one place that defines it.
 *
 * Nesting is not only the schema_* triple: Assumption, StsPeterPaulAp and
 * NativityJohnBaptist nest as vigil/day, which is the shape that actually
 * carries content today.
 */
const SCHEMA_ORDER = Object.keys(ReadingsRenderer.massLabels);

/**
 * Canonical order and vocabulary for the readings WITHIN one schema.
 *
 * `readingOrder` interleaves each responsorial psalm directly after the reading
 * it answers, which is what makes a form built from it readable: the eight keys
 * that all label as "Responsorial Psalm" are never adjacent.
 */
const READING_ORDER = [...ReadingsRenderer.readingOrder];


/**
 * The readings shapes `CommonDef.json` defines, resolved from the schema at
 * runtime and cached for the page's lifetime.
 *
 * Hand-copying these is the bug class this page has been paying down (frontend
 * #526 is the same mistake made against `LitCommon`), and a copy would be wrong
 * in a way that is easy to miss: the union to offer is **`SourceReadings`**, not
 * `Readings`. The schema says why in its own description — `Readings` describes
 * OUTPUT, where a vigil Mass is a liturgical event in its own right with its own
 * `event_key`, so it does not admit `ReadingsWithVigil` or
 * `ReadingsChristmasWithVigil`. This editor writes SOURCE data, which does.
 *
 * @type {?Array<{id: string, title: string, kind: 'flat'|'nested'|'string', keys: string[]}>}
 */
let readingsShapes = null;

/**
 * A reading key's label, translated where the page has a translation and falling
 * back to the library's English.
 *
 * The fallback matters for forwards compatibility rather than for today: a key
 * the API adds after this page was last translated still renders with a real
 * label instead of `responsorial_psalm_7`.
 *
 * @param {string} key
 * @param {object} strings
 * @returns {string}
 */
function readingLabel(key, strings = i18n) {
    return strings.readings_labels?.[key] ?? ReadingsRenderer.readingLabels[key] ?? key;
}

/**
 * A reading map's keys in canonical order, with anything unrecognised kept at the
 * end so a key this page has never heard of is still shown rather than dropped.
 *
 * @param {Record<string, unknown>} readings
 * @returns {string[]}
 */
function readingKeysOf(readings) {
    const present = Object.keys(readings ?? {});
    const known = READING_ORDER.filter((k) => present.includes(k));
    const extra = present.filter((k) => !READING_ORDER.includes(k));
    return [...known, ...extra];
}

/**
 * Flatten a `oneOf` union of `$ref`s into the leaf definitions it admits.
 *
 * `SourceReadings` is a union of unions — its first branch is `Readings`, itself
 * a nine-branch union — so one pass would yield `Readings` as a "shape", which is
 * not one. `seen` guards a self-referential schema rather than any shape that
 * exists today.
 *
 * @param {string} name a definition name
 * @param {Record<string, object>} defs the schema's `definitions` map
 * @param {Set<string>} [seen]
 * @returns {string[]} leaf definition names, in schema order
 */
function unionLeaves(name, defs, seen = new Set()) {
    if (seen.has(name) || !defs[name]) return [];
    seen.add(name);
    const branches = defs[name].oneOf ?? defs[name].anyOf;
    if (!Array.isArray(branches)) return [name];
    return branches.flatMap((branch) => {
        const ref = typeof branch.$ref === 'string' ? branch.$ref.replace('#/definitions/', '') : null;
        return ref ? unionLeaves(ref, defs, seen) : [];
    });
}

/**
 * The readings shapes a curator may choose between, derived from the schema.
 *
 * Three kinds, and they are genuinely different rather than degrees of one:
 *
 * - `flat`   — reading key to citation. `ReadingsFerial` (the four-key default),
 *              `ReadingsFestive`, `ReadingsPalmSunday`, `ReadingsEasterVigil`.
 * - `nested` — Mass name to a whole set of readings: `ReadingsWithVigil`,
 *              `ReadingsChristmas`, `ReadingsMultipleSchemas` and the rest. Each
 *              slot carries a shape of its own.
 * - `string` — `ReadingsCommons`, which is a plain string naming the Common the
 *              readings are taken from, NOT an object. Memorials without a proper
 *              lectionary use it, so on a sanctorale it is a common answer rather
 *              than an exotic one, and a form that assumed every shape was an
 *              object would have no way to express it.
 *
 * A slot of a nested shape refs `Readings`, so in principle it could nest again;
 * only flat and string branches are offered there. The one combination that would
 * need in practice — a vigil alongside Christmas' three Masses — the schema gives
 * its own top-level shape, `ReadingsChristmasWithVigil`, which is exactly why that
 * definition exists.
 *
 * @param {object} schema a parsed `CommonDef.json`
 * @returns {Array<{id: string, title: string, kind: 'flat'|'nested'|'string', keys: string[]}>}
 */
export function resolveReadingsShapes(schema) {
    const defs = schema?.definitions ?? {};

    /** A property's declared target: a `$ref`'d definition name, or null. */
    const refName = (prop) =>
        typeof prop?.$ref === 'string' ? prop.$ref.replace('#/definitions/', '') : null;

    return unionLeaves('SourceReadings', defs).map((id) => {
        const def = defs[id] ?? {};
        const props = def.properties ?? {};
        const keys = Object.keys(props);

        // A slot of a NESTED shape holds a whole set of readings; a field of a flat
        // one holds one citation string. The test is therefore what the property
        // RESOLVES to — a definition with properties or branches of its own — and
        // not whether it refs the `Readings` union: the schema mostly refs a
        // CONCRETE shape instead (`ReadingsChristmas`'s three Masses are each a
        // `ReadingsFestive`), so a union-only test reads those four shapes as flat
        // and renders `night`/`dawn`/`day` as three text inputs.
        //
        // Testing the resolved target also keeps this from depending on the slot
        // NAMES, which would silently reclassify a shape the API adds later.
        const slotShapes = {};
        for (const key of keys) {
            const target = defs[refName(props[key]) ?? ''] ?? null;
            const isSet = target !== null
                && (target.properties !== undefined || Array.isArray(target.oneOf) || Array.isArray(target.anyOf));
            if (isSet) {
                // A slot refing a concrete shape declares its default; one refing a
                // union declares only that a choice is open, hence null.
                slotShapes[key] = Array.isArray(target.oneOf) || Array.isArray(target.anyOf)
                    ? null
                    : refName(props[key]);
            }
        }
        const nested = Object.keys(slotShapes).length > 0;

        return {
            id,
            title: def.title ?? id,
            kind: def.type === 'string' ? 'string' : (nested ? 'nested' : 'flat'),
            keys,
            /**
             * For a nested shape, the shape the schema declares for each slot —
             * `null` where the slot refs a union and the choice is genuinely open.
             * Empty for a flat or string shape.
             */
            slotShapes
        };
    });
}

/**
 * Which of the resolved shapes an existing readings entry already follows.
 *
 * An exact key-set match, so a partially filled entry does not masquerade as a
 * smaller shape: `ReadingsFestive` minus its `second_reading` is not
 * `ReadingsFerial`, it is a festive entry with a gap, and re-rendering it as
 * ferial would drop the gap out of the form and then out of the file. Falling
 * back to `null` leaves the entry's own keys rendered as they are.
 *
 * @param {unknown} entry one locale's readings
 * @param {Array<{id: string, kind: string, keys: string[]}>} shapes
 * @returns {?string} a shape id
 */
export function inferReadingsShape(entry, shapes) {
    if (typeof entry === 'string') {
        return shapes.find((s) => s.kind === 'string')?.id ?? null;
    }
    if (!entry || typeof entry !== 'object') return null;
    const present = Object.keys(entry).sort().join('|');
    return shapes.find((s) => s.kind !== 'string' && [...s.keys].sort().join('|') === present)?.id ?? null;
}

/**
 * `CommonDef.json`, fetched from the API and cached for the page's lifetime.
 *
 * A schema fetch rather than a copy in this file: the copy is the failure this
 * page keeps being bitten by, and a shape list that drifts from the schema would
 * offer a curator a shape the API then rejects — or, worse, silently omit one the
 * corpus already uses. Public endpoint, so `credentials: 'omit'` (see CLAUDE.md).
 */
async function loadReadingsShapes() {
    if (readingsShapes) return readingsShapes;
    readingsShapes = resolveReadingsShapes(await getJson('/schemas/CommonDef.json'));
    return readingsShapes;
}

/**
 * The schemas present across a tier's locales, in a stable order.
 *
 * A union rather than the first locale's keys: a locale missing one schema must
 * not remove that schema's tab for every other locale.
 */
export function schemaKeysOf(entries) {
    const seen = new Set();
    for (const entry of Object.values(entries ?? {})) {
        if (hasNestedSchemas(entry)) {
            Object.keys(entry).forEach((k) => seen.add(k));
        }
    }
    const known = SCHEMA_ORDER.filter((k) => seen.has(k));
    const extra = [...seen].filter((k) => !SCHEMA_ORDER.includes(k)).sort();
    return [...known, ...extra];
}

/**
 * Narrow a lectionary response's tiers to the ones the selected calendar actually
 * uses.
 *
 * `GET /lectionary/{rite}/sanctorale/{event_key}` is scoped by RITE, not by
 * calendar, so its `readings` array can carry tiers from Missals the selected
 * calendar never uses — StPeterClaver's US_2011 and IT_1983 tiers both ride along
 * when viewing the General Roman Calendar, and IT_1983's still rides along when
 * viewing the US calendar. The rite-level corpus (`tier.tier === 'rite'`) applies
 * to everything in the rite and is always kept; a `missal` tier is kept only when
 * its `source_id` is one of `applicableMissals()`'s ids. The caller owns that call
 * — routing through the page's one existing definition of "applies here" is the
 * point, rather than this function keeping a second, looser answer that can drift.
 *
 * @param {Array<object>} tiers a `/lectionary` response's `readings` array
 * @param {Set<string>|Array<string>} applicableMissalIds ids from applicableMissals()
 * @returns {Array<object>}
 */
export function applicableTiers(tiers, applicableMissalIds) {
    const ids = applicableMissalIds instanceof Set ? applicableMissalIds : new Set(applicableMissalIds ?? []);
    return (tiers ?? []).filter((tier) => tier.tier === 'rite' || ids.has(tier.source_id));
}

export function baseRegionFor(missals, rite) {
    const regions = [...new Set(missals.map((m) => m.region))];
    // A rite with a single region has no national missals to distinguish, so every
    // one of its missals is a base missal. This is what makes the Ambrosian rite
    // work without special-casing it at the call site.
    if (regions.length <= 1) {
        return regions[0] ?? null;
    }
    return RITE_BASE_REGION[rite] ?? regions[0];
}

export function applicableMissals(missals, calendar, baseRegion) {
    return missals
        .filter((m) => m.region === baseRegion || (calendar !== '' && m.region === calendar))
        .sort((a, b) => (a.year_published ?? 0) - (b.year_published ?? 0));
}

/**
 * Flatten the missal layers into one sanctorale.
 *
 * Keyed by `event_key`, later missal wins, and every row remembers which layer
 * supplied it. Overrides are rare but real — US_2011 redefines StIsidore — and a
 * reader cannot make sense of the result without being told where a row came from.
 *
 * Every row also keeps `_declaredBy`: the WHOLE chain of layers that declared its
 * key, oldest first, each with the row that layer supplied. Keeping only the
 * winner and the id of the loser — which is all `_overrides` records, and only
 * for the immediately preceding layer — was enough to say THAT something was
 * overridden but never WHAT changed, because the superseded row was thrown away.
 * That is frontend #524, and it is why the chain is retained here rather than
 * recomputed later: this is the one place that sees every layer in order.
 *
 * The rows in the chain are the layers' own, unannotated. The composed row is the
 * last chain entry's row plus the `_` fields, so `_declaredBy` carries no copy of
 * itself and the structure stays finite.
 *
 * `_overrides` is unchanged and still names only the immediately preceding layer:
 * the row badge means "this Missal redefines something an earlier one had", which
 * is exactly a one-step fact.
 *
 * @param {Array<{missal: object, rows: Array<object>}>} layers oldest first
 */
export function compose(layers) {
    const byKey = new Map();
    for (const { missal, rows } of layers) {
        for (const row of rows) {
            const previous = byKey.get(row.event_key);
            const declaration = {
                missalId: missal.missal_id,
                missalYear: missal.year_published,
                missalRegion: missal.region,
                row
            };
            byKey.set(row.event_key, {
                ...row,
                _missalId: missal.missal_id,
                _missalYear: missal.year_published,
                _overrides: previous ? previous._missalId : null,
                _declaredBy: [...(previous?._declaredBy ?? []), declaration]
            });
        }
    }
    return [...byKey.values()].sort((a, b) => (a.month - b.month) || (a.day - b.day));
}

/**
 * The fields a redeclaration can meaningfully change.
 *
 * The structure row only: names and readings live in their own sidecar files and
 * are edited in their own panels, so a difference in them is not something one
 * Missal did TO another's declaration. `grade_display` is included because an
 * edition that only relabels the rank — US_2011 presenting Independence Day as
 * "National Holiday" — has changed something a reader can see.
 */
const REDECLARATION_FIELDS = ['date', 'grade', 'grade_display', 'color', 'common'];

/** One declaration's value for a comparable field, normalised for comparison. */
function redeclarationValue(row, field) {
    switch (field) {
        case 'date':
            return `${row?.month}-${row?.day}`;
        case 'color':
        case 'common':
            // Order is meaningful in the corpus and diffStructure() compares
            // element by element, so a reordering IS a change, not a false one.
            return (row?.[field] ?? []).join('|');
        case 'grade_display':
            // An override of '' is authored: it says the rank is deliberately not
            // displayed. Absent means no override at all. The two differ.
            return gradeDisplayOf(row);
        default:
            return row?.[field] ?? null;
    }
}

/**
 * What one declaration did to the one before it.
 *
 * Three outcomes, and the whole point of #524 is that they are genuinely
 * different things the page used to present identically:
 *
 * - `property`  — a later edition changed something. `US_2011` exists to raise
 *                 `StPeterClaver` from optional memorial to memorial and does
 *                 nothing else; a curator cannot see that today without opening
 *                 three files.
 * - `universal` — a celebration a PARTICULAR calendar had declared was taken up
 *                 by an editio typica at the same rank, leaving the particular
 *                 entry redundant. `IT_1983` declared `StPeterClaver` because he
 *                 was not in the 1970 General Roman Calendar; the 2002 typica
 *                 then took him universal. Nothing changed, but the reason
 *                 nothing changed is a fact about the calendar, not a null result.
 * - `none`      — the later declaration changes nothing and is not a promotion.
 *
 * `universal` is decided by REGION rather than by a missal-id pattern: an edition
 * whose region is the rite's base region is a typical edition, which is the same
 * test `applicableMissals()` already applies. Passing the base region in keeps
 * this function pure and keeps the one definition of "typical" at the call site.
 *
 * @param {object} previous the earlier declaration
 * @param {object} next the later one
 * @param {?string} baseRegion the rite's base region, from baseRegionFor()
 * @returns {{kind: 'property'|'universal'|'none', changes: Array<{field: string, from: *, to: *}>}}
 */
export function describeRedeclaration(previous, next, baseRegion = null) {
    const changes = [];
    for (const field of REDECLARATION_FIELDS) {
        const from = redeclarationValue(previous?.row, field);
        const to = redeclarationValue(next?.row, field);
        if (from !== to) {
            changes.push({ field, from, to });
        }
    }

    if (changes.length > 0) {
        return { kind: 'property', changes };
    }
    const promoted = baseRegion !== null
        && previous?.missalRegion !== baseRegion
        && next?.missalRegion === baseRegion;
    return { kind: promoted ? 'universal' : 'none', changes };
}

/**
 * A row's redeclarations, oldest first, each described.
 *
 * Empty for the overwhelming majority of celebrations, which one layer declares
 * and no other touches — so a caller can render nothing at all rather than an
 * empty panel saying so.
 *
 * @param {object} row a composed row
 * @param {?string} baseRegion
 * @returns {Array<{previous: object, next: object, kind: string, changes: Array<object>}>}
 */
export function redeclarationSteps(row, baseRegion = null) {
    const chain = row?._declaredBy ?? [];
    return chain.slice(1).map((next, i) => {
        const previous = chain[i];
        return { previous, next, ...describeRedeclaration(previous, next, baseRegion) };
    });
}

/**
 * Narrow to the celebrations a single missal contributes, or all of them.
 *
 * The count this yields for a missal is what it contributes to the COMPOSED
 * sanctorale, which is not always its own row count: where a later edition
 * overrides an earlier one, the row belongs to the later. That is the honest
 * number for "what comes from this edition", and it is the point of the filter.
 */
export function filterByMissal(composed, missalId) {
    return missalId ? composed.filter((r) => r._missalId === missalId) : composed;
}

/** Rows for one month, day-ordered, narrowed by the search term. */
export function rowsFor(composed, month, search) {
    const needle = search.trim().toLowerCase();
    return composed.filter((r) => r.month === month && matches(r, needle));
}

function matches(row, needle) {
    if (!needle) return true;
    return String(row.name ?? '').toLowerCase().includes(needle)
        || String(row.event_key ?? '').toLowerCase().includes(needle);
}

/**
 * Which months contain a search hit, so a search can move the reader to a month
 * that actually has one. Tabs hide eleven twelfths of the data from the browser's
 * own find; without this the search would silently miss most of it.
 */
export function monthsWithHits(composed, search) {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return [...new Set(composed.filter((r) => matches(r, needle)).map((r) => r.month))].sort((a, b) => a - b);
}

function renderTabs(visible) {
    const counts = new Map();
    for (const row of visible) {
        counts.set(row.month, (counts.get(row.month) ?? 0) + 1);
    }
    const hits = new Set(monthsWithHits(visible, state.search));

    dom.tabs.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const count  = counts.get(m) ?? 0;
        const active = m === state.month;
        // A sparse month reads as "3", not as a broken page.
        const badgeClass = hits.has(m) ? 'bg-primary' : 'bg-secondary';
        return `
            <li class="nav-item">
                <button class="nav-link ${active ? 'active' : ''}" data-month="${m}" type="button">
                    ${escapeHtml(monthName(m))}
                    <span class="badge ${badgeClass} ms-1">${count}</span>
                </button>
            </li>`;
    }).join('');

    dom.tabs.querySelectorAll('button[data-month]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.month = Number(btn.dataset.month);
            syncHash();
            render();
        });
    });
}

function renderTable(visible) {
    const rows = rowsFor(visible, state.month, state.search);
    if (!rows.length) {
        const empty = state.search ? i18n.noSearchHits : i18n.noEntries;
        dom.tableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">${escapeHtml(empty)}</td></tr>`;
        return;
    }
    dom.tableBody.innerHTML = rows.map((row) => `
        <tr>
            <td class="text-nowrap">${row.day}</td>
            <td>${escapeHtml(row.name ?? row.event_key)}</td>
            <td><code class="small">${escapeHtml(row.event_key)}</code></td>
            <td>
                <span class="badge bg-light text-dark border" title="${escapeHtml(i18n.fromMissal)}">${escapeHtml(row._missalId)}</span>
                ${row._overrides ? `<span class="badge bg-warning text-dark ms-1" title="${escapeHtml(i18n.overridesTitle)}">${escapeHtml(i18n.overrides)}</span>` : ''}
            </td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-dark"
                        data-event-key="${escapeHtml(row.event_key)}" data-missal="${escapeHtml(row._missalId)}">
                    <i class="fas fa-magnifying-glass me-1"></i>${escapeHtml(i18n.view)}
                </button>
                ${capabilityFor(row._missalId).canEdit ? `
                <button type="button" class="btn btn-sm btn-outline-primary ms-1"
                        data-edit-key="${escapeHtml(row.event_key)}" data-missal="${escapeHtml(row._missalId)}">
                    <i class="fas fa-pen me-1"></i>${escapeHtml(i18n.edit)}
                </button>` : ''}
            </td>
        </tr>`).join('');

    dom.tableBody.querySelectorAll('button[data-event-key]').forEach((btn) => {
        btn.addEventListener('click', () => showDetail(btn.dataset.eventKey, btn.dataset.missal));
    });
    dom.tableBody.querySelectorAll('button[data-edit-key]').forEach((btn) => {
        btn.addEventListener('click', () => showDetail(btn.dataset.editKey, btn.dataset.missal, true));
    });
}

function notice(variant, html) {
    dom.notice.innerHTML = html
        ? `<div class="alert alert-${variant}" role="alert">${html}</div>`
        : '';
}

function render() {
    const visible = filterByMissal(state.composed, state.fromMissal);
    renderTabs(visible);
    renderTable(visible);
}

/**
 * Offer each contributing missal, oldest first, with how many celebrations it
 * contributes. Selecting one is how a reader sees an edition's delta at a glance.
 */
function renderFromOptions() {
    const counts = new Map();
    for (const row of state.composed) {
        counts.set(row._missalId, (counts.get(row._missalId) ?? 0) + 1);
    }
    const ordered = applicableMissals(state.missals, state.calendar, state.baseRegion)
        .filter((m) => counts.has(m.missal_id));

    dom.from.innerHTML = [
        `<option value="">${escapeHtml(i18n.allMissals)} (${state.composed.length})</option>`
    ].concat(ordered.map((m) =>
        `<option value="${escapeHtml(m.missal_id)}">${escapeHtml(m.missal_id)} (${counts.get(m.missal_id)})</option>`
    )).join('');

    // A rite or calendar change can retire the selected missal entirely.
    if (state.fromMissal && !counts.has(state.fromMissal)) {
        state.fromMissal = '';
    }
    dom.from.value = state.fromMissal;
}

// ---------------------------------------------------------------- detail view

/**
 * One event across every layer that defines it: structure, all its names, and
 * its readings from whichever lectionary tiers carry them.
 *
 * @param {string} eventKey
 * @param {string} missalId
 * @param {boolean} [editing] open the entry as a form rather than as a reading
 */
async function showDetail(eventKey, missalId, editing = false) {
    // Opening B while A is still loading must not let A render into B's modal.
    // Taken FIRST, before any await and before any helper below can yield, and
    // re-checked immediately after the one await: every step that touches the
    // modal or editState sits on one side of that check or the other.
    const seq = ++detailSeq;

    openDetailShell(eventKey);
    const row = resetEditStateForEntry(eventKey, missalId, editing);

    // Names and readings are independent: a rite with no lectionary still has
    // names, so one failing must not blank the other. The schema and the
    // lectionary index ride along because a 404 on the readings route is the case
    // that most needs them — there is no response to read a shape or a locale set
    // off, and that is exactly when a blank form has to be offered.
    const [names, readings, shapes] = await Promise.allSettled([
        loadI18n(missalId),
        getJson(`/lectionary/${encodeURIComponent(state.rite)}/sanctorale/${encodeURIComponent(eventKey)}`),
        loadReadingsShapes()
    ]);

    if (seq !== detailSeq) return;

    // A shape select this page could not build its options for is worse than
    // none; renderReadingsEditable() falls back to the data's own keys.
    if (shapes.status === 'rejected') readingsShapes = null;

    recordDetailOriginals(names, readings, eventKey);
    dom.detailBody.innerHTML = renderDetailBody(row, names, readings, eventKey);

    // The lectionary INDEX is deliberately NOT awaited above. It is needed only
    // when the per-event route 404s — an entry nothing has curated yet — which is
    // the one case with no response to read a locale set off. Fetching it on every
    // modal open would put a request the common path never uses in front of the
    // form, and the modal is not usable until this whole function has rendered it.
    if (editState.editing && isNothingCuratedYet(readings)) {
        refreshCreateReadings(seq);
    }

    // The custom text only means anything in Custom mode, and is revealed with
    // the value it had rather than cleared: switching away and back must not
    // silently drop text the user has already typed.
    wireGradeDisplayToggle();
}

/**
 * Put the modal on screen in its loading state and address it in the URL.
 *
 * @param {string} eventKey
 */
function openDetailShell(eventKey) {
    dom.detailTitle.textContent = eventKey;
    dom.detailBody.innerHTML = `<p class="text-muted">${escapeHtml(i18n.loading)}</p>`;
    bootstrap.Modal.getOrCreateInstance(dom.detailModal).show();
    // Written immediately, not after showDetail()'s await: the URL should name
    // what is opening even while it is still loading, so a copy taken mid-load
    // is still a valid link back to this celebration.
    state.event = eventKey;
    syncHash();
}

/**
 * Tear down whatever the modal last held and rebuild `editState` for this entry,
 * then set the footer to match what the user may actually do to it.
 *
 * @param {string} eventKey
 * @param {string} missalId
 * @param {boolean} editing asked for by the caller; granted by the capability
 * @returns {object|undefined} the composed row, for the renderers
 */
function resetEditStateForEntry(eventKey, missalId, editing) {
    const row = state.composed.find((r) => r.event_key === eventKey);

    editState.eventKey = eventKey;
    editState.missalId = missalId;
    editState.creating = false;
    editState.calendarLabel = null;
    // Reset explicitly rather than relying on renderReadingsForm() to overwrite it:
    // the 404 branch renders no inputs and sets no tier, so a stale value from
    // whatever entry was open before this one must not leak into this one's payload.
    editState.readingsTier = 'rite';
    // Reset for the same reason `readingsTier` is: the 404 branch infers no shape,
    // so a stale one from whatever entry was open before must not decide which
    // fields this entry's blank form offers.
    editState.readingsShape = DEFAULT_READINGS_SHAPE;
    editState.readingsSlotShapes = {};
    editState.readingsLocales = [];
    editState.capability = capabilityFor(missalId);
    // Asked for by the caller, granted by the capability: a stale Edit button on
    // a row whose grant has since been revoked opens read-only rather than
    // offering a Save the API would refuse.
    editState.editing = editing && editState.capability.canEdit;
    editState.original = { structure: structureOf(row), i18n: {}, readings: {} };

    dom.detailFooter.classList.toggle('d-none', !editState.editing);
    // Delete belongs to an entry that exists and is being edited; a create modal
    // reuses this footer and must not offer to delete a row nothing has stored.
    dom.deleteEntry.classList.toggle('d-none', !(editState.editing && editState.capability.canDelete));
    dom.formError.textContent = '';

    return row;
}

/**
 * Record what was loaded as the baseline every diff is taken against.
 *
 * @param {PromiseSettledResult<object>} names
 * @param {PromiseSettledResult<object>} readings
 * @param {string} eventKey
 */
function recordDetailOriginals(names, readings, eventKey) {
    if (names.status === 'fulfilled') {
        // Only locales the file actually carries an entry for. A locale that is
        // ABSENT stays absent in the original, which is what lets diffLocaleMap
        // tell "cleared to blank" apart from "never had one".
        const coverage = names.value.coverage?.[eventKey] ?? {};
        for (const loc of names.value.locales ?? []) {
            if (coverage.missing?.includes(loc)) continue;
            editState.original.i18n[loc] = names.value.i18n?.[loc]?.[eventKey] ?? '';
        }
    }

    if (readings.status === 'fulfilled') {
        // The write target's tier ONLY — the one tier the form renders inputs for.
        // See resolveReadingsTarget(): the response is rite-scoped and routinely
        // carries tiers this Missal's write cannot reach.
        const { tier, target } = resolveReadingsTarget(readings.value);
        editState.readingsTier = tier;
        for (const [loc, entry] of Object.entries(target?.entries ?? {})) {
            editState.original.readings[loc] = entry;
        }

        // The shape the stored entry already follows, so the form opens describing
        // the data rather than imposing the default on it. Read off any one locale
        // — they share a structure, which is the same premise `editState.readingsShape`
        // rests on — and left at the default when nothing matches, in which case
        // renderLocaleFields() still renders the entry's own keys.
        const sample = Object.values(target?.entries ?? {})[0];
        const inferred = inferReadingsShape(sample, readingsShapes ?? []);
        editState.readingsShape = inferred ?? DEFAULT_READINGS_SHAPE;
        editState.readingsSlotShapes = {};
        if (inferred && sample && typeof sample === 'object') {
            const shape = (readingsShapes ?? []).find((s) => s.id === inferred);
            if (shape?.kind === 'nested') {
                for (const slot of shape.keys) {
                    editState.readingsSlotShapes[slot] =
                        inferReadingsShape(sample[slot], readingsShapes ?? [])
                        ?? shape.slotShapes?.[slot]
                        ?? DEFAULT_READINGS_SHAPE;
                }
            }
        }
    } else {
        // A 404 means nothing is curated yet, which is a normal state, not a
        // failure — but there is then no original to diff against.
        editState.original.readings = {};
    }
}

/**
 * The modal body: structure, names and readings, each as a form or as a reading
 * depending on `editState.editing`.
 *
 * @param {object|undefined} row
 * @param {PromiseSettledResult<object>} names
 * @param {PromiseSettledResult<object>} readings
 * @param {string} eventKey
 * @returns {string}
 */
function renderDetailBody(row, names, readings, eventKey) {
    return [
        editState.editing ? renderStructureForm(row) : renderStructure(row),
        names.status === 'fulfilled'
            ? (editState.editing ? renderNamesForm(names.value, eventKey) : renderNames(names.value, eventKey))
            : `<div class="alert alert-warning">${escapeHtml(i18n.namesUnavailable)}</div>`,
        // A 404 means nothing is curated for this event yet — a normal state, not a
        // failure. An editor gets a blank form for it rather than the read-only
        // "nothing curated" message: the tier and locales come from the lectionary
        // INDEX, which needs no event_key and so still answers when the per-event
        // route does not. That is the second half of frontend #525. Any other
        // rejection is a real failure and still reads as one.
        editState.editing && readings.status === 'fulfilled'
            ? renderReadingsForm(readings.value)
            : (editState.editing && isNothingCuratedYet(readings)
                // Filled in by refreshCreateReadings() once the lectionary index
                // names the write target's locales — see showDetail().
                ? '<div id="entryReadingsBlock"></div>'
                : renderReadingsOutcome(readings))
    ].join('');
}

/**
 * Reveal or hide the custom grade-display text input as the mode select
 * changes. Shared by showDetail() and showCreate(), which both render
 * renderStructureForm() into the modal.
 */
function wireGradeDisplayToggle() {
    el('entryGradeDisplayMode')?.addEventListener('change', (event) => {
        el('entryGradeDisplayText')?.classList.toggle('d-none', event.target.value !== 'custom');
    });
}

/**
 * The calendar label a Missal's rows carry.
 *
 * `buildRow()` refuses a payload whose `calendar` is not the Missal's own, and
 * every applicable Missal has at least one composed row to read it off.
 *
 * @param {string} missalId
 * @returns {string}
 */
function calendarLabelFor(missalId) {
    return state.composed.find((r) => r._missalId === missalId)?.calendar ?? '';
}

/**
 * Re-render the Names block for the Missal currently selected in the create
 * dialog's target picker.
 *
 * Genuinely load-bearing, not cosmetic: the locale set differs per edition —
 * US_2011 publishes `en_US` alone against the 1970 typica's fourteen. Without
 * this, switching the picker would leave the previous Missal's locale set on
 * screen and let a curator submit names into locales the chosen Missal does
 * not even publish.
 *
 * Guarded by `detailSeq`, the same token showDetail() uses: a curator who
 * flips between two Missals before the first `/i18n` fetch resolves must see
 * the SECOND choice's locales, not have the first overwrite it on arrival.
 */
async function refreshCreateNames() {
    const seq = ++detailSeq;
    const container = el('entryNamesBlock');
    if (!container) return;
    container.innerHTML = `<p class="text-muted">${escapeHtml(i18n.loading)}</p>`;

    let payload;
    try {
        payload = await loadI18n(editState.missalId);
    } catch {
        payload = null;
    }
    if (seq !== detailSeq) return;

    const block = el('entryNamesBlock');
    if (!block) return;
    block.innerHTML = payload
        ? renderNamesForm(payload, '')
        : `<div class="alert alert-warning">${escapeHtml(i18n.namesUnavailable)}</div>`;

    await refreshCreateReadings(seq);
}

/**
 * Fill the create modal's readings block, off the modal-open critical path.
 *
 * Also re-run when the target Missal changes: the readings target moves with it —
 * an edition that owns a lectionary folder writes into it, one that does not
 * writes into the shared rite corpus, and the two carry different locale sets.
 * Left stale, the panel would collect citations for locales the chosen edition
 * cannot store.
 *
 * Guarded by `detailSeq`, like every other await here, so a curator who flips
 * between two Missals before the first index fetch resolves sees the SECOND
 * choice's locales rather than having the first overwrite it on arrival.
 *
 * @param {number} seq the caller's detailSeq token
 */
async function refreshCreateReadings(seq) {
    if (!el('entryReadingsBlock')) return;

    const [shapes, target] = await Promise.allSettled([
        loadReadingsShapes(),
        readingsTargetFromIndex(editState.missalId)
    ]);
    if (seq !== detailSeq) return;

    if (shapes.status === 'rejected') readingsShapes = null;
    if (target.status === 'fulfilled') {
        // 'none' is a rite with no lectionary corpus (Ambrosian, API #957); the
        // handler REJECTS a create body carrying `readings` for it, so no panel.
        editState.readingsTier = target.value.tier;
        editState.readingsLocales = target.value.tier === 'none' ? [] : target.value.locales;
    }

    const block = el('entryReadingsBlock');
    if (block) block.innerHTML = renderReadingsBlank(editState.readingsLocales);
}

/**
 * Open the modal to create an entry.
 *
 * Two controls exist here and nowhere else. The Missal picker, because adding a
 * saint to US_2011 and adding one to the 1970 typica are different acts and the
 * UI must make the curator say which — it lists only editions they may CREATE in,
 * which is a narrower set than the ones they may edit: creating is `PUT`, and
 * `PUT` needs `admin` where an edit needs only `editor`. And
 * the event_key input, because the key is set once: the API refuses to rename
 * one, since a rename orphans its name and readings in every locale permanently.
 * That input is validated against the schema's `EventKey` pattern, in the HTML
 * `pattern=` attribute and again in saveEntry(), from the one shared constant.
 */
async function showCreate() {
    const editable = applicableMissals(state.missals, state.calendar, state.baseRegion)
        .filter((m) => capabilityFor(m.missal_id).canCreate)
        .reverse(); // newest first; applicableMissals sorts oldest-first for compose()

    if (editable.length === 0) return;

    const seq = ++detailSeq;

    editState.eventKey = '';
    editState.missalId = editable[0].missal_id;
    editState.creating = true;
    editState.editing = true;
    editState.capability = capabilityFor(editState.missalId);
    editState.original = { structure: {}, i18n: {}, readings: {} };
    editState.calendarLabel = calendarLabelFor(editState.missalId);
    editState.readingsTier = 'rite';
    editState.readingsShape = DEFAULT_READINGS_SHAPE;
    editState.readingsSlotShapes = {};
    editState.readingsLocales = [];

    // Nothing to address yet — a create dialog has no event_key until Save.
    // Cleared explicitly rather than left over from whatever showDetail() last
    // set: the `hidden.bs.modal` listener only fires once THIS modal closes, by
    // which point a stale `#event=` would already have been visible in the URL.
    if (state.event) {
        state.event = '';
        syncHash();
    }

    dom.detailTitle.textContent = i18n.newEntry;
    dom.detailFooter.classList.remove('d-none');
    dom.deleteEntry.classList.add('d-none');
    dom.formError.textContent = '';
    dom.detailBody.innerHTML = `<p class="text-muted">${escapeHtml(i18n.loading)}</p>`;
    bootstrap.Modal.getOrCreateInstance(dom.detailModal).show();

    // `loadI18n()` is the same cached loader showDetail() uses — it returns
    // `{locales, i18n, coverage}`, exactly what renderNamesForm() consumes.
    //
    // The readings target comes from the lectionary INDEX rather than the
    // per-event route, which is what makes a readings panel possible here at all:
    // there is no event_key yet to ask about, so the per-event route could only
    // ever answer 404. The index names the sources and their locales for the rite.
    // ONLY the names fetch is awaited here. The readings panel needs two more —
    // the schema and the lectionary index — and the index is genuinely expensive
    // (the API walks every source folder and every locale file in the rite to
    // build it). Awaiting all three would hold the modal shut behind the slowest,
    // for a panel that is not even the first thing a curator fills in, so the
    // readings block is filled in afterwards by refreshCreateReadings().
    let payload;
    try {
        payload = await loadI18n(editState.missalId);
    } catch {
        payload = null;
    }
    if (seq !== detailSeq) return;

    dom.detailBody.innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryTargetMissal">${escapeHtml(i18n.targetMissal)}</label>
                <select class="form-select" id="entryTargetMissal">
                    ${editable.map((m) => `<option value="${escapeHtml(m.missal_id)}">${escapeHtml(m.missal_id)}</option>`).join('')}
                </select>
            </div>
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryEventKey">${escapeHtml(i18n.eventKeyLabel)}</label>
                <input type="text" class="form-control" id="entryEventKey" pattern="${EVENT_KEY_PATTERN}">
                <div class="form-text">${escapeHtml(i18n.eventKeyHint)}</div>
            </div>
        </div>
        ${renderStructureForm(null)}
        <div id="entryNamesBlock">${payload
            ? renderNamesForm(payload, '')
            : `<div class="alert alert-warning">${escapeHtml(i18n.namesUnavailable)}</div>`}</div>
        <div id="entryReadingsBlock"></div>`;

    wireGradeDisplayToggle();
    refreshCreateReadings(seq);

    el('entryTargetMissal')?.addEventListener('change', (event) => {
        editState.missalId = event.target.value;
        editState.capability = capabilityFor(editState.missalId);
        editState.calendarLabel = calendarLabelFor(editState.missalId);
        // The calendar readback in the Structure panel is baked into innerHTML
        // rather than re-rendered wholesale, so it is updated directly here;
        // the payload itself always reads editState.calendarLabel fresh at
        // save time regardless (see readStructureForm()).
        const calendarField = el('entryCalendarLabel');
        if (calendarField) calendarField.textContent = editState.calendarLabel;
        refreshCreateNames();
    });
}

/**
 * Save the modal. The `#saveEntryBtn` click handler.
 *
 * A thin wrapper so that the lock on the write controls covers the whole of
 * performSave(), including its early returns — see withWriteControlsDisabled().
 */
async function saveEntry() {
    await withWriteControlsDisabled(performSave);
}

/**
 * Save the modal, assuming the write controls are already locked.
 *
 * Local state is updated ONLY when the write reached disk. In queue mode the
 * response carries the proposed payload rather than a stored resource, so
 * writing it into `state.composed` would show the user an entry the server may
 * never store.
 */
async function performSave() {
    dom.formError.textContent = '';

    // Read before validation, because the event_key rule below is stated over
    // `editState.eventKey` rather than over the input.
    if (editState.creating) {
        editState.eventKey = el('entryEventKey')?.value.trim() ?? '';
    }

    const next = {
        structure: readStructureForm(),
        i18n: readNamesForm(),
        readings: readReadingsForm()
    };

    const invalid = validateEntryForm(next);
    if (invalid !== null) {
        dom.formError.textContent = invalid;
        return;
    }

    let payload;
    try {
        payload = buildEntryPayload(next);
    } catch (error) {
        if (error instanceof PayloadError) {
            dom.formError.textContent = error.message === 'nothing changed' ? i18n.noChanges : error.message;
            return;
        }
        throw error;
    }

    const path = entryPath(state.rite, editState.missalId, editState.eventKey);
    try {
        const data = await writeJson(editState.creating ? 'PUT' : 'PATCH', path, payload);
        const outcome = reportWrite(data, editState.creating ? i18n.created : i18n.saved);
        const savedKey = editState.eventKey;
        closeEntryModal();
        if (outcome.applied) {
            await reloadAndFollow(savedKey);
        }
    } catch (error) {
        await reportSaveError(error);
    }
}

/**
 * What is wrong with the form, in the order the user should be told about it.
 *
 * The order is load-bearing, not incidental: a form with two faults reports the
 * FIRST, and reordering these silently changes which message the user sees.
 *
 * @param {{structure: object}} next the form as it currently reads
 * @returns {?string} the message to show, or null when the form is submittable
 */
function validateEntryForm(next) {
    // The schema's own rule, not an approximation of it: see EVENT_KEY_PATTERN.
    // A looser client rule lets `stIsidore` through to an opaque 400; a tighter
    // one refuses `StJohnBaptist_vigil` outright, which is how a vigil entry
    // became impossible to create.
    if (editState.creating && !isValidEventKey(editState.eventKey)) {
        return i18n.eventKeyHint;
    }

    // `Number(el('entryDay')?.value)` on a cleared or missing input lands on 0
    // or NaN depending on how it was cleared — neither is a day the API will
    // accept, and buildCreate()/buildPatch() have no opinion on range, only on
    // presence. Reported here, beside the input, rather than let it travel as
    // an opaque 400.
    if (!Number.isInteger(next.structure.day) || next.structure.day < 1 || next.structure.day > 31) {
        return i18n.invalidDay;
    }

    // The same problem for the two SELECTS, which differ from the day input in
    // that they always yield something: a create form left untouched submits
    // January and grade 0 (Weekday), both present and both wrong, so no presence
    // check can catch them. Checked on the RAW value — `next.structure` has
    // already coerced through Number(), where the placeholder's '' and a
    // deliberate grade of 0 (Weekday IS a legal grade) are the same number.
    if (editState.creating) {
        if (el('entryMonth')?.value === '') return i18n.chooseMonth;
        if (el('entryGrade')?.value === '') return i18n.chooseGrade;
    }

    return null;
}

/**
 * The body of the write: a whole entry when creating, a diff when editing.
 *
 * @param {object} next the form as it currently reads
 * @returns {object}
 * @throws {PayloadError} when there is nothing to send
 */
function buildEntryPayload(next) {
    return editState.creating
        ? buildCreate({ eventKey: editState.eventKey, next, readingsTier: editState.readingsTier })
        : buildPatch({ original: editState.original, next, readingsTier: editState.readingsTier });
}

/**
 * Report a failed write where the user can act on it.
 *
 * Rethrows anything that is not an API write failure: an unexpected error must
 * surface, not be flattened into a form message.
 *
 * @param {unknown} error
 */
async function reportSaveError(error) {
    if (!(error instanceof ApiWriteError)) throw error;
    if (error.status === 409) {
        // assertKeyIdentity() composes a message naming the editions and dates
        // that disagree. It belongs beside the day and month that caused it —
        // inline in the form, never as a toast that outlives the modal.
        dom.formError.textContent = `${i18n.conflictTitle}: ${error.body?.error ?? ''}`;
        return;
    }
    if (error.status === 403) {
        // The likeliest cause is a grant changing under a long-lived page.
        // The refresh is best effort — it exists only to stop the page offering
        // affordances the user no longer has. Telling the user their write was
        // refused is not best effort; it is the whole point of this branch, so
        // a rejected refresh must never swallow the message that follows it.
        try {
            await loadCatalogue();
        } catch {
            // Ignored: reporting the 403 below still has to happen.
        }
        dom.formError.textContent = i18n.permissionDenied;
        return;
    }
    dom.formError.textContent = i18n.saveFailed.replace('%s', error.body?.error ?? error.message);
}

/**
 * Close the entry modal and stop it addressing anything.
 *
 * `state.event` is cleared here rather than left for the `hidden.bs.modal`
 * listener, whose fade-out timing races the reload that follows: without this,
 * reload()'s own openDeepLinkedEvent() can still see the just-written key in
 * `state.event` and reopen the very modal the write just closed.
 */
function closeEntryModal() {
    bootstrap.Modal.getOrCreateInstance(dom.detailModal).hide();
    state.event = '';
}

/**
 * Reload the sanctorale and follow the written row to wherever it landed.
 *
 * Following matters because a curator who moves a celebration to another month
 * must SEE it move rather than have to go find it — and on a delete, because
 * removing an override reveals an earlier edition's row, which is usually but
 * not necessarily on the same date.
 *
 * @param {string} eventKey
 */
async function reloadAndFollow(eventKey) {
    await reload();
    const month = monthOf(state.composed, eventKey);
    if (month !== null && month !== state.month) {
        state.month = month;
        syncHash();
        render();
    }
}

/**
 * Lock Save and Delete for the duration of one write.
 *
 * `reload()` can take seconds, so the window in which a second click lands on a
 * still-open modal is real, and a doubled `PUT`/`DELETE` is not harmless. The
 * restore is in a `finally` so that success, failure, a rethrown error and every
 * validation early-return all re-enable the controls.
 *
 * @param {() => Promise<void>} work
 */
async function withWriteControlsDisabled(work) {
    setWriteControlsDisabled(true);
    try {
        await work();
    } finally {
        setWriteControlsDisabled(false);
    }
}

/** @param {boolean} disabled */
function setWriteControlsDisabled(disabled) {
    if (dom.saveEntry) dom.saveEntry.disabled = disabled;
    if (dom.deleteEntry) dom.deleteEntry.disabled = disabled;
}

/**
 * Delete the open entry.
 *
 * Admin-only, and confirmed by naming the Missal: deleting from the edition that
 * WON reveals whatever it overrode, so the row does not disappear, it changes.
 *
 * `readings_retained` is reported when true. The rite-level corpus is shared, so
 * a key another Missal still declares keeps its readings — and a curator who
 * deleted an entry and found its readings intact would otherwise read that as a
 * failed delete.
 */
async function deleteEntry() {
    await withWriteControlsDisabled(performDelete);
}

/** Delete the open entry, assuming the write controls are already locked. */
async function performDelete() {
    const confirmed = window.confirm(
        i18n.confirmDelete.replace('%1$s', editState.eventKey).replace('%2$s', editState.missalId)
    );
    if (!confirmed) return;

    const path = entryPath(state.rite, editState.missalId, editState.eventKey);
    try {
        const data = await writeJson('DELETE', path);
        const outcome = reportWrite(data, i18n.deleted);
        const deletedKey = editState.eventKey;
        closeEntryModal();
        if (outcome.applied) {
            if (data?.readings_retained === true && typeof window.showToast === 'function') {
                window.showToast(i18n.readingsRetained, 'info');
            }
            // A plain delete leaves nothing to follow — the row is simply gone,
            // and reloadAndFollow() stays put for it, monthOf() finding nothing.
            await reloadAndFollow(deletedKey);
        }
    } catch (error) {
        if (!(error instanceof ApiWriteError)) throw error;
        dom.formError.textContent = error.status === 403
            ? i18n.permissionDenied
            : i18n.saveFailed.replace('%s', error.body?.error ?? error.message);
    }
}

/**
 * A celebration with no curated readings answers 404, which is the SAME status a
 * bad event key gets. Reporting that as "could not load" would tell a reader the
 * request failed when in truth there is simply nothing there yet — so the two are
 * separated here, and only a non-404 is treated as a failure.
 *
 * @param {PromiseSettledResult<object>} settled
 */
/**
 * Whether a settled readings request means "nothing curated yet" rather than a
 * failure.
 *
 * The same 404 a bad event key gets, which is why this is stated once and shared:
 * `renderReadingsOutcome()` uses it to choose its message and `renderDetailBody()`
 * uses it to choose between a blank form and that message, and the two must not
 * come to different conclusions about the same response.
 *
 * @param {PromiseSettledResult<object>} settled
 * @returns {boolean}
 */
export function isNothingCuratedYet(settled) {
    return settled.status === 'rejected'
        && settled.reason instanceof HttpError
        && settled.reason.status === 404;
}

export function renderReadingsOutcome(settled, strings = i18n) {
    if (settled.status === 'fulfilled') {
        return renderReadings(settled.value, strings);
    }
    if (isNothingCuratedYet(settled)) {
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(strings.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(strings.noReadingsForEvent)}</div>`;
    }
    return `<div class="alert alert-warning">${escapeHtml(strings.readingsUnavailable)}</div>`;
}

export { HttpError };

async function loadI18n(missalId) {
    const cacheKey = `${state.rite}/${missalId}`;
    if (!i18nCache.has(cacheKey)) {
        i18nCache.set(cacheKey, await getJson(
            `/missals/${encodeURIComponent(state.rite)}/${encodeURIComponent(missalId)}/i18n`
        ));
    }
    return i18nCache.get(cacheKey);
}

/**
 * `GET /lectionary/{rite}/sanctorale` — the section index, cached per rite.
 *
 * The per-event route cannot answer this: an entry that does not exist yet has no
 * readings and gets a 404, which is precisely the state a create dialog is in. The
 * index is scoped to the rite rather than the event, so it names every source and
 * the locales each carries without needing an `event_key` at all.
 */
const lectionaryIndexCache = new Map();

async function loadLectionaryIndex() {
    if (!lectionaryIndexCache.has(state.rite)) {
        lectionaryIndexCache.set(
            state.rite,
            await getJson(`/lectionary/${encodeURIComponent(state.rite)}/sanctorale`)
        );
    }
    return lectionaryIndexCache.get(state.rite);
}

/**
 * Which tier a readings write for `missalId` would land in, and the locales that
 * tier carries — the index's answer to the question `resolveReadingsTarget()`
 * answers from a per-event response.
 *
 * The two must agree, and they agree because they apply the same rule: a `missal`
 * tier only when THIS Missal owns a lectionary folder of its own, otherwise the
 * rite-level corpus. `'none'` for a rite with no corpus at all (Ambrosian, API
 * #957), where a readings panel must not be offered.
 *
 * @param {string} missalId
 * @returns {Promise<{tier: 'missal'|'rite'|'none', locales: string[]}>}
 */
async function readingsTargetFromIndex(missalId) {
    let index;
    try {
        index = await loadLectionaryIndex();
    } catch {
        // A create dialog is still perfectly usable without a readings panel —
        // structure and names are what `buildCreate()` actually requires — so an
        // unreachable index degrades to "no readings offered" rather than failing
        // the whole modal.
        return { tier: 'none', locales: [] };
    }
    if (index?.lectionary_available === false) {
        return { tier: 'none', locales: [] };
    }
    const sources = index?.sources ?? [];
    const own = sources.find((s) => s.tier === 'missal' && s.source_id === missalId);
    const target = own ?? sources.find((s) => s.tier === 'rite') ?? null;
    return target
        ? { tier: own ? 'missal' : 'rite', locales: target.locales ?? [] }
        : { tier: 'none', locales: [] };
}

function renderStructure(row) {
    if (!row) return '';
    const field = (label, value) => `
        <div class="col-6 col-md-4 mb-2">
            <div class="small text-muted">${escapeHtml(label)}</div>
            <div>${escapeHtml(value)}</div>
        </div>`;
    // Rendered only when the data actually carries an override — on almost every
    // celebration there is none, and an empty field would be noise. An override of
    // '' is still an override: it says the rank is deliberately not displayed.
    const override = gradeDisplayOf(row);
    const overrideLabel = override === '' ? i18n.displaysAsNothing : override;

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.structure)}</h6>
        <div class="row mb-3">
            ${field(i18n.date, `${monthName(row.month)} ${row.day}`)}
            ${field(i18n.grade, formatGrade(row, i18n))}
            ${override !== null ? field(i18n.displaysAs, overrideLabel) : ''}
            ${field(i18n.calendarField, row.calendar)}
            ${field(i18n.color, (row.color ?? []).join(', '))}
            ${field(i18n.common, (row.common ?? []).join(', '))}
            ${field(i18n.fromMissal, row._missalId)}
        </div>
        ${renderRedeclarations(row)}`;
}

/**
 * How a redeclared field's value reads to a curator.
 *
 * `formatGrade()` rather than the bare integer: "2" and "3" are what the data
 * says, but "Optional memorial" and "Memorial" are what the change MEANS, and a
 * panel that exists to make a relationship legible must not make the reader
 * translate rank numbers.
 */
function redeclarationFieldValue(declaration, field, side) {
    const row = declaration?.row;
    switch (field) {
        case 'date':
            return `${monthName(row?.month)} ${row?.day}`;
        case 'grade':
            return formatGrade(row, i18n);
        case 'grade_display': {
            const value = side;
            if (value === null) return i18n.displaysAsNothingSet;
            return value === '' ? i18n.displaysAsNothing : value;
        }
        default:
            // color and common are joined lists; an empty one reads as a dash
            // rather than as blank, so the two columns stay aligned.
            return side === '' ? '—' : String(side).split('|').join(', ');
    }
}

const REDECLARATION_FIELD_LABEL = {
    date: 'date',
    grade: 'grade',
    grade_display: 'displaysAs',
    color: 'color',
    common: 'common'
};

/**
 * The redeclaration panel: who substituted whom, in order, and what it changed.
 *
 * frontend #524. The page used to badge a row "override" and name the losing
 * Missal, which says THAT one declaration replaced another but nothing about what
 * changed or why — so "US_2011 raised the rank from optional to obligatory
 * memorial" and "the 2002 typica took an Italian particular memorial universal,
 * changing nothing" rendered identically, though they are different acts.
 *
 * Only the Missals that apply to the selected calendar appear, because the chain
 * is built by compose() from applicableMissals()' layers — the same narrowing
 * PR #523 gave the readings tiers. So `IT_1983` shows on the Italian calendar and
 * not on the US one, which is the honest answer to "who declares this here".
 *
 * Rendered only when there IS a chain: one declaration is the overwhelmingly
 * common case and an empty panel saying "declared once" would be noise on every
 * celebration.
 */
function renderRedeclarations(row) {
    const steps = redeclarationSteps(row, state.baseRegion);
    if (!steps.length) return '';

    const line = (step) => {
        const heading = `
            <code class="small">${escapeHtml(step.previous.missalId)}</code>
            <i class="fas fa-arrow-right mx-1 text-muted small"></i>
            <code class="small">${escapeHtml(step.next.missalId)}</code>`;

        if (step.kind === 'universal') {
            return `
                <li class="mb-2">${heading}
                    <div class="small text-muted">${escapeHtml(i18n.redeclarationUniversal)}</div>
                </li>`;
        }
        if (step.kind === 'none') {
            return `
                <li class="mb-2">${heading}
                    <div class="small text-muted">${escapeHtml(i18n.redeclarationNoChange)}</div>
                </li>`;
        }
        return `
            <li class="mb-2">${heading}
                <ul class="list-unstyled ms-3 mb-0">${step.changes.map((change) => `
                    <li class="small">
                        <span class="text-muted">${escapeHtml(i18n[REDECLARATION_FIELD_LABEL[change.field]] ?? change.field)}:</span>
                        ${escapeHtml(redeclarationFieldValue(step.previous, change.field, change.from))}
                        <i class="fas fa-arrow-right mx-1 text-muted"></i>
                        <strong>${escapeHtml(redeclarationFieldValue(step.next, change.field, change.to))}</strong>
                    </li>`).join('')}
                </ul>
            </li>`;
    };

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.redeclarations)}</h6>
        <ul class="list-unstyled mb-3">${steps.map(line).join('')}</ul>`;
}

// ------------------------------------------------------------- structure form

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** `LitColor` in CommonDef.json, in the schema's own order. */
const COLORS = ['white', 'red', 'green', 'purple', 'rose', 'morello', 'black'];

/**
 * The row as the Structure form can express it.
 *
 * `is_dominical` and `is_bvm` are OMITTED from a row rather than written `false`
 * — the API serializes them only where the source data sets them — but a
 * checkbox has two states, so an absent flag reads back as `false`. Defaulting
 * them here is what lets an untouched form diff to nothing: without it every
 * PATCH would carry `is_dominical: false, is_bvm: false` and buildPatch() could
 * never report "nothing changed".
 *
 * @param {object} [row] a composed row
 * @returns {object} the row with both flags present
 */
export function structureOf(row) {
    return { ...row, is_dominical: row?.is_dominical === true, is_bvm: row?.is_bvm === true };
}

/**
 * A multi-select's values, keeping the row's own order for what it already had.
 *
 * `selectedOptions` reports selections in DOM order, which is the enum's order,
 * not the row's: `StHilaryPoitiers` stores `["Pastors:For a Bishop", "Doctors"]`
 * while the option list has `Doctors` first. Reading that back reordered would
 * diff as a change on a form nobody touched, and would rewrite the corpus's
 * order for no reason — diffStructure() compares arrays element by element.
 *
 * @param {string} id the select's element id
 * @param {string[]} [previous] the stored order
 * @returns {string[]}
 */
export function orderedSelection(id, previous) {
    const chosen = new Set([...(el(id)?.selectedOptions ?? [])].map((o) => o.value));
    const kept = (previous ?? []).filter((value) => chosen.has(value));
    // Set iteration is DOM order, which is the only order a newly picked value has.
    const added = [...chosen].filter((value) => false === kept.includes(value));
    return [...kept, ...added];
}

/**
 * The editable Structure panel.
 *
 * `calendar` is shown but not editable: the API derives it from the Missal and
 * refuses a row whose calendar is not the Missal's own. It is still submitted on
 * create, where `buildRow()` requires it.
 *
 * `grade_display` is a SELECT, not a text input, because the field has three
 * states and a text input has two. See sanctorale-payload.js.
 *
 * `month` and `grade` get a disabled placeholder when CREATING. A `<select>` with
 * no placeholder always yields a value, so an untouched control is
 * indistinguishable from a deliberate one: a curator who never opens the grade
 * dropdown writes `grade: 0` — Weekday — for a saint who is at minimum an
 * optional memorial, and one who never opens the month dropdown files the entry
 * under January. `CREATE_REQUIRED`'s presence check cannot fire for either, since
 * both values are present; they are just wrong. The placeholder makes "not
 * chosen" a state the form can hold, and saveEntry() rejects it on the create
 * path — reading the RAW select value, because a grade of `0` is legitimate and
 * only `''` means unchosen.
 *
 * @param {object} [row] the entry being edited, absent when creating one
 * @returns {string} HTML
 */
function renderStructureForm(row) {
    const mode = gradeDisplayMode(row?.grade_display);
    const option = (value, label, selected) =>
        `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const placeholder = row
        ? ''
        : `<option value="" disabled selected>${escapeHtml(i18n.choosePrompt)}</option>`;

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.structure)}</h6>
        <div class="row g-3 mb-3">
            <div class="col-6 col-md-3">
                <label class="form-label small" for="entryMonth">${escapeHtml(i18n.date)}</label>
                <select class="form-select" id="entryMonth">
                    ${placeholder}${MONTHS.map((m) => option(String(m), monthName(m), m === row?.month)).join('')}
                </select>
            </div>
            <div class="col-6 col-md-2">
                <label class="form-label small" for="entryDay">&nbsp;</label>
                <input type="number" min="1" max="31" class="form-control" id="entryDay"
                       value="${escapeHtml(row?.day ?? '')}">
            </div>
            <div class="col-12 col-md-3">
                <label class="form-label small" for="entryGrade">${escapeHtml(i18n.grade)}</label>
                <select class="form-select" id="entryGrade">
                    ${placeholder}${Object.entries(i18n.grades ?? {}).map(([value, label]) =>
                        option(value, label, Number(value) === row?.grade)).join('')}
                </select>
            </div>
            <div class="col-12 col-md-4">
                <label class="form-label small" for="entryGradeDisplayMode">${escapeHtml(i18n.displaysAs)}</label>
                <select class="form-select" id="entryGradeDisplayMode">
                    ${option('default', i18n.gradeDisplayDefault, mode === 'default')}
                    ${option('none', i18n.gradeDisplayNone, mode === 'none')}
                    ${option('custom', i18n.gradeDisplayCustom, mode === 'custom')}
                </select>
                <input type="text" class="form-control mt-1 ${mode === 'custom' ? '' : 'd-none'}"
                       id="entryGradeDisplayText" value="${escapeHtml(mode === 'custom' ? row.grade_display : '')}">
            </div>
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryCommon">${escapeHtml(i18n.common)}</label>
                <select class="form-select" id="entryCommon" multiple size="6">
                    ${(config.commons ?? []).map((c) =>
                        option(c, c, (row?.common ?? []).includes(c))).join('')}
                </select>
            </div>
            <div class="col-12 col-md-6">
                <label class="form-label small" for="entryColor">${escapeHtml(i18n.color)}</label>
                <select class="form-select" id="entryColor" multiple size="6">
                    ${COLORS.map((c) => option(c, c, (row?.color ?? []).includes(c))).join('')}
                </select>
                <div class="form-check mt-2">
                    <input class="form-check-input" type="checkbox" id="entryIsDominical"
                           ${row?.is_dominical ? 'checked' : ''}>
                    <label class="form-check-label small" for="entryIsDominical">is_dominical</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="entryIsBvm"
                           ${row?.is_bvm ? 'checked' : ''}>
                    <label class="form-check-label small" for="entryIsBvm">is_bvm</label>
                </div>
            </div>
            <div class="col-12">
                <div class="small text-muted">${escapeHtml(i18n.calendarField)}</div>
                <div><code id="entryCalendarLabel">${escapeHtml(row?.calendar ?? editState.calendarLabel ?? '')}</code></div>
            </div>
        </div>`;
}

/**
 * The Structure panel's current values, in payload shape.
 *
 * @returns {object}
 */
function readStructureForm() {
    return {
        month: Number(el('entryMonth')?.value),
        day: Number(el('entryDay')?.value),
        grade: Number(el('entryGrade')?.value),
        grade_display: gradeDisplayValue(el('entryGradeDisplayMode')?.value, el('entryGradeDisplayText')?.value),
        common: orderedSelection('entryCommon', editState.original.structure.common),
        color: orderedSelection('entryColor', editState.original.structure.color),
        calendar: editState.original.structure.calendar ?? editState.calendarLabel ?? '',
        is_dominical: el('entryIsDominical')?.checked === true,
        is_bvm: el('entryIsBvm')?.checked === true
    };
}

/** The Names panel's current values. An empty input is '', which is a value. */
function readNamesForm() {
    const names = {};
    document.querySelectorAll('#entryNames input[data-locale]').forEach((input) => {
        names[input.dataset.locale] = input.value;
    });
    return names;
}

/**
 * Which lectionary tier a readings edit for the open Missal would land in.
 *
 * `GET /lectionary/{rite}/sanctorale/{key}` is scoped by RITE, so its `readings`
 * array can carry tiers belonging to Missals the selected calendar does not use
 * and to Missals other than the one being edited. Both renderers already drop
 * those (applicableTiers(), then isReadingsWriteTarget()), and the diff must drop
 * them too: `editState.original.readings` exists to be diffed against what the
 * form edits, and the form edits exactly one tier.
 *
 * Folding EVERY tier's entries into the original was inert only by accident — no
 * locale key happens to collide between the rite corpus (`en`, `fr`, `it`…) and
 * the missal lectionaries (`en_US`, `es_US`, `it_IT`…), and diffLocaleMap()
 * iterates `next`, so a surplus original key is never emitted. That is an
 * empirical property of today's corpus, not a structural one.
 *
 * @param {object} payload a `/lectionary/{rite}/sanctorale/{key}` response
 * @returns {{tiers: object[], tier: 'missal'|'rite'|'none', target: ?object}}
 */
function resolveReadingsTarget(payload) {
    if (payload?.lectionary_available === false) {
        return { tiers: [], tier: 'none', target: null };
    }
    const applicableIds = applicableMissals(state.missals, state.calendar, state.baseRegion).map((m) => m.missal_id);
    const tiers = applicableTiers(payload?.readings ?? [], applicableIds);
    // 'missal' only when THIS Missal owns a lectionary tier of its own — not merely
    // when some other Missal's tier happens to ride along in the same response.
    const ownMissalTier = tiers.find((t) => t.tier === 'missal' && t.source_id === editState.missalId);
    return {
        tiers,
        tier: ownMissalTier ? 'missal' : 'rite',
        target: ownMissalTier ?? tiers.find((t) => t.tier === 'rite') ?? null
    };
}

/**
 * Whether `tier` is the one `MissalsHandler::resolveSanctoraleTarget()` would write
 * a readings edit to for the Missal currently open in the modal.
 *
 * Matching on `tier.tier` alone is not enough: `GET /lectionary/{rite}/sanctorale/{key}`
 * is scoped by RITE, not by Missal, and a single event can be carried by several
 * MISSAL-tier sources at once — `StPeterClaver` is a real example, present in both
 * `US_2011`'s own lectionary and `IT_1983`'s. `resolveSanctoraleTarget()` picks the
 * folder belonging to the Missal being edited specifically, so the client has to
 * agree by checking `source_id` too, not just accept the first `missal` tier it sees.
 *
 * @param {object} tier one entry of a `/lectionary` response's `readings` array
 * @returns {boolean}
 */
function isReadingsWriteTarget(tier) {
    return editState.readingsTier === 'missal'
        ? tier.tier === 'missal' && tier.source_id === editState.missalId
        : tier.tier === 'rite';
}

/**
 * Readings per locale, editable.
 *
 * The tier decides what this panel may do, and the three cases are genuinely
 * different rather than degrees of the same one:
 *
 * - `missal` — the edition has its own lectionary folder; the write stays inside it.
 * - `rite`   — the write lands in the rite-wide `sanctorum` corpus, which every
 *              Missal of the rite reads. The note says so; a curator editing a
 *              1970 reading is editing what 2002 and 2008 also see.
 * - `none`   — the rite has no corpus at all (Ambrosian, API #957). Read-only,
 *              and the payload omits `readings` entirely: the handler REJECTS a
 *              body that carries it.
 *
 * A response can carry MORE tiers than the one being written to — see
 * isReadingsWriteTarget(). Every tier other than the write target is rendered with
 * the same read-only presentation renderReadings() uses for a non-editing viewer,
 * plus a note explaining why it has no inputs here: offering an input for a citation
 * this Missal's write cannot reach would let a curator "edit" a value that silently
 * either overwrites a DIFFERENT source's file (same locale key) or gets rejected by
 * `assertLocalesExist` (a locale the write target does not carry) — a field the UI
 * offered them but the API cannot honor from here.
 */
/**
 * A readings shape's label, translated where the page has one.
 *
 * Falls back to the schema's own `title`, which is English but is at least a
 * sentence a curator can read — a shape the API adds after this page was last
 * translated shows as "Readings with Evening Mass", not `ReadingsWithEvening`.
 */
function shapeTitle(shape, strings = i18n) {
    return strings.readings_shapes?.[shape.id] ?? shape.title;
}

/**
 * One `<select>` of readings shapes.
 *
 * @param {string} id the element id, also what the change handler re-renders from
 * @param {string} selected the chosen shape's id
 * @param {Array<object>} choices the shapes to offer
 * @param {?string} slot the nested slot this select belongs to, or null for the tier
 */
function renderShapeSelect(id, selected, choices, slot = null) {
    return `
        <div class="mb-2">
            <label class="form-label small text-muted" for="${escapeHtml(id)}">${escapeHtml(i18n.readingsShape)}</label>
            <select class="form-select form-select-sm" id="${escapeHtml(id)}"
                    data-readings-shape="${escapeHtml(slot ?? '')}">
                ${choices.map((s) => `
                    <option value="${escapeHtml(s.id)}"${s.id === selected ? ' selected' : ''}>${escapeHtml(shapeTitle(s))}</option>`).join('')}
            </select>
        </div>`;
}

/**
 * Which citation fields one locale's inputs should be, for a chosen shape.
 *
 * The SHAPE's keys, not the data's — which is the whole of frontend #525. An
 * entry with no readings has no keys, so a form built from the data renders no
 * inputs and a curator can never enter the first citation; built from the shape
 * it renders a fillable blank. `buildCreate()` and `buildPatch()` drop blank
 * entries, so offering a field costs nothing if it goes unused.
 *
 * The shape's keys are union'd with whatever the data actually carries, so a
 * value outside the chosen shape stays visible and editable rather than being
 * quietly dropped on the next save — but only STRING-valued extras. Switching a
 * nested shape to a flat one re-renders with the previous values still in hand,
 * and those are keyed by Mass name (`vigil`, `day`) with whole readings maps
 * under them; admitting those would offer a text input for an object.
 *
 * A null shape means "whatever the data has", the pre-shape behaviour, kept for
 * when the schema could not be fetched.
 *
 * @param {?{keys: string[]}} shape
 * @param {Record<string, unknown>} values
 * @returns {string[]}
 */
export function readingFieldKeys(shape, values) {
    const present = values ?? {};
    if (!shape) return readingKeysOf(present);
    return [
        ...shape.keys,
        ...Object.keys(present).filter((k) => !shape.keys.includes(k) && typeof present[k] === 'string')
    ];
}

/** One citation input. `data-field=""` marks the whole-entry string of ReadingsCommons. */
function readingInput(loc, schema, name, value, label) {
    return `
        <div class="col-12 col-md-6 mb-2">
            <label class="form-label small text-muted">${escapeHtml(label)}</label>
            <input type="text" class="form-control form-control-sm"
                   data-locale="${escapeHtml(loc)}" data-schema="${escapeHtml(schema ?? '')}"
                   data-field="${escapeHtml(name ?? '')}" value="${escapeHtml(value ?? '')}">
        </div>`;
}

/**
 * The write target's editable readings: a shape select, then that shape's fields
 * for every locale the target carries.
 *
 * One renderer for three situations that used to be two-and-a-gap — an entry with
 * curated readings, an entry with none (the API's 404, or its all-empty
 * placeholder), and an entry that does not exist yet because the create modal is
 * open. They differ only in what `entries` holds and where `locales` came from;
 * the fields are the SHAPE's, not the data's, which is what lets a blank entry
 * render a fillable form at all. That gap is frontend #525.
 *
 * `locales` is passed rather than read off `entries` because a create dialog's
 * entries are empty by definition — the locale set comes from the lectionary
 * index instead (see `readingsTargetFromIndex()`).
 *
 * @param {Record<string, unknown>} entries locale => that locale's readings
 * @param {string[]} locales the locales to render inputs for
 * @param {?Array<object>} [shapes] the resolved shapes; defaults to the fetched set
 * @param {string} [shapeId] the chosen shape; defaults to the open entry's
 * @returns {string}
 */
export function renderReadingsEditable(entries, locales, shapes = readingsShapes, shapeId = editState.readingsShape) {
    shapes = shapes ?? [];
    if (!shapes.length) {
        // The schema never arrived. Rendering a shape select with nothing in it
        // would be worse than rendering none: fall back to the data's own keys,
        // which is exactly what this panel did before it learned about shapes.
        return locales.map((loc) => renderLocaleFields(loc, entries[loc], null)).join('');
    }

    const shape = shapes.find((s) => s.id === shapeId) ?? shapes[0];
    // Only flat and string branches for a nested shape's slots — see the note on
    // resolveReadingsShapes() for why a slot is not offered a nested shape.
    const slotChoices = shapes.filter((s) => s.kind !== 'nested');

    let body;
    if (shape.kind === 'nested') {
        body = shape.keys.map((slot) => {
            // The curator's pick, else the shape the SCHEMA declares for this slot
            // — Christmas' three Masses are each festive, Seasonal's two are
            // ferial — and only then the page-wide default. Starting every slot at
            // ferial would drop `second_reading` off a Christmas Mass that the
            // schema says has one.
            const slotShapeId = editState.readingsSlotShapes[slot]
                ?? shape.slotShapes?.[slot]
                ?? DEFAULT_READINGS_SHAPE;
            const slotShape = slotChoices.find((s) => s.id === slotShapeId) ?? slotChoices[0];
            return `
                <div class="mb-3 ps-2 border-start">
                    <div class="fw-semibold small mb-1">${escapeHtml(i18n.schemas?.[slot] ?? slot)}</div>
                    ${renderShapeSelect(`readingsShape-${slot}`, slotShape?.id, slotChoices, slot)}
                    ${locales.map((loc) => renderLocaleFields(loc, entries[loc]?.[slot], slotShape, slot)).join('')}
                </div>`;
        }).join('');
    } else {
        body = locales.map((loc) => renderLocaleFields(loc, entries[loc], shape)).join('');
    }

    return `
        ${renderShapeSelect('readingsShape', shape.id, shapes)}
        ${body}`;
}

/**
 * Re-render the editable readings panel when the curator picks another shape.
 *
 * Delegated from the modal body, which outlives every re-render, so the handler
 * is attached exactly once at start-up rather than re-bound each time the panel
 * is rebuilt — a per-render binding is how a shape change ends up applied twice.
 *
 * Current inputs are read back first and passed in as the entries, so citations
 * already typed survive a shape change: going ferial to festive keeps all four and
 * adds an empty `second_reading`, and going back keeps the four and drops the one
 * the shape no longer has.
 */
function wireReadingsShapeSelect() {
    dom.detailBody?.addEventListener('change', (event) => {
        const select = event.target.closest?.('select[data-readings-shape]');
        if (!select) return;

        const current = readReadingsForm();
        const slot = select.dataset.readingsShape;
        if (slot) {
            editState.readingsSlotShapes[slot] = select.value;
        } else {
            editState.readingsShape = select.value;
            // A new top-level shape has new slots; carrying the old shape's slot
            // choices over would apply `vigil`'s pick to whatever the new shape
            // happens to name first.
            editState.readingsSlotShapes = {};
        }

        const host = el('entryReadingsEditable');
        if (host) {
            host.innerHTML = renderReadingsEditable(current, editState.readingsLocales);
        }
    });
}

/**
 * The readings panel for an entry the write target carries nothing for yet.
 *
 * Reached two ways, and they are the same situation seen from different sides:
 * the create modal, where the entry does not exist at all, and an existing entry
 * whose lectionary route answers 404 because no source carries its key. Both get
 * a fillable form rather than "nothing is curated yet" — which is frontend #525.
 *
 * @param {string[]} locales
 * @returns {string}
 */
function renderReadingsBlank(locales) {
    if (!locales.length) return '';
    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.readings)}</h6>
        <div id="entryReadings">
            <div class="alert alert-secondary py-1 px-2 small">${escapeHtml(i18n.readingsNoneYet)}</div>
            <div id="entryReadingsEditable">${renderReadingsEditable({}, locales)}</div>
        </div>`;
}

/**
 * One locale's inputs for a given shape.
 *
 * A `null` shape means "render whatever keys the data has", the pre-shape
 * behaviour, kept for the case where the schema could not be fetched.
 *
 * @param {string} loc
 * @param {unknown} readings this locale's readings for this slot
 * @param {?object} shape
 * @param {?string} slot
 */
function renderLocaleFields(loc, readings, shape, slot = null) {
    if (shape?.kind === 'string') {
        // ReadingsCommons: the whole entry is one string naming the Common the
        // readings come from, so there is one input and it carries no field name.
        return `
            <div class="mb-2"><code class="small">${escapeHtml(loc)}</code>
                <div class="row">${readingInput(
                    loc, slot, '', typeof readings === 'string' ? readings : '', i18n.readingsFromCommon
                )}</div>
            </div>`;
    }

    const values = readings && typeof readings === 'object' ? readings : {};
    const keys = readingFieldKeys(shape, values);
    if (!keys.length) return '';

    return `
        <div class="mb-2"><code class="small">${escapeHtml(loc)}</code>
            <div class="row">${keys
                .map((name) => readingInput(loc, slot, name, values[name], readingLabel(name))).join('')}</div>
        </div>`;
}

function renderReadingsForm(payload) {
    if (payload.lectionary_available === false) {
        editState.readingsTier = 'none';
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(i18n.readingsNotWritable)}</div>`;
    }

    // The response is rite-scoped, so it can carry tiers from Missals the selected
    // calendar does not use, and tiers this Missal's write cannot reach. One
    // resolver decides, shared with showDetail()'s population of
    // `editState.original.readings`, so the diff and the form cannot disagree
    // about which tier is being edited.
    const { tiers, tier } = resolveReadingsTarget(payload);
    editState.readingsTier = tier;

    if (!tiers.length) {
        // The write target's own Missal is always applicable by construction, so
        // this only fires for a rite with no rite-level corpus and no applicable
        // missal tier — reported the same as "nothing curated" (the 404 case),
        // not as a fourth state.
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(i18n.noReadingsForEvent)}</div>`;
    }

    const panels = tiers.map((tier, i) => {
        if (!isReadingsWriteTarget(tier)) {
            return `
                <div class="mb-3">
                    <div class="alert alert-secondary py-1 px-2 small mb-2">${escapeHtml(i18n.readingsInherited)}</div>
                    ${renderReadingsTier(tier, i, i18n)}
                </div>`;
        }

        // The locales this tier carries, remembered so a shape change can re-render
        // the panel without the response in hand.
        const entries = tier.entries ?? {};
        editState.readingsLocales = Object.keys(entries);

        return `
            <div class="mb-3">
                <div class="mb-1"><span class="badge bg-dark">${escapeHtml(tier.tier)}</span>
                    <code class="small ms-1">${escapeHtml(tier.source_id)}</code></div>
                ${tier.tier === 'rite'
                    ? `<div class="alert alert-warning py-1 px-2 small">${escapeHtml(i18n.readingsShared)}</div>` : ''}
                <div id="entryReadingsEditable">${renderReadingsEditable(entries, editState.readingsLocales)}</div>
            </div>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.readings)}</h6>
        <div id="entryReadings">${panels}</div>`;
}

/**
 * The Readings panel's values, rebuilt into the nested shape the API stores.
 * A blank input stays blank: a curated-as-blank citation is a decision.
 */
function readReadingsForm() {
    const readings = {};
    document.querySelectorAll('#entryReadings input[data-locale]').forEach((input) => {
        const { locale, schema, field } = input.dataset;
        // An empty `data-field` is ReadingsCommons: the value IS the entry (or the
        // whole of one slot of a nested shape), a string naming the Common the
        // readings are taken from, rather than one citation within a map.
        if (!field) {
            if (schema) {
                readings[locale] = readings[locale] ?? {};
                readings[locale][schema] = input.value;
            } else {
                readings[locale] = input.value;
            }
            return;
        }
        readings[locale] = readings[locale] ?? {};
        if (schema) {
            readings[locale][schema] = readings[locale][schema] ?? {};
            readings[locale][schema][field] = input.value;
        } else {
            readings[locale][field] = input.value;
        }
    });
    return readings;
}

/**
 * What an `event_key` the coverage map has never heard of resolves to.
 *
 * Every locale is `missing`, because that is what an absent entry means. It is
 * spelled out and passed explicitly rather than defaulted inside
 * nameCoverageBadge(), so a caller cannot quietly pick a different one — which is
 * exactly what had happened: the read-only renderer fell back to three EMPTY
 * arrays, which puts a locale in no named list at all and lands it on the final
 * `translated` branch. The result was fourteen green "translated" badges beside
 * fourteen blank names in the read-only modal, and fourteen red "missing" badges
 * for the same entry the moment Edit was clicked.
 *
 * @param {object} payload a Missal i18n response
 * @returns {{translated: string[], empty: string[], missing: string[]}}
 */
function absentCoverage(payload) {
    return { translated: [], empty: [], missing: payload.locales ?? [] };
}

/**
 * The coverage badge for one locale, shared by BOTH Names renderers.
 *
 * Three states, not two: `translated`, `empty` (curated as blank on purpose) and
 * `missing` (no entry at all). Collapsing empty into missing would misreport
 * deliberate blanks as gaps; collapsing missing into translated — which an
 * all-empty fallback silently does — misreports gaps as finished work.
 *
 * @param {object} payload a Missal i18n response
 * @param {string} eventKey
 * @param {string} loc a BCP-47 tag from `payload.locales`
 * @param {{translated: string[], empty: string[], missing: string[]}} fallback
 *        what to use when the coverage map has no entry for `eventKey`
 * @param {object} [strings] i18n strings
 * @returns {string} HTML
 */
export function nameCoverageBadge(payload, eventKey, loc, fallback, strings = i18n) {
    const coverage = payload.coverage?.[eventKey] ?? fallback;
    if (coverage.missing?.includes(loc)) {
        return `<span class="badge bg-danger">${escapeHtml(strings.missingLabel)}</span>`;
    }
    if (coverage.empty?.includes(loc)) {
        return `<span class="badge bg-warning text-dark">${escapeHtml(strings.emptyLabel)}</span>`;
    }
    return `<span class="badge bg-success">${escapeHtml(strings.translatedLabel)}</span>`;
}

/**
 * Names per locale, using the coverage map the API precomputes.
 *
 * The badge is nameCoverageBadge()'s, with the same fallback the editable
 * renderer uses: opening a celebration read-only and opening the same one for
 * edit must not disagree about what is translated.
 */
function renderNames(payload, eventKey) {
    const fallback = absentCoverage(payload);
    const rows = (payload.locales ?? []).map((loc) => {
        const value = payload.i18n?.[loc]?.[eventKey];
        const stateBadge = nameCoverageBadge(payload, eventKey, loc, fallback);
        return `
            <tr>
                <td class="text-nowrap"><code>${escapeHtml(loc)}</code></td>
                <td>${escapeHtml(value ?? '')}</td>
                <td class="text-end">${stateBadge}</td>
            </tr>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.names)}
            <span class="badge bg-light text-dark border ms-1">${(payload.locales ?? []).length}</span>
        </h6>
        <table class="table table-sm mb-3"><tbody>${rows}</tbody></table>`;
}

/**
 * Names per locale, editable.
 *
 * Every locale the Missal publishes gets an input, including the ones with no
 * entry: `fanOutKey()` will create them, and a curator filling one in is the
 * normal way a translation arrives. An empty input submits `""` — the corpus's
 * own record of "exists, not translated yet" — and never null or omission.
 *
 * An `eventKey` the coverage map has never heard of (the create dialog, before
 * anything is saved) is treated as missing in every locale, so every input opens
 * blank with the `missing` badge rather than misreporting as translated.
 */
function renderNamesForm(payload, eventKey) {
    const fallback = absentCoverage(payload);
    const rows = (payload.locales ?? []).map((loc) => {
        const value = payload.i18n?.[loc]?.[eventKey] ?? '';
        const badge = nameCoverageBadge(payload, eventKey, loc, fallback);
        return `
            <tr>
                <td class="text-nowrap align-middle"><code>${escapeHtml(loc)}</code></td>
                <td><input type="text" class="form-control form-control-sm"
                           data-locale="${escapeHtml(loc)}" value="${escapeHtml(value)}"></td>
                <td class="text-end align-middle">${badge}</td>
            </tr>`;
    }).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(i18n.names)}
            <span class="badge bg-light text-dark border ms-1">${(payload.locales ?? []).length}</span>
        </h6>
        <table class="table table-sm mb-3"><tbody id="entryNames">${rows}</tbody></table>`;
}

/**
 * Readings, tier by tier.
 *
 * `lectionary_available: false` is a first-class answer, not an error — the
 * Ambrosian rite has no sanctorale lectionary at all — so it renders the API's
 * own message rather than an empty table that reads as a bug.
 */
/**
 * One locale's readings as table rows: reading name on the left, citation right.
 *
 * Rows are ordered by `readingKeysOf()` rather than by the object's own key order,
 * so every locale of a celebration reads down in the same sequence and can be
 * compared line against line — which is what the locale table exists to do.
 *
 * A `ReadingsCommons` entry is a STRING, not a map: the readings are taken from a
 * Common of Saints, and the value names which. It is rendered as that one line.
 * Requiring an object here used to drop such an entry silently — it failed the
 * `typeof` guard and returned an empty row — so a memorial taking its readings
 * from a Common displayed as though nothing were curated for it.
 */
function readingRows(entries, schema, strings) {
    return Object.entries(entries ?? {}).map(([loc, entry]) => {
        const readings = schema ? entry?.[schema] : entry;
        const cell = typeof readings === 'string'
            ? `<div class="small"><span class="text-muted">${escapeHtml(strings.readingsFromCommon)}:</span> ${escapeHtml(readings)}</div>`
            : (readings && typeof readings === 'object'
                ? readingKeysOf(readings).map((k) => `
                    <div class="small"><span class="text-muted">${escapeHtml(readingLabel(k, strings))}:</span> ${escapeHtml(readings[k])}</div>`).join('')
                : null);
        if (cell === null) return '';
        return `
            <tr>
                <td class="text-nowrap align-top"><code>${escapeHtml(loc)}</code></td>
                <td>${cell}</td>
            </tr>`;
    }).join('') || `<tr><td class="text-muted small">${escapeHtml(strings.noEntries)}</td></tr>`;
}

/**
 * One lectionary tier's read-only presentation: a badge naming the tier and
 * source, its readings as schema tabs or a plain table, and the blank/missing
 * locale lists.
 *
 * Factored out of renderReadings() so renderReadingsForm() can reuse the exact
 * same markup for a tier it is not writing to (see isReadingsWriteTarget()) —
 * a curator still needs to SEE that citation, just not an input pretending they
 * can change it from here.
 *
 * Where a celebration offers alternative schemas, they become TABS rather than
 * more nesting. The table already varies by locale; stacking three schemas inside
 * that turns six rows into eighteen and makes comparing one language against
 * another impossible, which is the thing the locale table exists to do. Tabs keep
 * locale as the axis you read down and schema as the one you switch between.
 *
 * The schema labels match ReadingsRenderer in liturgy-components-js ("Schema I",
 * "Schema II", "Schema III") so the two agree. That renderer solves this problem
 * already but is not exported from the package entry point, so it cannot be
 * imported here — raised upstream; consolidate if it is exported.
 *
 * @param {object} tier one entry of a `/lectionary` response's `readings` array
 * @param {number} index used to build tab ids unique across every tier on the page
 * @param {object} strings i18n strings
 * @returns {string}
 */
function renderReadingsTier(tier, index, strings) {
    const entries = tier.entries ?? {};
    const schemas = schemaKeysOf(entries);
    const without = tier.locales_without_entry ?? [];
    const blank   = tier.locales_with_empty_entry ?? [];

    const badge = `
        <span class="badge bg-dark">${escapeHtml(tier.tier)}</span>
        <code class="small ms-1">${escapeHtml(tier.source_id)}</code>`;

    const table = (schema) => `
        <table class="table table-sm mb-1"><tbody>${readingRows(entries, schema, strings)}</tbody></table>`;

    let body;
    if (schemas.length) {
        const tabId = (k) => `readings-t${index}-${k.replace(/[^a-z0-9]/gi, '')}`;
        body = `
            <ul class="nav nav-pills nav-sm mb-2" role="tablist">
                ${schemas.map((k, n) => `
                    <li class="nav-item" role="presentation">
                        <button class="nav-link btn-sm py-1 px-2 ${n === 0 ? 'active' : ''}" type="button"
                                data-bs-toggle="tab" data-bs-target="#${tabId(k)}" role="tab">
                            ${escapeHtml(strings.schemas?.[k] ?? k)}
                        </button>
                    </li>`).join('')}
            </ul>
            <div class="tab-content">
                ${schemas.map((k, n) => `
                    <div class="tab-pane fade ${n === 0 ? 'show active' : ''}" id="${tabId(k)}" role="tabpanel">
                        ${table(k)}
                    </div>`).join('')}
            </div>`;
    } else {
        body = table(null);
    }

    return `
        <div class="mb-3">
            <div class="mb-1 d-flex align-items-center gap-2 flex-wrap">${badge}</div>
            ${body}
            ${blank.length ? `<div class="small text-muted">${escapeHtml(strings.emptyLabel)}: <code>${blank.map(escapeHtml).join('</code>, <code>')}</code></div>` : ''}
            ${without.length ? `<div class="small text-muted">${escapeHtml(strings.missingLabel)}: <code>${without.map(escapeHtml).join('</code>, <code>')}</code></div>` : ''}
        </div>`;
}

/**
 * Readings, tier by tier, read-only.
 *
 * `lectionary_available: false` is a first-class answer, not an error — the
 * Ambrosian rite has no sanctorale lectionary at all — so it renders the API's
 * own message rather than an empty table that reads as a bug.
 */
function renderReadings(payload, strings = i18n) {
    if (payload.lectionary_available === false) {
        return `
            <h6 class="text-uppercase text-muted small">${escapeHtml(strings.readings)}</h6>
            <div class="alert alert-secondary mb-0">${escapeHtml(payload.message || strings.noLectionary)}</div>`;
    }

    // The response is rite-scoped, so it can carry tiers from Missals the selected
    // calendar does not use (see applicableTiers()); filtering can empty the list
    // entirely, which reads as "nothing curated" — the same message a 404 gets —
    // not as a distinct empty-panel state.
    const applicableIds = applicableMissals(state.missals, state.calendar, state.baseRegion).map((m) => m.missal_id);
    const tiers = applicableTiers(payload.readings ?? [], applicableIds);

    const rendered = tiers.map((tier, i) => renderReadingsTier(tier, i, strings)).join('');

    return `
        <h6 class="text-uppercase text-muted small">${escapeHtml(strings.readings)}</h6>
        ${rendered || `<div class="alert alert-secondary mb-0">${escapeHtml(strings.noReadingsForEvent)}</div>`}`;
}

// -------------------------------------------------------------------- loading

async function loadMetadata() {
    if (state.metadata) return;
    const payload = await getJson('/calendars');
    state.metadata = payload.litcal_metadata ?? payload ?? null;
}

async function loadCatalogue(seq = selectionSeq) {
    // Rite-scoped since API #953. The unprefixed `/missals` still answers, but it
    // means `roman`, so asking for it explicitly is what makes the rite selector real.
    const payload = await getJson(`/missals/${encodeURIComponent(state.rite)}`);
    if (seq !== selectionSeq) return;
    state.missals = payload.litcal_missals ?? payload ?? [];
    state.baseRegion = baseRegionFor(state.missals, state.rite);

    const regions = [...new Set(state.missals.map((m) => m.region))]
        .filter((r) => r !== state.baseRegion)
        .sort();

    const baseLabel = state.rite === 'ambrosian' ? i18n.ambrosianCalendar : i18n.generalRoman;
    dom.calendar.innerHTML = [`<option value="">${escapeHtml(baseLabel)}</option>`]
        .concat(regions.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`))
        .join('');
    // A rite change can invalidate the selected nation, so fall back to the base.
    if (state.calendar && !regions.includes(state.calendar)) {
        state.calendar = '';
    }
    dom.calendar.value = state.calendar;
    renderLocaleOptions();

    await refreshCapabilities(seq);
}

/**
 * Recompute per-Missal capabilities for the currently applicable set, and
 * toggle `#newEntryBtn` accordingly — on the CREATE capability, which is
 * `admin`, not on the edit one. A curator holding only `editor` may change
 * existing rows and may not add new ones.
 *
 * The applicable set is calendar-scoped (applicableMissals() filters by
 * `state.calendar`), so this must be called on every rite OR calendar change —
 * not only from loadCatalogue(), which runs on a rite change alone. Selecting a
 * national calendar brings in a Missal (e.g. `US_2011`) that a prior computation
 * never saw, and capabilityFor() defaults an unlisted Missal to read-only, so
 * skipping this on a calendar-only change would silently hide Edit on exactly
 * the rows the whole feature exists to gate. Both loadCatalogue() and
 * recompose() call this, sharing the one implementation.
 *
 * Guarded by the same `seq` token its callers already allocate:
 * detectMissalCapabilities() fans out one round-trip per Missal per relation,
 * so an abandoned selection's checks can resolve after a fresher selection's
 * and must not overwrite `state.capabilities` — the same hazard loadSanctorale()
 * guards against for `state.composed`.
 *
 * @param {number} seq
 */
async function refreshCapabilities(seq) {
    // Capabilities are per Missal, so they are refreshed whenever the applicable
    // set changes — which is on every rite or calendar change, not once per page.
    const capabilities = await detectMissalCapabilities({
        missals: applicableMissals(state.missals, state.calendar, state.baseRegion),
        rite: state.rite,
        baseRegion: state.baseRegion,
        userSub: config?.userSub ?? '',
        isGlobalAdmin: config?.isGlobalAdmin === true,
        checkAllowed: async (path) => {
            const result = await getJson(path, {}, 'include');
            return result !== null && typeof result === 'object' && result.allowed === true;
        }
    });
    if (seq !== selectionSeq) return;
    state.capabilities = capabilities;
    revealCreateButton();
}

/**
 * Show `#newEntryBtn` only when a create is actually possible: the caller holds
 * CREATE on some applicable Missal, AND the composed sanctorale has loaded.
 *
 * The second condition is not belt-and-braces. Capabilities and the sanctorale
 * are fetched on SEPARATE async paths off one selection change, so the button
 * could be revealed and clicked while `state.composed` was still empty — and
 * `calendarLabelFor()` reads the calendar label off a composed row, because the
 * API derives a Missal's calendar itself (`GENERAL ROMAN` for an editio typica,
 * the nation code for a national edition) and does not publish it on the
 * `/missals` index. With no row to read, the label fell back to `''` and the
 * create `PUT` was rejected 400: "This Missal's entries belong to the `US`
 * calendar, but the payload says ``."
 *
 * Latent before, and rare enough to look like flake; adding the readings panel's
 * fetches widened the window enough for CI to catch it. Called from both paths so
 * whichever finishes last reveals the button.
 */
function revealCreateButton() {
    const canCreate = [...state.capabilities.values()].some((c) => c.canCreate);
    dom.newEntry?.classList.toggle('d-none', !(canCreate && state.composed.length > 0));
}

/**
 * Offer the locales this calendar publishes, and keep the current choice only if
 * it survives the change — switching to a national calendar that publishes one
 * locale must not leave a stale, unpublished one selected.
 */
function renderLocaleOptions() {
    const available = localesFor(state.metadata, state.rite, state.calendar);
    const display = (tag) => {
        try {
            return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag;
        } catch {
            return tag;
        }
    };

    if (!available.includes(state.nameLocale)) {
        state.nameLocale = preferredLocale(available, locale);
    }
    dom.locale.innerHTML = available
        .map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(display(l))} (${escapeHtml(l)})</option>`)
        .join('');
    dom.locale.value = state.nameLocale;
    dom.locale.disabled = available.length <= 1;
}

async function loadSanctorale(seq = selectionSeq) {
    notice('', '');

    const applicable = applicableMissals(state.missals, state.calendar, state.baseRegion);
    if (!applicable.length) {
        state.composed = [];
        renderFromOptions();
        notice('info', escapeHtml(i18n.noMissals));
        render();
        return;
    }
    dom.tableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">${escapeHtml(i18n.loading)}</td></tr>`;

    try {
        const layers = await Promise.all(applicable.map(async (missal) => ({
            missal,
            rows: await getJson(
                `/missals/${encodeURIComponent(state.rite)}/${encodeURIComponent(missal.missal_id)}`,
                // The API merges the celebration name for the negotiated locale, so
                // this header is what makes the picker do anything at all.
                state.nameLocale ? { 'Accept-Language': state.nameLocale } : {}
            )
        })));
        if (seq !== selectionSeq) return;
        state.composed = compose(layers);
        // The other half of the race revealCreateButton() closes: whichever of
        // capabilities and the sanctorale resolves last reveals the button.
        revealCreateButton();
        renderFromOptions();
        render();
    } catch (error) {
        if (seq !== selectionSeq) return;
        state.composed = [];
        revealCreateButton();
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
        render();
    }
}

function syncHash() {
    // Addressable so a link can name a month, and so a reload keeps the reader
    // where they were rather than snapping back to the current month.
    const params = new URLSearchParams();
    params.set('rite', state.rite);
    if (state.calendar) params.set('calendar', state.calendar);
    if (state.nameLocale) params.set('locale', state.nameLocale);
    if (state.fromMissal) params.set('from', state.fromMissal);
    params.set('month', String(state.month));
    // Carries the open modal's event_key, so copying the URL out of the address
    // bar while viewing one celebration reproduces that view, not just the tab.
    if (state.event) params.set('event', state.event);
    history.replaceState(null, '', `#${params.toString()}`);
}

function readHash() {
    const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const month  = Number(params.get('month'));
    if (params.get('rite')) state.rite = params.get('rite');
    // Assigned unconditionally, defaulting to empty. syncHash omits these when they
    // are unset, so testing for presence would let an in-page link to the base
    // calendar silently keep whichever nation happened to be selected before.
    state.calendar   = params.get('calendar') ?? '';
    state.fromMissal = params.get('from') ?? '';
    state.nameLocale = params.get('locale') ?? '';
    state.event      = params.get('event') ?? '';
    if (month >= 1 && month <= 12) state.month = month;
}

/**
 * The month a celebration currently lives on, or `null` when it is not in the
 * composed list at all.
 *
 * Exists so a curator can be followed to where their edit landed rather than
 * left on the tab they started from — see the `monthOf()` call after `reload()`
 * in saveEntry() and deleteEntry().
 *
 * @param {Array<object>} composed
 * @param {string} eventKey
 * @returns {number|null}
 */
export function monthOf(composed, eventKey) {
    return composed.find((r) => r.event_key === eventKey)?.month ?? null;
}

/**
 * Open the entry a deep link named (`#event=<key>`), landing on its month tab.
 *
 * Called once the composed sanctorale for the current rite/calendar/locale is
 * loaded, so `state.composed` is what the link is checked against. A key absent
 * from the CURRENT selection is reported, not silently ignored: a stale or
 * mistyped link — or one for a rite/calendar this page has since moved away
 * from — must say so, which is the exact failure mode `#event=` shipped
 * without in the first place.
 */
function openDeepLinkedEvent() {
    if (!state.event) return;
    const row = state.composed.find((r) => r.event_key === state.event);
    if (!row) {
        notice('warning', escapeHtml(i18n.eventNotFound.replace('%s', state.event)));
        state.event = '';
        syncHash();
        return;
    }
    if (state.month !== row.month) {
        state.month = row.month;
        render();
    }
    showDetail(row.event_key, row._missalId, false);
}

/**
 * Reload catalogue and sanctorale for the current selection.
 *
 * The token is taken once, here, so every await below belongs to THIS selection:
 * a slower request for a selection the reader has already moved on from returns
 * to a bumped token and commits nothing.
 */
async function reload() {
    const seq = ++selectionSeq;
    try {
        await loadMetadata();
        await loadCatalogue(seq);
        if (seq !== selectionSeq) return;
        renderLocaleOptions();
        await loadSanctorale(seq);
        if (seq !== selectionSeq) return;
        // The URL last, once loadCatalogue and renderLocaleOptions have had their
        // say: a nation that does not exist in the new rite is dropped, and the
        // locale may have been re-derived. Writing the hash before that leaves it
        // describing a selection the page is not showing.
        syncHash();
        // A rite/calendar/locale change can carry a `#event=` along for the ride
        // (or leave a stale one from before the change); either way it has to be
        // resolved against the FRESH composed list, not the one it was read against.
        openDeepLinkedEvent();
    } catch (error) {
        if (seq !== selectionSeq) return;
        // Clear before reporting. Otherwise a failed Ambrosian load leaves the
        // previous rite's celebrations on screen underneath an error saying the
        // load failed, which is a worse lie than showing nothing.
        state.missals    = [];
        state.baseRegion = null;
        state.composed   = [];
        renderFromOptions();
        render();
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
    }
}

/** Recompose without refetching the catalogue: the rite has not changed. */
async function recompose() {
    const seq = ++selectionSeq;
    try {
        // Capabilities BEFORE loadSanctorale: loadSanctorale() ends by calling
        // render(), which reads capabilityFor() live. Refreshing capabilities
        // afterwards would leave freshly-eligible rows (e.g. a newly selected
        // US_2011) rendered without their Edit button until some unrelated
        // re-render happened to run. A calendar change (not just a rite change)
        // can bring a new Missal into the applicable set — see
        // refreshCapabilities()'s own doc comment for why this call is here at
        // all, not only in loadCatalogue().
        await refreshCapabilities(seq);
        if (seq !== selectionSeq) return;
        await loadSanctorale(seq);
        if (seq !== selectionSeq) return;
        // renderFromOptions may have retired the selected edition; drop it from
        // the URL rather than leaving a filter there that no longer applies.
        syncHash();
    } catch (error) {
        if (seq !== selectionSeq) return;
        state.composed = [];
        renderFromOptions();
        render();
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
    }
}

async function init() {
    readHash();
    // A failed catalogue must not abort init: the listeners below are what let the
    // reader pick another rite or retry, and skipping them strands the page dead.
    let catalogueFailed = false;
    try {
        await loadMetadata();
        await loadCatalogue();
    } catch (error) {
        catalogueFailed = true;
        notice('danger', escapeHtml(i18n.loadFailed.replace('%s', error.message)));
    }
    dom.rite.value = state.rite;

    dom.rite.addEventListener('change', () => {
        state.rite = dom.rite.value;
        syncHash();
        // Each rite has its own catalogue, so this is a reload, not a recompose.
        reload();
    });
    dom.calendar.addEventListener('change', () => {
        state.calendar = dom.calendar.value;
        renderLocaleOptions();
        syncHash();
        recompose();
    });
    dom.locale.addEventListener('change', () => {
        state.nameLocale = dom.locale.value;
        syncHash();
        // Names are merged server-side, so a locale change is a refetch.
        recompose();
    });
    dom.from.addEventListener('change', () => {
        state.fromMissal = dom.from.value;
        syncHash();
        // Purely a view filter over data already composed — no request needed.
        render();
    });
    dom.saveEntry?.addEventListener('click', saveEntry);
    dom.deleteEntry?.addEventListener('click', deleteEntry);
    dom.newEntry?.addEventListener('click', showCreate);
    // Delegated once from the modal body, which every readings re-render happens
    // inside of — see wireReadingsShapeSelect().
    wireReadingsShapeSelect();
    dom.search.addEventListener('input', () => {
        state.search = dom.search.value;
        // Move to a month that actually contains a hit, otherwise the reader
        // searches and is shown an empty month they happened to be standing on.
        // Honours the From filter, so a search inside a filtered view cannot jump
        // to a month the filter has emptied.
        const hits = monthsWithHits(filterByMissal(state.composed, state.fromMissal), state.search);
        if (hits.length && !hits.includes(state.month)) {
            state.month = hits[0];
            syncHash();
        }
        render();
    });

    // A hash change is a SAME-DOCUMENT navigation: the module does not re-run, so
    // without this a deep link followed from this very page silently does nothing
    // — the reader clicks a link naming another rite or month and sees no change.
    window.addEventListener('hashchange', () => {
        const before = `${state.rite}|${state.calendar}|${state.nameLocale}`;
        readHash();
        dom.rite.value     = state.rite;
        dom.calendar.value = state.calendar;
        if (`${state.rite}|${state.calendar}|${state.nameLocale}` !== before) {
            reload();
        } else {
            dom.from.value = state.fromMissal;
            render();
            // reload() resolves its own `#event=` once its fetch lands (see above);
            // this branch fetches nothing, so it must resolve one itself, against
            // the composed list that is already current.
            openDeepLinkedEvent();
        }
    });

    // Clears the hash's `event=` once the modal it named is no longer open —
    // fired by both an explicit close and a save/delete's own `.hide()` call —
    // so the URL never keeps pointing at a view that is no longer on screen.
    dom.detailModal?.addEventListener('hidden.bs.modal', () => {
        if (state.event) {
            state.event = '';
            syncHash();
        }
    });

    if (!catalogueFailed) {
        await loadSanctorale();
        // A deep link can name a calendar, locale or edition that this rite does
        // not have. Rewrite it once, so the URL matches what is actually shown and
        // copying it out of the address bar reproduces this page.
        syncHash();
        // Resolved last, once the composed list and the URL both agree with what
        // is on screen: a `#event=` deep link opens the modal and lands on the
        // right month tab, rather than silently doing nothing — see #503 phase 4.
        openDeepLinkedEvent();
    }
}

// Guarded so the module can be imported by unit tests, and so it is inert if
// ever loaded on a page without the table it drives.
if (dom.tableBody && dom.tabs) {
    init();
}
