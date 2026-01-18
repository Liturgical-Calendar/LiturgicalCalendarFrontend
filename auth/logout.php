<?php

/**
 * OIDC Logout Handler
 *
 * Clears local authentication cookies and optionally redirects
 * to Zitadel to end the session there as well.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;
use LiturgicalCalendar\Frontend\CookieHelper;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

// Get ID token for Zitadel logout hint (if available)
$idToken = $_COOKIE['litcal_id_token'] ?? null;

// Clear all auth cookies
CookieHelper::clearAuthCookie('litcal_access_token');
CookieHelper::clearAuthCookie('litcal_refresh_token');
CookieHelper::clearAuthCookie('litcal_id_token');

// Destroy PHP session (used during OIDC flow for PKCE state)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        [
            'expires'  => time() - 42000,
            'path'     => $params['path'],
            'domain'   => $params['domain'],
            'secure'   => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]
    );
}
session_destroy();

// Get post-logout redirect URL
$frontendUrl           = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: '';
$postLogoutRedirectUri = $_GET['return_to'] ?? $frontendUrl;

// Normalize URL: remove trailing slash to match Zitadel's configured URIs
$postLogoutRedirectUri = rtrim($postLogoutRedirectUri, '/');

// Ensure we have a valid redirect URL
if (empty($postLogoutRedirectUri)) {
    $postLogoutRedirectUri = rtrim($frontendUrl, '/');
}

// For OIDC logout, always use base frontend URL
// Zitadel only has the base URL configured as post_logout_redirect_uri
// Individual page URLs (user-profile.php, etc.) would cause "invalid redirect" errors
$zitadelLogout = $_GET['zitadel'] ?? 'true';
if ($zitadelLogout === 'true') {
    // Use base frontend URL for Zitadel redirect
    $postLogoutRedirectUri = rtrim($frontendUrl, '/');
}

// Validate post-logout redirect URL
$parsed = parse_url($postLogoutRedirectUri);
if (isset($parsed['host'])) {
    $frontendHost = parse_url($frontendUrl, PHP_URL_HOST);
    if ($parsed['host'] !== $frontendHost) {
        $postLogoutRedirectUri = $frontendUrl;
    }
}

// Check if we should also logout from Zitadel
if ($zitadelLogout === 'true' && OidcClient::isConfigured()) {
    try {
        $oidcClient = OidcClient::fromEnv();
        $logoutUrl  = $oidcClient->getLogoutUrl($idToken, $postLogoutRedirectUri);
        header('Location: ' . $logoutUrl);
        exit;
    } catch (Exception $e) {
        error_log('OIDC logout error: ' . $e->getMessage());
        // Fall through to local redirect
    }
}

// Local-only logout: redirect to frontend
header('Location: ' . $postLogoutRedirectUri);
exit;
