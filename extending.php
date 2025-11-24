<?php

use LiturgicalCalendar\Frontend\FormControls;
use LiturgicalCalendar\Frontend\Utilities;

include_once 'common.php'; // provides $i18n and all API URLs

$FormControls = new FormControls($i18n);

$dayOfWeekFmt = IntlDateFormatter::create($i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN, 'EEEE');
$thursday     = $dayOfWeekFmt->format(DateTime::createFromFormat('!j-n-Y', '1-1-2022', new DateTimeZone('UTC'))->modify('next Thursday'));
$sunday       = $dayOfWeekFmt->format(DateTime::createFromFormat('!j-n-Y', '1-1-2022', new DateTimeZone('UTC'))->modify('next Sunday'));

$AvailableNationalCalendars = [];

$c = new Collator($i18n->LOCALE);

$ch = curl_init();
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);

/**
 * Fetch metadata from API
 */
curl_setopt($ch, CURLOPT_URL, $apiConfig->metadataUrl);
$metadataRaw = curl_exec($ch);

if (curl_errno($ch)) {
    $error_msg = curl_error($ch);
    die($error_msg);
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($httpCode >= 400) {
    die('Error: Received HTTP code ' . $httpCode . ' from API at ' . $apiConfig->metadataUrl);
}

if ($metadataRaw === false) {
    die('Could not fetch metadata from API at ' . $apiConfig->metadataUrl);
}

$metadataJson = json_decode($metadataRaw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    $error_msg = json_last_error_msg();
    die($error_msg);
}

if (false === isset($metadataJson['litcal_metadata'])) {
    die('litcal_metadata not found in metadata JSON from API');
}

[ 'litcal_metadata' => $LitCalMetadata ] = $metadataJson;

/**
 * Fetch liturgical events catalog from API
 */
curl_setopt($ch, CURLOPT_URL, $apiConfig->eventsUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept-Language: ' . $i18n->LOCALE]);

$eventsCatalogRaw = curl_exec($ch);

if (curl_errno($ch)) {
    $error_msg = curl_error($ch);
    die($error_msg);
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($httpCode >= 400) {
    die('Error: Received HTTP code ' . $httpCode . ' from API at ' . $apiConfig->eventsUrl);
}

if ($eventsCatalogRaw === false) {
    die('Could not fetch events from API at ' . $apiConfig->eventsUrl);
}

$litEventsJson = json_decode($eventsCatalogRaw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    $error_msg = json_last_error_msg();
    die($error_msg);
}

if (false === isset($litEventsJson['litcal_events'])) {
    die('litcal_events not found in events JSON from API');
}

[ 'litcal_events' => $LiturgicalEventCollection ] = $litEventsJson;

/**
 * Fetch Catholic Dioceses by Nation data
 */
$WorldDiocesesByNation = @file_get_contents('./assets/data/WorldDiocesesByNation.json');
if ($WorldDiocesesByNation === false) {
    die('Could not fetch WorldDiocesesByNation.json data');
}

$WorldDiocesesByNationJson = json_decode($WorldDiocesesByNation, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    $error_msg = json_last_error_msg();
    die($error_msg);
}

if (false === isset($WorldDiocesesByNationJson['catholic_dioceses_latin_rite'])) {
    die('catholic_dioceses_latin_rite not found in WorldDiocesesByNation JSON data');
}

[ 'catholic_dioceses_latin_rite' => $CatholicDiocesesByNation ] = $WorldDiocesesByNationJson;

$DiocesanGroups = $LitCalMetadata['diocesan_groups'];

// National Calendars that have been defined in the API except "Vatican"
$NationalCalendars = array_values(array_filter(
    $LitCalMetadata['national_calendars'],
    fn($calendar) => isset($calendar['calendar_id']) && $calendar['calendar_id'] !== 'VA'
));
foreach ($NationalCalendars as $calendar) {
    $AvailableNationalCalendars[$calendar['calendar_id']] = Locale::getDisplayRegion('-' . $calendar['calendar_id'], $i18n->LOCALE);
}
$c->asort($AvailableNationalCalendars);

// Extract the 'country_iso' values from the CatholicDiocesesByNation array and transform values to upper case
$CountryIso                    = array_map('strtoupper', array_column($CatholicDiocesesByNation, 'country_iso'));
$DisplayRegions                = array_map(fn ($item) => Locale::getDisplayRegion('-' . $item, $i18n->LOCALE), $CountryIso);
$CountriesWithCatholicDioceses = array_combine($CountryIso, $DisplayRegions);
$c->asort($CountriesWithCatholicDioceses);


$SystemLocalesWithRegion = array_filter(ResourceBundle::getLocales(''), function ($value) use ($i18n) {
    return strpos($value, 'POSIX') === false && Locale::getDisplayRegion($value, $i18n->LOCALE) !== '';
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

$API_EXTEND_HOWTO_A   = _('The General Roman Calendar can be extended so as to create a National or Diocesan calendar. Diocesan calendars depend on National calendars, so the National calendar must first be created.');
$API_EXTEND_HOWTO_A1  = _('The first step in creating a national or diocesan calendar, is to translate the data for the General Roman Calendar into the language for that nation or diocese.');
$API_EXTEND_HOWTO_A1a = _('(see <a href="translations.php">Translations</a>)');
$API_EXTEND_HOWTO_A2  = _('A national calendar may have some liturgical events in common with other national calendars, for example the patron of a wider region.');
$API_EXTEND_HOWTO_A3  = _('In this case, the liturgical events for the wider region should be defined separately, and the languages applicable to the wider region should be set; the wider region data will then be applied automatically to national calendars belonging to the wider region.');
$DioceseGroupHelp     = _('If a group of dioceses decides to pool their Liturgical Calendar data, for example to print out one single yearly calendar with the data for all the dioceses in the group, the group can be defined or set here.');

$messages = [
    'EventKey'                      => _('Event key'),
    'Name'                          => _('Name'),
    'Day'                           => _('Day'),
    'Month'                         => _('Month'),
    'Other Solemnity'               => _('Other Solemnity'),
    'Other Feast'                   => _('Other Feast'),
    'Other Memorial'                => _('Other Memorial'),
    'Other Optional Memorial'       => _('Other Optional Memorial'),
    'Delete calendar'               => _('Delete calendar'),
    'Delete diocesan calendar'      => _('Delete diocesan calendar'),
    'If you choose'                 => _('If you choose to delete this calendar, the liturgical events defined for the calendar and the corresponding index entries will be removed and no longer available in the client applications.'),
    'Liturgical color'              => _('Liturgical color'),
    'white'                         => _('white'),
    'red'                           => _('red'),
    'green'                         => _('green'),
    'purple'                        => _('purple'),
    'rose'                          => _('rose'),
    /**translators: in reference to the first year from which this liturgical event takes place */
    'Since'                         => _('Since'),
    /**translators: in reference to the year from which this liturgical event no longer needs to be dealt with */
    'Until'                         => _('Until'),
    /**translators: label of the form row */
    'Designate patron'              => _('Patron or Patrons of the Wider Region'),
    /**translators: label of the form row */
    'New liturgical event'          => _('New liturgical event'),
    /**translators: label of the form row */
    'Change name'                   => _('Change name'),
    /**translators: label of the form row */
    'Change grade'                  => _('Change grade'),
    /**translators: label of the form row */
    'Move liturgical event'         => _('Move liturgical event'),
    'Decree URL'                    => _('Decree URL'),
    'Decree Langs'                  => _('Decree Language mappings'),
    'Missal'                        => _('Missal'),
    'Reason'                        => _('Reason (in favor of liturgical event)'),
    'commonsTemplate'               => $FormControls->getCommonsTemplate(),
    'gradeTemplate'                 => $FormControls->getGradeTemplate(),
    'LOCALE'                        => $i18n->LOCALE,
    'LOCALE_WITH_REGION'            => $i18n->LOCALE_WITH_REGION,
    'AvailableLocales'              => $SystemLocalesWithoutRegion,
    'AvailableLocalesWithRegion'    => $SystemLocalesWithRegion,
    'CountriesWithCatholicDioceses' => $CountriesWithCatholicDioceses,
    'DiocesesList'                  => $CatholicDiocesesByNation
];

$buttonGroup = '<hr><div class="d-flex justify-content-around">
<button class="btn btn-sm btn-primary m-2" id="makePatronAction" data-bs-toggle="modal" data-bs-target="#makePatronActionPrompt"><i class="fas fa-user-graduate me-2"></i>' . _('Designate patron') . '</button>
<button class="btn btn-sm btn-primary m-2" id="setPropertyAction" data-bs-toggle="modal" data-bs-target="#setPropertyActionPrompt"><i class="fas fa-edit me-2"></i>' . _('Change name or grade of existing liturgical event') . '</button>
<button class="btn btn-sm btn-primary m-2" id="moveLiturgicalEventAction" data-bs-toggle="modal" data-bs-target="#moveLiturgicalEventActionPrompt"><i class="fas fa-calendar-day me-2"></i>' . _('Move liturgical event to new date') . '</button>
<button class="btn btn-sm btn-primary m-2" id="newLiturgicalEventAction" data-bs-toggle="modal" data-bs-target="#newLiturgicalEventActionPrompt"><i class="far fa-calendar-plus me-2"></i>' . _('Create a new liturgical event') . '</button>
</div>';

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _('General Roman Calendar - Extending') ?></title>
    <?php include_once('layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _('Extend the General Roman Calendar with National or Diocesan data'); ?></h1>
        <p class="mb-1 lh-sm"><small><i><?php echo $API_EXTEND_HOWTO_A . ' ' . $API_EXTEND_HOWTO_A1 . ' ' . $API_EXTEND_HOWTO_A1a . ' ' . $API_EXTEND_HOWTO_A2 . ' ' . $API_EXTEND_HOWTO_A3; ?></i></small></p>
<?php
if (isset($_GET['choice'])) {
    switch ($_GET['choice']) {
        case 'widerRegion':
            //FormControls::$settings["untilYearField"] = true;
            ?>
                <div class="container-fluid">
                    <form class="row justify-content-center align-items-end needs-validation regionalNationalSettingsForm" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="widerRegionCalendarName" class="fw-bold"><?php echo _('Wider Region'); ?></label>
                            <input list="WiderRegionsList" class="form-control regionalNationalCalendarName" id="widerRegionCalendarName" data-category="widerregion" required>
                            <div class="invalid-feedback"><?php echo _('This value cannot be empty.'); ?></div>
                            <datalist id="WiderRegionsList">
                                <option value=""></option>
                            <?php
                            foreach ($LitCalMetadata['wider_regions'] as $widerRegion) {
                                foreach ($widerRegion['locales'] as $widerRegionLanguage) {
                                    $widerRegionName         = htmlspecialchars($widerRegion['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    $widerRegionLanguageSafe = htmlspecialchars($widerRegionLanguage, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    echo "<option value=\"{$widerRegionName} - {$widerRegionLanguageSafe}\">{$widerRegionName}</option>";
                                }
                            }
                            ?>
                            </datalist>
                        </div>
                        <div class="col col-md-3">
                            <div>
                                <label for="widerRegionLocales" class="fw-bold"><?php echo _('Locales') ?></label>
                                <select class="form-select calendarLocales" id="widerRegionLocales" multiple="multiple">
                                <?php foreach ($SystemLocalesWithRegion as $locale => $lang_region) {
                                        echo "<option value='$locale'>$lang_region</option>";
                                } ?>
                                </select>
                            </div>
                        </div>
                        <div class="col col-md-3">
                            <label for="currentLocalizationWiderRegion" class="fw-bold"><?php echo _('Current localization') ?></label>
                            <select class="form-select currentLocalizationChoices" id="currentLocalizationWiderRegion">
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
                                <?php echo _('Remove existing data'); ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 m-4">
                        <div class="card-header py-3">
                            <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _('Create a Calendar for a Wider Region'); ?></h4>
                        </div>
                        <div class="card-body">
                            <hr>
                            <form class="needs-validation regionalNationalDataForm" id="widerRegionForm" novalidate>
                            </form>
                            <?php echo $buttonGroup ?>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 serializeRegionalNationalData" id="serializeWiderRegionData" data-category="widerregion" disabled>
                                <i class="fas fa-save me-2"></i>
                                <?php echo _('Save Wider Region Calendar Data') ?>
                            </button>
                        </div>
                    </div>
                </div>
                <?php
            break;
        case 'national':
            ?>
                <div class="container-fluid">
                    <form class="row justify-content-center needs-validation align-items-center regionalNationalSettingsForm" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="nationalCalendarName" class="fw-bold"><?php echo _('National Calendar'); ?></label>
                            <input list="nationalCalendarsList" class="form-control regionalNationalCalendarName" id="nationalCalendarName" data-category="nation" required>
                            <div class="invalid-feedback"><?php echo _('This value cannot be empty.'); ?></div>
                            <datalist id="nationalCalendarsList">
                            <?php
                            foreach ($CountriesWithCatholicDioceses as $isoCode => $countryLocalized) {
                                $isoCodeSafe          = htmlspecialchars($isoCode, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                $countryLocalizedSafe = htmlspecialchars($countryLocalized, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                echo "<option value=\"{$isoCodeSafe}\">{$countryLocalizedSafe}</option>";
                            }
                            ?>
                            </datalist>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="removeExistingCalendarDataBtn" class="fw-bold"></label>
                            <button class="btn btn-danger m-2 form-control" id="removeExistingCalendarDataBtn" disabled data-bs-toggle="modal" data-bs-target="#removeCalendarDataPrompt">
                                <i class="far fa-trash-alt me-2"></i>
                                <?php echo _('Remove existing data'); ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 m-4">
                        <div class="card-header py-3">
                            <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _('Create a National Calendar'); ?></h4>
                        </div>
                        <div class="card-body">

                            <div id="nationalCalendarSettingsContainer" class="container">
                                <h3 id="nationalCalendarSettingsTitle" class="text-center"><?php echo _('National calendar settings') ?><i class="fas fa-info-circle ms-4 d-inline-block text-black" style="--bs-text-opacity: .3;" role="button" title="please keep in mind that the first step to creating a national calendar, is to translate the already existing calendar data into the correct language. This can be done on the LitCal translation server (see above for details)"></i></h3>
                                <form id="nationalCalendarSettingsForm" class="row justify-content-center align-items-baseline needs-validation" novalidate>
                                    <div class="form-group col col-md-3">
                                        <label><?php echo _('EPIPHANY') ?></label>
                                        <select class="form-select" id="nationalCalendarSettingEpiphany">
                                            <option value=""></option>
                                            <option value="JAN6"><?php echo _('January 6') ?></option>
                                            <option value="SUNDAY_JAN2_JAN8"><?php echo _('Sunday between January 2 and January 8') ?></option>
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
                                            <input class="form-check-input fs-2" type="checkbox" role="switch" id="nationalCalendarSettingHighPriest" style="margin-left: -1.25em; margin-top: 0.075em;">
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
                                        <input class="form-control" list="WiderRegionsList" id="associatedWiderRegion" />
                                        <datalist id="WiderRegionsList">
                                            <option value=""></option>
                                        <?php
                                        foreach ($LitCalMetadata['wider_regions_keys'] as $WiderRegion) {
                                            $widerRegionKeySafe = htmlspecialchars($WiderRegion, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                            echo "<option value=\"{$widerRegionKeySafe}\">{$widerRegionKeySafe}</option>";
                                        }
                                        ?>
                                        </datalist>
                                    </div>
                                    <div class="form-group col col-md-3 mt-4">
                                        <label for="currentLocalizationNational"><?php echo _('Current localization') ?></label>
                                        <select class="form-select currentLocalizationChoices" id="currentLocalizationNational">
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
                            <button class="btn btn-lg btn-primary m-2 serializeRegionalNationalData" id="serializeNationalCalendarData" data-category="nation" disabled>
                                <i class="fas fa-save me-2"></i>
                                <?php echo _('Save National Calendar Data') ?>
                            </button>
                        </div>
                    </div>
                </div>
                <?php
            break;
        case 'diocesan':
            FormControls::$settings['untilYearField'] = true;
            ?>
                <div class="container mb-5">
                    <form class="needs-validation" novalidate>
                        <div class="row justify-content-center align-items-baseline ">
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarNationalDependency" class="fw-bold"><?php echo _('Depends on national calendar'); ?>:</label>
                                <select class="form-select" id="diocesanCalendarNationalDependency" required>
                                    <option value=""></option>
                                <?php
                                foreach ($AvailableNationalCalendars as $nation => $displayName) {
                                    $nationSafe      = htmlspecialchars($nation, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    $displayNameSafe = htmlspecialchars($displayName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    echo "<option value=\"{$nationSafe}\">$displayNameSafe</option>";
                                }
                                ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarDioceseName" class="fw-bold"><?php echo _('Diocese'); ?>:</label>
                                <input list="DiocesesList" class="form-control" id="diocesanCalendarDioceseName" required>
                                <div class="invalid-feedback"><?php echo _('This diocese does not seem to exist? Please choose from a value in the list to retrieve an existing diocese, or ignore if creating a new diocesan calendar.'); ?></div>
                                <datalist id="DiocesesList">
                                    <option value=""></option>
                                </datalist>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarGroup" class="fw-bold"><?php echo _('Diocesan group'); ?>: <i class="fas fa-circle-info mx-2" title="<?php echo htmlspecialchars($DioceseGroupHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i></label>
                                <input list="DiocesanGroupsList" class="form-control" id="diocesanCalendarGroup" aria-describedby="diocesanCalendarGroupHelp">
                                <datalist id="DiocesanGroupsList">
                                    <option value=""></option>
                                    <?php
                                    foreach ($DiocesanGroups as $diocesanGroup) {
                                        $diocesanGroupName = htmlspecialchars($diocesanGroup['group_name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                        echo "<option value=\"{$diocesanGroupName}\">{$diocesanGroupName}</option>";
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
                                <label for="currentLocalizationDiocesan" class="fw-bold"><?php echo _('Current localization'); ?>:</label>
                                <select class="form-select currentLocalizationChoices" id="currentLocalizationDiocesan">
                                    <option value=""></option>
                                    <?php
                                    foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                        echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                    }
                                    ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarTimezone" class="fw-bold"><?php echo _('Timezone'); ?></label>
                                <select class="form-select" id="diocesanCalendarTimezone">
                                    <option value=""></option>
                                </select>
                            </div>
                            <div class="col col-md-3 text-center align-self-end">
                                <button class="btn btn-danger" id="removeExistingDiocesanDataBtn" disabled data-bs-toggle="modal" data-bs-target="#removeDiocesanCalendarPrompt">
                                    <i class="far fa-trash-alt me-2"></i>
                                    <?php echo _('Remove existing data'); ?>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <nav aria-label="Diocesan calendar definition" id="diocesanCalendarDefinitionCardLinks">
                    <ul class="pagination pagination-lg justify-content-center m-1">
                        <li class="page-item disabled">
                            <a class="page-link diocesan-carousel-prev" href="#" tabindex="-1" aria-disabled="true" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>
                        </li>
                        <li class="page-item active"><a class="page-link" href="#" data-bs-slide-to="0"><?php echo _('Solemnities'); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="1"><?php echo _('Feasts'); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="2"><?php echo _('Memorials'); ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="3"><?php echo _('Optional memorials'); ?></a></li>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _('Create a Diocesan Calendar'); ?>: <?php echo _('Define the Solemnities'); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow(_('Principal Patron(s) of the Place, Diocese, Region, Province or Territory')) ?>
                                                <?php $FormControls->createEventRow(_('Dedication of the Cathedral')) ?>
                                                <?php $FormControls->createEventRow(_('Other Solemnity')) ?>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _('Create a Diocesan Calendar'); ?>: <?php echo _('Define the Feasts'); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow(_('Patron(s) of the Place, Diocese, Region, Province or Territory')) ?>
                                                <?php $FormControls->createEventRow(_('Dedication of the Cathedral')) ?>
                                                <?php $FormControls->createEventRow(_('Other Feast')) ?>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _('Create a Diocesan Calendar'); ?>: <?php echo _('Define the Memorials'); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow(_('Secondary Patron(s) of the Place, Diocese, Region, Province or Territory')) ?>
                                                <?php $FormControls->createEventRow(_('Other Memorial')) ?>
                                                <?php $FormControls->createEventRow(_('Other Memorial')) ?>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo _('Create a Diocesan Calendar'); ?>: <?php echo _('Define the Optional Memorials'); ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow(_('Saints whose veneration is local to the Place, Diocese, Region, Province or Territory')) ?>
                                                <?php $FormControls->createEventRow(_('Other Optional Memorial')) ?>
                                                <?php $FormControls->createEventRow(_('Other Optional Memorial')) ?>
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
                    <p id="diocesanOverridesTitle" class="text-center"><?php echo _('Diocesan overrides to the national calendar for …') ?></p>
                    <form id="diocesanOverridesForm" class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label><?php echo _('EPIPHANY') ?></label>
                            <select class="form-select" id="diocesanCalendarOverrideEpiphany">
                                <option value=""></option>
                                <option value="JAN6"><?php echo _('January 6') ?></option>
                                <option value="SUNDAY_JAN2_JAN8"><?php echo _('Sunday between January 2 and January 8') ?></option>
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
                            <button class="btn btn-lg btn-primary m-1" id="saveDiocesanCalendar_btn">
                                <i class="fas fa-save me-2"></i>
                                <?php echo _('SAVE DIOCESAN CALENDAR') ?>
                            </button>
                        </div>
                    </div>
                </div>
                <?php
            break;
    }
}
?>
<script>
const Messages = <?php echo json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
const LitCalMetadata = <?php echo json_encode($LitCalMetadata, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
let LiturgicalEventCollection = <?php echo json_encode($LiturgicalEventCollection, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
let LiturgicalEventCollectionKeys = <?php echo json_encode(array_column($LiturgicalEventCollection, 'event_key'), JSON_UNESCAPED_UNICODE); ?>;
</script>
<?php include_once('./layout/footer.php'); ?>

<!-- Authentication Module -->
<script src="assets/js/auth.js"></script>
<?php include_once('./includes/login-modal.php'); ?>

<!-- DEFINE MAKE PATRON MODAL  -->
<div class="modal fade actionPromptModal" id="makePatronActionPrompt" tabindex="-1" role="dialog" aria-labelledby="makePatronActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="makePatronActionModalLabel"><?php echo _('Designate patron') ?></h5>
            </div>
            <?php Utilities::generateModalBody(false, false); ?>
            <div class="modal-footer">
                <button type="button" id="designatePatronButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-user-graduate me-2"></i><?php echo _('Designate patron') ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE SET PROPERTY MODAL  -->
<div class="modal fade actionPromptModal" id="setPropertyActionPrompt" tabindex="-1" role="dialog" aria-labelledby="setPropertyActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="setPropertyActionModalLabel"><?php echo _('Change name or grade of existing liturgical event') ?></h5>
            </div>
            <?php Utilities::generateModalBody(true, true); ?>
            <div class="modal-footer">
                <button type="button" id="setPropertyButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-edit me-2"></i><?php echo _('Set property') ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE MOVE FESTIVITY MODAL  -->
<div class="modal fade actionPromptModal" id="moveLiturgicalEventActionPrompt" tabindex="-1" role="dialog" aria-labelledby="moveLiturgicalEventActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="moveLiturgicalEventActionModalLabel"><?php echo _('Move liturgical event to new date') ?></h5>
            </div>
            <?php Utilities::generateModalBody(true, false); ?>
            <div class="modal-footer">
                <button type="button" id="moveLiturgicalEventButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-day me-2"></i><?php echo _('Move Liturgical Event') ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
            </div>
        </div>
    </div>
</div>

<!-- DEFINE NEW FESTIVITY MODAL  -->
<div class="modal fade actionPromptModal" id="newLiturgicalEventActionPrompt" tabindex="-1" role="dialog" aria-labelledby="newLiturgicalEventActionModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="newLiturgicalEventActionModalLabel"><?php echo _('Create a new liturgical event') ?></h5>
            </div>
            <?php Utilities::generateModalBody(false, false); ?>
            <div class="modal-footer">
                <button type="button" id="newLiturgicalEventFromExistingButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo _('Create Liturgical Event') ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
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
                        <label for="languageEditionRomanMissalName" class="fw-bold"><?php echo _('Choose from known Roman Missal language editions'); ?>:</label>
                        <input list="languageEditionRomanMissalList" class="form-control" id="languageEditionRomanMissalName">
                        <div class="invalid-feedback"><?php echo _('This Missal is unknown to the Liturgical Calendar API. Please choose from a value in the list, or contact the curator of the API to have the Missal added to known language edition Missals.'); ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="addLanguageEditionRomanMissal" class="btn btn-primary" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo _('Add language edition Roman Missal') ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
            </div>
        </div>
    </div>
</div>

<datalist id="existingLiturgicalEventsList">
<?php
foreach ($LiturgicalEventCollection as $liturgical_event) {
    $key  = htmlspecialchars($liturgical_event['event_key'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $name = htmlspecialchars($liturgical_event['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    echo "<option value=\"{$key}\">{$name}</option>";
}
?>
</datalist>

<datalist id="languageEditionRomanMissalList"></datalist>

<div id="overlay">
    <div class="lds-dual-ring"></div>
</div>

</body>
</html>
