<!doctype html><?php

include_once("includes/I18n.php");
include_once("vendor/autoload.php");

use LiturgicalCalendar\Components\CalendarSelect;

$i18n = new I18n();
$CalendarSelect = new CalendarSelect(["locale" => $i18n->LOCALE]);
$API_DESCRIPTION = _("A Liturgical Calendar API from which you can retrieve data for the Liturgical events of any given year from 1970 onwards, whether for the Universal or General Roman Calendar or for derived National and Diocesan calendars");

$isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false || strpos($_SERVER['HTTP_HOST'], "localhost") !== false );
//$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
$calSubscriptionURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/calendar?returntype=ICS";

?>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _("General Roman Calendar") . ' - ' . _('Examples') ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _("Example usage of the API"); ?></h3>

        <div class="accordion" id="examplesOfUsage">
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#webCalendar" aria-expanded="true" aria-controls="webCalendar">
                        <i class="fas fa-calendar"></i>&nbsp;<?php echo _("Web calendar"); ?>
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
                                        <p><?php echo _("HTML presentation elaborated by PHP using a CURL request"); ?></p>
                                        <div class="text-center"><a href="examples/php/" class="btn btn-primary"><?php echo _("View PHP Example"); ?></a></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">JavaScript<i class="fab fa-js float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _("HTML presentation elaborated by JAVASCRIPT using an AJAX request"); ?></p>
                                        <div class="text-center"><a href="examples/javascript/" class="btn btn-primary"><?php echo _("View JavaScript Example"); ?></a></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Calendar"); ?><i class="far fa-calendar float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _("FullCalendar representation elaborated by JAVASCRIPT using an AJAX request"); ?></p>
                                        <div class="text-center"><a href="examples/fullcalendar/examples/month-view.html" class="btn btn-primary"><?php echo _("View FullCalendar"); ?></a></div>
                                        <div class="text-center"><a href="examples/fullcalendar/examples/messages.html" class="btn btn-primary mt-2"><?php echo _("View FullCalendar (messages first)"); ?></a></div>
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
                        <i class="far fa-calendar-plus"></i>&nbsp;<?php echo _("Calendar subscription"); ?>
                    </button>
                </h2>
                <div id="calSubscription" class="collapse hide" aria-labelledby="headingCalSubscription" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="row">
                                    <div class="form-group col-md">
                                        <?php echo $CalendarSelect->getSelect([
                                            'class'    => 'form-select',
                                            'id'       => 'calendarSelect',
                                            'options'  => 'all',
                                            'label'    => true,
                                            'labelStr' => _("Select calendar")
                                        ]); ?>
                                    </div>
                                </div>
                                <p><?php echo _("Calendar subscription URL"); ?></p>
                                <div class="text-center bg-light border border-info rounded p-2" role="button" title="Click to copy to the clipboard!" id="calSubscriptionURLWrapper"><code id="calSubscriptionURL"><?php echo $calSubscriptionURL; ?></code><i class="fas fa-clipboard float-end text-info"></i></div>
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
                                        echo "<p>" . _("Click on the link above to copy it the clipboard.") . "</p>";
                                        echo "<p>" . sprintf(_("Navigate to %s."), "<a href=\"https://calendar.google.com\" target=\"_blank\">https://calendar.google.com</a> ") . "</p>";
                                        echo "<p>" . _("At the bottom left corner of the screen, next to Other calendars, click on the + icon to add a new calendar, and choose <i><b>From URL</b></i>.") . "</p>";
                                        echo "<p>" . _("Paste in the URL that you copied earlier.") . "</p>";
                                        echo "<p>" . _("Once subscribed, your calendar will be populated with the events from the subscription URL.") . "</p>";
                                        echo "<p>" . _("Google Calendar will poll the calendar URL every 8 hours.") . "</p>";
                                        echo "<p>" . _("Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.") . "</p>";
                                        echo "<p>" . _("You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.") . "</p>";
                                        echo "<p>" . _("Once the calendar has been added from a desktop, it will become available for the same Gmail account on the Google Calendar app on a smartphone.") . "</p>";
                                    ?>
                                    </div>
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom" id="iphone" role="tabpanel" aria-labelledby="iphone-tab">
                                    <?php
                                        echo "<p>" . _("Click on the link above to copy it the clipboard.") . "</p>";
                                        echo "<p>" . _("Go to <i><b>Phone Settings → Accounts → Add account → Other → Add Calendar</b></i>.");
                                        echo "<p>" . _("Paste in the URL that you copied earlier.") . "</p>";
                                        echo "<p>" . _("Once subscribed, your calendar will be populated with the events from the subscription URL.") . "</p>";
                                        echo "<p>" . _("The iPhone Calendar app will poll the calendar URL based on the settings at <i><b>Phone Settings → Accounts → Fetch New Data → Fetch</b></i>.") . "</p>";
                                        echo "<p>" . _("Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.") . "</p>";
                                        echo "<p>" . _("You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.") . "</p>";
                                    ?>
                                    </div>
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom" id="android" role="tabpanel" aria-labelledby="android-tab">
                                    <?php
                                        echo "<p>" . sprintf(_("If you have not yet added the calendar subscription from the desktop version of Google Calendar, please do so now (see %s)."), '<a href="#gcal">Google Calendar</a>') . "</p>";
                                        echo "<p>" . _("Open the Google Calendar app.") . "</p>";
                                        echo "<p>" . _("Go to <i><b>Settings</b></i>, then under the account which you used for the Desktop version, click on the Calendar subscription name.") . "</p>";
                                        echo "<p>" . _("Make sure <i><b>Synchronization</b></i> is turned on.");
                                        echo "<p>" . _("Once subscribed, your calendar will be populated with the events from the subscription URL.") . "</p>";
                                        echo "<p>" . _("Google Calendar will poll the calendar URL every 8 hours.") . "</p>";
                                        echo "<p>" . _("Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.") . "</p>";
                                        echo "<p>" . _("You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.") . "</p>";
                                    ?>

                                    </div>
                                    <div class="tab-pane fade p-4 border-left border-right border-bottom" id="msoutlook" role="tabpanel" aria-labelledby="msoutlook-tab">
                                    <?php
                                        echo "<i class=\"small\">(" . _("tested with Outlook 2013") . ")</i>";
                                        echo "<p>" . _("Click on the link above to copy it the clipboard.") . "</p>";
                                        echo "<p>" . _("At the bottom of the screen, switch from Email view to Calendar view.") . "</p>";
                                        echo "<p>" . _("On the ribbon of the Home menu item, click on <i><b>Open calendar → From the internet</b></i>.") . "</p>";
                                        echo "<p>" . _("Paste in the URL that you copied earlier.") . "</p>";
                                        echo "<p>" . _("On the following screen, check the checkbox along the lines of \"Poll this calendar in the interval suggested by the creator\".") . "</p>";
                                        echo "<p>" . _("Outlook Calendar should now poll the calendar URL once a day.") . "</p>";
                                        echo "<p>" . _("Once subscribed, your calendar will be populated with the events from the subscription URL.") . "</p>";
                                        echo "<p>" . _("Make sure the Calendar is created in the Other calendars folder; if you find it under the Personal calendars folder, drag it and drop it onto the Other calendars folder, so as to ensure that it is treated as a subscription internet calendar.") . "</p>";
                                        echo "<p>" . _("You can manually fetch new data by clicking on <i><b>Send/receive all</b></i> (from the SEND/RECEIVE menu item).") . "</p>";
                                        echo "<p>" . _("Outlook Calendar supports a minimal amount of HTML in the event description, so the event descriptions provided by the subscription URL are a little bit more \"beautified\" for Outlook.") . "</p>";
                                        echo "<p>" . _("Since you have made a subscription, any updates in the Liturgical Calendar API will be propagated to your subscription.") . "</p>";
                                        echo "<p>" . _("You will only see events for the current year. On the first day of a new year however, new events will be created automatically for the new year.") . "</p>";
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
                        <i class="fas fa-egg"></i>&nbsp;<?php echo _("Dates of Easter"); ?>
                    </button>
                </h2>
                <div id="datesOfEaster" class="collapse" aria-labelledby="headingTwo" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="col-md-6">
                            <div class="card shadow m-2">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Calculation of the Date of Easter"); ?>: Example interface<i class="fas fa-poll-h float-end fa-2x text-light"></i></h6>
                                </div>
                                <div class="card-body">
                                    <p><?php echo _("Example display of the date of Easter from 1583 to 9999"); ?></p>
                                    <div class="text-center"><a href="easter.php" class="btn btn-primary m-2"><?php echo _("Calculate the Date of Easter"); ?></a></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button bg-light collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#liturgyOfTheDay" aria-expanded="false" aria-controls="liturgyOfTheDay">
                        <i class="fas fa-calendar-day"></i>&nbsp;<?php echo _("Liturgy of the Day"); ?>
                    </button>
                </h2>
                <div id="liturgyOfTheDay" class="collapse" aria-labelledby="headingThree" data-bs-parent="#examplesOfUsage">
                    <div class="accordion-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Alexa News Brief"); ?><i class="fab fa-amazon float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _("Daily news brief with the liturgy of the day, as an Amazon Alexa skill"); ?></p>
                                        <div class="text-center">
                                            <a href="https://www.amazon.com/dp/B08PW27RCH" class="btn btn-primary" target="_blank" title="four feeds to choose from, according to timezone within the USA. The calendar is the national liturgical calendar for the United States">Liturgy of the Day (USA)</a>
                                        </div>
                                        <div class="text-center">
                                            <a href="https://www.amazon.it/dp/B08PZ67XHY" class="btn btn-primary mt-2" target="_blank" title="unico feed con il calendario liturgico nazionale per l'Italia">Liturgia del Giorno (Italia)</a>
                                        </div>
                                        <div class="text-center">
                                            <a href="https://www.amazon.it/dp/B08PZCF5RX" class="btn btn-primary mt-2" target="_blank" title="unico feed con il calendario liturgico specifico della Diocesi di Roma">Liturgia del Giorno (Diocesi di Roma)</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">Alexa interactive skill<i class="fab fa-amazon float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _("In development"); ?></p>
                                    </div>
                                </div>
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">Google Assistant app<i class="fab fa-google float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _("In development"); ?></p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Liturgy of any day"); ?><i class="fas fa-church float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _("For example, you can find the liturgy of the day from the day of your baptism."); ?></p>
                                        <div class="text-center"><a href="liturgyOfAnyDay.php" class="btn btn-primary m-2"><?php echo _("Liturgy of any day"); ?></a></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    <?php include_once('./layout/footer.php'); ?>

</body>
</html>
