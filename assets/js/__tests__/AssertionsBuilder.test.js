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

describe('rebaseDate', () => {
    it('re-anchors baseMonthDay, description, dates, and per-year text', () => {
        const b = new AssertionsBuilder({ locale: 'en-US' }).load(sampleExact);
        b.rebaseDate({ month: 8, day: 6 });
        expect(b.baseMonthDay).toEqual({ month: 8, day: 6 });
        expect(b.model.description).toBe("The Memorial of 'Saint Ignatius of Loyola' should fall on August 6");
        b.model.assertions.forEach((a) => {
            expect(a.expected_value).toBe(`${a.year}-08-06T00:00:00+00:00`);
            expect(a.assertion).toBe("The Memorial of 'Saint Ignatius of Loyola' should fall on August 6");
        });
    });

    it('rewrites not-exists assertions to the new date but leaves them value-less', () => {
        const b = new AssertionsBuilder({ locale: 'en-US' }).load(sampleSince);
        b.rebaseDate({ month: 8, day: 6 });
        const notExists = b.model.assertions.find((a) => a.assert === AssertType.EventNotExists);
        expect(notExists.expected_value).toBeNull();
        expect(notExists.assertion).toBe("The FEAST of 'Some Feast' should not exist on August 6");
        const exists = b.model.assertions.find((a) => a.assert === AssertType.EventTypeExact);
        expect(exists.expected_value).toBe('2026-08-06T00:00:00+00:00');
        expect(exists.assertion).toBe("The FEAST of 'Some Feast' should fall on August 6");
    });

    it('ignores an incomplete month/day', () => {
        const b = new AssertionsBuilder({ locale: 'en-US' }).load(sampleExact);
        const before = b.serialize();
        b.rebaseDate({ month: 8 });
        expect(b.serialize()).toEqual(before);
    });
});

describe('render date-editor enablement', () => {
    it('enables the date editor for eventExists assertions (even value-less) and disables it for eventNotExists', () => {
        const b = new AssertionsBuilder({ locale: 'en-US' });
        b.model.assertions = [
            // Dated assertion with no value yet (e.g. toggled to Exact for a
            // movable feast) — the date editor must still be enabled.
            new Assertion(2024, null, AssertType.EventTypeExact, 'x'),
            new Assertion(2025, '2025-07-31T00:00:00+00:00', AssertType.EventTypeExact, 'x'),
            new Assertion(2026, null, AssertType.EventNotExists, 'x'),
        ];
        const container = document.createElement('div');
        b.render(container);
        const editButtons = container.querySelectorAll('.assertion-card .editDate');
        expect(editButtons[0].disabled).toBe(false); // Exact, no value → enabled
        expect(editButtons[1].disabled).toBe(false); // Exact, valued → enabled
        expect(editButtons[2].disabled).toBe(true);  // NotExists → disabled
    });
});

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

    it('derives baseMonthDay as the MODE of dated assertions (transfer years are outliers)', () => {
        // spec R3.1: a test mixing canonical (June 24) and transferred (June 23)
        // dates must derive the canonical majority, not the first assertion.
        const mixed = {
            name: 'MixedTest',
            event_key: 'NativityJohnBaptist',
            description: "The Solemnity 'Nativity of John the Baptist' should fall on June 24",
            test_type: 'exactCorrespondence',
            assertions: [
                { year: 2022, expected_value: '2022-06-23T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
                { year: 2023, expected_value: '2023-06-24T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
                { year: 2024, expected_value: '2024-06-24T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
            ],
        };
        const b = new AssertionsBuilder().load(mixed);
        expect(b.baseMonthDay).toEqual({ month: 6, day: 24 });
    });

    it('load() sorts assertions by year (corpus may group by assert type)', () => {
        // spec R4: e.g. StJaneFrancesDeChantalTest stores all eventExists
        // assertions first, then the eventNotExists block — the model must
        // normalize to year order so cards render chronologically.
        const grouped = {
            name: 'GroupedTest',
            event_key: 'StJaneFrancesDeChantal',
            description: 'x',
            test_type: 'variableCorrespondence',
            assertions: [
                { year: 2001, expected_value: '2001-12-12T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
                { year: 2010, expected_value: '2010-12-12T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
                { year: 1971, expected_value: null, assert: 'eventNotExists', assertion: 'x' },
                { year: 2005, expected_value: null, assert: 'eventNotExists', assertion: 'x' },
            ],
        };
        const b = new AssertionsBuilder().load(grouped);
        expect(b.model.assertions.map((a) => a.year)).toEqual([1971, 2001, 2005, 2010]);
    });

    it('baseMonthDay mode tiebreak goes to the earliest year', () => {
        const tied = {
            name: 'TiedTest',
            event_key: 'SomeEvent',
            description: 'x',
            test_type: 'exactCorrespondence',
            assertions: [
                { year: 2022, expected_value: '2022-06-23T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
                { year: 2023, expected_value: '2023-06-24T00:00:00+00:00', assert: 'eventExists AND hasExpectedDate', assertion: 'x' },
            ],
        };
        const b = new AssertionsBuilder().load(tied);
        expect(b.baseMonthDay).toEqual({ month: 6, day: 23 });
    });
});

const event = { event_key: 'StIgnatiusOfLoyola', name: 'Saint Ignatius of Loyola', grade: 3, grade_lcl: 'Memorial', month: 7, day: 31 };

describe('generate', () => {
    it('exactCorrespondence: every year asserts eventExists with a UTC midnight date', () => {
        const b = new AssertionsBuilder({ locale: 'en' });
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondence' });
        b.generate({ event, minYear: 2023, maxYear: 2025 });
        const out = b.serialize();
        expect(out.assertions.map((a) => a.year)).toEqual([2023, 2024, 2025]);
        expect(out.assertions.every((a) => a.assert === 'eventExists AND hasExpectedDate')).toBe(true);
        expect(out.assertions[1].expected_value).toBe('2024-07-31T00:00:00+00:00');
        expect(out.description).toBe("The Memorial of 'Saint Ignatius of Loyola' should fall on July 31");
    });

    it('exactCorrespondenceSince: years before the pivot assert eventNotExists', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondenceSince' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2025 });
        const out = b.serialize();
        expect(out.year_since).toBe(2025);
        expect(out.assertions.find((a) => a.year === 2024).assert).toBe('eventNotExists');
        expect(out.assertions.find((a) => a.year === 2024).expected_value).toBe(null);
        expect(out.assertions.find((a) => a.year === 2025).assert).toBe('eventExists AND hasExpectedDate');
        expect(out.assertions.find((a) => a.year === 2024).assertion)
            .toBe("The Memorial of 'Saint Ignatius of Loyola' should not exist on July 31");
    });

    it('exactCorrespondenceUntil: years after the pivot assert eventNotExists', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondenceUntil' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2025 });
        const out = b.serialize();
        expect(out.year_until).toBe(2025);
        expect(out.assertions.find((a) => a.year === 2026).assert).toBe('eventNotExists');
        expect(out.assertions.find((a) => a.year === 2025).assert).toBe('eventExists AND hasExpectedDate');
    });

    it('skips excluded years', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondence' });
        b.generate({ event, minYear: 2023, maxYear: 2025, excludedYears: [2024] });
        expect(b.serialize().assertions.map((a) => a.year)).toEqual([2023, 2025]);
    });
});

describe('mutators', () => {
    const build = () => {
        const b = new AssertionsBuilder();
        b.setMeta({ test_type: 'variableCorrespondence' });
        b.generate({ event, minYear: 2024, maxYear: 2026 });
        return b;
    };

    it('toggleAssert flips eventExists -> eventNotExists and back', () => {
        const b = build();
        b.toggleAssert(2025);
        let a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventNotExists');
        expect(a.expected_value).toBe(null);
        expect(a.assertion).toContain('should not exist on');
        b.toggleAssert(2025);
        a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventExists AND hasExpectedDate');
        expect(a.expected_value).toBe('2025-07-31T00:00:00+00:00');
        expect(a.assertion).toContain('should fall on');
    });

    it('toggleAssert rewrites canonical text even after a user edit (no substring dependency)', () => {
        const b = build();
        // Simulate a user rewriting the sentence so the "should fall on"
        // phrase is gone — substring replacement would silently no-op here.
        b.setAssertionText(2025, 'Totally custom sentence written by an editor');
        b.toggleAssert(2025);
        let a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventNotExists');
        expect(a.assertion).toContain('should not exist on');
        b.toggleAssert(2025);
        a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventExists AND hasExpectedDate');
        expect(a.assertion).toContain('should fall on');
    });

    it('setExpectedDate updates the RFC3339 value', () => {
        const b = build();
        b.setExpectedDate(2024, '2024-08-01T00:00:00+00:00');
        expect(b.model.assertions.find((x) => x.year === 2024).expected_value).toBe('2024-08-01T00:00:00+00:00');
    });

    it('setAssertionText and setComment work; empty comment removes it', () => {
        const b = build();
        b.setAssertionText(2024, 'custom sentence');
        expect(b.model.assertions.find((x) => x.year === 2024).assertion).toBe('custom sentence');
        b.setComment(2024, 'a note');
        expect(b.model.assertions.find((x) => x.year === 2024).comment).toBe('a note');
        b.setComment(2024, '');
        expect('comment' in b.model.assertions.find((x) => x.year === 2024)).toBe(false);
    });

    it('excludeYear removes the assertion', () => {
        const b = build();
        b.excludeYear(2025);
        expect(b.model.assertions.map((x) => x.year)).toEqual([2024, 2026]);
    });

    it('setPivot re-splits a Since test', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ test_type: 'exactCorrespondenceSince' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2024 });
        b.setPivot(2026);
        expect(b.model.year_since).toBe(2026);
        expect(b.model.assertions.find((x) => x.year === 2024).assert).toBe('eventNotExists');
        expect(b.model.assertions.find((x) => x.year === 2026).assert).toBe('eventExists AND hasExpectedDate');
    });
});

describe('render', () => {
    it('renders one card per assertion with textarea, toggle, and color classes', () => {
        const b = new AssertionsBuilder();
        b.setMeta({ test_type: 'variableCorrespondence' });
        b.generate({ event, minYear: 2024, maxYear: 2025 });
        b.toggleAssert(2025); // make 2025 eventNotExists
        const container = document.createElement('div');
        b.render(container);

        const cards = container.querySelectorAll('[data-year]');
        expect(cards).toHaveLength(2);

        const card2024 = container.querySelector('[data-year="2024"]');
        expect(card2024.querySelector('.assert').textContent).toBe('eventExists AND hasExpectedDate');
        expect(card2024.querySelector('textarea.assertionText')).not.toBeNull();
        expect(card2024.querySelector('.toggleAssert')).not.toBeNull();
        expect(card2024.querySelector('.expectedValue').getAttribute('data-value')).toBe('2024-07-31T00:00:00+00:00');

        const card2025 = container.querySelector('[data-year="2025"]');
        expect(card2025.querySelector('.assert').textContent).toBe('eventNotExists');
        expect(card2025.querySelector('.editDate').classList.contains('disabled')).toBe(true);
    });
});

describe('coverage hardening', () => {
    it('generate variableCorrespondence: all in-range years are eventExists', () => {
        const event = { event_key: 'VEvent', name: 'Variable Event', grade: 3, grade_lcl: 'Memorial', month: 6, day: 15 };
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: 'VEvent', test_type: 'variableCorrespondence' });
        b.generate({ event, minYear: 2020, maxYear: 2022 });
        const out = b.serialize();
        expect(out.assertions.map((a) => a.year)).toEqual([2020, 2021, 2022]);
        expect(out.assertions.every((a) => a.assert === 'eventExists AND hasExpectedDate')).toBe(true);
        expect(out.assertions[0].expected_value).toBe('2020-06-15T00:00:00+00:00');
        expect('year_since' in out).toBe(false);
        expect('year_until' in out).toBe(false);
    });

    it('generate with an event lacking month/day forces every year to eventNotExists', () => {
        const movable = { event_key: 'Movable', name: 'Movable Feast', grade: 6, grade_lcl: 'SOLEMNITY' };
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: 'Movable', test_type: 'exactCorrespondence' });
        b.generate({ event: movable, minYear: 2020, maxYear: 2021 });
        expect(b.baseMonthDay).toBe(null);
        const out = b.serialize();
        expect(out.assertions.every((a) => a.assert === 'eventNotExists')).toBe(true);
        expect(out.assertions.every((a) => a.expected_value === null)).toBe(true);
    });

    it('generate Since with a null pivot leaves all years eventExists and omits year_since', () => {
        const event = { event_key: 'SEvent', name: 'Since Event', grade: 4, grade_lcl: 'FEAST', month: 3, day: 19 };
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: 'SEvent', test_type: 'exactCorrespondenceSince' });
        b.generate({ event, minYear: 2024, maxYear: 2025, pivotYear: null });
        const out = b.serialize();
        expect(out.assertions.every((a) => a.assert === 'eventExists AND hasExpectedDate')).toBe(true);
        expect('year_since' in out).toBe(false);
    });

    it('setPivot on an Until test marks years after the pivot as eventNotExists', () => {
        const event = { event_key: 'UEvent', name: 'Until Event', grade: 4, grade_lcl: 'FEAST', month: 5, day: 1 };
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: 'UEvent', test_type: 'exactCorrespondenceUntil' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2026 });
        b.setPivot(2024);
        expect(b.model.year_until).toBe(2024);
        const at = (y) => b.model.assertions.find((a) => a.year === y);
        expect(at(2024).assert).toBe('eventExists AND hasExpectedDate');
        expect(at(2025).assert).toBe('eventNotExists');
        expect(at(2025).expected_value).toBe(null);
        expect(at(2026).assert).toBe('eventNotExists');
    });

    it('toggleAssert back to Exact keeps expected_value null when there is no base date', () => {
        const b = new AssertionsBuilder();
        b.load({
            name: 'NoBaseTest',
            event_key: 'NB',
            description: "The FEAST of 'NB' should fall on July 4",
            test_type: 'variableCorrespondence',
            assertions: [
                { year: 2024, expected_value: null, assert: 'eventNotExists', assertion: "The FEAST of 'NB' should not exist on July 4" },
            ],
        });
        expect(b.baseMonthDay).toBe(null);
        b.toggleAssert(2024);
        const a = b.model.assertions.find((x) => x.year === 2024);
        expect(a.assert).toBe('eventExists AND hasExpectedDate');
        expect(a.expected_value).toBe(null);
        expect(a.assertion).toContain('should fall on');
    });

    it('render exposes grid class, color classes, comment icon, textarea', () => {
        const event = { event_key: 'REvent', name: 'Render Event', grade: 3, grade_lcl: 'Memorial', month: 7, day: 31 };
        const b = new AssertionsBuilder();
        b.setMeta({ event_key: 'REvent', test_type: 'variableCorrespondence' });
        b.generate({ event, minYear: 2024, maxYear: 2025 });
        b.toggleAssert(2025);                 // 2025 -> eventNotExists
        b.setComment(2024, 'a note');         // 2024 has a comment
        const container = document.createElement('div');
        b.render(container);

        expect(container.classList.contains('assertions-grid')).toBe(true);

        const card2024 = container.querySelector('[data-year="2024"]');
        const card2025 = container.querySelector('[data-year="2025"]');
        expect(card2024.classList.contains('bg-success')).toBe(true);
        expect(card2024.classList.contains('text-white')).toBe(true);
        expect(card2025.classList.contains('bg-warning')).toBe(true);
        expect(card2025.classList.contains('text-dark')).toBe(true);

        // comment icon swap
        expect(card2024.querySelector('.comment .fa-comment-dots')).not.toBeNull();
        expect(card2025.querySelector('.comment .fa-comment-medical')).not.toBeNull();

        // editable sentence is a textarea, not contenteditable
        const ta = card2024.querySelector('textarea.assertionText');
        expect(ta).not.toBeNull();
        expect(ta.getAttribute('contenteditable')).toBe(null);
    });
});

describe('locale normalization', () => {
    it('accepts a gettext/ICU-style underscore locale (en_US) without throwing', () => {
        // PHP \Locale::acceptFromHttp() yields en_US; Intl.DateTimeFormat throws
        // a RangeError on underscore tags unless the builder normalizes to BCP-47.
        const event = { event_key: 'LEvent', name: 'Locale Event', grade: 3, grade_lcl: 'Memorial', month: 7, day: 31 };
        const b = new AssertionsBuilder({ locale: 'en_US' });
        expect(b.locale).toBe('en-US');
        b.setMeta({ event_key: 'LEvent', test_type: 'exactCorrespondence' });
        expect(() => b.generate({ event, minYear: 2024, maxYear: 2025 })).not.toThrow();
        const out = b.serialize();
        expect(out.assertions).toHaveLength(2);
        expect(out.description).toBe("The Memorial of 'Locale Event' should fall on July 31");
        const container = document.createElement('div');
        expect(() => b.render(container)).not.toThrow();
    });
});

describe('excludeYear / includeYear', () => {
    const build = () => {
        const b = new AssertionsBuilder({ locale: 'en' });
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondence' });
        b.generate({ event, minYear: 2024, maxYear: 2026 });
        return b;
    };

    it('excludeYear removes the assertion; model.excludes stays null; chainable/dedup', () => {
        const b = build();
        b.excludeYear(2025).excludeYear(2024).excludeYear(2025); // second exclude of 2025 is a no-op
        expect(b.model.excludes).toBe(null);
        expect(b.model.assertions.map((a) => a.year)).toEqual([2026]);
    });

    it('excludeYear is a no-op for years without an assertion', () => {
        const b = build();
        b.excludeYear(1999);
        expect(b.model.excludes).toBe(null);
        expect(b.model.assertions).toHaveLength(3);
    });

    it('serialize() after excludeYear does not contain an excludes key (schema correctness)', () => {
        const b = build();
        b.excludeYear(2026);
        expect('excludes' in b.serialize()).toBe(false);
    });

    it('includeYear restores an exact assertion with expected_value from baseMonthDay (exclude then include)', () => {
        const b = build();
        b.excludeYear(2025).includeYear(2025);
        expect(b.model.excludes).toBe(null);
        const a = b.model.assertions.find((x) => x.year === 2025);
        expect(a.assert).toBe('eventExists AND hasExpectedDate');
        expect(a.expected_value).toBe('2025-07-31T00:00:00+00:00');
        expect(b.model.assertions.map((x) => x.year)).toEqual([2024, 2025, 2026]);
    });

    it('includeYear respects the since-pivot (creates eventNotExists + "should not exist on" before pivot)', () => {
        const b = new AssertionsBuilder({ locale: 'en' });
        b.setMeta({ event_key: event.event_key, test_type: 'exactCorrespondenceSince' });
        b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2026 });
        b.excludeYear(2024).includeYear(2024);
        const a = b.model.assertions.find((x) => x.year === 2024);
        expect(a.assert).toBe('eventNotExists');
        expect(a.assertion).toContain('should not exist on');
    });

    it('includeYear is a no-op when the year already has an assertion', () => {
        const b = build();
        b.includeYear(2025); // 2025 already has an assertion — assertion presence IS inclusion
        expect(b.model.excludes).toBe(null);
        expect(b.model.assertions).toHaveLength(3);
    });

    it('sparse-load: includeYear(2025) creates an assertion; model.excludes remains null; serialize has no excludes key', () => {
        // Real-world case: source definitions like NativityJohnBaptistTest have
        // assertions only for specific years (2022/2033/2044), every other year
        // in the span is excluded by omission. model.excludes is never populated.
        const b = new AssertionsBuilder({ locale: 'en' });
        b.load({
            name: 'SparseTest',
            event_key: 'StIgnatiusOfLoyola',
            description: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31",
            test_type: 'exactCorrespondence',
            assertions: [2022, 2033, 2044].map((year) => ({
                year,
                expected_value: `${year}-07-31T00:00:00+00:00`,
                assert: 'eventExists AND hasExpectedDate',
                assertion: "The Memorial of 'Saint Ignatius of Loyola' should fall on July 31",
            })),
        });
        b.includeYear(2025);
        expect(b.model.excludes).toBe(null);
        const a = b.model.assertions.find((x) => x.year === 2025);
        expect(a).not.toBeUndefined();
        expect(a.assert).toBe('eventExists AND hasExpectedDate');
        expect(a.expected_value).toBe('2025-07-31T00:00:00+00:00');
        expect('excludes' in b.serialize()).toBe(false);
    });

    it('generate skips excludedYears so regeneration preserves exclusions', () => {
        // model-level guarantee behind regenerate() wiring; excludedYears are
        // derived from asserted-span gaps (not model.excludes, which stays null).
        const b = build();
        b.excludeYear(2025);
        b.generate({
            event,
            minYear: 2024,
            maxYear: 2026,
            excludedYears: [2025], // derived from asserted span gaps, not model.excludes
        });
        expect(b.model.assertions.map((a) => a.year)).toEqual([2024, 2026]);
        expect(b.model.excludes).toBe(null);
    });
});
