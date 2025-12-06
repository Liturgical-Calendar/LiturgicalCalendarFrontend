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

if (false === file_exists('credentials.php')) {
    die('missing credentials definition');
}

include_once('credentials.php');

if (false === defined('AUTH_USERS')) {
    die('missing AUTH_USERS definition');
}

if (false === is_array(AUTH_USERS) || 0 === count(AUTH_USERS)) {
    die('AUTH_USERS must be an array');
}


if (!Utilities::authenticated(AUTH_USERS)) {
    header('WWW-Authenticate: Basic realm="Please insert your credentials"');
    header($_SERVER['SERVER_PROTOCOL'] . ' 401 Unauthorized');
    echo 'You need a username and password to access this service.';
    die();
}

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

$thh = array_keys($firstMissalRecord);

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
    <div class="form-group col-md">
        <label for="jsonFileSelect"><?php echo $messages['Select JSON file to manage']; ?>:</label>
        <select class="form-select" id="jsonFileSelect">
            <option value="api/dev/jsondata/sourcedata/missals/propriumdesanctis_1970/propriumdesanctis_1970.json">Editio Typica 1970</option>
            <option value="api/dev/jsondata/sourcedata/missals/propriumdesanctis_2002/propriumdesanctis_2002.json">Editio Typica Tertia 2002</option>
            <option value="api/dev/jsondata/sourcedata/missals/propriumdesanctis_2008/propriumdesanctis_2008.json">Editio Typica Tertia Emendata 2008</option>
            <option value="api/dev/jsondata/sourcedata/missals/propriumdesanctis_IT_1983/propriumdesanctis_IT_1983.json">Messale Romano ed. 1983 pubblicata dalla CEI</option>
            <option value="api/dev/jsondata/sourcedata/missals/propriumdesanctis_US_2011/propriumdesanctis_US_2011.json">2011 Roman Missal issued by the USCCB</option>
            <option value="api/dev/jsondata/sourcedata/missals/propriumdetempore/propriumdetempore.json">propriumdetempore.json</option>
            <option value="api/dev/jsondata/sourcedata/decrees/decrees.json">decrees.json</option>
        </select>
    </div>
    <div class="d-flex m-2 justify-content-end">
        <button class="btn btn-primary me-2" id="addColumnBtn"><i class="fas fa-plus-square me-2"></i><?php echo $messages['AddColumnButton']; ?><i class="fas fa-columns ms-2"></i></button>
        <button class="btn btn-primary me-2" id="saveDataBtn"><i class="fas fa-save me-2"></i><?php echo $messages['SaveDataButton']; ?></button>
    </div>
    <div id="tableContainer">
        <table class="table" id="jsonDataTbl">
            <thead class="bg-secondary text-white sticky-top">
                <tr><?php
                $i = 0;
                $n = [ 5, 5, 14, 5, 20, 0, 6, 30, 15 ];
                foreach ($thh as $th) {
                    $safeTh = htmlspecialchars((string) $th, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                    $width  = $n[$i] ?? 0;
                    echo "<th class=\"sticky-top\" style=\"width: {$width}%;\" scope=\"col\">$safeTh</th>";
                    $i++;
                }
                ?></tr>
            </thead>
            <tbody>
                <?php
                foreach ($MissalData as $row) {
                    echo '<tr>';
                    foreach ($row as $value) {
                        if (is_array($value) && is_string(array_keys($value)[0])) {
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
    <div class="modal fade actionPromptModal" id="setPropertyActionPrompt" tabindex="-1" role="dialog" aria-labelledby="setPropertyActionModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="setPropertyActionModalLabel"><?php echo $messages['SetPropertyButton']; ?></h5>
                </div>
                <?php Utilities::generateActionPromptModalBody(true, true); ?>
                <div class="modal-footer">
                    <button type="button" id="setPropertyButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-edit me-2"></i><?php echo $messages['SetPropertyLabel']; ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo $messages['CancelButton']; ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- DEFINE MOVE FESTIVITY MODAL  -->
    <div class="modal fade actionPromptModal" id="moveLiturgicalEventActionPrompt" tabindex="-1" role="dialog" aria-labelledby="moveLiturgicalEventActionModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="moveLiturgicalEventActionModalLabel"><?php echo $messages['MoveEventButton']; ?></h5>
                </div>
                <?php Utilities::generateActionPromptModalBody(true, false); ?>
                <div class="modal-footer">
                    <button type="button" id="moveLiturgicalEventButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-day me-2"></i><?php echo $messages['MoveLiturgicalEventLabel']; ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo $messages['CancelButton']; ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- DEFINE NEW FESTIVITY MODAL  -->
    <div class="modal fade actionPromptModal" id="newLiturgicalEventActionPrompt" tabindex="-1" role="dialog" aria-labelledby="newLiturgicalEventActionModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="newLiturgicalEventActionModalLabel"><?php echo $messages['Modal - Create new event']; ?></h5>
                </div>
                <?php Utilities::generateActionPromptModalBody(false, false); ?>
                <div class="modal-footer">
                    <button type="button" id="newLiturgicalEventFromExistingButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo $messages['NewEventFromExistingButton']; ?></button>
                    <button type="button" id="newLiturgicalEventExNovoButton" class="btn btn-primary actionPromptButton"><i class="fas fa-calendar-plus me-2"></i><?php echo $messages['NewEventExNovoButton']; ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo $messages['CancelButton']; ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- DEFINE MAKE DOCTOR MODAL  -->
    <div class="modal fade actionPromptModal" id="makeDoctorActionPrompt" tabindex="-1" role="dialog" aria-labelledby="makeDoctorActionModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="makeDoctorActionModalLabel"><?php echo $messages['MakeDoctorButton']; ?></h5>
                </div>
                <?php Utilities::generateActionPromptModalBody(true, false); ?>
                <div class="modal-footer">
                    <button type="button" id="designateDoctorButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-user-graduate me-2"></i><?php echo $messages['Designate Doctor']; ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo $messages['CancelButton']; ?></button>
                </div>
            </div>
        </div>
    </div>

    <datalist id="existingLiturgicalEventsList">
    <?php
    foreach ($LiturgicalEventCollection as $liturgical_event) {
        $event_key = htmlspecialchars($liturgical_event['event_key'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $name      = htmlspecialchars($liturgical_event['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo "<option value=\"{$event_key}\">{$name}</option>";
    }
    ?>
    </datalist>
    <script>
        const Messages = <?php echo json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
        const LiturgicalEventCollection = <?php echo json_encode($LiturgicalEventCollection, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
        const LiturgicalEventCollectionKeys = <?php echo json_encode(array_column($LiturgicalEventCollection, 'event_key'), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
