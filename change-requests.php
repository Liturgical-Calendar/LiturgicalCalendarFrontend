<?php

/**
 * Your Change Requests (submitter view)
 *
 * Every authenticated user who has ever proposed a source-data change can see
 * their own batches here, read what each one proposes, and withdraw one that is
 * still awaiting review.
 *
 * Scoping is entirely server-side: `GET /auth/change-requests` accepts no
 * submitter parameter and never will, since accepting one would let a caller list
 * someone else's batches.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
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
        $changesTitle  = _('Your Change Requests');
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
        <i class="fas fa-user-edit me-2"></i><?php
            echo htmlspecialchars(_('Your Change Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        ?>
    </h1>

    <p class="text-muted mb-4"><?php
        // phpcs:ignore Generic.Files.LineLength
        $pageDesc = _('Calendar edits you are not yourself an administrator of are recorded as change requests and reviewed before they are published. This is every change request you have submitted, and what became of it.');
        echo htmlspecialchars($pageDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></p>

    <div id="changeRequestAlerts"></div>

    <div class="card shadow mb-4">
        <div class="card-header py-3 d-flex align-items-center">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-history me-2"></i><?php
                    echo htmlspecialchars(_('Your Change Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                ?>
            </h6>
            <button class="btn btn-outline-primary btn-sm ms-auto" id="refreshBtn" data-requires-auth>
                <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
        <div class="card-body" id="changeRequestsBody">
            <div class="text-center text-muted">
                <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </div>
        </div>
    </div>

    <div class="d-flex gap-2 mt-4">
        <a href="admin-dashboard.php" class="btn btn-outline-secondary" data-requires-auth>
            <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <!-- Detail Modal -->
    <div class="modal fade" id="changeRequestDetailModal" tabindex="-1" aria-labelledby="changeRequestDetailModalLabel">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="changeRequestDetailModalLabel">
                        <i class="fas fa-file-code me-2"></i><?php
                            echo htmlspecialchars(_('Proposed changes'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body" id="changeRequestDetailBody">
                    <!-- Filled by JavaScript -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config must be defined BEFORE footer.php, which auto-loads change-requests.js -->
    <?php
    /** @var array<string, mixed> $changeRequestI18n */
    $changeRequestI18n  = include './includes/change-request-i18n.php';
    $changeRequestsI18n = array_merge($changeRequestI18n, [
        'noChangeRequests' => _('You have not submitted any change requests yet.'),
        'failedToLoad'     => _('Failed to load your change requests. Please try again later.'),
        'processing'       => _('Processing...'),
        'withdraw'         => _('Withdraw'),
        'confirmWithdraw'  => _('Withdraw this change request? The files it proposes will no longer be reviewed.'),
        'withdrawSuccess'  => _('Change request withdrawn.'),
        'withdrawFailed'   => _('Failed to withdraw this change request. Please try again.'),
        // The endpoint answers 404 both for "not yours" and for "already decided",
        // so this is the only honest thing to say about either.
        'withdrawGone'     => _('This change request can no longer be withdrawn — it may already have been reviewed.'),
    ]);
    ?>
    <script>
        window.ChangeRequestsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            locale: <?php echo json_encode(str_replace('_', '-', $i18n->LOCALE)); ?>,
            repoUrl: <?php echo json_encode($sourceDataRepoUrl); ?>,
            i18n: <?php echo json_encode($changeRequestsI18n); ?>
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
