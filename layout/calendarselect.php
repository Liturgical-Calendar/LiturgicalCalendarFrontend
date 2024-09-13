<?php

class CalendarSelect
{
    private static $nationalCalendarsWithDioceses = [];
    private static $nationOptions                 = [];
    private static $dioceseOptions                = [];
    private static $dioceseOptionsGrouped         = [];
    private static $nationalCalendars             = [];
    private static $locale                        = 'en';
    public static $nationsInnerHtml;
    public static $diocesesInnerHtml;

    public static function setLocale($locale)
    {
        self::$locale = $locale;
    }

    private static function hasNationalCalendarWithDioceses($nation)
    {
        return count(self::$nationalCalendarsWithDioceses) && count(array_filter(self::$nationalCalendarsWithDioceses, fn($item) => $item['calendar_id'] === $nation)) > 0;
    }

    private static function addNationalCalendarWithDioceses($nation)
    {
        $nationalCalendar = array_values(array_filter(self::$nationalCalendars, fn($item) => $item['calendar_id'] === $nation));
        array_push(self::$nationalCalendarsWithDioceses, $nationalCalendar[0]);
        self::$dioceseOptions[$nation] = [];
    }

    private static function addNationOption($nationalCalendar, $selected = false)
    {
        $selectedStr = $selected ? ' selected' : '';
        $optionOpenTag = "<option data-calendartype=\"nationalcalendar\" value=\"{$nationalCalendar['calendar_id']}\"{$selectedStr}>";
        $optionContents = \Locale::getDisplayRegion('-' . $nationalCalendar['country_iso'], self::$locale);
        $optionCloseTag = "</option>";
        self::$nationOptions[] = "{$optionOpenTag}{$optionContents}{$optionCloseTag}";
    }

    private static function addDioceseOption($item)
    {
        $optionOpenTag = "<option data-calendartype=\"diocesancalendar\" value=\"{$item['calendar_id']}\">";
        $optionContents = $item['diocese'];
        $optionCloseTag = "</option>";
        self::$dioceseOptions[$item['nation']][] = "{$optionOpenTag}{$optionContents}{$optionCloseTag}";
    }

    public static function buildAllOptions($diocesan_calendars, $national_calendars)
    {
        $col = \Collator::create(self::$locale);  // the default rules will do in this case..
        $col->setStrength(\Collator::PRIMARY); // only compare base characters; not accents, lower/upper-case, ...

        self::$nationalCalendars = $national_calendars;
        foreach ($diocesan_calendars as $diocesanCalendar) {
            if (!self::hasNationalCalendarWithDioceses($diocesanCalendar['nation'])) {
                // we add all nations with dioceses to the nations list
                self::addNationalCalendarWithDioceses($diocesanCalendar['nation']);
            }
            self::addDioceseOption($diocesanCalendar);
        }
        usort($national_calendars, fn($a, $b) => $col->compare(
            \Locale::getDisplayRegion("-" . $a['country_iso'], self::$locale),
            \Locale::getDisplayRegion("-" . $b['country_iso'], self::$locale)
        ));
        foreach ($national_calendars as $nationalCalendar) {
            if (!self::hasNationalCalendarWithDioceses($nationalCalendar['calendar_id'])) {
                // This is the first time we call CalendarSelect::addNationOption().
                // This will ensure that the VATICAN (or any other nation without any diocese) will be added as the first option.
                // In theory any other nation for whom no dioceses are defined will be added here too,
                // so we will ensure that the VATICAN is always the default selected option
                if ('VATICAN' === $nationalCalendar['calendar_id']) {
                    self::addNationOption($nationalCalendar, true);
                } else {
                    self::addNationOption($nationalCalendar);
                }
            }

            // now we can add the options for the nations in the #calendarNationsWithDiocese list
            // that is to say, nations that have dioceses
            usort(self::$nationalCalendarsWithDioceses, fn($a, $b) => $col->compare(
                \Locale::getDisplayRegion('-' . $a['country_iso'], self::$locale),
                \Locale::getDisplayRegion('-' . $b['country_iso'], self::$locale)
            ));
            foreach (self::$nationalCalendarsWithDioceses as $nationalCalendar) {
                self::addNationOption($nationalCalendar);
                $optgroupLabel = \Locale::getDisplayRegion("-" . $nationalCalendar['country_iso'], self::$locale);
                $optgroupOpenTag = "<optgroup label=\"{$optgroupLabel}\">";
                $optgroupContents = implode('', self::$dioceseOptions[$nationalCalendar['calendar_id']]);
                $optgroupCloseTag = "</optgroup>";
                array_push(self::$dioceseOptionsGrouped, "{$optgroupOpenTag}{$optgroupContents}{$optgroupCloseTag}");
            }
        }
    }

    public static function get($key)
    {
        if ($key === 'nationsInnerHtml') {
            return implode('', self::$nationOptions);
        }

        if ($key === 'diocesesInnerHtml') {
            return implode('', self::$dioceseOptionsGrouped);
        }

        return "<option>$key</option>";
    }
}

$locale = isset($_COOKIE['currentLocale']) ? $_COOKIE['currentLocale'] : Locale::acceptFromHttp($_SERVER['HTTP_ACCEPT_LANGUAGE']);
CalendarSelect::setLocale($locale);

$metadataRaw = file_get_contents("https://litcal.johnromanodorazio.com/api/{$endpointV}/calendars");
$metadataJSON = json_decode($metadataRaw, true);
[ 'litcal_metadata' => $CalendarIndex ] = $metadataJSON;

CalendarSelect::buildAllOptions($CalendarIndex["diocesan_calendars"], $CalendarIndex["national_calendars"]);
?>

<div class="row">
    <div class="form-group col-md">
        <label><?php echo _("Select calendar"); ?></label>
        <select class="form-select" id="calendarSelect">
            <?php echo CalendarSelect::get('nationsInnerHtml') . CalendarSelect::get('diocesesInnerHtml'); ?>
        </select>
    </div>
</div>
