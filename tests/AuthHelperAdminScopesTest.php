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

    /**
     * Unauthenticated short-circuit: loadAdminScopes() must return the fail-closed
     * default WITHOUT ever calling the API when !$this->isAuthenticated, and the
     * result must be memoized (a second call must not refetch).
     *
     * NOTE: We cannot assert programmatically that *no* HTTP call was made —
     * fetchAdminScopes() catches all Throwables and fails closed, so even if the
     * short-circuit were accidentally removed and a Guzzle request were attempted,
     * the assertion values would still be the same. The structural guarantee is in
     * the code: loadAdminScopes() returns before reaching fetchAdminScopes() when
     * isAuthenticated is false (lines 346-347 of AuthHelper.php).
     */
    public function testUnauthenticatedShortCircuitFailsClosed(): void
    {
        // Start from a clean singleton state.
        AuthHelper::reset();

        // Stash and clear any env vars that could trigger OIDC or legacy auth.
        // Without ZITADEL_ISSUER/CLIENT_ID, getInstance() skips tryValidateOidcToken().
        // Without JWT_SECRET (≥32 chars), tryValidateFromCookie() returns null immediately.
        $envSaved = $this->stashAndClearEnv(['ZITADEL_ISSUER', 'ZITADEL_CLIENT_ID', 'JWT_SECRET']);

        // Stash and clear any auth cookies (belt-and-suspenders: with JWT_SECRET absent
        // tryValidateFromCookie() already short-circuits before reading $_COOKIE, but we
        // clear cookies anyway to make the test self-contained).
        $cookieSaved = [];
        foreach (['litcal_access_token', 'litcal_id_token'] as $name) {
            $cookieSaved[$name] = $_COOKIE[$name] ?? null;
            unset($_COOKIE[$name]);
        }

        try {
            $auth = AuthHelper::getInstance();

            // Precondition: the instance must be unauthenticated.
            self::assertFalse($auth->isAuthenticated, 'Precondition: instance must be unauthenticated');

            // The unauthenticated short-circuit must fail closed.
            self::assertFalse($auth->isResourceAdmin());
            self::assertSame([], $auth->adminScopes());

            // Memoization: a second call must return the cached result.
            self::assertFalse($auth->isResourceAdmin(), 'Memoized second call must still return false');
            self::assertSame([], $auth->adminScopes(), 'Memoized second call must still return []');
        } finally {
            $this->restoreEnv($envSaved);

            foreach ($cookieSaved as $name => $val) {
                if ($val !== null) {
                    $_COOKIE[$name] = $val;
                }
            }

            // Always reset the singleton so subsequent tests start clean.
            AuthHelper::reset();
        }
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
