<?php

namespace LiturgicalCalendar\Frontend;

class Utilities
{
    /**
     * Format a number as an ordinal, e.g. 1st, 2nd, 3rd, etc.
     *
     * @param int $number The number to format as an ordinal
     * @return string The ordinal string
     */
    public static function ordinal($number)
    {
        $ends = array('th','st','nd','rd','th','th','th','th','th','th');
        if ((($number % 100) >= 11) && (($number % 100) <= 13)) {
            return $number . 'th';
        } else {
            return $number . $ends[$number % 10];
        }
    }

    /**
     * Returns a string representation of the given number in Roman numerals.
     *
     * The method uses a lookup array to match the given number to the
     * correct Roman numeral. It then builds the Roman numeral string by
     * repeating the correct Roman numeral characters the correct number of
     * times.
     *
     * @param int $number The number to convert to a Roman numeral
     *
     * @return string The Roman numeral representation of the given number
     */
    public static function romanNumeral(int $number)
    {
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

        $result = '';
        foreach ($lookup as $roman => $value) {
            // Determine the number of matches
            $matches = intval($number / $value);

            // Add the same number of characters to the string
            $result .= str_repeat($roman, $matches);

            // Set the integer to be the remainder of the integer and the value
            $number = $number % $value;
        }

        // The Roman numeral should be built, return it
        return $result;
    }

    private static $formatStr = '<a href=%s>%s</a> - ';

    /**
     * Return an associative array with information about a person.
     * The following are the keys in the associative array:
     * - website: the website of the person
     * - note: a short description of the person
     * - img: the path to an image of the person
     * - icon: a Bootstrap icon class to be used to represent the person
     *
     * @param string $who the name of the person for which to return the information
     * @return array an associative array with the information about the person
     */
    private static function getCardInfo(string $who)
    {
        $cards = [
            "DONJOHN" => [
                "website"   => sprintf(Utilities::$formatStr, 'https://www.johnromanodorazio.com', 'John Romano D\'Orazio'),
                "note"      => _('Priest in the Diocese of Rome, self-taught programmer, author of the BibleGet Project'),
                "img"       => "./assets/img/donjohn_125x125.jpg",
                "icon"      => "fas fa-cross fa-2x text-black"
            ],
            "MIKETRUSO" => [
                "website"   => sprintf(Utilities::$formatStr, 'https://www.miketruso.com/', 'Mike Truso'),
                "note"      => _('Software Developer based in St. Paul, MN (USA), Co-Founder at JobPost, Senior Software Engineer at Agile Orbit, founder of the St. Isidore Guild for Catholic IT Professionals'),
                "img"       => "./assets/img/miketruso_125x125.jpg",
                "icon"      => "fas fa-code fa-2x text-black"
            ],
            "MICHAELSHELTON" => [
                "website"   => sprintf(Utilities::$formatStr, 'https://www.linkedin.com/in/michaelrshelton/', 'Michael Shelton'),
                "note"      => _('Full stack web developer'),
                "img"       => "./assets/img/michaelshelton_125x125.jpg",
                "icon"      => "fas fa-code fa-2x text-black"
            ],
            "STEVENVANROODE" => [
                "website"   => sprintf(Utilities::$formatStr, 'https://www.latijnseliturgie.nl/', 'Steven van Roode'),
                "note"      => _('Latin Liturgy Association of the Netherlands, contributed the national calendar for the Netherlands to this project with all related translations'),
                "img"       => "./assets/img/Steven van Roode 125x125.jpg",
                "icon"      => "fas fa-music fa-2x text-black"
            ]
        ];
        return $cards[$who];
    }

    /**
     * Generate a Bootstrap card with the information of a contributor
     *
     * @param string $who The contributor for which we want to generate the card
     * @return void
     */
    public static function generateCard(string $who): void
    {
        $cardInfo = self::getCardInfo($who);
        echo "<div class=\"col-md-6\">
            <div class=\"card border-3 border-top-0 border-bottom-0 border-end-0 border-primary shadow m-2\">
                <div class=\"card-body\">
                    <div class=\"row no-gutters align-items-center\">
                        <div class=\"col mr-2\">
                            <div class=\"row no-gutters align-items-center\">
                                <div class=\"col-auto mr-2\"><img class=\"img-profile rounded-circle mx-auto img-fluid\" src=\"" . $cardInfo["img"] . "\"></div>
                                <div class=\"col\">" . $cardInfo["website"] . $cardInfo["note"] . "</div>
                            </div>
                        </div>
                        <div class=\"col-auto\">
                            <i class=\"" . $cardInfo["icon"] . "\" style=\"--bs-text-opacity: .15;\"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>";
    }

    /**
     * Verifies that the user is authenticated using HTTP Basic Authentication.
     *
     * The $users parameter should be an associative array where the key is the
     * username and the value is the hashed password (using password_hash()).
     *
     * @param array $users An associative array of usernames and hashed passwords.
     * @return bool True if the user is authenticated, false otherwise.
     */
    public static function authenticated(array $users = [])
    {
        if (!isset($_SERVER['PHP_AUTH_USER']) || !isset($_SERVER['PHP_AUTH_PW'])) {
            return false;
        }
        if (array_key_exists($_SERVER['PHP_AUTH_USER'], $users) && password_verify($_SERVER['PHP_AUTH_PW'], $users[$_SERVER['PHP_AUTH_USER']])) {
            return true;
        }
        return false;
    }

    /**
     * Generates the modal body for the modals that use the "Choose from existing festivities" input.
     *
     * @param bool $hasPropertyChange Whether the modal needs to have the property to change select input.
     */
    public static function generateModalBody(bool $hasPropertyChange = false): void
    {
        $modalBody = "<div class=\"modal-body\">
        <form class=\"row justify-content-left needs-validation\" novalidate>
            <div class=\"form-group col col-md-10\">
                <label for=\"existingFestivityName\" class=\"fw-bold\">" . _("Choose from existing festivities") . ":</label>
                <input list=\"existingFestivitiesList\" class=\"form-control existingFestivityName\" id=\"existingFestivityName\" required>
                <div class=\"invalid-feedback\">" . _("This festivity does not seem to exist? Please choose from a value in the list.") . "</div>
            </div>";
        if ($hasPropertyChange) {
            $modalBody .= "<div class=\"form-group col col-md-6\">
                <label for=\"propertyToChange\" class=\"fw-bold\">" . _("Property to change") . ":</label>
                <select class=\"form-select\" id=\"propertyToChange\" name=\"propertyToChange\">
                    <option value=\"name\">" . _("Name") . "</option>
                    <option value=\"grade\">" . _("Grade") . "</option>
                </select>
            </div>";
        }
        $modalBody .= "</form></div>";
        echo $modalBody;
    }

    /**
     * A message to print after the package has been installed.
     *
     * Prints a message of thanks to God and a prayer for the Pope.
     */
    public static function postInstall(): void
    {
        printf("\t\033[4m\033[1;44mCatholic Liturgical Calendar components\033[0m\n");
        printf("\t\033[0;33mAd Majorem Dei Gloriam\033[0m\n");
        printf("\t\033[0;36mOremus pro Pontifice nostro Francisco Dominus\n\tconservet eum et vivificet eum et beatum faciat eum in terra\n\tet non tradat eum in animam inimicorum ejus\033[0m\n");
    }
}
