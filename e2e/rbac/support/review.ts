import { expect, type Locator, type Page } from '@playwright/test';

/*
 * Selector reference (pinned against admin-permissions.php + assets/js/admin-permissions.js,
 * verified 2026-06-22):
 *
 * URL: /admin-permissions.php
 *
 * ── Access Requests list ─────────────────────────────────────────────────────
 * Status tabs:     #permRequestStatusTabs  →  buttons #permReq-{status}-tab
 *                  (admin-permissions.php line 157, 164, 169, 175)
 * List containers: #permReq{Status}Body   e.g. #permReqPendingBody
 *                  (admin-permissions.php lines 187, 194, 201, 208)
 *   Loading spinner present while fetching: .fa-spinner inside the container
 *                  (admin-permissions.js loadAccessRequests(), line 596-603)
 * Per-row:         tr  (inside table rendered by renderAccessReqList, line 722)
 *   Email cell:    td > small.text-muted   (renderAccessReqUserCell, line 677)
 *   Review button: .permReq-review-btn     (renderAccessReqRow, line 710)
 *                  data-permreq-id  = request DB id
 *                  data-permreq-status = current status (pending | approved | …)
 *
 * ── Review modal ─────────────────────────────────────────────────────────────
 * Modal element:   #permReqReviewModal     (admin-permissions.php line 218)
 * Details content: #permReqDetails         (admin-permissions.php line 228)
 * Notes section:   #permReqNotesSection    (admin-permissions.php line 232; hidden for
 *                                           rejected/revoked by configureReviewModalButtons,
 *                                           admin-permissions.js line 856)
 * Notes textarea:  #permReqReviewNotes     (admin-permissions.php line 241)
 * Alerts div:      #permReqModalAlerts     (admin-permissions.php line 244)
 * Approve button:  #permReqApproveBtn      (admin-permissions.php line 247; d-none unless
 *                                           status === pending, line 847)
 * Reject button:   #permReqRejectBtn       (admin-permissions.php line 250; d-none unless
 *                                           status === pending, line 848)
 * Revoke button:   #permReqRevokeBtn       (admin-permissions.php line 253; d-none unless
 *                                           status === approved, line 851)
 *
 * ── Post-action flow (processAccessReq, admin-permissions.js line 885) ───────
 * On success: success alert shown in #permReqModalAlerts → 1500 ms delay →
 *   modal.hide() → loadAccessRequests() refreshes all tab bodies.
 * Durable assertion: modal is hidden + spinner gone in the source-status body.
 * (Alert in #permReqModalAlerts is transient and cleared after 1500 ms.)
 */

const PAGE_PATH = '/admin-permissions.php';

function statusTabSelector(status: string): string {
    return `#permReq-${status}-tab`;
}

function statusBodySelector(status: string): string {
    // 'pending' → '#permReqPendingBody', 'approved' → '#permReqApprovedBody', etc.
    const cap = status.charAt(0).toUpperCase() + status.slice(1);
    return `#permReq${cap}Body`;
}

/**
 * Navigate to the admin access-requests page, activate the given status tab,
 * and wait for the list XHR to complete — not just the spinner, which Bootstrap's
 * shown.bs.tab can clear before the fetch resolves.
 *
 * loadAccessRequests() issues a SINGLE GET /admin/access-requests for all statuses
 * on page init, so register the listener BEFORE goto to avoid missing it. Match on
 * the GET method (not status 200) so even a non-200 resolves the wait rather than
 * hanging. (A resource-admin only reaches this page — and fires this XHR — when
 * AuthHelper resolves isResourceAdmin() true; that server-side admin-scopes call
 * needs API_INTERNAL_URL in Docker, else the page redirects and no XHR fires.)
 */
async function gotoAndWaitList(page: Page, status: string): Promise<void> {
    const responseReady = page.waitForResponse(
        r => r.url().includes('/admin/access-requests') && r.request().method() === 'GET',
    );
    await page.goto(PAGE_PATH);
    // For non-pending tabs, activate the correct tab so its body is visible
    // before we start reading the DOM (tab click is purely cosmetic, no fetch).
    if (status !== 'pending') {
        await page.click(statusTabSelector(status));
    }
    await responseReady;
    await expect(page.locator(`${statusBodySelector(status)} .fa-spinner`)).toHaveCount(0);
}

/**
 * Navigate/reload the review list (optionally with a status filter) and return
 * whether a row for `requesterEmail` is present.
 */
export async function requestVisible(
    page: Page,
    q: { requesterEmail: string; status?: string },
): Promise<boolean> {
    const status = q.status ?? 'pending';
    await gotoAndWaitList(page, status);
    const count = await page
        .locator(`${statusBodySelector(status)} tr`)
        .filter({ has: page.locator(`td:first-child small.text-muted:text-is("${q.requesterEmail}")`) })
        .count();
    return count > 0;
}

/**
 * Return the table-row Locator for a specific requester in the given status list
 * (defaults to 'pending'). Assumes the page is already on admin-permissions.php
 * with the appropriate tab loaded; call `requestVisible` or `gotoAndWaitList` first.
 */
export async function findRequestRow(
    page: Page,
    q: { requesterEmail: string; status?: string },
): Promise<Locator> {
    const status = q.status ?? 'pending';
    return page
        .locator(`${statusBodySelector(status)} tr`)
        .filter({ has: page.locator(`td:first-child small.text-muted:text-is("${q.requesterEmail}")`) });
}

/**
 * Open the review modal for the given requester's request, optionally fill
 * review notes, click the action button, and wait for the modal to close and
 * the list to refresh.
 *
 * - approve / reject → expects the request to be in the `pending` tab.
 * - revoke           → expects the request to be in the `approved` tab.
 */
export async function actOnRequest(
    page: Page,
    q: { requesterEmail: string; action: 'approve' | 'reject' | 'revoke'; notes?: string },
): Promise<void> {
    // The source tab depends on the action.
    const fromStatus = q.action === 'revoke' ? 'approved' : 'pending';
    await gotoAndWaitList(page, fromStatus);

    // Find the row and click its review button.
    // Scope to the first cell so the justification cell's small.text-muted doesn't match.
    const row = page
        .locator(`${statusBodySelector(fromStatus)} tr`)
        .filter({ has: page.locator(`td:first-child small.text-muted:text-is("${q.requesterEmail}")`) });
    await expect(row).toBeVisible();
    await row.locator('.permReq-review-btn').click();

    // Wait for the review modal to open.
    const modal = page.locator('#permReqReviewModal');
    await expect(modal).toBeVisible();

    // Fill notes if provided (the notes section is present for pending + approved).
    if (q.notes) {
        await page.fill('#permReqReviewNotes', q.notes);
    }

    // Click the action button — assert it is visible first so an action that is
    // invalid for the row's current status fails with a meaningful message.
    const actionBtnSelector: Record<string, string> = {
        approve: '#permReqApproveBtn',
        reject: '#permReqRejectBtn',
        revoke: '#permReqRevokeBtn',
    };
    await expect(page.locator(actionBtnSelector[q.action])).toBeVisible();
    await page.click(actionBtnSelector[q.action]);

    // Wait for the modal to close (JS hides it after the 1500 ms success delay).
    await expect(modal).toBeHidden({ timeout: 10000 });

    // Wait for the list to reload in the source-status body (spinner gone).
    await expect(
        page.locator(`${statusBodySelector(fromStatus)} .fa-spinner`),
    ).toHaveCount(0);
}
