<?php
/**************************
 * UTILITY FUNCTIONS
 *************************/

function countSameDayEvents( $currentKeyIndex, $EventsArray, &$cc ) {
    $Keys = array_keys($EventsArray);
    $currentFestivity = $EventsArray[$Keys[$currentKeyIndex]];
    if ($currentKeyIndex < count($Keys) - 1) {
        $nextFestivity = $EventsArray[$Keys[$currentKeyIndex + 1]];
        if ($nextFestivity->date == $currentFestivity->date) {
            $cc++;
            countSameDayEvents($currentKeyIndex + 1, $EventsArray, $cc);
        }
    }
}

function countSameMonthEvents( $currentKeyIndex, $EventsArray, &$cm ) {
    $Keys = array_keys($EventsArray);
    $currentFestivity = $EventsArray[$Keys[$currentKeyIndex]];
    if ($currentKeyIndex < count($Keys) - 1) {
        $nextFestivity = $EventsArray[$Keys[$currentKeyIndex + 1]];
        if ($nextFestivity->date->format('n') == $currentFestivity->date->format('n')) {
            $cm++;
            countSameMonthEvents($currentKeyIndex + 1, $EventsArray, $cm);
        }
    }
}

function retrieveMetadata() {
    $metadata = null;
    $ch = curl_init();
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt( $ch, CURLOPT_URL, METADATA_URL );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, ['Accept: application/json'] );
    $metadataRaw = curl_exec( $ch );
    if( $metadataRaw !== false ){
        $metadata = json_decode( $metadataRaw, true );
    }
    curl_close( $ch );
    return $metadata;
}

function sendAPIRequest( $queryData ) {

    $ch = curl_init();
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt( $ch, CURLOPT_URL, LITCAL_API_URL );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, ['Accept: application/json'] );
    curl_setopt( $ch, CURLOPT_POST, 1 );
    curl_setopt( $ch, CURLOPT_POSTFIELDS, http_build_query( $queryData ) );

    $result = curl_exec($ch);

    if (curl_errno($ch)) {
        die("Could not send request. Curl error: " . curl_error($ch));
    } else {
        $resultStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($resultStatus != 200) {
            header('Content-Type: text/html');
            $htmlBody = "<body style=\"background-color:pink;color:darkred;\">";
            $htmlBody .= "<div style=\"text-align:center;padding: 20px;margin: 20px auto;\">";
            $htmlBody .= "<h1>Request failed.</h1>";
            $htmlBody .= "<h2>" . StatusCodes::getMessageForCode($resultStatus) . "</h2>";
            $htmlBody .= "<p>$result</p>";
            $htmlBody .= "</div></body>";
            die($htmlBody);
        }
    }

    curl_close($ch);
    return $result;

}

function getNationsIndex( $MetaData ) {
    $nations = [];
    if( $MetaData !== null ) {
        $nations = array_column($MetaData, "nation");
    }
    if( !in_array( "VATICAN", $nations ) ) {
        array_push( $nations, "VATICAN" );
    }
    if( !in_array( "ITALY", $nations ) ) {
        array_push( $nations, "ITALY" );
    }
    if( !in_array( "USA", $nations ) ) {
        array_push( $nations, "USA" );
    }
    return array_unique( $nations, SORT_STRING );
}

function buildDioceseOptions( $MetaData, $NATION, $DIOCESE ) {
    $options = '<option value=""></option>';
    if( $MetaData !== null ) {
        foreach( $MetaData as $key => $value ){
            if( $value['nation'] === $NATION ) {
                $options .= "<option value='{$key}'" . ( $DIOCESE === $key ? ' SELECTED' : '' ) . ">{$value['diocese']}</option>";
            }
        }
    }
    return $options;
}

function buildNationOptions( $nations, $NATION ) {
    $options = '<option value="">---</option>';
    foreach( $nations as $nationVal ) {
        $options .= "<option value='{$nationVal}'" . ($nationVal === $NATION ? ' SELECTED' : '') . ">$nationVal</option>";
    }
    return $options;
}

function prepareQueryData( $litSettings ) {
    $queryData = [
        "year"          => $litSettings->YEAR,
        "epiphany"      => $litSettings->Epiphany,
        "ascension"     => $litSettings->Ascension,
        "corpuschristi" => $litSettings->CorpusChristi,
        "locale"        => $litSettings->LOCALE
    ];
    if( $litSettings->NationalCalendar !== null ) {
        $queryData["nationalcalendar"] = $litSettings->NationalCalendar;
    }
    if( $litSettings->DiocesanCalendar !== null ) {
        $queryData["diocesancalendar"] = $litSettings->DiocesanCalendar;
    }
    return $queryData;
}
