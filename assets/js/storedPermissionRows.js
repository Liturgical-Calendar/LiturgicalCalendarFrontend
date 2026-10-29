/**
 * Preparing a rejected access request's stored permissions for resubmit.
 *
 * People no longer request `viewer` (LiturgicalCalendarAPI #1049): read access
 * comes with the role they hold. A request stored before that change may still
 * carry `viewer` rows, and the API refuses a resubmit that contains any, so the
 * form drops them before refilling its rows and tells the user why.
 *
 * Pure: no DOM, no fetch.
 *
 * @module storedPermissionRows
 */

/**
 * Split stored permissions into the ones the form refills and a count of the
 * `viewer` rows dropped. Order is kept; anything that is not a `viewer` row
 * (malformed entries included) is kept for the row restore to cope with.
 *
 * @param {unknown} permissions The stored `permissions` array; anything else reads as empty.
 * @returns {{kept: Array<unknown>, dropped: number}} A new array, never the input.
 */
export function dropViewerRows(permissions) {
    if (!Array.isArray(permissions)) {
        return { kept: [], dropped: 0 };
    }
    const kept = permissions.filter((perm) => !(
        perm !== null && typeof perm === 'object' && perm.relation === 'viewer'
    ));
    return { kept, dropped: permissions.length - kept.length };
}
