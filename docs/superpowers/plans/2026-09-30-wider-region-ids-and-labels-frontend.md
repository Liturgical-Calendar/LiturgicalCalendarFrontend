# Wider Region Ids and Labels (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify wider regions by kebab-case id, show them by localized label, and edit a region's labels (one field
per language, with the member countries' flags) on the extending page — the frontend half of API #1018 / PR #1022.

**Architecture:** Pure helpers in `assets/js/prospectiveWiderRegions.js` (id rule, label resolution) and a new
`assets/js/widerRegionLabels.js` (label fields) are unit-tested; the PHP reader resolves prospective labels
server-side; `extending.js` and the pickers consume them. Every read of an existing region goes through
`regionId`/`regionLabel`, which fall back to the deprecated `name`.

**Tech Stack:** PHP 8.4 (PHPUnit, PHPStan, phpcs, intl), vanilla ES modules (Vitest + jsdom), Playwright, gettext.

**Spec:** `docs/superpowers/specs/2026-09-30-wider-region-ids-and-labels-frontend-design.md` (amends
`docs/superpowers/specs/2026-09-29-prospective-wider-regions-design.md`)

## Global Constraints

- Region id rule, identical everywhere: `^[a-z]+(-[a-z]+)*$`. Label key rule: `^[a-z]{2,3}(_[A-Z][a-z]{3})?$`.
- Option values and payload keys are ids; visible text is labels. Never compare regions by label.
- Existing regions: `id ?? name` for identity, `label ?? name` for display.
- One label field per language; `en` always first; fixed-width flag cell, ≤ 4 flags else 3 + `+N`.
- New UI strings via gettext `_()` (PHP) or `Messages[...]` (extending page) / `config.i18n` (permission pages).
- PHP: single quotes, short arrays, aligned `=>`; `composer lint`, `composer analyse` clean.
- JS: ES modules, JSDoc on exports; lint with `node_modules/.bin/eslint .` (`yarn lint` is broken in this checkout
  for an environmental reason — do not repair it).
- Commits: never `--no-verify`, quoted heredoc, no push. End each commit message with the two trailer lines given in
  the dispatch.

## Review Focus

1. **Older API** (no `id`/`label` in `/calendars`): pickers, national page and extending page still work using
   `name`. Pinned in Tasks 1, 4.
2. **A locale with a script** (`zh_Hans_SG`): its field key is `zh_Hans`, not `zh`. Pinned in Tasks 1, 5.
3. **Many countries per language** (Europe's `de`: AT BE DE LI LU CH): three flags plus `+3`, inputs aligned. Pinned
   in Task 5.
4. **Removing a locale** whose language still has another selected locale keeps that language's field and its value.
   Pinned in Task 5.
5. **Translation-only editor** cannot edit `en` or other languages' labels. Pinned in Task 6 (unit via the rights
   helper) and E2E where the rbac suite covers it.

---

### Task 1: Id and label helpers

**Files:**

- Modify: `assets/js/prospectiveWiderRegions.js`
- Modify: `assets/js/NationalCalendarPayload.js` (import `WIDER_REGION_ID_PATTERN` instead of the name pattern)
- Modify: `assets/js/extending.js` — only the two call sites of `isValidWiderRegionName` (search for it): switch to
  `isValidWiderRegionId` (the error message text is updated in Task 6)
- Test: `assets/js/__tests__/prospectiveWiderRegions.test.js`, `assets/js/__tests__/NationalCalendarPayload.test.js`

**Interfaces — Produces** (named exports of `prospectiveWiderRegions.js`):

- `WIDER_REGION_ID_PATTERN: RegExp`, `isValidWiderRegionId(id: unknown): boolean`
- `regionId(region: {id?: string, name?: string}): string`, `regionLabel(region: {label?: string, name?: string}): string`
- `labelKeyForLocale(locale: string): string`
- `idToWords(id: string): string`
- `resolveLabel(labels: Object<string,string>|null|undefined, uiLocale: string, id: string, m49?: string|null): string`
- `findProspectiveRegion(prospective, id)` (by `id`), `rosterToNationalCalendars`, `widerRegionNationalCalendars`,
  `offeredLocales` (unchanged)
- Removed: `WIDER_REGION_NAME_PATTERN`, `isValidWiderRegionName`

- [ ] **Step 1: Replace the name tests with id/label tests**

In `assets/js/__tests__/prospectiveWiderRegions.test.js`, replace the `isValidWiderRegionName` describe block and
the `findProspectiveRegion` fixtures (`{ name: … }` → `{ id: … }`) and add:

```js
describe('isValidWiderRegionId', () => {
    it.each([
        'europe',
        'german-language-area',
        'senegal-mauritania-cabo-verde-guinea-bissau',
    ])('accepts %s', (id) => {
        expect(isValidWiderRegionId(id)).toBe(true);
    });
    it.each([
        '',
        'Europe',
        'german language area',
        'german--area',
        '-europe',
        'europe-',
        'são-tomé',
        'area1',
        42,
        null,
    ])('rejects %s', (id) => {
        expect(isValidWiderRegionId(id)).toBe(false);
    });
    it('exposes the pattern', () => {
        expect(WIDER_REGION_ID_PATTERN.source).toBe('^[a-z]+(-[a-z]+)*$');
    });
});

describe('regionId / regionLabel', () => {
    it('prefer id and label', () => {
        const region = { id: 'europe', label: 'Europa', name: 'europe' };
        expect(regionId(region)).toBe('europe');
        expect(regionLabel(region)).toBe('Europa');
    });
    it('fall back to name on an older API', () => {
        expect(regionId({ name: 'Europe' })).toBe('Europe');
        expect(regionLabel({ name: 'Europe' })).toBe('Europe');
    });
});

describe('labelKeyForLocale', () => {
    it.each([
        ['it_IT', 'it'],
        ['it_CH', 'it'],
        ['de', 'de'],
        ['zh_Hans_SG', 'zh_Hans'],
        ['zh-Hant-TW', 'zh_Hant'],
        ['sr_Latn_RS', 'sr_Latn'],
    ])('%s → %s', (locale, key) => {
        expect(labelKeyForLocale(locale)).toBe(key);
    });
});

describe('idToWords', () => {
    it('title-cases each word', () => {
        expect(idToWords('german-language-area')).toBe('German Language Area');
        expect(idToWords('europe')).toBe('Europe');
    });
});

describe('resolveLabel', () => {
    const labels = { en: 'Chinese Area', zh_Hans: '华语区', it: 'Area cinese' };
    it('tries language plus script, then language, then en', () => {
        expect(resolveLabel(labels, 'zh_Hans_CN', 'chinese-area')).toBe(
            '华语区',
        );
        expect(resolveLabel(labels, 'it_IT', 'chinese-area')).toBe(
            'Area cinese',
        );
        expect(resolveLabel(labels, 'zh_Hant_TW', 'chinese-area')).toBe(
            'Chinese Area',
        );
        expect(resolveLabel(labels, 'fr', 'chinese-area')).toBe('Chinese Area');
    });
    it('uses the M.49 name before the id words', () => {
        expect(resolveLabel({}, 'fr', 'africa', '002')).toBe('Afrique');
        expect(
            resolveLabel({ fr: 'Continent africain' }, 'fr', 'africa', '002'),
        ).toBe('Continent africain');
    });
    it('falls back to words from the id', () => {
        expect(resolveLabel(null, 'it', 'north-africa')).toBe('North Africa');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test:unit assets/js/__tests__/prospectiveWiderRegions.test.js`
Expected: FAIL (missing exports).

- [ ] **Step 3: Implement**

In `assets/js/prospectiveWiderRegions.js`: update the module doc comment (regions are identified by id since
API #1018), change the `ProspectiveRegion` typedef to
`{ id: string, label: string, labels: Object<string,string>, m49: string|null, description: string, roster: string[], locales: string[] }`,
remove `WIDER_REGION_NAME_PATTERN`/`isValidWiderRegionName`, make `findProspectiveRegion` match `region.id === id`,
and add:

```js
/** The API's WiderRegionId rule (#1018): lowercase kebab-case, permanent once the region exists. */
export const WIDER_REGION_ID_PATTERN = /^[a-z]+(-[a-z]+)*$/;

/**
 * @param {unknown} id - Candidate region id
 * @returns {boolean} Whether it satisfies the API's id rule
 */
export function isValidWiderRegionId(id) {
    return typeof id === 'string' && WIDER_REGION_ID_PATTERN.test(id);
}

/**
 * A region's id; an API older than #1018 publishes only `name`.
 * @param {{id?: string, name?: string}} region - A `litcal_metadata.wider_regions` item
 * @returns {string} The id
 */
export function regionId(region) {
    return region.id ?? region.name;
}

/**
 * A region's label in the request's language; an API older than #1018 publishes only `name`.
 * @param {{label?: string, name?: string}} region - A `litcal_metadata.wider_regions` item
 * @returns {string} The label
 */
export function regionLabel(region) {
    return region.label ?? region.name;
}

/**
 * The `metadata.labels` key a locale's label is stored under: its language, plus its script when it has one.
 * @param {string} locale - e.g. `it_CH`, `zh_Hans_SG`, `zh-Hant-TW`
 * @returns {string} e.g. `it`, `zh_Hans`, `zh_Hant`
 */
export function labelKeyForLocale(locale) {
    const parsed = new Intl.Locale(String(locale).replaceAll('_', '-'));
    return parsed.script
        ? `${parsed.language}_${parsed.script}`
        : parsed.language;
}

/**
 * Words derived from an id, the API's last-resort label.
 * @param {string} id - e.g. `german-language-area`
 * @returns {string} e.g. `German Language Area`
 */
export function idToWords(id) {
    return id
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * A region's label for a UI locale, resolved as the API resolves it: language plus
 * script, language, `en`, then (for a continent) the UN M.49 name in the UI
 * language, then words derived from the id.
 * @param {Object<string, string>|null|undefined} labels - `metadata.labels`
 * @param {string} uiLocale - e.g. `it_IT`
 * @param {string} id - The region id
 * @param {string|null} [m49] - UN M.49 area code, e.g. `002`
 * @returns {string} The label
 */
export function resolveLabel(labels, uiLocale, id, m49 = null) {
    const map = labels ?? {};
    const key = labelKeyForLocale(uiLocale);
    const language = key.split('_')[0];
    for (const candidate of [key, language, 'en']) {
        if (typeof map[candidate] === 'string' && map[candidate] !== '')
            return map[candidate];
    }
    if (m49) {
        try {
            const name = new Intl.DisplayNames(
                [uiLocale.replaceAll('_', '-')],
                { type: 'region' },
            ).of(m49);
            if (name && name !== m49)
                return name.charAt(0).toUpperCase() + name.slice(1);
        } catch {
            // an unknown locale or code falls through to the id words
        }
    }
    return idToWords(id);
}
```

In `assets/js/NationalCalendarPayload.js`: import `WIDER_REGION_ID_PATTERN` instead of `WIDER_REGION_NAME_PATTERN`,
use it for `wider_regions`, and update the adjacent comment ("The API's rule for a wider region id"). Update
`NationalCalendarPayload.test.js` fixtures that use capitalised region names (`'Europe'` → `'europe'`, etc.) and
add one case asserting a capitalised name is rejected.

In `assets/js/extending.js`: replace the import of `isValidWiderRegionName` with `isValidWiderRegionId` and the two
call sites accordingly.

- [ ] **Step 4: Run tests**

Run: `yarn test:unit && node_modules/.bin/eslint . && node --check assets/js/extending.js`
Expected: PASS. (Tests that used the old picker/name fixtures are updated in their own tasks; if an unrelated suite
fails only because it imports the removed export, fix its import here.)

- [ ] **Step 5: Commit** — `feat: wider region ids and label resolution helpers (#1018)`

---

### Task 2: Prospective data with ids and labels

**Files:**

- Modify: `assets/data/ProspectiveWiderRegions.json`, `src/ProspectiveWiderRegions.php`
- Modify: `admin-permissions.php`, `permission-requests.php`, `extending.php` — only the `ProspectiveWiderRegions::all()`
  call sites, which now pass the UI locale: `ProspectiveWiderRegions::all($i18n->LOCALE)` (check the variable name
  each page uses for its locale)
- Test: `tests/ProspectiveWiderRegionsTest.php`

Also add a top-level `"m49_codes"` map to the data file for regions that already exist:
`{ "americas": "019", "asia": "142", "europe": "150" }`, exposed by a new
`ProspectiveWiderRegions::m49Codes(string $source = self::DEFAULT_SOURCE): array<string, string>` (id → code, merged
with every prospective entry's non-null `m49`; invalid ids/codes dropped). The extending page gets it as
`Messages.WiderRegionM49` (Task 6).

**Interfaces — Produces:** `ProspectiveWiderRegions::m49Codes(string $source = self::DEFAULT_SOURCE): array` and
`ProspectiveWiderRegions::all(string $uiLocale, string $source = self::DEFAULT_SOURCE): array`
returning `list<array{id: string, label: string, labels: array<string, string>, m49: ?string, description: string, roster: list<string>, locales: list<string>}>`
sorted by `label` (Collator for `$uiLocale`). Constants `DEFAULT_SOURCE`, `ID_PATTERN`, `LABEL_KEY_PATTERN`, `M49_PATTERN`.

- [ ] **Step 1: Rewrite the data file**

Replace each entry's `name` with `id` + `labels` + `m49` per the spec's table, keep `description`, `roster`,
`locales`, `sources`, `note`, and update the `$comment` to describe `id`, `labels`, `m49`. Add:

```json
{
    "id": "africa",
    "labels": {},
    "m49": "002",
    "description": "Africa (UN M.49 002)",
    "roster": ["DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CD", "CG", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RE", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW"],
    "locales": [],
    "sources": [],
    "note": "Prospective continent: no continent-wide patron or celebration appears in the Notitiae survey."
},
{
    "id": "oceania",
    "labels": {},
    "m49": "009",
    "description": "Oceania (UN M.49 009)",
    "roster": ["AU", "NZ", "PG", "SB", "FJ", "VU", "NC", "PF", "WS", "TO", "KI", "FM", "MH", "PW", "NR", "TV", "GU", "MP", "AS", "CK", "WF", "NU", "TK"],
    "locales": [],
    "sources": [],
    "note": "Prospective continent: no continent-wide patron or celebration appears in the Notitiae survey."
}
```

`southern-africa` gets `"m49": "018"` and `north-africa` gets `"m49": "015"` (curated labels still win). Then **prune** every roster code (in all entries) that is not a
`country_iso` in `assets/data/WorldDiocesesByNation.json` (the Step 2 test enforces it; list the removed codes in the
report).

- [ ] **Step 2: Rewrite the PHPUnit test**

Cover, with temp-file fixtures like the existing test:

- shipped file: 8 ids exactly (`africa`, `german-language-area`, `malaysia-singapore-brunei`, `nordic`, `north-africa`,
  `oceania`, `senegal-mauritania-cabo-verde-guinea-bissau`, `southern-africa`); each id matches `ID_PATTERN`; each
  roster non-empty; returned keys exactly `['id','label','labels','m49','description','roster','locales']`;
- every roster code of the shipped file is a `country_iso` in `WorldDiocesesByNation.json`;
- `all('en')` labels: `german-language-area` → `German Language Area`, `africa` → `Africa`;
  `all('it')`: `africa` → `Africa` (ICU Italian), `nordic` → `Nordic Countries` (no `it` label → `en`),
  `german-language-area` stays English; `all('de')`: `german-language-area` → `Deutsches Sprachgebiet`;
- `all('en')` is sorted by label;
- dropped: bad id (`Europe`, `german language`), duplicate id, empty roster, bad roster code, label key `DE` or
  `de_de`, empty label value, `m49` `"2"`; a non-object entry;
- `m49Codes()` returns `americas` 019, `asia` 142, `europe` 150, `africa` 002, `oceania` 009, `north-africa` 015, `southern-africa` 018;
  a fixture with a bad id or code in `m49_codes` drops that pair;
- a region with no labels and no m49 resolves to the id words (`north-africa` fixture with `labels: {}` → `North Africa`);
- unreadable file and missing `wider_regions` throw `\RuntimeException`.

- [ ] **Step 3: Run to verify failure** — `vendor/bin/phpunit tests/ProspectiveWiderRegionsTest.php` → FAIL.

- [ ] **Step 4: Implement**

Rewrite `src/ProspectiveWiderRegions.php` along the existing structure: `ID_PATTERN = '/^[a-z]+(-[a-z]+)*$/'`,
`LABEL_KEY_PATTERN = '/^[a-z]{2,3}(_[A-Z][a-z]{3})?$/'`, `M49_PATTERN = '/^\d{3}$/'`. An entry is dropped when any
label key or value is invalid (not partially kept). `label` resolution mirrors `resolveLabel` in Task 1:

```php
    /**
     * @param array<string, string> $labels
     */
    private static function resolveLabel(array $labels, string $uiLocale, string $id, ?string $m49): string
    {
        $parsed   = \Locale::parseLocale($uiLocale);
        $language = is_array($parsed) && isset($parsed['language']) ? $parsed['language'] : 'en';
        $script   = is_array($parsed) && isset($parsed['script']) ? $parsed['script'] : null;
        $keys     = $script !== null ? [$language . '_' . $script, $language, 'en'] : [$language, 'en'];
        foreach ($keys as $key) {
            if (isset($labels[$key])) {
                return $labels[$key];
            }
        }
        if ($m49 !== null) {
            $name = \Locale::getDisplayRegion('und_' . $m49, $uiLocale);
            if ($name !== false && $name !== '' && $name !== $m49) {
                return mb_strtoupper(mb_substr($name, 0, 1)) . mb_substr($name, 1);
            }
        }
        return implode(' ', array_map(static fn (string $w): string => ucfirst($w), explode('-', $id)));
    }
```

Sort with `$collator = new \Collator($uiLocale); usort($regions, fn ($a, $b) => (int) $collator->compare($a['label'], $b['label']));`.
Update the class docblock. Update the three `all()` call sites to pass the page's UI locale.

- [ ] **Step 5: Run** — `vendor/bin/phpunit && composer lint && composer analyse && composer parallel-lint` → PASS.

- [ ] **Step 6: Commit** — `feat: prospective wider regions by id, with labels and the five continents (#1018)`

---

### Task 3: Region membership helpers by id

**Files:**

- Modify: `assets/js/widerRegions.js`, `assets/js/widerRegionForNation.js`, `assets/js/widerRegionEditRights.js`
  (only if it reads `region.name`)
- Modify: `assets/js/extending.js` — `fillWiderRegionsControl` (option value = id, text = label) and every other place
  that reads `.name` of a `LitCalMetadata.wider_regions` item (search `wider_regions` and `.name` together, e.g.
  `currentWiderRegion`, `widerRegionMembership`, the delete filter)
- Test: `assets/js/__tests__/widerRegions.test.js`, `widerRegionForNation.test.js`, `widerRegionEditRights.test.js`

**Interfaces — Consumes:** `regionId`, `regionLabel` (Task 1). **Produces:** unchanged function names; every
"region name" parameter/return in these modules is now an id. Add `widerRegionLabelById(regions, id): string`
to `widerRegions.js` (label of the region with that id, else the id).

- [ ] **Step 1:** Update the three test files' fixtures to the #1018 shape (`{ id: 'europe', label: 'Europe', name: 'europe', … }`)
      and add, per module, one test with an older-API fixture (`{ name: 'Europe', … }`, no `id`) proving the fallback.
      Add tests for `widerRegionLabelById` (found → label; missing → id).
- [ ] **Step 2:** Run → FAIL where modules read `.name`.
- [ ] **Step 3:** Replace every `region.name` in these modules with `regionId(region)`; add `widerRegionLabelById`;
      update JSDoc (`names` → `ids`). In `extending.js`, `fillWiderRegionsControl` builds
      `new Option(widerRegionLabelById(LitCalMetadata.wider_regions, id), id, false, selected.includes(id))`.
- [ ] **Step 4:** `yarn test:unit && node_modules/.bin/eslint . && node --check assets/js/extending.js` → PASS.
- [ ] **Step 5: Commit** — `refactor: compare wider regions by id (#1018)`

---

### Task 4: Pickers show labels, keyed by id

**Files:**

- Modify: `assets/js/widerRegionObjectIdSelect.js`, `admin-permissions.php`, `permission-requests.php` (one new i18n
  key `widerRegionNations`: `_('%d nations')` — the only placeholder, so `%d` is fine; follow the file's existing
  `translators:` comment style)
- Test: `assets/js/__tests__/widerRegionObjectIdSelect.test.js`, `e2e/permission-pickers.spec.ts`

**Interfaces — Consumes:** `regionId`, `regionLabel` (Task 1); `ProspectiveRegion` (Task 2 shape). **Produces:**
`buildWiderRegionObjectIdSelect({ prospective, existing, locale, className, id, i18n })` where `i18n` gains
`nations` (a string with `%d`); `buildWiderRegionObjectIdSelectFromConfig` reads `config.i18n.widerRegionNations`.

- [ ] **Step 1:** Update the unit tests: fixtures in the new shapes; option `value` is the id; text is
      `Label (DK, SE, NO, FI, IS)` for ≤ 6 codes and `Label (54 nations)` for more; `title` is the description; existing
      regions sorted by label with the Collator; a prospective id that exists appears once (existing group); older-API
      fixture (`name` only) still works; ungrouped when metadata is unknown.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: `regionOption(value, label, codes, description, nationsTemplate)`; existing →
      `regionOption(regionId(r), regionLabel(r), existingCodes(r))`; prospective → `regionOption(p.id, p.label, p.roster, p.description)`;
      dedupe by id. Inject `widerRegionNations` in both PHP configs.
- [ ] **Step 4:** Update `e2e/permission-pickers.spec.ts`'s wider-region test: existing regions are checked by
      `wider_regions[].id ?? name`; the prospective value checked is `nordic`; assert its option text starts with the
      resolved English label `Nordic Countries`; `africa`/`oceania` are offered (prospective or existing), and no option
      value fails the id rule.
- [ ] **Step 5:** `yarn test:unit && node_modules/.bin/eslint . && composer lint && composer analyse` → PASS (E2E runs
      in Task 7).
- [ ] **Step 6: Commit** — `feat: wider region pickers keyed by id, shown by label (#1018)`

---

### Task 5: Label fields module

**Files:**

- Create: `assets/js/widerRegionLabels.js`
- Modify: `assets/js/extending.js` — delete its local `country2flag` and import it from the new module (no other change)
- Modify: `assets/css/extending.css`
- Test: `assets/js/__tests__/widerRegionLabels.test.js`

**Interfaces — Consumes:** `labelKeyForLocale` (Task 1). **Produces:**

- `country2flag(code: string): string`
- `labelFieldsFor(locales: string[]): Array<{ key: string, regions: string[] }>`
- `buildWiderRegionLabelFields({ fields, values, suggestions, placeholders, regionName, i18n }): HTMLDivElement` —
  `values`, `suggestions` and `placeholders` are `{ key: string }`; a field with no value but a suggestion is
  pre-filled with the suggestion and gets class `wr-label-suggested` plus `title = i18n.suggested` (the class is
  removed on the first `input` event); `regionName(code)` returns a country's display name; `i18n.more` is a `+%d`
  template
- `m49Suggestions(keys: string[], m49: string): Object<string, string>` — for each label key, the capitalised
  `Intl.DisplayNames([key with '_' → '-'], { type: 'region' }).of(m49)`, omitting keys where ICU returns the code or
  throws
- `collectLabels(container: ParentNode): Object<string, string>`
- `FLAG_LIMIT = 4`

- [ ] **Step 1: Write the failing tests** — `labelFieldsFor(['de_DE', 'it_IT', 'de_AT', 'zh_Hans_SG'])` →
      `[{key:'en',regions:[]},{key:'de',regions:['DE','AT']},{key:'it',regions:['IT']},{key:'zh_Hans',regions:['SG']}]`;
      `labelFieldsFor(['en_ZA','en_BW'])` → `[{key:'en',regions:['ZA','BW']}]`; `labelFieldsFor([])` → `[{key:'en',regions:[]}]`;
      a locale without region (`de`) adds the key with no region; duplicates removed. Builder: one `.wr-label-row` per
      field; the input has `data-label-key`, value from `values`, placeholder from `placeholders`; the flag cell holds
      exactly `min(n, 4)` flags when n ≤ 4, and 3 flags + a `.wr-label-more` reading `+3` for Europe's `de`
      (`['AT','BE','DE','LI','LU','CH']`); the cell's `title` lists all country names; `en` with no regions shows `🌐`;
      every row has the same three-cell structure; a suggested field is pre-filled, has `wr-label-suggested`, and loses it
      after an `input` event; a stored value wins over a suggestion. `m49Suggestions(['en','fr','it','de'], '150')` →
      `{ en: 'Europe', fr: 'Europe', it: 'Europa', de: 'Europa' }`; `m49Suggestions(['ga'], '150')` capitalises
      (`An Eoraip`). `collectLabels` returns trimmed non-empty values only (suggested values included — they seed the
      stored labels).
      `country2flag('it')` → `🇮🇹`, `country2flag('')` → `''`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** the module (JSDoc on exports). Row markup:

    ```html
    <div class="wr-label-row">
        <span
            class="wr-label-flags noto-color-emoji-regular"
            title="Germany, Austria, …"
            >🇩🇪🇦🇹🇨🇭<span class="wr-label-more">+3</span></span
        >
        <label class="wr-label-key font-monospace" for="widerRegionLabel_de"
            >DE</label
        >
        <input
            type="text"
            class="form-control form-control-sm"
            id="widerRegionLabel_de"
            data-label-key="de"
        />
    </div>
    ```

    Visible key text: the key upper-cased with `_` → ` ` for scripts (`ZH Hans`). CSS in `extending.css`:

    ```css
    #widerRegionLabels {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.25rem 1.5rem;
    }
    @media (min-width: 768px) {
        #widerRegionLabels {
            grid-template-columns: 1fr 1fr;
        }
    }
    .wr-label-row {
        display: grid;
        grid-template-columns: 7.5rem 4.5rem 1fr;
        align-items: center;
    }
    .wr-label-flags {
        white-space: nowrap;
        overflow: hidden;
    }
    .wr-label-more {
        font-size: 0.75rem;
        margin-left: 0.25rem;
        vertical-align: middle;
    }
    ```

    Move `country2flag` here verbatim from `extending.js` and import it there.

- [ ] **Step 4:** `yarn test:unit && node_modules/.bin/eslint . && node --check assets/js/extending.js` → PASS.
- [ ] **Step 5: Commit** — `feat: wider region label fields, one per language with member flags (#1018)`

---

### Task 6: Extending page — ids, the label editor, payload

**Files:**

- Modify: `extending.php` (`Messages.WiderRegionM49` = `ProspectiveWiderRegions::m49Codes()`, plus the
  translatable `'Suggested from UN M.49 / CLDR'` tooltip; datalist values/labels by id; a `col-12` `#widerRegionLabelsBlock` at the end of the
  wider-region `.regionalNationalSettingsForm` with a heading and hint; `Messages` gains the strings below)
- Modify: `includes/messages.php` (new strings: `'Region name'`, `'Wider region labels hint'` = "One name per language
  of the region. Languages without a name show the English one.", `'+%d'` if needed, and replace the text of
  `'Invalid wider region name'` with the id rule: "A wider region id is one or more lowercase words (a–z) joined by
  hyphens, e.g. german-language-area.")
- Modify: `assets/js/extending.js`, `assets/js/WiderRegionPayload.js`
- Test: `assets/js/__tests__/WiderRegionPayload.test.js` (create if absent), existing extending unit tests if any

**Interfaces — Consumes:** Tasks 1–5.

Requirements (implementer designs the wiring; keep functions small and named):

1. **Datalist** (`extending.php`): existing regions → one option per (region, locale), value `{id} - {locale}`,
   `label` attribute = region label; prospective regions not yet existing → value `{id}`, label
   `{label} ({roster}) — not yet created`. Use `$widerRegion['id'] ?? $widerRegion['name']` and
   `$widerRegion['label'] ?? $widerRegion['name']`.
2. **Mount** the label block (`#widerRegionLabelsBlock` → `buildWiderRegionLabelFields`) whenever the wider-region
   form's locales change (the `calendarLocalesChanged` path for `#widerRegionLocales`), preserving typed values by
   key: build `values` from the current inputs (`collectLabels`) merged over the last loaded/prefilled labels.
3. **Load** (`updateRegionalCalendarForm`, widerregion case): values from `data.metadata.labels ?? {}`;
   suggestions from `m49Suggestions(fieldKeys, Messages.WiderRegionM49[id])` when the region has an M.49 code
   (Europe, the Americas, Asia today), so languages the API has no label for are seeded on the next save.
4. **Create** (`prepareNewWiderRegion`): prospective → values from the entry's `labels`, suggestions from its `m49`
   (`m49Suggestions`); not prospective → empty values, `en` placeholder `idToWords(API.key)`.
   Suggestions are recomputed for the new field keys whenever the locales change.
5. **Save** (`buildWiderRegionPayload`): `metadata.wider_region = API.key` (the id, without the locale suffix),
   `metadata.labels = collectLabels(block)` when non-empty. `WiderRegionPayload` validates `metadata.labels`, when
   present, as an object whose keys match `^[a-z]{2,3}(_[A-Z][a-z]{3})?$` and whose values are non-empty strings.
6. **Edit rights** (`applyWiderRegionEditRights`): label inputs follow the rights — whole-region editors edit all;
   otherwise a label input is enabled only if some selected locale with that label key is editable
   (`editsWiderRegionLocale`); re-apply after every rebuild.
7. **Validation messages:** the up-front check in `regionalNationalCalendarNameChanged` and the `API` key trap use
   `isValidWiderRegionId`; the toast uses the updated message.
8. **Delete** path and any remaining `name` comparisons on `LitCalMetadata.wider_regions` use `regionId`.

- [ ] **Step 1:** Write `WiderRegionPayload` tests (labels accepted; bad key / empty value / non-object rejected;
      absent labels fine). Run → FAIL.
- [ ] **Step 2:** Implement requirements 1–8.
- [ ] **Step 3:** `yarn test:unit && node_modules/.bin/eslint . && node --check assets/js/extending.js && composer lint && composer analyse && composer parallel-lint` → PASS.
- [ ] **Step 4:** `docker compose up -d --no-deps --force-recreate litcal-frontend` (single-file bind mounts).
- [ ] **Step 5: Commit** — `feat: edit wider region labels on the extending page; regions by id (#1018)`

---

### Task 7: E2E against API PR #1022

**Precondition (controller):** the local stack's `litcal-api` runs API PR #1022 with its Doctrine migration and the
OpenFGA script applied; `/calendars` returns `id`/`label`.

**Files:**

- Modify: `e2e/constants.ts` (`WIDER_REGION_ID_PATTERN` replaces the name pattern), `e2e/wider-region-calendar.spec.ts`,
  `e2e/permission-pickers.spec.ts` (already edited in Task 4), any other spec using capitalised region names
  (search `Europe`, `Americas`, `Asia` in `e2e/`)

- [ ] **Step 1:** In `wider-region-calendar.spec.ts`: drop the single-word filter and its comments; the CREATE test
      takes the first not-yet-existing prospective region by id from the JSON (read `id`); `generatedRegionName` →
      `generatedRegionId` returning `testregion-` + 4 lowercase letters; the invalid-name test uses `German Language Area`
      (not an id) and expects the id-rule toast. For `german-language-area` assert: exactly one `[data-label-key="de"]`
      input, pre-filled `Deutsches Sprachgebiet`, whose row's flag cell has 4 flags; an `[data-label-key="en"]` input
      pre-filled `German Language Area`; the captured PUT payload has `metadata.wider_region === 'german-language-area'`
      and `metadata.labels.de === 'Deutsches Sprachgebiet'`; cleanup deletes the region. The UPDATE test loads an existing
      region by id and asserts the label block shows its stored labels.
- [ ] **Step 2:** Run `yarn playwright test e2e/wider-region-calendar.spec.ts e2e/permission-pickers.spec.ts e2e/national-calendar.spec.ts --project=chromium`
      and `yarn typecheck`. Report skips with reasons; re-run a failure once to separate flakes (`ERR_NETWORK_CHANGED`)
      from real failures. Confirm no test region remains in `/calendars` `wider_regions_keys`.
- [ ] **Step 3: Commit** — `test(e2e): wider regions by id, with labels (#1018)`

---

### Task 8: Docs and full verification

- [ ] **Step 1:** CLAUDE.md "Calendar Schema Differences": replace the wider-region paragraph with: ids
      (`^[a-z]+(-[a-z]+)*$`, API #1018) identify regions, labels (`metadata.labels`, per language) display them;
      prospective regions (incl. all five continents) are curated in `assets/data/ProspectiveWiderRegions.json`; the
      extending page edits labels one field per language. Update the spec `2026-09-29-prospective-wider-regions-design.md`
      header with a one-line "Amended by …ids-and-labels-frontend-design.md".
- [ ] **Step 2:** Run the full suite, then revert fixer changes to files this branch never touched:

    ```bash
    composer parallel-lint && composer lint:fix && composer analyse && composer test && composer lint:md:fix
    yarn typecheck && node_modules/.bin/eslint . && yarn test:unit && yarn format:md
    ```

- [ ] **Step 3: Commit** — `docs: wider region ids and labels (#1018)`
