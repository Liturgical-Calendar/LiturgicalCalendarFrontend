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
