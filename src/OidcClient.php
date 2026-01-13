<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend;

use Firebase\JWT\CachedKeySet;
use Firebase\JWT\JWT;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\HttpFactory;
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
     * Cached discovery document.
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
     */
    public function __construct(string $issuer, string $clientId, string $redirectUri)
    {
        $this->issuer      = rtrim($issuer, '/');
        $this->clientId    = $clientId;
        $this->redirectUri = $redirectUri;
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

        return new self($issuer, $clientId, $redirectUri);
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
        $allScopes     = array_unique(array_merge($defaultScopes, $scopes));

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
     * @return array Token response (access_token, id_token, refresh_token)
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

        $client   = new Client();
        $response = $client->post($tokenEndpoint, [
            'form_params' => [
                'grant_type'    => 'authorization_code',
                'client_id'     => $this->clientId,
                'code'          => $code,
                'redirect_uri'  => $this->redirectUri,
                'code_verifier' => $codeVerifier,
            ],
        ]);

        $tokens = json_decode($response->getBody()->getContents(), true);

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
     * @return array New token response
     * @throws \RuntimeException If refresh fails
     */
    public function refreshToken(string $refreshToken): array
    {
        $tokenEndpoint = $this->getTokenEndpoint();

        $client   = new Client();
        $response = $client->post($tokenEndpoint, [
            'form_params' => [
                'grant_type'    => 'refresh_token',
                'client_id'     => $this->clientId,
                'refresh_token' => $refreshToken,
            ],
        ]);

        return json_decode($response->getBody()->getContents(), true);
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
        if ($storedNonce !== null && isset($payload->nonce)) {
            if (!hash_equals($storedNonce, $payload->nonce)) {
                throw new \RuntimeException('Invalid ID token nonce');
            }
        }

        return $payload;
    }

    /**
     * Get user info from access token.
     *
     * @param string $accessToken Access token
     * @return array User info
     */
    public function getUserInfo(string $accessToken): array
    {
        $userinfoEndpoint = $this->getUserinfoEndpoint();

        $client   = new Client();
        $response = $client->get($userinfoEndpoint, [
            'headers' => [
                'Authorization' => 'Bearer ' . $accessToken,
            ],
        ]);

        return json_decode($response->getBody()->getContents(), true);
    }

    /**
     * Extract user info from ID token payload.
     *
     * @param object $payload Decoded ID token payload
     * @return array User info array
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

        // Extract Zitadel roles
        $rolesKey = 'urn:zitadel:iam:org:project:roles';
        if (isset($payload->{$rolesKey})) {
            $rolesData     = (array) $payload->{$rolesKey};
            $user['roles'] = array_keys($rolesData);
        } else {
            $user['roles'] = [];
        }

        return $user;
    }

    /**
     * Get OIDC discovery document.
     *
     * @return array Discovery document
     */
    public function getDiscoveryDocument(): array
    {
        if ($this->discoveryDoc !== null) {
            return $this->discoveryDoc;
        }

        $client   = new Client();
        $response = $client->get($this->issuer . '/.well-known/openid-configuration');

        $this->discoveryDoc = json_decode($response->getBody()->getContents(), true);

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
        $doc = $this->getDiscoveryDocument();
        return $doc['token_endpoint'] ?? $this->issuer . '/oauth/v2/token';
    }

    /**
     * Get userinfo endpoint from discovery document.
     *
     * @return string Userinfo endpoint URL
     */
    public function getUserinfoEndpoint(): string
    {
        $doc = $this->getDiscoveryDocument();
        return $doc['userinfo_endpoint'] ?? $this->issuer . '/oidc/v1/userinfo';
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

        $httpClient  = new Client();
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
