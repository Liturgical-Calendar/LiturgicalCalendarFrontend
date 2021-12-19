<?php

/**
 * Liturgical Calendar display script using CURL and PHP
 * Author: John Romano D'Orazio 
 * Email: priest@johnromanodorazio.com
 * Licensed under the Apache 2.0 License
 * Version 2.3
 * Date Created: 27 December 2017
 */

ini_set('error_reporting', E_ALL);
ini_set("display_errors", 1);

include_once( 'includes/LitSettings.php' );
include_once( 'includes/Festivity.php' );
include_once( 'includes/Functions.php' );
include_once( 'includes/StatusCodes.php' );
include_once( 'includes/Messages.php' );


$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
define("LITCAL_API_URL", "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalEngine.php");
define("METADATA_URL", "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalMetadata.php");

$litSettings = new LitSettings( $_GET );

$GRADE = array();
$GRADE[0] = __("FERIA",$litSettings->LOCALE);
$GRADE[1] = __("COMMEMORATION",$litSettings->LOCALE);
$GRADE[2] = __("OPTIONAL MEMORIAL",$litSettings->LOCALE);
$GRADE[3] = __("MEMORIAL",$litSettings->LOCALE);
$GRADE[4] = __("FEAST",$litSettings->LOCALE);
$GRADE[5] = __("FEAST OF THE LORD",$litSettings->LOCALE);
$GRADE[6] = __("SOLEMNITY",$litSettings->LOCALE);
$GRADE[7] = __("HIGHER RANKING SOLEMNITY",$litSettings->LOCALE);

$nationalPresetOptions = '<option value="">---</option>';
$diocesanPresetOptions = '<option value="">---</option>';

$MetaData = retrieveMetadata();
if( $MetaData !== null ) {
    $litSettings->setMetaData( $MetaData );
    $nations = getNationsIndex( $MetaData );
    $nationalPresetOptions = buildNationOptions( $nations, $litSettings->NationalCalendar );
    $diocesanPresetOptions = buildDioceseOptions( $MetaData, $litSettings->NationalCalendar, $litSettings->DiocesanCalendar );
}

ini_set('date.timezone', 'Europe/Vatican');
//ini_set('intl.default_locale', strtolower($litSettings->LOCALE) . '_' . $litSettings->LOCALE);
setlocale(LC_TIME, strtolower($litSettings->LOCALE) . '_' . $litSettings->LOCALE);

$SUNDAY_CYCLE = ["A", "B", "C"];
$WEEKDAY_CYCLE = ["I", "II"];

if ($litSettings->YEAR >= 1970 && $litSettings->YEAR <= 9999) {

    $result = sendAPIRequest(prepareQueryData( $litSettings ));
    $LitCalData = json_decode($result, true);

    if( json_last_error() !== JSON_ERROR_NONE ) {
        echo "There was an error decoding the JSON data: " . json_last_error_msg() . PHP_EOL;
        echo "<pre>";
        var_dump($result);
        echo "</pre>";
        die();
    }

    $LitCal = array();
    if( isset( $LitCalData["LitCal"] ) ) {
        $LitCal = $LitCalData["LitCal"];
    } else {
        echo "We do not have enough information. Returned data has no LitCal property:" . PHP_EOL;
        echo "<pre>";
        var_dump($LitCalData);
        echo "</pre>";
        die();
    }

    foreach ($LitCal as $key => $value) {
        // retransform each entry from an associative array to a Festivity class object
        $LitCal[$key] = new Festivity(
            $LitCal[$key]["name"],
            $LitCal[$key]["date"],
            $LitCal[$key]["color"],
            $LitCal[$key]["type"],
            $LitCal[$key]["grade"],
            $LitCal[$key]["common"],
            (isset($LitCal[$key]["liturgicalYear"]) ? $LitCal[$key]["liturgicalYear"] : null),
            $LitCal[$key]["displayGrade"]
        );
    }
}


/**************************
 * BEGIN DISPLAY LOGIC
 * 
 *************************/

?>
<!doctype html>

<head>
    <title><?php echo __("Generate Roman Calendar", $litSettings->LOCALE) ?></title>
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="../../favicon.ico">
    <meta name="msapplication-TileColor" content="#ffffff" />
    <meta name="msapplication-TileImage" content="../../assets/easter-egg-5-144-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="152x152" href="../../assets/easter-egg-5-152-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="144x144" href="../../assets/easter-egg-5-144-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="120x120" href="../../assets/easter-egg-5-120-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="114x114" href="../../assets/easter-egg-5-114-279148.png">
    <link rel="apple-touch-icon-precomposed" sizes="72x72" href="../../assets/easter-egg-5-72-279148.png">    
    <link rel="apple-touch-icon-precomposed" href="../../assets/easter-egg-5-57-279148.png">
    <link rel="icon" href="../../assets/easter-egg-5-32-279148.png" sizes="32x32">
    <link rel="stylesheet" type="text/css" href="styles.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
</head>

<body>
    <div><a class="backNav" href="https://litcal<?php echo $stagingURL; ?>.johnromanodorazio.com/usage.php">↩      Go back      ↩</a></div>

    <?php

    echo '<h1 style="text-align:center;">' . __("Liturgical Calendar Calculation for a Given Year", $litSettings->LOCALE) . ' (' . $litSettings->YEAR . ')</h1>';
    echo '<h2 style="text-align:center;">' . sprintf(__("HTML presentation elaborated by PHP using a CURL request to a %s", $litSettings->LOCALE), "<a href=\"" . LITCAL_API_URL ."\">PHP engine</a>") . '</h2>';

    if($litSettings->YEAR > 9999){
        $litSettings->YEAR = 9999;
    }
    
    if ($litSettings->YEAR < 1970) {
        echo '<div style="text-align:center;border:3px ridge Green;background-color:LightBlue;width:75%;margin:10px auto;padding:10px;">';
        echo __('You are requesting a year prior to 1970: it is not possible to request years prior to 1970.', $litSettings->LOCALE);
        echo '</div>';
    }


    echo '<form method="GET">';
    echo '<fieldset style="margin-bottom:6px;"><legend>' . __('Customize options for generating the Roman Calendar',$litSettings->LOCALE) . '</legend>';
    echo '<table style="width:100%;"><tr>';
    echo '<td><label>' . __('YEAR', $litSettings->LOCALE) . ': <input type="number" name="year" id="year" min="1970" max="9999" value="' . $litSettings->YEAR . '" /></label></td>';
    echo '<td><label>' . __('EPIPHANY', $litSettings->LOCALE) . ': <select name="epiphany" id="epiphany"><option value="JAN6" ' . ($litSettings->Epiphany === "JAN6" ? " SELECTED" : "") . '>January 6</option><option value="SUNDAY_JAN2_JAN8" ' . ($litSettings->Epiphany === "SUNDAY_JAN2_JAN8" ? " SELECTED" : "") . '>Sunday between January 2 and January 8</option></select></label></td>';
    echo '<td><label>' . __('ASCENSION', $litSettings->LOCALE) . ': <select name="ascension" id="ascension"><option value="THURSDAY" ' . ($litSettings->Ascension === "THURSDAY" ? " SELECTED" : "") . '>Thursday</option><option value="SUNDAY" ' . ($litSettings->Ascension === "SUNDAY" ? " SELECTED" : "") . '>Sunday</option></select></label></td>';
    echo '<td><label>CORPUS CHRISTI (CORPUS DOMINI): <select name="corpuschristi" id="corpuschristi"><option value="THURSDAY" ' . ($litSettings->CorpusChristi === "THURSDAY" ? " SELECTED" : "") . '>Thursday</option><option value="SUNDAY" ' . ($litSettings->CorpusChristi === "SUNDAY" ? " SELECTED" : "") . '>Sunday</option></select></label></td>';
    echo '<td><label>LOCALE: <select name="locale" id="locale"><option value="EN" ' . ($litSettings->LOCALE === "EN" ? " SELECTED" : "") . '>EN</option><option value="IT" ' . ($litSettings->LOCALE === "IT" ? " SELECTED" : "") . '>IT</option><option value="LA" ' . ($litSettings->LOCALE === "LA" ? " SELECTED" : "") . '>LA</option></select></label></td>';
    echo '</tr><tr>';
    echo '<td colspan="5" style="text-align:center;padding:18px;"><i>' . __('or', $litSettings->LOCALE) . '</i><br /><i>Scegli il Calendario desiderato dall\'elenco</i></td>';
    echo '</tr><tr>';
    echo '<td colspan="5" style="text-align:center;"><label>NATION: <select id="nationalcalendar" name="nationalcalendar">' . $nationalPresetOptions . '</select></label>';
    echo '<label style="margin-left: 18px;">DIOCESE: <select id="diocesancalendar" name="diocesancalendar"' . ($litSettings->NationalCalendar === '' ? ' DISABLED' : '') . '>' . $diocesanPresetOptions . '</select></label></td>';
    echo '</tr><tr>';
    echo '<td colspan="5" style="text-align:center;padding:15px;"><input type="SUBMIT" value="' . strtoupper(__("Generate Roman Calendar", $litSettings->LOCALE)) . '" /></td>';
    echo '</tr></table>';
    echo '</fieldset>';
    echo '</form>';

    echo '<div style="text-align:center;border:2px groove White;border-radius:6px;width:60%;margin:0px auto;padding-bottom:6px;">';

    echo '<h3>' . __('Configurations being used to generate this calendar:', $litSettings->LOCALE) . '</h3>';
    echo '<span>' . __('YEAR', $litSettings->LOCALE) . ' = ' . $litSettings->YEAR . ', ' . __('EPIPHANY', $litSettings->LOCALE) . ' = ' . $litSettings->Epiphany . ', ' . __('ASCENSION', $litSettings->LOCALE) . ' = ' . $litSettings->Ascension . ', CORPUS CHRISTI = ' . $litSettings->CorpusChristi . ', LOCALE = ' . $litSettings->LOCALE . '</span>';
    echo '<br /><span>' . __('NATION', $litSettings->LOCALE) . ' = ' . $litSettings->NationalCalendar . ', ' . __('DIOCESE', $litSettings->LOCALE) . ' = ' . $litSettings->DiocesanCalendar . '</span>';
    echo '</div>';

    if ($litSettings->YEAR >= 1970) {
        echo '<table id="LitCalTable">';
        echo '<thead><tr><th>' . __("Month", $litSettings->LOCALE) . '</th><th>' . __("Date in Gregorian Calendar", $litSettings->LOCALE) . '</th><th>' . __("General Roman Calendar Festivity", $litSettings->LOCALE) . '</th><th>' . __("Grade of the Festivity", $litSettings->LOCALE) . '</th></tr></thead>';
        echo '<tbody>';


        $dayCnt = 0;
        //for($i=1997;$i<=2037;$i++){
        $highContrast = ['purple', 'red', 'green'];

        $LitCalKeys = array_keys($LitCal);

        $currentMonth = 0; //1=January, ... 12=December
        $newMonth = false;

        //print_r($LitCalKeys);
        //echo count($LitCalKeys);
        for ($keyindex = 0; $keyindex < count($LitCalKeys); $keyindex++) {
            $dayCnt++;
            $keyname = $LitCalKeys[$keyindex];
            $festivity = $LitCal[$keyname];
            //If we are at the start of a new month, count how many events we have in that same month, so we can display the Month table cell
            if((int) $festivity->date->format('n') !== $currentMonth){
                $newMonth = true;
                $currentMonth = (int) $festivity->date->format('n');
                $cm = 0;
                countSameMonthEvents($keyindex, $LitCal, $cm);
            }

            //Let's check if we have more than one event on the same day, such as optional memorials...
            $cc = 0;
            countSameDayEvents($keyindex, $LitCal, $cc);
            if ($cc > 0) {

                for ($ev = 0; $ev <= $cc; $ev++) {
                    $keyname = $LitCalKeys[$keyindex];
                    $festivity = $LitCal[$keyname];
                    // LET'S DO SOME MORE MANIPULATION ON THE FESTIVITY->COMMON STRINGS AND THE FESTIVITY->COLOR...
                    if ($festivity->common !== "" && $festivity->common !== "Proper") {
                        $commons = explode(",", $festivity->common);
                        $commons = array_map(function ($txt) use ($litSettings) {
                            $common = explode(":", $txt);
                            $commonGeneral = __($common[0], $litSettings->LOCALE);
                            $commonSpecific = isset($common[1]) && $common[1] != "" ? __($common[1], $litSettings->LOCALE) : "";
                            //$txt = str_replace(":", ": ", $txt);
                            switch ($commonGeneral) {
                                case __("Blessed Virgin Mary", $litSettings->LOCALE):
                                    $commonKey = "of (SING_FEMM)";
                                    break;
                                case __("Virgins", $litSettings->LOCALE):
                                    $commonKey = "of (PLUR_FEMM)";
                                    break;
                                case __("Martyrs", $litSettings->LOCALE):
                                case __("Pastors", $litSettings->LOCALE):
                                case __("Doctors", $litSettings->LOCALE):
                                case __("Holy Men and Women", $litSettings->LOCALE):
                                    $commonKey = "of (PLUR_MASC)";
                                    break;
                                default:
                                    $commonKey = "of (SING_MASC)";
                            }
                            return __("From the Common", $litSettings->LOCALE) . " " . __($commonKey, $litSettings->LOCALE) . " " . $commonGeneral . ($commonSpecific != "" ? ": " . $commonSpecific : "");
                        }, $commons);
                        $festivity->common = implode("; " . __("or", $litSettings->LOCALE) . " ", $commons);
                    } else if ($festivity->common == "Proper") {
                        $festivity->common = __("Proper", $litSettings->LOCALE);
                    }
                    
                    //check which liturgical season we are in, to apply color for the season to the row
                    $SeasonColor = "green";
                    if (($festivity->date > $LitCal["Advent1"]->date  && $festivity->date < $LitCal["Christmas"]->date) || ($festivity->date > $LitCal["AshWednesday"]->date && $festivity->date < $LitCal["Easter"]->date)) {
                        $SeasonColor = "purple";
                    } else if ($festivity->date > $LitCal["Easter"]->date && $festivity->date < $LitCal["Pentecost"]->date) {
                        $SeasonColor = "white";
                    } else if ($festivity->date > $LitCal["Christmas"]->date || $festivity->date < $LitCal["BaptismLord"]->date) {
                        $SeasonColor = "white";
                    }

                    //We will apply the color for the single festivity only to it's own table cells
                    $possibleColors = explode(",", $festivity->color);
                    $CSScolor = $possibleColors[0];
                    $festivityColorString = "";
                    if(count($possibleColors) === 1){
                        $festivityColorString = __($possibleColors[0],$litSettings->LOCALE);
                    } else if (count($possibleColors) > 1){
                        $possibleColors = array_map(function($txt) use ($litSettings){
                            return __($txt,$litSettings->LOCALE);
                        },$possibleColors);
                        $festivityColorString = implode("</i> " . __("or",$litSettings->LOCALE) . " <i>",$possibleColors);
                    }

                    echo '<tr style="background-color:' . $SeasonColor . ';' . (in_array($SeasonColor, $highContrast) ? 'color:white;' : '') . '">';
                    if($newMonth){
                        $monthRwsp = $cm + 1;
                        echo '<td class="rotate" rowspan = "' . $monthRwsp . '"><div>' . ($litSettings->LOCALE === 'LA' ? strtoupper($months[(int)$festivity->date->format('n')]) : strtoupper(utf8_encode(strftime('%B', $festivity->date->format('U'))))) . '</div></td>';
                        $newMonth = false;
                    }
                    if ($ev == 0) {
                        $rwsp = $cc + 1;
                        $dateString = "";
                        switch ($litSettings->LOCALE) {
                            case "LA":
                                $dayOfTheWeek = (int)$festivity->date->format('w'); //w = 0-Sunday to 6-Saturday
                                $dayOfTheWeekLatin = $daysOfTheWeek[$dayOfTheWeek];
                                $month = (int)$festivity->date->format('n'); //n = 1-January to 12-December
                                $monthLatin = $months[$month];
                                $dateString = $dayOfTheWeekLatin . ' ' . $festivity->date->format('j') . ' ' . $monthLatin . ' ' . $festivity->date->format('Y');
                                break;
                            case "EN":
                                $dateString = $festivity->date->format('D, F jS, Y'); // G:i:s e') . "offset = " . $festivity->hourOffset;
                                break;
                            default:
                                $dateString = utf8_encode(strftime('%A %e %B %Y', $festivity->date->format('U')));
                        }
                        echo '<td rowspan="' . $rwsp . '" class="dateEntry">' . $dateString . '</td>';
                    }
                    $currentCycle = property_exists($festivity, "liturgicalYear") && $festivity->liturgicalYear !== null && $festivity->liturgicalYear !== "" ? " (" . $festivity->liturgicalYear . ")" : "";
                    echo '<td style="background-color:' . $CSScolor . ';' . (in_array($CSScolor, $highContrast) ? 'color:white;' : 'color:black;') . '">' . $festivity->name . $currentCycle . ' - <i>' . $festivityColorString . '</i><br /><i>' . $festivity->common . '</i></td>';
                    echo '<td style="background-color:' . $CSScolor . ';' . (in_array($CSScolor, $highContrast) ? 'color:white;' : 'color:black;') . '">' . ($keyname === 'AllSouls' ? __("COMMEMORATION",$litSettings->LOCALE) : ($festivity->displayGrade !== "" ? $festivity->displayGrade : $GRADE[$festivity->grade] ) ) . '</td>';
                    echo '</tr>';
                    $keyindex++;
                }
                $keyindex--;
            } else {
                // LET'S DO SOME MORE MANIPULATION ON THE FESTIVITY->COMMON STRINGS AND THE FESTIVITY->COLOR...
                if ($festivity->common !== "" && $festivity->common !== "Proper") {
                    $commons = explode(",", $festivity->common);
                    $commons = array_map(function ($txt) use ($litSettings) {
                        $common = explode(":", $txt);
                        $commonGeneral = __($common[0], $litSettings->LOCALE);
                        $commonSpecific = isset($common[1]) && $common[1] != "" ? __($common[1], $litSettings->LOCALE) : "";
                        //$txt = str_replace(":", ": ", $txt);
                        switch ($commonGeneral) {
                            case __("Blessed Virgin Mary", $litSettings->LOCALE):
                                $commonKey = "of (SING_FEMM)";
                                break;
                            case __("Virgins", $litSettings->LOCALE):
                                $commonKey = "of (PLUR_FEMM)";
                                break;
                            case __("Martyrs", $litSettings->LOCALE):
                            case __("Pastors", $litSettings->LOCALE):
                            case __("Doctors", $litSettings->LOCALE):
                            case __("Holy Men and Women", $litSettings->LOCALE):
                                $commonKey = "of (PLUR_MASC)";
                                break;
                            default:
                                $commonKey = "of (SING_MASC)";
                        }
                        return __("From the Common", $litSettings->LOCALE) . " " . __($commonKey, $litSettings->LOCALE) . " " . $commonGeneral . ($commonSpecific != "" ? ": " . $commonSpecific : "");
                    }, $commons);
                    $festivity->common = implode("; " . __("or", $litSettings->LOCALE) . " ", $commons);
                } else if ($festivity->common == "Proper") {
                    $festivity->common = __("Proper", $litSettings->LOCALE);
                }

                //We will apply the color for the single festivity only to it's own table cells
                $possibleColors = explode(",", $festivity->color);
                $CSScolor = $possibleColors[0];
                $festivityColorString = "";
                if(count($possibleColors) === 1){
                    $festivityColorString = __($possibleColors[0],$litSettings->LOCALE);
                } else if (count($possibleColors) > 1){
                    $possibleColors = array_map(function($txt) use ($litSettings){
                        return __($txt,$litSettings->LOCALE);
                    },$possibleColors);
                    $festivityColorString = implode("</i> " . __("or",$litSettings->LOCALE) . " <i>",$possibleColors);
                }
                echo '<tr style="background-color:' . $CSScolor . ';' . (in_array($CSScolor, $highContrast) ? 'color:white;' : '') . '">';
                if($newMonth){
                    $monthRwsp = $cm +1;
                    echo '<td class="rotate" rowspan = "' . $monthRwsp . '"><div>' . ($litSettings->LOCALE === 'LA' ? strtoupper($months[(int)$festivity->date->format('n')]) : strtoupper(utf8_encode(strftime('%B', $festivity->date->format('U'))))) . '</div></td>';
                    $newMonth = false;
                }
                $dateString = "";
                switch ($litSettings->LOCALE) {
                    case "LA":
                        $dayOfTheWeek = (int)$festivity->date->format('w'); //w = 0-Sunday to 6-Saturday
                        $dayOfTheWeekLatin = $daysOfTheWeek[$dayOfTheWeek];
                        $month = (int)$festivity->date->format('n'); //n = 1-January to 12-December
                        $monthLatin = $months[$month];
                        $dateString = $dayOfTheWeekLatin . ' ' . $festivity->date->format('j') . ' ' . $monthLatin . ' ' . $festivity->date->format('Y');
                        break;
                    case "EN":
                        $dateString = $festivity->date->format('D, F jS, Y'); //  G:i:s e') . "offset = " . $festivity->hourOffset;
                        break;
                    default:
                        $dateString = utf8_encode(strftime('%A %e %B %Y', $festivity->date->format('U')));
                }
                $displayGrade = "";
                if($keyname === 'AllSouls'){
                    $displayGrade = __("COMMEMORATION",$litSettings->LOCALE);
                }
                else if((int)$festivity->date->format('N') !== 7){
                    $displayGrade = $GRADE[$festivity->grade];
                }
                echo '<td class="dateEntry">' . $dateString . '</td>';
                $currentCycle = property_exists($festivity, "liturgicalYear") && $festivity->liturgicalYear !== null && $festivity->liturgicalYear !== "" ? " (" . $festivity->liturgicalYear . ")" : "";
                echo '<td>' . $festivity->name . $currentCycle . ' - <i>' . $festivityColorString . '</i><br /><i>' . $festivity->common . '</i></td>';
                echo '<td>' . $displayGrade . '</td>';
                echo '</tr>';
            }
        }

        echo '</tbody></table>';

        echo '<div style="text-align:center;border:3px ridge Green;background-color:LightBlue;width:75%;margin:10px auto;padding:10px;">' . $dayCnt . ' event days created</div>';
    }

    if (isset($LitCalData["Messages"]) && is_array($LitCalData["Messages"]) && count($LitCalData["Messages"]) > 0 ) {
        echo '<table id="LitCalMessages"><thead><tr><th colspan=2 style="text-align:center;">' . __("Information about the current calculation of the Liturgical Year",$litSettings->LOCALE) . '</th></tr></thead>';
        echo '<tbody>';
        foreach($LitCalData["Messages"] as $idx => $message){
            echo "<tr><td>{$idx}</td><td>{$message}</td></tr>";
        }
        echo '</tbody></table>';
    }


    ?>
</body>
