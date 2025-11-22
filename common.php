<?php

include_once('vendor/autoload.php');

use LiturgicalCalendar\Frontend\I18n;
use Dotenv\Dotenv;
use Monolog\Logger;
use Monolog\Level;
use Monolog\Handler\StreamHandler;
use LiturgicalCalendar\Components\Http\HttpClientFactory;
use LiturgicalCalendar\Components\ApiClient;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;
use Symfony\Component\Cache\Psr16Cache;

// ============================================================================
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
$dotenv->ifPresent(['API_PROTOCOL', 'API_HOST', 'API_BASE_PATH'])->notEmpty();
$dotenv->ifPresent(['API_PORT'])->isInteger();
$dotenv->safeLoad();

// Set default environment variables if not already set
$debugMode             = filter_var($_ENV['DEBUG_MODE'] ?? 'false', FILTER_VALIDATE_BOOLEAN);
$_ENV['API_PROTOCOL']  = $_ENV['API_PROTOCOL'] ?? 'https';
$_ENV['API_HOST']      = $_ENV['API_HOST'] ?? 'litcal.johnromanodorazio.com';
$_ENV['API_PORT']      = $_ENV['API_PORT'] ?? '';
$_ENV['API_BASE_PATH'] = $_ENV['API_BASE_PATH'] ?? '/api/dev';

// Build Base API URL
$apiPort    = !empty($_ENV['API_PORT']) ? ":{$_ENV['API_PORT']}" : '';
$apiBaseUrl = rtrim("{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}{$apiPort}{$_ENV['API_BASE_PATH']}", '/');

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

$dateOfEasterUrl    = "{$apiBaseUrl}/easter";
$calendarUrl        = "{$apiBaseUrl}/calendar";
$metadataUrl        = "{$apiBaseUrl}/calendars";
$eventsUrl          = "{$apiBaseUrl}/events";
$missalsUrl         = "{$apiBaseUrl}/missals";
$decreesUrl         = "{$apiBaseUrl}/decrees";
$regionalDataUrl    = "{$apiBaseUrl}/data";
$calSubscriptionUrl = "{$apiBaseUrl}/calendar?returntype=ICS";

$i18n = new I18n();

// ============================================================================
// Setup PSR-Compliant HTTP Client with Production Features
// ============================================================================

// 1. Setup Logger (Monolog)

$logger  = null;
$logsDir = __DIR__ . '/logs';

if (!is_dir($logsDir)) {
    if ($debugMode) {
        error_log('Creating logs directory: ' . $logsDir);
    }
    $result = mkdir($logsDir, 0755, true);
    if (!$result) {
        $lastError = error_get_last();
        $errorMsg  = $lastError['message'] ?? 'unknown';
        error_log('Failed to create logs directory: ' . $errorMsg);
    }
}

try {
    $logger = new Logger('liturgical-calendar');
    $logger->pushHandler(new StreamHandler(
        $logsDir . '/litcal.log',
        Level::Debug
    ));
    if ($debugMode) {
        error_log('Logger initialized successfully');
    }
    $logger->info('Logger initialized successfully');
} catch (Exception $e) {
    error_log('Error creating logger: ' . $e->getMessage());
}

if ($debugMode && $logger) {
    $logger->debug('Debug mode enabled');
}

// 2. Setup Cache - Filesystem cache (if available) or ArrayCache fallback
$filesystemAdapter = new FilesystemAdapter(
    'litcal',
    3600 * 24,
    __DIR__ . '/cache'
);

$cache = new Psr16Cache($filesystemAdapter);

// 3. Create Production-Ready HTTP Client
$httpClient = HttpClientFactory::createProductionClient(
    cache: $cache,
    logger: $logger,
    cacheTtl: 3600 * 24,
    maxRetries: 3,
    failureThreshold: 5
);

// 4. Initialize ApiClient Singleton
$apiClient = ApiClient::getInstance([
    'apiUrl'     => $apiBaseUrl,
    'httpClient' => $httpClient
]);
