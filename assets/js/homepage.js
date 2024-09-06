const { COUNTRIES, LITCAL_LOCALE } = ISO_3166_1_alpha_2;
let countryNames = new Intl.DisplayNames([LITCAL_LOCALE], {type: 'region'});

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
    static calendar_type        = null;
};

/**
 * Class CurrentEndpoint
 * Used to build the full endpoint URL for the API /calendar endpoint
 */
class CurrentEndpoint {
    static get apiBase() {
        return `${RequestURLBase}calendar`
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
    static #calendarNationsWithDioceses = [];
    static #nationOptions = [];
    static #dioceseOptions = {};
    static #dioceseOptionsGrouped = [];

    static hasNationWithDiocese(nation) {
        return this.#calendarNationsWithDioceses.includes(nation);
    }
    static addCalendarNationWithDiocese(nation) {
        this.#calendarNationsWithDioceses.push(nation);
        this.#dioceseOptions[nation] = [];
    }
    static addNationOption(nationKey, selected = false) {
        let option = `<option data-calendartype="nationalcalendar" value="${nationKey}"${selected ? ' selected' : ''}>${countryNames.of(COUNTRIES[nationKey])}</option>`;
        this.#nationOptions.push(option);
    }
    static addDioceseOption(item) {
        let option = `<option data-calendartype="diocesancalendar" value="${item.calendar_id}">${item.diocese}</option>`;
        this.#dioceseOptions[item.nation].push(option);
    }
    static buildAllOptions(diocesan_calendars, national_calendars_keys) {
        diocesan_calendars.forEach(diocesanCalendarObj => {
            if(false === this.hasNationWithDiocese(diocesanCalendarObj.nation)) {
                // we add all nations with dioceses to the nations list
                this.addCalendarNationWithDiocese(diocesanCalendarObj.nation);
            }
            this.addDioceseOption(diocesanCalendarObj);
        });

        national_calendars_keys.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])));
        national_calendars_keys.forEach(nationKey => {
            if( false === this.hasNationWithDiocese(nationKey) ) {
                // This is the first time we call CalendarSelect.addNationOption().
                // This will ensure that the VATICAN (a nation without any diocese) will be added as the first option.
                // In theory any other nation for whom no dioceses are defined will be added here too,
                // so we will ensure that the VATICAN is always the default selected option
                if ('VATICAN' === nationKey) {
                    this.addNationOption(nationKey, true);
                } else {
                    this.addNationOption(nationKey);
                }
            }
        });

        // now we can add the options for the nations in the #calendarNationsWithDiocese list
        // that is to say, nations that have dioceses
        this.#calendarNationsWithDioceses.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])));
        this.#calendarNationsWithDioceses.forEach(nationKey => {
            this.addNationOption(nationKey);
            let optGroup = `<optgroup label="${countryNames.of(COUNTRIES[nationKey])}">${this.#dioceseOptions[nationKey].join('')}</optgroup>`;
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


(function ($) {

    fetch( MetaDataURL ).then(data => data.json()).then(jsonData => {
        console.log(jsonData);
        const { litcal_metadata } = jsonData;
        const { national_calendars_keys, diocesan_calendars } = litcal_metadata;

        CalendarSelect.buildAllOptions(diocesan_calendars, national_calendars_keys);
    });

    $(document).on('change', '#APICalendarRouteSelect', function() {
        const selectEl = document.querySelector('#APICalendarSelect');
        switch (this.value) {
            case '/calendar':
                selectEl.innerHTML = '<option value="">GENERAL ROMAN</option>';
                CurrentEndpoint.calendarType       = null;
                CurrentEndpoint.calendarId         = null;
                RequestPayload.locale              = null;
                RequestPayload.ascension           = null;
                RequestPayload.corpus_christi      = null;
                RequestPayload.epiphany            = null;
                RequestPayload.calendar_type       = null;
                RequestPayload.eternal_high_priest = null;
                $('.requestOption').prop('disabled', false);
                $('#APICalendarSelect').prop('disabled', true);
                break;
            case '/calendar/nation/':
                $('.requestOption').prop('disabled', true);
                $('#APICalendarSelect').prop('disabled', false);
                selectEl.innerHTML = CalendarSelect.nationsInnerHtml;
                if ( CurrentEndpoint.calendarType !== CalendarType.NATIONAL ) {
                    CurrentEndpoint.calendarId   = selectEl.value;
                    CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                }
                break;
            case '/calendar/diocese/':
                $('.requestOption').prop('disabled', true);
                $('#APICalendarSelect').prop('disabled', false);
                selectEl.innerHTML = CalendarSelect.diocesesInnerHtml;
                if ( CurrentEndpoint.calendarType !== CalendarType.DIOCESAN ) {
                    CurrentEndpoint.calendarId   = selectEl.value;
                    CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                }
                break;
        }
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#APICalendarSelect', function() {
        const calendarType = $(this).find(':selected').attr("data-calendartype");
        switch (calendarType){
            case 'nationalcalendar':
                CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                CurrentEndpoint.calendarId   = this.value;
                break;
            case 'diocesancalendar':
                CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                CurrentEndpoint.calendarId   = this.value;
                break;
        }
        //TODO: we should set the requestOption values to the current selected calendar's values
        $('.requestOption').val('');
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#RequestOptionReturnType', function() {
        RequestPayload.return_type = this.value;
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#RequestOptionCalendarType', function() {
        RequestPayload.calendar_type = this.value;
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
