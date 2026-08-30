<?php

/**
 * Change Request Review Page
 *
 * The reviewer's queue for source-data change requests (API #902).
 *
 * Open to global admins and to resource admins alike: the API scopes
 * `/admin/change-requests` to the resources the caller administers, and
 * re-checks authorization on the specific batch id for every approve and
 * reject, so there is nothing for this page to filter.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

$isAdmin         = $authHelper->hasRole('admin');
$isResourceAdmin = $authHelper->dashboardScopes()['is_resource_admin'];

// Anyone who administers nothing has nothing to review here.
if (!$isAdmin && !$isResourceAdmin) {
    header('Location: admin-dashboard.php');
    exit;
}

// The GitHub repository the phase 2 publisher opens pull requests against, so a
// settled batch's `pr_number` can be linked. Empty (the number is then shown bare)
// unless the deployment names a well-formed "owner/repo".
$sourceDataRepo    = trim((string) ( $_ENV['SOURCEDATA_REPOSITORY'] ?? '' ));
$sourceDataRepoUrl = preg_match('#^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$#', $sourceDataRepo) === 1
    ? 'https://github.com/' . $sourceDataRepo
    : '';

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $changesTitle  = _('Change Request Review');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($changesTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-code-pull-request me-2"></i><?php
            echo htmlspecialchars(_('Change Request Review'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        ?>
    </h1>

    <p class="text-muted mb-4"><?php
        // phpcs:ignore Generic.Files.LineLength
        $pageDesc = _('Review the source data changes proposed for the calendars you administer. Approving a change request is the only human gate before it is published, so read what it proposes before deciding.');
        echo htmlspecialchars($pageDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></p>

    <!-- Stats Cards -->
    <div class="row mb-4">
        <div class="col-md-3 mb-3 mb-md-0">
            <div class="card border-warning h-100">
                <div class="card-body text-center">
                    <i class="fas fa-hourglass-half fa-2x text-warning mb-2"></i>
                    <h4 class="mb-0" id="submittedCount">
                        <span class="spinner-border spinner-border-sm" role="status"></span>
                    </h4>
                    <small class="text-muted"><?php echo htmlspecialchars(_('Submitted'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small>
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
                    <i class="fas fa-undo fa-2x text-secondary mb-2"></i>
                    <h4 class="mb-0" id="withdrawnCount">
                        <span class="spinner-border spinner-border-sm" role="status"></span>
                    </h4>
                    <small class="text-muted"><?php echo htmlspecialchars(_('Withdrawn'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small>
                </div>
            </div>
        </div>
    </div>

    <!-- Filter Tabs -->
    <ul class="nav nav-tabs mb-3" id="statusTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="submitted-tab" data-bs-toggle="tab" data-bs-target="#submitted-panel"
                    type="button" role="tab" aria-controls="submitted-panel" aria-selected="true">
                <i class="fas fa-hourglass-half me-1"></i><?php echo htmlspecialchars(_('Submitted'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
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
            <button class="nav-link" id="withdrawn-tab" data-bs-toggle="tab" data-bs-target="#withdrawn-panel"
                    type="button" role="tab" aria-controls="withdrawn-panel" aria-selected="false">
                <i class="fas fa-undo me-1"></i><?php echo htmlspecialchars(_('Withdrawn'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
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
        <div class="tab-pane fade show active" id="submitted-panel" role="tabpanel" aria-labelledby="submitted-tab">
            <div class="card shadow">
                <div class="card-body" id="submittedChangesBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-pane fade" id="approved-panel" role="tabpanel" aria-labelledby="approved-tab">
            <div class="card shadow">
                <div class="card-body" id="approvedChangesBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-pane fade" id="rejected-panel" role="tabpanel" aria-labelledby="rejected-tab">
            <div class="card shadow">
                <div class="card-body" id="rejectedChangesBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-pane fade" id="withdrawn-panel" role="tabpanel" aria-labelledby="withdrawn-tab">
            <div class="card shadow">
                <div class="card-body" id="withdrawnChangesBody">
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
        <a href="change-requests.php" class="btn btn-outline-primary" data-requires-auth>
            <i class="fas fa-user-edit me-2"></i><?php echo htmlspecialchars(_('Your Change Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <!-- Review Modal -->
    <div class="modal fade" id="reviewModal" tabindex="-1" aria-labelledby="reviewModalLabel">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="reviewModalLabel">
                        <i class="fas fa-code-pull-request me-2"></i><?php
                            echo htmlspecialchars(_('Review Change Request'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="changeRequestDetails">
                        <!-- Filled by JavaScript -->
                    </div>
                    <hr>
                    <div class="mb-3" id="notesSection">
                        <label for="reviewNotes" class="form-label"><?php
                            $reasonLabel   = _('Reason for rejection');
                            $optionalLabel = _('optional');
                            echo htmlspecialchars($reasonLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?> <span class="text-muted">(<?php
                            echo htmlspecialchars($optionalLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>)</span></label>
                        <?php $placeholder = _('The submitter will be shown this reason.'); ?>
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
                    <button type="button" class="btn btn-success d-none" id="approveBtn" data-requires-auth>
                        <i class="fas fa-check-circle me-1"></i><?php echo htmlspecialchars(_('Approve'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config must be defined BEFORE footer.php, which auto-loads admin-changes.js -->
    <?php
    /** @var array<string, mixed> $changeRequestI18n */
    $changeRequestI18n = include './includes/change-request-i18n.php';
    $adminChangesI18n  = array_merge($changeRequestI18n, [
        'submittedBy'      => _('Submitted by'),
        'outcome'          => _('Outcome'),
        'review'           => _('Review'),
        'reviewDecision'   => _('Reviewer decision'),
        'rejectedReason'   => _('Reason'),
        'noPendingChanges' => _('No change requests are waiting for review. All caught up!'),
        'noChangeRequests' => _('No change requests found.'),
        'failedToLoad'     => _('Failed to load change requests. Please try again later.'),
        'processing'       => _('Processing...'),
        'approveSuccess'   => _('Change request approved.'),
        'rejectSuccess'    => _('Change request rejected.'),
        'failedToProcess'  => _('Failed to process this change request. Please try again.'),
        'alreadyDecided'   => _('This change request was already decided by someone else. Reloading the list.'),
    ]);
    ?>
    <script>
        window.AdminChangesConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            locale: <?php echo json_encode(str_replace('_', '-', $i18n->LOCALE)); ?>,
            repoUrl: <?php echo json_encode($sourceDataRepoUrl); ?>,
            i18n: <?php echo json_encode($adminChangesI18n); ?>
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
