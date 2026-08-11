# Rite selector and rite-aware subscription URL on usage.php

**Date:** 2026-08-11
**Status:** Approved, pending implementation

## Problem

`usage.php`'s calendar-subscription card offers a nation/diocese dropdown and renders a
subscription URL from it. It has no notion of liturgical rite, so:

- The four Ambrosian dioceses (`milano_it`, `bergam_it`, `novara_it`, `lugano_ch`) are
  unreachable. A `CalendarSelect` defaults to the Roman rite and, as of
  liturgy-components-php v4.0.0, correctly partitions dioceses by rite.
- The Ambrosian rite-level calendar (`/calendar/ambrosian`) is unreachable.
- The General Roman Calendar itself is unreachable: the dropdown has no empty option, so
  only a nation or a diocese can be subscribed to.

The dropdown is rendered server-side by the PHP `CalendarSelect`. A rite selector has to
repartition that list when the rite changes, which a server-rendered select cannot do
without a round trip.

## Decisions

1. **The subscription card moves to liturgy-components-js.** `RiteSelect` and
   `CalendarSelect` render client-side and are linked with `linkToRiteSelect()`.
2. **The calendar select gains `allowNull(true)`**, making the rite-level calendar
   selectable. The empty option is self-labelling in components-js 2.1.0 — "General Roman
   Calendar" / "Ambrosian Calendar".
3. **The rite segment is always emitted, `roman` included.** Rite-explicit URLs become the
   default so users transition onto them, rather than leaving Roman an implicit special
   case. Existing implicit URLs keep resolving.
4. **The PHP-components bootstrap in `includes/common.php` is gated to `examples.php`.**
5. **Permanent Playwright coverage** is added as `e2e/usage.spec.ts`.

## Constraint: the PHP library stays a dependency

The frontend stops _rendering_ PHP components, but must keep hosting the library, because
the embedded PHP example borrows the host's autoloader and singletons:

- `examples/php/index.php:42` sets `$directAccess = false` when included rather than
  requested directly, and then **skips its own autoloader**. Embedded, it resolves `Rite`,
  `RiteSelect`, `LocaleResolver` and `ScopedLocale` from the frontend's `vendor/`. This is
  exactly what crashed when the frontend was pinned to `^3.3`.
- Its own `ApiClient::getInstance()` (line 193) sits inside the `$directAccess` block, so
  embedded, its `$apiClient->calendar()` (line 467) and
  `MetadataProvider::isValidDioceseForNation()` (line 433) run against the **host**
  singleton from `includes/common.php`.

Therefore `composer.json` keeps `liturgical-calendar/components: ^4.2`, and the
`ApiClient::getInstance()` bootstrap keeps existing — just no longer on every page.

## Changes

### `usage.php`

Remove `use LiturgicalCalendar\Components\CalendarSelect;`, the `new CalendarSelect(...)`
construction, and the `->getSelect()` render. In their place, two empty containers:

```html
<div class="form-group col-md" id="riteSelectContainer"></div>
<div class="form-group col-md" id="calendarSelectContainer"></div>
```

Label text stays in gettext rather than duplicating a translation map. `usage.php` already
serialises a `Messages` object to JS; `_('Select calendar')` and a new `_('Select rite')`
ride along in it. (`liturgyOfAnyDay.js` hand-rolls a 12-language map because the library's
`Messages` export is internal; here PHP already holds the strings.)

### `assets/js/usage.js`

Already loads as `type="module"` with the components-js importmap present, so no plumbing
is needed. Following the `liturgyOfAnyDay.js` precedent:

```js
const apiClient = await ApiClient.init(BaseUrl);

const riteSelect = new RiteSelect(lang)
    .class('form-select')
    .id('riteSelect')
    .label({ text: Messages['Select rite'], class: 'form-label' });
riteSelect.appendTo('#riteSelectContainer');

const calendarSelect = new CalendarSelect(lang)
    .class('form-select')
    .id('calendarSelect')
    .label({ text: Messages['Select calendar'], class: 'form-label' })
    .allowNull(true);
calendarSelect.appendTo('#calendarSelectContainer');

calendarSelect.linkToRiteSelect(riteSelect);
```

`linkToRiteSelect()` is called directly on `CalendarSelect`. `liturgyOfAnyDay.js` routes
the link through `ApiOptions` only because it also needs the locale input; this page does
not, so no `ApiOptions` instance is created.

**Ordering matters:** `riteSelect.appendTo()` must run before `linkToRiteSelect()`, which
reads the rite select's element to attach its change listener. This is the same constraint
noted at `liturgyOfAnyDay.js:119-121`.

Both selects get a `change` listener calling `updateSubscriptionURL()`. The listeners
attach to `#riteSelect` / `#calendarSelect` via `getElementById`, matching how
`updateSubscriptionURL()` already reaches the calendar select, rather than reaching into
component internals.

### The URL builder

`CurrentEndpoint` gains a `rite` field, and the segment is emitted **unconditionally** —
including `roman`:

```js
currentEndpoint += `/${CurrentEndpoint.rite}`;
```

The rite is a **path segment between `/calendar` and the nation/diocese pair** — there is
no `/calendar/rite/{rite}` spelling and no query parameter.

Note that `CurrentEndpoint.apiBase` is the `CalendarUrl` global, which already ends in
`/calendar`. The rite segment is therefore appended immediately after `apiBase` and
**before** the existing `/{calendarType}/{calendarId}` block — appending it later would
produce `/calendar/nation/IT/ambrosian`, which the API rejects.

This is the library's `explicitRite = true` behaviour, and it is deliberate: rite-explicit
URLs are the default from here on, and emitting `roman` starts moving users onto them
rather than leaving the Roman rite as an implicit special case. It also matches what
components-js itself renders on a page with a linked rite select — `ApiOptions` sets
`explicitRite = true` whenever `linkToRiteSelect()` runs (`ApiOptions.js:1047`).

This changes the URL the card displays for Roman selections, so it is a visible change, but
not a breaking one:

- `Router::extractRiteSegment()` accepts `roman` explicitly. Verified against both the local
  API and production (`litcal.johnromanodorazio.com/api/dev`): `/calendar/roman`,
  `/calendar/roman/nation/IT` and `/calendar/roman/diocese/romamo_it` all return `200`, and
  the ICS body of `/calendar/roman/nation/IT` is byte-identical to `/calendar/nation/IT`
  (modulo `DTSTAMP`/`UID`/`PRODID`).
- The bare forms keep resolving, so subscription URLs users have **already** pasted into
  Google Calendar, iPhone or Outlook continue to work untouched. Only newly copied URLs
  carry the explicit segment.

With `allowNull`, an empty selection nulls `calendarType`/`calendarId`, yielding
`/calendar/roman` or `/calendar/ambrosian`.

### `includes/common.php`

Gate the PHP-components bootstrap — Monolog logger, `FilesystemAdapter`, `Psr16Cache`,
`HttpClientFactory::createProductionClient()`, `ApiClient::getInstance()` — on the page that
consumes it, reusing the `$pageName` idiom already used in `layout/footer.php`:

```php
$pageName = basename($_SERVER['SCRIPT_FILENAME'], '.php');
if ('examples' === $pageName) {
    // ... existing bootstrap unchanged ...
}
```

Verified safe: `$httpClient`, `$cache`, `$logger` and `$filesystemAdapter` have no consumer
outside `common.php`. Every page that declares `$apiClient` immediately reassigns it with
the frontend's own `LiturgicalCalendar\Frontend\ApiClient` (`easter.php:47`,
`extending.php:43`, `missals-editor.php:37`), which is a different class.

Behaviour on `examples.php` stays byte-identical; 18 other pages stop constructing a
decorated Guzzle client, a filesystem cache adapter and a Monolog handler per request.

## Error handling

`ApiClient.init()` rejects on failure as of components-js 2.0.0. Use the same
`startPage()` / `.catch()` shape as `liturgyOfAnyDay.js:247`. On failure the two containers
stay empty and the card still shows its static subscription instructions and tabs, so the
page degrades rather than breaking.

## Testing

`e2e/usage.spec.ts`, running under the existing `chromium` project (which supplies
`storageState`; the page itself needs no auth). The subscription card is inside a collapsed
accordion, so each test expands `button[data-bs-target="#calSubscription"]` first.

Assertions:

| Rite      | Selection   | Expected subscription URL                         |
| --------- | ----------- | ------------------------------------------------- |
| Roman     | empty       | `/calendar/roman?return_type=ICS&year_type=CIVIL` |
| Roman     | nation `IT` | `/calendar/roman/nation/IT?...`                   |
| Roman     | diocese     | `/calendar/roman/diocese/romamo_it?...`           |
| Ambrosian | empty       | `/calendar/ambrosian?...`                         |
| Ambrosian | diocese     | `/calendar/ambrosian/diocese/lugano_ch?...`       |

Plus: switching to Ambrosian repartitions the list (no `optgroup`s, no national options,
the four Ambrosian dioceses present), and switching back to Roman restores the national
tier. A guard asserts every emitted URL carries an explicit rite segment, so a regression
back to the implicit Roman spelling fails the suite.

## Out of scope

- Adding a year to the subscription URL. It is intentionally absent so the subscription
  tracks the current year.
- Rite awareness anywhere else on the site.
- Removing `liturgical-calendar/components` from `composer.json` — load-bearing, see above.
