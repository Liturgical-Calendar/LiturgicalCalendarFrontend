/**
 * The change request review page: the renderers the admin module factory calls
 * with the module it builds as `this`.
 *
 * createAdminModule() copies only the options it knows onto that module, so a
 * helper declared among the options was unreachable: opening a review threw
 * `this.renderPullRequestLink is not a function`, and rendering any decided
 * batch `this.renderOutcome is not a function`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (file) => readFileSync(resolve(process.cwd(), `assets/js/${file}`), 'utf8');

function loadAdminChanges() {
    window.AdminChangesConfig = {
        repoUrl: 'https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI',
        locale: 'en',
        i18n: {
            submitted: 'Submitted', publication: 'Publication', pullRequest: 'Pull request',
            proposedChanges: 'Proposed changes', loading: 'Loading', approvedThenClosed: 'Approved, then closed',
            publicationStatuses: {}, statuses: {}, unknownUser: 'Unknown user', files: 'Files'
        }
    };
    // The factory keeps renderModalDetails to itself and calls it with the module as `this`
    // (`renderModalDetails.call(this, item)`); capture the options to make the same call.
    return new Function(
        `${read('change-request-common.js')}\n${read('admin-module-base.js')}\n`
        + 'const __factory = createAdminModule; let __options = null;\n'
        + 'createAdminModule = (options) => { __options = options; return __factory(options); };\n'
        + `${read('admin-changes.js')}\nreturn { AdminChanges, options: __options };`
    )();
}

const batch = (overrides = {}) => ({
    batch_id: '99999999-8888-7777-6666-555555555555',
    resource_type: 'wider_region',
    resource_id: 'Americas',
    review_status: 'submitted',
    review_decision: null,
    publication_status: 'unpublished',
    submitted_by_name: "John D'Orazio",
    submitted_by_email: 'john@example.test',
    file_count: 27,
    pr_number: null,
    rejected_reason: null,
    created_at: '2026-09-27T18:00:00+00:00',
    ...overrides
});

describe('admin change request renderers', () => {
    it('opens a review without throwing, linking a published batch to its pull request', () => {
        const { AdminChanges, options } = loadAdminChanges();
        const html = options.renderModalDetails.call(AdminChanges, batch({ pr_number: 42 }));

        expect(html).toContain('https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/pull/42');
    });

    it('opens a review of an unpublished batch without a pull request row', () => {
        const { AdminChanges, options } = loadAdminChanges();

        expect(() => options.renderModalDetails.call(AdminChanges, batch())).not.toThrow();
    });

    it('renders a decided batch with its outcome and reason', () => {
        const { AdminChanges, options } = loadAdminChanges();
        const html = options.renderTableRow.call(AdminChanges, batch({ review_status: 'rejected', rejected_reason: 'Missing names.' }), 'rejected');

        expect(html).toContain('Missing names.');
    });
});
