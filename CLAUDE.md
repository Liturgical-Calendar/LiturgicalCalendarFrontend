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
├── examples/           # Example implementations (separate repository)
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
2. Configure API connection:

   ```env
   API_PROTOCOL=http
   API_HOST=localhost
   API_PORT=8000
   ```

### Running the Development Server

```bash
php -S localhost:3000
```

Ensure the API is running on the configured host/port (default: localhost:8000).

## Code Quality and Linting

### Available Scripts

All linting and quality scripts are defined in `composer.json`:

```bash
# PHP Syntax Checking
composer parallel-lint       # Check PHP syntax in all files

# PHP Code Standards (PSR-12)
composer lint                # Check code standards
composer lint:fix            # Auto-fix code standard violations

# PHPStan Static Analysis
composer analyse             # Run PHPStan level 1 analysis

# Markdown Linting
composer lint:md             # Check markdown files
composer lint:md:fix         # Auto-fix markdown issues

# Tests
composer test                # Run PHPUnit tests (when available)
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

### Markdown

**Configuration**: `.markdownlint.yaml`

**Key Rules**:

- Max line length: 180 characters (excluding code blocks/tables)
- Fenced code blocks required
- Blank lines around headings
- Table column style checking disabled (MD060)

## PHPStan Configuration

**File**: `phpstan.neon.dist`

**Analyzed Paths**:

- `src/` - PHP classes
- `includes/` - Include files
- `layout/` - Layout components
- Root PHP files (index.php, extending.php, admin.php, etc.)

**Excluded**:

- `examples/` - Separate repository
- `.intelephense-helper.php` - IDE helper

**Level**: 1 (can be increased as code quality improves)

## Authentication

The frontend implements JWT authentication for administrative features:

**Files**:

- `assets/js/auth.js` - JWT authentication module
- `includes/login-modal.php` - Login UI and handlers
- `layout/header.php` - Authentication status in navbar

**Key Features**:

- JWT token storage (sessionStorage/localStorage)
- Automatic token refresh
- Session expiry warnings
- Protected UI elements with `data-requires-auth` attribute

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

### Internationalization

Uses PHP gettext:

```php
<?php echo _('Translate this text'); ?>
```

Translation files: `i18n/*.po`

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

The API configuration is available globally as `APIConfig`:

```javascript
const apiUrl = `${APIConfig.BaseUrl}/calendar?year=2024`;
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

Currently, the project has minimal automated tests. When adding tests:

1. Place test files in `tests/` directory
2. Run with `composer test`
3. Follow PHPUnit conventions

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
