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

// Global admins manage everything; resource-admins may review the access
// requests scoped to the resources they administer. The API enforces the
// actual scoping — this gate only decides who the UI lets in.
$isGlobalAdmin   = $authHelper->hasRole('admin');
$isResourceAdmin = $authHelper->isResourceAdmin();

// Redirect users who are neither to the dashboard.
if (!$isGlobalAdmin && !$isResourceAdmin) {
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

    <?php if ($isGlobalAdmin) : ?>
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
                        <option value="general_roman_calendar"><?php echo htmlspecialchars(_('General Roman Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="general_roman_calendar_test"><?php echo htmlspecialchars(_('General Roman Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="national_calendar"><?php echo htmlspecialchars(_('National Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="diocesan_calendar"><?php echo htmlspecialchars(_('Diocesan Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="wider_region"><?php echo htmlspecialchars(_('Wider Region'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="national_calendar_test"><?php echo htmlspecialchars(_('National Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="diocesan_calendar_test"><?php echo htmlspecialchars(_('Diocesan Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
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
                        <option value="admin"><?php echo htmlspecialchars(pgettext('permission relation', 'Admin'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
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
    <?php endif; ?>

    <!-- Access Requests Review Section -->
    <div class="card shadow mb-4">
        <div class="card-header py-3 d-flex justify-content-between align-items-center">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-inbox me-2"></i><?php echo htmlspecialchars(_('Access Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                <span class="badge bg-warning text-dark ms-2" id="permRequestsCount">0</span>
            </h6>
            <div>
                <button class="btn btn-outline-primary btn-sm" id="refreshPermRequestsBtn">
                    <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </button>
            </div>
        </div>

        <!-- Filter Tabs for Access Requests -->
        <div class="card-body pb-0">
            <ul class="nav nav-tabs" id="permRequestStatusTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="permReq-pending-tab" data-bs-toggle="tab" data-bs-target="#permReq-pending-panel"
                            type="button" role="tab" aria-controls="permReq-pending-panel" aria-selected="true">
                        <i class="fas fa-clock me-1"></i><?php echo htmlspecialchars(_('Pending'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        <span class="badge bg-warning text-dark ms-1" id="permReqPendingBadge">0</span>
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="permReq-approved-tab" data-bs-toggle="tab" data-bs-target="#permReq-approved-panel"
                            type="button" role="tab" aria-controls="permReq-approved-panel" aria-selected="false">
                        <i class="fas fa-check-circle me-1"></i><?php echo htmlspecialchars(_('Approved'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        <span class="badge bg-success ms-1" id="permReqApprovedBadge">0</span>
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="permReq-rejected-tab" data-bs-toggle="tab" data-bs-target="#permReq-rejected-panel"
                            type="button" role="tab" aria-controls="permReq-rejected-panel" aria-selected="false">
                        <i class="fas fa-times-circle me-1"></i><?php echo htmlspecialchars(_('Rejected'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        <span class="badge bg-danger ms-1" id="permReqRejectedBadge">0</span>
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="permReq-revoked-tab" data-bs-toggle="tab" data-bs-target="#permReq-revoked-panel"
                            type="button" role="tab" aria-controls="permReq-revoked-panel" aria-selected="false">
                        <i class="fas fa-ban me-1"></i><?php echo htmlspecialchars(_('Revoked'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        <span class="badge bg-secondary ms-1" id="permReqRevokedBadge">0</span>
                    </button>
                </li>
            </ul>
        </div>

        <!-- Tab Content for Access Requests -->
        <div class="tab-content" id="permRequestTabContent">
            <div class="tab-pane fade show active" id="permReq-pending-panel" role="tabpanel" aria-labelledby="permReq-pending-tab">
                <div class="card-body" id="permReqPendingBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
            <div class="tab-pane fade" id="permReq-approved-panel" role="tabpanel" aria-labelledby="permReq-approved-tab">
                <div class="card-body" id="permReqApprovedBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
            <div class="tab-pane fade" id="permReq-rejected-panel" role="tabpanel" aria-labelledby="permReq-rejected-tab">
                <div class="card-body" id="permReqRejectedBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
            <div class="tab-pane fade" id="permReq-revoked-panel" role="tabpanel" aria-labelledby="permReq-revoked-tab">
                <div class="card-body" id="permReqRevokedBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Access Request Review Modal -->
    <div class="modal fade" id="permReqReviewModal" tabindex="-1" aria-labelledby="permReqReviewModalLabel">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="permReqReviewModalLabel">
                        <i class="fas fa-key me-2"></i><?php echo htmlspecialchars(_('Review Access Request'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="permReqDetails">
                        <!-- Filled by JavaScript -->
                    </div>
                    <hr>
                    <div class="mb-3" id="permReqNotesSection">
                        <label for="permReqReviewNotes" class="form-label"><?php
                            $notesLabel    = _('Notes');
                            $optionalLabel = _('optional');
                            echo htmlspecialchars($notesLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?> <span class="text-muted">(<?php
                            echo htmlspecialchars($optionalLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        ?>)</span></label>
                        <?php $reviewPlaceholder = _('Add notes about your decision...'); ?>
                        <textarea class="form-control" id="permReqReviewNotes" rows="3"
                            placeholder="<?php echo htmlspecialchars($reviewPlaceholder, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></textarea>
                    </div>
                    <div id="permReqModalAlerts"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-success d-none" id="permReqApproveBtn" data-requires-auth>
                        <i class="fas fa-check-circle me-1"></i><?php echo htmlspecialchars(_('Approve'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger d-none" id="permReqRejectBtn" data-requires-auth>
                        <i class="fas fa-times-circle me-1"></i><?php echo htmlspecialchars(_('Reject'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-warning d-none" id="permReqRevokeBtn" data-requires-auth>
                        <i class="fas fa-ban me-1"></i><?php echo htmlspecialchars(_('Revoke'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i><?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="d-flex gap-2">
        <a href="admin-dashboard.php" class="btn btn-outline-secondary">
            <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <?php if ($isGlobalAdmin) : ?>
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
                        <label for="grantRelation" class="form-label"><?php echo htmlspecialchars(_('Relation'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <select class="form-select" id="grantRelation" required>
                            <option value=""><?php echo htmlspecialchars(_('Select relation...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="viewer"><?php echo htmlspecialchars(_('Viewer'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="editor"><?php echo htmlspecialchars(_('Editor'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="admin"><?php echo htmlspecialchars(pgettext('permission relation', 'Admin'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="grantObjectType" class="form-label"><?php echo htmlspecialchars(_('Calendar scope'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <select class="form-select" id="grantObjectType" required>
                            <option value=""><?php echo htmlspecialchars(_('Select calendar scope...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="general_roman_calendar"><?php echo htmlspecialchars(_('General Roman Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="general_roman_calendar_test"><?php echo htmlspecialchars(_('General Roman Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="national_calendar"><?php echo htmlspecialchars(_('National Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="diocesan_calendar"><?php echo htmlspecialchars(_('Diocesan Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="wider_region"><?php echo htmlspecialchars(_('Wider Region'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="national_calendar_test"><?php echo htmlspecialchars(_('National Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            <option value="diocesan_calendar_test"><?php echo htmlspecialchars(_('Diocesan Calendar Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="grantObjectId" class="form-label"><?php echo htmlspecialchars(_('Calendar ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <div id="grantObjectIdMount">
                            <select class="form-select" id="grantObjectId" required>
                                <option value="" disabled selected><?php echo htmlspecialchars(_('Select calendar ID...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            </select>
                        </div>
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
    <?php endif; ?>

    <!-- Config for JavaScript -->
    <script>
        window.AdminPermissionsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            isGlobalAdmin: <?php echo json_encode($isGlobalAdmin); ?>,
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
                subject: <?php
                    /* translators: permissions table column heading for the principal a permission is
                       granted TO — an OpenFGA tuple subject, i.e. a user. Not the thing the permission
                       applies to: that is the adjacent "Object Type" / "Object ID". Several locales have
                       rendered this as "topic" or "email subject line", which collides with those columns. */
                    echo json_encode(_('Subject'));
                ?>,
                unknownUser: <?php echo json_encode(_('Unknown user')); ?>,
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
                generalRomanCalendar: <?php echo json_encode(_('General Roman Calendar')); ?>,
                grcTemporale: <?php echo json_encode(_('Temporale')); ?>,
                grcSanctorale1970: <?php echo json_encode(_('Sanctorale — Editio Typica 1970')); ?>,
                grcSanctorale2002: <?php echo json_encode(_('Sanctorale — Editio Typica 2002')); ?>,
                grcSanctorale2008: <?php echo json_encode(_('Sanctorale — Editio Typica 2008')); ?>,
                grcDecrees: <?php echo json_encode(_('Decrees of the Dicastery for Divine Worship')); ?>,
                enterObjectId: <?php echo json_encode(_('Enter object ID...')); ?>,
                selectObjectId: <?php echo json_encode(_('Select object ID...')); ?>,
                calendarScope: <?php echo json_encode(_('Calendar scope')); ?>,
                calendarId: <?php echo json_encode(_('Calendar ID')); ?>,
                selectCalendarId: <?php echo json_encode(_('Select calendar ID...')); ?>,
                /** translators: shown in place of the calendar dropdown when the calendar list could not be loaded */
                calendarIdLoadFailed: <?php echo json_encode(_('Could not load calendars — try reloading the page')); ?>,
                testsNational: <?php echo json_encode(_('National Calendar Tests')); ?>,
                testsDiocesan: <?php echo json_encode(_('Diocesan Calendar Tests')); ?>,
                testsGeneralRoman: <?php echo json_encode(_('General Roman Calendar Tests')); ?>,
                // Relation display names
                viewer: <?php echo json_encode(_('Viewer')); ?>,
                editor: <?php echo json_encode(_('Editor')); ?>,
                admin: <?php echo json_encode(pgettext('permission relation', 'Admin')); ?>,
                // Validation
                allFieldsRequired: <?php echo json_encode(_('All fields are required.')); ?>,
                // Access requests review section
                accessReq: {
                    loading: <?php echo json_encode(_('Loading...')); ?>,
                    noRequests: <?php echo json_encode(_('No requests found.')); ?>,
                    noPendingRequests: <?php echo json_encode(_('No pending access requests. All caught up!')); ?>,
                    failedToLoad: <?php echo json_encode(_('Failed to load access requests. Please try again later.')); ?>,
                    processing: <?php echo json_encode(_('Processing...')); ?>,
                    approveSuccess: <?php echo json_encode(_('Access request approved successfully.')); ?>,
                    rejectSuccess: <?php echo json_encode(_('Access request rejected.')); ?>,
                    revokeSuccess: <?php echo json_encode(_('Access revoked successfully.')); ?>,
                    failedToProcess: <?php echo json_encode(_('Failed to process request. Please try again.')); ?>,
                    // Labels
                    user: <?php echo json_encode(_('User')); ?>,
                    role: <?php echo json_encode(_('Role')); ?>,
                    permissions: <?php echo json_encode(_('Permissions')); ?>,
                    objectType: <?php echo json_encode(_('Object Type')); ?>,
                    objectId: <?php echo json_encode(_('Object ID')); ?>,
                    calendarScope: <?php echo json_encode(_('Calendar scope')); ?>,
                    calendarId: <?php echo json_encode(_('Calendar ID')); ?>,
                    selectCalendarId: <?php echo json_encode(_('Select calendar ID...')); ?>,
                /** translators: shown in place of the calendar dropdown when the calendar list could not be loaded */
                calendarIdLoadFailed: <?php echo json_encode(_('Could not load calendars — try reloading the page')); ?>,
                    testsNational: <?php echo json_encode(_('National Calendar Tests')); ?>,
                    testsDiocesan: <?php echo json_encode(_('Diocesan Calendar Tests')); ?>,
                    testsGeneralRoman: <?php echo json_encode(_('General Roman Calendar Tests')); ?>,
                    relation: <?php echo json_encode(_('Relation')); ?>,
                    justification: <?php echo json_encode(_('Justification')); ?>,
                    credentials: <?php echo json_encode(_('Credentials')); ?>,
                    date: <?php echo json_encode(_('Date')); ?>,
                    actions: <?php echo json_encode(_('Actions')); ?>,
                    review: <?php echo json_encode(_('Review')); ?>,
                    reviewedAt: <?php echo json_encode(_('Reviewed At')); ?>,
                    reviewNotes: <?php echo json_encode(_('Review Notes')); ?>,
                    status: <?php echo json_encode(_('Status')); ?>,
                    requested: <?php echo json_encode(_('Requested')); ?>,
                    // Role display names
                    calendarEditor: <?php echo json_encode(_('Calendar Editor')); ?>,
                    testEditor: <?php echo json_encode(_('Accuracy Test Editor')); ?>,
                    developer: <?php echo json_encode(_('Developer')); ?>,
                    // Status labels
                    statusPending: <?php echo json_encode(_('Pending')); ?>,
                    statusApproved: <?php echo json_encode(_('Approved')); ?>,
                    statusRejected: <?php echo json_encode(_('Rejected')); ?>,
                    statusRevoked: <?php echo json_encode(_('Revoked')); ?>
                }
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
