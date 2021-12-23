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

        <div class="row">

            <div class="col-md-6">
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary">PHP<i class="fab fa-php float-right text-gray-600"></i></h6>
                    </div>
                    <div class="card-body">
                        <p><?php echo _( "HTML presentation elaborated by PHP using a CURL request" ); ?></p>
                        <div class="text-center"><a href="examples/php/" class="btn btn-primary"><?php echo _( "View PHP Example" ); ?></a></div>
                    </div>
                </div>
                <div class="card shadow m-2">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary">JavaScript<i class="fab fa-js float-right text-gray-600"></i></h6>
                    </div>
                    <div class="card-body">
                        <p><?php echo _( "HTML presentation elaborated by JAVASCRIPT using an AJAX request" ); ?></p>
                        <div class="text-center"><a href="examples/javascript/" class="btn btn-primary"><?php echo _( "View JavaScript Example" ); ?></a></div>
                    </div>
                </div>
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
        <!-- /.row -->

    <?php include_once('./layout/footer.php'); ?>

</body>
</html>
