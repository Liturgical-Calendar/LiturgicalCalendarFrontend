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
TEST_USERNAME=testuser
TEST_PASSWORD=testpassword
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

# Markdown
composer lint:md             # Check markdown
composer lint:md:fix         # Auto-fix markdown
yarn format:md               # Format with prettier (aligns tables)

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
    headers: { 'Accept': 'application/json' },
    credentials: 'include'  // Sends HttpOnly cookies automatically
});
```

**Public endpoints** (MetadataUrl, MissalsUrl, DecreesUrl, TemporaleUrl):

```javascript
const response = await fetch(MetadataUrl, {
    headers: { 'Accept': 'application/json' },
    credentials: 'omit'  // Required: API returns Access-Control-Allow-Origin: *
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
TEST_USERNAME=your_test_username
TEST_PASSWORD=your_test_password
```

### Calendar Schema Differences

| Calendar Type | Allowed Actions                                                      |
|---------------|----------------------------------------------------------------------|
| National      | `setProperty`, `createNew`, `moveFeast`, `makeDoctor`, `makePatron`  |
| Wider Region  | `createNew`, `makePatron` only                                       |
| Diocesan      | `createNew`, `makePatron` only                                       |

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

## Additional Documentation

- [Parent monorepo CLAUDE.md](../CLAUDE.md) - Architecture and component library methods
- `docs/AUTHENTICATION_ROADMAP.md` - JWT implementation details
- `README.md` - Project overview
