/**
 * Sanctorale composition.
 *
 * The layering rules are where this page's subtlety lives, so they are pure
 * functions in their own right and pinned here: a missal file is a delta, later
 * editions win, and every row must remember which layer supplied it.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let applicableMissals, compose, rowsFor, monthsWithHits;

const VA_1970 = { missal_id: 'EDITIO_TYPICA_1970', region: 'VA', year_published: 1970 };
const VA_2002 = { missal_id: 'EDITIO_TYPICA_2002', region: 'VA', year_published: 2002 };
const US_2011 = { missal_id: 'US_2011',            region: 'US', year_published: 2011 };
const IT_1983 = { missal_id: 'IT_1983',            region: 'IT', year_published: 1983 };
const CATALOGUE = [VA_2002, US_2011, VA_1970, IT_1983];

beforeAll(async () => {
    global.window = global.window ?? {};
    const mod = await import('../sanctorale.js');
    ({ applicableMissals, compose, rowsFor, monthsWithHits } = mod);
});

describe('applicableMissals', () => {
    it('gives the General Roman calendar only the typical editions, oldest first', () => {
        expect(applicableMissals(CATALOGUE, '').map((m) => m.missal_id))
            .toEqual(['EDITIO_TYPICA_1970', 'EDITIO_TYPICA_2002']);
    });

    it('adds the national missal for its own region, still oldest first', () => {
        expect(applicableMissals(CATALOGUE, 'US').map((m) => m.missal_id))
            .toEqual(['EDITIO_TYPICA_1970', 'EDITIO_TYPICA_2002', 'US_2011']);
    });

    it('does not leak one nation\'s missal into another\'s calendar', () => {
        expect(applicableMissals(CATALOGUE, 'IT').map((m) => m.missal_id)).not.toContain('US_2011');
    });

    it('orders by year, not by catalogue order, since "later wins" depends on it', () => {
        // IT_1983 predates the 2002 typical edition and must compose before it.
        expect(applicableMissals(CATALOGUE, 'IT').map((m) => m.year_published))
            .toEqual([1970, 1983, 2002]);
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

    it('returns one month, day-ordered by way of compose\'s sort', () => {
        expect(rowsFor(composed, 1, '').map((r) => r.event_key)).toEqual(['A', 'B']);
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
