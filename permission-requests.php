<?php

/**
 * Permission Requests Page
 *
 * Allows any authenticated user to request resource-level permissions
 * (OpenFGA tuples) for calendar resources, and view their request status.
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
        $permReqTitle  = _('Permission Requests');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($permReqTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-key me-2"></i><?php echo htmlspecialchars(_('Permission Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4"><?php
        // phpcs:ignore Generic.Files.LineLength
        $pageDesc = _('Request access to specific calendar resources. You can request viewer, editor, or other permissions for national calendars, diocesan calendars, wider regions, and test definitions.');
        echo htmlspecialchars($pageDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></p>

    <div class="row">
        <div class="col-lg-8 col-xl-6">
            <!-- Existing Permission Requests -->
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-history me-2"></i><?php echo htmlspecialchars(_('Your Permission Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body" id="existingRequestsBody">
                    <div class="text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2"></i><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
            </div>

            <!-- New Permission Request Form -->
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 fw-bold text-primary">
                        <i class="fas fa-plus-circle me-2"></i><?php echo htmlspecialchars(_('Request a Permission'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h6>
                </div>
                <div class="card-body">
                    <form id="permissionRequestForm">
                        <div class="mb-3">
                            <label for="objectType" class="form-label fw-bold"><?php echo htmlspecialchars(_('Object Type'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <select class="form-select" id="objectType" name="object_type" required>
                                <option value=""><?php echo htmlspecialchars(_('Select object type...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="national_calendar"><?php echo htmlspecialchars(_('National Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="diocesan_calendar"><?php echo htmlspecialchars(_('Diocesan Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="wider_region"><?php echo htmlspecialchars(_('Wider Region'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="test_definition"><?php echo htmlspecialchars(_('Test Definition'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <?php $objectIdPlaceholder = _('e.g. IT, USA, BOSTON, Americas...'); ?>
                            <label for="objectId" class="form-label fw-bold"><?php echo htmlspecialchars(_('Object ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <input type="text" class="form-control" id="objectId" name="object_id" required
                                placeholder="<?php echo htmlspecialchars($objectIdPlaceholder, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                            <div class="form-text"><?php
                                $objectIdHelp = _('The identifier of the specific resource (e.g. country code, diocese name, wider region name).');
                                echo htmlspecialchars($objectIdHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            ?></div>
                        </div>

                        <div class="mb-3">
                            <label for="relation" class="form-label fw-bold"><?php echo htmlspecialchars(_('Relation'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <select class="form-select" id="relation" name="relation" required>
                                <option value=""><?php echo htmlspecialchars(_('Select relation...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="viewer"><?php echo htmlspecialchars(_('Viewer'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="editor"><?php echo htmlspecialchars(_('Editor'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="admin"><?php echo htmlspecialchars(_('Admin'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="deleter"><?php echo htmlspecialchars(_('Deleter'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            </select>
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
                            <textarea class="form-control" id="justification" name="justification" rows="3"
                                placeholder="<?php echo htmlspecialchars(_('Please describe why you need this permission...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></textarea>
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
                            <textarea class="form-control" id="credentials" name="credentials" rows="2"
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
    <script>
        window.PermissionRequestsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            i18n: {
                loading: <?php echo json_encode(_('Loading...')); ?>,
                noRequests: <?php echo json_encode(_('You have not made any permission requests yet.')); ?>,
                failedToLoad: <?php echo json_encode(_('Could not load your existing requests.')); ?>,
                submitSuccess: <?php echo json_encode(_('Your permission request has been submitted successfully.')); ?>,
                failedToSubmit: <?php echo json_encode(_('Failed to submit request. Please try again.')); ?>,
                submitting: <?php echo json_encode(_('Submitting...')); ?>,
                submitRequest: <?php echo json_encode(_('Submit Request')); ?>,
                selectRole: <?php echo json_encode(_('Please select a role.')); ?>,
                allFieldsRequired: <?php echo json_encode(_('Object type, object ID, and relation are required.')); ?>,
                requested: <?php echo json_encode(_('Requested')); ?>,
                adminNotes: <?php echo json_encode(_('Admin notes')); ?>,
                unknownError: <?php echo json_encode(_('Unknown error')); ?>,
                // Table headers
                objectType: <?php echo json_encode(_('Object Type')); ?>,
                objectId: <?php echo json_encode(_('Object ID')); ?>,
                relation: <?php echo json_encode(_('Relation')); ?>,
                status: <?php echo json_encode(_('Status')); ?>,
                justification: <?php echo json_encode(_('Justification')); ?>,
                reviewNotes: <?php echo json_encode(_('Review Notes')); ?>,
                submitted: <?php echo json_encode(_('Submitted')); ?>,
                reviewed: <?php echo json_encode(_('Reviewed')); ?>,
                // Object type display names
                nationalCalendar: <?php echo json_encode(_('National Calendar')); ?>,
                diocesanCalendar: <?php echo json_encode(_('Diocesan Calendar')); ?>,
                widerRegion: <?php echo json_encode(_('Wider Region')); ?>,
                testDefinition: <?php echo json_encode(_('Test Definition')); ?>,
                // Relation display names
                viewer: <?php echo json_encode(_('Viewer')); ?>,
                editor: <?php echo json_encode(_('Editor')); ?>,
                admin: <?php echo json_encode(_('Admin')); ?>,
                deleter: <?php echo json_encode(_('Deleter')); ?>,
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
