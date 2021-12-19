<?php

/**
 * Define our translation strings
*/
include_once("includes/i18n.php");
$i18n = new i18n();
$formatStr = '<a href=\"%s\">%s</a> - ';
$DONJOHN_A = sprintf( $formatStr,
    'https://www.johnromanodorazio.com',
    'John Romano D\'Orazio'
);
$DONJOHN_B = _( 'Priest in the Diocese of Rome, self-taught programmer, author of the BibleGet Project' );
$DONJOHN = $DONJOHN_A . $DONJOHN_B;

$MIKETRUSO_A = sprintf( $formatStr,
    'https://www.miketruso.com/',
    'Mike Truso'
);
$MIKETRUSO_B = _( 'Software Developer based in St. Paul, MN (USA), Co-Founder at JobPost, Senior Software Engineer at Agile Orbit, founder of the St. Isidore Guild for Catholic IT Professionals' );
$MIKETRUSO = $MIKETRUSO_A . $MIKETRUSO_B;

$MICHAELSHELTON_A = sprintf( $formatStr,
    'https://www.linkedin.com/in/michaelrshelton/',
    'Michael Shelton'
);
$MICHAELSHELTON_B = _( 'Full stack web developer' );
$MICHAELSHELTON = $MICHAELSHELTON_A . $MICHAELSHELTON_B;


$ABOUT_US = _( "The Liturgical Calendar project is curated by a group of volunteer catholic programmers, seeking to serve the Church." );
?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "Liturgical Calendar - About us") ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-gray-800"><?php echo _( "Liturgical Calendar - About us"); ?></h1>
        <p><?php echo $ABOUT_US; ?></p>

        <div class="row">
            <div class="col-md-6">
                <div class="card border-left-success shadow m-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="row no-gutters align-items-center">
                                    <div class="col-auto mr-2"><img class="img-profile rounded-circle mx-auto img-fluid" src="./assets/img/donjohn_125x125.jpg"></div>
                                    <div class="col"><?php echo $DONJOHN ?></div>
                                </div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-cross fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-left-success shadow m-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="row no-gutters align-items-center">
                                    <div class="col-auto mr-2"><img class="img-profile rounded-circle mx-auto img-fluid" src="./assets/img/miketruso_125x125.jpg"></div>
                                    <div class="col"><?php echo $MIKETRUSO ?></div>
                                </div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-code fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card border-left-success shadow m-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="row no-gutters align-items-center">
                                    <div class="col-auto mr-2"><img class="img-profile rounded-circle mx-auto img-fluid" src="./assets/img/michaelshelton_125x125.jpg"></div>
                                    <div class="col"><?php echo $MICHAELSHELTON ?></div>
                                </div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-code fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-left-success shadow m-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="row no-gutters align-items-center">
                                    <div class="col-auto mr-2"><img class="img-profile rounded-circle mx-auto img-fluid" src="./assets/img/easter-egg-5-120-279148.png"></div>
                                    <div class="col"><?php echo _( "ANOTHERVOLUNTEER") ?></div>
                                </div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-code fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

    <?php include_once('./layout/footer.php'); ?>

</body>
</html>
