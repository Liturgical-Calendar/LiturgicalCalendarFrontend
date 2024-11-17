<?php

use LiturgicalCalendar\Frontend\I18n;

include_once("vendor/autoload.php");

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__, ['.env', '.env.local', '.env.development', '.env.production'], false);
$dotenv->safeLoad();

if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development') {
    if (false === isset($_ENV['API_PROTOCOL']) || false === isset($_ENV['API_HOST']) || false === isset($_ENV['API_PORT'])) {
        die("API_PROTOCOL, API_HOST and API_PORT must be defined in .env.development or similar dotenv when APP_ENV=development");
    }

    $dateOfEasterURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/easter";
    $calendarURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/calendar";
    $metadataURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/calendars";
    $eventsURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/events";
    $missalsURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/missals";
    $decreesURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/decrees";
    $regionalDataURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/data";
    $calSubscriptionURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}/calendar?returntype=ICS";
} else {
    $isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false );
    //$stagingURL = $isStaging ? "-staging" : "";
    $endpointV = $isStaging ? "dev" : "v3";

    $dateOfEasterURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/easter/";
    $calendarURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/calendar";
    $metadataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/calendars/";
    $eventsURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/events";
    $missalsURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/missals";
    $decreesURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/decrees";
    $regionalDataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/data";
    $calSubscriptionURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/calendar?returntype=ICS";
}
/*
$API_URLS = [
    "dateOfEaster" => $dateOfEasterURL,
    "calendar" => $calendarURL,
    "metadata" => $metadataURL,
    "events" => $eventsURL,
    "missals" => $missalsURL,
    "decrees" => $decreesURL,
    "regionalData" => $regionalDataURL
];
die(json_encode($API_URLS));
*/
$i18n = new I18n();
