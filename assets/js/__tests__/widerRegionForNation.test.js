import { describe, it, expect } from 'vitest';
import { widerRegionsForNation } from '../widerRegionForNation.js';

// After API #1005: each region publishes its roster.
const WITH_ROSTER = [
    { name: 'Americas', locales: ['en_CA', 'es_MX'], roster: ['CA', 'MX', 'US'] },
    { name: 'Europe', locales: ['it_IT'], roster: ['DK', 'IE', 'IT', 'SE'] },
    { name: 'Nordic', locales: [], roster: ['DK', 'SE'] }
];

// Before it: membership can only be inferred from the region subtag of each region's locales.
const WITHOUT_ROSTER = [
    { name: 'Americas', locales: ['en_CA', 'en_US', 'es_MX', 'fr_CA', 'pt_BR'] },
    { name: 'Asia', locales: ['zh_CN', 'ja_JP'] },
    { name: 'Europe', locales: ['de_AT', 'hr_HR', 'it_IT', 'nl_NL', 'fr_FR'] }
];

describe('widerRegionsForNation, from rosters', () => {
    it('suggests every region whose roster lists the nation, broadest first', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'SE')).toEqual(['Europe', 'Nordic']);
        expect(widerRegionsForNation(WITH_ROSTER, 'MX')).toEqual(['Americas']);
    });

    it('accepts a lowercase nation code', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'ie')).toEqual(['Europe']);
    });

    it('suggests nothing for a nation on no roster', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'AU')).toEqual([]);
    });
});

describe('widerRegionsForNation, without rosters', () => {
    it('infers the region from the region subtag of its locales', () => {
        expect(widerRegionsForNation(WITHOUT_ROSTER, 'JP')).toEqual(['Asia']);
        // fr_CA places Canada in the Americas; French does not place it in Europe.
        expect(widerRegionsForNation(WITHOUT_ROSTER, 'CA')).toEqual(['Americas']);
    });

    it('suggests every region that lists the nation', () => {
        const overlapping = [...WITHOUT_ROSTER, { name: 'Oceania', locales: ['en_US'] }];
        expect(widerRegionsForNation(overlapping, 'US')).toEqual(['Americas', 'Oceania']);
    });
});

it('suggests nothing without a nation or without metadata', () => {
    expect(widerRegionsForNation(WITH_ROSTER, '')).toEqual([]);
    expect(widerRegionsForNation(undefined, 'MX')).toEqual([]);
});
