<?php

namespace LiturgicalCalendar\Frontend;

class LitColor
{
    public const GREEN  = 'green';
    public const PURPLE = 'purple';
    public const WHITE  = 'white';
    public const RED    = 'red';
    public const ROSE   = 'rose';
    // Ambrosian only: never licit in Roman source data, so not in $values.
    public const MORELLO = 'morello';
    public const BLACK   = 'black';
    /** @var array<int, string> The Roman palette, which is what $values validates against. */
    public static array $values = [ 'green', 'purple', 'white', 'red', 'rose' ];

    public static function isValid(string $value): bool
    {
        return in_array($value, self::$values, true);
    }

    /**
     * @param array<int, string> $values
     */
    public static function areValid(array $values): bool
    {
        return empty(array_diff($values, self::$values));
    }

    public static function i18n(string $value, string $locale): string
    {
        switch ($value) {
            case self::GREEN:
                /**translators: context = liturgical color */
                return $locale === 'LA' ? 'viridis'     : _('green');
            case self::PURPLE:
                /**translators: context = liturgical color */
                return $locale === 'LA' ? 'purpura'     : _('purple');
            case self::WHITE:
                /**translators: context = liturgical color */
                return $locale === 'LA' ? 'albus'       : _('white');
            case self::RED:
                /**translators: context = liturgical color */
                return $locale === 'LA' ? 'ruber'       : _('red');
            case self::ROSE:
                /**translators: context = liturgical color */
                return $locale === 'LA' ? 'rosea'       : _('rose');
            case self::MORELLO:
                /**translators: context = liturgical color (Ambrosian rite) */
                return $locale === 'LA' ? 'morellus'    : _('morello');
            case self::BLACK:
                /**translators: context = liturgical color (Ambrosian rite) */
                return $locale === 'LA' ? 'niger'       : _('black');
            default:
                throw new \InvalidArgumentException("Invalid liturgical color: {$value}");
        }
    }
}
