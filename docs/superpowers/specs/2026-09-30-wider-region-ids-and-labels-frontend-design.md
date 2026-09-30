# Wider region ids and labels: frontend

- **Issues:** #591, #66 (continued); follow-up to LiturgicalCalendarAPI #1018 / PR #1022
- **Amends:** `docs/superpowers/specs/2026-09-29-prospective-wider-regions-design.md` — wherever that spec says
  "name", read "id" for identity and "label" for display.
- **Branch:** `feat/prospective-wider-regions` (held until API PR #1022 is ready; both merge together)

## Goal

API #1018 separates a wider region's permanent **id** (lowercase kebab-case, `^[a-z]+(-[a-z]+)*$`) from its
**labels** (`metadata.labels`, keyed by language `it` or language plus script `zh_Hans`; allowed keys are `en` and the
languages of the region's `locales`). The frontend must identify regions by id everywhere, show them by label in
the user's language, and let curators edit a region's labels, one field per language, on the region's create/edit
page.

## API contract (from PR #1022)

- `/calendars` → `litcal_metadata.wider_regions[]`: `{ id, label, name, locales, api_path, national_calendars, roster }`.
  `label` is resolved for `Accept-Language`; `name` is a deprecated alias of `id`. `wider_regions_keys` lists ids.
- `GET /data/widerregion/{id}` → `metadata: { locales, wider_region: id, labels: { en, it, … } }`.
- `PUT`/`PATCH /data/widerregion/{id}` accept `metadata.labels`; a `PATCH` that omits `labels` keeps the stored ones.
- National calendars' `metadata.wider_regions` hold ids. Legacy capitalised names are still accepted on input.

The frontend reads `region.id ?? region.name` and `region.label ?? region.name`, so it keeps working against an API
that predates #1018.

## Decisions

1. **One label field per language**, not per language–country pair. A field shows the flags of every member country
   whose selected locale uses that language (`de` in the German Language Area: 🇩🇪 🇦🇹 🇨🇭 🇱🇺).
2. **Alignment.** The flag cell has a fixed width, so every input starts at the same position. More than four flags
   collapse into the first three plus a `+N` badge; the cell's tooltip lists every country. The `en` field, when no
   member uses English, shows 🌐.
3. **All five continents are prospective.** `africa` and `oceania` join the list even without a known patron decree;
   `americas`, `asia` and `europe` exist and come from `/calendars`.
4. **M.49 suggestions for any region with an M.49 code.** Europe (`150`), the Americas (`019`), Asia (`142`),
   Africa (`002`), Oceania (`009`), North Africa (`015`) and Southern Africa (`018`) have UN M.49 codes; ICU/CLDR names them in most
   languages. An empty label field of such a region, existing or prospective, is pre-filled with the ICU name and
   marked as suggested (italic, tooltip "Suggested from UN M.49 / CLDR") until edited; saving stores it, so the
   frontend seeds the languages the API has no label for yet. A stored label always wins over a suggestion.
5. **Prospective labels live on the frontend**, in the same shape as the API's (`labels` map), and pre-fill the label
   fields when the region is created. A continent may give its UN M.49 code (`m49`), from which any language's label
   is derived with ICU/`Intl.DisplayNames`, as the API seeded Europe's. A curated label wins over a derived one.

## Part 1: shared helpers (`assets/js/prospectiveWiderRegions.js`)

- `WIDER_REGION_ID_PATTERN = /^[a-z]+(-[a-z]+)*$/` and `isValidWiderRegionId(id)` replace the name pattern and
  `isValidWiderRegionName`. `NationalCalendarPayload.js` validates `wider_regions` with the id pattern.
- `regionId(region)` → `region.id ?? region.name`; `regionLabel(region)` → `region.label ?? region.name`.
- `labelKeyForLocale(locale)` → `zh_Hans_SG` → `zh_Hans`, `it_CH` → `it`, `de` → `de`.
- `idToWords(id)` → `german-language-area` → `German Language Area`.
- `resolveLabel(labels, uiLocale, id, m49)` → language plus script, then language, then `en`, then the M.49 name in
  the UI language (when `m49` is given), then `idToWords(id)`.
- `findProspectiveRegion(prospective, id)` matches by `id`.

## Part 2: prospective data

`assets/data/ProspectiveWiderRegions.json` entries become:

```json
{
    "id": "german-language-area",
    "labels": { "en": "German Language Area", "de": "Deutsches Sprachgebiet" },
    "m49": null,
    "description": "Regionalkalender für das deutsche Sprachgebiet",
    "roster": ["DE", "AT", "CH", "LU"],
    "locales": ["de_DE", "de_AT", "de_CH", "de_LU"],
    "sources": ["N1972-2069-71", "N1972-2069"],
    "note": "…"
}
```

| `id`                                          | `labels` (curated)                                                                                                                                         | `m49` |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `africa`                                      | —                                                                                                                                                          | `002` |
| `german-language-area`                        | en German Language Area; de Deutsches Sprachgebiet                                                                                                         | —     |
| `malaysia-singapore-brunei`                   | en Malaysia, Singapore and Brunei; ms Malaysia, Singapura dan Brunei                                                                                       | —     |
| `nordic`                                      | en Nordic Countries; da Norden; sv Norden; nb Norden; fi Pohjoismaat; is Norðurlönd                                                                        | —     |
| `north-africa`                                | en North Africa; fr Afrique du Nord                                                                                                                        | `015` |
| `oceania`                                     | —                                                                                                                                                          | `009` |
| `senegal-mauritania-cabo-verde-guinea-bissau` | en Senegal, Mauritania, Cabo Verde and Guinea-Bissau; fr Sénégal, Mauritanie, Cap-Vert et Guinée-Bissau; pt Senegal, Mauritânia, Cabo Verde e Guiné-Bissau | —     |
| `southern-africa`                             | en Southern Africa                                                                                                                                         | `018` |

`africa` and `oceania` rosters are the UN M.49 members of `002` / `009` that have Latin-rite dioceses (every code
must appear in `assets/data/WorldDiocesesByNation.json`); they suggest no locales.

`src/ProspectiveWiderRegions.php`:

- validates `id` against `^[a-z]+(-[a-z]+)*$`, `labels` keys against `^[a-z]{2,3}(_[A-Z][a-z]{3})?$` with non-empty
  string values, `m49` against `^\d{3}$` or null, and the roster as before; drops invalid entries and duplicate ids;
- `all(string $uiLocale, string $source = …)` returns
  `list<{id, label, labels, m49, description, roster, locales}>` sorted by `label` with a Collator for `$uiLocale`,
  where `label` is resolved as in Part 1 (M.49 via `Locale::getDisplayRegion('und_' . $m49, $uiLocale)`, first letter
  upper-cased).

## Part 3: pickers and region lists

- Both permission pickers (`widerRegionObjectIdSelect.js`): option value = id, text = label plus roster summary —
  the codes when there are six or fewer, otherwise `{label} ({N} nations)` (translatable). Existing regions use
  `regionId`/`regionLabel`; prospective ones their resolved `label`.
- `widerRegions.js` and `widerRegionForNation.js` compare regions by `regionId`. The national page's
  `#associatedWiderRegions` option value = id, text = label.
- `widerRegionEditRights.js` and `CalendarEditRights.widerRegions` compare ids (grants are stored on ids after the
  API migration).

## Part 4: the label editor (extending page, wider region)

- New module `assets/js/widerRegionLabels.js`:
    - `labelFieldsFor(locales)` → ordered `[{ key, regions: [ISO…] }]`: `en` first (always present), then each distinct
      `labelKeyForLocale` of the selected locales in selection order, each with the region subtags of the locales that
      map to it.
    - `buildWiderRegionLabelFields({ fields, values, i18n })` → a `<div id="widerRegionLabels">` with one row per field:
      a fixed-width flag cell (≤ 4 flags, else 3 + `+N`, tooltip = country names), the language key in monospace, and
      `<input class="form-control" data-label-key="{key}">` pre-filled from `values[key]`. Reuses the emoji-flag
      technique of `country2flag`, moved into this module and imported by `extending.js`.
    - `collectLabels(container)` → `{ key: trimmed value }` for non-empty inputs.
- CSS (`assets/css/extending.css`): a grid `grid-template-columns: 7.5rem 3.5rem 1fr` per row, rows in two columns
  from `md` up, the flag cell `overflow: hidden; white-space: nowrap`.
- Placement: a full-width `col-12` block at the end of the wider-region settings row in `extending.php`, with a
  heading "Region name" (translatable) and a hint that the English label is used when a language has none.
- Lifecycle in `extending.js`:
    - rebuilt whenever `#widerRegionLocales` changes, keeping values already typed;
    - **load** an existing region: values from `metadata.labels`;
    - **create** a prospective region: values from its `labels`, plus, for an `m49` region, the ICU name for every
      field without one (`Intl.DisplayNames([key], { type: 'region' }).of(m49)`);
    - **create** any other new region: empty, with `idToWords(id)` as the `en` placeholder;
    - **save**: `metadata.labels = collectLabels(…)` (omitted when empty), `metadata.wider_region = id`.
- Edit rights: a whole-region editor edits every label; a national editor with translation-only rights edits a label
  only if they may edit some selected locale of that language (`editsWiderRegionLocale`), never `en` unless English
  is one of those.
- The region chooser: datalist values are ids (`{id} - {locale}` for existing regions, `{id}` for prospective), with
  the label in the option's `label`. The up-front check and the `API` key trap use `isValidWiderRegionId`; the error
  message states the id rule. `WiderRegionPayload` accepts an optional `metadata.labels` object of strings.

## Part 5: tests

- Unit: helpers (Part 1), label fields (`labelFieldsFor`, the builder's flag cell and `+N`, `collectLabels`), pickers
  (ids, labels, roster summary), `widerRegions.js` by id, `WiderRegionPayload` labels.
- PHPUnit: new entry shape, label resolution incl. M.49, invalid ids/labels/m49 dropped, every roster code is a nation
  with Latin-rite dioceses.
- E2E (against the stack running API PR #1022): the create test uses `german-language-area` (no single-word
  restriction); it asserts one `de` field with four flags pre-filled "Deutsches Sprachgebiet", an `en` field, and
  `metadata.labels` in the PUT payload; generated fallback ids are `testregion-xxxx`; the picker shows labels.
- Docs: CLAUDE.md's wider-region paragraph describes ids, labels and the label editor.

## Out of scope

- Removing the `name` fallback (after the API drops the deprecated alias).
- Labels for national or diocesan calendars.
