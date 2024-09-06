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
    static corpus_christi       = null;
    static epiphany             = null;
    static ascension            = null;
    static locale               = null;
    static return_type          = null;
    static calendar_type        = null;
    static eternal_high_priest  = null;
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
    static #calendarNations = [];
    static #nationOptions = [];
    static #dioceseOptions = {};
    static #dioceseOptionsGrouped = [];

    static hasNation(nation) {
        return this.#calendarNations.includes(nation);
    }
    static addCalendarNation(nation) {
        this.#calendarNations.push(nation);
        this.#dioceseOptions[nation] = [];
    }
    static addNationOption(item) {
        let option = `<option data-calendartype="nationalcalendar" value="${item}">${countryNames.of(COUNTRIES[item])}</option>`;
        this.#nationOptions.push(option);
    }
    static addDioceseOption(item) {
        let option = `<option data-calendartype="diocesancalendar" value="${item.calendar_id}">${item.diocese}</option>`;
        this.#dioceseOptions[item.nation].push(option);
    }
    static buildAllOptions() {
        this.#calendarNations.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])));
        this.#calendarNations.forEach(item => {
            let option = `<option data-calendartype="nationalcalendar" value="${item}">${countryNames.of(COUNTRIES[item])}</option>`;
            this.#nationOptions.push(option);
            let optGroup = `<optgroup label="${countryNames.of(COUNTRIES[item])}">${this.#dioceseOptions[item].join('')}</optgroup>`;
            this.#dioceseOptionsGrouped.push(optGroup);
        })
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

        diocesan_calendars.forEach(item => {
            if(false === CalendarSelect.hasNation(item.nation)) {
                CalendarSelect.addCalendarNation(item.nation);
            }
            CalendarSelect.addDioceseOption(item);
        });

        national_calendars_keys.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])));
        national_calendars_keys.forEach(item => {
            if( false === CalendarSelect.hasNation(item) ) {
                CalendarSelect.addNationOption(item);
            }
        });

        CalendarSelect.buildAllOptions();
    });

    $(document).on('change', '#APICalendarRouteSelect', function() {
        const selectEl = document.querySelector('#APICalendarSelect');
        switch (this.value) {
            case '/calendar':
                selectEl.innerHTML = '<option value="">---</option>';
                break;
            case '/calendar/nation/':
                selectEl.innerHTML = CalendarSelect.nationsInnerHtml;
                break;
            case '/calendar/diocese/':
                selectEl.innerHTML = CalendarSelect.diocesesInnerHtml;
                break;
        }
    });

    $(document).on('change', '#APICalendarSelect', function() {
        if( this.value === "VATICAN" || this.value === '' ) {
            CurrentEndpoint.calendarType       = null;
            CurrentEndpoint.calendarId         = null;
            RequestPayload.locale              = null;
            RequestPayload.ascension           = null;
            RequestPayload.corpus_christi      = null;
            RequestPayload.epiphany            = null;
            RequestPayload.calendar_type       = null;
            RequestPayload.eternal_high_priest = null;
        }
        else {
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
        }
        if( this.value !== '' ) {
            $('.requestOption').val('');
            $('.requestOption').prop('disabled', true);
        } else {
            $('.requestOption').prop('disabled', false);
        }
        $('#RequestURLExample').text(CurrentEndpoint.serialize());
        $('#RequestURLButton').attr('href', CurrentEndpoint.serialize());
    });

    $(document).on('change', '#RequestOptionReturnType', function() {
        RequestPayload.return_type = this.value;
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
            case 'RequestOptionCalendarType':
                RequestPayload.calendar_type = this.value;
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
