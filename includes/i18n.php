<?php 
//turn on error reporting for the staging site
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

class i18n {

    public string $LOCALE;

    public function __construct() {

        if( !empty( $_COOKIE["currentLocale"] ) ) {
            $this->LOCALE = $_COOKIE["currentLocale"];
        }
        elseif( isset( $_SERVER['HTTP_ACCEPT_LANGUAGE'] ) ) {
            $this->LOCALE = Locale::acceptFromHttp( $_SERVER['HTTP_ACCEPT_LANGUAGE'] );
        }
        else {
            $this->LOCALE = "en";
        }
        //we only need the two letter ISO code, not the national extension, when setting the text domain...
        $LOCALE = $this->LOCALE;
        if( strpos( $this->LOCALE, "_" ) ) {
            $LOCALE = explode( "_", $this->LOCALE )[0];
        } else if ( strpos( $this->LOCALE, "-" ) ) {
            $LOCALE = explode( "-", $this->LOCALE )[0];
        }

        $localeArray = [
            strtolower( $LOCALE ) . '_' . strtoupper( $LOCALE ) . '.utf8',
            strtolower( $LOCALE ) . '_' . strtoupper( $LOCALE ) . '.UTF-8',
            strtolower( $LOCALE ) . '_' . strtoupper( $LOCALE ),
            strtolower( $LOCALE )
        ];
        setlocale( LC_ALL, $localeArray );
        bindtextdomain("litcal", "i18n");
        textdomain("litcal");

    }

}
