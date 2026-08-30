/**
 * What the API actually DID with a write.
 *
 * Since LiturgicalCalendarAPI #902 a `PUT` / `PATCH` / `DELETE` against
 * `/data/*`, `/decrees/*` or `/tests/*` is not necessarily applied to disk.
 * When `SOURCEDATA_CHANGE_REQUESTS` is enabled (it is, on `api/dev`) the write
 * is recorded as a change request awaiting review, and the response says so:
 *
 *   {
 *     "success": "Calendar data created for Diocese …",
 *     "disposition": "submitted",
 *     "change_request": {
 *       "batch_id": "…", "review_status": "submitted", "auto_approved": false,
 *       "resource": { "type": "…", "id": "…" }, "paths": [ … ],
 *       "superseded_batch_ids": [ … ]
 *     }
 *   }
 *
 * The `success` string is built unconditionally by the handlers, in BOTH modes,
 * so echoing it tells an editor their work was saved when it was only queued.
 * `data` is likewise populated in queue mode — but it is the PROPOSED payload,
 * not a stored resource (see API #933), so nothing derived from it may be
 * written into client-side state unless the disposition is `applied`.
 *
 * Hence the one rule every caller of this module observes:
 *
 *   **`applied` is the only disposition that may mutate local state.**
 *
 * A response with no `disposition` at all is `applied`: that is disk mode, and
 * it is what production `api/v5` still returns.
 *
 * @module writeDisposition
 */

/** @type {string} The write landed on disk. Today's behaviour, today's message. */
export const DISPOSITION_APPLIED = 'applied';

/** @type {string} The write was recorded as a change request awaiting review. */
export const DISPOSITION_SUBMITTED = 'submitted';

/** @type {string} The change request was auto-approved, but is not published yet. */
export const DISPOSITION_APPROVED = 'approved';

/**
 * Every disposition this frontend knows how to describe. Anything else is
 * reported as unrecognized rather than guessed at — see describeWriteOutcome().
 * @type {ReadonlyArray<string>}
 */
export const KNOWN_DISPOSITIONS = Object.freeze([
    DISPOSITION_APPLIED,
    DISPOSITION_SUBMITTED,
    DISPOSITION_APPROVED
]);

/**
 * The localized strings describeWriteOutcome() needs.
 *
 * Supplied by the page: `Messages` in extending.php, `config.i18n` in
 * admin-decrees.php and admin-tests.php. Every one of them takes a single `%s`.
 *
 * @typedef {Object} WriteDispositionMessages
 * @prop {string} writeSubmitted  Queued for review. `%s` is the batch id.
 * @prop {string} writeApproved   Approved, awaiting publication. `%s` is the batch id.
 * @prop {string} writeSuperseded Appended when batches were folded in. `%s` is the id list.
 * @prop {string} writeUnknown    Unrecognized disposition. `%s` is the raw value.
 */

/**
 * The outcome of a write, ready to be reported and to be branched on.
 *
 * @typedef {Object} WriteOutcome
 * @prop {string} disposition          Raw disposition, defaulting to `applied`.
 * @prop {boolean} applied             True only when the write reached disk.
 * @prop {string} message              The message to show the user.
 * @prop {'success'|'info'} severity   Toast severity matching that message.
 * @prop {string|null} batchId         Change request batch id, when there is one.
 * @prop {string[]} supersededBatchIds Batch ids folded into this one.
 */

/**
 * Substitute a single `%s` placeholder, the way admin-tests.js already does
 * with `confirmDelete`.
 *
 * @param {string} template Localized string containing one `%s`.
 * @param {string} value    The value to substitute.
 * @returns {string} The formatted string.
 */
const format = (template, value) => String(template ?? '').replace('%s', value);

/**
 * The disposition a write response reports.
 *
 * A body that is missing, unparseable or silent about `disposition` means disk
 * mode, which is `applied` — the answer that keeps the pre-#902 API and the
 * empty DELETE body behaving exactly as before.
 *
 * @param {unknown} responseData The parsed response body.
 * @returns {string} The disposition.
 */
export function readDisposition(responseData) {
    if (null === responseData || typeof responseData !== 'object') {
        return DISPOSITION_APPLIED;
    }
    const disposition = responseData.disposition;
    return typeof disposition === 'string' && disposition !== '' ? disposition : DISPOSITION_APPLIED;
}

/**
 * Whether this write actually happened.
 *
 * The gate on every local-state mutation. An unrecognized disposition is NOT
 * applied: we would rather leave the page's state untouched and let the user
 * reload than register a resource the server may never have stored.
 *
 * @param {unknown} responseData The parsed response body.
 * @returns {boolean} True when the write reached disk.
 */
export function isApplied(responseData) {
    return readDisposition(responseData) === DISPOSITION_APPLIED;
}

/**
 * The batch ids this change request superseded, always as an array.
 *
 * A superseded batch stops existing, so it vanishes from
 * `GET /auth/change-requests`. Naming the ids is what keeps that from reading
 * as lost work to an editor watching their own queue: those batches were folded
 * INTO this one, not discarded.
 *
 * @param {unknown} responseData The parsed response body.
 * @returns {string[]} The superseded batch ids, possibly empty.
 */
export function supersededBatchIds(responseData) {
    const changeRequest = ( responseData && typeof responseData === 'object' ) ? responseData.change_request : null;
    const ids = ( changeRequest && typeof changeRequest === 'object' ) ? changeRequest.superseded_batch_ids : null;
    return Array.isArray(ids) ? ids.map(id => String(id)) : [];
}

/**
 * Describe what the API did with a write, and how to say it.
 *
 * `appliedMessage` is whatever the call site says today for a successful write
 * — usually the handler's own `success` string — and is used ONLY on the
 * `applied` branch, since it is built in both modes and therefore proves
 * nothing on its own.
 *
 * @param {unknown} responseData    The parsed response body.
 * @param {WriteDispositionMessages} messages The localized strings.
 * @param {string} appliedMessage   What to say when the write reached disk.
 * @returns {WriteOutcome} The outcome, ready to report and to branch on.
 */
export function describeWriteOutcome(responseData, messages, appliedMessage) {
    const disposition = readDisposition(responseData);
    const changeRequest = ( responseData && typeof responseData === 'object' ) ? responseData.change_request : null;
    const batchId = ( changeRequest && typeof changeRequest === 'object' && changeRequest.batch_id )
        ? String(changeRequest.batch_id)
        : null;
    const superseded = supersededBatchIds(responseData);

    let message;
    switch (disposition) {
        case DISPOSITION_APPLIED:
            message = appliedMessage;
            break;
        case DISPOSITION_SUBMITTED:
            message = format(messages?.writeSubmitted, batchId ?? '');
            break;
        case DISPOSITION_APPROVED:
            message = format(messages?.writeApproved, batchId ?? '');
            break;
        default:
            message = format(messages?.writeUnknown, disposition);
            break;
    }

    // Only a queued write can have superseded anything, so this never lengthens
    // the disk-mode message.
    if (superseded.length > 0 && disposition !== DISPOSITION_APPLIED) {
        message += ' ' + format(messages?.writeSuperseded, superseded.join(', '));
    }

    return {
        disposition,
        applied: disposition === DISPOSITION_APPLIED,
        message,
        severity: disposition === DISPOSITION_APPLIED ? 'success' : 'info',
        batchId,
        supersededBatchIds: superseded
    };
}
