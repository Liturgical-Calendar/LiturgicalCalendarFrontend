<?php

/**
 * "Test Definitions" dashboard card.
 * Rendered from admin-dashboard.php for both global admins (inside the admin
 * blocks grid) and scoped test_editors (in their own Administration section),
 * so the markup lives here once instead of being duplicated per branch.
 */

?>
<div class="col-12 col-md-6 col-lg-4 mb-4">
    <div class="card admin-block shadow h-100 border-dark">
        <div class="card-body text-center d-flex flex-column">
            <div class="admin-block-icon mb-3">
                <i class="fas fa-vial fa-3x text-info"></i>
            </div>
            <h5 class="card-title"><?php echo htmlspecialchars(_('Test Definitions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
            <p class="card-text text-muted small flex-grow-1">
                <?php echo htmlspecialchars(_('Manage liturgical accuracy tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </p>
            <div class="admin-block-actions mt-auto">
                <a href="admin-tests.php" class="btn btn-dark btn-sm">
                    <i class="fas fa-tasks me-1"></i><?php echo htmlspecialchars(_('Manage'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
            </div>
        </div>
    </div>
</div>
