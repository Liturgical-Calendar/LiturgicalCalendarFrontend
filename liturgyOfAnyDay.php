<?php

/**
 * liturgyOfAnyDay
 * @author John Romano D'Orazio <priest@johnromanodorazio.com>
 * @link https://litcal.johnromanodorazio.com
 */

use LiturgicalCalendar\Components\CalendarSelect;

include_once 'common.php';

$dateToday      = new DateTime();
$fmt            = new IntlDateFormatter($i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::FULL, 'UTC', IntlDateFormatter::GREGORIAN, 'MMMM');
$fmtFull        = new IntlDateFormatter($i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::NONE, 'UTC', IntlDateFormatter::GREGORIAN);
$monthDate      = new DateTime();
$CalendarSelect = new CalendarSelect(['locale' => $i18n->LOCALE, 'url' => $metadataURL]);

?><!doctype html>
<html lang="<?php echo $i18n->LOCALE; ?>">
<head>
    <title><?php echo _('General Roman Calendar') . ' - ' . _('Liturgy of any day') ?></title>
    <?php include_once('./layout/head.php'); ?>
</head>
<body>

    <?php include_once('./layout/header.php'); ?>

        <!-- Page Heading -->
        <h3 class="h3 mb-2 text-gray-800"><?php echo _('Liturgy of any day'); ?></h3>
        <div class="container">
            <div class="row">
                <div class="form-group col-md"><?php
                    echo $CalendarSelect->getSelect([
                        'class'    => 'form-select',
                        'id'       => 'calendarSelect',
                        'options'  => 'all',
                        'label'    => true,
                        'labelStr' => _('Select calendar')
                    ]);
                ?></div>
            </div>
            <div class="row">
                <div class="form-group col-md">
                    <label><?php echo _('Day'); ?></label>
                    <input class="form-control" id="dayControl" type="number" min="1" max="<?php echo $dateToday->format('t') ?>" value="<?php echo $dateToday->format('d') ?>" />
                </div>
                <div class="form-group col-md">
                    <label><?php echo _('Month'); ?></label>
                    <select class="form-select" id="monthControl">
                        <?php foreach (range(1, 12) as $monthNumber) {
                            $monthDate->setDate($dateToday->format('Y'), $monthNumber, 15);
                            $selected = '';
                            if (intval($dateToday->format('n')) === $monthNumber) {
                                $selected = 'selected';
                            }
                            echo "<option value=\"{$monthNumber}\" " . $selected . ">{$fmt->format($monthDate)}</option>";
                        }
                        ?>
                    </select>
                </div>
                <div class="form-group col-md">
                    <label><?php echo _('Year'); ?></label>
                    <input class="form-control" id="yearControl" type="number" min="1970" max="9999" value="<?php echo $dateToday->format('Y') ?>" />
                </div>
            </div>
            <div class="card shadow m-2">
                <div class="card-header py-3">
                    <h6 class="m-0 font-weight-bold text-primary"><?php
                        //translators: %s = current selected date
                        echo sprintf(_('Liturgy of %s'), '<span id="dateOfLiturgy">' . $fmtFull->format($dateToday) . '</span>');
                    ?><i class="fas fa-cross float-end text-black" style="--bs-text-opacity: .15;"></i></h6>
                </div>
                <div class="card-body" id="liturgyResults">
                </div>
            </div>
        </div>
        <?php include_once('./layout/footer.php'); ?>
        <script nomodule defer src="https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js"></script>
</body>
</html>
