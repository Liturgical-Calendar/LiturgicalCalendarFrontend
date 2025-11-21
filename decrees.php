<?php
include_once 'common.php'; // provides $i18n and all API URLs

$messages = [
    /**translators: label of the form row */
    'New liturgical event'  => _('New liturgical event'),
    /**translators: label of the form row */
    'Change name or grade'  => _('Change name or grade'),
    /**translators: label of the form row */
    'Change name'           => _('Change name'),
    /**translators: label of the form row */
    'Change grade'          => _('Change grade'),
    /**translators: label of the form row */
    'Move liturgical event' => _('Move liturgical event'),
    /**translators: label of the form row */
    'Designate Doctor'      => _('Designate Doctor of the Church'),
];

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

[ 'litcal_decrees' => $LitCalDecrees ] = json_decode(
    file_get_contents($decreesURL),
    true
);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $eventsURL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept-Language: ' . $i18n->LOCALE]);
$response = curl_exec($ch);

[ 'litcal_events' => $LiturgicalEventCollection ] = json_decode(
    $response,
    true
);
curl_close($ch);

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
    <head>
        <title><?php echo _('General Roman Calendar - Decrees') ?></title>
        <?php include_once('layout/head.php'); ?>
    </head>
    <body class="sb-nav-fixed">

        <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _('Refine the General Roman Calendar with Decrees of the Dicastery for Divine Worship and the Discipline of the Sacraments'); ?></h1>
        <p class="mb-1 small"><?php echo _('The Liturgical Calendar is based off of both published Roman Missals, and Decrees of the Dicastery for Divine Worship and the Discipline of the Sacraments. These Decrees can refine the data from the Roman Missals, adding or removing or changing liturgical events, or instructing on how to handle any possible coincidences between mandatory celebrations.'); ?></p>
        <p class="mb-1 small"><?php
            echo _('Data for <b>Roman Missals</b> is handled by the <code>/missals</code> endpoint of the API, while data for <b>Decrees</b> is handled by the <code>/decrees</code> endpoint of the API.') . ' ';
            echo sprintf(
                _('Currently, these endpoints are read-only. There are currently <b>%d Decrees</b> defined at the endpoint %s.'),
                count($LitCalDecrees),
                "<a href=\"{$decreesURL}\" target=\"_blank\">{$decreesURL}</a>"
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
                        $decree['url'] = $decree['metadata']['url_lang_map'][$i18n->LOCALE];
                    } else {
                        $decree['url'] = $decree['metadata']['url_lang_map']['en'];
                    }
                } else {
                    $decree['url'] = $decree['metadata']['url'];
                }

                $existingEvent = array_find($LiturgicalEventCollection, function ($event) use ($decree) {
                    return $event['event_key'] === $decree['liturgical_event']['event_key'];
                });

                $ActionCardTitle = $RowActionTitle[$decree['metadata']['action']] ?? '???';
                if ($decree['metadata']['action'] === 'setProperty') {
                    if ($decree['metadata']['property'] === 'name') {
                        $ActionCardTitle = $RowActionTitle[$RowAction['SetNameProperty']];
                    } elseif ($decree['metadata']['property'] === 'grade') {
                        $ActionCardTitle = $RowActionTitle[$RowAction['SetGradeProperty']];
                    }
                }

                $cardItems[] = "<div class='card mb-3' id=\"{$decreeID}\">"
                    . "<div class='card-header'>"
                    . "<h5 class='card-title d-flex justify-content-between'><div>{$decreeProtocol}</div><div>" . $messages[$ActionCardTitle] . '</div></h5>'
                    . "<h6 class='card-subtitle mb-2 text-muted d-flex justify-content-between'><div>{$decreeDate}</div><div>{$decreeID}</div></h6>"
                    . '</div>'
                    . "<div class='card-body'>"
                    . "<p class='card-text'>{$decreeDescription}<a href='{$decree['url']}' class='ms-2' target='_blank'>" . _('Read the Decree') . '</a></p>'
                    . '<div class="row gx-2 align-items-baseline">'
                    . '<div class="form-group col-sm-4">'
                    . "<label for='event_key_{$decreeID}' class='event_key'>Event Key</label>"
                    . "<input type='text' class='form-control event_key' id='event_key_{$decreeID}' value='{$decreeLitEventKey}' list='existingLiturgicalEventsList' disabled>"
                    . '</div>'
                    . '<div class="form-group col-sm-2">'
                    . "<label for='since_year_{$decreeID}' class='since_year'>To take effect in the year</label>"
                    . "<input type='number' class='form-control since_year' id='since_year_{$decreeID}' value='{$decree['metadata']['since_year']}' min='" . (int) date('Y', strtotime($decreeDate)) . "' disabled>"
                    . '</div>'
                    . '</div>'
                    . '</div>'
                    . '</div>';
            }

            echo '<nav id="decreesNavBar" class="navbar navbar-expand-lg mt-3 mb-3 p-0" style="background-color: #e3f2fd;" data-bs-theme="light">';
            echo '<ul class="nav nav-pills">' . implode('', $navItems) . '<button class="btn btn-primary btn-sm ms-3" title="Add Decree" id="addDecreeBtn" disabled>+</button>' . '</ul>';
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
