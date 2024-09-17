<?php

// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

class I18n
{
    public string $LOCALE;
    public string $LOCALE_WITH_REGION;
    private const PRIMARY_REGIONS = [
        "en" => "US",
        "la" => "VA",
        "es" => "ES",
        "pt" => "PT",
        "fr" => "FR",
        "it" => "IT",
        "de" => "DE",
        "nl" => "NL"
    ];

    public function __construct()
    {

        if (!empty($_COOKIE["currentLocale"])) {
            $this->LOCALE = $_COOKIE["currentLocale"];
        } elseif (isset($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
            $this->LOCALE = Locale::acceptFromHttp($_SERVER['HTTP_ACCEPT_LANGUAGE']);
        } else {
            $this->LOCALE = "en";
        }
        //we only need the two letter ISO code, not the national extension, when setting the text domain...
        if ($this->LOCALE !== 'la' && $this->LOCALE !== "LA") {
            $LOCALE = Locale::getPrimaryLanguage($this->LOCALE);
            $REGION = Locale::getRegion($this->LOCALE);
            if (null === $REGION || empty($REGION)) {
                $this->LOCALE_WITH_REGION = $LOCALE . '_' . self::PRIMARY_REGIONS[$LOCALE];
            } else {
                $this->LOCALE_WITH_REGION = $LOCALE . '_' . $REGION;
            }
        } else {
            $LOCALE = 'la';
            $REGION = 'VA';
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
        bindtextdomain("litcal", "i18n");
        textdomain("litcal");
    }
}
