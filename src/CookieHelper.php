<?php

namespace LiturgicalCalendar\Frontend;

/**
 * Cookie Helper for authentication cookie management
 *
 * Provides centralized methods for setting and clearing HttpOnly cookies
 * used for authentication across all auth endpoints.
 */
class CookieHelper
{
    /**
     * Refresh token lifetime in seconds (7 days).
     */
    public const REFRESH_TOKEN_LIFETIME = 604800;

    /**
     * Set an authentication cookie with secure defaults.
     *
     * In production (non-development), cookies are set with Secure and SameSite=Strict.
     * In development, cookies use SameSite=Lax to allow local testing without HTTPS.
     *
     * @param string $name Cookie name
     * @param string $value Cookie value
     * @param int $expiry Expiry timestamp
     */
    public static function setAuthCookie(string $name, string $value, int $expiry): void
    {
        $secure   = ( $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'development' ) !== 'development';
        $sameSite = $secure ? 'Strict' : 'Lax';
        $domain   = $_ENV['COOKIE_DOMAIN'] ?? getenv('COOKIE_DOMAIN') ?: '';

        setcookie($name, $value, [
            'expires'  => $expiry,
            'path'     => '/',
            'domain'   => $domain ?: '',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => $sameSite,
        ]);
    }

    /**
     * Clear an authentication cookie.
     *
     * Sets the cookie with an empty value and an expiry time in the past.
     *
     * @param string $name Cookie name to clear
     */
    public static function clearAuthCookie(string $name): void
    {
        self::setAuthCookie($name, '', time() - 3600);
    }
}
