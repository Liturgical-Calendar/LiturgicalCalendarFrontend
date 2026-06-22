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
 *     `.perm-object-id` (text input — but swapped to a <select> when object-type is
 *     `general_roman_calendar`), and `.perm-relation` (select). Set object-type FIRST
 *     so the object-id control is in its final form before we fill it.
 *   - Justification: `#justification` (optional). Submit: `#submitBtn`.
 *   - Success: `#formAlerts .alert-success`; the new pending request also appears in
 *     `#existingRequestsBody` as `tr[id^="request-"]`.
 */
export interface AccessRequestOptions {
    requestedRole: string; // e.g. 'calendar_editor'
    permission: {
        objectType: 'national_calendar' | 'diocesan_calendar' | 'wider_region' | 'general_roman_calendar';
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

    // Object-type first — for GRC this swaps .perm-object-id from <input> to <select>.
    await row.locator('.perm-object-type').selectOption(opts.permission.objectType);

    const idField = row.locator('.perm-object-id');
    if (opts.permission.objectType === 'general_roman_calendar') {
        await idField.selectOption(opts.permission.objectId);
    } else {
        await idField.fill(opts.permission.objectId);
    }

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
