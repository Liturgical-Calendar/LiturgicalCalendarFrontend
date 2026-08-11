# Code Style & Conventions — LiturgicalCalendarFrontend

## PHP

- **PHP >= 8.4**
- **PSR-12** enforced via `phpcs` (`phpcs.xml`); auto-fix with `phpcbf`
- **PHPStan level 7** (config: `phpstan.neon` + `phpstan-bootstrap.php`)
- PSR-4: `LiturgicalCalendar\Frontend\` → `src/`; `pgettext.php` autoloaded via composer `files`

## JavaScript

- **ES6+ vanilla JS** (no SPA framework)
- ESLint flat config in `eslint.config.mjs`
- **Global variables declared in `eslint.config.mjs`**, NOT inline `/* global … */` comments

## Markdown

- `.markdownlint.yaml` enforced via `markdownlint-cli2` (also via prettier `format:md` for tables)
- Pre-commit hook auto-runs lint on `.md` changes
- General rules: blank lines around lists/code blocks, fenced code blocks with language, sequential ordered list numbering, vertically aligned tables

## i18n (CRITICAL)

gettext via PHP. **Always use numbered placeholders** so translators can reorder:

```php
// CORRECT
sprintf(_('There are %1$d items at %2$s.'), $count, $url);

// WRONG (translators can't reorder)
sprintf(_('There are %d items at %s.'), $count, $url);
```

`src/pgettext.php` provides additional gettext helpers.

## API communication patterns

**Authenticated endpoints** (require JWT cookie):

```javascript
const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include', // sends HttpOnly cookies
});
```

**Public endpoints** (`MetadataUrl`, `MissalsUrl`, `DecreesUrl`, `TemporaleUrl`):

```javascript
const response = await fetch(MetadataUrl, {
    headers: { Accept: 'application/json' },
    credentials: 'omit', // REQUIRED — API returns wildcard CORS
});
```

Why: public endpoints return `Access-Control-Allow-Origin: *` which is incompatible with `credentials: 'include'`. Browsers block such requests. Always set `credentials: 'omit'` explicitly to make intent obvious.

## Auth (cookie-only)

- HttpOnly cookies set by API: `litcal_access_token`, `litcal_refresh_token`
- `Auth.checkAuthAsync()` for server-verified state (preferred)
- `Auth.isAuthenticated()` for cached sync check (may be stale)
- Deprecated (return `null` / warn): `Auth.getToken()`, `setToken()`, `getPayload()`, `setRefreshToken()`
- Mark protected UI with `data-requires-auth`
- Helper for app-set cookies: `setSecureCookie(name, value, expire, sameSite)`

## Security headers

- **PHP** sets dynamic headers (CSP w/ env-derived API URL, HSTS) in `includes/common.php`
- **nginx** sets static headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy; HSTS if nginx terminates TLS)

## CSP allow-lists

- `script-src`: `'self'`, `'unsafe-inline'` (legacy), jsdelivr, cdnjs, unpkg, skypack
- `connect-src`: `'self'`, API URL (env), api.github.com, raw.githubusercontent.com (CLDR data for `extending.php`), CDN domains (source maps + ESM dynamic imports)

## ApiClient + CalendarSelect locale rules

When `ApiClient` listens to `ApiOptions`, `Accept-Language` is set automatically from `_localeInput`.

| Mode                                    | Vatican meaning                                          |
| --------------------------------------- | -------------------------------------------------------- |
| CalendarSelect standalone               | General Roman Calendar (user's locale, NOT forced Latin) |
| With PathBuilder, `/calendar`           | General Roman Calendar                                   |
| With PathBuilder, `/calendar/nation/VA` | Vatican (Latin)                                          |

## Naming

- PHP: PascalCase classes/namespaces, camelCase methods/properties
- JS: camelCase (functions/vars), PascalCase for constructors/modules
- File-level PHP entry pages use kebab-case (`admin-users.php`, `permission-requests.php`)
