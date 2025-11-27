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
        $ends = ['th','st','nd','rd','th','th','th','th','th','th'];
        if (( ( $number % 100 ) >= 11 ) && ( ( $number % 100 ) <= 13 )) {
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
        $lookup = [
            'X&#773;'        => 10000,
            'I&#773;X&#773;' => 9000,
            'V&#773;'        => 5000,
            'I&#773;V&#773;' => 4000,
            'M'              => 1000,
            'CM'             => 900,
            'D'              => 500,
            'CD'             => 400,
            'C'              => 100,
            'XC'             => 90,
            'L'              => 50,
            'XL'             => 40,
            'X'              => 10,
            'IX'             => 9,
            'V'              => 5,
            'IV'             => 4,
            'I'              => 1
        ];

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


    /**
     * Format string used to format the name of a person with their website URL.
     * The first string parameter %1$s corresponds to the URL and the second
     * string parameter %2$s corresponds to the full name of the person.
     *
     * @var string
     */
    private const NAME_WITH_URL = '<a href="%1$s" target="_blank">%2$s</a>';

    /**
     * Format a string with the given URL and name, using the
     * self::NAME_WITH_URL format string.
     *
     * @param string $url the URL of the person
     * @param string $name the full name of the person
     * @return string the formatted string
     */
    private static function formatNameWithUrl(string $url, string $name)
    {
        return sprintf(self::NAME_WITH_URL, $url, $name) . ' - ';
    }

    /**
     * Return an associative array with information about a person.
     * The following are the keys in the associative array:
     * - website: the website of the person
     * - note: a short description of the person
     * - img: the path to an image of the person
     * - icon: a Bootstrap icon class to be used to represent the person
     *
     * @param string $who the name of the person for which to return the information
     * @return array<string, string> an associative array with the information about the person
     */
    private static function getCardInfo(string $who): array
    {
        $cards = [
            'DONJOHN'        => [
                'website' => Utilities::formatNameWithUrl('https://www.johnromanodorazio.com', 'John Romano D\'Orazio'),
                'note'    => sprintf(
                    /**translators: 1. BibleGet github url 2. Liturgical Calendar github url */
                    _('Priest in the Diocese of Rome, author of the <a href="%1$s" target="_blank">BibleGet project</a> and of the <a href="%2$s" target="_blank">Liturgical Calendar project</a>'),
                    'https://github.com/BibleGet-I-O',
                    'https://github.com/Liturgical-Calendar'
                ),
                'img'     => './assets/img/johndorazio_512x512.jpg',
                'icon'    => 'fa-cross'
            ],
            'MIKETRUSO'      => [
                'website' => Utilities::formatNameWithUrl('https://www.miketruso.com/', 'Mike Truso'),
                'note'    => _('Software Developer based in St. Paul, MN (USA), Co-Founder at JobPost, Senior Software Engineer at Agile Orbit, founder of the St. Isidore Guild for Catholic IT Professionals, contributed the bootstrap theming of the project website'),
                'img'     => './assets/img/miketruso_512x512.jpg',
                'icon'    => 'fa-code'
            ],
            'MICHAELSHELTON' => [
                'website' => Utilities::formatNameWithUrl('https://www.linkedin.com/in/michaelrshelton/', 'Michael Shelton'),
                'note'    => _('Full stack web developer, contributed to the generation of the Open API documentation'),
                'img'     => './assets/img/michaelshelton_512x512.jpg',
                'icon'    => 'fa-code'
            ],
            'STEVENVANROODE' => [
                'website' => Utilities::formatNameWithUrl('https://www.latijnseliturgie.nl/', 'Steven van Roode'),
                'note'    => _('Latin Liturgy Association of the Netherlands, contributed the national calendar for the Netherlands to this project with all related translations'),
                'img'     => './assets/img/stevenvanroode_512x512.jpg',
                'icon'    => 'fa-music'
            ],
            'MIKEKASBERG'    => [
                'website' => Utilities::formatNameWithUrl('https://www.mikekasberg.com/', 'Mike Kasberg'),
                'note'    => _('Senior software engineer at Strava, author of the ConfessIt app, contributed to the structuring of the JSON responses of the Liturgical Calendar API'),
                'img'     => './assets/img/mikekasberg_512x512.jpg',
                'icon'    => 'fa-code'
            ],
            'GABRIELCHOW'    => [
                'website' => Utilities::formatNameWithUrl('https://gcatholic.org/', 'Gabriel Chow'),
                'note'    => _('Software Engineer and contributor to Salt + Light Television, contributed information about the dioceses of Latin rite'),
                'img'     => './assets/img/gabrielchow_512x512.webp',
                'icon'    => 'fa-code'
            ],
            'CHRISSHERREN'   => [
                'website' => Utilities::formatNameWithUrl('https://dioceseofcharlottetown.com/priests/', 'Chris Sherren'),
                'note'    => _('Chancellor of the Diocese of Charlottetown, contributed liturgical calendar data for Canada in both English and French'),
                'img'     => './assets/img/chrissherren_504x504.jpg',
                'icon'    => 'fa-cross'
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
        echo '<div class="col-md-6">
            <div class="card border-3 border-top-0 border-bottom-0 border-end-0 border-primary shadow m-2">
                <div class="card-body">
                    <div class="row no-gutters align-items-center">
                        <div class="col mr-2">
                            <div class="row no-gutters align-items-center">
                                <div class="col-auto mr-2"><img height="125" width="125" class="img-profile rounded-circle mx-auto img-fluid" src="' . ( $cardInfo['img'] ?? './assets/img/default_125x125.jpg' ) . '"></div>
                                <div class="col">' . $cardInfo['website'] . $cardInfo['note'] . '</div>
                            </div>
                        </div>
                        <div class="col-auto">
                            <i class="fas ' . $cardInfo['icon'] . ' fa-2x text-black" style="--bs-text-opacity: .15;"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>';
    }

    /**
     * Verifies that the user is authenticated using HTTP Basic Authentication.
     *
     * The $users parameter should be an associative array where the key is the
     * username and the value is the hashed password (using password_hash()).
     *
     * @param array<string, string> $users An associative array of usernames and hashed passwords.
     * @return bool True if the user is authenticated, false otherwise.
     */
    public static function authenticated(array $users = []): bool
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
     * Generates the modal body for the modals that use the "Choose from existing liturgical events" input.
     *
     * @param bool $required Whether the liturgical event input is required to use a value from the existing liturgical events list.
     * @param bool $hasPropertyChange Whether the modal needs to have the "property to change" select input.
     */
    public static function generateModalBody(bool $required = true, bool $hasPropertyChange = false): void
    {
        $feedbackDiv = $required
            ? '<div class="invalid-feedback">' . _('This liturgical event does not seem to exist? Please choose from a value in the list.') . '</div>'
            : '<div class="form-text text-warning d-none">' . _('This liturgical event does not exist, so it will be created.') . '</div>';

        $modalBody = '<div class="modal-body">
        <form class="row justify-content-left needs-validation" novalidate>
            <div class="form-group col col-md-10">
                <label for="existingLiturgicalEventName" class="fw-bold">' . ( $required ? _('Choose from existing liturgical events') : _('Choose from existing liturgical events (or create a new one)') ) . ':</label>
                <input list="existingLiturgicalEventsList" class="form-control existingLiturgicalEventName" id="existingLiturgicalEventName"' . ( $required ? ' required' : '' ) . '>
                ' . $feedbackDiv . '
            </div>';
        if ($hasPropertyChange) {
            $modalBody .= '<div class="form-group col col-md-6">
                <label for="propertyToChange" class="fw-bold">' . _('Property to change') . ':</label>
                <select class="form-select" id="propertyToChange" name="propertyToChange">
                    <option value="name">' . _('Name') . '</option>
                    <option value="grade">' . _('Grade') . '</option>
                </select>
            </div>';
        }
        $modalBody .= '</form></div>';
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
