<?php

include_once("includes/i18n.php");

$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
define("LITCAL_API_URL", "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalEngine.php");
define("METADATA_URL", "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalMetadata.php");

$i18n = new i18n();
$dateToday = new DateTime();
$fmt = new IntlDateFormatter( $i18n->LOCALE,IntlDateFormatter::FULL, IntlDateFormatter::FULL, 'UTC', IntlDateFormatter::GREGORIAN, "MMMM" );
$fmtFull = new IntlDateFormatter( $i18n->LOCALE,IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN );
$monthDate = new DateTime();

function verifyCalendarIndexJson( $JSON ) {
    return (
        array_key_exists( "LitCalMetadata", $JSON ) &&
        is_array( $JSON["LitCalMetadata"] ) &&
        array_key_exists( "NationalCalendars", $JSON["LitCalMetadata"] ) &&
        is_array( $JSON["LitCalMetadata"]["NationalCalendars"] ) &&
        array_key_exists( "DiocesanCalendars", $JSON["LitCalMetadata"] ) &&
        is_array( $JSON["LitCalMetadata"]["DiocesanCalendars"] )
    );
}

$CalendarNations = [];
$SelectOptions = [];
$JSON = json_decode( file_get_contents( METADATA_URL ), true );
if( verifyCalendarIndexJson( $JSON ) ) {
    $NationalCalendars = $JSON["LitCalMetadata"]["NationalCalendars"];
    $DiocesanCalendars = $JSON["LitCalMetadata"]["DiocesanCalendars"];
    foreach( $DiocesanCalendars as $key => $value ) {
        if( !in_array( $value["nation"], $CalendarNations ) ) {
            array_push( $CalendarNations, $value["nation"] );
            $SelectOptions[$value["nation"]] = [];
        }
        array_push( $SelectOptions[$value["nation"]], "<option data-calendartype=\"diocesancalendar\" value=\"{$key}\">{$value["diocese"]}</option>" );
    }
    foreach( array_keys( $NationalCalendars ) as $key ) {
        if( !in_array( $key, $CalendarNations ) ) {
            array_push( $CalendarNations, $key );
        }
    }
    sort( $CalendarNations );
}

$haveCookie = false;

if(isset($_COOKIE['queryString'])) {
    $haveCookie = true;
    $cookieVal = json_decode($_COOKIE['queryString']);
}

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
        <?php include_once('./layout/calendarselect.php') ?>
            <div class="row">
                <div class="form-group col-md">
                    <label><?php echo _("Day"); ?></label>
                    <input class="form-control" id="dayControl" type="number" min="1" max="<?php echo $dateToday->format('t') ?>" value="<?php echo $haveCookie ? $cookieVal->day : $dateToday->format('d') ?>" />
                </div>
                <div class="form-group col-md">
                    <label><?php echo _("Month"); ?></label>
                    <select class="form-select" id="monthControl">
                        <?php foreach( range(1,12) as $monthNumber ) {
                            $monthDate->setDate($dateToday->format('Y'), $monthNumber, 15);
                            $selected = '';
                            if($haveCookie) {
                                if(intval($cookieVal->month) === $monthNumber) {
                                    $selected = 'selected';
                                }
                            } else {
                                if(intval($dateToday->format('n')) === $monthNumber) {
                                    $selected = 'selected';
                                }
                            }
                            echo "<option value=\"{$monthNumber}\" " . $selected . ">{$fmt->format($monthDate)}</option>";
                        }
                        ?>
                    </select>
                </div>
                <div class="form-group col-md">
                    <label><?php echo _("Year"); ?></label>
                    <input class="form-control" id="yearControl" type="number" min="1970" max="9999" value="<?php echo $haveCookie ? $cookieVal->year : $dateToday->format('Y') ?>" />
                </div>
            </div>
            <div class="card shadow m-2">
                <div class="card-header py-3">
                    <?php /**translators: %s = current selected date */ ?>
                    <h6 class="m-0 font-weight-bold text-primary"><?php echo sprintf( _("Liturgy of %s"), "<span id=\"dateOfLiturgy\">" . $fmtFull->format( $dateToday ) . "</span>" ); ?><i class="fas fa-cross float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                </div>
                <div class="card-body" id="liturgyResults">
                </div>
            </div>
        </div>
        <?php include_once('./layout/footer.php'); ?>
        <script nomodule defer src="https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js"></script>
</body>
</html>
