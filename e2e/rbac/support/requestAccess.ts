import { expect, type Page } from '@playwright/test';

/**
 * Submit a pending access request by driving the real permission-requests.php UI
 * (the design's "real UI flow"). Pinned against assets/js/permission-requests.js
 * (verified 2026-06-22):
 *
 *   - Page: `/permission-requests.php`, form `#accessRequestForm`.
 *   - Role: radios `input[name="requested_role"]`; checking one reveals
 *     `#permissionsSection` and auto-adds one permission row when none exist.
 *   - Permission row: `#permissionRows .card`, with `.perm-object-type` (select),
 *     `.perm-object-id` (always a <select>), and `.perm-relation` (select). Set
 *     object-type FIRST so the object-id control is populated before we select from it.
 *   - Justification: `#justification` (optional). Submit: `#submitBtn`.
 *   - Success: `#formAlerts .alert-success`; the new pending request also appears in
 *     `#existingRequestsBody` as `tr[id^="request-"]`.
 *
 * Resubmit flow (for a rejected request):
 *   - The existing-requests table renders a `.resubmit-btn[data-request-id]` button
 *     only when status === 'rejected'.
 *   - Clicking it calls openResubmitForm() which pre-fills the form and switches
 *     #submitBtn to Resubmit mode.
 *   - Clicking #submitBtn then POSTs to /auth/access-requests/{id}/resubmit, which
 *     returns the SAME request to pending (does NOT add a new row).
 *   - Durable success signal: `.resubmit-btn` count drops to 0 (pending rows have no
 *     resubmit button).
 */
export interface AccessRequestOptions {
    requestedRole: string; // e.g. 'calendar_editor'
    permission: {
        objectType: 'national_calendar' | 'diocesan_calendar' | 'wider_region' | 'general_roman_calendar' | 'national_calendar_test' | 'diocesan_calendar_test' | 'general_roman_calendar_test';
        objectId: string;
        relation: 'admin' | 'editor' | 'viewer' | 'deleter';
    };
    justification?: string;
}

export async function submitAccessRequest(page: Page, opts: AccessRequestOptions): Promise<void> {
    await page.goto('/permission-requests.php');

    // Select the role; this reveals the permissions section and auto-adds the first row.
    await page.check(`input[name="requested_role"][value="${opts.requestedRole}"]`);

    const row = page.locator('#permissionRows .card').first();
    await expect(row).toBeVisible();

    // Object-type first — populates the object-id <select> options for this type.
    await row.locator('.perm-object-type').selectOption(opts.permission.objectType);

    const objectIdControl = row.locator('.perm-object-id');
    await objectIdControl.waitFor({ state: 'visible' });
    await objectIdControl.selectOption(opts.permission.objectId);

    await row.locator('.perm-relation').selectOption(opts.permission.relation);

    if (opts.justification) {
        await page.fill('#justification', opts.justification);
    }

    // Wait for the initial request-list load to settle (the body shows a spinner until
    // loadExistingRequests() renders the table or the empty state) so the count below
    // reflects the rendered list, not the pre-fetch state — otherwise a user with an
    // existing request could read a stale rowsBefore and flake the post-submit assertion.
    await expect(page.locator('#existingRequestsBody .fa-spinner')).toHaveCount(0);

    // Capture the current request count, then submit and wait for the new pending request to
    // appear in the user's list. Success is durable here; the green toast is animated and is
    // cleared by the form reset that runs on success, so it's an unreliable signal.
    const requestRows = page.locator('#existingRequestsBody tr[id^="request-"]');
    const rowsBefore = await requestRows.count();
    await page.click('#submitBtn');
    await expect(requestRows).toHaveCount(rowsBefore + 1);
}

/**
 * Resubmit the user's single rejected access request via the real UI flow on
 * permission-requests.php. Navigates fresh, clicks the `.resubmit-btn`, then
 * clicks `#submitBtn` (now in Resubmit mode). Waits for the row's status to
 * return to pending (durable: `.resubmit-btn` disappears because only rejected
 * rows carry it).
 *
 * Precondition: exactly one rejected request exists for this user (no pending
 * requests). If the user has no rejected request the helper will throw with a
 * meaningful Playwright assertion error.
 */
export async function resubmitAccessRequest(page: Page): Promise<void> {
    await page.goto('/permission-requests.php');

    // Wait for the existing-requests list to finish loading.
    await expect(page.locator('#existingRequestsBody .fa-spinner')).toHaveCount(0);

    // Click the resubmit button on the rejected row.
    const resubmitBtn = page.locator('#existingRequestsBody .resubmit-btn').first();
    await expect(resubmitBtn).toBeVisible();
    await resubmitBtn.click();

    // The form is now in resubmit mode; #submitBtn label changed to "Resubmit".
    // Click it to POST /auth/access-requests/{id}/resubmit.
    await page.click('#submitBtn');

    // Durable success: the resubmit button disappears (the row is now pending, not rejected).
    await expect(page.locator('#existingRequestsBody .resubmit-btn')).toHaveCount(0);
}
