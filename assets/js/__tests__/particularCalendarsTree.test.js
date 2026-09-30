import { describe, it, expect } from 'vitest';
import {
    actionUrl,
    buildNavigatorTree,
    dioceseNation,
    filterMine,
    nationDioceses,
    parseDeepLink,
    widerRegionOpeningLocale,
} from '../particularCalendarsTree.js';

// Fixtures shaped like the hub's inputs (see the design doc, Part 1-2): a national IT and NL
// (both declaring `europe`), SE absent as a national calendar; a diocesan roma_it (IT, roman)
// and lugano_ch (CH, ambrosian); the existing region europe (roster IT NL SE DE); the
// prospective regions nordic (roster SE DK) and africa (roster KE).

function baseMetadata() {
    return {
        national_calendars: [
            { calendar_id: 'IT', wider_regions: ['europe'] },
            { calendar_id: 'NL', wider_regions: ['europe'] },
        ],
        diocesan_calendars: [
            { calendar_id: 'roma_it', diocese: 'Roma', nation: 'IT', rite: 'roman' },
            { calendar_id: 'lugano_ch', diocese: 'Lugano', nation: 'CH', rite: 'ambrosian' },
        ],
        wider_regions: [
            { id: 'europe', label: 'Europe', roster: ['IT', 'NL', 'SE', 'DE'] },
        ],
    };
}

function metadataWithoutIT() {
    const metadata = baseMetadata();
    return { ...metadata, national_calendars: metadata.national_calendars.filter((c) => c.calendar_id !== 'IT') };
}

const PROSPECTIVE_REGIONS = [
    { id: 'nordic', label: 'Nordic', roster: ['SE', 'DK'] },
    { id: 'africa', label: 'Africa', roster: ['KE'] },
];

const NATIONS = {
    IT: 'Italy',
    NL: 'Netherlands',
    SE: 'Sweden',
    DK: 'Denmark',
    DE: 'Germany',
    KE: 'Kenya',
    FR: 'France',
    CH: 'Switzerland',
};

const MISSALS = { IT: ['IT_1983'] };

/**
 * @param {object} [overrides]
 * @returns {import('../particularCalendarsTree.js').NavigatorRights}
 */
function rights({ isGlobalAdmin = false, admin = {}, editor = {} } = {}) {
    return {
        isGlobalAdmin,
        admin: { national_calendar: [], diocesan_calendar: [], wider_region: [], ...admin },
        editor: { national_calendar: [], diocesan_calendar: [], wider_region: [], ...editor },
    };
}

function buildTree({ metadata = baseMetadata(), rights: theRights = rights(), dioceses = new Map(), uiLocale = 'en' } = {}) {
    return buildNavigatorTree({
        metadata,
        prospectiveRegions: PROSPECTIVE_REGIONS,
        nations: NATIONS,
        missals: MISSALS,
        rights: theRights,
        dioceses,
        uiLocale,
    });
}

function findNode(nodes, matcher) {
    for (const node of nodes) {
        if (matcher(node)) return node;
        const found = findNode(node.children ?? [], matcher);
        if (found) return found;
    }
    return null;
}

function findAll(nodes, matcher, results = []) {
    for (const node of nodes) {
        if (matcher(node)) results.push(node);
        findAll(node.children ?? [], matcher, results);
    }
    return results;
}

describe('buildNavigatorTree — structure', () => {
    const dioceses = new Map([
        ['IT', [{ id: 'torino_it', name: 'Torino' }, { id: 'roma_it', name: 'Roma (already created)' }]],
    ]);
    const tree = buildTree({ rights: rights({ isGlobalAdmin: true }), dioceses });

    it('lists existing regions before prospective ones, each sorted by label', () => {
        expect(tree.map((n) => n.id)).toEqual(['europe', 'africa', 'nordic', 'no-region', 'ambrosian']);
    });

    it('places SE under both europe and nordic with the same actions', () => {
        const europe = tree.find((n) => n.id === 'europe');
        const nordic = tree.find((n) => n.id === 'nordic');
        const seInEurope = europe.children.find((n) => n.id === 'SE');
        const seInNordic = nordic.children.find((n) => n.id === 'SE');
        expect(seInEurope).toBeTruthy();
        expect(seInNordic).toBeTruthy();
        expect(seInEurope.actions).toEqual(seInNordic.actions);
    });

    it('places FR, which is in no roster, under no-region', () => {
        const noRegion = tree.find((n) => n.id === 'no-region');
        expect(noRegion.children.map((n) => n.id)).toContain('FR');
    });

    it('places lugano_ch under the ambrosian group', () => {
        const ambrosian = tree.find((n) => n.id === 'ambrosian');
        expect(ambrosian.children.map((n) => n.id)).toEqual(['lugano_ch']);
    });

    it('places roma_it under IT', () => {
        const europe = tree.find((n) => n.id === 'europe');
        const it = europe.children.find((n) => n.id === 'IT');
        expect(it.children.map((n) => n.id)).toContain('roma_it');
    });

    it('adds a not-yet-created diocese from the dioceses Map, without duplicating a created one', () => {
        const europe = tree.find((n) => n.id === 'europe');
        const it = europe.children.find((n) => n.id === 'IT');
        const torino = it.children.find((n) => n.id === 'torino_it');
        expect(torino).toBeTruthy();
        expect(torino.exists).toBe(false);
        expect(it.children.filter((n) => n.id === 'roma_it')).toHaveLength(1);
    });
});

describe('buildNavigatorTree — global admin', () => {
    const tree = buildTree({ rights: rights({ isGlobalAdmin: true }) });

    it('offers edit on every existing node and create on every missing one', () => {
        const nodes = findAll(tree, (n) => n.kind !== 'group');
        expect(nodes.length).toBeGreaterThan(0);
        for (const node of nodes) {
            if (node.exists) {
                expect(node.actions).toContain('edit');
            } else {
                expect(node.actions).toContain('create');
            }
        }
    });

    it('offers sanctorale on IT, which has a Missal edition', () => {
        const it = findNode(tree, (n) => n.kind === 'nation' && n.id === 'IT');
        expect(it.actions).toEqual(['edit', 'sanctorale']);
        expect(it.missals).toEqual(['IT_1983']);
    });

    it('marks NL with the no-missal note and no sanctorale action', () => {
        const nl = findNode(tree, (n) => n.kind === 'nation' && n.id === 'NL');
        expect(nl.actions).toEqual(['edit']);
        expect(nl.note).toBe('no-missal');
        expect(nl.missals).toBeUndefined();
    });
});

describe('buildNavigatorTree — national editor of IT', () => {
    const tree = buildTree({ rights: rights({ editor: { national_calendar: ['roman/IT'] } }) });

    it('lets IT be edited, with sanctorale', () => {
        const it = findNode(tree, (n) => n.kind === 'nation' && n.id === 'IT');
        expect(it.actions).toEqual(['edit', 'sanctorale']);
    });

    it('offers translate on europe, since IT is a member the editor may edit', () => {
        const europe = tree.find((n) => n.id === 'europe');
        expect(europe.actions).toEqual(['translate']);
    });

    it('offers only request on NL and on roma_it', () => {
        const nl = findNode(tree, (n) => n.kind === 'nation' && n.id === 'NL');
        const romaIt = findNode(tree, (n) => n.id === 'roma_it');
        expect(nl.actions).toEqual(['request']);
        expect(romaIt.actions).toEqual(['request']);
    });
});

describe('buildNavigatorTree — national admin of a missing nation', () => {
    it('offers create on DK', () => {
        const tree = buildTree({ rights: rights({ admin: { national_calendar: ['roman/DK'] } }) });
        const dk = findNode(tree, (n) => n.kind === 'nation' && n.id === 'DK');
        expect(dk.actions).toEqual(['create']);
    });
});

describe('buildNavigatorTree — diocese admin, nation missing', () => {
    it('offers create on torino_it, with disabledReason nation-missing', () => {
        const dioceses = new Map([['IT', [{ id: 'torino_it', name: 'Torino' }]]]);
        const tree = buildTree({
            metadata: metadataWithoutIT(),
            rights: rights({ admin: { diocesan_calendar: ['roman/torino_it'] } }),
            dioceses,
        });
        const torino = findNode(tree, (n) => n.id === 'torino_it');
        expect(torino.actions).toEqual(['create']);
        expect(torino.disabledReason).toBe('nation-missing');
    });

    it('never sets nation-missing on an Ambrosian diocese', () => {
        const tree = buildTree({ metadata: metadataWithoutIT(), rights: rights({ isGlobalAdmin: true }) });
        const lugano = findNode(tree, (n) => n.id === 'lugano_ch');
        expect(lugano.disabledReason).toBeUndefined();
    });
});

describe('buildNavigatorTree — admin on a prospective region', () => {
    it('offers create on nordic', () => {
        const tree = buildTree({ rights: rights({ admin: { wider_region: ['roman/nordic'] } }) });
        const nordic = tree.find((n) => n.id === 'nordic');
        expect(nordic.actions).toEqual(['create']);
    });
});

describe('mine and filterMine', () => {
    it('is true exactly on nodes with an action other than request', () => {
        const tree = buildTree({ rights: rights({ editor: { national_calendar: ['roman/IT'] } }) });
        for (const node of findAll(tree, () => true)) {
            expect(node.mine).toBe(node.actions.some((a) => a !== 'request'));
        }
    });

    it('keeps mine nodes and their ancestors, marking ancestors context: true, and drops empty groups', () => {
        const tree = buildTree({ rights: rights({ editor: { national_calendar: ['roman/IT'] } }) });
        const filtered = filterMine(tree);

        const europe = filtered.find((n) => n.id === 'europe');
        expect(europe).toBeTruthy();
        expect(europe.mine).toBe(true);
        expect(europe.context).toBeUndefined();

        const it = europe.children.find((n) => n.id === 'IT');
        expect(it).toBeTruthy();
        expect(it.mine).toBe(true);
        expect(europe.children.map((n) => n.id)).not.toContain('NL');
        expect(it.children.map((n) => n.id)).not.toContain('roma_it');

        expect(filtered.map((n) => n.id)).not.toContain('no-region');
        expect(filtered.map((n) => n.id)).not.toContain('ambrosian');
        expect(filtered.map((n) => n.id)).not.toContain('nordic');
    });

    it('marks a context ancestor that carries no rights of its own', () => {
        const dioceses = new Map([['IT', [{ id: 'torino_it', name: 'Torino' }]]]);
        const tree = buildTree({
            rights: rights({ admin: { diocesan_calendar: ['roman/torino_it'] } }),
            dioceses,
        });
        const filtered = filterMine(tree);

        const europe = filtered.find((n) => n.id === 'europe');
        expect(europe.context).toBe(true);

        const it = europe.children.find((n) => n.id === 'IT');
        expect(it.context).toBe(true);
        expect(it.mine).toBe(false);

        const torino = it.children.find((n) => n.id === 'torino_it');
        expect(torino.mine).toBe(true);
        expect(torino.context).toBeUndefined();
    });
});

describe('parseDeepLink', () => {
    it('parses a national deep link', () => {
        expect(parseDeepLink('?choice=national&calendar=IT'))
            .toEqual({ choice: 'national', calendar: 'IT', locale: null, rite: 'roman' });
    });

    it('parses a region deep link with a locale', () => {
        expect(parseDeepLink('?choice=widerRegion&calendar=europe&locale=en_US'))
            .toEqual({ choice: 'widerRegion', calendar: 'europe', locale: 'en_US', rite: 'roman' });
    });

    it('parses a diocesan deep link with an explicit rite', () => {
        expect(parseDeepLink('?choice=diocesan&calendar=lugano_ch&rite=ambrosian'))
            .toEqual({ choice: 'diocesan', calendar: 'lugano_ch', locale: null, rite: 'ambrosian' });
    });

    it('rejects an unknown choice', () => {
        expect(parseDeepLink('?choice=bogus&calendar=IT')).toBeNull();
    });

    it('rejects a calendar id failing the id pattern', () => {
        expect(parseDeepLink('?choice=national&calendar=IT/etc')).toBeNull();
        expect(parseDeepLink('?choice=national&calendar=')).toBeNull();
        expect(parseDeepLink('?choice=national')).toBeNull();
    });

    it('rejects an unknown rite', () => {
        expect(parseDeepLink('?choice=diocesan&calendar=lugano_ch&rite=bogus')).toBeNull();
    });

    it('rejects an invalid locale', () => {
        expect(parseDeepLink('?choice=national&calendar=IT&locale=not-a-locale')).toBeNull();
    });
});

describe('actionUrl', () => {
    const europeNode = { kind: 'region', id: 'europe', rite: 'roman', label: 'Europe' };
    const nationNode = { kind: 'nation', id: 'IT', rite: 'roman', label: 'Italy' };
    const dioceseNode = { kind: 'diocese', id: 'lugano_ch', rite: 'ambrosian', label: 'Lugano' };

    it('edit or create a region', () => {
        expect(actionUrl(europeNode, 'edit')).toBe('extending.php?choice=widerRegion&calendar=europe');
        expect(actionUrl(europeNode, 'create')).toBe('extending.php?choice=widerRegion&calendar=europe');
    });

    it('translate a region, with a locale', () => {
        expect(actionUrl(europeNode, 'translate', { locale: 'it_IT' }))
            .toBe('extending.php?choice=widerRegion&calendar=europe&locale=it_IT');
    });

    it('edit or create a nation', () => {
        expect(actionUrl(nationNode, 'edit')).toBe('extending.php?choice=national&calendar=IT');
        expect(actionUrl(nationNode, 'create')).toBe('extending.php?choice=national&calendar=IT');
    });

    it('the Proper of Saints for a nation', () => {
        expect(actionUrl(nationNode, 'sanctorale')).toBe('sanctorale.php#rite=roman&calendar=IT');
    });

    it('edit or create a diocese', () => {
        expect(actionUrl(dioceseNode, 'edit')).toBe('extending.php?choice=diocesan&calendar=lugano_ch&rite=ambrosian');
        expect(actionUrl(dioceseNode, 'create')).toBe('extending.php?choice=diocesan&calendar=lugano_ch&rite=ambrosian');
    });

    it('requests access, URL-encoding the rite-qualified object id', () => {
        expect(actionUrl(nationNode, 'request'))
            .toBe('permission-requests.php?object_type=national_calendar&object_id=roman%2FIT');
        expect(actionUrl(europeNode, 'request'))
            .toBe('permission-requests.php?object_type=wider_region&object_id=roman%2Feurope');
        expect(actionUrl(dioceseNode, 'request'))
            .toBe('permission-requests.php?object_type=diocesan_calendar&object_id=ambrosian%2Flugano_ch');
    });
});

describe('nationDioceses', () => {
    it('reads a nation entry from the Map, upper-cased', () => {
        const map = new Map([['IT', [{ id: 'torino_it', name: 'Torino' }]]]);
        expect(nationDioceses('it', map)).toEqual([{ id: 'torino_it', name: 'Torino' }]);
    });

    it('returns an empty array when not loaded', () => {
        expect(nationDioceses('NL', new Map())).toEqual([]);
        expect(nationDioceses('NL', undefined)).toEqual([]);
    });
});

describe('dioceseNation', () => {
    const world = new Map([
        ['IT', [{ id: 'torino_it', name: 'Torino' }, { id: 'roma_it', name: 'Roma' }]],
        ['CH', [{ id: 'lugano_ch', name: 'Lugano' }]],
    ]);

    it('reads an existing diocesan calendar\'s nation from the metadata, upper-cased', () => {
        const metadata = { diocesan_calendars: [{ calendar_id: 'roma_it', nation: 'it', rite: 'roman' }] };
        expect(dioceseNation('roma_it', metadata, undefined)).toBe('IT');
    });

    it('prefers the metadata over the world dioceses', () => {
        const metadata = { diocesan_calendars: [{ calendar_id: 'lugano_ch', nation: 'CH', rite: 'ambrosian' }] };
        expect(dioceseNation('lugano_ch', metadata, new Map([['IT', [{ id: 'lugano_ch', name: 'x' }]]]))).toBe('CH');
    });

    it('finds a not-yet-created diocese in the world dioceses', () => {
        expect(dioceseNation('torino_it', baseMetadata(), world)).toBe('IT');
    });

    it('returns null for a diocese unknown to both', () => {
        expect(dioceseNation('atlantis_xx', baseMetadata(), world)).toBeNull();
        expect(dioceseNation('atlantis_xx', undefined, undefined)).toBeNull();
    });
});

describe('widerRegionOpeningLocale', () => {
    const metadata = {
        locales: ['de', 'it', 'nl'],
        wider_regions: [{ id: 'europe', locales: ['bg_BG', 'de_DE', 'it_CH', 'it_IT', 'nl_NL'] }],
    };

    it('opens the UI locale when the region offers it', () => {
        expect(widerRegionOpeningLocale('europe', metadata, 'it_IT')).toBe('it_IT');
    });

    it('falls back to the first locale in the UI language', () => {
        expect(widerRegionOpeningLocale('europe', metadata, 'it_VA')).toBe('it_CH');
    });

    it('falls back to the region\'s first official locale', () => {
        expect(widerRegionOpeningLocale('europe', metadata, 'en_US')).toBe('de_DE');
    });

    it('never picks an unofficial locale while an official one exists', () => {
        expect(widerRegionOpeningLocale('europe', metadata, 'bg_BG')).toBe('de_DE');
    });

    it('falls back to the first locale when none is official', () => {
        const asia = { locales: ['en'], wider_regions: [{ id: 'asia', locales: ['ja_JP', 'zh_Hans_CN'] }] };
        expect(widerRegionOpeningLocale('asia', asia, 'en_US')).toBe('ja_JP');
    });

    it('reads a region an older API names only by `name`', () => {
        expect(widerRegionOpeningLocale('Europe', { wider_regions: [{ name: 'Europe', locales: ['fr_FR'] }] }, 'en_US')).toBe('fr_FR');
    });

    it('returns null for a region that does not exist yet, or has no locales', () => {
        expect(widerRegionOpeningLocale('nordic', metadata, 'en_US')).toBeNull();
        expect(widerRegionOpeningLocale('europe', { wider_regions: [{ id: 'europe', locales: [] }] }, 'en_US')).toBeNull();
        expect(widerRegionOpeningLocale('europe', undefined, 'en_US')).toBeNull();
    });
});

describe('buildNavigatorTree — the Vatican', () => {
    it('leaves VA out everywhere, even when a roster, a declaration or the nations list names it', () => {
        const metadata = baseMetadata();
        metadata.national_calendars = [
            ...metadata.national_calendars,
            { calendar_id: 'VA', wider_regions: ['europe'] },
        ];
        metadata.wider_regions = [{ id: 'europe', label: 'Europe', roster: ['IT', 'NL', 'SE', 'DE', 'VA'] }];
        const tree = buildNavigatorTree({
            metadata,
            prospectiveRegions: [...PROSPECTIVE_REGIONS, { id: 'holy-see', label: 'Holy See', roster: ['VA', 'IT'] }],
            nations: { ...NATIONS, VA: 'Vatican City' },
            missals: MISSALS,
            rights: rights({ isGlobalAdmin: true }),
            dioceses: new Map(),
            uiLocale: 'en',
        });
        expect(findAll(tree, (n) => n.id === 'VA')).toEqual([]);
        expect(tree.find((n) => n.id === 'holy-see').children.map((n) => n.id)).toEqual(['IT']);
    });
});
