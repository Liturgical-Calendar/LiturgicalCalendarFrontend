/**
 * The particular calendars navigator's tree model (#66).
 *
 * A pure module — no DOM, no fetching — that turns the hub page's already-loaded
 * inputs (`/calendars` metadata, the prospective wider regions, the catalogued
 * nations, the national Missal editions, the user's rights, and whichever
 * dioceses have been loaded so far) into a `NavigatorNode[]` tree, plus a few
 * small helpers the hub and the deep-link parser share.
 *
 * Governance does not cascade (a national admin holds no rights on that
 * nation's dioceses, and vice versa), so every node's actions are decided on
 * its own rights, not inherited from its parent. The hierarchy is not a tree
 * either: a nation can belong to several wider regions (Sweden: Europe and
 * Nordic) or to none, and the Ambrosian rite has diocesan calendars but no
 * national tier and no regions. See docs/superpowers/specs/
 * 2026-09-30-particular-calendars-navigator-design.md Parts 1-2.
 *
 * @module particularCalendarsTree
 */

import { idToWords, regionId, regionLabel } from './prospectiveWiderRegions.js';
import { nationWiderRegions, widerRegionsByNation } from './widerRegions.js';
import { AMBROSIAN_RITE, ROMAN_RITE, qualifyObjectId } from './riteScopedObjectId.js';

/**
 * @typedef {Object} NavigatorRights
 * @property {boolean} isGlobalAdmin
 * @property {{national_calendar: string[], diocesan_calendar: string[], wider_region: string[]}} admin
 * @property {{national_calendar: string[], diocesan_calendar: string[], wider_region: string[]}} editor
 */

/**
 * @typedef {Object} NavigatorNode
 * @property {'region'|'nation'|'diocese'|'group'} kind
 * @property {string} id - Region id, ISO 3166-1 alpha-2 nation code, or bare diocese id;
 *   group ids are `no-region` and `ambrosian`
 * @property {string} [rite] - `roman` or `ambrosian`; omitted on a group node
 * @property {string} label
 * @property {boolean} exists
 * @property {Array<'edit'|'create'|'sanctorale'|'translate'|'request'>} actions
 * @property {string} [disabledReason] - e.g. `nation-missing` for a Roman diocese whose nation
 *   has no calendar: its Create is disabled, or, for a user without rights on it, it has no action
 * @property {string[]} [missals] - Nation nodes only: the national Missal editions `/missals`
 *   lists for it, when it has any
 * @property {string} [note] - `no-missal` on a nation without Missal editions;
 *   `ambrosian-unsupported` on an Ambrosian diocese, which no form can load yet (it has no actions
 *   but `request`, offered only to a user without rights on it)
 * @property {boolean} mine - Whether the user holds rights on this node (any action but `request`)
 * @property {boolean} [context] - Set by `filterMine()` on an ancestor kept only to reach a `mine` node
 * @property {NavigatorNode[]} children
 * @property {boolean} [childrenPending] - Nation nodes only: the dioceses `Map` has not loaded
 *   this nation's not-yet-created candidates yet
 */

/** The `wider_region`/`national_calendar`/`diocesan_calendar` OpenFGA object types this module composes. */
const WIDER_REGION_TYPE = 'wider_region';
const NATIONAL_CALENDAR_TYPE = 'national_calendar';
const DIOCESAN_CALENDAR_TYPE = 'diocesan_calendar';

/** The group node ids (see NavigatorNode). */
const NO_REGION_GROUP_ID = 'no-region';
const AMBROSIAN_GROUP_ID = 'ambrosian';

/**
 * The Vatican: it has a national calendar, but it is the Roman rite's own (Editio Typica), not a
 * particular calendar a curator maintains; extending.php's national form leaves it out too.
 */
const VATICAN_ISO = 'VA';

/** `?choice=` values `parseDeepLink()` accepts. */
const DEEP_LINK_CHOICES = ['widerRegion', 'national', 'diocesan'];

/** Rites `parseDeepLink()` and every rite-bearing node accept. */
const KNOWN_RITES = [ROMAN_RITE, AMBROSIAN_RITE];

/** A calendar id as the API and the existing pickers validate it (see `parseDeepLink()`). */
const CALENDAR_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** A locale tag, e.g. `en`, `zh_Hans`, `en_US` (see `parseDeepLink()`). */
const LOCALE_PATTERN = /^[a-z]{2,3}(_[A-Za-z]{4})?(_[A-Z]{2})?$/;

/**
 * Whether a rite-qualified scope list grants a right on `rite/id`.
 * @param {string[]|undefined} list - e.g. `rights.editor.national_calendar`
 * @param {string} rite
 * @param {string} id
 * @returns {boolean}
 */
function has(list, rite, id) {
    return Boolean(list?.includes(`${rite}/${id}`));
}

/**
 * @param {NavigatorRights|undefined} rights
 * @param {string} type - `national_calendar`, `diocesan_calendar`, or `wider_region`
 * @param {string} rite
 * @param {string} id
 * @returns {boolean} Whether the user may edit this calendar: global admin, editor, or admin
 *   (admin implies editor, as in the OpenFGA model)
 */
function canEdit(rights, type, rite, id) {
    return rights?.isGlobalAdmin === true
        || has(rights?.editor?.[type], rite, id)
        || has(rights?.admin?.[type], rite, id);
}

/**
 * @param {NavigatorRights|undefined} rights
 * @param {string} type
 * @param {string} rite
 * @param {string} id
 * @returns {boolean} Whether the user may create this calendar: global admin, or admin
 */
function canCreate(rights, type, rite, id) {
    return rights?.isGlobalAdmin === true || has(rights?.admin?.[type], rite, id);
}

/**
 * @param {string} [uiLocale]
 * @returns {Intl.Collator} A collator for `uiLocale`, falling back to the default locale
 */
function labelCollator(uiLocale) {
    try {
        return new Intl.Collator(String(uiLocale ?? '').replaceAll('_', '-') || undefined);
    } catch {
        return new Intl.Collator();
    }
}

/**
 * @param {NavigatorNode[]} nodes
 * @param {string} [uiLocale]
 * @returns {NavigatorNode[]} `nodes`, sorted by `label`
 */
function sortByLabel(nodes, uiLocale) {
    const collator = labelCollator(uiLocale);
    return [...nodes].sort((a, b) => collator.compare(a.label, b.label));
}

/**
 * @param {string} iso - ISO 3166-1 alpha-2 code
 * @param {Object<string,string>|undefined} nations - `CatholicNations::localized()`
 * @param {string} [uiLocale]
 * @returns {string} `nations[iso]`, else the CLDR region name, else `iso`
 */
function nationLabel(iso, nations, uiLocale) {
    if (typeof nations?.[iso] === 'string' && nations[iso] !== '') return nations[iso];
    try {
        const locale = String(uiLocale ?? '').replaceAll('_', '-') || 'en';
        const name = new Intl.DisplayNames([locale], { type: 'region' }).of(iso);
        if (typeof name === 'string' && name !== iso) return name;
    } catch {
        // an unknown locale or code falls through to the bare ISO code
    }
    return iso;
}

/**
 * A `/calendars` wider region's declared member nations.
 * @param {{roster?: unknown, national_calendars?: unknown}} region
 * @returns {string[]} ISO codes
 */
function regionMembers(region) {
    const members = region.roster ?? region.national_calendars ?? [];
    return Array.isArray(members) ? members : Object.values(members);
}

/**
 * The nations whose national calendar declares `regionId` (via `wider_regions`/`wider_region`),
 * whether or not the region's own roster lists them.
 * @param {string} id - Region id
 * @param {object[]|undefined} nationalCalendars - `litcal_metadata.national_calendars`
 * @returns {string[]} ISO codes
 */
function nationsDeclaringRegion(id, nationalCalendars) {
    return (nationalCalendars ?? [])
        .filter((item) => nationWiderRegions(item).includes(id))
        .map((item) => item.calendar_id);
}

/**
 * @param {NavigatorRights|undefined} rights
 * @param {Set<string>} candidateIsoCodes
 * @returns {boolean} Whether the user is editor or admin of any of these nations' calendars
 */
function anyNationEditable(rights, candidateIsoCodes) {
    return [...candidateIsoCodes].some((iso) => canEdit(rights, NATIONAL_CALENDAR_TYPE, ROMAN_RITE, iso));
}

/**
 * @param {string} id
 * @param {string} label
 * @param {NavigatorNode[]} children
 * @returns {NavigatorNode} A structural group node (`no-region`, `ambrosian`): never `mine` on
 *   its own, never actionable
 */
function buildGroupNode(id, label, children) {
    return {
        kind: 'group',
        id,
        label,
        exists: true,
        actions: [],
        mine: false,
        children,
    };
}

/**
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.label
 * @param {string} params.rite
 * @param {boolean} params.exists
 * @param {boolean} params.nationExists - Ignored for the Ambrosian rite
 * @param {NavigatorRights|undefined} params.rights
 * @returns {NavigatorNode} A diocese node
 */
function buildDioceseNode({ id, label, rite, exists, nationExists, rights }) {
    const nationMissing = rite === ROMAN_RITE && !nationExists;
    const actions = [];
    let disabledReason;
    if (exists) {
        if (canEdit(rights, DIOCESAN_CALENDAR_TYPE, rite, id)) actions.push('edit');
    } else if (canCreate(rights, DIOCESAN_CALENDAR_TYPE, rite, id)) {
        actions.push('create');
        if (nationMissing) disabledReason = 'nation-missing';
    }
    if (actions.length === 0) {
        // The access-request diocese picker offers only nations that have a national calendar,
        // so a request on a Roman diocese of a nation without one could not be selected there:
        // offer none, and show why instead.
        if (nationMissing) {
            disabledReason = 'nation-missing';
        } else {
            actions.push('request');
        }
    }

    const node = {
        kind: 'diocese',
        id,
        rite,
        label,
        exists,
        actions,
        mine: actions.some((action) => action !== 'request'),
        children: [],
    };
    if (disabledReason) node.disabledReason = disabledReason;
    // The diocesan form reads and writes the Roman rite's `/data/diocese/{id}` only, so it
    // cannot open an Ambrosian diocese: offer a user who holds rights on it no action (but keep
    // `mine` driven by the rights); a user without rights keeps Request access, which the
    // access-request picker handles for `ambrosian/…`.
    if (rite === AMBROSIAN_RITE) {
        if (node.mine) node.actions = [];
        node.note = 'ambrosian-unsupported';
    }
    return node;
}

/**
 * A nation's dioceses: its created Roman diocesan calendars (from metadata), plus the
 * not-yet-created candidates loaded for it (from the `dioceses` Map), skipping any candidate
 * whose id is already a created calendar.
 * @param {string} iso
 * @param {object[]} diocesanCalendars - `litcal_metadata.diocesan_calendars`
 * @param {Map<string, {id: string, name: string}[]>|undefined} dioceses
 * @param {NavigatorRights|undefined} rights
 * @param {boolean} nationExists
 * @param {string} [uiLocale]
 * @returns {{children: NavigatorNode[], childrenPending: boolean}}
 */
function buildNationDioceses(iso, diocesanCalendars, dioceses, rights, nationExists, uiLocale) {
    const existing = diocesanCalendars.filter(
        (c) => (c.rite ?? ROMAN_RITE) === ROMAN_RITE && c.nation === iso,
    );
    const existingIds = new Set(existing.map((c) => c.calendar_id));

    const existingNodes = existing.map((c) => buildDioceseNode({
        id: c.calendar_id,
        label: c.diocese ?? c.calendar_id,
        rite: ROMAN_RITE,
        exists: true,
        nationExists,
        rights,
    }));

    const candidateNodes = (dioceses?.get(iso) ?? [])
        .filter((d) => !existingIds.has(d.id))
        .map((d) => buildDioceseNode({
            id: d.id,
            label: d.name,
            rite: ROMAN_RITE,
            exists: false,
            nationExists,
            rights,
        }));

    return {
        children: sortByLabel([...existingNodes, ...candidateNodes], uiLocale),
        childrenPending: !(dioceses?.has(iso) ?? false),
    };
}

/**
 * @param {object[]} diocesanCalendars - `litcal_metadata.diocesan_calendars`
 * @param {NavigatorRights|undefined} rights
 * @param {string} [uiLocale]
 * @returns {NavigatorNode[]} The Ambrosian diocesan calendars, sorted by label
 */
function buildAmbrosianDioceseNodes(diocesanCalendars, rights, uiLocale) {
    const nodes = diocesanCalendars
        .filter((c) => c.rite === AMBROSIAN_RITE)
        .map((c) => buildDioceseNode({
            id: c.calendar_id,
            label: c.diocese ?? c.calendar_id,
            rite: AMBROSIAN_RITE,
            exists: true,
            nationExists: true, // irrelevant: the Ambrosian rite never gets `nation-missing`
            rights,
        }));
    return sortByLabel(nodes, uiLocale);
}

/**
 * @param {object} params
 * @param {string} params.iso
 * @param {boolean} params.exists
 * @param {Object<string,string>|undefined} params.nations
 * @param {Object<string,string[]>|undefined} params.missals
 * @param {NavigatorRights|undefined} params.rights
 * @param {object[]} params.diocesanCalendars
 * @param {Map<string, {id: string, name: string}[]>|undefined} params.dioceses
 * @param {string} [params.uiLocale]
 * @returns {NavigatorNode} A nation node, with its diocese children
 */
function buildNationNode({ iso, exists, nations, missals, rights, diocesanCalendars, dioceses, uiLocale }) {
    const editable = canEdit(rights, NATIONAL_CALENDAR_TYPE, ROMAN_RITE, iso);
    const creatable = canCreate(rights, NATIONAL_CALENDAR_TYPE, ROMAN_RITE, iso);
    const missalEditions = missals?.[iso] ?? [];
    const hasMissal = missalEditions.length > 0;

    const actions = [];
    if (exists) {
        if (editable) actions.push('edit');
    } else if (creatable) {
        actions.push('create');
    }
    if (hasMissal && editable) actions.push('sanctorale');
    if (actions.length === 0) actions.push('request');

    const { children, childrenPending } = buildNationDioceses(
        iso, diocesanCalendars, dioceses, rights, exists, uiLocale,
    );

    const node = {
        kind: 'nation',
        id: iso,
        rite: ROMAN_RITE,
        label: nationLabel(iso, nations, uiLocale),
        exists,
        actions,
        mine: actions.some((action) => action !== 'request'),
        children,
    };
    if (hasMissal) {
        node.missals = missalEditions;
    } else {
        node.note = 'no-missal';
    }
    if (childrenPending) node.childrenPending = true;
    return node;
}

/**
 * @param {{id: string, label: string, exists: boolean, members: Set<string>}} region
 * @param {NavigatorRights|undefined} rights
 * @param {(iso: string) => NavigatorNode} buildNation - Memoized nation-node builder
 * @param {string} [uiLocale]
 * @returns {NavigatorNode} A region node, with its member nations as children
 */
function buildRegionNode(region, rights, buildNation, uiLocale) {
    const editable = canEdit(rights, WIDER_REGION_TYPE, ROMAN_RITE, region.id);
    const creatable = canCreate(rights, WIDER_REGION_TYPE, ROMAN_RITE, region.id);

    const actions = [];
    if (region.exists) {
        if (editable) {
            actions.push('edit');
        } else if (anyNationEditable(rights, region.members)) {
            actions.push('translate');
        }
    } else if (creatable) {
        actions.push('create');
    }
    if (actions.length === 0) actions.push('request');

    return {
        kind: 'region',
        id: region.id,
        rite: ROMAN_RITE,
        label: region.label,
        exists: region.exists,
        actions,
        mine: actions.some((action) => action !== 'request'),
        children: sortByLabel([...region.members].map(buildNation), uiLocale),
    };
}

/**
 * Builds the whole navigator tree: regions (existing, then prospective, each sorted by label),
 * then a `no-region` group of nations belonging to none, then an `ambrosian` group of the
 * Ambrosian diocesan calendars. The Vatican (`VA`) is left out everywhere. See docs/superpowers/specs/
 * 2026-09-30-particular-calendars-navigator-design.md Part 2 for the full rules.
 *
 * @param {object} params
 * @param {object} params.metadata - `/calendars` `litcal_metadata`
 * @param {{id: string, label: string, roster: string[]}[]|undefined} params.prospectiveRegions -
 *   `ProspectiveWiderRegions::all()`
 * @param {Object<string,string>|undefined} params.nations - `CatholicNations::localized()`
 * @param {Object<string,string[]>|undefined} params.missals - National Missal editions by nation
 * @param {NavigatorRights} params.rights - The user's rights (every tree is for an authenticated
 *   user; a user with no rights simply gets `request` everywhere)
 * @param {Map<string, {id: string, name: string}[]>|undefined} params.dioceses - Loaded
 *   not-yet-created diocese candidates, by nation
 * @param {string} [params.uiLocale]
 * @returns {NavigatorNode[]} The navigator tree
 */
export function buildNavigatorTree({ metadata, prospectiveRegions, nations, missals, rights, dioceses, uiLocale }) {
    const nationalCalendars = (metadata?.national_calendars ?? []).filter((item) => item.calendar_id !== VATICAN_ISO);
    const diocesanCalendars = metadata?.diocesan_calendars ?? [];
    const existingRegions = metadata?.wider_regions ?? [];

    const existingRegionIdSet = new Set(existingRegions.map(regionId));

    const existingRegionDescriptors = existingRegions.map((region) => {
        const id = regionId(region);
        return {
            id,
            label: regionLabel(region),
            exists: true,
            members: new Set([...regionMembers(region), ...nationsDeclaringRegion(id, nationalCalendars)]),
        };
    });

    const prospectiveRegionDescriptors = (prospectiveRegions ?? [])
        .filter((region) => !existingRegionIdSet.has(region.id))
        .map((region) => ({
            id: region.id,
            label: region.label,
            exists: false,
            members: new Set(region.roster ?? []),
        }));

    const regionDescriptors = [...existingRegionDescriptors, ...prospectiveRegionDescriptors];
    for (const region of regionDescriptors) region.members.delete(VATICAN_ISO);

    const existingNationIsoSet = new Set(nationalCalendars.map((item) => item.calendar_id));
    const nationIsoSet = new Set([
        ...Object.keys(nations ?? {}).filter((iso) => iso !== VATICAN_ISO),
        ...existingNationIsoSet,
        ...regionDescriptors.flatMap((region) => [...region.members]),
    ]);

    const nationNodeCache = new Map();
    const buildNation = (iso) => {
        if (!nationNodeCache.has(iso)) {
            nationNodeCache.set(iso, buildNationNode({
                iso,
                exists: existingNationIsoSet.has(iso),
                nations,
                missals,
                rights,
                diocesanCalendars,
                dioceses,
                uiLocale,
            }));
        }
        return nationNodeCache.get(iso);
    };

    const regionNodes = regionDescriptors.map((region) => buildRegionNode(region, rights, buildNation, uiLocale));
    const sortedRegionNodes = [
        ...sortByLabel(regionNodes.filter((node) => node.exists), uiLocale),
        ...sortByLabel(regionNodes.filter((node) => !node.exists), uiLocale),
    ];

    const placedIsoSet = new Set(regionDescriptors.flatMap((region) => [...region.members]));
    const noRegionNodes = sortByLabel(
        [...nationIsoSet].filter((iso) => !placedIsoSet.has(iso)).map(buildNation),
        uiLocale,
    );

    return [
        ...sortedRegionNodes,
        buildGroupNode(NO_REGION_GROUP_ID, 'No Region', noRegionNodes),
        buildGroupNode(AMBROSIAN_GROUP_ID, 'Ambrosian Rite', buildAmbrosianDioceseNodes(diocesanCalendars, rights, uiLocale)),
    ];
}

/**
 * Keeps only the nodes with `mine: true`, plus the ancestors needed to reach them (marked
 * `context: true`); an ancestor left with no surviving children — including a whole `no-region`
 * or `ambrosian` group — is dropped.
 * @param {NavigatorNode[]} nodes
 * @returns {NavigatorNode[]}
 */
export function filterMine(nodes) {
    return (nodes ?? []).map(filterMineNode).filter((node) => node !== null);
}

/**
 * @param {NavigatorNode} node
 * @returns {NavigatorNode|null}
 */
function filterMineNode(node) {
    const children = (node.children ?? []).map(filterMineNode).filter((child) => child !== null);
    if (node.mine) return { ...node, children };
    if (children.length === 0) return null;
    return { ...node, children, context: true };
}

/**
 * @param {string} nation - ISO 3166-1 alpha-2 code
 * @param {Map<string, {id: string, name: string}[]>|undefined} worldDioceses - See
 *   `diocesesByNation()` in `dioceseObjectIdPicker.js`
 * @returns {{id: string, name: string}[]} The nation's dioceses, or `[]` when not loaded
 */
export function nationDioceses(nation, worldDioceses) {
    return worldDioceses?.get(String(nation ?? '').toUpperCase()) ?? [];
}

/**
 * The nation a diocese belongs to, for the diocesan form's national dependency: from its entry
 * in `/calendars` when its calendar exists, else from the world's dioceses (a not-yet-created one).
 * @param {string} id - Bare diocese id, e.g. `roma_it`
 * @param {{diocesan_calendars?: {calendar_id: string, nation: string}[]}|undefined} metadata
 * @param {Map<string, {id: string, name: string}[]>|undefined} worldDioceses - See
 *   `diocesesByNation()` in `dioceseObjectIdPicker.js`
 * @returns {string|null} Upper-case ISO 3166-1 alpha-2 code, or `null` when neither knows it
 */
export function dioceseNation(id, metadata, worldDioceses) {
    const existing = metadata?.diocesan_calendars?.find((calendar) => calendar.calendar_id === id);
    if (existing?.nation) return String(existing.nation).toUpperCase();

    for (const [nation, dioceses] of worldDioceses ?? []) {
        if (dioceses.some((diocese) => diocese.id === id)) return nation;
    }
    return null;
}

/**
 * The locale to open an existing wider region in when a deep link names none: the wider region
 * form loads a region one locale at a time, and refuses one whose language is not official
 * (`metadata.locales`). Among the region's official locales (all of them when none is official)
 * it prefers the UI locale, then the first in the UI language, then the first.
 * @param {string} id - Region id
 * @param {{wider_regions?: {id?: string, name?: string, locales?: string[]}[], locales?: string[]}|undefined} metadata
 * @param {string} uiLocale - e.g. `it_IT`
 * @returns {string|null} `null` when the region does not exist yet (or has no locales)
 */
export function widerRegionOpeningLocale(id, metadata, uiLocale) {
    const locales = metadata?.wider_regions?.find((region) => regionId(region) === id)?.locales ?? [];
    const language = (locale) => String(locale ?? '').split('_')[0];
    const official = locales.filter((locale) => (metadata?.locales ?? []).includes(language(locale)));
    const candidates = official.length > 0 ? official : locales;
    if (candidates.length === 0) return null;
    return candidates.find((locale) => locale === uiLocale)
        ?? candidates.find((locale) => language(locale) === language(uiLocale))
        ?? candidates[0];
}

/**
 * Parses the hub's deep-link query string (`?choice=national&calendar=IT`) into the form
 * `extending.js` uses to prefill a form. Returns `null` on anything invalid: an unknown
 * `choice`, a `calendar` failing `CALENDAR_ID_PATTERN`, an unknown `rite`, or a `locale` failing
 * `LOCALE_PATTERN`.
 * @param {string} search - `location.search`, with or without its leading `?`
 * @returns {{choice: string, calendar: string, locale: string|null, rite: string}|null}
 */
export function parseDeepLink(search) {
    const params = new URLSearchParams(search ?? '');

    const choice = params.get('choice');
    if (!DEEP_LINK_CHOICES.includes(choice)) return null;

    const calendar = params.get('calendar');
    if (!CALENDAR_ID_PATTERN.test(calendar ?? '')) return null;

    const riteParam = params.get('rite');
    const rite = riteParam === null ? ROMAN_RITE : riteParam;
    if (!KNOWN_RITES.includes(rite)) return null;

    const localeParam = params.get('locale');
    if (localeParam !== null && !LOCALE_PATTERN.test(localeParam)) return null;

    return { choice, calendar, locale: localeParam, rite };
}

/**
 * @param {string} type - An OpenFGA object type (`national_calendar`, `diocesan_calendar`, `wider_region`)
 * @param {string} id - The bare calendar id
 * @param {string} rite
 * @param {boolean} exists - Whether the calendar exists: creating one needs `admin` (API #669),
 *   so a request on one not yet created asks for it; otherwise no relation is named (`editor`)
 * @returns {string} `permission-requests.php?object_type=…&object_id=…[&relation=admin]`, URL-encoded
 */
function requestUrl(type, id, rite, exists) {
    const params = new URLSearchParams({ object_type: type, object_id: qualifyObjectId(type, id, rite) });
    if (!exists) params.set('relation', 'admin');
    return `permission-requests.php?${params.toString()}`;
}

/**
 * The URL a node's action button opens. See docs/superpowers/specs/
 * 2026-09-30-particular-calendars-navigator-design.md Part 3, "Where each action goes".
 * @param {NavigatorNode} node
 * @param {'edit'|'create'|'sanctorale'|'translate'|'request'} action
 * @param {{locale?: string}} [context] - `locale`: required for `translate` (the user's first
 *   editable locale of the region)
 * @returns {string}
 */
export function actionUrl(node, action, context = {}) {
    const params = new URLSearchParams();

    switch (node.kind) {
        case 'region':
            if (action === 'edit' || action === 'create') {
                params.set('choice', 'widerRegion');
                params.set('calendar', node.id);
                return `extending.php?${params.toString()}`;
            }
            if (action === 'translate') {
                params.set('choice', 'widerRegion');
                params.set('calendar', node.id);
                params.set('locale', context.locale ?? '');
                return `extending.php?${params.toString()}`;
            }
            if (action === 'request') return requestUrl(WIDER_REGION_TYPE, node.id, ROMAN_RITE, node.exists);
            break;

        case 'nation':
            if (action === 'edit' || action === 'create') {
                params.set('choice', 'national');
                params.set('calendar', node.id);
                return `extending.php?${params.toString()}`;
            }
            if (action === 'sanctorale') {
                return `sanctorale.php#${new URLSearchParams({ rite: node.rite, calendar: node.id }).toString()}`;
            }
            if (action === 'request') return requestUrl(NATIONAL_CALENDAR_TYPE, node.id, ROMAN_RITE, node.exists);
            break;

        case 'diocese':
            if (action === 'edit' || action === 'create') {
                params.set('choice', 'diocesan');
                params.set('calendar', node.id);
                params.set('rite', node.rite);
                return `extending.php?${params.toString()}`;
            }
            if (action === 'request') return requestUrl(DIOCESAN_CALENDAR_TYPE, node.id, node.rite, node.exists);
            break;

        default:
            break;
    }

    throw new Error(`particularCalendarsTree: no URL for action "${action}" on node kind "${node.kind}"`);
}

/**
 * @typedef {Object} BreadcrumbSegment
 * @property {string} label
 * @property {string|null} href - `null` for the last segment: the form's loaded (or
 *   about-to-be-created) calendar itself
 */

/** The hub's own breadcrumb segment: first on every form. */
const HUB_HREF = 'extending.php';

/**
 * The hub and Ambrosian-rite segment labels `breadcrumbSegments()` returns, in English: the same
 * convention `buildGroupNode()` uses for its own group labels ('No Region', 'Ambrosian Rite').
 * The caller — `extending.js` — localizes them via `Messages` before rendering.
 */
const HUB_LABEL = 'Particular Calendars';
const AMBROSIAN_RITE_LABEL = 'Ambrosian Rite';

/**
 * @param {string} id - Region id
 * @param {{wider_regions?: object[]}|undefined} metadata - `/calendars` `litcal_metadata`
 * @returns {string} The region's label from metadata, else words derived from its id (a
 *   prospective region, not yet in metadata)
 */
function regionLabelForId(id, metadata) {
    const region = (metadata?.wider_regions ?? []).find((candidate) => regionId(candidate) === id);
    return region ? regionLabel(region) : idToWords(id);
}

/**
 * The breadcrumb above one of the three particular calendar forms (#66 Part 5): the hub, then
 * the loaded (or about-to-be-created) calendar's ancestors, ending with the calendar itself
 * (no link). Every non-final segment's link is the same URL `actionUrl()`'s `edit` action would
 * produce for that ancestor, so a region or nation segment opens correctly whether or not it
 * exists yet.
 *
 * - `widerRegion`: the hub, then the region itself (no parent to link to).
 * - `national`: the hub, then one segment per region the nation belongs to — those its
 *   `/calendars` entry declares and those whose roster lists it, calendar or not (the tree's
 *   membership), deduplicated, broadest first (`widerRegionsByNation()`) — then the nation itself.
 * - `diocesan`: the hub, then the diocese's nation (from `metadata` when the diocese's calendar
 *   exists, else from `worldDioceses`, a not-yet-created one), then the diocese; for the
 *   Ambrosian rite, which has no national tier, the middle segment is the rite itself (linked to
 *   the hub) instead of a nation.
 *
 * @param {object} params
 * @param {'widerRegion'|'national'|'diocesan'} params.choice
 * @param {string} params.calendar - The loaded (or about-to-be-created) calendar's id: a wider
 *   region id, an ISO 3166-1 alpha-2 nation code, or a bare diocese id
 * @param {string} [params.rite] - `roman` (default) or `ambrosian`; only meaningful for
 *   `diocesan`
 * @param {object} [params.metadata] - `/calendars` `litcal_metadata`
 * @param {string} [params.uiLocale]
 * @param {Map<string, {id: string, name: string}[]>} [params.worldDioceses] - See
 *   `diocesesByNation()` in `dioceseObjectIdPicker.js`; resolves a not-yet-created diocese's
 *   nation and name
 * @returns {BreadcrumbSegment[]} Always starts with the hub segment
 */
export function breadcrumbSegments({ choice, calendar, rite = ROMAN_RITE, metadata, uiLocale, worldDioceses }) {
    const hub = { label: HUB_LABEL, href: HUB_HREF };

    if (choice === 'widerRegion') {
        return [hub, { label: regionLabelForId(calendar, metadata), href: null }];
    }

    if (choice === 'national') {
        const memberships = widerRegionsByNation(metadata?.national_calendars, metadata?.wider_regions);
        const regionSegments = (memberships[calendar] ?? []).map((id) => ({
            label: regionLabelForId(id, metadata),
            href: actionUrl({ kind: 'region', id, rite: ROMAN_RITE }, 'edit'),
        }));
        return [hub, ...regionSegments, { label: nationLabel(calendar, undefined, uiLocale), href: null }];
    }

    if (choice === 'diocesan') {
        const existing = metadata?.diocesan_calendars?.find((c) => c.calendar_id === calendar);

        if (rite === AMBROSIAN_RITE) {
            return [
                hub,
                { label: AMBROSIAN_RITE_LABEL, href: HUB_HREF },
                { label: existing?.diocese ?? calendar, href: null },
            ];
        }

        const nation = dioceseNation(calendar, metadata, worldDioceses);
        const dioceseLabel = existing?.diocese
            ?? nationDioceses(nation ?? '', worldDioceses).find((d) => d.id === calendar)?.name
            ?? calendar;
        if (nation === null) return [hub, { label: dioceseLabel, href: null }];
        return [
            hub,
            {
                label: nationLabel(nation, undefined, uiLocale),
                href: actionUrl({ kind: 'nation', id: nation, rite: ROMAN_RITE }, 'edit'),
            },
            { label: dioceseLabel, href: null },
        ];
    }

    return [hub];
}
