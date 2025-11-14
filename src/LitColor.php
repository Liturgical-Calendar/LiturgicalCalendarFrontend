<?php

namespace LiturgicalCalendar\Frontend;

class LitColor
{
    public const GREEN          = 'green';
    public const PURPLE         = 'purple';
    public const WHITE          = 'white';
    public const RED            = 'red';
    public const ROSE           = 'rose';
    public static array $values = [ 'green', 'purple', 'white', 'red', 'rose' ];

    public static function isValid(string $value)
    {
        return in_array($value, self::$values);
    }

    public static function areValid(array $values)
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
        }
    }
}
