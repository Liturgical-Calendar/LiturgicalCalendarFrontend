# Admin Dashboard Relation-Aware Card Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate admin-dashboard cards on Zitadel role AND OpenFGA relation, fetched server-side in one API round-trip
(frontend issue #399; spec: `docs/superpowers/specs/2026-07-12-admin-dashboard-fga-gating-design.md`).

**Architecture:** A new batched `GET /auth/dashboard-scopes` endpoint in LiturgicalCalendarAPI returns admin scopes plus
viewer-or-above scopes for `general_roman_calendar` and the three `*_test` types. The frontend `AuthHelper` fetches it
server-side (cookie-forwarded, memoized, lazy) and `admin-dashboard.php` / `includes/admin-blocks.php` gate the
Temporale block, Decrees block + card, Tests card, and Access Requests card at render time. The interim client-side
check in `admin-decrees-card.php` is deleted.

**Tech Stack:** PHP 8.4 (both repos), PSR-7/15 handlers + Guzzle-mocked PHPUnit (API), Guzzle + PHPUnit (frontend),
Playwright e2e against the local docker stack (Zitadel + OpenFGA + API + frontend).

## Global Constraints

- Two repos: `/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI` (Tasks 1-3) and
  `/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend` (Tasks 4-7). Paths below are
  relative to the repo named in each task.
- Branches from `development`; PRs target `development`, never `main`.
- Never `git commit --no-verify`. Do not push after committing (CodeRabbit rate limits) — PRs only on explicit user request, API PR before frontend PR.
- PHP: PSR-12, 4-space indent, single quotes, short arrays. API PHPStan level 10; frontend PHPStan level 7.
- Fail closed everywhere: any scopes-fetch error → empty scopes → relation-gated cards hidden. `is_global_admin` always honored from the token.
- No new user-visible strings (no i18n changes).
- Docker gotcha: top-level frontend PHP files are inode-pinned bind mounts — after editing `admin-dashboard.php`, run
  `docker compose up -d --force-recreate litcal-frontend` before browser verification. After API edits, rebuild with
  `docker compose up -d --build litcal-api`.

---

### Task 1: API — `ResourceAdminService::resolveViewerScopes()`

**Repo:** LiturgicalCalendarAPI

**Files:**

- Modify: `src/Services/ResourceAdminService.php` (after `resolveTestScopes()`, ~line 105)
- Test: `phpunit_tests/Services/ResourceAdminServiceTest.php`

**Interfaces:**

- Consumes: existing `OpenFgaClient::listObjects(string $user, string $relation, string $type): array` (returns object
  IDs with the `type:` prefix already stripped, e.g. `['IT']`).
- Produces: `public const VIEWER_OBJECT_TYPES` and
  `public function resolveViewerScopes(string $sub): array` returning `array<string, list<string>>` keyed by every
  entry of `VIEWER_OBJECT_TYPES` (all keys always present). Task 2 consumes both.

- [ ] **Step 1: Create the branch**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
git checkout development && git pull
git checkout -b feat/dashboard-scopes
```

- [ ] **Step 2: Write the failing tests**

Append inside `ResourceAdminServiceTest` (it already has a `serviceWith(array $responses)` helper that queues mocked
OpenFGA responses in call order):

```php
    public function testResolveViewerScopesReturnsIdsKeyedByType(): void
    {
        // One list-objects response per VIEWER_OBJECT_TYPES entry, in order:
        // general_roman_calendar, national_calendar_test, diocesan_calendar_test, general_roman_calendar_test
        $service = $this->serviceWith([
            new GuzzleResponse(200, [], '{"objects":["general_roman_calendar:temporale","general_roman_calendar:decrees"]}'),
            new GuzzleResponse(200, [], '{"objects":["national_calendar_test:IT"]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]);

        self::assertSame(
            [
                'general_roman_calendar'      => ['temporale', 'decrees'],
                'national_calendar_test'      => ['IT'],
                'diocesan_calendar_test'      => [],
                'general_roman_calendar_test' => [],
            ],
            $service->resolveViewerScopes('grc-editor')
        );
    }

    public function testResolveViewerScopesFailsClosedOnOpenFgaError(): void
    {
        $service = $this->serviceWith([
            new GuzzleResponse(500, [], 'boom'),
        ]);

        self::assertSame(
            [
                'general_roman_calendar'      => [],
                'national_calendar_test'      => [],
                'diocesan_calendar_test'      => [],
                'general_roman_calendar_test' => [],
            ],
            $service->resolveViewerScopes('grc-editor')
        );
    }
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
vendor/bin/phpunit phpunit_tests/Services/ResourceAdminServiceTest.php
```

Expected: 2 errors — `Call to undefined method ...::resolveViewerScopes()`.

- [ ] **Step 4: Implement**

In `src/Services/ResourceAdminService.php`, add after the `TEST_OBJECT_TYPES` constant:

```php
    /**
     * Object types whose `viewer` relation the frontend admin dashboard consults
     * for card visibility (issue LiturgicalCalendarFrontend#399). In the FGA model
     * `viewer` is a union including `editor` and `admin`, so a single `viewer`
     * query means "viewer or above".
     */
    public const VIEWER_OBJECT_TYPES = [
        'general_roman_calendar',
        'national_calendar_test',
        'diocesan_calendar_test',
        'general_roman_calendar_test',
    ];
```

And add after `resolveTestScopes()`:

```php
    /**
     * Object IDs the caller can view (viewer-or-above), keyed by object type,
     * across VIEWER_OBJECT_TYPES. Every key is always present.
     *
     * Fails closed: any OpenFGA transport error yields all-empty lists.
     *
     * @param string $sub Zitadel user ID (without "user:" prefix)
     * @return array<string, list<string>>
     */
    public function resolveViewerScopes(string $sub): array
    {
        $fgaUser = "user:{$sub}";
        $scopes  = array_fill_keys(self::VIEWER_OBJECT_TYPES, []);

        try {
            foreach (self::VIEWER_OBJECT_TYPES as $type) {
                $scopes[$type] = $this->fgaClient->listObjects($fgaUser, 'viewer', $type);
            }
        } catch (\RuntimeException) {
            return array_fill_keys(self::VIEWER_OBJECT_TYPES, []);
        }

        return $scopes;
    }
```

- [ ] **Step 5: Run tests to verify they pass, plus static analysis**

```bash
vendor/bin/phpunit phpunit_tests/Services/ResourceAdminServiceTest.php && composer analyse
```

Expected: OK (all tests pass), PHPStan no errors.

- [ ] **Step 6: Commit**

```bash
git add src/Services/ResourceAdminService.php phpunit_tests/Services/ResourceAdminServiceTest.php
git commit -m "feat(auth): add ResourceAdminService::resolveViewerScopes for dashboard gating"
```

---

### Task 2: API — `DashboardScopesHandler` + Router registration

**Repo:** LiturgicalCalendarAPI

**Files:**

- Create: `src/Handlers/Auth/DashboardScopesHandler.php`
- Modify: `src/Router.php` (auth dispatch ~line 371; OIDC-protected list ~line 622; `use` block near the
  `AdminScopesHandler` import)
- Test: `phpunit_tests/Handlers/Auth/DashboardScopesHandlerTest.php`

**Interfaces:**

- Consumes: `ResourceAdminService::resolveScopes(string $sub)`, `ResourceAdminService::resolveViewerScopes(string $sub)`,
  `ResourceAdminService::VIEWER_OBJECT_TYPES` (Task 1).
- Produces: route `GET /auth/dashboard-scopes` returning JSON
  `{is_global_admin: bool, is_resource_admin: bool, admin_scopes: list<{object_type, object_id}>, viewer_scopes: map<type, list<id>>}`.
  Tasks 3 (OpenAPI) and 4 (frontend fetch) depend on exactly this shape.

- [ ] **Step 1: Write the failing tests**

Create `phpunit_tests/Handlers/Auth/DashboardScopesHandlerTest.php` (modeled on `AdminScopesHandlerTest` in the same
directory — same `handlerWith()` mock plumbing, `requestFor()`, `decodeJsonBody()` from `AbstractHandlerTestCase`):

```php
<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Tests\Handlers\Auth;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use LiturgicalCalendar\Api\Handlers\Auth\DashboardScopesHandler;
use LiturgicalCalendar\Api\Http\Exception\UnauthorizedException;
use LiturgicalCalendar\Api\Services\OpenFgaClient;
use LiturgicalCalendar\Tests\Handlers\AbstractHandlerTestCase;
use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(DashboardScopesHandler::class)]
final class DashboardScopesHandlerTest extends AbstractHandlerTestCase
{
    /**
     * @param array<int, GuzzleResponse> $responses
     */
    private function handlerWith(array $responses): DashboardScopesHandler
    {
        $stack  = HandlerStack::create(new MockHandler($responses));
        $guzzle = new GuzzleClient(['handler' => $stack]);
        $psr17  = new Psr17Factory();
        $client = new OpenFgaClient(
            apiUrl: 'http://openfga.test',
            storeId: 'test-store',
            modelId: 'test-model',
            httpClient: $guzzle,
            requestFactory: $psr17,
            streamFactory: $psr17,
            apiToken: 'test-token'
        );
        return new DashboardScopesHandler($client);
    }

    /**
     * Response queue order: 4 admin list-objects (ADMIN_OBJECT_TYPES: national_calendar,
     * diocesan_calendar, wider_region, general_roman_calendar), then 4 viewer list-objects
     * (VIEWER_OBJECT_TYPES: general_roman_calendar, national_calendar_test,
     * diocesan_calendar_test, general_roman_calendar_test).
     *
     * @param array<int, GuzzleResponse> $viewerResponses
     * @return array<int, GuzzleResponse>
     */
    private static function emptyAdminThenViewer(array $viewerResponses): array
    {
        $empty = new GuzzleResponse(200, [], '{"objects":[]}');
        return [$empty, $empty, $empty, $empty, ...$viewerResponses];
    }

    public function testMissingOidcUserIsUnauthorized(): void
    {
        $this->expectException(UnauthorizedException::class);
        $this->handlerWith([])->handle($this->requestFor('GET', '/auth/dashboard-scopes'));
    }

    public function testViewerScopesAreKeyedByType(): void
    {
        $handler = $this->handlerWith(self::emptyAdminThenViewer([
            new GuzzleResponse(200, [], '{"objects":["general_roman_calendar:decrees"]}'),
            new GuzzleResponse(200, [], '{"objects":["national_calendar_test:IT"]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]));

        $request = $this->requestFor('GET', '/auth/dashboard-scopes')
            ->withAttribute('oidc_user', ['sub' => 'cei-editor', 'roles' => ['calendar_editor']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertFalse($body['is_global_admin']);
        self::assertFalse($body['is_resource_admin']);
        self::assertSame([], $body['admin_scopes']);
        self::assertSame(
            [
                'general_roman_calendar'      => ['decrees'],
                'national_calendar_test'      => ['IT'],
                'diocesan_calendar_test'      => [],
                'general_roman_calendar_test' => [],
            ],
            $body['viewer_scopes']
        );
    }

    public function testResourceAdminScopesMatchAdminScopesEndpointSemantics(): void
    {
        $empty   = new GuzzleResponse(200, [], '{"objects":[]}');
        $handler = $this->handlerWith([
            new GuzzleResponse(200, [], '{"objects":["national_calendar:IT"]}'),
            $empty, $empty, $empty, // remaining admin types
            $empty, $empty, $empty, $empty, // viewer types
        ]);

        $request = $this->requestFor('GET', '/auth/dashboard-scopes')
            ->withAttribute('oidc_user', ['sub' => 'cei-admin', 'roles' => ['calendar_editor']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertTrue($body['is_resource_admin']);
        self::assertSame(
            [['object_type' => 'national_calendar', 'object_id' => 'IT']],
            $body['admin_scopes']
        );
    }

    public function testGlobalAdminIsFlaggedFromToken(): void
    {
        $handler = $this->handlerWith(self::emptyAdminThenViewer([
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]));

        $request = $this->requestFor('GET', '/auth/dashboard-scopes')
            ->withAttribute('oidc_user', ['sub' => 'root', 'roles' => ['admin']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertTrue($body['is_global_admin']);
        self::assertFalse($body['is_resource_admin']);
    }

    public function testFailsClosedWhenOpenFgaErrors(): void
    {
        // First 500 aborts resolveScopes(); second 500 aborts resolveViewerScopes().
        $handler = $this->handlerWith([
            new GuzzleResponse(500, [], 'boom'),
            new GuzzleResponse(500, [], 'boom'),
        ]);

        $request = $this->requestFor('GET', '/auth/dashboard-scopes')
            ->withAttribute('oidc_user', ['sub' => 'root', 'roles' => ['admin']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertTrue($body['is_global_admin']);
        self::assertFalse($body['is_resource_admin']);
        self::assertSame([], $body['admin_scopes']);
        self::assertSame(
            [
                'general_roman_calendar'      => [],
                'national_calendar_test'      => [],
                'diocesan_calendar_test'      => [],
                'general_roman_calendar_test' => [],
            ],
            $body['viewer_scopes']
        );
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
vendor/bin/phpunit phpunit_tests/Handlers/Auth/DashboardScopesHandlerTest.php
```

Expected: errors — `Class "LiturgicalCalendar\Api\Handlers\Auth\DashboardScopesHandler" not found`.

- [ ] **Step 3: Create the handler**

Create `src/Handlers/Auth/DashboardScopesHandler.php` (mirrors `AdminScopesHandler.php` in the same directory):

```php
<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Api\Handlers\Auth;

use LiturgicalCalendar\Api\Handlers\AbstractHandler;
use LiturgicalCalendar\Api\Http\Enum\AcceptabilityLevel;
use LiturgicalCalendar\Api\Http\Enum\AcceptHeader;
use LiturgicalCalendar\Api\Http\Enum\RequestMethod;
use LiturgicalCalendar\Api\Http\Exception\UnauthorizedException;
use LiturgicalCalendar\Api\Http\Middleware\OidcAuthMiddleware;
use LiturgicalCalendar\Api\Services\OpenFgaClient;
use LiturgicalCalendar\Api\Services\ResourceAdminService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Dashboard Scopes Handler
 *
 * GET /auth/dashboard-scopes — batched capability report for the frontend admin
 * dashboard (LiturgicalCalendarFrontend#399). One round-trip returns everything
 * the dashboard needs to gate its cards server-side:
 *   - is_global_admin: the Zitadel `admin` role is present in the token.
 *   - is_resource_admin / admin_scopes: same semantics as GET /auth/admin-scopes.
 *   - viewer_scopes: object IDs the caller can view (viewer-or-above; the FGA
 *     model unions `viewer` with `editor` and `admin`), keyed by object type,
 *     across ResourceAdminService::VIEWER_OBJECT_TYPES.
 *
 * Fails closed: when OpenFGA is unavailable, all scope lists are empty, but
 * is_global_admin is still honored from the token.
 */
final class DashboardScopesHandler extends AbstractHandler
{
    private ?OpenFgaClient $fgaClient = null;

    public function __construct(?OpenFgaClient $fgaClient = null)
    {
        parent::__construct();

        $this->fgaClient             = $fgaClient;
        $this->allowedRequestMethods = [RequestMethod::GET];
        $this->allowedAcceptHeaders  = [AcceptHeader::JSON];
        $this->allowCredentials      = true;
    }

    private function isFgaClientAvailable(): bool
    {
        return $this->fgaClient !== null || OpenFgaClient::isConfigured();
    }

    private function getFgaClient(): OpenFgaClient
    {
        if ($this->fgaClient === null) {
            $this->fgaClient = OpenFgaClient::fromEnv();
        }
        return $this->fgaClient;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $response = static::initResponse($request);
        $method   = RequestMethod::from($request->getMethod());

        if ($method === RequestMethod::OPTIONS) {
            return $this->handlePreflightRequest($request, $response);
        }

        $response = $this->setAccessControlAllowOriginHeader($request, $response);
        $this->validateRequestMethod($request);

        $mime     = $this->validateAcceptHeader($request, AcceptabilityLevel::LAX);
        $response = $response->withHeader('Content-Type', $mime)
            ->withHeader('Cache-Control', 'no-store');

        /** @var array{sub?: string, roles?: array<string>}|null $oidcUser */
        $oidcUser = $request->getAttribute('oidc_user');

        if ($oidcUser === null) {
            throw new UnauthorizedException('Authentication required');
        }

        $sub = $oidcUser['sub'] ?? null;
        if (!is_string($sub) || trim($sub) === '') {
            throw new UnauthorizedException('Invalid authentication token');
        }

        $isGlobalAdmin = OidcAuthMiddleware::isAdmin($oidcUser);

        $adminScopes  = [];
        $viewerScopes = array_fill_keys(ResourceAdminService::VIEWER_OBJECT_TYPES, []);
        if ($this->isFgaClientAvailable()) {
            $service      = new ResourceAdminService($this->getFgaClient());
            $adminScopes  = $service->resolveScopes($sub);
            $viewerScopes = $service->resolveViewerScopes($sub);
        }

        return $this->encodeResponseBody($response, [
            'is_global_admin'   => $isGlobalAdmin,
            'is_resource_admin' => $adminScopes !== [],
            'admin_scopes'      => $adminScopes,
            'viewer_scopes'     => $viewerScopes,
        ]);
    }
}
```

- [ ] **Step 4: Register the route in `src/Router.php`**

Three edits:

1. In the `use` block, next to the existing `AdminScopesHandler` import, add:

    ```php
    use LiturgicalCalendar\Api\Handlers\Auth\DashboardScopesHandler;
    ```

2. In the auth dispatch chain, after the `test-scopes` elseif (~line 371-375):

    ```php
                        } elseif ($authRoute === 'dashboard-scopes') {
                            // GET /auth/dashboard-scopes - Batched admin/viewer scopes for the frontend admin dashboard
                            $dashboardScopesHandler = new DashboardScopesHandler();
                            $this->handler          = $dashboardScopesHandler;
    ```

3. In the OIDC-protected auth route list (~line 622), add `'dashboard-scopes'`:

    ```php
    in_array($requestPathParts[0], ['access-requests', 'email-verification', 'notifications', 'admin-scopes', 'test-scopes', 'dashboard-scopes'], true)
    ```

- [ ] **Step 5: Run tests to verify they pass, plus static analysis and lint**

```bash
vendor/bin/phpunit phpunit_tests/Handlers/Auth/DashboardScopesHandlerTest.php && composer analyse && composer lint
```

Expected: all tests PASS, PHPStan clean, phpcs clean.

- [ ] **Step 6: Commit**

```bash
git add src/Handlers/Auth/DashboardScopesHandler.php src/Router.php phpunit_tests/Handlers/Auth/DashboardScopesHandlerTest.php
git commit -m "feat(auth): add GET /auth/dashboard-scopes batched capability endpoint"
```

---

### Task 3: API — OpenAPI schema + full-suite verification

**Repo:** LiturgicalCalendarAPI

**Files:**

- Modify: `jsondata/schemas/openapi.json` (add path `/auth/dashboard-scopes`; add component schema
  `DashboardScopesResponse`)

**Interfaces:**

- Consumes: response shape from Task 2.
- Produces: OpenAPI documentation only; no code interfaces.

- [ ] **Step 1: Add the path entry**

In `openapi.json` `paths`, alongside `/auth/admin-scopes`, add:

```json
"/auth/dashboard-scopes": {
    "get": {
        "tags": ["Authentication"],
        "security": [{ "BearerAuth": [] }, { "CookieAuth": [] }],
        "summary": "Get the caller's batched dashboard capability scopes",
        "operationId": "authDashboardScopes",
        "description": "Batched capability report for the frontend admin dashboard: global-admin flag, resource-admin scopes (as /auth/admin-scopes), and viewer-or-above object IDs keyed by object type across general_roman_calendar and the *_test types. Response is not cacheable (`Cache-Control: no-store`).",
        "responses": {
            "200": {
                "description": "OK: Dashboard scope information",
                "headers": {
                    "Cache-Control": {
                        "schema": { "type": "string", "example": "no-store" },
                        "description": "Always set to `no-store` to prevent caching of auth state."
                    }
                },
                "content": {
                    "application/json": {
                        "schema": { "$ref": "#/components/schemas/DashboardScopesResponse" }
                    }
                }
            },
            "401": { "$ref": "#/components/responses/Unauthorized401" }
        }
    }
}
```

- [ ] **Step 2: Add the component schema**

In `components.schemas`, alongside `AdminScopesResponse`, add (reusing its `admin_scopes` item shape verbatim):

```json
"DashboardScopesResponse": {
    "type": "object",
    "properties": {
        "is_global_admin": {
            "type": "boolean",
            "description": "True when the caller holds the global `admin` Zitadel role."
        },
        "is_resource_admin": {
            "type": "boolean",
            "description": "True when the caller holds an OpenFGA `admin` relation on at least one resource."
        },
        "admin_scopes": {
            "type": "array",
            "description": "Resources the caller administers via OpenFGA. Empty when `is_resource_admin` is false.",
            "items": {
                "type": "object",
                "properties": {
                    "object_type": { "type": "string", "example": "national_calendar", "description": "The OpenFGA object type." },
                    "object_id": { "type": "string", "example": "IT", "description": "The OpenFGA object ID." }
                },
                "required": ["object_type", "object_id"],
                "additionalProperties": false
            }
        },
        "viewer_scopes": {
            "type": "object",
            "description": "Object IDs the caller can view (viewer-or-above), keyed by OpenFGA object type. Keys cover general_roman_calendar, national_calendar_test, diocesan_calendar_test and general_roman_calendar_test.",
            "additionalProperties": {
                "type": "array",
                "items": { "type": "string" }
            },
            "example": {
                "general_roman_calendar": ["temporale", "decrees"],
                "national_calendar_test": ["IT"],
                "diocesan_calendar_test": [],
                "general_roman_calendar_test": []
            }
        }
    },
    "required": ["is_global_admin", "is_resource_admin", "admin_scopes", "viewer_scopes"],
    "additionalProperties": false
}
```

- [ ] **Step 3: Lint the OpenAPI schema and run the full API suite**

```bash
composer lint:openapi && composer parallel-lint && composer lint && composer analyse && composer test:quick
```

Expected: Redocly lint clean; phpcs/PHPStan clean; PHPUnit green (slow group excluded).

- [ ] **Step 4: Commit**

```bash
git add jsondata/schemas/openapi.json
git commit -m "docs(openapi): document GET /auth/dashboard-scopes"
```

---

### Task 4: Frontend — `AuthHelper` dashboard-scopes support

**Repo:** LiturgicalCalendarFrontend

**Files:**

- Modify: `src/AuthHelper.php` (new property next to `$adminScopesResult` ~line 54; new methods after `adminScopes()`
  ~line 333; new static fetch after `fetchAdminScopes()` ~line 434)
- Test: `tests/AuthHelperDashboardScopesTest.php` (new; modeled on `tests/AuthHelperAdminScopesTest.php`)

**Interfaces:**

- Consumes: `GET {apiBase}/auth/dashboard-scopes` (Task 2 shape); existing private `buildCookieHeader()`,
  `ApiConfig::getInstance()->apiBaseUrl`, `API_INTERNAL_URL` env override.
- Produces (Task 5 consumes exactly these):
    - `public function dashboardScopes(): array` —
      `array{is_global_admin: bool, is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>, viewer_scopes: array<string, list<string>>}`
    - `public function canViewResource(string $objectType, string $objectId): bool`
    - `public function canViewAnyResourceOfType(string ...$objectTypes): bool`
    - `public static function fetchDashboardScopes(string $apiBaseUrl, ?string $cookieHeader, ?\GuzzleHttp\Client $client = null): array`

- [ ] **Step 1: Create the branch**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
git checkout development
git checkout -b feature/admin-dashboard-fga-gating
```

- [ ] **Step 2: Write the failing tests**

Create `tests/AuthHelperDashboardScopesTest.php`. Copy the `clientWith()`, `stashAndClearEnv()` and `restoreEnv()`
helpers verbatim from `tests/AuthHelperAdminScopesTest.php`, then add:

```php
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
vendor/bin/phpunit tests/AuthHelperDashboardScopesTest.php
```

Expected: errors — `Call to undefined method ...::fetchDashboardScopes()` / `dashboardScopes()`.

- [ ] **Step 4: Implement in `src/AuthHelper.php`**

Add the memoization property next to `$adminScopesResult`:

```php
    /**
     * Memoized dashboard-scopes result for this request.
     *
     * @var array{is_global_admin: bool, is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>, viewer_scopes: array<string, list<string>>}|null
     */
    private ?array $dashboardScopesResult = null;
```

Add after `adminScopes()`:

```php
    /**
     * The caller's batched dashboard capability scopes, resolved once per request
     * from GET /auth/dashboard-scopes (server-side, using the caller's session
     * cookies). Lazy: the API is only contacted on first use. Fails closed.
     *
     * @return array{is_global_admin: bool, is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>, viewer_scopes: array<string, list<string>>}
     */
    public function dashboardScopes(): array
    {
        if ($this->dashboardScopesResult !== null) {
            return $this->dashboardScopesResult;
        }

        if (!$this->isAuthenticated) {
            return $this->dashboardScopesResult = [
                'is_global_admin'   => false,
                'is_resource_admin' => false,
                'admin_scopes'      => [],
                'viewer_scopes'     => [],
            ];
        }

        $internalUrl = $_ENV['API_INTERNAL_URL'] ?? getenv('API_INTERNAL_URL') ?: null;
        $apiBaseUrl  = $internalUrl ? rtrim($internalUrl, '/') : ApiConfig::getInstance()->apiBaseUrl;

        return $this->dashboardScopesResult = self::fetchDashboardScopes($apiBaseUrl, self::buildCookieHeader());
    }

    /**
     * Whether the caller can view (viewer-or-above) a specific OpenFGA object.
     * Global admins (Zitadel role) always can — no API call is made for them.
     */
    public function canViewResource(string $objectType, string $objectId): bool
    {
        if ($this->hasRole('admin')) {
            return true;
        }
        return in_array($objectId, $this->dashboardScopes()['viewer_scopes'][$objectType] ?? [], true);
    }

    /**
     * Whether the caller can view (viewer-or-above) ANY object of any of the
     * given OpenFGA object types. Global admins always can.
     */
    public function canViewAnyResourceOfType(string ...$objectTypes): bool
    {
        if ($this->hasRole('admin')) {
            return true;
        }
        $viewerScopes = $this->dashboardScopes()['viewer_scopes'];
        foreach ($objectTypes as $type) {
            if (( $viewerScopes[$type] ?? [] ) !== []) {
                return true;
            }
        }
        return false;
    }
```

Add after `fetchAdminScopes()` (same Guzzle defaults: `timeout 5`, `connect_timeout 2`, `http_errors true`):

```php
    /**
     * Fetch and parse GET /auth/dashboard-scopes. Fails closed on any error.
     *
     * @param string $apiBaseUrl Base API URL (no trailing slash)
     * @param string|null $cookieHeader Cookie header forwarding the caller's session
     * @param \GuzzleHttp\Client|null $client Injectable client (tests)
     * @return array{is_global_admin: bool, is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>, viewer_scopes: array<string, list<string>>}
     */
    public static function fetchDashboardScopes(
        string $apiBaseUrl,
        ?string $cookieHeader,
        ?\GuzzleHttp\Client $client = null
    ): array {
        $failClosed = [
            'is_global_admin'   => false,
            'is_resource_admin' => false,
            'admin_scopes'      => [],
            'viewer_scopes'     => [],
        ];

        $client ??= new \GuzzleHttp\Client(['timeout' => 5, 'connect_timeout' => 2, 'http_errors' => true]);

        $headers = ['Accept' => 'application/json'];
        if ($cookieHeader !== null) {
            $headers['Cookie'] = $cookieHeader;
        }

        try {
            $response = $client->get("{$apiBaseUrl}/auth/dashboard-scopes", ['headers' => $headers]);
            $data     = json_decode((string) $response->getBody(), true);
        } catch (\Throwable) {
            return $failClosed;
        }

        if (!is_array($data)) {
            return $failClosed;
        }

        $adminScopes = [];
        if (isset($data['admin_scopes']) && is_array($data['admin_scopes'])) {
            foreach ($data['admin_scopes'] as $scope) {
                if (
                    is_array($scope)
                    && isset($scope['object_type'], $scope['object_id'])
                    && is_string($scope['object_type'])
                    && is_string($scope['object_id'])
                ) {
                    $adminScopes[] = ['object_type' => $scope['object_type'], 'object_id' => $scope['object_id']];
                }
            }
        }

        $viewerScopes = [];
        if (isset($data['viewer_scopes']) && is_array($data['viewer_scopes'])) {
            foreach ($data['viewer_scopes'] as $type => $ids) {
                if (!is_string($type) || !is_array($ids)) {
                    continue;
                }
                $viewerScopes[$type] = array_values(array_filter($ids, 'is_string'));
            }
        }

        // Strict, fail-closed booleans: only an explicit JSON `true` counts,
        // mirroring fetchAdminScopes().
        return [
            'is_global_admin'   => ( $data['is_global_admin'] ?? false ) === true,
            'is_resource_admin' => ( $data['is_resource_admin'] ?? false ) === true,
            'admin_scopes'      => $adminScopes,
            'viewer_scopes'     => $viewerScopes,
        ];
    }
```

- [ ] **Step 5: Run tests, lint, static analysis**

```bash
vendor/bin/phpunit tests/AuthHelperDashboardScopesTest.php && composer test && composer lint && composer analyse
```

Expected: new tests PASS, full frontend suite still green, phpcs and PHPStan (level 7) clean.

- [ ] **Step 6: Commit**

```bash
git add src/AuthHelper.php tests/AuthHelperDashboardScopesTest.php
git commit -m "feat(auth): AuthHelper dashboard-scopes fetch with viewer-scope helpers (#399)"
```

---

### Task 5: Frontend — server-side card gating

**Repo:** LiturgicalCalendarFrontend

**Files:**

- Modify: `admin-dashboard.php` (branch conditions at lines 126, 136, 146)
- Modify: `includes/admin-blocks.php` (temporale + decrees entries; render loop)
- Modify: `includes/admin-decrees-card.php` (delete interim script + data attributes)

**Interfaces:**

- Consumes: `$authHelper->canViewResource()`, `$authHelper->canViewAnyResourceOfType()`,
  `$authHelper->dashboardScopes()` (Task 4); `$isAdmin` and `$authHelper` from `includes/common.php` /
  `admin-dashboard.php`.
- Produces: rendered dashboard; e2e selectors unchanged (`.admin-block[data-block-id="..."]`,
  `a[href="admin-decrees.php"]`, `a[href="admin-tests.php"]`, `.admin-block:has(i.fa-inbox)`).

- [ ] **Step 1: Gate the Temporale and Decrees blocks in `includes/admin-blocks.php`**

Add a `visible` key to the `temporale` entry (after `'permission' => 'temporale:write'`):

```php
        'permission'  => 'temporale:write',
        // Relation-aware gating (#399): non-admins need the calendar_editor role AND
        // viewer-or-above on general_roman_calendar:temporale.
        'visible'     => $isAdmin || (
            $authHelper->hasRole('calendar_editor')
            && $authHelper->canViewResource('general_roman_calendar', 'temporale')
        )
```

Add the analogous `visible` key to the `decrees` entry:

```php
        'permission'  => 'decrees:write',
        'visible'     => $isAdmin || (
            $authHelper->hasRole('calendar_editor')
            && $authHelper->canViewResource('general_roman_calendar', 'decrees')
        )
```

At the top of the render loop, skip hidden blocks (blocks without a `visible` key stay visible):

```php
foreach ($adminBlocks as $block) {
    if (( $block['visible'] ?? true ) === false) {
        continue;
    }
```

Also extend the file docblock: the component now expects `$isAdmin` (bool) and `$authHelper` (AuthHelper) to be
defined by the including page (`admin-dashboard.php`).

- [ ] **Step 2: Gate the section branches in `admin-dashboard.php`**

Line 126 (dedicated Decrees card section) — from:

```php
<?php if (!$isAdmin && $authHelper->hasRole('calendar_editor')) : ?>
```

to:

```php
<?php if (!$isAdmin && $authHelper->hasRole('calendar_editor') && $authHelper->canViewResource('general_roman_calendar', 'decrees')) : ?>
```

Line 136 (Tests card section) — from:

```php
<?php if (!$isAdmin && $authHelper->hasRole('test_editor')) : ?>
```

to:

```php
<?php if (
    !$isAdmin
    && $authHelper->hasRole('test_editor')
    && $authHelper->canViewAnyResourceOfType('national_calendar_test', 'diocesan_calendar_test', 'general_roman_calendar_test')
) : ?>
```

Line 146 (Access Requests card) — from:

```php
<?php if (!$isAdmin && $authHelper->isResourceAdmin()) : ?>
```

to (same rule, but sourced from the single batched call so the dashboard makes exactly one scopes request):

```php
<?php if (!$isAdmin && $authHelper->dashboardScopes()['is_resource_admin']) : ?>
```

- [ ] **Step 3: Remove the interim client-side check from `includes/admin-decrees-card.php`**

Delete the entire `<script>(function () { ... }());</script>` block and the `data-fga-gate` / `data-user-sub`
attributes from the wrapper `<div>`, leaving:

```php
<div class="col-12 col-md-6 col-lg-4 mb-4">
```

Update the file docblock: visibility is now decided server-side in `admin-dashboard.php` via
`AuthHelper::canViewResource('general_roman_calendar', 'decrees')`; global admins always see the card.
Remove the stale `@var string $apiBaseUrl` reference if no longer used in the file.

- [ ] **Step 4: Lint and static analysis**

```bash
composer parallel-lint && composer lint && composer analyse
```

Expected: clean. (If phpcs flags the modified files, run `composer lint:fix` and re-check.)

- [ ] **Step 5: Manual smoke against the docker stack (optional but recommended)**

```bash
docker compose up -d --build litcal-api
docker compose up -d --force-recreate litcal-frontend
```

Log in as a seeded global admin → all cards visible. Log in as a calendar_editor without GRC relations →
Temporale and Decrees blocks absent.

- [ ] **Step 6: Commit**

```bash
git add admin-dashboard.php includes/admin-blocks.php includes/admin-decrees-card.php
git commit -m "feat(admin-dashboard): relation-aware card gating via dashboard-scopes (#399)"
```

---

### Task 6: Frontend — e2e coverage

**Repo:** LiturgicalCalendarFrontend

**Files:**

- Modify: `e2e/rbac/support/users.ts` (role union + two seeded `test_editor` users)
- Modify: `e2e/rbac/07-dashboard-card-scoping.spec.ts` (per-user visible/hidden block matrix)
- Create: `e2e/rbac/15-dashboard-tests-card-matrix.spec.ts`

**Interfaces:**

- Consumes: dashboard DOM from Task 5; support helpers `actingAs(browser, userKey)`, `grantScope(userKey, {role?})`,
  `revokeScope(userKey)`; `rbac.setup.ts` auto-seeds every `SEEDED_USER_IDS` entry (Zitadel user + role + `.auth`
  state; FGA tuples seeded only for `relation: 'admin'` users).
- Produces: green e2e suite documenting the new gating.

**Why seeded users (not runtime role grants):** Zitadel roles are baked into the JWT at login. A role granted after
`.auth` state is written (spec-14 style runtime grants) would not appear in the stored token, so `hasRole()` would
fail. FGA tuples ARE evaluated live, so tuple grants at runtime remain fine.

- [ ] **Step 1: Add `test_editor` users to `e2e/rbac/support/users.ts`**

Widen the role union:

```ts
role: 'admin' | 'calendar_editor' | 'test_editor';
```

(also update the `mk()` parameter type if it repeats the union). Add to `USERS`:

```ts
    'tests-editor': mk('tests-editor', 'test_editor', { relation: 'editor', objectType: 'national_calendar_test', objectId: 'IT' }),
    'tests-editor-noscope': mk('tests-editor-noscope', 'test_editor', null),
```

Both are seeded automatically (they are not in `REGISTRATION_USER_IDS`). `tests-editor`'s tuple is NOT seeded by
`seedUser` (only `admin` relations are) — spec 15 grants it at runtime via `grantScope`.

- [ ] **Step 2: Update the matrix in `e2e/rbac/07-dashboard-card-scoping.spec.ts`**

Replace the "all six cards visible" assertion with a per-user visible/hidden block matrix. Update the `Expected`
interface and `MATRIX`:

```ts
interface Expected {
    visibleBlocks: readonly string[];
    hiddenBlocks: readonly string[];
    globalAdminSection: boolean;
    reviewCard: boolean;
}

const ALWAYS_VISIBLE = [
    'sanctorale',
    'widerregion',
    'national',
    'diocesan',
] as const;

const MATRIX: Record<string, Expected> = {
    // Global admin: role bypasses all FGA gates — all six blocks.
    'super-admin': {
        visibleBlocks: [...ALWAYS_VISIBLE, 'temporale', 'decrees'],
        hiddenBlocks: [],
        globalAdminSection: true,
        reviewCard: false,
    },
    // calendar_editors WITHOUT any general_roman_calendar relation: temporale + decrees hidden.
    'cei-admin': {
        visibleBlocks: [...ALWAYS_VISIBLE],
        hiddenBlocks: ['temporale', 'decrees'],
        globalAdminSection: false,
        reviewCard: true,
    },
    'cei-editor': {
        visibleBlocks: [...ALWAYS_VISIBLE],
        hiddenBlocks: ['temporale', 'decrees'],
        globalAdminSection: false,
        reviewCard: false,
    },
    'usccb-admin': {
        visibleBlocks: [...ALWAYS_VISIBLE],
        hiddenBlocks: ['temporale', 'decrees'],
        globalAdminSection: false,
        reviewCard: true,
    },
    // admin@general_roman_calendar:temporale → temporale visible (viewer via admin), decrees still hidden.
    'grc-admin': {
        visibleBlocks: [...ALWAYS_VISIBLE, 'temporale'],
        hiddenBlocks: ['decrees'],
        globalAdminSection: false,
        reviewCard: true,
    },
    'europe-admin': {
        visibleBlocks: [...ALWAYS_VISIBLE],
        hiddenBlocks: ['temporale', 'decrees'],
        globalAdminSection: false,
        reviewCard: true,
    },
};
```

In `assertMatrix()`, replace the six-card loop with:

```ts
for (const id of expected.visibleBlocks) {
    await expect(page.locator(SEL.calendarBlock(id))).toBeVisible();
}
for (const id of expected.hiddenBlocks) {
    await expect(page.locator(SEL.calendarBlock(id))).toHaveCount(0);
}
```

Rewrite the header comment's "NOTE on scope narrowing" section: the dashboard NOW narrows Temporale/Decrees block
visibility by `general_roman_calendar` viewer relation (issue #399, server-side via `/auth/dashboard-scopes`); the
remaining four blocks stay role-gated.

- [ ] **Step 3: Create `e2e/rbac/15-dashboard-tests-card-matrix.spec.ts`**

```ts
/**
 * Scenario 15 — dashboard Tests-card matrix (test_editor role × FGA test scope)
 *
 * Issue #399: the Tests card renders for non-admins only when the user holds the
 * test_editor role AND a viewer-or-above relation on at least one *_test object
 * (checked server-side via GET /auth/dashboard-scopes).
 *
 * Preconditions (seeded by rbac-setup):
 *   - tests-editor: Zitadel test_editor role, no FGA tuple at seed time; this spec
 *     grants editor@national_calendar_test:IT at runtime (FGA is evaluated live,
 *     unlike Zitadel roles which are baked into the login token).
 *   - tests-editor-noscope: Zitadel test_editor role, never granted any tuple.
 */

import { test, expect, Browser } from '@playwright/test';
import { actingAs } from './support/actingAs';
import { grantScope, revokeScope } from './support/grant';

const TESTS_CARD_LINK = 'a[href="admin-tests.php"]';
const HEADING = '.admin-dashboard-heading';

test.describe.serial('15 — dashboard Tests-card matrix', () => {
    test.beforeAll(async () => {
        // editor@national_calendar_test:IT — editor satisfies the viewer-or-above gate.
        await grantScope('tests-editor', { role: false });
    });

    test.afterAll(async () => {
        await revokeScope('tests-editor');
    });

    test('test_editor WITH a test scope sees the Tests card', async ({
        browser,
    }) => {
        const page = await actingAs(browser, 'tests-editor');
        await page.goto('/admin-dashboard.php');
        await expect(page.locator(HEADING)).toBeVisible();
        await expect(page.locator(TESTS_CARD_LINK)).toBeVisible();
        await page.context().close();
    });

    test('test_editor WITHOUT a test scope does NOT see the Tests card', async ({
        browser,
    }) => {
        const page = await actingAs(browser, 'tests-editor-noscope');
        await page.goto('/admin-dashboard.php');
        await expect(page.locator(HEADING)).toBeVisible();
        await expect(page.locator(TESTS_CARD_LINK)).toHaveCount(0);
        await page.context().close();
    });
});
```

Match `actingAs`'s actual signature/return to how `14-admin-decrees-capability-matrix.spec.ts` uses it — adjust the
two call sites if it returns `{ page, context }` instead of a bare `Page`.

- [ ] **Step 4: Typecheck and run the affected specs**

```bash
yarn typecheck
```

Expected: clean. Then, with the docker stack up (API rebuilt in Task 5 Step 5):

```bash
yarn test:chromium e2e/rbac/07-dashboard-card-scoping.spec.ts e2e/rbac/15-dashboard-tests-card-matrix.spec.ts
```

Expected: both specs green (rbac.setup reseeds users, including the two new `test_editor` users).

- [ ] **Step 5: Run the full rbac e2e suite (regression)**

```bash
yarn test:chromium e2e/rbac
```

Expected: all green — notably 12 (test_editor request flow), 13 (admin-tests CRUD) and 14 (decrees matrix) must be
unaffected.

- [ ] **Step 6: Commit**

```bash
git add e2e/rbac/support/users.ts e2e/rbac/07-dashboard-card-scoping.spec.ts e2e/rbac/15-dashboard-tests-card-matrix.spec.ts
git commit -m "test(e2e): dashboard card gating matrix by FGA relation (#399)"
```

---

### Task 7: Final verification (both repos)

**Files:** none (verification only).

- [ ] **Step 1: API repo full check**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
composer parallel-lint && composer lint && composer analyse && composer test:quick && composer lint:openapi
```

Expected: all clean/green.

- [ ] **Step 2: Frontend repo full check**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
composer parallel-lint && composer lint && composer analyse && composer test && composer lint:md && yarn typecheck && yarn lint
```

Expected: all clean/green.

- [ ] **Step 3: Report and stop**

Report results to the user. Do NOT push either branch and do NOT open PRs — wait for the user's explicit request.
When asked: open the API PR first (`feat/dashboard-scopes` → `development` in LiturgicalCalendarAPI), then the
frontend PR (`feature/admin-dashboard-fga-gating` → `development`), noting the frontend PR depends on the API one.
