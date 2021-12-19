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
        "green" => [
            "de" => "grün",
            "en" => "green",
            "es" => "verde",
            "fr" => "vert",
            "it" => "verde",
            "lat" => "viridis",
            "pt" => "verde"
        ],
        "purple" => [
            "de" => "violett",
            "en" => "purple",
            "es" => "violeta",
            "fr" => "violet",
            "it" => "viola",
            "lat" => "purpura",
            "pt" => "violeta"
        ],
        "white" => [
            "de" => "weiß",
            "en" => "white",
            "es" => "blanco",
            "fr" => "blanc",
            "it" => "bianco",
            "lat" => "albus",
            "pt" => "branco"
        ],
        "red" => [
            "de" => "rot",
            "en" => "red",
            "es" => "rojo",
            "fr" => "rouge",
            "it" => "rosso",
            "lat" => "ruber",
            "pt" => "vermelho"
        ],
        "pink" => [
            "de" => "rosa",
            "en" => "pink",
            "es" => "rosa",
            "fr" => "rose",
            "it" => "rosa",
            "lat" => "rosea",
            "pt" => "rosa"
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
        "From the Common" => [
            "en" => "From the Common",
            "it" => "Dal Comune",
            "lat" => "De Communi"
        ],
        "Proper" => [
            "en" => "Proper",
            "it" => "Proprio",
            "lat" => "Proprium"
        ],
        "Common" => [
            "en" => "Common",
            "it" => "Comune",
            "lat" => "Commune"
        ],
        "of (SING_MASC)" => [
            "en" => "of",
            "it" => "del",
            "lat" => ""
        ],
        "of (SING_FEMM)" => [
            "en" => "of the",
            "it" => "della",
            "lat" => "" //latin expresses the genitive in the declination of the noun, no need for a preposition, leave empty
        ],
        "of (PLUR_MASC)" => [
            "en" => "of",
            "it" => "dei",
            "lat" => "" //latin expresses the genitive in the declination of the noun, no need for a preposition, leave empty
        ],
        "of (PLUR_MASC_ALT)" => [
            "en" => "of",
            "it" => "degli",
            "lat" => "" //latin expresses the genitive in the declination of the noun, no need for a preposition, leave empty
        ],
        "of (PLUR_FEMM)" => [
            "en" => "of",
            "it" => "delle",
            "lat" => "" //latin expresses the genitive in the declination of the noun, no need for a preposition, leave empty
        ],
        /*translators: in reference to the Common of the Blessed Virgin Mary */
        "Blessed Virgin Mary" => [
            "en" => "Blessed Virgin Mary",
            "it" => "Beata Vergine Maria",
            "lat" => "Beatæ Virginis Mariæ"
        ],
        /*translators: all of the following are in the genitive case, in reference to "from the Common of %s" */
        "Martyrs" => [
            "en" => "Martyrs",
            "it" => "Martiri",
            "lat" => "Martyrum"
        ],
        "Pastors" => [
            "en" => "Pastors",
            "it" => "Pastori",
            "lat" => "Pastorum"
        ],
        "Doctors" => [
            "en" => "Doctors",
            "it" => "Dottori della Chiesa",
            "lat" => "Doctorum Ecclesiæ"
        ],
        "Virgins" => [
            "en" => "Virgins",
            "it" => "Vergini",
            "lat" => "Virginum"
        ],
        "Holy Men and Women" => [
            "en" => "Holy Men and Women",
            "it" => "Santi e delle Sante",
            "lat" => "Sanctorum et Sanctarum"
        ],
        "For One Martyr" => [
            "en" => "For One Martyr",
            "it" => "Per un martire",
            "lat" => "Pro uno martyre"
        ],
        "For Several Martyrs" => [
            "en" => "For Several Martyrs",
            "it" => "Per più martiri",
            "lat" => "Pro pluribus martyribus"
        ],
        "For Missionary Martyrs" => [
            "en" => "For Missionary Martyrs",
            "it" => "Per i martiri missionari",
            "lat" => "Pro missionariis martyribus"
        ],
        "For One Missionary Martyr" => [
            "en" => "For One Missionary Martyr",
            "it" => "Per un martire missionario",
            "lat" => "Pro uno missionario martyre"
        ],
        "For Several Missionary Martyrs" => [
            "en" => "For Several Missionary Martyrs",
            "it" => "Per più martiri missionari",
            "lat" => "Pro pluribus missionariis martyribus"
        ],
        "For a Virgin Martyr" => [
            "en" => "For a Virgin Martyr",
            "it" => "Per una vergine martire",
            "lat" => "Pro virgine martyre"
        ],
        "For a Holy Woman Martyr" => [
            "en" => "For a Holy Woman Martyr",
            "it" => "Per una santa martire",
            "lat" => "Pro una martyre muliere",
        ],
        "For a Pope" => [
            "en" => "For a Pope",
            "it" => "Per i papi",
            "lat" => "Pro Papa"
        ],
        "For a Bishop" => [
            "en" => "For a Bishop",
            "it" => "Per i vescovi",
            "lat" => "Pro Episcopis"
        ],
        "For One Pastor" => [
            "en" => "For One Pastor",
            "it" => "Per un pastore",
            "lat" => "Pro Pastoribus"
        ],
        "For Several Pastors" => [
            "en" => "For Several Pastors",
            "it" => "Per i pastori",
            "lat" => "Pro Pastoribus"
        ],
        "For Founders of a Church" => [
            "en" => "For Founders of a Church",
            "it" => "Per i fondatori delle chiese",
            "lat" => "Pro Fundatoribus ecclesiarum"
        ],
        "For One Founder" => [
            "en" => "For One Founder",
            "it" => "Per un fondatore",
            "lat" => "Pro Uno Fundatore"
        ],
        "For Several Founders" => [
            "en" => "For Several Founders",
            "it" => "Per più fondatori",
            "lat" => "Pro Pluribus Fundatoribus"
        ],
        "For Missionaries" => [
            "en" => "For Missionaries",
            "it" => "Per i missionari",
            "lat" => "Pro missionariis"
        ],
        "For One Virgin" => [
            "en" => "For One Virgin",
            "it" => "Per una vergine",
            "lat" => "Pro una virgine"
        ],
        "For Several Virgins" => [
            "en" => "For Several Virgins",
            "it" => "Per più vergini",
            "lat" => "Pro pluribus virginibus"
        ],
        "For Religious" => [
            "en" => "For Religious",
            "it" => "Per i religiosi",
            "lat" => "Pro Religiosis"
        ],
        "For Those Who Practiced Works of Mercy" => [
            "en" => "For Those Who Practiced Works of Mercy",
            "it" => "Per gli operatori di misericordia",
            "lat" => "Pro iis qui opera Misericordiæ Exercuerunt"
        ],
        "For an Abbot" => [
            "en" => "For an Abbot",
            "it" => "Per un abate",
            "lat" => "Pro abbate"
        ],
        "For a Monk" => [
            "en" => "For a Monk",
            "it" => "Per un monaco",
            "lat" => "Pro monacho"
        ],
        "For a Nun" => [
            "en" => "For a Nun",
            "it" => "Per i religiosi",
            "lat" => "Pro moniali"
        ],
        "For Educators" => [
            "en" => "For Educators",
            "it" => "Per gli educatori",
            "lat" => "Pro Educatoribus"
        ],
        "For Holy Women" => [
            "en" => "For Holy Women",
            "it" => "Per le sante",
            "lat" => "Pro Sanctis Mulieribus"
        ],
        "For One Saint" => [
            "en" => "For One Saint",
            "it" => "Per un Santo",
            "lat" => "Pro uno Sancto"
        ],
        "For Several Saints" => [
            "en" => "For Several Saints",
            "it" => "Per più Santi",
            "lat" => "Pro pluribus Sanctos"
        ],
        "Dedication of a Church" => [
            "en" => "Dedication of a Church",
            "it" => "Dedicazione di una Chiesa",
            "lat" => "Dedicationis Ecclesiæ"
        ],
        "or" => [
            "en" => "or",
            "it" => "oppure",
            "lat" => "vel"
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

        if( $messages !== null ) {
            $this->messages = array_merge( self::MESSAGES, $messages );
        }
    }

    /**
     * Translation function __()
     * Returns the translated string
     */
    public function __( $key, $locale = null ) {
        if( $locale === null ) {
            $locale = $this->LOCALE;
        }
        $lcl = strtolower( $locale );
        if ( isset( $this->messages[$key] ) ) {
            if ( isset( $this->messages[$key][$lcl] ) ) {
                return $this->messages[$key][$lcl];
            } else {
                return $this->messages[$key]["en"];
            }
        } else {
            return $key;
        }
    }

    /**
     * Translation function _e()
     * Echos out the translated string
     */

    public function _e( $key, $locale = null ) {
        if( $locale === null ) {
            $locale = $this->LOCALE;
        }
        $lcl = strtolower( $locale );
        if ( isset( $this->messages[$key] ) ) {
            if ( isset( $this->messages[$key][$lcl] ) ) {
                echo $this->messages[$key][$lcl];
            } else {
                echo $this->messages[$key]["en"];
            }
        } else {
            echo $key;
        }
    }

    /**
     * Function _C
     * Gets a translated human readable string with the Common or the Proper
     */
    public function _C( $common, $locale = null ) {
        if( $locale === null ) {
            $locale = $this->LOCALE;
        }
        $locale = strtolower($locale);
        if ( $common !== "" && $common !== "Proper" ) {
            $commons = explode( ",", $common );
            $commons = array_map(function ($txt) use ($locale) {
                $commonArr = explode(":", $txt);
                $commonGeneral = $this->__($commonArr[0], $locale);
                $commonSpecific = isset($commonArr[1]) && $commonArr[1] != "" ? $this->__($commonArr[1], $locale) : "";
                //$txt = str_replace(":", ": ", $txt);
                switch ($commonGeneral) {
                    case $this->__("Blessed Virgin Mary", $locale):
                        $commonKey = "of (SING_FEMM)";
                        break;
                    case $this->__("Virgins", $locale):
                        $commonKey = "of (PLUR_FEMM)";
                        break;
                    case $this->__("Martyrs", $locale):
                    case $this->__("Pastors", $locale):
                    case $this->__("Doctors", $locale):
                    case $this->__("Holy Men and Women", $locale):
                        $commonKey = "of (PLUR_MASC)";
                        break;
                    case $this->__("Dedication of a Church", $locale):
                        $commonKey = "of (SING_FEMM)";
                        break;
                    default:
                        $commonKey = "of (SING_MASC)";
                }
                return $this->__("From the Common", $locale) . " " . $this->__($commonKey, $locale) . " " . $commonGeneral . ($commonSpecific != "" ? ": " . $commonSpecific : "");
            }, $commons);
            $common = implode("; " . $this->__("or", $locale) . " ", $commons);
        } else if ($common == "Proper") {
            $common = $this->__("Proper", $locale);
        }
        return $common;
    }

}

?>