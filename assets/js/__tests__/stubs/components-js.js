/**
 * Test-only stand-in for `@liturgical-calendar/components-js`.
 *
 * In the browser this package resolves via the import map footer.php emits
 * (`./assets/components-js/index.js`, a build artifact not present in this
 * checkout — see layout/footer.php). Under vitest there is nothing on disk
 * for Vite to resolve, so vitest.config.js aliases the bare specifier to
 * this file for every test. It exists purely so modules that import the
 * package (admin-tests.js, admin-permissions.js, permission-requests.js)
 * can be loaded in jsdom; none of the exports here need real behavior
 * beyond "chainable and inert" unless a specific test exercises them.
 */
import { vi } from 'vitest';

class ChainableStub {
    // The real components expose the mounted element as `_domElement`, and
    // permission-requests.js and admin-permissions.js both attach a `change`
    // listener to a RiteSelect's. Without an inert stand-in here, any test that
    // reaches those rite-linked paths dies on `addEventListener` of undefined
    // rather than on whatever it was actually asserting. appendTo() is a no-op,
    // so this stays available afterwards.
    _domElement = { addEventListener() {} };

    filter() { return this; }
    allowNull() { return this; }
    class() { return this; }
    id() { return this; }
    name() { return this; }
    label() { return this; }
    wrapper() { return this; }
    after() { return this; }
    disabled() { return this; }
    linkToRiteSelect() { return this; }
    linkToNationsSelect() { return this; }
    appendTo() {}
}

export class CalendarSelect extends ChainableStub {}
export class RiteSelect extends ChainableStub {}
export class WebCalendar extends ChainableStub {}

export const CalendarSelectFilter = Object.freeze({
    NATIONAL_CALENDARS: 'nationalCalendars',
    DIOCESAN_CALENDARS: 'diocesanCalendars',
    ALL_CALENDARS: 'allCalendars',
});

export const ApiClient = {
    init: vi.fn(() => Promise.resolve(null)),
};

// Mirrors liturgy-components-js/src/Enums.js exactly. Unlike the classes above,
// this one carries real values: admin-tests.js reads Rite.ROMAN as the default
// rite for a scope that names none, and puts it in the request path and the
// `applies_to.rite` payload — an inert stand-in would silently change what the
// tests assert.
export const Rite = Object.freeze({
    ROMAN: 'roman',
    AMBROSIAN: 'ambrosian',
});

/**
 * Like `Rite` above, this one carries REAL values rather than inert stand-ins.
 *
 * sanctorale.js reads `massLabels`' keys as its schema render order and
 * `readingOrder` as the field order of a readings form, so an empty stand-in
 * would not merely fail to exercise the code — it would let the ordering tests
 * pass against nothing. Mirrors liturgy-components-js/src/ReadingsRenderer, and
 * `readings-renderer-stub.test.js` asserts the mirror against the real package
 * whenever a build of it is present, so this copy cannot drift unnoticed.
 */
export class ReadingsRenderer {
    static readingLabels = Object.freeze({
        first_reading: 'First Reading',
        responsorial_psalm: 'Responsorial Psalm',
        second_reading: 'Second Reading',
        gospel_acclamation: 'Gospel Acclamation',
        gospel: 'Gospel',
        palm_gospel: 'Gospel at the Procession',
        epistle: 'Epistle',
        responsorial_psalm_2: 'Responsorial Psalm',
        third_reading: 'Third Reading',
        responsorial_psalm_3: 'Responsorial Psalm',
        fourth_reading: 'Fourth Reading',
        responsorial_psalm_4: 'Responsorial Psalm',
        fifth_reading: 'Fifth Reading',
        responsorial_psalm_5: 'Responsorial Psalm',
        sixth_reading: 'Sixth Reading',
        responsorial_psalm_6: 'Responsorial Psalm',
        seventh_reading: 'Seventh Reading',
        responsorial_psalm_7: 'Responsorial Psalm',
        responsorial_psalm_epistle: 'Responsorial Psalm',
    });

    static massLabels = Object.freeze({
        vigil: 'Vigil Mass',
        night: 'Mass during the Night',
        dawn: 'Mass at Dawn',
        day: 'Mass during the Day',
        evening: 'Evening Mass',
        schema_one: 'Schema I',
        schema_two: 'Schema II',
        schema_three: 'Schema III',
        easter_season: 'Easter Season',
        outside_easter_season: 'Outside Easter Season',
    });

    static readingOrder = Object.freeze([
        'palm_gospel',
        'first_reading',
        'responsorial_psalm',
        'second_reading',
        'responsorial_psalm_2',
        'third_reading',
        'responsorial_psalm_3',
        'fourth_reading',
        'responsorial_psalm_4',
        'fifth_reading',
        'responsorial_psalm_5',
        'sixth_reading',
        'responsorial_psalm_6',
        'seventh_reading',
        'responsorial_psalm_7',
        'epistle',
        'responsorial_psalm_epistle',
        'gospel_acclamation',
        'gospel',
    ]);

    static hasNestedSchemas(readings) {
        const values = Object.values(readings ?? {});
        return values.length > 0 && values.every((v) => v !== null && typeof v === 'object');
    }
}
