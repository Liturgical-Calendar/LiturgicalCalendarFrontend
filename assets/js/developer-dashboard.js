/**
 * Developer Dashboard Module
 *
 * Handles application management and API key generation for developers.
 */

/**
 * API client for applications endpoint
 */
const ApplicationsAPI = {
    baseUrl: window.DeveloperDashboard?.apiBaseUrl || '',

    /**
     * Make an authenticated API request
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} - JSON response
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Send HttpOnly cookies
        };

        const response = await fetch(url, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    },

    /**
     * List all applications for the current user
     */
    async listApplications() {
        return this.request('/applications');
    },

    /**
     * Create a new application
     * @param {Object} data - Application data
     */
    async createApplication(data) {
        return this.request('/applications', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * Update an application
     * @param {string} uuid - Application UUID
     * @param {Object} data - Updated data
     */
    async updateApplication(uuid, data) {
        return this.request(`/applications/${uuid}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    /**
     * Delete an application
     * @param {string} uuid - Application UUID
     */
    async deleteApplication(uuid) {
        return this.request(`/applications/${uuid}`, {
            method: 'DELETE'
        });
    },

    /**
     * List API keys for an application
     * @param {string} uuid - Application UUID
     */
    async listKeys(uuid) {
        return this.request(`/applications/${uuid}/keys`);
    },

    /**
     * Generate a new API key
     * @param {string} uuid - Application UUID
     * @param {Object} data - Key configuration
     */
    async generateKey(uuid, data) {
        return this.request(`/applications/${uuid}/keys`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * Revoke an API key
     * @param {string} uuid - Application UUID
     * @param {number} keyId - Key ID
     */
    async revokeKey(uuid, keyId) {
        return this.request(`/applications/${uuid}/keys/${keyId}`, {
            method: 'DELETE'
        });
    },

    /**
     * Rotate an API key
     * @param {string} uuid - Application UUID
     * @param {number} keyId - Key ID
     */
    async rotateKey(uuid, keyId) {
        return this.request(`/applications/${uuid}/keys/${keyId}/rotate`, {
            method: 'POST'
        });
    },

    /**
     * Resubmit a rejected application for review
     * @param {string} uuid - Application UUID
     */
    async resubmitApplication(uuid) {
        return this.request(`/applications/${uuid}/resubmit`, {
            method: 'POST'
        });
    }
};

/**
 * UI rendering functions
 */
const UI = {
    i18n: window.DeveloperDashboard?.i18n || {},

    /**
     * Render the empty state when no applications exist
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-cubes"></i>
                </div>
                <h5>${this.i18n.noApplications}</h5>
                <p>${this.i18n.createFirst}</p>
                <button type="button" class="btn btn-primary" id="btnNewAppEmpty">
                    <i class="fas fa-plus me-1"></i>${this.i18n.newApplication}
                </button>
            </div>
        `;
    },

    /**
     * Render a single application card
     * @param {Object} app - Application data
     */
    renderApplicationCard(app) {
        const keyCount = app.key_count || 0;
        const keyLabel = keyCount === 1 ? this.i18n.key : this.i18n.keys;
        const createdDate = app.created_at ? new Date(app.created_at).toLocaleDateString() : '-';
        const status = app.status || 'approved'; // Default to approved for backward compatibility
        const isApproved = status === 'approved';
        const isRejected = status === 'rejected';
        const isRevoked = status === 'revoked';
        const canEdit = !isRevoked; // Can edit unless revoked

        // Escape values used in HTML attributes to prevent injection
        const safeUuid = this.escapeHtml(app.uuid);
        const safeStatus = this.escapeHtml(status);
        const collapseId = `keys-${safeUuid}`;

        return `
            <div class="card app-card shadow-sm mb-3" data-app-uuid="${safeUuid}" data-status="${safeStatus}">
                <div class="card-header d-flex justify-content-between align-items-start">
                    <div>
                        <h5 class="mb-1">
                            ${this.escapeHtml(app.name)}
                            ${this.renderStatusBadge(status)}
                        </h5>
                        <div class="app-uuid">${safeUuid}</div>
                    </div>
                    <div class="app-actions">
                        ${canEdit ? `
                            <button type="button" class="btn btn-outline-primary btn-sm btn-edit-app" data-uuid="${safeUuid}" title="${this.escapeHtml(this.i18n.edit)}">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-outline-danger btn-sm btn-delete-app" data-uuid="${safeUuid}" data-name="${this.escapeHtml(app.name)}" title="${this.escapeHtml(this.i18n.delete)}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${app.description ? `<p class="card-text">${this.escapeHtml(app.description)}</p>` : ''}

                    ${this.renderStatusMessage(status, app.review_notes)}

                    <div class="app-metadata">
                        ${app.website ? `
                            <div class="app-metadata-item">
                                <i class="fas fa-globe"></i>
                                <a href="${this.escapeHtml(app.website)}" target="_blank" rel="noopener noreferrer" class="app-website-link">
                                    ${this.escapeHtml(app.website)}
                                </a>
                            </div>
                        ` : ''}
                        <div class="app-metadata-item">
                            <i class="fas fa-calendar-alt"></i>
                            ${this.i18n.created}: ${createdDate}
                        </div>
                        <div class="app-metadata-item">
                            ${this.renderScopeBadge(app.requested_scope || 'read')}
                        </div>
                        ${isApproved ? `
                            <div class="app-metadata-item">
                                <i class="fas fa-key"></i>
                                ${keyCount} ${keyLabel}
                            </div>
                        ` : ''}
                    </div>

                    ${isRejected ? `
                        <div class="mt-3">
                            <button type="button" class="btn btn-warning btn-resubmit" data-uuid="${safeUuid}">
                                <i class="fas fa-redo me-1"></i>${this.i18n.resubmit}
                            </button>
                        </div>
                    ` : ''}

                    ${isApproved ? `
                        <div class="keys-section">
                            <div class="keys-section-header">
                                <button class="btn btn-sm btn-outline-secondary btn-toggle-keys" type="button"
                                        data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                                        aria-expanded="false" aria-controls="${collapseId}">
                                    <i class="fas fa-chevron-down me-1"></i>
                                    ${this.i18n.apiKeys}
                                    <span class="badge bg-secondary key-count-badge">${keyCount}</span>
                                </button>
                                <button type="button" class="btn btn-sm btn-primary btn-generate-key" data-uuid="${safeUuid}">
                                    <i class="fas fa-plus me-1"></i>${this.i18n.generateKey}
                                </button>
                            </div>
                            <div class="collapse keys-collapse" id="${collapseId}" data-app-uuid="${safeUuid}">
                                <div class="keys-container mt-3">
                                    <div class="text-center text-muted small py-2">
                                        <i class="fas fa-info-circle me-1"></i>
                                        ${this.i18n.noKeys}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Render status badge based on application status
     * @param {string} status - Application status
     */
    renderStatusBadge(status) {
        const statusConfig = {
            pending: { class: 'bg-warning text-dark', icon: 'fa-clock', label: this.i18n.statusPending },
            approved: { class: 'bg-success', icon: 'fa-check-circle', label: this.i18n.statusApproved },
            rejected: { class: 'bg-danger', icon: 'fa-times-circle', label: this.i18n.statusRejected },
            revoked: { class: 'bg-secondary', icon: 'fa-ban', label: this.i18n.statusRevoked }
        };

        const config = statusConfig[status] || statusConfig.pending;
        return `<span class="badge ${config.class} ms-2"><i class="fas ${config.icon} me-1"></i>${config.label}</span>`;
    },

    /**
     * Render scope badge for application access level
     * @param {string} scope - Application requested scope ('read' or 'write')
     */
    renderScopeBadge(scope) {
        if (scope === 'write') {
            return `<span class="badge bg-warning text-dark"><i class="fas fa-edit me-1"></i>${this.i18n.readWrite || 'Read & Write'}</span>`;
        }
        return `<span class="badge bg-info"><i class="fas fa-eye me-1"></i>${this.i18n.readOnly || 'Read-only'}</span>`;
    },

    /**
     * Render status-specific message
     * @param {string} status - Application status
     * @param {string|null} reviewNotes - Admin review notes
     */
    renderStatusMessage(status, reviewNotes) {
        if (status === 'pending') {
            return `
                <div class="alert alert-warning mb-3">
                    <i class="fas fa-clock me-2"></i>
                    ${this.i18n.awaitingApproval}
                </div>
            `;
        }

        if (status === 'rejected') {
            return `
                <div class="alert alert-danger mb-3">
                    <i class="fas fa-times-circle me-2"></i>
                    ${this.i18n.cannotGenerateKeys}
                    ${reviewNotes ? `
                        <hr>
                        <strong>${this.i18n.rejectionNotes}:</strong>
                        <p class="mb-0 mt-1">${this.escapeHtml(reviewNotes)}</p>
                    ` : ''}
                </div>
            `;
        }

        if (status === 'revoked') {
            return `
                <div class="alert alert-secondary mb-3">
                    <i class="fas fa-ban me-2"></i>
                    ${this.i18n.revokedMessage}
                    ${reviewNotes ? `
                        <hr>
                        <p class="mb-0">${this.escapeHtml(reviewNotes)}</p>
                    ` : ''}
                </div>
            `;
        }

        return '';
    },

    /**
     * Render API keys table
     * @param {Array} keys - Array of API key data
     * @param {string} appUuid - Application UUID
     */
    renderKeysTable(keys, appUuid) {
        if (!keys || keys.length === 0) {
            return `
                <div class="text-center text-muted small py-2">
                    <i class="fas fa-info-circle me-1"></i>
                    ${this.i18n.noKeys}
                </div>
            `;
        }

        const safeAppUuid = this.escapeHtml(appUuid);
        const rows = keys.map(key => {
            const scopeClass = key.scope === 'write' ? 'key-scope-write' : 'key-scope-read';
            const scopeLabel = key.scope === 'write' ? this.i18n.write : this.i18n.read;
            const expires = key.expires_at ? new Date(key.expires_at).toLocaleDateString() : this.i18n.never;
            const lastUsed = key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : this.i18n.neverUsed;
            const keyName = key.name || `${key.key_prefix}...`;
            const safeKeyPrefix = this.escapeHtml(key.key_prefix);
            const safeKeyId = this.escapeHtml(String(key.id));

            return `
                <tr data-key-id="${safeKeyId}">
                    <td>
                        <span class="key-name">${this.escapeHtml(keyName)}</span>
                        <br>
                        <code class="key-prefix">${safeKeyPrefix}...</code>
                    </td>
                    <td><span class="key-scope ${scopeClass}">${scopeLabel}</span></td>
                    <td class="text-nowrap">${key.rate_limit_per_hour} ${this.i18n.requestsPerHour}</td>
                    <td class="text-nowrap">${expires}</td>
                    <td class="text-nowrap">${lastUsed}</td>
                    <td class="key-actions">
                        <button type="button" class="btn btn-outline-warning btn-sm btn-rotate-key"
                                data-uuid="${safeAppUuid}" data-key-id="${safeKeyId}" title="${this.escapeHtml(this.i18n.rotate)}">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm btn-revoke-key"
                                data-uuid="${safeAppUuid}" data-key-id="${safeKeyId}" title="${this.escapeHtml(this.i18n.revoke)}">
                            <i class="fas fa-ban"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-responsive">
                <table class="table table-sm keys-table">
                    <thead>
                        <tr>
                            <th>${this.i18n.apiKeys}</th>
                            <th>${this.i18n.scope}</th>
                            <th>${this.i18n.rateLimit}</th>
                            <th>${this.i18n.expires}</th>
                            <th>${this.i18n.lastUsed}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Show loading state in container
     * @param {HTMLElement} container - Container element
     */
    showLoading(container) {
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    },

    /**
     * Show error state
     * @param {HTMLElement} container - Container element
     * @param {string} message - Error message
     */
    showError(container, message) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                ${this.escapeHtml(message)}
            </div>
        `;
    },

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, danger, warning, info)
     */
    showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toastId = `toast-${Date.now()}`;
        const iconMap = {
            success: 'fa-check-circle',
            danger: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas ${iconMap[type] || 'fa-info-circle'} me-2"></i>
                        ${this.escapeHtml(message)}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHtml);

        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 5000 });
        toast.show();

        // Remove from DOM after hidden
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
};

/**
 * Main application state and controller
 */
const DeveloperDashboard = {
    applications: [],
    currentDeleteAction: null,
    _isDeleting: false,
    modals: {},
    _initialized: false,

    /**
     * Initialize the dashboard
     */
    async init() {
        // Prevent multiple initializations (guards against duplicate event listeners)
        if (this._initialized) {
            return;
        }
        this._initialized = true;

        // Initialize Bootstrap modals with null checks
        const appModalEl = document.getElementById('appModal');
        const keyModalEl = document.getElementById('keyModal');
        const keyDisplayModalEl = document.getElementById('keyDisplayModal');
        const deleteModalEl = document.getElementById('deleteModal');

        if (appModalEl) this.modals.app = new bootstrap.Modal(appModalEl);
        if (keyModalEl) this.modals.key = new bootstrap.Modal(keyModalEl);
        if (keyDisplayModalEl) this.modals.keyDisplay = new bootstrap.Modal(keyDisplayModalEl);
        if (deleteModalEl) this.modals.delete = new bootstrap.Modal(deleteModalEl);

        // Bind event handlers
        this.bindEvents();

        // Load applications
        await this.loadApplications();
    },

    /**
     * Bind all event handlers
     */
    bindEvents() {
        // New application buttons
        document.getElementById('btnNewApp')?.addEventListener('click', () => this.showAppModal());

        // Save application
        document.getElementById('btnSaveApp')?.addEventListener('click', () => this.saveApplication());

        // Generate key
        document.getElementById('btnGenerateKey')?.addEventListener('click', () => this.generateKey());

        // Copy key button
        document.getElementById('btnCopyKey')?.addEventListener('click', () => this.copyKeyToClipboard());

        // Confirm delete
        document.getElementById('btnConfirmDelete')?.addEventListener('click', () => this.executeDelete());

        // Delegated events for dynamic content
        document.getElementById('applicationsContainer')?.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.classList.contains('btn-edit-app')) {
                this.editApplication(target.dataset.uuid);
            } else if (target.classList.contains('btn-delete-app')) {
                this.confirmDeleteApplication(target.dataset.uuid, target.dataset.name);
            } else if (target.classList.contains('btn-generate-key')) {
                this.showKeyModal(target.dataset.uuid);
            } else if (target.classList.contains('btn-revoke-key')) {
                this.confirmRevokeKey(target.dataset.uuid, target.dataset.keyId);
            } else if (target.classList.contains('btn-rotate-key')) {
                this.rotateKey(target.dataset.uuid, target.dataset.keyId);
            } else if (target.classList.contains('btn-resubmit')) {
                this.resubmitApplication(target.dataset.uuid);
            } else if (target.id === 'btnNewAppEmpty') {
                this.showAppModal();
            }
        });

        // Load keys when collapse is shown
        document.getElementById('applicationsContainer')?.addEventListener('show.bs.collapse', async (e) => {
            if (e.target.classList.contains('keys-collapse')) {
                const uuid = e.target.dataset.appUuid;
                await this.loadKeysForApp(uuid);
            }
        });

        // Form submission on enter
        document.getElementById('appForm')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveApplication();
            }
        });

        document.getElementById('keyForm')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.generateKey();
            }
        });
    },

    /**
     * Load all applications from API
     */
    async loadApplications() {
        const container = document.getElementById('applicationsContainer');
        UI.showLoading(container);

        try {
            const response = await ApplicationsAPI.listApplications();
            this.applications = response.applications || [];

            if (this.applications.length === 0) {
                container.innerHTML = UI.renderEmptyState();
            } else {
                container.innerHTML = this.applications.map(app => UI.renderApplicationCard(app)).join('');
            }
        } catch (error) {
            console.error('Failed to load applications:', error);
            UI.showError(container, UI.i18n.errorLoading);
        }
    },

    /**
     * Load API keys for a specific application
     * @param {string} uuid - Application UUID
     */
    async loadKeysForApp(uuid) {
        const collapse = document.querySelector(`.keys-collapse[data-app-uuid="${CSS.escape(uuid)}"]`);
        const container = collapse?.querySelector('.keys-container');
        if (!container) return;

        UI.showLoading(container);

        try {
            const response = await ApplicationsAPI.listKeys(uuid);
            container.innerHTML = UI.renderKeysTable(response.keys || [], uuid);

            // Update key count badge
            const badge = collapse.closest('.app-card')?.querySelector('.key-count-badge');
            if (badge) {
                badge.textContent = response.total || 0;
            }
        } catch (error) {
            console.error('Failed to load keys:', error);
            UI.showError(container, UI.i18n.errorLoading);
        }
    },

    /**
     * Show the application modal for creating or editing
     * @param {Object|null} app - Application data for editing, null for new
     */
    showAppModal(app = null) {
        const isEdit = app !== null;
        document.getElementById('appModalTitle').textContent = isEdit ? UI.i18n.editApplication : UI.i18n.newApplication;
        document.getElementById('appUuid').value = app?.uuid || '';
        document.getElementById('appName').value = app?.name || '';
        document.getElementById('appDescription').value = app?.description || '';
        document.getElementById('appWebsite').value = app?.website || '';

        // Show scope section only for new applications (cannot be changed after creation)
        const scopeSection = document.getElementById('appScopeSection');
        if (scopeSection) {
            scopeSection.style.display = isEdit ? 'none' : 'block';
            if (!isEdit) {
                // Reset to read scope for new applications
                const scopeRead = document.getElementById('scopeRead');
                if (scopeRead) scopeRead.checked = true;
            }
        }

        // Update button text and icon based on new vs edit
        const btnText = document.getElementById('btnSaveAppText');
        const btnIcon = document.getElementById('btnSaveAppIcon');
        if (btnText) {
            btnText.textContent = isEdit ? UI.i18n.save : UI.i18n.submitRequest;
        }
        if (btnIcon) {
            btnIcon.className = isEdit ? 'fas fa-save me-1' : 'fas fa-paper-plane me-1';
        }

        this.modals.app.show();
        document.getElementById('appName').focus();
    },

    /**
     * Edit an existing application
     * @param {string} uuid - Application UUID
     */
    editApplication(uuid) {
        const app = this.applications.find(a => a.uuid === uuid);
        if (app) {
            this.showAppModal(app);
        }
    },

    /**
     * Save application (create or update)
     */
    async saveApplication() {
        const saveBtn = document.getElementById('btnSaveApp');

        // Prevent double submission
        if (saveBtn.disabled) {
            return;
        }

        const uuid = document.getElementById('appUuid').value;
        const name = document.getElementById('appName').value.trim();
        const description = document.getElementById('appDescription').value.trim();
        const website = document.getElementById('appWebsite').value.trim();

        if (!name) {
            document.getElementById('appName').focus();
            return;
        }

        const spinner = saveBtn.querySelector('.spinner-border');
        saveBtn.disabled = true;
        spinner?.classList.remove('d-none');

        try {
            const data = { name, description, website };

            if (uuid) {
                await ApplicationsAPI.updateApplication(uuid, data);
                UI.showToast(UI.i18n.applicationUpdated, 'success');
            } else {
                // Include requested_scope for new applications
                const scopeRadio = document.querySelector('input[name="appScope"]:checked');
                data.requested_scope = scopeRadio ? scopeRadio.value : 'read';
                await ApplicationsAPI.createApplication(data);
                UI.showToast(UI.i18n.applicationCreated, 'success');
            }

            // Wait for modal to fully hide before refreshing the list
            const modalEl = document.getElementById('appModal');
            await new Promise(resolve => {
                modalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
                this.modals.app.hide();
            });
            await this.loadApplications();
        } catch (error) {
            console.error('Failed to save application:', error);
            UI.showToast(UI.i18n.errorSaving, 'danger');
        } finally {
            saveBtn.disabled = false;
            spinner?.classList.add('d-none');
        }
    },

    /**
     * Show delete confirmation for an application
     * @param {string} uuid - Application UUID
     * @param {string} name - Application name
     */
    confirmDeleteApplication(uuid, name) {
        const message = UI.i18n.deleteAppConfirm.replace('%s', name);
        document.getElementById('deleteMessage').textContent = message;
        this.currentDeleteAction = { type: 'app', uuid };
        this.modals.delete.show();
    },

    /**
     * Show delete confirmation for revoking a key
     * @param {string} uuid - Application UUID
     * @param {string} keyId - Key ID
     */
    confirmRevokeKey(uuid, keyId) {
        document.getElementById('deleteMessage').textContent = UI.i18n.revokeKeyConfirm;
        this.currentDeleteAction = { type: 'key', uuid, keyId };
        this.modals.delete.show();
    },

    /**
     * Execute the pending delete action
     */
    async executeDelete() {
        // Guard against duplicate requests from rapid clicks
        if (!this.currentDeleteAction || this._isDeleting) return;
        this._isDeleting = true;

        // Capture and immediately clear to prevent duplicate requests
        const action = this.currentDeleteAction;
        this.currentDeleteAction = null;

        const deleteBtn = document.getElementById('btnConfirmDelete');
        const spinner = deleteBtn.querySelector('.spinner-border');
        deleteBtn.disabled = true;
        spinner?.classList.remove('d-none');

        try {
            const modalEl = document.getElementById('deleteModal');
            const hideModal = () => new Promise(resolve => {
                modalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
                this.modals.delete.hide();
            });

            if (action.type === 'app') {
                await ApplicationsAPI.deleteApplication(action.uuid);
                UI.showToast(UI.i18n.applicationDeleted, 'success');
                await hideModal();
                await this.loadApplications();
            } else if (action.type === 'key') {
                await ApplicationsAPI.revokeKey(action.uuid, action.keyId);
                UI.showToast(UI.i18n.keyRevoked, 'success');
                await hideModal();
                await this.loadKeysForApp(action.uuid);
            }
        } catch (error) {
            console.error('Failed to delete:', error);
            UI.showToast(UI.i18n.errorDeleting, 'danger');
        } finally {
            deleteBtn.disabled = false;
            spinner?.classList.add('d-none');
            this._isDeleting = false;
        }
    },

    /**
     * Show the key generation modal
     * @param {string} uuid - Application UUID
     */
    showKeyModal(uuid) {
        document.getElementById('keyAppUuid').value = uuid;
        document.getElementById('keyName').value = '';
        document.getElementById('keyScope').value = 'read';
        document.getElementById('keyExpires').value = '';

        // Get the application's requested_scope to restrict key scope options
        const app = this.applications.find(a => a.uuid === uuid);
        const requestedScope = app?.requested_scope || 'read';
        const keyScopeSelect = document.getElementById('keyScope');

        if (keyScopeSelect) {
            const writeOption = keyScopeSelect.querySelector('option[value="write"]');
            if (writeOption) {
                // Disable write option if application only has read access
                writeOption.disabled = requestedScope === 'read';
            }
            // Always start with read selected
            keyScopeSelect.value = 'read';
        }

        // Show a warning if the application is read-only
        const keyModalBody = document.querySelector('#keyModal .modal-body');
        const existingWarning = keyModalBody?.querySelector('.scope-restriction-warning');
        if (existingWarning) {
            existingWarning.remove();
        }

        if (requestedScope === 'read' && keyModalBody) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'alert alert-info scope-restriction-warning mb-3';
            warningDiv.innerHTML = `<i class="fas fa-info-circle me-2"></i>${UI.escapeHtml(UI.i18n.scopeReadOnlyRestriction)}`;
            keyModalBody.insertBefore(warningDiv, keyModalBody.firstChild);
        }

        this.modals.key.show();
        document.getElementById('keyName').focus();
    },

    /**
     * Generate a new API key
     */
    async generateKey() {
        const uuid = document.getElementById('keyAppUuid').value;
        const name = document.getElementById('keyName').value.trim();
        const scope = document.getElementById('keyScope').value;
        const expiresAt = document.getElementById('keyExpires').value;

        const generateBtn = document.getElementById('btnGenerateKey');
        const spinner = generateBtn.querySelector('.spinner-border');
        generateBtn.disabled = true;
        spinner?.classList.remove('d-none');

        try {
            const data = {
                name: name || null,
                scope
            };

            if (expiresAt) {
                data.expires_at = expiresAt;
            }

            const response = await ApplicationsAPI.generateKey(uuid, data);

            // Wait for key modal to fully hide before showing the display modal
            const keyModalEl = document.getElementById('keyModal');
            await new Promise(resolve => {
                keyModalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
                this.modals.key.hide();
            });

            document.getElementById('generatedKeyDisplay').value = response.key;
            document.getElementById('copySuccess').classList.add('d-none');
            this.modals.keyDisplay.show();

            // Refresh keys list
            await this.loadKeysForApp(uuid);

            // Also update the applications list to refresh key counts
            await this.loadApplications();

            // Re-expand the keys collapse for this app
            const collapse = document.querySelector(`.keys-collapse[data-app-uuid="${CSS.escape(uuid)}"]`);
            if (collapse) {
                const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
                bsCollapse.show();
            }
        } catch (error) {
            console.error('Failed to generate key:', error);
            UI.showToast(UI.i18n.errorGeneratingKey, 'danger');
        } finally {
            generateBtn.disabled = false;
            spinner?.classList.add('d-none');
        }
    },

    /**
     * Rotate an API key
     * @param {string} uuid - Application UUID
     * @param {string} keyId - Key ID
     */
    async rotateKey(uuid, keyId) {
        try {
            const response = await ApplicationsAPI.rotateKey(uuid, keyId);

            // Show the new key
            document.getElementById('generatedKeyDisplay').value = response.key;
            document.getElementById('copySuccess').classList.add('d-none');
            this.modals.keyDisplay.show();

            // Refresh keys list
            await this.loadKeysForApp(uuid);

            UI.showToast(UI.i18n.keyRotated, 'success');
        } catch (error) {
            console.error('Failed to rotate key:', error);
            UI.showToast(UI.i18n.errorGeneratingKey, 'danger');
        }
    },

    /**
     * Resubmit a rejected application for review
     * @param {string} uuid - Application UUID
     */
    async resubmitApplication(uuid) {
        try {
            await ApplicationsAPI.resubmitApplication(uuid);
            UI.showToast(UI.i18n.resubmitSuccess, 'success');
            await this.loadApplications();
        } catch (error) {
            console.error('Failed to resubmit application:', error);
            UI.showToast(UI.i18n.resubmitError, 'danger');
        }
    },

    /**
     * Copy the generated key to clipboard
     */
    async copyKeyToClipboard() {
        const keyInput = document.getElementById('generatedKeyDisplay');
        const successAlert = document.getElementById('copySuccess');

        try {
            await navigator.clipboard.writeText(keyInput.value);
            successAlert.classList.remove('d-none');
        } catch {
            // Fallback for older browsers
            keyInput.select();
            document.execCommand('copy');
            successAlert.classList.remove('d-none');
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => DeveloperDashboard.init());
