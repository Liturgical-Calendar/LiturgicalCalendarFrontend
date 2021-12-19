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
        //we only need the two letter ISO code, not the national extension
        if( strpos( $this->LOCALE, "_" ) ) {
            $this->LOCALE = explode( "_", $this->LOCALE )[0];
        } else if ( strpos( $this->LOCALE, "-" ) ) {
            $this->LOCALE = explode( "-", $this->LOCALE )[0];
        }

        $localeArray = [
            strtolower( $this->LOCALE ) . '_' . strtoupper( $this->LOCALE ) . '.utf8',
            strtolower( $this->LOCALE ) . '_' . strtoupper( $this->LOCALE ) . '.UTF-8',
            strtolower( $this->LOCALE ) . '_' . strtoupper( $this->LOCALE ),
            strtolower( $this->LOCALE )
        ];
        setlocale( LC_ALL, $localeArray );
        bindtextdomain("litcal", "i18n");
        textdomain("litcal");

    }


}

?>
