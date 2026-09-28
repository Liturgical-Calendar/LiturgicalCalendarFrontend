import { describe, it, expect } from 'vitest';
import { eligibleWiderRegions, nationWiderRegions, orderWiderRegions, widerRegionRoster } from '../widerRegions.js';

// Shaped like `litcal_metadata.wider_regions` from /calendars after API #1005, trimmed.
const REGIONS = [
    { name: 'Nordic', roster: ['DK', 'FI', 'IS', 'NO', 'SE'] },
    { name: 'Americas', roster: ['AR', 'BR', 'CA', 'MX', 'US', 'VE'] },
    { name: 'Europe', roster: ['AT', 'DE', 'DK', 'FI', 'IE', 'IT', 'NO', 'SE'] }
];

describe('nationWiderRegions', () => {
    it('reads the list', () => {
        expect(nationWiderRegions({ wider_regions: ['Europe', 'Nordic'] })).toEqual(['Europe', 'Nordic']);
        expect(nationWiderRegions({ wider_regions: [] })).toEqual([]);
    });

    it('reads the legacy string as a one-element list', () => {
        expect(nationWiderRegions({ wider_region: 'Europe' })).toEqual(['Europe']);
    });

    it('prefers the list when both are present', () => {
        expect(nationWiderRegions({ wider_regions: ['Europe', 'Nordic'], wider_region: 'Europe' })).toEqual(['Europe', 'Nordic']);
    });

    it('reads nothing from an empty string, a missing field or a missing item', () => {
        expect(nationWiderRegions({ wider_region: '' })).toEqual([]);
        expect(nationWiderRegions({})).toEqual([]);
        expect(nationWiderRegions(undefined)).toEqual([]);
    });
});

describe('widerRegionRoster', () => {
    it('reads the roster, or null when the API does not publish one', () => {
        expect(widerRegionRoster(REGIONS[0])).toEqual(['DK', 'FI', 'IS', 'NO', 'SE']);
        expect(widerRegionRoster({ name: 'Europe' })).toBeNull();
        expect(widerRegionRoster(undefined)).toBeNull();
    });
});

describe('orderWiderRegions', () => {
    it('puts the broadest region first', () => {
        expect(orderWiderRegions(['Nordic', 'Europe'], REGIONS)).toEqual(['Europe', 'Nordic']);
    });

    it('breaks a tie by name, and puts regions with no roster last, by name', () => {
        const regions = [{ name: 'B', roster: ['X'] }, { name: 'A', roster: ['Y'] }, { name: 'D' }, { name: 'C' }];
        expect(orderWiderRegions(['D', 'B', 'C', 'A'], regions)).toEqual(['A', 'B', 'C', 'D']);
    });
});

describe('eligibleWiderRegions', () => {
    it('offers the regions whose roster lists the nation, broadest first', () => {
        expect(eligibleWiderRegions('SE', REGIONS, [])).toEqual(['Europe', 'Nordic']);
        expect(eligibleWiderRegions('VE', REGIONS, [])).toEqual(['Americas']);
    });

    it('offers nothing to a nation on no roster that declares nothing', () => {
        expect(eligibleWiderRegions('AU', REGIONS, [])).toEqual([]);
    });

    it('keeps a declared region its roster no longer lists', () => {
        expect(eligibleWiderRegions('IT', REGIONS, ['Americas'])).toEqual(['Europe', 'Americas']);
    });

    it('keeps a declared region that /calendars does not list', () => {
        expect(eligibleWiderRegions('SE', REGIONS, ['Scandinavia'])).toEqual(['Europe', 'Nordic', 'Scandinavia']);
    });

    it('offers every region when the API publishes no roster', () => {
        const legacy = [{ name: 'Europe' }, { name: 'Americas' }];
        expect(eligibleWiderRegions('SE', legacy, [])).toEqual(['Americas', 'Europe']);
        expect(eligibleWiderRegions('SE', undefined, ['Europe'])).toEqual(['Europe']);
    });
});
