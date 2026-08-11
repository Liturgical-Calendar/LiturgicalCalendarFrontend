import { describe, it, expect, beforeEach } from 'vitest';
import {
    CalendarType,
    RequestPayload,
    CurrentEndpoint,
} from '../subscriptionUrl.js';

const reset = () => {
    CurrentEndpoint.apiBase = 'https://example.test/calendar';
    CurrentEndpoint.rite = 'roman';
    CurrentEndpoint.calendarType = null;
    CurrentEndpoint.calendarId = null;
    CurrentEndpoint.calendarYear = null;
    RequestPayload.epiphany = null;
    RequestPayload.ascension = null;
    RequestPayload.corpus_christi = null;
    RequestPayload.eternal_high_priest = null;
    RequestPayload.locale = null;
    RequestPayload.return_type = 'ICS';
    RequestPayload.year_type = 'CIVIL';
};

describe('CurrentEndpoint.serialize', () => {
    beforeEach(reset);

    it('emits the bare base with its query parameters when nothing is selected', () => {
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits a national calendar path', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = 'IT';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman/nation/IT?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits a diocesan calendar path', () => {
        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId = 'romamo_it';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman/diocese/romamo_it?return_type=ICS&year_type=CIVIL',
        );
    });

    it('omits the calendar segment when the id is null', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = null;
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman?return_type=ICS&year_type=CIVIL',
        );
    });

    it('skips null and empty payload fields', () => {
        RequestPayload.locale = '';
        RequestPayload.epiphany = 'JAN6';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman?epiphany=JAN6&return_type=ICS&year_type=CIVIL',
        );
    });
});

describe('CurrentEndpoint rite segment', () => {
    beforeEach(reset);

    it('emits the roman segment explicitly', () => {
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits the rite before a national calendar', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = 'IT';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman/nation/IT?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits the ambrosian rite before a diocesan calendar', () => {
        CurrentEndpoint.rite = 'ambrosian';
        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId = 'lugano_ch';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/ambrosian/diocese/lugano_ch?return_type=ICS&year_type=CIVIL',
        );
    });

    it('emits the rite alone for the ambrosian rite-level calendar', () => {
        CurrentEndpoint.rite = 'ambrosian';
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/ambrosian?return_type=ICS&year_type=CIVIL',
        );
    });

    it('keeps the year after the calendar segment', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId = 'IT';
        CurrentEndpoint.calendarYear = 2026;
        expect(CurrentEndpoint.serialize()).toBe(
            'https://example.test/calendar/roman/nation/IT/2026?return_type=ICS&year_type=CIVIL',
        );
    });
});
