<?php

include_once 'includes/common.php'; // provides $i18n and all API URLs
include_once 'includes/messages.php';

// Defensive initialization: ensure $messages is an array before use
if (!isset($messages) || !is_array($messages)) {
    $messages = [];
}

use LiturgicalCalendar\Frontend\ApiClient;
use LiturgicalCalendar\Frontend\FormControls;
use LiturgicalCalendar\Frontend\Utilities;

$FormControls = new FormControls($i18n);

$messages = array_merge($messages, [
    'commonsTemplate'    => $FormControls->getCommonsTemplate(),
    'gradeTemplate'      => $FormControls->getGradeTemplate(),
    'LOCALE'             => $i18n->LOCALE,
    'LOCALE_WITH_REGION' => $i18n->LOCALE_WITH_REGION,
    //'AvailableLocales'              => $SystemLocalesWithoutRegion,
    //'AvailableLocalesWithRegion'    => $SystemLocalesWithRegion,
    //'CountriesWithCatholicDioceses' => $CountriesWithCatholicDioceses,
    //'DiocesesList'                  => $CatholicDiocesesByNation
]);

/**
 * Fetch missals and events using Guzzle-based client
 */
$apiClient = new ApiClient($i18n->LOCALE);

try {
    $MissalData = $apiClient->fetchJson($apiConfig->missalsUrl . '/EDITIO_TYPICA_1970');
} catch (\RuntimeException $e) {
    die('Error fetching missals from API: ' . $e->getMessage());
}

$firstMissalRecord = reset($MissalData);
if (empty($MissalData) || !is_array($firstMissalRecord)) {
    die('Unexpected missal data structure from API');
}

// Filter out "calendar" property - not needed in the admin table
$thh = array_values(array_filter(array_keys($firstMissalRecord), fn($key) => $key !== 'calendar'));

try {
    $eventsData                = $apiClient->fetchJsonWithKey($apiConfig->eventsUrl, 'litcal_events');
    $LiturgicalEventCollection = $eventsData['litcal_events'];
} catch (\RuntimeException $e) {
    die('Error fetching events from API: ' . $e->getMessage());
}


$buttonGroup = '<div id="memorialsFromDecreesBtnGrp">
<hr><div class="d-flex justify-content-around">
<button class="btn btn-sm btn-primary m-2" id="setPropertyAction" data-bs-toggle="modal" data-bs-target="#setPropertyActionPrompt"><i class="fas fa-edit me-2"></i>' . $messages['SetPropertyButton'] . '</button>
<button class="btn btn-sm btn-primary m-2" id="moveLiturgicalEventAction" data-bs-toggle="modal" data-bs-target="#moveLiturgicalEventActionPrompt"><i class="fas fa-calendar-day me-2"></i>' . $messages['MoveEventButton'] . '</button>
<button class="btn btn-sm btn-primary m-2" id="newLiturgicalEventAction" data-bs-toggle="modal" data-bs-target="#newLiturgicalEventActionPrompt"><i class="far fa-calendar-plus me-2"></i>' . $messages['Modal - Create new event'] . '</button>
<button class="btn btn-sm btn-primary m-2" id="makeDoctorAction" data-bs-toggle="modal" data-bs-target="#makeDoctorActionPrompt"><i class="fas fa-user-graduate me-2"></i>' . $messages['MakeDoctorButton'] . '</button>
</div>
</div>';

?>
<!DOCTYPE html>
<head>
    <title><?php echo $messages['Page title - Admin']; ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>

<body>
    <?php include_once('./layout/header.php'); ?>
    <h1><?php echo $messages['Admin heading']; ?></h1>

    <!-- Login required message (shown when not authenticated) -->
    <div class="alert alert-info" id="loginRequiredMessage" data-requires-no-auth>
        <i class="fas fa-info-circle me-2"></i>
        <?php echo _('Please login to access the admin interface.'); ?>
    </div>

    <!-- Admin interface (hidden until authenticated) -->
    <div id="adminInterface" class="d-none" data-requires-auth="true">
        <div class="row mb-3">
            <div class="col-12 col-md-6 col-lg-4">
                <label for="jsonFileSelect" class="form-label"><?php echo $messages['Select data source']; ?>:</label>
                <select class="form-select" id="jsonFileSelect">
                    <option value="missals/EDITIO_TYPICA_1970">Editio Typica 1970</option>
                    <option value="missals/EDITIO_TYPICA_2002">Editio Typica Tertia 2002</option>
                    <option value="missals/EDITIO_TYPICA_2008">Editio Typica Tertia Emendata 2008</option>
                    <option value="missals/IT_1983">Messale Romano ed. 1983 pubblicata dalla CEI</option>
                    <option value="missals/US_2011">2011 Roman Missal issued by the USCCB</option>
                    <option value="decrees">Decrees</option>
                </select>
            </div>
            <div class="col-12 col-md-6 col-lg-8 d-flex align-items-end justify-content-end mt-2 mt-md-0">
                <button class="btn btn-primary me-2" id="addColumnBtn"><i class="fas fa-plus-square me-2"></i><span class="d-none d-sm-inline"><?php echo $messages['AddColumnButton']; ?></span><i class="fas fa-columns ms-2"></i></button>
                <button class="btn btn-primary" id="saveDataBtn"><i class="fas fa-save me-2"></i><span class="d-none d-sm-inline"><?php echo $messages['SaveDataButton']; ?></span></button>
            </div>
        </div>
    <div id="tableContainer" class="table-responsive">
        <table class="table table-sm" id="jsonDataTbl">
            <thead class="bg-secondary text-white sticky-top">
                <tr><?php
                foreach ($thh as $th) {
                    $safeTh = htmlspecialchars((string) $th, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                    echo "<th class=\"sticky-top\" scope=\"col\">$safeTh</th>";
                }
                ?></tr>
            </thead>
            <tbody>
                <?php
                foreach ($MissalData as $row) {
                    echo '<tr>';
                    foreach ($thh as $key) {
                        $value = $row[$key] ?? null;
                        if (is_array($value) && !empty($value) && is_string(array_keys($value)[0])) {
                            echo "<td contenteditable='false'>";
                            echo '<table><tbody>';
                            foreach ($value as $title => $val) {
                                $safeTitle = htmlspecialchars((string) $title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                if (is_array($val)) {
                                    echo "<tr><td colspan=\"2\" style=\"text-align:center;font-weight:bold;border:0;background-color:lightgray;\">$safeTitle</td></tr>";
                                    foreach ($val as $title2 => $val2) {
                                        $safeTitle2 = htmlspecialchars((string) $title2, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                        $safeVal2   = htmlspecialchars((string) $val2, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                        echo "<tr><td>$safeTitle2</td><td contenteditable='false'>$safeVal2</td></tr>";
                                    }
                                } else {
                                    $safeValue = htmlspecialchars((string) $val, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                    echo "<tr><td>$safeTitle</td><td contenteditable='false'>$safeValue</td></tr>";
                                }
                            }
                            echo '</tbody></table>';
                            echo '</td>';
                        } elseif (is_array($value)) {
                            $safeValue = htmlspecialchars(implode(',', $value), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            echo "<td contenteditable='false'>" . $safeValue . '</td>';
                        } elseif ($value === null) {
                            echo "<td contenteditable='false'>null</td>";
                        } else {
                            $safeValue = htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            echo "<td contenteditable='false'>$safeValue</td>";
                        }
                    }
                    echo '</tr>';
                }
                ?>
            </tbody>
        </table>
    </div>
    <?php echo $buttonGroup; ?>
    <form class="needs-validation" id="memorialsFromDecreesForm" novalidate>
    </form>

    <!-- DEFINE SET PROPERTY MODAL  -->
    <?php Utilities::generateActionPromptModal(
        'setPropertyActionPrompt',
        'setPropertyActionModalLabel',
        $messages['SetPropertyButton'],
        true,
        true,
        [['id' => 'setPropertyButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-edit', 'label' => $messages['SetPropertyLabel'], 'disabled' => true]],
        $messages['CancelButton']
    ); ?>

    <!-- DEFINE MOVE FESTIVITY MODAL  -->
    <?php Utilities::generateActionPromptModal(
        'moveLiturgicalEventActionPrompt',
        'moveLiturgicalEventActionModalLabel',
        $messages['MoveEventButton'],
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
        [
            ['id' => 'newLiturgicalEventFromExistingButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-calendar-plus', 'label' => $messages['NewEventFromExistingButton'], 'disabled' => true],
            ['id' => 'newLiturgicalEventExNovoButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-calendar-plus', 'label' => $messages['NewEventExNovoButton']]
        ],
        $messages['CancelButton']
    ); ?>

    <!-- DEFINE MAKE DOCTOR MODAL  -->
    <?php Utilities::generateActionPromptModal(
        'makeDoctorActionPrompt',
        'makeDoctorActionModalLabel',
        $messages['MakeDoctorButton'],
        true,
        false,
        [['id' => 'designateDoctorButton', 'class' => 'btn btn-primary actionPromptButton', 'icon' => 'fas fa-user-graduate', 'label' => $messages['Designate Doctor'], 'disabled' => true]],
        $messages['CancelButton']
    ); ?>

    <datalist id="existingLiturgicalEventsList">
    <?php
    foreach ($LiturgicalEventCollection as $liturgical_event) {
        $event_key = htmlspecialchars($liturgical_event['event_key'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $name      = htmlspecialchars($liturgical_event['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo "<option value=\"{$event_key}\">{$name}</option>";
    }
    ?>
    </datalist>
    </div><!-- end adminInterface -->

    <script>
        const Messages = <?php echo json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
        const LiturgicalEventCollection = <?php echo json_encode($LiturgicalEventCollection, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
        const LiturgicalEventCollectionKeys = <?php echo json_encode(array_column($LiturgicalEventCollection, 'event_key'), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
