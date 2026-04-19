<?php

/**
 * Current User Info Endpoint
 *
 * Returns information about the currently authenticated user.
 * Used by JavaScript to check authentication state.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

// Set JSON response headers
header('Content-Type: application/json');

/**
 * Send JSON response and exit.
 *
 * @param array<string, mixed> $data Response data
 * @param int $statusCode HTTP status code
 * @throws \JsonException If JSON encoding fails
 */
function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}

// Check for access token (proves user is authenticated)
$accessToken = $_COOKIE['litcal_access_token'] ?? null;

if ($accessToken === null) {
    jsonResponse(['authenticated' => false]);
}

// Get ID token for user profile information
// ID token contains full user claims (preferred_username, email, name, etc.)
// Access token typically only has minimal claims (sub)
$idToken = $_COOKIE['litcal_id_token'] ?? null;

// Use ID token if available, fall back to access token
$tokenToValidate = $idToken ?? $accessToken;

// Validate access token
try {
    if (!OidcClient::isConfigured()) {
        jsonResponse([
            'authenticated' => false,
            'error'         => 'OIDC not configured',
        ]);
    }

    $oidcClient = OidcClient::fromEnv();
    $projectId  = $_ENV['ZITADEL_PROJECT_ID'] ?? getenv('ZITADEL_PROJECT_ID') ?: null;
    $additionalAudiences = $projectId !== null ? [$projectId] : [];

    // Validate token using OidcClient (handles internal URL routing for Docker)
    $payload = $oidcClient->validateToken($tokenToValidate, $additionalAudiences);
    if ($payload === null) {
        jsonResponse([
            'authenticated' => false,
            'error'         => 'Token validation failed',
        ]);
    }

    // Extract user info using OidcClient
    $user = $oidcClient->extractUserFromIdToken($payload);

    // Check token expiry
    $exp = $payload->exp ?? 0;

    jsonResponse([
        'authenticated'   => true,
        'user'            => $user,
        'expires_at'      => $exp,
        'token_remaining' => max(0, $exp - time()),
    ]);
} catch (Exception $e) {
    error_log('Auth/me error: ' . $e->getMessage());
    jsonResponse([
        'authenticated' => false,
        'error'         => 'Token validation failed',
    ]);
}
