# LiturgicalCalendarFrontend — Project Overview

PHP-based **website frontend** that presents data from the Liturgical Calendar API. Provides:

- Documentation + interactive examples for the API
- UI for exploring liturgical events
- Editors for **National Calendars**, **Diocesan Calendars**, **Wider Region** layers, **Missals**, **Decrees**
- Admin/dashboard pages for users, applications, role/permission requests

## Live instances

- Production: <https://litcal.johnromanodorazio.com/>
- Staging: <https://litcal-staging.johnromanodorazio.com/>

## Tech Stack

- **PHP >= 8.4** (composer package `liturgical-calendar/frontend`, namespace `LiturgicalCalendar\Frontend\` → `src/`)
- Bootstrap UI theme, vanilla ES6+ JavaScript (no SPA framework)
- **liturgy-components-js** (sister project) — frontend components, loaded via npm CDNs (jsDelivr, cdnjs, unpkg, skypack) or local symlink in dev
- PHP deps: `liturgical-calendar/components` ^3.3, `vlucas/phpdotenv`, `monolog/monolog`, `symfony/cache`, `guzzlehttp/guzzle`, `firebase/php-jwt`
- Quality: PHPUnit 11/12, PHPStan **level 7**, PHP_CodeSniffer (PSR-12, modified)
- E2E tests: **Playwright** + TypeScript
- Node tooling: Yarn 4 (PnP), Node >=22; ESLint, prettier, markdownlint-cli2
- Hooks: CaptainHook
- gettext for i18n (with **numbered placeholders** — see conventions)

## Repo Location

`/home/johnrdorazio/development/LiturgicalCalendar/LiturgicalCalendarFrontend`

Companion repos in `LiturgicalCalendar/` parent:

- `LiturgicalCalendarAPI` — PHP backend
- `UnitTestInterface` — integrity check UI (uses API's WebSocket server)
- `liturgy-components-js` — JS components consumed here

## Critical rules (from CLAUDE.md)

- **Branching**: feature branches off `development`; PRs target `development`; **NEVER `main`** (`gh pr create --base development`)
- **Never `--no-verify`** — pre-commit runs `composer lint` + `composer lint:md`
- **Don't push immediately after commit** — CodeRabbit rate-limits; wait for explicit user request or batch commits

## Default ports (dev)

- API: `localhost:8000`
- Frontend: `localhost:3000`
