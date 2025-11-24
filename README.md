# Liturgical Calendar Frontend

**Code quality**

| MAIN | DEVELOPMENT |
|:----:|:-----------:|
| [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge/main)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/overview/main) | [![CodeFactor](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/badge/development)](https://www.codefactor.io/repository/github/liturgical-calendar/liturgicalcalendarfrontend/overview/development) |

Presentation of the Liturgical Calendar Project, using bootstrap theming.
See [https://litcal.johnromanodorazio.com/](https://litcal.johnromanodorazio.com/).
Development is done initially on the development branch with a frontend at [https://litcal-staging.johnromanodorazio.com/](https://litcal-staging.johnromanodorazio.com/).

The Liturgical Calendar project offers an API that generates data for the liturgical events in the General Roman Calendar,
as well as an API that generates the dates of easter in both the gregorian and the julian calendar from the year 1583 to the year 9999.
Data from the Liturgical Calendar API can be requested in either JSON or XML format, to be consumed by any kind of application that can read JSON or XML data.
It can also be requested in ICS format, to be consumed by any kind of iCal or Calendar application.

This frontend is an interface with documentation and examples for the API.

The API can be extended with National Calendars, based on the Roman Missals issued in the region;
these calendars can then be requested on the Liturgical Calendar API `/calendar/nation/{NATION}` path,
where `{NATION}` is the two-letter ISO country code, as defined in [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).

The API is also extendable for Diocesan Calendars, which however can only be defined after the National Calendar for the region has been defined;
once the Diocesan Calendar is defined, it can be requested on the Liturgical Calendar API `/calendar/diocese/{DIOCESE}` path,
where `{DIOCESE}` is the code for the diocese as defined in [/assets/data/WorldDiocesesByNation.json](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/blob/development/assets/data/WorldDiocesesByNation.json)
in this frontend repository.

The National and Diocesan Calendar data can be defined directly through the interfaces offered by this frontend.

## Development

To test the frontend locally, first install all package dependencies with `composer install`.

Then make sure you have an instance of the API running locally (see [Liturgical-Calendar/LiturgicalCalendarAPI/README.md#testing-locally](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/tree/development?tab=readme-ov-file#testing-locally)).

Then copy `.env.example` to `.env.development`. You shouldn't have to change any values, unless you are running the local API instance on a port other than 8000.

Finally, launch PHP's built-in server from a separate terminal instance than the one on which you are running the local API instance:

```console
php -S localhost:3000
```

Then navigate to `localhost:3000` in your browser, and you should see a running instance of the frontend website that is fully communicational with the backend API.

> [!TIP]
> For convenience when using VSCode, a `tasks.json` has been defined so that you can simply type <kbd>CTRL</kbd>+<kbd>SHIFT</kbd>+<kbd>B</kbd>
> (<kbd>CMD</kbd>+<kbd>SHIFT</kbd>+<kbd>B</kbd> on macOS) to start the PHP built-in server and open the browser at `localhost:3000`.

## Production Deployment

### Security Headers

This application uses a **hybrid approach** for security headers:

- **PHP** sets dynamic headers that require environment variables (see `common.php:57-83`)
  - `Content-Security-Policy` (includes dynamic API URL from `.env`)
  - `Strict-Transport-Security` (requires HTTPS detection)

- **nginx** should set static security headers for better performance

**CSP Directives:**

**`script-src`** - JavaScript sources:

- `'self'` - Same-origin scripts
- `'unsafe-inline'` - Inline scripts (required for legacy code)
- `https://cdn.jsdelivr.net` - npm packages (liturgy-components-js)
- `https://cdnjs.cloudflare.com` - Common libraries (Bootstrap, jQuery)
- `https://unpkg.com` - npm CDN alternative
- `https://cdn.skypack.dev` - FullCalendar example dependencies

**`connect-src`** - Fetch/XHR requests:

- `'self'` - Same-origin requests
- `http://localhost:8000` - API endpoint (from `.env`)
- `https://api.github.com` - GitHub API for release info
- `https://raw.githubusercontent.com` - CLDR territory data (extending.php)
- `https://cdn.jsdelivr.net` - Source maps + dynamic imports
- `https://cdnjs.cloudflare.com` - Source maps for debugging
- `https://cdn.skypack.dev` - FullCalendar module loading

**Note:** CDN domains are needed in `connect-src` because:

- Browsers fetch source maps (`.map` files) via fetch/XHR for debugging
- ES modules may dynamically import dependencies from CDNs
- extending.php fetches CLDR (Common Locale Data Repository) territory info for national calendar forms

#### nginx Configuration

Add the following to your nginx configuration (in `server` block or `location` block):

```nginx
# Static Security Headers
# X-Frame-Options - Prevent clickjacking
add_header X-Frame-Options "DENY" always;

# X-Content-Type-Options - Prevent MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# X-XSS-Protection - Enable browser XSS protection
add_header X-XSS-Protection "1; mode=block" always;

# Referrer-Policy - Control referrer information
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Optional: Permissions-Policy (formerly Feature-Policy)
# Disable unnecessary browser features
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

**Note:** If nginx always handles HTTPS termination, you can also add:

```nginx
# HSTS - Force HTTPS for 1 year (only if using HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

In this case, you can remove the HSTS header from `common.php` (lines 77-81).

#### Why Hybrid Approach?

- **PHP CSP** is necessary because the `connect-src` directive includes the API URL from `.env` configuration
- **nginx static headers** provide better performance for headers that don't change
- This approach works in any environment (shared hosting, nginx, Apache, etc.)

### Cookie Security (SameSite Protection)

The application implements **SameSite cookie protection** to prevent CSRF attacks (see `common.php:91-139`).

**Current Implementation:**

- JWT tokens are stored in `localStorage`/`sessionStorage` (not cookies)
- SameSite protection is configured for **future cookie usage**
- PHP session cookies (if ever used) are automatically secured

**Automatic Configuration:**

```php
// Session cookies are configured with:
session.cookie_httponly = 1    // Prevent JavaScript access
session.cookie_samesite = Strict  // CSRF protection
session.cookie_secure = 1      // HTTPS only (when HTTPS detected)
```

**Helper Function for Custom Cookies:**

If you need to set custom cookies in the application, use the `setSecureCookie()` helper:

```php
// Example: Set a preference cookie
setSecureCookie(
    name: 'user_language',
    value: 'en-US',
    expire: time() + (86400 * 30),  // 30 days
    sameSite: 'Lax'  // 'Strict', 'Lax', or 'None'
);
```

**SameSite Options:**

- `Strict` (default) - Cookie only sent for same-site requests (maximum protection)
- `Lax` - Cookie sent for top-level navigation (balance between security and usability)
- `None` - Cookie sent for all requests (requires `Secure` flag, HTTPS only)

**Why SameSite Over CSRF Tokens?**

The application uses **Authorization headers** for JWT authentication, not cookies. SameSite protection provides:

- ✅ Protection against CSRF attacks
- ✅ Defense-in-depth for any future cookie usage
- ✅ No additional server-side token generation needed
- ✅ Lightweight protection without complexity
- ✅ Automatic protection for PHP sessions

## Localization of the Frontend

<a href="https://translate.johnromanodorazio.com/engage/liturgical-calendar/">
<img src="https://translate.johnromanodorazio.com/widgets/liturgical-calendar/-/frontend/open-graph.png" alt="Translation status" />
</a>
