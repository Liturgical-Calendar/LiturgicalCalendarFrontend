/**
 * Admin Module Base Factory
 *
 * Creates admin modules with shared functionality for managing entities
 * with status-based workflows (pending, approved, rejected, revoked).
 *
 * @param {Object} options - Configuration options
 * @param {string} options.configName - Window config variable name (e.g., 'AdminApplicationsConfig')
 * @param {string} options.entityName - Entity name for logging (e.g., 'applications')
 * @param {string} options.containerPrefix - Container ID prefix (e.g., 'Applications' -> '${status}ApplicationsBody')
 * @param {string} options.apiEndpoint - API endpoint path (e.g., '/admin/applications')
 * @param {Function} options.parseResponse - Function to parse API response into status-grouped data
 * @param {Function} options.renderTableRow - Function to render a single table row
 * @param {Function} options.getTableHeaders - Function to get table headers for a status
 * @param {Function} options.renderModalDetails - Function to render modal details HTML
 * @param {Function} [options.getItemId] - Function to get item ID (default: item.id || item.uuid)
 * @param {string} [options.reviewBtnDataAttr] - Data attribute prefix for review button (default: 'app')
 * @returns {Object} Admin module object
 */
function createAdminModule(options) { // eslint-disable-line no-unused-vars
    const {
        configName,
        entityName,
        containerPrefix,
        apiEndpoint,
        parseResponse,
        renderTableRow,
        getTableHeaders,
        renderModalDetails,
        getItemId = (item) => item.id || item.uuid,
        reviewBtnDataAttr = 'app'
    } = options;

    return {
        items: {
            pending: [],
            approved: [],
            rejected: [],
            revoked: []
        },
        currentItemId: null,
        currentItemStatus: null,
        modals: {},
        config: null,

        /**
         * Initialize the admin module
         */
        init() {
            this.config = window[configName];
            if (!this.config) {
                console.error(`${configName} not found`);
                return;
            }

            // Initialize Bootstrap modal
            this.modals.review = new bootstrap.Modal(document.getElementById('reviewModal'));

            // Bind event handlers
            this.bindEvents();

            // Load items
            this.loadItems();
        },

        /**
         * Bind event handlers
         */
        bindEvents() {
            // Refresh button
            document.getElementById('refreshBtn')?.addEventListener('click', () => {
                const icon = document.querySelector('#refreshBtn i');
                icon?.classList.add('fa-spin');
                this.loadItems().finally(() => {
                    icon?.classList.remove('fa-spin');
                });
            });

            // Tab change events - render data when tab is shown
            document.querySelectorAll('#statusTabs button[data-bs-toggle="tab"]').forEach(tab => {
                tab.addEventListener('shown.bs.tab', () => this.renderCurrentTab());
            });

            // Action buttons in modal
            document.getElementById('approveBtn')?.addEventListener('click', () => this.processItem('approve'));
            document.getElementById('rejectBtn')?.addEventListener('click', () => this.processItem('reject'));
            document.getElementById('revokeBtn')?.addEventListener('click', () => this.processItem('revoke'));
        },

        /**
         * Load all items from API
         */
        async loadItems() {
            const statuses = ['pending', 'approved', 'rejected', 'revoked'];

            // Show loading state in all containers
            statuses.forEach(status => {
                const container = document.getElementById(`${status}${containerPrefix}Body`);
                if (container) {
                    container.innerHTML = `
                        <div class="text-center text-muted">
                            <i class="fas fa-spinner fa-spin me-2"></i>${this.config.i18n.loading}
                        </div>
                    `;
                }
            });

            try {
                const response = await fetch(`${this.config.apiUrl}${apiEndpoint}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`Failed to load ${entityName}`);
                }

                const data = await response.json();

                // Parse response using entity-specific function
                const { items, counts } = parseResponse.call(this, data);
                this.items = items;

                // Update counts
                this.updateCounts(counts);

                // Render the current active tab
                this.renderCurrentTab();
            } catch (error) {
                console.error(`Error loading ${entityName}:`, error);
                statuses.forEach(status => {
                    const container = document.getElementById(`${status}${containerPrefix}Body`);
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
         * @param {Object|null} counts - Optional counts object
         */
        updateCounts(counts = null) {
            const finalCounts = counts || {
                pending: this.items.pending.length,
                approved: this.items.approved.length,
                rejected: this.items.rejected.length,
                revoked: this.items.revoked.length
            };

            const pendingCountEl = document.getElementById('pendingCount');
            const approvedCountEl = document.getElementById('approvedCount');
            const rejectedCountEl = document.getElementById('rejectedCount');
            const revokedCountEl = document.getElementById('revokedCount');
            const pendingBadgeEl = document.getElementById('pendingBadge');

            if (pendingCountEl) pendingCountEl.textContent = finalCounts.pending ?? 0;
            if (approvedCountEl) approvedCountEl.textContent = finalCounts.approved ?? 0;
            if (rejectedCountEl) rejectedCountEl.textContent = finalCounts.rejected ?? 0;
            if (revokedCountEl) revokedCountEl.textContent = finalCounts.revoked ?? 0;
            if (pendingBadgeEl) pendingBadgeEl.textContent = finalCounts.pending ?? 0;
        },

        /**
         * Render the currently active tab
         */
        renderCurrentTab() {
            const activeTab = document.querySelector('#statusTabs button.active');
            if (!activeTab) return;

            const status = activeTab.id.replace('-tab', '');
            this.renderItemsList(status);
        },

        /**
         * Render items list for a specific status
         * @param {string} status - Item status
         */
        renderItemsList(status) {
            const container = document.getElementById(`${status}${containerPrefix}Body`);
            if (!container) return;

            const items = this.items[status] || [];

            if (items.length === 0) {
                const message = status === 'pending'
                    ? this.config.i18n.noPendingItems
                    : this.config.i18n.noItems;
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-${status === 'pending' ? 'check-circle text-success' : 'inbox'} fa-3x mb-3"></i>
                        <p class="mb-0">${message}</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
            html += `<thead><tr>${getTableHeaders.call(this, status)}</tr></thead><tbody>`;

            for (const item of items) {
                html += renderTableRow.call(this, item, status);
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;

            // Add event listeners to review buttons
            container.querySelectorAll('.review-btn').forEach(btn => {
                const itemId = btn.dataset[`${reviewBtnDataAttr}Id`];
                const itemStatus = btn.dataset[`${reviewBtnDataAttr}Status`];
                btn.addEventListener('click', () => {
                    this.openReviewModal(itemId, itemStatus);
                });
            });
        },

        /**
         * Open the review modal for an item
         * @param {string} itemId - Item ID
         * @param {string} status - Current status
         */
        openReviewModal(itemId, status) {
            const item = this.items[status]?.find(i => String(getItemId(i)) === String(itemId));
            if (!item) return;

            this.currentItemId = itemId;
            this.currentItemStatus = status;

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
                revokeBtn.classList.remove('d-none');
                notesSection?.classList.remove('d-none');
            } else if (status === 'rejected') {
                approveBtn.classList.remove('d-none');
                notesSection?.classList.remove('d-none');
            } else {
                // For revoked, hide notes input
                notesSection?.classList.add('d-none');
            }

            // Render entity-specific modal details
            const detailsContainer = document.getElementById('applicationDetails') ||
                                     document.getElementById('requestDetails');
            if (detailsContainer) {
                detailsContainer.innerHTML = renderModalDetails.call(this, item, status);
            }

            this.modals.review.show();
        },

        /**
         * Process an item (approve/reject/revoke)
         * @param {string} action - Action to perform
         */
        async processItem(action) {
            if (!this.currentItemId) return;

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
                    `${this.config.apiUrl}${apiEndpoint}/${encodeURIComponent(this.currentItemId)}/${action}`,
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
                    this.loadItems();
                }, 1500);
            } catch (error) {
                console.error(`Error processing ${entityName}:`, error);
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
        },

        /**
         * Render a status badge
         * @param {string} status - Status value
         * @returns {string} HTML badge
         */
        renderStatusBadge(status) {
            const badges = {
                pending: `<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>${this.config.i18n.statusPending}</span>`,
                approved: `<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>${this.config.i18n.statusApproved}</span>`,
                rejected: `<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>${this.config.i18n.statusRejected}</span>`,
                revoked: `<span class="badge bg-secondary"><i class="fas fa-ban me-1"></i>${this.config.i18n.statusRevoked}</span>`
            };
            return badges[status] || status;
        },

        /**
         * Format a date for display
         * @param {string|null} dateStr - ISO date string
         * @returns {string} Formatted date or '-'
         */
        formatDate(dateStr) {
            return dateStr ? new Date(dateStr).toLocaleDateString() : '-';
        }
    };
}
