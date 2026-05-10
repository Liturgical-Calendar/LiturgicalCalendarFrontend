/**
 * Access Requests Page JavaScript
 *
 * Handles the user-facing interface for requesting access (role + permissions)
 * via the unified /auth/access-requests endpoint, and viewing existing request status.
 */

document.addEventListener('DOMContentLoaded', async function() {
    const config = window.AccessRequestsConfig;
    if (!config) {
        console.error('AccessRequestsConfig not found');
        return;
    }

    const existingRequestsBody = document.getElementById('existingRequestsBody');
    const accessRequestForm = document.getElementById('accessRequestForm');
    const formAlerts = document.getElementById('formAlerts');
    const submitBtn = document.getElementById('submitBtn');
    const requestedRoleRadios = document.querySelectorAll('input[name="requested_role"]');
    const requestFormBody = document.getElementById('requestFormBody');
    const permissionsSection = document.getElementById('permissionsSection');

    function getRequestedRole() {
        const checked = document.querySelector('input[name="requested_role"]:checked');
        return checked ? checked.value : '';
    }

    function setRequestedRole(value) {
        requestedRoleRadios.forEach(function(r) { r.checked = (r.value === value); });
    }

    function setRoleSelectionDisabled(disabled) {
        requestedRoleRadios.forEach(function(r) { r.disabled = disabled; });
    }
    const permissionRows = document.getElementById('permissionRows');
    const addPermissionBtn = document.getElementById('addPermissionBtn');

    // Mirror of API CreateAccessRequestBody.permissions maxItems
    const MAX_PERMISSIONS = 50;

    // Role display names
    const roleNames = {
        'calendar_editor': config.i18n.calendarEditor,
        'test_editor': config.i18n.testEditor,
        'developer': config.i18n.developer
    };

    // Object type display names
    const objectTypeNames = {
        'national_calendar': config.i18n.nationalCalendar,
        'diocesan_calendar': config.i18n.diocesanCalendar,
        'wider_region': config.i18n.widerRegion,
        'test_definition': config.i18n.testDefinition
    };

    // Relation display names
    const relationNames = {
        'viewer': config.i18n.viewer,
        'editor': config.i18n.editor,
        'admin': config.i18n.admin,
        'deleter': config.i18n.deleter
    };

    // Relation badge classes
    const relationBadgeClasses = {
        'viewer': 'bg-info',
        'editor': 'bg-primary',
        'admin': 'bg-warning text-dark',
        'deleter': 'bg-danger'
    };

    // Status display info
    const statusInfo = {
        'pending': { class: 'bg-warning text-dark', icon: 'fas fa-clock', text: config.i18n.statusPending },
        'approved': { class: 'bg-success', icon: 'fas fa-check', text: config.i18n.statusApproved },
        'rejected': { class: 'bg-danger', icon: 'fas fa-times', text: config.i18n.statusRejected },
        'revoked': { class: 'bg-secondary', icon: 'fas fa-ban', text: config.i18n.statusRevoked }
    };

    // Object types allowed per role
    const roleObjectTypes = {
        'calendar_editor': ['national_calendar', 'diocesan_calendar', 'wider_region'],
        'test_editor': ['test_definition'],
        'developer': ['national_calendar', 'diocesan_calendar', 'wider_region', 'test_definition']
    };

    let permissionRowCounter = 0;

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
     * Show alert message in the form
     * @param {string} type - Alert type (success, danger, warning, info)
     * @param {string} message - Alert message
     */
    function showAlert(type, message) {
        const allowedTypes = ['success', 'danger', 'warning', 'info', 'primary', 'secondary', 'light', 'dark'];
        const safeType = allowedTypes.includes(type) ? type : 'info';
        formAlerts.innerHTML = `
            <div class="alert alert-${safeType} alert-dismissible fade show" role="alert">
                ${escapeHtml(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    /**
     * Format a date for display
     * @param {string|null} dateStr - ISO date string
     * @returns {string} Formatted date or '-'
     */
    function formatDate(dateStr) {
        return dateStr ? new Date(dateStr).toLocaleDateString() : '-';
    }

    /**
     * Get allowed object types for the currently selected role
     * @returns {string[]} Array of allowed object type keys
     */
    function getAllowedObjectTypes() {
        const role = getRequestedRole();
        return roleObjectTypes[role] || [];
    }

    /**
     * Build the object type <option> elements for a permission row
     * @returns {string} HTML options
     */
    function buildObjectTypeOptions() {
        const allowed = getAllowedObjectTypes();
        let html = '<option value="">' + escapeHtml(config.i18n.selectObjectType) + '</option>';
        for (const type of allowed) {
            html += '<option value="' + escapeHtml(type) + '">' + escapeHtml(objectTypeNames[type] || type) + '</option>';
        }
        return html;
    }

    /**
     * Add a new permission row to the form
     */
    function updateAddPermissionBtnState() {
        const currentCount = permissionRows.querySelectorAll('.card').length;
        addPermissionBtn.disabled = currentCount >= MAX_PERMISSIONS;
    }

    function addPermissionRow() {
        const currentCount = permissionRows.querySelectorAll('.card').length;
        if (currentCount >= MAX_PERMISSIONS) {
            const tmpl = config.i18n.maxPermissionsReached
                || 'You have reached the maximum of %1$d permissions per request.';
            showAlert('warning', tmpl.replace(/%1\$d/g, String(MAX_PERMISSIONS)));
            updateAddPermissionBtnState();
            return;
        }
        permissionRowCounter++;
        const rowId = 'permRow_' + permissionRowCounter;
        const row = document.createElement('div');
        row.className = 'card bg-light mb-2';
        row.id = rowId;
        row.innerHTML = `
            <div class="card-body py-2 px-3">
                <div class="row g-2 align-items-end">
                    <div class="col-md-4">
                        <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.objectType)}</label>
                        <select class="form-select form-select-sm perm-object-type" required>
                            ${buildObjectTypeOptions()}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.objectId)}</label>
                        <input type="text" class="form-control form-control-sm perm-object-id" required
                            placeholder="${escapeHtml(config.i18n.objectIdPlaceholder)}">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.relation)}</label>
                        <select class="form-select form-select-sm perm-relation" required>
                            <option value="">${escapeHtml(config.i18n.selectRelation)}</option>
                            <option value="admin">${escapeHtml(config.i18n.admin)}</option>
                            <option value="viewer">${escapeHtml(config.i18n.viewer)}</option>
                            <option value="editor">${escapeHtml(config.i18n.editor)}</option>
                            <option value="deleter">${escapeHtml(config.i18n.deleter)}</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-outline-danger btn-sm w-100 remove-perm-btn"
                                title="${escapeHtml(config.i18n.remove)}"
                                aria-label="${escapeHtml(config.i18n.remove)}">
                            <i class="fas fa-trash-alt" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        permissionRows.appendChild(row);

        // Bind remove button
        row.querySelector('.remove-perm-btn').addEventListener('click', function() {
            row.remove();
            updateAddPermissionBtnState();
        });

        updateAddPermissionBtnState();
    }

    /**
     * Update the permissions section visibility and rebuild object type
     * options based on selected role.
     */
    function updatePermissionsSection() {
        const role = getRequestedRole();
        if (role) {
            if (requestFormBody) requestFormBody.style.display = '';
            permissionsSection.style.display = '';
            // Rebuild object type options in existing rows
            const selects = permissionRows.querySelectorAll('.perm-object-type');
            const optionsHtml = buildObjectTypeOptions();
            selects.forEach(function(sel) {
                const currentVal = sel.value;
                sel.innerHTML = optionsHtml;
                // Try to restore the previous selection if still valid
                if (currentVal) {
                    const opt = sel.querySelector('option[value="' + currentVal + '"]');
                    if (opt) {
                        sel.value = currentVal;
                    }
                }
            });
            // Add an initial row if there are none
            if (permissionRows.children.length === 0) {
                addPermissionRow();
            }
        } else {
            if (requestFormBody) requestFormBody.style.display = 'none';
            permissionsSection.style.display = 'none';
        }
    }

    /**
     * Collect permissions from the form rows
     * @returns {Array|null} Array of permission objects, or null if validation fails
     */
    function collectPermissions() {
        const rows = permissionRows.querySelectorAll('.card');
        if (rows.length === 0) {
            return null;
        }
        const permissions = [];

        for (const row of rows) {
            const objectType = row.querySelector('.perm-object-type').value;
            const objectId = row.querySelector('.perm-object-id').value.trim();
            const relation = row.querySelector('.perm-relation').value;

            if (!objectType || !objectId || !relation) {
                return null;
            }

            permissions.push({
                object_type: objectType,
                object_id: objectId,
                relation: relation
            });
        }

        return permissions;
    }

    /**
     * Summarize a permissions array into a short display string
     * @param {Array} permissions - Array of permission objects
     * @returns {string} Summary HTML
     */
    function summarizePermissions(permissions) {
        if (!permissions || permissions.length === 0) {
            return '-';
        }
        const parts = [];
        for (const perm of permissions) {
            const typeName = objectTypeNames[perm.object_type] || perm.object_type;
            const relName = relationNames[perm.relation] || perm.relation;
            const badgeClass = relationBadgeClasses[perm.relation] || 'bg-secondary';
            parts.push(
                '<span class="badge ' + badgeClass + ' me-1">'
                + escapeHtml(relName)
                + '</span> '
                + escapeHtml(typeName) + ': <code>' + escapeHtml(perm.object_id) + '</code>'
            );
        }
        return parts.join('<br>');
    }

    // ========================================================================
    // Event listeners
    // ========================================================================

    requestedRoleRadios.forEach(function(r) {
        r.addEventListener('change', updatePermissionsSection);
    });
    addPermissionBtn.addEventListener('click', addPermissionRow);

    // ========================================================================
    // Load existing access requests
    // ========================================================================

    /**
     * Load existing access requests for the current user
     */
    async function loadExistingRequests() {
        try {
            const response = await fetch(config.apiUrl + '/auth/access-requests', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(function() { return {}; });
                const errorMsg = errorData.detail || errorData.error || errorData.message || errorData.title || 'HTTP ' + response.status;
                throw new Error(errorMsg);
            }

            const data = await response.json();
            displayExistingRequests(data.requests || []);
        } catch (error) {
            console.error('Error loading access requests:', error);
            const errorMessage = error.message || config.i18n.unknownError;
            existingRequestsBody.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(config.i18n.failedToLoad)}
                    <br><small class="text-muted">${escapeHtml(errorMessage)}</small>
                </div>
            `;
        }
    }

    /**
     * Display existing access requests
     * @param {Array} requests - Array of access request objects
     */
    function displayExistingRequests(requests) {
        if (requests.length === 0) {
            existingRequestsBody.innerHTML = `
                <p class="text-muted mb-0">
                    <i class="fas fa-inbox me-2"></i>
                    ${escapeHtml(config.i18n.noRequests)}
                </p>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
        html += `
            <thead>
                <tr>
                    <th>${escapeHtml(config.i18n.role)}</th>
                    <th>${escapeHtml(config.i18n.permissions)}</th>
                    <th>${escapeHtml(config.i18n.status)}</th>
                    <th>${escapeHtml(config.i18n.reviewNotes)}</th>
                    <th>${escapeHtml(config.i18n.submitted)}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const request of requests) {
            const status = statusInfo[request.status] || statusInfo['pending'];
            const roleName = roleNames[request.requested_role] || request.requested_role;
            const reviewNotes = request.review_notes
                ? (request.review_notes.length > 60
                    ? request.review_notes.substring(0, 60) + '...'
                    : request.review_notes)
                : '-';

            let actionHtml = '';
            if (request.status === 'rejected') {
                actionHtml = `
                    <button class="btn btn-outline-warning btn-sm resubmit-btn"
                            data-request-id="${escapeHtml(String(request.id))}"
                            title="${escapeHtml(config.i18n.resubmit || 'Resubmit')}">
                        <i class="fas fa-redo me-1"></i>${escapeHtml(config.i18n.resubmit || 'Resubmit')}
                    </button>
                `;
            }

            html += `
                <tr>
                    <td><span class="badge bg-info">${escapeHtml(roleName)}</span></td>
                    <td>${summarizePermissions(request.permissions)}</td>
                    <td>
                        <span class="badge ${status.class}">
                            <i class="${status.icon} me-1"></i>${escapeHtml(status.text)}
                        </span>
                    </td>
                    <td><small class="text-muted fst-italic">${escapeHtml(reviewNotes)}</small></td>
                    <td><small>${formatDate(request.created_at)}</small></td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        existingRequestsBody.innerHTML = html;

        // Bind resubmit buttons
        existingRequestsBody.querySelectorAll('.resubmit-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                openResubmitForm(this.dataset.requestId, requests);
            });
        });
    }

    // Track resubmit state
    let resubmitRequestId = null;

    /**
     * Populate the permission rows from a stored permissions array
     * (used during resubmit pre-fill). Truncates to MAX_PERMISSIONS
     * with a single warning if the stored array exceeds the cap.
     * @param {Array|undefined} stored - Stored permissions from the request
     */
    function populateRowsFromStoredPermissions(stored) {
        if (!Array.isArray(stored)) return;
        if (stored.length > MAX_PERMISSIONS) {
            const tmpl = config.i18n.permissionsTruncated
                || 'This request had more than %1$d permissions; only the first %2$d are shown.';
            showAlert('warning',
                tmpl
                    .replace(/%1\$d/g, String(stored.length))
                    .replace(/%2\$d/g, String(MAX_PERMISSIONS))
            );
        }
        for (const perm of stored.slice(0, MAX_PERMISSIONS)) {
            addPermissionRow();
            const row = permissionRows.lastElementChild;
            if (!row) continue;
            const typeSelect = row.querySelector('.perm-object-type');
            const idInput = row.querySelector('.perm-object-id');
            const relSelect = row.querySelector('.perm-relation');
            if (typeSelect) typeSelect.value = perm.object_type || '';
            if (idInput) idInput.value = perm.object_id || '';
            if (relSelect) relSelect.value = perm.relation || '';
        }
    }

    /**
     * Open the form pre-filled with a rejected request's data for resubmission.
     * @param {string} requestId - The request ID to resubmit
     * @param {Array} requests - All requests (to find the one to resubmit)
     */
    function openResubmitForm(requestId, requests) {
        const request = requests.find(function(r) { return String(r.id) === String(requestId); });
        if (!request) return;

        // Set the role (disable it — role can't change on resubmit)
        setRequestedRole(request.requested_role);
        setRoleSelectionDisabled(true);

        // Reset and populate permissions
        updatePermissionsSection();
        permissionRows.innerHTML = '';
        permissionRowCounter = 0;
        populateRowsFromStoredPermissions(request.permissions);

        // Pre-fill justification
        const justificationEl = document.getElementById('justification');
        if (justificationEl && request.justification) {
            justificationEl.value = request.justification;
        }

        // Show rejection reason as alert
        if (request.review_notes) {
            showAlert('warning', (config.i18n.rejectionReason || 'Rejection reason') + ': ' + request.review_notes);
        }

        // Set resubmit mode
        resubmitRequestId = requestId;
        submitBtn.innerHTML = '<i class="fas fa-redo me-2"></i>' + escapeHtml(config.i18n.resubmit || 'Resubmit');

        // Scroll to form
        document.getElementById('accessRequestForm').scrollIntoView({ behavior: 'smooth' });
    }

    // ========================================================================
    // Form submission
    // ========================================================================

    /**
     * Build the request body for an access-request submission.
     * @returns {Object} POST body
     */
    function buildRequestBody(requestedRole, permissions) {
        const justification = document.getElementById('justification').value.trim();
        const credentials = document.getElementById('credentials').value.trim();
        const body = {
            requested_role: requestedRole,
            permissions: permissions,
            email: config.userEmail || null,
            name: config.userName || null
        };
        if (justification) body.justification = justification;
        if (credentials) body.credentials = credentials;
        return body;
    }

    /**
     * POST the access request, handling new vs resubmit endpoints and
     * non-OK responses uniformly. Throws Error on failure with a
     * user-readable message; returns parsed JSON on success.
     */
    async function submitAccessRequest(body) {
        const endpoint = resubmitRequestId
            ? config.apiUrl + '/auth/access-requests/' + encodeURIComponent(resubmitRequestId) + '/resubmit'
            : config.apiUrl + '/auth/access-requests';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let errorMsg = config.i18n.failedToSubmit;
            try {
                const errData = await response.json();
                errorMsg = errData.message || errData.error || errData.detail || errorMsg;
            } catch { /* non-JSON error response */ }
            throw new Error(errorMsg);
        }
        return response.json();
    }

    /**
     * Reset the form and resubmit state after a successful submission.
     */
    function resetFormAfterSuccess() {
        resubmitRequestId = null;
        setRoleSelectionDisabled(false);
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>' + escapeHtml(config.i18n.submitRequest);
        accessRequestForm.reset();
        permissionRows.innerHTML = '';
        permissionRowCounter = 0;
        // Reset hides the form body + permissions section since no radio is checked.
        updatePermissionsSection();
    }

    accessRequestForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        formAlerts.innerHTML = '';

        const requestedRole = getRequestedRole();
        if (!requestedRole) {
            showAlert('danger', config.i18n.roleRequired);
            return;
        }

        const permissions = collectPermissions();
        if (permissions === null) {
            showAlert('danger', config.i18n.permissionIncomplete);
            return;
        }

        const body = buildRequestBody(requestedRole, permissions);

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>' + escapeHtml(config.i18n.submitting);

        try {
            const data = await submitAccessRequest(body);
            showAlert('success', data.message || config.i18n.submitSuccess);
            resetFormAfterSuccess();
            await loadExistingRequests();
        } catch (error) {
            console.error('Error submitting access request:', error);
            showAlert('danger', error.message || config.i18n.failedToSubmit);
        } finally {
            submitBtn.disabled = false;
            // Preserve resubmit-mode label if a resubmit failed; only restore the
            // default Submit label after a successful submission (which has already
            // cleared resubmitRequestId) or for a fresh submission.
            if (resubmitRequestId) {
                submitBtn.innerHTML = '<i class="fas fa-redo me-2"></i>' + escapeHtml(config.i18n.resubmit || 'Resubmit');
            } else {
                submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>' + escapeHtml(config.i18n.submitRequest);
            }
        }
    });

    // Load existing requests on page load
    await loadExistingRequests();
});
