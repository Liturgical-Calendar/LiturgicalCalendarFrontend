<?php

include_once('vendor/autoload.php');

use LiturgicalCalendar\Frontend\I18n;
use Dotenv\Dotenv;

$ghReleaseCacheFolder = 'assets' . DIRECTORY_SEPARATOR . 'json' . DIRECTORY_SEPARATOR;
$ghReleaseCacheFile   = $ghReleaseCacheFolder . 'github-latest-release.json';
if (false === file_exists($ghReleaseCacheFolder)) {
    if (!mkdir($ghReleaseCacheFolder, 0755, true)) {
        die('Could not create cache folder for github latest release info at ' . $ghReleaseCacheFolder);
    }
}
if (false === file_exists($ghReleaseCacheFile) || ( time() - filemtime($ghReleaseCacheFile) ) > 86400) {
    $GithubReleasesAPI = 'https://api.github.com/repos/Liturgical-Calendar/LiturgicalCalendarAPI/releases/latest';

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $GithubReleasesAPI);
    curl_setopt($ch, CURLOPT_USERAGENT, 'LiturgicalCalendar');
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $ghCurrentReleaseInfo = curl_exec($ch);

    if (!curl_errno($ch) && $ghCurrentReleaseInfo !== false) {
        $GitHubReleasesObj = json_decode($ghCurrentReleaseInfo);
        file_put_contents($ghReleaseCacheFile, json_encode($GitHubReleasesObj, JSON_PRETTY_PRINT));
    }
}

$dotenv = Dotenv::createImmutable(__DIR__, ['.env', '.env.local', '.env.development', '.env.production'], false);
$dotenv->safeLoad();

if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development') {
    if (false === isset($_ENV['API_PROTOCOL']) || false === isset($_ENV['API_HOST']) || false === isset($_ENV['API_PORT'])) {
        die('API_PROTOCOL, API_HOST and API_PORT must be defined in .env.development or similar dotenv when APP_ENV=development');
    }

    $baseURL = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}:{$_ENV['API_PORT']}";
} else {
    if (file_exists($ghReleaseCacheFile)) {
        $GitHubReleasesRaw = @file_get_contents($ghReleaseCacheFile);
        if ($GitHubReleasesRaw === false) {
            $lastError = error_get_last();
            die('Could not read GitHub latest release cache file: ' . $lastError['message']);
        }
        $GitHubLatestReleaseInfo = json_decode($GitHubReleasesRaw);
        $tagName                 = is_object($GitHubLatestReleaseInfo) && isset($GitHubLatestReleaseInfo->tag_name)
            ? $GitHubLatestReleaseInfo->tag_name
            : 'dev';
        $GitHubLatestRelease     = explode('.', $tagName)[0] ?: 'dev';
    } else {
        $GitHubLatestRelease = 'dev';
    }
    $host      = $_SERVER['HTTP_HOST'] ?? '';
    $isStaging = ( strpos($host, '-staging') !== false );
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
