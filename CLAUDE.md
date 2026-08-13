# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Instructions

**Branching Strategy:** Feature branches must be created from `development` and PRs must target `development`.
The `main` branch is reserved for production releases only.

```bash
# CORRECT
gh pr create --base development

# INCORRECT - will be rejected
gh pr create --base main
```

**Never skip git hooks.** Do not use `--no-verify` when committing. Pre-commit hooks run `composer lint` and
`composer lint:md` to enforce code standards. If a hook fails, fix the issue and create a new commit — do not
bypass the hook.

**Do not push immediately after committing.** This project uses CodeRabbit for automated code review with rate
limiting. Wait for the user to explicitly request a push, or batch multiple commits before pushing.

## Project Overview

The **LiturgicalCalendarFrontend** is a PHP-based website frontend that presents liturgical calendar data from the
LiturgicalCalendar API. It uses Bootstrap for theming and provides an interactive user interface for exploring
liturgical events, creating custom calendars, and more.

- **Production**: <https://litcal.johnromanodorazio.com/>
- **Staging**: <https://litcal-staging.johnromanodorazio.com/>

For architecture details, component library methods, and shared code standards, see the
[parent CLAUDE.md](../CLAUDE.md).

## Project Structure

```text
LiturgicalCalendarFrontend/
├── assets/              # CSS, JavaScript, images
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── includes/           # PHP includes and partials
├── layout/             # Common layout components (header, footer)
├── src/                # PHP source classes
├── i18n/               # Internationalization files (gettext .po/.mo)
├── cache/              # Cache directory (gitignored)
├── logs/               # Log files (gitignored)
└── docs/               # Documentation

Main PHP files: index.php, extending.php, admin.php, etc.
```

## Development Setup

### Prerequisites

- PHP >= 8.4
- Composer
- Node.js and Yarn (for E2E tests and markdown linting)
- Access to LiturgicalCalendar API (default: <http://localhost:8000>)

### Installation

```bash
composer install
```

### Environment Configuration

Copy `.env.example` to `.env.development` and configure:

```env
APP_ENV=development
API_PROTOCOL=http
API_HOST=localhost
API_PORT=8000
FRONTEND_URL=http://localhost:3000
```

### Running the Development Server

```bash
php -S localhost:3000
```

### Using Local liturgy-components-js Library

In development mode, the frontend can use a local version of `liturgy-components-js`:

```bash
cd assets
ln -sf ../../liturgy-components-js/dist components-js
```

When `APP_ENV=development`, the import map automatically points to `assets/components-js/index.js`.

## Code Quality

### Available Scripts

```bash
# PHP
composer parallel-lint       # Syntax checking
composer lint                # Check code standards (PSR-12)
composer lint:fix            # Auto-fix code standards
composer analyse             # PHPStan level 7

# Markdown (yarn lint:md / lint:md:fix are the same commands)
composer lint:md             # Check markdown
composer lint:md:fix         # Auto-fix markdown
yarn format:md               # Format with prettier (aligns tables)
# Which files get linted is config, not script arguments: .markdownlint-cli2.jsonc
# sets "gitignore": true (rules stay in .markdownlint.yaml), and prettier reads
# .gitignore plus .prettierignore. Do not add inline exclusion globs to the
# composer/yarn scripts — that is how they drifted apart in issue #447.

# JavaScript/TypeScript
yarn typecheck               # Type check e2e tests
yarn lint                    # ESLint
node --check assets/js/file.js  # Syntax check
```

### Before Committing

```bash
composer parallel-lint && composer lint:fix && composer analyse && composer lint:md:fix && yarn typecheck && yarn format:md
```

### Git Hooks (CaptainHook)

Pre-commit hooks automatically run PHP linting, code standards, and markdown linting.
Configuration: `captainhook.json`

## Code Standards

**PHP:** PSR-12 with modifications. See [parent CLAUDE.md](../CLAUDE.md#php-all-projects) for details.

**JavaScript:** ES6+ syntax, vanilla JS. Global variables are declared in `eslint.config.mjs` (not inline comments).

**Markdown:** See [parent CLAUDE.md](../CLAUDE.md#markdown) for formatting rules.

## Authentication

The frontend uses **cookie-only JWT authentication** (no Authorization headers or localStorage):

- `assets/js/auth.js` - Authentication module
- `includes/login-modal.php` - Login UI
- `layout/header.php` - Auth status in navbar

Key features: HttpOnly cookies, auth state caching via `checkAuthAsync()`, automatic token refresh,
protected UI elements with `data-requires-auth` attribute.

API requests use `credentials: 'include'` - the API reads tokens from HttpOnly cookies automatically.

## Important Patterns

### API Communication

**Authenticated endpoints** (require JWT):

```javascript
const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include', // Sends HttpOnly cookies automatically
});
```

**Public endpoints** (MetadataUrl, MissalsUrl, DecreesUrl, TemporaleUrl):

```javascript
const response = await fetch(MetadataUrl, {
    headers: { Accept: 'application/json' },
    credentials: 'omit', // Required: API returns Access-Control-Allow-Origin: *
});
```

Public API endpoints use wildcard CORS (`Access-Control-Allow-Origin: *`) which is incompatible with
`credentials: 'include'`. Browsers block credential requests to wildcard-CORS endpoints. Always use
`credentials: 'omit'` explicitly for these endpoints to make the intent clear.

### Internationalization

Uses PHP gettext with **numbered placeholders** for translator flexibility:

```php
// CORRECT
sprintf(_('There are %1$d items at %2$s.'), $count, $url);

// WRONG - cannot be reordered by translators
sprintf(_('There are %d items at %s.'), $count, $url);
```

### Accept-Language Header and CalendarSelect

When `ApiClient` listens to `ApiOptions`, the `Accept-Language` header is set automatically from `_localeInput`.

- **CalendarSelect standalone**: Vatican = General Roman Calendar (user's locale, not forced Latin)
- **With PathBuilder**: `/calendar` = General Roman, `/calendar/nation/VA` = Vatican (Latin)

### Rite awareness

The API routes a rite as a bare path segment between `calendar` and any nation or diocese pair —
`/calendar/ambrosian/diocese/lugano_ch`. There is no `/calendar/rite/{rite}` spelling and no query
parameter.

`usage.php` emits the segment for **every** rite, `roman` included, so users transition onto
rite-explicit URLs. The implicit spelling keeps resolving, so subscription URLs already pasted into
calendar apps are unaffected.

The Ambrosian rite has no national tier and its own set of diocesan calendars (`milano_it`, `bergam_it`,
`novara_it`, `lugano_ch`), so a `CalendarSelect` must be linked to a `RiteSelect` — via
`calendarSelect.linkToRiteSelect(riteSelect)`, or `ApiOptions.linkToCalendarSelect().linkToRiteSelect()`
when an `ApiOptions` form is already present — to repartition its list when the rite changes.

### PHP vs JS components

Frontend pages use **liturgy-components-js**. The PHP library (`liturgical-calendar/components`) is a
dependency solely for the embedded PHP example: `examples/php/index.php` detects that it is being included
rather than requested directly, skips its own autoloader and its own `ApiClient` singleton, and resolves
both from the host. `includes/common.php` therefore keeps its `ApiClient::getInstance()` bootstrap, gated
to `examples.php`. Do not remove the composer dependency — the example crashes without it.

### Meta-components

liturgy-components-js 2.2.0 ships two meta-components that bundle wiring this repo used to re-derive by
hand:

- **`DayViewer`** — the whole "liturgy of any day" page. Used by `assets/js/liturgyOfAnyDay.js`.
- **`CalendarResourcePicker`** — a `RiteSelect` plus a filtered `CalendarSelect`, for choosing a national
  or diocesan resource id.

Prefer them over hand-wiring. A `RiteSelect` needs **two** wires — `linkToRiteSelect()` AND
`apiClient.listenTo(riteSelect)` — and wiring only the first fails silently: the form reads `ambrosian`
while every request still goes to `/calendar/roman/`. The meta-components own that.

Five call sites still hand-wire a `RiteSelect` plus a `CalendarSelect`. They fall into two groups, and
the difference matters: one group is a permanent exception, the other is simply not converted yet.

**Permanently hand-wired — do not "fix" these:**

- `assets/js/usage.js` — `CalendarResourcePicker` rejects `CalendarSelectFilter.NONE` and makes the
  empty option a disabled placeholder. The subscription card needs an all-calendars list and a
  _selectable_ empty option meaning the rite-level calendar. Asked upstream as
  liturgy-components-js#42.
- `assets/js/index.js` — a PathBuilder/API-explorer page; neither meta-component models it.

**Awaiting migration to `CalendarResourcePicker`** — these three are picker-shaped and should be
converted, just not yet. Treat their current hand-wiring as debt, not as a pattern to copy:

- `assets/js/admin-permissions.js` — the permission-grant resource-id picker.
- `assets/js/permission-requests.js` — the permission-request picker, including a hand-rolled
  `is-invalid` failure control the component now provides.
- `assets/js/admin-tests.js` — the test-scope picker.

The first two are RBAC-critical and covered only by the `rbac` e2e project, which is why they were
deferred to their own PR rather than bundled with the `DayViewer` conversion.

**Theme bag notes:** The theme bag's keys are HTML roles (`select`, `label`, `input`, `wrapper`) with
per-child overrides named for the public getters. Two sharp edges: `label()` is **one-shot**, so once the
theme bag has themed a child, custom label text must go through the per-child `labelText` key rather than
`viewer.<child>.label({ text })`, which throws; and `id()` is not one-shot. Separately,
`Theme.resolveChildTheme()` currently forwards only `class`/`labelClass`/`labelText`/`wrapperClass`/`wrapper`,
so the eight `LiturgyOfAnyDay` styling keys `DayViewer`'s own constructor tries to read are silently dropped
— `assets/js/liturgyOfAnyDay.js` sets them post-mount instead. Filed upstream as liturgy-components-js#43;
move them into the theme bag once that lands.

## E2E Tests (Playwright)

Test files in `e2e/` verify form submissions match API contracts.

### Running Tests

```bash
# CI mode - auto-starts servers (recommended)
yarn test:ci:chromium

# Manual mode - requires servers running
yarn test:chromium

# Interactive
yarn test:ui
```

### Test Configuration

Requires in `.env.development`:

```env
FRONTEND_URL=http://localhost:3000
```

The **authenticated** projects additionally need the `ZITADEL_*` settings, because their setup
seeds a Zitadel user and logs it in through the OIDC flow rather than using test credentials
against the API's legacy HS256 `/auth/login`, whose tokens `auth/me.php` could never accept
(issue #448):

- `chromium`, `chromium-ci-auth`, `firefox`, `webkit` — via `e2e/auth.setup.ts`
- `rbac` — via `e2e/rbac/rbac.setup.ts`

`chromium-ci` needs none of them: it declares no `storageState` and no `setup` dependency, so it
runs without Zitadel. That is deliberate — it keeps the login-free specs green even when Zitadel
is unavailable.

### Calendar Schema Differences

| Calendar Type | Allowed Actions                                                     |
| ------------- | ------------------------------------------------------------------- |
| National      | `setProperty`, `createNew`, `moveFeast`, `makeDoctor`, `makePatron` |
| Wider Region  | `createNew`, `makePatron` only                                      |
| Diocesan      | `createNew`, `makePatron` only                                      |

WiderRegion names must be: `Americas`, `Europe`, `Asia`, `Africa`, or `Oceania`.

## Troubleshooting

### API Connection Issues

1. Verify API running on configured host/port
2. Check `.env.development` settings
3. Verify CORS configuration on API

### Linting Failures

```bash
composer lint:fix      # PHP
composer lint:md:fix   # Markdown
```

### CaptainHook Issues

```bash
vendor/bin/captainhook install -f
```

## Docker Stack Operations

The local docker stack (`docker-compose.yml` plus `docker-compose.override.yml`) bundles
Postgres, Zitadel, OpenFGA, the API (built from the local `../LiturgicalCalendarAPI` repo
via the override), and the frontend. A few non-obvious workflows:

### After `docker compose down -v` (clean slate)

When you wipe volumes, Zitadel and OpenFGA come back empty. The local `.env`,
`service-account.pat`, and `test-service-account-key.json` files still hold the OLD
PAT/project/store IDs from before the wipe. You **must** re-bootstrap and recreate
the dependent containers:

```bash
./scripts/setup-zitadel.sh --force-secrets --update-env
docker compose up -d --force-recreate litcal-api litcal-frontend litcal-tests
```

Notes:

- **Always pass `--force-secrets`** when Zitadel volumes were just wiped. Without it,
  the script reuses the local `service-account.pat` which Zitadel no longer recognizes,
  silently writing an invalid PAT to `.env`. (Tracked upstream in the API repo.)
- **Recreate all three app containers**, not just `litcal-api`. The frontend and
  tests containers also read `ZITADEL_CLIENT_ID`/`ZITADEL_PROJECT_ID` and will
  serve stale values otherwise — login flow breaks because the OIDC client_id
  doesn't exist in fresh Zitadel.
- `litcal-api` healthcheck (`GET /calendars`) doesn't depend on Zitadel, so it
  reports healthy even when its PAT is invalid. Verify Zitadel auth explicitly:

    ```bash
    docker compose exec litcal-api bash -c '
      curl -sS -X POST http://zitadel:8080/management/v1/users/_search \
        -H "Authorization: Bearer $ZITADEL_MACHINE_TOKEN" \
        -H "Host: localhost" \
        -H "Content-Type: application/json" \
        -d "{\"limit\":1}" | head -c 200
    '
    ```

    A 401 / `Errors.Token.Invalid` means the PAT is stale and you need
    `--force-secrets`.

### After re-running `setup-zitadel.sh`

Same recreate step — `litcal-api litcal-frontend litcal-tests`. Compose only
re-evaluates env from `.env` on container creation, not restart.

### Single-file bind-mount inode-pinning gotcha

`docker-compose.override.yml` (gitignored, local) bind-mounts each top-level PHP file
individually so JS/CSS/PHP edits propagate to the container without a rebuild.
Directory mounts (`./assets`, `./includes`, `./layout`, etc.) work cleanly: the
directory inode is stable.

**Top-level PHP files are mounted as individual files**, and Docker's single-file
bind-mount pins the host inode at container start. When the Edit tool (or vim, or
any editor using atomic temp+rename) writes to such a file, a new inode is created
and the container keeps serving the OLD inode's content.

If a top-level PHP edit doesn't appear in the browser:

```bash
docker compose up -d --force-recreate litcal-frontend
```

### Useful diagnostic commands

```bash
# What's actually in the container right now?
docker compose exec litcal-frontend grep -c "<some-marker>" /var/www/html/some-file.php

# Compare host vs container env values
docker compose exec litcal-api bash -c 'echo "$ZITADEL_MACHINE_TOKEN"' | tail -c 12
grep "^ZITADEL_MACHINE_TOKEN=" .env | tail -c 12

# Confirm a service has come up healthy after recreate
until docker compose ps litcal-api --format '{{.Status}}' | grep -q "healthy"; do sleep 1; done
```

## Additional Documentation

- [Parent monorepo CLAUDE.md](../CLAUDE.md) - Architecture and component library methods
- `docs/AUTHENTICATION_ROADMAP.md` - JWT implementation details
- `README.md` - Project overview
