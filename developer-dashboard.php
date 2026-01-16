<?php

/**
 * Developer Dashboard
 *
 * Allows users with the "developer" role to:
 * - Register applications
 * - Generate and manage API keys
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Check if user has developer role
$isDeveloper = $authHelper->hasRole('developer');

// If not a developer, redirect to request-access page
if (!$isDeveloper) {
    header('Location: request-access.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $dashboardTitle = _('Developer Dashboard');
        $calendarTitle  = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($dashboardTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
    <link rel="stylesheet" href="assets/css/developer-dashboard.css">
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black developer-dashboard-heading" style="--bs-text-opacity: .6;">
        <i class="fas fa-code me-2"></i><?php echo htmlspecialchars(_('Developer Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4">
        <?php echo htmlspecialchars(_('Register applications and manage API keys for accessing the Liturgical Calendar API.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </p>

    <!-- Applications Section -->
    <div class="card shadow mb-4">
        <div class="card-header py-3 d-flex justify-content-between align-items-center">
            <h5 class="m-0 fw-bold text-primary">
                <i class="fas fa-cubes me-2"></i><?php echo htmlspecialchars(_('My Applications'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </h5>
            <button type="button" class="btn btn-primary btn-sm" id="btnNewApp">
                <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('New Application'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
        <div class="card-body">
            <div id="applicationsContainer">
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden"><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                    </div>
                    <p class="text-muted mt-2"><?php echo htmlspecialchars(_('Loading applications...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></p>
                </div>
            </div>
        </div>
    </div>

    <!-- New/Edit Application Modal -->
    <div class="modal fade" id="appModal" tabindex="-1" aria-labelledby="appModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="appModalLabel">
                        <i class="fas fa-cube me-2"></i><span id="appModalTitle"><?php echo htmlspecialchars(_('New Application'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <form id="appForm">
                        <input type="hidden" id="appUuid" value="">
                        <div class="mb-3">
                            <label for="appName" class="form-label"><?php echo htmlspecialchars(_('Application Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?> <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="appName" required maxlength="100">
                            <div class="form-text"><?php echo htmlspecialchars(_('A descriptive name for your application.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>
                        <div class="mb-3">
                            <label for="appDescription" class="form-label"><?php echo htmlspecialchars(_('Description'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <textarea class="form-control" id="appDescription" rows="3" maxlength="500"></textarea>
                            <div class="form-text"><?php echo htmlspecialchars(_('Optional description of what your application does.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>
                        <div class="mb-3">
                            <label for="appWebsite" class="form-label"><?php echo htmlspecialchars(_('Website URL'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <input type="url" class="form-control" id="appWebsite" placeholder="https://example.com">
                            <div class="form-text"><?php echo htmlspecialchars(_('Optional URL to your application or project.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></button>
                    <button type="button" class="btn btn-primary" id="btnSaveApp">
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                        <i class="fas fa-save me-1"></i><?php echo htmlspecialchars(_('Save'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Generate API Key Modal -->
    <div class="modal fade" id="keyModal" tabindex="-1" aria-labelledby="keyModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="keyModalLabel">
                        <i class="fas fa-key me-2"></i><?php echo htmlspecialchars(_('Generate API Key'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <form id="keyForm">
                        <input type="hidden" id="keyAppUuid" value="">
                        <div class="mb-3">
                            <label for="keyName" class="form-label"><?php echo htmlspecialchars(_('Key Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <input type="text" class="form-control" id="keyName" maxlength="100" placeholder="<?php echo htmlspecialchars(_('e.g., Production, Development'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                            <div class="form-text"><?php echo htmlspecialchars(_('Optional name to identify this key.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>
                        <div class="mb-3">
                            <label for="keyScope" class="form-label"><?php echo htmlspecialchars(_('Scope'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <select class="form-select" id="keyScope">
                                <option value="read"><?php echo htmlspecialchars(_('Read-only'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                <option value="write"><?php echo htmlspecialchars(_('Read and Write'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                            </select>
                            <div class="form-text"><?php echo htmlspecialchars(_('Read-only keys can only access public endpoints. Write keys can modify data.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>
                        <div class="mb-3">
                            <label for="keyExpires" class="form-label"><?php echo htmlspecialchars(_('Expiration Date'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                            <input type="date" class="form-control" id="keyExpires">
                            <div class="form-text"><?php echo htmlspecialchars(_('Optional. Leave empty for a key that never expires.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></button>
                    <button type="button" class="btn btn-primary" id="btnGenerateKey">
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                        <i class="fas fa-key me-1"></i><?php echo htmlspecialchars(_('Generate Key'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- API Key Display Modal -->
    <div class="modal fade" id="keyDisplayModal" tabindex="-1" aria-labelledby="keyDisplayModalLabel" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-success text-white">
                    <h5 class="modal-title" id="keyDisplayModalLabel">
                        <i class="fas fa-check-circle me-2"></i><?php echo htmlspecialchars(_('API Key Generated'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning mb-3">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong><?php echo htmlspecialchars(_('Important:'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></strong>
                        <?php echo htmlspecialchars(_('Copy this key now. For security reasons, it will not be shown again.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold"><?php echo htmlspecialchars(_('Your API Key:'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                        <div class="input-group">
                            <input type="text" class="form-control font-monospace" id="generatedKeyDisplay" readonly>
                            <button class="btn btn-outline-primary" type="button" id="btnCopyKey" title="<?php echo htmlspecialchars(_('Copy to clipboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div id="copySuccess" class="alert alert-success d-none">
                        <i class="fas fa-check me-2"></i><?php echo htmlspecialchars(_('API key copied to clipboard!'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                        <i class="fas fa-check me-1"></i><?php echo htmlspecialchars(_('Done'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteModal" tabindex="-1" aria-labelledby="deleteModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title" id="deleteModalLabel">
                        <i class="fas fa-exclamation-triangle me-2"></i><?php echo htmlspecialchars(_('Confirm Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <p id="deleteMessage"><?php echo htmlspecialchars(_('Are you sure you want to delete this item?'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></p>
                    <p class="text-danger mb-0"><small><?php echo htmlspecialchars(_('This action cannot be undone.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></small></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></button>
                    <button type="button" class="btn btn-danger" id="btnConfirmDelete">
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                        <i class="fas fa-trash-alt me-1"></i><?php echo htmlspecialchars(_('Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <script>
        // Configuration from PHP
        window.DeveloperDashboard = {
            apiBaseUrl: <?php echo json_encode($apiConfig->apiBaseUrl); ?>,
            i18n: {
                noApplications: <?php echo json_encode(_('You have not registered any applications yet.')); ?>,
                createFirst: <?php echo json_encode(_('Create your first application to get started.')); ?>,
                application: <?php echo json_encode(_('Application')); ?>,
                apiKeys: <?php echo json_encode(_('API Keys')); ?>,
                noKeys: <?php echo json_encode(_('No API keys generated yet.')); ?>,
                generateKey: <?php echo json_encode(_('Generate Key')); ?>,
                edit: <?php echo json_encode(_('Edit')); ?>,
                delete: <?php echo json_encode(_('Delete')); ?>,
                revoke: <?php echo json_encode(_('Revoke')); ?>,
                rotate: <?php echo json_encode(_('Rotate')); ?>,
                scope: <?php echo json_encode(_('Scope')); ?>,
                rateLimit: <?php echo json_encode(_('Rate Limit')); ?>,
                expires: <?php echo json_encode(_('Expires')); ?>,
                never: <?php echo json_encode(_('Never')); ?>,
                lastUsed: <?php echo json_encode(_('Last Used')); ?>,
                neverUsed: <?php echo json_encode(_('Never used')); ?>,
                created: <?php echo json_encode(_('Created')); ?>,
                keys: <?php echo json_encode(_('keys')); ?>,
                key: <?php echo json_encode(_('key')); ?>,
                deleteAppConfirm: <?php echo json_encode(_('Are you sure you want to delete the application "%s"? This will also revoke all associated API keys.')); ?>,
                revokeKeyConfirm: <?php echo json_encode(_('Are you sure you want to revoke this API key? Applications using this key will no longer be able to authenticate.')); ?>,
                errorLoading: <?php echo json_encode(_('Failed to load applications. Please try again.')); ?>,
                errorSaving: <?php echo json_encode(_('Failed to save application. Please try again.')); ?>,
                errorDeleting: <?php echo json_encode(_('Failed to delete. Please try again.')); ?>,
                errorGeneratingKey: <?php echo json_encode(_('Failed to generate API key. Please try again.')); ?>,
                // Success messages
                applicationUpdated: <?php echo json_encode(_('Application updated successfully.')); ?>,
                applicationCreated: <?php echo json_encode(_('Application created successfully.')); ?>,
                applicationDeleted: <?php echo json_encode(_('Application deleted successfully.')); ?>,
                keyRevoked: <?php echo json_encode(_('API key revoked successfully.')); ?>,
                keyRotated: <?php echo json_encode(_('API key rotated successfully.')); ?>,
                read: <?php echo json_encode(_('Read')); ?>,
                write: <?php echo json_encode(_('Write')); ?>,
                requestsPerHour: <?php echo json_encode(_('requests/hour')); ?>,
                newApplication: <?php echo json_encode(_('New Application')); ?>,
                editApplication: <?php echo json_encode(_('Edit Application')); ?>,
                website: <?php echo json_encode(_('Website')); ?>,
                viewKeys: <?php echo json_encode(_('View Keys')); ?>,
                hideKeys: <?php echo json_encode(_('Hide Keys')); ?>,
                // Application status
                statusPending: <?php echo json_encode(_('Pending')); ?>,
                statusApproved: <?php echo json_encode(_('Approved')); ?>,
                statusRejected: <?php echo json_encode(_('Rejected')); ?>,
                statusRevoked: <?php echo json_encode(_('Revoked')); ?>,
                awaitingApproval: <?php echo json_encode(_('Awaiting admin approval')); ?>,
                rejectionNotes: <?php echo json_encode(_('Rejection Notes')); ?>,
                resubmit: <?php echo json_encode(_('Resubmit for Review')); ?>,
                cannotGenerateKeys: <?php echo json_encode(_('API keys can only be generated for approved applications.')); ?>,
                revokedMessage: <?php echo json_encode(_('This application has been revoked. Contact an administrator for assistance.')); ?>,
                resubmitSuccess: <?php echo json_encode(_('Application resubmitted for review.')); ?>,
                resubmitError: <?php echo json_encode(_('Failed to resubmit application. Please try again.')); ?>
            }
        };
    </script>
</body>
</html>
