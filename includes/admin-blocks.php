<?php

/**
 * Admin Dashboard Block Buttons Component
 *
 * Renders the 6 admin section blocks for the unified admin dashboard.
 * Each block displays a title, description, count badge, and action buttons.
 */

$adminBlocks = [
    [
        'id'          => 'temporale',
        'icon'        => 'fa-calendar-alt',
        'color'       => 'primary',
        'title'       => _('Temporale'),
        'description' => _('Proprium de Tempore - temporal cycle events'),
        'viewUrl'     => 'temporale.php',
        'editUrl'     => 'temporale.php?edit=1',
        'permission'  => 'temporale:write'
    ],
    [
        'id'          => 'sanctorale',
        'icon'        => 'fa-book-open',
        'color'       => 'success',
        'title'       => _('Sanctorale'),
        'description' => _('Proprium de Sanctis - Roman Missal editions'),
        'viewUrl'     => 'missals-editor.php',
        'editUrl'     => 'missals-editor.php',
        'permission'  => 'missals:write'
    ],
    [
        'id'          => 'decrees',
        'icon'        => 'fa-gavel',
        'color'       => 'warning',
        'title'       => _('Decrees'),
        'description' => _('Congregation for Divine Worship decrees'),
        'viewUrl'     => 'decrees.php',
        'editUrl'     => 'decrees.php?edit=1',
        'permission'  => 'decrees:write'
    ],
    [
        'id'          => 'widerregion',
        'icon'        => 'fa-globe-americas',
        'color'       => 'info',
        'title'       => _('Wider Region'),
        'description' => _('Shared events for geographical regions'),
        'viewUrl'     => 'extending.php?choice=widerRegion',
        'editUrl'     => 'extending.php?choice=widerRegion',
        'permission'  => 'widerregion:write'
    ],
    [
        'id'          => 'national',
        'icon'        => 'fa-flag',
        'color'       => 'danger',
        'title'       => _('National'),
        'description' => _('National calendars by Bishops Conferences'),
        'viewUrl'     => 'extending.php?choice=national',
        'editUrl'     => 'extending.php?choice=national',
        'permission'  => 'national:write'
    ],
    [
        'id'          => 'diocesan',
        'icon'        => 'fa-church',
        'color'       => 'secondary',
        'title'       => _('Diocesan'),
        'description' => _('Diocesan calendars by liturgical offices'),
        'viewUrl'     => 'extending.php?choice=diocesan',
        'editUrl'     => 'extending.php?choice=diocesan',
        'permission'  => 'diocesan:write'
    ]
];

foreach ($adminBlocks as $block) {
    $id          = htmlspecialchars($block['id'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $icon        = htmlspecialchars($block['icon'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $color       = htmlspecialchars($block['color'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $title       = htmlspecialchars($block['title'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $description = htmlspecialchars($block['description'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $viewUrl     = htmlspecialchars($block['viewUrl'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $editUrl     = htmlspecialchars($block['editUrl'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $permission  = htmlspecialchars($block['permission'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $viewLabel = htmlspecialchars(_('View'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $editLabel = htmlspecialchars(_('Edit'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?>
    <div class="col-12 col-md-6 col-lg-4 mb-4">
        <div class="card admin-block shadow h-100 border-<?php echo $color; ?>" data-block-id="<?php echo $id; ?>">
            <div class="card-body text-center d-flex flex-column">
                <div class="admin-block-icon mb-3">
                    <i class="fas <?php echo $icon; ?> fa-3x text-<?php echo $color; ?>"></i>
                </div>
                <h5 class="card-title"><?php echo $title; ?></h5>
                <p class="card-text text-muted small flex-grow-1">
                    <?php echo $description; ?>
                </p>
                <div class="admin-block-count mb-3">
                    <span class="badge bg-<?php echo $color; ?> rounded-pill" data-count="<?php echo $id; ?>">
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    </span>
                </div>
                <div class="admin-block-actions mt-auto">
                    <a href="<?php echo $viewUrl; ?>" class="btn btn-outline-<?php echo $color; ?> btn-sm">
                        <i class="fas fa-eye me-1"></i><?php echo $viewLabel; ?>
                    </a>
                    <a href="<?php echo $editUrl; ?>"
                       class="btn btn-<?php echo $color; ?> btn-sm d-none"
                       data-requires-auth
                       data-requires-permission="<?php echo $permission; ?>">
                        <i class="fas fa-edit me-1"></i><?php echo $editLabel; ?>
                    </a>
                </div>
            </div>
        </div>
    </div>
    <?php
}
