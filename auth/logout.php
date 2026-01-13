<?php

/**
 * OIDC Logout Handler
 *
 * Clears local authentication cookies and optionally redirects
 * to Zitadel to end the session there as well.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

/**
 * Clear authentication cookie.
 *
 * @param string $name Cookie name
 */
function clearAuthCookie(string $name): void
{
    $secure   = ( $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'development' ) !== 'development';
    $sameSite = $secure ? 'Strict' : 'Lax';
    $domain   = $_ENV['COOKIE_DOMAIN'] ?? getenv('COOKIE_DOMAIN') ?: '';

    $options = [
        'expires'  => time() - 3600,
        'path'     => '/',
        'domain'   => $domain ?: '',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => $sameSite,
    ];

    setcookie($name, '', $options);
}

// Get ID token for Zitadel logout hint (if available)
$idToken = $_COOKIE['litcal_id_token'] ?? null;

// Clear all auth cookies
clearAuthCookie('litcal_access_token');
clearAuthCookie('litcal_refresh_token');
clearAuthCookie('litcal_id_token');

// Get post-logout redirect URL
$frontendUrl           = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: '';
$postLogoutRedirectUri = $_GET['return_to'] ?? $frontendUrl;

// Validate post-logout redirect URL
$parsed = parse_url($postLogoutRedirectUri);
if (isset($parsed['host'])) {
    $frontendHost = parse_url($frontendUrl, PHP_URL_HOST);
    if ($parsed['host'] !== $frontendHost) {
        $postLogoutRedirectUri = $frontendUrl;
    }
}

// Check if we should also logout from Zitadel
$zitadelLogout = $_GET['zitadel'] ?? 'true';

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
