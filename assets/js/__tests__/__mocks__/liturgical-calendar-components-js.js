/**
 * Test-only stand-in for `@liturgical-calendar/components-js`.
 *
 * The real package is not an npm dependency of this project — it is wired in
 * at runtime via the browser importmap (see layout/footer.php and CLAUDE.md's
 * "Component Library Methods" section), pinned to a CDN build in production
 * or a vendored `assets/components-js/` copy in development. Vite/Vitest's
 * static import analysis can't resolve a bare specifier with no matching
 * npm package or node_modules entry, so vitest.config.js aliases it to this
 * file for every test file, letting admin-tests.js (and any sibling admin
 * page that imports the same package) be imported directly in a test without
 * a full browser/CDN environment.
 *
 * Exports only the names admin-tests.js actually imports, and only the
 * members those names' call sites in admin-tests.js's DOMContentLoaded
 * closure exercise (none, for the exported top-level helpers this stub
 * exists for). `Rite`'s values mirror the real
 * `liturgy-components-js/src/Enums.js` exactly (`ROMAN: 'roman'`,
 * `AMBROSIAN: 'ambrosian'`) since admin-tests.js's rite logic depends on them.
 */
export const Rite = Object.freeze({
    ROMAN: 'roman',
    AMBROSIAN: 'ambrosian',
});

export class ApiClient {
    static init() {
        return Promise.reject(new Error('ApiClient.init() is not implemented in the components-js test stub'));
    }
}

export class CalendarSelect {}

export const CalendarSelectFilter = Object.freeze({
    NATIONAL_CALENDARS: 'nations',
    DIOCESAN_CALENDARS: 'dioceses',
});

export class RiteSelect {}
