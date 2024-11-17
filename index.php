<?php

use LiturgicalCalendar\Components\ApiOptions;
use LiturgicalCalendar\Components\ApiOptions\Input;
use LiturgicalCalendar\Components\ApiOptions\PathType;

include_once "common.php"; // provides $i18n and all API URLs

$API_DESCRIPTION = _('Collection of Liturgical events for any given year between 1970 and 9999.') . " " .
    sprintf(
        /**translators: 1. /calendar, 2. /calendar/nation/{NATION}, 3. /calendar/diocese/{DIOCESE} */
        _('The base %1$s path returns liturgical events for the General Roman Calendar. National and Diocesan calendars can be requested on the %2$s and %3$s paths respectively.'),
        '<b><code>/calendar</code></b>',
        '<b><code>/calendar/nation/{NATION}</code></b>',
        '<b><code>/calendar/diocese/{DIOCESE}</code></b>'
    ) . " " .
    sprintf(
        /**translators: 1. /{YEAR} */
        _('Each of these paths can optionally be further specified with a %1$s path parameter. When not specified, the API will default to the current year.'),
        '<b><code>/{YEAR}</code></b>'
    );

$firstAfterA = sprintf(
    /**translators: 1. /calendar/nation/{NATION}, 2. /calendar/diocese/{DIOCESE} */
    _('These parameters are useful for tweaking the calendar results, when no National or Diocesan calendar is requested. Since National and Diocesan calendars have these parameters built in, the parameters are not available on the %1$s and %2$s routes.'),
    '<b><code>/calendar/nation/{NATION}</code></b>',
    '<b><code>/calendar/diocese/{DIOCESE}</code></b>'
);
$firstAfterB = _('N.B. When none of these parameters are set, the API will use the defaults as in use in the Vatican.');
$firstAfter = "<small class=\"text-muted\"><i>$firstAfterA<br>$firstAfterB</i></small>";

$secondAfterA = sprintf(
    /**translators: 1. /calendar */
    _('These request parameters can always be set, whether we are requesting the base %1$s resource or any resource below the %1$s path. National and Diocesan calendars do not have these parameters built-in.'),
    '<b><code>/calendar</code></b>'
);
$secondAfter = "<small class=\"text-muted\"><i>$secondAfterA</i></small>";

$localeLabelAfterA = _('It is preferable to set the locale using the Accept-Language header rather than using the locale parameter. N.B. The Accept-Language header will have no effect when a National or Diocesan calendar is requested.');
$localeLabelAfter = "<i class=\"fas fa-circle-info ms-2\" data-bs-toggle=\"tooltip\" data-bs-title=\"$localeLabelAfterA\" role=\"button\"></i>";

$acceptLabelAfterA = _('It is preferable to request the response content type using the Accept header rather than using the return_type parameter.');
$acceptLabelAfter = "<i class=\"fas fa-circle-info ms-2\" data-bs-toggle=\"tooltip\" data-bs-title=\"$acceptLabelAfterA\" role=\"button\"></i>";

$formLabelA = sprintf(
    /**translators: %s = '/calendar' */
    _('Request parameters available on the base %s path'),
    '<b><code>/calendar</code></b>'
);

$formLabelB = sprintf(
    /**translators: 1. /calendar */
    _('Request parameters available on all %1$s paths'),
    '<b><code>/calendar/*</code></b>'
);

$options = [
    "locale"    => $i18n->LOCALE,
    "formLabel" => true,
    "wrapper"   => true
];
$apiOptions = new ApiOptions($options);
$apiOptions->wrapper->as('div')->class('row mb-4')->id('calendarOptions');
$apiOptions->formLabel->as('h5')->class('fw-bold');
Input::setGlobalWrapper('div');
Input::setGlobalWrapperClass('form-group col-sm-2');
Input::setGlobalInputClass('form-select requestOption');
$apiOptions->epiphanyInput->id('RequestOptionEpiphany');
$apiOptions->ascensionInput->id('RequestOptionAscension');
$apiOptions->corpusChristiInput->id('RequestOptionCorpusChristi');
$apiOptions->eternalHighPriestInput->id('RequestOptionEternalHighPriest');
$apiOptions->localeInput->id('RequestOptionLocale')->labelAfter($localeLabelAfter);
$apiOptions->yearTypeInput->id('RequestOptionYearType')->class('form-select')->wrapperClass('form-group col-sm-3');
$apiOptions->acceptHeaderInput->id('RequestOptionReturnType')->labelAfter($acceptLabelAfter)->class('form-select')->wrapperClass('form-group col-sm-3')->asReturnTypeParam();

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php
        echo _("General Roman Calendar");
    ?></title>
    <?php include_once('layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _("Catholic Liturgical Calendar"); ?></h1>

        <!-- Content Row -->
        <div class="row">
            <div class="col-md-12">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php
                            echo sprintf(
                                /**translators: 1. /calendar */
                                _('API %1$s endpoint'),
                                '<b><code>/calendar</code></b>'
                            );
                            ?><i class="fas fa-code float-end fa-2x text-black" style="--bs-text-opacity: .15;"></i></h6>
                    </div>
                    <div class="card-body">
                        <p><small class="text-muted"><i><?php echo $API_DESCRIPTION; ?></i></small></p>
                        <div class="row mb-4">
                            <h5 class="fw-bold"><?php
                                echo _("Path builder");
                            ?></h5>
                            <div class="form-group col-sm-3">
                                <label><?php
                                    echo _("Select route");
                                ?></label>
                                <select id="APICalendarRouteSelect" class="form-select">
                                    <option value="/calendar">/calendar</option>
                                    <option value="/calendar/nation/">/calendar/nation/</option>
                                    <option value="/calendar/diocese/">/calendar/diocese/</option>
                                </select>
                            </div>
                            <div class="form-group col-sm-6">
                                <label for="APICalendarSelect"><?php
                                    echo _("Calendars available on selected route");
                                ?></label>
                                <select id="APICalendarSelect" class="form-select" disabled>
                                    <option value="">GENERAL ROMAN</option>
                                </select>
                            </div>
                            <div class="form-group col-sm-3">
                                <label><?php echo _("Year"); ?> <i class="fas fa-circle-info ms-2" data-bs-toggle="tooltip" data-bs-title="<?php echo _("When not specified, the API will default to the current year. Try specifically setting the year by changing the value here."); ?>"></i></label>
                                <input id="RequestOptionYear" class="form-control" type="number" min=1970 max=9999 value=<?php echo date("Y"); ?> />
                            </div>
                        </div>
                        <?php
                        $apiOptions->formLabel->text($formLabelA);
                        $apiOptions->after($firstAfter);
                        echo $apiOptions->getForm(PathType::BASE_PATH);
                        $apiOptions->formLabel->text($formLabelB);
                        $apiOptions->after($secondAfter);
                        echo $apiOptions->getForm(PathType::ALL_PATHS);
                        ?>
                        <div class="row align-items-center">
                            <div class="form-group col-sm-8">
                                <div id="RequestURLExampleWrapper">
                                    <small class="text-muted"><code id="RequestURLExample"><?php echo $calendarURL; ?></code></small>
                                </div>
                            </div>
                            <div class="form-group col-sm-4">
                                <a id="RequestURLButton" href="<?php echo $calendarURL; ?>" class="btn btn-primary m-2" target="_blank"><?php
                                    echo _("Liturgical Calendar API endpoint");
                                ?></a>
                            </div>
                            <small class="text-muted"><i><?php echo _("URL of the API request based on selected options. The button is set to the same URL, click on it to see results."); ?></i></small>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Liturgical Calendar Validator"); ?><i class="fas fa-flask-vial float-end fa-2x text-black" style="--bs-text-opacity: .15;"></i></h6>
                    </div>
                    <div class="card-body">
                        <div><?php echo _("In order to verify that the liturgical data produced by the API is correct, there is a Unit Test interface that can run predefined tests against the JSON responses produced by the API starting from the year 1970 and going up to 25 years from the current year."); ?></div>
                        <div class="text-center mb-2"><a href="https://litcal-tests.johnromanodorazio.com/" class="btn btn-primary mt-2"><?php echo _("Liturgical Calendar Validator"); ?></a></div>
                        <small class="text-muted">
                            <i>
                                <?php echo sprintf(_("The unit tests are defined in the %s folder in the Liturgical Calendar API repository."), "<a href=\"https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/tree/development/tests\">LiturgicalCalendarAPI/tree/development/tests</a>"); ?>
                                <?php echo sprintf(_("The unit test interface is curated in a repository of its own: %s."), "<a href=\"https://github.com/Liturgical-Calendar/UnitTestInterface\">Liturgical-Calendar/UnitTestInterface</a>"); ?>
                            </i>
                        </small>
                    </div>
                </div>
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Translation Tool"); ?><i class="fas fa-language float-end fa-2x text-black" style="--bs-text-opacity: .15;"></i></h6>
                    </div>
                    <div class="card-body text-center">
                        <a href="https://translate.johnromanodorazio.com/engage/liturgical-calendar/" class="btn btn-light" id="transl-status-btn">
                            <picture>
                                <source media="(max-width: 600px)" srcset="https://translate.johnromanodorazio.com/widget/liturgical-calendar/horizontal-auto.svg" />
                                <img src="https://translate.johnromanodorazio.com/widget/liturgical-calendar/multi-auto.svg" alt="<?php echo _("Translations status"); ?>" />
                            </picture>
                        </a>
                        <p class="m-2"><i><?php echo _("Translations status"); ?></i></p>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php  echo _("Open API Schema") ?><i class="fas fa-file-code float-end fa-2x text-black" style="--bs-text-opacity: .15;"></i></h6>
                    </div>
                    <div class="card-body">
                        <div class="text-center"><a href="dist/" class="btn btn-primary mt-2"><?php echo _("Swagger / Open API Documentation"); ?></a></div>
                        <p class="m-2"><small class="text-muted">
                            <i><?php echo _("All of the available API routes with their supported methods, parameters, content types and responses are described here."); ?></i>
                        </small></p>
                    </div>
                </div>
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Calculation of the Date of Easter"); ?>: API<i class="fas fa-code float-end fa-2x text-black" style="--bs-text-opacity: .15;"></i></h6>
                    </div>
                    <div class="card-body">
                        <?php $EASTER_CALCULATOR_API = _("A simple API endpoint that returns data about the Date of Easter, both Gregorian and Julian, " .
                        "from 1583 (year of the adoption of the Gregorian Calendar) to 9999 (maximum possible date calculation in 64bit PHP), " .
                        "using a PHP adaptation of the Meeus/Jones/Butcher algorithm for Gregorian easter (observed by the Roman Catholic church) " .
                        "and of the Meeus algorithm for Julian easter (observed by orthodox churches)."); ?>
                        <p><?php echo $EASTER_CALCULATOR_API; ?></p>
                        <div class="text-center"><a href="<?php echo $dateOfEasterURL ?>" class="btn btn-primary m-2"><?php echo _("Date of Easter API endpoint"); ?></a></div>
                        <small class="text-muted">
                            <i><?php echo _("Currently the data can be requested with almost any localization. " .
                            "In any case, since the API returns a UNIX timestamp for each date of Easter, localizations can be done in a client application just as well."); ?></i>
                        </small>
                    </div>
                </div>
            </div>
        </div>


<?php include_once('layout/footer.php'); ?>

</body>
</html>
