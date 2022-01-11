<?php

include_once("includes/i18n.php");

$i18n = new i18n();
$dateToday = new DateTime();
$fmt = new IntlDateFormatter( $i18n->LOCALE,IntlDateFormatter::FULL, IntlDateFormatter::FULL, 'UTC', IntlDateFormatter::GREGORIAN, "MMMM" );
$fmtFull = new IntlDateFormatter( $i18n->LOCALE,IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN );
$monthDate = new DateTime();

$CalendarNations = [];
$SelectOptions = [];
$CalendarIndex = json_decode( file_get_contents( 'https://litcal.johnromanodorazio.com/api/v3/LitCalMetadata.php' ), true );
foreach( $CalendarIndex as $key => $value ) {
    if( !in_array( $value["nation"], $CalendarNations ) ) {
        array_push( $CalendarNations, $value["nation"] );
        $SelectOptions[$value["nation"]] = [];
    }
    array_push( $SelectOptions[$value["nation"]], "<option data-calendartype=\"diocesancalendar\" value=\"{$key}\">{$value["diocese"]}</option>" );
}
if( !in_array( "USA", $CalendarNations ) ) {
    array_push( $CalendarNations, "USA" );
}
if( !in_array( "Italy", $CalendarNations ) ) {
    array_push( $CalendarNations, "Italy" );
}
if( !in_array( "Vatican", $CalendarNations ) ) {
    array_push( $CalendarNations, "Vatican" );
}
sort( $CalendarNations );

?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "General Roman Calendar") . ' - ' . _( 'Liturgy of any day' ) ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-gray-800"><?php echo _( "Liturgy of any day" ); ?></h3>
        <div class="container">
            <div class="row">
                <div class="form-group col-md">
                    <label><?php echo _("Select calendar"); ?></label>
                    <select class="form-control" id="calendarSelect">
                        <?php foreach( $CalendarNations as $nation ) {
                            if( is_array( $SelectOptions[ $nation ] ) ) {
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
            <div class="row">
                <div class="form-group col-md">
                    <label><?php echo _("Day"); ?></label>
                    <input class="form-control" id="dayControl" type="number" min="1" max="<?php echo $dateToday->format('t') ?>" value="<?php echo $dateToday->format('d') ?>" />
                </div>
                <div class="form-group col-md">
                    <label><?php echo _("Month"); ?></label>
                    <select class="form-control" id="monthControl">
                        <?php foreach( range(1,12) as $monthNumber ) {
                            $monthDate->setDate($dateToday->format('Y'), $monthNumber, 1);
                            echo "<option value=\"{$monthNumber}\">{$fmt->format($monthDate)}</option>";
                        }
                        ?>
                    </select>
                </div>
                <div class="form-group col-md">
                    <label><?php echo _("Year"); ?></label>
                    <input class="form-control" id="yearControl" type="number" min="1970" max="9999" value="<?php echo $dateToday->format('Y') ?>" />
                </div>
            </div>
            <div class="card shadow m-2">
                <div class="card-header py-3">
                    <?php /**translators: %s = current selected date */ ?>
                    <h6 class="m-0 font-weight-bold text-primary"><?php echo sprintf( _("Liturgy of %s"), "<span id=\"dateOfLiturgy\">" . $fmtFull->format( $dateToday ) . "</span>" ); ?><i class="fas fa-cross float-right text-gray-600"></i></h6>
                </div>
                <div class="card-body" id="liturgyResults">
                </div>
            </div>
        </div>
        <?php include_once('./layout/footer.php'); ?>
        <script nomodule defer src="https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js"></script>
</body>
</html>
