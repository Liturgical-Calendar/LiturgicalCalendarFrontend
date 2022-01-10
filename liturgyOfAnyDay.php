<?php

include_once("includes/i18n.php");

$i18n = new i18n();
$dateToday = new DateTime();
$fmt = new IntlDateFormatter( $i18n->LOCALE,IntlDateFormatter::FULL, IntlDateFormatter::FULL, 'UTC', IntlDateFormatter::GREGORIAN, "MMMM" );
$monthDate = new DateTime();
?>

<!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _( "General Roman Calendar") . ' - ' . _( 'Liturgy of any day' ) ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-gray-800"><?php echo _( "Liturgy of any day" ); ?></h3>
        <div class="container">
            <div class="row">
                <div class="form-group col-md">
                    <label><?php echo _("Day"); ?></label>
                    <input class="form-control" id="dayControl" type="number" min="1" max="<?php echo $dateToday->format('t') ?>" value="<?php echo $dateToday->format('d') ?>" />
                </div>
                <div class="form-group col-md">
                    <label><?php echo _("Month"); ?></label>
                    <select class="form-control" id="monthControl">
                        <?php foreach( range(1,12) as $monthNumber ) {
                            $monthDate->setDate($dateToday->format('Y'), $monthNumber, 1);
                            echo "<option value=\"{$monthNumber}\">{$fmt->format($monthDate)}</option>";
                        }
                        ?>
                    </select>
                </div>
                <div class="form-group col-md">
                    <label><?php echo _("Year"); ?></label>
                    <input class="form-control" id="yearControl" type="number" min="1970" max="9999" value="<?php echo $dateToday->format('Y') ?>" />
                </div>
            </div>
        </div>
        <?php include_once('./layout/footer.php'); ?>

</body>
</html>
