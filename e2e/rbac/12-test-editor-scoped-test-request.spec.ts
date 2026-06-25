import { test } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { submitAccessRequest } from './support/requestAccess';
import { truncateAppTables, settleCleanup } from './support/cleanup';

/**
 * Scenario 12 — test_editor scoped to national_calendar_test:IT
 *
 * Proves the new calendar-scoped TEST object types are accepted end-to-end through the real UI:
 *   - Selecting the test_editor role reveals the permissions section.
 *   - Choosing "national_calendar_test" as the object type mounts a CalendarSelect.
 *   - Selecting "IT" from that select and submitting results in a new pending request row.
 *
 * Requester: grc-editor (editor@general_roman_calendar:temporale).
 * Seeded by rbac-setup; .auth/grc-editor.json exists.
 * No approval step — submit + visible in #existingRequestsBody is sufficient.
 *
 * Preconditions (seeded by rbac-setup):
 *   - grc-editor: Zitadel calendar_editor role, FGA editor@general_roman_calendar:temporale
 */

test('12 — test_editor request scoped to national_calendar_test:IT is accepted and visible', async ({ browser }) => {
    // grc-editor submits a test_editor request for national_calendar_test:IT.
    // submitAccessRequest asserts the new pending row appears in #existingRequestsBody.
    const grced = await actingAs(browser, 'grc-editor');
    try {
        await submitAccessRequest(grced.page, {
            requestedRole: 'test_editor',
            permission: {
                objectType: 'national_calendar_test',
                objectId: 'IT',
                relation: 'editor',
            },
            justification: 'Testing national calendar test data for IT locale',
        });
    } finally {
        await grced.context.close();
    }
});

test.afterEach(async () => {
    // Remove the pending request row so the spec is re-runnable from a clean slate.
    // No FGA tuples to revoke (no approval step in this scenario).
    await settleCleanup('scenario 12 afterEach', [
        truncateAppTables(),
    ]);
});
