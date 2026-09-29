/**
 * Tests for the wider region name rule and the prospective-region helpers
 * shared by the permission pickers and the extending page (#591, #66).
 */
import { describe, it, expect } from 'vitest';
import {
    WIDER_REGION_NAME_PATTERN,
    findProspectiveRegion,
    isValidWiderRegionName,
    offeredLocales,
    rosterToNationalCalendars,
    widerRegionNationalCalendars,
} from '../prospectiveWiderRegions.js';

const prospective = [
    {
        name: 'Nordic',
        description: 'Nordic Episcopal Conference',
        roster: ['DK', 'SE'],
        locales: ['da_DK'],
    },
    {
        name: 'Southern Africa',
        description: '',
        roster: ['ZA', 'BW', 'SZ'],
        locales: [],
    },
];

describe('isValidWiderRegionName', () => {
    it.each([
        'Europe',
        'Southern Africa',
        'Senegal Mauritania Cabo Verde Guinea Bissau',
    ])('accepts %s', (name) => {
        expect(isValidWiderRegionName(name)).toBe(true);
    });
    it.each([
        '',
        'europe',
        'Guinea-Bissau',
        'São Tomé',
        'Two  Spaces',
        'Trailing ',
        42,
        null,
    ])('rejects %s', (name) => {
        expect(isValidWiderRegionName(name)).toBe(false);
    });
    it('exposes the same pattern', () => {
        expect(WIDER_REGION_NAME_PATTERN.source).toBe(
            '^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$',
        );
    });
});

describe('findProspectiveRegion', () => {
    it('finds by exact name', () => {
        expect(findProspectiveRegion(prospective, 'Nordic')?.roster).toEqual([
            'DK',
            'SE',
        ]);
    });
    it('is undefined for an unknown name, a different case, or no list', () => {
        expect(findProspectiveRegion(prospective, 'Europe')).toBeUndefined();
        expect(findProspectiveRegion(prospective, 'nordic')).toBeUndefined();
        expect(findProspectiveRegion(null, 'Nordic')).toBeUndefined();
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
