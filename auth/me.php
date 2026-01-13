<?php

/**
 * Current User Info Endpoint
 *
 * Returns information about the currently authenticated user.
 * Used by JavaScript to check authentication state.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;
use Firebase\JWT\JWT;
use Firebase\JWT\CachedKeySet;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\HttpFactory;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

// Set JSON response headers
header('Content-Type: application/json');

/**
 * Send JSON response and exit.
 *
 * @param array $data Response data
 * @param int $statusCode HTTP status code
 */
function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

// Check for access token
$accessToken = $_COOKIE['litcal_access_token'] ?? null;

if ($accessToken === null) {
    jsonResponse(['authenticated' => false]);
}

// Validate access token
try {
    if (!OidcClient::isConfigured()) {
        // If OIDC is not configured, we can't validate the token
        // This shouldn't happen in practice if user has a token
        jsonResponse([
            'authenticated' => false,
            'error'         => 'OIDC not configured',
        ]);
    }

    $issuer   = $_ENV['ZITADEL_ISSUER'] ?? getenv('ZITADEL_ISSUER') ?: '';
    $clientId = $_ENV['ZITADEL_CLIENT_ID'] ?? getenv('ZITADEL_CLIENT_ID') ?: '';

    // Fetch JWKS
    $jwksUri     = rtrim($issuer, '/') . '/oauth/v2/keys';
    $httpClient  = new Client();
    $httpFactory = new HttpFactory();

    $keySet = new CachedKeySet(
        $jwksUri,
        $httpClient,
        $httpFactory,
        null,
        3600,
        true
    );

    // Decode and validate token
    $payload = JWT::decode($accessToken, $keySet);

    // Validate issuer
    if (!isset($payload->iss) || $payload->iss !== $issuer) {
        jsonResponse([
            'authenticated' => false,
            'error'         => 'Invalid token issuer',
        ]);
    }

    // Validate audience
    $aud = $payload->aud ?? null;
    if (is_string($aud) && $aud !== $clientId) {
        jsonResponse([
            'authenticated' => false,
            'error'         => 'Invalid token audience',
        ]);
    } elseif (is_array($aud) && !in_array($clientId, $aud, true)) {
        jsonResponse([
            'authenticated' => false,
            'error'         => 'Invalid token audience',
        ]);
    }

    // Extract user info
    $user = [
        'sub'                => $payload->sub ?? null,
        'email'              => $payload->email ?? null,
        'email_verified'     => $payload->email_verified ?? false,
        'name'               => $payload->name ?? null,
        'given_name'         => $payload->given_name ?? null,
        'family_name'        => $payload->family_name ?? null,
        'preferred_username' => $payload->preferred_username ?? null,
    ];

    // Extract roles
    $rolesKey = 'urn:zitadel:iam:org:project:roles';
    if (isset($payload->{$rolesKey})) {
        $rolesData     = (array) $payload->{$rolesKey};
        $user['roles'] = array_keys($rolesData);
    } else {
        $user['roles'] = [];
    }

    // Check token expiry
    $exp = $payload->exp ?? 0;

    jsonResponse([
        'authenticated'   => true,
        'user'            => $user,
        'expires_at'      => $exp,
        'token_remaining' => max(0, $exp - time()),
    ]);
} catch (Firebase\JWT\ExpiredException $e) {
    // Token expired - could try refresh here
    jsonResponse([
        'authenticated'  => false,
        'error'          => 'Token expired',
        'should_refresh' => true,
    ]);
} catch (Exception $e) {
    error_log('Auth/me error: ' . $e->getMessage());
    jsonResponse([
        'authenticated' => false,
        'error'         => 'Token validation failed',
    ]);
}
