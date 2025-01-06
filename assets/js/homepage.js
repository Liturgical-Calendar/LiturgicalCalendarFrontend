import { ApiClient, CalendarSelect, ApiOptions, Input, ApiOptionsFilter } from '@liturgical-calendar/components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

/**
 * CalendarCategory
 * @typedef {('nation'|'diocese')} CalendarCategory
 */

/**
 * CalendarType
 * @readonly
 * @enum {CalendarCategory} Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = {
    NATIONAL: 'nation',
    DIOCESAN: 'diocese'
}
Object.freeze(CalendarType);


/**
 * Describes the URL parameters that can be set on the API /calendar endpoint
 * @module RequestPayload
 */
class RequestPayload {
    /** @type {?Epiphany} - Whether Epiphany is to be celebrated on January 6 or on the Sunday between January 2 and January 8 */
    static epiphany             = null;
    /** @type {?Ascension} - Whether Ascension is to be celebrated on Thursday or on Sunday */
    static ascension            = null;
    /** @type {?CorpusChristi} - Whether Corpus Christi is to be celebrated on Thursday or on Sunday */
    static corpus_christi       = null;
    /** @type {?EternalHighPriest} - Whether Eternal High Priest is to be celebrated */
    static eternal_high_priest  = null;
    /** @type {?Locale} - The locale in which the liturgical calendar should be produced */
    static locale               = null;
    /** @type {?ReturnType} - The format of the response data */
    static return_type          = null;
    /** @type {?YearType} - Whether the liturgical calendar data should be for the liturgical year or the civil year */
    static year_type            = null;
};


/**
 * Used to build the full endpoint URL for the API /calendar endpoint
 * @module CurrentEndpoint
 *
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

ApiClient.init().then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const apiOptions = (new ApiOptions( LITCAL_LOCALE ));
        apiOptions._localeInput.defaultValue( 'la' ).class( 'form-select requestOption' ).id('RequestOptionLocale');
        apiOptions._acceptHeaderInput.asReturnTypeParam().id('RequestOptionReturnType');
        apiOptions._yearInput.class( 'form-control' ).id('RequestOptionYear');
        apiOptions._yearTypeInput.id('RequestOptionYearType');
        apiOptions._calendarPathInput.class( 'form-select' ).id( 'APICalendarRouteSelect' );
        apiOptions._epiphanyInput.id('RequestOptionEpiphany').class( 'form-select requestOption' );
        apiOptions._ascensionInput.id('RequestOptionAscension').class( 'form-select requestOption' );
        apiOptions._corpusChristiInput.id('RequestOptionCorpusChristi').class( 'form-select requestOption' );
        apiOptions._eternalHighPriestInput.id('RequestOptionEternalHighPriest').class( 'form-select requestOption' );
        apiOptions.filter( ApiOptionsFilter.PATH_BUILDER ).appendTo('#pathBuilder');

        const calendarSelect = (new CalendarSelect( LITCAL_LOCALE )).allowNull();
        calendarSelect.label({
            class: 'form-label mb-1',
            id: 'calendarSelectLabel',
            text: 'Select a calendar'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'calendarSelectWrapper'
        }).id('APICalendarSelect')
        .class('form-select')
        .insertAfter( apiOptions._calendarPathInput );

        apiOptions.filter( ApiOptionsFilter.BASE_PATH ).appendTo('#requestParametersBasePath');
        apiOptions.filter( ApiOptionsFilter.ALL_PATHS ).appendTo('#requestParametersAllPaths');
        apiOptions.linkToCalendarSelect( calendarSelect );

        /*
        apiClient.listenTo( calendarSelect );
        apiClient.listenTo( apiOptions );
        apiClient._eventBus.on( 'calendarFetched', ( data ) => {
            console.log('calendarFetch event received with data:', data );
        });
        */
    }
});


(function ($) {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

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
                break;
            case '/calendar/nation/':
                if ( CurrentEndpoint.calendarType !== CalendarType.NATIONAL ) {
                    CurrentEndpoint.calendarId   = encodeURIComponent(selectEl.value);
                    CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                }
                break;
            case '/calendar/diocese/':
                if ( CurrentEndpoint.calendarType !== CalendarType.DIOCESAN ) {
                    CurrentEndpoint.calendarId   = encodeURIComponent(selectEl.value);
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
            case 'national':
                CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                CurrentEndpoint.calendarId   = this.value;
                break;
            case 'diocesan': {
                CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                CurrentEndpoint.calendarId   = this.value;
                break;
            }
        }
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
