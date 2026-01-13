<?php

/**
 * OIDC Login Initiator
 *
 * Redirects the user to Zitadel for authentication.
 * Supports a 'return_to' parameter to redirect back after login.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\OidcClient;

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__), ['.env.local', '.env.development', '.env.production', '.env']);
$dotenv->safeLoad();

// Check if OIDC is configured
if (!OidcClient::isConfigured()) {
    header('HTTP/1.1 503 Service Unavailable');
    echo 'OIDC authentication is not configured';
    exit;
}

try {
    $oidcClient = OidcClient::fromEnv();

    // Get return URL from query parameter
    $returnTo = $_GET['return_to'] ?? null;

    // Validate return URL is relative or same origin
    if ($returnTo !== null) {
        $parsed = parse_url($returnTo);
        if (isset($parsed['host'])) {
            // Has a host - check if it's same origin
            $frontendUrl  = $_ENV['FRONTEND_URL'] ?? getenv('FRONTEND_URL') ?: '';
            $frontendHost = parse_url($frontendUrl, PHP_URL_HOST);
            if ($parsed['host'] !== $frontendHost) {
                $returnTo = null; // Reject external URLs
            }
        }
    }

    // Generate authorization URL and redirect
    $authUrl = $oidcClient->getAuthorizationUrl([], $returnTo);
    header('Location: ' . $authUrl);
    exit;
} catch (Exception $e) {
    header('HTTP/1.1 500 Internal Server Error');
    echo 'Failed to initialize OIDC client: ' . htmlspecialchars($e->getMessage());
    exit;
}
