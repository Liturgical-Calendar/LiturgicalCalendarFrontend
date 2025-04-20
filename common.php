<?php

include_once("vendor/autoload.php");

use LiturgicalCalendar\Frontend\I18n;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__, ['.env', '.env.local', '.env.development', '.env.production'], false);
$dotenv->safeLoad();

if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development') {
    if (false === isset($_ENV['API_PROTOCOL']) || false === isset($_ENV['API_HOST']) || false === isset($_ENV['API_PORT'])) {
        die("API_PROTOCOL, API_HOST and API_PORT must be defined in .env.development or similar dotenv when APP_ENV=development");
    }

    $baseURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}";

} else {
    $isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false );
    //$stagingURL = $isStaging ? "-staging" : "";
    $endpointV = $isStaging ? "dev" : "v4";
    $baseURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}";
}

$dateOfEasterURL    = "{$baseURL}/easter";
$calendarURL        = "{$baseURL}/calendar";
$metadataURL        = "{$baseURL}/calendars";
$eventsURL          = "{$baseURL}/events";
$missalsURL         = "{$baseURL}/missals";
$decreesURL         = "{$baseURL}/decrees";
$regionalDataURL    = "{$baseURL}/data";
$calSubscriptionURL = "{$baseURL}/calendar?returntype=ICS";

$i18n = new I18n();
