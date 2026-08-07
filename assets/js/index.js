import { ApiClient, CalendarSelect, RiteSelect, ApiOptions, Input, ApiOptionsFilter, PathBuilder } from '@liturgical-calendar/components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');


if (!BaseUrl) {
    console.error('BaseUrl is falsy, cannot initialize ApiClient');
} else {
    ApiClient.init(BaseUrl).then(apiClient => {
        if (false === apiClient || false === apiClient instanceof ApiClient) {
            alert('Error initializing the Liturgical Calendar API Client');
        } else {
            const apiOptions = (new ApiOptions( LITCAL_LOCALE ));
            apiOptions._localeInput.defaultValue('la').class('form-select requestOption').id('RequestOptionLocale');
            apiOptions._acceptHeaderInput.asReturnTypeParam().id('RequestOptionReturnType');
            apiOptions._yearInput.class('form-control').id('RequestOptionYear');
            apiOptions._yearTypeInput.id('RequestOptionYearType');
            apiOptions._calendarPathInput.id('APICalendarRouteSelect').class('form-select');
            apiOptions._epiphanyInput.id('RequestOptionEpiphany').class('form-select requestOption');
            apiOptions._ascensionInput.id('RequestOptionAscension').class('form-select requestOption');
            apiOptions._corpusChristiInput.id('RequestOptionCorpusChristi').class('form-select requestOption');
            apiOptions._eternalHighPriestInput.id('RequestOptionEternalHighPriest').class('form-select requestOption');
            apiOptions._ascensionInput.wrapperClass('form-group col col-md-2');
            apiOptions._corpusChristiInput.wrapperClass('form-group col col-md-2');
            apiOptions._eternalHighPriestInput.wrapperClass('form-group col col-md-2');
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

            // Must be in the DOM before linkToCalendarSelect() below, which reads
            // this element to attach the rite-change listener.
            // No `text`: omitting it lets RiteSelect supply its own localized label
            // (Messages[lang].SELECT_A_RITE), so this reads "Seleziona un rito" on the
            // Italian page rather than the hardcoded English used for the calendar
            // label below. Note the library only translates this key for en and it so
            // far; every other locale still falls back to English.
            const riteSelect = (new RiteSelect( LITCAL_LOCALE ))
                .label({
                    class: 'form-label mb-1',
                    id: 'riteSelectLabel'
                }).id('APIRiteSelect')
                .class('form-select');
            riteSelect.appendTo('#riteSelectWrapper');

            apiOptions.filter( ApiOptionsFilter.BASE_PATH ).appendTo('#requestParametersBasePath');
            apiOptions.filter( ApiOptionsFilter.ALL_PATHS ).appendTo('#requestParametersAllPaths');
            // Passing riteSelect marks the rite as explicit, so it is emitted as a
            // path segment (/calendar/ambrosian/...) rather than left implicit, and
            // rebuilds the calendar select whenever the rite changes. The Ambrosian
            // rite has no national tier and fixes Epiphany, Ascension, Corpus Christi
            // and the Eternal High Priest in its own books, so ApiOptions also
            // disables those four inputs for as long as it is selected.
            apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

            const localeLabelAfter = document.querySelector('#localeLabelAfter');
            const acceptLabelAfter = document.querySelector('#acceptLabelAfter');
            const yearLabelAfter = document.querySelector('#yearLabelAfter');
            apiOptions._localeInput._labelElement.insertAdjacentElement('beforeend', localeLabelAfter);
            apiOptions._acceptHeaderInput._labelElement.insertAdjacentElement('beforeend', acceptLabelAfter);
            apiOptions._yearInput._labelElement.insertAdjacentElement('beforeend', yearLabelAfter);

            const pathBuilder = new PathBuilder(apiOptions, calendarSelect);
            pathBuilder.id('requestUrlBuilder')
                .class('row ps-2')
                .pathWrapperClass('col col-md-8 border border-secondary rounded bg-light d-flex align-items-center')
                .buttonWrapperClass('col col-md-3')
                .buttonClass('btn btn-primary')
                .replace('#pathBuilderComponent');

            $('#holydays_of_obligation').multiselect({
                buttonWidth: '100%',
                buttonClass: 'form-select',
                templates: {
                    button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                },
            });
            calendarSelect._domElement.addEventListener('change', (ev) => {
                $('#holydays_of_obligation').multiselect('rebuild');
                if (ev.target.value === '') {
                    $('#holydays_of_obligation').multiselect('deselectAll', false).multiselect('selectAll', false).parent().find('button.multiselect').removeAttr('style');
                } else {
                    $('#holydays_of_obligation').parent().find('button.multiselect').css('background-color', '#e9ecef');
                }
            });

        }
    }).catch( err => {
        console.error('Error initializing the Liturgical Calendar API Client:', err);
    });
}

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList];
tooltipList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
