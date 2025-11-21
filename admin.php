<?php

include_once('common.php'); // provides $i18n and all API URLs

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

/**
 * Fetch missals and events
 */
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $missalsURL . '/EDITIO_TYPICA_1970');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept-Language: ' . $i18n->LOCALE]);
$missalsResponse = curl_exec($ch);

curl_setopt($ch, CURLOPT_URL, $eventsURL);
$eventsResponse = curl_exec($ch);
curl_close($ch);


/**
 * Decode the JSON responses
 */
$MissalData = json_decode($missalsResponse, true);

if (!is_array($decodedMissals)) {
    die('Invalid missals JSON from API');
}

if (empty($MissalData) || !is_array($MissalData[0])) {
    die('Unexpected missal data structure from API');
}

$thh = array_keys($MissalData[0]);

$decodedEvents = json_decode($eventsResponse, true);

if (!is_array($decodedEvents) || !isset($decodedEvents['litcal_events']) || !is_array($decodedEvents['litcal_events'])) {
    die('Invalid events JSON from API');
}

[ 'litcal_events' => $LiturgicalEventCollection ] = $decodedEvents;

/**
 * Prepare our translations strings
 */
$messages = [
    'Event key'             => _('Event key'),
    'Name'                  => _('Name'),
    'Day'                   => _('Day'),
    'Month'                 => _('Month'),
    'Liturgical color'      => _('Liturgical color'),
    'white'                 => _('white'),
    'red'                   => _('red'),
    'green'                 => _('green'),
    'purple'                => _('purple'),
    'rose'                  => _('rose'),
    /**translators: in reference to the first year from which this liturgical event takes place */
    'Since'                 => _('Since'),
    /**translators: in reference to the year from which this liturgical event no longer needs to be dealt with */
    'Until'                 => _('Until'),
    /**translators: label of the form row */
    'Designate Doctor'      => _('Designate Doctor of the Church'),
    /**translators: label of the form row */
    'New liturgical event'  => _('New liturgical event'),
    /**translators: label of the form row */
    'Change name or grade'  => _('Change name or grade'),
    /**translators: label of the form row */
    'Move liturgical event' => _('Move liturgical event'),
    'Decree URL'            => _('Decree URL'),
    'Decree Langs'          => _('Decree Language mappings'),
    'Reason'                => _('Reason (in favor of liturgical event)'),
    'commonsTemplate'       => $FormControls->getCommonsTemplate(),
    'gradeTemplate'         => $FormControls->getGradeTemplate(),
    'LOCALE'                => $i18n->LOCALE,
];

$buttonGroup = '<div id="memorialsFromDecreesBtnGrp">
<hr><div class="d-flex justify-content-around">
<button class="btn btn-sm btn-primary m-2" id="setPropertyAction" data-bs-toggle="modal" data-bs-target="#setPropertyActionPrompt"><i class="fas fa-edit me-2"></i>' . _('Change name or grade of existing liturgical event') . '</button>
<button class="btn btn-sm btn-primary m-2" id="moveLiturgicalEventAction" data-bs-toggle="modal" data-bs-target="#moveLiturgicalEventActionPrompt"><i class="fas fa-calendar-day me-2"></i>' . _('Move liturgical event to new date') . '</button>
<button class="btn btn-sm btn-primary m-2" id="newLiturgicalEventAction" data-bs-toggle="modal" data-bs-target="#newLiturgicalEventActionPrompt"><i class="far fa-calendar-plus me-2"></i>' . _('Create a new liturgical event') . '</button>
<button class="btn btn-sm btn-primary m-2" id="makeDoctorAction" data-bs-toggle="modal" data-bs-target="#makeDoctorActionPrompt"><i class="fas fa-user-graduate me-2"></i>' . _('Designate Doctor of the Church from existing liturgical event') . '</button>
</div>
</div>';

?>
<!DOCTYPE html>
<head>
    <title>Administration tools</title>
    <?php include_once('./layout/head.php'); ?>
</head>

<body>
    <?php include_once('./layout/header.php'); ?>
    <h1>Liturgical Calendar project Administration tools</h1>
    <div class="form-group col-md">
        <label>Select JSON file to manage:</label>
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
        <button class="btn btn-primary me-2" id="addColumnBtn"><i class="fas fa-plus-square me-2"></i>Add Column<i class="fas fa-columns ms-2"></i></button>
        <button class="btn btn-primary me-2" id="saveDataBtn"><i class="fas fa-save me-2"></i>Save data</button>
    </div>
    <div id="tableContainer">
        <table class="table" id="jsonDataTbl">
            <thead class="bg-secondary text-white sticky-top">
                <tr><?php
                $i = 0;
                $n = [ 5, 5, 14, 5, 20, 0, 6, 30, 15 ];
                foreach ($thh as $th) {
                    echo "<th class=\"sticky-top\" style=\"width: {$n[$i++]}%;\" scope=\"col\">$th</th>";
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
                                if (is_array($val)) {
                                    echo "<tr><td colspan=\"2\" style=\"text-align:center;font-weight:bold;border:0;background-color:lightgray;\">$title</td></tr>";
                                    foreach ($val as $title2 => $val2) {
                                        echo "<tr><td>$title2</td><td contenteditable='false'>$val2</td></tr>";
                                    }
                                } else {
                                    echo "<tr><td>$title</td><td contenteditable='false'>$val</td></tr>";
                                }
                            }
                            echo '</tbody></table>';
                            echo '</td>';
                        } elseif (is_array($value)) {
                            echo "<td contenteditable='false'>" . implode(',', $value) . '</td>';
                        } else {
                            echo "<td contenteditable='false'>$value</td>";
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
                    <h5 class="modal-title" id="setPropertyActionModalLabel"><?php echo _('Change name or grade of existing liturgical event') ?></h5>
                </div>
                <?php Utilities::generateModalBody(true, true); ?>
                <div class="modal-footer">
                    <button type="button" id="setPropertyButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-edit me-2"></i>Set Property</button>
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
                    <button type="button" id="moveLiturgicalEventButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-day me-2"></i><?php echo _('Move LiturgicalEvent') ?></button>
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
                    <button type="button" id="newLiturgicalEventFromExistingButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo _('New LiturgicalEvent from existing') ?></button>
                    <button type="button" id="newLiturgicalEventExNovoButton" class="btn btn-primary actionPromptButton"><i class="fas fa-calendar-plus me-2"></i><?php echo _('New LiturgicalEvent ex novo') ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- DEFINE MAKE DOCTOR MODAL  -->
    <div class="modal fade actionPromptModal" id="makeDoctorActionPrompt" tabindex="-1" role="dialog" aria-labelledby="makeDoctorActionModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="makeDoctorActionModalLabel"><?php echo _('Designate Doctor of the Church from existing liturgical event') ?></h5>
                </div>
                <?php Utilities::generateModalBody(true, false); ?>
                <div class="modal-footer">
                    <button type="button" id="designateDoctorButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-user-graduate me-2"></i><?php echo _('Designate Doctor of the Church') ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _('Cancel') ?></button>
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
        const Messages = <?php echo json_encode($messages); ?>;
        const LiturgicalEventCollection = <?php echo json_encode($LiturgicalEventCollection); ?>;
        const LiturgicalEventCollectionKeys = <?php echo json_encode(array_column($LiturgicalEventCollection, 'event_key')); ?>;
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
