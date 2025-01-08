import { ApiClient, CalendarSelect, ApiOptions, Input, ApiOptionsFilter, PathBuilder } from '@liturgical-calendar/components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');


ApiClient.init().then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const apiOptions = (new ApiOptions( LITCAL_LOCALE ));
        apiOptions._localeInput.defaultValue( 'la' ).class( 'form-select requestOption' ).id('RequestOptionLocale');
        apiOptions._acceptHeaderInput.asReturnTypeParam().id('RequestOptionReturnType');
        apiOptions._yearInput.class( 'form-control' ).id('RequestOptionYear');
        apiOptions._yearTypeInput.id('RequestOptionYearType');
        apiOptions._calendarPathInput.id( 'APICalendarRouteSelect' ).class( 'form-select' );
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

        const localeLabelAfter = document.querySelector('#localeLabelAfter');
        const acceptLabelAfter = document.querySelector('#acceptLabelAfter');
        const yearLabelAfter = document.querySelector('#yearLabelAfter');
        apiOptions._localeInput._labelElement.insertAdjacentElement('beforeend', localeLabelAfter);
        apiOptions._acceptHeaderInput._labelElement.insertAdjacentElement('beforeend', acceptLabelAfter);
        apiOptions._yearInput._labelElement.insertAdjacentElement('beforeend', yearLabelAfter);

        const pathBuilder = new PathBuilder(apiOptions, calendarSelect)
        .class('row ps-2')
        .pathWrapperClass('col col-md-8 border border-secondary rounded bg-light d-flex align-items-center')
        .buttonWrapperClass('col col-md-3')
        .buttonClass('btn btn-primary')
        .replace('#pathBuilderComponent');

    }
});


const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
