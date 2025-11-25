/**
 * Liturgy of Any Day - using liturgy-components-js library
 *
 * This module uses the ApiClient, CalendarSelect, ApiOptions, and LiturgyOfAnyDay
 * components from the liturgy-components-js library. The ApiClient automatically handles
 * the Accept-Language header when listening to ApiOptions.
 */

import {
    ApiClient,
    CalendarSelect,
    ApiOptions,
    ApiOptionsFilter,
    LiturgyOfAnyDay
} from '@liturgical-calendar/components-js';

// Simple translation maps (Messages is not exported from the library)
const translations = {
    selectCalendar: {
        en: 'Select a calendar',
        it: 'Seleziona un calendario',
        es: 'Seleccionar un calendario',
        fr: 'Sélectionner un calendrier',
        de: 'Kalender auswählen',
        pt: 'Selecionar um calendário',
        nl: 'Selecteer een kalender',
        la: 'Elige calendarium',
        hu: 'Válasszon naptárat',
        sk: 'Vyberte kalendár',
        vi: 'Chọn lịch',
        id: 'Pilih kalender'
    },
    language: {
        en: 'Language',
        it: 'Lingua',
        es: 'Idioma',
        fr: 'Langue',
        de: 'Sprache',
        pt: 'Língua',
        nl: 'Taal',
        la: 'Lingua',
        hu: 'Nyelv',
        sk: 'Jazyk',
        vi: 'Ngôn ngữ',
        id: 'Bahasa'
    },
    day: {
        en: 'Day',
        it: 'Giorno',
        es: 'Día',
        fr: 'Jour',
        de: 'Tag',
        pt: 'Dia',
        nl: 'Dag',
        la: 'Dies',
        hu: 'Nap',
        sk: 'Deň',
        vi: 'Ngày',
        id: 'Hari'
    },
    month: {
        en: 'Month',
        it: 'Mese',
        es: 'Mes',
        fr: 'Mois',
        de: 'Monat',
        pt: 'Mês',
        nl: 'Maand',
        la: 'Mensis',
        hu: 'Hónap',
        sk: 'Mesiac',
        vi: 'Tháng',
        id: 'Bulan'
    },
    year: {
        en: 'Year',
        it: 'Anno',
        es: 'Año',
        fr: 'Année',
        de: 'Jahr',
        pt: 'Ano',
        nl: 'Jaar',
        la: 'Annus',
        hu: 'Év',
        sk: 'Rok',
        vi: 'Năm',
        id: 'Tahun'
    }
};

/**
 * Initialize the page with JS components
 */
const initializePage = async () => {
    // Initialize ApiClient with the API URL from the global BaseUrl
    const apiClient = await ApiClient.init( BaseUrl );

    if ( !( apiClient instanceof ApiClient ) ) {
        console.error( 'Failed to initialize ApiClient' );
        return;
    }

    // Get the base language for translations
    const lang = currentLocale.language;

    // Create CalendarSelect component
    const calendarSelect = new CalendarSelect( lang )
        .class( 'form-select' )
        .id( 'calendarSelect' )
        .label( { text: translations.selectCalendar[ lang ] || translations.selectCalendar.en, class: 'form-label' } )
        .allowNull( true );
    calendarSelect.appendTo( '#calendarSelectContainer' );

    // Set CalendarSelect to General Roman Calendar (empty value) instead of Vatican
    calendarSelect._domElement.value = '';

    // Create ApiOptions with only the locale input filter
    const apiOptions = new ApiOptions( lang )
        .filter( ApiOptionsFilter.LOCALE_ONLY )
        .linkToCalendarSelect( calendarSelect );

    // Configure the locale input before appending
    // Set defaultValue to currentLocale.language so it will be selected if available
    apiOptions._localeInput.id( 'apiOptionsLocale' );
    apiOptions._localeInput.class( 'form-select' );
    apiOptions._localeInput.labelClass( 'form-label' );
    apiOptions._localeInput._labelElement.textContent = translations.language[ lang ] || translations.language.en;
    apiOptions._localeInput.defaultValue( lang );

    // Append the locale input to its container using the filter
    apiOptions.appendTo( '#localeSelectContainer' );

    // Try to select the current locale in LocaleInput, fallback to first option if not available
    // First try exact match, then try matching just the language part (e.g., "en" matches "en_US")
    const localeOptions = Array.from( apiOptions._localeInput._domElement.options );
    const exactMatch = localeOptions.find( opt => opt.value === lang );
    const languageMatch = localeOptions.find( opt => opt.value.split( /[-_]/ )[ 0 ] === lang );

    let selectedLocale;
    if ( exactMatch ) {
        selectedLocale = exactMatch.value;
    } else if ( languageMatch ) {
        selectedLocale = languageMatch.value;
    } else if ( localeOptions.length > 0 ) {
        selectedLocale = localeOptions[ 0 ].value;
    } else {
        selectedLocale = lang; // Fallback to original lang if no options available
    }
    apiOptions._localeInput._domElement.value = selectedLocale;

    // Create LiturgyOfAnyDay component
    const liturgyOfAnyDay = new LiturgyOfAnyDay( { locale: lang } )
        .id( 'liturgyOfAnyDay' )
        .class( 'card shadow m-2' )
        .dateClass( 'card-header py-3 d-flex justify-content-between align-items-center' )
        .dateControlsClass( 'row g-3 p-3' )
        .eventsWrapperClass( 'card-body' )
        .eventClass( 'liturgy-event p-3 mb-2 rounded' )
        .eventGradeClass( 'small' )
        .eventCommonClass( 'small fst-italic' )
        .eventYearCycleClass( 'small' )
        .dayInputConfig( {
            wrapper: 'div',
            wrapperClass: 'col-md',
            class: 'form-control',
            labelClass: 'form-label',
            labelText: translations.day[ lang ] || translations.day.en
        } )
        .monthInputConfig( {
            wrapper: 'div',
            wrapperClass: 'col-md',
            class: 'form-select',
            labelClass: 'form-label',
            labelText: translations.month[ lang ] || translations.month.en
        } )
        .yearInputConfig( {
            wrapper: 'div',
            wrapperClass: 'col-md',
            class: 'form-control',
            labelClass: 'form-label',
            labelText: translations.year[ lang ] || translations.year.en
        } )
        .buildDateControls()
        .listenTo( apiClient );

    // Hide the component's title since the page already has a heading
    liturgyOfAnyDay._titleElement.style.display = 'none';

    liturgyOfAnyDay.appendTo( '#liturgyOfAnyDayContainer' );

    // Have ApiClient listen to CalendarSelect and ApiOptions
    // This automatically handles Accept-Language headers based on locale selection
    apiClient.listenTo( calendarSelect ).listenTo( apiOptions );

    // Initial fetch - fetch the General Roman Calendar
    // Note: LiturgyOfAnyDay.listenTo() already configured ApiClient with the correct
    // year_type (LITURGICAL for Dec 31st to include vigil masses, CIVIL otherwise)
    apiClient.fetchCalendar( selectedLocale );
};

// Initialize when DOM is ready
if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', initializePage );
} else {
    initializePage();
}
