/**
 * Admin Permissions Management JavaScript
 *
 * Handles the admin interface for managing OpenFGA permission tuples.
 * Provides functionality for listing, granting, and revoking permissions.
 */

document.addEventListener('DOMContentLoaded', function() {
    const config = window.AdminPermissionsConfig;
    if (!config) {
        console.error('AdminPermissionsConfig not found');
        return;
    }

    // DOM elements
    const permissionsTableBody = document.getElementById('permissionsTableBody');
    const permissionsCount = document.getElementById('permissionsCount');
    const refreshBtn = document.getElementById('refreshBtn');
    const grantPermissionBtn = document.getElementById('grantPermissionBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    // Filter inputs
    const filterUser = document.getElementById('filterUser');
    const filterObjectType = document.getElementById('filterObjectType');
    const filterObjectId = document.getElementById('filterObjectId');
    const filterRelation = document.getElementById('filterRelation');

    // Grant modal elements
    const grantModal = new bootstrap.Modal(document.getElementById('grantModal'));
    const grantUser = document.getElementById('grantUser');
    const grantObjectType = document.getElementById('grantObjectType');
    const grantObjectId = document.getElementById('grantObjectId');
    const grantRelation = document.getElementById('grantRelation');
    const grantModalAlerts = document.getElementById('grantModalAlerts');
    const confirmGrantBtn = document.getElementById('confirmGrantBtn');

    // Revoke modal elements
    const revokeModal = new bootstrap.Modal(document.getElementById('revokeModal'));
    const revokeConfirmText = document.getElementById('revokeConfirmText');
    const revokeModalAlerts = document.getElementById('revokeModalAlerts');
    const confirmRevokeBtn = document.getElementById('confirmRevokeBtn');

    // Current revoke target
    let currentRevoke = null;

    // Object type display names
    const objectTypeNames = {
        'national_calendar': config.i18n.nationalCalendar,
        'diocesan_calendar': config.i18n.diocesanCalendar,
        'wider_region': config.i18n.widerRegion,
        'test_definition': config.i18n.testDefinition
    };

    // Relation display names and badge classes
    const relationNames = {
        'admin': config.i18n.admin,
        'viewer': config.i18n.viewer,
        'editor': config.i18n.editor,
        'deleter': config.i18n.deleter
    };

    const relationBadgeClasses = {
        'admin': 'bg-dark',
        'viewer': 'bg-info',
        'editor': 'bg-primary',
        'deleter': 'bg-danger'
    };

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Build query string from filter values
     * @returns {string} Query string
     */
    function buildFilterParams() {
        const params = new URLSearchParams();
        const user = filterUser.value.trim();
        const objectType = filterObjectType.value;
        const objectId = filterObjectId.value.trim();
        const relation = filterRelation.value;

        if (user) params.set('user', user);
        if (objectType) params.set('object_type', objectType);
        if (objectId) params.set('object_id', objectId);
        if (relation) params.set('relation', relation);

        const queryString = params.toString();
        return queryString ? '?' + queryString : '';
    }

    /**
     * Load permissions from the API
     */
    async function loadPermissions() {
        permissionsTableBody.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-spinner fa-spin me-2"></i>${config.i18n.loading}
            </div>
        `;

        try {
            const filterParams = buildFilterParams();
            const response = await fetch(config.apiUrl + '/admin/permissions' + filterParams, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load permissions');
            }

            const data = await response.json();
            const tuples = data.tuples || data.permissions || [];

            permissionsCount.textContent = tuples.length;
            displayPermissions(tuples);
        } catch (error) {
            console.error('Error loading permissions:', error);
            permissionsTableBody.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${config.i18n.failedToLoad}
                </div>
            `;
        }
    }

    /**
     * Display permissions in a table
     * @param {Array} tuples - Permission tuples
     */
    function displayPermissions(tuples) {
        if (tuples.length === 0) {
            permissionsTableBody.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-shield-alt fa-3x text-muted mb-3"></i>
                    <p class="mb-0">${config.i18n.noPermissions}</p>
                </div>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
        html += `
            <thead>
                <tr>
                    <th>${config.i18n.user}</th>
                    <th>${config.i18n.objectType}</th>
                    <th>${config.i18n.objectId}</th>
                    <th>${config.i18n.relation}</th>
                    <th>${config.i18n.actions}</th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const tuple of tuples) {
            const user = tuple.user || '';
            const relation = tuple.relation || '';
            // The API returns "object" as "type:id" (e.g., "national_calendar:IT")
            const objectFull = tuple.object || '';
            const colonIdx = objectFull.indexOf(':');
            const objectType = colonIdx !== -1 ? objectFull.substring(0, colonIdx) : objectFull;
            const objectId = colonIdx !== -1 ? objectFull.substring(colonIdx + 1) : '';

            const objectTypeName = objectTypeNames[objectType] || objectType;
            const relationName = relationNames[relation] || relation;
            const badgeClass = relationBadgeClasses[relation] || 'bg-secondary';

            html += `
                <tr>
                    <td><small class="text-muted">${escapeHtml(user)}</small></td>
                    <td>${escapeHtml(objectTypeName)}</td>
                    <td><code>${escapeHtml(objectId)}</code></td>
                    <td><span class="badge ${badgeClass}">${escapeHtml(relationName)}</span></td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm revoke-btn"
                                data-user="${escapeHtml(user)}"
                                data-object-type="${escapeHtml(objectType)}"
                                data-object-id="${escapeHtml(objectId)}"
                                data-relation="${escapeHtml(relation)}"
                                data-requires-auth>
                            <i class="fas fa-trash-alt me-1"></i>${config.i18n.revoke}
                        </button>
                    </td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        permissionsTableBody.innerHTML = html;

        // Add event listeners to revoke buttons
        document.querySelectorAll('.revoke-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                openRevokeModal(this.dataset);
            });
        });
    }

    /**
     * Open the grant permission modal
     */
    function openGrantModal() {
        grantUser.value = '';
        grantObjectType.value = '';
        grantObjectId.value = '';
        grantRelation.value = '';
        grantModalAlerts.innerHTML = '';
        grantModal.show();
    }

    /**
     * Handle grant permission confirmation
     */
    async function handleGrant() {
        const user = grantUser.value.trim();
        const objectType = grantObjectType.value;
        const objectId = grantObjectId.value.trim();
        const relation = grantRelation.value;

        if (!user || !objectType || !objectId || !relation) {
            grantModalAlerts.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${config.i18n.allFieldsRequired}
                </div>
            `;
            return;
        }

        confirmGrantBtn.disabled = true;
        const originalText = confirmGrantBtn.innerHTML;
        confirmGrantBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + config.i18n.granting;

        try {
            const response = await fetch(config.apiUrl + '/admin/permissions', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    user: user,
                    object_type: objectType,
                    object_id: objectId,
                    relation: relation
                })
            });

            if (!response.ok) {
                let errorMsg = config.i18n.failedToGrant;
                try {
                    const data = await response.json();
                    errorMsg = data.message || data.error || errorMsg;
                } catch { /* non-JSON response */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            grantModalAlerts.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    ${escapeHtml(data.message || config.i18n.grantSuccess)}
                </div>
            `;

            setTimeout(function() {
                confirmGrantBtn.disabled = false;
                confirmGrantBtn.innerHTML = originalText;
                grantModal.hide();
                loadPermissions();
            }, 1500);
        } catch (error) {
            console.error('Error granting permission:', error);
            grantModalAlerts.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(error.message || config.i18n.failedToGrant)}
                </div>
            `;
            confirmGrantBtn.disabled = false;
            confirmGrantBtn.innerHTML = originalText;
        }
    }

    /**
     * Open the revoke confirmation modal
     * @param {Object} data - Dataset from revoke button
     */
    function openRevokeModal(data) {
        currentRevoke = {
            user: data.user,
            objectType: data.objectType,
            objectId: data.objectId,
            relation: data.relation
        };

        const objectTypeName = objectTypeNames[data.objectType] || data.objectType;
        const relationName = relationNames[data.relation] || data.relation;

        revokeConfirmText.innerHTML = `
            ${config.i18n.confirmRevoke}<br><br>
            <strong>${config.i18n.user}:</strong> ${escapeHtml(data.user)}<br>
            <strong>${config.i18n.objectType}:</strong> ${escapeHtml(objectTypeName)}<br>
            <strong>${config.i18n.objectId}:</strong> <code>${escapeHtml(data.objectId)}</code><br>
            <strong>${config.i18n.relation}:</strong> ${escapeHtml(relationName)}
        `;
        revokeModalAlerts.innerHTML = '';
        revokeModal.show();
    }

    /**
     * Handle revoke permission confirmation
     */
    async function handleRevoke() {
        if (!currentRevoke) return;

        confirmRevokeBtn.disabled = true;
        const originalText = confirmRevokeBtn.innerHTML;
        confirmRevokeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + config.i18n.revoking;

        try {
            const response = await fetch(config.apiUrl + '/admin/permissions', {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    user: currentRevoke.user,
                    object_type: currentRevoke.objectType,
                    object_id: currentRevoke.objectId,
                    relation: currentRevoke.relation
                })
            });

            if (!response.ok) {
                let errorMsg = config.i18n.failedToRevoke;
                try {
                    const data = await response.json();
                    errorMsg = data.message || data.error || errorMsg;
                } catch { /* non-JSON response */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            revokeModalAlerts.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    ${escapeHtml(data.message || config.i18n.revokeSuccess)}
                </div>
            `;

            setTimeout(function() {
                confirmRevokeBtn.disabled = false;
                confirmRevokeBtn.innerHTML = originalText;
                revokeModal.hide();
                loadPermissions();
            }, 1500);
        } catch (error) {
            console.error('Error revoking permission:', error);
            revokeModalAlerts.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(error.message || config.i18n.failedToRevoke)}
                </div>
            `;
            confirmRevokeBtn.disabled = false;
            confirmRevokeBtn.innerHTML = originalText;
        }
    }

    // Event listeners
    refreshBtn.addEventListener('click', function() {
        const icon = this.querySelector('i');
        icon.classList.add('fa-spin');
        loadPermissions().finally(function() {
            icon.classList.remove('fa-spin');
        });
    });

    grantPermissionBtn.addEventListener('click', openGrantModal);
    confirmGrantBtn.addEventListener('click', handleGrant);
    confirmRevokeBtn.addEventListener('click', handleRevoke);
    applyFiltersBtn.addEventListener('click', loadPermissions);

    clearFiltersBtn.addEventListener('click', function() {
        filterUser.value = '';
        filterObjectType.value = '';
        filterObjectId.value = '';
        filterRelation.value = '';
        loadPermissions();
    });

    // Load permissions on page load
    loadPermissions();

    // ========================================================================
    // Permission Requests Review Section
    // ========================================================================

    const permReqI18n = config.i18n.permReq;
    if (!permReqI18n) {
        console.warn('Permission requests i18n config not found');
        return;
    }

    // Relation display names reuse the main map (which includes admin from i18n)
    const permReqRelationNames = relationNames;

    const permReqRelationBadgeClasses = {
        ...relationBadgeClasses,
        'admin': 'bg-warning text-dark'
    };

    // Permission requests state
    let permReqItems = {
        pending: [],
        approved: [],
        rejected: [],
        revoked: []
    };
    let currentPermReqId = null;

    const permReqReviewModal = new bootstrap.Modal(document.getElementById('permReqReviewModal'));

    /**
     * Load all permission requests from admin API
     */
    async function loadPermissionRequests() {
        const statuses = ['pending', 'approved', 'rejected', 'revoked'];
        const bodyPrefix = 'permReq';

        statuses.forEach(function(status) {
            const container = document.getElementById(bodyPrefix + status.charAt(0).toUpperCase() + status.slice(1) + 'Body');
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i>${permReqI18n.loading}
                    </div>
                `;
            }
        });

        try {
            const response = await fetch(config.apiUrl + '/admin/permission-requests', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load permission requests');
            }

            const data = await response.json();

            // Group requests by status
            const requests = data.requests || [];
            permReqItems = {
                pending: requests.filter(function(r) { return r.status === 'pending'; }),
                approved: requests.filter(function(r) { return r.status === 'approved'; }),
                rejected: requests.filter(function(r) { return r.status === 'rejected'; }),
                revoked: requests.filter(function(r) { return r.status === 'revoked'; })
            };

            // Update counts
            updatePermReqCounts();

            // Render active tab
            renderPermReqActiveTab();
        } catch (error) {
            console.error('Error loading permission requests:', error);
            statuses.forEach(function(status) {
                const container = document.getElementById(bodyPrefix + status.charAt(0).toUpperCase() + status.slice(1) + 'Body');
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${permReqI18n.failedToLoad}
                        </div>
                    `;
                }
            });
        }
    }

    /**
     * Update permission request count displays
     */
    function updatePermReqCounts() {
        const countEl = document.getElementById('permRequestsCount');
        const pendingBadge = document.getElementById('permReqPendingBadge');
        const totalPending = permReqItems.pending.length;
        if (countEl) countEl.textContent = totalPending;
        if (pendingBadge) pendingBadge.textContent = totalPending;
    }

    /**
     * Render the active permission requests tab
     */
    function renderPermReqActiveTab() {
        const activeTab = document.querySelector('#permRequestStatusTabs button.active');
        if (!activeTab) return;

        // Extract status from tab id: 'permReq-pending-tab' -> 'pending'
        const status = activeTab.id.replace('permReq-', '').replace('-tab', '');
        renderPermReqList(status);
    }

    /**
     * Render a user cell (name + email) for a permission request row.
     * @param {Object} req - Permission request item
     * @returns {string} HTML for the user cell
     */
    function renderPermReqUserCell(req) {
        let html = '<td><strong>' + escapeHtml(req.user_name || '-') + '</strong>';
        if (req.user_email) {
            html += '<br><small class="text-muted">' + escapeHtml(req.user_email) + '</small>';
        }
        return html + '</td>';
    }

    /**
     * Render a single permission request table row.
     * @param {Object} req - Permission request item
     * @param {string} status - Request status
     * @returns {string} HTML for the table row
     */
    function renderPermReqRow(req, status) {
        const objectTypeName = objectTypeNames[req.object_type] || req.object_type;
        const relationName = permReqRelationNames[req.relation] || req.relation;
        const badgeClass = permReqRelationBadgeClasses[req.relation] || 'bg-secondary';
        const requestedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : '-';
        const justification = req.justification
            ? (req.justification.length > 40
                ? escapeHtml(req.justification.substring(0, 40)) + '...'
                : escapeHtml(req.justification))
            : '-';

        let html = '<tr>';
        html += renderPermReqUserCell(req);
        html += '<td>' + escapeHtml(objectTypeName) + '</td>';
        html += '<td><code>' + escapeHtml(req.object_id || '-') + '</code></td>';
        html += '<td><span class="badge ' + badgeClass + '">' + escapeHtml(relationName) + '</span></td>';
        html += '<td><small class="text-muted fst-italic">' + justification + '</small></td>';
        html += '<td><small>' + requestedDate + '</small></td>';
        if (status !== 'pending') {
            const reviewedDate = req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '-';
            html += '<td><small>' + reviewedDate + '</small></td>';
        }
        html += '<td>';
        html += '<button class="btn btn-outline-primary btn-sm permReq-review-btn" ';
        html += 'data-permreq-id="' + escapeHtml(String(req.id || '')) + '" ';
        html += 'data-permreq-status="' + status + '" data-requires-auth>';
        html += '<i class="fas fa-eye me-1"></i>' + permReqI18n.review;
        html += '</button></td></tr>';
        return html;
    }

    /**
     * Render permission request list for a specific status
     * @param {string} status - Request status
     */
    function renderPermReqList(status) {
        const containerId = 'permReq' + status.charAt(0).toUpperCase() + status.slice(1) + 'Body';
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = permReqItems[status] || [];

        if (items.length === 0) {
            const message = status === 'pending' ? permReqI18n.noPendingRequests : permReqI18n.noRequests;
            const icon = status === 'pending' ? 'check-circle text-success' : 'inbox';
            container.innerHTML = '<div class="text-center text-muted py-4">'
                + '<i class="fas fa-' + icon + ' fa-3x mb-3"></i>'
                + '<p class="mb-0">' + message + '</p></div>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr>';
        html += '<th>' + permReqI18n.user + '</th>';
        html += '<th>' + permReqI18n.objectType + '</th>';
        html += '<th>' + permReqI18n.objectId + '</th>';
        html += '<th>' + permReqI18n.relation + '</th>';
        html += '<th>' + permReqI18n.justification + '</th>';
        html += '<th>' + permReqI18n.date + '</th>';
        if (status !== 'pending') {
            html += '<th>' + permReqI18n.reviewedAt + '</th>';
        }
        html += '<th>' + permReqI18n.actions + '</th>';
        html += '</tr></thead><tbody>';

        for (const req of items) {
            html += renderPermReqRow(req, status);
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;

        container.querySelectorAll('.permReq-review-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                openPermReqReviewModal(this.dataset.permreqId, this.dataset.permreqStatus);
            });
        });
    }

    /**
     * Open the review modal for a permission request
     * @param {string} reqId - Request ID
     * @param {string} status - Current status
     */
    /**
     * Build a detail row for the review modal table.
     * @param {string} icon - FontAwesome icon name
     * @param {string} label - Row label
     * @param {string} value - Row value HTML (not escaped — caller must escape)
     * @returns {string} HTML table row
     */
    function detailRow(icon, label, value) {
        return '<tr><th class="text-muted" style="width: 35%;"><i class="fas fa-' + icon + ' me-2"></i>'
            + label + '</th><td>' + value + '</td></tr>';
    }

    /**
     * Render the detail table for a permission request in the review modal.
     * @param {Object} item - Permission request item
     * @param {string} status - Current status
     * @returns {string} HTML for the detail table
     */
    function renderPermReqDetails(item, status) {
        const objectTypeName = objectTypeNames[item.object_type] || item.object_type;
        const relationName = permReqRelationNames[item.relation] || item.relation;
        const badgeClass = permReqRelationBadgeClasses[item.relation] || 'bg-secondary';
        const requestedDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : '-';

        const statusBadges = {
            pending: '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>' + permReqI18n.statusPending + '</span>',
            approved: '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>' + permReqI18n.statusApproved + '</span>',
            rejected: '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>' + permReqI18n.statusRejected + '</span>',
            revoked: '<span class="badge bg-secondary"><i class="fas fa-ban me-1"></i>' + permReqI18n.statusRevoked + '</span>'
        };

        let userValue = '<strong>' + escapeHtml(item.user_name || '-') + '</strong>';
        if (item.user_email) {
            userValue += '<br><small class="text-muted">' + escapeHtml(item.user_email) + '</small>';
        }

        let html = '<table class="table table-borderless mb-0">';
        html += detailRow('user', permReqI18n.user, userValue);
        html += detailRow('cube', permReqI18n.objectType, escapeHtml(objectTypeName));
        html += detailRow('hashtag', permReqI18n.objectId, '<code>' + escapeHtml(item.object_id || '-') + '</code>');
        html += detailRow('user-tag', permReqI18n.relation, '<span class="badge ' + badgeClass + '">' + escapeHtml(relationName) + '</span>');

        if (item.justification) {
            html += detailRow('comment', permReqI18n.justification, '<em>"' + escapeHtml(item.justification) + '"</em>');
        }
        if (item.credentials) {
            html += detailRow('id-badge', permReqI18n.credentials, '<em>' + escapeHtml(item.credentials) + '</em>');
        }

        html += detailRow('info-circle', permReqI18n.status, statusBadges[status] || status);
        html += detailRow('calendar', permReqI18n.requested, requestedDate);

        if (status !== 'pending' && item.reviewed_at) {
            const reviewedDate = new Date(item.reviewed_at).toLocaleDateString();
            html += detailRow('calendar-check', permReqI18n.reviewedAt, reviewedDate);
        }
        if (item.review_notes) {
            html += detailRow('sticky-note', permReqI18n.reviewNotes, '<em>"' + escapeHtml(item.review_notes) + '"</em>');
        }

        html += '</table>';
        return html;
    }

    /**
     * Configure review modal buttons based on request status.
     * @param {string} status - Current request status
     */
    function configureReviewModalButtons(status) {
        const approveBtn = document.getElementById('permReqApproveBtn');
        const rejectBtn = document.getElementById('permReqRejectBtn');
        const revokeBtn = document.getElementById('permReqRevokeBtn');
        const notesSection = document.getElementById('permReqNotesSection');

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
            notesSection?.classList.add('d-none');
        }
    }

    /**
     * Open the review modal for a permission request
     * @param {string} reqId - Request ID
     * @param {string} status - Current status
     */
    function openPermReqReviewModal(reqId, status) {
        const item = permReqItems[status]?.find(function(i) { return String(i.id) === String(reqId); });
        if (!item) return;

        currentPermReqId = reqId;

        document.getElementById('permReqReviewNotes').value = '';
        document.getElementById('permReqModalAlerts').innerHTML = '';

        configureReviewModalButtons(status);
        document.getElementById('permReqDetails').innerHTML = renderPermReqDetails(item, status);

        permReqReviewModal.show();
    }

    /**
     * Process a permission request action (approve/reject/revoke)
     * @param {string} action - Action to perform
     */
    async function processPermReq(action) {
        if (!currentPermReqId) return;

        const notes = document.getElementById('permReqReviewNotes').value.trim();
        const approveBtn = document.getElementById('permReqApproveBtn');
        const rejectBtn = document.getElementById('permReqRejectBtn');
        const revokeBtn = document.getElementById('permReqRevokeBtn');
        const modalAlerts = document.getElementById('permReqModalAlerts');

        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        revokeBtn.disabled = true;

        const btnMap = { approve: approveBtn, reject: rejectBtn, revoke: revokeBtn };
        const btn = btnMap[action];
        const originalText = btn?.innerHTML || '';

        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + permReqI18n.processing;
        }

        try {
            const response = await fetch(
                config.apiUrl + '/admin/permission-requests/' + encodeURIComponent(currentPermReqId) + '/' + action,
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

            if (!response.ok) {
                let errorMsg = 'Request failed';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errData.error || errorMsg;
                } catch { /* non-JSON error response */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            const successMessages = {
                approve: permReqI18n.approveSuccess,
                reject: permReqI18n.rejectSuccess,
                revoke: permReqI18n.revokeSuccess
            };

            modalAlerts.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    ${escapeHtml(data.message || successMessages[action])}
                </div>
            `;

            setTimeout(function() {
                // Restore button state before hiding modal
                approveBtn.disabled = false;
                rejectBtn.disabled = false;
                revokeBtn.disabled = false;
                if (btn) {
                    btn.innerHTML = originalText;
                }
                permReqReviewModal.hide();
                loadPermissionRequests();
                // Refresh notifications
                if (typeof Notifications !== 'undefined' && Notifications.fetchNotifications) {
                    Notifications.fetchNotifications();
                }
            }, 1500);
        } catch (error) {
            console.error('Error processing permission request:', error);
            modalAlerts.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(error.message || permReqI18n.failedToProcess)}
                </div>
            `;
            approveBtn.disabled = false;
            rejectBtn.disabled = false;
            revokeBtn.disabled = false;
            if (btn) {
                btn.innerHTML = originalText;
            }
        }
    }

    // Permission request event listeners
    document.getElementById('permReqApproveBtn')?.addEventListener('click', function() {
        processPermReq('approve');
    });
    document.getElementById('permReqRejectBtn')?.addEventListener('click', function() {
        processPermReq('reject');
    });
    document.getElementById('permReqRevokeBtn')?.addEventListener('click', function() {
        processPermReq('revoke');
    });

    document.getElementById('refreshPermRequestsBtn')?.addEventListener('click', function() {
        const icon = this.querySelector('i');
        icon?.classList.add('fa-spin');
        loadPermissionRequests().finally(function() {
            icon?.classList.remove('fa-spin');
        });
    });

    // Tab change events for permission requests
    document.querySelectorAll('#permRequestStatusTabs button[data-bs-toggle="tab"]').forEach(function(tab) {
        tab.addEventListener('shown.bs.tab', function() {
            renderPermReqActiveTab();
        });
    });

    // Load permission requests on page load
    loadPermissionRequests();
});
