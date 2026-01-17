<?php

/**
 * Admin Application Management Page
 *
 * Allows administrators to view and manage developer application requests.
 * Administrators can approve, reject, or revoke applications from this page.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Check if user has admin role
$isAdmin = $authHelper->hasRole('admin');

// Redirect non-admins to dashboard
if (!$isAdmin) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $applicationsTitle = _('Application Management');
        $calendarTitle     = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($applicationsTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-cubes me-2"></i><?php echo htmlspecialchars(_('Application Management'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <!-- Stats Cards -->
    <div class="row mb-4">
        <div class="col-md-3 mb-3 mb-md-0">
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
        <div class="col-md-3 mb-3 mb-md-0">
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
        <div class="col-md-3 mb-3 mb-md-0">
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
        <div class="col-md-3">
            <div class="card border-secondary h-100">
                <div class="card-body text-center">
                    <i class="fas fa-ban fa-2x text-secondary mb-2"></i>
                    <h4 class="mb-0" id="revokedCount">
                        <span class="spinner-border spinner-border-sm" role="status"></span>
                    </h4>
                    <small class="text-muted"><?php echo htmlspecialchars(_('Revoked'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small>
                </div>
            </div>
        </div>
    </div>

    <!-- Filter Tabs -->
    <ul class="nav nav-tabs mb-3" id="statusTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="pending-tab" data-bs-toggle="tab" data-bs-target="#pending-panel"
                    type="button" role="tab" aria-controls="pending-panel" aria-selected="true">
                <i class="fas fa-clock me-1"></i><?php echo htmlspecialchars(_('Pending'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                <span class="badge bg-warning text-dark ms-1" id="pendingBadge">0</span>
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="approved-tab" data-bs-toggle="tab" data-bs-target="#approved-panel"
                    type="button" role="tab" aria-controls="approved-panel" aria-selected="false">
                <i class="fas fa-check-circle me-1"></i><?php echo htmlspecialchars(_('Approved'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="rejected-tab" data-bs-toggle="tab" data-bs-target="#rejected-panel"
                    type="button" role="tab" aria-controls="rejected-panel" aria-selected="false">
                <i class="fas fa-times-circle me-1"></i><?php echo htmlspecialchars(_('Rejected'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="revoked-tab" data-bs-toggle="tab" data-bs-target="#revoked-panel"
                    type="button" role="tab" aria-controls="revoked-panel" aria-selected="false">
                <i class="fas fa-ban me-1"></i><?php echo htmlspecialchars(_('Revoked'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </li>
        <li class="nav-item ms-auto">
            <button class="btn btn-outline-primary btn-sm" id="refreshBtn" data-requires-auth>
                <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content" id="statusTabContent">
        <div class="tab-pane fade show active" id="pending-panel" role="tabpanel" aria-labelledby="pending-tab">
            <div class="card shadow">
                <div class="card-body" id="pendingApplicationsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-pane fade" id="approved-panel" role="tabpanel" aria-labelledby="approved-tab">
            <div class="card shadow">
                <div class="card-body" id="approvedApplicationsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-pane fade" id="rejected-panel" role="tabpanel" aria-labelledby="rejected-tab">
            <div class="card shadow">
                <div class="card-body" id="rejectedApplicationsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-pane fade" id="revoked-panel" role="tabpanel" aria-labelledby="revoked-tab">
            <div class="card shadow">
                <div class="card-body" id="revokedApplicationsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="d-flex gap-2 mt-4">
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
                        <i class="fas fa-cube me-2"></i><?php echo htmlspecialchars(_('Review Application'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="applicationDetails">
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
                <div class="modal-footer" id="modalFooter">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger d-none" id="rejectBtn" data-requires-auth>
                        <i class="fas fa-times-circle me-1"></i><?php echo htmlspecialchars(_('Reject'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-warning d-none" id="revokeBtn" data-requires-auth>
                        <i class="fas fa-ban me-1"></i><?php echo htmlspecialchars(_('Revoke'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-success d-none" id="approveBtn" data-requires-auth>
                        <i class="fas fa-check-circle me-1"></i><?php echo htmlspecialchars(_('Approve'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config must be defined BEFORE footer.php which auto-loads admin-applications.js -->
    <script>
        window.AdminApplicationsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            i18n: {
                loading: <?php echo json_encode(_('Loading...')); ?>,
                noApplications: <?php echo json_encode(_('No applications found.')); ?>,
                noPendingApplications: <?php echo json_encode(_('No pending applications. All caught up!')); ?>,
                failedToLoad: <?php echo json_encode(_('Failed to load applications. Please try again later.')); ?>,
                processing: <?php echo json_encode(_('Processing...')); ?>,
                approveSuccess: <?php echo json_encode(_('Application approved successfully.')); ?>,
                rejectSuccess: <?php echo json_encode(_('Application rejected.')); ?>,
                revokeSuccess: <?php echo json_encode(_('Application revoked.')); ?>,
                failedToProcess: <?php echo json_encode(_('Failed to process request. Please try again.')); ?>,
                // Labels
                user: <?php echo json_encode(_('User')); ?>,
                application: <?php echo json_encode(_('Application')); ?>,
                description: <?php echo json_encode(_('Description')); ?>,
                website: <?php echo json_encode(_('Website')); ?>,
                created: <?php echo json_encode(_('Created')); ?>,
                status: <?php echo json_encode(_('Status')); ?>,
                actions: <?php echo json_encode(_('Actions')); ?>,
                review: <?php echo json_encode(_('Review')); ?>,
                reviewedBy: <?php echo json_encode(_('Reviewed By')); ?>,
                reviewedAt: <?php echo json_encode(_('Reviewed At')); ?>,
                reviewNotes: <?php echo json_encode(_('Review Notes')); ?>,
                // Status labels
                statusPending: <?php echo json_encode(_('Pending')); ?>,
                statusApproved: <?php echo json_encode(_('Approved')); ?>,
                statusRejected: <?php echo json_encode(_('Rejected')); ?>,
                statusRevoked: <?php echo json_encode(_('Revoked')); ?>
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
