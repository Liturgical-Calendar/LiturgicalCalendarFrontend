<?php

include_once("includes/i18n.php");
include_once("./layout/formcontrols.php");

$i18n = new i18n();
$FormControls = new FormControls( $i18n );
$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$versionAPI = $isStaging ? "dev" : "v3";

$dayOfWeekFmt = IntlDateFormatter::create($i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN, 'EEEE' );
$thursday   = $dayOfWeekFmt->format( DateTime::createFromFormat( '!j-n-Y', '1-1-2022', new DateTimeZone( 'UTC' ) )->modify( 'next Thursday' ) );
$sunday     = $dayOfWeekFmt->format( DateTime::createFromFormat( '!j-n-Y', '1-1-2022', new DateTimeZone( 'UTC' ) )->modify( 'next Sunday' ) );

$countryISOCodes = json_decode( file_get_contents("./assets/data/CountryToISO.json"), true );

[ "LitCalMetadata" => $LitCalMetadata ] = json_decode( file_get_contents("https://litcal.johnromanodorazio.com/api/{$versionAPI}/LitCalMetadata.php"), true );
[ "LitCalAllFestivities" => $FestivityCollection ] = json_decode( file_get_contents( "https://litcal.johnromanodorazio.com/api/{$versionAPI}/LitCalAllFestivities.php?locale=" . $i18n->LOCALE ), true );
$NationalCalendars = $LitCalMetadata["NationalCalendars"];
unset($NationalCalendars["VATICAN"]);
$DiocesanGroups = array_keys( $LitCalMetadata["DiocesanGroups"] );

$availableNationalCalendars = [];
foreach( array_keys($NationalCalendars) as $country_name ) {
    $availableNationalCalendars[$country_name] = Locale::getDisplayRegion("-" . $countryISOCodes[$country_name], $i18n->LOCALE);
}
asort($availableNationalCalendars, SORT_LOCALE_STRING);

$API_EXTEND_HOWTO_A = _( "The General Roman Calendar can be extended so as to create a National or Diocesan calendar. Diocesan calendars depend on National calendars, so the National calendar must first be created." );
$API_EXTEND_HOWTO_A2 = _( "A National calendar may have some festivities in common with other National calendars, for example the patron of a wider region." );
$API_EXTEND_HOWTO_A3 = _( "In this case, the festivities for the Wider region should be defined separately, and if applicable should be made translatable, then the Wider region should be applied to the National Calendar." );
$API_EXTEND_HOWTO_B = _( "National calendars must be defined using data from the translation of the Roman Missal used in the Region or in any case from decrees of the Episcopal Conference of the Region." );
$DioceseGroupHelp = _( "If a group of dioceses decides to pool their Liturgical Calendar data, for example to print out one single yearly calendar with the data for all the dioceses in the group, the group can be defined or set here." );

$c = new Collator($i18n->LOCALE);

$AvailableLocales = array_filter(ResourceBundle::getLocales(''), function ($value) {
    return strpos($value, '_') === false;
});
$AvailableLocales = array_reduce($AvailableLocales, function($carry, $item) use($i18n){
    $carry[$item] = Locale::getDisplayLanguage($item, $i18n->LOCALE);
    return $carry;
},[]);
$c->asort($AvailableLocales);

$AvailableCountries = array_filter(ResourceBundle::getLocales(''), function ($value) {
    return strpos($value, '_');
});
$AvailableCountries = array_reduce($AvailableCountries, function($carry, $item) use($i18n) {
    if( !array_key_exists( Locale::getDisplayRegion($item, 'en'), $carry ) ) {
        $carry[Locale::getDisplayRegion($item, 'en')] = Locale::getDisplayRegion($item, $i18n->LOCALE);
    }
    return $carry;
},[]);
$c->asort($AvailableCountries);

$messages = [
    "Tag"               => _( "Tag" ),
    "Name"              => _( "Name" ),
    "Day"               => _( "Day" ),
    "Month"             => _( "Month" ),
    "Other Solemnity"   => _( "Other Solemnity" ),
    "Other Feast"       => _( "Other Feast" ),
    "Other Memorial"    => _( "Other Memorial" ),
    "Other Optional Memorial"   => _( "Other Optional Memorial" ),
    "Delete diocesan calendar"  => _( "Delete diocesan calendar" ),
    "If you choose"     => _( "If you choose to delete this diocesan calendar, the liturgical events defined for the calendar and the corresponding index entry will be removed and no longer available in the client applications." ),
    "Liturgical color"  => _( "Liturgical color" ),
    "white"             => _( "white" ),
    "red"               => _( "red" ),
    "green"             => _( "green" ),
    "purple"            => _( "purple" ),
    /**translators: in reference to the first year from which this festivity takes place */
    "Since"             => _( "Since" ),
    /**translators: in reference to the year from which this festivity no longer needs to be dealt with */
    "Until"             => _( "Until" ),
    /**translators: label of the form row */
    "Designate patron"  => _( "Patron or Patrons of the Wider Region"),
    /**translators: label of the form row */
    "New festivity"     => _( "New festivity" ),
    /**translators: label of the form row */
    "Change name or grade" => _( "Change name or grade" ),
    /**translators: label of the form row */
    "Move festivity" => _( "Move festivity" ),
    "Decree URL"        => _( "Decree URL" ),
    "Decree Langs"      => _( "Decree Language mappings" ),
    "Missal"            => _( "Missal" ),
    "Reason"            => _( "Reason (in favor of festivity)" ),
    "commonsTemplate"   => $FormControls->getCommonsTemplate(),
    "gradeTemplate"     => $FormControls->getGradeTemplate(),
    "LOCALE"            => $i18n->LOCALE,
    "AvailableLocales"  => $AvailableLocales,
    "AvailableCountries"=> $AvailableCountries,
    "countryISOCodes"   => $countryISOCodes
];

?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "General Roman Calendar - Extending") ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-gray-800"><?php echo _( "Extend the General Roman Calendar with National or Diocesan data"); ?></h1>
        <p class="mb-4">
            <p><?php echo $API_EXTEND_HOWTO_A . " " . $API_EXTEND_HOWTO_A2 . " " . $API_EXTEND_HOWTO_A3; ?></p>
            <p><?php echo $API_EXTEND_HOWTO_B; ?></p>
        </p>
<?php
    if(isset($_GET["choice"])){
        switch($_GET["choice"]){
            case "widerRegion":
                //FormControls::$settings["toYearField"] = true;
                ?>
                <div class="container-fluid">
                    <form class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="widerRegionCalendarName" class="font-weight-bold"><?php echo _( "Wider Region"); ?></label>
                            <input list="WiderRegionsList" class="form-control regionalNationalCalendarName" id="widerRegionCalendarName" data-category="widerRegionCalendar" required>
                            <div class="invalid-feedback"><?php echo _( "This value cannot be empty."); ?></div>
                            <datalist id="WiderRegionsList">
                                <option value=""></option>
                                <?php
                                    foreach( $LitCalMetadata["WiderRegions"] as $widerRegion ) {
                                        echo "<option value=\"{$widerRegion}\">{$widerRegion}</option>";
                                    }
                                ?>
                            </datalist>
                        </div>
                        <div class="form-group col col-md-3">
                            <label>:</label>
                            <div class="form-check form-switch">
                                <input type="checkbox" class="form-check-input" id="widerRegionIsMultilingual" />
                                <label for="widerRegionIsMultilingual" class="form-check-label font-weight-bold"><?php echo _( "Wider Region is multilingual" ) ?></label>
                            </div>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="removeExistingWiderRegionData" class="font-weight-bold"></label>
                            <button class="btn btn-danger m-2 form-control" id="removeExistingWiderRegionData" disabled data-toggle="modal" data-target="#removeWiderRegionDataPrompt">
                                <i class="far fa-trash-alt mr-2"></i>
                                <?php echo _( "Remove existing data"); ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-left-primary mr-5 mx-5">
                        <div class="card-header py-3">
                            <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Create a Calendar for a Wider Region"); ?></h4>
                        </div>
                        <div class="card-body">
                            <hr>
                            <form class="needs-validation regionalNationalDataForm" id="widerRegionForm" novalidate>
                            </form>
                            <hr>
                            <div class="d-flex justify-content-around">
                                <button class="btn btn-sm btn-primary m-2" id="makePatronAction" data-toggle="modal" data-target="#makePatronActionPrompt"><i class="fas fa-user-graduate mr-2"></i><?php echo _( "Designate patron from existing festivity" ) ?></button>
                                <button class="btn btn-sm btn-primary m-2" id="setPropertyAction" data-toggle="modal" data-target="#setPropertyActionPrompt"><i class="fas fa-edit mr-2"></i><?php echo _( "Change name or grade of existing festivity" ) ?></button>
                                <button class="btn btn-sm btn-primary m-2" id="moveFestivityAction" data-toggle="modal" data-target="#moveFestivityActionPrompt"><i class="fas fa-calendar-day mr-2"></i><?php echo _( "Move festivity to new date" ) ?></button>
                                <button class="btn btn-sm btn-primary m-2" id="newFestivityAction" data-toggle="modal" data-target="#newFestivityActionPrompt"><i class="far fa-calendar-plus mr-2"></i><?php echo _( "Create a new festivity" ) ?></button>
                            </div>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 serializeRegionalNationalData" id="serializeWiderRegionData" data-category="widerRegionCalendar" disabled><i class="fas fa-save mr-2"></i><?php echo _("Save Wider Region Calendar Data") ?></button>
                        </div>
                    </div>
                </div>
                <?php
                break;
            case "national":
                ?>
                <div class="container-fluid">
                    <form class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="nationalCalendarName" class="font-weight-bold"><?php echo _( "National Calendar"); ?></label>
                            <input list="nationalCalendarsList" class="form-control regionalNationalCalendarName" id="nationalCalendarName" data-category="nationalCalendar" required>
                            <div class="invalid-feedback"><?php echo _( "This value cannot be empty."); ?></div>
                            <datalist id="nationalCalendarsList">
                                <?php
                                    /*foreach( $NationalCalendars as $nationalCalendar => $dioceseArray ) {
                                        echo "<option value=\"{$nationalCalendar}\">{$nationalCalendar}</option>";
                                    }*/
                                    foreach( $AvailableCountries as $countryEnglish => $countryLocalized ) {
                                        echo "<option value=\"{$countryEnglish}\">{$countryLocalized}</option>";
                                    }
                                ?>
                            </datalist>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="removeExistingNationalData" class="font-weight-bold"></label>
                            <button class="btn btn-danger m-2 form-control" id="removeExistingNationalData" disabled data-toggle="modal" data-target="#removeNationalDataPrompt">
                                <i class="far fa-trash-alt mr-2"></i>
                                <?php echo _( "Remove existing data"); ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-left-primary mr-5 mx-5">
                        <div class="card-header py-3">
                            <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Create a National Calendar"); ?></h4>
                        </div>
                        <div class="card-body">

                            <div id="nationalCalendarSettingsContainer" class="container">
                                <h3 id="nationalCalendarSettingsTitle" class="text-center"><?php echo _("National calendar settings") ?></h3>
                                <form id="nationalCalendarSettingsForm" class="row justify-content-center needs-validation" novalidate>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _( 'EPIPHANY' ) ?></label>
                                        <select class="form-control" id="nationalCalendarSettingEpiphany">
                                            <option value=""></option>
                                            <option value="JAN6"><?php echo _("January 6") ?></option>
                                            <option value="SUNDAY_JAN2_JAN8"><?php echo _("Sunday between January 2 and January 8") ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _( 'ASCENSION' ) ?></label>
                                        <select class="form-control" id="nationalCalendarSettingAscension">
                                            <option value=""></option>
                                            <option value="THURSDAY"><?php echo $thursday ?></option>
                                            <option value="SUNDAY"><?php echo $sunday ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _( 'CORPUS CHRISTI' ) ?></label>
                                        <select class="form-control" id="nationalCalendarSettingCorpusChristi">
                                            <option value=""></option>
                                            <option value="THURSDAY"><?php echo $thursday ?></option>
                                            <option value="SUNDAY"><?php echo $sunday ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _( 'LOCALE' ) ?></label>
                                        <select class="form-control" id="nationalCalendarSettingLocale">
                                            <?php
                                                foreach( $AvailableLocales as $AvlLOCALE => $AvlLANGUAGE ) {
                                                    echo "<option value=\"{$AvlLOCALE}\"" . ($i18n->LOCALE === $AvlLOCALE ? ' selected' : '') . ">{$AvlLANGUAGE}</option>";
                                                }
                                            ?>
                                        </select>
                                    </div>

                                    <div class="form col col-md-6">
                                        <div class="row">
                                            <label><?php echo _( 'Published Roman Missals' ) ?></label><button class="btn btn-sm btn-primary ml-2 mb-2" id="addPublishedRomanMissal" data-toggle="modal" data-target="#addPublishedRomanMissalPrompt" type="button"><i class="fas fa-plus mr-2"></i><?php echo _( 'Add Missal' ) ?></button>
                                        </div>
                                        <div class="row">
                                            <ul class="list-group" id="publishedRomanMissalList" style="width: 250px;">
                                            </ul>
                                        </div>
                                    </div>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _( 'Wider Region' ) ?></label>
                                        <input class="form-control" type="text" id="associatedWiderRegion" />
                                    </div>
                                </form>
                            </div>
                            <hr>
                            <form class="needs-validation regionalNationalDataForm" id="nationalCalendarForm" novalidate>
                            </form>
                            <hr>
                            <div class="d-flex justify-content-around">
                                <button class="btn btn-sm btn-primary m-2" id="makePatronAction" data-toggle="modal" data-target="#makePatronActionPrompt"><i class="fas fa-user-graduate mr-2"></i><?php echo _( "Designate patron from existing festivity" ) ?></button>
                                <button class="btn btn-sm btn-primary m-2" id="setPropertyAction" data-toggle="modal" data-target="#setPropertyActionPrompt"><i class="fas fa-edit mr-2"></i><?php echo _( "Change name or grade of existing festivity" ) ?></button>
                                <button class="btn btn-sm btn-primary m-2" id="moveFestivityAction" data-toggle="modal" data-target="#moveFestivityActionPrompt"><i class="fas fa-calendar-day mr-2"></i><?php echo _( "Move festivity to new date" ) ?></button>
                                <button class="btn btn-sm btn-primary m-2" id="newFestivityAction" data-toggle="modal" data-target="#newFestivityActionPrompt"><i class="far fa-calendar-plus mr-2"></i><?php echo _( "Create a new festivity" ) ?></button>
                            </div>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 serializeRegionalNationalData" id="serializeNationalCalendarData" data-category="nationalCalendar" disabled><i class="fas fa-save mr-2"></i><?php echo _("Save National Calendar Data") ?></button>
                        </div>
                    </div>
                </div>
                <?php
            break;
            case "diocesan":
                FormControls::$settings["toYearField"] = false;
                ?>
                <div class="container">
                    <form class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarNationalDependency" class="font-weight-bold"><?php echo _( "Depends on national calendar"); ?>:</label>
                            <select class="form-control" id="diocesanCalendarNationalDependency" required>
                                <option value=""></option>
                                <?php
                                    foreach( $availableNationalCalendars as $nation => $displayName ) {
                                        echo "<option value=\"{$nation}\">$displayName</option>";
                                    }
                                ?>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarDioceseName" class="font-weight-bold"><?php echo _( "Diocese"); ?>:</label>
                            <input list="DiocesesList" class="form-control" id="diocesanCalendarDioceseName" required>
                            <div class="invalid-feedback"><?php echo _( "This diocese does not seem to exist? Please choose from a value in the list."); ?></div>
                            <datalist id="DiocesesList">
                                <option value=""></option>
                            </datalist>
                            <div class="col text-center"><button class="btn btn-primary m-2" id="retrieveExistingDiocesanData" disabled><?php echo _( "Retrieve existing data"); ?></button></div>
                            <div class="col text-center"><button class="btn btn-danger m-2" id="removeExistingDiocesanData" disabled data-toggle="modal" data-target="#removeDiocesanCalendarPrompt"><?php echo _( "Remove existing data"); ?></button></div>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarGroup" class="font-weight-bold"><?php echo _( "Diocesan group"); ?>:</label>
                            <input list="DiocesanGroupsList" class="form-control" id="diocesanCalendarGroup" aria-describedby="diocesanCalendarGroupHelp">
                            <datalist id="DiocesanGroupsList">
                                <option value=""></option>
                                <?php
                                    foreach( $DiocesanGroups as $diocesanGroup ) {
                                        echo "<option value=\"$diocesanGroup\">$diocesanGroup</option>";
                                    }
                                ?>
                            </datalist>
                            <small id="diocesanCalendarGroupHelp" class="form-text text-muted"><?php echo $DioceseGroupHelp; ?></small>
                        </div>
                    </form>
                </div>

                <nav aria-label="Diocesan calendar definition" id="diocesanCalendarDefinitionCardLinks">
                    <ul class="pagination pagination-lg justify-content-center m-1">
                        <li class="page-item disabled">
                            <a class="page-link diocesan-carousel-prev" href="#" tabindex="-1" aria-disabled="true" aria-labeled="Previous"><span aria-hidden="true">&laquo;</span></a>
                        </li>
                        <li class="page-item active"><a class="page-link" href="#" data-slide-to="0"><?php echo _( "Solemnities" ); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-slide-to="1"><?php echo _( "Feasts" ); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-slide-to="2"><?php echo _( "Memorials" ); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-slide-to="3"><?php echo _( "Optional memorials" ); ?></a></li>
                        <li class="page-item">
                            <a class="page-link diocesan-carousel-next" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>
                        </li>
                    </ul>
                </nav>

                <div id="carouselExampleIndicators" class="carousel slide" data-interval="false">
                    <ol class="carousel-indicators">
                        <li data-target="#carouselExampleIndicators" data-slide-to="0" class="active"></li>
                        <li data-target="#carouselExampleIndicators" data-slide-to="1" class=""></li>
                        <li data-target="#carouselExampleIndicators" data-slide-to="2" class=""></li>
                        <li data-target="#carouselExampleIndicators" data-slide-to="3" class=""></li>
                    </ol>
                    <div class="carousel-inner">
                        <div class="carousel-item active" id="carouselItemSolemnities">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Create a Diocesan Calendar"); ?>: <?php echo _( "Define the Solemnities"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Principal Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Dedication of the Cathedral")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Solemnity")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addSolemnity">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="carousel-item" id="carouselItemFeasts">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Create a Diocesan Calendar"); ?>: <?php echo _( "Define the Feasts"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Dedication of the Cathedral")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Feast")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addFeast">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="carousel-item" id="carouselItemMemorials">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Create a Diocesan Calendar"); ?>: <?php echo _( "Define the Memorials"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Secondary Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Memorial")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Memorial")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addMemorial">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="carousel-item" id="carouselItemOptionalMemorials">
                            <div class="container-fluid">
                                <div class="card border-left-primary mr-5 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 font-weight-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-gray-300 mr-4"></i><?php echo _( "Create a Diocesan Calendar"); ?>: <?php echo _( "Define the Optional Memorials"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col mr-2">-->
                                                <form class="needs-validation" novalidate>
                                                    <?php $FormControls->CreateFestivityRow( _( "Saints whos veneration is local to the Place, Diocese, Region, Province or Territory")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Optional Memorial")) ?>
                                                    <?php $FormControls->CreateFestivityRow( _( "Other Optional Memorial")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addOptionalMemorial">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="sr-only">Previous</span>
                    </a>
                    <a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="sr-only">Next</span>
                    </a>
                </div>

                <div id="diocesanOverridesContainer" class="container">
                    <h3 id="diocesanOverridesTitle" class="text-center"><?php echo _("Diocesan overrides to the national calendar for ...") ?></h3>
                    <form id="diocesanOverridesForm" class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label><?php echo _( 'EPIPHANY' ) ?></label>
                            <select class="form-control" id="diocesanCalendarOverrideEpiphany">
                                <option value=""></option>
                                <option value="JAN6"><?php echo _("January 6") ?></option>
                                <option value="SUNDAY_JAN2_JAN8"><?php echo _("Sunday between January 2 and January 8") ?></option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label><?php echo _( 'ASCENSION' ) ?></label>
                            <select class="form-control" id="diocesanCalendarOverrideAscension">
                                <option value=""></option>
                                <option value="THURSDAY"><?php echo $thursday ?></option>
                                <option value="SUNDAY"><?php echo $sunday ?></option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label><?php echo _( 'CORPUS CHRISTI' ) ?></label>
                            <select class="form-control" id="diocesanCalendarOverrideCorpusChristi">
                                <option value=""></option>
                                <option value="THURSDAY"><?php echo $thursday ?></option>
                                <option value="SUNDAY"><?php echo $sunday ?></option>
                            </select>
                        </div>
                    </form>
                </div>

                <div class="container">
                    <div class="row">
                        <div class="col text-center">
                            <button class="btn btn-lg btn-primary m-1" id="saveDiocesanCalendar_btn"><?php echo _( "SAVE DIOCESAN CALENDAR") ?></button>
                        </div>
                    </div>
                </div>
                <?php
            break;
        }
    }
?>
<script>
const messages = <?php echo json_encode($messages); ?>;
const FestivityCollection = <?php echo json_encode($FestivityCollection); ?>;
</script>
<?php include_once('./layout/footer.php'); ?>

<!-- DEFINE MAKE PATRON MODAL  -->
<div class="modal fade actionPromptModal" id="makePatronActionPrompt" tabindex="-1" role="dialog" aria-labelledby="makePatronActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="makePatronActionModalLabel"><?php echo _( "Designate patron from existing festivity" ) ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-center needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="existingFestivityName" class="font-weight-bold"><?php echo _( "Choose from existing festivities"); ?>:</label>
                        <input list="existingFestivitiesList" class="form-control existingFestivityName" required>
                        <div class="invalid-feedback"><?php echo _( "This festivity does not seem to exist? Please choose from a value in the list."); ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="designatePatronButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-user-graduate mr-2"></i><?php echo _( "Designate patron" ) ?></button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-window-close mr-2"></i><?php echo _( "Cancel" ) ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE SET PROPERTY MODAL  -->
<div class="modal fade actionPromptModal" id="setPropertyActionPrompt" tabindex="-1" role="dialog" aria-labelledby="setPropertyActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="setPropertyActionModalLabel"><?php echo _( "Change name or grade of existing festivity" ) ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-left needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="existingFestivityName" class="font-weight-bold"><?php echo _( "Choose from existing festivities"); ?>:</label>
                        <input list="existingFestivitiesList" class="form-control existingFestivityName" required>
                        <div class="invalid-feedback"><?php echo _( "This festivity does not seem to exist? Please choose from a value in the list."); ?></div>
                    </div>
                    <div class="form-group col col-md-6">
                        <label for="propertyToChange" class="font-weight-bold"><?php echo _( "Property to change" ); ?>:</label>
                        <select class="form-control" id="propertyToChange" name="propertyToChange">
                            <option value="name"><?php echo _( "Name" ); ?></option>
                            <option value="grade"><?php echo _( "Grade" ); ?></option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="setPropertyButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-edit mr-2"></i>Set Property</button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-window-close mr-2"></i><?php echo _( "Cancel" ) ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE MOVE FESTIVITY MODAL  -->
<div class="modal fade actionPromptModal" id="moveFestivityActionPrompt" tabindex="-1" role="dialog" aria-labelledby="moveFestivityActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="moveFestivityActionModalLabel"><?php echo _( "Move festivity to new date" ) ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-center needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="existingFestivityName" class="font-weight-bold"><?php echo _( "Choose from existing festivities"); ?>:</label>
                        <input list="existingFestivitiesList" class="form-control existingFestivityName" required>
                        <div class="invalid-feedback"><?php echo _( "This festivity does not seem to exist? Please choose from a value in the list." ); ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="moveFestivityButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-day mr-2"></i><?php echo _( "Move Festivity" ) ?></button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-window-close mr-2"></i><?php echo _( "Cancel" ) ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE NEW FESTIVITY MODAL  -->
<div class="modal fade actionPromptModal" id="newFestivityActionPrompt" tabindex="-1" role="dialog" aria-labelledby="newFestivityActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="newFestivityActionModalLabel"><?php echo _( "Create a new festivity" ) ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-center needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="existingFestivityName" class="font-weight-bold"><?php echo _( "Choose from existing festivities"); ?>:</label>
                        <input list="existingFestivitiesList" class="form-control existingFestivityName">
                        <div class="invalid-feedback"><?php echo _( "This festivity does not seem to exist? Please choose from a value in the list."); ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="newFestivityFromExistingButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-plus mr-2"></i><?php echo _( "New Festivity from existing" ) ?></button>
                <button type="button" id="newFestivityExNovoButton" class="btn btn-primary actionPromptButton"><i class="fas fa-calendar-plus mr-2"></i><?php echo _( "New Festivity ex novo" ) ?></button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-window-close mr-2"></i><?php echo _( "Cancel" ) ?></button>
            </div>
        </div>
    </div>
</div>

<!-- addPublishedRomanMissalPrompt -->
<div class="modal fade" id="addPublishedRomanMissalPrompt" tabindex="-1" role="dialog" aria-labelledby="addPublishedRomanMissalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addPublishedRomanMissalLabel"><?php echo _( 'Add Missal' ) ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-center needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="languageEditionRomanMissalName" class="font-weight-bold"><?php echo _( "Choose from known Roman Missal language editions"); ?>:</label>
                        <input list="languageEditionRomanMissalList" class="form-control" id="languageEditionRomanMissalName">
                        <div class="invalid-feedback"><?php echo _( "This Missal is unknown to the Liturgical Calendar API. Please choose from a value in the list, or contact the curator of the API to have the Missal added to known language edition Missals."); ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="addLanguageEditionRomanMissal" class="btn btn-primary" disabled><i class="fas fa-calendar-plus mr-2"></i><?php echo _( "Add language edition Roman Missal" ) ?></button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-window-close mr-2"></i><?php echo _( "Cancel" ) ?></button>
            </div>
        </div>
    </div>
</div>

<datalist id="existingFestivitiesList">
<?php
    foreach( $FestivityCollection as $key => $festivity ) {
        echo "<option value=\"{$key}\">{$festivity["NAME"]}</option>";
    }
?>
</datalist>

<datalist id="languageEditionRomanMissalList"></datalist>

</body>
</html>
