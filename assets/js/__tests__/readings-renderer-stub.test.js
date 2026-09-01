/**
 * The vitest stub for `@liturgical-calendar/components-js` carries REAL
 * `ReadingsRenderer` statics, because sanctorale.js reads them as its schema
 * render order, its reading-field order and its label vocabulary — an inert
 * stand-in would let those tests pass against nothing.
 *
 * Real values in a stub are a copy, and a copy drifts. That is precisely the
 * failure liturgy-components-js#97 was filed about and which frontend #525
 * removed from the PRODUCTION path: sanctorale.js now imports the renderer
 * instead of restating it. This suite keeps the remaining test-only copy honest.
 *
 * It compares against a real build when one is on disk — the `assets/components-js`
 * symlink a development checkout has (see CLAUDE.md, "Using Local
 * liturgy-components-js Library"). CI has no such build, so there the suite skips
 * rather than fails: a missing sibling checkout is not a regression, and failing
 * on it would make the whole suite depend on a symlink that is deliberately
 * gitignored.
 */
import { describe, expect, it } from 'vitest';
import { ReadingsRenderer as Stub } from './stubs/components-js.js';

const real = await (async () => {
    try {
        return (await import('../../components-js/index.js')).ReadingsRenderer;
    } catch {
        return null;
    }
})();

describe.skipIf(!real)('the ReadingsRenderer stub mirrors the real package', () => {
    it('has the same reading labels, in the same order', () => {
        expect(Object.entries(Stub.readingLabels)).toEqual(Object.entries(real.readingLabels));
    });

    it('has the same mass labels, in the same order', () => {
        // Order matters beyond equality: sanctorale.js takes SCHEMA_ORDER from
        // these keys, and the library derives its own nested-schema keys the same
        // way, so a reordering here silently reorders the page's schema tabs.
        expect(Object.entries(Stub.massLabels)).toEqual(Object.entries(real.massLabels));
    });

    it('has the same reading order', () => {
        expect([...Stub.readingOrder]).toEqual([...real.readingOrder]);
    });

    it('agrees on which entries are nested', () => {
        const cases = [
            {},
            { first_reading: 'Gn 1:1' },
            { vigil: { first_reading: 'Gn 1:1' }, day: { first_reading: 'Ex 1:1' } },
            { schema_one: {}, schema_two: {}, schema_three: {} },
        ];
        for (const entry of cases) {
            expect(Stub.hasNestedSchemas(entry)).toBe(real.hasNestedSchemas(entry));
        }
    });
});
