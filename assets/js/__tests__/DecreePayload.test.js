import { describe, it, expect } from 'vitest';
import { DecreeAction, buildDecreePayload, validateDecreePayload, deriveDecreeId } from '../DecreePayload.js';

const createNewForm = () => ({
    action: DecreeAction.CreateNew,
    decree_id: 'StTest_Create',
    decree_date: '2025-01-01',
    decree_protocol: 'Prot. N. 1/25',
    description: 'Test decree.',
    event_key: 'StTest',
    event_type: 'fixed',
    day: 14,
    month: 2,
    grade: 2,
    color: ['white'],
    common: ['Pastors'],
    since_year: 2025,
    url: 'https://www.vatican.va/test.html',
    i18n: { en: 'Saint Test' },
    readings: {
        en: {
            first_reading: 'Genesis 1:1',
            responsorial_psalm: 'Psalm 1',
            gospel_acclamation: 'John 1:1',
            gospel: 'John 1:1-14',
        },
    },
});

describe('buildDecreePayload', () => {
    it('builds a fixed-date createNew payload with day/month and no strtotime', () => {
        const p = buildDecreePayload(createNewForm());
        expect(p.decree_id).toBe('StTest_Create');
        expect(p.liturgical_event.day).toBe(14);
        expect(p.liturgical_event.month).toBe(2);
        expect(p.liturgical_event.type).toBe('fixed');
        expect(p.liturgical_event.grade).toBe(2);
        expect(p.liturgical_event.color).toEqual(['white']);
        expect(p.liturgical_event.common).toEqual(['Pastors']);
        expect(p.liturgical_event).not.toHaveProperty('strtotime');
        expect(p.metadata.action).toBe('createNew');
        expect(p.metadata).not.toHaveProperty('property');
        expect(p.i18n.en).toBe('Saint Test');
    });

    it('builds a mobile createNew payload with strtotime and no day/month', () => {
        const form = { ...createNewForm(), event_type: 'mobile', strtotime: 'Monday after Pentecost' };
        delete form.day;
        delete form.month;
        const p = buildDecreePayload(form);
        expect(p.liturgical_event.strtotime).toBe('Monday after Pentecost');
        expect(p.liturgical_event.type).toBe('mobile');
        expect(p.liturgical_event.grade).toBe(2);
        expect(p.liturgical_event.color).toEqual(['white']);
        expect(p.liturgical_event.common).toEqual(['Pastors']);
        expect(p.liturgical_event).not.toHaveProperty('day');
        expect(p.liturgical_event).not.toHaveProperty('month');
    });

    it('parses a JSON-stringified strtotime object and returns it as an object', () => {
        const strtotimeObj = { day_of_the_week: 'Monday', relative_time: 'after', event_key: 'Pentecost' };
        const form = {
            ...createNewForm(),
            event_type: 'mobile',
            strtotime: JSON.stringify(strtotimeObj),
        };
        delete form.day;
        delete form.month;
        const p = buildDecreePayload(form);
        expect(p.liturgical_event.strtotime).toEqual(strtotimeObj);
        expect(typeof p.liturgical_event.strtotime).toBe('object');
        expect(p.liturgical_event.type).toBe('mobile');
        expect(p.liturgical_event).not.toHaveProperty('day');
        expect(p.liturgical_event).not.toHaveProperty('month');
    });

    it('splits setProperty actions into action + property', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.SetPropertyGrade, i18n: undefined, readings: undefined });
        expect(p.metadata.action).toBe('setProperty');
        expect(p.metadata.property).toBe('grade');
        expect(p).not.toHaveProperty('i18n');
        expect(p).not.toHaveProperty('readings');
    });

    it('setProperty:grade liturgical_event has only event_key, calendar, grade — no i18n, no type, no color, no common', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.SetPropertyGrade, i18n: undefined, readings: undefined });
        expect(p.liturgical_event).toHaveProperty('event_key');
        expect(p.liturgical_event).toHaveProperty('calendar');
        expect(p.liturgical_event).toHaveProperty('grade');
        expect(p.liturgical_event).not.toHaveProperty('type');
        expect(p.liturgical_event).not.toHaveProperty('day');
        expect(p.liturgical_event).not.toHaveProperty('month');
        expect(p.liturgical_event).not.toHaveProperty('strtotime');
        expect(p.liturgical_event).not.toHaveProperty('color');
        expect(p.liturgical_event).not.toHaveProperty('common');
    });

    it('setProperty:name liturgical_event has only event_key and calendar — no grade, no type', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.SetPropertyName, readings: undefined });
        expect(p.liturgical_event).toHaveProperty('event_key');
        expect(p.liturgical_event).toHaveProperty('calendar');
        expect(p.liturgical_event).not.toHaveProperty('grade');
        expect(p.liturgical_event).not.toHaveProperty('type');
        expect(p.liturgical_event).not.toHaveProperty('day');
        expect(p.liturgical_event).not.toHaveProperty('month');
        expect(p.liturgical_event).not.toHaveProperty('color');
        expect(p.liturgical_event).not.toHaveProperty('common');
    });

    it('makeDoctor liturgical_event has only event_key, calendar, common — no grade, no type, no day/month, no color', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.MakeDoctor, readings: undefined });
        expect(p.liturgical_event).toHaveProperty('event_key');
        expect(p.liturgical_event).toHaveProperty('calendar');
        expect(p.liturgical_event).toHaveProperty('common');
        expect(p.liturgical_event).not.toHaveProperty('grade');
        expect(p.liturgical_event).not.toHaveProperty('type');
        expect(p.liturgical_event).not.toHaveProperty('day');
        expect(p.liturgical_event).not.toHaveProperty('month');
        expect(p.liturgical_event).not.toHaveProperty('color');
    });
});

describe('validateDecreePayload', () => {
    it('accepts a complete createNew payload on create', () => {
        expect(validateDecreePayload(buildDecreePayload(createNewForm()), 'en', true)).toEqual([]);
    });

    it('requires i18n with the base locale for name-bearing actions', () => {
        const p = buildDecreePayload({ ...createNewForm(), i18n: { it: 'San Test' } });
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.some((e) => e.includes('en'))).toBe(true);
    });

    it('rejects i18n for setProperty:grade when i18n is injected directly into payload', () => {
        // buildDecreePayload strips i18n for setProperty:grade; to test the validator's
        // rejection branch we inject i18n manually into the already-built payload.
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.SetPropertyGrade, readings: undefined });
        p.i18n = { en: 'Saint Test' }; // inject forbidden field so validator can reject it
        expect(validateDecreePayload(p, 'en', false).length).toBeGreaterThan(0);
    });

    it('requires readings on create only for createNew', () => {
        const noReadings = buildDecreePayload({ ...createNewForm(), readings: undefined });
        expect(validateDecreePayload(noReadings, 'en', true).length).toBeGreaterThan(0);
        expect(validateDecreePayload(noReadings, 'en', false)).toEqual([]);
    });

    it('rejects readings on create for makeDoctor when readings are injected directly into payload', () => {
        // buildDecreePayload strips readings for makeDoctor; to test the validator's
        // rejection branch we inject readings manually into the already-built payload.
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.MakeDoctor });
        p.readings = { en: { first_reading: 'Genesis 1:1', gospel: 'John 1:1-14' } }; // inject forbidden field
        expect(validateDecreePayload(p, 'en', true).length).toBeGreaterThan(0);
    });

    // --- makeDoctor common requirement ---

    it('makeDoctor without common array → validation error', () => {
        // buildDecreePayload omits common when the array is empty; inject empty common
        // into the already-built payload to test the validator directly.
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.MakeDoctor, common: [], readings: undefined });
        // common is omitted by buildDecreePayload when empty — validator must catch the absence
        const errors = validateDecreePayload(p, 'en', false);
        expect(errors.some((e) => e.toLowerCase().includes('common'))).toBe(true);
    });

    it('makeDoctor with non-empty common → no common error', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.MakeDoctor, common: ['Doctors'], readings: undefined });
        const errors = validateDecreePayload(p, 'en', false);
        expect(errors.every((e) => !e.toLowerCase().includes('common'))).toBe(true);
    });

    // --- createNew pre-checks for DTO-required fields ---

    it('createNew without color → validation error', () => {
        const p = buildDecreePayload({ ...createNewForm(), color: [] });
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.some((e) => e.toLowerCase().includes('color'))).toBe(true);
    });

    it('createNew without common → validation error', () => {
        const p = buildDecreePayload({ ...createNewForm(), common: [] });
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.some((e) => e.toLowerCase().includes('common'))).toBe(true);
    });

    it('createNew with color and common → no color/common errors', () => {
        const p = buildDecreePayload(createNewForm());
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.every((e) => !e.toLowerCase().includes('color') && !e.toLowerCase().includes('common'))).toBe(true);
    });

    // --- URL / url_lang_map consistency ---

    it('flags a %s URL with no url_lang_map', () => {
        const p = buildDecreePayload({ ...createNewForm(), url: 'https://vatican.va/%s/doc.html' });
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.some((e) => e.includes('%s'))).toBe(true);
    });

    it('flags a url_lang_map with no %s in the URL', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            url: 'https://vatican.va/doc.html',
            url_lang_map: { en: 'en', it: 'it' },
        });
        const errors = validateDecreePayload(p, 'en', true);
        expect(errors.some((e) => e.includes('%s'))).toBe(true);
    });

    it('accepts a %s URL paired with a url_lang_map', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            url: 'https://vatican.va/%s/doc.html',
            url_lang_map: { en: 'en', de: 'ge' },
        });
        expect(validateDecreePayload(p, 'en', true)).toEqual([]);
    });
});

describe('buildDecreePayload: url_lang_map metadata', () => {
    it('includes url_lang_map in metadata when present', () => {
        const p = buildDecreePayload({
            ...createNewForm(),
            url: 'https://vatican.va/%s/doc.html',
            url_lang_map: { en: 'en', de: 'ge', pt: 'po' },
        });
        expect(p.metadata.url_lang_map).toEqual({ en: 'en', de: 'ge', pt: 'po' });
    });

    it('omits url_lang_map from metadata when absent or empty', () => {
        const p1 = buildDecreePayload(createNewForm());
        expect('url_lang_map' in p1.metadata).toBe(false);
        const p2 = buildDecreePayload({ ...createNewForm(), url_lang_map: {} });
        expect('url_lang_map' in p2.metadata).toBe(false);
    });
});

describe('deriveDecreeId', () => {
    it('derives the deterministic suffix per action', () => {
        expect(deriveDecreeId('StMotherTeresa', DecreeAction.CreateNew)).toBe('StMotherTeresa_Create');
        expect(deriveDecreeId('StThereseChildJesus', DecreeAction.MakeDoctor)).toBe('StThereseChildJesus_Doctor');
        expect(deriveDecreeId('StMartha', DecreeAction.SetPropertyName)).toBe('StMartha_NameChange');
        expect(deriveDecreeId('StMaryMagdalene', DecreeAction.SetPropertyGrade)).toBe('StMaryMagdalene_Upgrade');
    });

    it('returns empty string when event_key or action is missing/unknown', () => {
        expect(deriveDecreeId('', DecreeAction.CreateNew)).toBe('');
        expect(deriveDecreeId('StTest', '')).toBe('');
        expect(deriveDecreeId('StTest', 'bogusAction')).toBe('');
    });
});
