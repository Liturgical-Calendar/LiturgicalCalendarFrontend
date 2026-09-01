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

import {
    diffLocaleMap, buildPatch, buildCreate, PayloadError
} from '../sanctorale-payload.js';

describe('diffLocaleMap', () => {
    it('carries only the locales that changed', () => {
        expect(diffLocaleMap({ en: 'Isidore', it: 'Isidoro' }, { en: 'St Isidore', it: 'Isidoro' }))
            .toEqual({ en: 'St Isidore' });
    });

    it('treats clearing a name as a change to "", never as a removal', () => {
        // "" is how the corpus records "not translated yet". Omitting the locale
        // would leave the old name in place; sending null would break the schema.
        expect(diffLocaleMap({ de: 'Isidor' }, { de: '' })).toEqual({ de: '' });
    });

    it('treats filling in a previously blank name as a change', () => {
        expect(diffLocaleMap({ de: '' }, { de: 'Isidor' })).toEqual({ de: 'Isidor' });
    });

    it('treats a locale absent from the original as a change when it has a value', () => {
        expect(diffLocaleMap({}, { nl: 'Isidorus' })).toEqual({ nl: 'Isidorus' });
    });

    it('does not propose a blank for a locale that was already absent', () => {
        // The API fans a new key out into every locale file itself; proposing
        // fourteen identical blanks would only lengthen a reviewer's diff.
        expect(diffLocaleMap({}, { nl: '' })).toEqual({});
    });

    it('compares nested readings entries structurally', () => {
        const before = { en: { first_reading: 'Sir 3:1', gospel: 'Mt 5:1' } };
        expect(diffLocaleMap(before, { en: { first_reading: 'Sir 3:1', gospel: 'Mt 5:1' } }))
            .toEqual({});
        expect(diffLocaleMap(before, { en: { first_reading: 'Sir 3:1', gospel: 'Mt 6:1' } }))
            .toEqual({ en: { first_reading: 'Sir 3:1', gospel: 'Mt 6:1' } });
    });

    it('keeps a curated-blank reading blank', () => {
        // AllSouls carries three schemata whose every field is "".
        const before = { en: { first_reading: '', gospel: '' } };
        expect(diffLocaleMap(before, { en: { first_reading: '', gospel: '' } })).toEqual({});
    });
});

describe('buildPatch', () => {
    const original = {
        structure: {
            month: 5, day: 15, grade: 3, grade_display: null,
            common: ['Pastors'], calendar: 'US', color: ['white'],
            is_dominical: false, is_bvm: false
        },
        i18n: { en_US: 'Saint Isidore' },
        readings: { en_US: { first_reading: 'Sir 3:1', gospel: 'Mt 5:1' } }
    };

    const unchanged = () => ({
        structure: { ...original.structure },
        i18n: { ...original.i18n },
        readings: { en_US: { ...original.readings.en_US } }
    });

    it('refuses a no-op rather than recording an empty change', () => {
        // The API refuses this too; catching it here keeps a pointless change
        // request out of a reviewer's queue.
        expect(() => buildPatch({ original, next: unchanged(), readingsTier: 'missal' }))
            .toThrow(PayloadError);
    });

    it('sends only the structure field that changed', () => {
        const next = unchanged();
        next.structure.day = 16;
        expect(buildPatch({ original, next, readingsTier: 'missal' })).toEqual({ day: 16 });
    });

    it('omits i18n entirely when no name changed', () => {
        const next = unchanged();
        next.structure.grade = 4;
        expect(buildPatch({ original, next, readingsTier: 'missal' }))
            .not.toHaveProperty('i18n');
    });

    it('sends only the locales that changed', () => {
        const next = unchanged();
        next.i18n.en_US = 'St Isidore the Farmer';
        expect(buildPatch({ original, next, readingsTier: 'missal' }))
            .toEqual({ i18n: { en_US: 'St Isidore the Farmer' } });
    });

    it('omits readings when the rite has no lectionary to write to', () => {
        // readings_tier 'none' is the Ambrosian rite. The handler REJECTS a
        // payload carrying readings there, so omission is required, not polite.
        const next = unchanged();
        next.readings.en_US.gospel = 'Mt 6:1';
        next.structure.day = 16;
        const payload = buildPatch({ original, next, readingsTier: 'none' });
        expect(payload).not.toHaveProperty('readings');
        expect(payload).toEqual({ day: 16 });
    });

    it('sends readings when the tier is the rite-level corpus', () => {
        const next = unchanged();
        next.readings.en_US.gospel = 'Mt 6:1';
        expect(buildPatch({ original, next, readingsTier: 'rite' }))
            .toEqual({ readings: { en_US: { first_reading: 'Sir 3:1', gospel: 'Mt 6:1' } } });
    });

    it('never carries event_key or calendar', () => {
        const next = unchanged();
        next.structure.day = 16;
        const payload = buildPatch({ original, next, readingsTier: 'missal' });
        expect(payload).not.toHaveProperty('event_key');
        expect(payload).not.toHaveProperty('calendar');
    });
});

describe('buildCreate', () => {
    const complete = {
        structure: {
            month: 5, day: 15, grade: 3, grade_display: null,
            common: ['Pastors'], calendar: 'US', color: ['white'],
            is_dominical: false, is_bvm: false
        },
        i18n: { en_US: 'Saint Isidore' }
    };

    it('carries the whole entry, including the derived calendar', () => {
        // PUT is create-or-replace: buildRow() requires month, day, grade,
        // common, calendar and color, and refuses a calendar that is not the
        // Missal's own.
        const payload = buildCreate({ eventKey: 'StIsidore', next: complete, readingsTier: 'missal' });
        expect(payload).toMatchObject({
            month: 5, day: 15, grade: 3, common: ['Pastors'],
            calendar: 'US', color: ['white'], i18n: { en_US: 'Saint Isidore' }
        });
    });

    it('carries an authored grade_display of "" rather than dropping it', () => {
        const next = { ...complete, structure: { ...complete.structure, grade_display: '' } };
        expect(buildCreate({ eventKey: 'AllSouls', next, readingsTier: 'rite' }).grade_display).toBe('');
    });

    it('omits grade_display when there is no override', () => {
        expect(buildCreate({ eventKey: 'StIsidore', next: complete, readingsTier: 'missal' }))
            .not.toHaveProperty('grade_display');
    });

    it('names every missing required field at once', () => {
        const next = { structure: { month: 5, calendar: 'US' }, i18n: { en_US: 'x' } };
        expect(() => buildCreate({ eventKey: 'StIsidore', next, readingsTier: 'missal' }))
            .toThrow(/day.*grade.*common.*color/s);
    });

    it('requires at least one locale, since the schema sets minProperties 1', () => {
        expect(() => buildCreate({ eventKey: 'StIsidore', next: { ...complete, i18n: {} }, readingsTier: 'missal' }))
            .toThrow(PayloadError);
    });

    it('accepts a single blank name as a locale, because blank is a value', () => {
        const next = { ...complete, i18n: { en_US: '' } };
        expect(buildCreate({ eventKey: 'StIsidore', next, readingsTier: 'missal' }).i18n)
            .toEqual({ en_US: '' });
    });

    it('never carries event_key, which the URL owns', () => {
        expect(buildCreate({ eventKey: 'StIsidore', next: complete, readingsTier: 'missal' }))
            .not.toHaveProperty('event_key');
    });
});
