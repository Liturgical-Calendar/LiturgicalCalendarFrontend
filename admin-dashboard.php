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

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php echo htmlspecialchars(_('Admin Dashboard'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?> - <?php echo htmlspecialchars(_('Catholic Liturgical Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></title>
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

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
