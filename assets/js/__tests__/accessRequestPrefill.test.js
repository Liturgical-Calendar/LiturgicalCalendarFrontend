import { describe, it, expect } from 'vitest';
import { parseAccessRequestPrefill } from '../accessRequestPrefill.js';

describe('parseAccessRequestPrefill', () => {
    it('parses a national calendar deep link', () => {
        expect(parseAccessRequestPrefill('?object_type=national_calendar&object_id=roman/FR'))
            .toEqual({ object_type: 'national_calendar', object_id: 'roman/FR' });
    });

    it('parses a wider region deep link', () => {
        expect(parseAccessRequestPrefill('?object_type=wider_region&object_id=roman/europe'))
            .toEqual({ object_type: 'wider_region', object_id: 'roman/europe' });
    });

    it('parses a diocesan calendar deep link, including an Ambrosian rite', () => {
        expect(parseAccessRequestPrefill('?object_type=diocesan_calendar&object_id=roman/roma_it'))
            .toEqual({ object_type: 'diocesan_calendar', object_id: 'roman/roma_it' });
        expect(parseAccessRequestPrefill('?object_type=diocesan_calendar&object_id=ambrosian/lugano_ch'))
            .toEqual({ object_type: 'diocesan_calendar', object_id: 'ambrosian/lugano_ch' });
    });

    it('accepts the query string with or without a leading "?"', () => {
        expect(parseAccessRequestPrefill('object_type=national_calendar&object_id=roman/FR'))
            .toEqual({ object_type: 'national_calendar', object_id: 'roman/FR' });
    });

    it('rejects an unknown object_type', () => {
        expect(parseAccessRequestPrefill('?object_type=rite_calendar&object_id=roman/temporale')).toBeNull();
        expect(parseAccessRequestPrefill('?object_type=bogus&object_id=roman/FR')).toBeNull();
        expect(parseAccessRequestPrefill('?object_id=roman/FR')).toBeNull();
    });

    it('rejects a missing or empty object_id', () => {
        expect(parseAccessRequestPrefill('?object_type=national_calendar')).toBeNull();
        expect(parseAccessRequestPrefill('?object_type=national_calendar&object_id=')).toBeNull();
    });

    it('rejects an object_id that is not rite-qualified', () => {
        expect(parseAccessRequestPrefill('?object_type=national_calendar&object_id=FR')).toBeNull();
    });

    it('rejects an object_id with an unknown rite prefix', () => {
        expect(parseAccessRequestPrefill('?object_type=national_calendar&object_id=bogus/FR')).toBeNull();
    });

    it('rejects an object_id with characters outside the allowed set', () => {
        expect(parseAccessRequestPrefill('?object_type=national_calendar&object_id=roman/FR%2Fetc')).toBeNull();
        expect(parseAccessRequestPrefill('?object_type=national_calendar&object_id=roman/')).toBeNull();
    });

    it('returns null for an empty query string', () => {
        expect(parseAccessRequestPrefill('')).toBeNull();
        expect(parseAccessRequestPrefill(undefined)).toBeNull();
    });
});
