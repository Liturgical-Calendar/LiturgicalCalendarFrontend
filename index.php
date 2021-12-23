<?php

include_once("includes/i18n.php");
$i18n = new i18n();

$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
$endpointURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalEngine.php";
$metadataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalMetadata.php";
$dateOfEasterURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/DateOfEaster.php";

$API_DESCRIPTION = _( "A Liturgical Calendar API from which you can retrieve data for the Liturgical events of any given year from 1970 to 9999, whether for the Universal or General Roman Calendar or for derived National and Diocesan calendars" );
?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "General Roman Calendar" ) ?></title>
    <?php include_once('layout/head.php'); ?>
</head>
<body>

    <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-gray-800"><?php echo _( "Catholic Liturgical Calendar" ); ?></h1>

        <!-- Content Row -->
        <div class="row">
            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "API Endpoint" ); ?><i class="fas fa-code float-right fa-2x text-gray-300"></i></h6>
                    </div>
                    <div class="card-body">
                        <p class="mb-4"><?php echo $API_DESCRIPTION; ?></p>
                        <div class="form-row">
                            <div class="form-group col-sm-7">
                                <label for="APICalendarSelect"><?php echo _( "Calendar to retrieve from the API" ); ?>:</label>
                                <select id="APICalendarSelect" class="form-control">
                                    <option value="">---</option>
                                    <option value="VATICAN">Vatican (Universal Roman Calendar)</option>
                                </select>
                            </div>
                            <div class="form-group col-sm-3">
                                <label>year</label><input id="RequestOptionYear" class="form-control" type="number" min=1970 max=9999 value=<?php echo date("Y"); ?> />
                            </div>
                            <div class="form-group col-sm-2">
                                <label>returntype</label>
                                <select id="RequestOptionReturnType" class="form-control">
                                    <option value="">--</option>
                                    <option value="JSON">JSON</option>
                                    <option value="XML">XML</option>
                                    <option value="ICS">ICS (ICAL feed)</option>
                                </select>
                            </div>
                        </div>
                        <div class="text-center"><a id="RequestURLButton" href="<?php echo $endpointURL; ?>" class="btn btn-primary m-2"><?php echo _( "Liturgical Calendar API endpoint"); ?></a></div>
                        <p><?php echo _( "If a national or diocesan calendar is requested, these calendars will automatically set the specific options in the API request. " .
                            "If instead no national or diocesan calendar is requested (i.e. the Universal Calendar is requested) then the more specific options can be requested:" ); ?></p>
                        <div class="form-row">
                            <div class="form-group col-sm-3"><label>epiphany</label><select id="RequestOptionEpiphany" class="form-control requestOption"><option value="">--</option><option value="SUNDAY_JAN2_JAN8">SUNDAY_JAN2_JAN8</option><option value="JAN6">JAN6</option></select></div>
                            <div class="form-group col-sm-3"><label>ascension</label><select id="RequestOptionAscension" class="form-control requestOption"><option value="">--</option><option value="SUNDAY">SUNDAY</option><option value="THURSDAY">THURSDAY</option></select></div>
                            <div class="form-group col-sm-3"><label>corpuschristi</label><select id="RequestOptionCorpusChristi" class="form-control requestOption"><option value="">--</option><option value="SUNDAY">SUNDAY</option><option value="THURSDAY">THURSDAY</option></select></div>
                            <div class="form-group col-sm-3"><label>locale</label><select id="RequestOptionLocale" class="form-control requestOption"><option value="">--</option><option value="EN">English</option><option value="IT">Italian</option><option value="LA">Latin</option></select></div>
                        </div>
                        <small class="text-muted">
                            <p><i><?php echo _( "URL for the API request based on selected options (the above button is set to this URL)" ); ?>:</i></p>
                            <div id="RequestURLExampleWrapper"><code id="RequestURLExample"><?php echo $endpointURL; ?></code></div>
                        </small>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "Calculation of the Date of Easter" ); ?><i class="fas fa-code float-right fa-2x text-gray-300"></i></h6>
                    </div>
                    <div class="card-body">
                        <?php $EASTER_CALCULATOR_API = _( "A simple API endpoint that returns data about the Date of Easter, both Gregorian and Julian, " .
                "from 1583 (year of the adoption of the Gregorian Calendar) to 9999 (maximum possible date calculation in 64bit PHP), " .
                "using a PHP adaptation of the Meeus/Jones/Butcher algorithm for Gregorian easter (observed by the Roman Catholic church) " .
                "and of the Meeus algorithm for Julian easter (observed by orthodox churches)" ); ?>
                        <p><?php echo $EASTER_CALCULATOR_API; ?></p>
                        <div class="text-center"><a href="<?php echo $dateOfEasterURL ?>" class="btn btn-primary m-2"><?php echo _( "Date of Easter API endpoint"); ?></a></div>
                        <small class="text-muted">
                            <i><?php echo _( "Currently the data can be requested with almost any localization. " .
                            "In any case, since the API returns a UNIX timestamp for each date of Easter, localizations can be done in a client application just as well." ); ?></i>
                        </small>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "API Endpoint" ); ?>: <?php  echo _( "Definition" ) ?><i class="fas fa-file-code float-right fa-2x text-gray-300"></i></h6>
                    </div>
                    <div class="card-body">
                        <div class="text-center"><a href="dist/" class="btn btn-primary mt-2"><?php echo _( "Swagger / Open API Documentation" ); ?></a></div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "Calculation of the Date of Easter" ); ?><i class="fas fa-poll-h float-right fa-2x text-gray-300"></i></h6>
                    </div>
                    <div class="card-body">
                        <p><?php echo _( "Example display of the date of Easter from 1583 to 9999" ); ?></p>
                        <div class="text-center"><a href="easter.php" class="btn btn-primary m-2"><?php echo _( "Calculate the Date of Easter" ); ?></a></div>
                    </div>
                </div>
            </div>
        </div>

<?php include_once('layout/footer.php'); ?>

</body>
</html>
