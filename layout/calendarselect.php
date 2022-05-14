<?php
$CalendarNations = [];
$SelectOptions = [];
[ 'LitCalMetadata' => $CalendarIndex ] = json_decode( file_get_contents( 'https://litcal.johnromanodorazio.com/api/v3/LitCalMetadata.php' ), true );
foreach( $CalendarIndex["DiocesanCalendars"] as $key => $value ) {
    if( !in_array( $value["nation"], $CalendarNations ) ) {
        array_push( $CalendarNations, $value["nation"] );
        $SelectOptions[$value["nation"]] = [];
    }
    array_push( $SelectOptions[$value["nation"]], "<option data-calendartype=\"diocesancalendar\" value=\"{$key}\">{$value["diocese"]}</option>" );
}
foreach( array_keys($CalendarIndex["NationalCalendars"]) as $key ) {
    if( !in_array( $key, $CalendarNations ) ) {
        array_push( $CalendarNations, $key );
    }
}
sort( $CalendarNations );
?>

<div class="row">
    <div class="form-group col-md">
        <label><?php echo _("Select calendar"); ?></label>
        <select class="form-control" id="calendarSelect">
            <?php foreach( $CalendarNations as $nation ) {
                if( array_key_exists( $nation, $SelectOptions ) && is_array( $SelectOptions[ $nation ] ) ) {
                    echo "<option data-calendartype=\"nationalcalendar\" value=\"{$nation}\">$nation</option>";
                    echo "<optgroup label=\"$nation\">" . PHP_EOL;
                    foreach( $SelectOptions[$nation] as $option ) {
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
