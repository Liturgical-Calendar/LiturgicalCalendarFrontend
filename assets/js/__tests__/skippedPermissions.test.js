/**
 * Unit tests for the access-request submit outcome reader (assets/js/skippedPermissions.js).
 *
 * The API refuses to record redundant permissions: it answers 201 (create) or 200 (resubmit)
 * with `skipped_permissions` and `role_only`, or 409 when nothing is left to request.
 */

import { describe, it, expect } from 'vitest';

import { SKIP_REASONS, readSubmitOutcome, skipReasonText } from '../skippedPermissions.js';

const I18N = {
    skipGranted:   'Already granted',
    skipDuplicate: 'Duplicate',
    skipUnknown:   'Skipped'
};

const SKIP = { object_type: 'diocesan_calendar', object_id: 'roma_it', relation: 'editor', reason: 'granted' };

describe('SKIP_REASONS', () => {
    it('lists the two reasons the API emits', () => {
        expect(SKIP_REASONS).toEqual(['granted', 'duplicate']);
    });
});

describe('skipReasonText', () => {
    it('maps each reason to its key', () => {
        expect(skipReasonText('granted', I18N)).toBe('Already granted');
        expect(skipReasonText('duplicate', I18N)).toBe('Duplicate');
    });

    it('falls back to skipUnknown for an unknown reason or undefined', () => {
        expect(skipReasonText('whatever', I18N)).toBe('Skipped');
        expect(skipReasonText(undefined, I18N)).toBe('Skipped');
        expect(skipReasonText('pending', I18N)).toBe('Skipped');
    });
});

describe('readSubmitOutcome', () => {
    it('reads a 201 with skips as created', () => {
        expect(readSubmitOutcome(201, { skipped_permissions: [SKIP], role_only: false }))
            .toEqual({ kind: 'created', skipped: [SKIP] });
    });

    it('reads a 201 with role_only as role_only', () => {
        expect(readSubmitOutcome(201, { skipped_permissions: [], role_only: true }).kind).toBe('role_only');
    });

    it('reads a 200 resubmit as created', () => {
        expect(readSubmitOutcome(200, { skipped_permissions: [SKIP] }))
            .toEqual({ kind: 'created', skipped: [SKIP] });
    });

    it('defaults skipped to [] when absent', () => {
        expect(readSubmitOutcome(201, {})).toEqual({ kind: 'created', skipped: [] });
    });

    it('reads a 409 with skipped_permissions as all_redundant', () => {
        expect(readSubmitOutcome(409, { success: false, message: 'x', skipped_permissions: [SKIP] }))
            .toEqual({ kind: 'all_redundant', skipped: [SKIP] });
    });

    it('reads a 409 without the array as error', () => {
        expect(readSubmitOutcome(409, { success: false, message: 'x' }).kind).toBe('error');
    });

    it('reads a 500 as error', () => {
        expect(readSubmitOutcome(500, { skipped_permissions: [SKIP] })).toEqual({ kind: 'error', skipped: [] });
    });

    it('tolerates a missing body', () => {
        expect(readSubmitOutcome(201, null).kind).toBe('created');
        expect(readSubmitOutcome(409, undefined).kind).toBe('error');
    });
});
