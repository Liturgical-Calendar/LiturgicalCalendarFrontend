<?php

use LiturgicalCalendar\Frontend\ApiClient;
use LiturgicalCalendar\Frontend\FormControls;
use LiturgicalCalendar\Frontend\Utilities;

include_once 'includes/common.php'; // provides $i18n and all API URLs
include_once 'includes/messages.php'; // translation strings
/** @var array<string,mixed> $messages */

// Defensive initialization: ensure $messages is an array before use
if (!isset($messages) || !is_array($messages)) {
    $messages = [];
}

$FormControls = new FormControls($i18n);

$dayOfWeekFmt = IntlDateFormatter::create($i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN, 'EEEE');
if ($dayOfWeekFmt === null) {
    die('Error: Could not create IntlDateFormatter');
}
$thursdayDate = DateTime::createFromFormat('!j-n-Y', '1-1-2022', new DateTimeZone('UTC'));
$sundayDate   = DateTime::createFromFormat('!j-n-Y', '1-1-2022', new DateTimeZone('UTC'));
if ($thursdayDate === false || $sundayDate === false) {
    die('Error: Could not create DateTime from format');
}
$thursday = $dayOfWeekFmt->format($thursdayDate->modify('next Thursday'));
$sunday   = $dayOfWeekFmt->format($sundayDate->modify('next Sunday'));

$AvailableNationalCalendars = [];

$c = new Collator($i18n->LOCALE);

/**
 * Fetch metadata and events from API using Guzzle-based client
 */
$apiClient = new ApiClient($i18n->LOCALE);

try {
    $metadataJson   = $apiClient->fetchJsonWithKey($apiConfig->metadataUrl, 'litcal_metadata');
    $LitCalMetadata = $metadataJson['litcal_metadata'];
} catch (\RuntimeException $e) {
    die('Error fetching metadata from API: ' . $e->getMessage());
}

try {
    $litEventsJson             = $apiClient->fetchJsonWithKey($apiConfig->eventsUrl, 'litcal_events');
    $LiturgicalEventCollection = $litEventsJson['litcal_events'];
} catch (\RuntimeException $e) {
    die('Error fetching events from API: ' . $e->getMessage());
}

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
    $displayRegion                                        = Locale::getDisplayRegion('-' . $calendar['calendar_id'], $i18n->LOCALE);
    $AvailableNationalCalendars[$calendar['calendar_id']] = $displayRegion !== false ? $displayRegion : $calendar['calendar_id'];
}
$c->asort($AvailableNationalCalendars);

// Extract the 'country_iso' values from the CatholicDiocesesByNation array and transform values to upper case
$CountryIso     = array_map('strtoupper', array_column($CatholicDiocesesByNation, 'country_iso'));
$DisplayRegions = array_map(function ($item) use ($i18n) {
    $region = Locale::getDisplayRegion('-' . $item, $i18n->LOCALE);
    return $region !== false ? $region : $item;
}, $CountryIso);
/** @var array<string, string> $CountriesWithCatholicDioceses */
$CountriesWithCatholicDioceses = array_combine($CountryIso, $DisplayRegions);
$c->asort($CountriesWithCatholicDioceses);


$resourceBundleLocales = ResourceBundle::getLocales('');
if ($resourceBundleLocales === false) {
    die('Error: Could not retrieve available locales from ResourceBundle');
}
$SystemLocalesWithRegion = array_filter($resourceBundleLocales, function ($value) use ($i18n) {
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

$SystemLocalesWithoutRegion = array_filter($resourceBundleLocales, function ($value) {
    return strpos($value, '_') === false;
});
$SystemLocalesWithoutRegion = array_reduce($SystemLocalesWithoutRegion, function ($carry, $item) use ($i18n) {
    $carry[$item] = Locale::getDisplayLanguage($item, $i18n->LOCALE);
    return $carry;
}, []);
$c->asort($SystemLocalesWithoutRegion);

$API_EXTEND_HOWTO_A   = $messages['API_EXTEND_HOWTO_A'];
$API_EXTEND_HOWTO_A1  = $messages['API_EXTEND_HOWTO_A1'];
$API_EXTEND_HOWTO_A1a = $messages['API_EXTEND_HOWTO_A1a'];
$API_EXTEND_HOWTO_A2  = $messages['API_EXTEND_HOWTO_A2'];
$API_EXTEND_HOWTO_A3  = $messages['API_EXTEND_HOWTO_A3'];
$DioceseGroupHelp     = $messages['DioceseGroupHelp'];


$buttonGroup = '<hr><div class="d-flex justify-content-around">
<button class="btn btn-sm btn-primary m-2 d-none litcalActionButton" id="makePatronAction" data-requires-auth="true" data-bs-toggle="modal" data-bs-target="#makePatronActionPrompt"><i class="fas fa-user-graduate me-2"></i>' . $messages['PatronButton'] . '</button>
<button class="btn btn-sm btn-primary m-2 d-none litcalActionButton" id="setPropertyAction" data-requires-auth="true" data-bs-toggle="modal" data-bs-target="#setPropertyActionPrompt"><i class="fas fa-edit me-2"></i>' . $messages['SetPropertyButton'] . '</button>
<button class="btn btn-sm btn-primary m-2 d-none litcalActionButton" id="moveLiturgicalEventAction" data-requires-auth="true" data-bs-toggle="modal" data-bs-target="#moveLiturgicalEventActionPrompt"><i class="fas fa-calendar-day me-2"></i>' . $messages['MoveEventButton'] . '</button>
<button class="btn btn-sm btn-primary m-2 d-none litcalActionButton" id="newLiturgicalEventAction" data-requires-auth="true" data-bs-toggle="modal" data-bs-target="#newLiturgicalEventActionPrompt"><i class="far fa-calendar-plus me-2"></i>' . $messages['CreateEventButton'] . '</button>
</div>';

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo $messages['Page title - Extending'] ?></title>
    <?php include_once('layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo $messages['Extend heading']; ?></h1>
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
                            <label for="widerRegionCalendarName" class="fw-bold"><?php echo $messages['Wider Region']; ?></label>
                            <input list="WiderRegionsList" class="form-control regionalNationalCalendarName" id="widerRegionCalendarName" data-category="widerregion" required>
                            <div class="invalid-feedback"><?php echo $messages['This value cannot be empty.']; ?></div>
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
                                <label for="widerRegionLocales" class="fw-bold"><?php echo $messages['Locales']; ?></label>
                                <select class="form-select calendarLocales" id="widerRegionLocales" data-requires-auth="true" disabled multiple="multiple">
                                <?php foreach ($SystemLocalesWithRegion as $locale => $lang_region) {
                                        echo "<option value='$locale'>$lang_region</option>";
                                } ?>
                                </select>
                            </div>
                        </div>
                        <div class="col col-md-3">
                            <label for="currentLocalizationWiderRegion" class="fw-bold"><?php echo $messages['Current localization']; ?></label>
                            <select class="form-select currentLocalizationChoices" id="currentLocalizationWiderRegion" data-requires-auth="true" disabled>
                                <?php
                                foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                    echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                }
                                ?>
                            </select>
                        </div>
                        <div class="col col-md-3">
                            <button class="btn btn-danger d-none" id="removeExistingCalendarDataBtn" data-requires-auth="true" disabled data-bs-toggle="modal" data-bs-target="#removeCalendarDataPrompt">
                                <i class="far fa-trash-alt me-2"></i>
                                <?php echo $messages['RemoveDataButton']; ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 m-4">
                        <div class="card-header py-3">
                            <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo $messages['Create a Calendar for a Wider Region']; ?></h4>
                        </div>
                        <div class="card-body">
                            <hr>
                            <form class="needs-validation regionalNationalDataForm opacity-50" id="widerRegionForm" data-requires-auth="true" novalidate>
                            </form>
                            <?php echo $buttonGroup ?>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 d-none serializeRegionalNationalData" id="serializeWiderRegionData" data-requires-auth="true" data-category="widerregion" disabled>
                                <i class="fas fa-save me-2"></i>
                                <?php echo $messages['Save Wider Region Calendar Data']; ?>
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
                            <label for="nationalCalendarName" class="fw-bold"><?php echo $messages['National Calendar']; ?></label>
                            <input list="nationalCalendarsList" class="form-control regionalNationalCalendarName" id="nationalCalendarName" data-category="nation" required>
                            <div class="invalid-feedback"><?php echo $messages['This value cannot be empty.']; ?></div>
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
                            <button class="btn btn-danger m-2 d-none form-control" id="removeExistingCalendarDataBtn" data-requires-auth="true" disabled data-bs-toggle="modal" data-bs-target="#removeCalendarDataPrompt">
                                <i class="far fa-trash-alt me-2"></i>
                                <?php echo $messages['RemoveDataButton']; ?>
                            </button>
                        </div>
                    </form>
                    <div class="card border-4 border-top-0 border-bottom-0 border-end-0 border-primary rounded-3 m-4">
                        <div class="card-header py-3">
                            <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo $messages['Create a National Calendar']; ?></h4>
                        </div>
                        <div class="card-body">

                            <div id="nationalCalendarSettingsContainer" class="container">
                                <h3 id="nationalCalendarSettingsTitle" class="text-center"><?php echo $messages['National calendar settings']; ?><i class="fas fa-info-circle ms-4 d-inline-block text-black" style="--bs-text-opacity: .3;" role="button" title="<?php echo htmlspecialchars($messages['Tooltip - National calendar first step'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i></h3>
                                <form id="nationalCalendarSettingsForm" class="row justify-content-center align-items-baseline needs-validation opacity-50" data-requires-auth="true" novalidate>
                                    <div class="form-group col col-md-3">
                                        <label for="nationalCalendarSettingEpiphany"><?php echo $messages['EPIPHANY']; ?></label>
                                        <select class="form-select" id="nationalCalendarSettingEpiphany">
                                            <option value=""></option>
                                            <option value="JAN6"><?php echo $messages['January 6']; ?></option>
                                            <option value="SUNDAY_JAN2_JAN8"><?php echo $messages['Sunday between January 2 and January 8']; ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-2">
                                        <label for="nationalCalendarSettingAscension"><?php echo $messages['ASCENSION']; ?></label>
                                        <select class="form-select" id="nationalCalendarSettingAscension">
                                            <option value=""></option>
                                            <option value="THURSDAY"><?php echo $thursday ?></option>
                                            <option value="SUNDAY"><?php echo $sunday ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-2">
                                        <label for="nationalCalendarSettingCorpusChristi"><?php echo $messages['CORPUS CHRISTI']; ?></label>
                                        <select class="form-select" id="nationalCalendarSettingCorpusChristi">
                                            <option value=""></option>
                                            <option value="THURSDAY"><?php echo $thursday ?></option>
                                            <option value="SUNDAY"><?php echo $sunday ?></option>
                                        </select>
                                    </div>
                                    <div class="form-group col col-md-2">
                                        <label for="nationalCalendarSettingHighPriest"><?php echo $messages['ETERNAL HIGH PRIEST']; ?></label>
                                        <div class="form-check form-switch">
                                            <input class="form-check-input fs-2" type="checkbox" role="switch" id="nationalCalendarSettingHighPriest" style="margin-left: -1.25em; margin-top: 0.075em;">
                                            <i class="fas fa-info-circle ms-4 d-inline-block text-black" style="--bs-text-opacity: .3;" role="button" title="<?php echo htmlspecialchars($messages['Tooltip - Eternal High Priest'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i>
                                        </div>
                                    </div>
                                    <div class="form-group col col-md-3">
                                        <label for="nationalCalendarLocales" class="text-uppercase"><?php echo $messages['Locales']; ?></label>
                                        <select class="form-select calendarLocales" id="nationalCalendarLocales" data-requires-auth="true" disabled multiple="multiple">
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
                                                <label><i class="fas fa-info-circle me-2 text-black" style="--bs-text-opacity: .3;" role="button" title="<?php echo htmlspecialchars($messages['Tooltip - Published Roman Missals'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i><?php echo $messages['Published Roman Missals']; ?></label>
                                            </div>
                                            <div class="col-4">
                                                <button class="btn btn-sm btn-primary ms-2 mb-2" id="addPublishedRomanMissal" data-bs-toggle="modal" data-bs-target="#addPublishedRomanMissalPrompt" type="button"><i class="fas fa-plus me-2"></i><?php echo $messages['AddMissalButton']; ?></button>
                                            </div>
                                        </div>
                                        <div class="row">
                                            <ul class="list-group" id="publishedRomanMissalList" style="width: 250px;">
                                            </ul>
                                        </div>
                                    </div>
                                    <div class="form-group col col-md-3 mt-4">
                                        <label for="associatedWiderRegion"><?php echo $messages['Wider Region']; ?><i class="fas fa-info-circle ms-2 text-black" style="--bs-text-opacity: .3;" role="button" title="<?php echo htmlspecialchars($messages['Tooltip - Wider Region association'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i></label>
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
                                        <label for="currentLocalizationNational"><?php echo $messages['Current localization']; ?></label>
                                        <select class="form-select currentLocalizationChoices" id="currentLocalizationNational" data-requires-auth="true" disabled>
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
                            <form class="needs-validation regionalNationalDataForm opacity-50" id="nationalCalendarForm" data-requires-auth="true" novalidate>
                            </form>
                            <?php echo $buttonGroup ?>
                        </div>
                        <div class="card-footer text-center">
                            <button class="btn btn-lg btn-primary m-2 d-none serializeRegionalNationalData" id="serializeNationalCalendarData" data-requires-auth="true" data-category="nation" disabled>
                                <i class="fas fa-save me-2"></i>
                                <?php echo $messages['Save National Calendar Data']; ?>
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
                                <label for="diocesanCalendarNationalDependency" class="fw-bold"><?php echo $messages['Depends on national calendar']; ?>:</label>
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
                                <label for="diocesanCalendarDioceseName" class="fw-bold"><?php echo $messages['Diocese']; ?>:</label>
                                <input list="DiocesesList" class="form-control" id="diocesanCalendarDioceseName" required disabled>
                                <small id="diocesanCalendarDioceseNameHelp" class="form-text text-muted">
                                    <i class="fas fa-circle-info me-1"></i><?php echo $messages['Select a national calendar first']; ?>
                                </small>
                                <datalist id="DiocesesList">
                                    <option value=""></option>
                                </datalist>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarGroup" class="fw-bold"><?php echo $messages['Diocesan group']; ?>: <i class="fas fa-circle-info mx-2" title="<?php echo htmlspecialchars($DioceseGroupHelp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"></i></label>
                                <input list="DiocesanGroupsList" class="form-control" id="diocesanCalendarGroup" aria-describedby="diocesanCalendarGroupHelp" disabled>
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
                                <label for="diocesanCalendarLocales" class="fw-bold"><?php echo $messages['Locales']; ?>:</label>
                                <select class="form-select calendarLocales" id="diocesanCalendarLocales" multiple="multiple" disabled>
                                <?php
                                foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                    echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                }
                                ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="currentLocalizationDiocesan" class="fw-bold"><?php echo $messages['Current localization']; ?>:</label>
                                <select class="form-select currentLocalizationChoices" id="currentLocalizationDiocesan" disabled>
                                    <option value=""></option>
                                    <?php
                                    foreach ($SystemLocalesWithRegion as $AvlLOCALE => $AvlLANGUAGE) {
                                        echo "<option value=\"{$AvlLOCALE}\">{$AvlLANGUAGE}</option>";
                                    }
                                    ?>
                                </select>
                            </div>
                            <div class="form-group col col-md-3">
                                <label for="diocesanCalendarTimezone" class="fw-bold"><?php echo $messages['Timezone']; ?></label>
                                <select class="form-select" id="diocesanCalendarTimezone" disabled>
                                    <option value=""></option>
                                </select>
                            </div>
                            <div class="col col-md-3 text-center align-self-end">
                                <button class="btn btn-danger" id="removeExistingDiocesanDataBtn" disabled data-bs-toggle="modal" data-bs-target="#removeDiocesanCalendarPrompt">
                                    <i class="far fa-trash-alt me-2"></i>
                                    <?php echo $messages['RemoveDataButton']; ?>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <nav aria-label="<?php echo $messages['Diocesan calendar definition']; ?>" id="diocesanCalendarDefinitionCardLinks" class="diocesan-disabled">
                    <ul class="pagination pagination-lg justify-content-center m-1">
                        <li class="page-item disabled">
                            <a class="page-link diocesan-carousel-prev" href="#" tabindex="-1" aria-disabled="true" aria-label="<?php echo $messages['Previous']; ?>"><span aria-hidden="true">&laquo;</span></a>
                        </li>
                        <li class="page-item active"><a class="page-link" href="#" data-bs-slide-to="0"><?php echo $messages['Solemnities']; ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="1"><?php echo $messages['Feasts']; ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="2"><?php echo $messages['Memorials']; ?></a></li>
                        <li class="page-item"><a class="page-link" href="#" data-bs-slide-to="3"><?php echo $messages['Optional memorials']; ?></a></li>
                        <li class="page-item">
                            <a class="page-link diocesan-carousel-next" href="#" aria-label="<?php echo $messages['Next']; ?>"><span aria-hidden="true">&raquo;</span></a>
                        </li>
                    </ul>
                </nav>

                <div id="carouselExampleIndicators" class="carousel slide diocesan-disabled" data-bs-interval="false">
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo $messages['Create a Diocesan Calendar']; ?>: <?php echo $messages['Define the Solemnities']; ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow($messages['Principal Patron(s)']) ?>
                                                <?php $FormControls->createEventRow($messages['Dedication of the Cathedral']) ?>
                                                <?php $FormControls->createEventRow($messages['Other Solemnity']) ?>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo $messages['Create a Diocesan Calendar']; ?>: <?php echo $messages['Define the Feasts']; ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow($messages['Patron(s)']) ?>
                                                <?php $FormControls->createEventRow($messages['Dedication of the Cathedral']) ?>
                                                <?php $FormControls->createEventRow($messages['Other Feast']) ?>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo $messages['Create a Diocesan Calendar']; ?>: <?php echo $messages['Define the Memorials']; ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow($messages['Secondary Patron(s)']) ?>
                                                <?php $FormControls->createEventRow($messages['Other Memorial']) ?>
                                                <?php $FormControls->createEventRow($messages['Other Memorial']) ?>
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
                                        <h4 class="m-0 fw-bold text-primary"><i class="fas fa-place-of-worship fa-2x text-black d-inline-block me-4" style="--bs-text-opacity: .1;"></i><?php echo $messages['Create a Diocesan Calendar']; ?>: <?php echo $messages['Define the Optional Memorials']; ?></h4>
                                    </div>
                                    <div class="card-body">
                                        <!--<div class="row no-gutters align-items-center">
                                            <div class="col me-2">-->
                                                <form class="needs-validation" novalidate>
                                                <?php $FormControls->createEventRow($messages['Saints local veneration']) ?>
                                                <?php $FormControls->createEventRow($messages['Other Optional Memorial']) ?>
                                                <?php $FormControls->createEventRow($messages['Other Optional Memorial']) ?>
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
                        <span class="visually-hidden"><?php echo $messages['Previous']; ?></span>
                    </a>
                    <a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden"><?php echo $messages['Next']; ?></span>
                    </a>
                </div>

                <div id="diocesanOverridesContainer" class="container diocesan-disabled">
                    <p id="diocesanOverridesTitle" class="text-center"><?php echo $messages['Diocesan overrides']; ?></p>
                    <form id="diocesanOverridesForm" class="row justify-content-center needs-validation" novalidate>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarOverrideEpiphany"><?php echo $messages['EPIPHANY']; ?></label>
                            <select class="form-select" id="diocesanCalendarOverrideEpiphany">
                                <option value=""></option>
                                <option value="JAN6"><?php echo $messages['January 6']; ?></option>
                                <option value="SUNDAY_JAN2_JAN8"><?php echo $messages['Sunday between January 2 and January 8']; ?></option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarOverrideAscension"><?php echo $messages['ASCENSION']; ?></label>
                            <select class="form-select" id="diocesanCalendarOverrideAscension">
                                <option value=""></option>
                                <option value="THURSDAY"><?php echo $thursday ?></option>
                                <option value="SUNDAY"><?php echo $sunday ?></option>
                            </select>
                        </div>
                        <div class="form-group col col-md-3">
                            <label for="diocesanCalendarOverrideCorpusChristi"><?php echo $messages['CORPUS CHRISTI']; ?></label>
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
                            <button class="btn btn-lg btn-primary m-1 d-none" id="saveDiocesanCalendar_btn" data-requires-auth="true">
                                <i class="fas fa-save me-2"></i>
                                <?php echo $messages['Save Diocesan Calendar Data']; ?>
                            </button>
                        </div>
                    </div>
                </div>
                <?php
            break;
    }
}

$messages = array_merge($messages, [
    'commonsTemplate'               => $FormControls->getCommonsTemplate(),
    'gradeTemplate'                 => $FormControls->getGradeTemplate(),
    'LOCALE'                        => $i18n->LOCALE,
    'LOCALE_WITH_REGION'            => $i18n->LOCALE_WITH_REGION,
    'AvailableLocales'              => $SystemLocalesWithoutRegion,
    'AvailableLocalesWithRegion'    => $SystemLocalesWithRegion,
    'CountriesWithCatholicDioceses' => $CountriesWithCatholicDioceses,
    'DiocesesList'                  => $CatholicDiocesesByNation
]);

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
<?php Utilities::generateActionPromptModal(
    'makePatronActionPrompt',
    'makePatronActionModalLabel',
    $messages['PatronButton'],
    false,
    false,
    [['id' => 'designatePatronButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-user-graduate', 'label' => $messages['PatronButton'], 'disabled' => true]],
    $messages['CancelButton']
); ?>

<!-- DEFINE SET PROPERTY MODAL  -->
<?php Utilities::generateActionPromptModal(
    'setPropertyActionPrompt',
    'setPropertyActionModalLabel',
    $messages['Modal - Change name or grade'],
    true,
    true,
    [['id' => 'setPropertyButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-edit', 'label' => $messages['SetPropertyLabel'], 'disabled' => true]],
    $messages['CancelButton']
); ?>

<!-- DEFINE MOVE FESTIVITY MODAL  -->
<?php Utilities::generateActionPromptModal(
    'moveLiturgicalEventActionPrompt',
    'moveLiturgicalEventActionModalLabel',
    $messages['Modal - Move event'],
    true,
    false,
    [['id' => 'moveLiturgicalEventButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-calendar-day', 'label' => $messages['MoveLiturgicalEventLabel'], 'disabled' => true]],
    $messages['CancelButton']
); ?>

<!-- DEFINE NEW FESTIVITY MODAL  -->
<?php Utilities::generateActionPromptModal(
    'newLiturgicalEventActionPrompt',
    'newLiturgicalEventActionModalLabel',
    $messages['Modal - Create new event'],
    false,
    false,
    [['id' => 'newLiturgicalEventFromExistingButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-calendar-plus', 'label' => $messages['CreateLiturgicalEventLabel'], 'disabled' => true]],
    $messages['CancelButton']
); ?>

<!-- addPublishedRomanMissalPrompt -->
<div class="modal fade" id="addPublishedRomanMissalPrompt" tabindex="-1" role="dialog" aria-labelledby="addPublishedRomanMissalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addPublishedRomanMissalLabel"><?php echo $messages['AddMissalButton']; ?></h5>
            </div>
            <div class="modal-body">
                <form class="row justify-content-center needs-validation" novalidate>
                    <div class="form-group col col-md-10">
                        <label for="languageEditionRomanMissalName" class="fw-bold"><?php echo $messages['Modal - Choose missal']; ?>:</label>
                        <input list="languageEditionRomanMissalList" class="form-control" id="languageEditionRomanMissalName">
                        <div class="invalid-feedback"><?php echo $messages['Missal not found']; ?></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" id="addLanguageEditionRomanMissal" class="btn btn-primary" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo $messages['AddMissalEditionButton']; ?></button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo $messages['CancelButton']; ?></button>
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
