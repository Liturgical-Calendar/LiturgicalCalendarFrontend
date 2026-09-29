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
