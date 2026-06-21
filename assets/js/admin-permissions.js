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
    const grantModalEl = document.getElementById('grantModal');
    const grantModal = grantModalEl ? new bootstrap.Modal(grantModalEl) : null;
    const grantUser = document.getElementById('grantUser');
    const grantObjectType = document.getElementById('grantObjectType');
    // Note: the Object ID control is looked up live (document.getElementById) wherever it is
    // used, because syncObjectIdField() swaps the input<->select element when the object type
    // changes; a cached reference would go stale after that swap.
    const grantRelation = document.getElementById('grantRelation');
    const grantModalAlerts = document.getElementById('grantModalAlerts');
    const confirmGrantBtn = document.getElementById('confirmGrantBtn');

    // Fixed object-id choices for the General Roman Calendar type.
    // The five enumerated General Roman Calendar sub-resource ids.
    // Keep in sync with the API constant AccessRequestRepository::GRC_OBJECT_IDS
    // and the identical copy in assets/js/permission-requests.js.
    const GRC_OBJECT_IDS = [
        { id: 'temporale',          label: config.i18n.grcTemporale },
        { id: 'EDITIO_TYPICA_1970', label: config.i18n.grcSanctorale1970 },
        { id: 'EDITIO_TYPICA_2002', label: config.i18n.grcSanctorale2002 },
        { id: 'EDITIO_TYPICA_2008', label: config.i18n.grcSanctorale2008 },
        { id: 'decrees',            label: config.i18n.grcDecrees }
    ];

    // Swap the free-text Object ID input for a <select> when GRC is selected, and back otherwise.
    function syncObjectIdField(objectType) {
        const current = document.getElementById('grantObjectId');
        if (objectType === 'general_roman_calendar') {
            if (current.tagName === 'SELECT') {
                return;
            }
            const select = document.createElement('select');
            select.className = 'form-select';
            select.id = 'grantObjectId';
            select.required = true;
            // Empty placeholder forces an explicit choice instead of silently defaulting to the
            // first id (temporale); consistent with the object-type and relation selects.
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = config.i18n.selectObjectId || 'Select object ID...';
            placeholder.disabled = true;
            placeholder.selected = true;
            select.appendChild(placeholder);
            for (const opt of GRC_OBJECT_IDS) {
                const o = document.createElement('option');
                o.value = opt.id;
                o.textContent = opt.label;
                select.appendChild(o);
            }
            current.replaceWith(select);
        } else if (current.tagName === 'SELECT') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.id = 'grantObjectId';
            input.required = true;
            input.placeholder = config.i18n.enterObjectId || '';
            current.replaceWith(input);
        }
    }

    // Revoke modal elements
    const revokeModalEl = document.getElementById('revokeModal');
    const revokeModal = revokeModalEl ? new bootstrap.Modal(revokeModalEl) : null;
    const revokeConfirmText = document.getElementById('revokeConfirmText');
    const revokeModalAlerts = document.getElementById('revokeModalAlerts');
    const confirmRevokeBtn = document.getElementById('confirmRevokeBtn');

    // Current revoke target
    let currentRevoke = null;

    // Map of zitadel userId → { userId, displayName, username, email, roles, ... }
    // Populated by loadUserMap() and used by displayPermissions() to show
    // human-readable user info instead of raw zitadel IDs in the tuple table.
    let userMap = new Map();

    // Object type display names
    const objectTypeNames = {
        'national_calendar': config.i18n.nationalCalendar,
        'diocesan_calendar': config.i18n.diocesanCalendar,
        'wider_region': config.i18n.widerRegion,
        'test_definition': config.i18n.testDefinition,
        'general_roman_calendar': config.i18n.generalRomanCalendar
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
     * Load the user list from /admin/users and rebuild userMap so
     * displayPermissions() can show display name + email instead of
     * the raw zitadel ID. Fails silently — on error userMap is left
     * empty and tuples render with their raw IDs (the prior behavior).
     */
    async function loadUserMap() {
        try {
            // limit=1000 is the API maximum; sufficient for this project's scale.
            const response = await fetch(config.apiUrl + '/admin/users?limit=1000', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (!response.ok) return;
            const data = await response.json();
            const users = [
                ...(Array.isArray(data.usersWithRoles) ? data.usersWithRoles : []),
                ...(Array.isArray(data.usersWithoutRoles) ? data.usersWithoutRoles : [])
            ];
            userMap = new Map(users.map(function (u) { return [u.userId, u]; }));
        } catch (error) {
            console.error('Failed to load user map for permissions display:', error);
        }
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

            // API returns user as "user:<zitadel-id>"; strip the prefix for the userMap lookup.
            const lookupId = user.startsWith('user:') ? user.slice('user:'.length) : user;
            const userInfo = userMap.get(lookupId);
            const userCellHtml = userInfo
                ? `<strong>${escapeHtml(userInfo.displayName || userInfo.username || lookupId)}</strong>`
                    + (userInfo.email ? `<br><small class="text-muted">${escapeHtml(userInfo.email)}</small>` : '')
                : `<small class="text-muted font-monospace">${escapeHtml(user)}</small>`;

            html += `
                <tr>
                    <td>${userCellHtml}</td>
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
        syncObjectIdField('');
        document.getElementById('grantObjectId').value = '';
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
        const objectId = document.getElementById('grantObjectId').value.trim();
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

            // If the API cascaded a role revoke (deleted the user's last
            // in-scope tuple), the related access_requests have just been
            // marked revoked too — refresh that section so it doesn't show
            // stale "Approved" entries. Skip the extra fetch when nothing
            // cascaded.
            const cascaded = Array.isArray(data.cascaded_roles) && data.cascaded_roles.length > 0;

            setTimeout(function() {
                confirmRevokeBtn.disabled = false;
                confirmRevokeBtn.innerHTML = originalText;
                revokeModal.hide();
                loadPermissions();
                if (cascaded) {
                    loadAccessRequests();
                }
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

    // Event listeners — the FGA permission-tuple management section is
    // global-admin-only; its DOM is absent for resource-admins, so skip its
    // wiring and initial load entirely.
    if (config.isGlobalAdmin) {
        refreshBtn.addEventListener('click', async function() {
            const icon = this.querySelector('i');
            icon.classList.add('fa-spin');
            // Refresh user map first so newly-granted-to users appear with friendly names.
            await loadUserMap();
            loadPermissions().finally(function() {
                icon.classList.remove('fa-spin');
            });
        });

        grantPermissionBtn.addEventListener('click', openGrantModal);
        grantObjectType.addEventListener('change', (e) => syncObjectIdField(e.target.value));
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

        // Load user map and then permissions on page load
        loadUserMap().then(loadPermissions);
    }

    // ========================================================================
    // Access Requests Review Section
    // ========================================================================

    const accessReqI18n = config.i18n.accessReq;
    if (!accessReqI18n) {
        console.warn('Access requests i18n config not found');
        return;
    }

    // Role display names for access requests
    const accessReqRoleNames = {
        'calendar_editor': accessReqI18n.calendarEditor,
        'test_editor': accessReqI18n.testEditor,
        'developer': accessReqI18n.developer
    };

    // Relation display names reuse the main map (which includes admin from i18n)
    const accessReqRelationNames = relationNames;

    const accessReqRelationBadgeClasses = {
        ...relationBadgeClasses,
        'admin': 'bg-warning text-dark'
    };

    // Access requests state
    let accessReqItems = {
        pending: [],
        approved: [],
        rejected: [],
        revoked: []
    };
    let currentAccessReqId = null;

    const accessReqReviewModal = new bootstrap.Modal(document.getElementById('permReqReviewModal'));

    /**
     * Summarize a permissions array for table display
     * @param {Array} permissions - Permission objects
     * @returns {string} Summary HTML
     */
    function summarizeAccessPermissions(permissions) {
        if (!permissions || permissions.length === 0) {
            return '-';
        }
        const parts = [];
        for (const perm of permissions) {
            const typeName = objectTypeNames[perm.object_type] || perm.object_type;
            const relName = accessReqRelationNames[perm.relation] || perm.relation;
            const badgeClass = accessReqRelationBadgeClasses[perm.relation] || 'bg-secondary';
            parts.push(
                '<span class="badge ' + badgeClass + ' me-1">'
                + escapeHtml(relName)
                + '</span> '
                + escapeHtml(typeName) + ': <code>' + escapeHtml(perm.object_id) + '</code>'
            );
        }
        return parts.join('<br>');
    }

    /**
     * Load all access requests from admin API
     */
    async function loadAccessRequests() {
        const statuses = ['pending', 'approved', 'rejected', 'revoked'];
        const bodyPrefix = 'permReq';

        statuses.forEach(function(status) {
            const container = document.getElementById(bodyPrefix + status.charAt(0).toUpperCase() + status.slice(1) + 'Body');
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i>${accessReqI18n.loading}
                    </div>
                `;
            }
        });

        try {
            const response = await fetch(config.apiUrl + '/admin/access-requests', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load access requests');
            }

            const data = await response.json();

            // Group requests by status
            const requests = data.requests || [];
            accessReqItems = {
                pending: requests.filter(function(r) { return r.status === 'pending'; }),
                approved: requests.filter(function(r) { return r.status === 'approved'; }),
                rejected: requests.filter(function(r) { return r.status === 'rejected'; }),
                revoked: requests.filter(function(r) { return r.status === 'revoked'; })
            };

            // Update counts
            updateAccessReqCounts();

            // Render active tab
            renderAccessReqActiveTab();
        } catch (error) {
            console.error('Error loading access requests:', error);
            statuses.forEach(function(status) {
                const container = document.getElementById(bodyPrefix + status.charAt(0).toUpperCase() + status.slice(1) + 'Body');
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${accessReqI18n.failedToLoad}
                        </div>
                    `;
                }
            });
        }
    }

    /**
     * Update access request count displays
     */
    function updateAccessReqCounts() {
        const countEl = document.getElementById('permRequestsCount');
        const pendingBadge = document.getElementById('permReqPendingBadge');
        const totalPending = accessReqItems.pending.length;
        if (countEl) countEl.textContent = totalPending;
        if (pendingBadge) pendingBadge.textContent = totalPending;
    }

    /**
     * Render the active access requests tab
     */
    function renderAccessReqActiveTab() {
        const activeTab = document.querySelector('#permRequestStatusTabs button.active');
        if (!activeTab) return;

        // Extract status from tab id: 'permReq-pending-tab' -> 'pending'
        const status = activeTab.id.replace('permReq-', '').replace('-tab', '');
        renderAccessReqList(status);
    }

    /**
     * Render a user cell (name + email) for an access request row.
     * @param {Object} req - Access request item
     * @returns {string} HTML for the user cell
     */
    function renderAccessReqUserCell(req) {
        let html = '<td><strong>' + escapeHtml(req.user_name || '-') + '</strong>';
        if (req.user_email) {
            html += '<br><small class="text-muted">' + escapeHtml(req.user_email) + '</small>';
        }
        return html + '</td>';
    }

    /**
     * Render a single access request table row.
     * @param {Object} req - Access request item
     * @param {string} status - Request status
     * @returns {string} HTML for the table row
     */
    function renderAccessReqRow(req, status) {
        const roleName = accessReqRoleNames[req.requested_role] || req.requested_role;
        const requestedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : '-';
        const justification = req.justification
            ? (req.justification.length > 40
                ? escapeHtml(req.justification.substring(0, 40)) + '...'
                : escapeHtml(req.justification))
            : '-';

        let html = '<tr>';
        html += renderAccessReqUserCell(req);
        html += '<td><span class="badge bg-info">' + escapeHtml(roleName) + '</span></td>';
        html += '<td>' + summarizeAccessPermissions(req.permissions) + '</td>';
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
        html += '<i class="fas fa-eye me-1"></i>' + accessReqI18n.review;
        html += '</button></td></tr>';
        return html;
    }

    /**
     * Render access request list for a specific status
     * @param {string} status - Request status
     */
    function renderAccessReqList(status) {
        const containerId = 'permReq' + status.charAt(0).toUpperCase() + status.slice(1) + 'Body';
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = accessReqItems[status] || [];

        if (items.length === 0) {
            const message = status === 'pending' ? accessReqI18n.noPendingRequests : accessReqI18n.noRequests;
            const icon = status === 'pending' ? 'check-circle text-success' : 'inbox';
            container.innerHTML = '<div class="text-center text-muted py-4">'
                + '<i class="fas fa-' + icon + ' fa-3x mb-3"></i>'
                + '<p class="mb-0">' + message + '</p></div>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr>';
        html += '<th>' + accessReqI18n.user + '</th>';
        html += '<th>' + accessReqI18n.role + '</th>';
        html += '<th>' + accessReqI18n.permissions + '</th>';
        html += '<th>' + accessReqI18n.justification + '</th>';
        html += '<th>' + accessReqI18n.date + '</th>';
        if (status !== 'pending') {
            html += '<th>' + accessReqI18n.reviewedAt + '</th>';
        }
        html += '<th>' + accessReqI18n.actions + '</th>';
        html += '</tr></thead><tbody>';

        for (const req of items) {
            html += renderAccessReqRow(req, status);
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;

        container.querySelectorAll('.permReq-review-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                openAccessReqReviewModal(this.dataset.permreqId, this.dataset.permreqStatus);
            });
        });
    }

    /**
     * Build a detail row for the review modal table.
     * @param {string} icon - FontAwesome icon name
     * @param {string} label - Row label
     * @param {string} value - Row value HTML (not escaped - caller must escape)
     * @returns {string} HTML table row
     */
    function detailRow(icon, label, value) {
        return '<tr><th class="text-muted" style="width: 35%;"><i class="fas fa-' + icon + ' me-2"></i>'
            + label + '</th><td>' + value + '</td></tr>';
    }

    /**
     * Render the detail table for an access request in the review modal.
     * @param {Object} item - Access request item
     * @param {string} status - Current status
     * @returns {string} HTML for the detail table
     */
    function renderAccessReqDetails(item, status) {
        const roleName = accessReqRoleNames[item.requested_role] || item.requested_role;
        const requestedDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : '-';

        const statusBadges = {
            pending: '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>' + accessReqI18n.statusPending + '</span>',
            approved: '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>' + accessReqI18n.statusApproved + '</span>',
            rejected: '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>' + accessReqI18n.statusRejected + '</span>',
            revoked: '<span class="badge bg-secondary"><i class="fas fa-ban me-1"></i>' + accessReqI18n.statusRevoked + '</span>'
        };

        let userValue = '<strong>' + escapeHtml(item.user_name || '-') + '</strong>';
        if (item.user_email) {
            userValue += '<br><small class="text-muted">' + escapeHtml(item.user_email) + '</small>';
        }

        let html = '<table class="table table-borderless mb-0">';
        html += detailRow('user', accessReqI18n.user, userValue);
        html += detailRow('user-tag', accessReqI18n.role, '<span class="badge bg-info">' + escapeHtml(roleName) + '</span>');

        // Permissions detail
        if (item.permissions && item.permissions.length > 0) {
            html += detailRow('key', accessReqI18n.permissions, summarizeAccessPermissions(item.permissions));
        }

        if (item.justification) {
            html += detailRow('comment', accessReqI18n.justification, '<em>"' + escapeHtml(item.justification) + '"</em>');
        }
        if (item.credentials) {
            html += detailRow('id-badge', accessReqI18n.credentials, '<em>' + escapeHtml(item.credentials) + '</em>');
        }

        html += detailRow('info-circle', accessReqI18n.status, statusBadges[status] || status);
        html += detailRow('calendar', accessReqI18n.requested, requestedDate);

        if (status !== 'pending' && item.reviewed_at) {
            const reviewedDate = new Date(item.reviewed_at).toLocaleDateString();
            html += detailRow('calendar-check', accessReqI18n.reviewedAt, reviewedDate);
        }
        if (item.review_notes) {
            html += detailRow('sticky-note', accessReqI18n.reviewNotes, '<em>"' + escapeHtml(item.review_notes) + '"</em>');
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
            // Rejected requests cannot be approved by admin — user must resubmit
            notesSection?.classList.add('d-none');
        } else {
            notesSection?.classList.add('d-none');
        }
    }

    /**
     * Open the review modal for an access request
     * @param {string} reqId - Request ID
     * @param {string} status - Current status
     */
    function openAccessReqReviewModal(reqId, status) {
        const item = accessReqItems[status]?.find(function(i) { return String(i.id) === String(reqId); });
        if (!item) return;

        currentAccessReqId = reqId;

        document.getElementById('permReqReviewNotes').value = '';
        document.getElementById('permReqModalAlerts').innerHTML = '';

        configureReviewModalButtons(status);
        document.getElementById('permReqDetails').innerHTML = renderAccessReqDetails(item, status);

        accessReqReviewModal.show();
    }

    /**
     * Process an access request action (approve/reject/revoke)
     * @param {string} action - Action to perform
     */
    async function processAccessReq(action) {
        if (!currentAccessReqId) return;

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
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + accessReqI18n.processing;
        }

        try {
            const response = await fetch(
                config.apiUrl + '/admin/access-requests/' + encodeURIComponent(currentAccessReqId) + '/' + action,
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
                approve: accessReqI18n.approveSuccess,
                reject: accessReqI18n.rejectSuccess,
                revoke: accessReqI18n.revokeSuccess
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
                accessReqReviewModal.hide();
                loadAccessRequests();
                // Approving creates a tuple, revoking removes one; reject doesn't
                // affect tuples but a re-fetch is cheap. Refresh userMap first so
                // a freshly-promoted user appears with their friendly name.
                // The FGA permissions table only exists for global admins; resource-admins
                // have no such DOM, so skip its refresh (loadAccessRequests above already
                // refreshed the review list they care about).
                if (config.isGlobalAdmin) {
                    loadUserMap().then(loadPermissions);
                }
                // Refresh notifications
                if (typeof Notifications !== 'undefined' && Notifications.fetchNotifications) {
                    Notifications.fetchNotifications();
                }
            }, 1500);
        } catch (error) {
            console.error('Error processing access request:', error);
            modalAlerts.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(error.message || accessReqI18n.failedToProcess)}
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

    // Access request event listeners
    document.getElementById('permReqApproveBtn')?.addEventListener('click', function() {
        processAccessReq('approve');
    });
    document.getElementById('permReqRejectBtn')?.addEventListener('click', function() {
        processAccessReq('reject');
    });
    document.getElementById('permReqRevokeBtn')?.addEventListener('click', function() {
        processAccessReq('revoke');
    });

    document.getElementById('refreshPermRequestsBtn')?.addEventListener('click', function() {
        const icon = this.querySelector('i');
        icon?.classList.add('fa-spin');
        loadAccessRequests().finally(function() {
            icon?.classList.remove('fa-spin');
        });
    });

    // Tab change events for access requests
    document.querySelectorAll('#permRequestStatusTabs button[data-bs-toggle="tab"]').forEach(function(tab) {
        tab.addEventListener('shown.bs.tab', function() {
            renderAccessReqActiveTab();
        });
    });

    // Load access requests on page load
    loadAccessRequests();
});
