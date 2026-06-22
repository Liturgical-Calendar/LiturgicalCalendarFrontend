# Scoped Admin-Review for Resource-Admins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an OpenFGA resource-admin (admin tuple on a resource, but not the global Zitadel `admin` role) review the access-requests
scoped to the resources they administer through the existing admin UI, with a scoped notification badge.

**Architecture:** A new API endpoint (`GET /auth/admin-scopes`) exposes the caller's admin status/scopes; the existing
`GET /admin/notifications` is widened to admit resource-admins with a scoped count; the frontend consumes that signal to admit
resource-admins to the existing review UI (hiding global-only sections), add a dashboard entry, and switch the notification bell to
the scoped review queue. The per-request scoping predicate is extracted into one shared API service so the badge count and the review
list always agree. The API remains the sole authorization boundary; frontend changes only widen who the UI admits.

**Tech Stack:** PHP 8.4+ (API), PHP 8.1+ (frontend), PSR-7/15/17, OpenFGA, Zitadel OIDC, GuzzleHttp, PHPUnit, vanilla ES6 JS, Bootstrap.

## Global Constraints

- PHP code follows PSR-12 plus each project's `phpcs.xml` ruleset; short array syntax `[]` only; 4-space indentation; single quotes preferred.
- API requires PHP >= 8.4; frontend requires PHP >= 8.1.
- gettext user-facing strings use numbered placeholders (`%1$s`, `%2$d`) whenever there is more than one argument.
- Public API endpoints use `credentials: 'omit'`, but `/auth/*` and `/admin/*` are authenticated and use `credentials: 'include'`.
- Never use `--no-verify`; pre-commit hooks (phpcs, markdownlint) must pass. Fix and recommit on failure.
- Any markdown produced must pass `markdownlint` (180-char lines, blank lines around lists/code blocks, language-tagged fences).
- The API stays the authorization boundary. Hiding UI from resource-admins is not the security boundary — every privileged action is authorized server-side against OpenFGA.
- `GET /auth/admin-scopes` and the widened `GET /admin/notifications` fail closed: when OpenFGA is unavailable, treat the caller as
  not-a-resource-admin; `is_global_admin` is still derived from the token.

---

## File Structure

API (`/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI`):

- `src/Services/ResourceAdminService.php` (NEW) — single home for the OpenFGA-backed scoping logic: resolve a user's admin scopes
  (`resolveScopes`), filter access-requests to those a resource-admin administers (`filterByAdminAccess`), and the per-request
  "administers every resource" predicate (`administersAllResources`).
- `src/Handlers/Admin/AccessRequestAdminHandler.php` (MODIFY) — delegate `filterByAdminAccess` to the new service.
- `src/Handlers/Auth/AdminScopesHandler.php` (NEW) — `GET /auth/admin-scopes`.
- `src/Router.php` (MODIFY) — register the new auth route + add it to the OIDC-protected gate.
- `src/Handlers/Admin/NotificationsHandler.php` (MODIFY) — admit resource-admins with scoped counts.

Frontend (`/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend`):

- `composer.json` + `phpunit.xml` + `tests/` (NEW scaffolding, folded into Task 5) — frontend PHPUnit setup.
- `src/AuthHelper.php` (MODIFY) — `isResourceAdmin()`, `adminScopes()`, `fetchAdminScopes()`.
- `assets/js/auth.js` (MODIFY) — `Auth.isResourceAdmin()`.
- `admin-permissions.php` (MODIFY) — gate + section guard + `isGlobalAdmin` config flag.
- `assets/js/admin-permissions.js` (MODIFY) — skip FGA-tuple init for resource-admins.
- `admin-dashboard.php` (MODIFY) — "Access Requests to Review" card.
- `assets/js/notifications.js` (MODIFY) — admin mode for resource-admins.

---

### Task 1: API — `ResourceAdminService` (shared scoping logic)

**Files:**

- Create: `LiturgicalCalendarAPI/src/Services/ResourceAdminService.php`
- Test: `LiturgicalCalendarAPI/phpunit_tests/Services/ResourceAdminServiceTest.php`

**Interfaces:**

- Consumes: `LiturgicalCalendar\Api\Services\OpenFgaClient` —
  `listObjects(string $user, string $relation, string $type): array` (returns object IDs without type prefix, throws `\RuntimeException` on transport failure)
  and `check(string $user, string $relation, string $object): bool` (throws `\RuntimeException` on transport failure).
- Produces (relied on by Tasks 2, 3, 4):
  - `public const ADMIN_OBJECT_TYPES = ['national_calendar', 'diocesan_calendar', 'wider_region', 'general_roman_calendar'];`
  - `__construct(OpenFgaClient $fgaClient)`
  - `resolveScopes(string $sub): array` → returns `list<array{object_type: string, object_id: string}>`; fail-closed `[]` on any `\RuntimeException`.
  - `filterByAdminAccess(array $requests, string $adminUserId): array` → returns the subset of `$requests` whose every permission targets a
    resource the admin holds `admin` on; excludes empty-permission requests. Does NOT catch `\RuntimeException` (behavior-preserving).
  - `administersAllResources(array $permissions, string $fgaUser, array &$cache): bool` → predicate; `$cache` is a by-reference `array<string, bool>` of `"{type}:{id}" => bool`.

- [ ] **Step 1: Write the failing test**

Create `LiturgicalCalendarAPI/phpunit_tests/Services/ResourceAdminServiceTest.php`:

```php
<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Tests\Services;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use LiturgicalCalendar\Api\Services\OpenFgaClient;
use LiturgicalCalendar\Api\Services\ResourceAdminService;
use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(ResourceAdminService::class)]
final class ResourceAdminServiceTest extends TestCase
{
    /**
     * @param array<int, GuzzleResponse> $responses Queued, replayed in order.
     */
    private function serviceWith(array $responses): ResourceAdminService
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
        return new ResourceAdminService($client);
    }

    public function testResolveScopesUnionsAdminTuplesAcrossTypes(): void
    {
        // One list-objects response per ADMIN_OBJECT_TYPES entry, in order:
        // national_calendar, diocesan_calendar, wider_region, general_roman_calendar
        $service = $this->serviceWith([
            new GuzzleResponse(200, [], '{"objects":["national_calendar:IT"]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]);

        self::assertSame(
            [['object_type' => 'national_calendar', 'object_id' => 'IT']],
            $service->resolveScopes('cei-admin')
        );
    }

    public function testResolveScopesFailsClosedOnOpenFgaError(): void
    {
        $service = $this->serviceWith([
            new GuzzleResponse(500, [], 'boom'),
        ]);

        self::assertSame([], $service->resolveScopes('cei-admin'));
    }

    public function testFilterByAdminAccessKeepsOnlyFullyAdministeredRequests(): void
    {
        // check() calls, in request order:
        // req A perm national_calendar:IT -> allowed
        // req B perm national_calendar:US -> denied
        $service = $this->serviceWith([
            new GuzzleResponse(200, [], '{"allowed":true}'),
            new GuzzleResponse(200, [], '{"allowed":false}'),
        ]);

        $requests = [
            ['id' => 'A', 'permissions' => [['object_type' => 'national_calendar', 'object_id' => 'IT', 'relation' => 'editor']]],
            ['id' => 'B', 'permissions' => [['object_type' => 'national_calendar', 'object_id' => 'US', 'relation' => 'editor']]],
            ['id' => 'C', 'permissions' => []],
        ];

        $filtered = $service->filterByAdminAccess($requests, 'cei-admin');

        self::assertSame(['A'], array_column($filtered, 'id'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Services/ResourceAdminServiceTest.php`
Expected: FAIL — `Error: Class "LiturgicalCalendar\Api\Services\ResourceAdminService" not found`.

- [ ] **Step 3: Write minimal implementation**

Create `LiturgicalCalendarAPI/src/Services/ResourceAdminService.php`:

```php
<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Api\Services;

/**
 * Resolves and applies a user's OpenFGA `admin` scopes.
 *
 * Single home for the resource-admin scoping logic shared by
 * AdminScopesHandler (GET /auth/admin-scopes), the widened
 * NotificationsHandler (GET /admin/notifications), and
 * AccessRequestAdminHandler (GET /admin/access-requests). Centralizing it
 * keeps the badge count and the review list in agreement.
 */
final class ResourceAdminService
{
    /**
     * Object types a user can hold the `admin` relation on. Mirrors the
     * admin-capable types in the OpenFGA authorization model.
     */
    public const ADMIN_OBJECT_TYPES = [
        'national_calendar',
        'diocesan_calendar',
        'wider_region',
        'general_roman_calendar',
    ];

    public function __construct(private readonly OpenFgaClient $fgaClient)
    {
    }

    /**
     * Union of the objects the user holds `admin` on across ADMIN_OBJECT_TYPES.
     *
     * Fails closed: any OpenFGA transport error yields an empty scope set.
     *
     * @param string $sub Zitadel user ID (without "user:" prefix)
     * @return list<array{object_type: string, object_id: string}>
     */
    public function resolveScopes(string $sub): array
    {
        $fgaUser = "user:{$sub}";
        $scopes  = [];

        try {
            foreach (self::ADMIN_OBJECT_TYPES as $type) {
                foreach ($this->fgaClient->listObjects($fgaUser, 'admin', $type) as $objectId) {
                    $scopes[] = ['object_type' => $type, 'object_id' => $objectId];
                }
            }
        } catch (\RuntimeException) {
            // Fail closed — caller is treated as not-a-resource-admin.
            return [];
        }

        return $scopes;
    }

    /**
     * Filter requests to only those the resource admin administers in full.
     *
     * A request qualifies only if the admin holds the `admin` relation on
     * EVERY resource in that request's permissions array. Requests with an
     * empty permissions array are excluded.
     *
     * @param array<int, array<string, mixed>> $requests
     * @param string $adminUserId Admin's Zitadel user ID (without "user:" prefix)
     * @return array<int, array<string, mixed>> Filtered, re-indexed requests
     */
    public function filterByAdminAccess(array $requests, string $adminUserId): array
    {
        $fgaUser = "user:{$adminUserId}";

        /** @var array<string, bool> $cache */
        $cache = [];

        return array_values(array_filter($requests, function (array $req) use ($fgaUser, &$cache): bool {
            /** @var array<int, array{object_type: string, object_id: string, relation: string}> $permissions */
            $permissions = is_array($req['permissions'] ?? null) ? $req['permissions'] : [];
            return $this->administersAllResources($permissions, $fgaUser, $cache);
        }));
    }

    /**
     * True iff the admin holds `admin` on every resource in $permissions.
     *
     * An empty $permissions array returns false (matches the prior
     * AccessRequestAdminHandler behavior of excluding empty-permission
     * requests). The $cache de-duplicates OpenFGA `check` calls per resource.
     *
     * @param array<int, array{object_type: string, object_id: string, relation: string}> $permissions
     * @param string $fgaUser Fully-qualified FGA user (e.g. "user:cei-admin")
     * @param array<string, bool> $cache Shared per-call check cache (by reference)
     */
    public function administersAllResources(array $permissions, string $fgaUser, array &$cache): bool
    {
        if (empty($permissions)) {
            return false;
        }

        foreach ($permissions as $perm) {
            $objectType = $perm['object_type'] ?? '';
            $objectId   = $perm['object_id'] ?? '';
            $key        = "{$objectType}:{$objectId}";

            if (!isset($cache[$key])) {
                $cache[$key] = $this->fgaClient->check($fgaUser, 'admin', $key);
            }

            if (!$cache[$key]) {
                return false;
            }
        }

        return true;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Services/ResourceAdminServiceTest.php`
Expected: PASS (3 tests, OK).

- [ ] **Step 5: Lint + static analysis**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && composer lint && composer analyse`
Expected: no errors for `src/Services/ResourceAdminService.php` or the test.

- [ ] **Step 6: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
git add src/Services/ResourceAdminService.php phpunit_tests/Services/ResourceAdminServiceTest.php
git commit -m "feat(api): add ResourceAdminService for shared admin-scope logic"
```

---

### Task 2: API — refactor `AccessRequestAdminHandler::filterByAdminAccess` to use the service

**Files:**

- Modify: `LiturgicalCalendarAPI/src/Handlers/Admin/AccessRequestAdminHandler.php` (the `filterByAdminAccess` method, lines ~1003–1040)
- Test: `LiturgicalCalendarAPI/phpunit_tests/Handlers/Admin/AccessRequestAdminHandlerTest.php` (existing — must still pass; no new test)

**Interfaces:**

- Consumes: `ResourceAdminService::filterByAdminAccess(array $requests, string $adminUserId): array` (from Task 1),
  `$this->getFgaClient(): OpenFgaClient`, `$this->isFgaClientAvailable(): bool` (existing private methods).
- Produces: behavior-preserving private `filterByAdminAccess(array $requests, string $adminId): array` — identical outputs to today.

This is a behavior-preserving refactor. The deliverable's test is the existing handler suite continuing to pass.

- [ ] **Step 1: Run the existing tests to confirm the green baseline**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Handlers/Admin/AccessRequestAdminHandlerTest.php`
Expected: PASS (all existing tests green) — this is the regression oracle for the refactor.

- [ ] **Step 2: Add the service import**

In `src/Handlers/Admin/AccessRequestAdminHandler.php`, after the existing `use LiturgicalCalendar\Api\Services\RoleCascadeService;` line (line ~27), add:

```php
use LiturgicalCalendar\Api\Services\ResourceAdminService;
```

- [ ] **Step 3: Replace the method body with delegation**

Replace the existing method (lines ~1003–1040):

```php
    private function filterByAdminAccess(array $requests, string $adminId): array
    {
        if (!$this->isFgaClientAvailable()) {
            return [];
        }

        $fgaUser = "user:{$adminId}";

        // Cache admin checks to avoid redundant API calls
        /** @var array<string, bool> $cache */
        $cache = [];

        return array_values(array_filter($requests, function (array $req) use ($fgaUser, &$cache): bool {
            /** @var array<int, array{object_type: string, object_id: string, relation: string}> $permissions */
            $permissions = is_array($req['permissions'] ?? null) ? $req['permissions'] : [];

            if (empty($permissions)) {
                return false;
            }

            // Admin must have access to ALL resources in the request
            foreach ($permissions as $perm) {
                $objectType = $perm['object_type'] ?? '';
                $objectId   = $perm['object_id'] ?? '';
                $key        = "{$objectType}:{$objectId}";

                if (!isset($cache[$key])) {
                    $cache[$key] = $this->getFgaClient()->check($fgaUser, 'admin', $key);
                }

                if (!$cache[$key]) {
                    return false;
                }
            }

            return true;
        }));
    }
```

with:

```php
    private function filterByAdminAccess(array $requests, string $adminId): array
    {
        if (!$this->isFgaClientAvailable()) {
            return [];
        }

        return ( new ResourceAdminService($this->getFgaClient()) )->filterByAdminAccess($requests, $adminId);
    }
```

- [ ] **Step 4: Run the existing tests to verify behavior is preserved**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Handlers/Admin/AccessRequestAdminHandlerTest.php`
Expected: PASS (same count as Step 1, no regressions).

- [ ] **Step 5: Lint + static analysis**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && composer lint && composer analyse`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
git add src/Handlers/Admin/AccessRequestAdminHandler.php
git commit -m "refactor(api): delegate access-request admin filtering to ResourceAdminService"
```

---

### Task 3: API — `GET /auth/admin-scopes` handler + route

**Files:**

- Create: `LiturgicalCalendarAPI/src/Handlers/Auth/AdminScopesHandler.php`
- Modify: `LiturgicalCalendarAPI/src/Router.php` (auth route dispatch ~line 360, use statements ~line 27, OIDC gate ~line 613)
- Test: `LiturgicalCalendarAPI/phpunit_tests/Handlers/Auth/AdminScopesHandlerTest.php`

**Interfaces:**

- Consumes: `ResourceAdminService` (Task 1), `OpenFgaClient` (`fromEnv()`, `isConfigured()`),
  `OidcAuthMiddleware::isAdmin(array $oidcUser): bool`, request attribute `oidc_user` (`array{sub?: string, roles?: array<string>}`).
- Produces: JSON body `{"is_global_admin": bool, "is_resource_admin": bool, "admin_scopes": list<array{object_type: string, object_id: string}>}`.
  Constructor `__construct(?OpenFgaClient $fgaClient = null)` (injectable for tests).

- [ ] **Step 1: Write the failing test**

Create `LiturgicalCalendarAPI/phpunit_tests/Handlers/Auth/AdminScopesHandlerTest.php`:

```php
<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Tests\Handlers\Auth;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use LiturgicalCalendar\Api\Handlers\Auth\AdminScopesHandler;
use LiturgicalCalendar\Api\Http\Exception\UnauthorizedException;
use LiturgicalCalendar\Api\Services\OpenFgaClient;
use LiturgicalCalendar\Tests\Handlers\AbstractHandlerTestCase;
use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(AdminScopesHandler::class)]
final class AdminScopesHandlerTest extends AbstractHandlerTestCase
{
    /**
     * @param array<int, GuzzleResponse> $responses
     */
    private function handlerWith(array $responses): AdminScopesHandler
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
        return new AdminScopesHandler($client);
    }

    public function testMissingOidcUserIsUnauthorized(): void
    {
        $this->expectException(UnauthorizedException::class);
        $this->handlerWith([])->handle($this->requestFor('GET', '/auth/admin-scopes'));
    }

    public function testResourceAdminGetsScopes(): void
    {
        // Four list-objects responses, in ADMIN_OBJECT_TYPES order.
        $handler = $this->handlerWith([
            new GuzzleResponse(200, [], '{"objects":["national_calendar:IT"]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]);

        $request = $this->requestFor('GET', '/auth/admin-scopes')
            ->withAttribute('oidc_user', ['sub' => 'cei-admin', 'roles' => ['calendar_editor']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertFalse($body['is_global_admin']);
        self::assertTrue($body['is_resource_admin']);
        self::assertSame(
            [['object_type' => 'national_calendar', 'object_id' => 'IT']],
            $body['admin_scopes']
        );
    }

    public function testGlobalAdminIsFlaggedEvenWithNoFgaScopes(): void
    {
        $handler = $this->handlerWith([
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]);

        $request = $this->requestFor('GET', '/auth/admin-scopes')
            ->withAttribute('oidc_user', ['sub' => 'root', 'roles' => ['admin']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertTrue($body['is_global_admin']);
        self::assertFalse($body['is_resource_admin']);
        self::assertSame([], $body['admin_scopes']);
    }

    public function testPlainEditorGetsBothFalse(): void
    {
        $handler = $this->handlerWith([
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]);

        $request = $this->requestFor('GET', '/auth/admin-scopes')
            ->withAttribute('oidc_user', ['sub' => 'cei-editor', 'roles' => ['calendar_editor']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertFalse($body['is_global_admin']);
        self::assertFalse($body['is_resource_admin']);
        self::assertSame([], $body['admin_scopes']);
    }

    public function testFailsClosedWhenOpenFgaErrors(): void
    {
        $handler = $this->handlerWith([
            new GuzzleResponse(500, [], 'boom'),
        ]);

        $request = $this->requestFor('GET', '/auth/admin-scopes')
            ->withAttribute('oidc_user', ['sub' => 'cei-admin', 'roles' => ['admin']]);

        $body = $this->decodeJsonBody($handler->handle($request));

        self::assertTrue($body['is_global_admin']);
        self::assertFalse($body['is_resource_admin']);
        self::assertSame([], $body['admin_scopes']);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Handlers/Auth/AdminScopesHandlerTest.php`
Expected: FAIL — `Error: Class "LiturgicalCalendar\Api\Handlers\Auth\AdminScopesHandler" not found`.

- [ ] **Step 3: Create the handler**

Create `LiturgicalCalendarAPI/src/Handlers/Auth/AdminScopesHandler.php`:

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
 * Admin Scopes Handler
 *
 * GET /auth/admin-scopes — report the authenticated caller's admin status:
 *   - is_global_admin: the Zitadel `admin` role is present in the token.
 *   - admin_scopes: union of OpenFGA `admin` tuples across the admin-capable
 *     object types, as [{object_type, object_id}].
 *   - is_resource_admin: admin_scopes is non-empty.
 *
 * Fails closed: when OpenFGA is unavailable, admin_scopes is empty and
 * is_resource_admin is false, but is_global_admin is still honored from the token.
 */
final class AdminScopesHandler extends AbstractHandler
{
    private ?OpenFgaClient $fgaClient = null;

    public function __construct(?OpenFgaClient $fgaClient = null)
    {
        parent::__construct();

        $this->fgaClient            = $fgaClient;
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

        $scopes = [];
        if ($this->isFgaClientAvailable()) {
            $scopes = ( new ResourceAdminService($this->getFgaClient()) )->resolveScopes($sub);
        }

        return $this->encodeResponseBody($response, [
            'is_global_admin'   => $isGlobalAdmin,
            'is_resource_admin' => $scopes !== [],
            'admin_scopes'      => $scopes,
        ]);
    }
}
```

- [ ] **Step 4: Register the route in the Router (use statement)**

In `src/Router.php`, after the existing `use LiturgicalCalendar\Api\Handlers\Auth\EmailVerificationHandler;` line (line ~27), add:

```php
use LiturgicalCalendar\Api\Handlers\Auth\AdminScopesHandler;
```

- [ ] **Step 5: Register the route in the auth dispatch**

In `src/Router.php`, in the `case 'auth':` block, after the `notifications` branch
(the `elseif ($authRoute === 'notifications') { ... }` ending at line ~365), add a new branch before the closing `else`:

```php
                    } elseif ($authRoute === 'admin-scopes') {
                        // GET /auth/admin-scopes - Report caller's global/resource admin status + scopes
                        $adminScopesHandler = new AdminScopesHandler();
                        $this->handler      = $adminScopesHandler;
```

- [ ] **Step 6: Add the route to the OIDC-protected gate**

In `src/Router.php`, in the OIDC pipeline gate (line ~613), extend the auth allow-list array from:

```php
            ( $route === 'auth' && count($requestPathParts) >= 1 && in_array($requestPathParts[0], ['access-requests', 'email-verification', 'notifications'], true) )
```

to:

```php
            ( $route === 'auth' && count($requestPathParts) >= 1 && in_array($requestPathParts[0], ['access-requests', 'email-verification', 'notifications', 'admin-scopes'], true) )
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Handlers/Auth/AdminScopesHandlerTest.php`
Expected: PASS (5 tests, OK).

- [ ] **Step 8: Lint, analyse, syntax-check**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && composer parallel-lint && composer lint && composer analyse`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
git add src/Handlers/Auth/AdminScopesHandler.php src/Router.php phpunit_tests/Handlers/Auth/AdminScopesHandlerTest.php
git commit -m "feat(api): add GET /auth/admin-scopes endpoint"
```

---

### Task 4: API — widen `GET /admin/notifications` to resource-admins

**Files:**

- Modify: `LiturgicalCalendarAPI/src/Handlers/Admin/NotificationsHandler.php`
- Test: `LiturgicalCalendarAPI/phpunit_tests/Handlers/Admin/NotificationsHandlerTest.php` (existing — add new tests)

**Interfaces:**

- Consumes: `ResourceAdminService` (`resolveScopes`, `filterByAdminAccess`), `OpenFgaClient` (`fromEnv`, `isConfigured`),
  `OidcAuthMiddleware::isAdmin`, `AccessRequestRepository::getPending(): array` (oldest-first), existing `ApplicationRepository`.
- Produces: constructor `__construct(?OpenFgaClient $fgaClient = null)`; global-admin response unchanged; resource-admin response = scoped
  `pending_access_requests`, scoped `items` (cap 5, `url` = `admin-permissions.php`), `pending_applications` = 0, `total` = scoped count;
  plain editor → `ForbiddenException`.

- [ ] **Step 1: Run existing tests to confirm green baseline**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Handlers/Admin/NotificationsHandlerTest.php`
Expected: PASS (existing 5 tests green).

- [ ] **Step 2: Write the new failing tests**

Append these methods to the existing `LiturgicalCalendarAPI/phpunit_tests/Handlers/Admin/NotificationsHandlerTest.php` class body
(before the final closing `}`). Also add these imports at the top alongside the existing `use` statements:

```php
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use LiturgicalCalendar\Api\Services\OpenFgaClient;
use Nyholm\Psr7\Factory\Psr17Factory;
```

New test methods:

```php
    /**
     * @param array<int, GuzzleResponse> $responses
     */
    private function handlerWithFga(array $responses): NotificationsHandler
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
        return new NotificationsHandler($client);
    }

    public function testResourceAdminGetsScopedCount(): void
    {
        $accessRepo = new AccessRequestRepository(self::$pdo);
        // Request the resource-admin administers (national_calendar:IT)
        $accessRepo->create('user-it', 'it@x.test', 'ItUser', 'calendar_editor', [
            ['object_type' => 'national_calendar', 'object_id' => 'IT', 'relation' => 'editor'],
        ]);
        usleep(2000);
        // Request the resource-admin does NOT administer (national_calendar:US)
        $accessRepo->create('user-us', 'us@x.test', 'UsUser', 'calendar_editor', [
            ['object_type' => 'national_calendar', 'object_id' => 'US', 'relation' => 'editor'],
        ]);

        // resolveScopes: 4 list-objects calls (national_calendar -> IT, rest empty),
        // then filterByAdminAccess: 1 check() per request (IT -> allowed, US -> denied).
        $handler = $this->handlerWithFga([
            new GuzzleResponse(200, [], '{"objects":["national_calendar:IT"]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"allowed":true}'),
            new GuzzleResponse(200, [], '{"allowed":false}'),
        ]);

        $request = $this->requestFor('GET', '/admin/notifications')
            ->withAttribute('oidc_user', ['sub' => 'cei-admin', 'roles' => ['calendar_editor']]);

        $response = $handler->handle($request);

        self::assertSame(200, $response->getStatusCode());
        $body = $this->decodeJsonBody($response);
        self::assertSame(1, $body['pending_access_requests']);
        self::assertSame(0, $body['pending_applications']);
        self::assertSame(1, $body['total']);
        self::assertCount(1, $body['items']);
        self::assertSame('access_request', $body['items'][0]['type']);
        self::assertSame('admin-permissions.php', $body['items'][0]['url']);
    }

    public function testPlainEditorWithNoScopesIsForbidden(): void
    {
        // resolveScopes: 4 empty list-objects responses -> no scopes -> rejected.
        $handler = $this->handlerWithFga([
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
            new GuzzleResponse(200, [], '{"objects":[]}'),
        ]);

        $request = $this->requestFor('GET', '/admin/notifications')
            ->withAttribute('oidc_user', ['sub' => 'plain-editor', 'roles' => ['calendar_editor']]);

        $this->expectException(ForbiddenException::class);
        $this->expectExceptionMessage('Admin role required');

        $handler->handle($request);
    }
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run:

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
vendor/bin/phpunit --filter 'testResourceAdminGetsScopedCount|testPlainEditorWithNoScopesIsForbidden' phpunit_tests/Handlers/Admin/NotificationsHandlerTest.php
```

Expected: FAIL — `testResourceAdminGetsScopedCount` fails (resource-admin currently gets `ForbiddenException`);
`testPlainEditorWithNoScopesIsForbidden` may error on the `NotificationsHandler` constructor not accepting an argument.

- [ ] **Step 4: Add the FGA imports + constructor + getters to the handler**

In `src/Handlers/Admin/NotificationsHandler.php`, add these imports after the existing `use LiturgicalCalendar\Api\Repositories\ApplicationRepository;` line (line ~16):

```php
use LiturgicalCalendar\Api\Services\OpenFgaClient;
use LiturgicalCalendar\Api\Services\ResourceAdminService;
```

Replace the property block + constructor (lines ~30–40):

```php
    private ?AccessRequestRepository $accessRequestRepo = null;
    private ?ApplicationRepository $applicationRepo     = null;

    public function __construct()
    {
        parent::__construct();

        $this->allowedRequestMethods = [RequestMethod::GET];
        $this->allowedAcceptHeaders  = [AcceptHeader::JSON];
        $this->allowCredentials      = true;
    }
```

with:

```php
    private ?AccessRequestRepository $accessRequestRepo = null;
    private ?ApplicationRepository $applicationRepo     = null;
    private ?OpenFgaClient $fgaClient                   = null;

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
```

- [ ] **Step 5: Branch the handler on global vs resource admin**

In `src/Handlers/Admin/NotificationsHandler.php`, replace the block from the admin-role check through the end of the
`if (Connection::isConfigured()) { ... }` body (lines ~81–149) — that is, replace:

```php
        // Verify admin role
        if (!OidcAuthMiddleware::isAdmin($oidcUser)) {
            throw new ForbiddenException('Admin role required');
        }

        // Get notification counts
        $notifications = [
            'pending_access_requests' => 0,
            'pending_applications'    => 0,
            'total'                   => 0,
            'items'                   => [],
        ];

        if (Connection::isConfigured()) {
            // Get access request counts (unified role + permission requests)
            $accessRequestRepo                        = $this->getAccessRequestRepository();
            $notifications['pending_access_requests'] = $accessRequestRepo->countPending();

            // Get recent pending access requests for the dropdown.
            // getPending() returns oldest-first (ORDER BY created_at ASC),
            // so take the last 5 and reverse to display newest-first.
            $pendingRequests = $accessRequestRepo->getPending();
            $recentPending   = array_reverse(array_slice($pendingRequests, -5));
            foreach ($recentPending as $req) {
                $displayName              = !empty($req['user_name'])
                    ? $req['user_name']
                    : ( !empty($req['user_email'])
                        ? $req['user_email']
                        : ( 'User ' . substr(is_string($req['zitadel_user_id'] ?? null) ? $req['zitadel_user_id'] : '', -6) ) );
                $notifications['items'][] = [
                    'type'       => 'access_request',
                    'id'         => $req['id'] ?? '',
                    'user_name'  => $displayName,
                    'user_email' => $req['user_email'] ?? '',
                    'role'       => $req['requested_role'] ?? '',
                    'created_at' => $req['created_at'] ?? '',
                    'url'        => 'admin-permissions.php',
                ];
            }

            // Get pending applications count
            $applicationRepo                       = $this->getApplicationRepository();
            $notifications['pending_applications'] = $applicationRepo->countPendingApplications();

            // Get recent pending applications for the dropdown
            $pendingApps = $applicationRepo->getPendingApplications();
            foreach (array_slice($pendingApps, 0, 5) as $app) {
                $notifications['items'][] = [
                    'type'            => 'application',
                    'id'              => $app['id'] ?? '',
                    'app_name'        => $app['name'] ?? 'Unknown',
                    'zitadel_user_id' => $app['zitadel_user_id'] ?? '',
                    'requested_scope' => $app['requested_scope'] ?? 'read',
                    'created_at'      => $app['created_at'] ?? '',
                    'url'             => 'admin-applications.php',
                ];
            }

            // Sort items by created_at descending and limit to 5 most recent
            usort($notifications['items'], function ($a, $b) {
                $aDate = is_string($a['created_at']) ? $a['created_at'] : '';
                $bDate = is_string($b['created_at']) ? $b['created_at'] : '';
                return strcmp($bDate, $aDate);
            });
            $notifications['items'] = array_slice($notifications['items'], 0, 5);

            $notifications['total'] = $notifications['pending_access_requests']
                                    + $notifications['pending_applications'];
        }
```

with:

```php
        $isGlobalAdmin = OidcAuthMiddleware::isAdmin($oidcUser);
        $sub           = $oidcUser['sub'] ?? null;

        // Get notification counts
        $notifications = [
            'pending_access_requests' => 0,
            'pending_applications'    => 0,
            'total'                   => 0,
            'items'                   => [],
        ];

        if ($isGlobalAdmin) {
            if (Connection::isConfigured()) {
                $notifications = $this->buildGlobalAdminNotifications($notifications);
            }
        } else {
            // Resource-admin path: admit only callers who hold an OpenFGA admin
            // tuple on at least one resource. Fail closed when FGA is unavailable.
            if (!$this->isFgaClientAvailable() || !is_string($sub) || trim($sub) === '') {
                throw new ForbiddenException('Admin role required');
            }

            $scopeService = new ResourceAdminService($this->getFgaClient());
            if ($scopeService->resolveScopes($sub) === []) {
                throw new ForbiddenException('Admin role required');
            }

            if (Connection::isConfigured()) {
                $notifications = $this->buildResourceAdminNotifications($notifications, $scopeService, $sub);
            }
        }
```

- [ ] **Step 6: Extract the two builder methods**

In `src/Handlers/Admin/NotificationsHandler.php`, add these two private methods after the `handle()` method (before the final closing `}` of the class):

```php
    /**
     * Build the unscoped (global-admin) notification payload.
     *
     * @param array{pending_access_requests: int, pending_applications: int, total: int, items: array<int, array<string, mixed>>} $notifications
     * @return array{pending_access_requests: int, pending_applications: int, total: int, items: array<int, array<string, mixed>>}
     */
    private function buildGlobalAdminNotifications(array $notifications): array
    {
        $accessRequestRepo                        = $this->getAccessRequestRepository();
        $notifications['pending_access_requests'] = $accessRequestRepo->countPending();

        // getPending() returns oldest-first (ORDER BY created_at ASC),
        // so take the last 5 and reverse to display newest-first.
        $pendingRequests = $accessRequestRepo->getPending();
        $recentPending   = array_reverse(array_slice($pendingRequests, -5));
        foreach ($recentPending as $req) {
            $notifications['items'][] = $this->accessRequestItem($req);
        }

        $applicationRepo                       = $this->getApplicationRepository();
        $notifications['pending_applications'] = $applicationRepo->countPendingApplications();

        $pendingApps = $applicationRepo->getPendingApplications();
        foreach (array_slice($pendingApps, 0, 5) as $app) {
            $notifications['items'][] = [
                'type'            => 'application',
                'id'              => $app['id'] ?? '',
                'app_name'        => $app['name'] ?? 'Unknown',
                'zitadel_user_id' => $app['zitadel_user_id'] ?? '',
                'requested_scope' => $app['requested_scope'] ?? 'read',
                'created_at'      => $app['created_at'] ?? '',
                'url'             => 'admin-applications.php',
            ];
        }

        usort($notifications['items'], function ($a, $b) {
            $aDate = is_string($a['created_at']) ? $a['created_at'] : '';
            $bDate = is_string($b['created_at']) ? $b['created_at'] : '';
            return strcmp($bDate, $aDate);
        });
        $notifications['items'] = array_slice($notifications['items'], 0, 5);

        $notifications['total'] = $notifications['pending_access_requests']
                                + $notifications['pending_applications'];

        return $notifications;
    }

    /**
     * Build the scoped (resource-admin) notification payload: only the pending
     * access-requests the caller administers; no applications.
     *
     * @param array{pending_access_requests: int, pending_applications: int, total: int, items: array<int, array<string, mixed>>} $notifications
     * @return array{pending_access_requests: int, pending_applications: int, total: int, items: array<int, array<string, mixed>>}
     */
    private function buildResourceAdminNotifications(
        array $notifications,
        ResourceAdminService $scopeService,
        string $sub
    ): array {
        $pendingRequests = $this->getAccessRequestRepository()->getPending();
        $scoped          = $scopeService->filterByAdminAccess($pendingRequests, $sub);

        $notifications['pending_access_requests'] = count($scoped);
        $notifications['pending_applications']    = 0;
        $notifications['total']                   = count($scoped);

        // getPending() is oldest-first; filter preserves order. Newest 5, newest-first.
        $recentScoped = array_reverse(array_slice($scoped, -5));
        foreach ($recentScoped as $req) {
            $notifications['items'][] = $this->accessRequestItem($req);
        }

        return $notifications;
    }

    /**
     * Build a single access_request notification item.
     *
     * @param array<string, mixed> $req
     * @return array<string, mixed>
     */
    private function accessRequestItem(array $req): array
    {
        $displayName = !empty($req['user_name'])
            ? $req['user_name']
            : ( !empty($req['user_email'])
                ? $req['user_email']
                : ( 'User ' . substr(is_string($req['zitadel_user_id'] ?? null) ? $req['zitadel_user_id'] : '', -6) ) );

        return [
            'type'       => 'access_request',
            'id'         => $req['id'] ?? '',
            'user_name'  => $displayName,
            'user_email' => $req['user_email'] ?? '',
            'role'       => $req['requested_role'] ?? '',
            'created_at' => $req['created_at'] ?? '',
            'url'        => 'admin-permissions.php',
        ];
    }
```

- [ ] **Step 7: Run the full NotificationsHandler suite**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && vendor/bin/phpunit phpunit_tests/Handlers/Admin/NotificationsHandlerTest.php`
Expected: PASS — the 5 existing tests plus the 2 new ones (7 total, OK). In particular `testNonAdminIsForbidden` still passes
(viewer, no FGA configured/injected → `isFgaClientAvailable()` false → `ForbiddenException('Admin role required')`).

- [ ] **Step 8: Lint + analyse**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI && composer lint && composer analyse`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarAPI
git add src/Handlers/Admin/NotificationsHandler.php phpunit_tests/Handlers/Admin/NotificationsHandlerTest.php
git commit -m "feat(api): scope GET /admin/notifications for resource-admins"
```

---

### Task 5: Frontend — `AuthHelper::isResourceAdmin()` / `adminScopes()` (+ PHPUnit scaffolding)

**Files:**

- Modify: `LiturgicalCalendarFrontend/src/AuthHelper.php` (add methods after `hasPermission()`, ~line 302)
- Create: `LiturgicalCalendarFrontend/phpunit.xml`
- Modify: `LiturgicalCalendarFrontend/composer.json` (add `autoload-dev`)
- Test: `LiturgicalCalendarFrontend/tests/AuthHelperAdminScopesTest.php`

**Interfaces:**

- Consumes: `GuzzleHttp\Client` (already a dependency), `$_COOKIE['litcal_access_token']`, `$_COOKIE['litcal_id_token']`,
  `LiturgicalCalendar\Frontend\ApiConfig::getInstance()->apiBaseUrl` (initialized in `includes/common.php`).
- Produces (relied on by Tasks 7, 8):
  - `public function isResourceAdmin(): bool`
  - `public function adminScopes(): array` → `list<array{object_type: string, object_id: string}>`
  - `public static function fetchAdminScopes(string $apiBaseUrl, ?string $cookieHeader, ?\GuzzleHttp\Client $client = null): array` →
    `array{is_resource_admin: bool, admin_scopes: list<array{object_type: string, object_id: string}>}`;
    fail-closed `['is_resource_admin' => false, 'admin_scopes' => []]` on any error.

- [ ] **Step 1: Add the frontend test autoloading + PHPUnit config**

In `LiturgicalCalendarFrontend/composer.json`, add an `autoload-dev` block immediately after the existing `autoload` block:

```json
    "autoload-dev": {
        "psr-4": {
            "LiturgicalCalendar\\Frontend\\Tests\\": "tests/"
        }
    },
```

Create `LiturgicalCalendarFrontend/phpunit.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
         cacheDirectory=".phpunit.cache">
    <testsuites>
        <testsuite name="frontend">
            <directory>tests</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>src</directory>
        </include>
    </source>
</phpunit>
```

Regenerate the autoloader:

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && composer dump-autoload`
Expected: `Generated autoload files`.

- [ ] **Step 2: Write the failing test**

Create `LiturgicalCalendarFrontend/tests/AuthHelperAdminScopesTest.php`:

```php
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && vendor/bin/phpunit tests/AuthHelperAdminScopesTest.php`
Expected: FAIL — `Error: Call to undefined method LiturgicalCalendar\Frontend\AuthHelper::fetchAdminScopes()`.

- [ ] **Step 4: Implement the methods**

In `src/AuthHelper.php`, add a memoization property. After the existing `public readonly ?array $permissions;` declaration (line ~45), add:

```php

    /**
     * Memoized admin-scopes result for this request.
     * Shape: array{is_resource_admin: bool, admin_scopes: list<array{object_type: string, object_id: string}>}
     *
     * @var array{is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>}|null
     */
    private ?array $adminScopesResult = null;
```

Then, in `src/AuthHelper.php`, after the `hasPermission()` method (ends at line ~302), add:

```php

    /**
     * Whether the caller holds an OpenFGA `admin` tuple on at least one resource.
     *
     * Resolved once per request from GET /auth/admin-scopes (server-side, using
     * the caller's session cookies). Fails closed: an unauthenticated caller or
     * any API/parse error yields false.
     */
    public function isResourceAdmin(): bool
    {
        return $this->loadAdminScopes()['is_resource_admin'];
    }

    /**
     * The caller's OpenFGA `admin` scopes.
     *
     * @return array<int, array{object_type: string, object_id: string}>
     */
    public function adminScopes(): array
    {
        return $this->loadAdminScopes()['admin_scopes'];
    }

    /**
     * Resolve (and memoize) the admin-scopes result for this request.
     *
     * @return array{is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>}
     */
    private function loadAdminScopes(): array
    {
        if ($this->adminScopesResult !== null) {
            return $this->adminScopesResult;
        }

        // Fail closed for unauthenticated callers — never hit the API.
        if (!$this->isAuthenticated) {
            return $this->adminScopesResult = ['is_resource_admin' => false, 'admin_scopes' => []];
        }

        $apiBaseUrl   = ApiConfig::getInstance()->apiBaseUrl;
        $cookieHeader = self::buildCookieHeader();

        return $this->adminScopesResult = self::fetchAdminScopes($apiBaseUrl, $cookieHeader);
    }

    /**
     * Build a Cookie header from the session token cookies, to forward the
     * caller's identity to the API on the server-to-server call.
     */
    private static function buildCookieHeader(): ?string
    {
        $parts = [];
        foreach ([self::ACCESS_TOKEN_COOKIE, self::ID_TOKEN_COOKIE] as $name) {
            $value = $_COOKIE[$name] ?? null;
            if (is_string($value) && $value !== '') {
                $parts[] = "{$name}={$value}";
            }
        }
        return $parts === [] ? null : implode('; ', $parts);
    }

    /**
     * Fetch and parse GET /auth/admin-scopes. Fails closed on any error.
     *
     * @param string $apiBaseUrl Base API URL (no trailing slash)
     * @param string|null $cookieHeader Cookie header forwarding the caller's session
     * @param \GuzzleHttp\Client|null $client Injectable client (tests)
     * @return array{is_resource_admin: bool, admin_scopes: array<int, array{object_type: string, object_id: string}>}
     */
    public static function fetchAdminScopes(
        string $apiBaseUrl,
        ?string $cookieHeader,
        ?\GuzzleHttp\Client $client = null
    ): array {
        $failClosed = ['is_resource_admin' => false, 'admin_scopes' => []];

        $client ??= new \GuzzleHttp\Client(['timeout' => 5, 'connect_timeout' => 2, 'http_errors' => true]);

        $headers = ['Accept' => 'application/json'];
        if ($cookieHeader !== null) {
            $headers['Cookie'] = $cookieHeader;
        }

        try {
            $response = $client->get("{$apiBaseUrl}/auth/admin-scopes", ['headers' => $headers]);
            $data     = json_decode((string) $response->getBody(), true);
        } catch (\Throwable) {
            return $failClosed;
        }

        if (!is_array($data)) {
            return $failClosed;
        }

        $scopes = [];
        if (isset($data['admin_scopes']) && is_array($data['admin_scopes'])) {
            foreach ($data['admin_scopes'] as $scope) {
                if (
                    is_array($scope)
                    && isset($scope['object_type'], $scope['object_id'])
                    && is_string($scope['object_type'])
                    && is_string($scope['object_id'])
                ) {
                    $scopes[] = ['object_type' => $scope['object_type'], 'object_id' => $scope['object_id']];
                }
            }
        }

        return [
            'is_resource_admin' => (bool) ( $data['is_resource_admin'] ?? false ),
            'admin_scopes'      => $scopes,
        ];
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && vendor/bin/phpunit tests/AuthHelperAdminScopesTest.php`
Expected: PASS (3 tests, OK).

- [ ] **Step 6: Lint + analyse**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && composer parallel-lint && composer lint && composer analyse`
Expected: no errors. (If phpcs flags `src/AuthHelper.php`, run `composer lint:fix` and re-run.)

- [ ] **Step 7: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
git add composer.json phpunit.xml tests/AuthHelperAdminScopesTest.php src/AuthHelper.php
git commit -m "feat(frontend): add AuthHelper::isResourceAdmin()/adminScopes()"
```

---

### Task 6: Frontend — `Auth.isResourceAdmin()` (client-side, cached)

**Files:**

- Modify: `LiturgicalCalendarFrontend/assets/js/auth.js` (add a method after `hasRole()`, ~line 788)

**Interfaces:**

- Consumes: global `BaseUrl` (API base URL), `Auth._validateBaseUrl(methodName)` (existing private helper), `fetch` with `credentials: 'include'`.
- Produces (relied on by Task 9): `Auth.isResourceAdmin(): Promise<boolean>` — fetches `GET ${BaseUrl}/auth/admin-scopes` once
  and caches the boolean for the page; fails closed to `false`.

This is vanilla browser JS; behavioral coverage comes from Phase 2 E2E. Verification here is syntax + lint (project convention: `node --check` + ESLint).

- [ ] **Step 1: Add the cache fields**

In `assets/js/auth.js`, in the `Auth` object after the `_isLoggingOut: false,` property (line ~65), add:

```javascript

    /**
     * Cached resource-admin result for this page load (null = not yet fetched).
     * @private
     */
    _resourceAdminCache: null,

    /**
     * In-flight resource-admin fetch, to dedupe concurrent callers.
     * @private
     */
    _resourceAdminPromise: null,
```

- [ ] **Step 2: Add the method**

In `assets/js/auth.js`, after the `hasRole(role)` method (ends ~line 788, before `getUsername()`), add:

```javascript

    /**
     * Check whether the caller is an OpenFGA resource-admin (holds an `admin`
     * tuple on at least one resource) via GET /auth/admin-scopes.
     *
     * Result is cached for the page load and concurrent calls are deduped.
     * Fails closed to false on any network/API error.
     *
     * @returns {Promise<boolean>} True if the caller is a resource-admin
     */
    async isResourceAdmin() {
        if (this._resourceAdminCache !== null) {
            return this._resourceAdminCache;
        }
        if (this._resourceAdminPromise !== null) {
            return this._resourceAdminPromise;
        }
        if (!this._validateBaseUrl('isResourceAdmin')) {
            return false;
        }

        this._resourceAdminPromise = (async () => {
            try {
                const response = await fetch(`${BaseUrl}/auth/admin-scopes`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) {
                    return false;
                }
                const data = await response.json();
                return Boolean(data.is_resource_admin);
            } catch (error) {
                console.error('Auth.isResourceAdmin failed:', error);
                return false;
            }
        })();

        try {
            this._resourceAdminCache = await this._resourceAdminPromise;
            return this._resourceAdminCache;
        } finally {
            this._resourceAdminPromise = null;
        }
    },
```

Note: there is already a comma after the `hasRole()` method's closing `}` (it is followed by `getUsername()`),
so insert this block between them and keep the trailing comma after the new method.

- [ ] **Step 3: Syntax check**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && node --check assets/js/auth.js`
Expected: no output (exit 0).

- [ ] **Step 4: ESLint**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && yarn lint`
Expected: no new errors for `assets/js/auth.js`.

- [ ] **Step 5: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
git add assets/js/auth.js
git commit -m "feat(frontend): add Auth.isResourceAdmin() client signal"
```

---

### Task 7: Frontend — `admin-permissions.php` gate + global-only FGA section

**Files:**

- Modify: `LiturgicalCalendarFrontend/admin-permissions.php` (gate ~lines 19–26; FGA-section markup ~lines 53–132 and the Grant/Revoke modals ~lines 265–345; config block ~line 349)
- Modify: `LiturgicalCalendarFrontend/assets/js/admin-permissions.js` (modal instantiation lines 30 & 90; FGA event-listener/init block lines ~494–519)

**Interfaces:**

- Consumes: `$authHelper->hasRole('admin')`, `$authHelper->isResourceAdmin()` (Task 5); `window.AdminPermissionsConfig.isGlobalAdmin` (new flag).
- Produces: page admits global OR resource admins; FGA permission-tuple management section + its JS init render only for global admins; access-requests review section renders for both.

This task mixes PHP (testable by `composer lint` + manual reasoning) and browser JS (E2E-covered). Verification is `composer lint` + `node --check`.

- [ ] **Step 1: Widen the gate and compute `$isGlobalAdmin`**

In `admin-permissions.php`, replace lines 19–26:

```php
// Check if user has admin role
$isAdmin = $authHelper->hasRole('admin');

// Redirect non-admins to dashboard
if (!$isAdmin) {
    header('Location: admin-dashboard.php');
    exit;
}
```

with:

```php
// Global admins manage everything; resource-admins may review the access
// requests scoped to the resources they administer. The API enforces the
// actual scoping — this gate only decides who the UI lets in.
$isGlobalAdmin = $authHelper->hasRole('admin');
$isResourceAdmin = $authHelper->isResourceAdmin();

// Redirect users who are neither to the dashboard.
if (!$isGlobalAdmin && !$isResourceAdmin) {
    header('Location: admin-dashboard.php');
    exit;
}
```

- [ ] **Step 2: Wrap the FGA Filter Controls + Action Buttons + Permissions Table in `if ($isGlobalAdmin)`**

In `admin-permissions.php`, immediately before the `<!-- Filter Controls -->` comment (line 53), add:

```php
    <?php if ($isGlobalAdmin) : ?>
```

and immediately after the closing `</div>` of the Permissions Table card (the `</div>` that ends the card opened at line 120,
just before the `<!-- Access Requests Review Section -->` comment at line 134), add:

```php
    <?php endif; ?>
```

- [ ] **Step 3: Wrap the Grant + Revoke modals in `if ($isGlobalAdmin)`**

In `admin-permissions.php`, immediately before the `<!-- Grant Permission Modal -->` comment (line 265), add:

```php
    <?php if ($isGlobalAdmin) : ?>
```

and immediately after the closing `</div>` that ends the Revoke Confirmation Modal (the modal opened at line 321,
ending just before the `<!-- Config for JavaScript -->` comment at line 347), add:

```php
    <?php endif; ?>
```

- [ ] **Step 4: Expose the `isGlobalAdmin` flag to JS**

In `admin-permissions.php`, in the `window.AdminPermissionsConfig` object literal (line 349), add an `isGlobalAdmin` member right after the `apiUrl` line:

```php
        window.AdminPermissionsConfig = {
            apiUrl: <?php echo json_encode($apiBaseUrl); ?>,
            isGlobalAdmin: <?php echo json_encode($isGlobalAdmin); ?>,
```

- [ ] **Step 5: Make the two FGA modal instantiations null-safe in JS**

In `assets/js/admin-permissions.js`, replace line 30:

```javascript
    const grantModal = new bootstrap.Modal(document.getElementById('grantModal'));
```

with:

```javascript
    const grantModalEl = document.getElementById('grantModal');
    const grantModal = grantModalEl ? new bootstrap.Modal(grantModalEl) : null;
```

and replace line 90:

```javascript
    const revokeModal = new bootstrap.Modal(document.getElementById('revokeModal'));
```

with:

```javascript
    const revokeModalEl = document.getElementById('revokeModal');
    const revokeModal = revokeModalEl ? new bootstrap.Modal(revokeModalEl) : null;
```

- [ ] **Step 6: Skip the FGA event-listener + load init for resource-admins**

In `assets/js/admin-permissions.js`, wrap the FGA event-listener registration and initial load (the `// Event listeners` block
through the `loadUserMap().then(loadPermissions);` line, lines ~493–519) in a global-admin guard. Replace:

```javascript
    // Event listeners
    refreshBtn.addEventListener('click', async function() {
        const icon = this.querySelector('i');
        icon.classList.add('fa-spin');
        // Refresh user map first so newly-granted-to users appear with friendly names.
        await loadUserMap();
        loadPermissions().finally(function() {
            icon.classList.remove('fa-spin');
        });
    });

    grantPermissionBtn.addEventListener('click', openGrantModal);
    grantObjectType.addEventListener('change', (e) => syncObjectIdField(e.target.value));
    confirmGrantBtn.addEventListener('click', handleGrant);
    confirmRevokeBtn.addEventListener('click', handleRevoke);
    applyFiltersBtn.addEventListener('click', loadPermissions);

    clearFiltersBtn.addEventListener('click', function() {
        filterUser.value = '';
        filterObjectType.value = '';
        filterObjectId.value = '';
        filterRelation.value = '';
        loadPermissions();
    });

    // Load user map and then permissions on page load
    loadUserMap().then(loadPermissions);
```

with:

```javascript
    // Event listeners — the FGA permission-tuple management section is
    // global-admin-only; its DOM is absent for resource-admins, so skip its
    // wiring and initial load entirely.
    if (config.isGlobalAdmin) {
        refreshBtn.addEventListener('click', async function() {
            const icon = this.querySelector('i');
            icon.classList.add('fa-spin');
            // Refresh user map first so newly-granted-to users appear with friendly names.
            await loadUserMap();
            loadPermissions().finally(function() {
                icon.classList.remove('fa-spin');
            });
        });

        grantPermissionBtn.addEventListener('click', openGrantModal);
        grantObjectType.addEventListener('change', (e) => syncObjectIdField(e.target.value));
        confirmGrantBtn.addEventListener('click', handleGrant);
        confirmRevokeBtn.addEventListener('click', handleRevoke);
        applyFiltersBtn.addEventListener('click', loadPermissions);

        clearFiltersBtn.addEventListener('click', function() {
            filterUser.value = '';
            filterObjectType.value = '';
            filterObjectId.value = '';
            filterRelation.value = '';
            loadPermissions();
        });

        // Load user map and then permissions on page load
        loadUserMap().then(loadPermissions);
    }
```

- [ ] **Step 7: PHP lint + JS syntax check + ESLint**

Run:

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
composer parallel-lint && composer lint && node --check assets/js/admin-permissions.js && yarn lint
```

Expected: no errors. (If phpcs flags `admin-permissions.php`, run `composer lint:fix` and re-run.)

- [ ] **Step 8: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
git add admin-permissions.php assets/js/admin-permissions.js
git commit -m "feat(frontend): admit resource-admins to admin-permissions review UI"
```

---

### Task 8: Frontend — `admin-dashboard.php` "Access Requests to Review" card

**Files:**

- Modify: `LiturgicalCalendarFrontend/admin-dashboard.php` (after the `<?php endif; ?>` of the global-admin section, line 141)

**Interfaces:**

- Consumes: `$authHelper->isResourceAdmin()` (Task 5), `$isAdmin` (existing, `= $authHelper->hasRole('admin')`).
- Produces: a dashboard card linking to `admin-permissions.php`, shown only when `isResourceAdmin() && !$isAdmin`.

- [ ] **Step 1: Add the resource-admin card**

In `admin-dashboard.php`, immediately after the global-admin section's `<?php endif; ?>` (line 141) and before `<?php include_once('./layout/footer.php'); ?>` (line 143), add:

```php
    <?php if (!$isAdmin && $authHelper->isResourceAdmin()) : ?>
    <hr class="my-4">
    <h4 class="mb-3 text-black" style="--bs-text-opacity: .6;">
        <i class="fas fa-user-shield me-2"></i><?php echo htmlspecialchars(_('Administration'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    </h4>
    <div class="row">
        <div class="col-12 col-md-6 col-lg-4 mb-4">
            <div class="card admin-block shadow h-100 border-dark">
                <div class="card-body text-center d-flex flex-column">
                    <div class="admin-block-icon mb-3">
                        <i class="fas fa-inbox fa-3x text-dark"></i>
                    </div>
                    <h5 class="card-title"><?php echo htmlspecialchars(_('Access Requests to Review'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></h5>
                    <p class="card-text text-muted small flex-grow-1">
                        <?php echo htmlspecialchars(_('Review and approve access requests for the resources you administer'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </p>
                    <div class="admin-block-actions mt-auto">
                        <a href="admin-permissions.php" class="btn btn-dark btn-sm">
                            <i class="fas fa-tasks me-1"></i><?php echo htmlspecialchars(_('Review'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>

```

- [ ] **Step 2: PHP lint**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && composer parallel-lint && composer lint`
Expected: no errors. (If phpcs flags the file, run `composer lint:fix` and re-run.)

- [ ] **Step 3: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
git add admin-dashboard.php
git commit -m "feat(frontend): add resource-admin review card to admin dashboard"
```

---

### Task 9: Frontend — `notifications.js` admin mode for resource-admins

**Files:**

- Modify: `LiturgicalCalendarFrontend/assets/js/notifications.js` (the `init()` method, ~line 47–67; mode decision at line 55)

**Interfaces:**

- Consumes: `Auth.hasRole('admin')` (existing), `Auth.isResourceAdmin()` (Task 6, async).
- Produces: `init()` becomes async; `this._mode` is `'admin'` when `Auth.hasRole('admin') || await Auth.isResourceAdmin()`, else `'user'`.
  The `seen` POST stays user-mode only (unchanged at line 77–79).

Behavioral coverage is Phase 2 E2E; verification here is `node --check` + ESLint.

- [ ] **Step 1: Make `init()` async and resolve the mode for resource-admins**

In `assets/js/notifications.js`, replace the `init()` method (lines 47–67):

```javascript
    init() {
        if (this._initialized) {
            return;
        }
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
            return;
        }

        this._mode = Auth.hasRole('admin') ? 'admin' : 'user';
        this._initialized = true;
        console.log(`Notifications: Initializing in ${this._mode} mode`);

        // Container should already be visible from PHP for any authenticated
        // user, but force it here in case auth state changed after page load.
        const container = document.getElementById('notificationsContainer');
        if (container) {
            container.classList.remove('d-none');
        }

        this._startNotificationServices();
    },
```

with:

```javascript
    async init() {
        if (this._initialized) {
            return;
        }
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
            return;
        }

        // Global admins use the review queue; resource-admins do too, but the
        // API scopes /admin/notifications to the resources they administer.
        const isAdmin = Auth.hasRole('admin') || await Auth.isResourceAdmin();
        this._mode = isAdmin ? 'admin' : 'user';
        this._initialized = true;
        console.log(`Notifications: Initializing in ${this._mode} mode`);

        // Container should already be visible from PHP for any authenticated
        // user, but force it here in case auth state changed after page load.
        const container = document.getElementById('notificationsContainer');
        if (container) {
            container.classList.remove('d-none');
        }

        this._startNotificationServices();
    },
```

- [ ] **Step 2: Confirm callers tolerate the now-async `init()`**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && grep -rn "Notifications.init\|\.init()" assets/js/ layout/ includes/ | grep -i notif`
Expected: identify each call site. `init()` previously returned `undefined`; callers ignore the return value, so making it async
(returns a Promise that is ignored) is safe — no caller change required. If any call site `await`s or chains `.then()` on `init()`,
leave it; an async function is awaitable. Record the finding; no edit needed unless a caller depends on synchronous completion
(none do — `init()` already deferred work to `_startNotificationServices()` which itself fires async fetches).

- [ ] **Step 3: JS syntax check + ESLint**

Run: `cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend && node --check assets/js/notifications.js && yarn lint`
Expected: no errors for `assets/js/notifications.js`.

- [ ] **Step 4: Commit**

```bash
cd /home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend
git add assets/js/notifications.js
git commit -m "feat(frontend): resource-admins use review-queue notification bell"
```

---

## Self-Review

Spec section → task mapping:

- **Component 1 — API `GET /auth/admin-scopes` (new handler, OIDC-protected, listObjects over the four types, is_global_admin from token,
  fail-closed):** Task 3 (handler + Router dispatch + OIDC gate). The four object types live in `ResourceAdminService::ADMIN_OBJECT_TYPES`
  (Task 1); fail-closed in `resolveScopes` (Task 1) + the `isFgaClientAvailable()` guard (Task 3).
- **Component 2 — extract the per-request "administers every resource" predicate into a reusable helper; `filterByAdminAccess` uses it
  (behavior-preserving):** Task 1 (`ResourceAdminService::administersAllResources` + `filterByAdminAccess`) and Task 2
  (handler delegates; existing tests are the regression oracle).
- **Component 3 — widen `GET /admin/notifications` (global unchanged; resource-admin scoped count + items, `pending_applications: 0`; plain editor rejected):** Task 4.
- **Component 4 — frontend `AuthHelper::isResourceAdmin()` + `adminScopes()`, memoized, server-side fetch with cookie, fail-closed:** Task 5.
- **Component 5 — `assets/js/auth.js` `Auth.isResourceAdmin()` async + cached:** Task 6.
- **Component 6 — `admin-permissions.php` gate admits global OR resource admin; FGA-tuple section global-only; skip its JS init for
  resource-admins; review section stays for both:** Task 7.
- **Component 7 — `admin-dashboard.php` "Access Requests to Review" card for resource-admins (shown when `isResourceAdmin() && !hasRole('admin')`):** Task 8.
- **Component 8 — `assets/js/notifications.js` admin mode when `hasRole('admin') || await isResourceAdmin()`; `seen` POST stays user-mode:**
  Task 9 (the `seen` POST at lines 77–79 is left untouched).

Cross-cutting spec requirements:

- **API stays the authorization boundary:** no change to `requireAdminForAllResources` / `filterByAdminAccess` semantics (Task 2 is behavior-preserving); frontend only widens UI admission.
- **Fail-closed everywhere:** `ResourceAdminService::resolveScopes` (Task 1), `AdminScopesHandler` (Task 3), `NotificationsHandler`
  resource-admin branch (Task 4), `AuthHelper::fetchAdminScopes` (Task 5), `Auth.isResourceAdmin` (Task 6), `admin-permissions.php` gate (Task 7).
- **Response shape `{is_global_admin, is_resource_admin, admin_scopes:[{object_type, object_id}]}`:** Task 3 handler + Task 3 tests assert it.
- **Ordering (API before frontend):** Tasks 1–4 are API; Tasks 5–9 are frontend.
- **Testing expectations:** API global-admin / resource-admin / plain-editor cases for `/auth/admin-scopes` (Task 3) and
  `/admin/notifications` (Task 4); frontend `AuthHelper` parse + fail-closed (Task 5); JS behavior is unblocked for Phase 2 E2E
  (the spec's stated frontend test path).

Type/name consistency check (verified across tasks):

- `ResourceAdminService::resolveScopes`, `filterByAdminAccess`, `administersAllResources`, `ADMIN_OBJECT_TYPES` — defined Task 1, consumed identically in Tasks 2, 3, 4.
- `AuthHelper::isResourceAdmin()` / `adminScopes()` / `fetchAdminScopes()` — defined Task 5, consumed in Tasks 7 (`isResourceAdmin`) and 8 (`isResourceAdmin`).
- `Auth.isResourceAdmin()` — defined Task 6, consumed in Task 9.
- `window.AdminPermissionsConfig.isGlobalAdmin` — produced in Task 7 PHP, consumed in Task 7 JS.

Out of scope (per spec YAGNI), intentionally not planned: raw FGA tuple management for resource-admins, global user/applications
management for resource-admins, scoped data-editing dashboard entry points, a combined personal-inbox + review-queue notification mode,
and OpenAPI schema authoring for the new route (no spec requirement; `composer lint:openapi` lints the schema file, not live routes).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-21-scoped-admin-review.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
