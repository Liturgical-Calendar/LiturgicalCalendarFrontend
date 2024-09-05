<!doctype html><?php

include_once("includes/I18n.php");
$i18n = new I18n();

$isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false || strpos($_SERVER['HTTP_HOST'], "localhost") !== false );
//$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
$endpointURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/";
$metadataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/metadata/";
$dateOfEasterURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/easter/";

$API_DESCRIPTION = sprintf(
    /**translators: 1. /calendar, 2. /calendar/nation/{NATION}, 3. /calendar/diocese/{DIOCESE} */
    _('Collection of Liturgical events for any given year between 1970 and 9999. The base %1$s path returns liturgical events for the General Roman Calendar. National and Diocesan calendars can be requested on the %2$s and %3$s paths respectively.'),
    '<b><code>/calendar</code></b>',
    '<b><code>/calendar/nation/{NATION}</code></b>',
    '<b><code>/calendar/diocese/{DIOCESE}</code></b>'
);
?>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _("General Roman Calendar") ?></title>
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
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("API /calendar endpoint"); ?><i class="fas fa-code float-end fa-2x text-black" style="--bs-text-opacity: .15;"></i></h6>
                    </div>
                    <div class="card-body">
                        <p><small class="text-muted"><i><?php echo $API_DESCRIPTION; ?></i></small></p>
                        <div class="row mb-4">
                            <h5 class="fw-bold"><?php echo _("Path builder"); ?></h5>
                            <div class="form-group col-sm-7">
                                <label for="APICalendarSelect"><?php echo _("Calendar to retrieve from the API"); ?>:</label>
                                <select id="APICalendarSelect" class="form-select">
                                    <option value="">---</option>
                                </select>
                            </div>
                            <div class="form-group col-sm-3">
                                <label>year</label><input id="RequestOptionYear" class="form-control" type="number" min=1970 max=9999 value=<?php echo date("Y"); ?> />
                            </div>
                        </div>
                        <div class="row mb-4">
                            <h5 class="fw-bold"><?php
                                echo sprintf(
                                    /**translators: %s = '/calendar' */
                                    _('Request parameters available on the base %s path'),
                                    '/calendar'
                                );
                                ?></h5>
                            <div class="form-group col-sm-2"><label>epiphany</label><select id="RequestOptionEpiphany" class="form-select requestOption"><option value="">--</option><option value="SUNDAY_JAN2_JAN8">SUNDAY_JAN2_JAN8</option><option value="JAN6">JAN6</option></select></div>
                            <div class="form-group col-sm-2"><label>ascension</label><select id="RequestOptionAscension" class="form-select requestOption"><option value="">--</option><option value="SUNDAY">SUNDAY</option><option value="THURSDAY">THURSDAY</option></select></div>
                            <div class="form-group col-sm-2"><label>corpus_christi</label><select id="RequestOptionCorpusChristi" class="form-select requestOption"><option value="">--</option><option value="SUNDAY">SUNDAY</option><option value="THURSDAY">THURSDAY</option></select></div>
                            <div class="form-group col-sm-2"><label>eternal_high_priest</label><select id="RequestOptionEternalHighPriest" class="form-select requestOption"><option value="">--</option><option value="true">true</option><option value="false">false</option></select></div>
                            <div class="form-group col-sm-2"><label>locale</label><select id="RequestOptionLocale" class="form-select requestOption"><option value="">--</option><?php
                            foreach ($langsAssoc as $key => $lang) {
                                $keyUC = strtoupper($key);
                                echo "<option value=\"$keyUC\">$lang</option>";
                            }
                            ?></select></div>
                            <small class="text-muted"><i>
                                <?php echo sprintf(
                                    /**translators: 1. /calendar/nation/{NATION}, 2. /calendar/diocese/{DIOCESE} */
                                    _('These parameters are useful for tweaking the calendar results, when no National or Diocesan calendar is requested. Since National and Diocesan calendars have these parameters built in, the parameters are not available on the %1$s and %2$s routes.'),
                                    '<b><code>/calendar/nation/{NATION}</code></b>',
                                    '<b><code>/calendar/diocese/{DIOCESE}</code></b>'
                                ); ?>
                                <br />
                                <?php echo sprintf(
                                    /**translators: 1. VATICAN, 2. /calendar */
                                    _('N.B. Even though selecting %1$s will set the base %2$s path, it will have the same effect as selecting a National or Diocesan calendar, since we are requesting the Vatican calendar\'s built-in parameters; in other words, using none of these parameters on the base %2$s path will give us the General Roman calendar as used in the Vatican.'),
                                    '<b><code>VATICAN</code></b>',
                                    '<b><code>/calendar</code></b>'
                                ); ?>
                            </i></small>
                        </div>
                        <div class="row mb-4">
                            <h5 class="fw-bold"><?php echo sprintf(
                                /**translators: 1. /calendar */
                                _('Request parameters available on all %1$s paths'),
                                '<b><code>/calendar</code></b>'
                            ); ?></h5>
                            <div class="form-group col-sm-4">
                                <label>return_type</label>
                                <select id="RequestOptionReturnType" class="form-select">
                                    <option value="">--</option>
                                    <option value="JSON">JSON</option>
                                    <option value="XML">XML</option>
                                    <option value="ICS">ICS (ICAL feed)</option>
                                </select>
                            </div>
                            <div class="form-group col-sm-4">
                                <label>calendar_type</label>
                                <select id="RequestOptionCalendarType" class="form-select">
                                    <option value="">--</option>
                                    <option value="CIVIL">CIVIL</option>
                                    <option value="LITURGICAL">LITURGICAL</option>
                                </select>
                            </div>
                            <small class="text-muted"><i><?php
                                echo sprintf(
                                    /**translators: 1. /calendar */
                                    _('These request parameters can always be set, whether we are requesting the base %1$s resource or any resource below the %1$s path.'),
                                    '<b><code>/calendar</code></b>'
                                );
                                ?></i></small>
                        </div>
                        <div class="row align-items-center">
                            <div class="form-group col-sm-8">
                                <div id="RequestURLExampleWrapper"><small class="text-muted"><code id="RequestURLExample"><?php echo $endpointURL; ?></code></small></div>
                            </div>
                            <div class="form-group col-sm-4">
                                <a id="RequestURLButton" href="<?php echo $endpointURL; ?>" class="btn btn-primary m-2" target="_blank"><?php echo _("Liturgical Calendar API endpoint"); ?></a>
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
