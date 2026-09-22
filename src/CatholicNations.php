<?php

namespace LiturgicalCalendar\Frontend;

/**
 * The nations a national calendar can be requested or granted for.
 *
 * A `national_calendar` permission is not limited to nations whose calendar
 * already exists: the API accepts a prospective nation so that a national
 * liturgy office can request `admin` and then create the calendar (API #669).
 * The permission pickers therefore need every nation that CAN have a calendar,
 * not only those the `/calendars` metadata announces.
 *
 * The list is the one extending.php offers for defining a new national
 * calendar — the countries with Latin-rite Catholic dioceses — so what a user
 * may request is exactly what they will then be able to create.
 */
final class CatholicNations
{
    public const DEFAULT_SOURCE = __DIR__ . '/../assets/data/WorldDiocesesByNation.json';

    /**
     * ISO 3166-1 alpha-2 code => display name in `$locale`, sorted by display name.
     *
     * @param string $locale Locale for the display names and the collation
     * @param string $source Path to the WorldDiocesesByNation JSON data
     * @return array<string, string>
     * @throws \RuntimeException When the source cannot be read or has the wrong shape
     */
    public static function localized(string $locale, string $source = self::DEFAULT_SOURCE): array
    {
        $raw = @file_get_contents($source);
        if ($raw === false) {
            throw new \RuntimeException('Could not read ' . $source);
        }

        $json = json_decode($raw, true);
        if (!is_array($json) || !isset($json['catholic_dioceses_latin_rite']) || !is_array($json['catholic_dioceses_latin_rite'])) {
            throw new \RuntimeException('catholic_dioceses_latin_rite not found in ' . $source);
        }

        $nations = [];
        foreach ($json['catholic_dioceses_latin_rite'] as $entry) {
            if (!is_array($entry) || !isset($entry['country_iso']) || !is_string($entry['country_iso'])) {
                continue;
            }
            $code = strtoupper($entry['country_iso']);
            if (preg_match('/^[A-Z]{2}$/', $code) !== 1) {
                continue;
            }
            $name           = \Locale::getDisplayRegion('-' . $code, $locale);
            $nations[$code] = ( $name !== false && $name !== '' ) ? $name : $code;
        }

        $collator = new \Collator($locale);
        $collator->asort($nations);
        return $nations;
    }
}
