<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\ApiConfig;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(ApiConfig::class)]
final class ApiConfigTest extends TestCase
{
    protected function setUp(): void
    {
        ApiConfig::reset();
    }

    protected function tearDown(): void
    {
        ApiConfig::reset();
    }

    public function testInternalBaseUrlDefaultsToApiBaseUrl(): void
    {
        $config = ApiConfig::getInstance('http://localhost:8000');
        $this->assertSame('http://localhost:8000', $config->apiBaseUrl);
        $this->assertSame('http://localhost:8000', $config->internalBaseUrl);
    }

    public function testBrowserUrlsStayBrowserFacingWhenAnInternalBaseIsSet(): void
    {
        $config = ApiConfig::getInstance('http://localhost:8000', 'http://litcal-api:8000');
        // The *Url properties feed client-side JS and user-facing links, so they
        // must keep the browser-facing host regardless of the internal base.
        $this->assertSame('http://localhost:8000/events', $config->eventsUrl);
        $this->assertSame('http://localhost:8000/decrees', $config->decreesUrl);
        $this->assertSame('http://litcal-api:8000', $config->internalBaseUrl);
    }

    public function testToInternalRebasesABrowserUrlOntoTheInternalBase(): void
    {
        $config = ApiConfig::getInstance('http://localhost:8000', 'http://litcal-api:8000');
        $this->assertSame('http://litcal-api:8000/events', $config->toInternal($config->eventsUrl));
        $this->assertSame('http://litcal-api:8000/calendars', $config->toInternal($config->metadataUrl));
    }

    public function testToInternalIsANoOpWhenNoInternalBaseIsConfigured(): void
    {
        $config = ApiConfig::getInstance('https://litcal.example.com/api/dev');
        $this->assertSame($config->eventsUrl, $config->toInternal($config->eventsUrl));
    }

    public function testToInternalPassesThroughAUrlThatDoesNotStartWithTheBase(): void
    {
        $config = ApiConfig::getInstance('http://localhost:8000', 'http://litcal-api:8000');
        $foreign = 'https://cdn.example.com/asset.js';
        $this->assertSame($foreign, $config->toInternal($foreign));
    }
}
