<?php

/**
 * Temporale (Proprium de Tempore) Viewer/Editor
 *
 * Displays temporale events (temporal cycle of the liturgical year)
 * with filtering by season, grade, and search functionality.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: /');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php echo htmlspecialchars(_('Temporale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?> - <?php echo htmlspecialchars(_('Catholic Liturgical Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></title>
    <?php include_once('./layout/head.php'); ?>
    <link rel="stylesheet" href="assets/css/temporale.css">
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-calendar-alt me-2 text-primary"></i><?php echo htmlspecialchars(_('Temporale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>
    <p class="text-muted mb-4">
        <?php echo htmlspecialchars(_('Proprium de Tempore - The temporal cycle of the liturgical year including Advent, Christmas, Lent, Easter Triduum, Easter, and Ordinary Time.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </p>

    <!-- Filters -->
    <div class="card shadow mb-4">
        <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-filter me-2"></i><?php echo htmlspecialchars(_('Filters'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </h6>
        </div>
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-3">
                    <label for="seasonFilter" class="form-label"><?php echo htmlspecialchars(_('Liturgical Season'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <select id="seasonFilter" class="form-select">
                        <option value=""><?php echo htmlspecialchars(_('All Seasons'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="ADVENT"><?php echo htmlspecialchars(_('Advent'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="CHRISTMAS"><?php echo htmlspecialchars(_('Christmas'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="LENT"><?php echo htmlspecialchars(_('Lent'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="EASTER_TRIDUUM"><?php echo htmlspecialchars(_('Easter Triduum'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="EASTER"><?php echo htmlspecialchars(_('Easter'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="ORDINARY_TIME"><?php echo htmlspecialchars(_('Ordinary Time'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label for="gradeFilter" class="form-label"><?php echo htmlspecialchars(_('Grade'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <select id="gradeFilter" class="form-select">
                        <option value=""><?php echo htmlspecialchars(_('All Grades'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="7"><?php echo htmlspecialchars(_('Higher Solemnity (7)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="6"><?php echo htmlspecialchars(_('Solemnity (6)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="5"><?php echo htmlspecialchars(_('Feast of the Lord (5)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="4"><?php echo htmlspecialchars(_('Feast (4)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="3"><?php echo htmlspecialchars(_('Memorial (3)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="2"><?php echo htmlspecialchars(_('Optional Memorial (2)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="1"><?php echo htmlspecialchars(_('Commemoration (1)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="0"><?php echo htmlspecialchars(_('Weekday (0)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label for="categoryFilter" class="form-label"><?php echo htmlspecialchars(_('Lectionary Category'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <select id="categoryFilter" class="form-select">
                        <option value=""><?php echo htmlspecialchars(_('All Categories'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="dominicale_et_festivum"><?php echo htmlspecialchars(_('Dominicale et Festivum'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                        <option value="feriale"><?php echo htmlspecialchars(_('Feriale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label for="searchFilter" class="form-label"><?php echo htmlspecialchars(_('Search'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
                    <input type="text" id="searchFilter" class="form-control" placeholder="<?php echo htmlspecialchars(_('Search by name or key...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                </div>
            </div>
        </div>
    </div>

    <!-- Data Table -->
    <div class="card shadow mb-4">
        <div class="card-header py-3 d-flex justify-content-between align-items-center">
            <h6 class="m-0 fw-bold text-primary">
                <i class="fas fa-table me-2"></i><?php echo htmlspecialchars(_('Temporale Events'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                <span id="eventCount" class="badge bg-secondary ms-2">0</span>
            </h6>
            <div>
                <button id="exportBtn" class="btn btn-outline-primary btn-sm">
                    <i class="fas fa-download me-1"></i><?php echo htmlspecialchars(_('Export JSON'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </button>
            </div>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-bordered table-hover" id="temporaleTable">
                    <thead class="table-light">
                        <tr>
                            <th><?php echo htmlspecialchars(_('Event Key'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Grade'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Season'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Type'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Color'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Actions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                        </tr>
                    </thead>
                    <tbody id="temporaleTableBody">
                        <tr>
                            <td colspan="7" class="text-center py-4">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden"><?php echo htmlspecialchars(_('Loading...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Event Details Modal -->
    <div class="modal fade" id="eventDetailsModal" tabindex="-1" aria-labelledby="eventDetailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="eventDetailsModalLabel"><?php echo htmlspecialchars(_('Event Details'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body" id="eventDetailsBody">
                    <!-- Populated by JavaScript -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></button>
                </div>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>
    <script src="assets/js/temporale.js"></script>
</body>
</html>
