import { describe, expect, it } from 'vitest';
import {
    AMBROSIAN_RITE,
    ROMAN_RITE,
    bareCalendarId,
    isRiteQualifiedObjectType,
    legacyRiteCalendarObject,
    parseRiteQualifiedId,
    qualifyObjectId,
    riteForObjectType,
    sameObjectId,
    splitObjectId,
} from '../riteScopedObjectId.js';

/**
 * These assertions are the frontend half of a contract owned by the API:
 * `RiteScopedObjectId` and `AccessRequestRepository::isValidObjectIdForType()`
 * (LiturgicalCalendarAPI #785 / #786 / #788). Every expected string below is the
 * exact id that validator accepts — a wrong one here is a 403 or a 422 in
 * production, or worse, a grant on a resource the user did not name.
 */

describe('isRiteQualifiedObjectType', () => {
    it.each([
        'national_calendar',
        'diocesan_calendar',
        'wider_region',
        'national_calendar_test',
        'diocesan_calendar_test',
        // The tier ABOVE all of those, one per rite (API #955).
        'rite_calendar',
    ])('%s names a calendar and is qualified', (type) => {
        expect(isRiteQualifiedObjectType(type)).toBe(true);
    });

    it.each([
        // Deprecated, not removed: the API still accepts and still emits both,
        // and their ids stay bare until the prune milestone.
        'general_roman_calendar',
        'general_roman_calendar_test',
        // The exception that proves the rule: its id IS the rite.
        'rite_calendar_test',
        'something_else',
    ])('%s keeps a bare id', (type) => {
        expect(isRiteQualifiedObjectType(type)).toBe(false);
    });
});

describe('qualifyObjectId', () => {
    it('qualifies a national calendar as roman', () => {
        expect(qualifyObjectId('national_calendar', 'US')).toBe('roman/US');
        expect(qualifyObjectId('national_calendar', 'IT')).toBe('roman/IT');
    });

    it('qualifies a wider region as roman', () => {
        expect(qualifyObjectId('wider_region', 'Europe')).toBe('roman/Europe');
    });

    it('qualifies a national test scope as roman', () => {
        expect(qualifyObjectId('national_calendar_test', 'IT')).toBe('roman/IT');
    });

    it('takes the supplied rite for a diocesan calendar', () => {
        expect(qualifyObjectId('diocesan_calendar', 'lugano_ch', AMBROSIAN_RITE))
            .toBe('ambrosian/lugano_ch');
        expect(qualifyObjectId('diocesan_calendar', 'romamo_it', ROMAN_RITE))
            .toBe('roman/romamo_it');
        expect(qualifyObjectId('diocesan_calendar_test', 'milano_it', AMBROSIAN_RITE))
            .toBe('ambrosian/milano_it');
    });

    it('falls back to roman for a diocesan calendar with no announced rite', () => {
        expect(qualifyObjectId('diocesan_calendar', 'rotter_nl')).toBe('roman/rotter_nl');
        expect(qualifyObjectId('diocesan_calendar', 'rotter_nl', 'gallican')).toBe('roman/rotter_nl');
    });

    it('pins the roman-only types to roman even when handed another rite', () => {
        // The Ambrosian rite has no national tier and no wider regions; the API
        // rejects those ids outright, so composing one could only ever 422.
        expect(qualifyObjectId('national_calendar', 'IT', AMBROSIAN_RITE)).toBe('roman/IT');
        expect(qualifyObjectId('wider_region', 'Europe', AMBROSIAN_RITE)).toBe('roman/Europe');
        expect(qualifyObjectId('national_calendar_test', 'IT', AMBROSIAN_RITE)).toBe('roman/IT');
    });

    it('qualifies a rite calendar with the rite it is handed', () => {
        // The eight ids the API validates for `rite_calendar`
        // (RiteCalendarObjectIds). `decrees` and `supported_locales` are
        // Roman-only; `temporale` exists for both rites, which is exactly why a
        // bare id could no longer stand for "the Roman one".
        expect(qualifyObjectId('rite_calendar', 'temporale', ROMAN_RITE)).toBe('roman/temporale');
        expect(qualifyObjectId('rite_calendar', 'decrees', ROMAN_RITE)).toBe('roman/decrees');
        expect(qualifyObjectId('rite_calendar', 'supported_locales', ROMAN_RITE))
            .toBe('roman/supported_locales');
        expect(qualifyObjectId('rite_calendar', 'EDITIO_TYPICA_2008', ROMAN_RITE))
            .toBe('roman/EDITIO_TYPICA_2008');
        expect(qualifyObjectId('rite_calendar', 'temporale', AMBROSIAN_RITE))
            .toBe('ambrosian/temporale');
        expect(qualifyObjectId('rite_calendar', 'EDITIO_TYPICA_2024', AMBROSIAN_RITE))
            .toBe('ambrosian/EDITIO_TYPICA_2024');
    });

    it('is not pinned to roman: the rite tier exists under every rite', () => {
        // Unlike national_calendar / wider_region, which the API rejects for the
        // Ambrosian rite outright.
        expect(riteForObjectType('rite_calendar', AMBROSIAN_RITE)).toBe('ambrosian');
        expect(qualifyObjectId('rite_calendar', 'ambrosian/temporale', AMBROSIAN_RITE))
            .toBe('ambrosian/temporale');
    });

    it('leaves the bare-id types untouched', () => {
        expect(qualifyObjectId('general_roman_calendar', 'temporale')).toBe('temporale');
        expect(qualifyObjectId('general_roman_calendar', 'decrees')).toBe('decrees');
        expect(qualifyObjectId('general_roman_calendar', 'EDITIO_TYPICA_2008')).toBe('EDITIO_TYPICA_2008');
        expect(qualifyObjectId('general_roman_calendar_test', 'general_roman_calendar'))
            .toBe('general_roman_calendar');
        expect(qualifyObjectId('rite_calendar_test', 'ambrosian')).toBe('ambrosian');
    });

    it('is idempotent — an already-qualified id is not qualified twice', () => {
        expect(qualifyObjectId('national_calendar', 'roman/US')).toBe('roman/US');
        expect(qualifyObjectId('diocesan_calendar', 'ambrosian/lugano_ch', AMBROSIAN_RITE))
            .toBe('ambrosian/lugano_ch');
    });

    it('leaves an empty id empty rather than emitting a bare rite prefix', () => {
        expect(qualifyObjectId('national_calendar', '')).toBe('');
    });
});

describe('parseRiteQualifiedId', () => {
    it('splits a qualified id', () => {
        expect(parseRiteQualifiedId('ambrosian/lugano_ch')).toEqual({
            rite: 'ambrosian',
            id: 'lugano_ch',
        });
    });

    it('returns null for an unqualified legacy id', () => {
        expect(parseRiteQualifiedId('US')).toBeNull();
    });

    it('returns null when the prefix names no known rite', () => {
        // Same rule as Rite::tryFrom() on the API side.
        expect(parseRiteQualifiedId('mozarabic/toledo_es')).toBeNull();
    });

    it('returns null for a prefix with an empty calendar id', () => {
        expect(parseRiteQualifiedId('roman/')).toBeNull();
    });
});

describe('riteForObjectType', () => {
    it('answers roman for the roman-only types regardless of the argument', () => {
        expect(riteForObjectType('national_calendar', AMBROSIAN_RITE)).toBe('roman');
        expect(riteForObjectType('wider_region', undefined)).toBe('roman');
        expect(riteForObjectType('national_calendar_test', AMBROSIAN_RITE)).toBe('roman');
    });

    it('passes an announced rite through for the diocesan types', () => {
        expect(riteForObjectType('diocesan_calendar', AMBROSIAN_RITE)).toBe('ambrosian');
        expect(riteForObjectType('diocesan_calendar_test', ROMAN_RITE)).toBe('roman');
    });

    it('defaults an unknown or missing rite to roman', () => {
        expect(riteForObjectType('diocesan_calendar', undefined)).toBe('roman');
        expect(riteForObjectType('diocesan_calendar', 'nonsense')).toBe('roman');
    });
});

describe('splitObjectId / bareCalendarId — legacy tolerance', () => {
    it('splits a migrated id', () => {
        expect(splitObjectId('diocesan_calendar', 'ambrosian/lugano_ch'))
            .toEqual({ rite: 'ambrosian', id: 'lugano_ch' });
    });

    it('reads a pre-migration bare id as roman', () => {
        // Grants written before the migration are still live and still
        // authorize on the API side for the whole migration window.
        expect(splitObjectId('national_calendar', 'IT'))
            .toEqual({ rite: 'roman', id: 'IT' });
    });

    it('keeps a bare-id type whole', () => {
        expect(splitObjectId('general_roman_calendar', 'temporale'))
            .toEqual({ rite: 'roman', id: 'temporale' });
        // Not parsed as rite=roman,id='' — the whole id is the resource name.
        expect(bareCalendarId('rite_calendar_test', 'ambrosian')).toBe('ambrosian');
    });

    it('strips the rite for display', () => {
        expect(bareCalendarId('national_calendar_test', 'roman/IT')).toBe('IT');
        expect(bareCalendarId('national_calendar_test', 'IT')).toBe('IT');
    });
});

describe('sameObjectId', () => {
    it('matches a legacy grant against a migrated scope', () => {
        expect(sameObjectId('national_calendar_test', 'IT', 'roman/IT')).toBe(true);
        expect(sameObjectId('diocesan_calendar_test', 'romamo_it', 'roman/romamo_it')).toBe(true);
    });

    it('does not match across rites', () => {
        // The whole point of qualifying: a Roman lugano_ch and an Ambrosian one
        // are different resources, and a grant on one must not cover the other.
        expect(sameObjectId('diocesan_calendar', 'roman/lugano_ch', 'ambrosian/lugano_ch')).toBe(false);
        // A legacy bare id reads as Roman, so it does NOT cover the Ambrosian one.
        expect(sameObjectId('diocesan_calendar', 'lugano_ch', 'ambrosian/lugano_ch')).toBe(false);
    });

    it('does not match different calendars', () => {
        expect(sameObjectId('national_calendar', 'roman/IT', 'roman/US')).toBe(false);
    });

    it('compares bare-id types verbatim', () => {
        expect(sameObjectId('general_roman_calendar', 'temporale', 'temporale')).toBe(true);
        expect(sameObjectId('general_roman_calendar', 'temporale', 'decrees')).toBe(false);
    });

    it('matches a legacy rite-calendar grant against its migrated scope', () => {
        // A grant written as `rite_calendar:decrees` cannot exist (the API rejects
        // a bare id for the new type), but a value read back mid-migration and
        // labelled with it must still compare equal to the Roman scope.
        expect(sameObjectId('rite_calendar', 'decrees', 'roman/decrees')).toBe(true);
        expect(sameObjectId('rite_calendar', 'roman/temporale', 'ambrosian/temporale')).toBe(false);
    });
});

describe('legacyRiteCalendarObject — the #955 pairing', () => {
    it('pairs a Roman fixed sub-resource with its bare legacy object', () => {
        for (const sub of ['temporale', 'decrees', 'supported_locales']) {
            expect(legacyRiteCalendarObject('rite_calendar', `roman/${sub}`))
                .toEqual({ objectType: 'general_roman_calendar', objectId: sub });
        }
    });

    it('refuses to pair a NON-Roman fixed sub-resource', () => {
        // Every legacy id was Roman by construction — the predecessor type
        // modelled the tier as though only the Roman rite had one. Pairing
        // `ambrosian/temporale` with the bare `temporale` would re-introduce
        // exactly the un-qualification #955 exists to remove.
        expect(legacyRiteCalendarObject('rite_calendar', 'ambrosian/temporale')).toBeNull();
    });

    it('pairs a typical edition across EVERY rite', () => {
        // Missal ids are unique across rites, so the bare legacy id genuinely
        // denoted the Ambrosian edition too.
        expect(legacyRiteCalendarObject('rite_calendar', 'roman/EDITIO_TYPICA_2002'))
            .toEqual({ objectType: 'general_roman_calendar', objectId: 'EDITIO_TYPICA_2002' });
        expect(legacyRiteCalendarObject('rite_calendar', 'ambrosian/EDITIO_TYPICA_2024'))
            .toEqual({ objectType: 'general_roman_calendar', objectId: 'EDITIO_TYPICA_2024' });
    });

    it('has no pairing for any other type, or for an unqualified id', () => {
        expect(legacyRiteCalendarObject('national_calendar', 'roman/US')).toBeNull();
        expect(legacyRiteCalendarObject('rite_calendar_test', 'roman')).toBeNull();
        expect(legacyRiteCalendarObject('general_roman_calendar', 'decrees')).toBeNull();
        expect(legacyRiteCalendarObject('rite_calendar', 'decrees')).toBeNull();
        expect(legacyRiteCalendarObject('rite_calendar', 'mozarabic/temporale')).toBeNull();
    });
});
