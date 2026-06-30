<?php

/**
 * Admin Tests Management Page
 *
 * Allows test_editor / admin users to create, edit, delete, and view
 * liturgical test definitions via the /tests API. Per-row edit/delete are
 * gated against the caller's scopes from GET /auth/test-scopes; the API is
 * the hard backstop.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// This is an admin page: test editors, global admins, and resource-admins may
// enter. Per-row gating (below, in JS) governs what each user may change.
$isGlobalAdmin   = $authHelper->hasRole('admin');
$hasTestEditor   = $authHelper->hasRole('test_editor');
$isResourceAdmin = $authHelper->isResourceAdmin();

if (!$isGlobalAdmin && !$hasTestEditor && !$isResourceAdmin) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $testsTitle    = _('Test Definitions');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($testsTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-vial me-2 text-info"></i><?php echo htmlspecialchars(_('Test Definitions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4"><?php
        echo htmlspecialchars(
            _('Create, edit, and delete liturgical accuracy test definitions.'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
    ?></p>

    <!-- Filters -->
    <div class="card shadow mb-4">
        <div class="card-body">
            <div class="row g-2 align-items-end">
                <div class="col-md-4">
                    <label class="form-label" for="filterTestName">
                        <?php echo htmlspecialchars(_('Filter by name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </label>
                    <input type="text" class="form-control" id="filterTestName" />
                </div>
                <div class="col-md-4">
                    <label class="form-label" for="filterTestScope">
                        <?php echo htmlspecialchars(_('Filter by scope'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </label>
                    <input type="text" class="form-control" id="filterTestScope"
                        placeholder="<?php echo htmlspecialchars(_('USA, diocese id, ...'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>" />
                </div>
                <div class="col-md-4 text-end">
                    <button type="button" class="btn btn-outline-secondary" id="refreshTestsBtn">
                        <i class="fas fa-rotate"></i> <?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="createTestBtn" data-requires-auth>
                        <i class="fas fa-plus"></i> <?php echo htmlspecialchars(_('New Test'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Tests table -->
    <div class="card shadow mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span><?php echo htmlspecialchars(_('Tests'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
            <span class="badge bg-secondary" id="testsCount">0</span>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-sm table-hover align-middle">
                    <thead>
                        <tr>
                            <th><?php echo htmlspecialchars(_('Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Event'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Scope'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Type'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th><?php echo htmlspecialchars(_('Years'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th class="text-end"><?php echo htmlspecialchars(_('Actions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                        </tr>
                    </thead>
                    <tbody id="testsTableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Editor modal -->
    <div class="modal fade" id="testEditorModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="testEditorModalLabel">
                        <?php echo htmlspecialchars(_('Test Definition'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="testEditorAlerts"></div>
                    <form id="testEditorForm" novalidate>
                        <!-- Step 1: test type -->
                        <div class="mb-3">
                            <label class="form-label fw-bold">
                                <?php echo htmlspecialchars(_('Test type'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <div class="btn-group d-flex flex-wrap" role="group" id="testTypeGroup">
                                <input type="radio" class="btn-check" name="testType" id="tt-exact"
                                    value="exactCorrespondence" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-exact">
                                    <i class="fas fa-vial me-1"></i><?php echo htmlspecialchars(_('Exact date'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="radio" class="btn-check" name="testType" id="tt-since"
                                    value="exactCorrespondenceSince" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-since">
                                    <i class="fas fa-right-from-bracket me-1"></i><?php echo htmlspecialchars(_('Exact since year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="radio" class="btn-check" name="testType" id="tt-until"
                                    value="exactCorrespondenceUntil" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-until">
                                    <i class="fas fa-right-to-bracket me-1"></i><?php echo htmlspecialchars(_('Exact until year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="radio" class="btn-check" name="testType" id="tt-variable"
                                    value="variableCorrespondence" autocomplete="off">
                                <label class="btn btn-outline-primary" for="tt-variable">
                                    <i class="fas fa-square-root-variable me-1"></i><?php echo htmlspecialchars(_('Variable by year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="testName">
                                    <?php echo htmlspecialchars(_('Name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="testName"
                                    pattern="^(?:[a-z_]+?_){0,1}[A-Z][a-zA-Z1-9]+[0-9]{0,2}(?:_vigil)?Test$" required />
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="testScopeType">
                                    <?php echo htmlspecialchars(_('Scope'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <select class="form-select" id="testScopeType">
                                    <option value="general_roman_calendar">
                                        <?php echo htmlspecialchars(_('General Roman Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </option>
                                    <option value="national_calendar">
                                        <?php echo htmlspecialchars(_('National Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </option>
                                    <option value="diocesan_calendar">
                                        <?php echo htmlspecialchars(_('Diocesan Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </option>
                                </select>
                                <div id="testScopeIdMount" class="mt-2"></div>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="testEventKey">
                                    <?php echo htmlspecialchars(_('Liturgical event'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="testEventKey"
                                    list="testEventKeyList" required />
                                <datalist id="testEventKeyList"></datalist>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="testDescription">
                                    <?php echo htmlspecialchars(_('Description'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <textarea class="form-control" id="testDescription" rows="2" required></textarea>
                            </div>
                        </div>

                        <!-- Step 3: year range -->
                        <div class="mt-3">
                            <label class="form-label fw-bold">
                                <?php echo htmlspecialchars(_('Year range'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <div class="range-slider flat" id="yearsRangeSlider"
                                 style="--min:1970; --max:2050; --value-a:1999; --value-b:2030; --text-value-a:'1999'; --text-value-b:'2030';">
                                <input type="range" id="lowerRange" min="1970" max="2050" value="1999" />
                                <output></output>
                                <input type="range" id="upperRange" min="1970" max="2050" value="2030" />
                                <output></output>
                                <div class="range-slider__progress"></div>
                            </div>
                            <div class="year-grid mt-2" id="yearGrid"></div>
                        </div>

                        <!-- Step 4: base date -->
                        <div class="mt-3 col-md-4">
                            <label class="form-label" for="baseDate">
                                <?php echo htmlspecialchars(_('Base date'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <input type="date" class="form-control" id="baseDate"
                                min="1970-01-01" max="2050-12-31" />
                        </div>

                        <!-- Step 5: per-year assertions -->
                        <div class="mt-3">
                            <label class="form-label fw-bold">
                                <?php echo htmlspecialchars(_('Per-year assertions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <div id="assertionsContainer"></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="saveTestBtn" data-requires-auth>
                        <?php echo htmlspecialchars(_('Save'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Comment modal -->
    <div class="modal fade" id="testCommentModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <?php echo htmlspecialchars(_('Assertion comment'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="commentYear" />
                    <textarea class="form-control" id="commentText" rows="3"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="saveCommentBtn">
                        <?php echo htmlspecialchars(_('Save comment'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete modal -->
    <div class="modal fade" id="deleteTestModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <?php echo htmlspecialchars(_('Delete Test'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="deleteTestAlerts"></div>
                    <p id="deleteTestConfirmText"></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteTestBtn" data-requires-auth>
                        <?php echo htmlspecialchars(_('Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config for JavaScript -->
    <script>
        window.AdminTestsConfig = {
            apiUrl:        <?php echo json_encode($apiBaseUrl); ?>,
            isGlobalAdmin: <?php echo json_encode($isGlobalAdmin); ?>,
            hasTestEditor: <?php echo json_encode($hasTestEditor); ?>,
            locale:        <?php echo json_encode($i18n->LOCALE); ?>,
            i18n: {
                loading:             <?php echo json_encode(_('Loading...')); ?>,
                noTests:             <?php echo json_encode(_('No tests found.')); ?>,
                failedToLoad:        <?php echo json_encode(_('Failed to load tests. Please try again later.')); ?>,
                createSuccess:       <?php echo json_encode(_('Test created successfully.')); ?>,
                updateSuccess:       <?php echo json_encode(_('Test updated successfully.')); ?>,
                deleteSuccess:       <?php echo json_encode(_('Test deleted successfully.')); ?>,
                saving:              <?php echo json_encode(_('Saving...')); ?>,
                deleting:            <?php echo json_encode(_('Deleting...')); ?>,
                edit:                <?php echo json_encode(_('Edit')); ?>,
                delete:              <?php echo json_encode(_('Delete')); ?>,
                confirmDelete:       <?php echo json_encode(_('Are you sure you want to delete the test "%s"?')); ?>,
                generalRomanCalendar: <?php echo json_encode(_('General Roman Calendar')); ?>,
                nationalCalendar:    <?php echo json_encode(_('National Calendar')); ?>,
                diocesanCalendar:    <?php echo json_encode(_('Diocesan Calendar')); ?>,
                requiredFields:      <?php echo json_encode(_('Please fill in all required fields.')); ?>,
                denied403:           <?php echo json_encode(_('You do not have permission to perform this action.')); ?>,
                conflict409:         <?php echo json_encode(_('A test with that name already exists.')); ?>
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
