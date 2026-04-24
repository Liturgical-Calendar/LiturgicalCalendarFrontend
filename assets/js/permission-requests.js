/**
 * Permission Requests Page JavaScript
 *
 * Handles the user-facing interface for requesting resource-level permissions
 * and viewing existing permission request status.
 */

document.addEventListener('DOMContentLoaded', async function() {
    const config = window.PermissionRequestsConfig;
    if (!config) {
        console.error('PermissionRequestsConfig not found');
        return;
    }

    const existingRequestsBody = document.getElementById('existingRequestsBody');
    const permissionRequestForm = document.getElementById('permissionRequestForm');
    const formAlerts = document.getElementById('formAlerts');
    const submitBtn = document.getElementById('submitBtn');

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
     * Load existing permission requests for the current user
     */
    async function loadExistingRequests() {
        try {
            const response = await fetch(config.apiUrl + '/auth/permission-requests', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.detail || errorData.error || errorData.message || errorData.title || `HTTP ${response.status}`;
                throw new Error(errorMsg);
            }

            const data = await response.json();
            displayExistingRequests(data.requests || []);
        } catch (error) {
            console.error('Error loading permission requests:', error);
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
     * Display existing permission requests
     * @param {Array} requests - Array of permission request objects
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
                    <th>${config.i18n.objectType}</th>
                    <th>${config.i18n.objectId}</th>
                    <th>${config.i18n.relation}</th>
                    <th>${config.i18n.status}</th>
                    <th>${config.i18n.justification}</th>
                    <th>${config.i18n.reviewNotes}</th>
                    <th>${config.i18n.submitted}</th>
                    <th>${config.i18n.reviewed}</th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const request of requests) {
            const status = statusInfo[request.status] || statusInfo['pending'];
            const objectTypeName = objectTypeNames[request.object_type] || request.object_type;
            const relationName = relationNames[request.relation] || request.relation;
            const badgeClass = relationBadgeClasses[request.relation] || 'bg-secondary';
            const justification = request.justification
                ? (request.justification.length > 60
                    ? request.justification.substring(0, 60) + '...'
                    : request.justification)
                : '-';

            html += `
                <tr>
                    <td>${escapeHtml(objectTypeName)}</td>
                    <td><code>${escapeHtml(request.object_id || '-')}</code></td>
                    <td><span class="badge ${badgeClass}">${escapeHtml(relationName)}</span></td>
                    <td>
                        <span class="badge ${status.class}">
                            <i class="${status.icon} me-1"></i>${escapeHtml(status.text)}
                        </span>
                    </td>
                    <td><small class="text-muted fst-italic">${escapeHtml(justification)}</small></td>
                    <td><small class="text-muted">${escapeHtml(request.review_notes || '-')}</small></td>
                    <td><small>${formatDate(request.created_at)}</small></td>
                    <td><small>${formatDate(request.reviewed_at)}</small></td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        existingRequestsBody.innerHTML = html;
    }

    /**
     * Handle form submission
     */
    permissionRequestForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        formAlerts.innerHTML = '';

        const objectType = document.getElementById('objectType').value;
        const objectId = document.getElementById('objectId').value.trim();
        const relation = document.getElementById('relation').value;
        const justification = document.getElementById('justification').value.trim();
        const credentials = document.getElementById('credentials').value.trim();

        if (!objectType || !objectId || !relation) {
            showAlert('danger', config.i18n.allFieldsRequired);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>' + escapeHtml(config.i18n.submitting);

        try {
            const body = {
                object_type: objectType,
                object_id: objectId,
                relation: relation
            };

            if (justification) {
                body.justification = justification;
            }
            if (credentials) {
                body.credentials = credentials;
            }

            const response = await fetch(config.apiUrl + '/auth/permission-requests', {
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

            const data = await response.json();
            showAlert('success', data.message || config.i18n.submitSuccess);

            // Reset form and reload requests
            permissionRequestForm.reset();
            await loadExistingRequests();
        } catch (error) {
            console.error('Error submitting permission request:', error);
            showAlert('danger', error.message || config.i18n.failedToSubmit);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>' + escapeHtml(config.i18n.submitRequest);
        }
    });

    // Load existing requests on page load
    await loadExistingRequests();
});
