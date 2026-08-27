<?php

namespace LiturgicalCalendar\Frontend;

use LiturgicalCalendar\Frontend\LitColor;
use LiturgicalCalendar\Frontend\LitCommon;
use LiturgicalCalendar\Frontend\LitGrade;

class FormControls
{
    /**
     * Liturgical colors in the order they are offered in the UI.
     *
     * LitColor::$values is keyed for validation, not for display; this is the
     * presentation order (most frequent first) shared by every color select.
     *
     * @var array<int, string>
     */
    public const COLOR_ORDER = [
        LitColor::WHITE,
        LitColor::RED,
        LitColor::PURPLE,
        LitColor::GREEN,
        LitColor::ROSE
    ];

    /**
     * Common (or Proper) values in the order they are offered in the UI.
     *
     * Unlike LitCommon::$values (a flat validation list), this keeps the
     * `General:Specific` compound keys the API expects and groups each
     * specific common directly under its general one.
     *
     * @var array<int, string>
     */
    public const COMMON_ORDER = [
        'Proper',
        'Blessed Virgin Mary',
        'Martyrs',
        'Martyrs:For One Martyr',
        'Martyrs:For Several Martyrs',
        'Martyrs:For Missionary Martyrs',
        'Martyrs:For One Missionary Martyr',
        'Martyrs:For Several Missionary Martyrs',
        'Martyrs:For a Virgin Martyr',
        'Martyrs:For a Holy Woman Martyr',
        'Pastors',
        'Pastors:For a Pope',
        'Pastors:For a Bishop',
        'Pastors:For One Pastor',
        'Pastors:For Several Pastors',
        'Pastors:For Missionaries',
        'Pastors:For Founders of a Church',
        'Pastors:For Several Founders',
        'Pastors:For One Founder',
        'Doctors',
        'Virgins',
        'Virgins:For One Virgin',
        'Virgins:For Several Virgins',
        'Holy Men and Women',
        'Holy Men and Women:For One Saint',
        'Holy Men and Women:For Several Saints',
        'Holy Men and Women:For Religious',
        'Holy Men and Women:For an Abbot',
        'Holy Men and Women:For a Monk',
        'Holy Men and Women:For a Nun',
        'Holy Men and Women:For Educators',
        'Holy Men and Women:For Holy Women',
        'Holy Men and Women:For Those Who Practiced Works of Mercy',
        'Dedication of a Church'
    ];

    /** @var array<string, bool> */
    public static array $settings = [
        'nameField'      => true,
        'dayField'       => true,
        'monthField'     => true,
        'colorField'     => true,
        'properField'    => true,
        'fromYearField'  => true,
        'untilYearField' => true
    ];

    private I18n $i18n;
    private LitCommon $LitCommon;
    private LitGrade $LitGrade;

    public function __construct(I18n $i18n)
    {
        $this->i18n      = $i18n;
        $this->LitCommon = new LitCommon($i18n->LOCALE);
        $this->LitGrade  = new LitGrade($i18n->LOCALE);
    }

    /**
     * Render and output an HTML form row for defining a liturgical event.
     *
     * Builds a Bootstrap-aligned row of form controls (name, day, month with mobile toggle,
     * proper/common selection, liturgical color, since/until years) and echoes the resulting HTML.
     * Which controls are included is determined by FormControls::$settings.
     *
     * @param string|null $title Optional header label to render above the row; if omitted no header is rendered.
     */
    public function createEventRow(?string $title = null): void
    {
        $uniqid  = uniqid();
        $formRow = '';

        if ($title !== null) {
            // Do not add data-group-title to the div, because extending.js will remove all divs with the data-group-title class
            // when resetting the form (see $(document).on('change', '#diocesanCalendarDioceseName', ...))
            // But these are supposed to be fixed and not removed, even when empty
            $formRow .= '<div class="mt-4 d-flex justify-content-left">'
                        . '<h4 class="data-group-title">'
                        . $title
                        . '</h4>'
                        . '</div>';
        }

        $formRow .= '<div class="row gx-2 align-items-baseline">';

        if (self::$settings['nameField']) {
            $formRow .= '<div class="form-group col-sm-3">' .
            "<label for=\"{$uniqid}Name\">" . _('Name') . "</label><input type=\"text\" class=\"form-control litEvent litEventName\" id=\"{$uniqid}Name\" data-valuewas=\"\" />" .
            '<div class="invalid-feedback">This same celebration was already defined elsewhere. Please remove it first where it is defined, then you can define it here.</div>' .
            '</div>';
        }

        if (self::$settings['dayField']) {
            $formRow .= '<div class="form-group col-sm-1">' .
            "<label for=\"{$uniqid}Day\">" . _('Day') . "</label><input type=\"number\" min=1 max=31 value=1 class=\"form-control litEvent litEventDay\" id=\"{$uniqid}Day\" />" .
            '</div>';
        }

        if (self::$settings['monthField']) {
            $switchTitle     = _('switch on for mobile celebration as opposed to fixed date');
            $switchDivClass  = 'form-check form-check-inline form-switch me-0 ps-5 pe-2 border border-2 border-secondary rounded bg-light';
            $switchInputAttr = 'data-bs-toggle="toggle" data-bs-size="xs" data-bs-onstyle="info" data-bs-offstyle="dark"';
            $formRow        .= '<div class="form-group col-sm-2">'
                . '<label for="' . $uniqid . 'Month" class="d-flex justify-content-between align-items-end">'
                . '<span class="month-label">' . _('Month') . '</span>'
                . '<div class="' . $switchDivClass . '" title="' . $switchTitle . '">'
                . '<label class="form-check-label" for="' . $uniqid . 'Strtotime">' . _('Mobile') . '</label>'
                . '<input class="form-check-input litEvent litEventStrtotimeSwitch" type="checkbox" '
                . $switchInputAttr . ' role="switch" id="' . $uniqid . 'Strtotime">'
                . '</div></label>'
                . '<select class="form-select litEvent litEventMonth" id="' . $uniqid . 'Month">'
                . $this->getMonthOptionsHtml();

            $formRow .= '</select>' .
            '</div>';
        }

        if (self::$settings['properField']) {
            $commonsTemplate = $this->getCommonsTemplate();
            $properField     = str_replace(['{colWidth}', '{uniqid}'], ['3', $uniqid], $commonsTemplate);
            $formRow        .= $properField;
        }

        if (self::$settings['colorField']) {
            $formRow .= '<div class="form-group col-sm-1">' .
            "<label for=\"{$uniqid}Color\">" . _('Liturgical color') . '</label>' .
            "<select class=\"form-select litEvent litEventColor\" id=\"{$uniqid}Color\" multiple=\"multiple\" size=\"1\">" .
            $this->getColorOptionsHtml([LitColor::WHITE], [LitColor::WHITE, LitColor::RED, LitColor::PURPLE, LitColor::GREEN]) .
            '</select>' .
            '</div>';
        }

        if (self::$settings['fromYearField']) {
            $formRow .= '<div class="form-group col-sm-1">' .
            "<label for=\"{$uniqid}SinceYear\">" . _('Since') . '</label>' .
            "<input type=\"number\" min=1970 max=9999 class=\"form-control litEvent litEventSinceYear\" id=\"{$uniqid}SinceYear\" value=1970 />" .
            '</div>';
        }

        if (self::$settings['untilYearField']) {
            $formRow .= '<div class="form-group col-sm-1">' .
            "<label for=\"{$uniqid}UntilYear\">" . _('Until') . '</label>' .
            "<input type=\"number\" min=1900 max=9999 class=\"form-control litEvent litEventUntilYear\" id=\"{$uniqid}UntilYear\" value=\"\" />" .
            '</div>';
        }

        $formRow .= '</div>';

        echo $formRow;
    }

    /**
     * Localized `<option>` entries for a month select (values 1-12).
     *
     * @param int|null $selected The month number (1-12) to mark as selected, or null for none.
     * @return string The `<option>` list, without the surrounding `<select>`.
     */
    public function getMonthOptionsHtml(?int $selected = null): string
    {
        $formatter = new \IntlDateFormatter($this->i18n->LOCALE, \IntlDateFormatter::FULL, \IntlDateFormatter::NONE);
        $formatter->setPattern('MMMM');
        $options = '';
        for ($i = 1; $i <= 12; $i++) {
            $month = \DateTime::createFromFormat('n j', $i . ' 15', new \DateTimeZone('UTC'));
            if ($month === false) {
                continue;
            }
            $options .= '<option value="' . $i . '"' . ( $selected === $i ? ' selected' : '' ) . '>'
                . htmlspecialchars((string) $formatter->format($month), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '</option>';
        }
        return $options;
    }

    /**
     * Localized `<option>` entries for a liturgical grade select (values 0-7).
     *
     * @param int|null $selected The grade to mark as selected, or null for none.
     * @return string The `<option>` list, without the surrounding `<select>`.
     */
    public function getGradeOptionsHtml(?int $selected = null): string
    {
        $options = '';
        foreach (LitGrade::$values as $value) {
            $options .= '<option value="' . $value . '"' . ( $selected === $value ? ' selected' : '' ) . '>'
                . htmlspecialchars($this->LitGrade->i18n($value, false), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '</option>';
        }
        return $options;
    }

    /**
     * Localized `<option>` entries for a liturgical color multi-select.
     *
     * Labels are uppercased for parity with the diocesan calendar form rows.
     *
     * @param array<int, string>      $selected Color values to mark as selected.
     * @param array<int, string>|null $colors   Colors to offer, in display order; defaults to self::COLOR_ORDER.
     * @return string The `<option>` list, without the surrounding `<select>`.
     */
    public function getColorOptionsHtml(array $selected = [], ?array $colors = null): string
    {
        $options = '';
        foreach ($colors ?? self::COLOR_ORDER as $color) {
            $options .= '<option value="' . $color . '"' . ( in_array($color, $selected, true) ? ' selected' : '' ) . '>'
                . htmlspecialchars(strtoupper(LitColor::i18n($color, $this->i18n->LOCALE)), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '</option>';
        }
        return $options;
    }

    /**
     * Localized `<option>` entries for a "Common (or Proper)" multi-select.
     *
     * @param array<int, string> $selected Common values to mark as selected.
     * @return string The `<option>` list, without the surrounding `<select>`.
     */
    public function getCommonsOptionsHtml(array $selected = []): string
    {
        $options = '';
        foreach (self::COMMON_ORDER as $common) {
            $options .= '<option value="' . htmlspecialchars($common, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"'
                . ( in_array($common, $selected, true) ? ' selected' : '' ) . '>'
                . htmlspecialchars($this->LitCommon->fullTranslate($common), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '</option>';
        }
        return $options;
    }

    /**
     * HTML template for the "Common (or Proper)" multi-select form block, containing localized option entries.
     *
     * The returned string contains placeholders `{colWidth}` and `{uniqid}` that must be replaced by the caller
     * before rendering. The template includes a label and a `<select>` element (multiple, size="1") populated
     * with localized common/proper options.
     *
     * @return string The HTML fragment for the Common/Proper multi-select, with `{colWidth}` and `{uniqid}` placeholders.
     */
    public function getCommonsTemplate(): string
    {
        return '<div class="form-group col-sm-{colWidth}">' .
        '<label style="display:block;" for="onTheFly{uniqid}Common">' . _('Common (or Proper)') . '</label>' .
        '<select class="form-select litEvent litEventCommon" id="onTheFly{uniqid}Common" multiple="multiple" size="1">' .
        $this->getCommonsOptionsHtml([LitCommon::PROPRIO]) .
        '</select>' .
        '</div>';
    }

    public function getGradeTemplate(): string
    {
        $gradeTemplate  = '<div class="form-group col-sm-{colWidth}">' .
        '<label style="display:block;" for="onTheFly{uniqid}Grade">' . _('Grade') . '</label>' .
        '<select class="form-select litEvent litEventGrade" id="onTheFly{uniqid}Grade">';
        $gradeTemplate .= $this->getGradeOptionsHtml();
        $gradeTemplate .= '</select>';
        $gradeTemplate .= '</div>';
        return $gradeTemplate;
    }

    public static function setOption(string $option, bool $value): void
    {
        if (isset(self::$settings[$option])) {
            self::$settings[$option] = $value;
        }
    }

    /**
     * @param array<string, bool> $options
     */
    public static function setOptions(array $options): void
    {
        foreach ($options as $option => $value) {
            if (isset(self::$settings[$option])) {
                self::$settings[$option] = $value;
            }
        }
    }
}
