<?php

include_once("includes/i18n.php");

$i18n = new i18n();

$API_DESCRIPTION = _( "A Liturgical Calendar API from which you can retrieve data for the Liturgical events of any given year from 1970 onwards, whether for the Universal or General Roman Calendar or for derived National and Diocesan calendars" );

?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "General Roman Calendar") . ' - ' . _( 'Examples' ) ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-gray-800"><?php echo _( "EXAMPLE USAGE OF THE API" ); ?></h3>

        <div class="accordion" id="examplesOfUsage">
            <div class="card">
                <div class="card-header" id="headingOne">
                    <h2 class="mb-0">
                        <button class="btn btn-link btn-block text-left" type="button" data-toggle="collapse" data-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
                            <?php echo _("Web calendar"); ?>
                        </button>
                    </h2>
                </div>
                <div id="collapseOne" class="collapse show" aria-labelledby="headingOne" data-parent="#examplesOfUsage">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">PHP<i class="fab fa-php float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "HTML presentation elaborated by PHP using a CURL request" ); ?></p>
                                        <div class="text-center"><a href="examples/php/" class="btn btn-primary"><?php echo _( "View PHP Example" ); ?></a></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">JavaScript<i class="fab fa-js float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "HTML presentation elaborated by JAVASCRIPT using an AJAX request" ); ?></p>
                                        <div class="text-center"><a href="examples/javascript/" class="btn btn-primary"><?php echo _( "View JavaScript Example" ); ?></a></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "Calendar" ); ?><i class="far fa-calendar float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "Fullcalendar representation elaborated by JAVASCRIPT using an AJAX request" ); ?></p>
                                        <div class="text-center"><a href="examples/fullcalendar/examples/month-view.html" class="btn btn-primary"><?php echo _( "View Full Calendar" ); ?></a></div>
                                        <div class="text-center"><a href="examples/fullcalendar/examples/messages.html" class="btn btn-primary mt-2"><?php echo _( "View Full Calendar (messages first)" ); ?></a></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header" id="headingTwo">
                    <h2 class="mb-0">
                        <button class="btn btn-link btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                            <?php echo _("Dates of Easter"); ?>
                        </button>
                    </h2>
                </div>
                <div id="collapseTwo" class="collapse" aria-labelledby="headingTwo" data-parent="#examplesOfUsage">
                    <div class="card-body">
                        <div class="col-md-6">
                            <div class="card shadow m-2">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary"><?php echo _( "Calculation of the Date of Easter" ); ?>: Example interface<i class="fas fa-poll-h float-right fa-2x text-gray-300"></i></h6>
                                </div>
                                <div class="card-body">
                                    <p><?php echo _( "Example display of the date of Easter from 1583 to 9999" ); ?></p>
                                    <div class="text-center"><a href="easter.php" class="btn btn-primary m-2"><?php echo _( "Calculate the Date of Easter" ); ?></a></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header" id="headingThree">
                    <h2 class="mb-0">
                        <button class="btn btn-link btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                            <?php echo _("Liturgy of the Day"); ?>
                        </button>
                    </h2>
                </div>
                <div id="collapseThree" class="collapse" aria-labelledby="headingThree" data-parent="#examplesOfUsage">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Alexa News Brief"); ?><i class="fab fa-amazon float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "Daily news brief with the liturgy of the day, as an Amazon Alexa skill" ); ?></p>
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
                                        <h6 class="m-0 font-weight-bold text-primary">Alexa interactive skill<i class="fab fa-amazon float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "In development" ); ?></p>
                                    </div>
                                </div>
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary">Google Assistant app<i class="fab fa-google float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "In development" ); ?></p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg">
                                <div class="card shadow m-2">
                                    <div class="card-header py-3">
                                        <h6 class="m-0 font-weight-bold text-primary"><?php echo _("Liturgy of any day"); ?><i class="fas fa-church float-right text-gray-600"></i></h6>
                                    </div>
                                    <div class="card-body">
                                        <p><?php echo _( "For example, you can find the liturgy of the day from the day of your baptism." ); ?></p>
                                        <div class="text-center"><a href="liturgyOfAnyDay.php" class="btn btn-primary m-2"><?php echo _( "Liturgy of any day" ); ?></a></div>
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
