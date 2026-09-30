import { describe, it, expect } from 'vitest';
import { eligibleWiderRegions, nationWiderRegions, orderWiderRegions, widerRegionLabelById, widerRegionRoster, widerRegionsByNation } from '../widerRegions.js';

// Shaped like `litcal_metadata.wider_regions` from /calendars after API #1018: `id` is the
// permanent lowercase kebab-case identifier, `label` its resolved display text, and `name`
// a deprecated alias of `id`.
const REGIONS = [
    { id: 'nordic', label: 'Nordic', name: 'nordic', roster: ['DK', 'FI', 'IS', 'NO', 'SE'] },
    { id: 'americas', label: 'Americas', name: 'americas', roster: ['AR', 'BR', 'CA', 'MX', 'US', 'VE'] },
    { id: 'europe', label: 'Europe', name: 'europe', roster: ['AT', 'DE', 'DK', 'FI', 'IE', 'IT', 'NO', 'SE'] }
];

describe('nationWiderRegions', () => {
    it('reads the list', () => {
        expect(nationWiderRegions({ wider_regions: ['europe', 'nordic'] })).toEqual(['europe', 'nordic']);
        expect(nationWiderRegions({ wider_regions: [] })).toEqual([]);
    });

    it('reads the legacy string as a one-element list', () => {
        expect(nationWiderRegions({ wider_region: 'europe' })).toEqual(['europe']);
    });

    it('prefers the list when both are present', () => {
        expect(nationWiderRegions({ wider_regions: ['europe', 'nordic'], wider_region: 'europe' })).toEqual(['europe', 'nordic']);
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
        expect(widerRegionRoster({ id: 'europe' })).toBeNull();
        expect(widerRegionRoster(undefined)).toBeNull();
    });
});

describe('orderWiderRegions', () => {
    it('puts the broadest region first', () => {
        expect(orderWiderRegions(['nordic', 'europe'], REGIONS)).toEqual(['europe', 'nordic']);
    });

    it('breaks a tie by id, and puts regions with no roster last, by id', () => {
        const regions = [{ id: 'b', roster: ['X'] }, { id: 'a', roster: ['Y'] }, { id: 'd' }, { id: 'c' }];
        expect(orderWiderRegions(['d', 'b', 'c', 'a'], regions)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('falls back to name for an older API that publishes no id', () => {
        const legacy = [{ name: 'Europe', roster: ['X'] }, { name: 'Nordic', roster: ['X', 'Y'] }];
        expect(orderWiderRegions(['Europe', 'Nordic'], legacy)).toEqual(['Nordic', 'Europe']);
    });
});

describe('eligibleWiderRegions', () => {
    it('offers the regions whose roster lists the nation, broadest first', () => {
        expect(eligibleWiderRegions('SE', REGIONS, [])).toEqual(['europe', 'nordic']);
        expect(eligibleWiderRegions('VE', REGIONS, [])).toEqual(['americas']);
    });

    it('offers nothing to a nation on no roster that declares nothing', () => {
        expect(eligibleWiderRegions('AU', REGIONS, [])).toEqual([]);
    });

    it('keeps a declared region its roster no longer lists', () => {
        expect(eligibleWiderRegions('IT', REGIONS, ['americas'])).toEqual(['europe', 'americas']);
    });

    it('keeps a declared region that /calendars does not list', () => {
        expect(eligibleWiderRegions('SE', REGIONS, ['scandinavia'])).toEqual(['europe', 'nordic', 'scandinavia']);
    });

    it('offers every region when the API publishes no roster', () => {
        const legacy = [{ name: 'Europe' }, { name: 'Americas' }];
        expect(eligibleWiderRegions('SE', legacy, [])).toEqual(['Americas', 'Europe']);
        expect(eligibleWiderRegions('SE', undefined, ['Europe'])).toEqual(['Europe']);
    });
});

describe('widerRegionsByNation', () => {
    const CALENDARS = [
        { calendar_id: 'IT', wider_regions: ['europe'] },
        { calendar_id: 'SE', wider_regions: ['europe', 'nordic'] },
        { calendar_id: 'VA', wider_regions: [] }
    ];

    it('lists every region a nation declares or whose roster lists it', () => {
        const index = widerRegionsByNation(CALENDARS, REGIONS);
        expect(index.SE).toEqual(['europe', 'nordic']);
        // On Europe's roster, with no calendar of its own.
        expect(index.IE).toEqual(['europe']);
        expect(index.VE).toEqual(['americas']);
    });

    it('leaves out a nation in no region', () => {
        expect(widerRegionsByNation(CALENDARS, REGIONS)).not.toHaveProperty('VA');
    });

    it('falls back to the declared regions when no roster is published', () => {
        const legacy = [{ calendar_id: 'IT', wider_region: 'Europe' }];
        expect(widerRegionsByNation(legacy, [{ name: 'Europe' }])).toEqual({ IT: ['Europe'] });
    });
});

describe('widerRegionLabelById', () => {
    it('finds the label of the region with that id', () => {
        expect(widerRegionLabelById(REGIONS, 'europe')).toBe('Europe');
        expect(widerRegionLabelById(REGIONS, 'americas')).toBe('Americas');
    });

    it('falls back to the id itself when no region matches', () => {
        expect(widerRegionLabelById(REGIONS, 'scandinavia')).toBe('scandinavia');
        expect(widerRegionLabelById(undefined, 'europe')).toBe('europe');
        expect(widerRegionLabelById([], 'europe')).toBe('europe');
    });

    it('resolves an older-API region that publishes no id or label, by name', () => {
        expect(widerRegionLabelById([{ name: 'Europe' }], 'Europe')).toBe('Europe');
    });
});
