# Codebase Structure — LiturgicalCalendarFrontend

## Top-level layout

```
LiturgicalCalendarFrontend/
├── assets/                # Static assets
│   ├── css/               # Stylesheets
│   └── js/                # JavaScript (vanilla ES6+, incl. auth.js)
├── includes/              # PHP partials/includes (e.g. common.php — sets CSP/HSTS)
├── layout/                # Header / footer / shared layout
├── src/                   # PSR-4: LiturgicalCalendar\Frontend\
├── auth/                  # Auth-related PHP
├── i18n/                  # gettext .po/.mo files
├── examples/              # Code examples (excluded from many lints)
├── e2e/                   # Playwright tests + e2e/tsconfig.json
├── docs/                  # Project docs (incl. AUTHENTICATION_ROADMAP.md)
├── scripts/               # Helper scripts
├── dist/                  # Build output (if any)
├── cache/, logs/          # Runtime (gitignored)
├── .yarn/, .pnp.cjs, .pnp.loader.mjs   # Yarn 4 PnP
├── playwright-report/, test-results/    # Playwright artifacts (gitignored)
├── vendor/, node_modules?              # Deps
├── docker-compose.yml + .override.yml + .override.example.yml
├── Dockerfile
├── setup.sh
├── eslint.config.mjs, playwright.config.ts
├── phpstan.neon / phpstan.neon.dist, phpstan-bootstrap.php
├── phpcs.xml, captainhook.json
├── .markdownlint.yaml, .editorconfig, .nvmrc
├── composer.json / composer.lock
├── package.json / yarn.lock
├── .env, .env.example, .env.development
└── CLAUDE.md, README.md, CODE_OF_CONDUCT.md, LICENSE
```

## Top-level PHP entry pages (each is a directly-served page)

- `index.php` — landing
- `examples.php`, `usage.php` — usage docs / examples
- `extending.php` — National/Diocesan calendar extension UI
- `easter.php` — Easter date tool
- `temporale.php` — temporal cycle UI
- `decrees.php`, `translations.php`
- `liturgyOfAnyDay.php`
- `missals-editor.php` — missal editing
- `request-access.php`, `permission-requests.php`, `admin-role-requests.php`
- `admin-dashboard.php`, `admin-users.php`, `admin-applications.php`, `admin-permissions.php`
- `developer-dashboard.php`
- `user-profile.php`, `about.php`

## Source library (`src/`)

PSR-4 root for `LiturgicalCalendar\Frontend\` namespace. Includes `Utilities` (with `postInstall` hook), helpers, and `pgettext.php` autoloaded via composer `files`.

## Auth flow (cookie-only JWT)

- `assets/js/auth.js` — client module
  - `Auth.checkAuthAsync()` — server-verified, async (preferred for UI gating)
  - `Auth.isAuthenticated()` — sync, cached (may be stale)
  - Deprecated: `getToken()`, `setToken()`, `getPayload()`, `setRefreshToken()` (HttpOnly = JS can't see tokens)
- `includes/login-modal.php` — login UI
- `layout/header.php` — auth status in navbar
- `data-requires-auth` attribute marks protected UI elements
- All API calls use `credentials: 'include'`; tokens flow via HttpOnly cookies (`litcal_access_token`, `litcal_refresh_token`)

## Security headers (hybrid PHP + nginx)

- **PHP** (`includes/common.php` ~lines 57–83) sets dynamic headers needing env data:
  - `Content-Security-Policy` (includes API URL)
  - `Strict-Transport-Security` (when HTTPS detected)
- **nginx** should set static headers: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `X-XSS-Protection 1; mode=block`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy geolocation=()…`
- CSP `connect-src` allows: self, API URL, api.github.com, raw.githubusercontent.com (CLDR data), CDN domains for source maps + dynamic ESM imports

## E2E tests (`e2e/`)

Playwright. `e2e/tsconfig.json` for TypeScript. Reports → `playwright-report/`, results → `test-results/`.

## Schema differences for calendar editors

| Calendar Type | Allowed Actions                                                      |
|---------------|----------------------------------------------------------------------|
| National      | `setProperty`, `createNew`, `moveFeast`, `makeDoctor`, `makePatron`  |
| Wider Region  | `createNew`, `makePatron` only                                       |
| Diocesan      | `createNew`, `makePatron` only                                       |

WiderRegion names MUST be one of: `Americas`, `Europe`, `Asia`, `Africa`, `Oceania`.
