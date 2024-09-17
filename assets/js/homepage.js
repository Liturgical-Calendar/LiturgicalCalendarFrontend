/**
 * Enum CalendarType
 * Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = {
    NATIONAL: 'nation',
    DIOCESAN: 'diocese'
}
Object.freeze(CalendarType);

/**
 * Class RequestPayload
 * Describes the URL parameters that can be set on the API /calendar endpoint
 */
class RequestPayload {
    static epiphany             = null;
    static ascension            = null;
    static corpus_christi       = null;
    static eternal_high_priest  = null;
    static locale               = null;
    static return_type          = null;
    static year_type            = null;
};

const requestOptionDefaults = {
    "epiphany":            'JAN6',
    "ascension":           'THURSDAY',
    "corpus_christi":      'THURSDAY',
    "eternal_high_priest": false,
    "locale":              'LA'
}

/**
 * Class CurrentEndpoint
 * Used to build the full endpoint URL for the API /calendar endpoint
 */
class CurrentEndpoint {
    /**
     * The base URL of the API /calendar endpoint
     * @returns {string} The base URL of the API /calendar endpoint
     */
    static get apiBase() {
        return `${CalendarURL}`
    };
    static calendarType   = null;
    static calendarId     = null;
    static calendarYear   = null;
    static serialize = () => {
        let currentEndpoint = CurrentEndpoint.apiBase;
        if ( CurrentEndpoint.calendarType !== null && CurrentEndpoint.calendarId !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if ( CurrentEndpoint.calendarYear !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        let parameters = [];
        for (const key in RequestPayload) {
            if(RequestPayload[key] !== null && RequestPayload[key] !== ''){
                parameters.push(key + "=" + encodeURIComponent(RequestPayload[key]));
            }
        }
        let urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${currentEndpoint}${urlParams}`;
    }
}

class CalendarSelect {
    static #nationalCalendarsWithDioceses = [];
    static #nationOptions                 = [];
    static #dioceseOptions                = {};
    static #dioceseOptionsGrouped         = [];
    static #nationalCalendars             = [];

    static hasNationalCalendarWithDioceses(nation) {
        return this.#nationalCalendarsWithDioceses.filter(item => item?.calendar_id === nation).length > 0;
    }
    static addNationalCalendarWithDioceses(nation) {
        const nationalCalendar = this.#nationalCalendars.find(item => item.calendar_id === nation);
        this.#nationalCalendarsWithDioceses.push(nationalCalendar);
        this.#dioceseOptions[nation] = [];
    }
    static addNationOption(nationalCalendar, selected = false) {
        let option = `<option data-calendartype="nationalcalendar" value="${nationalCalendar.calendar_id}"${selected ? ' selected' : ''}>${countryNames.of(nationalCalendar.country_iso)}</option>`;
        this.#nationOptions.push(option);
    }
    static addDioceseOption(item) {
        let option = `<option data-calendartype="diocesancalendar" value="${item.calendar_id}">${item.diocese}</option>`;
        this.#dioceseOptions[item.nation].push(option);
    }
    static buildAllOptions(diocesan_calendars, national_calendars) {
        this.#nationalCalendars = national_calendars;
        diocesan_calendars.forEach(diocesanCalendarObj => {
            if(false === this.hasNationalCalendarWithDioceses(diocesanCalendarObj.nation)) {
                // we add all nations with dioceses to the nations list
                this.addNationalCalendarWithDioceses(diocesanCalendarObj.nation);
            }
            this.addDioceseOption(diocesanCalendarObj);
        });

        national_calendars.sort((a, b) => countryNames.of(a.country_iso).localeCompare(countryNames.of(b.country_iso)));
        national_calendars.forEach(nationalCalendar => {
            if( false === this.hasNationalCalendarWithDioceses(nationalCalendar.calendar_id) ) {
                // This is the first time we call CalendarSelect.addNationOption().
                // This will ensure that the VATICAN (or any other nation without any diocese) will be added as the first option(s).
                // We also ensure that the VATICAN is always the default selected option
                if ('VATICAN' === nationalCalendar.calendar_id) {
                    this.addNationOption(nationalCalendar, true);
                } else {
                    this.addNationOption(nationalCalendar);
                }
            }
        });

        // now we can add the options for the nations in the #calendarNationsWithDiocese list
        // that is to say, nations that have dioceses
        this.#nationalCalendarsWithDioceses.sort((a, b) => countryNames.of(a.country_iso).localeCompare(countryNames.of(b.country_iso)));
        this.#nationalCalendarsWithDioceses.forEach(nationalCalendar => {
            this.addNationOption(nationalCalendar);
            let optGroup = `<optgroup label="${countryNames.of(nationalCalendar.country_iso)}">${this.#dioceseOptions[nationalCalendar.calendar_id].join('')}</optgroup>`;
            this.#dioceseOptionsGrouped.push(optGroup);
        });
    }

    static get nationsInnerHtml() {
        return this.#nationOptions.join('');
    }

    static get diocesesInnerHtml() {
        return this.#dioceseOptionsGrouped.join('');
    }
}

let litcalMetadata = null;

(function ($) {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    fetch( MetaDataURL ).then(data => data.json()).then(jsonData => {
        console.log(jsonData);
        const { litcal_metadata } = jsonData;
        const { national_calendars, diocesan_calendars } = litcal_metadata;
        litcalMetadata = litcal_metadata;

        CalendarSelect.buildAllOptions(diocesan_calendars, national_calendars);
    });

    $(document).on('change', '#APICalendarRouteSelect', function() {
        RequestPayload.locale              = null;
        RequestPayload.ascension           = null;
        RequestPayload.corpus_christi      = null;
        RequestPayload.epiphany            = null;
        RequestPayload.year_type           = null;
        RequestPayload.eternal_high_priest = null;
        const selectEl = document.querySelector('#APICalendarSelect');
        switch (this.value) {
            case '/calendar':
                CurrentEndpoint.calendarType       = null;
                CurrentEndpoint.calendarId         = null;
                selectEl.innerHTML = '<option value="">GENERAL ROMAN</option>';
                $('.requestOption').val('');
                $('.requestOption').prop('disabled', false);
                $('#APICalendarSelect').prop('disabled', true);
                break;
            case '/calendar/nation/':
                selectEl.innerHTML = CalendarSelect.nationsInnerHtml;
                if ( CurrentEndpoint.calendarType !== CalendarType.NATIONAL ) {
                    CurrentEndpoint.calendarId   = selectEl.value;
                    CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                }
                // since the default selected nation is VATICAN, we can just use the default options used in the VATICAN
                document.querySelectorAll('.requestOption').forEach(el => {
                    el.value = requestOptionDefaults[el.dataset.param];
                });
                $('.requestOption').prop('disabled', true);
                $('#APICalendarSelect').prop('disabled', false);
                break;
            case '/calendar/diocese/':
                selectEl.innerHTML = CalendarSelect.diocesesInnerHtml;
                if ( CurrentEndpoint.calendarType !== CalendarType.DIOCESAN ) {
                    CurrentEndpoint.calendarId   = selectEl.value;
                    CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                }
                document.querySelectorAll('.requestOption').forEach(el => {
                    el.value = requestOptionDefaults[el.dataset.param];
                });
                let nation = litcalMetadata.diocesan_calendars.filter(diocesanCalendarObj => diocesanCalendarObj.calendar_id === selectEl.value)[0].nation;
                let nationalCalendarSettings = litcalMetadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === nation)[0].settings;
                let locale = nationalCalendarSettings.locale.replace('_', '-');
                locale = new Intl.Locale(locale);
                nationalCalendarSettings.locale = locale.language.toUpperCase();
                document.querySelectorAll('.requestOption').forEach(el => {
                    if (nationalCalendarSettings.hasOwnProperty(el.dataset.param)) {
                        el.value = nationalCalendarSettings[el.dataset.param];
                    }
                });
                $('.requestOption').prop('disabled', true);
                $('#APICalendarSelect').prop('disabled', false);
                break;
        }
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#APICalendarSelect', function() {
        // reset request options to defaults
        document.querySelectorAll('.requestOption').forEach(el => {
            el.value = requestOptionDefaults[el.dataset.param];
        });
        const calendarType = $(this).find(':selected').attr("data-calendartype");
        switch (calendarType){
            case 'nationalcalendar':
                CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                CurrentEndpoint.calendarId   = this.value;
                if (this.value !== 'VATICAN') {
                    let nationalCalendarSettings = litcalMetadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === this.value)[0].settings;
                    let locale = nationalCalendarSettings.locale.replace('_', '-');
                    locale = new Intl.Locale(locale);
                    nationalCalendarSettings.locale = locale.language.toUpperCase();
                    document.querySelectorAll('.requestOption').forEach(el => {
                        if (nationalCalendarSettings.hasOwnProperty(el.dataset.param)) {
                            el.value = nationalCalendarSettings[el.dataset.param];
                        }
                    });
                }
                break;
            case 'diocesancalendar':
                let settings = null;
                let diocesanCalendarObj = litcalMetadata.diocesan_calendars.filter(diocesanCalendarObj => diocesanCalendarObj.calendar_id === this.value)[0];
                let nation = diocesanCalendarObj.nation;
                let nationalCalendarSettings = litcalMetadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === nation)[0].settings;
                let locale = nationalCalendarSettings.locale.replace('_', '-');
                locale = new Intl.Locale(locale);
                nationalCalendarSettings.locale = locale.language.toUpperCase();
                settings = nationalCalendarSettings;
                if (diocesanCalendarObj.hasOwnProperty('settings')) {
                    settings = { ...settings, ...diocesanCalendarObj.settings };
                    if (diocesanCalendarObj.settings.hasOwnProperty('locale')) {
                        let diocese_locale = diocesanCalendarObj.settings.locale.replace('_', '-');
                        locale = new Intl.Locale(diocese_locale);
                        settings.locale = locale.language.toUpperCase();
                    }
                }
                document.querySelectorAll('.requestOption').forEach(el => {
                    if (settings.hasOwnProperty(el.dataset.param)) {
                        el.value = settings[el.dataset.param];
                    }
                });

                CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                CurrentEndpoint.calendarId   = this.value;
                break;
        }
        //TODO: we should set the requestOption values to the current selected calendar's values
        //$('.requestOption').val('');
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#RequestOptionReturnType', function() {
        RequestPayload.return_type = this.value;
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#RequestOptionYearType', function() {
        RequestPayload.year_type = this.value;
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on( 'change', '.requestOption', function() {
        $('#APICalendarSelect').val("");
        switch($(this).attr("id")){
            case 'RequestOptionEpiphany':
                RequestPayload.epiphany = this.value;
                break;
            case 'RequestOptionCorpusChristi':
                RequestPayload.corpus_christi = this.value;
                break;
            case 'RequestOptionAscension':
                RequestPayload.ascension = this.value;
                break;
            case 'RequestOptionLocale':
                RequestPayload.locale = this.value;
                break;
            case 'RequestOptionEternalHighPriest':
                RequestPayload.eternal_high_priest = this.value;
        }
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on( 'change', '#RequestOptionYear', function() {
        CurrentEndpoint.calendarYear = this.value;
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

})(jQuery);
