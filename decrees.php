<?php
include_once "common.php"; // provides $i18n and all API URLs

$messages = [
    /**translators: label of the form row */
    "New festivity"      => _("New festivity"),
    /**translators: label of the form row */
    "Change name or grade" => _("Change name or grade"),
    /**translators: label of the form row */
    "Change name"        => _("Change name"),
    /**translators: label of the form row */
    "Change grade"       => _("Change grade"),
    /**translators: label of the form row */
    "Move festivity"     => _("Move festivity"),
    /**translators: label of the form row */
    "Designate Doctor"   => _("Designate Doctor of the Church"),
];

$RowAction = [
    "SetProperty"       => 'setProperty',
    "SetNameProperty"   => 'setNameProperty',
    "SetGradeProperty"  => 'setGradeProperty',
    "MoveFestivity"     => 'moveFestivity',
    "CreateNew"         => 'createNew',
    "MakeDoctor"        => 'makeDoctor'
];

$RowActionTitle = [
    $RowAction["SetProperty"]       => 'Change name or grade',
    $RowAction["SetNameProperty"]   => 'Change name',
    $RowAction["SetGradeProperty"]  => 'Change grade',
    $RowAction["MoveFestivity"]     => 'Move festivity',
    $RowAction["CreateNew"]         => 'New festivity',
    $RowAction["MakeDoctor"]        => 'Designate Doctor'
];

[ "litcal_decrees" => $LitCalDecrees ] = json_decode(
    file_get_contents($decreesURL),
    true
);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $eventsURL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept-Language: " . $i18n->LOCALE
]);
$response = curl_exec($ch);

[ "litcal_events" => $FestivityCollection ] = json_decode(
    $response,
    true
);
curl_close($ch);

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
    <head>
        <title><?php echo _("General Roman Calendar - Decrees") ?></title>
        <?php include_once('layout/head.php'); ?>
    </head>
    <body class="sb-nav-fixed">

        <?php include_once('layout/header.php'); ?>

        <!-- Page Heading -->
        <h1 class="h3 mb-2 text-black" style="--bs-text-opacity: .6;"><?php echo _("Refine the General Roman Calendar with Decrees of the Congregation for Divine Worship"); ?></h1>
        <p class="mb-4"><?php echo _("The Liturgical Calendar is based off of both pubished Roman Missals, and Decrees of the Congregation for Divine Worship. These Decrees can refine the data from the Roman Missals, adding or removing or changing liturgical events, or instructing on how to handle any possible coincidences between mandatory celebrations."); ?></p>
        <p class="mb-4"><?php
            echo _("Data for <b>Roman Missals</b> is handled by the <code>/missals</code> endpoint of the API.") . " ";
            echo _("Data for <b>Decrees</b> is handled by the <code>/decrees</code> endpoint of the API.") . " ";
            echo sprintf(
                _("Currently, these endpoints are read-only. Here is the current data as read from %s:"),
                "<a href=\"{$decreesURL}\" target=\"_blank\">{$decreesURL}</a>"
            );
        ?></p>
        <?php
            usort($LitCalDecrees, function($a, $b) {
                return strtotime($a['decree_date']) <=> strtotime($b['decree_date']);
            });

            foreach ($LitCalDecrees as $decree) {
                if (array_key_exists('url_lang_map', $decree['metadata'])) {
                    if (array_key_exists($i18n->LOCALE, $decree['metadata']['url_lang_map'])) {
                        $decree['url'] = $decree['metadata']['urls_langs'][$i18n->LOCALE];
                    } else {
                        $decree['url'] = $decree['metadata']['urls_langs']['en'];
                    }
                } else {
                    $decree['url'] = $decree['metadata']['url'];
                }

                // When defining a new festivity for the first time, $existingFestivity will be null.
                // However, once the decree is applied, the festivity will be added to the collection.
                // So we can use this to check if the festivity already exists in the collection, in all cases, when reading from the API.
                $existingFestivity = array_find($FestivityCollection, function($event) use ($decree) {
                    return $event['event_key'] === $decree['festivity']['event_key'];
                });

                $ActionCard = "<div class='card mb-3'>";
                $ActionCard .= "<div class='card-header'>";
                $ActionCardTitle = $RowActionTitle[$decree['metadata']['action']] ?? '???';
                if ($decree['metadata']['action'] === 'setProperty') {
                    if ($decree['metadata']['property'] === 'name') {
                        $ActionCardTitle = $RowActionTitle[$RowAction['SetNameProperty']];
                    }
                    elseif ($decree['metadata']['property'] === 'grade') {
                        $ActionCardTitle = $RowActionTitle[$RowAction['SetGradeProperty']];
                    }
                }
                $ActionCard .= "<h5 class='card-title'>{$ActionCardTitle}</h5>";
                $ActionCard .= "<h6 class='card-subtitle mb-2 text-muted'>{$decree['decree_id']}</h6>";
                $ActionCard .= "</div>"; // close card-header
                $ActionCard .= "<div class='card-body'>";
                $ActionCard .= "<div class=\"row gx-2 align-items-baseline\">";
                $ActionCard .= "<div class=\"form-group col-sm-4\">";
                $ActionCard .= "<label for='event_key_{$decree['decree_id']}' class='event_key'>Event Key</label>";
                $ActionCard .= "<input type='text' class='form-control event_key' id='event_key_{$decree['decree_id']}' value='{$decree['festivity']['event_key']}' list='existingFestivitiesList'>";
                $ActionCard .= "</div>"; // close form-group
                $ActionCard .= "<div class=\"form-group col-sm-2\">";
                $ActionCard .= "<label for='since_year_{$decree['decree_id']}' class='since_year'>To take effect in the year</label>";
                $ActionCard .= "<input type='number' class='form-control since_year' id='since_year_{$decree['decree_id']}' value='{$decree['metadata']['since_year']}' min='" . (int)date('Y', strtotime($decree['decree_date'])) . "'>";
                $ActionCard .= "</div>"; // close form-group
                $ActionCard .= "</div>"; // close row
                $ActionCard .= "</div>"; // close card-body
                $ActionCard .= "</div>"; // close card

                echo "<div class='card mb-3'>";
                echo "<div class='card-header'>";
                echo "<h5 class='card-title'>{$decree['decree_protocol']}</h5>";
                echo "<h6 class='card-subtitle mb-2 text-muted'>{$decree['decree_date']}</h6>";
                echo "</div>";
                echo "<div class='card-body'>";
                echo "<p class='card-text'>{$decree['description']}</p>";
                echo "<p class='card-text'><a href='{$decree['url']}' class='btn btn-primary' target='_blank'>" . _("Read the Decree") . "</a></p>";
                echo $ActionCard;
                echo "</div>";
                echo "</div>";
            }
        ?>

        <?php include_once('layout/footer.php'); ?>

        <datalist id="existingFestivitiesList">
        <?php
        foreach ($FestivityCollection as $festivity) {
            echo "<option value=\"{$festivity["event_key"]}\">{$festivity["name"]}</option>";
        }
        ?>
        </datalist>

    </body>
</html>
