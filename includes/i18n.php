<?php 
//turn on error reporting for the staging site
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

class i18n {

    const MESSAGES = [
        "Usage" => [
            "de" => "Verwendung",
            "en" => "Usage",
            "es" => "Uso",
            "fr" => "Usage",
            "it" => "Utilizzo",
            "pt" => "Uso"
        ],
        "Extending the API" => [
            "de" => "API erweitern",
            "en" => "Extending the API",
            "es" => "Ampliando la API",
            "fr" => "Extension de l'API",
            "it" => "Estendere l'API",
            "pt" => "Extensão da API"
        ],
        "About us" => [
            "de" => "Wer wir sind",
            "en" => "About us",
            "es" => "Quienes somos",
            "fr" => "Qui nous sommes",
            "it" => "Chi siamo",
            "pt" => "Quem nós somos"
        ],
        "Create a Diocesan Calendar" => [
            "de" => "Erstellen Sie einen Diözesankalender",
            "en" => "Create a Diocesan Calendar",
            "es" => "Crea un calendario diocesano",
            "fr" => "Créer un calendrier diocésain",
            "it" => "Crea un calendario diocesano",
            "pt" => "Crie um calendário diocesano"
        ],
        "Create a National Calendar" => [
            "de" => "Erstellen Sie einen nationalen Kalender",
            "en" => "Create a National Calendar",
            "es" => "Crea un calendario nacional",
            "fr" => "Créer un calendrier national",
            "it" => "Crea un calendario nazionale",
            "pt" => "Crie um calendário nacional"
        ],
        "Month" => [
            "de" => "Monat",
            "en" => "Month",
            "es" => "Mes",
            "fr" => "Mois",
            "it" => "Mese",
            "lat" => "Mensis",
            "pt" => "Mês"
        ],
        "Day" => [
            "de" => "Tag",
            "en" => "Day",
            "es" => "Día",
            "fr" => "Jour",
            "it" => "Giorno",
            "lat" => "Dies",
            "pt" => "Dia"
        ],
        "Name" => [
            "de" => "Name",
            "en" => "Name",
            "es" => "Nombre",
            "fr" => "Nom",
            "it" => "Nome",
            "lat" => "Nomen",
            "pt" => "Nome"
        ],
        "Liturgical color" => [
            "de" => "Liturgische Farbe",
            "en" => "Liturgical color",
            "es" => "Color litúrgico",
            "fr" => "Couleur liturgique",
            "it" => "Colore liturgico",
            "lat" => "Color liturgicum",
            "pt" => "Cor litúrgica"
        ],
        "Solemnities" => [
            "de" => "Feierlichkeiten",
            "en" => "Solemnities",
            "es" => "Solemnidades",
            "fr" => "Solennités",
            "it" => "Solennità",
            "lat" => "Sollemnitates",
            "pt" => "Solenidades"
        ],
        "Feasts" => [
            "de" => "Feste",
            "en" => "Feasts",
            "es" => "Fiestas",
            "fr" => "Fêtes",
            "it" => "Feste",
            "lat" => "Festuum",
            "pt" => "Festas"
        ],
        "Memorials" => [
            "de" => "Gedenkfeiern",
            "en" => "Memorials",
            "es" => "Memorias",
            "fr" => "Mémoires",
            "it" => "Memorie obbligatorie",
            "lat" => "Memoriae",
            "pt" => "Memórias"
        ],
        "Optional memorials" => [
            "de" => "Optionale Gedenkfeiers",
            "en" => "Optional memorials",
            "es" => "Memorias opcionales",
            "fr" => "Mémoires optionnelles",
            "it" => "Memorie facoltative",
            "lat" => "Memoriae ad libitum",
            "pt" => "Memórias opcionais"
        ],
        "Since" => [
            "en" => "Since",
            "it" => "Dall'anno",
            "lat" => "Ab anno"
        ]
    ];

    

    public array $messages;

    public string $LOCALE;

    public function __construct( array $messages = null ) {

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

        if( $messages !== null ) {
            $this->messages = array_merge( self::MESSAGES, $messages );
        }
    }


}

?>
