/**
 * Redeclaration relationships (frontend #524).
 *
 * The page could say THAT one Missal overrode another and name the loser, but
 * nothing about what changed or why — because `compose()` kept only
 * `_overrides: <missalId>` and threw the superseded ROW away. So the two worked
 * examples in the issue, which are different acts, rendered identically:
 *
 * - `US_2011` redeclares `StPeterClaver` to raise the rank from optional memorial
 *   to memorial, and changes nothing else.
 * - `IT_1983` declared him because he was not in the 1970 General Roman Calendar;
 *   the 2002 typica then took him universal at the same rank, leaving the Italian
 *   entry redundant.
 *
 * Both examples are reproduced here with their real grades and dates.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let compose, describeRedeclaration, redeclarationSteps;

beforeAll(async () => {
    global.window = global.window ?? {};
    ({ compose, describeRedeclaration, redeclarationSteps } = await import('../sanctorale.js'));
});

const VA_1970 = { missal_id: 'EDITIO_TYPICA_1970', region: 'VA', year_published: 1970 };
const VA_2002 = { missal_id: 'EDITIO_TYPICA_2002', region: 'VA', year_published: 2002 };
const US_2011 = { missal_id: 'US_2011',            region: 'US', year_published: 2011 };
const IT_1983 = { missal_id: 'IT_1983',            region: 'IT', year_published: 1983 };

// StPeterClaver: 9 September, white, same common everywhere. Only the grade moves.
const claver = (grade) => ({
    event_key: 'StPeterClaver', month: 9, day: 9, grade,
    color: ['white'], common: ['Holy Men and Women:For Religious']
});

describe('compose retains the superseded declarations', () => {
    it('keeps the whole chain, oldest first, with each layer\'s own row', () => {
        // The structural blocker #524 names: without the superseded ROW there is
        // nothing to compare, so nothing can be said about what changed.
        const [row] = compose([
            { missal: VA_2002, rows: [claver(2)] },
            { missal: US_2011, rows: [claver(3)] }
        ]);
        expect(row._declaredBy.map((d) => d.missalId)).toEqual(['EDITIO_TYPICA_2002', 'US_2011']);
        expect(row._declaredBy[0].row.grade).toBe(2);
        expect(row._declaredBy[1].row.grade).toBe(3);
    });

    it('records more than one step, which `_overrides` alone cannot', () => {
        // `_overrides` names only the immediately preceding layer, so a key
        // declared three times reports one relationship and hides the other.
        const [row] = compose([
            { missal: VA_1970, rows: [claver(2)] },
            { missal: VA_2002, rows: [claver(2)] },
            { missal: US_2011, rows: [claver(3)] }
        ]);
        expect(row._overrides).toBe('EDITIO_TYPICA_2002');
        expect(row._declaredBy).toHaveLength(3);
    });

    it('leaves the winning row and `_overrides` exactly as before', () => {
        const [row] = compose([
            { missal: VA_2002, rows: [claver(2)] },
            { missal: US_2011, rows: [claver(3)] }
        ]);
        expect(row.grade).toBe(3);
        expect(row._missalId).toBe('US_2011');
        expect(row._overrides).toBe('EDITIO_TYPICA_2002');
    });

    it('gives a singly-declared celebration a one-entry chain and no steps', () => {
        // Which is almost every celebration, and is why the panel renders nothing
        // rather than an empty section saying "declared once".
        const [row] = compose([{ missal: VA_2002, rows: [claver(2)] }]);
        expect(row._declaredBy).toHaveLength(1);
        expect(row._overrides).toBeNull();
        expect(redeclarationSteps(row, 'VA')).toEqual([]);
    });

    it('does not nest a chain inside a chain', () => {
        // The chain holds the layers' own rows, not composed ones; if it held
        // composed rows each would carry the chain so far and the structure would
        // grow quadratically down a long one.
        const [row] = compose([
            { missal: VA_1970, rows: [claver(2)] },
            { missal: VA_2002, rows: [claver(2)] }
        ]);
        expect(row._declaredBy[1].row._declaredBy).toBeUndefined();
    });
});

describe('describeRedeclaration', () => {
    const decl = (missal, row) => ({
        missalId: missal.missal_id, missalYear: missal.year_published,
        missalRegion: missal.region, row
    });

    it('names the property a later edition changed — the US_2011 example', () => {
        // "So US_2011 exists to raise the rank from optional to obligatory
        // memorial, and nothing else."
        const result = describeRedeclaration(
            decl(VA_2002, claver(2)), decl(US_2011, claver(3)), 'VA'
        );
        expect(result.kind).toBe('property');
        expect(result.changes).toEqual([{ field: 'grade', from: 2, to: 3 }]);
    });

    it('calls a typica taking a particular celebration universal what it is — the IT_1983 example', () => {
        // Nothing changed, but "nothing changed" is the wrong answer: the fact is
        // that a local memorial became universal and the Italian entry is now
        // redundant. Distinguishing this from a plain no-op is the second half of
        // what #524 asks for.
        const result = describeRedeclaration(
            decl(IT_1983, claver(2)), decl(VA_2002, claver(2)), 'VA'
        );
        expect(result.kind).toBe('universal');
        expect(result.changes).toEqual([]);
    });

    it('does not call it universal when the later edition is also particular', () => {
        const result = describeRedeclaration(
            decl(IT_1983, claver(2)), decl(US_2011, claver(2)), 'VA'
        );
        expect(result.kind).toBe('none');
    });

    it('does not call it universal when the earlier edition was already universal', () => {
        // Typica to typica with no change is a genuine no-op, not a promotion.
        const result = describeRedeclaration(
            decl(VA_1970, claver(2)), decl(VA_2002, claver(2)), 'VA'
        );
        expect(result.kind).toBe('none');
    });

    it('reports a date move', () => {
        const moved = { ...claver(2), month: 9, day: 10 };
        const result = describeRedeclaration(decl(VA_2002, claver(2)), decl(US_2011, moved), 'VA');
        expect(result.changes).toEqual([{ field: 'date', from: '9-9', to: '9-10' }]);
    });

    it('reports colour and common changes, and treats a reordering as a change', () => {
        // Order is meaningful in the corpus and diffStructure() compares element
        // by element, so a reorder really is a change rather than a false one.
        const a = { ...claver(2), common: ['Martyrs', 'Pastors'] };
        const b = { ...claver(2), common: ['Pastors', 'Martyrs'] };
        const result = describeRedeclaration(decl(VA_2002, a), decl(US_2011, b), 'VA');
        expect(result.changes.map((c) => c.field)).toEqual(['common']);
    });

    it('tells an authored empty grade_display from an absent one', () => {
        // An override of '' says the rank is deliberately not displayed; absent
        // means no override at all. Collapsing the two would hide a real edit.
        const withOverride = { ...claver(2), grade_display: '' };
        const result = describeRedeclaration(
            decl(VA_2002, claver(2)), decl(US_2011, withOverride), 'VA'
        );
        expect(result.changes).toEqual([{ field: 'grade_display', from: null, to: '' }]);
    });

    it('reports every changed field, not just the first', () => {
        const changed = { ...claver(3), month: 9, day: 10, color: ['red'] };
        const result = describeRedeclaration(decl(VA_2002, claver(2)), decl(US_2011, changed), 'VA');
        expect(result.changes.map((c) => c.field)).toEqual(['date', 'grade', 'color']);
    });
});

describe('redeclarationSteps', () => {
    it('pairs the chain consecutively, oldest first', () => {
        const [row] = compose([
            { missal: IT_1983, rows: [claver(2)] },
            { missal: VA_2002, rows: [claver(2)] },
            { missal: US_2011, rows: [claver(3)] }
        ]);
        const steps = redeclarationSteps(row, 'VA');
        expect(steps.map((s) => [s.previous.missalId, s.next.missalId, s.kind])).toEqual([
            ['IT_1983', 'EDITIO_TYPICA_2002', 'universal'],
            ['EDITIO_TYPICA_2002', 'US_2011', 'property']
        ]);
    });

    it('shows only the declarations that apply to the chosen calendar', () => {
        // compose() is fed applicableMissals()' layers, so viewing the US calendar
        // never sees IT_1983 at all — the same narrowing PR #523 gave the readings
        // tiers, which is point 1 of the issue.
        const [row] = compose([
            { missal: VA_2002, rows: [claver(2)] },
            { missal: US_2011, rows: [claver(3)] }
        ]);
        expect(redeclarationSteps(row, 'VA').map((s) => s.previous.missalId))
            .toEqual(['EDITIO_TYPICA_2002']);
    });

    it('survives a row with no chain at all', () => {
        expect(redeclarationSteps(undefined, 'VA')).toEqual([]);
        expect(redeclarationSteps({}, 'VA')).toEqual([]);
    });
});
