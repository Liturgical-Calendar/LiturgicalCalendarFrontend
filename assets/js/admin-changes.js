/**
 * Change Request Review (admin / resource admin)
 *
 * The reviewer's queue for source-data change requests. Global admins see every
 * batch; resource admins see only the batches for resources they administer —
 * that filtering is entirely server-side, and approve/reject re-check
 * authorization against the specific batch id rather than trusting this list.
 *
 * Built on the shared admin module factory, with the change-request status
 * vocabulary (`submitted`/`approved`/`rejected`/`withdrawn`) supplied as options.
 * `withdrawn` is a SUBMITTER transition — there is no admin endpoint for it — so
 * it appears as a tab and a badge but never as a button.
 */

const AdminChanges = createAdminModule({
    configName: 'AdminChangesConfig',
    entityName: 'change requests',
    containerPrefix: 'Changes',
    apiEndpoint: '/admin/change-requests',
    reviewBtnDataAttr: 'batch',
    detailsContainerIds: ['changeRequestDetails'],

    statuses: ['submitted', 'approved', 'rejected', 'withdrawn'],
    attentionStatus: 'submitted',

    statusBadges: {
        submitted: { class: 'bg-warning text-dark', icon: 'fas fa-hourglass-half', i18nKey: 'statusSubmitted' },
        approved: { class: 'bg-success', icon: 'fas fa-check-circle', i18nKey: 'statusApproved' },
        rejected: { class: 'bg-danger', icon: 'fas fa-times-circle', i18nKey: 'statusRejected' },
        withdrawn: { class: 'bg-secondary', icon: 'fas fa-undo', i18nKey: 'statusWithdrawn' }
    },

    // Only a submitted batch can be decided. Approved, rejected and withdrawn are
    // terminal for a reviewer: the API offers no endpoint to reopen any of them.
    actionsForStatus: (status) => ( status === 'submitted' ? ['approve', 'reject'] : [] ),
    actionButtonIds: { approve: 'approveBtn', reject: 'rejectBtn' },

    /**
     * `POST /admin/change-requests/{batchId}/reject` takes `{reason?}` and is
     * `additionalProperties: false`, so the applications-shaped `{notes}` default
     * would be a 400. Approve declares no body at all; `{}` satisfies the handler's
     * JSON content-type without asserting anything.
     */
    buildActionBody: (action, notes) => ( action === 'reject' && notes ? { reason: notes } : {} ),

    /**
     * `has_more` is derived server-side from the PRE-filter SQL page size, so a
     * resource admin's page can come back with zero visible batches while later
     * pages still hold ones they may act on. Paging must therefore follow
     * `has_more` and never the emptiness of the page just received.
     */
    pagination: {
        limit: 100,
        maxPages: 50,
        getItems: (data) => data.change_requests || [],
        getHasMore: (data) => data.has_more === true
    },

    getItemId(batch) {
        return batch.batch_id;
    },

    /**
     * Bucket the aggregated batches by review status.
     * @param {{items: Array, pages: number, total: number|null}} data
     */
    parseResponse(data) {
        const items = {
            submitted: [],
            approved: [],
            rejected: [],
            withdrawn: []
        };

        for (const batch of ( data.items || [] )) {
            const status = batch.review_status;
            if (items[status]) {
                items[status].push(batch);
            }
        }

        return { items, counts: null };
    },

    getTableHeaders(status) {
        return `
            <th>${this.escapeHtml(this.config.i18n.resource)}</th>
            <th>${this.escapeHtml(this.config.i18n.submittedBy)}</th>
            <th>${this.escapeHtml(this.config.i18n.files)}</th>
            <th>${this.escapeHtml(this.config.i18n.submitted)}</th>
            ${status !== 'submitted' ? `<th>${this.escapeHtml(this.config.i18n.outcome)}</th>` : ''}
            <th>${this.escapeHtml(this.config.i18n.actions)}</th>
        `;
    },

    renderTableRow(batch, status) {
        // ChangeRequestCommon.escapeHtml, not the factory's: these land inside quoted
        // attributes, and only that one escapes quotes.
        const safeBatchId = ChangeRequestCommon.escapeHtml(batch.batch_id || '');
        // The batch carries submitted_by_name / submitted_by_email, so the submitter
        // renders without a /admin/users lookup — the same cheap route the
        // access-request tables take. (approved_by_sub has no such companion columns,
        // which is why no reviewer identity is shown anywhere on this page.)
        const submitter = batch.submitted_by_name || batch.submitted_by_email || this.config.i18n.unknownUser;
        const email = batch.submitted_by_email && batch.submitted_by_name
            ? `<br><small class="text-muted">${this.escapeHtml(batch.submitted_by_email)}</small>`
            : '';
        const actionLabel = status === 'submitted' ? this.config.i18n.review : this.config.i18n.view;

        return `
            <tr id="batch-${safeBatchId}">
                <td>${ChangeRequestCommon.renderResource(batch, this.config.i18n)}</td>
                <td><strong>${this.escapeHtml(submitter)}</strong>${email}</td>
                <td><span class="badge bg-light text-dark border">${this.escapeHtml(String(batch.file_count ?? 0))}</span></td>
                <td><small>${this.formatDate(batch.created_at)}</small></td>
                ${status !== 'submitted' ? `<td>${this.renderOutcome(batch)}</td>` : ''}
                <td>
                    <button class="btn btn-outline-primary btn-sm review-btn"
                            data-batch-id="${safeBatchId}"
                            data-batch-status="${ChangeRequestCommon.escapeHtml(status)}"
                            data-requires-auth>
                        <i class="fas fa-eye me-1"></i>${this.escapeHtml(actionLabel)}
                    </button>
                </td>
            </tr>
        `;
    },

    /**
     * What became of a decided batch.
     *
     * `review_decision` is the frozen human decision; `review_status` is where the
     * batch currently sits and CAN diverge from it — a published pull request closed
     * without merging moves an approved batch to `rejected` so it stays out of the
     * accumulation base. When the two disagree, say so rather than implying a
     * reviewer refused something they approved.
     */
    renderOutcome(batch) {
        const parts = [this.renderStatusBadge(batch.review_status)];

        if (batch.review_decision === 'approved' && batch.review_status === 'rejected') {
            parts.push(`<br><small class="text-muted fst-italic">${this.escapeHtml(this.config.i18n.approvedThenClosed)}</small>`);
        }

        if (batch.rejected_reason) {
            const reason = batch.rejected_reason.length > 80
                ? `${batch.rejected_reason.slice(0, 80)}…`
                : batch.rejected_reason;
            parts.push(`<br><small class="text-muted fst-italic">${this.escapeHtml(reason)}</small>`);
        }

        return parts.join('');
    },

    /**
     * The batch summary. The proposed file contents are fetched separately by
     * `onDetailsRendered` below and dropped into `#changeRequestFiles`.
     */
    renderModalDetails(batch) {
        const rows = [];

        const row = (icon, label, value) => `
            <tr>
                <th class="text-muted" style="width: 35%;"><i class="fas ${icon} me-2"></i>${this.escapeHtml(label)}</th>
                <td>${value}</td>
            </tr>
        `;

        rows.push(row('fa-folder-open', this.config.i18n.resource, ChangeRequestCommon.renderResource(batch, this.config.i18n)));
        rows.push(row(
            'fa-user',
            this.config.i18n.submittedBy,
            `<strong>${this.escapeHtml(batch.submitted_by_name || batch.submitted_by_email || this.config.i18n.unknownUser)}</strong>`
            + ( batch.submitted_by_email && batch.submitted_by_name
                ? `<br><small class="text-muted">${this.escapeHtml(batch.submitted_by_email)}</small>`
                : '' )
        ));
        rows.push(row('fa-info-circle', this.config.i18n.status, this.renderStatusBadge(batch.review_status)));

        if (batch.review_decision) {
            const decisionLabel = batch.review_decision === 'approved'
                ? this.config.i18n.statusApproved
                : this.config.i18n.statusRejected;
            let decisionHtml = this.escapeHtml(decisionLabel);
            if (batch.review_decision === 'approved' && batch.review_status === 'rejected') {
                decisionHtml += `<br><small class="text-muted fst-italic">${this.escapeHtml(this.config.i18n.approvedThenClosed)}</small>`;
            }
            rows.push(row('fa-gavel', this.config.i18n.reviewDecision, decisionHtml));
        }

        if (batch.rejected_reason) {
            rows.push(row('fa-comment', this.config.i18n.rejectedReason, `<em>${this.escapeHtml(batch.rejected_reason)}</em>`));
        }

        rows.push(row('fa-calendar', this.config.i18n.submitted, this.escapeHtml(this.formatDate(batch.created_at))));

        const publicationLabel = ( this.config.i18n.publicationStatuses || {} )[batch.publication_status]
            || batch.publication_status;
        let publicationHtml = this.escapeHtml(publicationLabel);
        if (batch.publication_settled_at) {
            publicationHtml += `<br><small class="text-muted">${this.escapeHtml(this.formatDate(batch.publication_settled_at))}</small>`;
        }
        rows.push(row('fa-code-branch', this.config.i18n.publication, publicationHtml));

        const prLink = this.renderPullRequestLink(batch.pr_number);
        if (prLink !== '') {
            rows.push(row('fa-code-pull-request', this.config.i18n.pullRequest, prLink));
        }

        return `<table class="table table-borderless mb-3">${rows.join('')}</table>`
            + `<h6 class="fw-bold">${this.escapeHtml(this.config.i18n.proposedChanges)}</h6>`
            + `<div id="changeRequestFiles">
                   <div class="text-center text-muted py-3">
                       <i class="fas fa-spinner fa-spin me-2"></i>${this.escapeHtml(this.config.i18n.loading)}
                   </div>
               </div>`;
    },

    /**
     * Link to the pull request a batch was published as. `repoUrl` is empty unless
     * the deployment names the source-data repository, in which case only the bare
     * number is shown — a wrong link is worse than none.
     */
    renderPullRequestLink(prNumber) {
        if (typeof prNumber !== 'number') {
            return '';
        }
        const repoUrl = this.config.repoUrl || '';
        if (repoUrl === '') {
            return `#${this.escapeHtml(String(prNumber))}`;
        }
        return `<a href="${ChangeRequestCommon.escapeHtml(`${repoUrl}/pull/${prNumber}`)}" target="_blank" rel="noopener">`
            + `#${this.escapeHtml(String(prNumber))}</a>`;
    },

    /**
     * Fetch what the batch actually proposes and render it as a before/after diff.
     *
     * This is the whole point of the review page: approval is the only human gate in
     * the design, and a reviewer who can see only a list of paths cannot use it.
     */
    async onDetailsRendered(batch) {
        const container = document.getElementById('changeRequestFiles');
        if (!container) return;

        try {
            const detail = await ChangeRequestCommon.fetchBatchDetail(
                this.config.apiUrl,
                'admin',
                batch.batch_id
            );
            // Guard against a slow response landing after the reviewer moved on.
            if (this.currentItemId !== batch.batch_id) return;
            container.innerHTML = ChangeRequestCommon.renderBatchFiles(detail, this.config.i18n, this.config.locale);
        } catch (error) {
            console.error('Failed to load change request detail:', error);
            container.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${ChangeRequestCommon.escapeHtml(this.config.i18n.failedToLoadDetail)}
                    <br><small class="text-muted">${ChangeRequestCommon.escapeHtml(error.message || '')}</small>
                </div>
            `;
        }
    }
});

// Alias the entity-specific empty-state strings onto the generic keys the base
// factory reads, the same way admin-applications.js does.
Object.defineProperty(AdminChanges, 'config', {
    get() {
        return this._config || window.AdminChangesConfig;
    },
    set(value) {
        if (value && value.i18n && !value.i18n.noPendingItems) {
            value.i18n.noPendingItems = value.i18n.noPendingChanges;
            value.i18n.noItems = value.i18n.noChangeRequests;
        }
        this._config = value;
    }
});

document.addEventListener('DOMContentLoaded', () => AdminChanges.init());
