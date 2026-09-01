/**
 * Sanctorale composition.
 *
 * The layering rules are where this page's subtlety lives, so they are pure
 * functions in their own right and pinned here: a missal file is a delta, later
 * editions win, and every row must remember which layer supplied it.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let applicableMissals, baseRegionFor, compose, rowsFor, monthsWithHits, renderReadingsOutcome, HttpError;

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
       renderReadingsOutcome, HttpError } = mod);
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
