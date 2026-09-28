import { describe, it, expect } from 'vitest';
import { widerRegionForNation } from '../widerRegionForNation.js';

// Shaped like `litcal_metadata.wider_regions` from /calendars, trimmed.
const WIDER_REGIONS = [
    { name: 'Americas', locales: ['en_CA', 'en_US', 'es_MX', 'fr_CA', 'pt_BR'] },
    { name: 'Asia', locales: ['zh_CN', 'ja_JP'] },
    { name: 'Europe', locales: ['de_AT', 'hr_HR', 'it_IT', 'nl_NL', 'fr_FR'] }
];

describe('widerRegionForNation', () => {
    it('finds the wider region whose locales include the nation', () => {
        expect(widerRegionForNation(WIDER_REGIONS, 'MX')).toBe('Americas');
        expect(widerRegionForNation(WIDER_REGIONS, 'JP')).toBe('Asia');
        expect(widerRegionForNation(WIDER_REGIONS, 'FR')).toBe('Europe');
    });

    it('matches on the region subtag, not the language', () => {
        // fr_CA places Canada in the Americas; French does not place it in Europe.
        expect(widerRegionForNation(WIDER_REGIONS, 'CA')).toBe('Americas');
    });

    it('accepts a lowercase nation code', () => {
        expect(widerRegionForNation(WIDER_REGIONS, 'it')).toBe('Europe');
    });

    it('suggests nothing for a nation no wider region lists', () => {
        expect(widerRegionForNation(WIDER_REGIONS, 'HU')).toBe('');
    });

    it('suggests nothing when several wider regions claim the nation', () => {
        const overlapping = [...WIDER_REGIONS, { name: 'Oceania', locales: ['en_US'] }];
        expect(widerRegionForNation(overlapping, 'US')).toBe('');
    });

    it('suggests nothing without a nation or without metadata', () => {
        expect(widerRegionForNation(WIDER_REGIONS, '')).toBe('');
        expect(widerRegionForNation(undefined, 'MX')).toBe('');
    });
});
