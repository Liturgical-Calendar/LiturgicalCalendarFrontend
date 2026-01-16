/**
 * Admin Role Requests Management JavaScript
 *
 * Handles the admin interface for managing user role requests.
 * Uses the shared admin module base factory.
 */

/* global createAdminModule */

const AdminRoleRequests = createAdminModule({
    configName: 'AdminRoleRequestsConfig',
    entityName: 'role requests',
    containerPrefix: 'Requests',
    apiEndpoint: '/admin/role-requests',
    reviewBtnDataAttr: 'req',

    /**
     * Parse API response into status-grouped data
     * API returns pre-grouped data for role requests
     * @param {Object} data - API response
     * @returns {Object} Parsed items and counts
     */
    parseResponse(data) {
        return {
            items: {
                pending: data.pending_requests || [],
                approved: data.approved || [],
                rejected: data.rejected || [],
                revoked: data.revoked || []
            },
            counts: data.counts || null
        };
    },

    /**
     * Get table headers for a status
     * @param {string} status - Current status
     * @returns {string} Table header HTML
     */
    getTableHeaders(status) {
        return `
            <th>${this.config.i18n.user}</th>
            <th>${this.config.i18n.roleRequested}</th>
            <th>${this.config.i18n.date}</th>
            ${status !== 'pending' ? `<th>${this.config.i18n.reviewedAt}</th>` : ''}
            <th>${this.config.i18n.actions}</th>
        `;
    },

    /**
     * Render a single table row
     * @param {Object} req - Request data
     * @param {string} status - Current status
     * @returns {string} Table row HTML
     */
    renderTableRow(req, status) {
        const requestedDate = this.formatDate(req.created_at);
        const reviewedDate = this.formatDate(req.reviewed_at);
        const safeReqId = this.escapeHtml(String(req.id || ''));
        const roleName = this.getRoleName(req.requested_role);

        return `
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
    },

    /**
     * Render modal details for a role request
     * @param {Object} req - Request data
     * @param {string} status - Current status
     * @returns {string} Details HTML
     */
    renderModalDetails(req, status) {
        const requestedDate = this.formatDate(req.created_at);
        const reviewedDate = this.formatDate(req.reviewed_at);
        const roleName = this.getRoleName(req.requested_role);

        let html = `
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
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-comment me-2"></i>${this.config.i18n.justification}
                    </th>
                    <td><em>"${this.escapeHtml(req.justification)}"</em></td>
                </tr>
            `;
        }

        html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-info-circle me-2"></i>Status
                    </th>
                    <td>${this.renderStatusBadge(status)}</td>
                </tr>
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar me-2"></i>${this.config.i18n.requested}
                    </th>
                    <td>${requestedDate}</td>
                </tr>
        `;

        if (status !== 'pending' && req.reviewed_at) {
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar-check me-2"></i>${this.config.i18n.reviewedAt}
                    </th>
                    <td>${reviewedDate}</td>
                </tr>
            `;
        }

        if (req.review_notes) {
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-sticky-note me-2"></i>${this.config.i18n.reviewNotes}
                    </th>
                    <td><em>"${this.escapeHtml(req.review_notes)}"</em></td>
                </tr>
            `;
        }

        html += '</table>';
        return html;
    },

    /**
     * Get item ID from request
     * @param {Object} req - Request data
     * @returns {string} Request ID
     */
    getItemId(req) {
        return req.id;
    }
});

/**
 * Get display name for a role
 * @param {string} role - Role key
 * @returns {string} Display name
 */
AdminRoleRequests.getRoleName = function(role) {
    const roleNames = {
        developer: this.config.i18n.roleDeveloper,
        calendar_editor: this.config.i18n.roleCalendarEditor,
        test_editor: this.config.i18n.roleTestEditor
    };
    return roleNames[role] || role;
};

// Add i18n aliases for generic messages
Object.defineProperty(AdminRoleRequests, 'config', {
    get() {
        const config = window.AdminRoleRequestsConfig;
        if (config && !config.i18n.noPendingItems) {
            config.i18n.noPendingItems = config.i18n.noPendingRequests;
            config.i18n.noItems = config.i18n.noRequests;
        }
        return config;
    },
    set(value) {
        // Allow setting during init
        Object.defineProperty(this, '_config', { value, writable: true });
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => AdminRoleRequests.init());
