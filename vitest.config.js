import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            // In the browser this resolves via the import map in
            // layout/footer.php (a build artifact not present in this
            // checkout). Modules under test import it directly (admin-tests.js,
            // admin-permissions.js, permission-requests.js), so tests need
            // something on disk for Vite to resolve — see the stub's own
            // header comment for why its exports are inert stand-ins.
            // fileURLToPath, not URL.pathname: the latter percent-encodes spaces
            // and keeps the leading slash on Windows drive letters, so a checkout
            // under such a path would fail to resolve.
            '@liturgical-calendar/components-js': fileURLToPath(
                new URL('./assets/js/__tests__/stubs/components-js.js', import.meta.url)
            ),
        },
    },
    test: {
        environment: 'jsdom',
        include: ['assets/js/__tests__/**/*.test.js'],
        globals: true,
    },
});
