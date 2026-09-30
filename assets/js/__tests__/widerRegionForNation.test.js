import { describe, it, expect } from 'vitest';
import { widerRegionsForNation } from '../widerRegionForNation.js';

// After API #1005: each region publishes its roster. Shaped like #1018 publishes them: `id` the
// permanent lowercase kebab-case identifier, `label` the resolved display text, `name` a
// deprecated alias of `id`.
const WITH_ROSTER = [
    { id: 'americas', label: 'Americas', name: 'americas', locales: ['en_CA', 'es_MX'], roster: ['CA', 'MX', 'US'] },
    { id: 'europe', label: 'Europe', name: 'europe', locales: ['it_IT'], roster: ['DK', 'IE', 'IT', 'SE'] },
    { id: 'nordic', label: 'Nordic', name: 'nordic', locales: [], roster: ['DK', 'SE'] }
];

// Before it: membership can only be inferred from the region subtag of each region's locales.
const WITHOUT_ROSTER = [
    { id: 'americas', label: 'Americas', name: 'americas', locales: ['en_CA', 'en_US', 'es_MX', 'fr_CA', 'pt_BR'] },
    { id: 'asia', label: 'Asia', name: 'asia', locales: ['zh_CN', 'ja_JP'] },
    { id: 'europe', label: 'Europe', name: 'europe', locales: ['de_AT', 'hr_HR', 'it_IT', 'nl_NL', 'fr_FR'] }
];

describe('widerRegionsForNation, from rosters', () => {
    it('suggests every region whose roster lists the nation, broadest first', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'SE')).toEqual(['europe', 'nordic']);
        expect(widerRegionsForNation(WITH_ROSTER, 'MX')).toEqual(['americas']);
    });

    it('accepts a lowercase nation code', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'ie')).toEqual(['europe']);
    });

    it('suggests nothing for a nation on no roster', () => {
        expect(widerRegionsForNation(WITH_ROSTER, 'AU')).toEqual([]);
    });
});

describe('widerRegionsForNation, without rosters', () => {
    it('infers the region from the region subtag of its locales', () => {
        expect(widerRegionsForNation(WITHOUT_ROSTER, 'JP')).toEqual(['asia']);
        // fr_CA places Canada in the Americas; French does not place it in Europe.
        expect(widerRegionsForNation(WITHOUT_ROSTER, 'CA')).toEqual(['americas']);
    });

    it('suggests every region that lists the nation', () => {
        const overlapping = [...WITHOUT_ROSTER, { id: 'oceania', label: 'Oceania', name: 'oceania', locales: ['en_US'] }];
        expect(widerRegionsForNation(overlapping, 'US')).toEqual(['americas', 'oceania']);
    });
});

it('suggests nothing without a nation or without metadata', () => {
    expect(widerRegionsForNation(WITH_ROSTER, '')).toEqual([]);
    expect(widerRegionsForNation(undefined, 'MX')).toEqual([]);
});

describe('widerRegionsForNation, older API with no id', () => {
    it('falls back to name, read as its id, for a region an API older than #1018 publishes without an id', () => {
        const legacy = [{ name: 'Europe', locales: ['it_IT'], roster: ['IT'] }];
        expect(widerRegionsForNation(legacy, 'IT')).toEqual(['europe']);
    });
});
