<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$isStaging          = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$stagingURL         = $isStaging ? "-staging" : "";
$endpointV          = $isStaging ? "dev" : "v3";
$endpointURL        = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalEngine.php";
$metadataURL        = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalMetadata.php";
$dateOfEasterURL    = "https://litcal.johnromanodorazio.com/api/{$endpointV}/DateOfEaster.php";

include_once( 'includes/functions.php' );

$AllAvailableLocales = array_filter(ResourceBundle::getLocales(''), function ($value) {
    return strpos($value, 'POSIX') === false;
});
$LOCALE = isset($_GET["locale"]) && in_array($_GET["locale"], $AllAvailableLocales) ? $_GET["locale"] : "LA"; //default to latin
ini_set('date.timezone', 'Europe/Vatican');

$baseLocale = Locale::getPrimaryLanguage($LOCALE);
$localeArray = [
    $LOCALE . '.utf8',
    $LOCALE . '.UTF-8',
    $LOCALE,
    $baseLocale . '_' . strtoupper( $baseLocale ) . '.utf8',
    $baseLocale . '_' . strtoupper( $baseLocale ) . '.UTF-8',
    $baseLocale . '_' . strtoupper( $baseLocale ),
    $baseLocale . '.utf8',
    $baseLocale . '.UTF-8',
    $baseLocale
];
setlocale( LC_ALL, $localeArray );
bindtextdomain("litcal", "i18n");
textdomain("litcal");

$error_msg = "";
$ch = curl_init();

curl_setopt( $ch, CURLOPT_URL, $dateOfEasterURL . "?locale=" . $LOCALE );
curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
$response = curl_exec( $ch );
if ( curl_errno( $ch ) ) {
    $error_msg = curl_error( $ch );
    curl_close( $ch );
    die( $error_msg );
}
curl_close( $ch );
$DatesOfEaster = json_decode( $response );

$AvailableLocales = array_filter($AllAvailableLocales, function ($value) {
    return strpos($value, '_') === false;
});
$AvailableLocales = array_reduce($AvailableLocales, function($carry, $item) use($LOCALE){
    $carry[$item] = Locale::getDisplayLanguage($item, $LOCALE);
    return $carry;
},[]);

$c = new Collator($LOCALE);
$c->asort($AvailableLocales);

//uasort($AvailableLocales, 'strcmp');

?>
<!DOCTYPE html>
<head>
    <title><?php echo _('Date of Easter from 1583 to 9999')?></title>
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <meta name="msapplication-TileColor" content="#ffffff" />
    <meta name="msapplication-TileImage" content="easter-egg-5-144-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="152x152" href="easter-egg-5-152-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="144x144" href="easter-egg-5-144-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="120x120" href="easter-egg-5-120-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="114x114" href="easter-egg-5-114-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="72x72" href="easter-egg-5-72-279148.png">    
    <link rel="apple-touch-icon-precomposed" href="easter-egg-5-57-279148.png">
    <link rel="icon" href="easter-egg-5-32-279148.png" sizes="32x32">
    <link rel="stylesheet" href="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css">
    <link rel="stylesheet" href="assets/css/easter.css">
</head>
<body>
    <div id="clipDiv" style="position:absolute;top:-500px;height:7em;z-index:0;background-image:linear-gradient(to bottom, rgba(255,255,255, 1), rgba(255,255,255, 1), rgba(255,255,255, 0) );left: 0px;width: 100%;"></div>
    <div><a class="backNav" href="/">↩      <?php echo _('Go back')?>      ↩</a></div>
    <select id="langSelect">
        <?php
            foreach($AvailableLocales as $Lcl => $DisplayLang) {
                $optionContent = $baseLocale === 'en' ? $DisplayLang : $DisplayLang . ' (' . Locale::getDisplayLanguage($Lcl, 'en') . ')';
                echo '<option value="'.$Lcl.'"'. (strtolower($LOCALE) === strtolower($Lcl) ? " selected" : "") . ' title="'.Locale::getDisplayLanguage($Lcl, 'en').'">'. $optionContent . '</option>';
            }
        ?>
    </select>
    <div id="HistoryNavigationLeftSidebar">
        <div id="slider-vertical"></div>
        <div id="TimelineCenturiesContainer">
        <?php 
            for($i=16;$i<=100;$i++){
                $century = strtolower($LOCALE) === "en" ? ordinal($i) : integerToRoman($i);
                echo "<div class=\"TimelineCenturyMarker\">" . $century . " " . _("Century") . "</div>";
            }
        ?>
        </div>
    </div>
<?php

    echo '<h3 style="text-align:center;">' . _("Easter Day Calculation in PHP (Years in which Julian and Gregorian easter coincide are marked in yellow)") . '</h3>';

    $EasterTableContainer = '<div id="EasterTableContainer">';
    $EasterTableContainer .= '<table style="width:60%;margin:30px auto;border:1px solid Blue;border-radius: 6px; padding:10px;background:LightBlue;">';
    $EasterTableContainer .= '<thead><tr><th width="300">' . _('Gregorian Easter') . '</th><th width="300">' . _('Julian Easter') . '</th><th width="300">' . _('Julian Easter in Gregorian Calendar') . '</th></tr></thead>';
    $EasterTableContainer .= '<tbody>';
    //$Y = (int)date("Y");
    //for($i=1997;$i<=2037;$i++){
    for($i=1583;$i<=9999;$i++){
        $gregDateString = $DatesOfEaster->DatesArray[$i-1583]->gregorianDateString;
        $julianDateString = $DatesOfEaster->DatesArray[$i-1583]->julianDateString;
        $westernJulianDateString = $DatesOfEaster->DatesArray[$i-1583]->westernJulianDateString;

        $style_str = $DatesOfEaster->DatesArray[$i-1583]->coinciding ? ' style="background-color:Yellow;font-weight:bold;color:Blue;"' : '';
        $EasterTableContainer .= '<tr'.$style_str.'><td width="300">'.$gregDateString.'</td><td width="300">' . $julianDateString . '</td><td width="300">'.$westernJulianDateString.'</td></tr>';
    }
    $EasterTableContainer .= '</tbody></table>';
    $EasterTableContainer .= '</div>';

    echo '<div style="text-align:center;width:40%;margin:0px auto;font-size:.7em;z-index:10;position:relative;"><i>The last coinciding Easter will be: ' . $DatesOfEaster->lastCoincidenceString . '</i></div>';
    echo $EasterTableContainer;
?>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js"></script>
    <script>
        const scale = (num, in_min, in_max, out_min, out_max) => {
            return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        }
        //const isStaging = window.location.pathname.includes('-staging');

        $(document).ready(function(){
            //if(isStaging){ $('.backNav').attr('href','/LiturgicalCalendar-staging/'); }
            let tableH = $('#EasterTableContainer table').height();
            let timelineH = $("#TimelineCenturiesContainer").children().last().offset().top - $("#TimelineCenturiesContainer").children().first().offset().top;
            timelineH /= 2;
            timelineH -= $("#TimelineCenturiesContainer").children().first().outerHeight();
            $('#TimelineCenturiesContainer div:first-child').addClass('highlight');
            let distFromTop = Math.round($('thead tr').offset().top) + 'px';
            $('#clipDiv').css({'top':'calc('+distFromTop+' - 3em)'});

            $("html,body").animate({scrollTop: 0}, 1000);
            $( "#slider-vertical" ).slider({
                orientation: "vertical",
                range: "min",
                step: 1,
                min: 0,
                max: 1000,
                value: 1000,
                slide: function( event, ui ) {
                    let slideVal = 1000 - ui.value;
                    let scrollAmount = scale(slideVal, 0, 1000, 0, tableH);
                    let scrollAmount2 = scale(slideVal, 0, 1000, 0, timelineH);
                    let nthCentury = Math.ceil(scale(slideVal, 0, 1000, 0, 84)) + 1;
                    $('#EasterTableContainer').scrollTop(scrollAmount);
                    $('#TimelineCenturiesContainer').scrollTop(scrollAmount2);
                    $('.highlight').removeClass('highlight');
                    $('#TimelineCenturiesContainer div:nth-child('+nthCentury+')').addClass('highlight');
                    if(nthCentury > 80 && $('#TimelineCenturiesContainer').hasClass('scrollBottom') === false ){
                        $('#TimelineCenturiesContainer').addClass('scrollBottom');
                    }
                    else if(nthCentury < 81 && $('#TimelineCenturiesContainer').hasClass('scrollBottom') ){
                        $('#TimelineCenturiesContainer').removeClass('scrollBottom');
                    }
                    //$( "#amount" ).val( ui.value );
                }
            });

            $('#langSelect').on('change', function(){
                let lcl = $(this).val();
                location.href = '?locale='+lcl;
            });

        });

    </script>
</body>
