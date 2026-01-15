<?php

/**
 * Admin Role Requests Management Page
 *
 * Allows administrators to view and manage pending role requests.
 * Administrators can approve or reject role requests from this page.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Check if user has admin role
$isAdmin = $authHelper->roles !== null && in_array('admin', $authHelper->roles, true);

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $roleRequestsTitle = _('Role Requests');
        $calendarTitle     = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($roleRequestsTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-user-check me-2"></i><?php echo htmlspecialchars(_('Role Requests Management'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <?php if (!$isAdmin) : ?>
    <div class="alert alert-danger" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <?php echo htmlspecialchars(_('You do not have permission to access this page. Administrator role required.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </div>
    <?php else : ?>
    <!-- Stats Cards -->
    <div class="row mb-4">
        <div class="col-md-4 mb-3 mb-md-0">
            <div class="card border-warning h-100">
                <div class="card-body text-center">
                    <i class="fas fa-clock fa-2x text-warning mb-2"></i>
                    <h4 class="mb-0" id="pendingCount">
                        <span class="spinner-border spinner-border-sm" role="status"></span>
                    </h4>
                    <small class="text-muted"><?php echo htmlspecialchars(_('Pending'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-3 mb-md-0">
            <div class="card border-success h-100">
                <div class="card-body text-center">
                    <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                    <h4 class="mb-0" id="approvedCount">
                        <span class="spinner-border spinner-border-sm" role="status"></span>
                    </h4>
                    <small class="text-muted"><?php echo htmlspecialchars(_('Approved'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-danger h-100">
                <div class="card-body text-center">
                    <i class="fas fa-times-circle fa-2x text-danger mb-2"></i>
                    <h4 class="mb-0" id="rejectedCount">
                        <span class="spinner-border spinner-border-sm" role="status"></span>
                    </h4>
                    <small class="text-muted"><?php echo htmlspecialchars(_('Rejected'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small>
                </div>
            </div>
        </div>
    </div>

    <!-- Pending Requests -->
    <div class="card shadow mb-4">
        <div class="card-header py-3 d-flex justify-content-between align-items-center">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-list me-2"></i><?php echo htmlspecialchars(_('Pending Role Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </h6>
            <button class="btn btn-outline-primary btn-sm" id="refreshBtn">
                <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
        <div class="card-body" id="pendingRequestsBody">
            <div class="text-center text-muted">
                <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </div>
        </div>
    </div>

    <div class="d-flex gap-2">
        <a href="admin-dashboard.php" class="btn btn-outline-secondary" data-requires-auth>
            <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <!-- Review Modal -->
    <div class="modal fade" id="reviewModal" tabindex="-1" aria-labelledby="reviewModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="reviewModalLabel">
                        <i class="fas fa-user-check me-2"></i><?php echo htmlspecialchars(_('Review Role Request'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="requestDetails">
                        <!-- Filled by JavaScript -->
                    </div>
                    <hr>
                    <div class="mb-3">
                        <label for="reviewNotes" class="form-label"><?php
                            $notesLabel    = _('Notes');
                            $optionalLabel = _('optional');
                            echo htmlspecialchars($notesLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?> <span class="text-muted">(<?php
                            echo htmlspecialchars($optionalLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>)</span></label>
                        <?php $placeholder = _('Add notes about your decision...'); ?>
                        <textarea class="form-control" id="reviewNotes" rows="3"
                            placeholder="<?php echo htmlspecialchars($placeholder, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></textarea>
                    </div>
                    <div id="modalAlerts"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger" id="rejectBtn">
                        <i class="fas fa-times-circle me-1"></i><?php echo htmlspecialchars(_('Reject'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-success" id="approveBtn">
                        <i class="fas fa-check-circle me-1"></i><?php echo htmlspecialchars(_('Approve'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <?php endif; ?>

    <?php include_once('./layout/footer.php'); ?>

    <?php if ($isAdmin) : ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const ApiUrl = <?php echo json_encode($apiBaseUrl); ?>;
        const pendingRequestsBody = document.getElementById('pendingRequestsBody');
        const refreshBtn = document.getElementById('refreshBtn');
        const reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
        const requestDetails = document.getElementById('requestDetails');
        const reviewNotes = document.getElementById('reviewNotes');
        const modalAlerts = document.getElementById('modalAlerts');
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');

        let currentRequestId = null;

        // Role display names
        const roleNames = {
            'developer': <?php echo json_encode(_('Developer')); ?>,
            'calendar_editor': <?php echo json_encode(_('Calendar Editor')); ?>,
            'test_editor': <?php echo json_encode(_('Accuracy Test Editor')); ?>
        };

        /**
         * Load pending requests and counts
         */
        async function loadRequests() {
            pendingRequestsBody.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-spinner fa-spin me-2"></i>${<?php echo json_encode(_('Loading...')); ?>}
                </div>
            `;

            try {
                const response = await fetch(ApiUrl + '/admin/role-requests', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to load requests');
                }

                const data = await response.json();

                // Update counts
                document.getElementById('pendingCount').textContent = data.counts?.pending || 0;
                document.getElementById('approvedCount').textContent = data.counts?.approved || 0;
                document.getElementById('rejectedCount').textContent = data.counts?.rejected || 0;

                // Display pending requests
                displayPendingRequests(data.pending_requests || []);
            } catch (error) {
                console.error('Error loading requests:', error);
                pendingRequestsBody.innerHTML = `
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${<?php echo json_encode(_('Failed to load role requests. Please try again later.')); ?>}
                    </div>
                `;
            }
        }

        /**
         * Display pending requests
         */
        function displayPendingRequests(requests) {
            if (requests.length === 0) {
                pendingRequestsBody.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                        <p class="mb-0">${<?php echo json_encode(_('No pending role requests. All caught up!')); ?>}</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
            html += `
                <thead>
                    <tr>
                        <th>${<?php echo json_encode(_('User')); ?>}</th>
                        <th>${<?php echo json_encode(_('Role Requested')); ?>}</th>
                        <th>${<?php echo json_encode(_('Date')); ?>}</th>
                        <th>${<?php echo json_encode(_('Actions')); ?>}</th>
                    </tr>
                </thead>
                <tbody>
            `;

            for (const request of requests) {
                const roleName = roleNames[request.requested_role] || request.requested_role;
                const createdAt = new Date(request.created_at).toLocaleDateString();

                html += `
                    <tr>
                        <td>
                            <strong>${escapeHtml(request.user_name || request.user_email)}</strong>
                            <br><small class="text-muted">${escapeHtml(request.user_email)}</small>
                        </td>
                        <td>
                            <span class="badge bg-primary">${escapeHtml(roleName)}</span>
                        </td>
                        <td><small>${createdAt}</small></td>
                        <td>
                            <button class="btn btn-outline-primary btn-sm review-btn"
                                    data-request-id="${request.id}"
                                    data-user-name="${escapeHtml(request.user_name || request.user_email)}"
                                    data-user-email="${escapeHtml(request.user_email)}"
                                    data-role="${escapeHtml(request.requested_role)}"
                                    data-role-name="${escapeHtml(roleName)}"
                                    data-justification="${escapeHtml(request.justification || '')}"
                                    data-created="${createdAt}">
                                <i class="fas fa-eye me-1"></i>${<?php echo json_encode(_('Review')); ?>}
                            </button>
                        </td>
                    </tr>
                `;
            }

            html += '</tbody></table></div>';
            pendingRequestsBody.innerHTML = html;

            // Add event listeners to review buttons
            document.querySelectorAll('.review-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    openReviewModal(this.dataset);
                });
            });
        }

        /**
         * Open review modal with request details
         */
        function openReviewModal(data) {
            currentRequestId = data.requestId;
            reviewNotes.value = '';
            modalAlerts.innerHTML = '';

            // Escape all dataset-derived values to prevent XSS
            // (browser decodes HTML entities from data-* attributes, so we must re-escape)
            const userName = escapeHtml(data.userName || '');
            const userEmail = escapeHtml(data.userEmail || '');
            const roleName = escapeHtml(data.roleName || '');
            const created = escapeHtml(data.created || '');
            const justification = escapeHtml(data.justification || '');

            requestDetails.innerHTML = `
                <table class="table table-borderless mb-0">
                    <tr>
                        <th class="text-muted" style="width: 35%;">
                            <i class="fas fa-user me-2"></i>${<?php echo json_encode(_('User')); ?>}
                        </th>
                        <td>
                            <strong>${userName}</strong>
                            <br><small class="text-muted">${userEmail}</small>
                        </td>
                    </tr>
                    <tr>
                        <th class="text-muted">
                            <i class="fas fa-user-tag me-2"></i>${<?php echo json_encode(_('Requested Role')); ?>}
                        </th>
                        <td><span class="badge bg-primary">${roleName}</span></td>
                    </tr>
                    <tr>
                        <th class="text-muted">
                            <i class="fas fa-calendar me-2"></i>${<?php echo json_encode(_('Requested')); ?>}
                        </th>
                        <td>${created}</td>
                    </tr>
                    ${data.justification ? `
                    <tr>
                        <th class="text-muted">
                            <i class="fas fa-comment me-2"></i>${<?php echo json_encode(_('Justification')); ?>}
                        </th>
                        <td><em>"${justification}"</em></td>
                    </tr>
                    ` : ''}
                </table>
            `;

            reviewModal.show();
        }

        /**
         * Handle approve action
         */
        approveBtn.addEventListener('click', async function() {
            if (!currentRequestId) return;
            await processRequest('approve');
        });

        /**
         * Handle reject action
         */
        rejectBtn.addEventListener('click', async function() {
            if (!currentRequestId) return;
            await processRequest('reject');
        });

        /**
         * Process request (approve/reject)
         */
        async function processRequest(action) {
            const notes = reviewNotes.value.trim();

            approveBtn.disabled = true;
            rejectBtn.disabled = true;

            const btnToUpdate = action === 'approve' ? approveBtn : rejectBtn;
            const originalText = btnToUpdate.innerHTML;
            btnToUpdate.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>' + <?php echo json_encode(_('Processing...')); ?>;

            try {
                const response = await fetch(`${ApiUrl}/admin/role-requests/${currentRequestId}/${action}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        notes: notes || null
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Request failed');
                }

                // Show success message
                modalAlerts.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        ${escapeHtml(data.message || (action === 'approve' ? <?php echo json_encode(_('Request approved successfully.')); ?> : <?php echo json_encode(_('Request rejected.')); ?>))}
                    </div>
                `;

                // Reload after a short delay
                setTimeout(() => {
                    reviewModal.hide();
                    loadRequests();
                }, 1500);
            } catch (error) {
                console.error('Error processing request:', error);
                modalAlerts.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${escapeHtml(error.message || <?php echo json_encode(_('Failed to process request. Please try again.')); ?>)}
                    </div>
                `;
                approveBtn.disabled = false;
                rejectBtn.disabled = false;
                btnToUpdate.innerHTML = originalText;
            }
        }

        /**
         * Refresh button handler
         */
        refreshBtn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            icon.classList.add('fa-spin');
            loadRequests().finally(() => {
                icon.classList.remove('fa-spin');
            });
        });

        /**
         * Escape HTML entities
         */
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Load requests on page load
        loadRequests();
    });
    </script>
    <?php endif; ?>
</body>
</html>
