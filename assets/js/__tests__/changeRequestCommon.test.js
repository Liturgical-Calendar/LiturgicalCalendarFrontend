/**
 * Unit tests for the shared change-request batch-detail renderer.
 *
 * The point of the batch detail routes is that a reviewer can see what they are
 * approving: `ChangeRequestFile` carries BOTH the proposed `content` and the
 * `current_content` on disk, so this renders a real before/after diff rather than
 * a list of paths. These tests pin the cases where getting it wrong would mislead
 * a reviewer — a suppressed body read as an empty file, a delete read as a
 * rewrite, an unchanged file read as a change.
 *
 * `change-request-common.js` is a classic script defining a global `const`, so it
 * is evaluated here from source the way the browser loads it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const SOURCE = readFileSync(resolve(process.cwd(), 'assets/js/change-request-common.js'), 'utf8');

const ChangeRequestCommon = new Function(`${SOURCE}\nreturn ChangeRequestCommon;`)();

const i18n = {
    noFiles: 'No files.',
    noChanges: 'No content change.',
    diffTooLarge: 'Too large (%1$s proposed, %2$s currently on disk).',
    diffHiddenLines: '@@ %1$d unchanged line(s) hidden @@',
    contentSuppressed: 'Contents not requested. Proposed: %1$s; on disk: %2$s.',
    fileWillBeDeleted: 'Will be removed (%1$s currently on disk).',
    operations: { create: 'Added', update: 'Changed', delete: 'Removed' },
    // Mirrors includes/change-request-i18n.php: `rite_calendar` is ADDED beside
    // the type it supersedes, never in place of it.
    resourceTypes: {
        national_calendar: 'National calendar',
        rite_calendar: 'Rite calendar',
        general_roman_calendar: 'General Roman Calendar'
    }
};

const file = (overrides = {}) => ({
    path: 'jsondata/sourcedata/calendars/US.json',
    operation: 'update',
    base_sha: 'abc123',
    content: null,
    content_bytes: null,
    current_content: null,
    current_content_bytes: null,
    ...overrides
});

describe('splitResourceId', () => {
    it('splits a rite-qualified id', () => {
        expect(ChangeRequestCommon.splitResourceId('roman/US')).toEqual({ rite: 'roman', id: 'US' });
    });

    it('leaves a bare id alone — not every resource type is rite-qualified', () => {
        expect(ChangeRequestCommon.splitResourceId('decrees')).toEqual({ rite: null, id: 'decrees' });
    });
});

describe('diffLines', () => {
    it('reports added, removed and unchanged lines', () => {
        const ops = ChangeRequestCommon.diffLines('a\nb\nc', 'a\nB\nc');
        expect(ops).toEqual([
            { type: 'context', text: 'a' },
            { type: 'remove', text: 'b' },
            { type: 'add', text: 'B' },
            { type: 'context', text: 'c' }
        ]);
    });

    it('treats a missing before-side as a pure addition', () => {
        const ops = ChangeRequestCommon.diffLines('', 'x\ny');
        expect(ops.every(op => op.type === 'add')).toBe(true);
        expect(ops).toHaveLength(2);
    });
});

describe('foldUnchanged', () => {
    it('collapses long unchanged runs but keeps context around a change', () => {
        const ops = ChangeRequestCommon.diffLines(
            Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n'),
            Array.from({ length: 30 }, (_, i) => ( i === 15 ? 'CHANGED' : `line ${i}` )).join('\n')
        );
        const folded = ChangeRequestCommon.foldUnchanged(ops);

        expect(folded.some(op => op.type === 'fold')).toBe(true);
        expect(folded.filter(op => op.type === 'add' || op.type === 'remove')).toHaveLength(2);
        expect(folded.length).toBeLessThan(ops.length);
    });
});

describe('renderBatchFiles', () => {
    it('renders a real before/after diff when both bodies are present', () => {
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({
                content: '{\n  "a": 2\n}',
                content_bytes: 12,
                current_content: '{\n  "a": 1\n}',
                current_content_bytes: 12
            })]
        }, i18n, 'en-US');

        expect(html).toContain('change-request-diff');
        expect(html).toContain('change-request-diff-add');
        expect(html).toContain('change-request-diff-remove');
        expect(html).toContain('&quot;a&quot;: 2');
        expect(html).toContain('Changed');
    });

    it('says the bodies were suppressed rather than showing an empty diff', () => {
        // content_included:false means "not requested", NOT "the file is empty" —
        // conflating the two would show a reviewer a delete that is not there.
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: false,
            files: [file({ content_bytes: 4096, current_content_bytes: 2048 })]
        }, i18n, 'en-US');

        expect(html).toContain('Contents not requested');
        expect(html).toContain('4 KiB');
        expect(html).toContain('2 KiB');
        expect(html).not.toContain('change-request-diff-add');
    });

    it('renders a delete row as a removal, not as a rewrite to nothing', () => {
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({
                operation: 'delete',
                content: null,
                content_bytes: null,
                current_content: '{"a":1}',
                current_content_bytes: 7
            })]
        }, i18n, 'en-US');

        expect(html).toContain('Will be removed');
        expect(html).toContain('Removed');
        expect(html).not.toContain('change-request-diff-add');
    });

    it('says so plainly when a restaged file has identical bytes', () => {
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({ content: 'same\ntext', content_bytes: 9, current_content: 'same\ntext', current_content_bytes: 9 })]
        }, i18n, 'en-US');

        expect(html).toContain('No content change.');
        expect(html).not.toContain('unchanged line(s) hidden');
    });

    it('refuses to diff a file past the line cap and reports its size instead', () => {
        const big = Array.from({ length: ChangeRequestCommon.MAX_DIFF_LINES + 10 }, (_, i) => `l${i}`).join('\n');
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({ content: big, content_bytes: big.length, current_content: '', current_content_bytes: 0 })]
        }, i18n, 'en-US');

        expect(html).toContain('Too large');
        expect(html).not.toContain('change-request-diff-add');
    });

    it('refuses to diff a file past the character cap even when its line count is tiny', () => {
        // One minified JSON line, far past MAX_DIFF_CHARS. This is the case the line
        // cap alone lets through: two lines total, megabytes of content.
        const oneHugeLine = 'x'.repeat(ChangeRequestCommon.MAX_DIFF_CHARS + 1);
        expect(oneHugeLine.split('\n').length).toBeLessThan(ChangeRequestCommon.MAX_DIFF_LINES);

        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({
                content: oneHugeLine,
                content_bytes: oneHugeLine.length,
                current_content: '',
                current_content_bytes: 0
            })]
        }, i18n, 'en-US');

        expect(html).toContain('Too large');
        expect(html).not.toContain('change-request-diff-add');
    });

    it('still diffs a file that is under both caps', () => {
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({ content: 'a\nb', content_bytes: 3, current_content: 'a', current_content_bytes: 1 })]
        }, i18n, 'en-US');

        expect(html).not.toContain('Too large');
        expect(html).toContain('change-request-diff-add');
    });

    it('escapes file paths and contents', () => {
        const html = ChangeRequestCommon.renderBatchFiles({
            batch: {},
            content_included: true,
            files: [file({
                path: '<img src=x onerror=alert(1)>',
                content: '<script>alert(1)</script>',
                content_bytes: 24,
                current_content: '',
                current_content_bytes: 0
            })]
        }, i18n, 'en-US');

        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('handles a batch with no files', () => {
        const html = ChangeRequestCommon.renderBatchFiles({ batch: {}, content_included: true, files: [] }, i18n, 'en-US');
        expect(html).toContain('No files.');
    });
});

describe('renderResource', () => {
    it('shows the rite badge separately from the bare calendar id', () => {
        const html = ChangeRequestCommon.renderResource(
            { resource_type: 'national_calendar', resource_id: 'roman/US' },
            i18n
        );
        expect(html).toContain('roman');
        expect(html).toContain('<code>US</code>');
        expect(html).toContain('National calendar');
    });

    it('splits a rite_calendar id, which carries its rite since API #955', () => {
        const html = ChangeRequestCommon.renderResource(
            { resource_type: 'rite_calendar', resource_id: 'ambrosian/EDITIO_TYPICA_2024' },
            i18n
        );
        expect(html).toContain('ambrosian');
        expect(html).toContain('<code>EDITIO_TYPICA_2024</code>');
        expect(html).toContain('Rite calendar');
    });

    it('omits the rite badge for a bare id', () => {
        const html = ChangeRequestCommon.renderResource(
            { resource_type: 'general_roman_calendar', resource_id: 'decrees' },
            i18n
        );
        expect(html).toContain('<code>decrees</code>');
        expect(html).not.toContain('badge bg-light text-dark border me-1');
    });

    it('STILL labels a legacy general_roman_calendar row after #955', () => {
        // The failure mode #955 makes easy: `rite_calendar` supersedes this type,
        // but the API never rewrites `audit_log` and keeps emitting the old name
        // on every row written before its data migration ran. A resourceTypes map
        // that only knew the new name would fall through to the raw type id here.
        const html = ChangeRequestCommon.renderResource(
            { resource_type: 'general_roman_calendar', resource_id: 'temporale' },
            i18n
        );
        expect(html).toContain('General Roman Calendar');
        expect(html).not.toContain('>general_roman_calendar<');
    });
});
