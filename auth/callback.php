<?php

/**
 * OIDC Callback Handler
 *
 * Handles the redirect back from Zitadel after authentication.
 * Exchanges the authorization code for tokens and sets HttpOnly cookies.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;
use LiturgicalCalendar\Frontend\CookieHelper;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

// Enable error display in development
$appEnv = $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'production';
if ($appEnv === 'development') {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
}

// Validate FRONTEND_URL early - required for all redirects
$frontendUrl = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: '';
if (empty($frontendUrl)) {
    throw new RuntimeException('Missing required environment variable: FRONTEND_URL');
}
$parsedFrontend = parse_url($frontendUrl);
if (!isset($parsedFrontend['scheme']) || !isset($parsedFrontend['host'])) {
    throw new RuntimeException('FRONTEND_URL must be a valid absolute URL with scheme and host');
}

/**
 * Redirect with error.
 *
 * @param string $frontendUrl Validated frontend URL
 * @param string $error Error code
 * @param string $description Error description
 */
function redirectWithError(string $frontendUrl, string $error, string $description): void
{
    $errorUrl = rtrim($frontendUrl, '/') . '/?auth_error=' . urlencode($error) . '&error_description=' . urlencode($description);
    header('Location: ' . $errorUrl);
    exit;
}

/**
 * Sanitize error message for development display.
 *
 * Redacts potential secrets (tokens, keys, long alphanumeric strings) while
 * keeping the message useful for debugging.
 *
 * @param string $message The error message to sanitize
 * @return string Sanitized message
 */
function sanitizeErrorMessage(string $message): string
{
    // Redact JWT-like tokens (three base64 segments separated by dots)
    $message = preg_replace('/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/', '[REDACTED_JWT]', $message);

    // Redact long alphanumeric strings that look like tokens/secrets (32+ chars)
    $message = preg_replace('/[A-Za-z0-9_-]{32,}/', '[REDACTED_TOKEN]', $message);

    // Truncate very long messages
    if (strlen($message) > 1000) {
        $message = substr($message, 0, 1000) . '... [truncated]';
    }

    return $message;
}

// Start session for PKCE state
session_start();

// Check for error response from Zitadel
if (isset($_GET['error'])) {
    $error       = substr((string) $_GET['error'], 0, 64);
    $description = substr((string) ( $_GET['error_description'] ?? 'Authentication failed' ), 0, 256);
    redirectWithError($frontendUrl, $error, $description);
}

// Verify required parameters
if (!isset($_GET['code']) || !isset($_GET['state'])) {
    redirectWithError($frontendUrl, 'invalid_request', 'Missing code or state parameter');
}

$code  = substr((string) $_GET['code'], 0, 2048);
$state = substr((string) $_GET['state'], 0, 512);

try {
    $oidcClient = OidcClient::fromEnv();

    // Exchange code for tokens
    $tokens = $oidcClient->exchangeCode($code, $state);

    if (!isset($tokens['access_token'])) {
        redirectWithError($frontendUrl, 'token_error', 'No access token received');
    }

    $accessToken  = $tokens['access_token'];
    $refreshToken = $tokens['refresh_token'] ?? null;
    $idToken      = $tokens['id_token'] ?? null;
    $expiresIn    = $tokens['expires_in'] ?? 3600;

    // Set HttpOnly cookies for tokens
    $accessExpiry = time() + $expiresIn;
    CookieHelper::setAuthCookie('litcal_access_token', $accessToken, $accessExpiry);

    if ($refreshToken !== null) {
        $refreshExpiry = time() + CookieHelper::REFRESH_TOKEN_LIFETIME;
        CookieHelper::setAuthCookie('litcal_refresh_token', $refreshToken, $refreshExpiry);
    }

    if ($idToken !== null) {
        $idTokenExpiry = OidcClient::getIdTokenExpiry($idToken, $accessExpiry);
        CookieHelper::setAuthCookie('litcal_id_token', $idToken, $idTokenExpiry);
    }

    // Check if user has any roles - if not, redirect to request-access page
    $userRoles = [];
    if ($idToken !== null) {
        try {
            $payload   = $oidcClient->validateIdToken($idToken);
            $userInfo  = $oidcClient->extractUserFromIdToken($payload);
            $userRoles = $userInfo['roles'] ?? [];
        } catch (Throwable $e) {
            // If we can't validate the token, we'll just proceed without role check
            error_log('Could not extract roles from ID token: ' . $e->getMessage());
        }
    }

    // Get return URL from session
    $returnTo = $_SESSION['oidc_return_to'] ?? null;
    unset($_SESSION['oidc_return_to']);

    // If user has no roles and no explicit return URL, redirect to request-access page
    if (empty($userRoles) && $returnTo === null) {
        $redirectUrl = rtrim($frontendUrl, '/') . '/request-access.php';
        header('Location: ' . $redirectUrl);
        exit;
    }

    // Validate return URL against frontend URL (already validated at script start)
    if ($returnTo !== null) {
        $parsed = parse_url($returnTo);
        // Reject if URL has a host that doesn't match frontend, or has a scheme (protocol-relative URLs)
        if (isset($parsed['scheme']) || isset($parsed['host'])) {
            $frontendHost   = parse_url($frontendUrl, PHP_URL_HOST);
            $frontendScheme = parse_url($frontendUrl, PHP_URL_SCHEME);
            if (
                ( $parsed['host'] ?? null ) !== $frontendHost ||
                ( isset($parsed['scheme']) && $parsed['scheme'] !== $frontendScheme )
            ) {
                $returnTo = null;
            }
        }
    }

    // Redirect to return URL or frontend home (frontendUrl validated at script start)
    $redirectUrl = $returnTo ?? $frontendUrl;
    header('Location: ' . $redirectUrl);
    exit;
} catch (Throwable $e) {
    error_log('OIDC callback error: ' . $e->getMessage());

    // In development, show sanitized error (redact potential secrets from upstream services)
    if ($appEnv === 'development') {
        header('Content-Type: text/plain');
        echo "OIDC Callback Error:\n\n";
        echo 'Message: ' . sanitizeErrorMessage($e->getMessage()) . "\n\n";
        echo 'File: ' . $e->getFile() . ':' . $e->getLine() . "\n\n";
        echo "Trace:\n" . sanitizeErrorMessage($e->getTraceAsString());
        exit;
    }

    redirectWithError($frontendUrl, 'callback_error', 'Failed to complete authentication');
}
