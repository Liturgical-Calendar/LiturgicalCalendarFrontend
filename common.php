<?php

/**
 * Common bootstrap file for LiturgicalCalendarFrontend
 *
 * This file intentionally both declares symbols and causes side effects
 * (loads environment, sets headers, initializes configuration).
 * This is a standard pattern for application bootstrap files.
 *
 * phpcs:disable PSR1.Files.SideEffects
 */

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

$dotenv = Dotenv::createImmutable(__DIR__, ['.env', '.env.local', '.env.development', '.env.staging', '.env.production'], false);
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

// ============================================================================
// Security Headers - Hybrid Approach (nginx + PHP)
// ============================================================================
// Static security headers (X-Frame-Options, etc.) should be configured in nginx
// See: nginx/security-headers.conf for nginx configuration
//
// PHP sets only dynamic headers that require environment variables:
// - Content-Security-Policy (includes dynamic API URL)
// - Strict-Transport-Security (requires HTTPS detection)
// ============================================================================

// Build CSP-compliant API URL for connect-src
$apiCspUrl = "{$_ENV['API_PROTOCOL']}://{$_ENV['API_HOST']}" . $apiPort;

// Content Security Policy - Phase 2 Enhanced Security
// This MUST be set in PHP because it includes the dynamic API URL from .env
// TODO: Phase 3 - Remove 'unsafe-inline' from script-src and style-src for stronger CSP
//       Move inline scripts to external .js files or use nonces/hashes
header('Content-Security-Policy: ' .
    "default-src 'self'; " .
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://cdn.skypack.dev; " .
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; " .
    "font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; " .
    "img-src 'self' data: https:; " .
    "connect-src 'self' {$apiCspUrl} https://api.github.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.skypack.dev; " .
    "frame-ancestors 'none'; " .
    "base-uri 'self'; " .
    "form-action 'self';");

// HSTS - Set in PHP for HTTPS detection
// Note: If nginx always proxies HTTPS, this can be moved to nginx config
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
}

// ============================================================================
// Cookie Security - SameSite Protection (Phase 2.2)
// ============================================================================
// Configure secure cookie defaults for any future cookie usage
// This protects against CSRF attacks by preventing cross-site cookie sending
// ============================================================================

$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';

// Configure PHP session cookie settings if sessions are ever used
// Note: Currently the app uses localStorage for JWT, not session cookies
ini_set('session.cookie_httponly', '1');  // Prevent JavaScript access
ini_set('session.cookie_samesite', 'Strict');  // CSRF protection
if ($isHttps) {
    ini_set('session.cookie_secure', '1');  // HTTPS only
}

/**
 * Helper function to set secure cookies with SameSite protection
 *
 * @param string $name Cookie name
 * @param string $value Cookie value
 * @param int $expire Expiration timestamp (0 for session cookie)
 * @param string $path Cookie path (default: '/')
 * @param string $domain Cookie domain (default: '')
 * @param string $sameSite SameSite policy: 'Strict', 'Lax', or 'None' (default: 'Strict')
 * @return bool True on success
 */
function setSecureCookie(
    string $name,
    string $value,
    int $expire = 0,
    string $path = '/',
    string $domain = '',
    string $sameSite = 'Strict'
): bool {
    global $isHttps;

    // Validate SameSite value
    $validSameSite = ['Strict', 'Lax', 'None'];
    if (!in_array($sameSite, $validSameSite, true)) {
        throw new InvalidArgumentException(
            'Invalid SameSite value. Must be one of: ' . implode(', ', $validSameSite)
        );
    }

    // SameSite=None requires Secure flag (HTTPS)
    // Browsers will silently reject cookies with SameSite=None without Secure
    if ($sameSite === 'None' && !$isHttps) {
        throw new InvalidArgumentException(
            'SameSite=None requires HTTPS. Cookie would be rejected by browsers.'
        );
    }

    $options = [
        'expires'  => $expire,
        'path'     => $path,
        'domain'   => $domain,
        'secure'   => $isHttps,  // Only send over HTTPS
        'httponly' => true,    // Not accessible via JavaScript
        'samesite' => $sameSite  // CSRF protection
    ];

    return setcookie($name, $value, $options);
}

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

// Initialize API configuration (singleton)
$apiConfig = \LiturgicalCalendar\Frontend\ApiConfig::getInstance($apiBaseUrl);

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
    'apiUrl'     => $apiConfig->apiBaseUrl,
    'httpClient' => $httpClient
]);
