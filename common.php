<?php

include_once('vendor/autoload.php');

use LiturgicalCalendar\Frontend\I18n;
use Dotenv\Dotenv;

$ghReleaseCacheFile = 'assets/json/github-latest-release.json';
if (false === file_exists($ghReleaseCacheFile) || ( time() - filemtime($ghReleaseCacheFile) ) > 86400) {
    $GithubReleasesAPI = 'https://api.github.com/repos/Liturgical-Calendar/LiturgicalCalendarAPI/releases/latest';

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $GithubReleasesAPI);
    curl_setopt($ch, CURLOPT_USERAGENT, 'LiturgicalCalendar');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $ghCurrentReleaseInfo = curl_exec($ch);

    if (curl_errno($ch)) {
        //throw new \Exception('Error while fetching via curl: ' . curl_error($ch));
    } else {
        $GitHubReleasesObj = json_decode($ghCurrentReleaseInfo);
        file_put_contents($ghReleaseCacheFile, json_encode($GitHubReleasesObj, JSON_PRETTY_PRINT));
    }
    curl_close($ch);
}

$dotenv = Dotenv::createImmutable(__DIR__, ['.env', '.env.local', '.env.development', '.env.production'], false);
$dotenv->safeLoad();

if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development') {
    if (false === isset($_ENV['API_PROTOCOL']) || false === isset($_ENV['API_HOST']) || false === isset($_ENV['API_PORT'])) {
        die('API_PROTOCOL, API_HOST and API_PORT must be defined in .env.development or similar dotenv when APP_ENV=development');
    }

    $baseURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}";
} else {
    $isStaging = ( strpos($_SERVER['HTTP_HOST'], '-staging') !== false );
    if (file_exists($ghReleaseCacheFile)) {
        $GitHubReleasesRaw       = file_get_contents($ghReleaseCacheFile);
        $GitHubLatestReleaseInfo = json_decode($ghReleasesRaw);
        $GitHubLatestRelease     = explode('.', $GitHubLatestReleaseInfo->tag_name)[0];
    } else {
        $GithubLatestRelease = 'dev';
    }
    //$stagingURL = $isStaging ? "-staging" : "";
    $endpointV = $isStaging ? 'dev' : $GitHubLatestRelease;
    $baseURL   = "https://litcal.johnromanodorazio.com/api/{$endpointV}";
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
