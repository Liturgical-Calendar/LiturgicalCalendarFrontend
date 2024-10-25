<?php

use LiturgicalCalendar\Frontend\I18n;

include_once("vendor/autoload.php");

$i18n = new I18n();

$example = isset($_GET['example']) ? $_GET['example'] : null;
const EXAMPLES = [
    "PHP" => "examples/php/index.php",
    "JavaScript" => "examples/javascript/index.html",
    "FullCalendar" => "examples/fullcalendar/examples/month-view.html",
    "FullCalendarMessages" => "examples/fullcalendar/examples/messages.html",
];
?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php
        echo _("General Roman Calendar");
    ?></title>
    <?php include_once('layout/head.php'); ?>
</head>
<body class="sb-nav-fixed">

<?php
include_once('layout/header.php');
if (array_key_exists($example, EXAMPLES)) {
    if ("PHP" == $example) {
        include_once(EXAMPLES[$example]);
    } else {
        echo "<iframe src='" . EXAMPLES[$example] . "'></iframe>";
    }
} else {
    echo "<h1>" . sprintf(_("Example '%s' not found"), $example) . "</h1>";
}
include_once('layout/footer.php');
?>
</body>
</html>
