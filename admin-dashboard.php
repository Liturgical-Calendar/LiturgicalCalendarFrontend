<?php

/**
 * Admin Dashboard
 *
 * Unified entry point for all administrative functions.
 * Displays a grid of 6 block buttons for managing different aspects
 * of the Liturgical Calendar API data.
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

// Check if user has any calendar-related role (admin, calendar_editor, or test_editor)
$hasCalendarRole = $isAdmin
    || $authHelper->hasRole('calendar_editor')
    || $authHelper->hasRole('test_editor');

// If user only has developer role (no calendar-related roles), redirect to developer dashboard
if (!$hasCalendarRole) {
    header('Location: developer-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $dashboardTitle = _('Admin Dashboard');
        $calendarTitle  = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($dashboardTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black admin-dashboard-heading" style="--bs-text-opacity: .6;">
        <i class="fas fa-tachometer-alt me-2"></i><?php echo htmlspecialchars(_('Admin Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4">
        <?php echo htmlspecialchars(_('Manage liturgical calendar data, Roman Missal information, and regional calendars.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </p>

    <div class="row" id="adminBlocks">
        <?php include_once('./includes/admin-blocks.php'); ?>
    </div>

    <?php if ($isAdmin) : ?>
    <hr class="my-4">
    <h4 class="mb-3 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-user-shield me-2"></i><?php echo htmlspecialchars(_('Administration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h4>
    <div class="row">
        <div class="col-12 col-md-6 col-lg-4 mb-4">
            <div class="card admin-block shadow h-100 border-dark">
                <div class="card-body text-center d-flex flex-column">
                    <div class="admin-block-icon mb-3">
                        <i class="fas fa-users fa-3x text-dark"></i>
                    </div>
                    <h5 class="card-title"><?php echo htmlspecialchars(_('Users'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
                    <p class="card-text text-muted small flex-grow-1">
                        <?php echo htmlspecialchars(_('View users and manage their roles'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </p>
                    <div class="admin-block-actions mt-auto">
                        <a href="admin-users.php" class="btn btn-dark btn-sm">
                            <i class="fas fa-users-cog me-1"></i><?php echo htmlspecialchars(_('Manage'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12 col-md-6 col-lg-4 mb-4">
            <div class="card admin-block shadow h-100 border-dark">
                <div class="card-body text-center d-flex flex-column">
                    <div class="admin-block-icon mb-3">
                        <i class="fas fa-user-check fa-3x text-dark"></i>
                    </div>
                    <h5 class="card-title"><?php echo htmlspecialchars(_('Role Requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
                    <p class="card-text text-muted small flex-grow-1">
                        <?php echo htmlspecialchars(_('Review and approve user role requests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </p>
                    <div class="admin-block-actions mt-auto">
                        <a href="admin-role-requests.php" class="btn btn-dark btn-sm">
                            <i class="fas fa-tasks me-1"></i><?php echo htmlspecialchars(_('Manage'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12 col-md-6 col-lg-4 mb-4">
            <div class="card admin-block shadow h-100 border-dark">
                <div class="card-body text-center d-flex flex-column">
                    <div class="admin-block-icon mb-3">
                        <i class="fas fa-cubes fa-3x text-dark"></i>
                    </div>
                    <h5 class="card-title"><?php echo htmlspecialchars(_('Applications'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
                    <p class="card-text text-muted small flex-grow-1">
                        <?php echo htmlspecialchars(_('Review and approve developer applications'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </p>
                    <div class="admin-block-actions mt-auto">
                        <a href="admin-applications.php" class="btn btn-dark btn-sm">
                            <i class="fas fa-tasks me-1"></i><?php echo htmlspecialchars(_('Manage'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
