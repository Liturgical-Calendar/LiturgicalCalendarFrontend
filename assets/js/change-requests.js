/**
 * Your Change Requests (submitter view)
 *
 * Lists the caller's own source-data change request batches — scoped entirely
 * server-side, there is no submitter query parameter — lets them read what each
 * one proposes, and lets them withdraw one that is still `submitted`.
 *
 * Deliberately NOT built on `createAdminModule`: this page has no review tabs and
 * no approve/reject, and the one action it does have (`withdraw`) exists only on
 * the submitter's side of the API. It follows the shape of
 * `permission-requests.js` — a single table of your own requests, one action
 * column — and shares the batch-detail diff renderer with the reviewer's page via
 * `ChangeRequestCommon`.
 */

( function () {
    'use strict';

    const config = window.ChangeRequestsConfig;
    if (!config) {
        console.error('ChangeRequestsConfig not found');
        return;
    }

    const listBody = document.getElementById('changeRequestsBody');
    const detailBody = document.getElementById('changeRequestDetailBody');
    const detailModalEl = document.getElementById('changeRequestDetailModal');
    const alertsEl = document.getElementById('changeRequestAlerts');

    /** Batches keyed by batch_id, so an action can find its row's data again. */
    let batchesById = new Map();

    const escapeHtml = (text) => ChangeRequestCommon.escapeHtml(text);

    const formatDate = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '-';
        try {
            return date.toLocaleDateString(config.locale);
        } catch {
            return date.toLocaleDateString();
        }
    };

    const statusBadges = {
        submitted: { class: 'bg-warning text-dark', icon: 'fas fa-hourglass-half', key: 'statusSubmitted' },
        approved: { class: 'bg-success', icon: 'fas fa-check-circle', key: 'statusApproved' },
        rejected: { class: 'bg-danger', icon: 'fas fa-times-circle', key: 'statusRejected' },
        withdrawn: { class: 'bg-secondary', icon: 'fas fa-undo', key: 'statusWithdrawn' }
    };

    function renderStatusBadge(status) {
        const badge = statusBadges[status];
        if (!badge) return escapeHtml(status);
        return `<span class="badge ${badge.class}"><i class="${badge.icon} me-1"></i>${escapeHtml(config.i18n[badge.key])}</span>`;
    }

    function showAlert(type, message) {
        if (!alertsEl) return;
        alertsEl.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${escapeHtml(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="${escapeHtml(config.i18n.close)}"></button>
            </div>
        `;
    }

    /**
     * Link to the pull request a batch was published as, when the deployment
     * names the source-data repository. Otherwise the bare number: a wrong link
     * is worse than none.
     */
    function renderPullRequest(prNumber) {
        if (typeof prNumber !== 'number') return '';
        const repoUrl = config.repoUrl || '';
        if (repoUrl === '') return `#${escapeHtml(String(prNumber))}`;
        return `<a href="${escapeHtml(`${repoUrl}/pull/${prNumber}`)}" target="_blank" rel="noopener">#${escapeHtml(String(prNumber))}</a>`;
    }

    // ========================================================================
    // Loading
    // ========================================================================

    /**
     * Walk every page of `GET /auth/change-requests`.
     *
     * This route reports no `has_more` — the response schema says so explicitly,
     * because the caller's own batches are scoped in SQL with no post-filter step —
     * so the page boundary is `offset + <page length>` against `total`. A page
     * guard keeps a malformed response from looping forever.
     *
     * @returns {Promise<Array>} Every batch, oldest page first
     */
    async function loadAllBatches() {
        const limit = 100;
        const maxPages = 50;
        const all = [];
        let offset = 0;

        for (let page = 0; page < maxPages; page++) {
            const response = await fetch(
                `${config.apiUrl}/auth/change-requests?limit=${limit}&offset=${offset}`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || data.error || data.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const batches = Array.isArray(data.change_requests) ? data.change_requests : [];
            all.push(...batches);

            const total = typeof data.total === 'number' ? data.total : all.length;
            const nextOffset = ( data.offset ?? offset ) + batches.length;
            if (batches.length === 0 || nextOffset >= total || nextOffset <= offset) {
                break;
            }
            offset = nextOffset;
        }

        return all;
    }

    async function loadChangeRequests() {
        if (!listBody) return;

        listBody.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-spinner fa-spin me-2"></i>${escapeHtml(config.i18n.loading)}
            </div>
        `;

        try {
            const batches = await loadAllBatches();
            batchesById = new Map(batches.map(batch => [batch.batch_id, batch]));
            renderList(batches);
        } catch (error) {
            console.error('Error loading change requests:', error);
            listBody.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(config.i18n.failedToLoad)}
                    <br><small class="text-muted">${escapeHtml(error.message || '')}</small>
                </div>
            `;
        }
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    function renderList(batches) {
        if (batches.length === 0) {
            listBody.innerHTML = `
                <p class="text-muted mb-0">
                    <i class="fas fa-inbox me-2"></i>${escapeHtml(config.i18n.noChangeRequests)}
                </p>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
        html += `
            <thead>
                <tr>
                    <th>${escapeHtml(config.i18n.resource)}</th>
                    <th>${escapeHtml(config.i18n.files)}</th>
                    <th>${escapeHtml(config.i18n.status)}</th>
                    <th>${escapeHtml(config.i18n.publication)}</th>
                    <th>${escapeHtml(config.i18n.submitted)}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const batch of batches) {
            const safeBatchId = escapeHtml(batch.batch_id || '');

            let statusCell = renderStatusBadge(batch.review_status);
            // The rejection reason exists precisely so the submitter can read it —
            // it is returned to them as well as to reviewers, and it can also come
            // from the merge poller rather than a reviewer.
            if (batch.rejected_reason) {
                statusCell += `<br><small class="text-muted fst-italic">${escapeHtml(batch.rejected_reason)}</small>`;
            }
            if (batch.review_decision === 'approved' && batch.review_status === 'rejected') {
                statusCell += `<br><small class="text-muted fst-italic">${escapeHtml(config.i18n.approvedThenClosed)}</small>`;
            }

            const publicationLabel = ( config.i18n.publicationStatuses || {} )[batch.publication_status]
                || batch.publication_status || '';
            let publicationCell = `<small>${escapeHtml(publicationLabel)}</small>`;
            const prLink = renderPullRequest(batch.pr_number);
            if (prLink !== '') {
                publicationCell += `<br><small>${prLink}</small>`;
            }

            const withdrawBtn = batch.review_status === 'submitted'
                ? `<button class="btn btn-outline-warning btn-sm withdraw-btn ms-1"
                           data-batch-id="${safeBatchId}"
                           data-requires-auth>
                       <i class="fas fa-undo me-1"></i>${escapeHtml(config.i18n.withdraw)}
                   </button>`
                : '';

            html += `
                <tr id="batch-${safeBatchId}">
                    <td>${ChangeRequestCommon.renderResource(batch, config.i18n)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(String(batch.file_count ?? 0))}</span></td>
                    <td>${statusCell}</td>
                    <td>${publicationCell}</td>
                    <td><small>${escapeHtml(formatDate(batch.created_at))}</small></td>
                    <td class="text-nowrap">
                        <button class="btn btn-outline-primary btn-sm view-btn" data-batch-id="${safeBatchId}">
                            <i class="fas fa-eye me-1"></i>${escapeHtml(config.i18n.view)}
                        </button>
                        ${withdrawBtn}
                    </td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        listBody.innerHTML = html;

        listBody.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => openDetail(btn.dataset.batchId));
        });
        listBody.querySelectorAll('.withdraw-btn').forEach(btn => {
            btn.addEventListener('click', () => withdrawBatch(btn.dataset.batchId, btn));
        });

        scrollToAnchoredBatch();
    }

    /**
     * If the page was opened with `#batch-<uuid>` — which is how a change-request
     * notification links here — scroll that row into view and highlight it briefly.
     */
    function scrollToAnchoredBatch() {
        const hash = window.location.hash;
        if (!hash.startsWith('#batch-')) return;

        const target = document.getElementById(hash.slice(1));
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('table-warning');
        setTimeout(() => target.classList.remove('table-warning'), 2500);
    }

    // ========================================================================
    // Detail
    // ========================================================================

    // Bumped on every openDetail() call. A reviewer clicking batch A then batch B
    // before A's request settles would otherwise have A's diff overwrite B's, in
    // whichever order the two responses happen to land.
    let detailRequestSeq = 0;

    async function openDetail(batchId) {
        const batch = batchesById.get(batchId);
        if (!batch || !detailBody || !detailModalEl) return;

        const seq = ++detailRequestSeq;

        detailBody.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-spinner fa-spin me-2"></i>${escapeHtml(config.i18n.loading)}
            </div>
        `;
        bootstrap.Modal.getOrCreateInstance(detailModalEl).show();

        try {
            // `GET /auth/change-requests/{batchId}` returns the same
            // ChangeRequestBatchDetail body the reviewer's route does, so the diff
            // renderer is shared verbatim.
            const detail = await ChangeRequestCommon.fetchBatchDetail(config.apiUrl, 'auth', batchId);
            if (seq !== detailRequestSeq) return;
            detailBody.innerHTML = ChangeRequestCommon.renderBatchFiles(detail, config.i18n, config.locale);
        } catch (error) {
            console.error('Failed to load change request detail:', error);
            // A stale failure must not replace the newer batch's content either.
            if (seq !== detailRequestSeq) return;
            detailBody.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(config.i18n.failedToLoadDetail)}
                    <br><small class="text-muted">${escapeHtml(error.message || '')}</small>
                </div>
            `;
        }
    }

    // ========================================================================
    // Withdraw
    // ========================================================================

    /**
     * Withdraw one of the caller's own still-submitted batches.
     *
     * The endpoint answers 404 — never 403 — both for "not yours" and for "already
     * decided", so a 404 here is reported as "it moved, reloading" rather than as a
     * missing resource.
     */
    async function withdrawBatch(batchId, btn) {
        if (!batchId) return;
        if (!window.confirm(config.i18n.confirmWithdraw)) return;

        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i>${escapeHtml(config.i18n.processing)}`;

        try {
            const response = await fetch(
                `${config.apiUrl}/auth/change-requests/${encodeURIComponent(batchId)}/withdraw`,
                {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                }
            );

            if (response.status === 404) {
                showAlert('warning', config.i18n.withdrawGone);
                await loadChangeRequests();
                return;
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || data.error || data.message || `HTTP ${response.status}`);
            }

            showAlert('success', config.i18n.withdrawSuccess);
            await loadChangeRequests();
            // The bell counts change-request events, so it is stale the moment this
            // batch stops being pending.
            if (typeof Notifications !== 'undefined' && Notifications.fetchNotifications) {
                Notifications.fetchNotifications();
            }
        } catch (error) {
            console.error('Error withdrawing change request:', error);
            showAlert('danger', error.message || config.i18n.withdrawFailed);
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        const icon = document.querySelector('#refreshBtn i');
        icon?.classList.add('fa-spin');
        loadChangeRequests().finally(() => icon?.classList.remove('fa-spin'));
    });

    loadChangeRequests();
} )();
