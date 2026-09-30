<?php

namespace LiturgicalCalendar\Frontend;

/**
 * The wider regions that do not exist yet but can be created.
 *
 * Since API #1007 a wider region is any region with a source file, named by a
 * shape rule rather than a fixed list, so there is no list of prospective
 * regions to ask the API for. This curated file supplies one: the groupings of
 * three or more nations that the Notitiae survey shows sharing a calendar
 * (Frontend #66, #591), plus the five continents (#1018). The permission
 * pickers offer them so an admin can be granted `admin` on a region before
 * creating it, and the extending page pre-fills a new region's locales and
 * member nations from them.
 *
 * Since #1018 an entry is identified by a permanent, lowercase kebab-case
 * `id` rather than a display `name`; `labels` is a curated map from a label
 * key (`en`, or a bare language/language_Script derived from the region's own
 * `locales`) to that language's label, and `m49` is the UN M.49 area code for
 * a continent (`null` otherwise). `label` resolution mirrors the API's
 * `WiderRegionLabels::resolve()` (see `assets/js/prospectiveWiderRegions.js`
 * `resolveLabel`), with an added frontend-only UN M.49 tier before falling
 * back to words derived from the id.
 *
 * `sources` and `note` document the file and are not passed to the browser.
 */
final class ProspectiveWiderRegions
{
    public const DEFAULT_SOURCE = __DIR__ . '/../assets/data/ProspectiveWiderRegions.json';

    /** The API's WiderRegionId rule: lowercase kebab-case, permanent once the region exists. */
    public const ID_PATTERN = '/^[a-z]+(-[a-z]+)*$/';

    /** The API's WiderRegionLabels key rule: a bare language, or a language plus script. */
    public const LABEL_KEY_PATTERN = '/^[a-z]{2,3}(_[A-Z][a-z]{3})?$/';

    /** The UN M.49 area code rule: three digits. */
    public const M49_PATTERN = '/^\d{3}$/';

    /**
     * The script a locale that names none is written in, by language and then region ('' = any other region).
     *
     * Mirrors the API's `WiderRegionLabels::DEFAULT_SCRIPTS` (and this repo's
     * `assets/js/prospectiveWiderRegions.js` `DEFAULT_SCRIPTS`): PHP intl exposes no addLikelySubtags, so this
     * carries the one CLDR likely-subtags fact `resolveLabel()` needs, for the one multi-script language among
     * the regions' locales.
     */
    private const DEFAULT_SCRIPTS = [
        'zh' => ['TW' => 'Hant', 'HK' => 'Hant', 'MO' => 'Hant', '' => 'Hans'],
    ];

    /**
     * The valid entries, with each entry's label resolved for `$uiLocale`, sorted by label (Collator).
     *
     * An entry with an id that fails the shape rule, a duplicate id, an empty roster, a roster code that is not
     * an uppercase ISO 3166-1 alpha-2 code, or a `labels`/`m49` that fails validation is dropped entirely (never
     * partially kept).
     *
     * `labels` is an object (label key => label), so that it JSON-encodes as `{}` even when empty, as the
     * page reads it: an empty PHP array would encode as `[]`.
     *
     * @param string $uiLocale The locale to resolve each region's `label` for
     * @param string $source Path to the ProspectiveWiderRegions JSON data
     * @return list<array{id: string, label: string, labels: \stdClass, m49: ?string, description: string, roster: list<string>, locales: list<string>}>
     * @throws \RuntimeException When the source cannot be read or has the wrong shape
     */
    public static function all(string $uiLocale, string $source = self::DEFAULT_SOURCE): array
    {
        $json    = self::loadJson($source);
        $entries = self::parseEntries($json);

        $regions = [];
        foreach ($entries as $entry) {
            $regions[] = [
                'id'          => $entry['id'],
                'label'       => self::resolveLabel($entry['labels'], $uiLocale, $entry['id'], $entry['m49']),
                'labels'      => (object) $entry['labels'],
                'm49'         => $entry['m49'],
                'description' => $entry['description'],
                'roster'      => $entry['roster'],
                'locales'     => $entry['locales'],
            ];
        }

        $collator = new \Collator($uiLocale);
        usort($regions, static fn (array $a, array $b): int => (int) $collator->compare($a['label'], $b['label']));

        return $regions;
    }

    /**
     * The top-level `m49_codes` map (id => UN M.49 area code), merged with every valid prospective entry's
     * non-null `m49`. A pair with an id that fails the shape rule or a code that fails the M.49 rule is dropped.
     *
     * @param string $source Path to the ProspectiveWiderRegions JSON data
     * @return array<string, string>
     * @throws \RuntimeException When the source cannot be read or has the wrong shape
     */
    public static function m49Codes(string $source = self::DEFAULT_SOURCE): array
    {
        $json = self::loadJson($source);

        $codes    = [];
        $rawCodes = isset($json['m49_codes']) && is_array($json['m49_codes']) ? $json['m49_codes'] : [];
        foreach ($rawCodes as $id => $code) {
            $id = (string) $id;
            if (
                preg_match(self::ID_PATTERN, $id) !== 1
                || !is_string($code)
                || preg_match(self::M49_PATTERN, $code) !== 1
            ) {
                continue;
            }
            $codes[$id] = $code;
        }

        foreach (self::parseEntries($json) as $entry) {
            if ($entry['m49'] !== null) {
                $codes[$entry['id']] = $entry['m49'];
            }
        }

        return $codes;
    }

    /**
     * @return array<mixed> The decoded JSON, guaranteed to have a `wider_regions` array
     * @throws \RuntimeException When the source cannot be read or has the wrong shape
     */
    private static function loadJson(string $source): array
    {
        $raw = @file_get_contents($source);
        if ($raw === false) {
            throw new \RuntimeException('Could not read ' . $source);
        }

        $json = json_decode($raw, true);
        if (!is_array($json) || !isset($json['wider_regions']) || !is_array($json['wider_regions'])) {
            throw new \RuntimeException('wider_regions not found in ' . $source);
        }

        return $json;
    }

    /**
     * @param array<mixed> $json The decoded JSON, as returned by loadJson()
     * @return list<array{id: string, labels: array<string, string>, m49: ?string, description: string, roster: list<string>, locales: list<string>}>
     */
    private static function parseEntries(array $json): array
    {
        $seen    = [];
        $entries = [];
        foreach ($json['wider_regions'] as $entry) {
            if (!is_array($entry) || !isset($entry['id']) || !is_string($entry['id'])) {
                continue;
            }
            $id = $entry['id'];
            if (preg_match(self::ID_PATTERN, $id) !== 1 || isset($seen[$id])) {
                continue;
            }
            $roster = self::roster($entry['roster'] ?? null);
            if ($roster === null) {
                continue;
            }
            $labels = self::labels($entry['labels'] ?? null);
            if ($labels === null) {
                continue;
            }
            $m49 = self::m49($entry['m49'] ?? null);
            if ($m49 === false) {
                continue;
            }
            $locales    = [];
            $rawLocales = isset($entry['locales']) && is_array($entry['locales']) ? $entry['locales'] : [];
            foreach ($rawLocales as $locale) {
                if (is_string($locale) && $locale !== '') {
                    $locales[] = $locale;
                }
            }
            $seen[$id] = true;
            $entries[] = [
                'id'          => $id,
                'labels'      => $labels,
                'm49'         => $m49,
                'description' => isset($entry['description']) && is_string($entry['description']) ? $entry['description'] : '',
                'roster'      => $roster,
                'locales'     => $locales,
            ];
        }

        return $entries;
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

    /**
     * @param mixed $labels The entry's `labels`
     * @return array<string, string>|null The map, its values as given, or null when malformed (a key that is not a
     *   label key, or a value that is not a non-empty string)
     */
    private static function labels(mixed $labels): ?array
    {
        if ($labels === null) {
            return [];
        }
        if (!is_array($labels) || ( $labels !== [] && array_is_list($labels) )) {
            return null;
        }
        $out = [];
        foreach ($labels as $key => $label) {
            $key = (string) $key;
            if (preg_match(self::LABEL_KEY_PATTERN, $key) !== 1) {
                return null;
            }
            if (!is_string($label) || $label === '') {
                return null;
            }
            $out[$key] = $label;
        }
        return $out;
    }

    /**
     * @param mixed $m49 The entry's `m49`
     * @return string|null|false The code, null (no m49, valid), or false when malformed
     */
    private static function m49(mixed $m49): string|null|false
    {
        if ($m49 === null) {
            return null;
        }
        if (!is_string($m49) || preg_match(self::M49_PATTERN, $m49) !== 1) {
            return false;
        }
        return $m49;
    }

    /**
     * The label for `$uiLocale`: its language plus script, then its language, then English, then the UN M.49
     * area name (frontend-only, not in the API), then words derived from the id.
     *
     * Mirrors the API's `WiderRegionLabels::resolve()` for the first three tiers, exactly as this repo's
     * `assets/js/prospectiveWiderRegions.js` `resolveLabel()` does.
     *
     * @param array<string, string> $labels
     */
    private static function resolveLabel(array $labels, string $uiLocale, string $id, ?string $m49): string
    {
        $candidates = [];
        if ($uiLocale !== '') {
            [$language, $script] = self::languageAndScript($uiLocale);
            if ($script === '') {
                $defaults = self::DEFAULT_SCRIPTS[$language] ?? [];
                $region   = strtoupper((string) \Locale::getRegion($uiLocale));
                $script   = $defaults[$region] ?? $defaults[''] ?? '';
            }
            if ($script !== '') {
                $candidates[] = "{$language}_{$script}";
            }
            if ($script === '' || !self::hasOtherScript($labels, $language, $script)) {
                $candidates[] = $language;
            }
        }
        $candidates[] = 'en';

        foreach ($candidates as $key) {
            if (isset($labels[$key]) && $labels[$key] !== '') {
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

    /** @return array{0: string, 1: string} Lowercase language and title-case script ('' when absent). */
    private static function languageAndScript(string $locale): array
    {
        $language = strtolower((string) \Locale::getPrimaryLanguage($locale));
        $script   = (string) \Locale::getScript($locale);

        return [$language, $script === '' ? '' : ucfirst(strtolower($script))];
    }

    /**
     * Whether `$labels` has a `{language}_{X}` key for a script X other than `$script`.
     *
     * @param array<string, string> $labels
     */
    private static function hasOtherScript(array $labels, string $language, string $script): bool
    {
        foreach (array_keys($labels) as $key) {
            if (str_starts_with($key, "{$language}_") && $key !== "{$language}_{$script}") {
                return true;
            }
        }

        return false;
    }
}
