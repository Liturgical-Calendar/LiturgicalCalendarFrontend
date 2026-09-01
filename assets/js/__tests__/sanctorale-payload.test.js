/**
 * Sanctorale write payloads.
 *
 * Every trap in this editor is a payload-shaping trap, and they share one shape:
 * an empty string is DATA, not absence. Collapsing it writes null over a decision
 * somebody made, in three separate places. They are pinned here.
 */
import { describe, it, expect } from 'vitest';
import {
    gradeDisplayMode, gradeDisplayValue, diffStructure,
    GRADE_DISPLAY_DEFAULT, GRADE_DISPLAY_NONE, GRADE_DISPLAY_CUSTOM
} from '../sanctorale-payload.js';

describe('grade_display is three states, not two', () => {
    it('reads null as "no override"', () => {
        expect(gradeDisplayMode(null)).toBe(GRADE_DISPLAY_DEFAULT);
    });

    it('reads "" as an authored "show no rank"', () => {
        // AllSouls. A text input cannot tell this apart from "not filled in",
        // which is why the control is a select.
        expect(gradeDisplayMode('')).toBe(GRADE_DISPLAY_NONE);
    });

    it('reads text as a custom override', () => {
        expect(gradeDisplayMode('National Holiday')).toBe(GRADE_DISPLAY_CUSTOM);
    });

    it('writes each mode back to its own value', () => {
        expect(gradeDisplayValue(GRADE_DISPLAY_DEFAULT, 'ignored')).toBeNull();
        expect(gradeDisplayValue(GRADE_DISPLAY_NONE, 'ignored')).toBe('');
        expect(gradeDisplayValue(GRADE_DISPLAY_CUSTOM, 'National Holiday')).toBe('National Holiday');
    });

    it('round-trips all three states without collapsing any into another', () => {
        for (const value of [null, '', 'National Holiday']) {
            expect(gradeDisplayValue(gradeDisplayMode(value), value)).toBe(value);
        }
    });

    it('treats an emptied custom field as "show no rank", never as null', () => {
        // The user chose "Custom text" and cleared it. That is still an override.
        expect(gradeDisplayValue(GRADE_DISPLAY_CUSTOM, '')).toBe('');
    });
});

describe('diffStructure', () => {
    const original = {
        month: 5, day: 15, grade: 3, grade_display: null,
        common: ['Pastors'], calendar: 'US', color: ['white'],
        is_dominical: false, is_bvm: false
    };

    it('is empty when nothing changed', () => {
        expect(diffStructure(original, { ...original })).toEqual({});
    });

    it('carries only what changed', () => {
        expect(diffStructure(original, { ...original, day: 16 })).toEqual({ day: 16 });
    });

    it('compares arrays by value, not by identity', () => {
        expect(diffStructure(original, { ...original, common: ['Pastors'] })).toEqual({});
        expect(diffStructure(original, { ...original, color: ['white', 'red'] }))
            .toEqual({ color: ['white', 'red'] });
    });

    it('reports a grade_display of "" as a change from null', () => {
        // The change that matters most and the one a truthiness test would drop.
        expect(diffStructure(original, { ...original, grade_display: '' }))
            .toEqual({ grade_display: '' });
    });

    it('reports a grade_display returning to null as a change from ""', () => {
        const authored = { ...original, grade_display: '' };
        expect(diffStructure(authored, { ...authored, grade_display: null }))
            .toEqual({ grade_display: null });
    });

    it('ignores fields it does not own, so calendar is never proposed as an edit', () => {
        // calendar is derived by the API from the Missal; it is submitted on PUT
        // and must never appear in a PATCH as if a user had changed it.
        expect(diffStructure(original, { ...original, calendar: 'IT' })).toEqual({});
    });

    it('treats a boolean flip as a change even when flipping to false', () => {
        const dominical = { ...original, is_dominical: true };
        expect(diffStructure(dominical, { ...dominical, is_dominical: false }))
            .toEqual({ is_dominical: false });
    });
});
