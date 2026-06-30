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
