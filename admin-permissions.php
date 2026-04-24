<?php

/**
 * Admin Permissions Management Page
 *
 * Allows administrators to view and manage OpenFGA permission tuples.
 * Administrators can grant new permissions and revoke existing ones.
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
        $permissionsTitle = _('Permissions Management');
        $calendarTitle    = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($permissionsTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-shield-alt me-2"></i><?php echo htmlspecialchars(_('Permissions Management'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4"><?php
        $managePermsDesc = _('Manage fine-grained permissions for calendar resources. Grant or revoke user access to specific calendars and test definitions.');
        echo htmlspecialchars($managePermsDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></p>

    <!-- Filter Controls -->
    <div class="card shadow mb-4">
        <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-filter me-2"></i><?php echo htmlspecialchars(_('Filters'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </h6>
        </div>
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-3">
                    <?php $userFilterLabel = _('User'); ?>
                    <label for="filterUser" class="form-label"><?php echo htmlspecialchars($userFilterLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <input type="text" class="form-control form-control-sm" id="filterUser"
                        placeholder="<?php echo htmlspecialchars(_('Filter by user ID...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                </div>
                <div class="col-md-3">
                    <?php $objectTypeLabel = _('Object Type'); ?>
                    <label for="filterObjectType" class="form-label"><?php echo htmlspecialchars($objectTypeLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <select class="form-select form-select-sm" id="filterObjectType">
                        <option value=""><?php echo htmlspecialchars(_('All'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="national_calendar"><?php echo htmlspecialchars(_('National Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="diocesan_calendar"><?php echo htmlspecialchars(_('Diocesan Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="wider_region"><?php echo htmlspecialchars(_('Wider Region'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="test_definition"><?php echo htmlspecialchars(_('Test Definition'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                    </select>
                </div>
                <div class="col-md-3">
                    <?php $objectIdLabel = _('Object ID'); ?>
                    <label for="filterObjectId" class="form-label"><?php echo htmlspecialchars($objectIdLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <input type="text" class="form-control form-control-sm" id="filterObjectId"
                        placeholder="<?php echo htmlspecialchars(_('Filter by object ID...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                </div>
                <div class="col-md-3">
                    <?php $relationLabel = _('Relation'); ?>
                    <label for="filterRelation" class="form-label"><?php echo htmlspecialchars($relationLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <select class="form-select form-select-sm" id="filterRelation">
                        <option value=""><?php echo htmlspecialchars(_('All'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="viewer"><?php echo htmlspecialchars(_('Viewer'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="editor"><?php echo htmlspecialchars(_('Editor'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="deleter"><?php echo htmlspecialchars(_('Deleter'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                    </select>
                </div>
            </div>
            <div class="mt-3">
                <button class="btn btn-primary btn-sm" id="applyFiltersBtn">
                    <i class="fas fa-search me-1"></i><?php echo htmlspecialchars(_('Apply Filters'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </button>
                <button class="btn btn-outline-secondary btn-sm" id="clearFiltersBtn">
                    <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Clear Filters'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </button>
            </div>
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="mb-3 d-flex gap-2">
        <button class="btn btn-success btn-sm" id="grantPermissionBtn" data-requires-auth>
            <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Grant Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
        <button class="btn btn-outline-primary btn-sm" id="refreshBtn">
            <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
    </div>

    <!-- Permissions Table -->
    <div class="card shadow mb-4">
        <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-list me-2"></i><?php echo htmlspecialchars(_('Permission Tuples'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                <span class="badge bg-primary ms-2" id="permissionsCount">0</span>
            </h6>
        </div>
        <div class="card-body" id="permissionsTableBody">
            <div class="text-center text-muted">
                <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </div>
        </div>
    </div>

    <div class="d-flex gap-2">
        <a href="admin-dashboard.php" class="btn btn-outline-secondary">
            <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <!-- Grant Permission Modal -->
    <div class="modal fade" id="grantModal" tabindex="-1" aria-labelledby="grantModalLabel">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="grantModalLabel">
                        <i class="fas fa-plus-circle me-2"></i><?php echo htmlspecialchars(_('Grant Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="grantUser" class="form-label"><?php echo htmlspecialchars(_('User ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <input type="text" class="form-control" id="grantUser" required
                            placeholder="<?php echo htmlspecialchars(_('Enter user ID...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    </div>
                    <div class="mb-3">
                        <label for="grantObjectType" class="form-label"><?php echo htmlspecialchars(_('Object Type'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <select class="form-select" id="grantObjectType" required>
                            <option value=""><?php echo htmlspecialchars(_('Select object type...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="national_calendar"><?php echo htmlspecialchars(_('National Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="diocesan_calendar"><?php echo htmlspecialchars(_('Diocesan Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="wider_region"><?php echo htmlspecialchars(_('Wider Region'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="test_definition"><?php echo htmlspecialchars(_('Test Definition'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="grantObjectId" class="form-label"><?php echo htmlspecialchars(_('Object ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <input type="text" class="form-control" id="grantObjectId" required
                            placeholder="<?php echo htmlspecialchars(_('Enter object ID...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    </div>
                    <div class="mb-3">
                        <label for="grantRelation" class="form-label"><?php echo htmlspecialchars(_('Relation'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <select class="form-select" id="grantRelation" required>
                            <option value=""><?php echo htmlspecialchars(_('Select relation...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="viewer"><?php echo htmlspecialchars(_('Viewer'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="editor"><?php echo htmlspecialchars(_('Editor'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="deleter"><?php echo htmlspecialchars(_('Deleter'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        </select>
                    </div>
                    <div id="grantModalAlerts"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-success" id="confirmGrantBtn" data-requires-auth>
                        <i class="fas fa-plus-circle me-1"></i><?php echo htmlspecialchars(_('Grant Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Revoke Confirmation Modal -->
    <div class="modal fade" id="revokeModal" tabindex="-1" aria-labelledby="revokeModalLabel">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="revokeModalLabel">
                        <i class="fas fa-user-minus me-2"></i><?php echo htmlspecialchars(_('Revoke Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <p id="revokeConfirmText"></p>
                    <div id="revokeModalAlerts"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmRevokeBtn" data-requires-auth>
                        <i class="fas fa-user-minus me-1"></i><?php echo htmlspecialchars(_('Revoke Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config for JavaScript -->
    <script>
        window.AdminPermissionsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            i18n: {
                loading: <?php echo json_encode(_('Loading...')); ?>,
                noPermissions: <?php echo json_encode(_('No permissions found.')); ?>,
                failedToLoad: <?php echo json_encode(_('Failed to load permissions. Please try again later.')); ?>,
                grantSuccess: <?php echo json_encode(_('Permission granted successfully.')); ?>,
                revokeSuccess: <?php echo json_encode(_('Permission revoked successfully.')); ?>,
                failedToGrant: <?php echo json_encode(_('Failed to grant permission. Please try again.')); ?>,
                failedToRevoke: <?php echo json_encode(_('Failed to revoke permission. Please try again.')); ?>,
                granting: <?php echo json_encode(_('Granting...')); ?>,
                revoking: <?php echo json_encode(_('Revoking...')); ?>,
                confirmRevoke: <?php echo json_encode(_('Are you sure you want to revoke this permission?')); ?>,
                // Table headers
                user: <?php echo json_encode(_('User')); ?>,
                objectType: <?php echo json_encode(_('Object Type')); ?>,
                objectId: <?php echo json_encode(_('Object ID')); ?>,
                relation: <?php echo json_encode(_('Relation')); ?>,
                actions: <?php echo json_encode(_('Actions')); ?>,
                revoke: <?php echo json_encode(_('Revoke')); ?>,
                // Object type display names
                nationalCalendar: <?php echo json_encode(_('National Calendar')); ?>,
                diocesanCalendar: <?php echo json_encode(_('Diocesan Calendar')); ?>,
                widerRegion: <?php echo json_encode(_('Wider Region')); ?>,
                testDefinition: <?php echo json_encode(_('Test Definition')); ?>,
                // Relation display names
                viewer: <?php echo json_encode(_('Viewer')); ?>,
                editor: <?php echo json_encode(_('Editor')); ?>,
                deleter: <?php echo json_encode(_('Deleter')); ?>,
                // Validation
                allFieldsRequired: <?php echo json_encode(_('All fields are required.')); ?>
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
