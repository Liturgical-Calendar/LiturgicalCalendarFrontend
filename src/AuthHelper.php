<?php

namespace LiturgicalCalendar\Frontend;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Firebase\JWT\BeforeValidException;
use UnexpectedValueException;

/**
 * Authentication Helper for server-side JWT validation
 *
 * Reads and validates JWT tokens from HttpOnly cookies to determine
 * authentication state before page render. This eliminates the flash/delay
 * that occurs when relying solely on client-side JavaScript authentication checks.
 *
 * The JWT secret must match the one used by the API to sign tokens.
 */
class AuthHelper
{
    private const ACCESS_TOKEN_COOKIE  = 'litcal_access_token';
    private const SUPPORTED_ALGORITHMS = ['HS256', 'HS384', 'HS512'];

    private static ?self $instance = null;

    public readonly bool $isAuthenticated;
    public readonly ?string $username;
    public readonly ?int $exp;
    /** @var array<string>|null */
    public readonly ?array $roles;
    /** @var array<string>|null */
    public readonly ?array $permissions;

    /**
     * Private constructor - use getInstance() to get the singleton
     *
     * @param object|null $payload Validated JWT payload, or null if not authenticated
     */
    private function __construct(?object $payload)
    {
        if ($payload === null) {
            $this->isAuthenticated = false;
            $this->username        = null;
            $this->exp             = null;
            $this->roles           = null;
            $this->permissions     = null;
        } else {
            $this->isAuthenticated = true;
            $this->username        = isset($payload->sub) && is_string($payload->sub) ? $payload->sub : null;
            $this->exp             = isset($payload->exp) && is_numeric($payload->exp) ? (int) $payload->exp : null;
            $this->roles           = isset($payload->roles) && is_array($payload->roles)
                ? array_values(array_filter($payload->roles, 'is_string'))
                : null;
            $this->permissions     = isset($payload->permissions) && is_array($payload->permissions)
                ? array_values(array_filter($payload->permissions, 'is_string'))
                : null;
        }
    }

    /**
     * Validate a JWT token
     *
     * @param string $token JWT token string
     * @param string $secret JWT signing secret
     * @param string $algorithm JWT algorithm
     * @return object|null Decoded payload if valid, null otherwise
     */
    private static function validateToken(string $token, string $secret, string $algorithm): ?object
    {
        try {
            $decoded = JWT::decode($token, new Key($secret, $algorithm));

            // Verify token type is 'access'
            if (!isset($decoded->type) || $decoded->type !== 'access') {
                return null;
            }

            return $decoded;
        } catch (ExpiredException) {
            // Token has expired
            return null;
        } catch (SignatureInvalidException) {
            // Token signature is invalid
            return null;
        } catch (BeforeValidException) {
            // Token not yet valid
            return null;
        } catch (UnexpectedValueException) {
            // Token malformed or other error
            return null;
        }
    }

    /**
     * Get the singleton instance
     *
     * @param string|null $secret JWT signing secret (required on first call, from JWT_SECRET env var)
     * @param string $algorithm JWT algorithm (from JWT_ALGORITHM env var, defaults to HS256)
     * @return self
     */
    public static function getInstance(?string $secret = null, string $algorithm = 'HS256'): self
    {
        if (self::$instance === null) {
            // Try to get from environment if not provided
            // Check both $_ENV (phpdotenv) and getenv() for compatibility
            $secret    = $secret ?? ( $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET') ?: null );
            $algorithm = $_ENV['JWT_ALGORITHM'] ?? getenv('JWT_ALGORITHM') ?: $algorithm;

            // Ensure algorithm is a string
            if (!is_string($algorithm)) {
                $algorithm = 'HS256';
            }

            // Attempt to validate token and create instance
            $payload        = self::tryValidateFromCookie($secret, $algorithm);
            self::$instance = new self($payload);
        }

        return self::$instance;
    }

    /**
     * Try to validate JWT from cookie
     *
     * @param string|null $secret JWT signing secret
     * @param string $algorithm JWT algorithm
     * @return object|null Validated payload or null
     */
    private static function tryValidateFromCookie(?string $secret, string $algorithm): ?object
    {
        // If no secret configured, we can't validate tokens
        if ($secret === null || $secret === '' || strlen($secret) < 32) {
            return null;
        }

        // Validate algorithm
        if (!in_array($algorithm, self::SUPPORTED_ALGORITHMS, true)) {
            return null;
        }

        // Get token from cookie
        $token = $_COOKIE[self::ACCESS_TOKEN_COOKIE] ?? null;
        if ($token === null || $token === '') {
            return null;
        }

        // Validate and return the token payload
        return self::validateToken($token, $secret, $algorithm);
    }

    /**
     * Check if the current user has a specific role
     *
     * @param string $role Role to check
     * @return bool True if user has the role
     */
    public function hasRole(string $role): bool
    {
        if (!$this->isAuthenticated || $this->roles === null) {
            return false;
        }
        return in_array($role, $this->roles, true);
    }

    /**
     * Check if the current user has a specific permission
     *
     * @param string $permission Permission to check
     * @return bool True if user has the permission
     */
    public function hasPermission(string $permission): bool
    {
        if (!$this->isAuthenticated || $this->permissions === null) {
            return false;
        }
        return in_array($permission, $this->permissions, true);
    }

    /**
     * Reset the singleton instance
     *
     * @internal For testing purposes only
     */
    public static function reset(): void
    {
        self::$instance = null;
    }
}
