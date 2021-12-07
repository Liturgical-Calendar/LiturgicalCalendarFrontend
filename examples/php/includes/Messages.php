<?php

function __($key, $locale) {
    global $messages;
    $lcl = strtolower($locale);
    if (isset($messages)) {
        if (isset($messages[$key])) {
            if (isset($messages[$key][$lcl])) {
                return $messages[$key][$lcl];
            } else {
                return $messages[$key]["en"];
            }
        } else {
            return $key;
        }
    } else {
        return $key;
    }
}


$messages = [
    "Generate Roman Calendar" => [
        "en" => "Generate Roman Calendar",
        "it" => "Genera Calendario Romano",
        "la" => "Calendarium Romanum Generare"
    ],
    "Liturgical Calendar Calculation for a Given Year" => [
        "en" => "Liturgical Calendar Calculation for a Given Year",
        "it" => "Calcolo del Calendario Liturgico per un dato anno",
        "la" => "Computus Calendarii Liturgici pro anno dedi"
    ],
    "HTML presentation elaborated by PHP using a CURL request to a %s" => [
        "en" => "HTML presentation elaborated by PHP using a CURL request to a %s",
        "it" => "Presentazione HTML elaborata con PHP usando una richiesta CURL al motore PHP %s",
        "la" => "Repræsentatio HTML elaborata cum PHP utendo petitionem CURL ad machinam PHP %s"
    ],
    "You are requesting a year prior to 1970: it is not possible to request years prior to 1970." => [
        "en" => "You are requesting a year prior to 1970: it is not possible to request years prior to 1970.",
        "it" => "Stai effettuando una richiesta per un anno che è precedente al 1970: non è possibile richiedere anni precedenti al 1970.",
        "la" => "Rogavisti annum ante 1970: non potest rogare annos ante annum 1970."
    ],
    "Customize options for generating the Roman Calendar" => [
        "en" => "Customize options for generating the Roman Calendar",
        "it" => "Personalizza le opzioni per la generazione del Calendario Romano",
        "la" => "Eligere optiones per generationem Calendarii Romani"
    ],
    "Configurations being used to generate this calendar:" => [
        "en" => "Configurations being used to generate this calendar:",
        "it" => "Configurazioni utilizzate per la generazione di questo calendario:",
        "la" => "Optiones electuus ut generare hic calendarium:"
    ],
    "Date in Gregorian Calendar" => [
        "en" => "Date in Gregorian Calendar",
        "it" => "Data nel Calendario Gregoriano",
        "la" => "Dies in Calendario Gregoriano"
    ],
    "General Roman Calendar Festivity" => [
        "en" => "General Roman Calendar Festivity",
        "it" => "Festività nel Calendario Romano Generale",
        "la" => "Festivitas in Calendario Romano Generale"
    ],
    "Grade of the Festivity" => [
        "en" => "Grade of the Festivity",
        "it" => "Grado della Festività",
        "la" => "Gradum Festivitatis"
    ],
    "YEAR" => [
        "en" => "YEAR",
        "it" => "ANNO",
        "la" => "ANNUM"
    ],
    "EPIPHANY" => [
        "en" => "EPIPHANY",
        "it" => "EPIFANIA",
        "la" => "EPIPHANIA"
    ],
    "ASCENSION" => [
        "en" => "ASCENSION",
        "it" => "ASCENSIONE",
        "la" => "ASCENSIO",
    ],
    "From the Common" => [
        "en" => "From the Common",
        "it" => "Dal Comune",
        "la" => "De Communi"
    ],
    "of (SING_MASC)" => [
        "en" => "of",
        "it" => "del",
        "la" => ""
    ],
    "of (SING_FEMM)" => [
        "en" => "of the",
        "it" => "della",
        "la" => ""
    ],
    "of (PLUR_MASC)" => [
        "en" => "of",
        "it" => "dei",
        "la" => ""
    ],
    "of (PLUR_MASC_ALT)" => [
        "en" => "of",
        "it" => "degli",
        "la" => ""
    ],
    "of (PLUR_FEMM)" => [
        "en" => "of",
        "it" => "delle",
        "la" => ""
    ],
    /*translators: in reference to the Common of the Blessed Virgin Mary */
    "Blessed Virgin Mary" => [
        "en" => "Blessed Virgin Mary",
        "it" => "Beata Vergine Maria",
        "la" => "Beatæ Virginis Mariæ"
    ],
    /*translators: all of the following are in the genitive case, in reference to "from the Common of %s" */
    "Martyrs" => [
        "en" => "Martyrs",
        "it" => "Martiri",
        "la" => "Martyrum"
    ],
    "Pastors" => [
        "en" => "Pastors",
        "it" => "Pastori",
        "la" => "Pastorum"
    ],
    "Doctors" => [
        "en" => "Doctors",
        "it" => "Dottori della Chiesa",
        "la" => "Doctorum Ecclesiæ"
    ],
    "Virgins" => [
        "en" => "Virgins",
        "it" => "Vergini",
        "la" => "Virginum"
    ],
    "Holy Men and Women" => [
        "en" => "Holy Men and Women",
        "it" => "Santi e delle Sante",
        "la" => "Sanctorum et Sanctarum"
    ],
    "For One Martyr" => [
        "en" => "For One Martyr",
        "it" => "Per un martire",
        "la" => "Pro uno martyre"
    ],
    "For Several Martyrs" => [
        "en" => "For Several Martyrs",
        "it" => "Per più martiri",
        "la" => "Pro pluribus martyribus"
    ],
    "For Missionary Martyrs" => [
        "en" => "For Missionary Martyrs",
        "it" => "Per i martiri missionari",
        "la" => "Pro missionariis martyribus"
    ],
    "For a Virgin Martyr" => [
        "en" => "For a Virgin Martyr",
        "it" => "Per una vergine martire",
        "la" => "Pro virgine martyre"
    ],
    "For Several Pastors" => [
        "en" => "For Several Pastors",
        "it" => "Per i pastori",
        "la" => "Pro Pastoribus"
    ],
    "For a Pope" => [
        "en" => "For a Pope",
        "it" => "Per i papi",
        "la" => "Pro Papa"
    ],
    "For a Bishop" => [
        "en" => "For a Bishop",
        "it" => "Per i vescovi",
        "la" => "Pro Episcopis"
    ],
    "For One Pastor" => [
        "en" => "For One Pastor",
        "it" => "Per un Pastore",
        "la" => "Pro Pastoribus"
    ],
    "For Missionaries" => [
        "en" => "For Missionaries",
        "it" => "Per i missionari",
        "la" => "Pro missionariis"
    ],
    "For One Virgin" => [
        "en" => "For One Virgin",
        "it" => "Per una vergine",
        "la" => "Pro una virgine"
    ],
    "For Several Virgins" => [
        "en" => "For Several Virgins",
        "it" => "Per più vergini",
        "la" => "Pro pluribus virginibus"
    ],
    "For Religious" => [
        "en" => "For Religious",
        "it" => "Per i religiosi",
        "la" => "Pro Religiosis"
    ],
    "For Those Who Practiced Works of Mercy" => [
        "en" => "For Those Who Practiced Works of Mercy",
        "it" => "Per gli operatori di misericordia",
        "la" => "Pro iis qui opera Misericordiæ Exercuerunt"
    ],
    "For an Abbot" => [
        "en" => "For an Abbot",
        "it" => "Per un abate",
        "la" => "Pro abbate"
    ],
    "For a Monk" => [
        "en" => "For a Monk",
        "it" => "Per un monaco",
        "la" => "Pro monacho"
    ],
    "For a Nun" => [
        "en" => "For a Nun",
        "it" => "Per i religiosi",
        "la" => "Pro moniali"
    ],
    "For Educators" => [
        "en" => "For Educators",
        "it" => "Per gli educatori",
        "la" => "Pro Educatoribus"
    ],
    "For Holy Women" => [
        "en" => "For Holy Women",
        "it" => "Per le sante",
        "la" => "Pro Sanctis Mulieribus"
    ],
    "For One Saint" => [
        "en" => "For One Saint",
        "it" => "Per un Santo",
        "la" => "Pro uno Sancto"
    ],
    "or" => [
        "en" => "or",
        "it" => "oppure",
        "la" => "vel"
    ],
    "Proper" => [
        "en" => "Proper",
        "it" => "Proprio",
        "la" => "Proprium"
    ],
    "green" => [
        "en" => "green",
        "it" => "verde",
        "la" => "viridis"
    ],
    "purple" => [
        "en" => "purple",
        "it" => "viola",
        "la" => "purpura"
    ],
    "white" => [
        "en" => "white",
        "it" => "bianco",
        "la" => "albus"
    ],
    "red" => [
        "en" => "red",
        "it" => "rosso",
        "la" => "ruber"
    ],
    "pink" => [
        "en" => "pink",
        "it" => "rosa",
        "la" => "rosea"
    ],
    "Month" => [
        "en" => "Month",
        "it" => "Mese",
        "la" => "Mensis"
    ],
    "FERIA" => [
        "en" => "<i>weekday</i>",
        "it" => "<i>feria</i>",
        "la" => "<i>feria</i>"
    ],
    "COMMEMORATION" => [
        "en" => "Commemoration",
        "it" => "Commemorazione",
        "la" => "Commemoratio"
    ],
    "OPTIONAL MEMORIAL" => [
        "en" => "Optional memorial",
        "it" => "Memoria facoltativa",
        "la" => "Memoria ad libitum"
    ],
    "MEMORIAL" => [
        "en" => "Memorial",
        "it" => "Memoria",
        "la" => "Memoria"
    ],
    "FEAST" => [
        "en" => "Feast",
        "it" => "Festa",
        "la" => "Festum"
    ],
    "FEAST OF THE LORD" => [
        "en" => "Feast of the Lord",
        "it" => "Festa del Signore",
        "la" => "Festa Domini"
    ],
    "SOLEMNITY" => [
        "en" => "Solemnity",
        "it" => "Solennità",
        "la" => "Sollemnitas"
    ],
    "HIGHER RANKING SOLEMNITY" => [
        "en" => "<i>precedence over solemnities</i>",
        "it" => "<i>precedenza sulle solennità</i>",
        "la" => "<i>præcellentia ante solemnitates</i>"
    ],
    "Information about the current calculation of the Liturgical Year" => [
        "en" => "Information about the current calculation of the Liturgical Year",
        "it" => "Informazioni sull'attuale calcolo dell'Anno Liturgico",
        "la" => "Notitiæ de computatione præsente Anni Liturgici"
    ]
];

$daysOfTheWeek = [
    "dies Solis",
    "dies Lunæ",
    "dies Martis",
    "dies Mercurii",
    "dies Iovis",
    "dies Veneris",
    "dies Saturni"
];

$months = [
    "",
    "Ianuarius",
    "Februarius",
    "Martius",
    "Aprilis",
    "Maius",
    "Iunius",
    "Iulius",
    "Augustus",
    "September",
    "October",
    "November",
    "December"
];
