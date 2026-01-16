/**
 * Admin Role Requests Management JavaScript
 *
 * Handles the admin interface for managing user role requests.
 */

const AdminRoleRequests = {
    requests: {
        pending: [],
        approved: [],
        rejected: [],
        revoked: []
    },
    currentRequestId: null,
    currentRequestStatus: null,
    modals: {},
    config: null,

    /**
     * Initialize the admin role requests page
     */
    init() {
        this.config = window.AdminRoleRequestsConfig;
        if (!this.config) {
            console.error('AdminRoleRequestsConfig not found');
            return;
        }

        // Initialize Bootstrap modal
        this.modals.review = new bootstrap.Modal(document.getElementById('reviewModal'));

        // Bind event handlers
        this.bindEvents();

        // Load requests
        this.loadRequests();
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            const icon = document.querySelector('#refreshBtn i');
            icon?.classList.add('fa-spin');
            this.loadRequests().finally(() => {
                icon?.classList.remove('fa-spin');
            });
        });

        // Tab change events - load data when tab is shown
        document.querySelectorAll('#statusTabs button[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', () => this.renderCurrentTab());
        });

        // Action buttons in modal
        document.getElementById('approveBtn')?.addEventListener('click', () => this.processRequest('approve'));
        document.getElementById('rejectBtn')?.addEventListener('click', () => this.processRequest('reject'));
        document.getElementById('revokeBtn')?.addEventListener('click', () => this.processRequest('revoke'));
    },

    /**
     * Load all role requests from API
     */
    async loadRequests() {
        // Show loading state in all containers
        ['pending', 'approved', 'rejected', 'revoked'].forEach(status => {
            const container = document.getElementById(`${status}RequestsBody`);
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i>${this.config.i18n.loading}
                    </div>
                `;
            }
        });

        try {
            const response = await fetch(`${this.config.apiUrl}/admin/role-requests`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load role requests');
            }

            const data = await response.json();

            // API returns pre-grouped data
            this.requests = {
                pending: data.pending_requests || [],
                approved: data.approved || [],
                rejected: data.rejected || [],
                revoked: data.revoked || []
            };

            // Update counts (API also provides counts object)
            this.updateCounts(data.counts);

            // Render the current active tab
            this.renderCurrentTab();
        } catch (error) {
            console.error('Error loading role requests:', error);
            ['pending', 'approved', 'rejected', 'revoked'].forEach(status => {
                const container = document.getElementById(`${status}RequestsBody`);
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${this.config.i18n.failedToLoad}
                        </div>
                    `;
                }
                // Also update counts to show error state
                const countEl = document.getElementById(`${status}Count`);
                if (countEl) {
                    countEl.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i>';
                }
            });
            // Update the pending badge too
            const pendingBadge = document.getElementById('pendingBadge');
            if (pendingBadge) {
                pendingBadge.textContent = '-';
            }
        }
    },

    /**
     * Update count displays
     * @param {Object|null} apiCounts - Optional counts from API response
     */
    updateCounts(apiCounts = null) {
        const counts = apiCounts || {
            pending: this.requests.pending.length,
            approved: this.requests.approved.length,
            rejected: this.requests.rejected.length,
            revoked: this.requests.revoked.length
        };

        document.getElementById('pendingCount').textContent = counts.pending ?? 0;
        document.getElementById('approvedCount').textContent = counts.approved ?? 0;
        document.getElementById('rejectedCount').textContent = counts.rejected ?? 0;
        document.getElementById('revokedCount').textContent = counts.revoked ?? 0;
        document.getElementById('pendingBadge').textContent = counts.pending ?? 0;
    },

    /**
     * Render the currently active tab
     */
    renderCurrentTab() {
        const activeTab = document.querySelector('#statusTabs button.active');
        if (!activeTab) return;

        const status = activeTab.id.replace('-tab', '');
        this.renderRequestsList(status);
    },

    /**
     * Render requests list for a specific status
     * @param {string} status - Request status
     */
    renderRequestsList(status) {
        const container = document.getElementById(`${status}RequestsBody`);
        if (!container) return;

        const reqs = this.requests[status] || [];

        if (reqs.length === 0) {
            const message = status === 'pending'
                ? this.config.i18n.noPendingRequests
                : this.config.i18n.noRequests;
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-${status === 'pending' ? 'check-circle text-success' : 'inbox'} fa-3x mb-3"></i>
                    <p class="mb-0">${message}</p>
                </div>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
        html += `
            <thead>
                <tr>
                    <th>${this.config.i18n.user}</th>
                    <th>${this.config.i18n.roleRequested}</th>
                    <th>${this.config.i18n.date}</th>
                    ${status !== 'pending' ? `<th>${this.config.i18n.reviewedAt}</th>` : ''}
                    <th>${this.config.i18n.actions}</th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const req of reqs) {
            const requestedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : '-';
            const reviewedDate = req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '-';
            const safeReqId = this.escapeHtml(String(req.id || ''));
            const roleName = this.getRoleName(req.requested_role);

            html += `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(req.user_name || '-')}</strong>
                        ${req.user_email ? `<br><small class="text-muted">${this.escapeHtml(req.user_email)}</small>` : ''}
                    </td>
                    <td><span class="badge bg-info">${roleName}</span></td>
                    <td><small>${requestedDate}</small></td>
                    ${status !== 'pending' ? `<td><small>${reviewedDate}</small></td>` : ''}
                    <td>
                        <button class="btn btn-outline-primary btn-sm review-btn"
                                data-req-id="${safeReqId}"
                                data-req-status="${status}">
                            <i class="fas fa-eye me-1"></i>${this.config.i18n.review}
                        </button>
                    </td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Add event listeners to review buttons
        container.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openReviewModal(btn.dataset.reqId, btn.dataset.reqStatus);
            });
        });
    },

    /**
     * Get display name for a role
     * @param {string} role - Role key
     * @returns {string} Display name
     */
    getRoleName(role) {
        const roleNames = {
            developer: this.config.i18n.roleDeveloper,
            calendar_editor: this.config.i18n.roleCalendarEditor,
            test_editor: this.config.i18n.roleTestEditor
        };
        return roleNames[role] || role;
    },

    /**
     * Open the review modal for a request
     * @param {string} reqId - Request ID
     * @param {string} status - Current status
     */
    openReviewModal(reqId, status) {
        const req = this.requests[status]?.find(r => String(r.id) === reqId);
        if (!req) return;

        this.currentRequestId = reqId;
        this.currentRequestStatus = status;

        // Reset modal state
        document.getElementById('reviewNotes').value = '';
        document.getElementById('modalAlerts').innerHTML = '';

        // Show/hide appropriate buttons based on status
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        const revokeBtn = document.getElementById('revokeBtn');
        const notesSection = document.getElementById('notesSection');

        approveBtn.classList.add('d-none');
        rejectBtn.classList.add('d-none');
        revokeBtn.classList.add('d-none');
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        revokeBtn.disabled = false;

        if (status === 'pending') {
            approveBtn.classList.remove('d-none');
            rejectBtn.classList.remove('d-none');
            notesSection?.classList.remove('d-none');
        } else if (status === 'approved') {
            // For approved requests, show the revoke button
            revokeBtn.classList.remove('d-none');
            notesSection?.classList.remove('d-none');
        } else {
            // For rejected/revoked requests, hide the notes input
            notesSection?.classList.add('d-none');
        }

        // Build request details
        const requestedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : '-';
        const reviewedDate = req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '-';
        const roleName = this.getRoleName(req.requested_role);

        const statusBadges = {
            pending: `<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>${this.config.i18n.statusPending}</span>`,
            approved: `<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>${this.config.i18n.statusApproved}</span>`,
            rejected: `<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>${this.config.i18n.statusRejected}</span>`,
            revoked: `<span class="badge bg-secondary"><i class="fas fa-ban me-1"></i>${this.config.i18n.statusRevoked}</span>`
        };

        let detailsHtml = `
            <table class="table table-borderless mb-0">
                <tr>
                    <th class="text-muted" style="width: 35%;">
                        <i class="fas fa-user me-2"></i>${this.config.i18n.user}
                    </th>
                    <td>
                        <strong>${this.escapeHtml(req.user_name || '-')}</strong>
                        ${req.user_email ? `<br><small class="text-muted">${this.escapeHtml(req.user_email)}</small>` : ''}
                    </td>
                </tr>
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-user-tag me-2"></i>${this.config.i18n.requestedRole}
                    </th>
                    <td><span class="badge bg-info">${roleName}</span></td>
                </tr>
        `;

        if (req.justification) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-comment me-2"></i>${this.config.i18n.justification}
                    </th>
                    <td><em>"${this.escapeHtml(req.justification)}"</em></td>
                </tr>
            `;
        }

        detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-info-circle me-2"></i>Status
                    </th>
                    <td>${statusBadges[status] || status}</td>
                </tr>
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar me-2"></i>${this.config.i18n.requested}
                    </th>
                    <td>${requestedDate}</td>
                </tr>
        `;

        if (status !== 'pending' && req.reviewed_at) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar-check me-2"></i>${this.config.i18n.reviewedAt}
                    </th>
                    <td>${reviewedDate}</td>
                </tr>
            `;
        }

        if (req.review_notes) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-sticky-note me-2"></i>${this.config.i18n.reviewNotes}
                    </th>
                    <td><em>"${this.escapeHtml(req.review_notes)}"</em></td>
                </tr>
            `;
        }

        detailsHtml += '</table>';

        document.getElementById('requestDetails').innerHTML = detailsHtml;
        this.modals.review.show();
    },

    /**
     * Process a request (approve/reject/revoke)
     * @param {string} action - Action to perform
     */
    async processRequest(action) {
        if (!this.currentRequestId) return;

        const notes = document.getElementById('reviewNotes').value.trim();
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        const revokeBtn = document.getElementById('revokeBtn');
        const modalAlerts = document.getElementById('modalAlerts');

        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        revokeBtn.disabled = true;

        const btnMap = { approve: approveBtn, reject: rejectBtn, revoke: revokeBtn };
        const btn = btnMap[action];
        const originalText = btn?.innerHTML || '';

        if (btn) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i>${this.config.i18n.processing}`;
        }

        try {
            const response = await fetch(
                `${this.config.apiUrl}/admin/role-requests/${encodeURIComponent(this.currentRequestId)}/${action}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        notes: notes || null
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Request failed');
            }

            // Show success message
            const successMessages = {
                approve: this.config.i18n.approveSuccess,
                reject: this.config.i18n.rejectSuccess,
                revoke: this.config.i18n.revokeSuccess
            };

            modalAlerts.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    ${this.escapeHtml(data.message || successMessages[action])}
                </div>
            `;

            // Reload after a short delay
            setTimeout(() => {
                this.modals.review.hide();
                this.loadRequests();
            }, 1500);
        } catch (error) {
            console.error('Error processing request:', error);
            modalAlerts.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${this.escapeHtml(error.message || this.config.i18n.failedToProcess)}
                </div>
            `;
            approveBtn.disabled = false;
            rejectBtn.disabled = false;
            revokeBtn.disabled = false;
            if (btn) {
                btn.innerHTML = originalText;
            }
        }
    },

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => AdminRoleRequests.init());
