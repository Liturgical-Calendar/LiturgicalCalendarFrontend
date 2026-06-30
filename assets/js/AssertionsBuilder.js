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
