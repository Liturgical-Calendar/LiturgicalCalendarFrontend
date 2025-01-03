<?php

include_once('common.php');

$example = isset($_GET['example']) ? $_GET['example'] : null;
$h2 = _('Liturgical Calendar as an HTML table produced by Javascript');

$JAVASCRIPT_EXAMPLE_CONTENTS = <<<EOT
<form id="litcalForm">
    <div class="row mb-4" id="calendarOptions">
        <h2>{$h2}</h2>
    </div>
</form>
<div id="litcalWebcalendar"></div>
<script type="module" src="examples/javascript/main.js"></script>
EOT;

$EXAMPLES = [
    "PHP" => "examples/php/index.php",
    "JavaScript" => $JAVASCRIPT_EXAMPLE_CONTENTS,
    "FullCalendar" => "examples/fullcalendar/examples/month-view.html",
    "FullCalendarMessages" => "examples/fullcalendar/examples/messages.html",
];
?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php
        echo _("General Roman Calendar");
    ?></title>
    <?php include_once('layout/head.php');
    switch ($example) {
        case "JavaScript":
            echo '<link rel="stylesheet" href="examples/javascript/styles.css">';
            break;
    }
    ?>
</head>
<body class="sb-nav-fixed">

<?php
include_once('layout/header.php');
if (array_key_exists($example, $EXAMPLES)) {
    switch ($example) {
        case "PHP":
            include_once($EXAMPLES[$example]);
            break;
        case "JavaScript":
            echo $EXAMPLES[$example];
            break;
        case "FullCalendar":
        case "FullCalendarMessages":
            echo "<iframe src='" . $EXAMPLES[$example] . "' style='width: 100%; height: 100vh;'></iframe>";
            break;
    }
} else {
    echo "<h1>" . sprintf(_("Example '%s' not found"), $example) . "</h1>";
}
include_once('layout/footer.php');
?>
</body>
</html>
