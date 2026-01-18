<?php

/**
 * Token Refresh Endpoint
 *
 * Refreshes the access token using the refresh token stored in HttpOnly cookie.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;
use LiturgicalCalendar\Frontend\CookieHelper;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

// Set JSON response headers
header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Check for refresh token
$refreshToken = $_COOKIE['litcal_refresh_token'] ?? null;

if ($refreshToken === null) {
    http_response_code(401);
    echo json_encode([
        'error'   => 'No refresh token',
        'message' => 'Please log in again',
    ]);
    exit;
}

// Check if OIDC is configured
if (!OidcClient::isConfigured()) {
    http_response_code(503);
    echo json_encode(['error' => 'OIDC not configured']);
    exit;
}

try {
    $oidcClient = OidcClient::fromEnv();

    // Refresh tokens
    $tokens = $oidcClient->refreshToken($refreshToken);

    if (!isset($tokens['access_token'])) {
        throw new \Exception('No access token in refresh response');
    }

    $accessToken     = $tokens['access_token'];
    $newRefreshToken = $tokens['refresh_token'] ?? null;
    $idToken         = $tokens['id_token'] ?? null;
    $expiresIn       = $tokens['expires_in'] ?? 3600;

    // Set new cookies
    $accessExpiry = time() + $expiresIn;
    CookieHelper::setAuthCookie('litcal_access_token', $accessToken, $accessExpiry);

    if ($newRefreshToken !== null) {
        $refreshExpiry = time() + CookieHelper::REFRESH_TOKEN_LIFETIME;
        CookieHelper::setAuthCookie('litcal_refresh_token', $newRefreshToken, $refreshExpiry);
    }

    if ($idToken !== null) {
        $idTokenExpiry = OidcClient::getIdTokenExpiry($idToken, $accessExpiry);
        CookieHelper::setAuthCookie('litcal_id_token', $idToken, $idTokenExpiry);
    }

    echo json_encode([
        'success'    => true,
        'expires_in' => $expiresIn,
        'expires_at' => $accessExpiry,
    ]);
} catch (Exception $e) {
    error_log('Token refresh error: ' . $e->getMessage());

    // Clear cookies on refresh failure
    CookieHelper::clearAuthCookie('litcal_access_token');
    CookieHelper::clearAuthCookie('litcal_refresh_token');
    CookieHelper::clearAuthCookie('litcal_id_token');

    http_response_code(401);
    echo json_encode([
        'error'   => 'Refresh failed',
        'message' => 'Please log in again',
    ]);
}
