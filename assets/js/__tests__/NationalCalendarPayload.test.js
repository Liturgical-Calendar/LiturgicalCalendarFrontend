import { describe, it, expect } from 'vitest';
import { NationalCalendarPayloadMetadata } from '../NationalCalendarPayload.js';

const base = { nation: 'SE', locales: ['sv_SE'], missals: [] };

describe('NationalCalendarPayloadMetadata wider_regions', () => {
    it('carries a list of wider regions, in the order given', () => {
        const metadata = new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['europe', 'nordic'] });
        expect(metadata.wider_regions).toEqual(['europe', 'nordic']);
        expect(metadata).not.toHaveProperty('wider_region');
    });

    it('accepts no wider region', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: [] }).wider_regions).toEqual([]);
    });

    it('accepts an id of several words', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['middle-east'] }).wider_regions)
            .toEqual(['middle-east']);
    });

    it('accepts a legacy name and sends its id', () => {
        expect(new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Europe', 'Middle East'] }).wider_regions)
            .toEqual(['europe', 'middle-east']);
    });

    it('rejects a legacy name and its id together as a duplicate', () => {
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Europe', 'europe'] })).toThrow(/wider_regions/);
    });

    it('requires the list', () => {
        expect(() => new NationalCalendarPayloadMetadata(base)).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: 'europe' })).toThrow(/wider_regions/);
    });

    it('rejects a duplicate or a malformed id', () => {
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['europe', 'europe'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['german language'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['Guinea-Bissau'] })).toThrow(/wider_regions/);
        expect(() => new NationalCalendarPayloadMetadata({ ...base, wider_regions: ['middle--east'] })).toThrow(/wider_regions/);
    });
});
