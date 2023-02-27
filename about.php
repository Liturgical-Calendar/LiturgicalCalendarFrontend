<?php

/**
 * Define our translation strings
*/
include_once("includes/i18n.php");
$i18n = new i18n();
$formatStr = '<a href=%s>%s</a> - ';

$cardInfo = [
    "DONJOHN" => [
        "website"   => sprintf( $formatStr, 'https://www.johnromanodorazio.com', 'John Romano D\'Orazio' ),
        "note"      => _( 'Priest in the Diocese of Rome, self-taught programmer, author of the BibleGet Project' ),
        "img"       => "./assets/img/donjohn_125x125.jpg",
        "icon"      => "fas fa-cross fa-2x text-black"
    ],
    "MIKETRUSO" => [
        "website"   => sprintf( $formatStr, 'https://www.miketruso.com/', 'Mike Truso' ),
        "note"      => _( 'Software Developer based in St. Paul, MN (USA), Co-Founder at JobPost, Senior Software Engineer at Agile Orbit, founder of the St. Isidore Guild for Catholic IT Professionals' ),
        "img"       => "./assets/img/miketruso_125x125.jpg",
        "icon"      => "fas fa-code fa-2x text-black"
    ],
    "MICHAELSHELTON" => [
        "website"   => sprintf( $formatStr, 'https://www.linkedin.com/in/michaelrshelton/', 'Michael Shelton' ),
        "note"      => _( 'Full stack web developer' ),
        "img"       => "./assets/img/michaelshelton_125x125.jpg",
        "icon"      => "fas fa-code fa-2x text-black"
    ],
    "STEVENVANROODE" => [
        "website"   => sprintf( $formatStr, 'https://www.latijnseliturgie.nl/', 'Steven van Roode' ),
        "note"      => _( 'Latin Liturgy Association of the Netherlands, contributed the national calendar for the Netherlands to this project with all related translations' ),
        "img"       => "./assets/img/Steven van Roode 125x125.jpg",
        "icon"      => "fas fa-music fa-2x text-black"
    ]
];

function generateCard( string $who ) : void {
    global $cardInfo;
    $card = "<div class=\"col-md-6\">
        <div class=\"card border-3 border-top-0 border-bottom-0 border-end-0 border-primary shadow m-2\">
            <div class=\"card-body\">
                <div class=\"row no-gutters align-items-center\">
                    <div class=\"col mr-2\">
                        <div class=\"row no-gutters align-items-center\">
                            <div class=\"col-auto mr-2\"><img class=\"img-profile rounded-circle mx-auto img-fluid\" src=\"" . $cardInfo[$who]["img"] . "\"></div>
                            <div class=\"col\">" . $cardInfo[ $who ]["website"] . $cardInfo[ $who ]["note"] . "</div>
                        </div>
                    </div>
                    <div class=\"col-auto\">
                        <i class=\"" . $cardInfo[ $who ]["icon"] . "\" style=\"--bs-text-opacity: .15;\"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>";
    echo $card;
}


$ABOUT_US = _( "The Liturgical Calendar project is curated by a group of volunteer catholic programmers, seeking to serve the Church." );
?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "Liturgical Calendar - About us") ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _( "Liturgical Calendar - About us"); ?></h1>
        <p><?php echo $ABOUT_US; ?></p>

        <div class="row">
            <?php generateCard( 'DONJOHN' ); ?>
            <?php generateCard( 'MIKETRUSO' ); ?>
        </div>

        <div class="row">
            <?php generateCard( 'MICHAELSHELTON' ); ?>
            <?php generateCard( 'STEVENVANROODE' ); ?>
        </div>

    <?php include_once('./layout/footer.php'); ?>

</body>
</html>
