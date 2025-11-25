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
    public readonly string $dateOfEasterUrl;
    public readonly string $calendarUrl;
    public readonly string $metadataUrl;
    public readonly string $eventsUrl;
    public readonly string $missalsUrl;
    public readonly string $decreesUrl;
    public readonly string $regionalDataUrl;
    public readonly string $calSubscriptionUrl;

    private function __construct(string $apiBaseUrl)
    {
        $this->apiBaseUrl         = rtrim($apiBaseUrl, '/');
        $this->dateOfEasterUrl    = "{$this->apiBaseUrl}/easter";
        $this->calendarUrl        = "{$this->apiBaseUrl}/calendar";
        $this->metadataUrl        = "{$this->apiBaseUrl}/calendars";
        $this->eventsUrl          = "{$this->apiBaseUrl}/events";
        $this->missalsUrl         = "{$this->apiBaseUrl}/missals";
        $this->decreesUrl         = "{$this->apiBaseUrl}/decrees";
        $this->regionalDataUrl    = "{$this->apiBaseUrl}/data";
        $this->calSubscriptionUrl = "{$this->apiBaseUrl}/calendar?returntype=ICS";
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
     * @return self
     * @throws \RuntimeException if called without URL before initialization
     */
    public static function getInstance(?string $apiBaseUrl = null): self
    {
        if (self::$instance === null) {
            if ($apiBaseUrl === null) {
                throw new \RuntimeException(
                    'ApiConfig must be initialized with a base URL on first call'
                );
            }
            self::$instance = new self($apiBaseUrl);
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
