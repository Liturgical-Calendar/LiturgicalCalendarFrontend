<?php

/**
 * Current User Info Endpoint
 *
 * Returns information about the currently authenticated user.
 * Used by JavaScript to check authentication state.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\AuthHelper;
use LiturgicalCalendar\Frontend\OidcClient;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.staging', '.env.production', '.env']);
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

// Validate access token as the primary proof of authentication
try {
    // Legacy (pre-Zitadel) deployments: with no OIDC configuration there is no JWKS to
    // validate against, so fall back to the HS256/JWT_SECRET path. This mirrors
    // AuthHelper::getInstance(), whose OIDC branch is gated on the SAME two variables and
    // which falls through to legacy validation when they are absent.
    //
    // Without this the two paths disagree: drop Zitadel and AuthHelper would authenticate
    // the user server-side and render the page, while this endpoint told the client that
    // nobody was logged in — the client/server split diagnosed in issue #448, reached
    // through configuration rather than through token shape.
    //
    // Deliberately NOT a fallback for the case where OIDC IS configured but validation
    // fails. That would let any JWT_SECRET-signed token satisfy a live Zitadel deployment.
    if (!OidcClient::isConfigured()) {
        $auth = AuthHelper::getInstance();

        if (!$auth->isAuthenticated) {
            jsonResponse([
                'authenticated' => false,
                'error'         => 'Token validation failed',
            ]);
        }

        $legacyExp = $auth->exp ?? 0;

        // Same key set as OidcClient::extractUserFromIdToken(), so assets/js/auth.js sees one
        // shape regardless of which validation path produced it. Legacy tokens carry only
        // `sub`, `roles` and `exp`; the OIDC-only profile claims stay null.
        jsonResponse([
            'authenticated'   => true,
            'user'            => [
                'sub'                => $auth->sub,
                'email'              => $auth->email,
                'email_verified'     => $auth->emailVerified,
                'name'               => $auth->name,
                'given_name'         => $auth->givenName,
                'family_name'        => $auth->familyName,
                'preferred_username' => $auth->username,
                'roles'              => $auth->roles ?? [],
            ],
            'expires_at'      => $legacyExp,
            'token_remaining' => max(0, $legacyExp - time()),
        ]);
    }

    $oidcClient          = OidcClient::fromEnv();
    $projectId           = $_ENV['ZITADEL_PROJECT_ID'] ?? getenv('ZITADEL_PROJECT_ID') ?: null;
    $additionalAudiences = $projectId !== null ? [$projectId] : [];

    // Validate access token (handles internal URL routing for Docker)
    $accessPayload = $oidcClient->validateToken($accessToken, $additionalAudiences);
    if ($accessPayload === null) {
        jsonResponse([
            'authenticated' => false,
            'error'         => 'Token validation failed',
        ]);
    }

    // Use ID token for richer profile claims if available, fall back to access token
    $idToken     = $_COOKIE['litcal_id_token'] ?? null;
    $idPayload   = $idToken !== null ? $oidcClient->validateToken($idToken, $additionalAudiences) : null;
    $claimSource = $idPayload ?? $accessPayload;

    // Extract user info from the best available token (ID token preferred for profile claims)
    $user = $oidcClient->extractUserFromIdToken($claimSource);

    // Roles may be asserted into the access token, the ID token, or both, depending on the
    // Zitadel "User roles inside ID Token" / "Assert roles on authentication" settings.
    // Union roles from every available token so a single config toggle (or a token that only
    // carries minimal claims) cannot silently leave the user with no roles.
    $roles = $oidcClient->extractRolesFromToken($accessPayload);
    if ($idPayload !== null) {
        $roles = array_merge($roles, $oidcClient->extractRolesFromToken($idPayload));
    }
    $user['roles'] = array_values(array_unique($roles));

    // Use access token expiry for session timing
    $exp = $accessPayload->exp ?? 0;

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
