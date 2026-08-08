<?php

namespace LiturgicalCalendar\Frontend;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\BadResponseException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;

/**
 * HTTP client wrapper for API requests
 *
 * Provides a reusable, consistent interface for making HTTP requests
 * to the Liturgical Calendar API with proper error handling.
 */
class ApiClient
{
    private Client $client;
    private ?string $locale;

    /**
     * Create a new API client instance
     *
     * @param string|null $locale Locale for Accept-Language header
     * @param int $timeout Request timeout in seconds
     * @param int $connectTimeout Connection timeout in seconds
     */
    public function __construct(?string $locale = null, int $timeout = 10, int $connectTimeout = 5)
    {
        $this->locale = $locale;
        $this->client = new Client([
            'timeout'         => $timeout,
            'connect_timeout' => $connectTimeout,
            'http_errors'     => true,
        ]);
    }

    /**
     * Fetch JSON data from an API endpoint
     *
     * @param string $url The URL to fetch
     * @param array<string, string> $headers Additional headers to send
     * @return array<string, mixed> Decoded JSON response
     * @throws \RuntimeException If the request fails or response is invalid
     */
    public function fetchJson(string $url, array $headers = []): array
    {
        $requestHeaders = ['Accept' => 'application/json'];

        if ($this->locale !== null) {
            $requestHeaders['Accept-Language'] = $this->locale;
        }

        $requestHeaders = array_merge($requestHeaders, $headers);

        try {
            $response = $this->client->get($url, ['headers' => $requestHeaders]);

            $body = (string) $response->getBody();

            $data = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \RuntimeException(
                    'Error decoding JSON from ' . $url . ': ' . json_last_error_msg()
                );
            }

            if (!is_array($data)) {
                throw new \RuntimeException(
                    'Invalid JSON response from ' . $url . ': expected array'
                );
            }

            return $data;
        // BadResponseException covers the "server answered, but with 4xx/5xx" case and
        // is the only RequestException subclass that carries a response. Guzzle 8
        // removed hasResponse()/getResponse() from RequestException itself, so the two
        // cases are split rather than branched on. BadResponseException extends
        // RequestException, so it must be caught first. This shape works on Guzzle 7
        // and 8 alike.
        } catch (BadResponseException $e) {
            $response   = $e->getResponse();
            $statusCode = $response->getStatusCode();

            // Build a safe, sanitized error message without leaking sensitive response data
            $safeMessage = 'HTTP request failed for ' . $url . ' (status ' . $statusCode . ')';

            $responseBody = (string) $response->getBody();

            // Log full response body for debugging (capped at 2KB to prevent log flooding)
            $logBody = strlen($responseBody) > 2048
                ? substr($responseBody, 0, 2048) . '... [truncated]'
                : $responseBody;
            error_log('ApiClient error response from ' . $url . ': ' . $logBody);

            // Create sanitized preview for exception message
            // Strip HTML tags and collapse whitespace
            $preview = strip_tags($responseBody);
            $preview = preg_replace('/\s+/', ' ', $preview);
            $preview = trim($preview ?? '');

            // Truncate to ~200 chars
            if (strlen($preview) > 200) {
                $preview = substr($preview, 0, 197) . '...';
            }

            if ($preview !== '') {
                $safeMessage .= ': ' . $preview;
            }

            throw new \RuntimeException($safeMessage, $statusCode, $e);
        } catch (RequestException $e) {
            // No response was ever received (DNS, connect, TLS, timeout). Status 0
            // preserves what hasResponse() === false previously reported.
            throw new \RuntimeException(
                'HTTP request failed for ' . $url . ' (status 0): ' . $e->getMessage(),
                0,
                $e
            );
        } catch (GuzzleException $e) {
            throw new \RuntimeException(
                'HTTP request failed for ' . $url . ': ' . $e->getMessage(),
                0,
                $e
            );
        }
    }

    /**
     * Fetch JSON data and validate a required key exists
     *
     * @param string $url The URL to fetch
     * @param string $requiredKey The key that must exist in the response
     * @param array<string, string> $headers Additional headers to send
     * @return array<string, mixed> Decoded JSON response
     * @throws \RuntimeException If the request fails, response is invalid, or key is missing
     */
    public function fetchJsonWithKey(string $url, string $requiredKey, array $headers = []): array
    {
        $data = $this->fetchJson($url, $headers);

        if (!array_key_exists($requiredKey, $data)) {
            throw new \RuntimeException(
                'Missing required key "' . $requiredKey . '" in response from ' . $url
            );
        }

        return $data;
    }

    /**
     * Set the locale for Accept-Language header
     *
     * @param string|null $locale The locale to use
     * @return self
     */
    public function setLocale(?string $locale): self
    {
        $this->locale = $locale;
        return $this;
    }
}
