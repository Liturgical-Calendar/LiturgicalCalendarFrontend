<?php

function ordinal($number) {
    $ends = array('th','st','nd','rd','th','th','th','th','th','th');
    if ((($number % 100) >= 11) && (($number%100) <= 13))
        return $number. 'th';
    else
        return $number. $ends[$number % 10];
}

function __($key)
{
    global $messages;
    global $LOCALE;
    $lcl = strtolower($LOCALE);
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

function _e($key)
{
    global $messages;
    global $LOCALE;
    $lcl = strtolower($LOCALE);
    if (isset($messages)) {
        if (isset($messages[$key])) {
            if (isset($messages[$key][$lcl])) {
                echo $messages[$key][$lcl];
            } else {
                echo $messages[$key]["en"];
            }
        } else {
            echo $key;
        }
    } else {
        echo $key;
    }
}

$messages = [
    'Date of Easter from 1583 to 9999' => [
        "en" => "Date of Easter from 1583 to 9999",
        "it" => "Data della Pasqua dal 1583 al 9999",
        "la" => "Diem Paschae a MDLXXXIII ad I&#773;X&#773;CMXCIX"
    ],
    "Go back" => [
        "en" => "Go back",
        "it" => "Torna indietro",
        "la" => "Reverte"
    ],
    "Easter Day Calculation in PHP (Years in which Julian and Gregorian easter coincide are marked in yellow)" => [
        "en" => "Easter Day Calculation in PHP (Years in which Julian and Gregorian easter coincide are marked in yellow)",
        "it" => "Calcolo del Giorno della Pasqua usando PHP (marcati in giallo gli anni nei quali coincide la pasqua giuliana con quella gregoriana)",
        "la" => "Computatio Diei Paschae cum PHP (notati sunt in flavo anni quibus coincidit Pascha gregoriana cum Pascha Iuliana)"
    ],
    "Note how they gradually drift further apart, then from the year 2698 there is a gap until 4102 (1404 years); again a gap from 4197 to 5006 (809 years); from 5096 to 5902 (806 years); after 6095 there are no more coincidences until the end of the calculable year 9999" => [
        "en" => "Note how they gradually drift further apart, then from the year 2698 there is a gap until 4102 (1404 years); again a gap from 4197 to 5006 (809 years); from 5096 to 5902 (806 years); after 6095 there are no more coincidences until the end of the calculable year 9999",
        "it" => "Da notare il graduale distanziamento, poi dall'anno 2698 c'è un vuoto fino al 4102 (1404 anni); di nuovo un vuoto dal 4197 al 5006 (809 anni); dal 5096 al 5902 (806 anni); dopo il 6095 non ci sono più coincidenze registrate fino all'ultimo anno calcolabile 9999",
        "la" => "Nota intervallum crescente, post annum 2698 vacuum est usque ad anno 4102 (anni 1404); rursus vacuum est post annum 4197 usque ad anno 5006 (anni 809); post annum 5096 usque ad anno 5902 (anni 806); post annum 6095 non accidunt usque ad finem calendarii computabilis in anno 9999"
    ],
    "Gregorian Easter" => [
        "en" => "Gregorian Easter",
        "it" => "Pasqua Gregoriana",
        "la" => "Pascha Gregoriana"
    ],
    "Julian Easter" => [
        "en" => "Julian Easter",
        "it" => "Pasqua Giuliana",
        "la" => "Pascha Iuliana"
    ],
    "Julian Easter in Gregorian Calendar" => [
        "en" => "Julian Easter in Gregorian Calendar",
        "it" => "Pasqua Giuliana nel Calendario Gregoriano",
        "la" => "Pascha Iuliana in Calendario Gregoriano"
    ],
    "Century" => [
        "en" => "Century",
        "it" => "Secolo",
        "la" => "Saeculum"
    ],
    "Sunday" => [
        "en" => "Sunday",
        "it" => "Domenica",
        "la" => "Dies Domini"
    ]
];

$monthsLatin = [
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

function integerToRoman($integer) {
    // Convert the integer into an integer (just to make sure)
    $integer = intval($integer);
    $result = '';
    
    // Create a lookup array that contains all of the Roman numerals.
    $lookup = array(
        'X&#773;'           => 10000,
        'I&#773;X&#773;'    => 9000,
        'V&#773;'           => 5000,
        'I&#773;V&#773;'    => 4000,
        'M'                 => 1000,
        'CM'                => 900,
        'D'                 => 500,
        'CD'                => 400,
        'C'                 => 100,
        'XC'                => 90,
        'L'                 => 50,
        'XL'                => 40,
        'X'                 => 10,
        'IX'                => 9,
        'V'                 => 5,
        'IV'                => 4,
        'I'                 => 1
    );
    
    foreach($lookup as $roman => $value){
        // Determine the number of matches
        $matches = intval($integer/$value);
        
        // Add the same number of characters to the string
        $result .= str_repeat($roman,$matches);
        
        // Set the integer to be the remainder of the integer and the value
        $integer = $integer % $value;
    }
    
    // The Roman numeral should be built, return it
    return $result;
}
