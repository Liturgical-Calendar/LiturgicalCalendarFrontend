<?php

/**
 * Sanctorale viewer.
 *
 * A Roman Missal file on disk is a DELTA, not a sanctorale: `propriumdesanctis_2008`
 * is a three-row file. The old missals editor presented each one as a flat table,
 * which can only ever show an increment. This page composes the missal layers that
 * apply to a chosen rite and calendar, badges each row with the layer that supplied
 * it, and groups the result by month.
 *
 * The detail modal doubles as the editor, writing back with `PUT|PATCH|DELETE
 * /missals/{rite}/{missal_id}/{event_key}`; the markup for it is the footer below,
 * revealed by assets/js/sanctorale.js only for a Missal the caller may edit.
 *
 * See docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

// Require authentication - redirect to home if not logged in.
// Same gate as temporale.php: the underlying /missals data is public, but this
// page sits in the calendar-role section of the admin sidebar alongside it, and
// an ungated page there would be the odd one out.
if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

// Whether the create button and per-row edit/delete controls are revealed is decided
// client-side against the caller's FGA relations on the specific Missal being edited;
// this flag only distinguishes the global-admin fast path from that check.
$isAdmin = $authHelper->hasRole('admin');

/**
 * The whole `LitCommon` enum from the API's CommonDef.json, in the schema's own order.
 *
 * Every value has to be here. The editor's Common control is a multi-select whose options
 * ARE this list, so a value the list omits cannot render as selected — and would then be
 * dropped from the row the next time anyone saved it. Nothing in the corpus uses the last
 * two today; they are still valid, so they are still offered.
 *
 * @var string[] $litCommons
 */
$litCommons = [
    'Proper',
    'Dedication of a Church',
    'Blessed Virgin Mary',
    'Martyrs',
    'Pastors',
    'Doctors',
    'Virgins',
    'Holy Men and Women',
    'Martyrs:For One Martyr',
    'Martyrs:For Several Martyrs',
    'Martyrs:For Missionary Martyrs',
    'Martyrs:For One Missionary Martyr',
    'Martyrs:For Several Missionary Martyrs',
    'Martyrs:For a Virgin Martyr',
    'Martyrs:For a Holy Woman Martyr',
    'Pastors:For a Pope',
    'Pastors:For a Bishop',
    'Pastors:For One Pastor',
    'Pastors:For Several Pastors',
    'Pastors:For Founders of a Church',
    'Pastors:For One Founder',
    'Pastors:For Several Founders',
    'Pastors:For Missionaries',
    'Virgins:For One Virgin',
    'Virgins:For Several Virgins',
    'Holy Men and Women:For Several Saints',
    'Holy Men and Women:For One Saint',
    'Holy Men and Women:For an Abbot',
    'Holy Men and Women:For a Monk',
    'Holy Men and Women:For a Nun',
    'Holy Men and Women:For Religious',
    'Holy Men and Women:For Those Who Practiced Works of Mercy',
    'Holy Men and Women:For Educators',
    'Holy Men and Women:For Holy Women',
    'For Giving Thanks to God for the Gift of Human Life [USA]',
    'For the Preservation of Peace and Justice'
];

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $pageTitle     = _('Sanctorale');
        $calendarTitle = _('Catholic Liturgical Calendar');
        echo htmlspecialchars($pageTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo ' - ';
        echo htmlspecialchars($calendarTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">
    <?php include_once('./layout/header.php'); ?>

    <h1 class="h3 mb-3 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-book-bible me-2"></i><?php echo htmlspecialchars(_('Sanctorale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted">
        <?php
        $blurb = _('Each Roman Missal contributes only what it adds: the 2008 edition defines three celebrations, not a whole '
            . 'sanctorale. This page composes the editions that apply to the calendar you choose, and shows which one each '
            . 'celebration comes from.');
        echo htmlspecialchars($blurb, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        ?>
    </p>

    <?php // Two rows, and the split is meaningful rather than cosmetic: the first row
          // chooses WHICH sanctorale is composed (each control refetches), the second
          // NARROWS what is already composed (neither issues a request). The previous
          // single row also totalled 13 columns, so the search box wrapped on its own. ?>
    <div class="row g-3 mb-3">
        <div class="col-md-3">
            <label class="form-label" for="riteSelect"><?php echo htmlspecialchars(_('Rite'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <select class="form-select" id="riteSelect">
                <option value="roman"><?php echo htmlspecialchars(_('Roman'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                <option value="ambrosian"><?php echo htmlspecialchars(_('Ambrosian'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
            </select>
        </div>
        <div class="col-md-4">
            <label class="form-label" for="calendarSelect"><?php echo htmlspecialchars(_('Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <select class="form-select" id="calendarSelect"></select>
        </div>
        <div class="col-md-5">
            <label class="form-label" for="localeSelect"><?php echo htmlspecialchars(_('Language'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <select class="form-select" id="localeSelect"></select>
            <div class="form-text"><?php echo htmlspecialchars(_('Languages this calendar is published in.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
        </div>
    </div>

    <div class="row g-3 mb-3">
        <div class="col-md-5">
            <label class="form-label" for="fromSelect"><?php echo htmlspecialchars(_('From'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <select class="form-select" id="fromSelect"></select>
            <div class="form-text"><?php echo htmlspecialchars(_('Show only what one edition contributes.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
        </div>
        <div class="col-md-7">
            <label class="form-label" for="sanctoraleSearch"><?php echo htmlspecialchars(_('Search all months'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <input type="search" class="form-control" id="sanctoraleSearch"
                   placeholder="<?php echo htmlspecialchars(_('Name or event key…'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
            <div class="form-text"><?php echo htmlspecialchars(_('Matches across every month, and moves you to one that has a result.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></div>
        </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-2">
        <div id="sanctoraleNotice" class="flex-grow-1"></div>
        <?php // Hidden by default and revealed only when the user may create in at least one
              // applicable Missal. NOT data-requires-auth: that global handler reveals on
              // ANY authentication, and creating an entry needs an admin grant on a
              // specific Missal — see admin-decrees.php's identical note. Creating is not
              // the same grant as editing: create is PUT, which needs admin, while editing
              // a row is PATCH, which needs only editor. ?>
        <button type="button" class="btn btn-primary btn-sm d-none ms-2" id="newEntryBtn">
            <i class="fas fa-plus me-1"></i><?php echo htmlspecialchars(_('New celebration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
        </button>
    </div>

    <ul class="nav nav-tabs mb-0" id="monthTabs"></ul>

    <div class="card shadow mb-4 border-top-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead class="table-light">
                        <tr>
                            <th scope="col"><?php echo htmlspecialchars(_('Day'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Celebration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Event key'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('From'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col" class="text-end"><?php echo htmlspecialchars(_('Details'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                        </tr>
                    </thead>
                    <tbody id="sanctoraleTableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal fade" id="detailModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="detailModalTitle"></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo htmlspecialchars(_('Close'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></button>
                </div>
                <div class="modal-body" id="detailModalBody"></div>
                <div class="modal-footer d-none" id="detailModalFooter">
                    <div id="entryFormError" class="text-danger small me-auto"></div>
                    <button type="button" class="btn btn-outline-danger d-none" id="deleteEntryBtn">
                        <i class="fas fa-trash me-1"></i><?php echo htmlspecialchars(_('Delete'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <?php echo htmlspecialchars(_('Cancel'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                    <button type="button" class="btn btn-primary" id="saveEntryBtn">
                        <?php echo htmlspecialchars(_('Save'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <!-- Config for JavaScript (assets/js/sanctorale.js, auto-loaded by layout/footer.php) -->
    <script>
        window.SanctoraleConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl, JSON_HEX_TAG); ?>,
            <?php // BCP-47 (en-US), not gettext/ICU (en_US): Intl.DateTimeFormat rejects underscore tags. ?>
            locale: <?php echo json_encode(str_replace('_', '-', $i18n->LOCALE), JSON_HEX_TAG); ?>,
            isGlobalAdmin: <?php echo json_encode($isAdmin, JSON_HEX_TAG); ?>,
            userSub:       <?php echo json_encode($authHelper->sub ?? '', JSON_HEX_TAG); ?>,
            <?php // The whole `LitCommon` enum — see $litCommons above for why it must be whole. ?>
            commons: <?php echo json_encode($litCommons, JSON_HEX_TAG); ?>,
            i18n: {
                loading:            <?php echo json_encode(_('Loading…'), JSON_HEX_TAG); ?>,
                view:               <?php echo json_encode(_('Details'), JSON_HEX_TAG); ?>,
                generalRoman:       <?php echo json_encode(_('General Roman Calendar'), JSON_HEX_TAG); ?>,
                structure:          <?php echo json_encode(_('Celebration'), JSON_HEX_TAG); ?>,
                names:              <?php echo json_encode(_('Names by locale'), JSON_HEX_TAG); ?>,
                readings:           <?php echo json_encode(_('Lectionary readings'), JSON_HEX_TAG); ?>,
                readingsShape:      <?php echo json_encode(_('Readings structure'), JSON_HEX_TAG); ?>,
                readingsFromCommon: <?php echo json_encode(_('From the Common'), JSON_HEX_TAG); ?>,
                readingsNoneYet:    <?php echo json_encode(_('No readings are curated for this celebration yet. Fill in what you know; blank citations are not saved.'), JSON_HEX_TAG); ?>,
                <?php // The readings shapes `SourceReadings` admits, keyed by their
                      // definition name in the API's CommonDef.json. The page RESOLVES the
                      // shapes themselves from the schema at runtime rather than listing
                      // them — these are only the translations of their titles, and a
                      // shape with no entry here falls back to the schema's own English
                      // title, so adding one upstream does not break this page. ?>
                readings_shapes: {
                    'ReadingsFerial':             <?php echo json_encode(_('Ferial Readings'), JSON_HEX_TAG); ?>,
                    'ReadingsFestive':            <?php echo json_encode(_('Festive Readings'), JSON_HEX_TAG); ?>,
                    'ReadingsPalmSunday':         <?php echo json_encode(_('Palm Sunday Readings'), JSON_HEX_TAG); ?>,
                    'ReadingsEasterVigil':        <?php echo json_encode(_('Easter Vigil Readings'), JSON_HEX_TAG); ?>,
                    'ReadingsChristmas':          <?php echo json_encode(_('Christmas Readings'), JSON_HEX_TAG); ?>,
                    'ReadingsWithEvening':        <?php echo json_encode(_('Readings with Evening Mass'), JSON_HEX_TAG); ?>,
                    'ReadingsMultipleSchemas':    <?php echo json_encode(_('Readings with Multiple Schemas'), JSON_HEX_TAG); ?>,
                    'ReadingsCommons':            <?php echo json_encode(_('Readings from liturgical Commons'), JSON_HEX_TAG); ?>,
                    'ReadingsSeasonal':           <?php echo json_encode(_('Seasonal Readings'), JSON_HEX_TAG); ?>,
                    'ReadingsWithVigil':          <?php echo json_encode(_('Readings with a Vigil Mass'), JSON_HEX_TAG); ?>,
                    'ReadingsChristmasWithVigil': <?php echo json_encode(_('Christmas Readings with a Vigil Mass'), JSON_HEX_TAG); ?>
                },
                <?php // Reading names, keyed as ReadingsRenderer.readingLabels keys them. The
                      // ORDER and the VOCABULARY are read from the renderer itself (exported
                      // in liturgy-components-js 2.10.0, issue #97); only the translations
                      // live here, and a key with no entry falls back to the renderer's
                      // English rather than showing the bare key. ?>
                readings_labels: {
                    'palm_gospel':               <?php echo json_encode(_('Gospel at the Procession'), JSON_HEX_TAG); ?>,
                    'first_reading':             <?php echo json_encode(_('First Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm':        <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'second_reading':            <?php echo json_encode(_('Second Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_2':      <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'third_reading':             <?php echo json_encode(_('Third Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_3':      <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'fourth_reading':            <?php echo json_encode(_('Fourth Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_4':      <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'fifth_reading':             <?php echo json_encode(_('Fifth Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_5':      <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'sixth_reading':             <?php echo json_encode(_('Sixth Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_6':      <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'seventh_reading':           <?php echo json_encode(_('Seventh Reading'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_7':      <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'epistle':                   <?php echo json_encode(_('Epistle'), JSON_HEX_TAG); ?>,
                    'responsorial_psalm_epistle': <?php echo json_encode(_('Responsorial Psalm'), JSON_HEX_TAG); ?>,
                    'gospel_acclamation':        <?php echo json_encode(_('Gospel Acclamation'), JSON_HEX_TAG); ?>,
                    'gospel':                    <?php echo json_encode(_('Gospel'), JSON_HEX_TAG); ?>
                },
                <?php // Some celebrations carry several sets of readings rather than one: a
                      // Vigil and a Day Mass, or numbered schemata. The keys and their order
                      // are read from ReadingsRenderer.massLabels in liturgy-components-js;
                      // these are the translations of its labels. ?>
                schemas: {
                    'vigil':                 <?php echo json_encode(_('Vigil Mass'), JSON_HEX_TAG); ?>,
                    'night':                 <?php echo json_encode(_('Mass during the Night'), JSON_HEX_TAG); ?>,
                    'dawn':                  <?php echo json_encode(_('Mass at Dawn'), JSON_HEX_TAG); ?>,
                    'day':                   <?php echo json_encode(_('Mass during the Day'), JSON_HEX_TAG); ?>,
                    'evening':               <?php echo json_encode(_('Evening Mass'), JSON_HEX_TAG); ?>,
                    'schema_one':            <?php echo json_encode(_('Schema I'), JSON_HEX_TAG); ?>,
                    'schema_two':            <?php echo json_encode(_('Schema II'), JSON_HEX_TAG); ?>,
                    'schema_three':          <?php echo json_encode(_('Schema III'), JSON_HEX_TAG); ?>,
                    'easter_season':         <?php echo json_encode(_('Easter Season'), JSON_HEX_TAG); ?>,
                    'outside_easter_season': <?php echo json_encode(_('Outside Easter Season'), JSON_HEX_TAG); ?>
                },
                date:               <?php echo json_encode(_('Date'), JSON_HEX_TAG); ?>,
                grade:              <?php echo json_encode(_('Grade'), JSON_HEX_TAG); ?>,
                <?php // Shown only when the data overrides the rank label, e.g. US_2011
                      // presents Independence Day as "National Holiday". ?>
                displaysAs:         <?php echo json_encode(_('Displays as'), JSON_HEX_TAG); ?>,
                <?php // An override of '' is authored, not missing: it means the rank is
                      // deliberately not displayed. AllSouls is the standing example. ?>
                displaysAsNothing:  <?php echo json_encode(_('no rank shown'), JSON_HEX_TAG); ?>,
                <?php // Liturgical ranks, keyed by the integer the data carries. The rows give a
                      // bare `grade` and no `grade_lcl`, so the names are translated here. ?>
                grades: {
                    '0': <?php echo json_encode(_('Weekday'), JSON_HEX_TAG); ?>,
                    '1': <?php echo json_encode(_('Commemoration'), JSON_HEX_TAG); ?>,
                    '2': <?php echo json_encode(_('Optional memorial'), JSON_HEX_TAG); ?>,
                    '3': <?php echo json_encode(_('Memorial'), JSON_HEX_TAG); ?>,
                    '4': <?php echo json_encode(_('Feast'), JSON_HEX_TAG); ?>,
                    '5': <?php echo json_encode(_('Feast of the Lord'), JSON_HEX_TAG); ?>,
                    '6': <?php echo json_encode(_('Solemnity'), JSON_HEX_TAG); ?>,
                    '7': <?php echo json_encode(_('Higher solemnity'), JSON_HEX_TAG); ?>
                },
                calendarField:      <?php echo json_encode(_('Calendar'), JSON_HEX_TAG); ?>,
                color:              <?php echo json_encode(_('Colour'), JSON_HEX_TAG); ?>,
                common:             <?php echo json_encode(_('Common'), JSON_HEX_TAG); ?>,
                fromMissal:         <?php echo json_encode(_('From this Missal'), JSON_HEX_TAG); ?>,
                allMissals:         <?php echo json_encode(_('All editions'), JSON_HEX_TAG); ?>,
                overrides:          <?php echo json_encode(_('override'), JSON_HEX_TAG); ?>,
                overridesTitle:     <?php echo json_encode(_('This Missal redefines a celebration an earlier one already had.'), JSON_HEX_TAG); ?>,
                <?php // The redeclaration panel. Naming the relationship, not just the
                      // fact of it: a later edition that CHANGES a property and one that
                      // merely takes a particular celebration universal are different
                      // acts, and the page used to present them identically. ?>
                redeclarations:     <?php echo json_encode(_('Redeclared by'), JSON_HEX_TAG); ?>,
                redeclarationUniversal: <?php echo json_encode(
                    _('Takes the celebration universal at the same rank; the earlier particular entry is now redundant.'),
                    JSON_HEX_TAG
                ); ?>,
                redeclarationNoChange: <?php echo json_encode(_('Redeclares the celebration without changing anything.'), JSON_HEX_TAG); ?>,
                <?php // Distinct from `displaysAsNothing`: that means an override of '',
                      // which deliberately shows no rank. This means no override at all. ?>
                displaysAsNothingSet: <?php echo json_encode(_('no override'), JSON_HEX_TAG); ?>,
                <?php // The three locale states are distinct on purpose: a deliberately blank
                      // entry and a missing one are different facts about the data. ?>
                translatedLabel:    <?php echo json_encode(_('translated'), JSON_HEX_TAG); ?>,
                emptyLabel:         <?php echo json_encode(_('blank'), JSON_HEX_TAG); ?>,
                missingLabel:       <?php echo json_encode(_('missing'), JSON_HEX_TAG); ?>,
                noEntries:          <?php echo json_encode(_('Nothing here.'), JSON_HEX_TAG); ?>,
                noSearchHits:       <?php echo json_encode(_('No celebration in this month matches your search.'), JSON_HEX_TAG); ?>,
                noLectionary:       <?php echo json_encode(_('No sanctorale lectionary is defined for this rite.'), JSON_HEX_TAG); ?>,
                <?php // Distinct from a failed request: the API answers 404 for a celebration
                      // whose readings simply have not been curated yet. ?>
                noReadingsForEvent: <?php echo json_encode(_('No readings are curated for this celebration yet.'), JSON_HEX_TAG); ?>,
                namesUnavailable:   <?php echo json_encode(_('Could not load the names for this celebration.'), JSON_HEX_TAG); ?>,
                readingsUnavailable: <?php echo json_encode(_('Could not load the readings for this celebration.'), JSON_HEX_TAG); ?>,
                ambrosianCalendar:  <?php echo json_encode(_('Ambrosian Rite'), JSON_HEX_TAG); ?>,
                noMissals:          <?php echo json_encode(_('No Missal is published for this combination of rite and calendar.'), JSON_HEX_TAG); ?>,
                edit:               <?php echo json_encode(_('Edit'), JSON_HEX_TAG); ?>,
                save:               <?php echo json_encode(_('Save'), JSON_HEX_TAG); ?>,
                cancel:             <?php echo json_encode(_('Cancel'), JSON_HEX_TAG); ?>,
                deleteLabel:        <?php echo json_encode(_('Delete'), JSON_HEX_TAG); ?>,
                newEntry:           <?php echo json_encode(_('New celebration'), JSON_HEX_TAG); ?>,
                targetMissal:       <?php echo json_encode(_('Add to Missal'), JSON_HEX_TAG); ?>,
                eventKeyLabel:      <?php echo json_encode(_('Event key'), JSON_HEX_TAG); ?>,
                <?php // The key ties the structure row to its name and readings in every locale,
                      // so the API refuses to rename one: it would orphan all of them.
                      // The rule described here is the `EventKey` pattern from the API's own
                      // CommonDef.json schema, shared with the input's `pattern=` attribute
                      // through EVENT_KEY_PATTERN in assets/js/sanctorale-payload.js. Keep the
                      // wording in step with that constant. ?>
                eventKeyHint:       <?php echo json_encode(_(
                    'Begins with a capital, then letters and digits (StIsidoreFarmer). A trailing number (StPaul_2) or _vigil is allowed, as is a lowercase two-word prefix. Cannot be renamed.'
                ), JSON_HEX_TAG); ?>,
                invalidDay:         <?php echo json_encode(_('Enter a day between 1 and 31.'), JSON_HEX_TAG); ?>,
                <?php // A <select> with no placeholder always yields a value, so an untouched
                      // month lands on January and an untouched grade on 0 (Weekday) — both
                      // present, both wrong, and neither catchable by a presence check. The
                      // create form gets a disabled placeholder instead, and these two say so. ?>
                choosePrompt:       <?php echo json_encode(_('Choose…'), JSON_HEX_TAG); ?>,
                chooseMonth:        <?php echo json_encode(_('Choose a month.'), JSON_HEX_TAG); ?>,
                chooseGrade:        <?php echo json_encode(_('Choose a grade.'), JSON_HEX_TAG); ?>,
                <?php // translators: %1$s is the event key, %2$s is the Missal id ?>
                confirmDelete:      <?php echo json_encode(_('Delete %1$s from %2$s? Its name and readings go with it, and any earlier edition that already defined it takes over.'), JSON_HEX_TAG); ?>,
                <?php // The rite-level corpus is shared by every Missal of the rite, so this
                      // edit is not confined to the edition being edited. ?>
                readingsShared:     <?php echo json_encode(_('These readings live in the rite-wide lectionary, shared by every Missal of this rite.'), JSON_HEX_TAG); ?>,
                readingsNotWritable: <?php echo json_encode(_('This rite has no lectionary, so readings cannot be edited here.'), JSON_HEX_TAG); ?>,
                <?php // A response can carry a tier the Missal being edited does NOT own — e.g.
                      // another national Missal's own lectionary entry for the same event_key.
                      // MissalsHandler::resolveSanctoraleTarget() writes to exactly one tier per
                      // Missal, so every other tier shown here is display-only: offering an input
                      // for it would let a curator "edit" a citation that either silently lands in
                      // a different file (a shared locale key) or gets rejected outright (a locale
                      // the write target does not carry). ?>
                readingsInherited:  <?php echo json_encode(_('Inherited from a different lectionary source; edit it there, not from this Missal.'), JSON_HEX_TAG); ?>,
                <?php // Reported after a delete when another Missal still declares the key, so
                      // the readings deliberately survived. Silence here reads as a bug. ?>
                readingsRetained:   <?php echo json_encode(_('The readings were kept: another Missal still declares this celebration.'), JSON_HEX_TAG); ?>,
                gradeDisplayDefault: <?php echo json_encode(_('Default (from grade)'), JSON_HEX_TAG); ?>,
                gradeDisplayNone:   <?php echo json_encode(_('Show no rank'), JSON_HEX_TAG); ?>,
                gradeDisplayCustom: <?php echo json_encode(_('Custom text…'), JSON_HEX_TAG); ?>,
                noChanges:          <?php echo json_encode(_('Nothing has changed.'), JSON_HEX_TAG); ?>,
                saved:              <?php echo json_encode(_('Saved.'), JSON_HEX_TAG); ?>,
                created:            <?php echo json_encode(_('Celebration created.'), JSON_HEX_TAG); ?>,
                deleted:            <?php echo json_encode(_('Celebration deleted.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the error reported by the API ?>
                saveFailed:         <?php echo json_encode(_('Could not save: %s'), JSON_HEX_TAG); ?>,
                permissionDenied:   <?php echo json_encode(_('You do not have permission to change this Missal.'), JSON_HEX_TAG); ?>,
                conflictTitle:      <?php echo json_encode(_('This clashes with another Missal'), JSON_HEX_TAG); ?>,
                <?php // The four strings describeWriteOutcome() needs; each takes one %s.
                      // A write is not necessarily applied to disk: with
                      // SOURCEDATA_CHANGE_REQUESTS enabled it is queued for review and the
                      // API answers the SAME 2xx. See assets/js/writeDisposition.js. ?>
                <?php // translators: %s is the change request batch id ?>
                writeSubmitted:     <?php echo json_encode(_('Queued for review as batch %s. Nothing has been written yet.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the change request batch id ?>
                writeApproved:      <?php echo json_encode(_('Approved as batch %s, awaiting publication.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is a comma-separated list of batch ids ?>
                writeSuperseded:    <?php echo json_encode(_('Earlier batches folded in: %s.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the unrecognized disposition value ?>
                writeUnknown:       <?php echo json_encode(_('The server reported an unrecognized outcome (%s); nothing local was changed.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the error reported by the API ?>
                loadFailed:         <?php echo json_encode(_('Could not load the sanctorale: %s'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the event_key a #event= link named
                      // Reported rather than left silent: the link may be stale, mistyped, or
                      // for a rite/calendar this page has since moved away from. ?>
                eventNotFound:      <?php echo json_encode(_('%s is not in the current selection.'), JSON_HEX_TAG); ?>
            }
        };
    </script>
</body>
</html>
