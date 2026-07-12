<?php

/**
 * Admin Decrees Management Page
 *
 * Allows calendar_editor / admin users to create, edit, and delete
 * Dicastery for Divine Worship decree definitions via the /decrees API.
 * Per-row edit/delete are gated against the caller's FGA relations;
 * the API is the hard backstop.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// This page is accessible to global admins and calendar editors.
// NOTE: the FGA viewer-or-above check happens client-side on load (Task 3);
// users with the role but no relation get an empty-state message, and the
// dashboard card (which performs the same check) will not have shown a link.
$isAdmin          = $authHelper->hasRole('admin');
$isCalendarEditor = $authHelper->hasRole('calendar_editor');

if (!$isAdmin && !$isCalendarEditor) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $decreesTitle  = _('Decrees');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($decreesTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-4 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-scroll me-2 text-warning"></i><?php echo htmlspecialchars(_('Decrees'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted mb-4"><?php
        echo htmlspecialchars(
            _('Create, edit and delete decrees of the Dicastery for Divine Worship.'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
    ?></p>

    <!-- Action buttons -->
    <div class="mb-4 d-flex flex-wrap gap-2 align-items-center">
        <button type="button" class="btn btn-primary d-none" id="btnCreateDecree" data-requires-auth>
            <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('New Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
        <?php // Permissions are resource-level (general_roman_calendar:decrees governs all decrees), hence one page-level link ?>
        <a href="admin-permissions.php?object_type=general_roman_calendar&amp;object_id=decrees"
           class="btn btn-outline-secondary d-none" id="lnkManagePermissions">
            <i class="fas fa-user-shield me-1"></i><?php echo htmlspecialchars(_('Manage permissions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <!-- Decrees container -->
    <div id="decreesContainer" class="row g-3"></div>

    <!-- Editor modal -->
    <div class="modal fade" id="decreeEditorModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="decreeEditorModalLabel">
                        <?php echo htmlspecialchars(_('Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">

                    <!-- Alert region for validation errors -->
                    <div id="decreeEditorAlerts"></div>

                    <form id="decreeEditorForm" novalidate>

                        <!-- ── Action select ──────────────────────────────── -->
                        <div class="mb-3">
                            <label for="decreeAction" class="form-label">
                                <?php echo htmlspecialchars(_('Action'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <select class="form-select" id="decreeAction" name="action" required>
                                <option value="createNew"><?php
                                    echo htmlspecialchars(_('Create new event'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?></option>
                                <option value="makeDoctor"><?php
                                    echo htmlspecialchars(_('Make Doctor of the Church'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?></option>
                                <option value="setProperty:name"><?php
                                    echo htmlspecialchars(_('Set property: name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?></option>
                                <option value="setProperty:grade"><?php
                                    echo htmlspecialchars(_('Set property: grade'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?></option>
                            </select>
                        </div>

                        <!-- ── Common fields ──────────────────────────────── -->
                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <label for="decreeId" class="form-label">
                                    <?php echo htmlspecialchars(_('Decree ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="decreeId" name="decree_id"
                                    pattern="^[A-Z][A-Za-z]+_(Upgrade|Create|NameChange|Doctor)$"
                                    required>
                                <div class="form-text">
                                    <?php echo htmlspecialchars(
                                        _('Format: PascalCaseName_(Upgrade|Create|NameChange|Doctor)'),
                                        ENT_QUOTES | ENT_SUBSTITUTE,
                                        'UTF-8'
                                    ); ?>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label for="decreeDate" class="form-label">
                                    <?php echo htmlspecialchars(_('Decree date'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="date" class="form-control" id="decreeDate" name="decree_date">
                            </div>
                            <div class="col-md-3">
                                <label for="decreeProtocol" class="form-label">
                                    <?php echo htmlspecialchars(_('Protocol'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="decreeProtocol" name="decree_protocol"
                                    placeholder="Prot. N. 000/25">
                            </div>
                        </div>

                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <label for="decreeEventKey" class="form-label">
                                    <?php echo htmlspecialchars(_('Event key'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="decreeEventKey" name="event_key">
                            </div>
                            <div class="col-md-3">
                                <label for="decreeSinceYear" class="form-label">
                                    <?php echo htmlspecialchars(_('Since year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="number" class="form-control" id="decreeSinceYear" name="since_year"
                                    min="1970" max="9999">
                            </div>
                            <div class="col-md-3">
                                <label for="decreeUrl" class="form-label">
                                    <?php echo htmlspecialchars(_('Source URL'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="url" class="form-control" id="decreeUrl" name="url"
                                    placeholder="https://www.vatican.va/…">
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="decreeDescription" class="form-label">
                                <?php echo htmlspecialchars(_('Description'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <textarea class="form-control" id="decreeDescription" name="description"
                                rows="2"></textarea>
                        </div>

                        <!-- ── createNew-only block: event details ────────── -->
                        <fieldset class="border rounded p-3 mb-3 action-block action-createNew">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php echo htmlspecialchars(_('Event details'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </legend>

                            <!-- Fixed / mobile date type -->
                            <div class="mb-3">
                                <label class="form-label">
                                    <?php echo htmlspecialchars(_('Date type'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <div class="d-flex gap-4">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="event_type"
                                            id="eventTypeFixed" value="fixed" checked>
                                        <label class="form-check-label" for="eventTypeFixed">
                                            <?php echo htmlspecialchars(_('Fixed'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="event_type"
                                            id="eventTypeMobile" value="mobile">
                                        <label class="form-check-label" for="eventTypeMobile">
                                            <?php echo htmlspecialchars(_('Mobile'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Fixed date inputs -->
                            <div class="row g-3 mb-3" id="fixedDateInputs">
                                <div class="col-md-3">
                                    <label for="eventDay" class="form-label">
                                        <?php echo htmlspecialchars(_('Day'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </label>
                                    <input type="number" class="form-control" id="eventDay" name="day"
                                        min="1" max="31">
                                </div>
                                <div class="col-md-3">
                                    <label for="eventMonth" class="form-label">
                                        <?php echo htmlspecialchars(_('Month'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </label>
                                    <input type="number" class="form-control" id="eventMonth" name="month"
                                        min="1" max="12">
                                </div>
                            </div>

                            <!-- Mobile date input -->
                            <div class="mb-3 d-none" id="mobileDateInput">
                                <label for="eventStrtotime" class="form-label">
                                    <?php echo htmlspecialchars(_('Strtotime expression'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="eventStrtotime" name="strtotime"
                                    placeholder="Monday after Pentecost">
                                <div class="form-text">
                                    <?php echo htmlspecialchars(
                                        _('PHP strtotime-compatible expression, e.g. "Monday after Pentecost"'),
                                        ENT_QUOTES | ENT_SUBSTITUTE,
                                        'UTF-8'
                                    ); ?>
                                </div>
                            </div>

                            <!-- Grade + color (event details, createNew only) -->
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label for="eventGradeCreate" class="form-label">
                                        <?php echo htmlspecialchars(_('Grade'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </label>
                                    <select class="form-select" id="eventGradeCreate" name="grade">
                                        <option value="0"><?php echo htmlspecialchars(_('0 — Weekday'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="1"><?php echo htmlspecialchars(_('1 — Commemoration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="2" selected><?php echo htmlspecialchars(_('2 — Optional Memorial'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="3"><?php echo htmlspecialchars(_('3 — Memorial'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="4"><?php echo htmlspecialchars(_('4 — Feast'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="5"><?php echo htmlspecialchars(_('5 — Feast of the Lord'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="6"><?php echo htmlspecialchars(_('6 — Solemnity'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="7"><?php echo htmlspecialchars(_('7 — Higher Solemnity'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label for="eventColor" class="form-label">
                                        <?php echo htmlspecialchars(_('Color(s)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </label>
                                    <select class="form-select" id="eventColor" name="color" multiple size="5">
                                        <option value="white"><?php echo htmlspecialchars(_('White'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="red"><?php echo htmlspecialchars(_('Red'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="green"><?php echo htmlspecialchars(_('Green'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="purple"><?php echo htmlspecialchars(_('Purple'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        <option value="rose"><?php echo htmlspecialchars(_('Rose'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    </select>
                                    <div class="form-text">
                                        <?php echo htmlspecialchars(_('Hold Ctrl/Cmd to select multiple'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        <!-- ── common block (createNew + makeDoctor) ─────── -->
                        <fieldset class="border rounded p-3 mb-3 action-block needs-common d-none">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php echo htmlspecialchars(_('Common(s)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </legend>
                            <div class="col-md-6">
                                <label for="eventCommon" class="form-label">
                                    <?php echo htmlspecialchars(_('Common(s)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="eventCommon" name="common_text"
                                    list="commonDatalist"
                                    placeholder="<?php echo htmlspecialchars(_('e.g. Pastors'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                                <datalist id="commonDatalist">
                                    <option value="Proper"></option>
                                    <option value="Pastors"></option>
                                    <option value="Doctors"></option>
                                    <option value="Martyrs"></option>
                                    <option value="Virgins"></option>
                                    <option value="Holy Men and Women"></option>
                                </datalist>
                                <div class="form-text">
                                    <?php echo htmlspecialchars(
                                        _('Separate multiple values with a comma'),
                                        ENT_QUOTES | ENT_SUBSTITUTE,
                                        'UTF-8'
                                    ); ?>
                                </div>
                            </div>
                        </fieldset>

                        <!-- ── setProperty:grade-only block ──────────────── -->
                        <fieldset class="border rounded p-3 mb-3 action-block action-setPropertyGrade d-none">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php echo htmlspecialchars(_('Grade'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </legend>
                            <div class="col-md-4">
                                <label for="eventGradeSet" class="form-label">
                                    <?php echo htmlspecialchars(_('New grade'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <select class="form-select" id="eventGradeSet" name="grade_set">
                                    <option value="0"><?php echo htmlspecialchars(_('0 — Weekday'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="1"><?php echo htmlspecialchars(_('1 — Commemoration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="2"><?php echo htmlspecialchars(_('2 — Optional Memorial'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="3" selected><?php echo htmlspecialchars(_('3 — Memorial'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="4"><?php echo htmlspecialchars(_('4 — Feast'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="5"><?php echo htmlspecialchars(_('5 — Feast of the Lord'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="6"><?php echo htmlspecialchars(_('6 — Solemnity'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                    <option value="7"><?php echo htmlspecialchars(_('7 — Higher Solemnity'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                </select>
                            </div>
                        </fieldset>

                        <!-- ── i18n block (needs-i18n) ────────────────────── -->
                        <fieldset class="border rounded p-3 mb-3 action-block needs-i18n d-none">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php echo htmlspecialchars(_('Translations (i18n)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </legend>

                            <div id="i18nRows">
                                <!-- Base locale row — pre-added and non-removable -->
                                <div class="row g-2 mb-2 i18n-row" data-base-row="true">
                                    <div class="col-md-3">
                                        <select class="form-select form-select-sm" name="i18n_locale[]" disabled>
                                            <option selected id="i18nBaseLocaleOption"></option>
                                        </select>
                                    </div>
                                    <div class="col-md-8">
                                        <input type="text" class="form-control form-control-sm"
                                            name="i18n_name[]"
                                            placeholder="<?php echo htmlspecialchars(_('Name in base locale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"
                                            required>
                                    </div>
                                    <div class="col-md-1 d-flex align-items-center">
                                        <span class="text-muted small">
                                            <i class="fas fa-lock" title="<?php echo htmlspecialchars(_('Base locale — cannot be removed'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="addI18nRow">
                                <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Add translation'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </button>
                        </fieldset>

                        <!-- ── Readings block (needs-readings) ───────────── -->
                        <fieldset class="border rounded p-3 mb-3 action-block needs-readings d-none">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php echo htmlspecialchars(_('Lectionary readings'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </legend>

                            <div id="readingsGroups">
                                <!-- Readings groups are added dynamically by JS.
                                     A base-locale group is pre-added on modal open. -->
                            </div>

                            <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="addReadingsGroup">
                                <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Add readings for locale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </button>
                        </fieldset>

                    </form>
                </div><!-- /.modal-body -->
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="saveDecreeBtn" data-requires-auth>
                        <?php echo htmlspecialchars(_('Save'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete confirmation modal -->
    <div class="modal fade" id="decreeDeleteModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <?php echo htmlspecialchars(_('Delete Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"
                        aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body">
                    <div id="decreeDeleteAlerts"></div>
                    <p id="decreeDeleteConfirmText"></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteDecreeBtn" data-requires-auth>
                        <?php echo htmlspecialchars(_('Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Config for JavaScript -->
    <script>
        window.AdminDecreesConfig = {
            apiUrl:        <?php echo json_encode($apiBaseUrl, JSON_HEX_TAG); ?>,
            <?php // BCP-47 (en-US), not gettext/ICU (en_US): Intl.DateTimeFormat rejects underscore tags. ?>
            locale:        <?php echo json_encode(str_replace('_', '-', $i18n->LOCALE), JSON_HEX_TAG); ?>,
            isGlobalAdmin: <?php echo json_encode($isAdmin, JSON_HEX_TAG); ?>,
            userSub:       <?php echo json_encode($authHelper->sub ?? '', JSON_HEX_TAG); ?>,
            i18n: {
                loading:           <?php echo json_encode(_('Loading…'), JSON_HEX_TAG); ?>,
                noAccess:          <?php echo json_encode(_('You do not have permission to view decrees administration.'), JSON_HEX_TAG); ?>,
                loadFailed:        <?php echo json_encode(_('Could not load decrees from the API.'), JSON_HEX_TAG); ?>,
                noDecrees:         <?php echo json_encode(_('No decrees found.'), JSON_HEX_TAG); ?>,
                confirmDelete:     <?php echo json_encode(_('Are you sure you want to delete this decree? This action cannot be undone.'), JSON_HEX_TAG); ?>,
                created:           <?php echo json_encode(_('Decree created.'), JSON_HEX_TAG); ?>,
                updated:           <?php echo json_encode(_('Decree updated.'), JSON_HEX_TAG); ?>,
                deleted:           <?php echo json_encode(_('Decree deleted.'), JSON_HEX_TAG); ?>,
                translations:      <?php echo json_encode(_('Translations'), JSON_HEX_TAG); ?>,
                readings:          <?php echo json_encode(_('Lectionary readings'), JSON_HEX_TAG); ?>,
                newDecree:         <?php echo json_encode(_('New Decree'), JSON_HEX_TAG); ?>,
                editDecree:        <?php echo json_encode(_('Edit Decree'), JSON_HEX_TAG); ?>,
                selectLocale:      <?php echo json_encode(_('Select locale'), JSON_HEX_TAG); ?>,
                removeRow:         <?php echo json_encode(_('Remove'), JSON_HEX_TAG); ?>,
                firstReading:      <?php echo json_encode(_('First reading'), JSON_HEX_TAG); ?>,
                responsorialPsalm: <?php echo json_encode(_('Responsorial psalm'), JSON_HEX_TAG); ?>,
                secondReading:     <?php echo json_encode(_('Second reading (optional)'), JSON_HEX_TAG); ?>,
                gospelAcclamation: <?php echo json_encode(_('Gospel acclamation'), JSON_HEX_TAG); ?>,
                gospel:            <?php echo json_encode(_('Gospel'), JSON_HEX_TAG); ?>,
                noReadings:        <?php echo json_encode(_('No readings defined for this locale yet'), JSON_HEX_TAG); ?>,
                validationErrors:  <?php echo json_encode(_('Please fix the following errors before saving:'), JSON_HEX_TAG); ?>,
                sinceYear:         <?php echo json_encode(_('Since %s'), JSON_HEX_TAG); ?>,
                sourceLink:        <?php echo json_encode(_('Source'), JSON_HEX_TAG); ?>,
                sessionExpired:    <?php echo json_encode(_('Your session has expired. Please log in again.'), JSON_HEX_TAG); ?>,
                loginLink:         <?php echo json_encode(_('Log in'), JSON_HEX_TAG); ?>,
                permissionDenied:  <?php echo json_encode(_('You do not have permission to perform this action.'), JSON_HEX_TAG); ?>,
                editAriaLabel:     <?php echo json_encode(_('Edit'), JSON_HEX_TAG); ?>,
                deleteAriaLabel:   <?php echo json_encode(_('Delete'), JSON_HEX_TAG); ?>,
                errorText:         <?php echo json_encode(_('(error)'), JSON_HEX_TAG); ?>,
                gradeLabels: {
                    7: <?php echo json_encode(_('Higher Solemnity'), JSON_HEX_TAG); ?>,
                    6: <?php echo json_encode(_('Solemnity'), JSON_HEX_TAG); ?>,
                    5: <?php echo json_encode(_('Feast of the Lord'), JSON_HEX_TAG); ?>,
                    4: <?php echo json_encode(_('Feast'), JSON_HEX_TAG); ?>,
                    3: <?php echo json_encode(_('Memorial'), JSON_HEX_TAG); ?>,
                    2: <?php echo json_encode(_('Optional Memorial'), JSON_HEX_TAG); ?>,
                    1: <?php echo json_encode(_('Commemoration'), JSON_HEX_TAG); ?>,
                    0: <?php echo json_encode(_('Weekday'), JSON_HEX_TAG); ?>
                }
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
