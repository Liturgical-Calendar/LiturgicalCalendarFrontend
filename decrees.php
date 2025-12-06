<?php
include_once 'includes/common.php'; // provides $i18n and all API URLs
include_once 'includes/messages.php'; // centralized translation strings
include_once 'includes/functions.php'; // helper functions including messagesPlural()

use LiturgicalCalendar\Frontend\ApiClient;

$RowAction = [
    'SetProperty'      => 'setProperty',
    'SetNameProperty'  => 'setNameProperty',
    'SetGradeProperty' => 'setGradeProperty',
    'MoveEvent'        => 'moveEvent',
    'CreateNew'        => 'createNew',
    'MakeDoctor'       => 'makeDoctor'
];

$RowActionTitle = [
    $RowAction['SetProperty']      => 'Change name or grade',
    $RowAction['SetNameProperty']  => 'Change name',
    $RowAction['SetGradeProperty'] => 'Change grade',
    $RowAction['MoveEvent']        => 'Move liturgical event',
    $RowAction['CreateNew']        => 'New liturgical event',
    $RowAction['MakeDoctor']       => 'Designate Doctor'
];

// Fetch decrees and events from API using Guzzle-based client
$apiClient = new ApiClient($i18n->LOCALE);

try {
    $decreesData   = $apiClient->fetchJsonWithKey($apiConfig->decreesUrl, 'litcal_decrees');
    $LitCalDecrees = $decreesData['litcal_decrees'];
} catch (\RuntimeException $e) {
    die('Error fetching decrees from API: ' . $e->getMessage());
}

try {
    $eventsData                = $apiClient->fetchJsonWithKey($apiConfig->eventsUrl, 'litcal_events');
    $LiturgicalEventCollection = $eventsData['litcal_events'];
} catch (\RuntimeException $e) {
    die('Error fetching events from API: ' . $e->getMessage());
}

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
    <head>
        <title><?php echo $messages['Page title - Decrees']; ?></title>
        <?php include_once('layout/head.php'); ?>
    </head>
    <body class="sb-nav-fixed">

        <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo $messages['Decrees heading']; ?></h1>
        <p class="mb-1 small"><?php echo $messages['Decrees intro']; ?></p>
        <p class="mb-1 small"><?php
            echo $messages['Decrees API endpoints'] . ' ';
            echo sprintf(
                messagesPlural('Decrees count', count($LitCalDecrees)),
                count($LitCalDecrees),
                "<a href=\"{$apiConfig->decreesUrl}\" target=\"_blank\">{$apiConfig->decreesUrl}</a>"
            );
        ?></p>
        <?php
            usort($LitCalDecrees, function ($a, $b) {
                return strtotime($a['decree_date']) <=> strtotime($b['decree_date']);
            });

            // Use a single loop to build arrays of HTML elements, then output them.
            $navItems  = [];
            $cardItems = [];

            foreach ($LitCalDecrees as $decree) {
                // Nav item
                $decreeID          = htmlspecialchars($decree['decree_id'], ENT_QUOTES, 'UTF-8');
                $decreeProtocol    = htmlspecialchars($decree['decree_protocol'], ENT_QUOTES, 'UTF-8');
                $decreeDate        = htmlspecialchars($decree['decree_date'], ENT_QUOTES, 'UTF-8');
                $decreeDescription = htmlspecialchars($decree['description'], ENT_QUOTES, 'UTF-8');
                $decreeLitEventKey = htmlspecialchars($decree['liturgical_event']['event_key'], ENT_QUOTES, 'UTF-8');
                if (false === is_int($decree['metadata']['since_year'])) {
                    throw new Exception('Decree metadata "since_year" is not an integer');
                }

                $navItems[] = "<li class=\"nav-item small border\"><a class=\"nav-link rounded-0\" href=\"#{$decreeID}\">{$decreeProtocol}\t({$decreeDate})</a></li>";

                // Card item
                if (array_key_exists('url_lang_map', $decree['metadata'])) {
                    if (array_key_exists($i18n->LOCALE, $decree['metadata']['url_lang_map'])) {
                        $decreeUrl = sprintf($decree['metadata']['url'], $decree['metadata']['url_lang_map'][$i18n->LOCALE]);
                    } elseif (array_key_exists('en', $decree['metadata']['url_lang_map'])) {
                        $decreeUrl = sprintf($decree['metadata']['url'], $decree['metadata']['url_lang_map']['en']);
                    } else {
                        $decreeUrl = sprintf($decree['metadata']['url'], array_values($decree['metadata']['url_lang_map'])[0]);
                    }
                } else {
                    $decreeUrl = $decree['metadata']['url'];
                }
                $decreeUrl = filter_var($decreeUrl, FILTER_SANITIZE_URL);
                if (false === filter_var($decreeUrl, FILTER_VALIDATE_URL, FILTER_FLAG_PATH_REQUIRED)) {
                    $decreeUrl = '#';
                }

                /**
                $existingEvent = array_find($LiturgicalEventCollection, function ($event) use ($decree) {
                    return $event['event_key'] === $decree['liturgical_event']['event_key'];
                });
                */

                $ActionCardTitle = $RowActionTitle[$decree['metadata']['action']] ?? '???';
                if ($decree['metadata']['action'] === 'setProperty') {
                    if (!isset($decree['metadata']['property'])) {
                        $errorMsg     = 'Decree data integrity error - missing "property" field for setProperty action';
                        $errorContext = [
                            'decree_id' => $decreeID,
                            'metadata'  => $decree['metadata']
                        ];
                        if (isset($logger)) {
                            $logger->error($errorMsg, $errorContext);
                        }
                        throw new \RuntimeException(
                            'Decree with action "setProperty" is missing required "property" field: ' . $decreeID
                        );
                    }
                    if ($decree['metadata']['property'] === 'name') {
                        $ActionCardTitle = $RowActionTitle[$RowAction['SetNameProperty']];
                    } elseif ($decree['metadata']['property'] === 'grade') {
                        $ActionCardTitle = $RowActionTitle[$RowAction['SetGradeProperty']];
                    }
                }

                $actionCardMessage   = $messages[$ActionCardTitle] ?? $ActionCardTitle;
                $decreeDateTimestamp = strtotime($decreeDate);
                $minYear             = $decreeDateTimestamp !== false ? (int) date('Y', $decreeDateTimestamp) : 1970;

                $cardItems[] = "<div class='card mb-3' id=\"{$decreeID}\">"
                    . "<div class='card-header'>"
                    . "<h5 class='card-title d-flex justify-content-between'><div>{$decreeProtocol}</div><div>" . $actionCardMessage . '</div></h5>'
                    . "<h6 class='card-subtitle mb-2 text-muted d-flex justify-content-between'><div>{$decreeDate}</div><div>{$decreeID}</div></h6>"
                    . '</div>'
                    . "<div class='card-body'>"
                    . "<p class='card-text'>{$decreeDescription}<a href='{$decreeUrl}' class='ms-2' target='_blank'>" . $messages['ReadDecreeLink'] . '</a></p>'
                    . '<div class="row gx-2 align-items-baseline">'
                    . '<div class="form-group col-sm-4">'
                    . "<label for='event_key_{$decreeID}' class='event_key'>" . $messages['EventKey'] . '</label>'
                    . "<input type='text' class='form-control event_key' id='event_key_{$decreeID}' value='{$decreeLitEventKey}' list='existingLiturgicalEventsList' disabled>"
                    . '</div>'
                    . '<div class="form-group col-sm-2">'
                    . "<label for='since_year_{$decreeID}' class='since_year'>" . $messages['To take effect in the year'] . '</label>'
                    . "<input type='number' class='form-control since_year' id='since_year_{$decreeID}' value='{$decree['metadata']['since_year']}' min='{$minYear}' disabled>"
                    . '</div>'
                    . '</div>'
                    . '</div>'
                    . '</div>';
            }

            echo '<nav id="decreesNavBar" class="navbar navbar-expand-lg mt-3 mb-3 p-0" style="background-color: #e3f2fd;" data-bs-theme="light">';
            echo '<ul class="nav nav-pills">' . implode('', $navItems) . '<button class="btn btn-primary btn-sm ms-3" title="' . $messages['AddDecreeButton'] . '" id="addDecreeBtn" disabled>+</button>' . '</ul>';
            echo '</nav>';

            echo '<div class="border" style="height: calc(100vh - 22rem); overflow-y: auto; box-shadow: inset 0px 0px 20px -6px rgba(0,0,0,0.3);" data-bs-spy="scroll" data-bs-target="#decreesNavBar" data-bs-root-margin="0px 0px -40%" data-bs-smooth-scroll="true">';
            echo implode('', $cardItems);
            echo '</div>';

            include_once('layout/footer.php');
            ?>

        <datalist id="existingLiturgicalEventsList">
        <?php
        foreach ($LiturgicalEventCollection as $liturgical_event) {
            echo "<option value=\"{$liturgical_event["event_key"]}\">{$liturgical_event["name"]}</option>";
        }
        ?>
        </datalist>

    </body>
</html>
