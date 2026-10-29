<?php

/**
 * "Decrees" dashboard card.
 * Rendered from admin-dashboard.php for non-admins who can edit decrees, in their own Administration section.
 * The markup lives here instead of being duplicated per branch.
 *
 * Visibility is decided server-side in admin-dashboard.php: a non-admin sees this card only when
 * AuthHelper::editableObjectIds('rite_calendar') contains `decrees`, i.e. they hold editor or admin on
 * rite_calendar:roman/decrees. Read-only access is served by the Decrees block in the dashboard grid
 * (LiturgicalCalendarAPI #1049).
 */

?>

<div class="col-12 col-md-6 col-lg-4 mb-4">
    <div class="card admin-block shadow h-100 border-dark">
        <div class="card-body text-center d-flex flex-column">
            <div class="admin-block-icon mb-3">
                <i class="fas fa-scroll fa-3x text-warning"></i>
            </div>
            <h5 class="card-title"><?php echo htmlspecialchars(_('Decrees'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
            <p class="card-text text-muted small flex-grow-1">
                <?php echo htmlspecialchars(_('Create, edit and delete decrees of the Dicastery for Divine Worship'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </p>
            <div class="admin-block-actions mt-auto">
                <a href="admin-decrees.php" class="btn btn-dark btn-sm">
                    <i class="fas fa-tasks me-1"></i><?php echo htmlspecialchars(_('Manage'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
            </div>
        </div>
    </div>
</div>
