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

// the Messages global is set in extending.php
const { LOCALE, AvailableLocales, AvailableLocalesWithRegion, CountriesWithCatholicDioceses } = Messages;
const jsLocale = LOCALE.replace('_', '-');
FormControls.jsLocale = jsLocale;
FormControls.weekdayFormatter = new Intl.DateTimeFormat(jsLocale, { weekday: "long" });
FormControls.index = LitCalMetadata;

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

let DiocesesList = null;
let CalendarData = { litcal: [], i18n: {} };
let MissalsIndex = null;
let tzdata;
let translationData = {};

Promise.all([
    fetch('./assets/data/WorldDiocesesByNation.json', {
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
    }),
    fetch('https://raw.githubusercontent.com/vvo/tzdb/refs/heads/main/raw-time-zones.json', {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    })
]).then(responses => {
    return Promise.all(responses.map((response) => {
        if (response.ok) {
            return response.json();
        }
        else {
            throw new Error(response.status + ': ' + response.text);
        }
    }));
}).then(data => {
    DiocesesList = data[0].catholic_dioceses_latin_rite;

    if (data[1].hasOwnProperty('litcal_missals')) {
        console.log('retrieved /missals metadata:');
        console.log(data[1]);
        MissalsIndex = data[1].litcal_missals;
        FormControls.missals = data[1].litcal_missals;
        const publishedRomanMissalsStr = MissalsIndex.map(({missal_id, name}) => !missal_id.startsWith('EDITIO_TYPICA_') ? `<option class="list-group-item" value="${missal_id}">${name}</option>` : null).join('')
        document.querySelector('#languageEditionRomanMissalList').insertAdjacentHTML('beforeend', publishedRomanMissalsStr);
        toastr["success"]('Successfully retrieved data from /missals path', "Success");
    }

    tzdata = data[2];
    toastr["success"]('Successfully retrieved time zone data', "Success");
}).catch(error => {
    console.error(error);
    toastr["error"](error, "Error");
});


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
                // the path will be set based on the method, category and key parameters
                if (target.hasOwnProperty('method') && target['method'] === 'PUT') {
                    if (target.hasOwnProperty('category') && target['category'] !== '') {
                        value = `${RegionalDataURL}/${target['category']}`;
                    } else {
                        value = `${RegionalDataURL}`;
                    }
                } else {
                    if (target.hasOwnProperty('category') && target['category'] !== '' && target.hasOwnProperty('key') && target['key'] !== '') {
                        value = `${RegionalDataURL}/${target['category']}/${target['key']}`;
                    }
                    else if (target.hasOwnProperty('category') && target['category'] !== '') {
                        value = `${RegionalDataURL}/${target['category']}`;
                    }
                }
                break;
            case 'category':
                if (false === ['widerregion', 'nation', 'diocese'].includes(value)) {
                    console.error(`property 'category' of this object must be one of the values 'widerregion', 'nation', or 'diocese'`);
                    return;
                }
                if (target.hasOwnProperty('method') && target['method'] === 'PUT') {
                    target['path'] = `${RegionalDataURL}/${value}`;
                } else {
                    if (target.hasOwnProperty('key') && target['key'] !== '') {
                        target['path'] = `${RegionalDataURL}/${value}/${target['key']}`;
                    }
                    else {
                        target['path'] = `${RegionalDataURL}/${value}`;
                    }
                }
                break;
            case 'key':
                if (target['category'] === 'widerregion') {
                    if (value.includes(' - ')) {
                        ([value, target['locale']] = value.split(' - '));
                    }
                    if (false === ['Americas', 'Europe', 'Africa', 'Oceania', 'Asia', 'Antarctica'].includes(value)) {
                        console.error(`property 'key=${value}' of this object is not a valid value, valid values are: 'Americas', 'Europe', 'Africa', 'Oceania', 'Asia' and 'Antarctica'`);
                        return;
                    }
                }
                else if (target['category'] === 'nation') {
                    if (false === Object.keys(CountriesWithCatholicDioceses).includes(value)) {
                        console.error(`property 'key=${value}' of this object is not a valid value, possible values are: ${Object.keys(CountriesWithCatholicDioceses).join(', ')}`);
                        return;
                    }
                    if (false === LitCalMetadata.national_calendars_keys.includes(value)) {
                        console.warn(`property 'key=${value}' of this object is not yet defined, defined values are: ${LitCalMetadata.national_calendars_keys.join(', ')}`);
                    }
                }
                else if (target['category'] === 'diocese') {
                    if (false === LitCalMetadata.diocesan_calendars_keys.includes(value)) {
                        console.warn(`property 'key=${value}' is not yet defined, defined values are: ${LitCalMetadata.diocesan_calendars_keys.join(', ')}; no worries, let's go ahead and create it! We just have to make sure that API.method is set to 'PUT', currently it is set to '${target['method']}'`);
                    } else {
                        console.info(`property 'key=${value}' seems to be defined, defined values are: ${LitCalMetadata.diocesan_calendars_keys.join(', ')}`);
                    }
                } else {
                    console.error(`property 'category=${target['category']}' of this object is not a valid value, possible values are: 'widerregion', 'nation' or 'diocese'`);
                    return;
                }
                if (target.hasOwnProperty('category') && target['category'] !== '') {
                    if (target.hasOwnProperty('method') && target['method'] === 'PUT') {
                        target['path'] = `${RegionalDataURL}/${target['category']}`;
                    } else {
                        target['path'] = `${RegionalDataURL}/${target['category']}/${value}`;
                    }
                }
                break;
            case 'locale':
                if (false === Object.keys(AvailableLocales).includes(value) && false === Object.keys(AvailableLocalesWithRegion).includes(value)) {
                    console.error(`property 'locale=${value}' of this object is not a valid value, possible values are: ${Object.keys(AvailableLocales).join(', ')}, ${Object.keys(AvailableLocalesWithRegion).join(', ')}`);
                    return;
                }
                break;
            case 'method':
                if (false === ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(value)) {
                    console.error(`property 'method=${value}' of this object is not a valid value, possible values are: 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'`);
                    return;
                }
                if (value === 'PUT') {
                    if (target.hasOwnProperty('category') && target['category'] !== '') {
                        target['path'] = `${RegionalDataURL}/${target['category']}`;
                    }
                } else {
                    if (target.hasOwnProperty('category') && target['category'] !== '' && target.hasOwnProperty('key') && target['key'] !== '') {
                        target['path'] = `${RegionalDataURL}/${target['category']}/${target['key']}`;
                    }
                    else if (target.hasOwnProperty('category') && target['category'] !== '') {
                        target['path'] = `${RegionalDataURL}/${target['category']}`;
                    }
                }
                break;
            default:
                console.error('unexpected property ' + prop + ' of type ' + typeof prop + ' on target of type ' + typeof target);
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

const translationTemplate = (locale, el) => {
    const localeStr = locale.replace(/_/g, '-');
    const localeObj = new Intl.Locale(localeStr);
    const lang = localeObj.language.toUpperCase();
    const langWithRegion = AvailableLocalesWithRegion[locale];
    const eventKeyEl = el.parentElement.querySelector('.litEventEvent_key');
    const eventKey = eventKeyEl ? eventKeyEl.value : (el.dataset.hasOwnProperty('valuewas') ? el.dataset.valuewas : '');
    const value = translationData[locale].hasOwnProperty(eventKey) ? ` value="${translationData[locale][eventKey]}"` : '';
    return `<div class="input-group input-group-sm mt-1">
            <label class="input-group-text font-monospace" for="${el.id}_${locale}" title="${langWithRegion}">${lang}</label>
            <input type="text" class="form-control litEvent litEventName_${lang}" id="${el.id}_${locale}" data-locale="${locale}"${value}>
        </div>`;
}

/**
 * All Calendars interactions
 */

$(document).on('change', '.litEvent', ev => {
    let row = ev.target.closest('.row');
    let card = ev.target.closest('.card-body');

    if (ev.target.classList.contains('litEventName')) {
        //console.log('LitEvent name has changed');
        if (ev.target.value === '') {
            //empty value probably means we are trying to delete an already defined event
            //so let's find the key and remove it
            const oldEventKey = ev.target.dataset.valuewas;
            console.log('seems we are trying to delete the object key ' + oldEventKey);
            CalendarData.litcal = CalendarData.litcal.filter(item => item.festivity.event_key !== oldEventKey);
            ev.target.setAttribute('data-valuewas', '');
        } else {
            const eventKey = ev.target.value.replace(/[^a-zA-Z]/gi, '');
            console.log('new LitEvent name identifier is ' + eventKey);
            console.log('festivity name is ' + ev.target.value);
            console.log(CalendarData);
            if (ev.target.dataset.valuewas === '' && CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length === 0) {
                console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                const newEvent = { festivity: {}, metadata: {} };
                const colorSelectedOptions = Array.from(row.querySelector('.litEventColor').selectedOptions);
                const commonSelectedOptions = Array.from(row.querySelector('.litEventCommon').selectedOptions);
                newEvent.festivity = new LitEvent(
                    eventKey,
                    ev.target.value, //name
                    colorSelectedOptions.map(({ value }) => value), //color
                    null,
                    commonSelectedOptions.map(({ value }) => value), //common
                    parseInt(row.querySelector('.litEventDay').value), //day
                    parseInt(row.querySelector('.litEventMonth').value), //month
                );
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                newEvent.metadata.since_year = parseInt(row.querySelector('.litEventSinceYear').value);
                if ( row.querySelector('.litEventUntilYear').value !== '' ) {
                    newEvent.metadata.until_year = parseInt(row.querySelector('.litEventUntilYear').value);
                }
                const formRowIndex = Array.from(card.querySelectorAll('.row')).indexOf(row);
                newEvent.metadata.form_rownum = formRowIndex;
                console.log('form row index is ' + formRowIndex);
                ev.target.setAttribute('data-valuewas', eventKey);
                ev.target.classList.remove('is-invalid');
                console.log('adding new event to CalendarData.litcal:');
                console.log( newEvent );
                if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
                    const currentLocalization = document.querySelector('#currentLocalization').value;
                    const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions).filter(({ value }) => value !== currentLocalization).map(({ value }) => value);
                    const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(localization, ev.target));
                    ev.target.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
                }
                CalendarData.litcal.push(newEvent);
            } else if (ev.target.dataset.valuewas !== '') {
                const oldEventKey = ev.target.dataset.valuewas;
                console.log('the preceding value here was ' + oldEventKey);
                if (CalendarData.litcal.filter(item => item.festivity.event_key === oldEventKey).length > 0) {
                    if (oldEventKey !== eventKey) {
                        console.log('I see you are trying to change the name of a festivity that was already defined. This will effectively change the relative key also, so here is what we are going to do:');
                        console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
                        const copiedEvent = CalendarData.litcal.filter(item => item.festivity.event_key === oldEventKey)[0];
                        copiedEvent.festivity.event_key = eventKey;
                        copiedEvent.festivity.name = ev.target.value;
                        CalendarData.litcal.push(copiedEvent);
                        CalendarData.litcal = CalendarData.litcal.filter(item => item.festivity.event_key !== oldEventKey);
                        ev.target.setAttribute('data-valuewas', eventKey);
                        ev.target.classList.remove('is-invalid');
                    }
                }
            } else if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                if ( false === CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.hasOwnProperty('until_year') ) {
                    console.log('exact same festivity name was already defined elsewhere! key ' + eventKey + ' already exists! and the untilYear property was not defined!');
                    ev.target.value = '';
                    ev.target.classList.add('is-invalid');
                } else {
                    const confrm = confirm('The same festivity name was already defined elsewhere. However an untilYear property was also defined, so perhaps you are wanting to define again for the years following. If this is the case, press OK, otherwise Cancel');
                    if (confrm) {
                        ev.target.classList.remove('is-invalid');
                        //retrieve untilYear from the previous festivity with the same name
                        const untilYear = CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.until_year;
                        //set the sinceYear field on this row to the previous untilYear plus one
                        row.querySelector('.litEventSinceYear').value = (untilYear + 1);
                        row.querySelector('.litEventUntilYear').min = (untilYear + 2);
                        //update our eventKey to be distinct from the previous festivity
                        ev.target.setAttribute('data-valuewas', eventKey);
                        const newEvent = { festivity: {}, metadata: {} };
                        const colorSelectedOptions = Array.from(row.querySelector('.litEventColor').selectedOptions);
                        const commonSelectedOptions = Array.from(row.querySelector('.litEventCommon').selectedOptions);
                        newEvent.festivity = new LitEvent(
                            eventKey,
                            ev.target.value, //name
                            colorSelectedOptions.map(({ value }) => value), //color
                            null,
                            commonSelectedOptions.map(({ value }) => value), //common
                            parseInt(row.querySelector('.litEventDay').value), //day
                            parseInt(row.querySelector('.litEventMonth').value), //month
                        );
                        newEvent.metadata.since_year = untilYear + 1;
                        const formRowIndex = Array.from(card.querySelectorAll('.row')).indexOf(row);
                        newEvent.metadata.form_rownum = formRowIndex;
                        console.log('form row index is ' + formRowIndex);
                        CalendarData.litcal.push(newEvent);
                    }
                }
            }
            switch (ev.target.closest('.carousel-item').id) {
                case 'carouselItemSolemnities':
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.grade = 6;
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
            if (ev.target.value.match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                $(row.querySelector('.litEventColor')).multiselect('deselectAll', false).multiselect('select', 'red');
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = [ 'red' ];
            } else {
                $(row.querySelector('.litEventColor')).multiselect('deselectAll', false).multiselect('select', 'white');
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = [ 'white' ];
            }
        }
    } else if (ev.target.classList.contains('litEventDay')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.day = parseInt(ev.target.value);
            }
        }
    } else if (ev.target.classList.contains('litEventMonth')) {
        const selcdMonth = parseInt(ev.target.value);
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.month = selcdMonth;
            }
        }
        row.querySelector('.litEventDay').max = selcdMonth === Month.FEBRUARY ? 28 : (MonthsOfThirty.includes(selcdMonth) ? 30 : 31);
        if (parseInt(row.querySelector('.litEventDay').value) > parseInt(row.querySelector('.litEventDay').max)) {
            row.querySelector('.litEventDay').value = parseInt(row.querySelector('.litEventDay').max);
        }
    } else if (ev.target.classList.contains('litEventCommon')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                const selectedOptions = Array.from(ev.target.selectedOptions);
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.common = selectedOptions.map(({ value }) => value);
                let eventColors = [];
                if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.common.some( m => /Martyrs/.test(m) )) {
                    eventColors.push('red');
                }
                if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.common.some( m => /(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/.test(m) ) ) {
                    eventColors.push('white');
                }
                $(row.querySelector('.litEventColor')).multiselect('deselectAll', false).multiselect('select', eventColors);
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = eventColors;
            }
        }
    } else if (ev.target.classList.contains('litEventColor')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                const selectedOptions = Array.from(ev.target.selectedOptions);
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.color = selectedOptions.map(({ value }) => value);;
            }
        }
    } else if (ev.target.classList.contains('litEventSinceYear')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.since_year = parseInt(ev.target.value);
            }
        }
        row.querySelector('.litEventUntilYear').min = parseInt(ev.target.value) + 1;
    } else if (ev.target.classList.contains('litEventUntilYear')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                if (ev.target.value !== '') {
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.until_year = parseInt(ev.target.value);
                } else {
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].metadata.until_year;
                }
            }
        }
    } else if (ev.target.classList.contains('litEventStrtotimeSwitch')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                if (false === ev.target.checked) {
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.strtotime;
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.day = 1;
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.month = 1;
                    const strToTimeFormGroup = ev.target.closest('.form-group');
                    strToTimeFormGroup.classList.remove('col-sm-3');
                    strToTimeFormGroup.classList.add('col-sm-2');
                    const litEventStrtotime = strToTimeFormGroup.querySelector('.litEventStrtotime');
                    const dayId = litEventStrtotime.id.replace('Strtotime', 'Day');
                    const monthId = litEventStrtotime.id.replace('Strtotime', 'Month');
                    strToTimeFormGroup.insertAdjacentHTML('beforebegin', `<div class="form-group col-sm-1">
                    <label for="${dayId}">${Messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" />
                    </div>`);
                    litEventStrtotime.remove();
                    let formRow = `<select class="form-select litEvent litEventMonth" id="${monthId}">`;
                    const formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
                    for (let i = 0; i < 12; i++) {
                        const month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                        formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
                    }
                    formRow += `</select>`;
                    strToTimeFormGroup.insertAdjacentHTML('beforeend', formRow);
                    strToTimeFormGroup.querySelector('.month-label').textContent = Messages[ 'Month' ];
                    strToTimeFormGroup.querySelector('.month-label').setAttribute('for', monthId);
                } else {
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.day;
                    delete CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.month;
                    CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.strtotime = '';

                    const dayFormGroup = row.querySelector('.litEventDay').closest('.form-group');
                    dayFormGroup.remove();

                    const litEventMonthFormGrp = ev.target.closest('.form-group');
                    const litEventMonth = litEventMonthFormGrp.querySelector('.litEventMonth');
                    const strtotimeId = litEventMonth.id.replace('Month', 'Strtotime');
                    litEventMonthFormGrp.classList.remove('col-sm-2');
                    litEventMonthFormGrp.classList.add('col-sm-3');
                    litEventMonth.remove();
                    litEventMonthFormGrp.querySelector('.month-label').textContent = 'Relative date';
                    litEventMonthFormGrp.querySelector('.month-label').setAttribute('for', strtotimeId);
                    litEventMonthFormGrp.insertAdjacentHTML('beforeend', `<input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="${strtotimeId}" />`);
                }
            }
        } else {
            alert('this switch is disabled as long as the festivity row does not have a festivity name!');
            //ev.preventDefault();
            ev.target.checked = !ev.target.checked;
        }
    } else if (ev.target.classList.contains('litEventStrtotime')) {
        if (row.querySelector('.litEventName').value !== '') {
            const eventKey = row.querySelector('.litEventName').dataset.valuewas;
            if (CalendarData.litcal.filter(item => item.festivity.event_key === eventKey).length > 0) {
                CalendarData.litcal.filter(item => item.festivity.event_key === eventKey)[0].festivity.strtotime = ev.target.value;
            }
        }
    }
});

$(document).on('click', '.onTheFlyEventRow', ev => {
    let row;
    let form;
    switch (ev.target.id) {
        case "addSolemnity":
            FormControls.title = Messages['Other Solemnity'];
            row = FormControls.CreateFestivityRow();
            form = document.querySelector('.carousel-item:nth-child(1) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
        case "addFeast":
            FormControls.title = Messages['Other Feast'];
            row = FormControls.CreateFestivityRow();
            form = document.querySelector('.carousel-item:nth-child(2) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
        case "addMemorial":
            FormControls.title = Messages['Other Memorial'];
            row = FormControls.CreateFestivityRow();
            form = document.querySelector('.carousel-item:nth-child(3) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
        case "addOptionalMemorial":
            FormControls.title = Messages['Other Optional Memorial'];
            row = FormControls.CreateFestivityRow();
            form = document.querySelector('.carousel-item:nth-child(4) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
    }

    setCommonMultiselect( form.lastElementChild, null );
    $(form.lastElementChild.querySelector('.litEventColor')).multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    });
});


$(document).on('change', '.calendarLocales', ev => {
    const calendarLocalesEl = document.querySelector('.calendarLocales');
    const updatedLocales = Array.from(calendarLocalesEl.selectedOptions).map(({ value }) => value);
    console.log('updatedLocales:', updatedLocales);
    const updatedLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
        return updatedLocales.includes(localeIso);
    });
    document.querySelector('.currentLocalizationChoices').innerHTML = updatedLocalizationChoices.map(([localeIso, localeDisplayName]) => {
        return `<option value="${localeIso}">${localeDisplayName}</option>`;
    });
});

jQuery(document).ready(() => {
    const carouselElement = document.querySelector('.carousel');
    if (carouselElement) {
        new bootstrap.Carousel(carouselElement);
        carouselElement.addEventListener('slide.bs.carousel', event => {
            const navLinks = document.querySelectorAll('#diocesanCalendarDefinitionCardLinks li');
            navLinks.forEach(link => link.classList.remove('active'));
            if (event.to === 0) {
                navLinks[0].classList.add('disabled');
                navLinks[navLinks.length - 1].classList.remove('disabled');
            } else if (event.to === 3) {
                navLinks[navLinks.length - 1].classList.add('disabled');
                navLinks[0].classList.remove('disabled');
            } else {
                navLinks[0].classList.remove('disabled');
                navLinks[navLinks.length - 1].classList.remove('disabled');
            }
            const targetLink = document.querySelector(`#diocesanCalendarDefinitionCardLinks li [data-bs-slide-to="${event.to}"]`);
            targetLink.parentElement.classList.add('active');
        });
    }

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
    API.category = ev.target.dataset.category;
    // our proxy will take care of splitting locale from wider region, when we are setting a wider region key
    API.key = ev.target.value;
    let nationalCalendarNotExists = true;

    const headers = {
        'Accept': 'application/json'
    };

    if ( API.category === 'nation' ) {
        const selectedNationalCalendar = LitCalMetadata.national_calendars.filter(item => item.calendar_id === API.key);
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
                document.querySelector('body').insertAdjacentHTML('beforeend', removeCalendarModal(`${API.category}/${API.key}`, Messages));
                return response.json();
            } else {
                document.querySelector('#removeExistingCalendarDataBtn').disabled = true;
                document.querySelector('#removeCalendarPrompt').remove();
                const localeOptions = Object.entries(AvailableLocalesWithRegion).map(([localeIso, localeDisplayName]) => {
                    return `<option value="${localeIso}">${localeDisplayName}</option>`;
                });
                if (API.category === 'nation') {
                    document.querySelector('#nationalCalendarSettingsForm').reset();
                    document.querySelector('#publishedRomanMissalList').innerHTML = '';
                    document.querySelector('#nationalCalendarLocales').innerHTML = localeOptions.join('\n');
                    document.querySelector('#currentLocalization').innerHTML = localeOptions.join('\n');
                    $('#nationalCalendarLocales').multiselect('rebuild');
                } else {
                    document.querySelector('#widerRegionLocales').innerHTML = localeOptions.join('\n');
                    document.querySelector('#currentLocalization').innerHTML = localeOptions.join('\n');
                    $('#widerRegionLocales').multiselect('rebuild');
                }

                document.querySelectorAll('.regionalNationalSettingsForm .form-select:not([multiple])').forEach(formSelect => {
                    formSelect.value = '';
                    formSelect.dispatchEvent(new Event('change'));
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
                    const currentLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
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

                    document.querySelector('#nationalCalendarSettingEpiphany').value = settings.epiphany;
                    document.querySelector('#nationalCalendarSettingAscension').value = settings.ascension;
                    document.querySelector('#nationalCalendarSettingCorpusChristi').value = settings.corpus_christi;

                    const localesForNation = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
                        return localeIso.split('_').pop() === API.key;
                    });

                    // Rebuild the #nationalCalendarLocales select
                    const nationalCalendarLocalesSelect = document.querySelector('#nationalCalendarLocales');
                    nationalCalendarLocalesSelect.innerHTML = localesForNation.map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}"${metadata.locales.includes(localeIso) ? ' selected' : ''}>${localeDisplayName}</option>\n`;
                    });
                    $('#nationalCalendarLocales').multiselect('rebuild');

                    // Rebuild the .currentLocalizationChoices select (same as #currentLocalization)
                    const currentLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
                        return metadata.locales.includes(localeIso);
                    });
                    document.querySelector('.currentLocalizationChoices').innerHTML = currentLocalizationChoices.map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}">${localeDisplayName}</option>\n`;
                    });
                    document.querySelector('#currentLocalization').value = API.locale !== '' ? API.locale : metadata.locales[0];

                    // Rebuild the #publishedRomanMissalList
                    const publishedRomanMissalList = document.querySelector('#publishedRomanMissalList');
                    publishedRomanMissalList.innerHTML = metadata.missals.map(missal => `<li class="list-group-item">${missal}</li>`).join('');

                    document.querySelector('#associatedWiderRegion').value = metadata.wider_region;
                    document.querySelector('#nationalCalendarSettingHighPriest').checked = settings.eternal_high_priest;
                }
            }
            document.querySelector('.regionalNationalDataForm').innerHTML = '';
            data.litcal.forEach((el) => {
                let currentUniqid = FormControls.uniqid;
                let existingFestivityTag = el.festivity.event_key ?? null;
                if ( el.metadata.action === RowAction.CreateNew && FestivityCollectionKeys.includes( existingFestivityTag ) ) {
                    el.metadata.action = RowAction.CreateNewFromExisting;
                }
                setFormSettings( el.metadata.action );
                if ( el.metadata.action === RowAction.SetProperty ) {
                    setFormSettingsForProperty( el.metadata.property );
                }
                /*
                if (FestivityCollectionKeys.includes( existingFestivityTag ) ) {
                    if ( el.festivity.hasOwnProperty( 'name' ) === false ) {
                        el.festivity.name = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].name;
                    }
                    if ( el.festivity.hasOwnProperty( 'day' ) === false ) {
                        el.festivity.day = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].day;
                    }
                    if ( el.festivity.hasOwnProperty( 'month' ) === false ) {
                        el.festivity.month = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].month;
                    }
                    if ( el.festivity.hasOwnProperty( 'grade' ) === false ) {
                        el.festivity.grade = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].grade;
                    }
                }*/
                let rowStr = FormControls.CreatePatronRow( el );
                let rowEls = $.parseHTML(rowStr);
                document.querySelector('.regionalNationalDataForm').append(...rowEls);

                let formrow = rowEls[1].querySelector('.form-group').closest('.row');
                formrow.setAttribute('data-action', el.metadata.action);

                if ( el.metadata.action === RowAction.SetProperty ) {
                    formrow.setAttribute('data-prop', el.metadata.property);
                }

                if ( el.festivity.hasOwnProperty('common') && el.festivity.common.includes('Proper') ) {
                    formrow.querySelector('.litEventReadings').disabled = false;
                }

                if ( FormControls.settings.missalField && existingFestivityTag !== null ) {
                    const { missal } = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0];
                    formrow.querySelector(`#onTheFly${currentUniqid}Missal`).value = missal;
                }

                $(formrow.querySelector('.litEventColor')).multiselect({
                    buttonWidth: '100%',
                    buttonClass: 'form-select',
                    templates: {
                        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                    }
                }).multiselect('deselectAll', false);

                if ( el.festivity.hasOwnProperty( 'color' ) === false && existingFestivityTag !== null ) {
                    console.log( 'retrieving default festivity info for ' + existingFestivityTag );
                    console.log( FestivityCollection.filter( el => el.event_key === existingFestivityTag )[0] );
                    el.festivity.color = FestivityCollection.filter( el => el.event_key === existingFestivityTag )[0].color;
                }

                $(formrow.querySelector('.litEventColor')).multiselect('select', el.festivity.color);

                if (FormControls.settings.colorField === false) {
                    $(formrow.querySelector('.litEventColor')).multiselect('disable');
                }

                if ( el.festivity.hasOwnProperty( 'common' ) ) {
                    if (FormControls.settings.commonFieldShow) {
                        setCommonMultiselect( formrow, el.festivity.common );
                        if (FormControls.settings.commonField === false) {
                            $(formrow.querySelector(`#onTheFly${currentUniqid}Common`)).multiselect('disable');
                        }
                    }
                }

                if (FormControls.settings.gradeFieldShow) {
                    formrow.querySelector(`#onTheFly${currentUniqid}Grade`).value = el.festivity.grade;
                    if (FormControls.settings.gradeField === false) {
                        formrow.querySelector(`#onTheFly${currentUniqid}Grade`).disabled = true;
                    }
                }

                if (FormControls.settings.missalField && el.metadata.hasOwnProperty('missal') ) {
                    formrow.querySelector(`#onTheFly${currentUniqid}Missal`).value = el.metadata.missal;
                }

                if (FormControls.settings.monthField === false) {
                    formrow.querySelectorAll(`#onTheFly${currentUniqid}Month > option[value]:not([value="${el.festivity.month}"])`).forEach(el => { el.disabled = true; });
                }
            });
            if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
                const currentLocalization = document.querySelector('#currentLocalization').value;
                const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions).filter(({ value }) => value !== currentLocalization).map(({ value }) => value);
                Promise.all(otherLocalizations.map(localization => fetch(API.path + '/' + localization).then(response => response.json()))).then(data => {
                    toastr["success"]("Calendar translation data was retrieved successfully", "Success");
                    data.forEach((localizationData, i) => {
                        translationData[otherLocalizations[i]] = localizationData;
                    });
                    console.log('translationData:', translationData);
                    Array.from(document.querySelectorAll('.litEventName')).filter(el => el.dataset.valuewas !== '').forEach(el => {
                        while (el.nextSibling) {
                            el.nextSibling.remove();
                        }
                        const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(localization, el));
                        el.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
                    });
                });
            }

            document.querySelector('.serializeRegionalNationalData').disabled = false;
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
                        document.querySelector('#nationalCalendarSettingsForm').reset();
                        document.querySelector('#publishedRomanMissalList').innerHTML = '';
                        const LocalesForRegion = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
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
                document.querySelector('.regionalNationalDataForm').innerHTML = '';
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
    const uniqid = parseInt( ev.target.dataset.rowUniqid);
    if ( ev.target.classList.contains('strtotime') ) {
        const monthVal = document.querySelector(`#onTheFly${uniqid}Month`).value;
        const dayVal = document.querySelector(`#onTheFly${uniqid}Day`).value;
        document.querySelector(`#onTheFly${uniqid}Month`).closest('.form-group').remove();
        const dayFormGroup = document.querySelector(`#onTheFly${uniqid}Day`).closest('.form-group');
        const valueWas = dayFormGroup.dataset.valuewas;
        const strToTimeTemplate = `<label for="onTheFly${uniqid}Strtotime">Relative date</label>
            <input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!"
                value="${valueWas}" class="form-control litEvent litEventStrtotime" id="onTheFly${uniqid}Strtotime"
            />`;
        dayFormGroup.innerHTML = '';
        dayFormGroup.classList.remove('col-sm-1');
        dayFormGroup.classList.add('col-sm-2');
        dayFormGroup.setAttribute('data-valuewas', `${dayVal}-${monthVal}`);
        dayFormGroup.insertAdjacentHTML('beforeend', strToTimeTemplate);
    } else {
        const strToTimeVal = document.querySelector(`#onTheFly${uniqid}Strtotime`).value;
        const strToTimeFormGroup = document.querySelector(`#onTheFly${uniqid}Strtotime`).closest('.form-group');
        const valueWas = strToTimeFormGroup.dataset.valuewas;
        const dayMonthWasVal = valueWas.split('-');
        const dayWasVal = dayMonthWasVal[0] !== '' ? dayMonthWasVal[0] : '1';
        const monthWasVal = dayMonthWasVal[1] ?? '';
        const dayTemplate = `<label for="onTheFly${uniqid}Day">Day</label>
            <input type="number" min="1" max="31" value=${parseInt(dayWasVal)} class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`;
        strToTimeFormGroup.innerHTML = '';
        strToTimeFormGroup.classList.remove('col-sm-2');
        strToTimeFormGroup.classList.add('col-sm-1');
        strToTimeFormGroup.setAttribute('data-valuewas', strToTimeVal);
        strToTimeFormGroup.insertAdjacentHTML('beforeend', dayTemplate);
        let monthFormGroupTemplate = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${Messages[ "Month" ]}</label>
        <select class="form-select litEvent litEventMonth" id="onTheFly${uniqid}Month">`;
        const formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
        for (let i = 0; i < 12; i++) {
            let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
            monthFormGroupTemplate += `<option value=${i + 1}${monthWasVal === i + 1 ? ' selected' : ''}>${formatter.format(month)}</option>`;
        }
        monthFormGroupTemplate += `</select></div>`;
        strToTimeFormGroup.insertAdjacentHTML('afterend', monthFormGroupTemplate);
    }
});

$(document).on('click', '.actionPromptButton', ev => {
    const currentUniqid = FormControls.uniqid;
    const modal = ev.target.closest('.actionPromptModal');
    const modalForm = modal.querySelector('form');
    const existingFestivityTag = sanitizeInput( modalForm.querySelector('.existingFestivityName').value );
    let existingFestivity = FestivityCollection.filter(festivity => festivity.event_key === existingFestivityTag)[0] ?? null;
    let propertyToChange;
    let rowStr;
    let rowEls;
    let formrow;
    //let buttonId = ev.target.id;
    //console.log(buttonId + ' button was clicked');
    FormControls.settings.decreeURLField = true;
    FormControls.settings.decreeLangMapField = document.querySelector('.regionalNationalCalendarName').id === 'widerRegionCalendarName';
    setFormSettings( ev.target.id );
    console.log(`FormControls.action = ${FormControls.action}, ev.target.id = ${ev.target.id}`);
    if ( ev.target.id === 'setPropertyButton' ) {
        propertyToChange = document.querySelector('#propertyToChange').value;
        setFormSettingsForProperty( propertyToChange );
    }

    if ( existingFestivityTag !== '' ) {
        rowStr = FormControls.CreatePatronRow( existingFestivityTag );
        rowEls = $.parseHTML(rowStr);
        formrow = rowEls[1].querySelector('.form-group').closest('.row');
        if ( FormControls.settings.missalField ) {
            const { missal } = existingFestivity;
            formrow.querySelector(`#onTheFly${currentUniqid}Missal`).value = missal; //.prop('disabled', true);
        }
    } else {
        rowStr = FormControls.CreatePatronRow();
        rowEls = $.parseHTML( rowStr );
        formrow = rowEls[1].querySelector('.form-group').closest('.row');
    }
    document.querySelector('.regionalNationalDataForm').append(...rowEls);
    bootstrap.Modal.getInstance(modal).hide();
    formrow.setAttribute('data-action', FormControls.action);
    if ( FormControls.action === RowAction.SetProperty ) {
        console.log('propertyToChange is of type ' + typeof propertyToChange + ' and has a value of ' + propertyToChange);
        formrow.setAttribute('data-prop', propertyToChange);
    }
    $(formrow.querySelector('.litEventColor')).multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    }).multiselect('deselectAll', false);

    if (FormControls.settings.colorField === false) {
        $(formrow.querySelector('.litEventColor')).multiselect('disable');
    }

    if (FormControls.settings.commonFieldShow) {
        setCommonMultiselect( formrow, null );
        if (FormControls.settings.commonField === false) {
            $(formrow.querySelector(`#onTheFly${currentUniqid}Common`)).multiselect('disable');
        }
    }

    if (FormControls.settings.gradeFieldShow) {
        formrow.querySelector(`#onTheFly${currentUniqid}Grade`).disabled = !FormControls.settings.gradeField;
    }

    if ( existingFestivityTag !== '' ) {
        const litevent = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0];

        if (FormControls.settings.gradeFieldShow) {
            formrow.querySelector(`#onTheFly${currentUniqid}Grade`).value = litevent.grade;
        }
        $(formrow.querySelector(`#onTheFly${currentUniqid}Common`)).multiselect('select', litevent.common);
        const colorVal = Array.isArray( litevent.color ) ? litevent.color : litevent.color.split(',');
        $(formrow.querySelector(`.litEventColor`)).multiselect('select', colorVal);

        if (FormControls.settings.monthField === false) {
            formrow.querySelectorAll(`#onTheFly${currentUniqid}Month > option[value]:not([value="${litevent.month}"])`).forEach(el => { el.disabled = true; });
        }
    }

    document.querySelector('.serializeRegionalNationalData').disabled = false;
});

$(document).on('click', '#removeExistingCalendarDataBtn', ev => {
    // We don't want any forms to submit, so we prevent the default action
    ev.preventDefault();
});

$(document).on('click', '#deleteCalendarConfirm', () => {

    document.querySelector('#deleteCalendarConfirm').blur(); // Remove focus from the button

    const removeCalendarDataPrompt = document.querySelector('#removeCalendarDataPrompt');
    bootstrap.Modal.getInstance(removeCalendarDataPrompt).hide();
    API.key = document.querySelector('.regionalNationalCalendarName').value;
    API.category = document.querySelector('.regionalNationalCalendarName').dataset.category;
    fetch(API.path, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            switch ( API.category ) {
                case 'widerregion':
                    LitCalMetadata.wider_regions = LitCalMetadata.wider_regions.filter(el => el.name !== API.key);
                    LitCalMetadata.wider_regions_keys = LitCalMetadata.wider_regions_keys.filter(el => el !== API.key);
                    break;
                case 'nation': {
                    LitCalMetadata.national_calendars = LitCalMetadata.national_calendars.filter(el => el.calendar_id !== API.key);
                    LitCalMetadata.national_calendars_keys = LitCalMetadata.national_calendars_keys.filter(el => el !== API.key);
                    document.querySelector('#nationalCalendarSettingsForm').reset();
                    document.querySelector('#publishedRomanMissalList').innerHTML = '';
                    const localeOptions = Object.entries(AvailableLocalesWithRegion).map(([localeIso, localeDisplayName]) => {
                        return `<option value="${localeIso}">${localeDisplayName}</option>`;
                    });
                    document.querySelector('#nationalCalendarLocales').innerHTML = localeOptions.join('\n');
                    document.querySelector('#currentLocalization').innerHTML = localeOptions.join('\n');
                    $('#nationalCalendarLocales').multiselect('rebuild');

                    document.querySelectorAll('.regionalNationalSettingsForm .form-select:not([multiple])').forEach(formSelect => {
                        formSelect.value = '';
                        formSelect.dispatchEvent(new Event('change'));
                    });
                    break;
                }
            }

            document.querySelector('#removeExistingCalendarDataBtn').disabled = true;
            document.querySelector('#removeCalendarDataPrompt').remove();
            document.querySelector('.regionalNationalCalendarName').value = '';
            document.querySelector('.regionalNationalDataForm').innerHTML = '';

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
    API.category = ev.target.dataset.category;
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
                eternal_high_priest: document.querySelector('#nationalCalendarSettingHighPriest').checked
            };
            const selectedLocales = document.querySelector('#nationalCalendarLocales').selectedOptions;
            payload.metadata  = {
                nation:       API.key,
                wider_region: widerRegion,
                missals:      Array.from(document.querySelectorAll('#publishedRomanMissalList li')).map(el => el.textContent),
                locales:      Array.from(selectedLocales).map(({ value }) => value)
            };
            break;
        }
        case 'widerregion': {
            // our proxy will take care of splitting locale from wider region
            API.key = document.querySelector('#widerRegionCalendarName').value;
            const regionNamesLocalizedEng = new Intl.DisplayNames(['en'], { type: 'region' });
            const selectedLocales = document.querySelector('#widerRegionLocales').selectedOptions;
            const nationalCalendars =  Array.from(selectedLocales).map(({ value }) => value).reduce((prev, curr) => {
                curr = curr.replaceAll('_', '-');
                // We have already exluded non-regional languages from the select list,
                // so we know we will always have a region associated with each of the selected languages.
                // Should we also define the language-region locale in the RomanMissal enum itself, on the API backend?
                // In that case we should try to get an exhaustive list of all printed Roman Missals since Vatican II.
                const locale = new Intl.Locale( curr );
                console.log( `curr = ${curr}, nation = ${locale.region}` );
                prev[ regionNamesLocalizedEng.of( locale.region ) ] = locale.region;
                return prev;
            }, {});
            payload.litcal = [];
            payload.national_calendars = nationalCalendars;
            payload.metadata = {
                locales: Array.from(selectedLocales).map(({ value }) => value),
                wider_region: document.querySelector('#widerRegionCalendarName').value
            };
            break;
        }
    }

    Array.from(document.querySelectorAll('.regionalNationalDataForm .row')).forEach(el => {
        const { action } = el.dataset;
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
        if ( action === RowAction.SetProperty ) {
            rowData.metadata.property = el.dataset.prop;
        }
        payloadProperties[action].forEach(prop => {
            const propClass = '.litEvent' + prop.charAt(0).toUpperCase() + prop.substring(1).toLowerCase();
            const propEl = el.querySelector(propClass);
            if ( propEl ) {
                let val = propEl.value;
                if ( integerProperties.includes(prop) ) {
                    val = parseInt( val );
                }
                if ( metadataProperties.includes(prop) ) {
                    rowData.metadata[prop] = val;
                } else {
                    rowData.festivity[prop] = val;
                }
            }
        });
        if ( action === RowAction.CreateNew && rowData.festivity.common.includes( 'Proper' ) ) {
            rowData.festivity.readings = {
                first_reading: el.querySelector('.litEventReadings_FIRST_READING').value,
                responsorial_psalm: el.querySelector('.litEventReadings_RESPONSORIAL_PSALM').value,
                alleluia_verse: el.querySelector('.litEventReadings_ALLELUIA_VERSE').value,
                gospel: el.querySelector('.litEventReadings_GOSPEL').value
            };
            if ( el.querySelector('.litEventReadings_SECOND_READING').value !== '' ) {
                rowData.festivity.readings.second_reading = el.querySelector('.litEventReadings_SECOND_READING').value;
            }
        }

        const litEventSinceYearEl = el.querySelector('.litEventSinceYear');
        if ( litEventSinceYearEl ) {
            const sinceYear = parseInt(litEventSinceYearEl.value);
            if ( sinceYear > 1582 && sinceYear <= 9999 ) {
                rowData.metadata.since_year = sinceYear;
            }
        }

        const litEventUntilYearEl = el.querySelector('.litEventUntilYear');
        if ( litEventUntilYearEl ) {
            const untilYear = parseInt(litEventUntilYearEl.value);
            if ( untilYear >= 1970 && untilYear <= 9999 ) {
                rowData.metadata.until_year = untilYear;
            }
        }

        const litEventDecreeUrlEl = el.querySelector('.litEventDecreeURL');
        if ( litEventDecreeUrlEl ) {
            const decreeURL = litEventDecreeUrlEl.value;
            if ( decreeURL !== '' ) {
                rowData.metadata.url = decreeURL;
            }
        }

        const litEventDecreeLangsEl = el.querySelector('.litEventDecreeLangs');
        if ( litEventDecreeLangsEl ) {
            const decreeLangs = litEventDecreeLangsEl.value;
            if ( decreeLangs !== '' ) {
                rowData.metadata.url_lang_map = decreeLangs.split(',').reduce((prevVal, curVal) => {
                    let assoc = curVal.split('=');
                    prevVal[assoc[0]] = assoc[1];
                    return prevVal;
                }, {}) ;
            }
        }
        payload.litcal.push(rowData);
    });

    const finalPayload = Object.freeze(new NationalCalendarPayload(payload.litcal, payload.settings, payload.metadata));

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
    document.querySelectorAll('#diocesanCalendarDefinitionCardLinks li').forEach(el => el.classList.remove('active'));
    const firstInputWithNonEmptyValue = Array.from(document.querySelectorAll('.carousel-item form .litEventName')).filter(el => el.dataset.valuewas !== '')[0];
    const parentCarouselItem = firstInputWithNonEmptyValue.closest('.carousel-item');
    const itemIndex = Array.from(document.querySelectorAll('.carousel-item')).indexOf(parentCarouselItem);
    const carouselElement = document.querySelector('.carousel');
    const carousel = bootstrap.Carousel.getInstance(carouselElement);
    carousel.to(itemIndex);
    document.querySelector(`#diocesanCalendarDefinitionCardLinks li:nth-child(${itemIndex+2})`).classList.add('active');
}

/**
 * @description Retrieves the data for the Diocesan Calendar associated with the currently selected diocese, and populates the edit form with the retrieved data.
 * @function loadDiocesanCalendarData
 */
const loadDiocesanCalendarData = () => {
    API.category = 'diocese';

    const dioceseSelect = document.getElementById('diocesanCalendarDioceseName');
    const diocese = dioceseSelect.value;
    const dioceseOption = document.querySelector(`#DiocesesList > option[value="${diocese}"]`);
    const dioceseKey = dioceseOption ? dioceseOption.dataset.value : null;
    API.key = dioceseKey;

    //let dioceseMetadata = LitCalMetadata.diocesan_calendars.filter(item => item.calendar_id === API.key)[0];
    API.locale = document.querySelector('#currentLocalization').value;
    const headers = {
        'Accept': 'application/json',
        'Accept-Language': API.locale
    }
    fetch(API.path, {
        method: 'GET',
        headers
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 404) {
            toastr["warning"](response.status + ' ' + response.statusText + ': ' + response.url + '<br />The Diocesan Calendar for ' + diocese + ' does not exist yet.', "Warning");
            console.log(response.status + ' ' + response.statusText + ': ' + response.url + 'The Diocesan Calendar for ' + diocese + ' does not exist yet.');
            API.method = 'PUT';
            return Promise.resolve({});
        } else {
            throw new Error(response.status + ' ' + response.statusText + ': ' + response.url);
        }
    }).then(data => {
        API.method = 'PATCH';
        console.log('retrieved diocesan data:', data);
        toastr["success"]("Diocesan Calendar was retrieved successfully", "Success");
        CalendarData = data;
        if (data.hasOwnProperty('settings')) {
            if (data.settings.hasOwnProperty('epiphany')) {
                document.getElementById('diocesanCalendarOverrideEpiphany').value = data.settings.epiphany;
            }
            if (data.settings.hasOwnProperty('ascension')) {
                document.getElementById('diocesanCalendarOverrideAscension').value = data.settings.ascension;
            }
            if (data.settings.hasOwnProperty('corpus_christi')) {
                document.getElementById('diocesanCalendarOverrideCorpusChristi').value = data.settings.corpus_christi;
            }
        }
        fillDiocesanFormWithData(data);
        if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
            const currentLocalization = document.querySelector('#currentLocalization').value;
            const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions).filter(({ value }) => value !== currentLocalization).map(({ value }) => value);
            Promise.all(otherLocalizations.map(localization => fetch(API.path + '/' + localization).then(response => response.json()))).then(data => {
                toastr["success"]("Diocesan Calendar translation data was retrieved successfully", "Success");
                data.forEach((localizationData, i) => {
                    translationData[otherLocalizations[i]] = localizationData;
                });
                console.log('translationData:', translationData);
                Array.from(document.querySelectorAll('.litEventName')).filter(el => el.dataset.valuewas !== '').forEach(el => {
                    while (el.nextSibling) {
                        el.nextSibling.remove();
                    }
                    const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(localization, el));
                    el.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
                });
            });
        }

        setFocusFirstTabWithData();
    }).catch(error => {
        if ( error instanceof Error && error.message.startsWith('404') ) { //we have already handled 404 Not Found above
            return;
        }
        toastr["error"](error.message, "Error");
    });
}

/**
 * Replaces the day input and month select with a text input for strtotime.
 * @param {HTMLElement} row - The containing row of the form.
 * @param {Object} Metadata - The metadata object from the JSON payload.
 */
const switcheroo = ( row, Metadata ) => {
    row.querySelector('.litEventDay').closest('.form-group').remove();
    const litEventMonth = row.querySelector('.litEventMonth');
    console.log(litEventMonth.id);
    const strtotimeId = litEventMonth.id.replace('Month', 'Strtotime');
    console.log(strtotimeId);
    const litEventMonthFormGrp = litEventMonth.closest('.form-group');
    litEventMonthFormGrp.classList.remove('col-sm-2');
    litEventMonthFormGrp.classList.add('col-sm-3');
    litEventMonth.remove();
    const monthLabel = litEventMonthFormGrp.querySelector('.month-label');
    monthLabel.textContent = 'Relative date';
    monthLabel.setAttribute('for', strtotimeId);
    litEventMonthFormGrp.insertAdjacentHTML('beforeend', `<input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="${strtotimeId}" value="${Metadata.strtotime}" />`);
}

/**
 * Reverts the form row from a strtotime text input back to separate day and month fields.
 * Adjusts the form group classes to accommodate the change.
 * Inserts a day input and month select dropdown based on the provided festivity data.
 *
 * @param {HTMLElement} row - The containing row of the form.
 * @param {Object} Festivity - The festivity data object containing day and month information.
 */
const unswitcheroo = ( row, Festivity ) => {
    const litEventStrtotime = row.querySelector('.litEventStrtotime');
    const strToTimeFormGroup = litEventStrtotime.closest('.form-group');
    strToTimeFormGroup.classList.remove('col-sm-3');
    strToTimeFormGroup.classList.add('col-sm-2');
    const dayId = litEventStrtotime.id.replace('Strtotime', 'Day');
    const monthId = litEventStrtotime.id.replace('Strtotime', 'Month');
    strToTimeFormGroup.insertAdjacentHTML('beforestart', `<div class="form-group col-sm-1">
    <label for="${dayId}">${Messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" value="${Festivity.day}" />
    </div>`);
    litEventStrtotime.remove();
    let formRow = `<select class="form-select litEvent litEventMonth" id="${monthId}">`;
    const formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
    for (let i = 0; i < 12; i++) {
        const month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
        formRow += `<option value=${i + 1}${(i+1)===Festivity.month ? ' selected' : ''}>${formatter.format(month)}</option>`;
    }
    formRow += `</select>`;
    strToTimeFormGroup.insertAdjacentHTML('beforeend', formRow);
    const monthLabel = strToTimeFormGroup.querySelector('.month-label');
    monthLabel.textContent = Messages[ 'Month' ];
    monthLabel.setAttribute('for', monthId);
}

const fillDiocesanFormWithData = (data) => {
    for (const entry of data.litcal) {
        const { festivity, metadata } = entry;
        let row;
        let numLastRow;
        let numMissingRows;
        if (festivity.hasOwnProperty('strtotime')) {
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
                numLastRow = document.querySelectorAll('#carouselItemSolemnities form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Solemnity'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        document.querySelector('#carouselItemSolemnities form').insertAdjacentHTML('beforeend', FormControls.CreateFestivityRow());
                    }
                }
                row = document.querySelectorAll('#carouselItemSolemnities form .row')[metadata.form_rownum];
                break;
            case Rank.FEAST:
                numLastRow = document.querySelectorAll('#carouselItemFeasts form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Feast'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                         document.querySelector('#carouselItemFeasts form').insertAdjacentHTML('beforeend', FormControls.CreateFestivityRow());
                    }
                }
                row = document.querySelectorAll('#carouselItemFeasts form .row')[metadata.form_rownum];
                break;
            case Rank.MEMORIAL:
                numLastRow = document.querySelectorAll('#carouselItemMemorials form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Memorial'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        document.querySelector('#carouselItemMemorials form').insertAdjacentHTML('beforeend', FormControls.CreateFestivityRow());
                    }
                }
                row = document.querySelectorAll('#carouselItemMemorials form .row')[metadata.form_rownum];
                break;
            case Rank.OPTIONALMEMORIAL:
                numLastRow = document.querySelectorAll('#carouselItemOptionalMemorials form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Optional Memorial'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        document.querySelector('#carouselItemOptionalMemorials form').insertAdjacentHTML('beforeend', FormControls.CreateFestivityRow());
                    }
                }
                row = document.querySelectorAll('#carouselItemOptionalMemorials form .row')[metadata.form_rownum];
                break;
        }
        row.querySelector('.litEventName').value = festivity.name;
        row.querySelector('.litEventName').setAttribute('data-valuewas', festivity.event_key);
        //if (metadata.form_rownum > 2) {
        //    $row.find('.litEventStrtotimeSwitch').bootstrapToggle();
        //}
        if ( festivity.hasOwnProperty('strtotime') ) {
            if ( row.querySelectorAll('.litEventStrtotime').length === 0 ) {
                switcheroo( row, metadata );
            }
            row.querySelector('.litEventStrtotime').value = festivity.strtotime;
        } else {
            if ( row.querySelectorAll('.litEventStrtotime').length > 0 ) {
                unswitcheroo( row, festivity );
            }
            row.querySelector('.litEventDay').value = festivity.day;
            row.querySelector('.litEventMonth').value = festivity.month;
        }
        setCommonMultiselect( row, festivity.common );
        $(row.querySelector('.litEventColor')).multiselect({
            buttonWidth: '100%',
            buttonClass: 'form-select',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
            }
        }).multiselect('deselectAll', false).multiselect('select', festivity.color);
        row.querySelector('.litEventSinceYear').value = metadata.since_year;
        if ( metadata.hasOwnProperty('until_year') ) {
            row.querySelector('.litEventUntilYear').value = metadata.until_year;
        } else {
            row.querySelector('.litEventUntilYear').min = metadata.since_year + 1;
        }
    };
}

/**
 * @function diocesanOvveridesDefined
 * @description Returns true if at least one of the overrides for epiphany, ascension, or corpus christi have been set, false otherwise.
 * @returns {boolean}
 */
const diocesanOvveridesDefined = () => {
    return (
        document.querySelector('#diocesanCalendarOverrideEpiphany').value !== ''
        || document.querySelector('#diocesanCalendarOverrideAscension').value !== ''
        || document.querySelector('#diocesanCalendarOverrideCorpusChristi').value !== ''
    );
}


/**
 * Event handlers for the calendar forms
 */

const diocesanCalendarNationalDependencyChanged = (ev) => {
    const currentSelectedNation = ev.target.value;

    // Disable "Remove diocesan data" button
    document.getElementById('removeExistingDiocesanDataBtn').disabled = true;

    // The diocese remove prompt is created when existing Diocesan data is loaded
    const removePrompt = document.getElementById('removeDiocesanCalendarPrompt');
    if (removePrompt) {
        removePrompt.remove();
    }

    // Reset selected diocese
    document.getElementById('diocesanCalendarDioceseName').value = '';

    // Reset the list of dioceses for the current selected nation
    const diocesesForNation = Object.freeze(DiocesesList.find(item => item.country_iso.toUpperCase() === currentSelectedNation)?.dioceses ?? null);
    const diocesesListElement = document.getElementById('DiocesesList');
    diocesesListElement.innerHTML = '';
    if (currentSelectedNation === '') {
        diocesesListElement.innerHTML = '<option value=""></option>';
    }
    else if (currentSelectedNation === 'US') {
        diocesesForNation.forEach(item => {
            diocesesListElement.insertAdjacentHTML('beforeend', `<option data-value="${item.diocese_id}" value="${item.diocese_name} (${item.province})">`);
        });
    } else {
        diocesesForNation.forEach(item => {
            diocesesListElement.insertAdjacentHTML('beforeend', `<option data-value="${item.diocese_id}" value="${item.diocese_name}">`);
        });
    }

    // Reset the diocesanCalendarGroup
    document.getElementById('diocesanCalendarGroup').value = '';

    // Reset the list of locales for the current selected nation
    let localesForNation;
    if (LitCalMetadata.national_calendars_keys.includes(currentSelectedNation)) {
        localesForNation = Object.freeze(Object.entries(AvailableLocalesWithRegion).filter(([key, ]) => {
            return LitCalMetadata.national_calendars.find(item => item.calendar_id === currentSelectedNation).locales.includes(key);
        }));
    } else {
        localesForNation = currentSelectedNation !== ''
        ? Object.freeze(Object.entries(AvailableLocalesWithRegion).filter(([key, ]) => {
                return key.split('_').pop() === currentSelectedNation;
            }))
        : Object.freeze(Object.entries(AvailableLocalesWithRegion));
    }
    if (localesForNation.length > 0) {
        const diocesanCalendarLocales = document.getElementById('diocesanCalendarLocales');
        diocesanCalendarLocales.innerHTML = localesForNation.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
        $(diocesanCalendarLocales).multiselect('rebuild');
        const currentLocalization = document.getElementById('currentLocalization');
        currentLocalization.innerHTML = localesForNation.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
        //currentLocalization.value = '';
    } else {
        // this should never be the case?
    }

    // Reset the list of timezones for the current selected nation
    const timezonesForCountry = tzdata.filter(tz => tz.countryCode === currentSelectedNation);
    console.log('timezonesForCountry = ', timezonesForCountry);
    const timezonesOptions = timezonesForCountry.map(tz => `<option value="${tz.name}" title="${tz.alternativeName} (${tz.mainCities.join(' - ')})">${tz.name} (${tz.abbreviation})</option>`);
    document.querySelector('#diocesanCalendarTimezone').innerHTML = timezonesOptions.length ? timezonesOptions.join('') : '<option value=""></option>';
}

const diocesanCalendarDioceseNameChanged = (ev) => {
    const currentVal = sanitizeInput( ev.target.value );
    CalendarData = { litcal: [] };
    document.querySelectorAll('.carousel-item form').forEach(form => {
        form.reset();
        form.querySelectorAll('.row').forEach((row, idx) => {
            if (idx >= 3) {
                row.remove();
            }
        });
        form.querySelectorAll('.data-group-title').forEach(el => el.remove());
        form.querySelectorAll('.litEventCommon').forEach(el => $(el).multiselect('deselectAll', false).multiselect('select', 'Proper'));
        form.querySelectorAll('.litEventColor').forEach(el => $(el).multiselect('deselectAll', false).multiselect('select', 'white'));
        form.querySelectorAll('.litEventName').forEach(el => el.setAttribute('data-valuewas', ''));
    });
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.classList.remove('was-validated'));
    const selectedOption = document.querySelector(`#DiocesesList > option[value="${currentVal}"]`);
    if (selectedOption) {
        ev.target.classList.remove('is-invalid');
        API.category = 'diocese';
        API.key = selectedOption.getAttribute('data-value');
        console.log('selected diocese with key = ' + API.key);
        if (LitCalMetadata.diocesan_calendars_keys.includes(API.key)) {
            API.method = 'PATCH';
            const diocesan_calendar = LitCalMetadata.diocesan_calendars.filter(el => el.calendar_id === API.key)[0];

            // Enable "Remove diocesan data" button
            document.querySelector('#removeExistingDiocesanDataBtn').disabled = false;

            // Create "Remove diocesan data" modal
            document.body.insertAdjacentHTML('beforeend', removeDiocesanCalendarModal(currentVal, Messages));

            // Set diocesan group if applicable
            if (diocesan_calendar.hasOwnProperty('group')){
                document.querySelector('#diocesanCalendarGroup').value = diocesan_calendar.group;
            }

            // Set the list of locales for the current selected diocese
            document.querySelector('#diocesanCalendarLocales').value = diocesan_calendar.locales;
            const LocalesForDiocese = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
                return diocesan_calendar.locales.includes(localeIso);
            });
            document.querySelector('#currentLocalization').innerHTML = LocalesForDiocese.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
            $('#diocesanCalendarLocales').multiselect('deselectAll', false).multiselect('select', diocesan_calendar.locales);

            // Set the timezone for the current selected diocese
            document.querySelector('#diocesanCalendarTimezone').value = diocesan_calendar.timezone;

            loadDiocesanCalendarData();
        } else {
            API.method = 'PUT';
            console.log(`API.method set to '${API.method}'`);
            document.querySelector('#removeExistingDiocesanDataBtn').disabled = true;
            const removePrompt = document.getElementById('removeDiocesanCalendarPrompt');
            if (removePrompt) {
                removePrompt.remove();
            }
            //console.log('no existing entry for this diocese');
        }
    } else {
        ev.target.classList.add('is-invalid');
    }
}

const deleteDiocesanCalendarConfirmClicked = () => {
    API.category = 'diocese';
    const modalElement = document.getElementById('removeDiocesanCalendarPrompt');
    const modal = bootstrap.Modal.getInstance(modalElement);
    console.log(modal);
    modal.toggle();
    const diocese = document.querySelector('#diocesanCalendarDioceseName').value;
    API.key = document.querySelector('#DiocesesList option[value="' + diocese + '"]').dataset.value;
    const nation = document.querySelector('#diocesanCalendarNationalDependency').value;
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
            LitCalMetadata.diocesan_calendars = LitCalMetadata.diocesan_calendars.filter(el => el.calendar_id !== API.key);
            LitCalMetadata.diocesan_calendars_keys = LitCalMetadata.diocesan_calendars_keys.filter(el => el !== API.key);

            document.getElementById('removeExistingDiocesanDataBtn').disabled = true;
            const removePromptElement = document.getElementById('removeDiocesanCalendarPrompt');
            if (removePromptElement) {
                removePromptElement.remove();
            }
            document.getElementById('diocesanCalendarDioceseName').value = '';
            document.getElementById('diocesanCalendarNationalDependency').value = '';
            document.getElementById('diocesanCalendarGroup').value = '';

            document.querySelectorAll('.carousel-item form').forEach(form => {
                form.reset();
                const rows = form.querySelectorAll('.row');
                for (let i = 3; i < rows.length; i++) {
                    rows[i].remove();
                }
                const dataGroupTitles = form.querySelectorAll('div.data-group-title');
                for (let i = 0; i < dataGroupTitles.length; i++) {
                    dataGroupTitles[i].remove();
                }
                const litEventCommons = form.querySelectorAll('.litEventCommon');
                for (let i = 0; i < litEventCommons.length; i++) {
                    $(litEventCommons[i]).multiselect('deselectAll', false).multiselect('select', 'Proper');
                }
                const litEventColors = form.querySelectorAll('.litEventColor');
                for (let i = 0; i < litEventColors.length; i++) {
                    $(litEventColors[i]).multiselect('deselectAll', false).multiselect('select', 'white');
                }
                const litEventNames = form.querySelectorAll('.litEventName');
                for (let i = 0; i < litEventNames.length; i++) {
                    litEventNames[i].setAttribute('data-valuewas', '');
                }
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
    });
}

const saveDiocesanCalendar_btnClicked = () => {
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
    if ( diocesanOvveridesDefined() ) {
        saveObj.payload.settings = {};
        const epiphanyValue = document.querySelector('#diocesanCalendarOverrideEpiphany').value;
        if (epiphanyValue !== '') {
            saveObj.payload.settings.epiphany = epiphanyValue;
        }
        const ascensionValue = document.querySelector('#diocesanCalendarOverrideAscension').value;
        if (ascensionValue !== '') {
            saveObj.payload.settings.ascension = ascensionValue;
        }
        const corpusChristiValue = document.querySelector('#diocesanCalendarOverrideCorpusChristi').value;
        if (corpusChristiValue !== '') {
            saveObj.payload.settings.corpus_christi = corpusChristiValue;
        }
    }

    let formsValid = true;

    document.querySelectorAll('.carousel-item form .row').forEach(row => {
        if (row.querySelector('.litEventName').value !== '') {
            row.querySelectorAll('input,select').forEach(el => {
                if (el.checkValidity() === false) {
                    formsValid = false;
                    alert(el.validationMessage);
                }
                el.classList.add('was-validated');
            });
            console.log(`row`, row, `has eventName`, eventName, `with value`, eventName.value);
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
        if (API.method === 'PUT') {
            const selectedOptions = document.querySelector('#diocesanCalendarLocales').selectedOptions;
            saveObj.payload.metadata = {
                locales: Array.from(selectedOptions).map(({ value }) => value),
                nation: document.querySelector('#diocesanCalendarNationalDependency').value,
                diocese_id: diocese_key,
                diocese_name: document.querySelector('#diocesanCalendarDioceseName').value,
                timezone: document.querySelector('#diocesanCalendarTimezone').value
            };
        }
        const body = API.method === 'PATCH'
            ? JSON.stringify(saveObj.payload)
            : (
                API.method === 'PUT'
                    ? JSON.stringify(saveObj)
                    : null
            );
        console.log('path: ', API.path);
        console.log('method: ', API.method);
        console.log('headers: ', headers);
        console.log('body: ', body);
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
}

const diocesanCalendarDefinitionsCardLinksClicked = ev => {
    ev.preventDefault();
    const carousel = document.querySelector('.carousel');
    const carouselInstance = bootstrap.Carousel.getInstance(carousel);

    if (ev.target.classList.contains('diocesan-carousel-next') || ev.target.parentElement.classList.contains('diocesan-carousel-next')) {
        carouselInstance.next();
    } else if (ev.target.classList.contains('diocesan-carousel-prev') || ev.target.parentElement.classList.contains('diocesan-carousel-prev')) {
        carouselInstance.prev();
    } else {
        const slideTo = parseInt(ev.target.getAttribute('data-bs-slide-to'));
        carouselInstance.to(slideTo);
    }
}

const existingFestivityNameChanged = ev => {
    const modal = ev.target.closest('.actionPromptModal');
    const form = modal.querySelectorAll('form');
    form.forEach(el => { el.classList.remove('was-validated') });

    const option = document.querySelector(`#existingFestivitiesList option[value="${ev.target.value}"]`);
    const disabledState = !option;
    if (ev.target.required) {
        ev.target.classList.toggle('is-invalid', disabledState);
    }

    const modalId = modal.id;
    const disableButtons = {
        makePatronActionPrompt: () => document.querySelector('#designatePatronButton').disabled = disabledState,
        setPropertyActionPrompt: () => document.querySelector('#setPropertyButton').disabled = disabledState,
        moveFestivityActionPrompt: () => document.querySelector('#moveFestivityButton').disabled = disabledState,
        newFestivityActionPrompt: () => {
            document.querySelector('#newFestivityFromExistingButton').disabled = disabledState;
            document.querySelector('#newFestivityExNovoButton').disabled = !disabledState;
        }
    };
    (disableButtons[modalId] || function () {})();
}

const addLanguageEditionRomanMissalClicked = (ev) => {
    const languageEditionRomanMissal = sanitizeInput( document.querySelector('#languageEditionRomanMissalName').value );
    document.querySelector('#publishedRomanMissalList').insertAdjacentHTML('beforeend', `<li class="list-group-item">${languageEditionRomanMissal}</li>`);
    const modal = ev.target.closest('.modal.show');
    bootstrap.Modal.getInstance(modal).hide();
}

document.addEventListener('change', ev => {
    if (ev.target.id === 'diocesanCalendarNationalDependency') {
        diocesanCalendarNationalDependencyChanged(ev);
    }
    if (ev.target.id === 'diocesanCalendarDioceseName') {
        diocesanCalendarDioceseNameChanged(ev);
    }
    if (ev.target.classList.contains('existingFestivityName')) {
        existingFestivityNameChanged(ev);
    }
    if (ev.target.id === 'languageEditionRomanMissalName') {
        document.querySelector('#addLanguageEditionRomanMissal').disabled = false;
    }
    if (ev.target.id === 'currentLocalization') {
        if (API.category === 'diocese' && API.method === 'PATCH') {
            loadDiocesanCalendarData();
        }
    }
});

document.addEventListener('click', ev => {
    if (ev.target.id === 'removeExistingDiocesanDataBtn') {
        // We don't want any forms to submit, so we prevent the default action
        ev.preventDefault();
    }
    if (ev.target.id === 'deleteDiocesanCalendarConfirm') {
        deleteDiocesanCalendarConfirmClicked();
    }
    if (ev.target.id === 'saveDiocesanCalendar_btn') {
        saveDiocesanCalendar_btnClicked();
    }
    if (ev.target.closest('#diocesanCalendarDefinitionCardLinks a.page-link')) {
        diocesanCalendarDefinitionsCardLinksClicked(ev);
    }
    if (ev.target.id === 'addLanguageEditionRomanMissal') {
        addLanguageEditionRomanMissalClicked(ev);
    }
});
