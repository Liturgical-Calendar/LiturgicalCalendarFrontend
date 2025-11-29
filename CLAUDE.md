# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The **LiturgicalCalendarFrontend** is a PHP-based website frontend that presents liturgical calendar data from the
LiturgicalCalendar API. It uses Bootstrap for theming and provides an interactive user interface for exploring
liturgical events, creating custom calendars, and more.

- **Production**: [https://litcal.johnromanodorazio.com/](https://litcal.johnromanodorazio.com/)
- **Staging**: [https://litcal-staging.johnromanodorazio.com/](https://litcal-staging.johnromanodorazio.com/)

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
├── examples/           # Symlink to ../examples/ (separate repository at workspace root)
└── docs/               # Documentation

Main PHP files: index.php, extending.php, admin.php, etc.
```

## Development Setup

### Prerequisites

- PHP >= 8.1
- Composer
- Node.js and npm (for markdown linting)
- Access to LiturgicalCalendar API (default: <http://localhost:8000>)

### Installation

```bash
composer install
```

### Environment Configuration

1. Copy `.env.example` to `.env.development`
2. Configure the environment variables:

   ```env
   # Application environment (development, staging, production)
   APP_ENV=development

   # API connection settings
   API_PROTOCOL=http
   API_HOST=localhost
   API_PORT=8000
   API_BASE_PATH=/

   # Debug mode (enables additional logging)
   DEBUG_MODE=false

   # Frontend URL (used by Playwright tests)
   FRONTEND_URL=http://localhost:3000

   # Path to API repository (optional, for CI mode tests)
   # API_REPO_PATH=/path/to/LiturgicalCalendarAPI

   # Test credentials for E2E tests (required for Playwright)
   # These must match a valid user in the API database
   TEST_USERNAME=testuser
   TEST_PASSWORD=testpassword
   ```

### Running the Development Server

```bash
php -S localhost:3000
```

Ensure the API is running on the configured host/port (default: localhost:8000).

### Using Local liturgy-components-js Library

In development mode (`APP_ENV=development`), the frontend uses a local version of `liturgy-components-js` instead of the
CDN version. This allows testing library changes without publishing to npm.

**Setup:**

Create a symlink from the frontend's assets to the local library's dist folder:

```bash
cd assets
ln -sf ../../liturgy-components-js/dist components-js
```

The symlink is gitignored. When `APP_ENV=development`, the import map in `layout/footer.php` automatically points to
`assets/components-js/index.js`. In staging/production, it uses the CDN version.

**Workflow:**

1. Make changes to `liturgy-components-js/src/`
2. Run `yarn compile` in the liturgy-components-js directory
3. Refresh the frontend page to see changes immediately

## Code Quality and Linting

### Available Scripts

Linting and quality scripts are defined in both `composer.json` (PHP) and `package.json` (TypeScript/JavaScript):

```bash
# PHP Syntax Checking
composer parallel-lint       # Check PHP syntax in all files

# PHP Code Standards (PSR-12)
composer lint                # Check code standards
composer lint:fix            # Auto-fix code standard violations

# PHPStan Static Analysis
composer analyse             # Run PHPStan level 7 analysis

# Markdown Linting
composer lint:md             # Check markdown files
composer lint:md:fix         # Auto-fix markdown issues

# Tests
composer test                # Run PHPUnit tests (when available)
```

**TypeScript/JavaScript Scripts** (defined in `package.json`):

```bash
# TypeScript Type Checking
yarn typecheck               # Type check e2e test files (uses e2e/tsconfig.json)
yarn tsc                     # Run TypeScript compiler directly

# Playwright E2E Tests
yarn test                    # Run all Playwright tests
yarn test:chromium           # Run tests in Chromium only
yarn test:ci:chromium        # Run tests in CI mode (Chromium)
yarn test:headed             # Run tests with browser visible
yarn test:ui                 # Run tests with Playwright UI
yarn test:report             # Show test report

# ESLint
yarn lint                    # Lint JavaScript files
```

### Before Committing

**IMPORTANT**: Run these commands before committing to ensure code quality:

```bash
# 1. Check PHP syntax
composer parallel-lint

# 2. Check and fix code standards
composer lint:fix
composer lint

# 3. Run static analysis
composer analyse

# 4. Check and fix markdown
composer lint:md:fix
composer lint:md

# 5. Verify JavaScript syntax (if modified)
node --check assets/js/extending.js
node --check assets/js/auth.js

# 6. Type check e2e tests (if modified)
yarn typecheck
```

### Git Hooks (CaptainHook)

The project uses CaptainHook for automated quality checks on commit:

**Pre-commit hooks automatically run:**

- PHP syntax linting
- PHP code standards (`composer lint`)
- Markdown linting (`composer lint:md`) - only on staged .md files

**Pre-push hooks automatically run:**

- PHP parallel-lint - comprehensive syntax check

**Configuration**: `captainhook.json`

To reinstall hooks:

```bash
vendor/bin/captainhook install -f
```

To view current configuration:

```bash
vendor/bin/captainhook config:info
```

## Code Standards

### PHP

**Base Standard**: PSR-12 with modifications

**Key Rules**:

- PHP >= 8.1 features encouraged
- Short array syntax `[]` (not `array()`)
- Single quotes for simple strings
- 4-space indentation
- Line length NOT enforced
- No trailing whitespace

**Configuration**: `phpcs.xml` (if present) or PSR-12 defaults

### JavaScript

- ES6+ syntax
- Vanilla JavaScript (no build step)
- Use `const`/`let` (not `var`)
- Consistent code style matching existing patterns

**Global Variables**:

All JavaScript global variables (from PHP inline scripts or external libraries) are declared centrally in `eslint.config.mjs` to avoid ESLint/CodeFactor warnings.

**Configuration**: `eslint.config.mjs` → `languageOptions.globals`

**Currently defined globals**:

- `$`, `jQuery` - jQuery library
- `bootstrap` - Bootstrap 5 library
- `toastr` - Toastr notification library
- `Auth` - Authentication module (from `assets/js/auth.js`)
- `BaseUrl` - API base URL (from PHP inline script)
- `Messages` - Translation strings (from PHP inline script)
- `EventsUrl`, `MissalsUrl`, `RegionalDataUrl`, `CalendarUrl` - API endpoints (from PHP)
- `LiturgicalEventCollection`, `LiturgicalEventCollectionKeys`, `LitCalMetadata` - App state (from PHP)
- `Cookies` - Cookie library
- `LITCAL_LOCALE`, `currentLocale` - Locale settings (writable)

**Adding new globals**:

1. **DO NOT** use `/* global ... */` comments in individual JavaScript files
2. **DO** add all globals to `eslint.config.mjs`:

   ```javascript
   languageOptions: {
     globals: {
       ...globals.browser,
       NewGlobalVar: "readonly",    // For read-only globals
       WritableGlobal: "writable",  // For globals that can be modified
     }
   }
   ```

3. Run `node --check assets/js/yourfile.js` to verify syntax

**Why centralized?**:

- Avoids "already defined as built-in" errors from CodeFactor
- Single source of truth for all global variables
- Easier maintenance and consistency
- Prevents duplication across files

### Markdown

**Configuration**: `.markdownlint.yaml`

**Key Rules**:

- Max line length: 180 characters (excluding code blocks/tables)
- Fenced code blocks required
- Blank lines around headings
- Table columns must be vertically aligned (MD060)

**Code Blocks in Lists**:

When including code blocks within numbered or bulleted lists, proper indentation is critical:

- **Numbered lists**: Indent code blocks with **3 spaces** to maintain list continuity
- **Bulleted lists**: Indent code blocks with **2 spaces** to maintain list continuity

**Correct indentation example**:

`````markdown
1. First step
2. Second step with code:

   ```javascript
   const example = "code";
   ```

3. Third step continues correctly
`````

**Key rules**:

- List item starts at column 0
- Code fence starts at column 3 (numbered lists) or column 2 (bulleted lists)
- All code fence lines (opening, content, closing) must maintain this indentation

**Common mistake**: Placing code fence at column 0 breaks the list, causing subsequent items to restart numbering (MD029 error).

**Tip**: When documenting nested code blocks, use five backticks for the outer block to avoid conflicts with inner triple-backtick blocks.

**Table Alignment**:

Table columns must be vertically aligned using consistent spacing:

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| Short    | Medium   | Longer   |
| Value    | Value    | Value    |
```

**Linting commands**:

```bash
composer lint:md         # Check markdown files
composer lint:md:fix     # Auto-fix most issues (but not indentation)
```

## PHPStan Configuration

**File**: `phpstan.neon.dist`

**Analyzed Paths**:

- `src/` - PHP classes
- `includes/` - Include files
- `layout/` - Layout components
- Root PHP files (index.php, extending.php, admin.php, etc.)

**Excluded**:

- `examples/` - Symlink to separate repository at workspace root
- `.intelephense-helper.php` - IDE helper

**Level**: 7

## Authentication

The frontend implements JWT authentication for administrative features:

**Files**:

- `assets/js/auth.js` - JWT authentication module
- `includes/login-modal.php` - Login UI and handlers
- `layout/header.php` - Authentication status in navbar

**Key Features**:

- HttpOnly cookie-based authentication (preferred, more secure)
- localStorage/sessionStorage fallback for backwards compatibility
- Automatic token refresh
- Session expiry warnings
- Protected UI elements with `data-requires-auth` attribute
- `checkAuthAsync()` for server-side session verification with HttpOnly cookies

See `docs/AUTHENTICATION_ROADMAP.md` for detailed implementation notes.

## Important Patterns

### Including Common Files

Most pages include `common.php` which sets up:

- Environment variables
- API configuration
- Security headers
- Internationalization
- Error handling

### API Communication

The frontend communicates with the API using:

- Fetch API
- JWT authentication headers (for protected endpoints)
- JSON/XML response parsing

Example:

```javascript
const headers = {
    'Accept': 'application/json'
};
if (Auth.isAuthenticated()) {
    headers['Authorization'] = `Bearer ${Auth.getToken()}`;
}

const response = await fetch(apiUrl, { headers });
```

### Liturgy of Any Day Page

The `liturgyOfAnyDay.php` page uses the `liturgy-components-js` library with `ApiClient`, `CalendarSelect`,
`ApiOptions`, and `LiturgyOfAnyDay` components. This provides a complete interface for viewing liturgical
events on any selected date.

**Component Wiring Pattern:**

```javascript
import { ApiClient, CalendarSelect, ApiOptions, ApiOptionsFilter, LiturgyOfAnyDay }
    from '@liturgical-calendar/components-js';

// 1. Initialize ApiClient
const apiClient = await ApiClient.init(BaseUrl);

// 2. Create CalendarSelect (default to General Roman Calendar)
const calendarSelect = new CalendarSelect(lang).allowNull(true);
calendarSelect.appendTo('#calendarContainer');
calendarSelect._domElement.value = ''; // Select General Roman Calendar

// 3. Create ApiOptions with locale filter, linked to CalendarSelect
const apiOptions = new ApiOptions(lang)
    .filter(ApiOptionsFilter.LOCALE_ONLY)
    .linkToCalendarSelect(calendarSelect);
apiOptions.appendTo('#localeContainer');

// 4. Match locale from available options
const localeOptions = Array.from(apiOptions._localeInput._domElement.options);
const exactMatch = localeOptions.find(opt => opt.value === lang);
const languageMatch = localeOptions.find(opt => opt.value.split(/[-_]/)[0] === lang);
let selectedLocale = exactMatch?.value || languageMatch?.value || localeOptions[0]?.value || lang;
apiOptions._localeInput._domElement.value = selectedLocale;

// 5. Create LiturgyOfAnyDay (auto-configures year_type for Dec 31st)
const liturgyOfAnyDay = new LiturgyOfAnyDay({ locale: lang })
    .buildDateControls()
    .listenTo(apiClient);
liturgyOfAnyDay.appendTo('#liturgyContainer');

// 6. Wire ApiClient to listen to UI components
apiClient.listenTo(calendarSelect).listenTo(apiOptions);

// 7. Initial fetch with matched locale
apiClient.fetchCalendar(selectedLocale);
```

**Key Implementation Details:**

- **CalendarSelect default**: By default Vatican is selected; set `_domElement.value = ''` for General Roman Calendar
- **Locale matching**: Try exact match first, then language match (e.g., "en" matches "en_US"), then first option
- **LiturgyOfAnyDay year_type**: The component auto-handles December 31st (uses LITURGICAL year_type with year+1 for vigil masses)
- **Accept-Language header**: Automatically handled by ApiClient when listening to ApiOptions

### Accept-Language Header and CalendarSelect

When `ApiClient` is configured to listen to `ApiOptions`, the `Accept-Language` header is automatically set based on
the `_localeInput` selection - no manual header handling is required.

**Vatican vs. General Roman Calendar**: When using `CalendarSelect` standalone:

- The component does **not** distinguish between "General Roman Calendar" and "Vatican calendar"
- Selecting "Vatican" from the dropdown is treated the same as selecting the General Roman Calendar (empty string)
- Users selecting "Vatican" probably expect to see the calendar in their own language, not forced into Latin
- Users can explicitly select Latin from the locale dropdown if desired

**Contrast with PathBuilder**: When `CalendarSelect` is used in conjunction with `CalendarPathInput` or `PathBuilder`:

- There **is** an explicit distinction via API paths:
  - `/calendar` = General Roman Calendar (supports any locale via `Accept-Language`)
  - `/calendar/nation/VA` = Vatican calendar (inherently Latin)
- The path explicitly identifies whether the user wants the universal General Roman Calendar or the Vatican's
  national calendar

**National/Diocesan calendars and language support**: National and diocesan calendars can support multiple languages.
When `ApiOptions` is linked to `CalendarSelect` (via `apiOptions.linkToCalendarSelect(calendarSelect)`):

- The `_localeInput` automatically shows only locales supported by the selected calendar
- When the General Roman Calendar (or Vatican) is selected, all API-supported locales are shown
- The `Accept-Language` header is automatically handled by `ApiClient`

This allows users to select from supported languages (e.g., French Canadian vs. English Canadian for Canada).

### Internationalization

Uses PHP gettext:

```php
<?php echo _('Translate this text'); ?>
```

Translation files: `i18n/*.po`

**Numbered Placeholders in Translation Strings**:

When using `sprintf()` with translatable strings, **always use numbered placeholders** (`%1$s`, `%2$d`, etc.)
instead of positional placeholders (`%s`, `%d`). This allows translators to reorder placeholders as needed for
their language's grammar.

```php
// CORRECT - numbered placeholders allow reordering
sprintf(_('There are %1$d items at %2$s.'), $count, $url);

// WRONG - positional placeholders cannot be reordered
sprintf(_('There are %d items at %s.'), $count, $url);
```

**Why?** Different languages have different word orders. For example, a translation might need to say "at X, there are Y items" instead of "there are Y items at X".

## Common Development Tasks

### Adding a New Page

1. Create `newpage.php` in root
2. Include `common.php` at the top
3. Include layout files: `layout/header.php`, `layout/footer.php`
4. Add translations to `i18n/*.po` files
5. Run linting scripts before committing

### Modifying JavaScript

1. Edit files in `assets/js/`
2. Check syntax: `node --check assets/js/yourfile.js`
3. Test in browser
4. Ensure no console errors

### Modifying Styles

1. Edit files in `assets/css/`
2. Follow existing naming conventions
3. Test responsive behavior
4. Use Bootstrap utilities when possible

### Working with the API

The API base URL is available globally as `BaseUrl`:

```javascript
const apiUrl = `${BaseUrl}/calendar?year=2024`;
```

## Dependencies

**PHP Packages** (composer.json):

- `liturgical-calendar/components` - Reusable UI components
- `vlucas/phpdotenv` - Environment configuration
- `monolog/monolog` - Logging
- `symfony/cache` - Caching

**Dev Dependencies**:

- `phpunit/phpunit` - Testing framework
- `squizlabs/php_codesniffer` - Code standards
- `phpstan/phpstan` - Static analysis
- `captainhook/captainhook-phar` - Git hooks

**JavaScript**:

- No build process required
- Dependencies loaded via CDN (Bootstrap, jQuery, etc.)

## Testing

### PHP Unit Tests

Place PHP test files in `tests/` directory and run with `composer test`.

### E2E Tests (Playwright)

The project uses Playwright for end-to-end testing of the `extending.php` forms. These tests verify that form
submissions produce payloads matching the API contract (fixtures).

**Test Files:**

```text
e2e/
├── auth.setup.ts              # Authentication setup (runs before all tests)
├── fixtures.ts                # Test fixtures and ExtendingPageHelper class
├── national-calendar.spec.ts  # National Calendar form tests
├── wider-region-calendar.spec.ts  # Wider Region Calendar form tests
├── diocesan-calendar.spec.ts  # Diocesan Calendar form tests
└── tsconfig.json              # TypeScript config for tests
```

**Prerequisites:**

1. **Node.js and Yarn** - The project uses Yarn 4.x
2. **Test user credentials** - A valid user must exist in the API for authentication

**Environment Configuration:**

Add these variables to your `.env.development` file:

```env
# Playwright test configuration
FRONTEND_URL=http://localhost:3000
TEST_USERNAME=your_test_username
TEST_PASSWORD=your_test_password
```

**Installing Test Dependencies:**

```bash
yarn install
yarn test:install  # Downloads browser binaries with dependencies
```

**Running Tests:**

```bash
# CI mode - automatically starts API and frontend servers (recommended)
yarn test:ci                # All browsers, auto-starts servers
yarn test:ci:chromium       # Chromium only, auto-starts servers (fastest for CI)

# Manual mode - requires servers already running
yarn test                   # All browsers
yarn test:chromium          # Chromium only (fastest)
yarn test:firefox           # Firefox only
yarn test:webkit            # WebKit only

# Interactive/debugging modes
yarn test:ui                # Interactive UI for debugging
yarn test:headed            # Run with visible browser

# View results
yarn test:report            # Open HTML test report
```

**CI Mode vs Manual Mode:**

- **CI mode** (`yarn test:ci`): Automatically starts both API (port 8000) and frontend (port 3000) servers before
  tests and stops them after. Ideal for CI/CD pipelines and fresh environments.
- **Manual mode** (`yarn test`): Requires servers to be running beforehand. Useful during development when you
  already have servers running.

**Test Coverage:**

The tests validate:

1. **Form Loading** - All form elements are present and visible
2. **Validation** - Required fields are enforced, valid values accepted
3. **Payload Structure** - PUT/PATCH requests match API contract:
   - `NationalCalendarPayload` structure (litcal, settings, metadata, i18n)
   - `WiderRegionPayload` structure (litcal, national_calendars, metadata, i18n)
   - `DiocesanCalendarPayload` structure (litcal, settings, metadata)

**Valid Test Data:**

When writing tests that need real diocese/calendar data:

- **Diocese data**: Valid diocese names and IDs are in `LiturgicalCalendarAPI/jsondata/world_dioceses.json`
- **Format**: `{ "country_iso": "us", "dioceses": [{ "diocese_name": "Boston", "diocese_id": "boston_us" }] }`
- **National calendars**: USA, IT, DE, FR, etc. (2-letter ISO codes, uppercase)
- **Wider regions**: Americas, Europe, Asia, Africa, Oceania

**Troubleshooting:**

- **Authentication failures**: Ensure `TEST_USERNAME` and `TEST_PASSWORD` are set and valid
- **Port already in use**: Kill existing processes with `lsof -ti:8000 | xargs kill -9` and `lsof -ti:3000 | xargs kill -9`
- **Connection refused** (manual mode): Verify both API (port 8000) and frontend (port 3000) are running
- **WebKit missing libraries**: On Linux, some WebKit dependencies may be missing; use `yarn test:chromium` instead
- **Timeout errors**: Increase timeout in `playwright.config.ts` or check network latency
- **Server startup issues in CI mode**: Check that `../LiturgicalCalendarAPI` directory exists and has `composer.json`

### Writing E2E Tests for Calendar CRUD Operations

When writing Playwright tests for calendar CREATE/UPDATE/DELETE operations, understand the important schema
differences between calendar types.

**Calendar Schema Differences:**

The API validates payloads against different JSON schemas depending on calendar type. Key differences in the
`litcal` array actions:

| Calendar Type | Allowed Actions in `litcal[].metadata.action`                        |
|---------------|----------------------------------------------------------------------|
| National      | `setProperty`, `createNew`, `moveFeast`, `makeDoctor`, `makePatron`  |
| Wider Region  | `createNew`, `makePatron` only (NOT `setProperty`)                   |
| Diocesan      | `createNew`, `makePatron` only (NOT `setProperty`)                   |

**Important:** WiderRegion and Diocesan schemas only accept `createNew` or `makePatron` actions. Using
`setProperty` (which is valid for National Calendar) will cause a 422 schema validation error.

**Route Interception for Payload Capture (Not Modification):**

Tests should properly fill in forms rather than modifying payloads via route interception. Use `page.route()`
only to **capture** payloads for verification, not to modify them:

```typescript
let capturedPayload: any = null;
let capturedMethod: string | null = null;

await page.route('**/data/**', async (route, request) => {
    if (['PUT', 'PATCH'].includes(request.method())) {
        capturedMethod = request.method();
        const postData = request.postData();
        if (postData) {
            capturedPayload = JSON.parse(postData);
            console.log(`CAPTURED PAYLOAD: ${postData}`);
        }
    }
    await route.continue();  // Always continue without modification
});
```

**Required Form Fields for CREATE Tests:**

For `createNew` action, ensure the test properly fills all required fields:

1. **Common selection**: Select a value other than "Proper" (e.g., "Martyrs") to avoid adding `readings`
   property which is not allowed by WiderRegion/Diocesan schemas (`additionalProperties: false`)

2. **Decree URL and Langs** (WiderRegion/Diocesan only): Fill `.litEventDecreeURL` and `.litEventDecreeLangs`
   fields - these are required by the schema's `MetadataCreateNew` definition:

   ```typescript
   const decreeUrlInput = row.querySelector('.litEventDecreeURL') as HTMLInputElement;
   decreeUrlInput.value = 'https://www.vatican.va/content/francesco/en/decree.html';

   const decreeLangsInput = row.querySelector('.litEventDecreeLangs') as HTMLInputElement;
   decreeLangsInput.value = 'en=en';  // Format: KEY=value pairs
   ```

3. **Bootstrap-multiselect for locales**: Use `.multiselect('select', [...])` to select locales, then
   fill name fields for each locale

**WiderRegion-Specific Considerations:**

1. **Valid region names**: WiderRegion names must be one of: `Americas`, `Europe`, `Asia`, `Africa`,
   `Oceania`. Random/unique names will fail validation.

2. **Finding available regions**: Query the `/calendars` API to find existing wider regions, then use
   a region that doesn't have data:

   ```typescript
   const calendarsResponse = await page.request.get(`${apiBaseUrl}/calendars`);
   const calendarsData = await calendarsResponse.json();
   const existingRegionIds = calendarsData.litcal_metadata?.wider_regions_keys || [];

   const validRegions = ['Americas', 'Europe', 'Africa', 'Oceania', 'Asia'];
   const regionToCreate = validRegions.find(r => !existingRegionIds.includes(r));
   ```

3. **i18n validation**: The `i18n` object must have keys matching `metadata.locales`. If tests fail with
   "i18n object must have the same keys as found in the metadata.locales array", ensure the test fills
   name fields for all selected locales (each locale has a corresponding name field like
   `.litEventName_${locale}`).

**Known Issues in extending.js:**

During E2E test development, the following bug was discovered and fixed:

- **Missing `API.locale` in `buildWiderRegionPayload()`** (line ~2210): The `buildWiderRegionPayload()`
  function did not set `API.locale`, unlike `buildNationalCalendarPayload()` (line ~2182). This caused
  i18n validation errors when creating wider region calendars. The fix was to add:

  ```javascript
  API.locale = document.querySelector('.currentLocalizationChoices').value;
  ```

  This ensures the locale is properly captured in the payload for i18n validation.

## Troubleshooting

### API Connection Issues

Check:

1. API is running on configured host/port
2. `.env.development` settings are correct
3. CORS is properly configured on API

### Linting Failures

**PHP linting fails**:

```bash
composer lint:fix  # Auto-fix most issues
```

**Markdown linting fails**:

```bash
composer lint:md:fix  # Auto-fix formatting
```

**PHPStan errors**:

- Review reported issues
- Fix undefined variables
- Add type hints where needed

### CaptainHook Issues

If hooks aren't running:

```bash
vendor/bin/captainhook install -f
```

## Additional Documentation

- **README.md** - Project overview and setup
- **docs/AUTHENTICATION_ROADMAP.md** - JWT authentication implementation
- **CODE_OF_CONDUCT.md** - Community guidelines
- **Parent monorepo CLAUDE.md** - Overall project architecture

## Contributing

Before submitting changes:

1. ✅ Run all linting scripts (see "Before Committing" section)
2. ✅ Test changes locally
3. ✅ Ensure no console errors
4. ✅ Update documentation if needed
5. ✅ Follow commit message conventions

The pre-commit hooks will automatically check code quality, but it's good practice to run the scripts manually first.
