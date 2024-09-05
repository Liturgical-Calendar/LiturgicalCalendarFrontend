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
    get apiBase() {
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


(function ($) {
    let CalendarNations = [];
    let selectOptions = {};

    $.getJSON( MetaDataURL, data => {
        const { litcal_metadata } = data;
        const { national_calendars_keys, diocesan_calendars } = litcal_metadata;

        diocesan_calendars.forEach(item => {
            if(false === CalendarNations.includes(item.nation)){
                CalendarNations.push(item.nation);
                selectOptions[item.nation] = [];
            }
            selectOptions[item.nation].push(`<option data-calendartype="diocesancalendar" value="${item.calendar_id}">${item.diocese}</option>`);
        });

        national_calendars_keys.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])))

        const $select = $('#APICalendarSelect');
        national_calendars_keys.forEach(item => {
            if( false === CalendarNations.includes(item) ) {
                $select.append(`<option data-calendartype="nationalcalendar" value="${item}">${countryNames.of(COUNTRIES[item])}</option>`);
            }
        });

        CalendarNations.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])));
        CalendarNations.forEach(item => {
            $select.append(`<option data-calendartype="nationalcalendar" value="${item}">${countryNames.of(COUNTRIES[item])}</option>`);
            const $optGroup = $(`<optgroup label="${countryNames.of(COUNTRIES[item])}">`);
            $select.append($optGroup);
            selectOptions[item].forEach(groupItem => $optGroup.append(groupItem));
        });
    });

    $(document).on('change', '#APICalendarSelect', function() {
        if( this.value === "VATICAN" ) {
            CurrentEndpoint.calendarType = null;
            CurrentEndpoint.calendarId   = null;
        }
        else if( this.value !== "" ) {
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
        RequestPayload.locale              = null;
        RequestPayload.ascension           = null;
        RequestPayload.corpus_christi      = null;
        RequestPayload.epiphany            = null;
        RequestPayload.calendar_type       = null;
        RequestPayload.eternal_high_priest = null;
        $('.requestOption').val('');
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
