<?php

namespace LiturgicalCalendar\Frontend;

/**
 * API Configuration Class
 *
 * Centralized configuration for API endpoints and base URLs.
 * Replaces global variables for better static analysis and testability.
 */
class ApiConfig
{
    private static ?self $instance = null;

    public readonly string $apiBaseUrl;
    /**
     * Base URL for server-side (PHP) requests. Equal to $apiBaseUrl unless an
     * internal URL is configured (e.g. inside a Docker network, where the
     * browser-facing host 'localhost' is not reachable from the container).
     * The *Url properties below stay browser-facing (they are emitted to JS and
     * to user-facing links); use toInternal() to map one for a server-side call.
     */
    public readonly string $internalBaseUrl;
    public readonly string $dateOfEasterUrl;
    public readonly string $calendarUrl;
    public readonly string $metadataUrl;
    public readonly string $eventsUrl;
    public readonly string $missalsUrl;
    public readonly string $decreesUrl;
    public readonly string $temporaleUrl;
    public readonly string $regionalDataUrl;
    public readonly string $calSubscriptionUrl;

    private function __construct(string $apiBaseUrl, ?string $internalBaseUrl = null)
    {
        $this->apiBaseUrl      = rtrim($apiBaseUrl, '/');
        $this->internalBaseUrl = rtrim($internalBaseUrl ?? $apiBaseUrl, '/');
        $this->dateOfEasterUrl = "{$this->apiBaseUrl}/easter";
        $this->calendarUrl     = "{$this->apiBaseUrl}/calendar";
        $this->metadataUrl     = "{$this->apiBaseUrl}/calendars";
        $this->eventsUrl       = "{$this->apiBaseUrl}/events";
        $this->missalsUrl      = "{$this->apiBaseUrl}/missals";
        $this->decreesUrl      = "{$this->apiBaseUrl}/decrees";
        $this->temporaleUrl    = "{$this->apiBaseUrl}/temporale";
        $this->regionalDataUrl = "{$this->apiBaseUrl}/data";
        // The `roman` rite segment is explicit here on purpose: it must match the
        // rite-explicit URL the JS produces after hydration, so a user who copies
        // the URL before hydration finishes gets the same result as one who copies after.
        $this->calSubscriptionUrl = "{$this->apiBaseUrl}/calendar/roman?return_type=ICS&year_type=CIVIL";
    }

    /**
     * Rewrite a browser-facing endpoint URL (one of the *Url properties, built
     * from $apiBaseUrl) to its internal equivalent for a server-side request.
     * A no-op when no internal URL is configured.
     *
     * @param string $url A URL that begins with $apiBaseUrl.
     * @return string The same URL rebased onto $internalBaseUrl.
     */
    public function toInternal(string $url): string
    {
        if ($this->internalBaseUrl === $this->apiBaseUrl) {
            return $url;
        }
        if (str_starts_with($url, $this->apiBaseUrl)) {
            return $this->internalBaseUrl . substr($url, strlen($this->apiBaseUrl));
        }
        return $url;
    }

    /**
     * Get the singleton instance
     *
     * IMPORTANT: The first non-null $apiBaseUrl provided wins. Subsequent calls
     * with different URLs are silently ignored and return the original instance.
     * This ensures configuration consistency throughout the application lifecycle.
     * To reconfigure, call reset() first (test environments only).
     *
     * @param string|null $apiBaseUrl Base API URL (required on first call)
     * @param string|null $internalBaseUrl Server-side base URL (defaults to $apiBaseUrl)
     * @return self
     * @throws \RuntimeException if called without URL before initialization
     */
    public static function getInstance(?string $apiBaseUrl = null, ?string $internalBaseUrl = null): self
    {
        if (self::$instance === null) {
            if ($apiBaseUrl === null) {
                throw new \RuntimeException(
                    'ApiConfig must be initialized with a base URL on first call'
                );
            }
            self::$instance = new self($apiBaseUrl, $internalBaseUrl);
        }

        return self::$instance;
    }

    /**
     * Reset the singleton instance
     *
     * @internal This method is intended for testing purposes only.
     *           Do NOT use in production code as it will cause configuration
     *           inconsistencies mid-request. Use only in test tearDown/setUp.
     */
    public static function reset(): void
    {
        self::$instance = null;
    }
}
