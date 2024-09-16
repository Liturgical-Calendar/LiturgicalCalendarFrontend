<?php

if (false === file_exists("credentials.php")) {
    die("missing credentials definition");
}

include_once("credentials.php");

if (false === defined("AUTH_USERS")) {
    die("missing AUTH_USERS definition");
}

if (false === is_array(AUTH_USERS) || 0 === count(AUTH_USERS)) {
    die("AUTH_USERS must be an array");
}

function authenticated()
{
    if (!isset($_SERVER['PHP_AUTH_USER']) || !isset($_SERVER['PHP_AUTH_PW'])) {
        return false;
    }
    if (array_key_exists($_SERVER['PHP_AUTH_USER'], AUTH_USERS) && password_verify($_SERVER['PHP_AUTH_PW'], AUTH_USERS[$_SERVER['PHP_AUTH_USER']])) {
        return true;
    }
    return false;
}

if (!authenticated()) {
    header("WWW-Authenticate: Basic realm=\"Please insert your credentials\"");
    header($_SERVER["SERVER_PROTOCOL"] . " 401 Unauthorized");
    echo "You need a username and password to access this service.";
    die();
}

include_once("./includes/I18n.php");
include_once("./layout/FormControls.php");

$i18n = new I18n();
$FormControls = new FormControls($i18n);

$isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false );

if ($isStaging) {
    $JSON = json_decode(file_get_contents('https://litcal.johnromanodorazio.com/api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json'), true);
    $thh = array_keys($JSON[0]);
    [ "litcal_events" => $FestivityCollection ] = json_decode(file_get_contents("https://litcal.johnromanodorazio.com/api/dev/events/?locale={$i18n->LOCALE}"), true);
} else {
    $JSON = json_decode(file_get_contents('api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json'), true);
    $thh = array_keys($JSON[0]);
    //$months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
    [ "LitCalAllFestivities" => $FestivityCollection ] = json_decode(file_get_contents("https://litcal.johnromanodorazio.com/api/dev/allevents/?locale={$i18n->LOCALE}"), true);
}


$messages = [
    "Tag"               => _("Tag"),
    "Name"              => _("Name"),
    "Day"               => _("Day"),
    "Month"             => _("Month"),
    "Liturgical color"  => _("Liturgical color"),
    "white"             => _("white"),
    "red"               => _("red"),
    "green"             => _("green"),
    "purple"            => _("purple"),
    /**translators: in reference to the first year from which this festivity takes place */
    "Since"             => _("Since"),
    /**translators: in reference to the year from which this festivity no longer needs to be dealt with */
    "Until"             => _("Until"),
    /**translators: label of the form row */
    "Designate Doctor"  => _("Designate Doctor of the Church"),
    /**translators: label of the form row */
    "New festivity"     => _("New festivity"),
    /**translators: label of the form row */
    "Change name or grade" => _("Change name or grade"),
    /**translators: label of the form row */
    "Move festivity" => _("Move festivity"),
    "Decree URL"        => _("Decree URL"),
    "Decree Langs"      => _("Decree Language mappings"),
    "Reason"            => _("Reason (in favor of festivity)"),
    "commonsTemplate"   => $FormControls->getCommonsTemplate(),
    "gradeTemplate"     => $FormControls->getGradeTemplate(),
    "LOCALE"            => $i18n->LOCALE,
];

$buttonGroup = "<div id=\"memorialsFromDecreesBtnGrp\">
<hr><div class=\"d-flex justify-content-around\">
<button class=\"btn btn-sm btn-primary m-2\" id=\"setPropertyAction\" data-bs-toggle=\"modal\" data-bs-target=\"#setPropertyActionPrompt\"><i class=\"fas fa-edit me-2\"></i>" . _("Change name or grade of existing festivity") . "</button>
<button class=\"btn btn-sm btn-primary m-2\" id=\"moveFestivityAction\" data-bs-toggle=\"modal\" data-bs-target=\"#moveFestivityActionPrompt\"><i class=\"fas fa-calendar-day me-2\"></i>" . _("Move festivity to new date") . "</button>
<button class=\"btn btn-sm btn-primary m-2\" id=\"newFestivityAction\" data-bs-toggle=\"modal\" data-bs-target=\"#newFestivityActionPrompt\"><i class=\"far fa-calendar-plus me-2\"></i>" . _("Create a new festivity") . "</button>
<button class=\"btn btn-sm btn-primary m-2\" id=\"makeDoctorAction\" data-bs-toggle=\"modal\" data-bs-target=\"#makeDoctorActionPrompt\"><i class=\"fas fa-user-graduate me-2\"></i>" . _("Designate Doctor of the Church from existing festivity") . "</button>
</div>
</div>";

function generateModalBody(bool $hasPropertyChange = false): void
{
    $modalBody = "<div class=\"modal-body\">
    <form class=\"row justify-content-left needs-validation\" novalidate>
        <div class=\"form-group col col-md-10\">
            <label for=\"existingFestivityName\" class=\"font-weight-bold\">" . _("Choose from existing festivities") . ":</label>
            <input list=\"existingFestivitiesList\" class=\"form-control existingFestivityName\" required>
            <div class=\"invalid-feedback\">" . _("This festivity does not seem to exist? Please choose from a value in the list.") . "</div>
        </div>";
    if ($hasPropertyChange) {
        $modalBody .= "<div class=\"form-group col col-md-6\">
            <label for=\"propertyToChange\" class=\"font-weight-bold\">" . _("Property to change") . ":</label>
            <select class=\"form-select\" id=\"propertyToChange\" name=\"propertyToChange\">
                <option value=\"name\">" . _("Name") . "</option>
                <option value=\"grade\">" . _("Grade") . "</option>
            </select>
        </div>";
    }
    $modalBody .= "</form></div>";
    echo $modalBody;
}

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
            <option value="api/dev/data/propriumdesanctis_1970/propriumdesanctis_1970.json">propriumdesanctis_1970.json</option>
            <option value="api/dev/data/propriumdesanctis_2002/propriumdesanctis_2002.json">propriumdesanctis_2002.json</option>
            <option value="api/dev/data/propriumdesanctis_ITALY_1983/propriumdesanctis_ITALY_1983.json">propriumdesanctis_ITALY_1983.json</option>
            <option value="api/dev/data/propriumdesanctis_USA_2011/propriumdesanctis_USA_2011.json">propriumdesanctis_USA_2011.json</option>
            <option value="api/dev/data/propriumdetempore.json">propriumdetempore.json</option>
            <option value="api/dev/data/memorialsFromDecrees/memorialsFromDecrees.json">memorialsFromDecrees.json</option>
        </select>
    </div>
    <div class="d-flex m-2 justify-content-end">
        <button class="btn btn-primary me-2" id="addColumnBtn"><i class="fas fa-plus-square me-2"></i>Add Column<i class="fas fa-columns ms-2"></i></button>
        <button class="btn btn-primary me-2" id="saveDataBtn"><i class="fas fa-save me-2"></i>Save data</button>
    </div>
    <div id="tableContainer">
        <table class="table" id="jsonDataTbl">
            <thead class="bg-secondary text-white sticky-top">
                <tr>
                    <?php
                        $i = 0;
                        $n = [ 10, 10, 14, 5, 25, 0, 6, 30 ];
                    foreach ($thh as $th) {
                        echo "<th class=\"sticky-top\" style=\"width: {$n[$i++]}%;\" scope=\"col\">$th</th>";
                    }
                    ?>
                </tr>
            </thead>
            <tbody>
                <?php
                foreach ($JSON as $row) {
                    echo "<tr>";
                    foreach ($row as $value) {
                        if (is_array($value) && is_string(array_keys($value)[0])) {
                            echo "<td contenteditable='false'>";
                            echo "<table><tbody>";
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
                            echo "</tbody></table>";
                            echo "</td>";
                        } elseif (is_array($value)) {
                            echo "<td contenteditable='false'>" . implode(",", $value) . "</td>";
                        } else {
                            echo "<td contenteditable='false'>$value</td>";
                        }
                    }
                    echo "</tr>";
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
                    <h5 class="modal-title" id="setPropertyActionModalLabel"><?php echo _("Change name or grade of existing festivity") ?></h5>
                </div>
                <?php generateModalBody(true); ?>
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
                <?php generateModalBody(false); ?>
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
                <?php generateModalBody(false); ?>
                <div class="modal-footer">
                    <button type="button" id="newFestivityFromExistingButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-calendar-plus me-2"></i><?php echo _("New Festivity from existing") ?></button>
                    <button type="button" id="newFestivityExNovoButton" class="btn btn-primary actionPromptButton"><i class="fas fa-calendar-plus me-2"></i><?php echo _("New Festivity ex novo") ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
                </div>
            </div>
        </div>
    </div>

    <!-- DEFINE MAKE DOCTOR MODAL  -->
    <div class="modal fade actionPromptModal" id="makeDoctorActionPrompt" tabindex="-1" role="dialog" aria-labelledby="makeDoctorActionModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="makeDoctorActionModalLabel"><?php echo _("Designate Doctor of the Church from existing festivity") ?></h5>
                </div>
                <?php generateModalBody(false); ?>
                <div class="modal-footer">
                    <button type="button" id="designateDoctorButton" class="btn btn-primary actionPromptButton" disabled><i class="fas fa-user-graduate me-2"></i><?php echo _("Designate Doctor of the Church") ?></button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-window-close me-2"></i><?php echo _("Cancel") ?></button>
                </div>
            </div>
        </div>
    </div>

    <datalist id="existingFestivitiesList">
    <?php
    foreach ($FestivityCollection as $key => $festivity) {
        echo "<option value=\"{$key}\">{$festivity["NAME"]}</option>";
    }
    ?>
    </datalist>
    <script>
        const messages = <?php echo json_encode($messages); ?>;
        const FestivityCollection = <?php echo json_encode($FestivityCollection); ?>;
    </script>

    <?php include_once('./layout/footer.php'); ?>
</body>
