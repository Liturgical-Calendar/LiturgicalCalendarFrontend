import {
    FormControls,
    LitEvent,
    RowAction,
    Month,
    MonthsOfThirty,
    Rank,
    setFormSettings,
    setFormSettingsForProperty,
    setCommonMultiselect,
    integerProperties,
    payloadProperties,
    metadataProperties
} from './FormControls.js';


import {
    removeDiocesanCalendarModal,
    removeCalendarModal,
    sanitizeInput
} from './templates.js';

import {
    WiderRegionPayload,
    NationalCalendarPayload,
    DiocesanCalendarPayload,
    DiocesanCalendarDELETEPayload
} from './Payload.js';


toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": true,
    "positionClass": "toast-bottom-center",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "2000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
}

// the Messages global is set in extending.php
const { LOCALE, LOCALE_WITH_REGION, AvailableLocales, AvailableLocalesWithRegion, CountriesWithCatholicDioceses } = Messages;
const jsLocale = LOCALE.replace('_', '-');
FormControls.jsLocale = jsLocale;
FormControls.weekdayFormatter = new Intl.DateTimeFormat(jsLocale, { weekday: "long" });

/**
 * Proxy sanitizer for the proxied API object. Sanitizes the values assigned to properties of the proxied API object.
 * @type {Proxy}
 * @prop {function} get - the getter for the proxy
 * @prop {function} set - the setter for the proxy
 * @prop {string} prop - the name of the property being accessed or modified
 * @prop {string} value - the value to be assigned to the property
 * @prop {Object} target - the object being proxied
 */
const sanitizeProxiedAPI = {
    get: (target, prop) => {
        return Reflect.get(target, prop);
    },
    set: (target, prop, value) => {
        // all props are strings
        if (typeof value !== 'string') {
            console.warn(`property ${prop} of this object must be of type string`);
            return;
        }
        if (value !== '') {
            value = sanitizeInput( value );
        }
        switch (prop) {
            case 'path':
                // the path will be set based on the category and key parameters
                value = (target.hasOwnProperty('category') && target['category'] !== '' && target.hasOwnProperty('key') && target['key'] !== '') ? `${RegionalDataURL}/${target['category']}/${target['key']}` : '';
                break;
            case 'category':
                if (false === ['widerregion', 'nation', 'diocese'].includes(value)) {
                    console.warn(`property 'category' of this object must be one of the values 'widerregion', 'nation', or 'diocese'`);
                    return;
                }
                if (target.hasOwnProperty('key') && target['key'] !== '') {
                    target['path'] = `${RegionalDataURL}/${value}/${target['key']}`;
                }
                break;
            case 'key':
                if (target['category'] === 'widerregion') {
                    if (value.includes(' - ')) {
                        ([value, target['locale']] = value.split(' - '));
                    }
                    if (false === ['Americas', 'Europe', 'Africa', 'Oceania', 'Asia', 'Antarctica'].includes(value)) {
                        console.warn(`property 'key' of this object must be one of the values 'Americas', 'Europe', 'Africa', 'Oceania', or 'Asia'`);
                        return;
                    }
                }
                else if (target['category'] === 'nation') {
                    if (false === Object.keys(CountriesWithCatholicDioceses).includes(value)) {
                        console.warn(`property 'key' of this object is not a valid value, possible values are: ${Object.keys(CountriesWithCatholicDioceses).join(', ')}`);
                        return;
                    }
                    if (false === LitCalMetadata.national_calendars_keys.includes(value)) {
                        console.warn(`property 'key' of this object is not yet defined, defined values are: ${LitCalMetadata.national_calendars_keys.join(', ')}`);
                    }
                }
                else if (target['category'] === 'diocese') {
                    if (false === LitCalMetadata.diocesan_calendars_keys.includes(value)) {
                        console.warn(`property 'key' of this object is not yet defined, defined values are: ${LitCalMetadata.diocesan_calendars_keys.join(', ')}`);
                    }
                }
                if (target.hasOwnProperty('category') && target['category'] !== '') {
                    target['path'] = `${RegionalDataURL}/${target['category']}/${value}`;
                }
                break;
            case 'locale':
                if (false === Object.keys(AvailableLocales).includes(value) && false === Object.keys(AvailableLocalesWithRegion).includes(value)) {
                    console.warn(`property 'locale' of this object must be one of the values ${Object.keys(AvailableLocales).join(', ')}, ${Object.keys(AvailableLocalesWithRegion).join(', ')}`);
                    return;
                }
                break;
            case 'method':
                if (false === ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(value)) {
                    console.warn(`property 'method' of this object must be one of the values 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'`);
                    return;
                }
                break;
            default:
                console.warn('unexpected property ' + prop + ' of type ' + typeof prop + ' on target of type ' + typeof target);
                return;
        }
        return Reflect.set(target, prop, value);
    }
}

/**
 * Proxied API object. This object is used to build the URL for the API to be queried.
 * @typedef {Object} ProxiedAPI
 * @property {string} category - category of API query. Valid values are 'widerregion', 'nation' and 'diocese'.
 * @property {string} key - value of category above. Valid values are ISO 3166-1 Alpha-2 codes for nations and valid diocese codes for dioceses.
 * @property {string} path - URL path for API query. Will be set by the proxy once category and key are set.
 * @property {string} locale - locale in which the API query result will be returned, or the payload will be PUT. Must be a valid locale.
 * @property {string} method - HTTP method for API query. Must be one of the values 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'.
 */

/**
 * @type {ProxiedAPI}
 */
const API = new Proxy({
    category: '',
    key: '',
    path: '',
    locale: '',
    method: ''
}, sanitizeProxiedAPI);


let DiocesesList = null;
let CalendarData = { litcal: [] };
let CalendarsIndex = null;
let MissalsIndex = null;

Promise.all([
    fetch('./assets/data/WorldDiocesesByNation.json', {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    }),
    fetch(MetadataURL, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    }),
    fetch(MissalsURL, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    })
]).then(responses => {
    return Promise.all(responses.map((response) => {
        if(response.ok) {
            return response.json();
        }
        else {
            throw new Error(response.status + ': ' + response.text);
        }
    }));
}).then(data => {
    DiocesesList = data[0].catholic_dioceses_latin_rite;

    if(data[1].hasOwnProperty('litcal_metadata')) {
        console.log('retrieved /calendars metadata:');
        console.log(data[1]);
        CalendarsIndex = data[1].litcal_metadata;
        FormControls.index = data[1].litcal_metadata;
        toastr["success"]('Successfully retrieved data from /calendars path', "Success");
    }

    if (data[2].hasOwnProperty('litcal_missals')) {
        console.log('retrieved /missals metadata:');
        console.log(data[2]);
        MissalsIndex = data[2].litcal_missals;
        FormControls.missals = data[2].litcal_missals;
        const publishedRomanMissalsStr = MissalsIndex.map(({missal_id,name}) => !missal_id.startsWith('EDITIO_TYPICA_') ? `<option class="list-group-item" value="${missal_id}">${name}</option>` : null).join('')
        $('#languageEditionRomanMissalList').append(publishedRomanMissalsStr);
        toastr["success"]('Successfully retrieved data from /missals path', "Success");
    }
}).catch(error => {
    console.error(error);
    toastr["error"](error, "Error");
});

/**
 * All Calendars interactions
 */

$(document).on('change', '.litEvent', ev => {
    let $row = $(ev.currentTarget).closest('.row');
    let $card = $(ev.currentTarget).closest('.card-body');
    if ($(ev.currentTarget).hasClass('litEventName')) {
        //console.log('LitEvent name has changed');
        if ($(ev.currentTarget).val() == '') {
            //empty value probably means we are trying to delete an already defined event
            //so let's find the key and remove it
            let oldEventKey = $(ev.currentTarget).attr('data-valuewas');
            console.log('seems we are trying to delete the object key ' + oldEventKey);
            CalendarData.litcal = CalendarData.litcal.filter(item => item.festivity.event_key !== oldEventKey);
            $(ev.currentTarget).attr('data-valuewas', '');
        } else {
            let eventKey = $(ev.currentTarget).val().replace(/[^a-zA-Z]/gi, '');
            console.log('new LitEvent name identifier is ' + eventKey);
            console.log('festivity name is ' + $(ev.currentTarget).val());
            if ($(ev.currentTarget).attr('data-valuewas') == '' && CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length === 0) {
                console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                let newEvent = { festivity: {}, metadata: {} };
                newEvent.festivity = new LitEvent(
                    eventKey,
                    $(ev.currentTarget).val(), //name
                    $row.find('.litEventColor').val(), //color
                    null,
                    $row.find('.litEventCommon').val(), //common
                    parseInt($row.find('.litEventDay').val()), //day
                    parseInt($row.find('.litEventMonth').val()), //month
                );
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                newEvent.metadata.since_year = parseInt($row.find('.litEventSinceYear').val());
                if( $row.find('.litEventUntilYear').val() !== '' ) {
                    newEvent.metadata.until_year = parseInt($row.find('.litEventUntilYear').val());
                }
                let formRowIndex = $card.find('.row').index($row);
                newEvent.metadata.form_rownum = formRowIndex;
                console.log('form row index is ' + formRowIndex);
                $(ev.currentTarget).attr('data-valuewas', eventKey);
                $(ev.currentTarget).removeClass('is-invalid');
                console.log('adding new event to CalendarData.litcal:');
                console.log( newEvent );
                CalendarData.litcal.push(newEvent);
            } else if ($(ev.currentTarget).attr('data-valuewas') != '') {
                let oldEventKey = $(ev.currentTarget).attr('data-valuewas');
                console.log('the preceding value here was ' + oldEventKey);
                if (CalendarData.litcal.filter(item => item.festivity.event_key === oldEventKey).length > 0) {
                    if (oldEventKey !== eventKey) {
                        if( /_2$/.test(eventKey) ) {
                            console.log('oh geez, we are dealing with a second festivity that has the same name as a first festivity, because it continues where the previous untilYear left off...');
                            eventKey = oldEventKey;
                            console.log('but wait, why would you be changing the name of the second festivity? it will no longer match the first festivity!');
                            console.log('this is becoming a big mess, arghhhh... results can start to be unpredictable');
                            CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.name = $(ev.currentTarget).val();
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        } else {
                            console.log('I see you are trying to change the name of a festivity that was already defined. This will effectively change the relative key also, so here is what we are going to do:');
                            console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
                            let copiedEvent = CalendarData.litcal.filter(item => item.festivity.event_key === oldEventKey)[0];
                            copiedEvent.festivity.event_key = eventKey;
                            copiedEvent.festivity.name = $(ev.currentTarget).val();
                            CalendarData.litcal.push(copiedEvent);
                            CalendarData.litcal = CalendarData.litcal.filter(item => item.festivity.event_key !== oldEventKey);
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        }
                    }
                }
            } else if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                if( false === CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.hasOwnProperty('until_year') ) {
                    console.log('exact same festivity name was already defined elsewhere! key ' + eventKey + ' already exists! and the untilYear property was not defined!');
                    $(ev.currentTarget).val('');
                    $(ev.currentTarget).addClass('is-invalid');
                } else {
                    let confrm = confirm('The same festivity name was already defined elsewhere. However an untilYear property was also defined, so perhaps you are wanting to define again for the years following. If this is the case, press OK, otherwise Cancel');
                    if(confrm) {
                        //retrieve untilYear from the previous festivity with the same name
                        let untilYear = CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.until_year;
                        //set the sinceYear field on this row to the previous untilYear plus one
                        $row.find('.litEventSinceYear').val(untilYear+1);
                        //update our eventKey to be distinct from the previous festivity
                        eventKey = eventKey+'_2';
                        $(ev.currentTarget).attr('data-valuewas', eventKey);
                        let newEvent = { festivity: {}, metadata: {} };
                        newEvent.festivity = new LitEvent(
                            eventKey,
                            $(ev.currentTarget).val(), //name
                            $row.find('.litEventColor').val(), //color
                            null,
                            $row.find('.litEventCommon').val(), //common
                            parseInt($row.find('.litEventDay').val()), //day
                            parseInt($row.find('.litEventMonth').val()), //month
                        );
                        newEvent.metadata.since_year = untilYear + 1;
                        let formRowIndex = $card.find('.row').index($row);
                        newEvent.metadata.form_rownum = formRowIndex;
                        console.log('form row index is ' + formRowIndex);
                        CalendarData.litcal.push(newEvent);
                    }
                }
            }
            switch ($(ev.currentTarget).closest('.carousel-item').attr('id')) {
                case 'carouselItemSolemnities':
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.grade = 6;
                    if ($(ev.currentTarget).val().match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'red');
                        CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = [ 'red' ];
                    } else {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                        CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = [ 'white' ];
                    }
                    break;
                case 'carouselItemFeasts':
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.grade = 4;
                    break;
                case 'carouselItemMemorials':
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.grade = 3;
                    break;
                case 'carouselItemOptionalMemorials':
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.grade = 2;
                    break;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventDay')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.day = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventMonth')) {
        let selcdMonth = parseInt($(ev.currentTarget).val());
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.month = selcdMonth;
            }
        }
        $row.find('.litEventDay').attr('max', selcdMonth === Month.FEBRUARY ? "28" : (MonthsOfThirty.includes(selcdMonth) ? "30" : "31"));
        if (parseInt($row.find('.litEventDay').val()) > parseInt($row.find('.litEventDay').attr('max'))) {
            $row.find('.litEventDay').val($row.find('.litEventDay').attr('max'));
        }
    } else if ($(ev.currentTarget).hasClass('litEventCommon')) {
        if ($row.find('.litEventName').val() !== "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.common = $(ev.currentTarget).val();
                let eventColors = [];
                if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.common.some( m => /Martyrs/.test(m) )) {
                    eventColors.push('red');
                }
                if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.common.some( m => /(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/.test(m) ) ) {
                    eventColors.push('white');
                }
                $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', eventColors);
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = eventColors;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventColor')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = $(ev.currentTarget).val();
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventSinceYear')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.since_year = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventUntilYear')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                if($(ev.currentTarget).val() !== '') {
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.until_year = parseInt($(ev.currentTarget).val());
                } else {
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.until_year;
                }
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventStrtotimeSwitch')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                if(false === $(ev.currentTarget).prop('checked')) {
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.strtotime;
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.day = 1;
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.month = 1;
                    let $strToTimeFormGroup = $(ev.currentTarget).closest('.form-group');
                    $strToTimeFormGroup.removeClass('col-sm-3').addClass('col-sm-2');
                    let $litEventStrtotime = $strToTimeFormGroup.find('.litEventStrtotime');
                    let dayId = $litEventStrtotime.attr('id').replace('Strtotime', 'Day');
                    let monthId = $litEventStrtotime.attr('id').replace('Strtotime', 'Month');
                    $strToTimeFormGroup.before(`<div class="form-group col-sm-1">
                    <label for="${dayId}">${Messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" />
                    </div>`);
                    $litEventStrtotime.remove();
                    let formRow = `<select class="form-select litEvent litEventMonth" id="${monthId}">`;
                    let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
                    for (let i = 0; i < 12; i++) {
                        let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                        formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
                    }
                    formRow += `</select>`;
                    $strToTimeFormGroup.append(formRow);
                    $strToTimeFormGroup.find('.month-label').text(Messages[ 'Month' ]).attr('for',monthId);
                } else {
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.day;
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.month;
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.strtotime = '';
                    $row.find('.litEventDay').closest('.form-group').remove();
                    let $litEventMonthFormGrp = $(ev.currentTarget).closest('.form-group');
                    let $litEventMonth = $litEventMonthFormGrp.find('.litEventMonth');
                    let strtotimeId = $litEventMonth.attr('id').replace('Month','Strtotime');
                    $litEventMonthFormGrp.removeClass('col-sm-2').addClass('col-sm-3');
                    $litEventMonth.remove();
                    $litEventMonthFormGrp.find('.month-label').text('Relative date').attr('for',strtotimeId);
                    $litEventMonthFormGrp.append(`<input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="${strtotimeId}" />`);
                }
            }
        } else {
            alert('this switch is disabled as long as the festivity row does not have a festivity name!');
            //ev.preventDefault();
            if( false === $(ev.currentTarget).prop('checked') ) {
                $(ev.currentTarget).prop('checked', true);
            } else {
                $(ev.currentTarget).prop('checked', false);
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventStrtotime')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.strtotime = $(ev.currentTarget).val();
            }
        }
    }
});

$(document).on('click', '.onTheFlyEventRow', ev => {
    let $row;
    switch (ev.currentTarget.id) {
        case "addSolemnity":
            FormControls.title = Messages['Other Solemnity'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').first().find('form').append($row);
            break;
        case "addFeast":
            FormControls.title = Messages['Other Feast'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').eq(1).find('form').append($row);
            break;
        case "addMemorial":
            FormControls.title = Messages['Other Memorial'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').eq(2).find('form').append($row);
            break;
        case "addOptionalMemorial":
            FormControls.title = Messages['Other Optional Memorial'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').eq(3).find('form').append($row);
            break;
    }

    setCommonMultiselect( $row, null );
    $row.find('.litEventColor').multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    });
    //$row.find('.litEventStrtotimeSwitch').bootstrapToggle();
});


$(document).on('change', '.calendarLocales', ev => {
    const updatedLocales = $(ev.currentTarget).val();
    console.log('updatedLocales:');
    console.log(updatedLocales);
    const updatedLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, localeDisplayName]) => {
        return updatedLocales.includes(localeIso);
    });
    document.querySelector('.currentLocalizationChoices').innerHTML = updatedLocalizationChoices.map(([localeIso, localeDisplayName]) => {
        return `<option value="${localeIso}">${localeDisplayName}</option>`;
    });
});

jQuery(document).ready(() => {
    let $carousel = $('.carousel').carousel();

    $carousel.on('slide.bs.carousel', event => {
        $('#diocesanCalendarDefinitionCardLinks li').removeClass('active');
        if (event.to == 0) {
            $('#diocesanCalendarDefinitionCardLinks li:first-child').addClass('disabled');
            $('#diocesanCalendarDefinitionCardLinks li:last-child').removeClass('disabled');
        } else if (event.to == 3) {
            $('#diocesanCalendarDefinitionCardLinks li:last-child').addClass('disabled');
            $('#diocesanCalendarDefinitionCardLinks li:first-child').removeClass('disabled');
        } else {
            $('#diocesanCalendarDefinitionCardLinks li:first-child').removeClass('disabled');
            $('#diocesanCalendarDefinitionCardLinks li:last-child').removeClass('disabled');
        }
        $('#diocesanCalendarDefinitionCardLinks li').find('[data-bs-slide-to=' + event.to + ']').parent('li').addClass('active');
    });

    $('.calendarLocales').multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        },
        maxHeight: 200,
        enableCaseInsensitiveFiltering: true
    });

    setCommonMultiselect(null, null);

    $('.litEventColor').multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    });

});

/**
 * Wider Region and National Calendar interactions
 */

$(document).on('change', '.regionalNationalCalendarName', ev => {
    API.category = ev.currentTarget.dataset.category;
    // our proxy will take care of splitting locale from wider region, when we are setting a wider region key
    API.key = ev.currentTarget.value;
    let nationalCalendarNotExists = true;

    const headers = {
        'Accept': 'application/json'
    };

    if ( API.category === 'nation' ) {
        const selectedNationalCalendar = CalendarsIndex.national_calendars.filter(item => item.calendar_id === API.key);
        if (selectedNationalCalendar.length > 0) {
            API.locale = selectedNationalCalendar[0].locales[0];
            headers['Accept-Language'] = API.locale.replaceAll('_', '-');
            nationalCalendarNotExists = false;
        }
    } else {
        headers['Accept-Language'] = API.locale.replaceAll('_', '-');
    }
    console.log(`API.path is ${API.path} (category is ${API.category} and key is ${API.key}). Locale set to ${API.locale === '' ? ' (empty string)' : API.locale}. Now checking if a calendar already exists...`);

    const eventsUrlForCurrentCategory = API.category === 'widerregion' || nationalCalendarNotExists
        ? `${EventsURL}`
        : `${EventsURL}/${API.category}/${API.key}`;

    fetch(eventsUrlForCurrentCategory, {
        method: 'GET',
        headers
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return Promise.reject(response);
        }
    }).then(json => {
        FestivityCollection = json.litcal_events;
        FestivityCollectionKeys = FestivityCollection.map(el => el.event_key);
        console.log( json.litcal_events );
        document.querySelector('#existingFestivitiesList').innerHTML = FestivityCollection.map(el => `<option value="${el.event_key}">${el.name}</option>`).join('\n');
    }).catch(error => {
        console.error(error);
    }).finally(() => {
        fetch(API.path, {
            method: 'GET',
            headers
        }).then(response => {
            if (response.ok) {
                document.querySelector('#removeExistingCalendarDataBtn').disabled = false;
                $('body').append(removeCalendarModal(`${API.category}/${API.key}`, Messages));
                return response.json();
            } else {
                document.querySelector('#removeExistingCalendarDataBtn').disabled = true;
                $('body').find('#removeCalendarPrompt').remove();
                const localeOptions = Object.entries(AvailableLocalesWithRegion).map(([localeIso, localeDisplayName]) => {
                    return `<option value="${localeIso}">${localeDisplayName}</option>`;
                });
                if (API.category === 'nation') {
                    $('form#nationalCalendarSettingsForm')[0].reset();
                    $('#publishedRomanMissalList').empty();
                    document.querySelector('#nationalCalendarLocales').innerHTML = localeOptions.join('\n');
                    document.querySelector('#currentLocalization').innerHTML = localeOptions.join('\n');
                    $('#nationalCalendarLocales').multiselect('rebuild');
                } else {
                    document.querySelector('#widerRegionLocales').innerHTML = localeOptions.join('\n');
                    document.querySelector('#currentLocalization').innerHTML = localeOptions.join('\n');
                    $('#widerRegionLocales').multiselect('rebuild');
                }
                $('.regionalNationalSettingsForm .form-select').not('[multiple]').each(function() {
                    $(this).val('').trigger('change');
                });

                return Promise.reject(response);
            }
        }).then(data => {
            console.log( `successfully retrieved the data file for the ${API.category} ${API.key}` );
            API.method = 'PATCH';
            console.log(data);
            switch(API.category) {
                case 'widerregion': {
                    FormControls.settings.decreeURLField = true;
                    FormControls.settings.decreeLangMapField = true;
                    $('#widerRegionLocales').multiselect('deselectAll', false).multiselect('select', data.metadata.locales);
                    const currentLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, localeDisplayName]) => {
                        return data.metadata.locales.includes(localeIso);
                    });
                    document.querySelector('.currentLocalizationChoices').innerHTML = currentLocalizationChoices.map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}">${localeDisplayName}</option>\n`;
                    });
                    document.querySelector('#currentLocalization').value = API.locale !== '' ? API.locale : data.metadata.locales[0];
                    break;
                }
                case 'nation': {
                    FormControls.settings.decreeURLField = true;
                    FormControls.settings.decreeLangMapField = false;
                    const { settings, metadata } = data;
                    $('#nationalCalendarSettingEpiphany').val( settings.epiphany );
                    $('#nationalCalendarSettingAscension').val( settings.ascension );
                    $('#nationalCalendarSettingCorpusChristi').val( settings.corpus_christi );
                    const localesForNation = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, localeDisplayName]) => {
                        return localeIso.split('_').pop() === API.key;
                    });
                    document.querySelector('#nationalCalendarLocales').innerHTML = localesForNation.map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}">${localeDisplayName}</option>\n`;
                    });
                    $('#nationalCalendarLocales').val(metadata.locales);
                    $('#nationalCalendarLocales').multiselect('rebuild');
                    const currentLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, localeDisplayName]) => {
                        return metadata.locales.includes(localeIso);
                    });
                    document.querySelector('.currentLocalizationChoices').innerHTML = currentLocalizationChoices.map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}">${localeDisplayName}</option>\n`;
                    });
                    document.querySelector('#currentLocalization').value = API.locale !== '' ? API.locale : metadata.locales[0];
                    $('#publishedRomanMissalList').empty().append( '<li class="list-group-item">' + metadata.missals.join('</li><li class="list-group-item">') + '</li>' );
                    $('#associatedWiderRegion').val( metadata.wider_region );
                    $('#nationalCalendarSettingHighPriest').prop('checked', settings.eternal_high_priest );
                }
            }
            $('.regionalNationalDataForm').empty();
            data.litcal.forEach((el) => {
                let currentUniqid = FormControls.uniqid;
                let existingFestivityTag = el.festivity.event_key ?? null;
                if( el.metadata.action === RowAction.CreateNew && FestivityCollectionKeys.includes( existingFestivityTag ) ) {
                    el.metadata.action = RowAction.CreateNewFromExisting;
                }
                setFormSettings( el.metadata.action );
                if( el.metadata.action === RowAction.SetProperty ) {
                    setFormSettingsForProperty( el.metadata.property );
                }
                /*
                if (FestivityCollectionKeys.includes( existingFestivityTag ) ) {
                    if( el.festivity.hasOwnProperty( 'name' ) === false ) {
                        el.festivity.name = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].name;
                    }
                    if( el.festivity.hasOwnProperty( 'day' ) === false ) {
                        el.festivity.day = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].day;
                    }
                    if( el.festivity.hasOwnProperty( 'month' ) === false ) {
                        el.festivity.month = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].month;
                    }
                    if( el.festivity.hasOwnProperty( 'grade' ) === false ) {
                        el.festivity.grade = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].grade;
                    }
                }*/
                let rowStr = FormControls.CreatePatronRow( el );
                let rowEls = $.parseHTML(rowStr);
                let $row = $(rowEls);
                $('.regionalNationalDataForm').append($row);

                let $formrow = $row.find('.form-group').closest('.row');
                $formrow.data('action', el.metadata.action).attr('data-action', el.metadata.action);

                if( el.metadata.action === RowAction.SetProperty ) {
                    $formrow.data('prop', el.metadata.property).attr('data-prop', el.metadata.property);
                }

                if( el.festivity.hasOwnProperty('common') && el.festivity.common.includes('Proper') ) {
                    $formrow.find('.litEventReadings').prop('disabled', false);
                }

                if( FormControls.settings.missalField && existingFestivityTag !== null ) {
                    const { missal } = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0];
                    $row.find(`#onTheFly${currentUniqid}Missal`).val(missal); //.prop('disabled', true);
                }
                $row.find('.litEventColor').multiselect({
                    buttonWidth: '100%',
                    buttonClass: 'form-select',
                    templates: {
                        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                    }
                }).multiselect('deselectAll', false);

                if( el.festivity.hasOwnProperty( 'color' ) === false && existingFestivityTag !== null ) {
                    console.log( 'retrieving default festivity info for ' + existingFestivityTag );
                    console.log( FestivityCollection.filter( el => el.event_key === existingFestivityTag )[0] );
                    el.festivity.color = FestivityCollection.filter( el => el.event_key === existingFestivityTag )[0].color;
                }

                $row.find('.litEventColor').multiselect('select', el.festivity.color);

                if(FormControls.settings.colorField === false) {
                    $row.find('.litEventColor').multiselect('disable');
                }

                if( el.festivity.hasOwnProperty( 'common' ) ) {
                    if(FormControls.settings.commonFieldShow) {
                        setCommonMultiselect( $row, el.festivity.common );
                        if(FormControls.settings.commonField === false) {
                            $row.find(`#onTheFly${currentUniqid}Common`).multiselect('disable');
                        }
                    }
                }

                if(FormControls.settings.gradeFieldShow) {
                    $row.find(`#onTheFly${currentUniqid}Grade`).val(el.festivity.grade);
                    if(FormControls.settings.gradeField === false) {
                        $row.find(`#onTheFly${currentUniqid}Grade`).prop('disabled', true);
                    }
                }

                if(FormControls.settings.missalField && el.metadata.hasOwnProperty('missal') ) {
                    $row.find(`#onTheFly${currentUniqid}Missal`).val(el.metadata.missal);
                }

                if(FormControls.settings.monthField === false) {
                    $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${el.festivity.month}])`).prop('disabled',true);
                }
            });
            $('.serializeRegionalNationalData').prop('disabled', false);
        }).catch(error => {
            if (404 === error.status || 400 === error.status) {
                API.method = 'PUT';
                error.json().then(json => {
                    const message = `${error.status} ${json.status} ${json.response}: ${json.description}<br />The Data File for the ${API.category} ${API.key} does not exist yet. Not that it's a big deal, just go ahead and create it now!`;
                    toastr["warning"](message, "Warning");
                    console.warn(message);
                });
                switch(API.category) {
                    case 'widerregion':
                        $('#widerRegionLocales').multiselect('deselectAll', false);
                        break;
                    case 'nation': {
                        $('form#nationalCalendarSettingsForm')[0].reset();
                        $('#publishedRomanMissalList').empty();
                        const LocalesForRegion = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, localeDisplayName]) => {
                            const jsLocaleStr = localeIso.replaceAll('_', '-');
                            const locale = new Intl.Locale(jsLocaleStr);
                            return locale.region === API.key;
                        });
                        const localeOptions = LocalesForRegion.map(([localeIso, localeDisplayName]) => {
                            return `<option value="${localeIso}">${localeDisplayName}</option>`;
                        });
                        document.querySelector('#nationalCalendarLocales').innerHTML = localeOptions.join('\n');
                        break;
                    }
                }
                $('form.regionalNationalDataForm').empty();
            } else {
                console.error(error);
                /*error.json().then(json => {
                    console.error(json);
                    //We're taking for granted that the API is sending back a JSON object with status, response and description
                    toastr["error"](json.status + ' ' + json.response + ': ' + json.description, "Error");
                });*/
            }
        });
    });

});

$(document).on('click', '.datetype-toggle-btn', ev => {
    const uniqid = parseInt( $(ev.currentTarget).attr('data-row-uniqid') );
    if( $(ev.currentTarget).hasClass('strtotime') ) {
        const monthVal = $(`#onTheFly${uniqid}Month`).val();
        const dayVal = $(`#onTheFly${uniqid}Day`).val();
        $(`#onTheFly${uniqid}Month`).closest('.form-group').remove();
        let $dayFormGroup = $(`#onTheFly${uniqid}Day`).closest('.form-group');
        const valueWas = $dayFormGroup.attr('data-valuewas');
        let strToTimeTemplate = `<label for="onTheFly${uniqid}Strtotime">Relative date</label>
            <input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!"
                value="${valueWas}" class="form-control litEvent litEventStrtotime" id="onTheFly${uniqid}Strtotime"
            />`;
        $dayFormGroup.empty().removeClass('col-sm-1').addClass('col-sm-2').attr('data-valuewas', `${dayVal}-${monthVal}`) .append(strToTimeTemplate);
    } else {
        const strToTimeVal = $(`#onTheFly${uniqid}Strtotime`).val();
        let $strToTimeFormGroup = $(`#onTheFly${uniqid}Strtotime`).closest('.form-group');
        const valueWas = $strToTimeFormGroup.attr('data-valuewas');
        const dayMonthWasVal = valueWas.split('-');
        const dayWasVal = dayMonthWasVal[0] !== '' ? dayMonthWasVal[0] : '1';
        const monthWasVal = dayMonthWasVal[1] ?? '';
        let dayTemplate = `<label for="onTheFly${uniqid}Day">Day</label>
            <input type="number" min="1" max="31" value=${parseInt(dayWasVal)} class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`;
        $strToTimeFormGroup.empty().removeClass('col-sm-2').addClass('col-sm-1').attr('data-valuewas', strToTimeVal).append(dayTemplate);
        let monthFormGroupTemplate = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${Messages[ "Month" ]}</label>
        <select class="form-select litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
        let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
        for (let i = 0; i < 12; i++) {
            let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
            monthFormGroupTemplate += `<option value=${i + 1}${monthWasVal === i + 1 ? ' selected' : ''}>${formatter.format(month)}</option>`;
        }
        monthFormGroupTemplate += `</select>
        </div>`;
        $strToTimeFormGroup.after(monthFormGroupTemplate);
    }
});

$(document).on('click', '.actionPromptButton', ev => {
    const currentUniqid = FormControls.uniqid;
    const $modal = $(ev.currentTarget).closest('.actionPromptModal');
    const $modalForm = $modal.find('form');
    const existingFestivityTag = sanitizeInput( $modalForm.find('.existingFestivityName').val() );
    let existingFestivity = FestivityCollection.filter(festivity => festivity.event_key === existingFestivityTag)[0] ?? null;
    let propertyToChange;
    let rowStr;
    let rowEls;
    let $row;
    //let buttonId = ev.currentTarget.id;
    //console.log(buttonId + ' button was clicked');
    FormControls.settings.decreeURLField = true;
    FormControls.settings.decreeLangMapField = document.querySelector('.regionalNationalCalendarName').id === 'widerRegionCalendarName';
    setFormSettings( ev.currentTarget.id );
    console.log(`FormControls.action = ${FormControls.action}, ev.currentTarget.id = ${ev.currentTarget.id}`);
    if( ev.currentTarget.id === 'setPropertyButton' ) {
        propertyToChange = $('#propertyToChange').val();
        setFormSettingsForProperty( propertyToChange );
    }

    if( existingFestivityTag !== '' ) {
        rowStr = FormControls.CreatePatronRow( existingFestivityTag );
        rowEls = $.parseHTML(rowStr);
        $row = $( rowEls );
        console.log($row);
        if( FormControls.settings.missalField ) {
            const { missal } = existingFestivity;
            $row.find(`#onTheFly${currentUniqid}Missal`).val(missal); //.prop('disabled', true);
        }
    } else {
        rowStr = FormControls.CreatePatronRow();
        rowEls = $.parseHTML( rowStr );
        $row = $( rowEls );
    }
    $('.regionalNationalDataForm').append($row);
    $modal.modal('hide');
    $row.find('.form-group').closest('.row').data('action', FormControls.action).attr('data-action', FormControls.action);
    if( FormControls.action === RowAction.SetProperty ) {
        console.log('propertyToChange is of type ' + typeof propertyToChange + ' and has a value of ' + propertyToChange);
        $row.find('.form-group').closest('.row').data('prop', propertyToChange).attr('data-prop', propertyToChange);
    }
    $row.find('.litEventColor').multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    }).multiselect('deselectAll', false);

    if(FormControls.settings.colorField === false) {
        $row.find('.litEventColor').multiselect('disable');
    }

    if(FormControls.settings.commonFieldShow) {
        setCommonMultiselect( $row, null );
        if(FormControls.settings.commonField === false) {
            $row.find(`#onTheFly${currentUniqid}Common`).multiselect('disable');
        }
    }

    if(FormControls.settings.gradeFieldShow && FormControls.settings.gradeField === false) {
        $row.find(`#onTheFly${currentUniqid}Grade`).prop('disabled', true);
    }

    if( existingFestivityTag !== '' ) {
        const litevent = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0];

        $row.find(`#onTheFly${currentUniqid}Grade`).val(litevent.grade);
        $row.find(`#onTheFly${currentUniqid}Common`).multiselect('select', litevent.common)
        const colorVal = Array.isArray( litevent.color ) ? litevent.color : litevent.color.split(',');
        $row.find(`.litEventColor`).multiselect('select', colorVal);

        if(FormControls.settings.monthField === false) {
            $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${litevent.month}])`).prop('disabled',true);
        }
    }

    if( $('.serializeRegionalNationalData').prop('disabled') ) {
        $('.serializeRegionalNationalData').prop('disabled', false);
    }

});

$(document).on('click', '#removeExistingCalendarDataBtn', evt => {
    // We don't want any forms to submit, so we prevent the default action
    evt.preventDefault();
});

$(document).on('click', '#deleteCalendarConfirm', () => {
    $('#deleteCalendarConfirm').blur(); // Remove focus from the button
    $('#removeCalendarDataPrompt').modal('hide');
    API.key = $('.regionalNationalCalendarName').val();
    API.category = $('.regionalNationalCalendarName').data('category');
    fetch(API.path, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            switch ( API.category ) {
                case 'widerregion':
                    CalendarsIndex.wider_regions = CalendarsIndex.wider_regions.filter(el => el.name !== API.key);
                    CalendarsIndex.wider_regions_keys = CalendarsIndex.wider_regions_keys.filter(el => el !== API.key);
                    break;
                case 'nation': {
                    CalendarsIndex.national_calendars = CalendarsIndex.national_calendars.filter(el => el.calendar_id !== API.key);
                    CalendarsIndex.national_calendars_keys = CalendarsIndex.national_calendars_keys.filter(el => el !== API.key);
                    $('form#nationalCalendarSettingsForm')[0].reset();
                    $('#publishedRomanMissalList').empty();
                    const localeOptions = Object.entries(AvailableLocalesWithRegion).map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}">${localeDisplayName}</option>`;
                    });
                    document.querySelector('#nationalCalendarLocales').innerHTML = localeOptions.join('\n');
                    document.querySelector('#currentLocalization').innerHTML = localeOptions.join('\n');
                    $('#nationalCalendarLocales').multiselect('rebuild');
                    $('.regionalNationalSettingsForm .form-select').not('[multiple]').each(function() {
                        $(this).val('').trigger('change');
                    });
                    break;
                }
            }
            $('#removeExistingCalendarDataBtn').prop('disabled', true);
            $('#removeCalendarDataPrompt').remove();
            $('.regionalNationalCalendarName').val('');
            $('.regionalNationalDataForm').empty();
            //$('.regionalNationalSettingsForm')[0].reset();
            toastr["success"](`Calendar '${API.category}/${API.key}' was deleted successfully`, "Success");
            response.json().then(json => {
                console.log(json);
            });
        } else {
            return Promise.reject(response);
        }
    }).catch(error => {
        console.error(error);
        /*error.json().then(json => {
            console.error(`${error.status} ${json.response}: ${json.description}`);
            toastr["error"](`${error.status} ${json.response}: ${json.description}`, "Error");
        });*/
    })
});

/**
 * @typedef {Object} RowData
 * @prop {Object} festivity
 * @prop {Object} metadata
 * @prop {RowAction} metadata.action
 */

/**
 * TODO: define payload classes for the various possible scenarios
 *
 * The following event handle is used to serialize the data from the wider region or national
 * calendar forms for submission to the API. The event handler receives the jQuery event object as
 * an argument, and prepares a JSON object as the payload with the following structure:
 *
 * The litcal object contains the liturgical events defined for the calendar.
 * litcal is an array of objects, each containing the information about a
 * single event in the calendar.
 * The object structure of the entries for the litcal array depend on the action being taken:
 *
 * - makePatron (will generally take a liturgical event that is already defined in the General Roman Calendar and allow to override the name and grade to indicate patronage):
 *      {
 *          "festivity": {
 *              "event_key": string,
 *              "name": string,
 *              "grade": number
 *          },
 *          "metadata": {
 *              "action": "makePatron"
 *          }
 *     }[]
 *
 * - setProperty (takes a liturgical event that is already defined in the General Roman Calendar and overrides the specified property of the liturgical event)
 *      {
 *          "festivity": {
 *              "event_key": string,
 *              "name": string,      // if metadata.property = 'name'
 *              "grade": number,     // if metadata.property = 'grade'
 *          },
 *          "metadata": {
 *              "action": "setProperty",
 *              "property": string
 *          }
 *     }[]
 *
 * - moveFestivity (takes a liturgical event that is already defined in the General Roman Calendar and moves it to a different date)
 *      {
 *          "festivity": {
 *              "event_key": string,
 *              "name": string,
 *              "day": number,
 *              "month": number,
 *              "missal": string,
 *              "reason": string
 *          },
 *          "metadata": {
 *              "action": "moveFestivity"
 *          }
 *     }[]
 *
 * - createNew (creates a new fixed date liturgical event for the wider region or national calendar)
 *      - createNew with common=Proper
 *      {
 *          "festivity": {
 *              "event_key": string,
 *              "name": string,
 *              "color": string[],
 *              "grade": number,
 *              "day": number,
 *              "month": number,
 *              "common": [ "Proper" ],
 *              "readings": {
 *                  "first_reading": string,
 *                  "second_reading": string (optional),
 *                  "responsorial_psalm": string,
 *                  "alleluia_verse": string,
 *                  "gospel": string
 *              }
 *          },
 *          "metadata": {
 *              "action": "createNew"
 *          }
 *     }[]
 *
 *     - createNew without common=Proper
 *      {
 *          "festivity": {
 *              "event_key": string,
 *              "name": string,
 *              "color": string[],
 *              "grade": number,
 *              "day": number,
 *              "month": number,
 *              "common": string[]
 *          },
 *          "metadata": {
 *              "action": "createNew"
 *          }
 *     }[]
 *   N.B. For the createNew action, if the liturgical event is mobile, the "day" and "month" properties will be omitted,
 *          and a "strtotime" property of type string will be added to the festivity object.
 *
 *   N.B. For any action, if since_year, until_year, url, or url_lang_map are defined, they will be added to the metadata object:
 *          - metadata.since_year,
 *          - metadata.until_year,
 *          - metadata.url,
 *          - metadata.url_lang_map
*/
$(document).on('click', '.serializeRegionalNationalData', ev => {
    API.category = $(ev.currentTarget).data('category');
    /**
     * @type {NationalCalendarPayload|WiderRegionPayload}
     */
    const payload = {};
    switch(API.category) {
        case 'nation': {
            API.key           = document.querySelector('#nationalCalendarName').value;
            API.locale        = document.querySelector('#currentLocalization').value;
            const widerRegion = document.querySelector('#associatedWiderRegion').value;
            payload.litcal    = [];
            payload.settings  = {
                epiphany:            document.querySelector('#nationalCalendarSettingEpiphany').value,
                ascension:           document.querySelector('#nationalCalendarSettingAscension').value,
                corpus_christi:      document.querySelector('#nationalCalendarSettingCorpusChristi').value,
                eternal_high_priest: document.querySelector('#nationalCalendarSettingHighPriest').checked,
            };
            payload.metadata  = {
                nation:       API.key,
                wider_region: widerRegion,
                missals:      $.map( $('#publishedRomanMissalList li'), el => { return $(el).text() }),
                locales:      $('#nationalCalendarLocales').val()
            };
            break;
        }
        case 'widerregion': {
            // our proxy will take care of splitting locale from wider region
            API.key = document.querySelector('#widerRegionCalendarName').value;
            const regionNamesLocalizedEng = new Intl.DisplayNames(['en'], { type: 'region' });
            let nationalCalendars = $('#widerRegionLocales').val().reduce((prev, curr) => {
                curr = curr.replaceAll('_', '-');
                // We have already exluded non-regional languages from the select list,
                // so we know we will always have a region associated with each of the selected languages.
                // Should we also define the language-region locale in the RomanMissal enum itself, on the API backend?
                // In that case we should try to get an exhaustive list of all printed Roman Missals since Vatican II.
                let locale = new Intl.Locale( curr );
                console.log( `curr = ${curr}, nation = ${locale.region}` );
                prev[ regionNamesLocalizedEng.of( locale.region ) ] = locale.region;
                return prev;
            }, {});
            payload.litcal = [];
            payload.national_calendars = nationalCalendars;
            payload.metadata = {
                locales: $('#widerRegionLocales').val(),
                wider_region: $('#widerRegionCalendarName').val()
            };
            break;
        }
    }
    let action;
    $('.regionalNationalDataForm .row').each((idx, el) => {
        action = $(el).data('action');
        console.log(`action = ${action}`);
        /**
         * @type RowData
         */
        let rowData = {
            festivity: {},
            metadata: {
                action
            }
        }
        if( action === RowAction.SetProperty ) {
            rowData.metadata.property = $(el).data('prop');
        }
        payloadProperties[action].forEach(prop => {
            let propClass = '.litEvent' + prop.charAt(0).toUpperCase() + prop.substring(1).toLowerCase();
            if( $(el).find(propClass).length ) {
                let val = $(el).find(propClass).val();
                if( integerProperties.includes(prop) ) {
                    val = parseInt( val );
                }
                if( metadataProperties.includes(prop) ) {
                    rowData.metadata[prop] = val;
                } else {
                    rowData.festivity[prop] = val;
                }
            }
        });
        if( action === RowAction.CreateNew && rowData.festivity.common.includes( 'Proper' ) ) {
            rowData.festivity.readings = {
                first_reading: $(el).find('.litEventReadings_FIRST_READING').val(),
                responsorial_psalm: $(el).find('.litEventReadings_RESPONSORIAL_PSALM').val(),
                alleluia_verse: $(el).find('.litEventReadings_ALLELUIA_VERSE').val(),
                gospel: $(el).find('.litEventReadings_GOSPEL').val()
            };
            if( $(el).find('.litEventReadings_SECOND_READING').val() !== "" ) {
                rowData.festivity.readings.second_reading = $(el).find('.litEventReadings_SECOND_READING').val();
            }
        }

        if( $(el).find('.litEventSinceYear').length ) {
            let sinceYear = parseInt($(el).find('.litEventSinceYear').val());
            if( sinceYear > 1582 && sinceYear <= 9999 ) {
                rowData.metadata.since_year = sinceYear;
            }
        }
        if( $(el).find('.litEventUntilYear').length ) {
            let untilYear = parseInt($(el).find('.litEventUntilYear').val());
            if( untilYear >= 1970 && untilYear <= 9999 ) {
                rowData.metadata.until_year = untilYear;
            }
        }
        if( $(el).find('.litEventDecreeURL').length ) {
            let decreeURL = $(el).find('.litEventDecreeURL').val();
            if( decreeURL !== '' ) {
                rowData.metadata.url = decreeURL;
            }
        }
        if( $(el).find('.litEventDecreeLangs').length ) {
            let decreeLangs = $(el).find('.litEventDecreeLangs').val();
            if( decreeLangs !== '' ) {
                rowData.metadata.url_lang_map = decreeLangs.split(',').reduce((prevVal, curVal) => { let assoc = curVal.split('='); prevVal[assoc[0]] = assoc[1]; return prevVal; }, {}) ;
            }
        }
        payload.litcal.push(rowData);
    });
    //console.log(payload);
    const finalPayload = Object.freeze(new NationalCalendarPayload(payload.litcal, payload.settings, payload.metadata));
    //console.log(finalPayload);
    //console.log(JSON.stringify(finalPayload))
    //console.log(`API.method = ${API.method}`);
    //console.log(`API.path = ${API.path}`);
    //console.log(`API.category = ${API.category}`);
    //console.log(`API.key = ${API.key}`);
    //console.log(`API.locale = ${API.locale}`);
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    if ( API.locale !== '' ) {
        headers['Accept-Language'] = API.locale;
    }
    fetch(API.path, {
        method: API.method,
        headers,
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(data => {
        console.log('Data returned from save action:', data);
        toastr["success"]("National Calendar was created or updated successfully", "Success");
    })
    .catch(error => {
        let errorBody = '';
        if (error && error.error) {
            errorBody = error.error;
            toastr["error"](error.status + ': ' + errorBody, "Error");
        } else {
            toastr["error"]('An error occurred', "Error");
        }
    });
});

/**
 * Diocesan Calendar interactions
 */

/**
 * Sets focus on the first tab of the diocesan calendar definition form with non-empty data.
 * @function setFocusFirstTabWithData
 */
const setFocusFirstTabWithData = () => {
    let $firstInputWithNonEmptyValue = $('.carousel-item form .litEventName')
        .filter(function(idx) {
            return $(this).val() !== "";
        })
        .first();
    let $parentCarouselItem = $firstInputWithNonEmptyValue.parents('.carousel-item');
    let itemIndex = $('.carousel-item').index( $parentCarouselItem );
    $('#diocesanCalendarDefinitionCardLinks li').removeClass('active');
    $('.carousel').carousel(itemIndex);
    $(`#diocesanCalendarDefinitionCardLinks li:nth-child(${itemIndex+2})`).addClass('active');
};

/**
 * @description Retrieves the data for the Diocesan Calendar associated with the currently selected diocese, and populates the edit form with the retrieved data.
 * @function loadDiocesanCalendarData
 */
const loadDiocesanCalendarData = () => {
    API.category = 'diocese';
    let diocese = $('#diocesanCalendarDioceseName').val();
    API.key = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value');
    let dioceseMetadata = CalendarsIndex.diocesan_calendars.filter(item => item.calendar_id === API.key)[0];
    API.locale = dioceseMetadata.locales[0];
    const headers = {
        'Accept': 'application/json',
        'Accept-Language': API.locale
    }
    fetch(API.path, {
        method: 'GET',
        headers
    }).then(response => {
        if(response.ok) {
            return response.json();
        } else if(response.status === 404) {
            toastr["warning"](response.status + ' ' + response.statusText + ': ' + response.url + '<br />The Diocesan Calendar for ' + diocese + ' does not exist yet.', "Warning");
            console.log(response.status + ' ' + response.statusText + ': ' + response.url + 'The Diocesan Calendar for ' + diocese + ' does not exist yet.');
            API.method = 'PUT';
            return Promise.resolve({});
        } else {
            throw new Error(response.status + ' ' + response.statusText + ': ' + response.url);
        }
    }).then(data => {
        API.method = 'PATCH';
        console.log('retrieved diocesan data:');
        console.log(data);
        toastr["success"]("Diocesan Calendar was retrieved successfully", "Success");
        CalendarData = data;
        if( data.hasOwnProperty('settings') ) {
            if( data.settings.hasOwnProperty('epiphany') ) {
                $('#diocesanCalendarOverrideEpiphany').val( data.settings.epiphany );
            }
            if( data.settings.hasOwnProperty('ascension') ) {
                $('#diocesanCalendarOverrideAscension').val( data.settings.ascension );
            }
            if( data.settings.hasOwnProperty('corpus_christi') ) {
                $('#diocesanCalendarOverrideCorpusChristi').val( data.settings.corpus_christi );
            }
        }
        fillDiocesanFormWithData(data);
        setFocusFirstTabWithData();
    }).catch(error => {
        if( error instanceof Error && error.message.startsWith('404') ) { //we have already handled 404 Not Found above
            return;
        }
        toastr["error"](error.message, "Error");
    });
}

/**
 * Replaces the day input and month select with a text input for strtotime.
 * @param {jQuery} $row - The containing row of the form.
 * @param {Object} Metadata - The metadata object from the JSON payload.
 */
const switcheroo = ( $row, Metadata ) => {
    $row.find('.litEventDay').closest('.form-group').remove();
    let $litEventMonth = $row.find('.litEventMonth');
    let $litEventMonthFormGrp = $litEventMonth.closest('.form-group');
    console.log($litEventMonth.attr('id'));
    let strtotimeId = $litEventMonth.attr('id').replace('Month', 'Strtotime');
    console.log(strtotimeId);
    $litEventMonthFormGrp.removeClass('col-sm-2').addClass('col-sm-3');
    $litEventMonth.remove();
    $litEventMonthFormGrp.find('.month-label').text('Relative date').attr('for', strtotimeId);
    $litEventMonthFormGrp.append(`<input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="${strtotimeId}" value="${Metadata.strtotime}" />`);
}

/**
 * Reverts the form row from a strtotime text input back to separate day and month fields.
 * Adjusts the form group classes to accommodate the change.
 * Inserts a day input and month select dropdown based on the provided festivity data.
 *
 * @param {jQuery} $row - The containing row of the form.
 * @param {Object} Festivity - The festivity data object containing day and month information.
 */
const unswitcheroo = ( $row, Festivity ) => {
    let $litEventStrtotime = $row.find('.litEventStrtotime');
    let $strToTimeFormGroup = $litEventStrtotime.closest('.form-group');
    $strToTimeFormGroup.removeClass('col-sm-3').addClass('col-sm-2');
    let dayId = $litEventStrtotime.attr('id').replace('Strtotime', 'Day');
    let monthId = $litEventStrtotime.attr('id').replace('Strtotime', 'Month');
    $strToTimeFormGroup.before(`<div class="form-group col-sm-1">
    <label for="${dayId}">${Messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" value="${Festivity.day}" />
    </div>`);
    $litEventStrtotime.remove();
    let formRow = `<select class="form-select litEvent litEventMonth" id="${monthId}">`;
    let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
    for (let i = 0; i < 12; i++) {
        let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
        formRow += `<option value=${i + 1}${(i+1)===Festivity.month ? ' selected' : ''}>${formatter.format(month)}</option>`;
    }
    formRow += `</select>`;
    $strToTimeFormGroup.append(formRow);
    $strToTimeFormGroup.find('.month-label').text(Messages[ 'Month' ]).attr('for',monthId);
}

const fillDiocesanFormWithData = (data) => {
    for (const entry of data.litcal) {
        const { festivity, metadata } = entry;
        let $form;
        let $row;
        let numLastRow;
        let numMissingRows;
        if(festivity.hasOwnProperty('strtotime')) {
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.strtotimeField = true;
        } else {
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.strtotimeField = false;
        }
        switch (festivity.grade) {
            case Rank.SOLEMNITY:
                $form = $('#carouselItemSolemnities form');
                numLastRow = $form.find('.row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Solemnity'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        $form.append($(FormControls.CreateFestivityRow()));
                    }
                }
                $row = $('#carouselItemSolemnities form .row').eq(metadata.form_rownum);
                break;
            case Rank.FEAST:
                numLastRow = $('#carouselItemFeasts form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Feast'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        $('.carousel-item').eq(1).find('form').append($(FormControls.CreateFestivityRow()));
                    }
                }
                $row = $('#carouselItemFeasts form .row').eq(metadata.form_rownum);
                break;
            case Rank.MEMORIAL:
                numLastRow = $('#carouselItemMemorials form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Memorial'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        $('.carousel-item').eq(2).find('form').append($(FormControls.CreateFestivityRow()));
                    }
                }
                $row = $('#carouselItemMemorials form .row').eq(metadata.form_rownum);
                break;
            case Rank.OPTIONALMEMORIAL:
                numLastRow = $('#carouselItemOptionalMemorials form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Optional Memorial'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        $('.carousel-item').eq(3).find('form').append($(FormControls.CreateFestivityRow()));
                    }
                }
                $row = $('#carouselItemOptionalMemorials form .row').eq(metadata.form_rownum);
                break;
        }
        $row.find('.litEventName').val(festivity.name).attr('data-valuewas', festivity.event_key);
        //if(metadata.form_rownum > 2) {
        //    $row.find('.litEventStrtotimeSwitch').bootstrapToggle();
        //}
        if( festivity.hasOwnProperty('strtotime') ) {
            if( $row.find('.litEventStrtotime').length === 0 ) {
                switcheroo( $row, metadata );
            }
            $row.find('.litEventStrtotime').val(festivity.strtotime);
        } else {
            if( $row.find('.litEventStrtotime').length > 0 ) {
                unswitcheroo( $row, festivity );
            }
            $row.find('.litEventDay').val(festivity.day);
            $row.find('.litEventMonth').val(festivity.month);
        }
        setCommonMultiselect( $row, festivity.common );
        $row.find('.litEventColor').multiselect({
            buttonWidth: '100%',
            buttonClass: 'form-select',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
            }
        }).multiselect('deselectAll', false).multiselect('select', festivity.color);
        $row.find('.litEventSinceYear').val(metadata.since_year);
        if( metadata.hasOwnProperty('until_year') ) {
            $row.find('.litEventUntilYear').val(metadata.until_year);
        }
    };
}

/**
 * @function diocesanOvveridesDefined
 * @description Returns true if at least one of the overrides for epiphany, ascension, or corpus christi have been set, false otherwise.
 * @returns {boolean}
 */
const diocesanOvveridesDefined = () => {
    return ( $('#diocesanCalendarOverrideEpiphany').val() !== "" || $('#diocesanCalendarOverrideAscension').val() !== "" || $('#diocesanCalendarOverrideCorpusChristi').val() !== "" );
}

$(document).on('change', '#diocesanCalendarNationalDependency', ev => {
    $('#diocesanCalendarDioceseName').val('');
    $('#removeExistingDiocesanDataBtn').prop('disabled', true);
    $('body').find('#removeDiocesanCalendarPrompt').remove();
    const currentSelectedNation = $(ev.currentTarget).val();
    const DiocesesForNation = Object.freeze(DiocesesList.filter(item => item.country_iso.toUpperCase() === currentSelectedNation)[0].dioceses);
    const LocalesForNation = Object.freeze(Object.entries(AvailableLocalesWithRegion).filter(([key, value]) => {
        return key.split('_' ).pop() === currentSelectedNation;
    }));
    $('#DiocesesList').empty();
    if (currentSelectedNation === 'US') {
        DiocesesForNation.forEach(item => $('#DiocesesList').append(`<option data-value="${item.diocese_id}" value="${item.diocese_name} (${item.province})">`));
    } else {
        DiocesesForNation.forEach(item => $('#DiocesesList').append('<option data-value="' + item.diocese_id + '" value="' + item.diocese_name + '">'));
    }
    if (LocalesForNation.length > 0) {
        document.querySelector('#diocesanCalendarLocales').innerHTML = LocalesForNation.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
        $('#diocesanCalendarLocales').multiselect('rebuild');
        document.querySelector('#currentLocalization').innerHTML = LocalesForNation.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
        document.querySelector('#currentLocalization').value = '';
    }
    document.querySelector('#diocesanCalendarGroup').value = '';
});

$(document).on('change', '#diocesanCalendarDioceseName', ev => {
    const currentVal = sanitizeInput( $(ev.currentTarget).val() );
    CalendarData = { litcal: {} };
    $('.carousel-item form').each((idx, el) => {
        el.reset();
        $(el).find('.row').slice(3).remove();
        $(el).find('div.data-group-title').remove();
        $(el).find('.litEventCommon').multiselect('deselectAll', false).multiselect('select', 'Proper');
        $(el).find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
        $(el).find('.litEventName').attr('data-valuewas', '');
    });
    $('form').each((idx, el) => { $(el).removeClass('was-validated') });
    //first we'll enforce only values from the current datalist
    if ($('#DiocesesList').find('option[value="' + currentVal + '"]').length > 0) {
        $(ev.currentTarget).removeClass('is-invalid');
        API.key = $('#DiocesesList').find('option[value="' + currentVal + '"]').attr('data-value');
        //console.log('selected diocese with key = ' + API.key);
        if (CalendarsIndex.diocesan_calendars_keys.includes(API.key)) {
            const diocesan_calendar = CalendarsIndex.diocesan_calendars.filter(el => el.calendar_id === API.key)[0];
            $('#removeExistingDiocesanDataBtn').prop('disabled', false);
            $('body').append(removeDiocesanCalendarModal(currentVal, Messages));
            if(diocesan_calendar.hasOwnProperty('group')){
                $('#diocesanCalendarGroup').val(diocesan_calendar.group);
            }
            loadDiocesanCalendarData();
            document.querySelector('#diocesanCalendarLocales').value = diocesan_calendar.locales;
            const LocalesForDiocese = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, localeDisplayName]) => {
                return diocesan_calendar.locales.includes(localeIso);
            });
            document.querySelector('#currentLocalization').innerHTML = LocalesForDiocese.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
            document.querySelector('#currentLocalization').value = API.locale;
            $('#diocesanCalendarLocales').multiselect('deselectAll', false).multiselect('select', diocesan_calendar.locales);
            //console.log('we have an existing entry for this diocese!');
        } else {
            $('#removeExistingDiocesanDataBtn').prop('disabled', true);
            $('body').find('#removeDiocesanCalendarPrompt').remove();
            //console.log('no existing entry for this diocese');
        }
    } else {
        $(ev.currentTarget).addClass('is-invalid');
    }
});

$(document).on('click', '#removeExistingDiocesanDataBtn', evt => {
    // We don't want any forms to submit, so we prevent the default action
    evt.preventDefault();
});

$(document).on('click', '#deleteDiocesanCalendarConfirm', () => {
    API.category = 'diocese';
    $('#removeDiocesanCalendarPrompt').modal('toggle');
    const diocese = $('#diocesanCalendarDioceseName').val();
    API.key = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value');
    let nation = $('#diocesanCalendarNationalDependency').val();
    /** @type {DiocesanCalendarDELETEPayload} */
    const payload = new DiocesanCalendarDELETEPayload(diocese, nation);
    fetch(API.path, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify( payload )
    }).then(response => {
        if (response.ok) {
            CalendarsIndex.diocesan_calendars = CalendarsIndex.diocesan_calendars.filter(el => el.calendar_id !== API.key);
            CalendarsIndex.diocesan_calendars_keys = CalendarsIndex.diocesan_calendars_keys.filter(el => el !== API.key);
            $('#removeExistingDiocesanDataBtn').prop('disabled', true);
            $('#removeDiocesanCalendarPrompt').remove();
            $('#diocesanCalendarDioceseName').val('');
            $('#diocesanCalendarNationalDependency').val('');
            $('#diocesanCalendarGroup').val('');
            $('.carousel-item form').each((idx, el) => {
                el.reset();
                $(el).find('.row').slice(3).remove();
                $(el).find('div.data-group-title').remove();
                $(el).find('.litEventCommon').multiselect('deselectAll', false).multiselect('select', 'Proper');
                $(el).find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                $(el).find('.litEventName').attr('data-valuewas', '');
            });
            toastr["success"](`Diocesan Calendar '${API.key}' was deleted successfully`, "Success");
            response.json().then(json => {
                console.log(json);
            });
        } else {
            return Promise.reject(response);
        }
    }).catch(error => {
        error.json().then(json => {
            console.error(`${error.status} ${json.response}: ${json.description}`);
            toastr["error"](`${error.status} ${json.response}: ${json.description}`, "Error");
        })
    })
});

$(document).on('click', '#saveDiocesanCalendar_btn', () => {
    //const nation = document.querySelector('#diocesanCalendarNationalDependency').value;
    const diocese = document.querySelector('#diocesanCalendarDioceseName').value;
    const option = document.querySelector('#DiocesesList option[value="' + diocese + '"]');
    const diocese_key = option ? option.getAttribute('data-value') : null;
    const saveObj = { payload: CalendarData };
    API.category = 'diocese';
    if (API.method === 'PATCH') {
        API.key = diocese_key;
    }
    API.locale = document.querySelector('#currentLocalization').value;

    // if the diocese overrides Epiphany, Ascension and Corpus Christi settings compared to the national calendar, add the settings to the payload
    if( diocesanOvveridesDefined() ) {
        saveObj.payload.settings = {};
        if( $('#diocesanCalendarOverrideEpiphany').val() !== "" ) {
            saveObj.payload.settings.epiphany = $('#diocesanCalendarOverrideEpiphany').val();
        }
        if( $('#diocesanCalendarOverrideAscension').val() !== "" ) {
            saveObj.payload.settings.ascension = $('#diocesanCalendarOverrideAscension').val();
        }
        if( $('#diocesanCalendarOverrideCorpusChristi').val() !== "" ) {
            saveObj.payload.settings.corpus_christi = $('#diocesanCalendarOverrideCorpusChristi').val();
        }
    }

    let formsValid = true;
    $('form').find('.row').each((idx,row) => {
        if( $(row).find('.litEventName').val() !== '' ) {
            $(row).find('input,select').each((idx, el) => {
                if (el.checkValidity() === false) {
                    formsValid = false;
                    alert(el.validationMessage);
                }
                $(el).addClass('was-validated');
            });
        }
    });
    if ( formsValid ) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (API.locale !== '') {
            headers['Accept-Language'] = API.locale;
        }
        const body = JSON.stringify(saveObj.payload);

        fetch(API.path, {
            method: API.method,
            headers,
            body
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            console.log('Data returned from save action:', data);
            toastr["success"]("Diocesan Calendar was created or updated successfully", "Success");
        })
        .catch(error => {
            console.error('Error:', error);
            toastr["error"](error.status + ' ' + error.message, "Error");
        });
    }
});

$(document).on('click', '#diocesanCalendarDefinitionCardLinks a.page-link', ev => {
    ev.preventDefault();
    $('#diocesanCalendarDefinitionCardLinks li').removeClass('active');
    //console.log("you clicked " + $(ev.currentTarget).text());
    if ($(ev.currentTarget).hasClass('diocesan-carousel-next')) {
        $('.carousel').carousel('next');
    } else if ($(ev.currentTarget).hasClass('diocesan-carousel-prev')) {
        $('.carousel').carousel('prev');
    } else {
        $(ev.currentTarget).parent('li').addClass('active');
        $('.carousel').carousel(parseInt($(ev.currentTarget).attr('data-bs-slide-to')));
    }
});

$(document).on('change', '.existingFestivityName', ev => {
    const $modal = $(ev.currentTarget).closest('.actionPromptModal');
    const $form = $modal.find('form');
    $form.each((idx, el) => { $(el).removeClass('was-validated') });
    let disabledState;
    if ($('#existingFestivitiesList').find('option[value="' + $(ev.currentTarget).val() + '"]').length > 0) {
        disabledState = false;
        if( $(ev.currentTarget).prop('required') ) {
            $(ev.currentTarget).removeClass('is-invalid');
        }
    } else {
        disabledState = true;
        if( $(ev.currentTarget).prop('required') ) {
            $(ev.currentTarget).addClass('is-invalid');
        }
    }
    switch( $modal.attr("id") ) {
        case 'makePatronActionPrompt':
            $('#designatePatronButton').prop('disabled', disabledState);
            break;
        case 'setPropertyActionPrompt':
            $('#setPropertyButton').prop('disabled', disabledState);
            break;
        case 'moveFestivityActionPrompt':
            $('#moveFestivityButton').prop('disabled', disabledState);
            break;
        case 'newFestivityActionPrompt':
            $('#newFestivityFromExistingButton').prop('disabled', disabledState);
            $('#newFestivityExNovoButton').prop('disabled', !disabledState);
            break;
    }
});

$(document).on('change', '#languageEditionRomanMissalName', ev => {
    $('#addLanguageEditionRomanMissal').prop('disabled', false);
});

$(document).on('click', '#addLanguageEditionRomanMissal', ev => {
    let languageEditionRomanMissal = sanitizeInput( $('#languageEditionRomanMissalName').val() );
    $('#publishedRomanMissalList').append(`<li class="list-group-item">${languageEditionRomanMissal}</li>`);
    let $modal = $(ev.currentTarget).closest('.modal');
    $modal.modal('hide');
});
