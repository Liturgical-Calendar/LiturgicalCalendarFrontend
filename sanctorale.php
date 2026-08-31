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
 * Read-only for now. The write routes exist (`PUT|PATCH|DELETE
 * /missals/{missal_id}/{event_key}`, API #943) and editing lands separately.
 *
 * See docs/superpowers/specs/2026-08-31-sanctorale-editor-design.md.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

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

    <div class="row g-3 mb-3">
        <div class="col-md-3">
            <label class="form-label" for="riteSelect"><?php echo htmlspecialchars(_('Rite'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <select class="form-select" id="riteSelect">
                <option value="roman"><?php echo htmlspecialchars(_('Roman'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
                <option value="ambrosian"><?php echo htmlspecialchars(_('Ambrosian'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></option>
            </select>
        </div>
        <div class="col-md-3">
            <label class="form-label" for="calendarSelect"><?php echo htmlspecialchars(_('Calendar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <select class="form-select" id="calendarSelect"></select>
        </div>
        <div class="col-md-6">
            <label class="form-label" for="sanctoraleSearch"><?php echo htmlspecialchars(_('Search all months'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></label>
            <input type="search" class="form-control" id="sanctoraleSearch"
                   placeholder="<?php echo htmlspecialchars(_('Name or event key…'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
        </div>
    </div>

    <div id="sanctoraleNotice"></div>

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
            </div>
        </div>
    </div>

    <?php include_once('./layout/footer.php'); ?>

    <?php
    $riteUnavailable = _('The API does not yet expose a sanctorale for this rite, so nothing can be shown here. '
        . 'The data exists; only the route is missing.');
    ?>
    <!-- Config for JavaScript (assets/js/sanctorale.js, auto-loaded by layout/footer.php) -->
    <script>
        window.SanctoraleConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl, JSON_HEX_TAG); ?>,
            <?php // BCP-47 (en-US), not gettext/ICU (en_US): Intl.DateTimeFormat rejects underscore tags. ?>
            locale: <?php echo json_encode(str_replace('_', '-', $i18n->LOCALE), JSON_HEX_TAG); ?>,
            i18n: {
                loading:            <?php echo json_encode(_('Loading…'), JSON_HEX_TAG); ?>,
                view:               <?php echo json_encode(_('Details'), JSON_HEX_TAG); ?>,
                generalRoman:       <?php echo json_encode(_('General Roman Calendar'), JSON_HEX_TAG); ?>,
                structure:          <?php echo json_encode(_('Celebration'), JSON_HEX_TAG); ?>,
                names:              <?php echo json_encode(_('Names by locale'), JSON_HEX_TAG); ?>,
                readings:           <?php echo json_encode(_('Lectionary readings'), JSON_HEX_TAG); ?>,
                date:               <?php echo json_encode(_('Date'), JSON_HEX_TAG); ?>,
                grade:              <?php echo json_encode(_('Grade'), JSON_HEX_TAG); ?>,
                calendarField:      <?php echo json_encode(_('Calendar'), JSON_HEX_TAG); ?>,
                color:              <?php echo json_encode(_('Colour'), JSON_HEX_TAG); ?>,
                common:             <?php echo json_encode(_('Common'), JSON_HEX_TAG); ?>,
                fromMissal:         <?php echo json_encode(_('From this Missal'), JSON_HEX_TAG); ?>,
                overrides:          <?php echo json_encode(_('override'), JSON_HEX_TAG); ?>,
                overridesTitle:     <?php echo json_encode(_('This Missal redefines a celebration an earlier one already had.'), JSON_HEX_TAG); ?>,
                <?php // The three locale states are distinct on purpose: a deliberately blank
                      // entry and a missing one are different facts about the data. ?>
                translatedLabel:    <?php echo json_encode(_('translated'), JSON_HEX_TAG); ?>,
                emptyLabel:         <?php echo json_encode(_('blank'), JSON_HEX_TAG); ?>,
                missingLabel:       <?php echo json_encode(_('missing'), JSON_HEX_TAG); ?>,
                noEntries:          <?php echo json_encode(_('Nothing here.'), JSON_HEX_TAG); ?>,
                noSearchHits:       <?php echo json_encode(_('No celebration in this month matches your search.'), JSON_HEX_TAG); ?>,
                noLectionary:       <?php echo json_encode(_('No sanctorale lectionary is defined for this rite.'), JSON_HEX_TAG); ?>,
                namesUnavailable:   <?php echo json_encode(_('Could not load the names for this celebration.'), JSON_HEX_TAG); ?>,
                readingsUnavailable: <?php echo json_encode(_('Could not load the readings for this celebration.'), JSON_HEX_TAG); ?>,
                riteUnavailable:    <?php echo json_encode($riteUnavailable, JSON_HEX_TAG); ?>,
                <?php // translators: %s is the error reported by the API ?>
                loadFailed:         <?php echo json_encode(_('Could not load the sanctorale: %s'), JSON_HEX_TAG); ?>
            }
        };
    </script>
</body>
</html>
