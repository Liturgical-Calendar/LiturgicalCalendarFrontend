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
        expect(p.liturgical_event).not.toHaveProperty('day');
    });

    it('splits setProperty actions into action + property', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.SetPropertyGrade, i18n: undefined, readings: undefined });
        expect(p.metadata.action).toBe('setProperty');
        expect(p.metadata.property).toBe('grade');
        expect(p).not.toHaveProperty('i18n');
        expect(p).not.toHaveProperty('readings');
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

    it('rejects i18n for setProperty:grade', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.SetPropertyGrade, readings: undefined });
        expect(validateDecreePayload(p, 'en', false).length).toBeGreaterThan(0);
    });

    it('requires readings on create only for createNew', () => {
        const noReadings = buildDecreePayload({ ...createNewForm(), readings: undefined });
        expect(validateDecreePayload(noReadings, 'en', true).length).toBeGreaterThan(0);
        expect(validateDecreePayload(noReadings, 'en', false)).toEqual([]);
    });

    it('rejects readings on create for makeDoctor', () => {
        const p = buildDecreePayload({ ...createNewForm(), action: DecreeAction.MakeDoctor });
        expect(validateDecreePayload(p, 'en', true).length).toBeGreaterThan(0);
    });
});
