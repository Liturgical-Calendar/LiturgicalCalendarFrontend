/**
 * Sanctorale composition.
 *
 * The layering rules are where this page's subtlety lives, so they are pure
 * functions in their own right and pinned here: a missal file is a delta, later
 * editions win, and every row must remember which layer supplied it.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let applicableMissals, baseRegionFor, compose, rowsFor, monthsWithHits, renderReadingsOutcome, HttpError, localesFor, preferredLocale, toBcp47, filterByMissal, formatGrade, gradeDisplayOf, hasNestedSchemas, schemaKeysOf, applicableTiers;

const VA_1970 = { missal_id: 'EDITIO_TYPICA_1970', region: 'VA', year_published: 1970 };
const VA_2002 = { missal_id: 'EDITIO_TYPICA_2002', region: 'VA', year_published: 2002 };
const US_2011 = { missal_id: 'US_2011',            region: 'US', year_published: 2011 };
const IT_1983 = { missal_id: 'IT_1983',            region: 'IT', year_published: 1983 };
const CATALOGUE = [VA_2002, US_2011, VA_1970, IT_1983];

// The Ambrosian rite publishes one edition, and its region is not a nation code.
const AMBROSIAN = [{ missal_id: 'EDITIO_TYPICA_2024', region: 'AMBROSIAN', year_published: 2024 }];

beforeAll(async () => {
    global.window = global.window ?? {};
    const mod = await import('../sanctorale.js');
    ({ applicableMissals, baseRegionFor, compose, rowsFor, monthsWithHits,
       renderReadingsOutcome, HttpError, localesFor, preferredLocale, toBcp47,
       filterByMissal, formatGrade, gradeDisplayOf, hasNestedSchemas, schemaKeysOf,
       applicableTiers } = mod);
});

describe('baseRegionFor', () => {
    it('picks the Vatican typical editions as the Roman base', () => {
        expect(baseRegionFor(CATALOGUE, 'roman')).toBe('VA');
    });

    it('treats a single-region rite as entirely base, with no per-rite constant needed', () => {
        // The Ambrosian marker is AMBROSIAN, not a nation code. Without this, the
        // rite's only missal is filtered out and the page renders empty.
        expect(baseRegionFor(AMBROSIAN, 'ambrosian')).toBe('AMBROSIAN');
    });

    it('returns null for an empty catalogue rather than throwing', () => {
        expect(baseRegionFor([], 'roman')).toBeNull();
    });
});

describe('applicableMissals', () => {
    it('gives the General Roman calendar only the typical editions, oldest first', () => {
        expect(applicableMissals(CATALOGUE, '', 'VA').map((m) => m.missal_id))
            .toEqual(['EDITIO_TYPICA_1970', 'EDITIO_TYPICA_2002']);
    });

    it('adds the national missal for its own region, still oldest first', () => {
        expect(applicableMissals(CATALOGUE, 'US', 'VA').map((m) => m.missal_id))
            .toEqual(['EDITIO_TYPICA_1970', 'EDITIO_TYPICA_2002', 'US_2011']);
    });

    it('does not leak one nation\'s missal into another\'s calendar', () => {
        expect(applicableMissals(CATALOGUE, 'IT', 'VA').map((m) => m.missal_id)).not.toContain('US_2011');
    });

    it('orders by year, not by catalogue order, since "later wins" depends on it', () => {
        // IT_1983 predates the 2002 typical edition and must compose before it.
        expect(applicableMissals(CATALOGUE, 'IT', 'VA').map((m) => m.year_published))
            .toEqual([1970, 1983, 2002]);
    });

    it('keeps the Ambrosian edition, whose region is the base rather than a nation', () => {
        const base = baseRegionFor(AMBROSIAN, 'ambrosian');
        expect(applicableMissals(AMBROSIAN, '', base).map((m) => m.missal_id))
            .toEqual(['EDITIO_TYPICA_2024']);
    });
});

describe('compose', () => {
    const base = { missal: VA_1970, rows: [
        { event_key: 'StIsidore',   month: 4, day: 4,  name: 'Isidore of Seville' },
        { event_key: 'StsBasilGreg', month: 1, day: 2, name: 'Basil and Gregory' }
    ] };

    it('flattens the layers and sorts by month then day', () => {
        const out = compose([base]);
        expect(out.map((r) => r.event_key)).toEqual(['StsBasilGreg', 'StIsidore']);
    });

    it('records which missal supplied each row', () => {
        expect(compose([base])[0]._missalId).toBe('EDITIO_TYPICA_1970');
    });

    it('lets a later missal override an earlier one on the same event_key', () => {
        const out = compose([
            base,
            { missal: US_2011, rows: [{ event_key: 'StIsidore', month: 5, day: 15, name: 'Isidore the Farmer' }] }
        ]);
        const isidore = out.find((r) => r.event_key === 'StIsidore');
        expect(isidore.name).toBe('Isidore the Farmer');
        expect(isidore.month).toBe(5);
        expect(isidore._missalId).toBe('US_2011');
    });

    it('flags an override with the layer it displaced, so the row is explicable', () => {
        const out = compose([
            base,
            { missal: US_2011, rows: [{ event_key: 'StIsidore', month: 5, day: 15 }] }
        ]);
        expect(out.find((r) => r.event_key === 'StIsidore')._overrides).toBe('EDITIO_TYPICA_1970');
    });

    it('leaves _overrides null for a row no earlier layer defined', () => {
        expect(compose([base]).every((r) => r._overrides === null)).toBe(true);
    });
});

describe('rowsFor', () => {
    const composed = [
        { event_key: 'A', month: 1, day: 5,  name: 'Agatha' },
        { event_key: 'B', month: 1, day: 2,  name: 'Basil' },
        { event_key: 'C', month: 3, day: 1,  name: 'Cecilia' }
    ];

    it('preserves the order it is given — compose() sorts, rowsFor() only filters', () => {
        // The fixture is deliberately NOT day-ordered (A is the 5th, B the 2nd), so
        // this pins the real contract instead of implying rowsFor sorts.
        expect(rowsFor(composed, 1, '').map((r) => r.event_key)).toEqual(['A', 'B']);
    });

    it('is day-ordered once its input has been through compose()', () => {
        const sorted = compose([{ missal: VA_1970, rows: composed }]);
        expect(rowsFor(sorted, 1, '').map((r) => r.event_key)).toEqual(['B', 'A']);
    });

    it('narrows by name or by event key, case-insensitively', () => {
        expect(rowsFor(composed, 1, 'basil').map((r) => r.event_key)).toEqual(['B']);
        expect(rowsFor(composed, 1, 'a').length).toBeGreaterThan(0);
    });
});

describe('monthsWithHits', () => {
    const composed = [
        { event_key: 'A', month: 1,  name: 'Agatha' },
        { event_key: 'B', month: 11, name: 'Basil' }
    ];

    it('finds hits in months the reader is not currently looking at', () => {
        // The whole point: tabs hide eleven twelfths of the data from the
        // browser's own find, so search has to reach across them.
        expect(monthsWithHits(composed, 'basil')).toEqual([11]);
    });

    it('returns nothing for an empty search rather than every month', () => {
        expect(monthsWithHits(composed, '   ')).toEqual([]);
    });
});

describe('renderReadingsOutcome', () => {
    const strings = {
        readings: 'Lectionary readings',
        noReadingsForEvent: 'No readings are curated for this celebration yet.',
        readingsUnavailable: 'Could not load the readings for this celebration.',
        noEntries: 'Nothing here.',
        noLectionary: 'No sanctorale lectionary is defined for this rite.',
        emptyLabel: 'blank',
        missingLabel: 'missing'
    };

    it('reports a 404 as "not curated yet", not as a failure', () => {
        // The API answers 404 both for an uncurated celebration and for a bad key.
        // Calling that "could not load" tells the reader the request broke when in
        // truth there is simply nothing there.
        const out = renderReadingsOutcome(
            { status: 'rejected', reason: new HttpError(404, '/lectionary/roman/sanctorale/X') },
            strings
        );
        expect(out).toContain(strings.noReadingsForEvent);
        expect(out).not.toContain(strings.readingsUnavailable);
    });

    it('still reports a real transport or server failure as unavailable', () => {
        expect(renderReadingsOutcome(
            { status: 'rejected', reason: new HttpError(500, '/x') }, strings
        )).toContain(strings.readingsUnavailable);

        expect(renderReadingsOutcome(
            { status: 'rejected', reason: new TypeError('network down') }, strings
        )).toContain(strings.readingsUnavailable);
    });

    it('renders the rite-level message when the rite has no lectionary at all', () => {
        const out = renderReadingsOutcome({
            status: 'fulfilled',
            value: { lectionary_available: false, message: 'No sanctorale lectionary data is defined for the ambrosian rite.' }
        }, strings);
        expect(out).toContain('ambrosian rite');
        expect(out).not.toContain(strings.readingsUnavailable);
    });
});

describe('localesFor', () => {
    const META = {
        locales: ['en', 'fr', 'it', 'la', 'nl'],
        ambrosian_calendars: [{ calendar_id: 'ambrosian', rite: 'ambrosian', locales: ['it', 'la'] }],
        national_calendars: [
            { calendar_id: 'US', locales: ['en_US'] },
            { calendar_id: 'IT', locales: ['it_IT'] },
            { calendar_id: 'CA', locales: ['en_CA', 'fr_CA'] }
        ]
    };

    it('offers the General Roman locales for the base Roman calendar', () => {
        expect(localesFor(META, 'roman', '')).toEqual(['en', 'fr', 'it', 'la', 'nl']);
    });

    it('offers only what a national calendar publishes, not the General Roman list', () => {
        // US_2011 exists in en_US alone; offering the five General Roman locales
        // would advertise translations that do not exist.
        expect(localesFor(META, 'roman', 'US')).toEqual(['en-US']);
        expect(localesFor(META, 'roman', 'CA')).toEqual(['en-CA', 'fr-CA']);
    });

    it('offers the Ambrosian locales for the Ambrosian rite, whatever the calendar', () => {
        expect(localesFor(META, 'ambrosian', '')).toEqual(['it', 'la']);
    });

    it('falls back to the General Roman list for a region with no national entry', () => {
        // Such a region still composes from the typical editions, so it has locales.
        expect(localesFor(META, 'roman', 'ZZ')).toEqual(['en', 'fr', 'it', 'la', 'nl']);
    });

    it('returns an empty list rather than throwing when metadata is missing', () => {
        expect(localesFor(null, 'roman', '')).toEqual([]);
    });

    it('normalises underscores, since Accept-Language and Intl want BCP-47', () => {
        expect(toBcp47('en_US')).toBe('en-US');
    });
});

describe('preferredLocale', () => {
    it('prefers the page locale when the calendar publishes it', () => {
        expect(preferredLocale(['en', 'fr', 'it'], 'fr')).toBe('fr');
    });

    it('settles for the same language in another region', () => {
        expect(preferredLocale(['en-US'], 'en-GB')).toBe('en-US');
        expect(preferredLocale(['en'], 'en_US')).toBe('en');
    });

    it('falls back to the first published locale when the page locale is absent', () => {
        expect(preferredLocale(['it', 'la'], 'de')).toBe('it');
    });

    it('returns empty for a calendar that publishes nothing', () => {
        expect(preferredLocale([], 'en')).toBe('');
    });
});

describe('filterByMissal', () => {
    const composed = [
        { event_key: 'A', month: 1, _missalId: 'EDITIO_TYPICA_1970' },
        { event_key: 'B', month: 1, _missalId: 'EDITIO_TYPICA_2002' },
        { event_key: 'C', month: 4, _missalId: 'EDITIO_TYPICA_2002' }
    ];

    it('narrows to one edition\'s contribution', () => {
        expect(filterByMissal(composed, 'EDITIO_TYPICA_2002').map((r) => r.event_key)).toEqual(['B', 'C']);
    });

    it('returns everything when no edition is selected', () => {
        expect(filterByMissal(composed, '')).toHaveLength(3);
    });

    it('counts an overridden celebration against the edition that won', () => {
        // US_2011 redefines StIsidore, so it belongs to US_2011 in the composed set,
        // not to the 1970 edition that first defined it.
        const out = compose([
            { missal: VA_1970, rows: [{ event_key: 'StIsidore', month: 4, day: 4 }] },
            { missal: US_2011, rows: [{ event_key: 'StIsidore', month: 5, day: 15 }] }
        ]);
        expect(filterByMissal(out, 'US_2011')).toHaveLength(1);
        expect(filterByMissal(out, 'EDITIO_TYPICA_1970')).toHaveLength(0);
    });

    it('leaves month grouping intact, so the tab counts follow the filter', () => {
        const jan = filterByMissal(composed, 'EDITIO_TYPICA_2002').filter((r) => r.month === 1);
        expect(jan).toHaveLength(1);
    });
});

describe('formatGrade', () => {
    const strings = {
        grades: {
            '0': 'Weekday', '1': 'Commemoration', '2': 'Optional memorial', '3': 'Memorial',
            '4': 'Feast', '5': 'Feast of the Lord', '6': 'Solemnity', '7': 'Higher solemnity'
        }
    };

    it('shows the rank as "number - name", not a bare integer', () => {
        expect(formatGrade({ grade: 3 }, strings)).toBe('3 - Memorial');
        expect(formatGrade({ grade: 6 }, strings)).toBe('6 - Solemnity');
    });

    it('keeps grade 0 rather than treating it as absent', () => {
        expect(formatGrade({ grade: 0 }, strings)).toBe('0 - Weekday');
    });

    it('reports the rank only, leaving any override to its own field', () => {
        expect(formatGrade({ grade: 3, grade_display: 'National Holiday' }, strings))
            .toBe('3 - Memorial');
    });

    it('falls back to the number alone for a rank it has no name for', () => {
        expect(formatGrade({ grade: 9 }, strings)).toBe('9');
    });
});

describe('gradeDisplayOf', () => {
    it('reports a labelled override', () => {
        expect(gradeDisplayOf({ grade: 3, grade_display: 'National Holiday' })).toBe('National Holiday');
    });

    it('reports an EMPTY override as \'\', not as absent', () => {
        // AllSouls is a Solemnity displayed without a rank, and CalendarHandler
        // writes '' for it explicitly. A HIGHER_SOLEMNITY is cleared the same way.
        // Collapsing this into "no override" discards an authored decision — and
        // once editing lands would write null back over a '' the curator meant.
        expect(gradeDisplayOf({ event_key: 'AllSouls', grade: 6, grade_display: '' })).toBe('');
        expect(gradeDisplayOf({ grade: 7, grade_display: '' })).toBe('');
    });

    it('reports null when there is genuinely no override', () => {
        expect(gradeDisplayOf({ grade: 3, grade_display: null })).toBeNull();
        expect(gradeDisplayOf({ grade: 3 })).toBeNull();
        expect(gradeDisplayOf(undefined)).toBeNull();
    });

    it('distinguishes the empty override from the absent one', () => {
        // The whole point: '' and null must not compare equal.
        expect(gradeDisplayOf({ grade_display: '' })).not.toBeNull();
        expect(gradeDisplayOf({})).toBeNull();
    });

    it('trims, and a whitespace-only value is a present override', () => {
        expect(gradeDisplayOf({ grade_display: '  National Holiday  ' })).toBe('National Holiday');
        expect(gradeDisplayOf({ grade_display: '   ' })).toBe('');
    });
});

describe('hasNestedSchemas', () => {
    const FLAT   = { first_reading: 'Eph 4:1-7', gospel: 'Mt 23:8-12' };
    const NESTED = { vigil: { first_reading: '1 Chr 15:3-4' }, day: { first_reading: 'Rev 11:19a' } };

    it('recognises the flat shape as not nested', () => {
        expect(hasNestedSchemas(FLAT)).toBe(false);
    });

    it('recognises alternative sets as nested', () => {
        expect(hasNestedSchemas(NESTED)).toBe(true);
        expect(hasNestedSchemas({ schema_one: {}, schema_two: {}, schema_three: {} })).toBe(true);
    });

    it('treats an empty entry as not nested, so it renders as a plain empty table', () => {
        expect(hasNestedSchemas({})).toBe(false);
        expect(hasNestedSchemas(undefined)).toBe(false);
    });

    it('does not mistake a null value for a nested object', () => {
        expect(hasNestedSchemas({ first_reading: null })).toBe(false);
    });
});

describe('schemaKeysOf', () => {
    it('orders keys liturgically, not alphabetically', () => {
        // Vigil precedes the Day Mass; alphabetical would put "day" first.
        expect(schemaKeysOf({ en: { day: {}, vigil: {} } })).toEqual(['vigil', 'day']);
    });

    it('orders the numbered schemata one, two, three', () => {
        expect(schemaKeysOf({ en: { schema_three: {}, schema_one: {}, schema_two: {} } }))
            .toEqual(['schema_one', 'schema_two', 'schema_three']);
    });

    it('unions across locales, so one locale missing a schema keeps its tab', () => {
        expect(schemaKeysOf({ en: { vigil: {}, day: {} }, la: { day: {} } })).toEqual(['vigil', 'day']);
    });

    it('keeps an unrecognised key rather than dropping it, after the known ones', () => {
        expect(schemaKeysOf({ en: { something_new: {}, vigil: {} } })).toEqual(['vigil', 'something_new']);
    });

    it('returns nothing for flat entries, which need no tabs at all', () => {
        expect(schemaKeysOf({ en: { first_reading: 'Eph 4:1-7' } })).toEqual([]);
        expect(schemaKeysOf({})).toEqual([]);
    });
});

/**
 * The two normalizations the editor applies between a stored row and the form
 * that edits it. Both exist because the form can express fewer states than the
 * data does, and both are invisible until a save writes something nobody asked
 * for — which is exactly why they are pinned here rather than left to the
 * browser pass that found them.
 */
describe('structureOf', () => {
    let structureOf, diffStructure;

    beforeAll(async () => {
        global.window = global.window ?? {};
        ({ structureOf } = await import('../sanctorale.js'));
        ({ diffStructure } = await import('../sanctorale-payload.js'));
    });

    // A US_2011 row as the API actually serves it: no `is_dominical`, no `is_bvm`.
    // The API writes those two only where the source data sets them.
    const ROW = Object.freeze({
        month: 5,
        day: 15,
        event_key: 'StIsidoreFarmer',
        grade: 2,
        grade_display: null,
        common: ['Holy Men and Women:For One Saint'],
        calendar: 'US',
        color: ['white'],
        name: 'Saint Isidore',
        _missalId: 'US_2011'
    });

    /** The same celebration as the Structure form reads it back, unedited. */
    const untouchedForm = (overrides = {}) => ({
        month: 5,
        day: 15,
        grade: 2,
        grade_display: null,
        common: ['Holy Men and Women:For One Saint'],
        color: ['white'],
        calendar: 'US',
        is_dominical: false,
        is_bvm: false,
        ...overrides
    });

    it('reads an absent flag back as false, since a checkbox has no third state', () => {
        expect(structureOf(ROW).is_dominical).toBe(false);
        expect(structureOf(ROW).is_bvm).toBe(false);
    });

    it('lets an untouched form diff to nothing', () => {
        // The whole reason the normalization exists. buildPatch() reports
        // "nothing changed" only when this map is empty.
        expect(diffStructure(structureOf(ROW), untouchedForm())).toEqual({});
    });

    it('is load-bearing: the raw row would diff as changed on a form nobody touched', () => {
        // diffStructure compares `original[field] ?? null` with `next[field] ?? null`,
        // and `false` is not nullish — so an absent flag reads as null and a
        // cleared checkbox reads as false, which are not equal. Without
        // structureOf() every PATCH would carry both of these.
        expect(diffStructure(ROW, untouchedForm())).toEqual({ is_dominical: false, is_bvm: false });
    });

    it('still reports a genuine true to false edit, which must never be swallowed', () => {
        const original = structureOf({ ...ROW, is_dominical: true });
        expect(original.is_dominical).toBe(true);
        expect(diffStructure(original, untouchedForm())).toEqual({ is_dominical: false });
    });

    it('keeps a set is_bvm set, rather than defaulting everything to false', () => {
        expect(structureOf({ ...ROW, is_bvm: true }).is_bvm).toBe(true);
        expect(diffStructure(structureOf({ ...ROW, is_bvm: true }), untouchedForm()))
            .toEqual({ is_bvm: false });
    });

    it('normalizes ONLY those two flags, so grade_display keeps all three states', () => {
        // Flattening any of these would write null over an authored decision —
        // the governing rule of sanctorale-payload.js.
        expect(structureOf({ ...ROW, grade_display: null }).grade_display).toBeNull();
        expect(structureOf({ ...ROW, grade_display: '' }).grade_display).toBe('');
        expect(structureOf({ ...ROW, grade_display: 'National Holiday' }).grade_display)
            .toBe('National Holiday');
    });

    it('does not invent a grade_display for a row that carries none', () => {
        const bare = { month: 1, day: 13, grade: 2 };
        expect(Object.prototype.hasOwnProperty.call(structureOf(bare), 'grade_display')).toBe(false);
    });

    it('accepts no row at all, which is what creating an entry passes', () => {
        expect(structureOf(undefined)).toEqual({ is_dominical: false, is_bvm: false });
    });

    it('leaves the composed row alone: state.composed must not gain invented flags', () => {
        const row = { month: 5, day: 15 };
        structureOf(row);
        expect(Object.prototype.hasOwnProperty.call(row, 'is_dominical')).toBe(false);
    });
});

describe('orderedSelection', () => {
    let orderedSelection;

    beforeAll(async () => {
        global.window = global.window ?? {};
        ({ orderedSelection } = await import('../sanctorale.js'));
    });

    // The option list is the LitCommon enum, whose order puts Doctors before
    // Pastors:For a Bishop. StHilaryPoitiers stores them the other way round.
    const OPTIONS = ['Proper', 'Doctors', 'Pastors:For a Bishop'];
    const STORED  = ['Pastors:For a Bishop', 'Doctors'];

    /** A real multi-select in the document, since orderedSelection reads the DOM. */
    const selectWith = (selected) => {
        document.body.innerHTML = '';
        const select = document.createElement('select');
        select.id = 'entryCommon';
        select.multiple = true;
        for (const value of OPTIONS) {
            const option = document.createElement('option');
            option.value = value;
            option.selected = selected.includes(value);
            select.appendChild(option);
        }
        document.body.appendChild(select);
        return select;
    };

    it('reports DOM order, which is why this function exists at all', () => {
        // Pinning the browser behaviour the rest of these tests are about:
        // selectedOptions follows the option list, never the stored array.
        const select = selectWith(STORED);
        expect([...select.selectedOptions].map((o) => o.value))
            .toEqual(['Doctors', 'Pastors:For a Bishop']);
    });

    it('keeps the row\'s own order for values it already had', () => {
        // Otherwise an untouched form diffs as changed, and a save silently
        // rewrites the corpus's order for no reason.
        selectWith(STORED);
        expect(orderedSelection('entryCommon', STORED)).toEqual(STORED);
    });

    it('appends a newly picked value rather than reordering the kept ones', () => {
        selectWith(['Proper', ...STORED]);
        expect(orderedSelection('entryCommon', STORED))
            .toEqual(['Pastors:For a Bishop', 'Doctors', 'Proper']);
    });

    it('drops a deselected value and leaves the rest in the stored order', () => {
        selectWith(['Doctors']);
        expect(orderedSelection('entryCommon', STORED)).toEqual(['Doctors']);
    });

    it('falls back to DOM order when there is no stored order to honour', () => {
        // A new celebration has none, and neither has a row whose field was empty.
        selectWith(STORED);
        expect(orderedSelection('entryCommon', [])).toEqual(['Doctors', 'Pastors:For a Bishop']);
        expect(orderedSelection('entryCommon', undefined)).toEqual(['Doctors', 'Pastors:For a Bishop']);
    });

    it('yields nothing when the control is absent, rather than throwing', () => {
        // The read-only modal renders no form controls at all.
        document.body.innerHTML = '';
        expect(orderedSelection('entryCommon', STORED)).toEqual([]);
    });
});

describe('applicableTiers', () => {
    // The real case from the brief: StPeterClaver is declared by EDITIO_TYPICA_2002,
    // US_2011 and IT_1983 alike. The lectionary route is rite-scoped, so a single
    // response can carry all three tiers no matter which calendar is open.
    const RITE_TIER = { tier: 'rite', source_id: 'sanctorum' };
    const TYPICA_TIER = { tier: 'missal', source_id: 'EDITIO_TYPICA_2002' };
    const US_TIER = { tier: 'missal', source_id: 'US_2011' };
    const IT_TIER = { tier: 'missal', source_id: 'IT_1983' };
    const ST_PETER_CLAVER_TIERS = [RITE_TIER, TYPICA_TIER, US_TIER, IT_TIER];

    it('keeps the rite tier regardless of the applicable set, even an empty one', () => {
        // The rite corpus applies to every calendar in the rite, so it survives
        // even when nothing else does.
        expect(applicableTiers([RITE_TIER], [])).toEqual([RITE_TIER]);
        expect(applicableTiers([RITE_TIER], new Set())).toEqual([RITE_TIER]);
    });

    it('keeps a missal tier whose source_id is applicable', () => {
        expect(applicableTiers([TYPICA_TIER], ['EDITIO_TYPICA_2002'])).toEqual([TYPICA_TIER]);
    });

    it('drops a missal tier whose source_id is not applicable — the General Roman case', () => {
        // Viewing the General Roman Calendar, only the typica's tier and the rite
        // corpus apply; neither national Missal's tier belongs here.
        const applicableIds = applicableMissals(CATALOGUE, '', 'VA').map((m) => m.missal_id);
        const out = applicableTiers(ST_PETER_CLAVER_TIERS, applicableIds);
        expect(out).toEqual([RITE_TIER, TYPICA_TIER]);
        expect(out).not.toContainEqual(US_TIER);
        expect(out).not.toContainEqual(IT_TIER);
    });

    it('narrows to the US calendar\'s own missal, still excluding IT_1983', () => {
        const applicableIds = applicableMissals(CATALOGUE, 'US', 'VA').map((m) => m.missal_id);
        const out = applicableTiers(ST_PETER_CLAVER_TIERS, applicableIds);
        expect(out).toEqual([RITE_TIER, TYPICA_TIER, US_TIER]);
        expect(out).not.toContainEqual(IT_TIER);
    });

    it('never filters out the write-target tier, since an editable row\'s Missal is applicable by construction', () => {
        // isReadingsWriteTarget() only ever selects the tier whose source_id equals
        // editState.missalId, and editState.missalId can only be a Missal
        // applicableMissals() already returned for the open calendar — so the
        // applicable set passed here always contains it.
        const writeTarget = { tier: 'missal', source_id: 'US_2011' };
        const applicableIds = applicableMissals(CATALOGUE, 'US', 'VA').map((m) => m.missal_id);
        expect(applicableIds).toContain('US_2011');
        expect(applicableTiers([writeTarget], applicableIds)).toContainEqual(writeTarget);
    });

    it('returns an empty result for an empty input rather than throwing', () => {
        expect(applicableTiers([], ['US_2011'])).toEqual([]);
        expect(applicableTiers(undefined, ['US_2011'])).toEqual([]);
    });

    it('represents "filtered to nothing" as [], leaving the empty case to the caller', () => {
        // A celebration whose only curated readings live in a Missal that does not
        // apply here must filter down to nothing — the function does not special
        // case that; deciding what to render for an empty list is the caller's job.
        expect(applicableTiers([US_TIER, IT_TIER], ['EDITIO_TYPICA_2002'])).toEqual([]);
    });
});
