<?php

use LiturgicalCalendar\Frontend\I18n;
use LiturgicalCalendar\Frontend\Utilities;

$i18n = new I18n();

$ABOUT_US = _("The Liturgical Calendar project is curated by a group of volunteer catholic programmers, seeking to serve the Church.");
?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _("Liturgical Calendar - About us") ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _("Liturgical Calendar - About us"); ?></h1>
        <p><?php echo $ABOUT_US; ?></p>

        <div class="row">
            <?php Utilities::generateCard('DONJOHN'); ?>
            <?php Utilities::generateCard('MIKETRUSO'); ?>
        </div>

        <div class="row">
            <?php Utilities::generateCard('MICHAELSHELTON'); ?>
            <?php Utilities::generateCard('STEVENVANROODE'); ?>
        </div>

    <?php include_once('./layout/footer.php'); ?>

</body>
</html>
