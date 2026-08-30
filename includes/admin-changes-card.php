<?php

/**
 * Change Request Review Card
 *
 * Links to `admin-changes.php`, the reviewer's queue for proposed source data
 * changes.
 *
 * Included from BOTH dashboard branches: the `$isAdmin` Administration block, and
 * the separate `!$isAdmin && is_resource_admin` block below it. Global admins are
 * deliberately served the first and never reach the second, so a card added to
 * only one of them is invisible to half its audience — which is exactly why this
 * lives in its own include rather than being written out twice.
 */

?>
<div class="col-12 col-md-6 col-lg-4 mb-4">
    <div class="card admin-block shadow h-100 border-dark">
        <div class="card-body text-center d-flex flex-column">
            <div class="admin-block-icon mb-3">
                <i class="fas fa-code-pull-request fa-3x text-dark"></i>
            </div>
            <h5 class="card-title"><?php echo htmlspecialchars(_('Change Requests to Review'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
            <p class="card-text text-muted small flex-grow-1">
                <?php
                // phpcs:ignore Generic.Files.LineLength
                $changesCardDesc = _('Read and decide the source data changes proposed for the calendars you administer');
                echo htmlspecialchars($changesCardDesc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                ?>
            </p>
            <div class="admin-block-actions mt-auto">
                <a href="admin-changes.php" class="btn btn-dark btn-sm">
                    <i class="fas fa-tasks me-1"></i><?php echo htmlspecialchars(_('Review'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </a>
            </div>
        </div>
    </div>
</div>
