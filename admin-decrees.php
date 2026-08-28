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

// Shared source of the localized month / grade / color / common option lists,
// so the decree editor offers exactly what the diocesan calendar form does.
$formControls = new \LiturgicalCalendar\Frontend\FormControls($i18n);

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
        <?php // NB: no data-requires-auth here — that global handler reveals on *any* auth, but creating a
              // decree requires the canEdit capability. Visibility is owned entirely by admin-decrees.js
              // (server-rendered d-none by default; revealed only when canEdit). ?>
        <button type="button" class="btn btn-primary d-none" id="btnCreateDecree">
            <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('New Decree'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
        <?php // Permissions are resource-level (general_roman_calendar:decrees governs all decrees), hence one page-level link ?>
        <a href="admin-permissions.php?object_type=general_roman_calendar&amp;object_id=decrees"
           class="btn btn-outline-secondary d-none" id="lnkManagePermissions">
            <i class="fas fa-user-shield me-1"></i><?php echo htmlspecialchars(_('Manage permissions'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </a>
    </div>

    <?php // Search + filter bar. Server-rendered hidden: admin-decrees.js reveals it only once
          // decrees have actually loaded, so it never sits above a spinner, an error or the
          // no-access empty state. Purely client-side — it narrows the list already fetched. ?>
    <div class="row g-2 mb-4 d-none" id="decreeFilters">
        <div class="col-12 col-md-6">
            <label for="decreeSearch" class="form-label visually-hidden">
                <?php echo htmlspecialchars(_('Search decrees'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </label>
            <div class="input-group">
                <span class="input-group-text"><i class="fas fa-search"></i></span>
                <input type="search" class="form-control" id="decreeSearch"
                    autocomplete="off"
                    placeholder="<?php echo htmlspecialchars(
                        _('Search by name, event key, protocol or description'),
                        ENT_QUOTES | ENT_SUBSTITUTE,
                        'UTF-8'
                    ); ?>">
            </div>
        </div>
        <div class="col-6 col-md-2">
            <label for="decreeYearFilter" class="form-label visually-hidden">
                <?php echo htmlspecialchars(_('Filter by year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </label>
            <?php // Options are filled by JS from the decree dates actually present. ?>
            <select class="form-select" id="decreeYearFilter">
                <option value=""><?php echo htmlspecialchars(_('Any year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
            </select>
        </div>
        <div class="col-6 col-md-3">
            <label for="decreeActionFilter" class="form-label visually-hidden">
                <?php
                    /* translators: "action" here is the decree's action type (create new event / make Doctor of the Church / set
                       property), not a deed or legal action */
                    echo htmlspecialchars(_('Filter by action'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                ?>
            </label>
            <select class="form-select" id="decreeActionFilter">
                                <option value=""><?php
                    /* translators: the unfiltered choice in the decree action filter; see the note on "Filter by action" */
                                echo htmlspecialchars(_('Any action'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                ?></option>
                <option value="createNew"><?php
                    echo htmlspecialchars(_('Create new event'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                ?></option>
                <option value="makeDoctor"><?php
                    /* translators: declares an existing saint a Doctor of the Church - the liturgical title (Latin "Doctor Ecclesiae"),
                       never an academic doctorate, and not "manufacture" */
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
        <div class="col-12 col-md-1 d-grid">
            <button type="button" class="btn btn-outline-secondary" id="btnClearDecreeFilters">
                <?php echo htmlspecialchars(_('Clear'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
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

                    <?php // Catalog of General Roman Calendar event keys (value) + localized names (label),
                          // filled by JS from GET /events. Shared by two fields — the decree's own
                          // #decreeEventKey and the mobile relative-date anchor #eventStrtotimeEventKey —
                          // so it lives at modal-body level rather than inside either one's block. ?>
                    <datalist id="grcEventKeysDatalist"></datalist>

                    <form id="decreeEditorForm" novalidate>

                        <!-- ── Event key + action (decree_id is derived) ──── -->
                        <div class="row g-3 mb-1">
                            <div class="col-md-6">
                                <label for="decreeEventKey" class="form-label">
                                    <?php echo htmlspecialchars(_('Event key'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="decreeEventKey" name="event_key"
                                    list="grcEventKeysDatalist" autocomplete="off" placeholder="StMotherTeresa">
                                <?php // On edit, event_key is immutable: shown as static text, not an editable field ?>
                                <div class="form-control-plaintext py-0 font-monospace d-none" id="decreeEventKeyStatic"></div>
                                <?php // Advisory catalog verdict, filled by JS (syncEventKeyHint): whether this key
                                      // already exists in the General Roman Calendar. Never blocks submission —
                                      // a createNew decree mints a key that is *supposed* to be absent. ?>
                                <div class="form-text mt-1" id="decreeEventKeyHint"></div>
                            </div>
                            <div class="col-md-6">
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
                                <?php // On edit, the action is immutable: shown as static text, not an editable select ?>
                                <div class="form-control-plaintext py-0 d-none" id="decreeActionStatic"></div>
                            </div>
                        </div>

                        <!-- Derived decree_id: shown as a hint, submitted via a hidden field -->
                        <div class="mb-3">
                            <div class="form-text mt-0">
                                <?php echo htmlspecialchars(_('Decree ID'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>:
                                <code id="decreeIdHint">—</code>
                                <span class="text-muted">
                                    (<?php echo htmlspecialchars(
                                        _('generated automatically from the event key and action'),
                                        ENT_QUOTES | ENT_SUBSTITUTE,
                                        'UTF-8'
                                    ); ?>)
                                </span>
                            </div>
                            <input type="hidden" id="decreeId" name="decree_id">
                        </div>

                        <!-- ── Decree metadata: date, protocol, since year ── -->
                        <div class="row g-3 mb-3">
                            <div class="col-md-4">
                                <label for="decreeDate" class="form-label">
                                    <?php
                                        /* translators: the date the decree was signed; label for a date field */
                                        echo htmlspecialchars(_('Decree date'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    ?>
                                </label>
                                <input type="date" class="form-control" id="decreeDate" name="decree_date">
                            </div>
                            <div class="col-md-4">
                                <label for="decreeProtocol" class="form-label">
                                    <?php echo htmlspecialchars(_('Protocol'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <input type="text" class="form-control" id="decreeProtocol" name="decree_protocol"
                                    placeholder="Prot. N. 000/25">
                            </div>
                            <div class="col-md-4">
                                <label for="decreeSinceYear" class="form-label">
                                    <?php
                                        /* translators: the year from which the decree takes effect; label for a numeric year field */
                                        echo htmlspecialchars(_('Since year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    ?>
                                </label>
                                <input type="number" class="form-control" id="decreeSinceYear" name="since_year"
                                    min="1970" max="9999">
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="decreeDescription" class="form-label">
                                <?php echo htmlspecialchars(_('Description'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </label>
                            <textarea class="form-control" id="decreeDescription" name="description"
                                rows="2"></textarea>
                        </div>

                        <!-- ── Source URL (below description) ─────────────── -->
                        <div class="mb-3">
                            <label for="decreeUrl" class="form-label">
                                <?php
                                    /* translators: web address of the published decree; label for a URL field */
                                    echo htmlspecialchars(_('Source URL'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?>
                            </label>
                            <input type="url" class="form-control" id="decreeUrl" name="url"
                                placeholder="https://www.vatican.va/…">
                            <div class="form-check form-switch mt-2">
                                <input class="form-check-input" type="checkbox"
                                    id="decreeUrlMultilang" name="url_multilang">
                                <label class="form-check-label" for="decreeUrlMultilang">
                                    <?php echo htmlspecialchars(
                                        _('Source available in multiple languages'),
                                        ENT_QUOTES | ENT_SUBSTITUTE,
                                        'UTF-8'
                                    ); ?>
                                </label>
                            </div>
                        </div>

                        <!-- URL language-code map (revealed by the multilingual switch) -->
                        <fieldset class="border rounded p-3 mb-3 d-none" id="urlLangMapBlock">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php echo htmlspecialchars(_('Language URL codes'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </legend>
                            <div class="form-text mt-0 mb-2">
                                <?php echo htmlspecialchars(
                                    _('Use %s in the URL above where the language code appears; each row maps a language to its Vatican URL code.'),
                                    ENT_QUOTES | ENT_SUBSTITUTE,
                                    'UTF-8'
                                ); ?>
                            </div>
                            <div id="urlLangMapRows"></div>
                            <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="addUrlLangRow">
                                <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Add language code'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </button>

                            <?php // Escape hatch for a language whose document does not fit the URL template at all. ?>
                            <hr class="my-3">
                            <div class="fw-semibold small">
                                <?php echo htmlspecialchars(_('Per-language URL overrides'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </div>
                            <div class="form-text mt-0 mb-2">
                                <?php
                                // Single literal, not a concatenation: xgettext cannot extract a concatenated msgid.
                                $urlOverrideHelp = _('For a language whose document does not follow the pattern above — a different path or filename, not just a different code. Give the full URL.');
                                echo htmlspecialchars($urlOverrideHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?>
                            </div>
                            <div id="urlOverrideRows"></div>
                            <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="addUrlOverrideRow">
                                <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('Add URL override'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                            </button>

                            <div class="mt-3">
                                <div class="fw-semibold small text-muted">
                                    <?php echo htmlspecialchars(_('Preview'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </div>
                                <ul class="small text-muted mb-0 ps-3" id="urlLangMapPreview"></ul>
                            </div>
                        </fieldset>

                        <?php
                        // Datalist of every ISO 639-1 language, labelled in the UI locale.
                        // Source-URL languages are independent of the GRC locale set, so the
                        // editor offers any valid two-letter code, searchable by code or name.
                        $isoLanguages = [];
                        $langBundle   = \ResourceBundle::create('en', 'ICUDATA-lang');
                        if (null !== $langBundle) {
                            $languagesRes = $langBundle->get('Languages');
                            if (null !== $languagesRes) {
                                foreach ($languagesRes as $isoCode => $ignored) {
                                    $isoCode = (string) $isoCode;
                                    if (2 === strlen($isoCode) && ctype_alpha($isoCode)) {
                                        $isoLanguages[$isoCode] = \Locale::getDisplayLanguage($isoCode, $i18n->LOCALE);
                                    }
                                }
                            }
                        }
                        asort($isoLanguages, SORT_LOCALE_STRING);
                        ?>
                        <datalist id="isoLangDatalist">
                            <?php foreach ($isoLanguages as $isoCode => $displayName) : ?>
                                <option value="<?php echo htmlspecialchars($isoCode, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"><?php
                                    echo htmlspecialchars($displayName . ' (' . $isoCode . ')', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?></option>
                            <?php endforeach; ?>
                        </datalist>

                        <?php // Per-language Vatican-code datalists (#urlCodes-{iso}), filled by JS from
                              // the current decrees' url_lang_map values (see rebuildUrlCodeDatalists). ?>
                        <div id="urlCodeDatalists" hidden></div>

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
                                    <?php // Defaults to 1, matching the month select's January: a fixed date always needs both. ?>
                                    <input type="number" class="form-control" id="eventDay" name="day"
                                        min="1" max="31" value="1">
                                </div>
                                <div class="col-md-3">
                                    <label for="eventMonth" class="form-label">
                                        <?php echo htmlspecialchars(_('Month'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </label>
                                    <select class="form-select" id="eventMonth" name="month">
                                        <?php echo $formControls->getMonthOptionsHtml(1); ?>
                                    </select>
                                </div>
                            </div>

                            <!-- Mobile date input -->
                            <?php
                            // Localized weekday labels (English value, label in the UI locale). Reference
                            // dates in the first week of Jan 2024: 2024-01-07 is a Sunday, 01-01 a Monday, etc.
                            $weekdayRefs = [
                                'Sunday'    => '2024-01-07',
                                'Monday'    => '2024-01-01',
                                'Tuesday'   => '2024-01-02',
                                'Wednesday' => '2024-01-03',
                                'Thursday'  => '2024-01-04',
                                'Friday'    => '2024-01-05',
                                'Saturday'  => '2024-01-06',
                            ];
                            $weekdayFmt  = new \IntlDateFormatter(
                                $i18n->LOCALE,
                                \IntlDateFormatter::FULL,
                                \IntlDateFormatter::NONE,
                                null,
                                null,
                                'EEEE'
                            );
                            ?>
                            <div class="mb-3 d-none" id="mobileDateInput">
                                <label class="form-label">
                                    <?php echo htmlspecialchars(_('Relative date'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <div class="row g-2 align-items-center">
                                    <div class="col-md-4">
                                        <select class="form-select" id="eventStrtotimeDow" name="strtotime_day_of_the_week">
                                            <?php foreach ($weekdayRefs as $dow => $refDate) :
                                                $label = $weekdayFmt->format(new \DateTime($refDate)) ?: $dow;
                                                ?>
                                                <option value="<?php echo htmlspecialchars($dow, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"><?php
                                                    echo htmlspecialchars(ucfirst((string) $label), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                                ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <select class="form-select" id="eventStrtotimeRel" name="strtotime_relative_time">
                                            <option value="before"><?php echo htmlspecialchars(_('before'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                            <option value="after"><?php echo htmlspecialchars(_('after'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                                        </select>
                                    </div>
                                    <div class="col-md-5">
                                        <input type="text" class="form-control" id="eventStrtotimeEventKey"
                                            name="strtotime_event_key" list="grcEventKeysDatalist"
                                            autocomplete="off" placeholder="Pentecost">
                                    </div>
                                </div>
                                <div class="form-text">
                                    <?php echo htmlspecialchars(
                                        _('A day of the week relative to a liturgical event, e.g. "Monday after Pentecost".'),
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
                                        <?php echo $formControls->getGradeOptionsHtml(\LiturgicalCalendar\Frontend\LitGrade::MEMORIAL_OPT); ?>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label for="eventColor" class="form-label">
                                        <?php echo htmlspecialchars(_('Color(s)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                    </label>
                                    <?php // Enhanced into a bootstrap-multiselect by admin-decrees.js (same widget as the diocesan calendar form). ?>
                                    <select class="form-select litEventColor" id="eventColor" name="color" multiple="multiple" size="1">
                                        <?php echo $formControls->getColorOptionsHtml([\LiturgicalCalendar\Frontend\LitColor::WHITE]); ?>
                                    </select>
                                </div>
                            </div>
                        </fieldset>

                        <!-- ── common block (createNew + makeDoctor) ─────── -->
                        <fieldset class="border rounded p-3 mb-3 action-block needs-common d-none">
                            <legend class="float-none w-auto px-2 fs-6 fw-semibold">
                                <?php
                                    /* translators: the liturgical Common (Commune sanctorum) a celebration is taken from - e.g. Pastors,
                                       Martyrs, Doctors. NOT "common" meaning ordinary or generic */
                                    echo htmlspecialchars(_('Common(s)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                ?>
                            </legend>
                            <div class="col-md-6">
                                <label for="eventCommon" class="form-label">
                                    <?php echo htmlspecialchars(_('Common (or Proper)'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                                </label>
                                <?php // Enhanced into a bootstrap-multiselect by admin-decrees.js (same widget as the diocesan calendar form). ?>
                                <select class="form-select litEventCommon" id="eventCommon" name="common" multiple="multiple" size="1">
                                    <?php echo $formControls->getCommonsOptionsHtml([\LiturgicalCalendar\Frontend\LitCommon::PROPRIO]); ?>
                                </select>
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
                                    <?php echo $formControls->getGradeOptionsHtml(\LiturgicalCalendar\Frontend\LitGrade::MEMORIAL); ?>
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

                            <?php // Filled by admin-decrees.js: which shape the selected grade calls for. ?>
                            <div class="form-text mb-3" id="readingsShapeHint"></div>

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
                secondReading:     <?php echo json_encode(_('Second reading'), JSON_HEX_TAG); ?>,
                <?php // Shown under the readings legend; the shape follows the selected grade. ?>
                readingsShapeFerial:  <?php echo json_encode(
                    _('Feast and below take the ferial readings: first reading, responsorial psalm, gospel acclamation and gospel.'),
                    JSON_HEX_TAG
                ); ?>,
                readingsShapeFestive: <?php echo json_encode(
                    _('Feast of the Lord and above take the festive readings, which also require a second reading.'),
                    JSON_HEX_TAG
                ); ?>,
                gospelAcclamation: <?php echo json_encode(_('Gospel acclamation'), JSON_HEX_TAG); ?>,
                gospel:            <?php echo json_encode(_('Gospel'), JSON_HEX_TAG); ?>,
                noReadings:        <?php echo json_encode(_('No readings defined for this locale yet'), JSON_HEX_TAG); ?>,
                langCodeVatican:   <?php echo json_encode(_('Vatican URL code (e.g. ge, sp, po)'), JSON_HEX_TAG); ?>,
                overrideUrl:       <?php echo json_encode(_('Full URL for this language'), JSON_HEX_TAG); ?>,
                <?php // Marks a preview row that comes from an override rather than the pattern ?>
                overrideBadge:     <?php echo json_encode(_('override'), JSON_HEX_TAG); ?>,
                <?php // %s is the duplicated ISO 639-1 language code ?>
                duplicateOverride: <?php echo json_encode(_('Duplicate language code "%s" in the URL overrides — each language may be overridden only once'), JSON_HEX_TAG); ?>,
                <?php // %s is the duplicated ISO 639-1 language code ?>
                duplicateLangCode: <?php echo json_encode(_('Duplicate language code "%s" in the source URL languages — each language may appear only once'), JSON_HEX_TAG); ?>,
                validationErrors:  <?php echo json_encode(_('Please fix the following errors before saving:'), JSON_HEX_TAG); ?>,
                sinceYear:         <?php echo json_encode(_('Since %s'), JSON_HEX_TAG); ?>,
                sourceLink:        <?php echo json_encode(_('Source'), JSON_HEX_TAG); ?>,
                sessionExpired:    <?php echo json_encode(_('Your session has expired. Please log in again.'), JSON_HEX_TAG); ?>,
                loginLink:         <?php echo json_encode(_('Log in'), JSON_HEX_TAG); ?>,
                permissionDenied:  <?php echo json_encode(_('You do not have permission to perform this action.'), JSON_HEX_TAG); ?>,
                eventKeyNew:       <?php echo json_encode(_('Not in the General Roman Calendar — a new event will be created.'), JSON_HEX_TAG); ?>,
                <?php // %s is the localized name of the existing General Roman Calendar event ?>
                eventKeyCollision: <?php echo json_encode(_('Already in the General Roman Calendar as "%s" — choose a different event key.'), JSON_HEX_TAG); ?>,
                eventKeyMissing:   <?php echo json_encode(_('Not in the General Roman Calendar — this decree will not match any event.'), JSON_HEX_TAG); ?>,
                <?php // %s is the localized name of the matched General Roman Calendar event ?>
                eventKeyMatch:     <?php echo json_encode(_('Matches "%s" in the General Roman Calendar.'), JSON_HEX_TAG); ?>,
                <?php // Distinct from noDecrees: an empty list caused by the filters, not by the API ?>
                noDecreesMatch:    <?php echo json_encode(_('No decrees match the current search and filters.'), JSON_HEX_TAG); ?>,
                editAriaLabel:     <?php echo json_encode(_('Edit'), JSON_HEX_TAG); ?>,
                deleteAriaLabel:   <?php echo json_encode(_('Delete'), JSON_HEX_TAG); ?>,
                errorText:         <?php echo json_encode(_('(error)'), JSON_HEX_TAG); ?>,
                gradeLabels: {
                                        7: <?php
                        /* translators: liturgical grade 7 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Higher Solemnity'), JSON_HEX_TAG);
                    ?>,
                                        6: <?php
                        /* translators: liturgical grade 6 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Solemnity'), JSON_HEX_TAG);
                    ?>,
                                        5: <?php
                        /* translators: liturgical grade 5 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Feast of the Lord'), JSON_HEX_TAG);
                    ?>,
                                        4: <?php
                        /* translators: liturgical grade 4 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Feast'), JSON_HEX_TAG);
                    ?>,
                                        3: <?php
                        /* translators: liturgical grade 3 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Memorial'), JSON_HEX_TAG);
                    ?>,
                                        2: <?php
                        /* translators: liturgical grade 2 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Optional Memorial'), JSON_HEX_TAG);
                    ?>,
                                        1: <?php
                        /* translators: liturgical grade 1 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Commemoration'), JSON_HEX_TAG);
                    ?>,
                                        0: <?php
                        /* translators: liturgical grade 0 of 7. These eight labels form a strict precedence ladder; each must be rendered
                           distinctly and none may reuse another rank's word. Machine translation has shifted this whole ladder
                           by one rank before */
                                        echo json_encode(_('Weekday'), JSON_HEX_TAG);
                    ?>
                }
            }
        };
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
</html>
