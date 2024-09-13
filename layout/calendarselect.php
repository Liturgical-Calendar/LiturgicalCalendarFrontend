<?php
$CalendarNations = [];
$SelectOptions = [];

$metadataRaw = file_get_contents("https://litcal.johnromanodorazio.com/api/{$endpointV}/calendars");
$metadataJSON = json_decode($metadataRaw, true);
[ 'litcal_metadata' => $CalendarIndex ] = $metadataJSON;
foreach ($CalendarIndex["diocesan_calendars"] as $diocesanCalendar) {
    if (!in_array($diocesanCalendar["nation"], $CalendarNations)) {
        array_push($CalendarNations, $diocesanCalendar["nation"]);
        $SelectOptions[$diocesanCalendar["nation"]] = [];
    }
    array_push($SelectOptions[$diocesanCalendar["nation"]], "<option data-calendartype=\"diocesancalendar\" value=\"{$diocesanCalendar['calendar_id']}\">{$diocesanCalendar["diocese"]}</option>");
}
foreach ($CalendarIndex["national_calendars_keys"] as $key) {
    if (!in_array($key, $CalendarNations)) {
        array_push($CalendarNations, $key);
    }
}
sort($CalendarNations);
?>

<div class="row">
    <div class="form-group col-md">
        <label><?php echo _("Select calendar"); ?></label>
        <select class="form-select" id="calendarSelect">
            <?php foreach ($CalendarNations as $nation) {
                if (array_key_exists($nation, $SelectOptions) && is_array($SelectOptions[ $nation ])) {
                    echo "<option data-calendartype=\"nationalcalendar\" value=\"{$nation}\">$nation</option>";
                    echo "<optgroup label=\"$nation\">" . PHP_EOL;
                    foreach ($SelectOptions[$nation] as $option) {
                        echo $option . PHP_EOL;
                    }
                    echo "</optgroup>";
                } else {
                    echo "<option data-calendartype=\"nationalcalendar\" value=\"{$nation}\">$nation</option>";
                }
            }
            ?>
        </select>
    </div>
</div>
