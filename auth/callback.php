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

/**
 * Redirect with error.
 *
 * @param string $error Error code
 * @param string $description Error description
 */
function redirectWithError(string $error, string $description): void
{
    $frontendUrl = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: '';
    $errorUrl    = rtrim($frontendUrl, '/') . '/?auth_error=' . urlencode($error) . '&error_description=' . urlencode($description);
    header('Location: ' . $errorUrl);
    exit;
}

// Start session for PKCE state
session_start();

// Check for error response from Zitadel
if (isset($_GET['error'])) {
    $error       = $_GET['error'];
    $description = $_GET['error_description'] ?? 'Authentication failed';
    redirectWithError($error, $description);
}

// Verify required parameters
if (!isset($_GET['code']) || !isset($_GET['state'])) {
    redirectWithError('invalid_request', 'Missing code or state parameter');
}

$code  = $_GET['code'];
$state = $_GET['state'];

try {
    $oidcClient = OidcClient::fromEnv();

    // Exchange code for tokens
    $tokens = $oidcClient->exchangeCode($code, $state);

    if (!isset($tokens['access_token'])) {
        redirectWithError('token_error', 'No access token received');
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
        // Extract expiry from ID token's exp claim
        $idTokenParts = explode('.', $idToken);
        if (count($idTokenParts) === 3) {
            $idTokenPayload = json_decode(
                base64_decode(strtr($idTokenParts[1], '-_', '+/')),
                true
            );
            $idTokenExpiry  = is_array($idTokenPayload) && isset($idTokenPayload['exp'])
                ? (int) $idTokenPayload['exp']
                : $accessExpiry;
        } else {
            $idTokenExpiry = $accessExpiry;
        }
        CookieHelper::setAuthCookie('litcal_id_token', $idToken, $idTokenExpiry);
    }

    // Get return URL from session
    $returnTo = $_SESSION['oidc_return_to'] ?? null;
    unset($_SESSION['oidc_return_to']);

    // Validate return URL
    $frontendUrl = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: '';

    if ($returnTo !== null) {
        $parsed = parse_url($returnTo);
        if (isset($parsed['host'])) {
            $frontendHost = parse_url($frontendUrl, PHP_URL_HOST);
            if ($parsed['host'] !== $frontendHost) {
                $returnTo = null;
            }
        }
    }

    // Redirect to return URL or home
    $redirectUrl = $returnTo ?? $frontendUrl;
    header('Location: ' . $redirectUrl);
    exit;
} catch (Throwable $e) {
    error_log('OIDC callback error: ' . $e->getMessage());

    // In development, show the actual error
    if ($appEnv === 'development') {
        header('Content-Type: text/plain');
        echo "OIDC Callback Error:\n\n";
        echo 'Message: ' . $e->getMessage() . "\n\n";
        echo 'File: ' . $e->getFile() . ':' . $e->getLine() . "\n\n";
        echo "Trace:\n" . $e->getTraceAsString();
        exit;
    }

    redirectWithError('callback_error', 'Failed to complete authentication');
}
