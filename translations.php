<?php

use LiturgicalCalendar\Frontend\I18n;

include_once('vendor/autoload.php');

$i18n = new I18n();

$API_EXTEND_HOWTO_1 = _('The first step in creating a national or diocesan calendar, is to translate the data for the General Roman Calendar into the language for that nation or diocese.');
$API_EXTEND_HOWTO_2 = sprintf(
    _('This can be done on the <a href="%1$s" target="_blank">LitCal translation server %2$s</a>.'),
    'https://translate.johnromanodorazio.com/projects/liturgical-calendar/',
    '<i class="fas fa-up-right-from-square ms-2"></i>'
);
$API_EXTEND_HOWTO_3 = _('If you would like to contribute to the translations of the Liturgical data for your region, please feel free to create an account on the translation server.');
$API_EXTEND_HOWTO_4 = _('Specifically, the components which require translation are:');

$API_EXTEND_HOWTO_5 = sprintf(
    /**translators: 1 = name of the translation component ("API strings"), 2 = names of the categories, 3 = name of a category ("Calendar messages") */
    _('Other translations required for the Liturgical Calendar data are found in the %1$s translation component. Upon choosing the language in which to translate this component, you will find tags that categorize the strings for translation in the "String status" section. The categories that are required to complete the Liturgical calendar data are: %2$s. The %3$s tag / category are the messages that explain how the calendar was calculated for a given year; though not essential for the Calendar data, it is useful information for understanding where the results of the current calculation came from.'),
    '<a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/liturgical-calendar-api/api-strings/" target="_blank" class="text-light">API strings <i class="fas fa-up-right-from-square mx-2"></i></a>',
    '<span class="text-nowrap">1. <kbd>Calendar strings</kbd></span>, <span class="text-nowrap">2. <kbd>Commons</kbd></span>, <span class="text-nowrap">3. <kbd>Liturgical colors</kbd></span>, <span class="text-nowrap">4. <kbd>Liturgical grades</kbd></span>, <span class="text-nowrap">5. <kbd>Liturgical seasons</kbd></span>',
    '<span class="text-nowrap"><kbd>Calendar messages</kbd></span>'
);

$API_EXTEND_HOWTO_5a = sprintf(
    _('If translating liturgical calendar data for a European country, you will also want to translate the %1$s component.'),
    '<a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/patron-saints-of-europe/" target="_blank" class="text-light text-nowrap">Patron Saints of Europe <i class="fas fa-up-right-from-square mx-2"></i></a>'
);

$API_EXTEND_HOWTO_6a = _('Translations of the above mentioned liturgical events MUST NOT be done simply based on the linguistic abilities of the translator, but MUST be taken from the Roman Missal used in the region for which the translation is accomplished.');
$API_EXTEND_HOWTO_6b = _('Translations of the above mentioned liturgical events may change from one edition of the Roman Missal to the next; translators should simply use the most recent edition of the Roman Missal for their region as a reference.');
$API_EXTEND_HOWTO_6c = _('This API intends to be historically correct as regards the calculation of the dates and the precedence of the liturgical events, but does not pretend historical accuracy as regards differences in the translations of the liturgical events over time.');

$API_EXTEND_HOWTO_7 = _('National calendars and related translations must be defined using data from the translation of the Roman Missal used in the Region or in any case from decrees of the Episcopal Conference of the Region.');
$API_EXTEND_HOWTO_8 = _('Anyone who intends on contributing to the translations is required to agree to these conditions.');
$API_EXTEND_HOWTO_9 = _('If the translator is not an expert in liturgical science or does not have a role in a diocesan office for liturgy and worship, the translations will require overview by a liturgical expert before being incorporated into this project.');

$API_EXTEND_HOWTO_10 = _('The project website can be also be translated into other languages. The translation strings can be found in the following translation components:');
?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _('Translating the Calendar') ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _('Translating the Liturgical Calendar project'); ?></h3>

        <ul class="nav nav-tabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="calendar-data-tab" data-bs-toggle="tab" data-bs-target="#calendar-data-panel" type="button" role="tab" aria-controls="calendar-data-panel" aria-selected="true"><?php echo _('Calendar data'); ?></button>
            </li>
            <li class="nav-item">
                <button class="nav-link" id="project-website-tab" data-bs-toggle="tab" data-bs-target="#project-website-panel" type="button" role="tab" aria-controls="project-website-panel" aria-selected="false"><?php echo _('Project website'); ?></button>
            </li>
        </ul>

        <div class="tab-content">
            <div class="tab-pane fade show active pt-3" id="calendar-data-panel" role="tabpanel" aria-labelledby="calendar-data-tab">
                <p style="text-align:justify;"><?php echo $API_EXTEND_HOWTO_1 . ' ' . $API_EXTEND_HOWTO_2 . ' ' . $API_EXTEND_HOWTO_3; ?></p>
                <div class="d-flex flex-column gap-3 flex-lg-row bg-secondary text-light p-4 m-2">
                    <div class="col-12 col-lg-3">
                        <p style="text-align:justify;"><?php echo $API_EXTEND_HOWTO_4; ?></p>
                        <ol class="mb-0">
                            <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/liturgical-calendar-api/proprium-de-sanctis-1970/" target="_blank" class="text-light"><small>Proprium de Sanctis 1970 <i class="fas fa-up-right-from-square ms-2"></i></small></a></li>
                            <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/liturgical-calendar-api/proprium-de-sanctis-2002/" target="_blank" class="text-light"><small>Proprium de Sanctis 2002 <i class="fas fa-up-right-from-square ms-2"></i></small></a></li>
                            <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/liturgical-calendar-api/proprium-de-sanctis-2008/" target="_blank" class="text-light"><small>Proprium de Sanctis 2008 <i class="fas fa-up-right-from-square ms-2"></i></small></a></li>
                            <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/liturgical-calendar-api/proprium-de-tempore/" target="_blank" class="text-light"><small>Proprium de Tempore <i class="fas fa-up-right-from-square ms-2"></i></small></a></li>
                            <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/liturgical-calendar-api/memorials-from-decrees/" target="_blank" class="text-light"><small>Memorials from Decrees <i class="fas fa-up-right-from-square ms-2"></i></small></a></li>
                        </ol>
                    </div>
                    <div class="col-12 col-lg-9">
                        <p><?php echo $API_EXTEND_HOWTO_5; ?></p>
                        <p><small><i><?php echo $API_EXTEND_HOWTO_5a; ?></small></i></p>
                    </div>
                </div>
                <p style="text-align:justify;"><?php echo $API_EXTEND_HOWTO_6a . ' ' . $API_EXTEND_HOWTO_6b . ' ' . $API_EXTEND_HOWTO_6c; ?></p>
                <p style="text-align:justify;"><?php echo $API_EXTEND_HOWTO_7 . ' ' . $API_EXTEND_HOWTO_8 . ' ' . $API_EXTEND_HOWTO_9; ?></p>
            </div>
            <div class="tab-pane fade pt-3" id="project-website-panel" role="tabpanel" aria-labelledby="project-website-tab">
                <p><?php echo $API_EXTEND_HOWTO_10; ?></p>
                <ol>
                    <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/frontend/" target="_blank">liturgical-calendar/frontend <i class="fas fa-up-right-from-square ms-2"></i></a></li>
                    <li><a href="https://translate.johnromanodorazio.com/projects/liturgical-calendar/frontend-js/" target="_blank">liturgical-calendar/frontend-js <i class="fas fa-up-right-from-square ms-2"></i></a></li>
                </ol>
            </div>
        </div>


    <?php include_once('./layout/footer.php'); ?>

</body>
</html>

