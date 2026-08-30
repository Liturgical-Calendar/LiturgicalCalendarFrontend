/**
 * Admin Module Base Factory
 *
 * Creates admin modules with shared functionality for managing entities with
 * status-based workflows.
 *
 * The status vocabulary, the per-status action buttons, the request body of an
 * action, and whether the list endpoint is paginated are all PARAMETERS, not
 * constants: `/admin/applications` speaks pending/approved/rejected/revoked and
 * takes `{notes}`, while `/admin/change-requests` speaks
 * submitted/approved/rejected/withdrawn, takes `{reason?}` on reject, and is
 * offset-paginated. Every option below defaults to the applications vocabulary,
 * so an existing caller keeps its behaviour by supplying none of them.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.configName - Window config variable name (e.g., 'AdminApplicationsConfig')
 * @param {string} options.entityName - Entity name for logging (e.g., 'applications')
 * @param {string} options.containerPrefix - Container ID prefix (e.g., 'Applications' -> '${status}ApplicationsBody')
 * @param {string} options.apiEndpoint - API endpoint path (e.g., '/admin/applications')
 * @param {Function} options.parseResponse - Function to parse API response into status-grouped data.
 *        Receives the raw response body, or — when `pagination` is configured — the aggregate
 *        `{items, pages, total}` produced by walking every page.
 * @param {Function} options.renderTableRow - Function to render a single table row
 * @param {Function} options.getTableHeaders - Function to get table headers for a status
 * @param {Function} options.renderModalDetails - Function to render modal details HTML
 * @param {Function} [options.getItemId] - Function to get item ID (default: item.id || item.uuid)
 * @param {string} [options.reviewBtnDataAttr] - Data attribute prefix for review button (default: 'app')
 * @param {string[]} [options.statuses] - Status vocabulary, in tab order
 * @param {string} [options.attentionStatus] - The status needing action; drives the header badge and
 *        the "all caught up" empty state (default: the first entry of `statuses`)
 * @param {string} [options.badgeElementId] - Element id of the attention badge (default: 'pendingBadge')
 * @param {Object} [options.statusBadges] - status -> {class, icon, i18nKey} badge definitions
 * @param {Function} [options.actionsForStatus] - (status) => string[] of action names offered for that status.
 *        An action a status does not offer is never rendered as a button — which is how a
 *        submitter-only transition such as `withdrawn` stays out of the reviewer's footer.
 * @param {Object} [options.actionButtonIds] - action -> element id of its modal button
 * @param {Function} [options.buildActionBody] - (action, notes) => object|null request body; null sends none
 * @param {string[]} [options.detailsContainerIds] - candidate element ids for the modal details container
 * @param {string} [options.notesElementId] - element id of the notes textarea (default: 'reviewNotes')
 * @param {Object} [options.pagination] - When set, the list endpoint is walked page by page:
 *        `{limit, getItems(data), getHasMore(data), getNextOffset(data, offset, limit), maxPages}`.
 *        **`getHasMore` must read the server's own has-more signal, never
 *        `items.length === 0`**: a resource admin's page is filtered AFTER the SQL page is
 *        fetched, so it can legitimately come back empty while later pages still hold
 *        batches they may act on.
 * @param {Function} [options.onDetailsRendered] - async (item, status) hook run after the modal is shown,
 *        for details that need their own fetch (e.g. a change request's proposed file contents)
 * @returns {Object} Admin module object
 */

/** Default status vocabulary (the `/admin/applications` one). */
const ADMIN_MODULE_DEFAULT_STATUSES = ['pending', 'approved', 'rejected', 'revoked'];

/** Default status badge definitions, keyed by status. */
const ADMIN_MODULE_DEFAULT_STATUS_BADGES = {
    pending: { class: 'bg-warning text-dark', icon: 'fas fa-clock', i18nKey: 'statusPending' },
    approved: { class: 'bg-success', icon: 'fas fa-check-circle', i18nKey: 'statusApproved' },
    rejected: { class: 'bg-danger', icon: 'fas fa-times-circle', i18nKey: 'statusRejected' },
    revoked: { class: 'bg-secondary', icon: 'fas fa-ban', i18nKey: 'statusRevoked' }
};

/** Default per-status actions (the `/admin/applications` workflow). */
const ADMIN_MODULE_DEFAULT_ACTIONS = {
    pending: ['approve', 'reject'],
    approved: ['revoke'],
    rejected: ['approve'],
    revoked: []
};

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
        reviewBtnDataAttr = 'app',
        statuses = ADMIN_MODULE_DEFAULT_STATUSES,
        badgeElementId = 'pendingBadge',
        statusBadges = ADMIN_MODULE_DEFAULT_STATUS_BADGES,
        actionsForStatus = (status) => ADMIN_MODULE_DEFAULT_ACTIONS[status] || [],
        actionButtonIds = { approve: 'approveBtn', reject: 'rejectBtn', revoke: 'revokeBtn' },
        buildActionBody = (action, notes) => ({ notes: notes || null }),
        detailsContainerIds = ['applicationDetails', 'requestDetails'],
        notesElementId = 'reviewNotes',
        pagination = null,
        onDetailsRendered = null
    } = options;

    const attentionStatus = options.attentionStatus || statuses[0];

    /**
     * Empty status buckets, rebuilt on every load so a status missing from a
     * response renders as empty rather than keeping the previous load's rows.
     */
    const emptyBuckets = () => {
        const buckets = {};
        for (const status of statuses) {
            buckets[status] = [];
        }
        return buckets;
    };

    return {
        items: emptyBuckets(),
        currentItemId: null,
        currentItemStatus: null,
        modals: {},
        config: null,

        /** The status vocabulary this module was built with. Exposed for tests and callers. */
        statuses,

        /** The status that drives the header badge and the "all caught up" empty state. */
        attentionStatus,

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
            for (const [action, elementId] of Object.entries(actionButtonIds)) {
                document.getElementById(elementId)?.addEventListener('click', () => this.processItem(action));
            }
        },

        /**
         * Fetch one page of the list endpoint.
         * @param {Object|null} page - `{limit, offset}`, or null for the unpaginated single request
         * @returns {Promise<Object>} Parsed JSON body
         * @private
         */
        async _fetchPage(page) {
            const query = page === null
                ? ''
                : `?limit=${encodeURIComponent(page.limit)}&offset=${encodeURIComponent(page.offset)}`;

            const response = await fetch(`${this.config.apiUrl}${apiEndpoint}${query}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to load ${entityName}`);
            }

            return response.json();
        },

        /**
         * Walk every page of a paginated list endpoint.
         *
         * The loop condition is the server's own has-more signal and NOTHING else.
         * Stopping on an empty page would be a correctness bug here: `/admin/change-requests`
         * filters each SQL page through OpenFGA AFTER fetching it, so a resource admin's page
         * can come back with zero visible batches while later pages still hold batches they
         * may act on. `offset` likewise advances by the server's effective page size, never by
         * the number of items that survived filtering.
         *
         * @returns {Promise<{items: Array, pages: number, total: number|null}>}
         * @private
         */
        async _loadAllPages() {
            const limit = pagination.limit ?? 100;
            const maxPages = pagination.maxPages ?? 100;
            const getItems = pagination.getItems ?? ((data) => data.items || []);
            const getHasMore = pagination.getHasMore ?? ((data) => data.has_more === true);
            const getNextOffset = pagination.getNextOffset
                ?? ((data, offset, requestedLimit) => ( data.offset ?? offset ) + ( data.limit ?? requestedLimit ));

            const items = [];
            let offset = 0;
            let pages = 0;
            let total = null;

            for (;;) {
                const data = await this._fetchPage({ limit, offset });
                pages += 1;
                items.push(...getItems(data));
                if (typeof data.total === 'number') {
                    total = data.total;
                }

                if (!getHasMore(data)) {
                    break;
                }

                if (pages >= maxPages) {
                    console.warn(`${entityName}: stopped paginating after ${pages} pages`);
                    break;
                }

                const nextOffset = getNextOffset(data, offset, limit);
                if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
                    // A server that advertises more pages without advancing the cursor would
                    // spin here forever; stop rather than hang the page.
                    console.warn(`${entityName}: pagination cursor did not advance past offset ${offset}; stopping`);
                    break;
                }
                offset = nextOffset;
            }

            return { items, pages, total };
        },

        /**
         * Load all items from API
         */
        async loadItems() {
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
                const data = pagination ? await this._loadAllPages() : await this._fetchPage(null);

                // Parse response using entity-specific function
                const { items, counts } = parseResponse.call(this, data);
                this.items = Object.assign(emptyBuckets(), items);

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
                // Update the attention badge too
                const attentionBadge = document.getElementById(badgeElementId);
                if (attentionBadge) {
                    attentionBadge.textContent = '-';
                }
            }
        },

        /**
         * Update count displays
         * @param {Object|null} counts - Optional counts object
         */
        updateCounts(counts = null) {
            const finalCounts = counts || Object.fromEntries(
                statuses.map(status => [status, ( this.items[status] || [] ).length])
            );

            for (const status of statuses) {
                const countEl = document.getElementById(`${status}Count`);
                if (countEl) {
                    countEl.textContent = finalCounts[status] ?? 0;
                }
            }

            const attentionBadge = document.getElementById(badgeElementId);
            if (attentionBadge) {
                attentionBadge.textContent = finalCounts[attentionStatus] ?? 0;
            }
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
                const isAttention = status === attentionStatus;
                const message = isAttention
                    ? this.config.i18n.noPendingItems
                    : this.config.i18n.noItems;
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-${isAttention ? 'check-circle text-success' : 'inbox'} fa-3x mb-3"></i>
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
            const notesEl = document.getElementById(notesElementId);
            if (notesEl) notesEl.value = '';
            const modalAlerts = document.getElementById('modalAlerts');
            if (modalAlerts) modalAlerts.innerHTML = '';

            // Show only the actions this status offers. Every action button is hidden
            // first, so a status the vocabulary offers nothing for (a withdrawn change
            // request, say) leaves the footer with just Cancel.
            const offered = actionsForStatus.call(this, status) || [];
            for (const [action, elementId] of Object.entries(actionButtonIds)) {
                const btn = document.getElementById(elementId);
                if (!btn) continue;
                btn.disabled = false;
                btn.classList.toggle('d-none', !offered.includes(action));
            }

            const notesSection = document.getElementById('notesSection');
            notesSection?.classList.toggle('d-none', offered.length === 0);

            // Render entity-specific modal details
            const detailsContainer = detailsContainerIds
                .map(id => document.getElementById(id))
                .find(el => el !== null && el !== undefined);
            if (detailsContainer) {
                detailsContainer.innerHTML = renderModalDetails.call(this, item, status);
            }

            this.modals.review.show();

            if (typeof onDetailsRendered === 'function') {
                Promise.resolve(onDetailsRendered.call(this, item, status)).catch(error => {
                    console.error(`Error loading ${entityName} details:`, error);
                });
            }
        },

        /**
         * Process an item (approve/reject/revoke/…)
         * @param {string} action - Action to perform
         */
        async processItem(action) {
            if (!this.currentItemId) return;

            const notes = document.getElementById(notesElementId)?.value.trim() ?? '';
            const modalAlerts = document.getElementById('modalAlerts');
            const actionButtons = Object.values(actionButtonIds)
                .map(id => document.getElementById(id))
                .filter(el => el !== null && el !== undefined);

            actionButtons.forEach(b => { b.disabled = true; });

            const btn = document.getElementById(actionButtonIds[action]);
            const originalText = btn?.innerHTML || '';

            if (btn) {
                btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i>${this.config.i18n.processing}`;
            }

            try {
                const body = buildActionBody.call(this, action, notes);
                const headers = { 'Accept': 'application/json' };
                const sendsBody = body !== null && body !== undefined;
                if (sendsBody) {
                    headers['Content-Type'] = 'application/json';
                }

                const response = await fetch(
                    `${this.config.apiUrl}${apiEndpoint}/${encodeURIComponent(this.currentItemId)}/${action}`,
                    {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        ...( sendsBody ? { body: JSON.stringify(body) } : {} )
                    }
                );

                const data = await response.json().catch(() => ({}));

                // 409 means somebody else decided this item between the list load and this
                // click. There is nothing for the reviewer to retry, so say so plainly and
                // reload rather than rendering it as a generic failure.
                if (response.status === 409) {
                    const alreadyDecided = this.config.i18n.alreadyDecided
                        || data.message || data.detail || data.error || 'This item was already decided.';
                    if (modalAlerts) {
                        modalAlerts.innerHTML = `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-circle me-2"></i>
                                ${this.escapeHtml(alreadyDecided)}
                            </div>
                        `;
                    }
                    setTimeout(() => {
                        this.modals.review.hide();
                        this.loadItems();
                        this.refreshNotifications();
                    }, 1500);
                    return;
                }

                if (!response.ok) {
                    throw new Error(data.message || data.detail || data.error || 'Request failed');
                }

                // Show success message
                const successMessage = this.config.i18n[`${action}Success`];

                if (modalAlerts) {
                    modalAlerts.innerHTML = `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle me-2"></i>
                            ${this.escapeHtml(data.message || successMessage)}
                        </div>
                    `;
                }

                // Reload after a short delay
                setTimeout(() => {
                    this.modals.review.hide();
                    this.loadItems();
                    this.refreshNotifications();
                }, 1500);
            } catch (error) {
                console.error(`Error processing ${entityName}:`, error);
                if (modalAlerts) {
                    modalAlerts.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${this.escapeHtml(error.message || this.config.i18n.failedToProcess)}
                        </div>
                    `;
                }
                actionButtons.forEach(b => { b.disabled = false; });
                if (btn) {
                    btn.innerHTML = originalText;
                }
            }
        },

        /**
         * Refresh the navbar notification bell so its badge reflects the decision
         * that was just made.
         */
        refreshNotifications() {
            if (typeof Notifications !== 'undefined' && Notifications.fetchNotifications) {
                Notifications.fetchNotifications();
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
            const badge = statusBadges[status];
            if (!badge) {
                return this.escapeHtml(status);
            }
            const label = this.config.i18n[badge.i18nKey] || status;
            return `<span class="badge ${badge.class}"><i class="${badge.icon} me-1"></i>${this.escapeHtml(label)}</span>`;
        },

        /**
         * Render a scope badge for application access level
         * @param {string} scope - Scope value ('read' or 'write')
         * @returns {string} HTML badge
         */
        renderScopeBadge(scope) {
            const scopeRead = this.config.i18n.scopeRead || 'Read-only';
            const scopeWrite = this.config.i18n.scopeWrite || 'Read & Write';
            if (scope === 'write') {
                return `<span class="badge bg-primary"><i class="fas fa-edit me-1"></i>${scopeWrite}</span>`;
            }
            return `<span class="badge bg-info"><i class="fas fa-eye me-1"></i>${scopeRead}</span>`;
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
