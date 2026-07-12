# Task 3 Report: Capability Detection + Enriched Read-Only View

## Status: COMPLETE

## Commit

`18c9ca5c` — feat: capability-gated enriched decrees listing

## Files Changed

- **`assets/js/admin-decrees.js`** (created, 455 lines of logic)
- **`admin-decrees.php`** (modified: added `userSub` to `window.AdminDecreesConfig`)

## Gate Results

| Gate | Result |
|------|--------|
| `node --check assets/js/admin-decrees.js` | PASS (no output) |
| `yarn lint assets/js/admin-decrees.js` | PASS (no output) |
| `yarn test:unit` | PASS — 52 tests, 2 test files |
| `php -l admin-decrees.php` | PASS — No syntax errors |
| `vendor/bin/phpcs admin-decrees.php` | PASS (no output) |

## Implementation Notes

### Capability Detection

- `detectCapabilities()` short-circuits to full access when `config.isGlobalAdmin === true`.
- For regular users, fires three parallel `GET /admin/permissions/check` calls with `?user=<sub>&object_type=general_roman_calendar&object_id=decrees&relation=<viewer|editor|admin>`.
- The `user` param uses the caller's OIDC sub (raw, not prefixed) from `config.userSub` — which triggers the API's self-check exemption on the feature branch (`normalizeUser($user) === "user:{$userId}"`).
- If `userSub` is empty (edge case), all capabilities are denied rather than sending a malformed request.

### PHP Config Change

Added `userSub: <?php echo json_encode($authHelper->sub ?? ''); ?>` immediately after `isGlobalAdmin` in the `window.AdminDecreesConfig` block. `AuthHelper::$sub` is `public readonly ?string`.

### Card Rendering (`renderDecreeCard`)

- Title: localized `liturgical_event.name` (falls back to `decree_id`).
- Sub-title: raw `decree_id` in muted text.
- **Badges**: grade (numeric → label via `gradeLabel()`), liturgical colours (Bootstrap bg- via `colorBgClass()`), type (`fixed`/`mobile`), common entries.
- **Date line**: `renderEventDate()` handles fixed (`month + day` → locale month name via `Intl.DateTimeFormat`), mobile object form (`day_of_the_week relative_time event_key`), mobile string form, and JSON-stringify fallback — never throws.
- **Collapsible translations panel**: request-locale name shown immediately; other locale names fetched lazily on `show.bs.collapse` via `GET /decrees/{id}` with `Accept-Language` header, cached in `translationCache` Map.
- **Collapsible readings panel**: only rendered when `event.readings` is present and non-empty; displays all locale entries as a definition list.
- **Metadata footer**: decree date, protocol, `since_year`, source URL (external link), manage-permissions link (only when `canAdmin`).
- Edit button: `d-none` unless `canEdit`. Delete button: `d-none` unless `canAdmin`.

### XSS Safety

All user-visible API strings are set via `.textContent` or `document.createTextNode()`. No `innerHTML` is used with API-derived data. Static HTML structure (icons, badge containers) uses `document.createElement()`.

### Exports for Future Tasks

- `detectCapabilities()` — async, returns `{canView, canEdit, canAdmin}`
- `capabilitiesPromise` — eagerly resolved promise; Tasks 4/5 import this
- `renderDecreeCard()` — single-card renderer for post-CRUD refresh
- `gradeLabel(grade)` — pure mapping, unit-testable
- `colorBgClass(color)` — pure mapping, unit-testable
- `renderEventDate(event)` — pure formatter, unit-testable

### Known Concerns

1. **`CSS.escape()` for collapse IDs**: Uses `CSS.escape(decreeId)` to make IDs safe for Bootstrap's `data-bs-target` selector. If decree IDs contain characters that map to long escape sequences, the collapse may not function. In practice decree IDs appear to be alphanumeric with underscores, so this is not an issue.

## Fix round 1

### Changes

Three review findings fixed in `assets/js/admin-decrees.js` and `admin-decrees.php`:

**Fix 1 — locale list from `/calendars` metadata (major):**

`loadDecrees()` now fires `GET /decrees` and `GET /calendars` in parallel via `Promise.all`. The public `/calendars` endpoint (MetadataHandler) is fetched without credentials using the native `fetch()` API (no cookie forwarding needed). The `locales` field is extracted from `response.litcal_metadata.locales` (a `string[]` on the `MetadataCalendars` model confirmed in `src/Models/Metadata/MetadataCalendars.php` line 98 and `jsonSerialize()` line 182). If the metadata fetch fails or the field is absent, falls back to `[requestLocale]`.

**Fix 2 — locale normalization dedup (minor):**

A `canonicalLocale(locale)` helper normalizes to lowercase + underscores. In `loadDecrees`, `requestLocale` is derived from `config.locale` with a global `/[-]/g → '_'` replace (previously only replaced the first dash). The dedup filter compares `canonicalLocale(l) !== canonicalLocale(requestLocale)` to prevent the request locale appearing twice when the metadata list uses a different separator/casing convention. Original locale values (not canonical forms) are kept in `allLocales` so they are sent as-is in `Accept-Language` headers. The `buildTranslationsPanel` call site in `renderDecreeCard` was also updated from `.replace('-','_')` (single replace) to `.replace(/-/g,'_')` (global replace) for consistency.

**Fix 3 — i18n empty-state string (minor):**

`admin-decrees.php`: added `noDecrees: <?php echo json_encode(_('No decrees found.')); ?>` to the `window.AdminDecreesConfig.i18n` block (gettext-wrapped, between `loadFailed` and `confirmDelete`).
`admin-decrees.js`: the empty-state `div.textContent` now reads `config.i18n.noDecrees` instead of the hardcoded English string `'No decrees found.'`.

### Verified `/calendars` JSON path

```
GET /calendars → { "litcal_metadata": { ..., "locales": string[] } }
```

Confirmed via `MetadataHandler.php` (line 59: `json_encode(['litcal_metadata' => $metadataCalendars])`) and `MetadataCalendars::jsonSerialize()` (line 182: `'locales' => $this->locales`).

### Gate outputs

| Gate | Result |
|------|--------|
| `node --check assets/js/admin-decrees.js` | PASS |
| `npx eslint assets/js/admin-decrees.js` | PASS (no output) |
| `npx vitest run` | PASS — 52 tests, 2 files |
| `php -l admin-decrees.php` | PASS — No syntax errors |
| `vendor/bin/phpcs admin-decrees.php` | PASS (no output) |
