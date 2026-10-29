<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use LiturgicalCalendar\Frontend\AuthHelper;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionProperty;

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
                'rite_calendar'          => ['roman/temporale', 'roman/decrees'],
                'national_calendar_test' => ['IT'],
                'diocesan_calendar_test' => [],
                'rite_calendar_test'     => [],
            ],
        ])));

        $result = AuthHelper::fetchDashboardScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertFalse($result['is_global_admin']);
        self::assertTrue($result['is_resource_admin']);
        self::assertSame(
            [['object_type' => 'national_calendar', 'object_id' => 'IT']],
            $result['admin_scopes']
        );
        self::assertSame(['roman/temporale', 'roman/decrees'], $result['viewer_scopes']['rite_calendar']);
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
                'rite_calendar'  => ['roman/temporale', 42, null],
                'bogus_non_list' => 'not-an-array',
            ],
        ])));

        $result = AuthHelper::fetchDashboardScopes('http://api.test', 'litcal_access_token=abc', $client);

        self::assertSame(['roman/temporale'], $result['viewer_scopes']['rite_calendar']);
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
            self::assertFalse($auth->canViewType('rite_calendar'));
            self::assertFalse($auth->canViewResource('rite_calendar', 'roman/decrees'));
            self::assertFalse($auth->canViewRiteCalendarResource('roman', 'decrees'));
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

    /**
     * An authenticated instance holding exactly `$roles`, built through the
     * real (private) constructor's legacy-token branch. It is not the
     * singleton, and nothing on it may reach the API: reading is decided by
     * the role alone (LiturgicalCalendarAPI #1049).
     */
    private function authWithRoles(string ...$roles): AuthHelper
    {
        $class = new ReflectionClass(AuthHelper::class);
        $auth  = $class->newInstanceWithoutConstructor();
        $ctor  = $class->getConstructor();
        self::assertNotNull($ctor);
        $ctor->invoke($auth, (object) ['sub' => 'user-1', 'roles' => $roles]);
        self::assertTrue($auth->isAuthenticated, 'Precondition: instance must be authenticated');
        return $auth;
    }

    /**
     * Every role's readable set, plus global admin and no role, against two
     * types that tell `calendar_editor` and `test_editor` apart.
     *
     * @return array<string, array{list<string>, bool, bool}>
     */
    public static function roleReadsProvider(): array
    {
        return [
            'calendar_editor'  => [['calendar_editor'], true, false],
            'test_editor'      => [['test_editor'], false, true],
            'developer'        => [['developer'], true, true],
            'no role'          => [[], false, false],
            'global admin'     => [['admin'], true, true],
            'unrelated role'   => [['translator'], false, false],
            'two roles summed' => [['calendar_editor', 'test_editor'], true, true],
        ];
    }

    /**
     * @param list<string> $roles
     */
    #[DataProvider('roleReadsProvider')]
    public function testCanViewTypeFollowsTheRole(array $roles, bool $readsRiteCalendar, bool $readsNationalTest): void
    {
        $auth = $this->authWithRoles(...$roles);

        self::assertSame($readsRiteCalendar, $auth->canViewType('rite_calendar'));
        self::assertSame($readsNationalTest, $auth->canViewType('national_calendar_test'));
    }

    /**
     * The object id no longer matters for reading: any id of a readable type
     * is readable, any id of an unreadable type is not.
     *
     * @param list<string> $roles
     */
    #[DataProvider('roleReadsProvider')]
    public function testTheViewMethodsIgnoreTheObjectId(array $roles, bool $readsRiteCalendar, bool $readsNationalTest): void
    {
        $auth = $this->authWithRoles(...$roles);

        foreach (['roman/decrees', 'roman/temporale', 'ambrosian/temporale', 'anything-at-all'] as $id) {
            self::assertSame($readsRiteCalendar, $auth->canViewResource('rite_calendar', $id), $id);
        }
        self::assertSame($readsRiteCalendar, $auth->canViewRiteCalendarResource('roman', 'decrees'));
        self::assertSame($readsRiteCalendar, $auth->canViewRiteCalendarResource('ambrosian', 'temporale'));
        foreach (['IT', 'roman/IT', 'nowhere'] as $id) {
            self::assertSame($readsNationalTest, $auth->canViewResource('national_calendar_test', $id), $id);
        }
        self::assertSame(
            $readsNationalTest,
            $auth->canViewAnyResourceOfType('national_calendar_test', 'diocesan_calendar_test', 'rite_calendar_test')
        );
        self::assertSame($readsRiteCalendar || $readsNationalTest, $auth->canViewAnyResourceOfType('rite_calendar', 'national_calendar_test'));
    }

    public function testAnUnknownTypeIsReadableByAGlobalAdminOnly(): void
    {
        // `general_roman_calendar` was removed from the FGA model at the #955
        // prune milestone (CatholicOS/cdcf-infra#44): no role lists it, so only
        // a global admin — who reads everything — passes a check against it.
        foreach ([['calendar_editor'], ['test_editor'], ['developer'], []] as $roles) {
            $auth = $this->authWithRoles(...$roles);
            self::assertFalse($auth->canViewType('general_roman_calendar'), implode(',', $roles));
            self::assertFalse($auth->canViewType('no_such_type'), implode(',', $roles));
            self::assertFalse($auth->canViewResource('general_roman_calendar', 'decrees'), implode(',', $roles));
        }

        $admin = $this->authWithRoles('admin');
        self::assertTrue($admin->canViewType('general_roman_calendar'));
        self::assertTrue($admin->canViewType('no_such_type'));
    }

    public function testTheReadableTypesTableMirrorsTheApiRoleScopes(): void
    {
        // Compared as sets: the frontend copy keeps a display order (rite-level
        // first), the API validates set membership only.
        $sorted = static function (array $types): array {
            sort($types);
            return $types;
        };
        $expected = [
            'calendar_editor' => ['diocesan_calendar', 'national_calendar', 'rite_calendar', 'wider_region'],
            'test_editor'     => ['diocesan_calendar_test', 'national_calendar_test', 'rite_calendar_test'],
        ];
        $expected['developer'] = $sorted(array_merge($expected['calendar_editor'], $expected['test_editor']));

        self::assertSame(array_keys($expected), array_keys(AuthHelper::ROLE_READABLE_TYPES));
        foreach ($expected as $role => $types) {
            self::assertSame($types, $sorted(AuthHelper::ROLE_READABLE_TYPES[$role]), $role);
        }
        // Display order: the rite-level scope comes first for each role.
        self::assertSame('rite_calendar', AuthHelper::ROLE_READABLE_TYPES['calendar_editor'][0]);
        self::assertSame('rite_calendar_test', AuthHelper::ROLE_READABLE_TYPES['test_editor'][0]);
        self::assertSame('rite_calendar', AuthHelper::ROLE_READABLE_TYPES['developer'][0]);
    }

    public function testFetchDashboardScopesParsesEditorScopes(): void
    {
        $client = $this->clientWith(new Response(200, [], (string) json_encode([
            'is_global_admin'   => false,
            'is_resource_admin' => false,
            'admin_scopes'      => [],
            'viewer_scopes'     => [],
            'editor_scopes'     => [
                'national_calendar' => ['roman/CA', 42, 'roman/VE'],
                'wider_region'      => [],
            ],
        ])));

        $result = AuthHelper::fetchDashboardScopes('http://api.test', null, $client);

        self::assertSame(['national_calendar' => ['roman/CA', 'roman/VE'], 'wider_region' => []], $result['editor_scopes']);
    }

    public function testEditorScopesFromAnApiThatPredatesThemGrantNothing(): void
    {
        $client = $this->clientWith(new Response(200, [], (string) json_encode([
            'is_global_admin'   => false,
            'is_resource_admin' => false,
            'admin_scopes'      => [],
            'viewer_scopes'     => [],
        ])));

        self::assertSame([], AuthHelper::fetchDashboardScopes('http://api.test', null, $client)['editor_scopes']);
    }

    public function testEditableObjectIdsStripsTheRiteQualifier(): void
    {
        AuthHelper::reset();
        try {
            $auth = AuthHelper::getInstance();
            $prop = new ReflectionProperty(AuthHelper::class, 'dashboardScopesResult');
            $prop->setValue($auth, [
                'is_global_admin'   => false,
                'is_resource_admin' => false,
                'admin_scopes'      => [],
                'viewer_scopes'     => [],
                'editor_scopes'     => [
                    'national_calendar' => ['roman/CA', 'ambrosian/XX', 'roman/VE'],
                    'wider_region'      => ['roman/Americas'],
                ],
            ]);

            self::assertSame(['CA', 'VE'], $auth->editableObjectIds('national_calendar'));
            self::assertSame(['Americas'], $auth->editableObjectIds('wider_region'));
            self::assertSame([], $auth->editableObjectIds('diocesan_calendar'));
        } finally {
            AuthHelper::reset();
        }
    }
}
