<?php

/**
 * "Decrees" dashboard card.
 * Rendered from admin-dashboard.php for both global admins (inside the admin
 * blocks grid) and scoped calendar_editors (in their own Administration section),
 * so the markup lives here once instead of being duplicated per branch.
 *
 * The data-fga-gate attribute is used by Task 3 capability detection to hide
 * this card when the user has no viewer relation on the resource. Global admins
 * always see it regardless of FGA state.
 */

?>
<div class="col-12 col-md-6 col-lg-4 mb-4" data-fga-gate="general_roman_calendar:decrees">
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
<script>
(function () {
    'use strict';
    // Interim per-card FGA visibility check (Task 3 will batch these).
    // Global admins always see the card; for calendar_editors we confirm
    // the viewer relation before showing the link.
    const isGlobalAdmin = <?php echo json_encode($isAdmin); ?>;
    if (isGlobalAdmin) {
        return; // always visible for global admins
    }
    const card = document.currentScript.closest('[data-fga-gate]');
    if (!card) {
        return;
    }
    const apiBase = <?php echo json_encode($apiBaseUrl); ?>;
    const resource = card.dataset.fgaGate; // "general_roman_calendar:decrees"
    fetch(apiBase + '/auth/decree-scopes', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            if (!data || !Array.isArray(data.scopes) || data.scopes.length === 0) {
                card.classList.add('d-none');
            }
        })
        .catch(function () {
            card.classList.add('d-none');
        });
}());
</script>
