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
final class AuthHelperDashboardScopesTest extends TestCase
{
    private function clientWith(Response ...$responses): Client
    {
        return new Client(['handler' => HandlerStack::create(new MockHandler($responses))]);
    }

    /**
     * Clear a set of env vars from both $_ENV and the process environment,
     * returning the previous values so they can be restored.
     *
     * @param list<string> $keys
     * @return array<string, array{env: string|null, proc: string|false}>
     */
    private function stashAndClearEnv(array $keys): array
    {
        $saved = [];
        foreach ($keys as $k) {
            $saved[$k] = ['env' => $_ENV[$k] ?? null, 'proc' => getenv($k)];
            unset($_ENV[$k]);
            putenv($k); // no '=value' → removes the variable from the process environment
        }
        return $saved;
    }

    /**
     * @param array<string, array{env: string|null, proc: string|false}> $saved
     */
    private function restoreEnv(array $saved): void
    {
        foreach ($saved as $k => $v) {
            if ($v['env'] !== null) {
                $_ENV[$k] = $v['env'];
            }
            if ($v['proc'] !== false) {
                putenv("{$k}={$v['proc']}");
            }
        }
    }

    public function testFetchDashboardScopesParsesFullResponse(): void
    {
        $client = $this->clientWith(new Response(200, [], json_encode([
            'is_global_admin'   => false,
            'is_resource_admin' => true,
            'admin_scopes'      => [
                ['object_type' => 'national_calendar', 'object_id' => 'IT'],
            ],
            'viewer_scopes'     => [
                'general_roman_calendar'      => ['temporale', 'decrees'],
                'national_calendar_test'      => ['IT'],
                'diocesan_calendar_test'      => [],
                'general_roman_calendar_test' => [],
            ],
        ])));

        $result = AuthHelper::fetchDashboardScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertFalse($result['is_global_admin']);
        self::assertTrue($result['is_resource_admin']);
        self::assertSame(
            [['object_type' => 'national_calendar', 'object_id' => 'IT']],
            $result['admin_scopes']
        );
        self::assertSame(['temporale', 'decrees'], $result['viewer_scopes']['general_roman_calendar']);
        self::assertSame(['IT'], $result['viewer_scopes']['national_calendar_test']);
    }

    public function testFetchDashboardScopesFailsClosedOnHttpError(): void
    {
        $client = $this->clientWith(new Response(401, [], 'Unauthorized'));

        $result = AuthHelper::fetchDashboardScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertFalse($result['is_global_admin']);
        self::assertFalse($result['is_resource_admin']);
        self::assertSame([], $result['admin_scopes']);
        self::assertSame([], $result['viewer_scopes']);
    }

    public function testFetchDashboardScopesFiltersMalformedViewerScopes(): void
    {
        $client = $this->clientWith(new Response(200, [], json_encode([
            'is_global_admin'   => false,
            'is_resource_admin' => false,
            'admin_scopes'      => [],
            'viewer_scopes'     => [
                'general_roman_calendar' => ['temporale', 42, null],
                'bogus_non_list'         => 'not-an-array',
            ],
        ])));

        $result = AuthHelper::fetchDashboardScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertSame(['temporale'], $result['viewer_scopes']['general_roman_calendar']);
        self::assertArrayNotHasKey('bogus_non_list', $result['viewer_scopes']);
    }

    public function testUnauthenticatedInstanceFailsClosedAndMemoizes(): void
    {
        AuthHelper::reset();
        $envSaved = $this->stashAndClearEnv(['ZITADEL_ISSUER', 'ZITADEL_CLIENT_ID', 'JWT_SECRET']);

        $cookieSaved = [];
        foreach (['litcal_access_token', 'litcal_id_token'] as $name) {
            $cookieSaved[$name] = $_COOKIE[$name] ?? null;
            unset($_COOKIE[$name]);
        }

        try {
            $auth = AuthHelper::getInstance();
            self::assertFalse($auth->isAuthenticated, 'Precondition: instance must be unauthenticated');

            self::assertFalse($auth->dashboardScopes()['is_resource_admin']);
            self::assertSame([], $auth->dashboardScopes()['viewer_scopes']);
            self::assertFalse($auth->canViewResource('general_roman_calendar', 'decrees'));
            self::assertFalse($auth->canViewAnyResourceOfType('national_calendar_test', 'diocesan_calendar_test'));
        } finally {
            $this->restoreEnv($envSaved);
            foreach ($cookieSaved as $name => $val) {
                if ($val !== null) {
                    $_COOKIE[$name] = $val;
                }
            }
            AuthHelper::reset();
        }
    }
}
