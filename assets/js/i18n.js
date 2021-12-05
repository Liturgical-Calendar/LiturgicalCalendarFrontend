if(Cookies.get("currentLocale") === undefined){
    Cookies.set("currentLocale", navigator.language );
}

var i18n = {
    LITCAL_LOCALE : Cookies.get("currentLocale").substring(0,2),
    __ : function(key, locale = LITCAL_LOCALE) {
        lcl = locale.toLowerCase();
        if (typeof messages !== 'undefined' && messages !== null && typeof messages === 'object') {
            if (messages.hasOwnProperty(key)) {
                if (messages[key].hasOwnProperty(lcl)) {
                    return messages[key][lcl];
                } else {
                    return messages[key]["en"];
                }
            } else {
                return key;
            }
        } else {
            return key;
        }
    },
    COUNTRIES : {
        "ÅLAND ISLANDS": "AX",
        "AFGHANISTAN": "AF",
        "ALBANIA": "AL",
        "ALGERIA": "DZ",
        "AMERICAN SAMOA": "AS",
        "ANDORRA": "AD",
        "ANGOLA": "AO",
        "ANGUILLA": "AI",
        "ANTARCTICA": "AQ",
        "ANTIGUA AND BARBUDA": "AG",
        "ARGENTINA": "AR",
        "ARMENIA": "AM",
        "ARUBA": "AW",
        "AUSTRALIA": "AU",
        "AUSTRIA": "AT",
        "AZERBAIJAN": "AZ",
        "BAHAMAS": "BS",
        "BAHRAIN": "BH",
        "BANGLADESH": "BD",
        "BARBADOS": "BB",
        "BELARUS": "BY",
        "BELGIUM": "BE",
        "BELIZE": "BZ",
        "BENIN": "BJ",
        "BERMUDA": "BM",
        "BHUTAN": "BT",
        "BOLIVIA, PLURINATIONAL STATE OF": "BO",
        "BONAIRE, SINT EUSTATIUS AND SABA": "BQ",
        "BOSNIA AND HERZEGOVINA": "BA",
        "BOTSWANA": "BW",
        "BOUVET ISLAND": "BV",
        "BRAZIL": "BR",
        "BRITISH INDIAN OCEAN TERRITORY": "IO",
        "BRUNEI DARUSSALAM": "BN",
        "BULGARIA": "BG",
        "BURKINA FASO": "BF",
        "BURUNDI": "BI",
        "CAMBODIA": "KH",
        "CAMEROON": "CM",
        "CANADA": "CA",
        "CAPE VERDE": "CV",
        "CAYMAN ISLANDS": "KY",
        "CENTRAL AFRICAN REPUBLIC": "CF",
        "CHAD": "TD",
        "CHILE": "CL",
        "CHINA": "CN",
        "CHRISTMAS ISLAND": "CX",
        "COCOS (KEELING) ISLANDS": "CC",
        "COLOMBIA": "CO",
        "COMOROS": "KM",
        "CONGO": "CG",
        "CONGO, THE DEMOCRATIC REPUBLIC OF THE": "CD",
        "COOK ISLANDS": "CK",
        "COSTA RICA": "CR",
        "CÔTE D'IVOIRE": "CI",
        "CROATIA": "HR",
        "CUBA": "CU",
        "CURAÇAO": "CW",
        "CYPRUS": "CY",
        "CZECH REPUBLIC": "CZ",
        "DENMARK": "DK",
        "DJIBOUTI": "DJ",
        "DOMINICA": "DM",
        "DOMINICAN REPUBLIC": "DO",
        "ECUADOR": "EC",
        "EGYPT": "EG",
        "EL SALVADOR": "SV",
        "EQUATORIAL GUINEA": "GQ",
        "ERITREA": "ER",
        "ESTONIA": "EE",
        "ETHIOPIA": "ET",
        "FALKLAND ISLANDS (MALVINAS)": "FK",
        "FAROE ISLANDS": "FO",
        "FIJI": "FJ",
        "FINLAND": "FI",
        "FRANCE": "FR",
        "FRENCH GUIANA": "GF",
        "FRENCH POLYNESIA": "PF",
        "FRENCH SOUTHERN TERRITORIES": "TF",
        "GABON": "GA",
        "GAMBIA": "GM",
        "GEORGIA": "GE",
        "GERMANY": "DE",
        "GHANA": "GH",
        "GIBRALTAR": "GI",
        "GREECE": "GR",
        "GREENLAND": "GL",
        "GRENADA": "GD",
        "GUADELOUPE": "GP",
        "GUAM": "GU",
        "GUATEMALA": "GT",
        "GUERNSEY": "GG",
        "GUINEA": "GN",
        "GUINEA-BISSAU": "GW",
        "GUYANA": "GY",
        "HAITI": "HT",
        "HEARD ISLAND AND MCDONALD ISLANDS": "HM",
        "HOLY SEE (VATICAN CITY STATE)": "VA",
        "HONDURAS": "HN",
        "HONG KONG": "HK",
        "HUNGARY": "HU",
        "ICELAND": "IS",
        "INDIA": "IN",
        "INDONESIA": "ID",
        "IRAN, ISLAMIC REPUBLIC OF": "IR",
        "IRAQ": "IQ",
        "IRELAND": "IE",
        "ISLE OF MAN": "IM",
        "ISRAEL": "IL",
        "ITALY": "IT",
        "JAMAICA": "JM",
        "JAPAN": "JP",
        "JERSEY": "JE",
        "JORDAN": "JO",
        "KAZAKHSTAN": "KZ",
        "KENYA": "KE",
        "KIRIBATI": "KI",
        "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF": "KP",
        "KOREA, REPUBLIC OF": "KR",
        "KUWAIT": "KW",
        "KYRGYZSTAN": "KG",
        "LAO PEOPLE'S DEMOCRATIC REPUBLIC": "LA",
        "LATVIA": "LV",
        "LEBANON": "LB",
        "LESOTHO": "LS",
        "LIBERIA": "LR",
        "LIBYA": "LY",
        "LIECHTENSTEIN": "LI",
        "LITHUANIA": "LT",
        "LUXEMBOURG": "LU",
        "MACAO": "MO",
        "MACEDONIA, THE FORMER YUGOSLAV REPUBLIC OF": "MK",
        "MADAGASCAR": "MG",
        "MALAWI": "MW",
        "MALAYSIA": "MY",
        "MALDIVES": "MV",
        "MALI": "ML",
        "MALTA": "MT",
        "MARSHALL ISLANDS": "MH",
        "MARTINIQUE": "MQ",
        "MAURITANIA": "MR",
        "MAURITIUS": "MU",
        "MAYOTTE": "YT",
        "MEXICO": "MX",
        "MICRONESIA, FEDERATED STATES OF": "FM",
        "MOLDOVA, REPUBLIC OF": "MD",
        "MONACO": "MC",
        "MONGOLIA": "MN",
        "MONTENEGRO": "ME",
        "MONTSERRAT": "MS",
        "MOROCCO": "MA",
        "MOZAMBIQUE": "MZ",
        "MYANMAR": "MM",
        "NAMIBIA": "NA",
        "NAURU": "NR",
        "NEPAL": "NP",
        "NETHERLANDS": "NL",
        "NEW CALEDONIA": "NC",
        "NEW ZEALAND": "NZ",
        "NICARAGUA": "NI",
        "NIGER": "NE",
        "NIGERIA": "NG",
        "NIUE": "NU",
        "NORFOLK ISLAND": "NF",
        "NORTHERN MARIANA ISLANDS": "MP",
        "NORWAY": "NO",
        "OMAN": "OM",
        "PAKISTAN": "PK",
        "PALAU": "PW",
        "PALESTINE, STATE OF": "PS",
        "PANAMA": "PA",
        "PAPUA NEW GUINEA": "PG",
        "PARAGUAY": "PY",
        "PERU": "PE",
        "PHILIPPINES": "PH",
        "PITCAIRN": "PN",
        "POLAND": "PL",
        "PORTUGAL": "PT",
        "PUERTO RICO": "PR",
        "QATAR": "QA",
        "RÉUNION": "RE",
        "ROMANIA": "RO",
        "RUSSIAN FEDERATION": "RU",
        "RWANDA": "RW",
        "SAINT BARTHÉLEMY": "BL",
        "SAINT HELENA, ASCENSION AND TRISTAN DA CUNHA": "SH",
        "SAINT KITTS AND NEVIS": "KN",
        "SAINT LUCIA": "LC",
        "SAINT MARTIN (FRENCH PART)": "MF",
        "SAINT PIERRE AND MIQUELON": "PM",
        "SAINT VINCENT AND THE GRENADINES": "VC",
        "SAMOA": "WS",
        "SAN MARINO": "SM",
        "SAO TOME AND PRINCIPE": "ST",
        "SAUDI ARABIA": "SA",
        "SENEGAL": "SN",
        "SERBIA": "RS",
        "SEYCHELLES": "SC",
        "SIERRA LEONE": "SL",
        "SINGAPORE": "SG",
        "SINT MAARTEN (DUTCH PART)": "SX",
        "SLOVAKIA": "SK",
        "SLOVENIA": "SI",
        "SOLOMON ISLANDS": "SB",
        "SOMALIA": "SO",
        "SOUTH AFRICA": "ZA",
        "SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS": "GS",
        "SOUTH SUDAN": "SS",
        "SPAIN": "ES",
        "SRI LANKA": "LK",
        "SUDAN": "SD",
        "SURINAME": "SR",
        "SVALBARD AND JAN MAYEN": "SJ",
        "SWAZILAND": "SZ",
        "SWEDEN": "SE",
        "SWITZERLAND": "CH",
        "SYRIAN ARAB REPUBLIC": "SY",
        "TAIWAN, PROVINCE OF CHINA": "TW",
        "TAJIKISTAN": "TJ",
        "TANZANIA, UNITED REPUBLIC OF": "TZ",
        "THAILAND": "TH",
        "TIMOR-LESTE": "TL",
        "TOGO": "TG",
        "TOKELAU": "TK",
        "TONGA": "TO",
        "TRINIDAD AND TOBAGO": "TT",
        "TUNISIA": "TN",
        "TURKEY": "TR",
        "TURKMENISTAN": "TM",
        "TURKS AND CAICOS ISLANDS": "TC",
        "TUVALU": "TV",
        "UGANDA": "UG",
        "UKRAINE": "UA",
        "UNITED ARAB EMIRATES": "AE",
        "UNITED KINGDOM": "GB",
        "UNITED STATES": "US",
        "UNITED STATES MINOR OUTLYING ISLANDS": "UM",
        "URUGUAY": "UY",
        "USA": "US",
        "UZBEKISTAN": "UZ",
        "VANUATU": "VU",
        "VENEZUELA, BOLIVARIAN REPUBLIC OF": "VE",
        "VIET NAM": "VN",
        "VIRGIN ISLANDS, BRITISH": "VG",
        "VIRGIN ISLANDS, U.S.": "VI",
        "WALLIS AND FUTUNA": "WF",
        "WESTERN SAHARA": "EH",
        "YEMEN": "YE",
        "ZAMBIA": "ZM",
        "ZIMBABWE": "ZW"
    }
}
Object.freeze(i18n);

(function ($) {
    const { LITCAL_LOCALE } = i18n;
    let languageNames = new Intl.DisplayNames([LITCAL_LOCALE], {type: 'language'});
    $(document).ready(function(){
      $('#langChoicesDropdown').text( languageNames.of(LITCAL_LOCALE) );
      $('#langChoiceEnglish').text( languageNames.of('en') );
      $('#langChoiceFrench').text( languageNames.of('fr') );
      $('#langChoiceGerman').text( languageNames.of('de') );
      $('#langChoiceItalian').text( languageNames.of('it') );
      $('#langChoiceSpanish').text( languageNames.of('es') );
      $('#langChoicePortuguese').text( languageNames.of('pt') );
      $('#langChoiceLatin').text( languageNames.of('lat') );
      $(document).on( 'click', '#langChoicesDropdownItems .dropdown-item', ev => {
        ev.preventDefault();
        //let oldLocale = Cookies.get('currentLocale');
        switch( $(ev.currentTarget).attr('id') ){
            case 'langChoiceEnglish':
                Cookies.set('currentLocale','en');
                break;
            case 'langChoiceFrench':
                Cookies.set('currentLocale','fr');
                break;
            case 'langChoiceGerman':
                Cookies.set('currentLocale','de');
                break;
            case 'langChoiceItalian':
                Cookies.set('currentLocale','it');
                break;
            case 'langChoiceSpanish':
                Cookies.set('currentLocale','es');
                break;
            case 'langChoicePortuguese':
                Cookies.set('currentLocale','pt');
                break;
            case 'langChoiceLatin':
                Cookies.set('currentLocale','lat');
                break;
        }
        //only reload if the value has changed
        if(Cookies.get('currentLocale') != LITCAL_LOCALE){
            location.reload();
        }
      });
    });
})(jQuery);
