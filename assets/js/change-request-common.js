/**
 * Change Request Common Helpers
 *
 * Shared by the reviewer's queue (`admin-changes.js`) and the submitter's own
 * history (`change-requests.js`).
 *
 * The two pages render the SAME batch detail body: `GET /admin/change-requests/{batchId}`
 * and `GET /auth/change-requests/{batchId}` return an identical
 * `ChangeRequestBatchDetail` — `{batch, files, content_included}` — and differ only in
 * who is allowed to ask. So the detail renderer lives here once, parameterised by which
 * of the two paths to call.
 *
 * A classic script (not an ES module) because `admin-changes.js` is loaded as one, to
 * reach `createAdminModule` from `admin-module-base.js`.
 *
 * @module ChangeRequestCommon
 */
const ChangeRequestCommon = { // eslint-disable-line no-unused-vars

    /**
     * Line counts above which a real diff is not attempted. The LCS below is
     * O(n·m); the decrees corpus batches 22 files and some are large, and a
     * reviewer is not served by a browser that stops responding. Above the cap
     * the file is summarised by size instead.
     */
    MAX_DIFF_LINES: 1500,

    /**
     * Total characters (before + after) above which a real diff is not attempted.
     *
     * The line cap alone is not a size cap: one minified JSON file is two lines
     * and can still be megabytes, which sails past MAX_DIFF_LINES and then costs
     * the O(n·m) LCS and a very large DOM node anyway. Source data is JSON, and
     * minified JSON is exactly the shape that hits this.
     */
    MAX_DIFF_CHARS: 512000,

    /**
     * HTML-escape a value for interpolation into markup.
     *
     * Quotes are escaped too, which the textContent/innerHTML idiom used elsewhere
     * in this codebase does NOT do — that idiom only covers `&`, `<` and `>`, and
     * is therefore only safe between tags. The output here is also interpolated
     * into quoted attributes (`id="batch-…"`, `href="…"`), so it must survive
     * there as well.
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Human-readable byte count. Locale-formatted for the integer part so the
     * thousands separator matches the page.
     * @param {number|null} bytes
     * @param {string} locale - BCP-47 tag
     * @returns {string}
     */
    formatBytes(bytes, locale) {
        if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '-';
        if (bytes < 1024) {
            return `${bytes.toLocaleString(locale)} B`;
        }
        const kib = bytes / 1024;
        if (kib < 1024) {
            return `${kib.toLocaleString(locale, { maximumFractionDigits: 1 })} KiB`;
        }
        return `${( kib / 1024 ).toLocaleString(locale, { maximumFractionDigits: 2 })} MiB`;
    },

    /**
     * Split a rite-qualified resource id into its rite and bare id.
     *
     * `resource_id` is `<rite>/<calendarId>` for the calendar-naming resource types
     * and for the two calendar test scopes, and bare for everything else
     * (`decrees`, `general_roman_calendar_test`, `rite_calendar_test`). Nothing
     * downstream may assume a slash is present.
     *
     * @param {string} resourceId
     * @returns {{rite: string|null, id: string}}
     */
    splitResourceId(resourceId) {
        const value = typeof resourceId === 'string' ? resourceId : '';
        const slash = value.indexOf('/');
        if (slash === -1) {
            return { rite: null, id: value };
        }
        return { rite: value.slice(0, slash), id: value.slice(slash + 1) };
    },

    /**
     * Render the resource a batch belongs to as a labelled cell.
     * @param {Object} batch - A ChangeRequestBatch
     * @param {Object} i18n - The page's i18n bag; `resourceTypes` maps a resource_type to a label
     * @returns {string} HTML
     */
    renderResource(batch, i18n) {
        const typeLabel = ( i18n.resourceTypes || {} )[batch.resource_type] || batch.resource_type || '';
        const { rite, id } = this.splitResourceId(batch.resource_id);
        const riteHtml = rite
            ? `<span class="badge bg-light text-dark border me-1">${this.escapeHtml(rite)}</span>`
            : '';
        return `${riteHtml}<code>${this.escapeHtml(id)}</code>`
            + `<br><small class="text-muted">${this.escapeHtml(typeLabel)}</small>`;
    },

    /**
     * Fetch one batch's detail.
     *
     * @param {string} apiUrl - API base URL
     * @param {'admin'|'auth'} scope - Which of the two identical routes to call
     * @param {string} batchId - Batch UUID
     * @param {boolean} [includeContent] - Pass false to size a batch without its bodies
     * @returns {Promise<Object>} A ChangeRequestBatchDetail
     */
    async fetchBatchDetail(apiUrl, scope, batchId, includeContent = true) {
        const base = scope === 'admin' ? '/admin/change-requests' : '/auth/change-requests';
        const query = includeContent ? '' : '?include_content=false';
        const response = await fetch(`${apiUrl}${base}/${encodeURIComponent(batchId)}${query}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || data.detail || data.error || `HTTP ${response.status}`);
        }

        return response.json();
    },

    /**
     * Longest-common-subsequence line diff.
     *
     * Returns a flat op list, each `{type: 'context'|'add'|'remove', text}`, in
     * document order.
     *
     * @param {string} before
     * @param {string} after
     * @returns {Array<{type: string, text: string}>}
     */
    diffLines(before, after) {
        const a = before === '' ? [] : before.split('\n');
        const b = after === '' ? [] : after.split('\n');

        // lengths[i][j] = LCS length of a[i:] and b[j:]
        const lengths = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
        for (let i = a.length - 1; i >= 0; i--) {
            for (let j = b.length - 1; j >= 0; j--) {
                lengths[i][j] = a[i] === b[j]
                    ? lengths[i + 1][j + 1] + 1
                    : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
            }
        }

        const ops = [];
        let i = 0;
        let j = 0;
        while (i < a.length && j < b.length) {
            if (a[i] === b[j]) {
                ops.push({ type: 'context', text: a[i] });
                i++;
                j++;
            } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
                ops.push({ type: 'remove', text: a[i] });
                i++;
            } else {
                ops.push({ type: 'add', text: b[j] });
                j++;
            }
        }
        while (i < a.length) {
            ops.push({ type: 'remove', text: a[i] });
            i++;
        }
        while (j < b.length) {
            ops.push({ type: 'add', text: b[j] });
            j++;
        }
        return ops;
    },

    /**
     * Collapse runs of unchanged lines longer than 2·context into a fold marker,
     * so a one-line edit in a large file does not render the whole file.
     *
     * @param {Array<{type: string, text: string}>} ops
     * @param {number} [context] - Unchanged lines kept on each side of a change
     * @returns {Array<{type: string, text: string, count?: number}>}
     */
    foldUnchanged(ops, context = 3) {
        const keep = new Array(ops.length).fill(false);
        for (let k = 0; k < ops.length; k++) {
            if (ops[k].type === 'context') continue;
            for (let n = Math.max(0, k - context); n <= Math.min(ops.length - 1, k + context); n++) {
                keep[n] = true;
            }
        }

        const folded = [];
        let skipped = 0;
        for (let k = 0; k < ops.length; k++) {
            if (keep[k]) {
                if (skipped > 0) {
                    folded.push({ type: 'fold', text: '', count: skipped });
                    skipped = 0;
                }
                folded.push(ops[k]);
            } else {
                skipped++;
            }
        }
        if (skipped > 0) {
            folded.push({ type: 'fold', text: '', count: skipped });
        }
        return folded;
    },

    /**
     * Render one file's before/after as a unified diff table.
     * @private
     */
    _renderFileDiff(file, i18n, locale) {
        const before = typeof file.current_content === 'string' ? file.current_content : '';
        const after = typeof file.content === 'string' ? file.content : '';

        const lineCount = ( before === '' ? 0 : before.split('\n').length )
            + ( after === '' ? 0 : after.split('\n').length );

        if (lineCount > this.MAX_DIFF_LINES || ( before.length + after.length ) > this.MAX_DIFF_CHARS) {
            const tooLarge = i18n.diffTooLarge
                || 'This file is too large to diff in the browser (%1$s proposed, %2$s currently).';
            return `<div class="alert alert-secondary small mb-0">${this.escapeHtml(
                tooLarge
                    .replace('%1$s', this.formatBytes(file.content_bytes, locale))
                    .replace('%2$s', this.formatBytes(file.current_content_bytes, locale))
            )}</div>`;
        }

        const raw = this.diffLines(before, after);
        // A batch can legitimately restage a path whose bytes did not move; folding
        // that into "N unchanged lines hidden" would be a strange way to say so.
        if (!raw.some(op => op.type !== 'context')) {
            return `<div class="text-muted small mb-0">${this.escapeHtml(i18n.noChanges || 'No content change.')}</div>`;
        }

        const ops = this.foldUnchanged(raw);

        const rowClass = {
            add: 'change-request-diff-add',
            remove: 'change-request-diff-remove',
            context: '',
            fold: 'change-request-diff-fold'
        };
        const marker = { add: '+', remove: '-', context: ' ', fold: '' };

        let html = '<pre class="change-request-diff mb-0"><code>';
        for (const op of ops) {
            if (op.type === 'fold') {
                const foldTmpl = i18n.diffHiddenLines || '@@ %1$d unchanged line(s) hidden @@';
                html += `<span class="${rowClass.fold}">`
                    + this.escapeHtml(foldTmpl.replace('%1$d', String(op.count)))
                    + '</span>\n';
                continue;
            }
            html += `<span class="${rowClass[op.type]}">${this.escapeHtml(marker[op.type] + op.text)}</span>\n`;
        }
        html += '</code></pre>';
        return html;
    },

    /**
     * Render a whole batch detail: every proposed file, with a real before/after
     * diff where the bodies are present.
     *
     * `content_included === false` is a distinct case from "there is no content":
     * the server suppressed the bodies but the byte counts are still accurate, so
     * the sizes are shown and the diff is not attempted.
     *
     * @param {Object} detail - A ChangeRequestBatchDetail
     * @param {Object} i18n - The page's i18n bag
     * @param {string} locale - BCP-47 tag for number formatting
     * @returns {string} HTML
     */
    renderBatchFiles(detail, i18n, locale) {
        const files = Array.isArray(detail.files) ? detail.files : [];
        if (files.length === 0) {
            return `<p class="text-muted mb-0">${this.escapeHtml(i18n.noFiles || 'This batch proposes no files.')}</p>`;
        }

        const operationBadges = {
            create: 'bg-success',
            update: 'bg-primary',
            delete: 'bg-danger'
        };

        let html = '';
        for (const file of files) {
            const operationLabel = ( i18n.operations || {} )[file.operation] || file.operation || '';
            const badgeClass = operationBadges[file.operation] || 'bg-secondary';

            html += '<div class="card mb-3">';
            html += '<div class="card-header py-2 d-flex flex-wrap align-items-center gap-2">';
            html += `<span class="badge ${badgeClass}">${this.escapeHtml(operationLabel)}</span>`;
            html += `<code class="text-break">${this.escapeHtml(file.path)}</code>`;
            html += `<small class="text-muted ms-auto">${this.escapeHtml(this.formatBytes(file.content_bytes, locale))}</small>`;
            html += '</div>';
            html += '<div class="card-body p-2">';

            if (detail.content_included === false) {
                const suppressed = i18n.contentSuppressed
                    || 'File contents were not requested. Proposed: %1$s; currently on disk: %2$s.';
                html += `<div class="alert alert-secondary small mb-0">${this.escapeHtml(
                    suppressed
                        .replace('%1$s', this.formatBytes(file.content_bytes, locale))
                        .replace('%2$s', this.formatBytes(file.current_content_bytes, locale))
                )}</div>`;
            } else if (file.operation === 'delete') {
                const deletes = i18n.fileWillBeDeleted || 'This file will be removed (%1$s currently on disk).';
                html += `<div class="alert alert-danger small mb-0">${this.escapeHtml(
                    deletes.replace('%1$s', this.formatBytes(file.current_content_bytes, locale))
                )}</div>`;
            } else {
                html += this._renderFileDiff(file, i18n, locale);
            }

            html += '</div></div>';
        }
        return html;
    }
};
