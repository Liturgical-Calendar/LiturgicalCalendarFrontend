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
        'viewer': config.i18n.viewer,
        'editor': config.i18n.editor,
        'deleter': config.i18n.deleter
    };

    const relationBadgeClasses = {
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
                } catch (e) { /* non-JSON response */ }
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
                } catch (e) { /* non-JSON response */ }
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
});
