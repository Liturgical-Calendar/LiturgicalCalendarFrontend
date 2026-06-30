import { describe, it, expect } from 'vitest';
import { TestType, AssertType, LitGrade, Assertion } from '../AssertionsBuilder.js';

describe('enums', () => {
    it('exposes the four test types', () => {
        expect(TestType.ExactCorrespondence).toBe('exactCorrespondence');
        expect(TestType.ExactCorrespondenceSince).toBe('exactCorrespondenceSince');
        expect(TestType.ExactCorrespondenceUntil).toBe('exactCorrespondenceUntil');
        expect(TestType.VariableCorrespondence).toBe('variableCorrespondence');
    });

    it('exposes the two assert types', () => {
        expect(AssertType.EventNotExists).toBe('eventNotExists');
        expect(AssertType.EventTypeExact).toBe('eventExists AND hasExpectedDate');
    });

    it('maps liturgical grades to strings', () => {
        expect(LitGrade.toString(LitGrade.FEAST)).toBe('FEAST');
    });
});

describe('Assertion', () => {
    it('omits comment when not provided', () => {
        const a = new Assertion(2024, null, AssertType.EventNotExists, 'x');
        expect('comment' in a).toBe(false);
        expect(a.year).toBe(2024);
    });

    it('keeps comment when provided', () => {
        const a = new Assertion(2024, null, AssertType.EventNotExists, 'x', 'note');
        expect(a.comment).toBe('note');
    });
});

import { AssertionsBuilder } from '../AssertionsBuilder.js';

const sampleExact = {
    name: 'StIgnatiusOfLoyolaTest',
    event_key: 'StIgnatiusOfLoyola',
    description: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31",
    test_type: 'exactCorrespondence',
    applies_to: { national_calendar: 'USA' },
    assertions: [
        { year: 2024, expected_value: '2024-07-31T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31" },
        { year: 2025, expected_value: '2025-07-31T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31", comment: 'note' },
    ],
};

const sampleSince = {
    name: 'SomeFeastTest',
    event_key: 'SomeFeast',
    description: "The FEAST of 'Some Feast' should fall on March 19",
    test_type: 'exactCorrespondenceSince',
    year_since: 2026,
    assertions: [
        { year: 2025, expected_value: null, assert: 'eventNotExists', assertion: "The FEAST of 'Some Feast' should not exist on March 19" },
        { year: 2026, expected_value: '2026-03-19T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The FEAST of 'Some Feast' should fall on March 19" },
    ],
};

const sampleUntil = {
    name: 'SomeUntilTest',
    event_key: 'SomeUntilEvent',
    description: "The FEAST of 'Some Feast' should fall on March 19 until 2028",
    test_type: 'exactCorrespondenceUntil',
    year_until: 2028,
    assertions: [
        { year: 2028, expected_value: '2028-03-19T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: "The FEAST of 'Some Feast' should fall on March 19" },
        { year: 2029, expected_value: null, assert: 'eventNotExists', assertion: "The FEAST of 'Some Feast' should not exist on March 19" },
    ],
};

describe('load + serialize round-trip', () => {
    it('round-trips an exactCorrespondence test (applies_to + comment preserved)', () => {
        const out = new AssertionsBuilder().load(sampleExact).serialize();
        expect(out).toEqual(sampleExact);
    });

    it('round-trips an exactCorrespondenceSince test (year_since preserved)', () => {
        const out = new AssertionsBuilder().load(sampleSince).serialize();
        expect(out).toEqual(sampleSince);
    });

    it('round-trips an exactCorrespondenceUntil test (year_until preserved)', () => {
        const out = new AssertionsBuilder().load(sampleUntil).serialize();
        expect(out).toEqual(sampleUntil);
    });

    it('omits year_since/year_until/applies_to/excludes when not applicable', () => {
        const out = new AssertionsBuilder().load({
            name: 'BareTest', event_key: 'Bare', description: 'd',
            test_type: 'exactCorrespondence',
            assertions: [{ year: 2024, expected_value: null, assert: 'eventNotExists', assertion: 'd' }],
        }).serialize();
        expect('year_since' in out).toBe(false);
        expect('year_until' in out).toBe(false);
        expect('applies_to' in out).toBe(false);
        expect('excludes' in out).toBe(false);
    });

    it('setMeta updates name/description/event_key/test_type without touching assertions', () => {
        const b = new AssertionsBuilder().load(sampleExact);
        b.setMeta({ name: 'RenamedTest', description: 'new desc', event_key: 'RenamedKeyEvent', test_type: 'variableCorrespondence' });
        const out = b.serialize();
        expect(out.name).toBe('RenamedTest');
        expect(out.description).toBe('new desc');
        expect(out.event_key).toBe('RenamedKeyEvent');
        expect(out.test_type).toBe('variableCorrespondence');
        expect(out.assertions).toHaveLength(2);
    });

    it('derives baseMonthDay from the first eventExists assertion', () => {
        const b = new AssertionsBuilder().load(sampleExact);
        expect(b.baseMonthDay).toEqual({ month: 7, day: 31 });
    });
});
