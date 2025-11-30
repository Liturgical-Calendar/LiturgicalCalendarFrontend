<?php

use LiturgicalCalendar\Components\CalendarSelect;

include_once 'includes/common.php';

$CalendarSelect = new CalendarSelect(['locale' => $i18n->LOCALE]);

$messages = [
    /** translators: notification title */
    'Success'                  => _('Success'),
    /** translators: notification title */
    'Error'                    => _('Error'),
    /** translators: notification message */
    'Copy not supported'       => _('Copy not supported'),
    /** translators: notification message */
    'URL copied to clipboard'  => _('URL was copied to the clipboard'),
    /** translators: notification message */
    'Failed to copy URL'       => _('Failed to copy URL to clipboard'),
    /** translators: notification message */
    'Select and copy manually' => _('Please select and copy manually'),
];

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php
        /** translators: part of page title - refers to the Catholic liturgical calendar */
        echo _('General Roman Calendar') . ' - ';
        /** translators: part of page title - section showing usage examples */
        echo _('Examples');
    ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php
            /** translators: main page heading for the API usage examples page */
            echo _('Example usage of the API');
        ?></h3>

        <div class="accordion" id="examplesOfUsage">
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#webCalendar" aria-expanded="true" aria-controls="webCalendar">
                        <i class="fas fa-calendar"></i>&nbsp;<?php
                            /** translators: accordion section header - examples of web-based calendar displays */
                            echo _('Web calendar');
                        ?>
                    </button>
                </h2>
                <div id="webCalendar" class="collapse show" aria-labelledby="headingOne" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">PHP<i class="fab fa-php float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: description of PHP example - explains it uses a specific npm/composer package */
                                            echo _('HTML presentation elaborated by PHP using the `@liturgical-calendar/components` package');
                                        ?></p>
                                        <div class="text-center"><a href="examples.php?example=PHP" class="btn btn-primary"><?php
                                            /** translators: button text to view the PHP code example */
                                            echo _('View PHP Example');
                                        ?></a></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">JavaScript<i class="fab fa-js float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: description of JavaScript example - explains it uses a specific ESM module */
                                            echo _('HTML presentation elaborated by JavaScript using the `@liturgical-calendar/components-js` ESM module');
                                        ?></p>
                                        <div class="text-center"><a href="examples.php?example=JavaScript" class="btn btn-primary"><?php
                                            /** translators: button text to view the JavaScript code example */
                                            echo _('View JavaScript Example');
                                        ?></a></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php
                                            /** translators: card header for FullCalendar example */
                                            echo _('Calendar');
                                        ?><i class="far fa-calendar float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: description of FullCalendar example - FullCalendar is a JavaScript library name */
                                            echo _('FullCalendar representation elaborated by JavaScript using the `@liturgical-calendar/components-js` ESM module');
                                        ?></p>
                                        <div class="text-center"><a href="examples.php?example=FullCalendar" class="btn btn-primary"><?php
                                            /** translators: button text to view the FullCalendar example */
                                            echo _('View FullCalendar');
                                        ?></a></div>
                                        <div class="text-center"><a href="examples.php?example=FullCalendarMessages" class="btn btn-primary mt-2"><?php
                                            /** translators: button text for FullCalendar variant that shows messages/notifications first */
                                            echo _('View FullCalendar (messages first)');
                                        ?></a></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button bg-light collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#calSubscription" aria-expanded="false" aria-controls="calSubscription">
                        <i class="far fa-calendar-plus"></i>&nbsp;<?php
                            /** translators: accordion section header - subscribing to the calendar via iCal/ICS URL */
                            echo _('Calendar subscription');
                        ?>
                    </button>
                </h2>
                <div id="calSubscription" class="collapse hide" aria-labelledby="headingCalSubscription" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="row">
                                    <div class="form-group col-md"><?php
                                    /** translators: label for dropdown to select which calendar to subscribe to */
                                    echo $CalendarSelect
                                        ->class('form-select')
                                        ->id('calendarSelect')
                                        ->label(true)
                                        ->labelText(_('Select calendar'))
                                        ->getSelect();
                                    ?></div>
                                </div>
                                <p class="mt-2 mb-1"><?php
                                    /** translators: label above the iCal/ICS subscription URL */
                                    echo _('Calendar subscription URL');
                                ?></p>
                                <div class="text-center bg-light border border-info rounded p-2" role="button"
                                     title="<?php
                                        /** translators: tooltip for clickable URL - instructs user to click to copy */
                                        echo _('Click to copy to the clipboard!');
                                     ?>" id="calSubscriptionUrlWrapper">
                                     <code id="calSubscriptionUrl"><?php echo $apiConfig->calSubscriptionUrl; ?></code>
                                     <i class="fas fa-clipboard float-end text-info"></i>
                                </div>
                                <ul class="nav nav-tabs mt-4" role="tablist">
                                    <li class="nav-item">
                                        <button class="nav-link active" id="gcal-tab" data-bs-toggle="tab" data-bs-target="#gcal" role="tab" aria-controls="gcal" aria-selected="true"><i class="fab fa-google me-2"></i>&nbsp;Google Calendar</button>
                                    </li>
                                    <li class="nav-item">
                                        <button class="nav-link" id="iphone-tab" data-bs-toggle="tab" data-bs-target="#iphone" role="tab" aria-controls="iphone" aria-selected="false"><i class="fab fa-apple me-2"></i>&nbsp;iPhone</button>
                                    </li>
                                    <li class="nav-item">
                                        <button class="nav-link" id="android-tab" data-bs-toggle="tab" data-bs-target="#android" role="tab" aria-controls="android" aria-selected="false"><i class="fab fa-android me-2"></i>&nbsp;Android</button>
                                    </li>
                                    <li class="nav-item">
                                        <button class="nav-link" id="msoutlook-tab" data-bs-toggle="tab" data-bs-target="#msoutlook" role="tab" aria-controls="msoutlook" aria-selected="false"><i class="fab fa-microsoft me-2"></i>&nbsp;Microsoft Outlook</button>
                                    </li>
                                </ul>
                                <div class="tab-content" id="myTabContent">
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom show active" id="gcal" role="tabpanel" aria-labelledby="gcal-tab">
                                    <?php
                                        /** translators: instruction step for calendar subscription - clicking to copy URL */
                                        echo '<p>' . _('Click on the link above to copy it to the clipboard.') . '</p>';
                                        /** translators: instruction step - %s is replaced with a link to calendar.google.com */
                                        echo '<p>' . sprintf(_('Navigate to %s.'), '<a href="https://calendar.google.com" target="_blank">https://calendar.google.com</a>') . '</p>';
                                        /** translators: instruction step for Google Calendar - describes UI location */
                                        echo '<p>' . _('At the bottom left corner of the screen, next to Other calendars, click on the + icon to add a new calendar, and choose <i><b>From URL</b></i>.') . '</p>';
                                        /** translators: instruction step - pasting the copied URL */
                                        echo '<p>' . _('Paste in the URL that you copied earlier.') . '</p>';
                                        /** translators: explanation of what happens after subscribing */
                                        echo '<p>' . _('Once subscribed, your calendar will be populated with the events from the subscription URL.') . '</p>';
                                        /** translators: info about Google Calendar's polling frequency */
                                        echo '<p>' . _('Google Calendar will poll the calendar URL every 8 hours.') . '</p>';
                                        /** translators: explanation about automatic updates via subscription */
                                        echo '<p>' . _('Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.') . '</p>';
                                        /** translators: explanation about yearly calendar refresh behavior */
                                        echo '<p>' . _('You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.') . '</p>';
                                        /** translators: info about cross-device availability for Google Calendar */
                                        echo '<p>' . _('Once the calendar has been added from a desktop, it will become available for the same Gmail account on the Google Calendar app on a smartphone.') . '</p>';
                                    ?>
                                    </div>
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom" id="iphone" role="tabpanel" aria-labelledby="iphone-tab">
                                    <?php
                                        /** translators: instruction step for calendar subscription - clicking to copy URL */
                                        echo '<p>' . _('Click on the link above to copy it to the clipboard.') . '</p>';
                                        /** translators: instruction step for iPhone - describes Settings menu path */
                                        echo '<p>' . _('Go to <i><b>Phone Settings → Accounts → Add account → Other → Add Calendar</b></i>.') . '</p>';
                                        /** translators: instruction step - pasting the copied URL */
                                        echo '<p>' . _('Paste in the URL that you copied earlier.') . '</p>';
                                        /** translators: explanation of what happens after subscribing */
                                        echo '<p>' . _('Once subscribed, your calendar will be populated with the events from the subscription URL.') . '</p>';
                                        /** translators: info about iPhone Calendar's polling frequency settings location */
                                        echo '<p>' . _('The iPhone Calendar app will poll the calendar URL based on the settings at <i><b>Phone Settings → Accounts → Fetch New Data → Fetch</b></i>.') . '</p>';
                                        /** translators: explanation about automatic updates via subscription */
                                        echo '<p>' . _('Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.') . '</p>';
                                        /** translators: explanation about yearly calendar refresh behavior */
                                        echo '<p>' . _('You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.') . '</p>';
                                    ?>
                                    </div>
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom" id="android" role="tabpanel" aria-labelledby="android-tab">
                                    <?php
                                        /** translators: instruction for Android - %s is a link to the Google Calendar tab; prerequisite step */
                                        echo '<p>' . sprintf(_('If you have not yet added the calendar subscription from the desktop version of Google Calendar, please do so now (see %s).'), '<a href="#gcal">Google Calendar</a>') . '</p>';
                                        /** translators: instruction step for Android */
                                        echo '<p>' . _('Open the Google Calendar app.') . '</p>';
                                        /** translators: instruction step for Android - describes app Settings navigation */
                                        echo '<p>' . _('Go to <i><b>Settings</b></i>, then under the account which you used for the Desktop version, click on the Calendar subscription name.') . '</p>';
                                        /** translators: instruction step for Android - enabling sync */
                                        echo '<p>' . _('Make sure <i><b>Synchronization</b></i> is turned on.') . '</p>';
                                        /** translators: explanation of what happens after subscribing */
                                        echo '<p>' . _('Once subscribed, your calendar will be populated with the events from the subscription URL.') . '</p>';
                                        /** translators: info about Google Calendar's polling frequency */
                                        echo '<p>' . _('Google Calendar will poll the calendar URL every 8 hours.') . '</p>';
                                        /** translators: explanation about automatic updates via subscription */
                                        echo '<p>' . _('Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.') . '</p>';
                                        /** translators: explanation about yearly calendar refresh behavior */
                                        echo '<p>' . _('You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.') . '</p>';
                                    ?>

                                    </div>
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom" id="msoutlook" role="tabpanel" aria-labelledby="msoutlook-tab">
                                    <?php
                                        /** translators: note about which Outlook version was tested */
                                        echo '<i class="small">(' . _('tested with Outlook 2013') . ')</i>';
                                        /** translators: instruction step for calendar subscription - clicking to copy URL */
                                        echo '<p>' . _('Click on the link above to copy it to the clipboard.') . '</p>';
                                        /** translators: instruction step for Outlook - switching views */
                                        echo '<p>' . _('At the bottom of the screen, switch from Email view to Calendar view.') . '</p>';
                                        /** translators: instruction step for Outlook - describes ribbon menu navigation */
                                        echo '<p>' . _('On the ribbon of the Home menu item, click on <i><b>Open calendar → From the internet</b></i>.') . '</p>';
                                        /** translators: instruction step - pasting the copied URL */
                                        echo '<p>' . _('Paste in the URL that you copied earlier.') . '</p>';
                                        /** translators: instruction step for Outlook - checkbox option for polling interval */
                                        echo '<p>' . _('On the following screen, check the checkbox along the lines of "Poll this calendar in the interval suggested by the creator".') . '</p>';
                                        /** translators: info about Outlook Calendar's polling frequency */
                                        echo '<p>' . _('Outlook Calendar should now poll the calendar URL once a day.') . '</p>';
                                        /** translators: explanation of what happens after subscribing */
                                        echo '<p>' . _('Once subscribed, your calendar will be populated with the events from the subscription URL.') . '</p>';
                                        /** translators: instruction for Outlook - ensuring calendar is in correct folder for internet subscription */
                                        echo '<p>' . _('Make sure the Calendar is created in the Other calendars folder; if you find it under the Personal calendars folder, drag it and drop it onto the Other calendars folder, so as to ensure that it is treated as a subscription internet calendar.') . '</p>';
                                        /** translators: instruction for Outlook - how to manually refresh data */
                                        echo '<p>' . _('You can manually fetch new data by clicking on <i><b>Send/receive all</b></i> (from the SEND/RECEIVE menu item).') . '</p>';
                                        /** translators: info about Outlook's HTML support in event descriptions */
                                        echo '<p>' . _('Outlook Calendar supports a minimal amount of HTML in the event description, so the event descriptions provided by the subscription URL are a little bit more "beautified" for Outlook.') . '</p>';
                                        /** translators: explanation about automatic updates via subscription */
                                        echo '<p>' . _('Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.') . '</p>';
                                        /** translators: explanation about yearly calendar refresh behavior */
                                        echo '<p>' . _('You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.') . '</p>';
                                    ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button bg-light collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#datesOfEaster" aria-expanded="false" aria-controls="datesOfEaster">
                        <i class="fas fa-egg"></i>&nbsp;<?php
                            /** translators: accordion section header - Easter date calculation tool */
                            echo _('Dates of Easter');
                        ?>
                    </button>
                </h2>
                <div id="datesOfEaster" class="collapse" aria-labelledby="headingTwo" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="col-md-6">
                            <div class="card shadow m-2">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary"><?php
                                        /** translators: card header for Easter calculation tool */
                                        echo _('Calculation of the Dates of Easter');
                                        /** translators: subtitle after card header - describes the example UI */
                                        echo ': ' . _('Example interface');
                                    ?><i class="fas fa-poll-h float-end fa-2x text-light"></i></h6>
                                </div>
                                <div class="card-body">
                                    <p><?php
                                        /** translators: description of Easter date calculation range - 1583 is when Gregorian calendar started */
                                        echo _('Example display of the date of Easter from 1583 to 9999');
                                    ?></p>
                                    <div class="text-center"><a href="easter.php" class="btn btn-primary m-2"><?php
                                        /** translators: button text to go to Easter date calculator */
                                        echo _('Calculate the Dates of Easter');
                                    ?></a></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button bg-light collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#liturgyOfTheDay" aria-expanded="false" aria-controls="liturgyOfTheDay">
                        <i class="fas fa-calendar-day"></i>&nbsp;<?php
                            /** translators: accordion section header - daily liturgy information and apps */
                            echo _('Liturgy of the Day');
                        ?>
                    </button>
                </h2>
                <div id="liturgyOfTheDay" class="collapse" aria-labelledby="headingThree" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php
                                            /** translators: card header - Amazon Alexa flash briefing skill */
                                            echo _('Alexa News Brief');
                                        ?><i class="fab fa-amazon float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: description of Alexa skill - flash briefing format */
                                            echo _('Daily news brief with the liturgy of the day, as an Amazon Alexa skill');
                                        ?></p>
                                        <div class="text-center">
                                            <a href="https://www.amazon.com/dp/B08PW27RCH" class="btn btn-primary" target="_blank" title="<?php
                                                /** translators: tooltip for USA Alexa skill - explains timezone options */
                                                echo _('Four feeds to choose from, according to timezone within the USA. The calendar is the national liturgical calendar for the United States.');
                                            ?>">Liturgy of the Day (USA)</a>
                                        </div>
                                        <div class="text-center">
                                            <a href="https://www.amazon.it/dp/B08PZ67XHY" class="btn btn-primary mt-2" target="_blank" title="<?php
                                                /** translators: tooltip for Italy Alexa skill - single feed with national calendar */
                                                echo _('Single feed with the national liturgical calendar for Italy.');
                                            ?>">Liturgia del Giorno (Italia)</a>
                                        </div>
                                        <div class="text-center">
                                            <a href="https://www.amazon.it/dp/B08PZCF5RX" class="btn btn-primary mt-2" target="_blank" title="<?php
                                                /** translators: tooltip for Rome Diocese Alexa skill - specific to Diocese of Rome */
                                                echo _('Single feed with the liturgical calendar specific to the Diocese of Rome.');
                                            ?>">Liturgia del Giorno (Diocesi di Roma)</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php
                                            /** translators: card header - Amazon Alexa conversational skill (not flash briefing) */
                                            echo _('Alexa interactive skill');
                                        ?><i class="fab fa-amazon float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: status indicator for features not yet available */
                                            echo _('In development');
                                        ?></p>
                                    </div>
                                </div>
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php
                                            /** translators: card header - Google Assistant voice application */
                                            echo _('Google Assistant app');
                                        ?><i class="fab fa-google float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: status indicator for features not yet available */
                                            echo _('In development');
                                        ?></p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php
                                            /** translators: card header - tool to look up liturgy for any date */
                                            echo _('Liturgy of any day');
                                        ?><i class="fas fa-church float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php
                                            /** translators: example use case for the liturgy lookup tool */
                                            echo _('For example, you can find the liturgy of the day from the day of your baptism.');
                                        ?></p>
                                        <div class="text-center"><a href="liturgyOfAnyDay.php" class="btn btn-primary m-2"><?php
                                            /** translators: button text to go to liturgy lookup page */
                                            echo _('Liturgy of any day');
                                        ?></a></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    <script>
        const Messages = <?php echo json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    </script>
    <?php include_once('./layout/footer.php'); ?>

</body>
</html>
