# Prospective Wider Regions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five hard-coded continental wider regions with the regions that exist (from `/calendars`) plus a
curated list of prospective regions from the Notitiae survey, in both permission pickers and on the extending page.

**Architecture:** A hand-curated JSON file (`assets/data/ProspectiveWiderRegions.json`) is read and validated by a PHP
helper (`src/ProspectiveWiderRegions.php`) and injected into page config. Pure JS helpers
(`assets/js/prospectiveWiderRegions.js`) hold the name rule and roster conversion; a new picker module
(`assets/js/widerRegionObjectIdSelect.js`) mirrors `nationObjectIdSelect.js`. The extending page offers prospective
regions in its datalist and pre-fills a prospective region's locales and member nations on create.

**Tech Stack:** PHP 8.4 (PHPUnit, PHPStan, phpcs), vanilla ES modules (Vitest + jsdom), Playwright E2E, gettext.

**Spec:** `docs/superpowers/specs/2026-09-29-prospective-wider-regions-design.md`

## Global Constraints

- Wider region name rule, identical everywhere: `^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$` (API `WiderRegionName`).
- Picker option value is the **bare region name** (no rite qualification, no locale suffix).
- Region names are not localized. New UI strings go through gettext `_()`; numbered placeholders if any are needed.
- PHP: single quotes, short arrays, 4 spaces, PSR-12 (`composer lint`), PHPStan (`composer analyse`).
- JS: ES modules, JSDoc on exported functions, 4 spaces; `yarn lint` clean.
- Public API fetches use `credentials: 'omit'` (no new fetches are expected in this plan).
- Commits: never `--no-verify`; do not push. End each commit message with:

    ```text
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
    ```

- Use a quoted heredoc (`<<'EOF'`) for commit messages so backticks survive.

## Review Focus

1. **Metadata fails to load** (API down): the picker must still render prospective regions ungrouped, not an empty or
   broken control. Pinned in Task 3.
2. **A prospective region that has since been created** (e.g. `Nordic` exists on the stack): it must appear once, in the
   existing group only. Pinned in Task 3.
3. **An existing region on an API that publishes no `roster`**: label falls back to `national_calendars`, then to the
   bare name, never `Name ()`. Pinned in Task 3.
4. **A suggested locale the server's ICU does not offer** (`AvailableLocalesWithRegion` lacks it): it is ignored, not
   selected as a phantom option. Pinned in Task 2 (`offeredLocales`).
5. **Creating a prospective region whose members have no locale selected** (Brunei, Eswatini, Mauritania): they must
   still reach `national_calendars`. Pinned in Task 2 (`widerRegionNationalCalendars`) and Task 6 (E2E).

Restoring a stored access request on a region that is no longer offered (e.g. an old `Africa` request) leaves the
placeholder selected, so the required field is visibly empty; no code handles it specially.

---

### Task 1: Prospective-region data and PHP reader

**Files:**

- Create: `assets/data/ProspectiveWiderRegions.json`
- Create: `src/ProspectiveWiderRegions.php`
- Test: `tests/ProspectiveWiderRegionsTest.php`

**Interfaces:**

- Produces: `LiturgicalCalendar\Frontend\ProspectiveWiderRegions::all(string $source = self::DEFAULT_SOURCE): array`
  returning `list<array{name: string, description: string, roster: list<string>, locales: list<string>}>`, sorted by
  `name`. Constants `DEFAULT_SOURCE`, `NAME_PATTERN`.

- [ ] **Step 1: Write the data file**

`assets/data/ProspectiveWiderRegions.json`:

```json
{
    "$comment": "Prospective wider regions: groupings of three or more nations that share a calendar, from the Notitiae survey (LiturgicalCalendarAPI docs/decrees/notitiae-register.json; see Frontend #66, #591). `name` must match ^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$. `roster` = nations eligible to join; `locales` = suggested locales pre-selected on create; `sources` = register entry ids. Names may change freely until the region is created.",
    "wider_regions": [
        {
            "name": "German Language Area",
            "description": "Regionalkalender für das deutsche Sprachgebiet",
            "roster": ["DE", "AT", "CH", "LU"],
            "locales": ["de_DE", "de_AT", "de_CH", "de_LU"],
            "sources": ["N1972-2069-71", "N1972-2069"],
            "note": "The diocese of Bolzano-Bressanone (IT) follows this regional calendar, but a roster can only list whole nations."
        },
        {
            "name": "Malaysia Singapore Brunei",
            "description": "Catholic Bishops' Conference of Malaysia, Singapore and Brunei",
            "roster": ["MY", "SG", "BN"],
            "locales": ["en_MY", "ms_MY", "en_SG", "ms_BN"],
            "sources": ["N2005-45-05-L"],
            "note": null
        },
        {
            "name": "Nordic",
            "description": "Nordic Episcopal Conference",
            "roster": ["DK", "SE", "NO", "FI", "IS"],
            "locales": ["da_DK", "sv_SE", "nb_NO", "fi_FI", "is_IS"],
            "sources": ["N2011-526-11-L", "N2012-556-12-L", "N2016-491-16"],
            "note": null
        },
        {
            "name": "North Africa",
            "description": "Regional Episcopal Conference of North Africa",
            "roster": ["DZ", "TN", "MA", "LY"],
            "locales": ["fr_DZ", "fr_TN", "fr_MA"],
            "sources": ["N1973-1870-72"],
            "note": null
        },
        {
            "name": "Senegal Mauritania Cabo Verde Guinea Bissau",
            "description": "Episcopal Conference of Senegal, Mauritania, Cabo Verde and Guinea-Bissau",
            "roster": ["SN", "MR", "CV", "GW"],
            "locales": ["fr_SN", "fr_MR", "pt_CV", "pt_GW"],
            "sources": ["N2013-18-13-L"],
            "note": null
        },
        {
            "name": "Southern Africa",
            "description": "Southern African Catholic Bishops' Conference",
            "roster": ["ZA", "BW", "SZ"],
            "locales": ["en_ZA", "af_ZA", "zu_ZA", "en_BW", "en_SZ"],
            "sources": [
                "N1976-CD-324-76",
                "N1982-CD-1012-81",
                "N2015-291-15",
                "N2015-681-15"
            ],
            "note": null
        }
    ]
}
```

- [ ] **Step 2: Write the failing test**

`tests/ProspectiveWiderRegionsTest.php`:

```php
<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\ProspectiveWiderRegions;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(ProspectiveWiderRegions::class)]
final class ProspectiveWiderRegionsTest extends TestCase
{
    /** @var list<string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $file) {
            @unlink($file);
        }
        $this->tempFiles = [];
    }

    private function fixture(string $json): string
    {
        $file = tempnam(sys_get_temp_dir(), 'pwr');
        $this->assertIsString($file);
        file_put_contents($file, $json);
        $this->tempFiles[] = $file;
        return $file;
    }

    public function testShippedFileLoadsEveryEntry(): void
    {
        $regions = ProspectiveWiderRegions::all();
        $names   = array_column($regions, 'name');
        $this->assertSame([
            'German Language Area',
            'Malaysia Singapore Brunei',
            'Nordic',
            'North Africa',
            'Senegal Mauritania Cabo Verde Guinea Bissau',
            'Southern Africa',
        ], $names);
        foreach ($regions as $region) {
            $this->assertMatchesRegularExpression(ProspectiveWiderRegions::NAME_PATTERN, $region['name']);
            $this->assertNotEmpty($region['roster']);
            $this->assertNotSame('', $region['description']);
        }
    }

    public function testOnlyBrowserFieldsAreReturned(): void
    {
        $regions = ProspectiveWiderRegions::all();
        $this->assertSame(['name', 'description', 'roster', 'locales'], array_keys($regions[0]));
    }

    public function testDropsInvalidEntriesAndSortsByName(): void
    {
        $file = $this->fixture(json_encode(['wider_regions' => [
            ['name' => 'Zeta', 'roster' => ['AA', 'BB']],
            ['name' => 'lowercase', 'roster' => ['AA']],
            ['name' => 'Hyphen-Name', 'roster' => ['AA']],
            ['name' => 'Empty Roster', 'roster' => []],
            ['name' => 'Bad Code', 'roster' => ['AA', 'usa']],
            ['name' => 'Alpha', 'roster' => ['CC'], 'description' => 'First', 'locales' => ['en_CC', 42]],
            ['name' => 'Alpha', 'roster' => ['DD']],
            'not an object',
        ]], JSON_THROW_ON_ERROR));

        $this->assertSame([
            ['name' => 'Alpha', 'description' => 'First', 'roster' => ['CC'], 'locales' => ['en_CC']],
            ['name' => 'Zeta', 'description' => '', 'roster' => ['AA', 'BB'], 'locales' => []],
        ], ProspectiveWiderRegions::all($file));
    }

    public function testUnreadableFileThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::all(sys_get_temp_dir() . '/does-not-exist-' . uniqid() . '.json');
    }

    public function testMissingWiderRegionsArrayThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::all($this->fixture('{"regions": []}'));
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `vendor/bin/phpunit tests/ProspectiveWiderRegionsTest.php`
Expected: FAIL / error, class `ProspectiveWiderRegions` not found.

- [ ] **Step 4: Write the implementation**

`src/ProspectiveWiderRegions.php`:

```php
<?php

namespace LiturgicalCalendar\Frontend;

/**
 * The wider regions that do not exist yet but can be created.
 *
 * Since API #1007 a wider region is any region with a source file, named by a
 * shape rule rather than a fixed list, so there is no list of prospective
 * regions to ask the API for. This curated file supplies one: the groupings of
 * three or more nations that the Notitiae survey shows sharing a calendar
 * (Frontend #66, #591). The permission pickers offer them so an admin can be
 * granted `admin` on a region before creating it, and the extending page
 * pre-fills a new region's locales and member nations from them.
 *
 * `sources` and `note` document the file and are not passed to the browser.
 */
final class ProspectiveWiderRegions
{
    public const DEFAULT_SOURCE = __DIR__ . '/../assets/data/ProspectiveWiderRegions.json';

    /** The API's WiderRegionName shape rule. */
    public const NAME_PATTERN = '/^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/';

    /**
     * The valid entries, sorted by name. An entry with a name that fails the
     * shape rule, an empty roster, or a roster code that is not an uppercase
     * ISO 3166-1 alpha-2 code is dropped, as is a repeated name.
     *
     * @param string $source Path to the ProspectiveWiderRegions JSON data
     * @return list<array{name: string, description: string, roster: list<string>, locales: list<string>}>
     * @throws \RuntimeException When the source cannot be read or has the wrong shape
     */
    public static function all(string $source = self::DEFAULT_SOURCE): array
    {
        $raw = @file_get_contents($source);
        if ($raw === false) {
            throw new \RuntimeException('Could not read ' . $source);
        }

        $json = json_decode($raw, true);
        if (!is_array($json) || !isset($json['wider_regions']) || !is_array($json['wider_regions'])) {
            throw new \RuntimeException('wider_regions not found in ' . $source);
        }

        $regions = [];
        foreach ($json['wider_regions'] as $entry) {
            if (!is_array($entry) || !isset($entry['name']) || !is_string($entry['name'])) {
                continue;
            }
            $name = $entry['name'];
            if (preg_match(self::NAME_PATTERN, $name) !== 1 || isset($regions[$name])) {
                continue;
            }
            $roster = self::roster($entry['roster'] ?? null);
            if ($roster === null) {
                continue;
            }
            $locales    = [];
            $rawLocales = isset($entry['locales']) && is_array($entry['locales']) ? $entry['locales'] : [];
            foreach ($rawLocales as $locale) {
                if (is_string($locale) && $locale !== '') {
                    $locales[] = $locale;
                }
            }
            $regions[$name] = [
                'name'        => $name,
                'description' => isset($entry['description']) && is_string($entry['description']) ? $entry['description'] : '',
                'roster'      => $roster,
                'locales'     => $locales,
            ];
        }

        ksort($regions, SORT_STRING);
        return array_values($regions);
    }

    /**
     * @param mixed $roster The entry's `roster`
     * @return list<string>|null The codes, or null when the roster is empty or malformed
     */
    private static function roster(mixed $roster): ?array
    {
        if (!is_array($roster) || $roster === []) {
            return null;
        }
        $codes = [];
        foreach ($roster as $code) {
            if (!is_string($code) || preg_match('/^[A-Z]{2}$/', $code) !== 1) {
                return null;
            }
            $codes[] = $code;
        }
        return $codes;
    }
}
```

- [ ] **Step 5: Run tests and static checks**

Run: `vendor/bin/phpunit tests/ProspectiveWiderRegionsTest.php && composer lint && composer analyse`
Expected: all 5 tests PASS; no lint or PHPStan errors.

- [ ] **Step 6: Commit**

```bash
git add assets/data/ProspectiveWiderRegions.json src/ProspectiveWiderRegions.php tests/ProspectiveWiderRegionsTest.php
git commit -F - <<'EOF'
feat: curated list of prospective wider regions (#591, #66)

The Notitiae survey's multinational groupings of three or more nations,
with their rosters, suggested locales and register entry ids.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```

---

### Task 2: Shared JS helpers for wider region names and rosters

**Files:**

- Create: `assets/js/prospectiveWiderRegions.js`
- Modify: `assets/js/NationalCalendarPayload.js:703-705` (use the shared pattern)
- Test: `assets/js/__tests__/prospectiveWiderRegions.test.js`

**Interfaces:**

- Consumes: the entry shape of Task 1 (`{ name, description, roster, locales }`).
- Produces (all named exports of `assets/js/prospectiveWiderRegions.js`):
    - `WIDER_REGION_NAME_PATTERN: RegExp`
    - `isValidWiderRegionName(name: unknown): boolean`
    - `findProspectiveRegion(prospective: ProspectiveRegion[]|null|undefined, name: string): ProspectiveRegion|undefined`
    - `rosterToNationalCalendars(roster: string[]): Object<string, string>` (English name → code)
    - `widerRegionNationalCalendars(roster: string[], localeMap: Object<string, string>): Object<string, string>`
      (union; locale-derived entries win on key collision, roster adds the rest)
    - `offeredLocales(locales: string[], available: string[]): string[]`

- [ ] **Step 1: Write the failing test**

`assets/js/__tests__/prospectiveWiderRegions.test.js`:

```js
/**
 * Tests for the wider region name rule and the prospective-region helpers
 * shared by the permission pickers and the extending page (#591, #66).
 */
import { describe, it, expect } from 'vitest';
import {
    WIDER_REGION_NAME_PATTERN,
    findProspectiveRegion,
    isValidWiderRegionName,
    offeredLocales,
    rosterToNationalCalendars,
    widerRegionNationalCalendars,
} from '../prospectiveWiderRegions.js';

const prospective = [
    {
        name: 'Nordic',
        description: 'Nordic Episcopal Conference',
        roster: ['DK', 'SE'],
        locales: ['da_DK'],
    },
    {
        name: 'Southern Africa',
        description: '',
        roster: ['ZA', 'BW', 'SZ'],
        locales: [],
    },
];

describe('isValidWiderRegionName', () => {
    it.each([
        'Europe',
        'Southern Africa',
        'Senegal Mauritania Cabo Verde Guinea Bissau',
    ])('accepts %s', (name) => {
        expect(isValidWiderRegionName(name)).toBe(true);
    });
    it.each([
        '',
        'europe',
        'Guinea-Bissau',
        'São Tomé',
        'Two  Spaces',
        'Trailing ',
        42,
        null,
    ])('rejects %s', (name) => {
        expect(isValidWiderRegionName(name)).toBe(false);
    });
    it('exposes the same pattern', () => {
        expect(WIDER_REGION_NAME_PATTERN.source).toBe(
            '^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$',
        );
    });
});

describe('findProspectiveRegion', () => {
    it('finds by exact name', () => {
        expect(findProspectiveRegion(prospective, 'Nordic')?.roster).toEqual([
            'DK',
            'SE',
        ]);
    });
    it('is undefined for an unknown name, a different case, or no list', () => {
        expect(findProspectiveRegion(prospective, 'Europe')).toBeUndefined();
        expect(findProspectiveRegion(prospective, 'nordic')).toBeUndefined();
        expect(findProspectiveRegion(null, 'Nordic')).toBeUndefined();
    });
});

describe('rosterToNationalCalendars', () => {
    it('maps English names to codes, as the API expects', () => {
        expect(rosterToNationalCalendars(['ZA', 'BW', 'SZ'])).toEqual({
            'South Africa': 'ZA',
            Botswana: 'BW',
            Eswatini: 'SZ',
        });
    });
});

describe('widerRegionNationalCalendars', () => {
    it('keeps roster nations that no selected locale covers', () => {
        // Only en_ZA selected: Botswana and Eswatini must not be dropped.
        expect(
            widerRegionNationalCalendars(['ZA', 'BW', 'SZ'], {
                'South Africa': 'ZA',
            }),
        ).toEqual({
            'South Africa': 'ZA',
            Botswana: 'BW',
            Eswatini: 'SZ',
        });
    });
    it('keeps a locale-derived nation outside the roster', () => {
        expect(widerRegionNationalCalendars(['DK'], { Norway: 'NO' })).toEqual({
            Norway: 'NO',
            Denmark: 'DK',
        });
    });
    it('does not list a nation twice', () => {
        const map = widerRegionNationalCalendars(['DK'], { Denmark: 'DK' });
        expect(Object.values(map)).toEqual(['DK']);
    });
});

describe('offeredLocales', () => {
    it('keeps only the locales the page offers, in the given order', () => {
        expect(
            offeredLocales(
                ['zh_SG', 'en_SG', 'ms_BN'],
                ['ms_BN', 'en_SG', 'it_IT'],
            ),
        ).toEqual(['en_SG', 'ms_BN']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit assets/js/__tests__/prospectiveWiderRegions.test.js`
Expected: FAIL, cannot resolve `../prospectiveWiderRegions.js`.

- [ ] **Step 3: Write the implementation**

`assets/js/prospectiveWiderRegions.js`:

```js
/**
 * Wider region names and the prospective wider regions (#591, #66).
 *
 * Since API #1007 a wider region is any region with a source file, named by a
 * shape rule, and whether it exists is checked at runtime. The prospective
 * regions — groupings from the Notitiae survey that do not exist yet — come
 * from assets/data/ProspectiveWiderRegions.json via src/ProspectiveWiderRegions.php.
 *
 * Used by widerRegionObjectIdSelect.js, extending.js and NationalCalendarPayload.js.
 */

/**
 * @typedef {object} ProspectiveRegion
 * @property {string} name - Region name, matching WIDER_REGION_NAME_PATTERN
 * @property {string} description - The grouping's full name, or ''
 * @property {string[]} roster - ISO 3166-1 alpha-2 codes of the nations eligible to join
 * @property {string[]} locales - Suggested locales, pre-selected when the region is created
 */

/** The API's WiderRegionName shape rule. */
export const WIDER_REGION_NAME_PATTERN = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;

/**
 * @param {unknown} name - Candidate region name
 * @returns {boolean} Whether it satisfies the API's shape rule
 */
export function isValidWiderRegionName(name) {
    return typeof name === 'string' && WIDER_REGION_NAME_PATTERN.test(name);
}

/**
 * @param {ProspectiveRegion[]|null|undefined} prospective - The prospective regions
 * @param {string} name - Region name, matched exactly
 * @returns {ProspectiveRegion|undefined} The entry, if the name is a prospective region
 */
export function findProspectiveRegion(prospective, name) {
    return (prospective ?? []).find((region) => region.name === name);
}

/**
 * The `national_calendars` map a wider region file holds: English nation name => code.
 * Named as the extending page's payload builder names them (Intl.DisplayNames, English).
 * @param {string[]} roster - ISO 3166-1 alpha-2 codes
 * @returns {Object<string, string>} English name => code
 */
export function rosterToNationalCalendars(roster) {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return Object.fromEntries(
        roster.map((code) => {
            let name = code;
            try {
                name = names.of(code) ?? code;
            } catch {
                // an invalid code keeps itself as its name
            }
            return [name, code];
        }),
    );
}

/**
 * A new region's member nations: those implied by its selected locales, plus
 * every roster nation no locale covers (Brunei, Eswatini, Mauritania have none
 * in the Locales list, and would otherwise be dropped).
 * @param {string[]} roster - ISO 3166-1 alpha-2 codes
 * @param {Object<string, string>} localeMap - English name => code, from the selected locales
 * @returns {Object<string, string>} English name => code, each nation once
 */
export function widerRegionNationalCalendars(roster, localeMap) {
    const result = { ...localeMap };
    const codes = new Set(Object.values(localeMap));
    for (const [name, code] of Object.entries(
        rosterToNationalCalendars(roster),
    )) {
        if (!codes.has(code)) {
            result[name] = code;
            codes.add(code);
        }
    }
    return result;
}

/**
 * @param {string[]} locales - Suggested locales
 * @param {string[]} available - Locales the page offers
 * @returns {string[]} The suggested locales the page offers, in the suggested order
 */
export function offeredLocales(locales, available) {
    const offered = new Set(available);
    return locales.filter((locale) => offered.has(locale));
}
```

In `assets/js/NationalCalendarPayload.js`, add at the top with the other imports:

```js
import { WIDER_REGION_NAME_PATTERN } from './prospectiveWiderRegions.js';
```

and replace (around line 703-705):

```js
// The API's shape for a wider region name; whether the region exists, and
// lists this nation, is the API's own check (422 on save).
const widerRegionName = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;
```

with:

```js
// The API's shape for a wider region name; whether the region exists, and
// lists this nation, is the API's own check (422 on save).
const widerRegionName = WIDER_REGION_NAME_PATTERN;
```

(If `NationalCalendarPayload.js` has no imports yet, put the import on line 1 after any leading doc comment.)

- [ ] **Step 4: Run tests**

Run: `yarn test:unit assets/js/__tests__/prospectiveWiderRegions.test.js assets/js/__tests__/NationalCalendarPayload.test.js && yarn lint`
Expected: PASS; no lint errors.

- [ ] **Step 5: Commit**

```bash
git add assets/js/prospectiveWiderRegions.js assets/js/__tests__/prospectiveWiderRegions.test.js assets/js/NationalCalendarPayload.js
git commit -F - <<'EOF'
feat: shared helpers for wider region names and rosters (#591)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```

---

### Task 3: The wider region picker module

**Files:**

- Create: `assets/js/widerRegionObjectIdSelect.js`
- Test: `assets/js/__tests__/widerRegionObjectIdSelect.test.js`

**Interfaces:**

- Consumes: `ProspectiveRegion` from Task 2. Metadata region items from `/calendars` `litcal_metadata.wider_regions`:
  `{ name: string, locales: string[], api_path: string, national_calendars?: string[], roster?: string[] }`.
- Produces:
    - `WIDER_REGION_TYPE = 'wider_region'`
    - `buildWiderRegionObjectIdSelect({ prospective, existing, locale, className, id, i18n }): HTMLSelectElement`
      where `existing` is the metadata region array or `null`, and `i18n = { placeholder, existingGroup, newGroup }`.
    - `buildWiderRegionObjectIdSelectFromConfig(config, client, { locale, className, id }): HTMLSelectElement`, reading
      `config.prospectiveWiderRegions`, `client?._metadata?.wider_regions ?? null`, and `config.i18n.selectCalendarId`,
      `config.i18n.existingWiderRegions`, `config.i18n.newWiderRegions`.

- [ ] **Step 1: Write the failing test**

`assets/js/__tests__/widerRegionObjectIdSelect.test.js`:

```js
/**
 * Tests for the `wider_region` scope's picker (#591).
 *
 * The regression it guards: the picker offered a fixed list of five continents,
 * so a region created under any other name could not be granted, and Africa and
 * Oceania were offered although no such region existed.
 */
import { describe, it, expect } from 'vitest';
import {
    buildWiderRegionObjectIdSelect,
    buildWiderRegionObjectIdSelectFromConfig,
    WIDER_REGION_TYPE,
} from '../widerRegionObjectIdSelect.js';

const i18n = {
    placeholder: 'Select calendar ID...',
    existingGroup: 'Existing wider regions',
    newGroup: 'New wider regions (not yet created)',
};

const prospective = [
    {
        name: 'Nordic',
        description: 'Nordic Episcopal Conference',
        roster: ['DK', 'SE', 'NO', 'FI', 'IS'],
        locales: [],
    },
    {
        name: 'Southern Africa',
        description: '',
        roster: ['ZA', 'BW', 'SZ'],
        locales: [],
    },
];

const existing = [
    {
        name: 'Europe',
        locales: ['it_IT'],
        api_path: '/data/widerregion/Europe',
        national_calendars: ['IT', 'NL'],
        roster: ['IT', 'NL', 'DE'],
    },
    {
        name: 'Americas',
        locales: ['en_US'],
        api_path: '/data/widerregion/Americas',
        national_calendars: ['US'],
        roster: ['US', 'CA'],
    },
];

function build(existingRegions, extra = {}) {
    return buildWiderRegionObjectIdSelect({
        prospective,
        existing: existingRegions,
        locale: 'en',
        className: 'form-select perm-object-id',
        i18n,
        ...extra,
    });
}

const values = (select) =>
    Array.from(
        select.querySelectorAll('option:not([value=""])'),
        (o) => o.value,
    );
const groupOf = (select, value) =>
    select.querySelector(`option[value="${value}"]`).parentElement;

describe('buildWiderRegionObjectIdSelect', () => {
    it('is the wider_region scope', () => {
        expect(WIDER_REGION_TYPE).toBe('wider_region');
    });

    it('starts with a disabled, selected placeholder and is required', () => {
        const select = build(existing, { id: 'grantObjectId' });
        expect(select.required).toBe(true);
        expect(select.id).toBe('grantObjectId');
        expect(select.className).toBe('form-select perm-object-id');
        const first = select.options[0];
        expect(first.value).toBe('');
        expect(first.disabled).toBe(true);
        expect(first.selected).toBe(true);
        expect(first.textContent).toBe(i18n.placeholder);
    });

    it('groups existing regions (sorted) apart from prospective ones', () => {
        const select = build(existing);
        const groups = select.querySelectorAll('optgroup');
        expect(groups).toHaveLength(2);
        expect(groups[0].label).toBe(i18n.existingGroup);
        expect(Array.from(groups[0].children, (o) => o.value)).toEqual([
            'Americas',
            'Europe',
        ]);
        expect(groups[1].label).toBe(i18n.newGroup);
        expect(Array.from(groups[1].children, (o) => o.value)).toEqual([
            'Nordic',
            'Southern Africa',
        ]);
    });

    it('never offers the old continents that do not exist', () => {
        const all = values(build(existing));
        expect(all).not.toContain('Africa');
        expect(all).not.toContain('Oceania');
        expect(all).not.toContain('Asia');
    });

    it('lists a prospective region that now exists only once, as existing', () => {
        const withNordic = [
            ...existing,
            {
                name: 'Nordic',
                locales: ['da_DK'],
                api_path: '',
                national_calendars: [],
                roster: ['DK', 'SE'],
            },
        ];
        const select = build(withNordic);
        expect(values(select).filter((v) => v === 'Nordic')).toHaveLength(1);
        expect(groupOf(select, 'Nordic').label).toBe(i18n.existingGroup);
    });

    it('labels an option with its roster and a prospective one with its description as title', () => {
        const select = build(existing);
        expect(select.querySelector('option[value="Europe"]').textContent).toBe(
            'Europe (IT, NL, DE)',
        );
        const nordic = select.querySelector('option[value="Nordic"]');
        expect(nordic.textContent).toBe('Nordic (DK, SE, NO, FI, IS)');
        expect(nordic.title).toBe('Nordic Episcopal Conference');
        expect(
            select
                .querySelector('option[value="Southern Africa"]')
                .hasAttribute('title'),
        ).toBe(false);
    });

    it('falls back to national_calendars, then to the bare name, when no roster is published', () => {
        const older = [
            {
                name: 'Europe',
                locales: [],
                api_path: '',
                national_calendars: ['IT'],
            },
            { name: 'Asia', locales: [], api_path: '' },
        ];
        const select = build(older);
        expect(select.querySelector('option[value="Europe"]').textContent).toBe(
            'Europe (IT)',
        );
        expect(select.querySelector('option[value="Asia"]').textContent).toBe(
            'Asia',
        );
    });

    it('lists the prospective regions ungrouped when metadata is unknown', () => {
        const select = build(null);
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect(values(select)).toEqual(['Nordic', 'Southern Africa']);
    });

    it('omits an empty group', () => {
        const allExist = prospective.map((p) => ({
            name: p.name,
            locales: [],
            api_path: '',
            roster: p.roster,
        }));
        const select = build(allExist);
        const groups = select.querySelectorAll('optgroup');
        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe(i18n.existingGroup);
    });
});

describe('buildWiderRegionObjectIdSelectFromConfig', () => {
    const config = {
        prospectiveWiderRegions: prospective,
        i18n: {
            selectCalendarId: 'Pick one',
            existingWiderRegions: 'Existing',
            newWiderRegions: 'New',
        },
    };

    it('reads the prospective list and labels from config, existing regions from the client', () => {
        const select = buildWiderRegionObjectIdSelectFromConfig(
            config,
            { _metadata: { wider_regions: existing } },
            {
                locale: 'en',
                className: 'form-select',
                id: 'grantObjectId',
            },
        );
        expect(select.options[0].textContent).toBe('Pick one');
        expect(
            Array.from(select.querySelectorAll('optgroup'), (g) => g.label),
        ).toEqual(['Existing', 'New']);
    });

    it('is ungrouped when the client failed to initialize', () => {
        const select = buildWiderRegionObjectIdSelectFromConfig(config, false, {
            locale: 'en',
            className: 'form-select',
        });
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect(values(select)).toEqual(['Nordic', 'Southern Africa']);
    });

    it('uses English defaults when config lacks labels and prospective regions', () => {
        const select = buildWiderRegionObjectIdSelectFromConfig(
            {},
            { _metadata: { wider_regions: existing } },
            {
                locale: 'en',
                className: 'form-select',
            },
        );
        expect(select.options[0].textContent).toBe('Select calendar ID...');
        expect(
            Array.from(select.querySelectorAll('optgroup'), (g) => g.label),
        ).toEqual(['Existing wider regions']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit assets/js/__tests__/widerRegionObjectIdSelect.test.js`
Expected: FAIL, cannot resolve `../widerRegionObjectIdSelect.js`.

- [ ] **Step 3: Write the implementation**

`assets/js/widerRegionObjectIdSelect.js`:

```js
/**
 * Wider region picker for the `wider_region` permission scope (#591).
 *
 * It used to offer a fixed list of five continents. Since API #1007 a wider
 * region is any region with a source file, so this picker offers the regions
 * that exist (from /calendars) and the prospective ones that do not yet
 * (assets/data/ProspectiveWiderRegions.json), split into two groups, so that an
 * admin can be granted `admin` on a region before creating it — the same
 * reasoning as the nation picker (nationObjectIdSelect.js, API #669).
 *
 * Option values are bare region names; region names are proper nouns and are
 * not localized.
 *
 * Used by permission-requests.js and admin-permissions.js.
 */

/** The permission scope this picker serves. */
export const WIDER_REGION_TYPE = 'wider_region';

/**
 * @typedef {import('./prospectiveWiderRegions.js').ProspectiveRegion} ProspectiveRegion
 */

/**
 * @typedef {object} WiderRegionSelectOptions
 * @property {ProspectiveRegion[]} prospective - The prospective regions, sorted by name
 * @property {object[]|null} existing - `litcal_metadata.wider_regions`, or null when metadata failed to load
 *   (the prospective regions are then listed without groups)
 * @property {string} locale - UI locale, for sorting the existing regions
 * @property {string} className - Class attribute for the <select>
 * @property {string} [id] - Id attribute for the <select>
 * @property {object} i18n - Labels
 * @property {string} i18n.placeholder - Text of the disabled empty option
 * @property {string} i18n.existingGroup - Label of the existing-regions <optgroup>
 * @property {string} i18n.newGroup - Label of the not-yet-created <optgroup>
 */

/**
 * @param {string} name - Region name
 * @param {string[]} codes - Member nation codes, possibly empty
 * @param {string} [description] - The grouping's full name, shown as a tooltip
 * @returns {HTMLOptionElement} The option
 */
function regionOption(name, codes, description = '') {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = codes.length > 0 ? `${name} (${codes.join(', ')})` : name;
    if (description !== '') o.title = description;
    return o;
}

/**
 * The nations an existing region lists: its roster, else (an API that publishes
 * no roster) the nations whose calendar declares it, else none.
 * @param {object} region - A `litcal_metadata.wider_regions` item
 * @returns {string[]} ISO codes
 */
function existingCodes(region) {
    if (Array.isArray(region.roster)) return region.roster;
    if (Array.isArray(region.national_calendars))
        return region.national_calendars;
    return [];
}

/**
 * @param {string} label - Group label
 * @param {HTMLOptionElement[]} options - Its options
 * @returns {HTMLOptGroupElement} The group
 */
function optgroup(label, options) {
    const group = document.createElement('optgroup');
    group.label = label;
    group.append(...options);
    return group;
}

/**
 * Build the region <select> for the `wider_region` scope.
 * @param {WiderRegionSelectOptions} opts - Options
 * @returns {HTMLSelectElement} The built select
 */
export function buildWiderRegionObjectIdSelect({
    prospective,
    existing,
    locale,
    className,
    id,
    i18n,
}) {
    const select = document.createElement('select');
    select.className = className;
    if (id) select.id = id;
    select.required = true;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = i18n.placeholder;
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    const prospectiveOption = (region) =>
        regionOption(region.name, region.roster, region.description);

    if (!Array.isArray(existing)) {
        select.append(...prospective.map(prospectiveOption));
        return select;
    }

    const collator = new Intl.Collator(locale);
    const existingOptions = [...existing]
        .sort((a, b) => collator.compare(a.name, b.name))
        .map((region) => regionOption(region.name, existingCodes(region)));
    if (existingOptions.length > 0) {
        select.appendChild(optgroup(i18n.existingGroup, existingOptions));
    }

    const existingNames = new Set(existing.map((region) => region.name));
    const newOptions = prospective
        .filter((region) => !existingNames.has(region.name))
        .map(prospectiveOption);
    if (newOptions.length > 0) {
        select.appendChild(optgroup(i18n.newGroup, newOptions));
    }

    return select;
}

/**
 * Build the region <select> from a page config and the resolved ApiClient.
 *
 * The prospective regions and labels come from the page config
 * (`config.prospectiveWiderRegions`, `config.i18n`), the existing regions from
 * the client's metadata — `null` when the client failed to initialize, which
 * leaves the list ungrouped rather than empty.
 * @param {object} config - The page config (AccessRequestsConfig / AdminPermissionsConfig)
 * @param {object|false} client - The resolved ApiClient, or false if init failed
 * @param {{locale: string, className: string, id?: string}} opts - Locale and attributes
 * @returns {HTMLSelectElement} The built select
 */
export function buildWiderRegionObjectIdSelectFromConfig(
    config,
    client,
    { locale, className, id },
) {
    const i18n = config.i18n || {};
    return buildWiderRegionObjectIdSelect({
        prospective: config.prospectiveWiderRegions || [],
        existing: client?._metadata?.wider_regions ?? null,
        locale,
        className,
        id,
        i18n: {
            placeholder: i18n.selectCalendarId || 'Select calendar ID...',
            existingGroup:
                i18n.existingWiderRegions || 'Existing wider regions',
            newGroup:
                i18n.newWiderRegions || 'New wider regions (not yet created)',
        },
    });
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test:unit assets/js/__tests__/widerRegionObjectIdSelect.test.js && yarn lint`
Expected: PASS; no lint errors.

- [ ] **Step 5: Commit**

```bash
git add assets/js/widerRegionObjectIdSelect.js assets/js/__tests__/widerRegionObjectIdSelect.test.js
git commit -F - <<'EOF'
feat: wider region picker with existing and prospective groups (#591)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```

---

### Task 4: Wire the picker into both permission pages

**Files:**

- Modify: `assets/js/admin-permissions.js` (imports ~line 20; delete `WIDER_REGIONS` at 96-98; `buildStaticGrantObjectId`
  branch at 142-143; add `mountWiderRegionObjectIdSelect`; dispatch in `syncObjectIdField` ~257-266)
- Modify: `assets/js/permission-requests.js` (imports ~line 21; delete `WIDER_REGIONS` at 151-153;
  `buildStaticObjectIdSelect` branch at 285-286; add `mountWiderRegionObjectIdSelect`; dispatch in
  `syncRowObjectIdField` ~402-416)
- Modify: `admin-permissions.php` (config ~382 and i18n ~435-437), `permission-requests.php` (config ~206 and i18n
  ~240-242)
- Test: `e2e/permission-pickers.spec.ts` (new `describe` block)

**Interfaces:**

- Consumes: `buildWiderRegionObjectIdSelectFromConfig`, `WIDER_REGION_TYPE` (Task 3);
  `ProspectiveWiderRegions::all()` (Task 1).
- Produces: `config.prospectiveWiderRegions`, `config.i18n.existingWiderRegions`, `config.i18n.newWiderRegions` on
  both pages.

- [ ] **Step 1: Write the failing E2E test**

Append to `e2e/permission-pickers.spec.ts`:

```ts
test.describe('Access request form — wider region picker', () => {
    test('offers existing wider regions and prospective ones, told apart (#591)', async ({
        page,
    }) => {
        const metadata = (
            await (await page.request.get(`${API_BASE_URL}/calendars`)).json()
        ).litcal_metadata;
        const existingRegions: string[] = metadata.wider_regions_keys;

        await page.goto('/permission-requests.php');
        await page.check(
            'input[name="requested_role"][value="calendar_editor"]',
        );
        const row = page.locator('#permissionRows .card').first();
        await row.locator('.perm-object-type').selectOption('wider_region');

        const select = row.locator('.perm-object-id');
        await expect(select).toBeVisible({ timeout: 15000 });

        const offered = await select
            .locator('option:not([value=""])')
            .evaluateAll((opts) =>
                opts.map((o) => ({
                    value: (o as HTMLOptionElement).value,
                    group: (o.parentElement as HTMLOptGroupElement).label ?? '',
                })),
            );
        const offeredNames = offered.map((o) => o.value);

        for (const name of existingRegions) {
            expect(
                offered.find((o) => o.value === name)?.group,
                `${name} exists`,
            ).toMatch(/existing/i);
        }
        expect(offeredNames).toContain('Nordic');
        if (!existingRegions.includes('Nordic')) {
            expect(offered.find((o) => o.value === 'Nordic')?.group).toMatch(
                /not yet created/i,
            );
        }
        for (const continent of ['Africa', 'Oceania']) {
            if (!existingRegions.includes(continent)) {
                expect(
                    offeredNames,
                    `${continent} does not exist and is not prospective`,
                ).not.toContain(continent);
            }
        }
        expect(new Set(offeredNames).size, 'no region is listed twice').toBe(
            offeredNames.length,
        );

        await select.selectOption('Nordic');
        await expect(select).toHaveValue('Nordic');
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (servers running, see CLAUDE.md): `yarn playwright test e2e/permission-pickers.spec.ts --project=chromium -g "wider region"`
Expected: FAIL: `Nordic` is not offered (the picker still lists the five continents).

- [ ] **Step 3: Inject the data and labels in PHP**

In `permission-requests.php`, add `use LiturgicalCalendar\Frontend\ProspectiveWiderRegions;` next to the
`CatholicNations` import (line 11), and after the `nations:` line (~206):

```php
            <?php // Wider regions that do not exist yet but can be created (#591). ?>
            prospectiveWiderRegions: <?php echo json_encode(ProspectiveWiderRegions::all(), $jsonFlags); ?>,
```

and next to `newNationalCalendars` in its `i18n` block (~242):

```php
                existingWiderRegions: <?php echo json_encode(_('Existing wider regions'), $jsonFlags); ?>,
                newWiderRegions: <?php echo json_encode(_('New wider regions (not yet created)'), $jsonFlags); ?>,
```

In `admin-permissions.php`, add the same `use` next to `CatholicNations` (line 10), after the `nations:` line (~382):

```php
            <?php // Wider regions that do not exist yet but can be created (#591). ?>
            prospectiveWiderRegions: <?php echo json_encode(ProspectiveWiderRegions::all(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>,
```

and next to `newNationalCalendars` (~437):

```php
                existingWiderRegions: <?php echo json_encode(_('Existing wider regions')); ?>,
                newWiderRegions: <?php echo json_encode(_('New wider regions (not yet created)')); ?>,
```

- [ ] **Step 4: Mount the picker in `permission-requests.js`**

Add the import after the `nationObjectIdSelect.js` import (line 21):

```js
import {
    buildWiderRegionObjectIdSelectFromConfig,
    WIDER_REGION_TYPE,
} from './widerRegionObjectIdSelect.js';
```

Delete lines 151-153 (the comment and `const WIDER_REGIONS = [...]`).

In `buildStaticObjectIdSelect`, replace:

```js
        let entries = [];
        if (objectType === 'wider_region') {
            entries = WIDER_REGIONS.map(function(name) { return { value: name, label: name }; });
        } else if (objectType === 'rite_calendar_test') {
```

with:

```js
        let entries = [];
        if (objectType === 'rite_calendar_test') {
```

and update its JSDoc first line to "for the non-calendar scopes (rite calendar / GRC / GRC test)".

After `mountNationObjectIdSelect(row, mount)` add:

```js
/**
 * Mount the wider region picker for the `wider_region` scope (#591).
 *
 * Offers the regions that exist and the prospective ones not yet created, so
 * a region's admin can be requested before the region exists. Metadata only
 * sorts the list into existing / to-be-created; if it failed to load, the
 * prospective regions are still offered, ungrouped.
 * @param {HTMLElement} row - The permission row (.card element)
 * @param {HTMLElement} mount - The row's `.perm-objid-mount`
 */
async function mountWiderRegionObjectIdSelect(row, mount) {
    const client = await apiClientReady;
    if (
        !row.isConnected ||
        row.querySelector('.perm-object-type').value !== WIDER_REGION_TYPE
    )
        return;
    mount.replaceChildren(
        buildWiderRegionObjectIdSelectFromConfig(config, client, {
            locale: LITCAL_LOCALE,
            className: 'form-select form-select-sm perm-object-id',
        }),
    );
}
```

In `syncRowObjectIdField`, after the `NATIONAL_CALENDAR_TYPE` block:

```js
if (objectType === WIDER_REGION_TYPE) {
    await mountWiderRegionObjectIdSelect(row, mount);
    return;
}
```

- [ ] **Step 5: Mount the picker in `admin-permissions.js`**

Add the import after line 20:

```js
import {
    buildWiderRegionObjectIdSelectFromConfig,
    WIDER_REGION_TYPE,
} from './widerRegionObjectIdSelect.js';
```

Delete lines 96-98 (the comment and `const WIDER_REGIONS = [...]`).

In `buildStaticGrantObjectId`, replace:

```js
        let entries = [];
        if (objectType === 'wider_region') {
            entries = WIDER_REGIONS.map(function(name) { return { value: name, label: name }; });
        } else if (objectType === 'rite_calendar_test') {
```

with:

```js
        let entries = [];
        if (objectType === 'rite_calendar_test') {
```

and update its JSDoc first line to "non-calendar scopes (rite calendar / GRC / GRC test)".

After `mountNationObjectIdSelect(mount)` add:

```js
/**
 * Mount the wider region picker for the `wider_region` scope (#591).
 *
 * See permission-requests.js: offers existing and prospective regions, so
 * `admin` can be granted on a region before it is created.
 * @param {HTMLElement} mount - #grantObjectIdMount
 */
async function mountWiderRegionObjectIdSelect(mount) {
    const client = await apiClientReady;
    if (grantObjectType.value !== WIDER_REGION_TYPE) return; // scope changed again meanwhile
    mount.replaceChildren(
        buildWiderRegionObjectIdSelectFromConfig(config, client, {
            locale: LITCAL_LOCALE,
            className: 'form-select',
            id: 'grantObjectId',
        }),
    );
}
```

In `syncObjectIdField`, after the `NATIONAL_CALENDAR_TYPE` block:

```js
if (objectType === WIDER_REGION_TYPE) {
    await mountWiderRegionObjectIdSelect(mount);
    return;
}
```

- [ ] **Step 6: Run the checks**

Run: `grep -rn "WIDER_REGIONS" assets/js` → no output.
Run: `yarn lint && yarn test:unit && composer lint && composer analyse`
Run: `yarn playwright test e2e/permission-pickers.spec.ts --project=chromium`
Expected: all PASS (the new test and the existing diocesan picker tests).

- [ ] **Step 7: Commit**

```bash
git add assets/js/admin-permissions.js assets/js/permission-requests.js admin-permissions.php permission-requests.php e2e/permission-pickers.spec.ts
git commit -F - <<'EOF'
feat: permission pickers list existing and prospective wider regions (#591)

The wider_region scope no longer offers a fixed list of five continents:
it lists the regions /calendars announces and the prospective ones from
ProspectiveWiderRegions.json, in two groups.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```

---

### Task 5: Extending page — offer, validate and pre-fill prospective regions

**Files:**

- Modify: `includes/messages.php` (~line 246, one new string)
- Modify: `extending.php` (datalist at ~186-195; `$messages` merge at ~737-745)
- Modify: `assets/js/extending.js` (imports ~39-42; destructure at 142; `key` validation at 628-635; the two
  "does not exist yet" `widerregion` branches at ~1924-1927 and ~1961-1964; `buildWiderRegionPayload` at ~2843-2865)

**Interfaces:**

- Consumes: `ProspectiveWiderRegions::all()` (Task 1); `isValidWiderRegionName`, `findProspectiveRegion`,
  `offeredLocales`, `widerRegionNationalCalendars` (Task 2).
- Produces: `Messages.ProspectiveWiderRegions` (array of `ProspectiveRegion`) on the extending page; the E2E test of
  Task 6 relies on a prospective region's roster reaching the PUT payload's `national_calendars` and its offered
  locales being pre-selected.

- [ ] **Step 1: Add the translatable suffix**

In `includes/messages.php`, next to `'Wider Region' => _('Wider Region'),`:

```php
    'not yet created'                                 => _('not yet created'),
```

(Align the `=>` with the surrounding entries; `composer lint:fix` will do it.)

- [ ] **Step 2: Offer prospective regions in the datalist**

In `extending.php`, add `use LiturgicalCalendar\Frontend\ProspectiveWiderRegions;` with the other `use` statements at
the top (if there are none, add it after the opening `<?php` block's `include`/`require` lines). Then, right after the
`foreach ($LitCalMetadata['wider_regions'] as $widerRegion) { ... }` loop inside `#WiderRegionsList` and before
`</datalist>`, add:

```php
                            foreach (ProspectiveWiderRegions::all() as $prospectiveRegion) {
                                if (in_array($prospectiveRegion['name'], $LitCalMetadata['wider_regions_keys'] ?? [], true)) {
                                    continue;
                                }
                                $prospectiveName  = htmlspecialchars($prospectiveRegion['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                $prospectiveLabel = htmlspecialchars(
                                    $prospectiveRegion['name'] . ' (' . implode(', ', $prospectiveRegion['roster']) . ') — ' . $messages['not yet created'],
                                    ENT_QUOTES | ENT_SUBSTITUTE,
                                    'UTF-8'
                                );
                                echo "<option value=\"{$prospectiveName}\">{$prospectiveLabel}</option>";
                            }
```

In the `$messages = array_merge($messages, [...])` call (~737), add:

```php
    'ProspectiveWiderRegions'       => ProspectiveWiderRegions::all(),
```

- [ ] **Step 3: Replace the hard-coded continent check**

In `assets/js/extending.js`, add to the imports (after line 41):

```js
import {
    findProspectiveRegion,
    isValidWiderRegionName,
    offeredLocales,
    widerRegionNationalCalendars,
} from './prospectiveWiderRegions.js';
```

Change line 142 to also destructure the new key:

```js
const {
    LOCALE,
    AvailableLocales,
    AvailableLocalesWithRegion,
    CountriesWithCatholicDioceses,
    DiocesesList,
    ProspectiveWiderRegions,
} = Messages;
```

Replace (628-635):

```js
if (target['category'] === 'widerregion') {
    if (value.includes(' - ')) {
        [value, target['locale']] = value.split(' - ');
    }
    if (
        false ===
        ['Americas', 'Europe', 'Africa', 'Oceania', 'Asia'].includes(value)
    ) {
        console.error(
            `property 'key=${value}' of this object is not a valid value, valid values are: 'Americas', 'Europe', 'Africa', 'Oceania', 'Asia'`,
        );
        return;
    }
}
```

with:

```js
if (target['category'] === 'widerregion') {
    if (value.includes(' - ')) {
        [value, target['locale']] = value.split(' - ');
    }
    // Since API #1007 any name of the right shape can be a wider region;
    // whether it exists is a runtime check (wider_regions_keys).
    if (false === isValidWiderRegionName(value)) {
        console.error(
            `property 'key=${value}' of this object is not a valid wider region name: each word must start with an uppercase letter and contain only letters`,
        );
        return;
    }
    if (false === LitCalMetadata.wider_regions_keys.includes(value)) {
        console.warn(
            `property 'key=${value}' of this object is not yet defined, defined values are: ${LitCalMetadata.wider_regions_keys.join(', ')}`,
        );
        target['method'] = 'PUT';
    }
}
```

- [ ] **Step 4: Pre-fill a prospective region on create**

Add this function next to `prepareNewNationalCalendarLocales` in `assets/js/extending.js`:

```js
/**
 * Prepare the form for a wider region being created. For a prospective region
 * (assets/data/ProspectiveWiderRegions.json) select its suggested locales —
 * those this page offers — and take its roster as the region's members, so the
 * edit-rights check sees its nations before the region exists. Any other new
 * region starts with no locales.
 */
const prepareNewWiderRegion = () => {
    const prospective = findProspectiveRegion(ProspectiveWiderRegions, API.key);
    loadedWiderRegionMembers = prospective ? [...prospective.roster] : [];
    const locales = prospective
        ? offeredLocales(
              prospective.locales,
              Object.keys(AvailableLocalesWithRegion),
          )
        : [];
    const localesSelect = document.querySelector('#widerRegionLocales');
    $(localesSelect).multiselect('deselectAll', false);
    if (locales.length === 0) return;
    $(localesSelect).multiselect('select', locales);
    // calendarLocalesChanged() rebuilds the current-localization choices from the selection.
    localesSelect.dispatchEvent(
        new CustomEvent('change', { bubbles: true, cancelable: true }),
    );
    document.querySelector('.currentLocalizationChoices').value = locales[0];
};
```

In both "does not exist yet" branches of `fetchRegionalCalendarData` (the `.catch` 404 branch ~1924 and the
`else` branch ~1961), replace:

```js
                    case 'widerregion':
                        $('#widerRegionLocales').multiselect('deselectAll', false);
                        break;
```

(and its differently indented twin) with:

```js
                    case 'widerregion':
                        prepareNewWiderRegion();
                        break;
```

- [ ] **Step 5: Keep roster nations in the create payload**

In `buildWiderRegionPayload`, replace:

```js
    return {
        litcal: [],
        national_calendars: nationalCalendars,
```

with:

```js
    // A prospective region being created brings its whole roster: some members
    // (Brunei, Eswatini, Mauritania) have no locale in the Locales list.
    const prospective = API.method === 'PUT' ? findProspectiveRegion(ProspectiveWiderRegions, API.key) : undefined;

    return {
        litcal: [],
        national_calendars: prospective
            ? widerRegionNationalCalendars(prospective.roster, nationalCalendars)
            : nationalCalendars,
```

- [ ] **Step 6: Run the checks**

Run: `grep -n "'Americas', 'Europe'" assets/js/extending.js` → no output.
Run: `node --check assets/js/extending.js && yarn lint && yarn test:unit && composer lint && composer analyse && composer parallel-lint`
Expected: all PASS.

Manual check (stack running, logged in as an admin): open `extending.php?choice=widerRegion`, type `Nordic` → the
"does not exist yet" toast appears and the Locales multiselect shows Danish/Swedish/Norwegian Bokmål/Finnish/Icelandic
selected; type `Europe - it_IT` → Europe loads as before.

- [ ] **Step 7: Commit**

```bash
git add includes/messages.php extending.php assets/js/extending.js
git commit -F - <<'EOF'
feat: extending page offers and pre-fills prospective wider regions (#66)

The wider region chooser lists the prospective regions not yet created,
validates names by the API's shape rule instead of five continents, and
creating a prospective region pre-selects its locales and sends its whole
roster as national_calendars.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```

---

### Task 6: E2E wider-region spec without the five-continent list

**Files:**

- Modify: `e2e/constants.ts:5-21`
- Modify: `e2e/wider-region-calendar.spec.ts` (import at line 2; region choice at ~250-267; payload checks at ~655-666)

**Interfaces:**

- Consumes: `assets/data/ProspectiveWiderRegions.json` (Task 1); the pre-fill and payload behaviour of Task 5.
- Produces: `WIDER_REGION_NAME_PATTERN` exported from `e2e/constants.ts`.

- [ ] **Step 1: Replace the constant**

In `e2e/constants.ts`, replace the `VALID_WIDER_REGIONS` doc comment, array and `WiderRegion` type with:

```ts
/**
 * The API's shape rule for a wider region name (`WiderRegionName`, API #1007).
 * Whether a region exists is a runtime check against `/calendars`.
 */
export const WIDER_REGION_NAME_PATTERN = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;
```

- [ ] **Step 2: Create a prospective region, falling back to a generated name**

In `e2e/wider-region-calendar.spec.ts`, change line 2 to:

```ts
import { WIDER_REGION_NAME_PATTERN } from './constants';
import { readFileSync } from 'node:fs';
import path from 'node:path';
```

Add below the imports:

```ts
type ProspectiveRegion = { name: string; roster: string[]; locales: string[] };

/** The prospective wider regions the extending page offers (assets/data/ProspectiveWiderRegions.json). */
function prospectiveWiderRegions(): ProspectiveRegion[] {
    const file = path.resolve(
        __dirname,
        '../assets/data/ProspectiveWiderRegions.json',
    );
    return JSON.parse(readFileSync(file, 'utf8')).wider_regions;
}

/** A pattern-valid region name no stack will have, e.g. `Test Region Kqbx`. */
function generatedRegionName(): string {
    const suffix = Array.from({ length: 4 }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join('');
    return `Test Region ${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
}
```

Replace:

```ts
// Find a valid wider region that doesn't have calendar data yet
const regionToCreate = VALID_WIDER_REGIONS.find(
    (r) => !existingRegionIds.includes(r),
);

if (!regionToCreate) {
    test.skip(true, `All valid wider regions already have calendar data`);
    return;
}
```

with:

```ts
// Create a prospective region that does not exist yet, so the pre-fill path runs;
// if every one already exists, any pattern-valid name still exercises CREATE.
const prospective = prospectiveWiderRegions().find(
    (r) => !existingRegionIds.includes(r.name),
);
const regionToCreate = prospective?.name ?? generatedRegionName();
```

After the `Locales dropdown populated` log (right after the `waitForFunction` on `#widerRegionLocales`), add:

```ts
if (prospective) {
    // The region's suggested locales that this page offers are pre-selected.
    const preselected = await page.evaluate(() =>
        Array.from(
            (document.querySelector('#widerRegionLocales') as HTMLSelectElement)
                .selectedOptions,
            (o) => o.value,
        ),
    );
    const offered = await page.evaluate(() =>
        Array.from(
            (document.querySelector('#widerRegionLocales') as HTMLSelectElement)
                .options,
            (o) => o.value,
        ),
    );
    expect(preselected).toEqual(
        prospective.locales.filter((l) => offered.includes(l)),
    );
}
```

- [ ] **Step 3: Check the saved name by the pattern and the roster in the payload**

Replace:

```ts
// Validate wider_region is one of the valid values
expect(VALID_WIDER_REGIONS).toContain(capturedPayload.metadata.wider_region);
```

with:

```ts
// The name follows the API's shape rule, and is the region we chose
expect(capturedPayload.metadata.wider_region).toMatch(
    WIDER_REGION_NAME_PATTERN,
);
expect(capturedPayload.metadata.wider_region).toBe(regionToCreate);

// A prospective region sends its whole roster, even nations with no selected locale
if (prospective) {
    const members = Object.values(capturedPayload.national_calendars ?? {});
    for (const code of prospective.roster) {
        expect(
            members,
            `${code} is on the ${prospective.name} roster`,
        ).toContain(code);
    }
}
```

- [ ] **Step 4: Run the checks**

Run: `grep -rn "VALID_WIDER_REGIONS\|WiderRegion\b" e2e/constants.ts e2e/wider-region-calendar.spec.ts` → only the
comment lines mentioning the `WiderRegion` schema (lines ~383, ~635, ~642), no import or use of the old constant.
Run: `yarn typecheck && yarn lint`
Run: `yarn playwright test e2e/wider-region-calendar.spec.ts --project=chromium`
Expected: PASS (the CREATE test creates `German Language Area`, the first prospective region alphabetically, unless it
exists; it may still skip for missing translations, as before).

- [ ] **Step 5: Commit**

```bash
git add e2e/constants.ts e2e/wider-region-calendar.spec.ts
git commit -F - <<'EOF'
test(e2e): create a prospective wider region instead of a hard-coded continent (#591)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```

---

### Task 7: Docs and full verification

**Files:**

- Modify: `CLAUDE.md` ("Calendar Schema Differences" section, the sentence after the table)

- [ ] **Step 1: Update CLAUDE.md**

Replace:

```markdown
WiderRegion names must be: `Americas`, `Europe`, `Asia`, `Africa`, or `Oceania`.
```

with:

```markdown
A WiderRegion name must match the API's shape rule `^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$` (API #1007); whether the region
exists is a runtime check against `/calendars` `wider_regions_keys`. The regions that do not exist yet but can be
created — the multinational groupings of the Notitiae survey — are curated in `assets/data/ProspectiveWiderRegions.json`
(read by `src/ProspectiveWiderRegions.php`), and both the permission pickers and the extending page offer them.
```

- [ ] **Step 2: Run the full pre-commit suite**

Run:

```bash
composer parallel-lint && composer lint:fix && composer analyse && composer test && composer lint:md:fix && yarn typecheck && yarn lint && yarn test:unit && yarn format:md
```

Expected: all PASS; `git status` shows only CLAUDE.md (plus any formatting the fixers applied, which must be reviewed).

- [ ] **Step 3: Run the affected E2E specs**

Run: `yarn playwright test e2e/permission-pickers.spec.ts e2e/wider-region-calendar.spec.ts e2e/national-calendar.spec.ts --project=chromium`
Expected: PASS (national-calendar covers the `wider_regions` association that now imports the shared pattern).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -F - <<'EOF'
docs: wider region names follow the API shape rule; prospective regions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018qX2H4ujchj6H61kthpKid
EOF
```
