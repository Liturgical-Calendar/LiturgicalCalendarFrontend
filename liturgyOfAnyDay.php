<?php

/**
 * liturgyOfAnyDay
 * @author John Romano D'Orazio <priest@johnromanodorazio.com>
 * @link https://litcal.johnromanodorazio.com
 *
 * This page uses the liturgy-components-js library to provide calendar selection,
 * API options, and the LiturgyOfAnyDay component. The ApiClient handles
 * Accept-Language headers automatically when listening to ApiOptions.
 */

include_once 'includes/common.php';

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _('General Roman Calendar') . ' - ' . _('Liturgy of any day') ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-gray-800"><?php echo _('Liturgy of any day'); ?></h3>
        <div class="container">
            <div class="row">
                <!-- CalendarSelect will be rendered here by JS -->
                <div class="form-group col-md" id="calendarSelectContainer"></div>
                <!-- LocaleInput from ApiOptions will be rendered here by JS -->
                <div class="form-group col-md" id="localeSelectContainer"></div>
            </div>
            <!-- LiturgyOfAnyDay component will be rendered here by JS -->
            <div id="liturgyOfAnyDayContainer"></div>
        </div>
        <?php include_once('./layout/footer.php'); ?>
        <script nomodule defer src="https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js"></script>
        <script type="module" src="assets/js/liturgyOfAnyDay.js"></script>
</body>
</html>
