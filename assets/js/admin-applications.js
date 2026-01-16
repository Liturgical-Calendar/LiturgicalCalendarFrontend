/**
 * Admin Applications Management JavaScript
 *
 * Handles the admin interface for managing developer application approvals.
 * Uses the shared admin module base factory.
 */

const AdminApplications = createAdminModule({
    configName: 'AdminApplicationsConfig',
    entityName: 'applications',
    containerPrefix: 'Applications',
    apiEndpoint: '/admin/applications',
    reviewBtnDataAttr: 'app',

    /**
     * Parse API response into status-grouped data
     * @param {Object} data - API response
     * @returns {Object} Parsed items and counts
     */
    parseResponse(data) {
        const items = {
            pending: [],
            approved: [],
            rejected: [],
            revoked: []
        };

        for (const app of (data.applications || [])) {
            const status = app.status || 'pending';
            if (items[status]) {
                items[status].push(app);
            }
        }

        return {
            items,
            counts: null // Calculate from items
        };
    },

    /**
     * Get table headers for a status
     * @param {string} status - Current status
     * @returns {string} Table header HTML
     */
    getTableHeaders(status) {
        return `
            <th>${this.config.i18n.application}</th>
            <th>${this.config.i18n.user}</th>
            <th>${this.config.i18n.created}</th>
            ${status !== 'pending' ? `<th>${this.config.i18n.reviewedAt}</th>` : ''}
            <th>${this.config.i18n.actions}</th>
        `;
    },

    /**
     * Render a single table row
     * @param {Object} app - Application data
     * @param {string} status - Current status
     * @returns {string} Table row HTML
     */
    renderTableRow(app, status) {
        const createdDate = this.formatDate(app.created_at);
        const reviewedDate = this.formatDate(app.reviewed_at);
        const safeAppId = this.escapeHtml(app.id || app.uuid || '');

        return `
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
    },

    /**
     * Render modal details for an application
     * @param {Object} app - Application data
     * @param {string} status - Current status
     * @returns {string} Details HTML
     */
    renderModalDetails(app, status) {
        const createdDate = this.formatDate(app.created_at);
        const reviewedDate = this.formatDate(app.reviewed_at);

        let html = `
            <table class="table table-borderless mb-0">
                <tr>
                    <th class="text-muted" style="width: 35%;">
                        <i class="fas fa-cube me-2"></i>${this.config.i18n.application}
                    </th>
                    <td><strong>${this.escapeHtml(app.name)}</strong></td>
                </tr>
        `;

        if (app.description) {
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-align-left me-2"></i>${this.config.i18n.description}
                    </th>
                    <td>${this.escapeHtml(app.description)}</td>
                </tr>
            `;
        }

        if (app.website) {
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-globe me-2"></i>${this.config.i18n.website}
                    </th>
                    <td><a href="${this.escapeHtml(app.website)}" target="_blank" rel="noopener">${this.escapeHtml(app.website)}</a></td>
                </tr>
            `;
        }

        html += `
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
                    <td>${this.renderStatusBadge(status)}</td>
                </tr>
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar me-2"></i>${this.config.i18n.created}
                    </th>
                    <td>${createdDate}</td>
                </tr>
        `;

        if (status !== 'pending' && app.reviewed_at) {
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-calendar-check me-2"></i>${this.config.i18n.reviewedAt}
                    </th>
                    <td>${reviewedDate}</td>
                </tr>
            `;
        }

        if (app.review_notes) {
            html += `
                <tr>
                    <th class="text-muted">
                        <i class="fas fa-comment me-2"></i>${this.config.i18n.reviewNotes}
                    </th>
                    <td><em>"${this.escapeHtml(app.review_notes)}"</em></td>
                </tr>
            `;
        }

        html += '</table>';
        return html;
    },

    /**
     * Get item ID from application
     * @param {Object} app - Application data
     * @returns {string} Application ID
     */
    getItemId(app) {
        return app.id || app.uuid;
    }
});

// Add i18n aliases for generic messages
Object.defineProperty(AdminApplications, 'config', {
    get() {
        if (this._config) return this._config;
        const config = window.AdminApplicationsConfig;
        if (config && !config.i18n.noPendingItems) {
            config.i18n.noPendingItems = config.i18n.noPendingApplications;
            config.i18n.noItems = config.i18n.noApplications;
        }
        return config;
    },
    set(value) {
        this._config = value;
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => AdminApplications.init());
