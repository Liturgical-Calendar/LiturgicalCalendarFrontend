import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// A real build of liturgy-components-js, present only in a development checkout
// that has made the gitignored `assets/components-js` symlink (see CLAUDE.md).
// `readings-renderer-stub.test.js` compares the test stub against it to keep the
// stub's real-valued ReadingsRenderer statics from drifting, and skips when it is
// absent — which is every CI run. Resolved HERE rather than in the test because
// Vite resolves import specifiers at transform time, so a dynamic import guarded
// inside the test fails the suite before any guard can run.
const realComponentsJs = fileURLToPath(new URL('./assets/components-js/index.js', import.meta.url));
const absentComponentsJs = fileURLToPath(
    new URL('./assets/js/__tests__/stubs/components-js-absent.js', import.meta.url)
);

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
            '@components-js-real': existsSync(realComponentsJs) ? realComponentsJs : absentComponentsJs,
        },
    },
    test: {
        environment: 'jsdom',
        include: ['assets/js/__tests__/**/*.test.js'],
        globals: true,
    },
});
