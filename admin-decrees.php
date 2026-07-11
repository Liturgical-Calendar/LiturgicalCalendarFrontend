<?php

/**
 * Admin Decrees Management Page
 *
 * Allows calendar_editor / admin users to create, edit, and delete
 * Dicastery for Divine Worship decree definitions via the /decrees API.
 * Per-row edit/delete are gated against the caller's FGA relations;
 * the API is the hard backstop.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// This page is accessible to global admins and calendar editors.
// NOTE: the FGA viewer-or-above check happens client-side on load (Task 3);
// users with the role but no relation get an empty-state message, and the
// dashboard card (which performs the same check) will not have shown a link.
$isAdmin          = $authHelper->hasRole('admin');
$isCalendarEditor = $authHelper->hasRole('calendar_editor');

if (!$isAdmin && !$isCalendarEditor) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $decreesTitle  = _('Decrees');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($decreesTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-scroll me-2 text-warning"></i><?php echo htmlspecialchars(_('Decrees'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4"><?php
        echo htmlspecialchars(
            _('Create, edit and delete decrees of the Dicastery for Divine Worship.'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
    ?></p>

    <!-- Action button -->
    <div class="mb-4">
        <button type="button" class="btn btn-primary d-none" id="btnCreateDecree" data-requires-auth>
            <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('New Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
    </div>

    <!-- Decrees container -->
    <div id="decreesContainer" class="row g-3"></div>

    <!-- Editor modal (form filled in by Task 4) -->
    <div class="modal fade" id="decreeEditorModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="decreeEditorModalLabel">
                        <?php echo htmlspecialchars(_('Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <!-- Task 4 will populate the form here -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="saveDecreeBtn" data-requires-auth>
                        <?php echo htmlspecialchars(_('Save'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete confirmation modal -->
    <div class="modal fade" id="decreeDeleteModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <?php echo htmlspecialchars(_('Delete Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="decreeDeleteAlerts"></div>
                    <p id="decreeDeleteConfirmText"></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteDecreeBtn" data-requires-auth>
                        <?php echo htmlspecialchars(_('Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config for JavaScript -->
    <script>
        window.AdminDecreesConfig = {
            apiUrl:        <?php echo json_encode($apiBaseUrl); ?>,
            <?php // BCP-47 (en-US), not gettext/ICU (en_US): Intl.DateTimeFormat rejects underscore tags. ?>
            locale:        <?php echo json_encode(str_replace('_', '-', $i18n->LOCALE)); ?>,
            isGlobalAdmin: <?php echo json_encode($isAdmin); ?>,
            i18n: {
                loading:       <?php echo json_encode(_('Loading…')); ?>,
                noAccess:      <?php echo json_encode(_('You do not have permission to view decrees administration.')); ?>,
                loadFailed:    <?php echo json_encode(_('Could not load decrees from the API.')); ?>,
                confirmDelete: <?php echo json_encode(_('Are you sure you want to delete this decree? This action cannot be undone.')); ?>,
                created:       <?php echo json_encode(_('Decree created.')); ?>,
                updated:       <?php echo json_encode(_('Decree updated.')); ?>,
                deleted:       <?php echo json_encode(_('Decree deleted.')); ?>,
                managePerms:   <?php echo json_encode(_('Manage permissions')); ?>,
                translations:  <?php echo json_encode(_('Translations')); ?>,
                readings:      <?php echo json_encode(_('Lectionary readings')); ?>
            }
        };
    </script>
    <script type="module" src="assets/js/admin-decrees.js"></script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
