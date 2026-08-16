import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            // `@liturgical-calendar/components-js` is not an npm dependency
            // (it's wired in at runtime via the browser importmap — see
            // layout/footer.php); alias it to a minimal test stub so files
            // that import it (admin-tests.js, admin-permissions.js,
            // permission-requests.js) can be unit tested directly. See the
            // stub's own doc comment for details.
            '@liturgical-calendar/components-js': fileURLToPath(
                new URL('./assets/js/__tests__/__mocks__/liturgical-calendar-components-js.js', import.meta.url),
            ),
        },
    },
    test: {
        environment: 'jsdom',
        include: ['assets/js/__tests__/**/*.test.js'],
        globals: true,
    },
});
