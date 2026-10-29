/**
 * Unit tests for assets/js/storedPermissionRows.js.
 *
 * People no longer request `viewer` (LiturgicalCalendarAPI #1049): reading comes
 * with the role. A rejected request stored before that change may still carry
 * `viewer` rows, and the API refuses a resubmit containing any, so they are
 * dropped before the form is refilled.
 */

import { describe, it, expect } from 'vitest';

import { dropViewerRows } from '../storedPermissionRows.js';

const VIEWER = { object_type: 'rite_calendar', object_id: 'roman/decrees', relation: 'viewer' };
const EDITOR = { object_type: 'national_calendar', object_id: 'roman/IT', relation: 'editor' };
const ADMIN  = { object_type: 'diocesan_calendar', object_id: 'roman/roma_it', relation: 'admin' };

describe('dropViewerRows', () => {
    it('drops a viewer-only list entirely', () => {
        expect(dropViewerRows([VIEWER])).toEqual({ kept: [], dropped: 1 });
    });

    it('keeps the editor entry of a mixed list', () => {
        expect(dropViewerRows([VIEWER, EDITOR])).toEqual({ kept: [EDITOR], dropped: 1 });
    });

    it('keeps order and counts every viewer row', () => {
        expect(dropViewerRows([EDITOR, VIEWER, ADMIN, { ...VIEWER, object_id: 'roman/temporale' }]))
            .toEqual({ kept: [EDITOR, ADMIN], dropped: 2 });
    });

    it('leaves a list without viewer rows untouched', () => {
        const stored = [EDITOR, ADMIN];
        const result = dropViewerRows(stored);
        expect(result).toEqual({ kept: [EDITOR, ADMIN], dropped: 0 });
        expect(result.kept).not.toBe(stored);
    });

    it('treats a missing or non-array input as empty', () => {
        expect(dropViewerRows(undefined)).toEqual({ kept: [], dropped: 0 });
        expect(dropViewerRows(null)).toEqual({ kept: [], dropped: 0 });
        expect(dropViewerRows('viewer')).toEqual({ kept: [], dropped: 0 });
    });

    it('keeps entries that are not viewer rows, even malformed ones', () => {
        // Malformed entries are not this function's business: the row restore
        // already copes with them, and silently counting them as "viewer"
        // would show a misleading alert.
        expect(dropViewerRows([null, {}, EDITOR])).toEqual({ kept: [null, {}, EDITOR], dropped: 0 });
    });
});
