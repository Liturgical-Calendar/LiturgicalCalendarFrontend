<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend;

use Firebase\JWT\CachedKeySet;
use Firebase\JWT\JWT;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\HttpFactory;
use Psr\Http\Message\RequestInterface;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;

/**
 * OIDC Client for Zitadel authentication using PKCE flow.
 *
 * Implements the Authorization Code Flow with PKCE (Proof Key for Code Exchange)
 * for secure authentication without requiring a client secret.
 */
class OidcClient
{
    private string $issuer;
    private string $clientId;
    private string $redirectUri;

    /**
     * Internal URL for server-side requests to Zitadel.
     * When running in Docker, Zitadel may not be reachable at the public issuer URL
     * from within the container. Set ZITADEL_INTERNAL_URL to the Docker service name
     * (e.g., http://zitadel:8080) to route server-side requests internally.
     */
    private ?string $internalUrl;

    /**
     * Zitadel organization ID to scope login and registration to.
     * When set, the `urn:zitadel:iam:org:id:<id>` scope is appended to every
     * authorization request, forcing both login AND new-user registration
     * into that specific org. Without it, Zitadel's hosted login lands new
     * passkey registrations in the IAM-internal default org, which won't
     * carry the project's RBAC roles.
     */
    private ?string $orgId;

    /**
     * Cached discovery document.
     *
     * @var array<string, mixed>|null
     */
    private ?array $discoveryDoc = null;

    /**
     * Session key for PKCE code verifier.
     */
    private const SESSION_CODE_VERIFIER = 'oidc_code_verifier';

    /**
     * Session key for state parameter.
     */
    private const SESSION_STATE = 'oidc_state';

    /**
     * Session key for nonce parameter.
     */
    private const SESSION_NONCE = 'oidc_nonce';

    /**
     * Create OIDC client.
     *
     * @param string $issuer Zitadel issuer URL
     * @param string $clientId Zitadel client ID
     * @param string $redirectUri Callback URL for code exchange
     * @param string|null $internalUrl Internal URL for server-side requests
     * @param string|null $orgId Zitadel org ID to scope login/registration to
     */
    public function __construct(
        string $issuer,
        string $clientId,
        string $redirectUri,
        ?string $internalUrl = null,
        ?string $orgId = null
    ) {
        $this->issuer      = rtrim($issuer, '/');
        $this->clientId    = $clientId;
        $this->redirectUri = $redirectUri;
        $this->internalUrl = $internalUrl !== null ? rtrim($internalUrl, '/') : null;
        $this->orgId       = self::normalizeOrgId($orgId);
    }

    /**
     * Normalize and validate a Zitadel org ID.
     *
     * Trims whitespace (env values commonly arrive with stray padding from
     * copy-paste), treats empty input as "not set", and rejects anything
     * non-numeric — Zitadel IDs are snowflake-style 18-digit decimal
     * strings, so a non-digit value can only be a misconfiguration and
     * would silently produce a malformed `urn:zitadel:iam:org:id:<id>`
     * scope that Zitadel rejects with a less helpful error.
     *
     * @throws \InvalidArgumentException If $orgId is non-empty but not all digits.
     */
    private static function normalizeOrgId(?string $orgId): ?string
    {
        if ($orgId === null) {
            return null;
        }
        $trimmed = trim($orgId);
        if ($trimmed === '') {
            return null;
        }
        if (!ctype_digit($trimmed)) {
            throw new \InvalidArgumentException(
                'ZITADEL_ORG_ID must be a numeric Zitadel ID (snowflake), got: ' . $orgId
            );
        }
        return $trimmed;
    }

    /**
     * Create client from environment variables.
     *
     * @param string|null $redirectUri Optional override for redirect URI
     * @return self
     * @throws \RuntimeException If required environment variables are missing
     */
    public static function fromEnv(?string $redirectUri = null): self
    {
        $issuer   = $_ENV['ZITADEL_ISSUER'] ?? getenv('ZITADEL_ISSUER') ?: null;
        $clientId = $_ENV['ZITADEL_CLIENT_ID'] ?? getenv('ZITADEL_CLIENT_ID') ?: null;

        if ($issuer === null || $clientId === null) {
            throw new \RuntimeException(
                'Missing required environment variables: ZITADEL_ISSUER, ZITADEL_CLIENT_ID'
            );
        }

        // Default redirect URI from environment or build from frontend URL
        if ($redirectUri === null) {
            $frontendUrl = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: null;
            if ($frontendUrl !== null) {
                $redirectUri = rtrim($frontendUrl, '/') . '/auth/callback.php';
            } else {
                throw new \RuntimeException('Missing FRONTEND_URL environment variable');
            }
        }

        $internalUrl = $_ENV['ZITADEL_INTERNAL_URL'] ?? getenv('ZITADEL_INTERNAL_URL') ?: null;
        $orgId       = $_ENV['ZITADEL_ORG_ID'] ?? getenv('ZITADEL_ORG_ID') ?: null;

        return new self($issuer, $clientId, $redirectUri, $internalUrl ?: null, $orgId ?: null);
    }

    /**
     * Check if OIDC is configured.
     *
     * @return bool True if Zitadel configuration is present
     */
    public static function isConfigured(): bool
    {
        $issuer   = $_ENV['ZITADEL_ISSUER'] ?? getenv('ZITADEL_ISSUER') ?: null;
        $clientId = $_ENV['ZITADEL_CLIENT_ID'] ?? getenv('ZITADEL_CLIENT_ID') ?: null;

        return $issuer !== null && $clientId !== null;
    }

    /**
     * Generate the authorization URL for login.
     *
     * @param array<string> $scopes Additional scopes beyond default
     * @param string|null $returnTo URL to redirect after login
     * @param string|null $prompt OIDC prompt parameter (login, consent, select_account, none)
     * @return string Authorization URL
     */
    public function getAuthorizationUrl(array $scopes = [], ?string $returnTo = null, ?string $prompt = null): string
    {
        $this->ensureSession();

        // Generate PKCE code verifier and challenge
        $codeVerifier  = $this->generateCodeVerifier();
        $codeChallenge = $this->generateCodeChallenge($codeVerifier);

        // Generate state and nonce for security
        $state = bin2hex(random_bytes(32));
        $nonce = bin2hex(random_bytes(32));

        // Store in session
        $_SESSION[self::SESSION_CODE_VERIFIER] = $codeVerifier;
        $_SESSION[self::SESSION_STATE]         = $state;
        $_SESSION[self::SESSION_NONCE]         = $nonce;

        if ($returnTo !== null) {
            $_SESSION['oidc_return_to'] = $returnTo;
        }

        // Build scopes
        $defaultScopes = [
            'openid',
            'profile',
            'email',
            'offline_access',
            'urn:zitadel:iam:org:project:roles',
        ];

        // Scope login/registration to a specific Zitadel org when configured.
        // Without this, Zitadel's hosted login lands new passkey registrations
        // in the IAM-internal default org, which carries no project roles.
        if ($this->orgId !== null) {
            $defaultScopes[] = 'urn:zitadel:iam:org:id:' . $this->orgId;
        }

        $allScopes = array_unique(array_merge($defaultScopes, $scopes));

        // Build authorization URL
        $authEndpoint = $this->getAuthorizationEndpoint();

        $params = [
            'response_type'         => 'code',
            'client_id'             => $this->clientId,
            'redirect_uri'          => $this->redirectUri,
            'scope'                 => implode(' ', $allScopes),
            'state'                 => $state,
            'nonce'                 => $nonce,
            'code_challenge'        => $codeChallenge,
            'code_challenge_method' => 'S256',
        ];

        // Add prompt parameter if specified (login, consent, select_account, none)
        if ($prompt !== null) {
            $params['prompt'] = $prompt;
        }

        return $authEndpoint . '?' . http_build_query($params);
    }

    /**
     * Exchange authorization code for tokens.
     *
     * @param string $code Authorization code
     * @param string $state State parameter from callback
     * @return array<string, mixed> Token response (access_token, id_token, refresh_token)
     * @throws \RuntimeException If exchange fails
     */
    public function exchangeCode(string $code, string $state): array
    {
        $this->ensureSession();

        // Verify state
        $storedState = $_SESSION[self::SESSION_STATE] ?? null;
        if ($storedState === null || !hash_equals($storedState, $state)) {
            throw new \RuntimeException('Invalid state parameter');
        }

        // Get code verifier
        $codeVerifier = $_SESSION[self::SESSION_CODE_VERIFIER] ?? null;
        if ($codeVerifier === null) {
            throw new \RuntimeException('Missing code verifier');
        }

        // Exchange code for tokens
        $tokenEndpoint = $this->getTokenEndpoint();

        $serverBase = $this->getServerBaseUrl();
        $client     = new Client(['connect_timeout' => 2, 'timeout' => 10]);
        try {
            $response = $client->post($tokenEndpoint, [
                'headers'     => $serverBase['headers'],
                'form_params' => [
                    'grant_type'    => 'authorization_code',
                    'client_id'     => $this->clientId,
                    'code'          => $code,
                    'redirect_uri'  => $this->redirectUri,
                    'code_verifier' => $codeVerifier,
                ],
            ]);
        } catch (RequestException $e) {
            $message = 'Token exchange failed';
            if ($e->hasResponse()) {
                $response   = $e->getResponse();
                $statusCode = $response->getStatusCode();
                $body       = $response->getBody()->getContents();
                $message    = "Token exchange failed (HTTP {$statusCode}): {$body}";
            } else {
                $message = 'Token exchange failed: ' . $e->getMessage();
            }
            throw new \RuntimeException($message, 0, $e);
        }

        $body   = $response->getBody()->getContents();
        $tokens = json_decode($body, true);
        if (!is_array($tokens)) {
            throw new \RuntimeException('Invalid token response from authorization server');
        }

        // Validate ID token nonce
        if (isset($tokens['id_token'])) {
            $this->validateIdToken($tokens['id_token']);
        }

        // Clean up session
        unset(
            $_SESSION[self::SESSION_CODE_VERIFIER],
            $_SESSION[self::SESSION_STATE],
            $_SESSION[self::SESSION_NONCE]
        );

        return $tokens;
    }

    /**
     * Refresh access token using refresh token.
     *
     * @param string $refreshToken Refresh token
     * @return array<string, mixed> New token response
     * @throws \RuntimeException If refresh fails
     */
    public function refreshToken(string $refreshToken): array
    {
        $tokenEndpoint = $this->getTokenEndpoint();

        $serverBase = $this->getServerBaseUrl();
        $client     = new Client(['connect_timeout' => 2, 'timeout' => 10]);
        try {
            $response = $client->post($tokenEndpoint, [
                'headers'     => $serverBase['headers'],
                'form_params' => [
                    'grant_type'    => 'refresh_token',
                    'client_id'     => $this->clientId,
                    'refresh_token' => $refreshToken,
                ],
            ]);
        } catch (RequestException $e) {
            $message = 'Token refresh failed';
            if ($e->hasResponse()) {
                $response   = $e->getResponse();
                $statusCode = $response->getStatusCode();
                $body       = $response->getBody()->getContents();
                $message    = "Token refresh failed (HTTP {$statusCode}): {$body}";
            } else {
                $message = 'Token refresh failed: ' . $e->getMessage();
            }
            throw new \RuntimeException($message, 0, $e);
        }

        $body   = $response->getBody()->getContents();
        $tokens = json_decode($body, true);
        if (!is_array($tokens)) {
            throw new \RuntimeException('Invalid token response from authorization server');
        }

        return $tokens;
    }

    /**
     * Get end session (logout) URL.
     *
     * @param string|null $idTokenHint ID token for logout
     * @param string|null $postLogoutRedirectUri Where to redirect after logout
     * @return string Logout URL
     */
    public function getLogoutUrl(?string $idTokenHint = null, ?string $postLogoutRedirectUri = null): string
    {
        $endSessionEndpoint = $this->getEndSessionEndpoint();

        // Always include client_id for proper session identification
        $params = [
            'client_id' => $this->clientId,
        ];

        if ($idTokenHint !== null) {
            $params['id_token_hint'] = $idTokenHint;
        }

        if ($postLogoutRedirectUri !== null) {
            $params['post_logout_redirect_uri'] = $postLogoutRedirectUri;
        }

        return $endSessionEndpoint . '?' . http_build_query($params);
    }

    /**
     * Validate an ID token.
     *
     * @param string $idToken ID token to validate
     * @return object Decoded token payload
     * @throws \RuntimeException If validation fails
     */
    public function validateIdToken(string $idToken): object
    {
        $keySet  = $this->getJwks();
        $payload = JWT::decode($idToken, $keySet);

        // Validate issuer
        if (!isset($payload->iss) || $payload->iss !== $this->issuer) {
            throw new \RuntimeException('Invalid ID token issuer');
        }

        // Validate audience
        $aud = $payload->aud ?? null;
        if (is_string($aud) && $aud !== $this->clientId) {
            throw new \RuntimeException('Invalid ID token audience');
        } elseif (is_array($aud) && !in_array($this->clientId, $aud, true)) {
            throw new \RuntimeException('Invalid ID token audience');
        }

        // Validate nonce if in session
        $storedNonce = $_SESSION[self::SESSION_NONCE] ?? null;
        if ($storedNonce !== null) {
            // If we have a stored nonce, the token must have a matching nonce
            if (!isset($payload->nonce)) {
                throw new \RuntimeException('Invalid ID token nonce');
            }
            if (!hash_equals($storedNonce, $payload->nonce)) {
                throw new \RuntimeException('Invalid ID token nonce');
            }
        }

        return $payload;
    }

    /**
     * Validate any token (ID token or access token) with flexible audience checking.
     *
     * Unlike validateIdToken(), this method accepts additional valid audiences
     * and returns null on failure instead of throwing exceptions.
     *
     * @param string $token Token to validate
     * @param array<string> $additionalAudiences Additional valid audience values (e.g., project ID)
     * @return object|null Decoded payload or null on validation failure
     */
    public function validateToken(string $token, array $additionalAudiences = []): ?object
    {
        try {
            $keySet  = $this->getJwks();
            $payload = JWT::decode($token, $keySet);

            // Validate issuer
            if (!isset($payload->iss) || $payload->iss !== $this->issuer) {
                return null;
            }

            // Validate audience (clientId or any additional audience)
            $validAudiences = array_merge([$this->clientId], $additionalAudiences);
            $aud            = $payload->aud ?? null;

            if (is_string($aud)) {
                if (!in_array($aud, $validAudiences, true)) {
                    return null;
                }
            } elseif (is_array($aud)) {
                if (empty(array_intersect($aud, $validAudiences))) {
                    return null;
                }
            }

            return $payload;
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Get user info from access token.
     *
     * @param string $accessToken Access token
     * @return array<string, mixed> User info
     */
    public function getUserInfo(string $accessToken): array
    {
        $userinfoEndpoint = $this->getUserinfoEndpoint();

        $serverBase = $this->getServerBaseUrl();
        $client     = new Client(['connect_timeout' => 2, 'timeout' => 10]);
        try {
            $response = $client->get($userinfoEndpoint, [
                'headers' => array_merge($serverBase['headers'], [
                    'Authorization' => 'Bearer ' . $accessToken,
                ]),
            ]);
        } catch (RequestException $e) {
            $message = 'Failed to fetch user info';
            if ($e->hasResponse()) {
                $response   = $e->getResponse();
                $statusCode = $response->getStatusCode();
                $body       = $response->getBody()->getContents();
                $message    = "Failed to fetch user info (HTTP {$statusCode}): {$body}";
            } else {
                $message = 'Failed to fetch user info: ' . $e->getMessage();
            }
            throw new \RuntimeException($message, 0, $e);
        }

        $body     = $response->getBody()->getContents();
        $userInfo = json_decode($body, true);
        if (!is_array($userInfo)) {
            throw new \RuntimeException('Invalid user info response from authorization server');
        }

        return $userInfo;
    }

    /**
     * Extract user info from ID token payload.
     *
     * @param object $payload Decoded ID token payload
     * @return array<string, mixed> User info array
     */
    public function extractUserFromIdToken(object $payload): array
    {
        $user = [
            'sub'                => $payload->sub ?? null,
            'email'              => $payload->email ?? null,
            'email_verified'     => $payload->email_verified ?? false,
            'name'               => $payload->name ?? null,
            'given_name'         => $payload->given_name ?? null,
            'family_name'        => $payload->family_name ?? null,
            'preferred_username' => $payload->preferred_username ?? null,
        ];

        $user['roles'] = $this->extractRolesFromToken($payload);

        return $user;
    }

    /**
     * Extract Zitadel project roles from a validated token payload.
     *
     * Reads both the generic `urn:zitadel:iam:org:project:roles` claim and the
     * project-specific `urn:zitadel:iam:org:project:{projectId}:roles` claim.
     *
     * Depending on the Zitadel configuration ("User roles inside ID Token" application
     * setting vs "Assert roles on authentication" project setting), roles may be asserted
     * into the ID token, the access token, or both. Callers should therefore union the
     * result of this method across every available token so a single configuration toggle
     * cannot silently leave a user with no roles.
     *
     * @param object $payload Decoded token payload (ID token or access token)
     * @return array<int, string> Role keys, or empty array if none are present
     */
    public function extractRolesFromToken(object $payload): array
    {
        $roles    = [];
        $rolesKey = 'urn:zitadel:iam:org:project:roles';
        if (isset($payload->{$rolesKey}) && is_object($payload->{$rolesKey})) {
            $roles = array_keys((array) $payload->{$rolesKey});
        }
        // Also check the project-specific roles claim
        $projectId = $_ENV['ZITADEL_PROJECT_ID'] ?? getenv('ZITADEL_PROJECT_ID') ?: null;
        if ($projectId !== null) {
            $projectRolesKey = "urn:zitadel:iam:org:project:{$projectId}:roles";
            if (isset($payload->{$projectRolesKey}) && is_object($payload->{$projectRolesKey})) {
                $roles = array_merge($roles, array_keys((array) $payload->{$projectRolesKey}));
            }
        }

        // array_keys on a cast object yields claim names (strings); normalize to a unique list.
        return array_values(array_unique(array_map('strval', $roles)));
    }

    /**
     * Extract expiry timestamp from ID token's exp claim.
     *
     * Parses the JWT payload without validation to extract the expiry time.
     * Falls back to the provided default expiry if parsing fails.
     *
     * @param string $idToken The ID token
     * @param int $fallbackExpiry Fallback expiry timestamp if extraction fails
     * @return int Expiry timestamp
     */
    public static function getIdTokenExpiry(string $idToken, int $fallbackExpiry): int
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            return $fallbackExpiry;
        }

        $payload = json_decode(
            base64_decode(strtr($parts[1], '-_', '+/')),
            true
        );

        return is_array($payload) && isset($payload['exp'])
            ? (int) $payload['exp']
            : $fallbackExpiry;
    }

    /**
     * Get the base URL for server-side HTTP requests to Zitadel.
     * Uses the internal URL if configured (for Docker), otherwise falls back to the public issuer.
     * When using an internal URL, requests include a Host header matching the public issuer
     * so that Zitadel's domain validation succeeds.
     *
     * @return array{url: string, headers: array<string, string>}
     */
    private function getServerBaseUrl(): array
    {
        if ($this->internalUrl !== null) {
            $parsedIssuer = parse_url($this->issuer);
            $host         = $parsedIssuer['host'] ?? 'localhost';
            if (isset($parsedIssuer['port'])) {
                $host .= ':' . $parsedIssuer['port'];
            }
            return [
                'url'     => $this->internalUrl,
                'headers' => ['Host' => $host],
            ];
        }
        return [
            'url'     => $this->issuer,
            'headers' => [],
        ];
    }

    /**
     * Rewrite an endpoint URL for server-side access.
     * When an internal URL is configured, replaces the issuer base with the internal URL
     * so that server-side requests route through the Docker network.
     *
     * @param string $endpointUrl The endpoint URL from the discovery document
     * @return string The rewritten URL (or original if no internal URL configured)
     */
    private function rewriteEndpoint(string $endpointUrl): string
    {
        if ($this->internalUrl !== null && str_starts_with($endpointUrl, $this->issuer)) {
            return $this->internalUrl . substr($endpointUrl, strlen($this->issuer));
        }
        return $endpointUrl;
    }

    /**
     * Get OIDC discovery document.
     *
     * Uses filesystem cache to reduce external calls and latency.
     *
     * @return array<string, mixed> Discovery document
     */
    public function getDiscoveryDocument(): array
    {
        // Return in-memory cache if available
        if ($this->discoveryDoc !== null) {
            return $this->discoveryDoc;
        }

        // Use filesystem cache
        $cacheDir = dirname(__DIR__) . '/cache';
        $cache    = new FilesystemAdapter('oidc_discovery', 3600, $cacheDir);
        $cacheKey = 'discovery_' . md5($this->issuer);

        $cacheItem = $cache->getItem($cacheKey);
        if ($cacheItem->isHit()) {
            $cached = $cacheItem->get();
            if (is_array($cached)) {
                $this->discoveryDoc = $cached;
                return $this->discoveryDoc;
            }
        }

        // Fetch from issuer (using internal URL if configured)
        $serverBase = $this->getServerBaseUrl();
        $client     = new Client(['connect_timeout' => 2, 'timeout' => 10]);
        try {
            $response = $client->get($serverBase['url'] . '/.well-known/openid-configuration', [
                'headers' => $serverBase['headers'],
            ]);
        } catch (RequestException $e) {
            $message = 'Failed to fetch OIDC discovery document';
            if ($e->hasResponse()) {
                $response   = $e->getResponse();
                $statusCode = $response->getStatusCode();
                $message    = "Failed to fetch OIDC discovery document (HTTP {$statusCode})";
            } else {
                $message = 'Failed to fetch OIDC discovery document: ' . $e->getMessage();
            }
            throw new \RuntimeException($message, 0, $e);
        }

        $body         = $response->getBody()->getContents();
        $discoveryDoc = json_decode($body, true);
        if (!is_array($discoveryDoc)) {
            throw new \RuntimeException('Invalid discovery document from authorization server');
        }

        // Store in filesystem cache
        $cacheItem->set($discoveryDoc);
        $cacheItem->expiresAfter(3600);
        $cache->save($cacheItem);

        $this->discoveryDoc = $discoveryDoc;

        return $this->discoveryDoc;
    }

    /**
     * Get authorization endpoint from discovery document.
     *
     * @return string Authorization endpoint URL
     */
    public function getAuthorizationEndpoint(): string
    {
        $doc = $this->getDiscoveryDocument();
        return $doc['authorization_endpoint'] ?? $this->issuer . '/oauth/v2/authorize';
    }

    /**
     * Get token endpoint from discovery document.
     *
     * @return string Token endpoint URL
     */
    public function getTokenEndpoint(): string
    {
        $doc      = $this->getDiscoveryDocument();
        $endpoint = $doc['token_endpoint'] ?? $this->issuer . '/oauth/v2/token';
        return $this->rewriteEndpoint($endpoint);
    }

    /**
     * Get userinfo endpoint from discovery document.
     *
     * @return string Userinfo endpoint URL
     */
    public function getUserinfoEndpoint(): string
    {
        $doc      = $this->getDiscoveryDocument();
        $endpoint = $doc['userinfo_endpoint'] ?? $this->issuer . '/oidc/v1/userinfo';
        return $this->rewriteEndpoint($endpoint);
    }

    /**
     * Get end session endpoint from discovery document.
     *
     * @return string End session endpoint URL
     */
    public function getEndSessionEndpoint(): string
    {
        $doc = $this->getDiscoveryDocument();
        return $doc['end_session_endpoint'] ?? $this->issuer . '/oidc/v1/end_session';
    }

    /**
     * Get JWKS for token validation.
     *
     * @return CachedKeySet JWKS key set
     */
    private function getJwks(): CachedKeySet
    {
        $doc     = $this->getDiscoveryDocument();
        $jwksUri = $doc['jwks_uri'] ?? $this->issuer . '/oauth/v2/keys';
        $jwksUri = $this->rewriteEndpoint($jwksUri);

        $serverBase = $this->getServerBaseUrl();
        if (!empty($serverBase['headers'])) {
            // CachedKeySet uses PSR-18 sendRequest() which doesn't apply Guzzle's
            // default headers. Use middleware to inject the Host header on every request.
            $hostHeader = $serverBase['headers']['Host'];
            $stack      = HandlerStack::create();
            $stack->push(Middleware::mapRequest(function (RequestInterface $request) use ($hostHeader) {
                return $request->withHeader('Host', $hostHeader);
            }));
            $httpClient = new Client(['handler' => $stack, 'connect_timeout' => 2, 'timeout' => 10]);
        } else {
            $httpClient = new Client(['connect_timeout' => 2, 'timeout' => 10]);
        }
        $httpFactory = new HttpFactory();

        // Use filesystem cache for JWKS
        $cacheDir = dirname(__DIR__) . '/cache';
        $cache    = new FilesystemAdapter('jwks', 3600, $cacheDir);

        return new CachedKeySet(
            $jwksUri,
            $httpClient,
            $httpFactory,
            $cache,
            3600,  // Cache TTL
            true   // Rate limit
        );
    }

    /**
     * Generate PKCE code verifier.
     *
     * @return string Code verifier (43-128 characters)
     */
    private function generateCodeVerifier(): string
    {
        // Generate 32 bytes = 43-character base64url string
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    /**
     * Generate PKCE code challenge from verifier.
     *
     * @param string $verifier Code verifier
     * @return string Code challenge (S256 method)
     */
    private function generateCodeChallenge(string $verifier): string
    {
        $hash = hash('sha256', $verifier, true);
        return rtrim(strtr(base64_encode($hash), '+/', '-_'), '=');
    }

    /**
     * Ensure session is started.
     */
    private function ensureSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    /**
     * Get the issuer URL.
     *
     * @return string Issuer URL
     */
    public function getIssuer(): string
    {
        return $this->issuer;
    }

    /**
     * Get the client ID.
     *
     * @return string Client ID
     */
    public function getClientId(): string
    {
        return $this->clientId;
    }
}
