# Adopting DayViewer on liturgyOfAnyDay.php

**Date:** 2026-08-11
**Status:** Approved, pending implementation

## Problem

`assets/js/liturgyOfAnyDay.js` is 257 lines that hand-wire four components — `RiteSelect`,
`CalendarSelect`, `ApiOptions(LOCALE_ONLY)` and `LiturgyOfAnyDay` — to each other and to an
`ApiClient`. liturgy-components-js v2.2.0 ships `DayViewer`, which bundles exactly that wiring.

The library's own CHANGELOG names this file as the page the component was extracted from:

> the page this was extracted from mounts its four parts into four separate containers, which a
> single `appendTo()` target cannot express

Three things in our file are now library responsibilities:

1. **An 86-line `translations` map.** Written because the library's `Messages` is not exported. It
   supplies six labels: `selectCalendar`, `selectRite`, `language`, `day`, `month`, `year`.
2. **The rite's two-wire requirement.** `ApiOptions.linkToRiteSelect()` rebuilds the calendar list and
   disables rite-fixed temporal options; `apiClient.listenTo(riteSelect)` is the only one of the two
   that turns the rite into a path segment. Wiring just the first fails silently — the form reads
   `ambrosian` while every request goes to `/calendar/roman/`. Ours is currently correct.
3. **The locale-matching cascade** — exact match, then language-prefix, then first available.

## Decisions

1. **Convert `liturgyOfAnyDay.js` to `DayViewer.mountInto()` with a slots object.**
2. **Write `e2e/liturgyOfAnyDay.spec.ts` FIRST**, as a characterization test against the current
   hand-wired page, then convert and prove it still passes.
3. **Surface mount failures to the user** via `toastr`, not console-only as today.
4. **`usage.js` and `index.js` stay hand-wired** (see Out of scope).

## Why the deletions are safe

Each removal is backed by a checked fact, not an assumption:

| Removed                                      | Replaced by                                                        | Verified                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 86-line `translations` map                   | The children's own localized labels                                | `DayViewer.js:109-113` deliberately omits label `text` so each child supplies its own localized label. v2.2.0 added `DAY`, `LANGUAGE` and `YEAR` to `Messages` — exactly the three of our six keys the library previously lacked. Coverage is **83 languages** vs our 12. |
| Manual rite double-wiring                    | `DayViewer`'s internal wiring                                      | The component exists for this; the CHANGELOG calls it "the whole reason this component exists".                                                                                                                                                                           |
| Locale-matching cascade                      | `viewer.selectedLocale`                                            | Documented in `docs/meta-components.md`.                                                                                                                                                                                                                                  |
| `_localeInput._labelElement.textContent = …` | theme `localeInput.labelText`, or the library's `LANGUAGE` message | Reaching into a private is what the theme bag's `labelText` key exists to replace.                                                                                                                                                                                        |

## Current configuration to preserve

`liturgyOfAnyDay.php` is **not** modified — its four containers already match `DayViewer`'s slot names.

| Slot       | Container                   | Today                                                                                                               |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `rite`     | `#riteSelectContainer`      | `.class('form-select')`, `#riteSelect`, label `form-label`                                                          |
| `calendar` | `#calendarSelectContainer`  | `.class('form-select')`, `#calendarSelect`, label `form-label`                                                      |
| `locale`   | `#localeSelectContainer`    | `#apiOptionsLocale`, `.class('form-select')`, label `form-label`                                                    |
| `liturgy`  | `#liturgyOfAnyDayContainer` | `#liturgyOfAnyDay`, `.class('card shadow m-2')`, date controls `wrapperClass: 'col-md'`, `labelClass: 'form-label'` |

Expressed as a theme bag:

```javascript
theme: {
    select: 'form-select',
    label: 'form-label',
    liturgy: { class: 'card shadow m-2' },
    dateControls: { labelClass: 'form-label', wrapperClass: 'col-md' },
}
```

The four element **ids** are not theme keys, and are unaffected by the note below. They are set after
the mount through the public getters — `viewer.riteSelect.id('riteSelect')`,
`viewer.calendarSelect.id('calendarSelect')`, `viewer.localeInput.id('apiOptionsLocale')`,
`viewer.liturgy.id('liturgyOfAnyDay')` — since `id()` is not one-shot.

**`label()` is one-shot, and the theme bag calls it.** Once the theme bag has themed a child's label
(which the flat `label` key above does for every child), calling
`viewer.calendarSelect.label({ text: … })` throws `Label has already been set`. Custom label _text_
must therefore go through the per-child `labelText` theme key instead. We intend to take the library's
localized defaults, so this should not arise — but it is the trap to watch if a label ever needs
overriding.

## Error handling

Today the page ends with `initializePage().catch(e => console.error(...))` — invisible to the user.

`mountInto()` accepts `onError`, registered **before** the initial fetch, so a failure of that very
first request still reaches it. Route it to a visible toast alongside the retained `console.error`.

**Use `showToast(message, 'danger')`, not `toastr`.** An earlier draft of this spec said "toastr is
already loaded on this page" — that is wrong. `layout/footer.php:125` loads the toastr CDN bundle only
for `['index', 'extending', 'usage', 'missals-editor', 'admin-dashboard', 'examples']`, and
`liturgyOfAnyDay` is not among them. What _is_ available is `window.showToast(message, type)` from
`assets/js/toast.js`, loaded unconditionally for every page at `layout/footer.php:87`. It is also the
direction the codebase is already moving (`docs/TOAST_MIGRATION_PROPOSAL.md`), and the idiom used by
`developer-dashboard.js`.

`liturgyOfAnyDay.php` has **no** `$messages` block today, so one must be added following the pattern at
`usage.php:9-27` — the `$messages` array with `/** translators: */` comments, and the
`const Messages = <?php echo json_encode(...) ?>;` script at `usage.php:420`.

## Testing

`e2e/liturgyOfAnyDay.spec.ts`, written **before** the conversion and unchanged by it. That ordering is
the point: a test written against the new code proves only that the new code does what it does.

The page needs no auth, so it runs in the `chromium` project. Note that project does not currently run
in CI (issue #448) — this spec is a local and manual-dispatch guard until that lands.

Coverage:

- all four children render into their four containers
- the rite select offers Roman and Ambrosian; switching to Ambrosian repartitions the calendar list
  (no national options, the four Ambrosian dioceses present)
- selecting a calendar and a date renders liturgical events
- **the rite reaches the request** — the crux, and the trap `DayViewer` exists to prevent. Assert on
  the actual network request URL (`page.on('request')` or `waitForRequest`) that choosing the Ambrosian
  rite produces `/calendar/ambrosian/...`, not `/calendar/roman/...`. A DOM-only assertion cannot see
  this failure mode.
- the locale input lists locales and defaults sensibly
- labels are localized: load with a non-English `currentLocale` cookie and assert a translated label,
  proving the library's `Messages` genuinely replaces the deleted map

## Out of scope

- **`usage.js`** — `CalendarResourcePicker` rejects `CalendarSelectFilter.NONE` and makes the empty
  option a disabled placeholder. `usage.php` needs an all-calendars list and a _selectable_ empty
  option meaning the rite-level calendar, which shipped in #446. Asked upstream as
  liturgy-components-js#42.
- **`index.js`** — a PathBuilder/API-explorer page; neither meta-component models it.
- **The three `CalendarResourcePicker` call sites** (`admin-permissions.js`, `permission-requests.js`,
  `admin-tests.js`) — a separate PR once this one proves the pattern. Two of them are RBAC-critical and
  covered only by the `rbac` e2e project.
