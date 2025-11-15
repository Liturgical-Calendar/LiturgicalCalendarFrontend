<?php

include_once('common.php');

$example = isset($_GET['example']) ? $_GET['example'] : null;
$h2      = _('Liturgical Calendar as an HTML table produced by Javascript');

$JAVASCRIPT_EXAMPLE_CONTENTS = <<<EOT
<form id="litcalForm">
    <div class="row mb-4" id="calendarOptions">
        <h2>{$h2}</h2>
    </div>
</form>
<div id="litcalWebcalendar"></div>
<table id="LitCalMessages">
<thead></thead>
<tbody></tbody>
</table>
<script type="module" src="examples/javascript/main.js"></script>
EOT;

$FULLCALENDAR_MESSAGES_FIRST = <<<EOT
<table id="LitCalMessages">
    <thead></thead>
    <tbody></tbody>
</table>

<div id='calendar'></div>
EOT;

$FULLCALENDAR_CALENDAR_FIRST = <<<EOT
<div id='calendar'></div>

<table id="LitCalMessages">
    <thead></thead>
    <tbody></tbody>
</table>
EOT;

$FULLCALENDAR_EXAMPLE_CONTENTS = <<<EOT
<div id="spinnerWrapper">
    <div class="lds-roller">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
    </div>
</div>

<header>
    <div id="calendarOptions" class="row mb-4"></div>
</header>

{INTERPOLATE}

<script type="importmap">
    {
        "imports": {
            "@fullcalendar/core": "https://cdn.skypack.dev/@fullcalendar/core@6.1.15",
            "@fullcalendar/core/": "https://cdn.skypack.dev/@fullcalendar/core@6.1.15/",
            "@fullcalendar/daygrid": "https://cdn.skypack.dev/@fullcalendar/daygrid@6.1.15",
            "@fullcalendar/list": "https://cdn.skypack.dev/@fullcalendar/list@6.1.15",
            "@fullcalendar/bootstrap5": "https://cdn.skypack.dev/@fullcalendar/bootstrap5@6.1.15",
            "@liturgical-calendar/components-js": "https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@1.3.1/+esm"
        }
    }
</script>
<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/latest/js.cookie.min.js"
    integrity="sha512-iewyUmLNmAZBOOtFnG+GlGeGudYzwDjE1SX3l9SWpGUs0qJTzdeVgGFeBeU7/BIyOZdDy6DpILikEBBvixqO9Q=="
    crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script type="module" src="examples/fullcalendar/script.js"></script>
EOT;

$EXAMPLES = [
    'PHP'                  => 'examples/php/index.php',
    'JavaScript'           => $JAVASCRIPT_EXAMPLE_CONTENTS,
    'FullCalendar'         => strtr($FULLCALENDAR_EXAMPLE_CONTENTS, [
        '{INTERPOLATE}' => $FULLCALENDAR_CALENDAR_FIRST
    ]),
    'FullCalendarMessages' => strtr($FULLCALENDAR_EXAMPLE_CONTENTS, [
        '{INTERPOLATE}' => $FULLCALENDAR_MESSAGES_FIRST
    ])
];
?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php
        echo _('General Roman Calendar');
    ?></title>
    <?php
    include_once('layout/head.php');
    // Since JavaScript is not an iframe, we need to ensure the CSS is loaded
    if ($example) {
        switch ($example) {
            case 'JavaScript':
                echo '<link rel="stylesheet" href="examples/javascript/styles.css">';
                break;
            case 'FullCalendar':
            case 'FullCalendarMessages':
                echo '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">';
                echo '<link href="examples/fullcalendar/styles.css" rel="stylesheet" />';
                break;
            case 'PHP':
                echo '<link href="examples/php/styles.css" rel="stylesheet" />';
                break;
        }
    }
    ?>
</head>
<body class="sb-nav-fixed">

<?php
include_once('layout/header.php');
if (array_key_exists($example, $EXAMPLES)) {
    switch ($example) {
        case 'PHP':
            include_once($EXAMPLES[$example]);
            break;
        case 'JavaScript':
        case 'FullCalendar':
        case 'FullCalendarMessages':
            echo $EXAMPLES[$example];
            break;
    }
} else {
    echo '<h1>' . sprintf(_("Example '%s' not found"), $example) . '</h1>';
}
include_once('layout/footer.php');
?>
</body>
</html>
