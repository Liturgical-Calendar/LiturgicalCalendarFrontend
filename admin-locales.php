<?php

/**
 * Supported Locales
 *
 * Shows which locales the API declares officially supported, and whether each
 * candidate locale has the resources required to be promoted.
 *
 * Promotion is a governance decision about the API's published contract: it flips
 * missing data from a quiet degradation into a hard failure. So this page is
 * global-admin only.
 *
 * Curation became writable with API #926. What a write MEANS depends on the
 * deployment, and the API says which in `curation.mode`: `change_request` records
 * a reviewable request, `disk` edits the file that the next deploy may overwrite,
 * and `misconfigured` refuses. The notice renders the API's own `reason` verbatim
 * in all three, so this page cannot drift from the server's account.
 */

include_once 'includes/common.php';
include_once 'includes/messages.php';

if (!$authHelper->isAuthenticated) {
    header('Location: index.php');
    exit;
}

if (!$authHelper->hasRole('admin')) {
    header('Location: admin-dashboard.php');
    exit;
}

?>
<!doctype html>
<html lang="<?php echo htmlspecialchars($i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
<head>
    <title><?php
        $pageTitle     = _('Supported Locales');
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
        <i class="fas fa-language me-2"></i><?php echo htmlspecialchars(_('Supported Locales'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h1>

    <p class="text-muted">
        <?php
        $localesBlurb = _('An officially supported locale promises complete data. Missing data for one is treated as an error, '
            . 'while a locale outside the list degrades quietly. Promoting a locale therefore tightens enforcement, '
            . 'and may only be done once every check below passes.');
        echo htmlspecialchars($localesBlurb, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        ?>
    </p>

    <div id="curationNotice"></div>

    <div class="card shadow mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="fas fa-list me-2"></i><?php echo htmlspecialchars(_('Candidate locales'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
            <button type="button" id="refreshBtn" class="btn btn-sm btn-outline-secondary">
                <i class="fas fa-sync-alt me-1"></i><?php echo htmlspecialchars(_('Refresh'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </button>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead class="table-light">
                        <tr>
                            <th scope="col"><?php echo htmlspecialchars(_('Locale'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Status'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Readiness'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                            <th scope="col"><?php echo htmlspecialchars(_('Details'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></th>
                        </tr>
                    </thead>
                    <tbody id="localesTableBody"></tbody>
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

    <!-- Config for JavaScript (assets/js/admin-locales.js, auto-loaded by layout/footer.php) -->
    <script>
        window.AdminLocalesConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl, JSON_HEX_TAG); ?>,
            i18n: {
                official:         <?php echo json_encode(_('Official'), JSON_HEX_TAG); ?>,
                candidate:        <?php echo json_encode(_('Candidate'), JSON_HEX_TAG); ?>,
                ready:            <?php echo json_encode(_('Ready'), JSON_HEX_TAG); ?>,
                notReady:         <?php echo json_encode(_('Not ready'), JSON_HEX_TAG); ?>,
                view:             <?php echo json_encode(_('View checks'), JSON_HEX_TAG); ?>,
                loading:          <?php echo json_encode(_('Loading…'), JSON_HEX_TAG); ?>,
                working:          <?php echo json_encode(_('Working…'), JSON_HEX_TAG); ?>,
                loadFailed:       <?php echo json_encode(_('Could not load locales: %s'), JSON_HEX_TAG); ?>,
                missing:          <?php echo json_encode(_('Missing:'), JSON_HEX_TAG); ?>,
                advisory:         <?php echo json_encode(_('Advisory — reported, but does not block promotion'), JSON_HEX_TAG); ?>,
                promote:          <?php echo json_encode(_('Promote'), JSON_HEX_TAG); ?>,
                demote:           <?php echo json_encode(_('Demote'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is a locale tag such as "fr_FR" ?>
                promoted:         <?php echo json_encode(_('Locale %s is now officially supported.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is a locale tag such as "fr_FR" ?>
                demoted:          <?php echo json_encode(_('Locale %s is no longer officially supported.'), JSON_HEX_TAG); ?>,
                <?php // translators: %s is the error reported by the API ?>
                actionFailed:     <?php echo json_encode(_('Could not change this locale: %s'), JSON_HEX_TAG); ?>,
                notReadyHint:     <?php echo json_encode(_('This locale is not ready to be promoted. Open “View checks” to see what is missing.'), JSON_HEX_TAG); ?>,
                lastOfficialHint: <?php echo json_encode(_('This is the only officially supported locale, and the list may not be emptied. Promote a replacement first.'), JSON_HEX_TAG); ?>,
                <?php // Labels for the three curation modes the API reports. The prose after
                      // each is the API's own `reason`, rendered verbatim. ?>
                readOnly:         <?php echo json_encode(_('Curation is unavailable.'), JSON_HEX_TAG); ?>,
                volatile:         <?php echo json_encode(_('Changes here are not durable.'), JSON_HEX_TAG); ?>,
                reviewed:         <?php echo json_encode(_('Changes here are reviewed.'), JSON_HEX_TAG); ?>,
                <?php // A write may be recorded as a change request awaiting review instead of
                      // being applied; the API says which in the response `disposition` field.
                      // Shared with includes/messages.php — same msgids, one translation each. ?>
                writeSubmitted:   <?php echo json_encode(_('Your changes were submitted for review as batch %s. Nothing has been saved yet.'), JSON_HEX_TAG); ?>,
                writeApproved:    <?php echo json_encode(_('Your changes were approved as batch %s and are queued for publication. They are not live yet.'), JSON_HEX_TAG); ?>,
                writeSuperseded:  <?php echo json_encode(_('Earlier pending submissions were folded into this one and no longer appear in your queue: %s'), JSON_HEX_TAG); ?>,
                writeUnknown:     <?php echo json_encode(
                    _('The server reported an unrecognized outcome (\'%s\') for these changes. Reload the page to check whether they were saved.'),
                    JSON_HEX_TAG
                ); ?>
            }
        };
    </script>
</body>
</html>
