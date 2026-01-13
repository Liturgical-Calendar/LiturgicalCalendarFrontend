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
    header('Content-Type: application/json');
    http_response_code(503);
    echo json_encode(['error' => 'OIDC not configured']);
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

    // Get prompt parameter (login, consent, select_account, none)
    // Use 'login' to force re-authentication even if Zitadel session exists
    $prompt       = $_GET['prompt'] ?? null;
    $validPrompts = ['login', 'consent', 'select_account', 'none'];
    if ($prompt !== null && !in_array($prompt, $validPrompts, true)) {
        $prompt = null;
    }

    // Generate authorization URL and redirect
    $authUrl = $oidcClient->getAuthorizationUrl([], $returnTo, $prompt);
    header('Location: ' . $authUrl);
    exit;
} catch (Exception $e) {
    error_log('OIDC login error: ' . $e->getMessage());
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Failed to initialize OIDC client']);
    exit;
}
