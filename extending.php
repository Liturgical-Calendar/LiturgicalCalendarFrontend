<?php

use LiturgicalCalendar\Frontend\FormControls;
use LiturgicalCalendar\Frontend\Utilities;

include_once "common.php"; // provides $i18n and all API URLs

$FormControls = new FormControls($i18n);

$dayOfWeekFmt = IntlDateFormatter::create($i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN, 'EEEE');
$thursday   = $dayOfWeekFmt->format(DateTime::createFromFormat('!j-n-Y', '1-1-2022', new DateTimeZone('UTC'))->modify('next Thursday'));
$sunday     = $dayOfWeekFmt->format(DateTime::createFromFormat('!j-n-Y', '1-1-2022', new DateTimeZone('UTC'))->modify('next Sunday'));

$AvailableNationalCalendars = [];

$c = new Collator($i18n->LOCALE);


[ "litcal_metadata" => $LitCalMetadata ] = json_decode(
    file_get_contents($metadataURL),
    true
);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $eventsURL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept-Language: " . $i18n->LOCALE
]);
$response = curl_exec($ch);
[ "litcal_events" => $FestivityCollection ] = json_decode(
    $response,
    true
);
curl_close($ch);

[ "catholic_dioceses_latin_rite" => $CatholicDiocesesByNation ] = json_decode(
    file_get_contents("./assets/data/WorldDiocesesByNation.json"),
    true
);

$DiocesanGroups = $LitCalMetadata["diocesan_groups"];

// National Calendars that have been defined in the API except "Vatican"
$NationalCalendars = array_values(array_filter(
    $LitCalMetadata["national_calendars"],
    fn($calendar) => isset($calendar['calendar_id']) && $calendar['calendar_id'] !== 'VA'
));
foreach ($NationalCalendars as $calendar) {
    $AvailableNationalCalendars[$calendar['calendar_id']] = Locale::getDisplayRegion("-" . $calendar['calendar_id'], $i18n->LOCALE);
}
$c->asort($AvailableNationalCalendars);

// Extract the 'country_iso' values from the CatholicDiocesesByNation array and transform values to upper case
$CountryIso = array_map('strtoupper', array_column($CatholicDiocesesByNation, 'country_iso'));
$DisplayRegions = array_map(fn ($item) => Locale::getDisplayRegion("-" . $item, $i18n->LOCALE), $CountryIso);
$CountriesWithCatholicDioceses = array_combine($CountryIso, $DisplayRegions);
$c->asort($CountriesWithCatholicDioceses);


$SystemLocalesWithRegion = array_filter(ResourceBundle::getLocales(''), function ($value) use ($i18n) {
    return strpos($value, 'POSIX') === false && Locale::getDisplayRegion($value, $i18n->LOCALE) !== "";
});
$SystemLocalesWithRegion = array_reduce($SystemLocalesWithRegion, function ($carry, $item) use ($i18n) {
    //$carry[$item] = Locale::getDisplayLanguage($item, $i18n->LOCALE)
    //    . (Locale::getDisplayRegion($item, $i18n->LOCALE) !== ""
    //          ? " (" . Locale::getDisplayRegion($item, $i18n->LOCALE) . ")"
    //          : "");
    $carry[$item] = Locale::getDisplayName($item, $i18n->LOCALE);
    return $carry;
}, []);
$c->asort($SystemLocalesWithRegion);

$SystemLocalesWithoutRegion = array_filter(ResourceBundle::getLocales(''), function ($value) {
    return strpos($value, '_') === false;
});
$SystemLocalesWithoutRegion = array_reduce($SystemLocalesWithoutRegion, function ($carry, $item) use ($i18n) {
    $carry[$item] = Locale::getDisplayLanguage($item, $i18n->LOCALE);
    return $carry;
}, []);
$c->asort($SystemLocalesWithoutRegion);

$API_EXTEND_HOWTO_A = _("The General Roman Calendar can be extended so as to create a National or Diocesan calendar. Diocesan calendars depend on National calendars, so the National calendar must first be created.");
$API_EXTEND_HOWTO_A1 = _('The first step in creating a national or diocesan calendar, is to translate the data for the General Roman Calendar into the language for that nation or diocese.');
$API_EXTEND_HOWTO_A1a = _('(see <a href="translations.php">Translations</a>)');
$API_EXTEND_HOWTO_A2 = _("A national calendar may have some festivities in common with other national calendars, for example the patron of a wider region.");
$API_EXTEND_HOWTO_A3 = _("In this case, the festivities for the wider region should be defined separately, and the languages applicable to the wider region should be set; the wider region data will then be applied automatically to national calendars belonging to the wider region.");
$DioceseGroupHelp = _("If a group of dioceses decides to pool their Liturgical Calendar data, for example to print out one single yearly calendar with the data for all the dioceses in the group, the group can be defined or set here.");

$messages = [
    "Tag"                => _("Tag"),
    "Name"               => _("Name"),
    "Day"                => _("Day"),
    "Month"              => _("Month"),
    "Other Solemnity"    => _("Other Solemnity"),
    "Other Feast"        => _("Other Feast"),
    "Other Memorial"     => _("Other Memorial"),
    "Other Optional Memorial"   => _("Other Optional Memorial"),
    "Delete calendar"    => _("Delete calendar"),
    "If you choose"      => _("If you choose to delete this calendar, the liturgical events defined for the calendar and the corresponding index entries will be removed and no longer available in the client applications."),
    "Liturgical color"   => _("Liturgical color"),
    "white"              => _("white"),
    "red"                => _("red"),
    "green"              => _("green"),
    "purple"             => _("purple"),
    /**translators: in reference to the first year from which this festivity takes place */
    "Since"              => _("Since"),
    /**translators: in reference to the year from which this festivity no longer needs to be dealt with */
    "Until"              => _("Until"),
    /**translators: label of the form row */
    "Designate patron"   => _("Patron or Patrons of the Wider Region"),
    /**translators: label of the form row */
    "New festivity"      => _("New festivity"),
    /**translators: label of the form row */
    "Change name or grade" => _("Change name or grade"),
    /**translators: label of the form row */
    "Move festivity"     => _("Move festivity"),
    "Decree URL"         => _("Decree URL"),
    "Decree Langs"       => _("Decree Language mappings"),
    "Missal"             => _("Missal"),
    "Reason"             => _("Reason (in favor of festivity)"),
    "commonsTemplate"    => $FormControls->getCommonsTemplate(),
    "gradeTemplate"      => $FormControls->getGradeTemplate(),
    "LOCALE"             => $i18n->LOCALE,
    "LOCALE_WITH_REGION" => $i18n->LOCALE_WITH_REGION,
    "AvailableLocales"   => $SystemLocalesWithoutRegion,
    "AvailableLocalesWithRegion"    => $SystemLocalesWithRegion,
    "CountriesWithCatholicDioceses" => $CountriesWithCatholicDioceses
];

$buttonGroup = "<hr><div class=\"d-flex justify-content-around\">
<button class=\"btn btn-sm btn-primary m-2\" id=\"makePatronAction\" data-bs-toggle=\"modal\" data-bs-target=\"#makePatronActionPrompt\"><i class=\"fas fa-user-graduate me-2\"></i>" . _("Designate patron from existing festivity") . "</button>
<button class=\"btn btn-sm btn-primary m-2\" id=\"setPropertyAction\" data-bs-toggle=\"modal\" data-bs-target=\"#setPropertyActionPrompt\"><i class=\"fas fa-edit me-2\"></i>" . _("Change name or grade of existing festivity") . "</button>
<button class=\"btn btn-sm btn-primary m-2\" id=\"moveFestivityAction\" data-bs-toggle=\"modal\" data-bs-target=\"#moveFestivityActionPrompt\"><i class=\"fas fa-calendar-day me-2\"></i>" . _("Move festivity to new date") . "</button>
<button class=\"btn btn-sm btn-primary m-2\" id=\"newFestivityAction\" data-bs-toggle=\"modal\" data-bs-target=\"#newFestivityActionPrompt\"><i class=\"far fa-calendar-plus me-2\"></i>" . _("Create a new festivity") . "</button>
</div>";

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _("General Roman Calendar - Extending") ?></title>
    <?php include_once('layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _("Extend the General Roman Calendar with National or Diocesan data"); ?></h1>
        <p class="mb-1 lh-sm"><small><i><?php echo $API_EXTEND_HOWTO_A . " " . $API_EXTEND_HOWTO_A1 . " " . $API_EXTEND_HOWTO_A1a . " " . $API_EXTEND_HOWTO_A2 . " " . $API_EXTEND_HOWTO_A3; ?></i></small></p>
<?php
if (isset($_GET["choice"])) {
    switch ($_GET["choice"]) {
        case "widerRegion":
            //FormControls::$settings["untilYearField"] = true;
            ?>
                <div class="container-fluid">
                    <form class="row justify-content-center align-items-end needs-validation regionalNationalSettingsForm" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="widerRegionCalendarName" class="fw-bold"><?php echo _("Wider Region"); ?></label>
                            <input list="WiderRegionsList" class="form-control regionalNationalCalendarName" id="widerRegionCalendarName" data-category="widerregion" required>
                            <div class="invalid-feedback"><?php echo _("This value cannot be empty."); ?></div>
                            <datalist id="WiderRegionsList">
                                <option value=""></option>
                            <?php
                            foreach ($LitCalMetadata["wider_regions"] as $widerRegion) {
                                foreach ($widerRegion["locales"] as $widerRegionLanguage) {
                                    echo "<option value=\"{$widerRegion['name']} - {$widerRegionLanguage}\">{$widerRegion['name']}</option>";
                                }
                            }
                            ?>
                            </datalist>
                        </div>
                        <div class="col col-md-3">
                            <div>
                                <label for="widerRegionLocales" class="fw-bold"><?php echo _("Locales") ?></label>
                                <select class="form-select calendarLocales" id="widerRegionLocales" multiple="multiple">
                                <?php foreach ($SystemLocalesWithRegion as $locale => $lang_region) {
                                        echo "<option value='$locale'>$lang_region</option>";
                                } ?>
                                </select>
                            </div>
                        </div>
                        <div class="col col-md-3">
                            <label for="currentLocalization" class="fw-bold"><?php echo _('Current localization') ?></label>
                            <select class="form-select currentLocalizationChoices" id="currentLocalization">
                                <?php
                                foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                    echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                }
                                ?>
                            </select>
                        </div>
                        <div class="col col-md-3">
                            <button class="btn btn-danger" id="removeExistingCalendarDataBtn" disabled data-bs-toggle="modal" data-bs-target="#removeCalendarDataPrompt">
                                <i class="far fa-trash-alt me-2"></i>
                                <?php echo _("Remove existing data"); ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 m-4">
                        <div class="card-header py-3">
                            <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _("Create a Calendar for a Wider Region"); ?></h4>
                        </div>
                        <div class="card-body">
                            <hr>
                            <form class="needs-validation regionalNationalDataForm" id="widerRegionForm" novalidate>
                            </form>
                            <?php echo $buttonGroup ?>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 serializeRegionalNationalData" id="serializeWiderRegionData" data-category="widerregion" disabled><i class="fas fa-save me-2"></i><?php echo _("Save Wider Region Calendar Data") ?></button>
                        </div>
                    </div>
                </div>
                <?php
            break;
        case "national":
            ?>
                <div class="container-fluid">
                    <form class="row justify-content-center needs-validation align-items-center regionalNationalSettingsForm" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="nationalCalendarName" class="fw-bold"><?php echo _("National Calendar"); ?></label>
                            <input list="nationalCalendarsList" class="form-control regionalNationalCalendarName" id="nationalCalendarName" data-category="nation" required>
                            <div class="invalid-feedback"><?php echo _("This value cannot be empty."); ?></div>
                            <datalist id="nationalCalendarsList">
                            <?php
                            foreach ($CountriesWithCatholicDioceses as $isoCode => $countryLocalized) {
                                echo "<option value=\"{$isoCode}\">{$countryLocalized}</option>";
                            }
                            ?>
                            </datalist>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="removeExistingCalendarDataBtn" class="fw-bold"></label>
                            <button class="btn btn-danger m-2 form-control" id="removeExistingCalendarDataBtn" disabled data-bs-toggle="modal" data-bs-target="#removeCalendarDataPrompt">
                                <i class="far fa-trash-alt me-2"></i>
                                <?php echo _("Remove existing data"); ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 m-4">
                        <div class="card-header py-3">
                            <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _("Create a National Calendar"); ?></h4>
                        </div>
                        <div class="card-body">

                            <div id="nationalCalendarSettingsContainer" class="container">
                                <h3 id="nationalCalendarSettingsTitle" class="text-center"><?php echo _("National calendar settings") ?><i class="fas fa-info-circle ms-4 d-inline-block text-black" style="--bs-text-opacity: .3;" role="button" title="please keep in mind that the first step to creating a national calendar, is to translate the already existing calendar data into the correct language. This can be done on the LitCal translation server (see above for details)"></i></h3>
                                <form id="nationalCalendarSettingsForm" class="row justify-content-center align-items-baseline needs-validation" novalidate>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _('EPIPHANY') ?></label>
                                        <select class="form-select" id="nationalCalendarSettingEpiphany">
                                            <option value=""></option>
                                            <option value="JAN6"><?php echo _("January 6") ?></option>
                                            <option value="SUNDAY_JAN2_JAN8"><?php echo _("Sunday between January 2 and January 8") ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-2">
                                        <label><?php echo _('ASCENSION') ?></label>
                                        <select class="form-select" id="nationalCalendarSettingAscension">
                                            <option value=""></option>
                                            <option value="THURSDAY"><?php echo $thursday ?></option>
                                            <option value="SUNDAY"><?php echo $sunday ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-2">
                                        <label><?php echo _('CORPUS CHRISTI') ?></label>
                                        <select class="form-select" id="nationalCalendarSettingCorpusChristi">
                                            <option value=""></option>
                                            <option value="THURSDAY"><?php echo $thursday ?></option>
                                            <option value="SUNDAY"><?php echo $sunday ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-2">
                                        <label><?php echo _('ETERNAL HIGH PRIEST') ?></label>
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" role="switch" id="nationalCalendarSettingHighPriest">
                                            <i class="fas fa-info-circle ms-4 d-inline-block text-black" style="--bs-text-opacity: .3;" role="button" title="In 2012, Pope Benedict XVI gave faculty to the Episcopal Conferences to insert the Feast of Jesus Christ Eternal High Priest in their own liturgical calendars on the Thursday after Pentecost."></i>
                                        </div>
                                    </div>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _('LOCALES') ?></label>
                                        <select class="form-select calendarLocales" id="nationalCalendarLocales" multiple="multiple">
                                        <?php
                                        foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                            echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                        }
                                        ?>
                                        </select>
                                    </div>

                                    <div class="col col-md-6 mt-4">
                                        <div class="row mt-2">
                                            <div class="col-5">
                                                <label><i class="fas fa-info-circle me-2 text-black" style="--bs-text-opacity: .3;" role="button" title="if data from the Proper of Saints of a given Missal for this nation has already been incorporated into the main LitCal engine, you can choose the Missal from this list to associate it with this National Calendar (if the Missal is not in the list, it has not been incorporated into the LitCal engine)"></i><?php echo _('Published Roman Missals') ?></label>
                                            </div>
                                            <div class="col-4">
                                                <button class="btn btn-sm btn-primary ms-2 mb-2" id="addPublishedRomanMissal" data-bs-toggle="modal" data-bs-target="#addPublishedRomanMissalPrompt" type="button"><i class="fas fa-plus me-2"></i><?php echo _('Add Missal') ?></button>
                                            </div>
                                        </div>
                                        <div class="row">
                                            <ul class="list-group" id="publishedRomanMissalList" style="width: 250px;">
                                            </ul>
                                        </div>
                                    </div>
                                    <div class="form-group col col-md-3 mt-4">
                                        <label for="associatedWiderRegion"><?php echo _('Wider Region') ?><i class="fas fa-info-circle ms-2 text-black" style="--bs-text-opacity: .3;" role="button" title="if data for a Wider Region that regards this National Calendar has already been defined, you can associate the Wider Region data with the National Calendar here"></i></label>
                                        <input class="form-control" type="text" id="associatedWiderRegion" />
                                    </div>
                                    <div class="form-group col col-md-3 mt-4">
                                        <label for="currentLocalization"><?php echo _('Current localization') ?></label>
                                        <select class="form-select currentLocalizationChoices" id="currentLocalization">
                                            <?php
                                            foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                                echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                            }
                                            ?>
                                        </select>
                                    </div>
                                </form>
                            </div>
                            <hr>
                            <form class="needs-validation regionalNationalDataForm" id="nationalCalendarForm" novalidate>
                            </form>
                            <?php echo $buttonGroup ?>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 serializeRegionalNationalData" id="serializeNationalCalendarData" data-category="nation" disabled><i class="fas fa-save me-2"></i><?php echo _("Save National Calendar Data") ?></button>
                        </div>
                    </div>
                </div>
                <?php
            break;
        case "diocesan":
            FormControls::$settings["untilYearField"] = true;
            ?>
                <div class="container mb-5">
                    <form class="needs-validation" novalidate>
                        <div class="row justify-content-center align-items-baseline ">
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarNationalDependency" class="fw-bold"><?php echo _("Depends on national calendar"); ?>:</label>
                                <select class="form-select" id="diocesanCalendarNationalDependency" required>
                                    <option value=""></option>
                                <?php
                                foreach ($AvailableNationalCalendars as $nation => $displayName) {
                                    echo "<option value=\"{$nation}\">$displayName</option>";
                                }
                                ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarDioceseName" class="fw-bold"><?php echo _("Diocese"); ?>:</label>
                                <input list="DiocesesList" class="form-control" id="diocesanCalendarDioceseName" required>
                                <div class="invalid-feedback"><?php echo _("This diocese does not seem to exist? Please choose from a value in the list to retrieve an existing diocese, or ignore if creating a new diocesan calendar."); ?></div>
                                <datalist id="DiocesesList">
                                    <option value=""></option>
                                </datalist>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarGroup" class="fw-bold"><?php echo _("Diocesan group"); ?>: <i class="fas fa-circle-info mx-2" title="<?php echo $DioceseGroupHelp; ?>"></i></label>
                                <input list="DiocesanGroupsList" class="form-control" id="diocesanCalendarGroup" aria-describedby="diocesanCalendarGroupHelp">
                                <datalist id="DiocesanGroupsList">
                                    <option value=""></option>
                                    <?php
                                    foreach ($DiocesanGroups as $diocesanGroup) {
                                        echo "<option value=\"{$diocesanGroup['group_name']}\">{$diocesanGroup['group_name']}</option>";
                                    }
                                    ?>
                                </datalist>
                            </div>
                        </div>
                        <div class="row justify-content-center align-items-baseline">
                            <div class="form-group col col-md-3">
                                <label><?php echo '<b>' . ucwords(strtolower(_('LOCALES'))) . ':</b>' ?></label>
                                <select class="form-select calendarLocales" id="diocesanCalendarLocales" multiple="multiple">
                                <?php
                                foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                    echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                }
                                ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="currentLocalization" class="fw-bold"><?php echo _("Current localization"); ?>:</label>
                                <select class="form-select currentLocalizationChoices" id="currentLocalization">
                                    <option value=""></option>
                                    <?php
                                    foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                        echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                    }
                                    ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarTimezone" class="fw-bold"><?php echo _("Timezone"); ?></label>
                                <select class="form-select" id="diocesanCalendarTimezone">
                                    <option value=""></option>
                                </select>
                            </div>
                            <div class="col col-md-3 text-center align-self-end">
                                <button class="btn btn-danger" id="removeExistingDiocesanDataBtn" disabled data-bs-toggle="modal" data-bs-target="#removeDiocesanCalendarPrompt"><?php echo _("Remove existing data"); ?></button>
                            </div>
                        </div>
                    </form>
                </div>

                <nav aria-label="Diocesan calendar definition" id="diocesanCalendarDefinitionCardLinks">
                    <ul class="pagination pagination-lg justify-content-center m-1">
                        <li class="page-item disabled">
                            <a class="page-link diocesan-carousel-prev" href="#" tabindex="-1" aria-disabled="true" aria-labeled="Previous"><span aria-hidden="true">&laquo;</span></a>
                        </li>
                        <li class="page-item active"><a class="page-link" href="#" data-bs-slide-to="0"><?php echo _("Solemnities"); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="1"><?php echo _("Feasts"); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="2"><?php echo _("Memorials"); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="3"><?php echo _("Optional memorials"); ?></a></li>
                        <li class="page-item">
                            <a class="page-link diocesan-carousel-next" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>
                        </li>
                    </ul>
                </nav>

                <div id="carouselExampleIndicators" class="carousel slide" data-bs-interval="false">
                    <ol class="carousel-indicators">
                        <li data-bs-target="#carouselExampleIndicators" data-bs-slide-to="0" class="active"></li>
                        <li data-bs-target="#carouselExampleIndicators" data-bs-slide-to="1" class=""></li>
                        <li data-bs-target="#carouselExampleIndicators" data-bs-slide-to="2" class=""></li>
                        <li data-bs-target="#carouselExampleIndicators" data-bs-slide-to="3" class=""></li>
                    </ol>
                    <div class="carousel-inner">
                        <div class="carousel-item active" id="carouselItemSolemnities">
                            <div class="container-fluid">
                                <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 my-4 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _("Create a Diocesan Calendar"); ?>: <?php echo _("Define the Solemnities"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createFestivityRow(_("Principal Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                <?php $FormControls->createFestivityRow(_("Dedication of the Cathedral")) ?>
                                                <?php $FormControls->createFestivityRow(_("Other Solemnity")) ?>
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
                                <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 my-4 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _("Create a Diocesan Calendar"); ?>: <?php echo _("Define the Feasts"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createFestivityRow(_("Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                <?php $FormControls->createFestivityRow(_("Dedication of the Cathedral")) ?>
                                                <?php $FormControls->createFestivityRow(_("Other Feast")) ?>
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
                                <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 my-4 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _("Create a Diocesan Calendar"); ?>: <?php echo _("Define the Memorials"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createFestivityRow(_("Secondary Patron(s) of the Place, Diocese, Region, Province or Territory")) ?>
                                                <?php $FormControls->createFestivityRow(_("Other Memorial")) ?>
                                                <?php $FormControls->createFestivityRow(_("Other Memorial")) ?>
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
                                <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 my-4 mx-5">
                                    <div class="card-header py-3">
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _("Create a Diocesan Calendar"); ?>: <?php echo _("Define the Optional Memorials"); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createFestivityRow(_("Saints whos veneration is local to the Place, Diocese, Region, Province or Territory")) ?>
                                                <?php $FormControls->createFestivityRow(_("Other Optional Memorial")) ?>
                                                <?php $FormControls->createFestivityRow(_("Other Optional Memorial")) ?>
                                                </form>
                                                <div class="text-center"><button class="btn btn-lg btn-primary m-3 onTheFlyEventRow" id="addOptionalMemorial">+</button></div>
                                            <!--</div>
                                        </div>-->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="sr-only">Previous</span>
                    </a>
                    <a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="sr-only">Next</span>
                    </a>
                </div>

                <div id="diocesanOverridesContainer" class="container">
                    <p id="diocesanOverridesTitle" class="text-center"><?php echo _("Diocesan overrides to the national calendar for …") ?></p>
                    <form id="diocesanOverridesForm" class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label><?php echo _('EPIPHANY') ?></label>
                            <select class="form-select" id="diocesanCalendarOverrideEpiphany">
                                <option value=""></option>
                                <option value="JAN6"><?php echo _("January 6") ?></option>
                                <option value="SUNDAY_JAN2_JAN8"><?php echo _("Sunday between January 2 and January 8") ?></option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label><?php echo _('ASCENSION') ?></label>
                            <select class="form-select" id="diocesanCalendarOverrideAscension">
                                <option value=""></option>
                                <option value="THURSDAY"><?php echo $thursday ?></option>
                                <option value="SUNDAY"><?php echo $sunday ?></option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label><?php echo _('CORPUS CHRISTI') ?></label>
                            <select class="form-select" id="diocesanCalendarOverrideCorpusChristi">
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
                            <button class="btn btn-lg btn-primary m-1" id="saveDiocesanCalendar_btn"><?php echo _("SAVE DIOCESAN CALENDAR") ?></button>
                        </div>
                    </div>
                </div>
                <?php
            break;
    }
}
?>
<script>
const Messages = <?php echo json_encode($messages); ?>;
const LitCalMetadata = <?php echo json_encode($LitCalMetadata); ?>;
let FestivityCollection = <?php echo json_encode($FestivityCollection); ?>;
let FestivityCollectionKeys = <?php echo json_encode(array_column($FestivityCollection, "event_key")); ?>;
</script>
<?php include_once('./layout/footer.php'); ?>

<!-- DEFINE MAKE PATRON MODAL  -->
<div class="modal fade actionPromptModal" id="makePatronActionPrompt" tabindex="-1" role="dialog" aria-labelledby="makePatronActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="makePatronActionModalLabel"><?php echo _("Designate patron from existing festivity") ?></h5>
            </div>
            <?php Utilities::generateModalBody(false); ?>
            <div class="modal-footer">
                <button type="button" id="designatePatronButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-user-graduate me-2"></i><?php echo _("Designate patron") ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE SET PROPERTY MODAL  -->
<div class="modal fade actionPromptModal" id="setPropertyActionPrompt" tabindex="-1" role="dialog" aria-labelledby="setPropertyActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="setPropertyActionModalLabel"><?php echo _("Change name or grade of existing festivity") ?></h5>
            </div>
            <?php Utilities::generateModalBody(true); ?>
            <div class="modal-footer">
                <button type="button" id="setPropertyButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-edit me-2"></i>Set Property</button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE MOVE FESTIVITY MODAL  -->
<div class="modal fade actionPromptModal" id="moveFestivityActionPrompt" tabindex="-1" role="dialog" aria-labelledby="moveFestivityActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="moveFestivityActionModalLabel"><?php echo _("Move festivity to new date") ?></h5>
            </div>
            <?php Utilities::generateModalBody(false); ?>
            <div class="modal-footer">
                <button type="button" id="moveFestivityButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-day me-2"></i><?php echo _("Move Festivity") ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE NEW FESTIVITY MODAL  -->
<div class="modal fade actionPromptModal" id="newFestivityActionPrompt" tabindex="-1" role="dialog" aria-labelledby="newFestivityActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="newFestivityActionModalLabel"><?php echo _("Create a new festivity") ?></h5>
            </div>
            <?php Utilities::generateModalBody(false); ?>
            <div class="modal-footer">
                <button type="button" id="newFestivityFromExistingButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo _("New Festivity from existing") ?></button>
                <button type="button" id="newFestivityExNovoButton" class="btn btn-primary actionPromptButton"><i class="fas fa-calendar-plus me-2"></i><?php echo _("New Festivity ex novo") ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
            </div>
        </div>
    </div>
</div>

<!-- addPublishedRomanMissalPrompt -->
<div class="modal fade" id="addPublishedRomanMissalPrompt" tabindex="-1" role="dialog" aria-labelledby="addPublishedRomanMissalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addPublishedRomanMissalLabel"><?php echo _('Add Missal') ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-center needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="languageEditionRomanMissalName" class="fw-bold"><?php echo _("Choose from known Roman Missal language editions"); ?>:</label>
                        <input list="languageEditionRomanMissalList" class="form-control" id="languageEditionRomanMissalName">
                        <div class="invalid-feedback"><?php echo _("This Missal is unknown to the Liturgical Calendar API. Please choose from a value in the list, or contact the curator of the API to have the Missal added to known language edition Missals."); ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="addLanguageEditionRomanMissal" class="btn btn-primary" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo _("Add language edition Roman Missal") ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
            </div>
        </div>
    </div>
</div>

<datalist id="existingFestivitiesList">
<?php
foreach ($FestivityCollection as $festivity) {
    echo "<option value=\"{$festivity["event_key"]}\">{$festivity["name"]}</option>";
}
?>
</datalist>

<datalist id="languageEditionRomanMissalList"></datalist>

</body>
</html>
