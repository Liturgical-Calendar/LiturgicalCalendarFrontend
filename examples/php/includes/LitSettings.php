<?php

include_once( 'enums/Epiphany.php' );
include_once( 'enums/Ascension.php' );
include_once( 'enums/CorpusChristi.php' );
include_once( 'enums/LitLocale.php' );

class LitSettings {
    public int $YEAR;
    public string $Epiphany         = Epiphany::JAN6;
    public string $Ascension        = Ascension::THURSDAY;
    public string $CorpusChristi    = CorpusChristi::THURSDAY;
    public string $LOCALE           = LitLocale::LATIN;
    public ?string $NationalCalendar = null;
    public ?string $DiocesanCalendar = null;
    private array $MetaData         = [];

    const ALLOWED_PARAMS  = [
        "YEAR",
        "EPIPHANY",
        "ASCENSION",
        "CORPUSCHRISTI",
        "LOCALE",
        "NATIONALCALENDAR",
        "DIOCESANCALENDAR"
    ];

    const SUPPORTED_NATIONAL_PRESETS = [ "ITALY", "USA", "VATICAN" ];

    //If we can get more data from 1582 (year of the Gregorian reform) to 1969
    // perhaps we can lower the limit to the year of the Gregorian reform
    //For now we'll just deal with the Liturgical Calendar from the Editio Typica 1970
    //const YEAR_LOWER_LIMIT          = 1583;
    const YEAR_LOWER_LIMIT          = 1970;

    //The upper limit is determined by the limit of PHP in dealing with DateTime objects
    const YEAR_UPPER_LIMIT          = 9999;
  
    public function __construct( array $DATA ){
        $this->YEAR = (int)date("Y");
        foreach( $DATA as $key => $value ){
            $key = strtoupper( $key );
            if( in_array( $key, self::ALLOWED_PARAMS ) ){
                switch( $key ){
                    case "YEAR":
                        if( gettype( $value ) === 'string' ){
                            if( is_numeric( $value ) && ctype_digit( $value ) && strlen( $value ) === 4 ){
                                $value = (int)$value;
                                if( $value >= self::YEAR_LOWER_LIMIT && $value <= self::YEAR_UPPER_LIMIT ){
                                    $this->YEAR = $value;
                                }
                            }
                        } elseif( gettype( $value ) === 'integer' ) {
                            if( $value >= self::YEAR_LOWER_LIMIT && $value <= self::YEAR_UPPER_LIMIT ){
                                $this->YEAR = $value;
                            }
                        }
                        break;
                    case "EPIPHANY":
                        $this->Epiphany         = Epiphany::isValid( strtoupper( $value ) )         ? strtoupper( $value ) : Epiphany::JAN6;
                        break;
                    case "ASCENSION":
                        $this->Ascension        = Ascension::isValid( strtoupper( $value ) )        ? strtoupper( $value ) : Ascension::THURSDAY;
                        break;
                    case "CORPUSCHRISTI":
                        $this->CorpusChristi    = CorpusChristi::isValid( strtoupper( $value ) )    ? strtoupper( $value ) : CorpusChristi::THURSDAY;
                        break;
                    case "LOCALE":
                        $this->LOCALE           = LitLocale::isValid( strtoupper( $value ) )       ? strtoupper( $value ) : LitLocale::LATIN;
                        break;
                    case "NATIONALCALENDAR":
                        $this->NationalCalendar         = in_array( strtoupper( $value ), self::SUPPORTED_NATIONAL_PRESETS ) ? strtoupper( $value ) : null;
                        break;
                    case "DIOCESANCALENDAR":
                        $this->DiocesanCalendar         = $value !== "" ? strtoupper( $value ) : null;
                }
            }
        }

        if( $this->NationalCalendar !== null ) {
            $this->updateSettingsByNation();
        }

    }

    private function updateSettingsByNation() {
        switch( $this->NationalCalendar ) {
            case "VATICAN":
                $this->Epiphany         = Epiphany::JAN6;
                $this->Ascension        = Ascension::THURSDAY;
                $this->CorpusChristi    = CorpusChristi::THURSDAY;
                $this->LOCALE           = LitLocale::LATIN;
                break;
            case "ITALY":
                $this->Epiphany         = Epiphany::JAN6;
                $this->Ascension        = Ascension::SUNDAY;
                $this->CorpusChristi    = CorpusChristi::SUNDAY;
                $this->LOCALE           = LitLocale::ITALIAN;
                break;
            case "USA":
                $this->Epiphany         = Epiphany::SUNDAY_JAN2_JAN8;
                $this->Ascension        = Ascension::SUNDAY;
                $this->CorpusChristi    = CorpusChristi::SUNDAY;
                $this->LOCALE           = LitLocale::ENGLISH;
                break;
        }
    }

    public function setMetaData( array $MetaData ) {
        $this->MetaData = $MetaData;
        if( $this->DiocesanCalendar !== null ) {
            $this->NationalCalendar = $this->MetaData[$this->DiocesanCalendar]["nation"];
            $this->updateSettingsByNation();
        }
    }

}
