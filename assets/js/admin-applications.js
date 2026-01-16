/**
 * Admin Applications Management JavaScript
 *
 * Handles the admin interface for managing developer application approvals.
 */

const AdminApplications = {
    applications: {
        pending: [],
        approved: [],
        rejected: [],
        revoked: []
    },
    currentApplicationId: null,
    currentApplicationStatus: null,
    modals: {},
    config: null,

    /**
     * Initialize the admin applications page
     */
    init() {
        this.config = window.AdminApplicationsConfig;
        if (!this.config) {
            console.error('AdminApplicationsConfig not found');
            return;
        }

        // Initialize Bootstrap modal
        this.modals.review = new bootstrap.Modal(document.getElementById('reviewModal'));

        // Bind event handlers
        this.bindEvents();

        // Load applications
        this.loadApplications();
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            const icon = document.querySelector('#refreshBtn i');
            icon?.classList.add('fa-spin');
            this.loadApplications().finally(() => {
                icon?.classList.remove('fa-spin');
            });
        });

        // Tab change events - load data when tab is shown
        document.querySelectorAll('#statusTabs button[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', () => this.renderCurrentTab());
        });

        // Action buttons in modal
        document.getElementById('approveBtn')?.addEventListener('click', () => this.processApplication('approve'));
        document.getElementById('rejectBtn')?.addEventListener('click', () => this.processApplication('reject'));
        document.getElementById('revokeBtn')?.addEventListener('click', () => this.processApplication('revoke'));
    },

    /**
     * Load all applications from API
     */
    async loadApplications() {
        // Show loading state in all containers
        ['pending', 'approved', 'rejected', 'revoked'].forEach(status => {
            const container = document.getElementById(`${status}ApplicationsBody`);
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i>${this.config.i18n.loading}
                    </div>
                `;
            }
        });

        try {
            const response = await fetch(`${this.config.apiUrl}/admin/applications`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load applications');
            }

            const data = await response.json();

            // Group applications by status
            this.applications = {
                pending: [],
                approved: [],
                rejected: [],
                revoked: []
            };

            for (const app of (data.applications || [])) {
                const status = app.status || 'pending';
                if (this.applications[status]) {
                    this.applications[status].push(app);
                }
            }

            // Update counts
            this.updateCounts();

            // Render the current active tab
            this.renderCurrentTab();
        } catch (error) {
            console.error('Error loading applications:', error);
            ['pending', 'approved', 'rejected', 'revoked'].forEach(status => {
                const container = document.getElementById(`${status}ApplicationsBody`);
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
     */
    updateCounts() {
        const counts = {
            pending: this.applications.pending.length,
            approved: this.applications.approved.length,
            rejected: this.applications.rejected.length,
            revoked: this.applications.revoked.length
        };

        document.getElementById('pendingCount').textContent = counts.pending;
        document.getElementById('approvedCount').textContent = counts.approved;
        document.getElementById('rejectedCount').textContent = counts.rejected;
        document.getElementById('revokedCount').textContent = counts.revoked;
        document.getElementById('pendingBadge').textContent = counts.pending;
    },

    /**
     * Render the currently active tab
     */
    renderCurrentTab() {
        const activeTab = document.querySelector('#statusTabs button.active');
        if (!activeTab) return;

        const status = activeTab.id.replace('-tab', '');
        this.renderApplicationsList(status);
    },

    /**
     * Render applications list for a specific status
     * @param {string} status - Application status
     */
    renderApplicationsList(status) {
        const container = document.getElementById(`${status}ApplicationsBody`);
        if (!container) return;

        const apps = this.applications[status] || [];

        if (apps.length === 0) {
            const message = status === 'pending'
                ? this.config.i18n.noPendingApplications
                : this.config.i18n.noApplications;
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
                    <th>${this.config.i18n.application}</th>
                    <th>${this.config.i18n.user}</th>
                    <th>${this.config.i18n.created}</th>
                    ${status !== 'pending' ? `<th>${this.config.i18n.reviewedAt}</th>` : ''}
                    <th>${this.config.i18n.actions}</th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const app of apps) {
            const createdDate = app.created_at ? new Date(app.created_at).toLocaleDateString() : '-';
            const reviewedDate = app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : '-';
            const safeAppId = this.escapeHtml(app.id || app.uuid || '');

            html += `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(app.name)}</strong>
                        ${app.description ? `<br><small class="text-muted">${this.escapeHtml(app.description)}</small>` : ''}
                    </td>
                    <td>
                        <strong>${this.escapeHtml(app.user_name || '-')}</strong>
                        ${app.user_email ? `<br><small class="text-muted">${this.escapeHtml(app.user_email)}</small>` : ''}
                    </td>
                    <td><small>${createdDate}</small></td>
                    ${status !== 'pending' ? `<td><small>${reviewedDate}</small></td>` : ''}
                    <td>
                        <button class="btn btn-outline-primary btn-sm review-btn"
                                data-app-id="${safeAppId}"
                                data-app-status="${status}">
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
                this.openReviewModal(btn.dataset.appId, btn.dataset.appStatus);
            });
        });
    },

    /**
     * Open the review modal for an application
     * @param {string} appId - Application ID
     * @param {string} status - Current status
     */
    openReviewModal(appId, status) {
        const app = this.applications[status]?.find(a => (a.id || a.uuid) === appId);
        if (!app) return;

        this.currentApplicationId = appId;
        this.currentApplicationStatus = status;

        // Reset modal state
        document.getElementById('reviewNotes').value = '';
        document.getElementById('modalAlerts').innerHTML = '';

        // Show/hide appropriate buttons based on status
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        const revokeBtn = document.getElementById('revokeBtn');

        approveBtn.classList.add('d-none');
        rejectBtn.classList.add('d-none');
        revokeBtn.classList.add('d-none');
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        revokeBtn.disabled = false;

        if (status === 'pending') {
            approveBtn.classList.remove('d-none');
            rejectBtn.classList.remove('d-none');
        } else if (status === 'approved') {
            revokeBtn.classList.remove('d-none');
        } else if (status === 'rejected') {
            approveBtn.classList.remove('d-none');
        }

        // Build application details
        const createdDate = app.created_at ? new Date(app.created_at).toLocaleDateString() : '-';
        const reviewedDate = app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : '-';

        const statusBadges = {
            pending: '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>' + this.config.i18n.statusPending + '</span>',
            approved: '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>' + this.config.i18n.statusApproved + '</span>',
            rejected: '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>' + this.config.i18n.statusRejected + '</span>',
            revoked: '<span class="badge bg-secondary"><i class="fas fa-ban me-1"></i>' + this.config.i18n.statusRevoked + '</span>'
        };

        let detailsHtml = `
            <table class="table table-borderless mb-0">
                <tr>
                    <th class="text-muted" style="width: 35%;">
                        <i class="fas fa-cube me-2"></i>${this.config.i18n.application}
                    </th>
                    <td><strong>${this.escapeHtml(app.name)}</strong></td>
                </tr>
        `;

        if (app.description) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-align-left me-2"></i>${this.config.i18n.description}
                    </th>
                    <td>${this.escapeHtml(app.description)}</td>
                </tr>
            `;
        }

        if (app.website) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-globe me-2"></i>${this.config.i18n.website}
                    </th>
                    <td><a href="${this.escapeHtml(app.website)}" target="_blank" rel="noopener">${this.escapeHtml(app.website)}</a></td>
                </tr>
            `;
        }

        detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-user me-2"></i>${this.config.i18n.user}
                    </th>
                    <td>
                        <strong>${this.escapeHtml(app.user_name || '-')}</strong>
                        ${app.user_email ? `<br><small class="text-muted">${this.escapeHtml(app.user_email)}</small>` : ''}
                    </td>
                </tr>
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-info-circle me-2"></i>${this.config.i18n.status}
                    </th>
                    <td>${statusBadges[status] || status}</td>
                </tr>
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar me-2"></i>${this.config.i18n.created}
                    </th>
                    <td>${createdDate}</td>
                </tr>
        `;

        if (status !== 'pending' && app.reviewed_at) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar-check me-2"></i>${this.config.i18n.reviewedAt}
                    </th>
                    <td>${reviewedDate}</td>
                </tr>
            `;
        }

        if (app.review_notes) {
            detailsHtml += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-comment me-2"></i>${this.config.i18n.reviewNotes}
                    </th>
                    <td><em>"${this.escapeHtml(app.review_notes)}"</em></td>
                </tr>
            `;
        }

        detailsHtml += '</table>';

        document.getElementById('applicationDetails').innerHTML = detailsHtml;
        this.modals.review.show();
    },

    /**
     * Process an application (approve/reject/revoke)
     * @param {string} action - Action to perform
     */
    async processApplication(action) {
        if (!this.currentApplicationId) return;

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
                `${this.config.apiUrl}/admin/applications/${encodeURIComponent(this.currentApplicationId)}/${action}`,
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
                this.loadApplications();
            }, 1500);
        } catch (error) {
            console.error('Error processing application:', error);
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
document.addEventListener('DOMContentLoaded', () => AdminApplications.init());
