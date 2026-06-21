<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use LiturgicalCalendar\Frontend\AuthHelper;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(AuthHelper::class)]
final class AuthHelperAdminScopesTest extends TestCase
{
    private function clientWith(Response ...$responses): Client
    {
        return new Client(['handler' => HandlerStack::create(new MockHandler($responses))]);
    }

    public function testFetchAdminScopesParsesResourceAdminResponse(): void
    {
        $client = $this->clientWith(new Response(200, [], json_encode([
            'is_global_admin'   => false,
            'is_resource_admin' => true,
            'admin_scopes'      => [
                ['object_type' => 'national_calendar', 'object_id' => 'IT'],
            ],
        ])));

        $result = AuthHelper::fetchAdminScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertTrue($result['is_resource_admin']);
        self::assertSame(
            [['object_type' => 'national_calendar', 'object_id' => 'IT']],
            $result['admin_scopes']
        );
    }

    public function testFetchAdminScopesFailsClosedOnHttpError(): void
    {
        $client = $this->clientWith(new Response(401, [], 'Unauthorized'));

        $result = AuthHelper::fetchAdminScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertFalse($result['is_resource_admin']);
        self::assertSame([], $result['admin_scopes']);
    }

    public function testFetchAdminScopesFailsClosedOnMalformedJson(): void
    {
        $client = $this->clientWith(new Response(200, [], 'not json'));

        $result = AuthHelper::fetchAdminScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertFalse($result['is_resource_admin']);
        self::assertSame([], $result['admin_scopes']);
    }
}
