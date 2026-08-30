/**
 * Unit tests for the write-disposition helper (assets/js/writeDisposition.js).
 *
 * Since LiturgicalCalendarAPI #902 a write may be recorded as a change request
 * instead of being applied, and the response says which in `disposition`. These
 * tests pin the three dispositions, the two defensive cases (no disposition at
 * all, an unrecognized one), and the superseded-batch reporting.
 *
 * The `applied` flag is the load-bearing one: it is what every call site gates
 * its local-state mutations on, so each case asserts it explicitly.
 */

import { describe, it, expect } from 'vitest';

import {
    DISPOSITION_APPLIED,
    DISPOSITION_APPROVED,
    DISPOSITION_SUBMITTED,
    describeWriteOutcome,
    isApplied,
    readDisposition,
    supersededBatchIds
} from '../writeDisposition.js';

/** Mirrors the four `write*` msgids includes/messages.php and the two admin pages define. */
const MESSAGES = {
    writeSubmitted:  'Submitted for review as batch %s.',
    writeApproved:   'Approved as batch %s, queued for publication.',
    writeSuperseded: 'Folded in: %s',
    writeUnknown:    'Unrecognized outcome (%s).'
};

const APPLIED_MESSAGE = 'Calendar data created for Diocese "Test".';

/**
 * A queue-mode response body, shaped like ChangeRequestSourceDataWriter::commit().
 *
 * @param {string} disposition
 * @param {string[]} superseded
 * @returns {object}
 */
const queued = (disposition, superseded = []) => ({
    success:     APPLIED_MESSAGE,
    disposition,
    change_request: {
        batch_id:             'batch-42',
        review_status:        disposition,
        auto_approved:        disposition === DISPOSITION_APPROVED,
        resource:             { type: 'diocesan_calendar', id: 'roman/test_us' },
        paths:                ['jsondata/sourcedata/rite/roman/calendars/dioceses/US/test_us.json'],
        superseded_batch_ids: superseded
    }
});

describe('readDisposition()', () => {
    it('reads the disposition the API reported', () => {
        expect(readDisposition({ disposition: 'submitted' })).toBe(DISPOSITION_SUBMITTED);
        expect(readDisposition({ disposition: 'approved' })).toBe(DISPOSITION_APPROVED);
    });

    it('treats a body with no disposition as applied — that is disk mode', () => {
        expect(readDisposition({ success: 'Calendar deleted.' })).toBe(DISPOSITION_APPLIED);
        expect(readDisposition(null)).toBe(DISPOSITION_APPLIED);
        expect(readDisposition(undefined)).toBe(DISPOSITION_APPLIED);
        expect(readDisposition('')).toBe(DISPOSITION_APPLIED);
    });
});

describe('isApplied()', () => {
    it('is true only for applied, and for the disk-mode bodies that omit the field', () => {
        expect(isApplied({ disposition: 'applied' })).toBe(true);
        expect(isApplied({ success: 'done' })).toBe(true);
        expect(isApplied(null)).toBe(true);
    });

    it('is false for every queued disposition', () => {
        expect(isApplied(queued(DISPOSITION_SUBMITTED))).toBe(false);
        expect(isApplied(queued(DISPOSITION_APPROVED))).toBe(false);
    });

    it('is false for a disposition this frontend does not recognize', () => {
        // Fail closed: never mutate local state on a verdict we cannot read.
        expect(isApplied({ disposition: 'rejected' })).toBe(false);
    });
});

describe('supersededBatchIds()', () => {
    it('returns the ids as strings, and an empty array when there are none', () => {
        expect(supersededBatchIds(queued(DISPOSITION_SUBMITTED, ['a', 'b']))).toEqual(['a', 'b']);
        expect(supersededBatchIds(queued(DISPOSITION_SUBMITTED))).toEqual([]);
        expect(supersededBatchIds({ disposition: 'applied' })).toEqual([]);
        expect(supersededBatchIds(null)).toEqual([]);
    });
});

describe('describeWriteOutcome()', () => {
    it('applied — keeps today\'s message and today\'s behaviour', () => {
        const outcome = describeWriteOutcome({ disposition: 'applied' }, MESSAGES, APPLIED_MESSAGE);
        expect(outcome.applied).toBe(true);
        expect(outcome.disposition).toBe(DISPOSITION_APPLIED);
        expect(outcome.message).toBe(APPLIED_MESSAGE);
        expect(outcome.severity).toBe('success');
        expect(outcome.batchId).toBeNull();
    });

    it('a pre-#902 response with no disposition is still applied', () => {
        const outcome = describeWriteOutcome({ success: APPLIED_MESSAGE }, MESSAGES, APPLIED_MESSAGE);
        expect(outcome.applied).toBe(true);
        expect(outcome.message).toBe(APPLIED_MESSAGE);
    });

    it('submitted — says it was sent for review, and names the batch', () => {
        const outcome = describeWriteOutcome(queued(DISPOSITION_SUBMITTED), MESSAGES, APPLIED_MESSAGE);
        expect(outcome.applied).toBe(false);
        expect(outcome.disposition).toBe(DISPOSITION_SUBMITTED);
        expect(outcome.message).toBe('Submitted for review as batch batch-42.');
        expect(outcome.severity).toBe('info');
        expect(outcome.batchId).toBe('batch-42');
        // The handler's own success string is built in BOTH modes, so it must
        // never reach the user on a queued write.
        expect(outcome.message).not.toContain(APPLIED_MESSAGE);
    });

    it('approved — says it was approved and queued for publication', () => {
        const outcome = describeWriteOutcome(queued(DISPOSITION_APPROVED), MESSAGES, APPLIED_MESSAGE);
        expect(outcome.applied).toBe(false);
        expect(outcome.disposition).toBe(DISPOSITION_APPROVED);
        expect(outcome.message).toBe('Approved as batch batch-42, queued for publication.');
        expect(outcome.severity).toBe('info');
    });

    it('appends the superseded batch ids, so they do not just vanish from the queue', () => {
        const outcome = describeWriteOutcome(
            queued(DISPOSITION_SUBMITTED, ['batch-40', 'batch-41']),
            MESSAGES,
            APPLIED_MESSAGE
        );
        expect(outcome.message).toBe('Submitted for review as batch batch-42. Folded in: batch-40, batch-41');
        expect(outcome.supersededBatchIds).toEqual(['batch-40', 'batch-41']);
    });

    it('an unrecognized disposition is reported as such, and is not applied', () => {
        const outcome = describeWriteOutcome({ disposition: 'teleported' }, MESSAGES, APPLIED_MESSAGE);
        expect(outcome.applied).toBe(false);
        expect(outcome.message).toBe('Unrecognized outcome (teleported).');
        expect(outcome.severity).toBe('info');
    });
});
