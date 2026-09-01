/**
 * Stands in for a real `liturgy-components-js` build when none is on disk.
 *
 * `vitest.config.js` aliases `@components-js-real` here whenever the gitignored
 * `assets/components-js` symlink does not resolve — which is every CI run, since
 * that symlink points at a sibling checkout CI does not have. Exporting `null`
 * lets `readings-renderer-stub.test.js` SKIP its drift comparison rather than
 * fail to build: a missing sibling checkout is not a regression.
 *
 * The decision is made in the config, not in the test, because Vite resolves
 * `import()` specifiers at TRANSFORM time — a dynamic import guarded by
 * try/catch or `existsSync` inside the test still fails the whole suite when the
 * path does not resolve, since that failure is not a runtime error.
 */
export const ReadingsRenderer = null;
