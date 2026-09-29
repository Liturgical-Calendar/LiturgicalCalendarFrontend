import { describe, it, expect } from 'vitest';
import { NationalCalendarPayloadMetadata } from '../NationalCalendarPayload.js';

const base = { nation: 'SE', locales: ['sv_SE'], missals: [] };

describe('NationalCalendarPayloadMetadata wider_regions', () => {
    it('carries a list of wider regions, in the order given', () => {
        const metadata = new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Europe', 'Nordic'] });
        expect(metadata.wider_regions).toEqual(['Europe', 'Nordic']);
        expect(metadata).not.toHaveProperty('wider_region');
    });

    it('accepts no wider region', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: [] }).wider_regions).toEqual([]);
    });

    it('accepts a name of several words', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Middle East'] }).wider_regions)
            .toEqual(['Middle East']);
    });

    it('requires the list', () => {
        expect(() => new NationalCalendarPayloadMetadata(base)).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: 'Europe' })).toThrow(/wider_regions/);
    });

    it('rejects a duplicate or a malformed name', () => {
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Europe', 'Europe'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['europe'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Middle  East'] })).toThrow(/wider_regions/);
    });
});
