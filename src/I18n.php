<?php

namespace LiturgicalCalendar\Frontend;

class I18n
{
    public string $LOCALE;
    public string $LOCALE_WITH_REGION;
    private const PRIMARY_REGIONS = [
        'en' => 'US',
        'la' => 'VA',
        'es' => 'ES',
        'pt' => 'PT',
        'fr' => 'FR',
        'it' => 'IT',
        'de' => 'DE',
        'nl' => 'NL',
        'sk' => 'SK'
    ];

    public function __construct()
    {

        if (!empty($_COOKIE['currentLocale'])) {
            $this->LOCALE = $_COOKIE['currentLocale'];
        } elseif (isset($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
            $acceptedLocale = \Locale::acceptFromHttp($_SERVER['HTTP_ACCEPT_LANGUAGE']);
            $this->LOCALE   = $acceptedLocale !== false ? $acceptedLocale : 'en';
        } else {
            $this->LOCALE = 'en';
        }
        //we only need the two letter ISO code, not the national extension, when setting the text domain...
        if ($this->LOCALE !== 'la' && $this->LOCALE !== 'LA') {
            $LOCALE = \Locale::getPrimaryLanguage($this->LOCALE);
            $REGION = \Locale::getRegion($this->LOCALE);
            if (null === $REGION || empty($REGION)) {
                $primaryRegion            = self::PRIMARY_REGIONS[$LOCALE] ?? strtoupper($LOCALE);
                $this->LOCALE_WITH_REGION = $LOCALE . '_' . $primaryRegion;
            } else {
                $this->LOCALE_WITH_REGION = $LOCALE . '_' . $REGION;
            }
        } else {
            $LOCALE                   = 'la';
            $REGION                   = 'VA';
            $this->LOCALE_WITH_REGION = 'la_VA';
        }

        $localeArray = [
            $LOCALE . '_' . $REGION . '.utf8',
            $LOCALE . '_' . $REGION . '.UTF-8',
            $LOCALE . '_' . $REGION,
            $LOCALE . '_' . strtoupper($LOCALE) . '.utf8',
            $LOCALE . '_' . strtoupper($LOCALE) . '.UTF-8',
            $LOCALE . '_' . strtoupper($LOCALE),
            $LOCALE . '.utf8',
            $LOCALE . '.UTF-8',
            $LOCALE
        ];
        setlocale(LC_ALL, $localeArray);
        bindtextdomain('litcal', 'i18n');
        textdomain('litcal');
    }
}
