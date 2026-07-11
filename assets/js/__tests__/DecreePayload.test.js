import { describe, it, expect } from 'vitest';
import { DecreeAction, buildDecreePayload, validateDecreePayload } from '../DecreePayload.js';

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
});
