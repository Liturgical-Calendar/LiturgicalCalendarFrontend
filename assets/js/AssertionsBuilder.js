/**
 * State-first Assertions Builder for the admin-tests editor.
 * The in-memory model is the single source of truth; serialize() reads the
 * model, never the DOM. Ported from UnitTestInterface (Isotope removed,
 * contenteditable replaced by <textarea>).
 * @module AssertionsBuilder
 */

export const TestType = Object.freeze({
    ExactCorrespondence:      'exactCorrespondence',
    ExactCorrespondenceSince: 'exactCorrespondenceSince',
    ExactCorrespondenceUntil: 'exactCorrespondenceUntil',
    VariableCorrespondence:   'variableCorrespondence',
});

export const AssertType = Object.freeze({
    EventNotExists: 'eventNotExists',
    EventTypeExact: 'eventExists AND hasExpectedDate',
});

export const LitGrade = Object.freeze({
    WEEKDAY: 0, COMMEMORATION: 1, OPTIONAL_MEMORIAL: 2, MEMORIAL: 3,
    FEAST: 4, FEAST_OF_THE_LORD: 5, SOLEMNITY: 6, HIGHER_SOLEMNITY: 7,
    stringVals: ['weekday', 'commemoration', 'optional memorial', 'Memorial',
        'FEAST', 'FEAST OF THE LORD', 'SOLEMNITY', 'HIGHER SOLEMNITY'],
    toString: (n) => LitGrade.stringVals[parseInt(n, 10)],
});

/**
 * A single per-year assertion. `comment` is only set when non-empty so it is
 * omitted from serialization (matching the schema's optional `comment`).
 */
export class Assertion {
    constructor(year, expected_value, assert, assertion, comment = null) {
        this.year = year;
        this.expected_value = expected_value;
        this.assert = assert;
        this.assertion = assertion;
        if (comment !== null && comment !== '') {
            this.comment = comment;
        }
    }
}

const EMPTY_MODEL = () => ({
    name: '',
    event_key: '',
    description: '',
    test_type: TestType.ExactCorrespondence,
    applies_to: null,
    excludes: null,
    year_since: null,
    year_until: null,
    assertions: [],
});

export class AssertionsBuilder {
    constructor({ locale = 'en' } = {}) {
        this.locale = locale;
        this.model = EMPTY_MODEL();
        this.baseMonthDay = null;
        this.event = null;
    }

    /** Populate the model from an existing LitCalTest definition. */
    load(def) {
        this.model = EMPTY_MODEL();
        this.model.name = def.name ?? '';
        this.model.event_key = def.event_key ?? '';
        this.model.description = def.description ?? '';
        this.model.test_type = def.test_type ?? TestType.ExactCorrespondence;
        this.model.applies_to = def.applies_to ?? null;
        this.model.excludes = def.excludes ?? null;
        this.model.year_since = def.year_since ?? null;
        this.model.year_until = def.year_until ?? null;
        this.model.assertions = (def.assertions ?? []).map(
            (a) => new Assertion(a.year, a.expected_value, a.assert, a.assertion, a.comment ?? null)
        );
        this.baseMonthDay = AssertionsBuilder.#deriveBaseMonthDay(this.model.assertions);
        return this;
    }

    /** Update editor-form metadata (never touches the assertions array). */
    setMeta({ name, event_key, description, test_type, applies_to, excludes } = {}) {
        if (name !== undefined) this.model.name = name;
        if (event_key !== undefined) this.model.event_key = event_key;
        if (description !== undefined) this.model.description = description;
        if (test_type !== undefined) this.model.test_type = test_type;
        if (applies_to !== undefined) this.model.applies_to = applies_to;
        if (excludes !== undefined) this.model.excludes = excludes;
        return this;
    }

    /** Produce a schema-valid LitCalTest object from the model. */
    serialize() {
        const m = this.model;
        const out = {
            name: m.name,
            event_key: m.event_key,
            description: m.description,
            test_type: m.test_type,
        };
        if (m.applies_to) out.applies_to = m.applies_to;
        if (m.excludes) out.excludes = m.excludes;
        if (m.test_type === TestType.ExactCorrespondenceSince && m.year_since !== null) {
            out.year_since = m.year_since;
        }
        if (m.test_type === TestType.ExactCorrespondenceUntil && m.year_until !== null) {
            out.year_until = m.year_until;
        }
        out.assertions = m.assertions.map((a) => {
            const item = {
                year: a.year,
                expected_value: a.expected_value,
                assert: a.assert,
                assertion: a.assertion,
            };
            if ('comment' in a) item.comment = a.comment;
            return item;
        });
        return out;
    }

    static #deriveBaseMonthDay(assertions) {
        const first = assertions.find((a) => a.expected_value);
        if (!first) return null;
        const d = new Date(first.expected_value);
        if (Number.isNaN(d.getTime())) return null;
        return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    }
}
