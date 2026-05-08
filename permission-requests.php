<?php

/**
 * Access Requests Page
 *
 * Allows any authenticated user to request access (role + fine-grained
 * permissions) via the unified /auth/access-requests endpoint, and view
 * their request status.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Require verified email - redirect to profile if email not verified
if (!$authHelper->emailVerified) {
    header('Location: user-profile.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $accessReqTitle = _('Access Requests');
        $calendarTitle  = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($accessReqTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-key me-2"></i><?php echo htmlspecialchars(_('Access Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4"><?php
        // phpcs:ignore Generic.Files.LineLength
        $pageDesc = _('Request access to the Liturgical Calendar system. Select a role and specify the resource permissions you need. Your request will be reviewed by an administrator.');
        echo htmlspecialchars($pageDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></p>

    <div class="row">
        <div class="col-lg-8 col-xl-6">
            <!-- Existing Access Requests -->
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-history me-2"></i><?php echo htmlspecialchars(_('Your Access Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body" id="existingRequestsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>

            <!-- New Access Request Form -->
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-plus-circle me-2"></i><?php echo htmlspecialchars(_('Request Access'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <form id="accessRequestForm">
                        <div class="mb-3">
                            <label for="requestedRole" class="form-label fw-bold"><?php echo htmlspecialchars(_('Role'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <select class="form-select" id="requestedRole" name="requested_role" required>
                                <option value=""><?php echo htmlspecialchars(_('Select a role...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="calendar_editor"><?php echo htmlspecialchars(_('Calendar Editor'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="test_editor"><?php echo htmlspecialchars(_('Accuracy Test Editor'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="developer"><?php echo htmlspecialchars(_('Developer'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            </select>
                            <div class="form-text"><?php
                                $roleHelp = _('Select the role that best describes how you plan to use the system.');
                                echo htmlspecialchars($roleHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            ?></div>
                        </div>

                        <!-- Permissions section -->
                        <div class="mb-3" id="permissionsSection" style="display: none;">
                            <label class="form-label fw-bold"><?php echo htmlspecialchars(_('Permissions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <div class="form-text mb-2"><?php
                                // phpcs:ignore Generic.Files.LineLength
                                $permHelp = _('Specify the resources you need access to. Add one or more permission rows.');
                                echo htmlspecialchars($permHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            ?></div>

                            <div id="permissionRows">
                                <!-- Permission rows are added dynamically by JavaScript -->
                            </div>

                            <button type="button" class="btn btn-outline-secondary btn-sm mt-2" id="addPermissionBtn">
                                <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Add Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </button>
                        </div>

                        <div class="mb-3">
                            <?php
                            $justificationLabel = _('Justification');
                            $optionalLabel      = _('optional');
                            $justificationHelp  = _('Providing a justification helps administrators review your request faster.');
                            ?>
                            <label for="justification" class="form-label fw-bold">
                                <?php echo htmlspecialchars($justificationLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                <span class="text-muted fw-normal">(<?php echo htmlspecialchars($optionalLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>)</span>
                            </label>
                            <textarea class="form-control" id="justification" name="justification" rows="3" maxlength="2000"
                                placeholder="<?php echo htmlspecialchars(_('Please describe why you need this access...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></textarea>
                            <div class="form-text"><?php echo htmlspecialchars($justificationHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>

                        <div class="mb-4">
                            <?php
                            $credentialsLabel = _('Credentials');
                            $credentialsHelp  = _('Optionally provide any credentials or references that support your request.');
                            ?>
                            <label for="credentials" class="form-label fw-bold">
                                <?php echo htmlspecialchars($credentialsLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                <span class="text-muted fw-normal">(<?php echo htmlspecialchars($optionalLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>)</span>
                            </label>
                            <textarea class="form-control" id="credentials" name="credentials" rows="2" maxlength="2000"
                                placeholder="<?php echo htmlspecialchars(_('Any relevant credentials or references...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></textarea>
                            <div class="form-text"><?php echo htmlspecialchars($credentialsHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>

                        <div id="formAlerts"></div>

                        <button type="submit" class="btn btn-primary" id="submitBtn" data-requires-auth>
                            <i class="fas fa-paper-plane me-2"></i><?php echo htmlspecialchars(_('Submit Request'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        </button>
                    </form>
                </div>
            </div>

            <div class="d-flex gap-2">
                <a href="user-profile.php" class="btn btn-outline-secondary">
                    <i class="fas fa-arrow-left me-2"></i><?php echo htmlspecialchars(_('Back to Profile'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
            </div>
        </div>
    </div>

    <!-- Config for JavaScript -->
    <?php $jsonFlags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT; ?>
    <script>
        window.AccessRequestsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl, $jsonFlags); ?>,
            userEmail: <?php echo json_encode($authHelper->email ?? '', $jsonFlags); ?>,
            userName: <?php echo json_encode($authHelper->name ?? $authHelper->username ?? '', $jsonFlags); ?>,
            i18n: {
                loading: <?php echo json_encode(_('Loading...'), $jsonFlags); ?>,
                noRequests: <?php echo json_encode(_('You have not made any access requests yet.'), $jsonFlags); ?>,
                failedToLoad: <?php echo json_encode(_('Could not load your existing requests.'), $jsonFlags); ?>,
                submitSuccess: <?php echo json_encode(_('Your access request has been submitted successfully.'), $jsonFlags); ?>,
                failedToSubmit: <?php echo json_encode(_('Failed to submit request. Please try again.'), $jsonFlags); ?>,
                submitting: <?php echo json_encode(_('Submitting...'), $jsonFlags); ?>,
                submitRequest: <?php echo json_encode(_('Submit Request'), $jsonFlags); ?>,
                resubmit: <?php echo json_encode(_('Resubmit'), $jsonFlags); ?>,
                rejectionReason: <?php echo json_encode(_('Rejection reason'), $jsonFlags); ?>,
                roleRequired: <?php echo json_encode(_('Please select a role.'), $jsonFlags); ?>,
                permissionIncomplete: <?php echo json_encode(_('Each permission row must have object type, object ID, and relation filled in.'), $jsonFlags); ?>,
                maxPermissionsReached: <?php echo json_encode(_('You have reached the maximum of %1$d permissions per request.'), $jsonFlags); ?>,
                permissionsTruncated: <?php echo json_encode(_('This request had more than %1$d permissions; only the first %2$d are shown.'), $jsonFlags); ?>,
                unknownError: <?php echo json_encode(_('Unknown error'), $jsonFlags); ?>,
                // Table headers
                role: <?php echo json_encode(_('Role'), $jsonFlags); ?>,
                permissions: <?php echo json_encode(_('Permissions'), $jsonFlags); ?>,
                status: <?php echo json_encode(_('Status'), $jsonFlags); ?>,
                justification: <?php echo json_encode(_('Justification'), $jsonFlags); ?>,
                reviewNotes: <?php echo json_encode(_('Review Notes'), $jsonFlags); ?>,
                submitted: <?php echo json_encode(_('Submitted'), $jsonFlags); ?>,
                reviewed: <?php echo json_encode(_('Reviewed'), $jsonFlags); ?>,
                // Permission form labels
                objectType: <?php echo json_encode(_('Object Type'), $jsonFlags); ?>,
                objectId: <?php echo json_encode(_('Object ID'), $jsonFlags); ?>,
                relation: <?php echo json_encode(_('Relation'), $jsonFlags); ?>,
                selectObjectType: <?php echo json_encode(_('Select object type...'), $jsonFlags); ?>,
                selectRelation: <?php echo json_encode(_('Select relation...'), $jsonFlags); ?>,
                remove: <?php echo json_encode(_('Remove'), $jsonFlags); ?>,
                // Object type display names
                nationalCalendar: <?php echo json_encode(_('National Calendar'), $jsonFlags); ?>,
                diocesanCalendar: <?php echo json_encode(_('Diocesan Calendar'), $jsonFlags); ?>,
                widerRegion: <?php echo json_encode(_('Wider Region'), $jsonFlags); ?>,
                testDefinition: <?php echo json_encode(_('Test Definition'), $jsonFlags); ?>,
                // Role display names
                calendarEditor: <?php echo json_encode(_('Calendar Editor'), $jsonFlags); ?>,
                testEditor: <?php echo json_encode(_('Accuracy Test Editor'), $jsonFlags); ?>,
                developer: <?php echo json_encode(_('Developer'), $jsonFlags); ?>,
                // Relation display names
                viewer: <?php echo json_encode(_('Viewer'), $jsonFlags); ?>,
                editor: <?php echo json_encode(_('Editor'), $jsonFlags); ?>,
                admin: <?php echo json_encode(_('Admin'), $jsonFlags); ?>,
                deleter: <?php echo json_encode(_('Deleter'), $jsonFlags); ?>,
                // Status labels
                statusPending: <?php echo json_encode(_('Pending'), $jsonFlags); ?>,
                statusApproved: <?php echo json_encode(_('Approved'), $jsonFlags); ?>,
                statusRejected: <?php echo json_encode(_('Rejected'), $jsonFlags); ?>,
                statusRevoked: <?php echo json_encode(_('Revoked'), $jsonFlags); ?>,
                // Object ID placeholders
                objectIdPlaceholder: <?php echo json_encode(_('e.g. IT, USA, BOSTON, Americas...'), $jsonFlags); ?>
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
