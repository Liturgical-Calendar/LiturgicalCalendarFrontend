<?php

/**
 * @var bool   $isAdmin    Defined by the including page (admin-dashboard.php).
 * @var string $apiBaseUrl Defined by includes/common.php.
 */

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
<div class="col-12 col-md-6 col-lg-4 mb-4"
    data-fga-gate="general_roman_calendar:decrees"
    data-user-sub="<?php echo htmlspecialchars($authHelper->sub ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
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
    // the viewer relation via /admin/permissions/check before showing the link.
    const isGlobalAdmin = <?php echo json_encode($isAdmin); ?>;
    if (isGlobalAdmin) {
        return; // always visible for global admins
    }
    const card = document.currentScript.closest('[data-fga-gate]');
    if (!card) {
        return;
    }
    const apiBase = <?php echo json_encode($apiBaseUrl); ?>;
    const gate = card.dataset.fgaGate; // "general_roman_calendar:decrees"
    const parts = gate.split(':');
    const objectType = parts[0];
    const objectId   = parts[1];
    const userSub    = card.dataset.userSub;
    const params     = new URLSearchParams({
        user:        userSub,
        object_type: objectType,
        object_id:   objectId,
        relation:    'viewer'
    });
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 15000);
    fetch(apiBase + '/admin/permissions/check?' + params.toString(), {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
    })
        .then(function (r) {
            clearTimeout(timeoutId);
            if (!r.ok) {
                console.warn('[admin-decrees-card] permissions/check returned HTTP ' + r.status + ' — hiding card');
                card.classList.add('d-none');
                return null;
            }
            return r.json();
        })
        .then(function (data) {
            if (data === null) {
                return;
            }
            if (!data || data.allowed !== true) {
                card.classList.add('d-none');
            }
        })
        .catch(function (err) {
            clearTimeout(timeoutId);
            console.warn('[admin-decrees-card] permissions/check unreachable — hiding card', err);
            card.classList.add('d-none');
        });
}());
</script>
