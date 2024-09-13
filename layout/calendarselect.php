<?php

class CalendarSelect
{
    private static $nationalCalendarsWithDioceses = [];
    private static $nationOptions                 = [];
    private static $dioceseOptions                = [];
    private static $dioceseOptionsGrouped         = [];
    private static $nationalCalendars             = [];
    private static $locale                        = 'en';

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
        $optionHtml = "{$optionOpenTag}{$optionContents}{$optionCloseTag}";
        array_push(self::$nationOptions, $optionHtml);
    }

    private static function addDioceseOption($item)
    {
        $optionOpenTag = "<option data-calendartype=\"diocesancalendar\" value=\"{$item['calendar_id']}\">";
        $optionContents = $item['diocese'];
        $optionCloseTag = "</option>";
        $optionHtml = "{$optionOpenTag}{$optionContents}{$optionCloseTag}";
        array_push(self::$dioceseOptions[$item['nation']], $optionHtml);
    }

    private static function buildAllOptions($diocesan_calendars, $national_calendars)
    {
        $col = \Collator::create(self::$locale);
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
                // This will ensure that the VATICAN (or any other nation without any diocese) will be added as the first option(s).
                // We also ensure that the VATICAN is always the default selected option
                if ('VATICAN' === $nationalCalendar['calendar_id']) {
                    self::addNationOption($nationalCalendar, true);
                } else {
                    self::addNationOption($nationalCalendar);
                }
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

    public static function getOptions($key)
    {
        if ($key === 'nations') {
            return implode('', self::$nationOptions);
        }

        if ($key === 'diocesesGrouped') {
            return implode('', self::$dioceseOptionsGrouped);
        }

        if ($key === 'all') {
            return implode('', self::$nationOptions) . implode('', self::$dioceseOptionsGrouped);
        }

        return "<option>$key</option>";
    }

    public static function getSelect($options)
    {
        $defaultOptions = [
            "class"   => "calendarSelect",
            "id"      => "calendarSelect",
            "options" => 'all',
            "label"   => false,
            "labelStr" => 'Select a calendar'
        ];
        $options = array_merge($defaultOptions, $options);
        $optionsHtml = self::getOptions($options['options']);
        return ($options['label'] ? "<label for=\"{$options['id']}\">{$options['labelStr']}</label>" : '')
            . "<select id=\"{$options['id']}\" class=\"{$options['class']}\">{$optionsHtml}</select>";
    }

    public static function init($metadataURL)
    {
        $metadataRaw = file_get_contents($metadataURL);
        if ($metadataRaw === false) {
            throw new \Exception("Error fetching metadata from {$metadataURL}");
        }
        $metadataJSON = json_decode($metadataRaw, true);
        if (JSON_ERROR_NONE !== json_last_error()) {
            throw new \Exception("Error decoding metadata from {$metadataURL}: " . json_last_error_msg());
        }
        if (array_key_exists('litcal_metadata', $metadataJSON) === false) {
            throw new \Exception("Missing 'litcal_metadata' in metadata from {$metadataURL}");
        }
        if (array_key_exists('diocesan_calendars', $metadataJSON['litcal_metadata']) === false) {
            throw new \Exception("Missing 'diocesan_calendars' in metadata from {$metadataURL}");
        }
        if (array_key_exists('national_calendars', $metadataJSON['litcal_metadata']) === false) {
            throw new \Exception("Missing 'national_calendars' in metadata from {$metadataURL}");
        }
        [ 'litcal_metadata' => $CalendarIndex ] = $metadataJSON;
        [ 'diocesan_calendars' => $diocesan_calendars, 'national_calendars' => $national_calendars ] = $CalendarIndex;
        self::buildAllOptions($diocesan_calendars, $national_calendars);
    }
}

$locale = isset($_COOKIE['currentLocale']) ? $_COOKIE['currentLocale'] : Locale::acceptFromHttp($_SERVER['HTTP_ACCEPT_LANGUAGE']);
CalendarSelect::setLocale($locale);
try {
    CalendarSelect::init("https://litcal.johnromanodorazio.com/api/{$endpointV}/calendars");
} catch (\Throwable $th) {
    echo $th->getMessage();
}
?>

<div class="row">
    <div class="form-group col-md">
        <?php echo CalendarSelect::getSelect([
            'class'    => 'form-select',
            'id'       => 'calendarSelect',
            'options'  => 'all',
            'label'    => true,
            'labelStr' => _("Select calendar")
        ]); ?>
    </div>
</div>
