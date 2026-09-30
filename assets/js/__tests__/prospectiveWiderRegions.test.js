/**
 * Tests for the wider region id/label rules and the prospective-region helpers
 * shared by the permission pickers and the extending page (#591, #66, #1018).
 */
import { describe, it, expect } from 'vitest';
import {
    WIDER_REGION_ID_PATTERN,
    WIDER_REGION_LEGACY_NAME_PATTERN,
    findProspectiveRegion,
    idToWords,
    isAcceptedWiderRegionKey,
    isValidWiderRegionId,
    labelKeyForLocale,
    normalizeWiderRegionKey,
    offeredLocales,
    membersWithoutOfferedLocale,
    regionId,
    regionLabel,
    resolveLabel,
    rosterToNationalCalendars,
    widerRegionNationalCalendars,
} from '../prospectiveWiderRegions.js';

const prospective = [
    {
        id: 'nordic',
        description: 'Nordic Episcopal Conference',
        roster: ['DK', 'SE'],
        locales: ['da_DK'],
    },
    {
        id: 'southern-africa',
        description: '',
        roster: ['ZA', 'BW', 'SZ'],
        locales: [],
    },
];

describe('isValidWiderRegionId', () => {
    it.each([
        'europe',
        'german-language-area',
        'senegal-mauritania-cabo-verde-guinea-bissau',
    ])('accepts %s', (id) => {
        expect(isValidWiderRegionId(id)).toBe(true);
    });
    it.each([
        '',
        'Europe',
        'german language area',
        'german--area',
        '-europe',
        'europe-',
        'são-tomé',
        'area1',
        42,
        null,
    ])('rejects %s', (id) => {
        expect(isValidWiderRegionId(id)).toBe(false);
    });
    it('exposes the pattern', () => {
        expect(WIDER_REGION_ID_PATTERN.source).toBe('^[a-z]+(-[a-z]+)*$');
    });
});

describe('regionId / regionLabel', () => {
    it('prefer id and label', () => {
        const region = { id: 'europe', label: 'Europa', name: 'europe' };
        expect(regionId(region)).toBe('europe');
        expect(regionLabel(region)).toBe('Europa');
    });
    it('fall back to name on an older API', () => {
        expect(regionId({ name: 'Europe' })).toBe('Europe');
        expect(regionLabel({ name: 'Europe' })).toBe('Europe');
    });
});

describe('labelKeyForLocale', () => {
    it.each([
        ['it_IT', 'it'],
        ['it_CH', 'it'],
        ['de', 'de'],
        ['zh_Hans_SG', 'zh_Hans'],
        ['zh-Hant-TW', 'zh_Hant'],
        ['sr_Latn_RS', 'sr_Latn'],
    ])('%s → %s', (locale, key) => {
        expect(labelKeyForLocale(locale)).toBe(key);
    });
});

describe('idToWords', () => {
    it('title-cases each word', () => {
        expect(idToWords('german-language-area')).toBe('German Language Area');
        expect(idToWords('europe')).toBe('Europe');
    });
});

describe('resolveLabel', () => {
    const labels = { en: 'Chinese Area', zh_Hans: '华语区', it: 'Area cinese' };
    it('tries language plus script, then language, then en', () => {
        expect(resolveLabel(labels, 'zh_Hans_CN', 'chinese-area')).toBe(
            '华语区',
        );
        expect(resolveLabel(labels, 'it_IT', 'chinese-area')).toBe(
            'Area cinese',
        );
        expect(resolveLabel(labels, 'zh_Hant_TW', 'chinese-area')).toBe(
            'Chinese Area',
        );
        expect(resolveLabel(labels, 'fr', 'chinese-area')).toBe('Chinese Area');
    });
    it('uses the M.49 name before the id words', () => {
        expect(resolveLabel({}, 'fr', 'africa', '002')).toBe('Afrique');
        expect(
            resolveLabel({ fr: 'Continent africain' }, 'fr', 'africa', '002'),
        ).toBe('Continent africain');
    });
    it('falls back to words from the id', () => {
        expect(resolveLabel(null, 'it', 'north-africa')).toBe('North Africa');
    });
    it('infers the default script for a scriptless Chinese locale', () => {
        const chineseLabels = { zh_Hant: '中華地區', zh_Hans: '简体地区' };
        expect(resolveLabel(chineseLabels, 'zh_TW', 'id')).toBe('中華地區');
        expect(resolveLabel(chineseLabels, 'zh_CN', 'id')).toBe('简体地区');
        expect(resolveLabel(chineseLabels, 'zh', 'id')).toBe('简体地区');
    });
    it('skips the bare-language key when the labels hold another script', () => {
        expect(
            resolveLabel(
                { zh: 'Simplified-only', zh_Hans: '简体', en: 'X' },
                'zh_Hant_TW',
                'id',
            ),
        ).toBe('X');
    });
    it('leaves a script-less non-Chinese locale unaffected', () => {
        expect(resolveLabel({ it: 'Etichetta' }, 'it_IT', 'id')).toBe(
            'Etichetta',
        );
    });
});

describe('findProspectiveRegion', () => {
    it('finds by exact id', () => {
        expect(findProspectiveRegion(prospective, 'nordic')?.roster).toEqual([
            'DK',
            'SE',
        ]);
    });
    it('is undefined for an unknown id, a different case, or no list', () => {
        expect(findProspectiveRegion(prospective, 'europe')).toBeUndefined();
        expect(findProspectiveRegion(prospective, 'Nordic')).toBeUndefined();
        expect(findProspectiveRegion(null, 'nordic')).toBeUndefined();
    });
});

describe('rosterToNationalCalendars', () => {
    it('maps English names to codes, as the API expects', () => {
        expect(rosterToNationalCalendars(['ZA', 'BW', 'SZ'])).toEqual({
            'South Africa': 'ZA',
            Botswana: 'BW',
            Eswatini: 'SZ',
        });
    });
});

describe('widerRegionNationalCalendars', () => {
    it('keeps roster nations that no selected locale covers', () => {
        // Only en_ZA selected: Botswana and Eswatini must not be dropped.
        expect(
            widerRegionNationalCalendars(['ZA', 'BW', 'SZ'], {
                'South Africa': 'ZA',
            }),
        ).toEqual({
            'South Africa': 'ZA',
            Botswana: 'BW',
            Eswatini: 'SZ',
        });
    });
    it('keeps a locale-derived nation outside the roster', () => {
        expect(widerRegionNationalCalendars(['DK'], { Norway: 'NO' })).toEqual({
            Norway: 'NO',
            Denmark: 'DK',
        });
    });
    it('does not list a nation twice', () => {
        const map = widerRegionNationalCalendars(['DK'], { Denmark: 'DK' });
        expect(Object.values(map)).toEqual(['DK']);
    });
});

describe('offeredLocales', () => {
    it('keeps only the locales the page offers, in the given order', () => {
        expect(
            offeredLocales(
                ['zh_SG', 'en_SG', 'ms_BN'],
                ['ms_BN', 'en_SG', 'it_IT'],
            ),
        ).toEqual(['en_SG', 'ms_BN']);
    });
});

describe('legacy wider region names (#1018)', () => {
    it('matches capitalised words joined by single spaces', () => {
        expect(WIDER_REGION_LEGACY_NAME_PATTERN.test('Europe')).toBe(true);
        expect(WIDER_REGION_LEGACY_NAME_PATTERN.test('Middle East')).toBe(true);
        expect(WIDER_REGION_LEGACY_NAME_PATTERN.test('german language')).toBe(false);
        expect(WIDER_REGION_LEGACY_NAME_PATTERN.test('Guinea-Bissau')).toBe(false);
        expect(WIDER_REGION_LEGACY_NAME_PATTERN.test('Middle  East')).toBe(false);
        expect(WIDER_REGION_LEGACY_NAME_PATTERN.test('')).toBe(false);
    });

    it('normalizes a legacy name to its id, as the API does', () => {
        expect(normalizeWiderRegionKey('Europe')).toBe('europe');
        expect(normalizeWiderRegionKey('Middle East')).toBe('middle-east');
    });

    it('returns an id unchanged', () => {
        expect(normalizeWiderRegionKey('europe')).toBe('europe');
        expect(normalizeWiderRegionKey('middle-east')).toBe('middle-east');
    });

    it('returns any other string unchanged', () => {
        expect(normalizeWiderRegionKey('german language')).toBe('german language');
        expect(normalizeWiderRegionKey('Guinea-Bissau')).toBe('Guinea-Bissau');
        expect(normalizeWiderRegionKey('')).toBe('');
    });

    it('accepts an id or a legacy name, and nothing else', () => {
        expect(isAcceptedWiderRegionKey('europe')).toBe(true);
        expect(isAcceptedWiderRegionKey('middle-east')).toBe(true);
        expect(isAcceptedWiderRegionKey('Europe')).toBe(true);
        expect(isAcceptedWiderRegionKey('Middle East')).toBe(true);
        expect(isAcceptedWiderRegionKey('german language')).toBe(false);
        expect(isAcceptedWiderRegionKey('Guinea-Bissau')).toBe(false);
        expect(isAcceptedWiderRegionKey('')).toBe(false);
        expect(isAcceptedWiderRegionKey(undefined)).toBe(false);
    });
});

describe('membersWithoutOfferedLocale', () => {
    it('keeps only members whose country has no offered locale', () => {
        expect(membersWithoutOfferedLocale(['IT', 'BN', 'SZ', 'CH'], ['it_IT', 'it_CH', 'de_CH', 'en_SZ'])).toEqual(['BN']);
    });
    it('matches scripted locales by their region', () => {
        expect(membersWithoutOfferedLocale(['CN', 'TW'], ['zh_Hans_CN'])).toEqual(['TW']);
    });
    it('is empty when every member has a locale on offer', () => {
        expect(membersWithoutOfferedLocale(['IT'], ['it_IT'])).toEqual([]);
    });
});
