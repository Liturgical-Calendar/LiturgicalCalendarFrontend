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
 * Supports two authentication modes:
 * - OIDC: Validates tokens from Zitadel using JWKS (RS256)
 * - Legacy: Validates tokens signed with JWT_SECRET (HS256)
 *
 * OIDC mode is used when ZITADEL_ISSUER and ZITADEL_CLIENT_ID are configured.
 */
class AuthHelper
{
    private const ACCESS_TOKEN_COOKIE  = 'litcal_access_token';
    private const ID_TOKEN_COOKIE      = 'litcal_id_token';
    private const SUPPORTED_ALGORITHMS = ['HS256', 'HS384', 'HS512'];

    private static ?self $instance = null;

    public readonly bool $isAuthenticated;
    public readonly ?string $username;
    public readonly ?string $email;
    public readonly ?string $name;
    public readonly ?string $givenName;
    public readonly ?string $familyName;
    public readonly ?string $sub;
    public readonly bool $emailVerified;
    public readonly ?int $exp;
    /** @var array<string>|null */
    public readonly ?array $roles;
    /** @var array<string>|null */
    public readonly ?array $permissions;

    /**
     * Memoized admin-scopes result for this request.
     * Shape: array{is_resource_admin: bool, admin_scopes: list<array{object_type: string, object_id: string}>}
     *
     * @var array{is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>}|null
     */
    private ?array $adminScopesResult = null;

    /**
     * Private constructor - use getInstance() to get the singleton
     *
     * @param object|null $payload Validated JWT payload, or null if not authenticated
     * @param bool $isOidc Whether this is an OIDC token (different claim structure)
     * @param array<int, string>|null $oidcRoles Roles unioned across the OIDC tokens (OIDC mode only)
     */
    private function __construct(?object $payload, bool $isOidc = false, ?array $oidcRoles = null)
    {
        if ($payload === null) {
            $this->isAuthenticated = false;
            $this->username        = null;
            $this->email           = null;
            $this->name            = null;
            $this->givenName       = null;
            $this->familyName      = null;
            $this->sub             = null;
            $this->emailVerified   = false;
            $this->exp             = null;
            $this->roles           = null;
            $this->permissions     = null;
        } elseif ($isOidc) {
            // OIDC token from Zitadel
            $this->isAuthenticated = true;
            // Prefer preferred_username, fall back to email, then sub
            $this->username      = $payload->preferred_username
                ?? $payload->email
                ?? $payload->sub
                ?? null;
            $this->email         = $payload->email ?? null;
            $this->name          = $payload->name ?? null;
            $this->givenName     = $payload->given_name ?? null;
            $this->familyName    = $payload->family_name ?? null;
            $this->sub           = $payload->sub ?? null;
            $this->emailVerified = $payload->email_verified ?? false;
            $this->exp           = isset($payload->exp) && is_numeric($payload->exp) ? (int) $payload->exp : null;

            // Roles are unioned across the ID and access tokens by tryValidateOidcToken(),
            // since Zitadel may assert them into either token depending on configuration.
            $this->roles       = !empty($oidcRoles) ? array_values(array_unique($oidcRoles)) : null;
            $this->permissions = null; // OIDC doesn't have permissions claim
        } else {
            // Legacy JWT token
            $this->isAuthenticated = true;
            $this->username        = isset($payload->sub) && is_string($payload->sub) ? $payload->sub : null;
            $this->email           = null; // Legacy tokens don't have email
            $this->name            = null;
            $this->givenName       = null;
            $this->familyName      = null;
            $this->sub             = isset($payload->sub) && is_string($payload->sub) ? $payload->sub : null;
            $this->emailVerified   = false;
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
     * Note: This is a true singleton - parameters are only used on first instantiation.
     * Subsequent calls return the cached instance regardless of parameters passed.
     * Use reset() to clear the instance if different parameters are needed (e.g., in tests).
     *
     * @param string|null $secret JWT signing secret (for legacy mode, from JWT_SECRET env var)
     * @param string $algorithm JWT algorithm (for legacy mode, from JWT_ALGORITHM env var, defaults to HS256)
     * @return self
     */
    public static function getInstance(?string $secret = null, string $algorithm = 'HS256'): self
    {
        if (self::$instance === null) {
            // Check if OIDC is configured
            $issuer   = $_ENV['ZITADEL_ISSUER'] ?? getenv('ZITADEL_ISSUER') ?: null;
            $clientId = $_ENV['ZITADEL_CLIENT_ID'] ?? getenv('ZITADEL_CLIENT_ID') ?: null;

            if ($issuer !== null && $clientId !== null) {
                // Try OIDC validation first
                $oidc = self::tryValidateOidcToken();
                if ($oidc !== null) {
                    self::$instance = new self($oidc['payload'], true, $oidc['roles']);
                    return self::$instance;
                }
            }

            // Fall back to legacy JWT validation
            $secret    = $secret ?? ( $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET') ?: null );
            $algorithm = $_ENV['JWT_ALGORITHM'] ?? getenv('JWT_ALGORITHM') ?: $algorithm;

            // Ensure algorithm is a string
            if (!is_string($algorithm)) {
                $algorithm = 'HS256';
            }

            // Attempt to validate token and create instance
            $payload        = self::tryValidateFromCookie($secret, $algorithm);
            self::$instance = new self($payload, false);
        }

        return self::$instance;
    }

    /**
     * Try to validate the OIDC tokens from Zitadel.
     *
     * Uses OidcClient for JWKS handling and token validation. Prefers the ID token for user
     * profile information (preferred_username, email, name, etc.) as the access token typically
     * only contains minimal claims (sub). Roles are unioned across both tokens, since Zitadel may
     * assert them into the ID token, the access token, or both depending on configuration.
     *
     * @return array{payload: object, roles: array<int, string>}|null Profile payload and unioned
     *                                                                 roles, or null if invalid
     */
    private static function tryValidateOidcToken(): ?array
    {
        // Access token must be present (proves the user is authenticated)
        $accessToken = $_COOKIE[self::ACCESS_TOKEN_COOKIE] ?? null;
        if ($accessToken === null || $accessToken === '') {
            return null;
        }

        // ID token carries the richer profile claims (preferred_username, email, name, etc.);
        // the access token typically only has minimal claims (sub).
        $idToken = $_COOKIE[self::ID_TOKEN_COOKIE] ?? null;

        // Prefer the ID token for the profile payload, fall back to the access token.
        $profileToken = $idToken ?? $accessToken;

        try {
            $oidcClient = OidcClient::fromEnv();

            // Build list of valid audiences (clientId + projectId if configured)
            $additionalAudiences = [];
            $projectId           = $_ENV['ZITADEL_PROJECT_ID'] ?? getenv('ZITADEL_PROJECT_ID') ?: null;
            if ($projectId !== null) {
                $additionalAudiences[] = $projectId;
            }

            $profilePayload = $oidcClient->validateToken($profileToken, $additionalAudiences);
            if ($profilePayload === null) {
                return null;
            }

            // Union roles from every available token so a single Zitadel config toggle (or a
            // token that only carries minimal claims) cannot silently leave the user with no roles.
            $roles = $oidcClient->extractRolesFromToken($profilePayload);
            if ($profileToken !== $accessToken) {
                $accessPayload = $oidcClient->validateToken($accessToken, $additionalAudiences);
                if ($accessPayload !== null) {
                    $roles = array_merge($roles, $oidcClient->extractRolesFromToken($accessPayload));
                }
            }

            return [
                'payload' => $profilePayload,
                'roles'   => array_values(array_unique($roles)),
            ];
        } catch (\Exception) {
            // OidcClient instantiation or validation errors
            return null;
        }
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
     * Whether the caller holds an OpenFGA `admin` tuple on at least one resource.
     *
     * Resolved once per request from GET /auth/admin-scopes (server-side, using
     * the caller's session cookies). Fails closed: an unauthenticated caller or
     * any API/parse error yields false.
     */
    public function isResourceAdmin(): bool
    {
        return $this->loadAdminScopes()['is_resource_admin'];
    }

    /**
     * The caller's OpenFGA `admin` scopes.
     *
     * @return array<int, array{object_type: string, object_id: string}>
     */
    public function adminScopes(): array
    {
        return $this->loadAdminScopes()['admin_scopes'];
    }

    /**
     * Resolve (and memoize) the admin-scopes result for this request.
     *
     * @return array{is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>}
     */
    private function loadAdminScopes(): array
    {
        if ($this->adminScopesResult !== null) {
            return $this->adminScopesResult;
        }

        // Fail closed for unauthenticated callers — never hit the API.
        if (!$this->isAuthenticated) {
            return $this->adminScopesResult = ['is_resource_admin' => false, 'admin_scopes' => []];
        }

        // Prefer API_INTERNAL_URL for server-side Guzzle calls so that in Docker
        // environments the request routes through the internal network (e.g. to
        // 'litcal-api') rather than to the container's own loopback. This mirrors the
        // ZITADEL_INTERNAL_URL pattern used by OidcClient. Falls back to the public
        // apiBaseUrl when no internal override is configured.
        $internalUrl  = $_ENV['API_INTERNAL_URL'] ?? getenv('API_INTERNAL_URL') ?: null;
        $apiBaseUrl   = $internalUrl ? rtrim($internalUrl, '/') : ApiConfig::getInstance()->apiBaseUrl;
        $cookieHeader = self::buildCookieHeader();

        return $this->adminScopesResult = self::fetchAdminScopes($apiBaseUrl, $cookieHeader);
    }

    /**
     * Build a Cookie header from the session token cookies, to forward the
     * caller's identity to the API on the server-to-server call.
     */
    private static function buildCookieHeader(): ?string
    {
        $parts = [];
        foreach ([self::ACCESS_TOKEN_COOKIE, self::ID_TOKEN_COOKIE] as $name) {
            $value = $_COOKIE[$name] ?? null;
            if (is_string($value) && $value !== '') {
                $parts[] = "{$name}={$value}";
            }
        }
        return $parts === [] ? null : implode('; ', $parts);
    }

    /**
     * Fetch and parse GET /auth/admin-scopes. Fails closed on any error.
     *
     * @param string $apiBaseUrl Base API URL (no trailing slash)
     * @param string|null $cookieHeader Cookie header forwarding the caller's session
     * @param \GuzzleHttp\Client|null $client Injectable client (tests)
     * @return array{is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>}
     */
    public static function fetchAdminScopes(
        string $apiBaseUrl,
        ?string $cookieHeader,
        ?\GuzzleHttp\Client $client = null
    ): array {
        $failClosed = ['is_resource_admin' => false, 'admin_scopes' => []];

        $client ??= new \GuzzleHttp\Client(['timeout' => 5, 'connect_timeout' => 2, 'http_errors' => true]);

        $headers = ['Accept' => 'application/json'];
        if ($cookieHeader !== null) {
            $headers['Cookie'] = $cookieHeader;
        }

        try {
            $response = $client->get("{$apiBaseUrl}/auth/admin-scopes", ['headers' => $headers]);
            $data     = json_decode((string) $response->getBody(), true);
        } catch (\Throwable) {
            return $failClosed;
        }

        if (!is_array($data)) {
            return $failClosed;
        }

        $scopes = [];
        if (isset($data['admin_scopes']) && is_array($data['admin_scopes'])) {
            foreach ($data['admin_scopes'] as $scope) {
                if (
                    is_array($scope)
                    && isset($scope['object_type'], $scope['object_id'])
                    && is_string($scope['object_type'])
                    && is_string($scope['object_id'])
                ) {
                    $scopes[] = ['object_type' => $scope['object_type'], 'object_id' => $scope['object_id']];
                }
            }
        }

        // Strict, fail-closed: only an explicit JSON `true` counts as resource-admin.
        // A non-boolean value (e.g. the string "false") or a missing key yields false,
        // mirroring the per-scope type validation above.
        return [
            'is_resource_admin' => ( $data['is_resource_admin'] ?? false ) === true,
            'admin_scopes'      => $scopes,
        ];
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
