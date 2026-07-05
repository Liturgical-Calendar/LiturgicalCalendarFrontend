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
        // Normalize gettext/ICU-style locales (en_US) to BCP-47 (en-US):
        // Intl.DateTimeFormat throws a RangeError on underscore tags, and the
        // page locale originates from PHP's \Locale::acceptFromHttp(), which
        // returns the underscore form.
        this.locale = (locale || 'en').replace(/_/g, '-');
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

    /** Build description text from an event, e.g. "The Memorial of 'X' should fall on July 31". */
    static #describe(event, locale) {
        const grade = event.grade_lcl ?? '';
        let onDate = 'the expected date';
        if (event.month && event.day) {
            const d = new Date(Date.UTC(1970, Number(event.month) - 1, Number(event.day)));
            onDate = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
        }
        return `The ${grade} of '${event.name}' should fall on ${onDate}`;
    }

    /** RFC 3339 UTC-midnight string for an event's month/day in a given year. */
    static #expectedValue(year, month, day) {
        const iso = new Date(Date.UTC(year, Number(month) - 1, Number(day))).toISOString();
        return `${iso.split('T')[0]}T00:00:00+00:00`;
    }

    /**
     * Rebuild the assertions array from an event, a year range, and the test type.
     * @param {{event:object, minYear:number, maxYear:number, pivotYear?:number|null, excludedYears?:number[]}} opts
     */
    generate({ event, minYear, maxYear, pivotYear = null, excludedYears = [] }) {
        this.event = event;
        this.baseMonthDay = (event.month && event.day)
            ? { month: Number(event.month), day: Number(event.day) }
            : null;
        const description = AssertionsBuilder.#describe(event, this.locale);
        this.model.description = description;
        this.model.event_key = event.event_key;

        this.model.year_since = null;
        this.model.year_until = null;
        if (this.model.test_type === TestType.ExactCorrespondenceSince) {
            this.model.year_since = pivotYear;
        } else if (this.model.test_type === TestType.ExactCorrespondenceUntil) {
            this.model.year_until = pivotYear;
        }

        const notExistsAssertion = description.replace('should fall on', 'should not exist on');
        const excluded = new Set(excludedYears.map(Number));
        const assertions = [];
        for (let year = minYear; year <= maxYear; year++) {
            if (excluded.has(year)) continue;
            let notExists = false;
            if (this.model.test_type === TestType.ExactCorrespondenceSince && pivotYear !== null) {
                notExists = year < pivotYear;
            } else if (this.model.test_type === TestType.ExactCorrespondenceUntil && pivotYear !== null) {
                notExists = year > pivotYear;
            }
            if (notExists || !this.baseMonthDay) {
                assertions.push(new Assertion(year, null, AssertType.EventNotExists, notExistsAssertion));
            } else {
                const ev = AssertionsBuilder.#expectedValue(year, this.baseMonthDay.month, this.baseMonthDay.day);
                assertions.push(new Assertion(year, ev, AssertType.EventTypeExact, description));
            }
        }
        this.model.assertions = assertions;
        return this;
    }

    #find(year) {
        return this.model.assertions.find((a) => a.year === year) ?? null;
    }

    toggleAssert(year) {
        const a = this.#find(year);
        if (!a) return this;
        // Rebuild the sentence from the canonical description (set by
        // generate()/load()), never from a.assertion: the per-year text is
        // user-editable via setAssertionText, so substring replacement on it
        // silently no-ops once an editor rewrites the phrase, desyncing the
        // text from assert/expected_value. Toggling always restores canon.
        const canonical = this.model.description || a.assertion;
        if (a.assert === AssertType.EventTypeExact) {
            a.assert = AssertType.EventNotExists;
            a.expected_value = null;
            a.assertion = canonical.replace('should fall on', 'should not exist on');
        } else {
            a.assert = AssertType.EventTypeExact;
            if (this.baseMonthDay) {
                a.expected_value = AssertionsBuilder.#expectedValue(year, this.baseMonthDay.month, this.baseMonthDay.day);
            }
            a.assertion = canonical.replace('should not exist on', 'should fall on');
        }
        return this;
    }

    setExpectedDate(year, iso) {
        const a = this.#find(year);
        if (a) a.expected_value = iso;
        return this;
    }

    setAssertionText(year, text) {
        const a = this.#find(year);
        if (a) a.assertion = text;
        return this;
    }

    setComment(year, text) {
        const a = this.#find(year);
        if (!a) return this;
        if (text === '' || text === null || text === undefined) {
            delete a.comment;
        } else {
            a.comment = text;
        }
        return this;
    }

    setPivot(year) {
        if (this.model.test_type === TestType.ExactCorrespondenceSince) {
            this.model.year_since = year;
        } else if (this.model.test_type === TestType.ExactCorrespondenceUntil) {
            this.model.year_until = year;
        }
        this.model.assertions.forEach((a) => {
            const notExists = this.model.test_type === TestType.ExactCorrespondenceSince
                ? a.year < year
                : a.year > year;
            const isNot = a.assert === AssertType.EventNotExists;
            if (notExists !== isNot) {
                this.toggleAssert(a.year);
            }
        });
        return this;
    }

    /**
     * Exclude a year from the test by removing its assertion. Assertion
     * absence is the single source of truth for year exclusion — model.excludes
     * (a calendar-scope field, not a year list) is never mutated here.
     * Chainable; no-op when the year has no assertion (including double-exclude).
     */
    excludeYear(year) {
        const y = Number(year);
        if (!this.model.assertions.some((a) => a.year === y)) return this;
        this.model.assertions = this.model.assertions.filter((a) => a.year !== y);
        return this;
    }

    /**
     * Restore a year by creating its assertion with the same rules generate()
     * uses (pivot- and baseMonthDay-aware). No-op when the year already has
     * an assertion (assertion presence IS inclusion). Chainable. model.excludes
     * is never mutated.
     */
    includeYear(year) {
        const y = Number(year);
        // No-op if the year already has an assertion — assertion presence IS inclusion.
        if (this.model.assertions.some((a) => a.year === y)) return this;

        let notExists = false;
        if (this.model.test_type === TestType.ExactCorrespondenceSince && this.model.year_since !== null) {
            notExists = y < this.model.year_since;
        } else if (this.model.test_type === TestType.ExactCorrespondenceUntil && this.model.year_until !== null) {
            notExists = y > this.model.year_until;
        }
        const description = this.model.description;
        if (notExists || !this.baseMonthDay) {
            this.model.assertions.push(
                new Assertion(y, null, AssertType.EventNotExists, description.replace('should fall on', 'should not exist on'))
            );
        } else {
            this.model.assertions.push(
                new Assertion(
                    y,
                    AssertionsBuilder.#expectedValue(y, this.baseMonthDay.month, this.baseMonthDay.day),
                    AssertType.EventTypeExact,
                    description
                )
            );
        }
        this.model.assertions.sort((a, b) => a.year - b.year);
        return this;
    }

    #formatDate(iso) {
        if (!iso) return '---';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '---';
        return new Intl.DateTimeFormat(this.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
    }

    render(container) {
        container.innerHTML = '';
        container.classList.add('assertions-grid');

        this.model.assertions.forEach((a) => {
            const notExists = a.assert === AssertType.EventNotExists;
            const bg = notExists ? 'bg-warning' : 'bg-success';
            const fg = notExists ? 'text-dark' : 'text-white';

            const card = document.createElement('div');
            card.className = `assertion-card d-flex flex-column border ${bg} ${fg}`;
            card.dataset.year = String(a.year);

            const yearP = document.createElement('p');
            yearP.className = 'text-center mb-0 fw-bold testYear';
            yearP.textContent = String(a.year);
            card.appendChild(yearP);

            // ASSERT THAT row
            const assertRow = document.createElement('div');
            assertRow.className = 'd-flex justify-content-between align-items-center px-1 border-bottom';
            const assertLabel = document.createElement('span');
            assertLabel.className = 'fw-bold small';
            assertLabel.textContent = 'ASSERT:';
            const assertVal = document.createElement('span');
            assertVal.className = 'assert small text-end';
            assertVal.textContent = a.assert;
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'btn btn-xs btn-danger ms-1 toggleAssert';
            toggleBtn.innerHTML = '<i class="fas fa-repeat" aria-hidden="true"></i>';
            assertRow.append(assertLabel, assertVal, toggleBtn);
            card.appendChild(assertRow);

            // EXPECT VALUE row
            const dateRow = document.createElement('div');
            dateRow.className = 'd-flex justify-content-between align-items-center px-1 border-bottom';
            const dateLabel = document.createElement('span');
            dateLabel.className = 'fw-bold small';
            dateLabel.textContent = 'DATE:';
            const dateVal = document.createElement('span');
            dateVal.className = 'expectedValue small';
            dateVal.setAttribute('data-value', a.expected_value ?? '');
            dateVal.textContent = this.#formatDate(a.expected_value);
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = `btn btn-xs editDate ms-1${a.expected_value ? ' btn-danger' : ' btn-secondary disabled'}`;
            editBtn.disabled = !a.expected_value;
            editBtn.innerHTML = '<i class="fas fa-pen-to-square" aria-hidden="true"></i>';
            dateRow.append(dateLabel, dateVal, editBtn);
            card.appendChild(dateRow);

            // ASSERTION textarea + comment button
            const textRow = document.createElement('div');
            textRow.className = 'd-flex flex-column p-1';
            const textHeader = document.createElement('div');
            textHeader.className = 'd-flex justify-content-between align-items-center';
            const textLabel = document.createElement('span');
            textLabel.className = 'fw-bold small';
            textLabel.textContent = 'ASSERTION:';
            const hasComment = 'comment' in a;
            const commentBtn = document.createElement('button');
            commentBtn.type = 'button';
            commentBtn.className = `btn btn-xs comment ms-1 ${hasComment ? 'btn-dark' : 'btn-secondary'}`;
            commentBtn.title = hasComment ? a.comment : 'add a comment';
            commentBtn.innerHTML = hasComment
                ? '<i class="fas fa-comment-dots" aria-hidden="true"></i>'
                : '<i class="fas fa-comment-medical" aria-hidden="true"></i>';
            textHeader.append(textLabel, commentBtn);
            const textarea = document.createElement('textarea');
            textarea.className = 'form-control form-control-sm assertionText';
            textarea.rows = 2;
            textarea.value = a.assertion;
            textRow.append(textHeader, textarea);
            card.appendChild(textRow);

            container.appendChild(card);
        });
    }
}
