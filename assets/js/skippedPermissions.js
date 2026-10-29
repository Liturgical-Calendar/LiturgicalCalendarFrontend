/**
 * Reading the outcome of an access-request submission.
 *
 * The API refuses to record permissions that are already redundant. A create
 * (201) or resubmit (200) response carries:
 *
 *   {
 *     "skipped_permissions": [
 *       { "object_type": "…", "object_id": "…", "relation": "…", "reason": "granted|pending|duplicate" }
 *     ],
 *     "role_only": false
 *   }
 *
 * When nothing is left to request, the API answers 409 with
 * `{ success: false, message, skipped_permissions: [ … ] }`.
 *
 * Pure: no DOM, no fetch.
 *
 * @module skippedPermissions
 */

/**
 * Every reason the API gives for skipping a permission.
 * @type {ReadonlyArray<string>}
 */
export const SKIP_REASONS = Object.freeze(['granted', 'pending', 'duplicate']);

/**
 * The localized strings skipReasonText() needs.
 *
 * @typedef {Object} SkippedPermissionsMessages
 * @prop {string} skipGranted   The user already holds this permission.
 * @prop {string} skipPending   A request for it is already pending.
 * @prop {string} skipDuplicate It was listed more than once in this request.
 * @prop {string} skipUnknown   Any other reason.
 */

/**
 * The outcome of a submission.
 *
 * @typedef {Object} SubmitOutcome
 * @prop {'created'|'role_only'|'all_redundant'|'error'} kind
 * @prop {Array<Object>} skipped The skipped permissions, possibly empty.
 */

/**
 * The localized text for a skip reason.
 *
 * @param {string|undefined} reason One of SKIP_REASONS, or anything else.
 * @param {SkippedPermissionsMessages} i18n The localized strings.
 * @returns {string} The text; `i18n.skipUnknown` for an unrecognized reason.
 */
export function skipReasonText(reason, i18n) {
    switch (reason) {
        case 'granted':
            return i18n.skipGranted;
        case 'pending':
            return i18n.skipPending;
        case 'duplicate':
            return i18n.skipDuplicate;
        default:
            return i18n.skipUnknown;
    }
}

/**
 * Interpret a submit response.
 *
 * @param {number} status The HTTP status.
 * @param {unknown} body  The parsed response body.
 * @returns {SubmitOutcome} What happened.
 */
export function readSubmitOutcome(status, body) {
    const data = ( body && typeof body === 'object' ) ? body : {};
    const skipped = Array.isArray(data.skipped_permissions) ? data.skipped_permissions : null;

    if (status === 201 || status === 200) {
        if (data.role_only === true) {
            return { kind: 'role_only', skipped: skipped ?? [] };
        }
        return { kind: 'created', skipped: skipped ?? [] };
    }
    if (status === 409 && skipped !== null) {
        return { kind: 'all_redundant', skipped };
    }
    return { kind: 'error', skipped: [] };
}
