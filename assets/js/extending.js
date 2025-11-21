import {
    FormControls,
    LitEvent,
    RowAction,
    getMonthMaxDay,
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
    //DiocesanCalendarPayload
} from './Payload.js';

import {
    LiturgicalEvent
} from './LiturgicalEvent.js';

/**
 * @typedef {Object} RowData
 * @prop {Object} liturgical_event
 * @prop {Object} metadata
 * @prop {RowAction} metadata.action
 */

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
    "timeOut": "0",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
}

/**
 * @var Messages
 * The Messages global is set in extending.php
 * @global
 */
const { LOCALE, AvailableLocales, AvailableLocalesWithRegion, CountriesWithCatholicDioceses, DiocesesList } = Messages;
const jsLocale = LOCALE.replace('_', '-');

/**
 * Takes a string in snake_case and returns it in PascalCase.
 * @param {string} str
 * @return {string}
 */
const snakeCaseToPascalCase = (str) => str.replace(/(^\w|[-_][a-z])/g, g => g.toUpperCase().replace(/[-_]/, ''));

/**
 * Takes a string in snake_case and returns it in camelCase.
 * @param {string} str
 * @return {string}
 */
//const snakeCaseToCamelCase = (str) => str.replace(/([-_][a-z])/g, g => g[1].toUpperCase());

FormControls.jsLocale = jsLocale;
FormControls.weekdayFormatter = new Intl.DateTimeFormat(jsLocale, { weekday: "long" });
FormControls.index = LitCalMetadata;

const TranslationData = new Map();
const EventsCollection = new Map();
EventsCollection.set(EventsURL, new Map());
EventsCollection.get(EventsURL).set(LOCALE, LiturgicalEventCollection.map(el => LiturgicalEvent.fromObject(el)));
const EventsCollectionKeys = new Map();
EventsCollectionKeys.set(EventsURL, LiturgicalEventCollection.map(el => el.event_key));

const initialHeaders = new Headers({
    'Accept': 'application/json'
});

const missalsRequest = new Request(`${MissalsURL}?include_empty=true`, {
    method: 'GET',
    headers: initialHeaders
});

// Only useful for Diocesan Calendar definitions
const tzdataRequest = new Request('https://raw.githubusercontent.com/vvo/tzdb/refs/heads/main/raw-time-zones.json', {
    method: 'GET',
    headers: initialHeaders
});

const cldrDataRequest = new Request('https://raw.githubusercontent.com/unicode-org/cldr-json/refs/heads/main/cldr-json/cldr-core/supplemental/territoryInfo.json', {
    method: 'GET',
    headers: initialHeaders
});

const urlParams = new URLSearchParams(window.location.search);
const choice = urlParams.get('choice');

const fetchRequests = [
    fetch(missalsRequest)
];

if (choice === 'diocesan') {
    fetchRequests.push(fetch(tzdataRequest));
}
else if (choice === 'national') {
    fetchRequests.push(fetch(cldrDataRequest));
}

let CalendarData = { litcal: [], i18n: {} };
let MissalsIndex = null;
let tzdata;
let cldrData;

Promise.all(fetchRequests).then(responses => {
    return Promise.all(responses.map((response) => {
        if (response.ok) {
            return response.json();
        }
        else {
            throw new Error(response.status + ': ' + response.text);
        }
    }));
}).then(data => {
    if (data[0].hasOwnProperty('litcal_missals')) {
        console.log('retrieved /missals metadata:');
        console.log(data[0]);
        MissalsIndex = data[0].litcal_missals;
        FormControls.missals = data[0].litcal_missals;
        const publishedRomanMissalsStr = MissalsIndex.map(({missal_id, name}) => !missal_id.startsWith('EDITIO_TYPICA_') ? `<option class="list-group-item" value="${missal_id}">${name}</option>` : null).join('')
        document.querySelector('#languageEditionRomanMissalList').insertAdjacentHTML('beforeend', publishedRomanMissalsStr);
        toastr["success"]('Successfully retrieved data from /missals path', "Success");
    }
    if (choice === 'diocesan' && data[1]) {
        console.log('retrieved time zone data:');
        console.log(data[1]);
        tzdata = data[1];
        const timezonesOptions = tzdata.map(tz => `<option value="${tz.name}" title="${tz.alternativeName} (${tz.mainCities.join(' - ')})">${tz.name} (${tz.abbreviation})</option>`);
        document.querySelector('#diocesanCalendarTimezone').innerHTML = timezonesOptions.length ? timezonesOptions.join('') : '<option value=""></option>';
        toastr["success"]('Successfully retrieved time zone data', "Success");
    }
    else if (choice === 'national' && data[1]) {
        console.log('retrieved CLDR data:');
        console.log(data[1]);
        cldrData = data[1];
        toastr["success"]('Successfully retrieved CLDR data', "Success");
    }
}).catch(error => {
    console.error(error);
    toastr["error"](error, "Error");
}).finally(() => {
    document.querySelector('#overlay').classList.add('hidden');
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
                    } else {
                        value = `${RegionalDataURL}`;
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
                        target['method'] = 'PUT';
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
                    } else {
                        target['path'] = `${RegionalDataURL}`;
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

class DataLoader {
    static lastRequestPath = '';
    static lastRequestLocale = '';
    static allLocalesLoaded = {};
}

class EventsLoader {
    static lastRequestPath = '';
    static lastRequestLocale = '';
}


const country2flag = (countryCode) => countryCode.replace(/./g, (letter) => String.fromCodePoint((letter.charCodeAt(0) % 32) + 0x1F1E5));

/**
 * Returns a string containing HTML for a Bootstrap input group element with a label
 * and an input text element. The label shows the language of the locale and the
 * input element has a class of litEvent and litEventName_<language code>, where
 * <language code> is the language code of the locale, and a data-locale attribute
 * with the value of the locale.
 *
 * The input element also has a value attribute with the value of the translation
 * of the event key with the given locale, if it exists, or an empty string
 * otherwise.
 *
 * @param {string} path - API.path for the translation data
 * @param {string} locale - API.locale of the translation
 * @param {HTMLElement} el - the `litEventName` input element for which the translationTemplate is created
 * @returns {string} HTML string for the input group element
 */
const translationTemplate = (path, locale, el) => {
    const localeStr = locale.replace(/_/g, '-');
    const region = localeStr.split('-')[1];
    const localeObj = new Intl.Locale(localeStr);
    const lang = localeObj.language.toUpperCase();
    const langWithRegion = AvailableLocalesWithRegion[locale];
    const eventKeyEl = el.closest('.row').querySelector('.litEventEventKey');
    const eventKey = eventKeyEl ? eventKeyEl.value : (el.dataset.hasOwnProperty('valuewas') ? el.dataset.valuewas : '');
    const value = (TranslationData.has(path) && TranslationData.get(path).has(locale) && TranslationData.get(path).get(locale).hasOwnProperty(eventKey)) ? ` value="${TranslationData.get(path).get(locale)[eventKey]}"` : '';
    return `<div class="input-group input-group-sm mt-1">
            <label class="input-group-text font-monospace" for="${el.id}_${locale}" title="${langWithRegion}"><span class="noto-color-emoji-regular me-2">${country2flag(region)}</span>${lang}</label>
            <input type="text" class="form-control litEvent litEventName_${lang}" id="${el.id}_${locale}" data-locale="${locale}"${value}>
        </div>`;
}


/**
 * Called when the initial HTML document has been completely loaded and parsed.
 *
 * Adds the event listeners for the Bootstrap carousel element and the multiselect elements
 * in the diocesan calendar definition card.
 *
 * The event listeners enable the carousel to slide between the different steps of the
 * diocesan calendar definition form, and update the 'active' class on the navigation links
 * accordingly. They also enable the multiselect elements to be used for selecting the locales
 * and liturgical colors for the diocesan calendar.
 *
 */
const domContentLoadedCallback = () => {
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
        enableCaseInsensitiveFiltering: true,
        onChange: (option, checked) => {
            if (false === checked && document.querySelector('#currentLocalization').value === option[0].value) {
                console.log('value of this in multiselect onChange:', this);
                alert('You cannot remove the current localization. In order to remove this locale, you must first switch to a different current localization.');
                $(option).prop('selected', !checked);
                $('.calendarLocales').multiselect('refresh');
                return;
            }
            console.log('option:', option, 'checked:', checked);
            const selectEl = option[0].parentElement;
            selectEl.dispatchEvent(new CustomEvent('change', {
                bubbles: true,
                cancelable: true
              }));
        }
    });

    setCommonMultiselect(null, null);

    $('.litEventColor').multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', domContentLoadedCallback);
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
    domContentLoadedCallback();
}

/**
 * All Calendars interactions
 */

/**
 * Handles changes to the liturgical event name input field. This function is responsible
 * for managing the creation, updating, or deletion of liturgical events in the CalendarData.
 * It checks if the input value is empty, indicating a potential deletion, or if it's a new
 * or updated event name. Based on the event key and the calendar existence, it updates
 * CalendarData accordingly. The function also handles the assignment of event keys,
 * liturgical_event properties, and localization inputs. Additionally, it manages validation
 * and conflict resolution for event keys, ensuring unique entries in the calendar.
 *
 * @param {Event} ev - The change event triggered by the liturgical event name input field.
 */
const litEventNameChangeHandler = (ev) => {
    const row  = ev.target.closest('.row');
    const card = ev.target.closest('.card-body');
    //console.log('LitEvent name has changed');
    if (ev.target.value === '') {
        //empty value probably means we are trying to delete an already defined event
        //so let's find the key and remove it
        const oldEventKeyEl = ev.target.closest('.row').querySelector('.litEventEventKey');
        const oldEventKey = oldEventKeyEl
            ? oldEventKeyEl.value
            : (ev.target.dataset.hasOwnProperty('valuewas') ? ev.target.dataset.valuewas : '');
        console.log('seems we are trying to delete the object key ' + oldEventKey);
        CalendarData.litcal = CalendarData.litcal.filter(item => item.liturgical_event.event_key !== oldEventKey);
        if (oldEventKeyEl) {
            oldEventKeyEl.value = '';
        } else {
            ev.target.setAttribute('data-valuewas', '');
        }
    } else {
        // We are either creating a new event, or updating an existing one
        // If the calendar already exists in the Liturgical Calendar API, we probably want to keep the event_key as is;
        //  otherwise we may want to generate a new one based on the new event name value
        let calendarExists = false;
        switch (choice) {
            case 'national': {
                const currentNation = document.querySelector('#nationalCalendarName').value;
                calendarExists = LitCalMetadata.national_calendars_keys.includes(currentNation);
                console.log('national calendar for ' + currentNation + ' already exists: ' + calendarExists);
                break;
            }
            case 'diocesan': {
                const currentDioceseName = document.querySelector('#diocesanCalendarDioceseName').value;
                const currentDioceseOption = document.querySelector(`#DiocesesList > option[value="${currentDioceseName}"]`);
                const currentDiocese = currentDioceseOption ? currentDioceseOption.dataset.value : null;
                calendarExists = LitCalMetadata.diocesan_calendars_keys.includes(currentDiocese);
                console.log('currentDioceseName = ' + currentDioceseName + ', currentDioceseOption = ', currentDioceseOption, ',  currentDiocese = ' + currentDiocese);
                console.log('diocesan calendar for ' + currentDiocese + ' already exists: ' + calendarExists);
                break;
            }
            case 'widerRegion': {
                const currentWiderRegion = document.querySelector('#widerRegionCalendarName').value;
                calendarExists = LitCalMetadata.wider_regions_keys.includes(currentWiderRegion);
                console.log('wider region calendar for ' + currentWiderRegion + ' already exists: ' + calendarExists);
                break;
            }
            default:
                console.error('unexpected choice ' + choice + ', should be a value of "nation", "diocese" or "widerregion"');
        }

        console.log('new liturgical_event name is ' + ev.target.value);
        const newEventKey = createEventKey(ev.target.value);
        console.log('if applicable, new LitEvent name identifier would be ' + newEventKey);

        if (false === calendarExists) {
            console.log('calendar does not exist in the Liturgical Calendar API, so we are generating a new event key or updating a new event key');
            const oldEventKeyEl = ev.target.closest('.row').querySelector('.litEventEventKey');
            const oldEventKey = oldEventKeyEl ? oldEventKeyEl.value : (ev.target.dataset.hasOwnProperty('valuewas') ? ev.target.dataset.valuewas : '');
            console.log(CalendarData);
            // This condition will never be met when dealing with national or wider region calendars
            if (oldEventKey === '') {
                console.log('the previous event_key was empty so we need not search for an entry in CalendarData, we simply create a new event with the new event key and add it to the CalendarData');
                // we need to ensure the new event_key does not collide with an existing event_key
                const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === newEventKey) ?? null;
                if (litEvent === null) {
                    console.log('new event key is unique');
                    const colorSelectedOptions = Array.from(row.querySelector('.litEventColor').selectedOptions);
                    const commonSelectedOptions = Array.from(row.querySelector('.litEventCommon').selectedOptions);

                    const liturgical_event = new LitEvent(
                        newEventKey,
                        ev.target.value, //name
                        colorSelectedOptions.map(({ value }) => value), //color
                        null,
                        commonSelectedOptions.map(({ value }) => value), //common
                        parseInt(row.querySelector('.litEventDay').value), //day
                        parseInt(row.querySelector('.litEventMonth').value), //month
                    );

                    const metadata = {};
                    //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                    metadata.since_year = parseInt(row.querySelector('.litEventSinceYear').value);
                    if ( row.querySelector('.litEventUntilYear').value !== '' ) {
                        metadata.until_year = parseInt(row.querySelector('.litEventUntilYear').value);
                    }
                    const formRowIndex = Array.from(card.querySelectorAll('.row')).indexOf(row);
                    metadata.form_rownum = formRowIndex;
                    console.log('form row index is ' + formRowIndex);

                    if (oldEventKeyEl) {
                        oldEventKeyEl.value = newEventKey;
                    } else {
                        ev.target.setAttribute('data-valuewas', newEventKey);
                    }
                    ev.target.classList.remove('is-invalid');

                    if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
                        const currentLocalization = document.querySelector('#currentLocalization').value;
                        const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                                    .filter(({ value }) => value !== currentLocalization)
                                                    .map(({ value }) => value);
                        const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(API.path, localization, ev.target));
                        ev.target.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
                    }

                    const newEvent = {
                        liturgical_event,
                        metadata
                    };
                    console.log('adding new event to CalendarData.litcal:');
                    console.log( newEvent );
                    CalendarData.litcal.push(newEvent);
                } else {
                    // If there is a collision with an existing event_key, we should let the user know and ask if they want to create an entry anyways.
                    // In this case, we can copy values from the existing event to the new event.
                    if ( false === litEvent.metadata.hasOwnProperty('until_year') ) {
                        console.log('exact same liturgical_event name was already defined elsewhere! key ' + newEventKey + ' already exists! and the untilYear property was not defined!');
                        ev.target.value = '';
                        ev.target.classList.add('is-invalid');
                    } else {
                        const confrm = confirm('The same liturgical_event name was already defined elsewhere. However an untilYear property was also defined, so perhaps you are wanting to define again for the years following. If this is the case, press OK, otherwise Cancel');
                        if (confrm) {
                            ev.target.classList.remove('is-invalid');
                            //retrieve untilYear from the previous liturgical_event with the same name
                            const { until_year } = litEvent.metadata;
                            //set the sinceYear field on this row to the previous until_year plus one
                            row.querySelector('.litEventSinceYear').value = (until_year + 1);
                            row.querySelector('.litEventUntilYear').min = (until_year + 2);
                            if (oldEventKeyEl) {
                                oldEventKeyEl.value = newEventKey;
                            } else {
                                ev.target.setAttribute('data-valuewas', newEventKey);
                            }

                            const colorSelectedOptions = Array.from(row.querySelector('.litEventColor').selectedOptions);
                            const commonSelectedOptions = Array.from(row.querySelector('.litEventCommon').selectedOptions);

                            const liturgical_event = new LitEvent(
                                newEventKey,
                                ev.target.value, //name
                                colorSelectedOptions.map(({ value }) => value), //color
                                null, // grade
                                commonSelectedOptions.map(({ value }) => value), //common
                                parseInt(row.querySelector('.litEventDay').value), //day
                                parseInt(row.querySelector('.litEventMonth').value), //month
                            );

                            const form_rownum = Array.from(card.querySelectorAll('.row')).indexOf(row);
                            const metadata = {
                                since_year: until_year + 1,
                                form_rownum
                            };
                            const newEvent = {
                                liturgical_event,
                                metadata
                            }
                            console.log('form row index is ' + form_rownum);
                            CalendarData.litcal.push(newEvent);
                        }
                    }
                }
            } else {
                // If the previous event_key is not empty, we are probably wanting to update an existing event with a new event_key
                // however we do NOT want to change the event_key when making a patron saint, or changing the name of an existing liturgical_event,
                // so this logic really only applies to diocesan calendar forms
                console.log('the previous event_key was not empty: ', oldEventKey);
                if (choice === 'diocesan') {
                    const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === oldEventKey) ?? null;
                    if (litEvent !== null) {
                        if (oldEventKey !== newEventKey) {
                            console.log('Name change on an existing liturgical_event.');
                            console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + newEventKey + '> and then remove <' + oldEventKey + '>');
                            litEvent.liturgical_event.event_key = newEventKey;
                            litEvent.liturgical_event.name = ev.target.value;
                            if (oldEventKeyEl) {
                                oldEventKeyEl.value = newEventKey;
                            } else {
                                ev.target.setAttribute('data-valuewas', newEventKey);
                            }
                            ev.target.classList.remove('is-invalid');
                        }
                    }
                }
            }

            if (choice === 'diocesan') {
                const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === newEventKey) ?? null;
                // We set the grade based on the current carousel item
                switch (ev.target.closest('.carousel-item').id) {
                    case 'carouselItemSolemnities':
                        litEvent.liturgical_event.grade = 6;
                        break;
                    case 'carouselItemFeasts':
                        litEvent.liturgical_event.grade = 4;
                        break;
                    case 'carouselItemMemorials':
                        litEvent.liturgical_event.grade = 3;
                        break;
                    case 'carouselItemOptionalMemorials':
                        litEvent.liturgical_event.grade = 2;
                        break;
                }

                // Attempt to set liturgical color to red for martyrs, white for all other cases
                if (ev.target.value.match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                    $(row.querySelector('.litEventColor')).multiselect('deselectAll', false).multiselect('select', 'red');
                    litEvent.liturgical_event.color = [ 'red' ];
                } else {
                    $(row.querySelector('.litEventColor')).multiselect('deselectAll', false).multiselect('select', 'white');
                    litEvent.liturgical_event.color = [ 'white' ];
                }
            }
        } else {
            // Seeing the calendar already exists, we should keep the event_key the same and just update the liturgical_event name
            // We only need to do this for diocesan calendars, because WiderRegion and National calendars are serialized on the spot,
            // not at each form control change event
            if (choice === 'diocesan') {
                const eventKey = ev.target.dataset.valuewas;
                console.log('calendar already exists, so we are just updating the liturgical_event name while keeping the event_key the same', eventKey);
                if (eventKey !== '') {
                    console.log('CalendarData before update: ', CalendarData);
                    const existingEntry = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey);
                    console.log('existingEntry is: ', existingEntry);
                    existingEntry.liturgical_event.name = ev.target.value;
                    console.log('CalendarData.litcal has been updated:', CalendarData);
                } else {
                    console.error('why is event_key empty?');
                }
            }
        }
    }
}

/**
 * Updates the day of a liturgical event when the day input is changed.
 * If the event's name is not empty and exists in the CalendarData,
 * it modifies the event's liturgical_event day with the new value.
 *
 * @param {Event} ev - The change event triggered by the day input field.
 */
const litEventDayChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            litEvent.liturgical_event.day = parseInt(ev.target.value);
        }
    }
}

/**
 * Handles changes to the month select element for a liturgical event.
 * Updates the liturgical_event's month property in the CalendarData and adjusts
 * the maximum day value allowed based on the selected month.
 * If the current day value exceeds the maximum allowed for the selected month,
 * it resets the day value to the maximum.
 *
 * @param {Event} ev - The change event triggered by selecting a new month.
 */
const litEventMonthChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    const selcdMonth = parseInt(ev.target.value);
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            litEvent.liturgical_event.month = selcdMonth;
        }
    }
    row.querySelector('.litEventDay').max = getMonthMaxDay(selcdMonth);
    if (parseInt(row.querySelector('.litEventDay').value) > parseInt(row.querySelector('.litEventDay').max)) {
        row.querySelector('.litEventDay').value = parseInt(row.querySelector('.litEventDay').max);
    }
}

/**
 * Handles changes to the 'common' multiselect for a liturgical event in the editor.
 * Updates the liturgical_event's 'common' and 'color' properties based on the selected options.
 * Additionally, updates the multiselect options for the 'litEventColor' field.
 *
 * @param {Event} ev - The change event triggered by the 'common' multiselect.
 * @listens change
 */
const litEventCommonChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            const selectedOptions = Array.from(ev.target.selectedOptions);
            litEvent.liturgical_event.common = selectedOptions.map(({ value }) => value);
            console.log('litEventChanged: litEventCommon has changed, new value is: ', CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey).liturgical_event.common);
            let eventColors = [];
            if (litEvent.liturgical_event.common.some( m => /Martyrs/.test(m) )) {
                eventColors.push('red');
            }
            if (litEvent.liturgical_event.common.some( m => /(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/.test(m) ) ) {
                eventColors.push('white');
            }
            $(row.querySelector('.litEventColor')).multiselect('deselectAll', false).multiselect('select', eventColors);
            litEvent.liturgical_event.color = eventColors;
        }
    }
}

/**
 * Handles the change event of the litEventColor select
 * @param {Event} ev the change event
 * @listens change
 */
const litEventColorChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            const selectedOptions = Array.from(ev.target.selectedOptions);
            litEvent.liturgical_event.color = selectedOptions.map(({ value }) => value);;
        }
    }
}

/**
 * Handles changes to the 'since year' input for a liturgical event in the editor
 * @param {Event} ev the change event
 * @listens change
 */
const litEventSinceYearChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            litEvent.metadata.since_year = parseInt(ev.target.value);
        }
    }
    row.querySelector('.litEventUntilYear').min = parseInt(ev.target.value) + 1;
}

/**
 * Handles changes to the 'until year' input for a liturgical event in the editor
 * @param {Event} ev the change event
 * @listens change
 */
const litEventUntilYearChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            if (ev.target.value !== '') {
                litEvent.metadata.until_year = parseInt(ev.target.value);
            } else {
                delete litEvent.metadata.until_year;
            }
        }
    }
}

/**
 * Handles the toggle switch that determines whether the liturgical_event date is either a static date (day and month) or a relative date (strtotime syntax)
 * @param {Event} ev the change event
 * @listens change
 */
const litEventStrtotimeSwitchHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            if (false === ev.target.checked) {
                delete litEvent.liturgical_event.strtotime;
                litEvent.liturgical_event.day = 1;
                litEvent.liturgical_event.month = 1;
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
                delete litEvent.liturgical_event.day;
                delete litEvent.liturgical_event.month;
                litEvent.liturgical_event.strtotime = '';

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
        alert('this switch is disabled as long as the liturgical_event row does not have a liturgical_event name!');
        //ev.preventDefault();
        ev.target.checked = !ev.target.checked;
    }
}

/**
 * Handles changes to the strtotime input field for a liturgical event.
 *
 * Updates the `strtotime` property of the corresponding liturgical event in the `CalendarData.litcal`
 * array when the input value changes. This function only performs the update if the event row
 * has a valid event name and the corresponding event exists in `CalendarData`.
 *
 * @param {Event} ev - The event object triggered by the input change.
 */

const litEventStrtotimeChangeHandler = (ev) => {
    const row = ev.target.closest('.row');
    if (row.querySelector('.litEventName').value !== '') {
        const eventKey = row.querySelector('.litEventName').dataset.valuewas;
        const litEvent = CalendarData.litcal.find(item => item.liturgical_event.event_key === eventKey) ?? null;
        if (litEvent !== null) {
            litEvent.liturgical_event.strtotime = ev.target.value;
        }
    }

}

/**
 * Handles changes to liturgical event form fields and updates the CalendarData accordingly.
 *
 * This function processes change events on different form fields related to liturgical events, including
 * event name, day, month, color, common, since year, until year, strtotime switch, and strtotime input.
 * It updates the CalendarData object based on the changes and ensures the consistency of the data.
 *
 * @param {Event} ev - The event object associated with the change event.
 */
const litEventChanged = (ev) => {
    if (ev.target.classList.contains('litEventName')) {
        litEventNameChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventDay')) {
        litEventDayChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventMonth')) {
        litEventMonthChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventCommon')) {
        litEventCommonChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventColor')) {
        litEventColorChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventSinceYear')) {
        litEventSinceYearChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventUntilYear')) {
        litEventUntilYearChangeHandler(ev);
    } else if (ev.target.classList.contains('litEventStrtotimeSwitch')) {
        litEventStrtotimeSwitchHandler(ev);
    } else if (ev.target.classList.contains('litEventStrtotime')) {
        litEventStrtotimeChangeHandler(ev);
    }
}


/**
 * Handles the change event for the list of locales that should be used for the localization of the calendar.
 *
 * This function is called when the user selects or deselects a locale from the list of available locales.
 *
 * It updates the list of localization choices for the "current localization" select based on the selected locales.
 *
 * @param {Event} ev - The event object for the change event.
 */
const calendarLocalesChanged = (ev) => {
    const updatedLocales = Array.from(ev.target.selectedOptions).map(({ value }) => value);
    console.log('updatedLocales:', updatedLocales);
    const updatedLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
        return updatedLocales.includes(localeIso);
    });
    const currentLocalizationEl = document.querySelector('#currentLocalization');
    const currentLocalization = currentLocalizationEl.value;
    console.log(`currentLocalizationEl.value: ${currentLocalizationEl.value}`);
    currentLocalizationEl.innerHTML = updatedLocalizationChoices.map(([localeIso, localeDisplayName]) => {
        const selectedProp = localeIso === currentLocalization ? ' selected' : '';
        return `<option value="${localeIso}"${selectedProp}>${localeDisplayName}</option>`;
    });
    const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                .filter(({ value }) => value !== currentLocalization)
                                .map(({ value }) => value);
    refreshOtherLocalizationInputs(otherLocalizations);
}


/**
 * Wider Region and National Calendar interactions
 */

/**
 * @description Updates the regional/national calendar data for the given category and key
 * @param {Object} data
 * @returns {void}
 */
const updateRegionalCalendarForm = (data) => {
    console.log( `successfully retrieved the data file for the ${API.category} ${API.key}` );
    API.method = 'PATCH';
    console.log(data);
    switch(API.category) {
        case 'widerregion': {
            FormControls.settings.decreeURLFieldShow = true;
            FormControls.settings.decreeLangMapFieldShow = true;
            $('#widerRegionLocales').multiselect('deselectAll', false).multiselect('select', data.metadata.locales);
            const currentLocalizationChoices = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => {
                return data.metadata.locales.includes(localeIso);
            });
            document.querySelector('.currentLocalizationChoices').innerHTML = currentLocalizationChoices.map(([localeIso, localeDisplayName]) => {
                return `<option value="${localeIso}">${localeDisplayName}</option>\n`;
            });
            const defaultLocale = API.locale !== '' ? API.locale : data.metadata.locales[0];
            document.querySelector('#currentLocalization').value = defaultLocale;
            API.locale = defaultLocale;
            break;
        }
        case 'nation': {
            FormControls.settings.decreeURLFieldShow = true;
            FormControls.settings.decreeLangMapFieldShow = false;
            const { settings, metadata } = data;

            document.querySelector('#nationalCalendarSettingEpiphany').value = settings.epiphany;
            document.querySelector('#nationalCalendarSettingAscension').value = settings.ascension;
            document.querySelector('#nationalCalendarSettingCorpusChristi').value = settings.corpus_christi;

            const localesForNation = Object.entries(AvailableLocalesWithRegion).filter(([key, ]) => key.split('_').pop() === API.key);

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
            break;
        }
    }
    document.querySelector('.regionalNationalDataForm').innerHTML = '';
    //console.log('EventLoader.lastRequestPath', EventsLoader.lastRequestPath);
    //console.log('EventsCollectionKeys', EventsCollectionKeys);
    data.litcal.forEach((el) => {
        const currentUniqid = FormControls.uniqid;
        //const existingLiturgicalEventEventKey = el.liturgical_event.event_key ?? null;
        /*
        if ( el.metadata.action === RowAction.CreateNew && EventsCollectionKeys.get(EventsLoader.lastRequestPath).includes( existingLiturgicalEventEventKey ) ) {
            el.metadata.action = RowAction.CreateNewFromExisting;
        }
        */
        setFormSettings( el.metadata.action );
        if ( el.metadata.action === RowAction.SetProperty ) {
            setFormSettingsForProperty( el.metadata.property );
        }
        const {fragment, controlsRow} = FormControls.CreateRegionalFormRow( el );
        document.querySelector('.regionalNationalDataForm').append(fragment);

        controlsRow.setAttribute('data-action', el.metadata.action);

        if ( el.metadata.action === RowAction.SetProperty ) {
            controlsRow.setAttribute('data-prop', el.metadata.property);
        }

        if (
            [RowAction.CreateNew, RowAction.MakePatron].includes(el.metadata.action)
            ||
            (el.metadata.action === RowAction.SetProperty && el.metadata.property === 'name')
        ) {
            if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
                const currentLocalization = document.querySelector('#currentLocalization').value;
                const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                            .filter(({ value }) => value !== currentLocalization)
                                            .map(({ value }) => value);
                const nameInput = controlsRow.querySelector(`#onTheFly${currentUniqid}Name`);
                const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(API.path, localization, nameInput));
                nameInput.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
            }
        }

        if ( el.liturgical_event.hasOwnProperty('common') && el.liturgical_event.common.includes('Proper') ) {
            controlsRow.querySelector('.litEventReadings').disabled = false;
        }

        /*
        if ( FormControls.settings.missalFieldShow && existingLiturgicalEventEventKey !== null ) {
            const { missal } = EventsCollection.get(EventsLoader.lastRequestPath).get(EventsLoader.lastRequestLocale).find(el => el.event_key === existingLiturgicalEventEventKey);
            controlsRow.querySelector(`#onTheFly${currentUniqid}Missal`).value = missal;
        }
        */
        if ( FormControls.settings.missalFieldShow && el.metadata.hasOwnProperty('missal') ) {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Missal`).value = el.metadata.missal;
        }

        $( controlsRow.querySelector('.litEventColor') ).multiselect({
            buttonWidth: '100%',
            buttonClass: 'form-select',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
            }
        }).multiselect('deselectAll', false);

        if ( el.liturgical_event.hasOwnProperty('color') && el.liturgical_event.color.length ) {
            $(controlsRow.querySelector('.litEventColor')).multiselect('select', el.liturgical_event.color);
        }

        /*
        if ( el.liturgical_event.hasOwnProperty( 'color' ) === false && existingLiturgicalEventEventKey !== null ) {
            console.log( 'retrieving default liturgical_event info for ' + existingLiturgicalEventEventKey );
            console.log( 'EventsLoader.lastRequestPath:', EventsLoader.lastRequestPath );
            console.log( 'EventsLoader.lastRequestLocale:', EventsLoader.lastRequestLocale );
            const existingEvent = EventsCollection.get(EventsLoader.lastRequestPath).get(EventsLoader.lastRequestLocale).find( el => el.event_key === existingLiturgicalEventEventKey );
            console.log( existingEvent );
            el.liturgical_event.color = existingEvent.color;
        }
        $(controlsRow.querySelector('.litEventColor')).multiselect('select', el.liturgical_event.color);
        */


        if (FormControls.settings.colorField === false) {
            $(controlsRow.querySelector('.litEventColor')).multiselect('disable');
        }

        if ( el.liturgical_event.hasOwnProperty( 'common' ) ) {
            if (FormControls.settings.commonFieldShow) {
                setCommonMultiselect( controlsRow, el.liturgical_event.common );
                if (FormControls.settings.commonField === false) {
                    $(controlsRow.querySelector(`#onTheFly${currentUniqid}Common`)).multiselect('disable');
                }
            }
        }

        if (FormControls.settings.gradeFieldShow) {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Grade`).value = el.liturgical_event.grade;
            if (FormControls.settings.gradeField === false) {
                controlsRow.querySelector(`#onTheFly${currentUniqid}Grade`).disabled = true;
            }
        }

        if (FormControls.settings.missalFieldShow && el.metadata.hasOwnProperty('missal') ) {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Missal`).value = el.metadata.missal;
        }

        if (FormControls.settings.monthField === false) {
            controlsRow.querySelectorAll(`#onTheFly${currentUniqid}Month > option[value]:not([value="${el.liturgical_event.month}"])`).forEach(el => { el.disabled = true; });
        }
    });

    /**
     * Load translation data
     */
    if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
        const currentLocalization = document.querySelector('#currentLocalization').value;
        const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                    .filter(({ value }) => value !== currentLocalization)
                                    .map(({ value }) => value);
        console.log('otherLocalizations:', otherLocalizations);
        if (DataLoader.lastRequestPath !== API.path) {
            document.querySelector('#overlay').classList.remove('hidden');
            Promise.all(
                otherLocalizations.map(
                    localization => fetch(API.path + '/' + localization).then(response => response.json())
                )
            )
            .then(data => {
                toastr["success"](`Calendar translation data retrieved successfully for calendar ${API.key} and locales ${otherLocalizations.join(', ')}`, "Success");
                if (false === TranslationData.has(API.path)) {
                    TranslationData.set(API.path, new Map());
                }
                data.forEach((localizationData, i) => {
                    TranslationData.get(API.path).set(otherLocalizations[i], localizationData);
                });
                console.log('TranslationData:', TranslationData);
                refreshOtherLocalizationInputs(otherLocalizations);
                DataLoader.lastRequestPath = API.path;
                DataLoader.lastRequestLocale = currentLocalization;
            }).finally(() => {
                document.querySelector('#overlay').classList.add('hidden');
            });
        } else {
            // We are requesting the same calendar, just with a different locale
            // We don't need to reload ALL i18n data, just the data for the last locale, if we haven't already
            if (DataLoader.allLocalesLoaded.hasOwnProperty(API.path)) {
                refreshOtherLocalizationInputs(otherLocalizations);
            } else {
                document.querySelector('#overlay').classList.remove('hidden');
                fetch(API.path + '/' + DataLoader.lastRequestLocale).then(response => response.json()).then(localizationData => {
                    if (false === TranslationData.has(API.path)) {
                        TranslationData.set(API.path, new Map());
                    }
                    TranslationData.get(API.path).set(DataLoader.lastRequestLocale, localizationData);
                    console.log('TranslationData:', TranslationData);
                    refreshOtherLocalizationInputs(otherLocalizations);
                    DataLoader.allLocalesLoaded[API.path] = true;
                }).finally(() => {
                    document.querySelector('#overlay').classList.add('hidden');
                });
            }
        }
    } else {
        document.querySelector('#overlay').classList.add('hidden');
    }

    document.querySelector('.serializeRegionalNationalData').disabled = false;
}

/**
 * Fetches the regional calendar data for the given path and locale.
 *
 * @param {Object} headers - The headers object to be passed to the fetch request.
 * @returns {Promise<Object>} - The fetched data as a JSON object.
 * @throws Will throw an error if the request fails.
 */
const fetchRegionalCalendarData = (headers) => {
    // Only fetch data for calendars that already exist
    let calendarExists = false;
    console.log(`fetchRegionCalendarData: API.category: ${API.category}, API.key: ${API.key}`);
    if (API.category === 'nation') {
        calendarExists = LitCalMetadata.national_calendars_keys.includes(API.key);
        console.log(`LitCalMetadata.national_calendars_keys.includes(API.key): ${LitCalMetadata.national_calendars_keys.includes(API.key)}`);
    } else {
        calendarExists = LitCalMetadata.wider_regions_keys.includes(API.key);
        console.log(`LitCalMetadata.wider_regions_keys.includes(API.key): ${LitCalMetadata.wider_regions_keys.includes(API.key)}`);
    }
    if (calendarExists) {
        console.log('Calendar exists, fetching data...');
        API.method = 'GET';
        const request = new Request(API.path, {
            method: API.method,
            headers
        });
        fetch(request).then(response => {
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
                    formSelect.dispatchEvent(new CustomEvent('change', {
                        bubbles: true,
                        cancelable: true
                      }));
                });

                return Promise.reject(response);
            }
        }).then(updateRegionalCalendarForm).catch(error => {
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
        }).finally(() => {
            // Leave this commented out for now, we don't want to remove the overlay until all locales are loaded,
            // see updateRegionalCalendarForm()
            //document.querySelector('#overlay').classList.add('hidden');
        });
    } else {
        API.method = 'PUT';
        const message = `The Data File for the ${API.category} ${API.key} does not exist yet. Not that it's a big deal, just go ahead and create it now!`;
        toastr["warning"](message, "Warning");
        console.warn(message);
        switch(API.category) {
            case 'widerregion':
                $('#widerRegionLocales').multiselect('deselectAll', false);
                break;
            case 'nation': {
                document.querySelector('#nationalCalendarSettingsForm').reset();
                document.querySelector('#publishedRomanMissalList').innerHTML = '';
                const LocalesForRegion = Object.entries(AvailableLocalesWithRegion).filter(([key, ]) => key.split('_').pop() === API.key);
                const calendarLocalesSelect = document.getElementById('nationalCalendarLocales');
                calendarLocalesSelect.innerHTML = LocalesForRegion.map(item => `<option value="${item[0]}" selected>${item[1]}</option>`).join('');
                $(calendarLocalesSelect).multiselect('rebuild');
                const currentLocalizationEl = document.querySelector('#currentLocalization');
                currentLocalizationEl.innerHTML = LocalesForRegion.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
                // set as default currentLocalization the locale with greater percentage per population, of those that are available
                const regionalLocales = LocalesForRegion.map(item => item[0].split('_')[0]);
                const mostSpokenLanguage = likelyLanguage(API.key, regionalLocales);
                currentLocalizationEl.value = `${mostSpokenLanguage}_${API.key}`;
                break;
            }
        }
        document.querySelector('.regionalNationalDataForm').innerHTML = '';
        document.querySelector('#overlay').classList.add('hidden');
    }
}

/**
 * Given a region code, find the first language matching the region code.
 *
 * This function loops over the CLDR data for likely subtags, and if the
 * region code is found in the likely subtags, it returns the language code
 * for that subtag. If no language code is found, it returns null.
 *
 * @param {string} region - The region code.
 * @param {string[]} [filteredLocales] - An optional array of locales to filter by.
 * @returns {?string} The first language code matching the region code, or null.
 */
const likelyLanguage = (region, filteredLocales = null) => {
    // Find the first language matching the country code
    const regionData = cldrData.supplemental.territoryInfo[region];
    if (regionData && regionData.languagePopulation) {
        // Find the language with the highest "official status" or population
        const mainLanguage = Object.entries(regionData.languagePopulation)
            .sort((a, b) => (b[1]._populationPercent || 0) - (a[1]._populationPercent || 0)) // Sort by population
            .filter(([lang]) => filteredLocales ? filteredLocales.includes(lang) : true)
            .map(([lang]) => lang)[0]; // Get the top language

        return mainLanguage || null;
    }
    return null;
}

/**
 * Calculates the percentage of empty strings in the provided Map of translations.
 *
 * Iterates over the values of the translations Map, counts the number of
 * empty strings, and returns the percentage of empty strings relative
 * to the total number of entries in the Map.
 *
 * @param {Map} translations - A Map object where each value is a translation string.
 * @returns {number} The percentage of empty strings in the translations Map.
 */
const emptyStringPercentage = (translations) => {
    console.log(`emptyStringPercentage: translations.size = ${translations.size}`);
    if (translations.size === 0) return 0; // Avoid division by zero

    let emptyCount = 0;

    for (const value of translations.values()) {
        if (value === "") {
            emptyCount++;
        }
    }
    console.log(`emptyStringPercentage: emptyCount = ${emptyCount}`);
    console.log(translations);
    return (emptyCount / translations.size) * 100;
}


/**
 * Fetches events and calendar data based on the current values of API.category and API.key.
 *
 * If the category is 'nation', it first checks if the national calendar exists and if the current locale is one of the locales
 * of the existing national calendar. If it does, it sets the Accept-Language header to that locale, otherwise it sets it to
 * the first locale of the existing national calendar. It then fetches the events for the selected locale.
 * If the category is not 'nation', it just sets the Accept-Language header to the current value of API.locale and fetches the
 * events for that locale.
 *
 * If the fetched events are not already in the EventsCollection, it adds them to the collection and updates the
 * #existingLiturgicalEventsList element.
 *
 * After fetching the events, it calls fetchRegionalCalendarData to fetch the calendar data.
 * @returns {Promise<void>}
 */
const fetchEventsAndCalendarData = () => {
    document.querySelector('#overlay').classList.remove('hidden');
    const headers = {
        'Accept': 'application/json'
    };

    if ( API.category === 'nation' ) {
        const selectedNationalCalendar = LitCalMetadata.national_calendars.filter(item => item.calendar_id === API.key);
        if (selectedNationalCalendar.length > 0) {
            const currentSelectedLocale = document.querySelector('#currentLocalization').value;
            API.locale = selectedNationalCalendar[0].locales.includes(currentSelectedLocale) ? currentSelectedLocale : selectedNationalCalendar[0].locales[0];
            headers['Accept-Language'] = API.locale.replaceAll('_', '-');
        } else {
            // The selected national calendar does not exist
            // Filter possible locales by nation
            console.log(`API.path is ${API.path} (category is ${API.category} and key is ${API.key}).`);
            API.locale = likelyLanguage(API.key);
            console.log(`likelyLanguage = ${API.locale} (nation is ${API.key})`);
            headers['Accept-Language'] = API.locale;
        }
    } else {
        headers['Accept-Language'] = API.locale.replaceAll('_', '-');
    }
    console.log(`API.path is ${API.path} (category is ${API.category} and key is ${API.key}). Locale set to ${API.locale === '' ? ' (empty string)' : API.locale}. Now checking if a calendar already exists...`);

    const eventsUrlForCurrentCategory = API.category === 'widerregion' || (API.category === 'nation' && false === LitCalMetadata.national_calendars_keys.includes(API.key))
        ? `${EventsURL}`
        : `${EventsURL}/${API.category}/${API.key}`;

    // Only fetch events if we don't already have them, and if they are available
    if (
        false === EventsCollection.has(eventsUrlForCurrentCategory)
        || false === EventsCollection.get(eventsUrlForCurrentCategory).has(API.locale)
        || (eventsUrlForCurrentCategory === EventsURL && LitCalMetadata.locales.includes(API.locale))
    ) {
        console.log(`EventsCollection.has(eventsUrlForCurrentCategory): ${EventsCollection.has(eventsUrlForCurrentCategory)}`);
        console.log(`EventsCollection.get(eventsUrlForCurrentCategory).has(API.locale): ${EventsCollection.has(eventsUrlForCurrentCategory) && EventsCollection.get(eventsUrlForCurrentCategory).has(API.locale)}`);
        console.log(`eventsUrlForCurrentCategory === EventsURL && LitCalMetadata.locales.includes(API.locale): ${eventsUrlForCurrentCategory === EventsURL && LitCalMetadata.locales.includes(API.locale)}`);
        console.log('If either of the first two conditions is false, or the third condition is true, then we procced to fetch events...');
        if (false === EventsCollection.has(eventsUrlForCurrentCategory)) {
            EventsCollection.set(eventsUrlForCurrentCategory, new Map());
        }
        const request = new Request(eventsUrlForCurrentCategory, {
            method: 'GET',
            headers
        });
        fetch(request).then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return Promise.reject(response);
            }
        }).then(json => {
            const eventsMap = new Map(json.litcal_events.map(el => [el.event_key, el?.name ?? '']));
            const emptyPercentage = emptyStringPercentage(eventsMap);
            if (emptyPercentage > 50) {
                console.warn('Warning: More than 50% of event names are empty strings.');
                toastr["warning"]('More than 50% of event names are empty strings, perhaps you should finish translating before creating a new calendar?', 'Warning');
            } else {
                console.log(`More than 50% of event names are translated, translated string percentage = ${100-emptyPercentage}%`);
            }
            EventsCollection.get(eventsUrlForCurrentCategory).set(API.locale, json.litcal_events.map(el => LiturgicalEvent.fromObject(el)));
            const keys = json.litcal_events.map(el => el.event_key);
            EventsCollectionKeys.set(eventsUrlForCurrentCategory, keys);
            EventsLoader.lastRequestPath = eventsUrlForCurrentCategory;
            EventsLoader.lastRequestLocale = API.locale;
            console.log('EventsLoader.lastRequestPath:', EventsLoader.lastRequestPath, 'EventsLoader.lastRequestLocale:', EventsLoader.lastRequestLocale, 'EventsCollection:', EventsCollection );
            document.querySelector('#existingLiturgicalEventsList').innerHTML = EventsCollection.get(eventsUrlForCurrentCategory).get(API.locale).map(el => `<option value="${el.event_key}">${el.name}</option>`).join('\n');
        }).catch(error => {
            console.error(error);
        }).finally(() => {
            fetchRegionalCalendarData(headers);
        });
    } else {
        fetchRegionalCalendarData(headers);
    }
}

/**
 * Handles the change event for the regional/national calendar name input.
 *
 * This function updates the API category and key based on the selected calendar name.
 * It invokes the fetchEventsAndCalendarData function to retrieve events and calendar
 * data for the selected calendar.
 *
 * @param {Event} ev - The event object associated with the change event.
 * @returns {void}
 */
const regionalNationalCalendarNameChanged = (ev) => {
    document.querySelector('#overlay').classList.remove('hidden');
    API.category = ev.target.dataset.category;
    // our proxy will take care of splitting locale from wider region, when we are setting a wider region key
    API.key = ev.target.value;
    fetchEventsAndCalendarData();
}

/**
 * Toggle between strtotime and day/month input for a given row in the on the fly form.
 * @param {Event} ev - The event object of the click event.
 */
const datetypeToggleBtnClicked = (ev) => {
    const uniqid = parseInt( ev.target.dataset.rowUniqid);
    console.log(`uniqid: ${uniqid}`);
    if ( ev.target.classList.contains('strtotime') ) {
        const dayVal = document.querySelector(`#onTheFly${uniqid}Day`).value;
        const monthVal = document.querySelector(`#onTheFly${uniqid}Month`).value;
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
        const monthWasVal = parseInt(dayMonthWasVal[1]) ?? '';
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
}

/**
 * Creates a unique key for a liturgical event based on its name, by splitting on
 * the first comma (if applicable), removing accented characters, reducing multiple
 * spaces to single spaces, removing leading and trailing spaces, splitting into
 * words, capitalizing the first letter of each word, and joining them back together.
 * @param {string} name - The name of the liturgical event.
 * @returns {string} A unique key for the liturgical event.
 */
const createEventKey = (name) => name.split(',')[0] // only consider everything up to the first comma (if applicable)
    .normalize('NFD')                // split accented characters
    .replace(/[\u0300-\u036f]/g, '') // remove accented characters
    .replace(/\s+/g, ' ')            // reduce multiple spaces to single spaces
    .trim()                          // remove leading and trailing spaces
    .split(/[^a-zA-Z]/)              // split into words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // capitalize first letter of each word
    .join('');

/**
 * Handles the submission of the action prompt modal. Depending on the action, it will:
 * - Create a new row in the regional national data form
 * - Populate the missal field with the value of the existing liturgical_event
 * - Set the action and property to change for the new row
 * - Set the common multiselect field
 * - Disable the color field if there is no use in modifying this information
 * - Disable the grade field if there is no use in modifying this information
 * - Disable the month field if there is no use in modifying this information
 * - Disable the common field if there is no use in modifying this information
 * - Enable the serialize button
 * @param {Event} ev the event object
 */
const actionPromptButtonClicked = (ev) => {
    const currentUniqid = FormControls.uniqid;
    const modal = ev.target.closest('.actionPromptModal');
    const modalForm = modal.querySelector('form');
    const actionButtonId = ev.target.id;
    const liturgicalEventInputVal = sanitizeInput( modalForm.querySelector('.existingLiturgicalEventName').value );
    const eventKey = actionButtonId === 'newLiturgicalEventExNovoButton' ? '' : liturgicalEventInputVal;

    let existingLiturgicalEvent;
    let propertyToChange;
    let fragment
    let controlsRow;

    if (
        actionButtonId !== 'newLiturgicalEventExNovoButton'
        && EventsLoader.lastRequestPath !== ''
        && EventsLoader.lastRequestLocale !== ''
    ) {
        existingLiturgicalEvent = EventsCollection.get(EventsLoader.lastRequestPath).get(EventsLoader.lastRequestLocale)
                                    .find(liturgical_event => liturgical_event.event_key === eventKey);
    }

    FormControls.settings.decreeURLFieldShow = true;
    FormControls.settings.decreeLangMapFieldShow = document.querySelector('.regionalNationalCalendarName').id === 'widerRegionCalendarName';
    setFormSettings( actionButtonId );
    console.log(`FormControls.action = ${FormControls.action}, actionButtonId = ${actionButtonId}`);

    if ( actionButtonId === 'setPropertyButton' ) {
        propertyToChange = document.querySelector('#propertyToChange').value;
        setFormSettingsForProperty( propertyToChange );
    }

    if ( existingLiturgicalEvent instanceof LiturgicalEvent ) {
        ({fragment, controlsRow} = FormControls.CreateRegionalFormRow( existingLiturgicalEvent ));
        if (FormControls.settings.missalFieldShow) {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Missal`).value = existingLiturgicalEvent.missal;
        }
    }
    else if ( eventKey !== '' && existingLiturgicalEvent !== undefined ) {
        ({fragment, controlsRow} = FormControls.CreateRegionalFormRow( eventKey ));
        if ( FormControls.settings.missalFieldShow ) {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Missal`).value = existingLiturgicalEvent.missal; //.prop('disabled', true);
        }
    } else {
        ({fragment, controlsRow} = FormControls.CreateRegionalFormRow());
        if (liturgicalEventInputVal !== '') {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Name`).value = liturgicalEventInputVal;
            if (FormControls.settings.eventKeyField) {
                // we create a default event key based on the liturgical_event name
                const newEventKey = createEventKey(liturgicalEventInputVal);
                controlsRow.querySelector(`#onTheFly${currentUniqid}EventKey`).value = newEventKey;
            }
        }
    }
    document.querySelector('.regionalNationalDataForm').append(fragment);
    bootstrap.Modal.getInstance(modal).hide();

    controlsRow.setAttribute('data-action', FormControls.action);
    if ( FormControls.action === RowAction.SetProperty ) {
        console.log('propertyToChange is of type ' + typeof propertyToChange + ' and has a value of ' + propertyToChange);
        controlsRow.setAttribute('data-prop', propertyToChange);
    }

    if (
        ['newLiturgicalEventExNovoButton', 'designatePatronButton'].includes(actionButtonId)
        ||
        (actionButtonId === 'setPropertyButton' && propertyToChange === 'name')
    ) {
        if (document.querySelector('.calendarLocales').selectedOptions.length > 1) {
            const currentLocalization = document.querySelector('#currentLocalization').value;
            const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                        .filter(({ value }) => value !== currentLocalization)
                                        .map(({ value }) => value);
            const nameInput = controlsRow.querySelector(`#onTheFly${currentUniqid}Name`);
            const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(API.path, localization, nameInput));
            nameInput.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
        }
    }

    $(controlsRow.querySelector('.litEventColor')).multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    }).multiselect('deselectAll', false);

    if (FormControls.settings.colorField === false) {
        $(controlsRow.querySelector('.litEventColor')).multiselect('disable');
    } else {
        if (actionButtonId === 'newLiturgicalEventExNovoButton') {
            // Attempt to set liturgical color to red for martyrs, white for all other cases
            if (controlsRow.querySelector('.litEventName').value.match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                $(controlsRow.querySelector('.litEventColor')).multiselect('select', 'red');
            } else {
                $(controlsRow.querySelector('.litEventColor')).multiselect('select', 'white');
            }
        }
    }

    if (FormControls.settings.commonFieldShow) {
        setCommonMultiselect( controlsRow, null );
        if (FormControls.settings.commonField === false) {
            $(controlsRow.querySelector(`#onTheFly${currentUniqid}Common`)).multiselect('disable');
        }
    }

    if (FormControls.settings.gradeFieldShow) {
        controlsRow.querySelector(`#onTheFly${currentUniqid}Grade`).disabled = !FormControls.settings.gradeField;
    }

    if ( eventKey !== '' && existingLiturgicalEvent !== undefined ) {
        if (FormControls.settings.gradeFieldShow) {
            controlsRow.querySelector(`#onTheFly${currentUniqid}Grade`).value = existingLiturgicalEvent.grade;
        }
        $(controlsRow.querySelector(`#onTheFly${currentUniqid}Common`)).multiselect('select', existingLiturgicalEvent.common);
        const colorVal = Array.isArray( existingLiturgicalEvent.color ) ? existingLiturgicalEvent.color : existingLiturgicalEvent.color.split(',');
        $(controlsRow.querySelector(`.litEventColor`)).multiselect('select', colorVal);

        if (FormControls.settings.monthField === false) {
            controlsRow.querySelectorAll(`#onTheFly${currentUniqid}Month > option[value]:not([value="${existingLiturgicalEvent.month}"])`).forEach(el => { el.disabled = true; });
        }
    }

    document.querySelector('.serializeRegionalNationalData').disabled = false;
}


/**
 * Handles the deletion of a regional/national calendar from the API.
 *
 * This function manages the deletion of the regional/national calendar from the API.
 * It checks if the currently selected calendar is present in the list of calendars.
 * If it is, it sends a request to delete the calendar and resets the form.
 *
 * The function also updates the global metadata and resets the form inputs.
 *
 * The function handles form validation, error handling, and updates to the global
 * metadata after a successful delete. It sets the request method to DELETE,
 * the API.category based on the current selected calendar, and the API.key based
 * on the current selected calendar.
 */
const deleteCalendarConfirmClicked = () => {
    document.querySelector('#overlay').classList.remove('hidden');

    const removeCalendarDataPrompt = document.querySelector('#removeCalendarDataPrompt');
    bootstrap.Modal.getInstance(removeCalendarDataPrompt).hide();

    API.category = document.querySelector('.regionalNationalCalendarName').dataset.category;
    API.key = document.querySelector('.regionalNationalCalendarName').value;
    const headers = new Headers({
        'Accept': 'application/json',
        'Accept-Language': API.locale
    });
    const request = new Request(API.path, {
        method: 'DELETE',
        headers
    });
    fetch(request).then(response => {
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
                        formSelect.dispatchEvent(new CustomEvent('change', {
                            bubbles: true,
                            cancelable: true
                          }));
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
        } else if (response.status === 400) {
            response.json().then(json => {
                console.error(`${response.status} ${json.response}: ${json.description}`);
                toastr["error"](`${response.status} ${json.response}: ${json.description}`, "Error");
            });
        } else {
            return Promise.reject(response);
        }
    }).catch(error => {
        console.error(error);
    }).finally(() => {
        document.querySelector('#overlay').classList.add('hidden');
    });
}


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
 *          "liturgical_event": {
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
 *          "liturgical_event": {
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
 * - moveEvent (takes a liturgical event that is already defined in the General Roman Calendar and moves it to a different date)
 *      {
 *          "liturgical_event": {
 *              "event_key": string,
 *              "name": string,
 *              "day": number,
 *              "month": number,
 *              "missal": string,
 *              "reason": string
 *          },
 *          "metadata": {
 *              "action": "moveEvent"
 *          }
 *     }[]
 *
 * - createNew (creates a new fixed date liturgical event for the wider region or national calendar)
 *      - createNew with common=Proper
 *      {
 *          "liturgical_event": {
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
 *                  "gospel_acclamation": string,
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
 *          "liturgical_event": {
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
 *          and a "strtotime" property of type string will be added to the liturgical_event object.
 *
 *   N.B. For any action, if since_year, until_year, url, or url_lang_map are defined, they will be added to the metadata object:
 *          - metadata.since_year,
 *          - metadata.until_year,
 *          - metadata.url,
 *          - metadata.url_lang_map
*/
const serializeRegionalNationalDataClicked = (ev) => {
    document.querySelector('#overlay').classList.remove('hidden');
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
                wider_region: document.querySelector('#widerRegionCalendarName').value.split(' - ')[0]
            };
            break;
        }
    }
    payload.i18n = {};
    payload.i18n[API.locale] = {};

    const rows = document.querySelectorAll('.regionalNationalDataForm .row');
    rows.forEach(row => {
        const { action } = row.dataset;
        console.log(`action = ${action}`);
        /**
         * @type RowData
         */
        let rowData = {
            liturgical_event: {},
            metadata: {
                action
            }
        }

        if ( action === RowAction.SetProperty ) {
            rowData.metadata.property = row.dataset.prop;
        }

        console.log('collecting payload properties', payloadProperties[action], ' based on action', action);
        payloadProperties[action].forEach(prop => {
            const propClass = '.litEvent' + snakeCaseToPascalCase(prop);
            console.log('transforming', prop, 'to Pascal Case: ', propClass);
            const propEl = row.querySelector(propClass);
            if ( propEl ) {
                let val = propEl.value;
                if ( integerProperties.includes(prop) ) {
                    val = parseInt( val );
                }
                if ( metadataProperties.includes(prop) ) {
                    rowData.metadata[prop] = val;
                } else {
                    if (propEl.tagName === 'SELECT' && propEl.multiple) {
                        const selectedOptions = Array.from(propEl.selectedOptions);
                        val = selectedOptions.map(({ value }) => value);
                    }
                    if ('name' === prop) {
                        if (
                            action !== RowAction.SetProperty
                            ||
                            (action === RowAction.SetProperty && rowData.metadata.property === 'name')
                        ) {
                            const eventKey = sanitizeInput(row.querySelector('.litEventEventKey').value);
                            payload.i18n[API.locale][eventKey] = val;

                            // Find all input elements with the data-locale attribute within the same parent
                            const localeInputs = row.querySelectorAll('input[data-locale]');

                            localeInputs.forEach(el => {
                                const locale = el.dataset.locale;
                                const value = el.value;

                                // Ensure the locale object exists in saveObj.payload.i18n
                                if (false === payload.i18n.hasOwnProperty(locale)) {
                                    payload.i18n[locale] = {};
                                }

                                // Assign the value to the corresponding eventKey
                                payload.i18n[locale][eventKey] = value;
                            });
                        }
                    } else {
                        rowData.liturgical_event[prop] = val;
                    }
                }
            } else {
                console.warn(`No element found in current row for ${propClass}`);
            }
        });

        console.log('rowData so far:', rowData);

        if ( action === RowAction.CreateNew && rowData.liturgical_event.common.includes( 'Proper' ) ) {
            rowData.liturgical_event.readings = {
                first_reading: row.querySelector('.litEventReadings_FIRST_READING').value,
                responsorial_psalm: row.querySelector('.litEventReadings_RESPONSORIAL_PSALM').value,
                gospel_acclamation: row.querySelector('.litEventReadings_ALLELUIA_VERSE').value,
                gospel: row.querySelector('.litEventReadings_GOSPEL').value
            };
            if ( row.querySelector('.litEventReadings_SECOND_READING').value !== '' ) {
                rowData.liturgical_event.readings.second_reading = row.querySelector('.litEventReadings_SECOND_READING').value;
            }
        }

        const litEventSinceYearEl = row.querySelector('.litEventSinceYear');
        if ( litEventSinceYearEl ) {
            const sinceYear = parseInt(litEventSinceYearEl.value);
            if ( sinceYear > 1582 && sinceYear <= 9999 ) {
                rowData.metadata.since_year = sinceYear;
            }
        }

        const litEventUntilYearEl = row.querySelector('.litEventUntilYear');
        if ( litEventUntilYearEl ) {
            const untilYear = parseInt(litEventUntilYearEl.value);
            if ( untilYear >= 1970 && untilYear <= 9999 ) {
                rowData.metadata.until_year = untilYear;
            }
        }

        const litEventDecreeUrlEl = row.querySelector('.litEventDecreeURL');
        if ( litEventDecreeUrlEl ) {
            const decreeURL = litEventDecreeUrlEl.value;
            if ( decreeURL !== '' ) {
                rowData.metadata.url = decreeURL;
            }
        }

        const litEventDecreeLangsEl = row.querySelector('.litEventDecreeLangs');
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

    console.log('payload so far:', payload);
    const finalPayload = API.category === 'nation'
        ? Object.freeze(new NationalCalendarPayload(payload.litcal, payload.settings, payload.metadata, payload.i18n))
        : Object.freeze(new WiderRegionPayload(payload.litcal, payload.national_calendars, payload.metadata, payload.i18n));

    const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    });
    if ( API.locale !== '' ) {
        headers.append('Accept-Language', API.locale);
    }

    const request = new Request(API.path, {
        method: API.method,
        headers,
        body: JSON.stringify(finalPayload)
    });

    console.log('we are ready to make the request', request);
    console.log('final payload:', finalPayload);
    console.log('json stringified payload:', JSON.stringify(finalPayload));

    fetch(request)
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
    }).finally(() => {
        document.querySelector('#overlay').classList.add('hidden');
    });
}

/**
 * Diocesan Calendar interactions
 */

/**
 * Sets focus on the first tab of the diocesan calendar definition form with non-empty data.
 */
const setFocusFirstTabWithData = () => {
    document.querySelectorAll('#diocesanCalendarDefinitionCardLinks li').forEach(el => el.classList.remove('active'));
    const firstInputWithNonEmptyValue = Array.from(document.querySelectorAll('.carousel-item form .litEventName')).find(el => el.dataset.valuewas !== '');
    if (!firstInputWithNonEmptyValue) {
        return;
    }
    const parentCarouselItem = firstInputWithNonEmptyValue.closest('.carousel-item');
    const itemIndex = Array.from(document.querySelectorAll('.carousel-item')).indexOf(parentCarouselItem);
    const carouselElement = document.querySelector('.carousel');
    const carousel = bootstrap.Carousel.getInstance(carouselElement);
    carousel.to(itemIndex);
    document.querySelector(`#diocesanCalendarDefinitionCardLinks li:nth-child(${itemIndex+2})`).classList.add('active');
}

/**
 * Rebuilds the other localization input fields for the given localization list.
 * This method is used when the user changes the primary localization of the calendar.
 *
 * @param {Array<string>} otherLocalizations - A list of localization codes that are not the primary localization.
 * @returns {void}
 */
const refreshOtherLocalizationInputs = (otherLocalizations) => {
    const previousValues = resetOtherLocalizationInputs();
    console.log('stored previousValues as follows:', previousValues);
    switch (API.category) {
        case 'diocese': {
            Array.from(document.querySelectorAll('.litEventName')).filter(el => el.dataset.valuewas !== '').forEach(el => {
                const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(API.path, localization, el));
                el.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
            });
            break;
        }
        default: {
            Array.from(document.querySelectorAll('.litEventName')).filter(el => {
                const closestRow = el.closest('.row');
                return (
                    closestRow.querySelector('.litEventEventKey')
                    && (
                        [
                            RowAction.CreateNew,
                            RowAction.CreateNewFromExisting,
                            RowAction.MakePatron,
                            RowAction.MakeDoctor
                        ].includes(closestRow.dataset.action)
                        || (closestRow.dataset.action === RowAction.SetProperty && closestRow.dataset.prop === 'name')
                    )
                );
            }).forEach(el => {
                const otherLocalizationsInputs = otherLocalizations.map(localization => translationTemplate(API.path, localization, el));
                el.insertAdjacentHTML('afterend', otherLocalizationsInputs.join(''));
                let currentEl = el;
                while (currentEl.nextSibling) {
                    currentEl = currentEl.nextSibling;
                    const inputEl = currentEl.querySelector('input');
                    if (inputEl.value === '' && previousValues.has(inputEl.id)) {
                        inputEl.value = previousValues.get(inputEl.id);
                    }
                }
            });
        }
    }
}

/**
 * Resets the localization input fields for liturgical event names.
 *
 * This function iterates over all elements with the class 'litEventName',
 * and removes any sibling elements that follow each 'litEventName' element.
 * This effectively clears any localization inputs that were previously
 * added after these elements, ensuring a clean state for localization input.
 */
const resetOtherLocalizationInputs = () => {
    const previousValues = new Map();
    Array.from(document.querySelectorAll('.litEventName')).forEach(el => {
        while (el.nextSibling) {
            const inputEl = el.nextSibling.querySelector('input');
            if (inputEl && inputEl.value !== '') {
                console.log('nextSibling input.id:', inputEl.id, 'nextSibling input.value:', inputEl.value);
                previousValues.set(inputEl.id, inputEl.value);
            }
            el.nextSibling.remove();
        }
    });
    return previousValues;
}

/**
 * Handles retrieving the Diocesan Calendar data and related i18n data from the API.
 * @function
 */
const loadDiocesanCalendarData = () => {
    API.category = 'diocese';
    document.querySelector('#overlay').classList.remove('hidden');

    const dioceseSelect = document.getElementById('diocesanCalendarDioceseName');
    const diocese = dioceseSelect.value;
    const dioceseOption = document.querySelector(`#DiocesesList > option[value="${diocese}"]`);
    const dioceseKey = dioceseOption ? dioceseOption.dataset.value : null;
    API.key = dioceseKey;

    //let dioceseMetadata = LitCalMetadata.diocesan_calendars.filter(item => item.calendar_id === API.key)[0];
    API.locale = document.querySelector('#currentLocalization').value;
    const headers = new Headers({
        'Accept': 'application/json',
        'Accept-Language': API.locale
    });
    const request = new Request(API.path, {
        method: 'GET',
        headers
    });
    fetch(request).then(response => {
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
        if (!data || !Array.isArray(data.litcal)) {
            // 404 / new calendar case: nothing to fill, remain in PUT mode
            return;
        }
        API.method = 'PATCH';
        console.log('retrieved diocesan data:', data);
        toastr["success"]("Diocesan Calendar was retrieved successfully", "Success");
        CalendarData = data;
        CalendarData.i18n = {};
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
            const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                        .filter(({ value }) => value !== currentLocalization)
                                        .map(({ value }) => value);
            if (DataLoader.lastRequestPath !== API.path) {
                // We are requesting a totally different calendar, we need to reload ALL i18n data
                Promise.all(otherLocalizations.map(localization => fetch(API.path + '/' + localization).then(response => response.json()))).then(data => {
                    toastr["success"]("Diocesan Calendar translation data was retrieved successfully", "Success");
                    if (false === TranslationData.has(API.path)) {
                        TranslationData.set(API.path, new Map());
                    }
                    data.forEach((localizationData, i) => {
                        TranslationData.get(API.path).set(otherLocalizations[i], localizationData);
                    });
                    console.log('TranslationData:', TranslationData);
                    refreshOtherLocalizationInputs(otherLocalizations);
                    DataLoader.lastRequestPath = API.path;
                    DataLoader.lastRequestLocale = currentLocalization;
                });
            }
            else {
                // We are requesting the same calendar, just with a different locale
                // We don't need to reload ALL i18n data, just the data for the last locale, if we haven't already
                if (DataLoader.allLocalesLoaded.hasOwnProperty(API.path)) {
                    refreshOtherLocalizationInputs(otherLocalizations);
                } else {
                    fetch(API.path + '/' + DataLoader.lastRequestLocale).then(response => response.json()).then(localizationData => {
                        if (false === TranslationData.has(API.path)) {
                            TranslationData.set(API.path, new Map());
                        }
                        TranslationData.get(API.path).set(DataLoader.lastRequestLocale, localizationData);
                        console.log('TranslationData:', TranslationData);
                        refreshOtherLocalizationInputs(otherLocalizations);
                        DataLoader.allLocalesLoaded[API.path] = true;
                    });
                }
            }
        }

        setFocusFirstTabWithData();
    }).catch(error => {
        if ( error instanceof Error && error.message.startsWith('404') ) { //we have already handled 404 Not Found above
            return;
        }
        toastr["error"](error.message, "Error");
    }).finally(() => {
        document.querySelector('#overlay').classList.add('hidden');
    });
}


/**
 * Handles the creation of a new liturgical_event row when the corresponding button is clicked in the "On the fly" form.
 * @param {Event} ev - The event object of the click event.
 * @returns {void}
 */
const onTheFlyEventRowClicked = (ev) => {
    let row;
    let form;
    switch (ev.target.id) {
        case "addSolemnity":
            FormControls.title = Messages['Other Solemnity'];
            row = FormControls.CreateDiocesanFormRow();
            form = document.querySelector('.carousel-item:nth-child(1) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
        case "addFeast":
            FormControls.title = Messages['Other Feast'];
            row = FormControls.CreateDiocesanFormRow();
            form = document.querySelector('.carousel-item:nth-child(2) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
        case "addMemorial":
            FormControls.title = Messages['Other Memorial'];
            row = FormControls.CreateDiocesanFormRow();
            form = document.querySelector('.carousel-item:nth-child(3) form');
            form.insertAdjacentHTML('beforeend', row);
            break;
        case "addOptionalMemorial":
            FormControls.title = Messages['Other Optional Memorial'];
            row = FormControls.CreateDiocesanFormRow();
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
 * Inserts a day input and month select dropdown based on the provided liturgical_event data.
 *
 * @param {HTMLElement} row - The containing row of the form.
 * @param {Object} LiturgicalEvent - The liturgical_event data object containing day and month information.
 */
const unswitcheroo = ( row, LiturgicalEvent ) => {
    const litEventStrtotime = row.querySelector('.litEventStrtotime');
    const strToTimeFormGroup = litEventStrtotime.closest('.form-group');
    strToTimeFormGroup.classList.remove('col-sm-3');
    strToTimeFormGroup.classList.add('col-sm-2');
    const dayId = litEventStrtotime.id.replace('Strtotime', 'Day');
    const monthId = litEventStrtotime.id.replace('Strtotime', 'Month');
    strToTimeFormGroup.insertAdjacentHTML('beforestart', `<div class="form-group col-sm-1">
    <label for="${dayId}">${Messages[ "Day" ]}</label><input type="number" min="1" max="31" class="form-control litEvent litEventDay" id="${dayId}" value="${LiturgicalEvent.day ?? 1}" />
    </div>`);
    litEventStrtotime.remove();
    let formRow = `<select class="form-select litEvent litEventMonth" id="${monthId}">`;
    const formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
    for (let i = 0; i < 12; i++) {
        const month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
        formRow += `<option value=${i + 1}${(i+1)===LiturgicalEvent.month ? ' selected' : ''}>${formatter.format(month)}</option>`;
    }
    formRow += `</select>`;
    strToTimeFormGroup.insertAdjacentHTML('beforeend', formRow);
    const monthLabel = strToTimeFormGroup.querySelector('.month-label');
    monthLabel.textContent = Messages[ 'Month' ];
    monthLabel.setAttribute('for', monthId);
}

/**
 * Populates the diocesan form with data from the provided liturgical calendar object.
 *
 * Iterates through the liturgical calendar data and creates or updates form rows
 * for each liturgical_event based on its grade and metadata. Adjusts the form's input fields
 * and settings according to whether the liturgical_event uses a fixed date or a strtotime format.
 * Sets form fields such as name, date, common, color, and year constraints for each liturgical_event.
 *
 * @param {Object} data - The data object containing the liturgical calendar information.
 * @param {Array} data.litcal - An array of objects representing festivities with their metadata.
 */
const fillDiocesanFormWithData = (data) => {
    for (const entry of data.litcal) {
        const { liturgical_event, metadata } = entry;
        let row;
        let numLastRow;
        let numMissingRows;
        if (liturgical_event.hasOwnProperty('strtotime')) {
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.strtotimeFieldShow = true;
        } else {
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.strtotimeFieldShow = false;
        }
        switch (liturgical_event.grade) {
            case Rank.SOLEMNITY:
                numLastRow = document.querySelectorAll('#carouselItemSolemnities form .row').length - 1;
                if (metadata.form_rownum > numLastRow) {
                    numMissingRows = metadata.form_rownum - numLastRow;
                    FormControls.title = Messages['Other Solemnity'];
                    FormControls.settings.commonField = true;
                    while (numMissingRows-- > 0) {
                        document.querySelector('#carouselItemSolemnities form').insertAdjacentHTML('beforeend', FormControls.CreateDiocesanFormRow());
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
                         document.querySelector('#carouselItemFeasts form').insertAdjacentHTML('beforeend', FormControls.CreateDiocesanFormRow());
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
                        document.querySelector('#carouselItemMemorials form').insertAdjacentHTML('beforeend', FormControls.CreateDiocesanFormRow());
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
                        document.querySelector('#carouselItemOptionalMemorials form').insertAdjacentHTML('beforeend', FormControls.CreateDiocesanFormRow());
                    }
                }
                row = document.querySelectorAll('#carouselItemOptionalMemorials form .row')[metadata.form_rownum];
                break;
        }
        row.querySelector('.litEventName').value = liturgical_event.name;
        row.querySelector('.litEventName').setAttribute('data-valuewas', liturgical_event.event_key);

        if ( liturgical_event.hasOwnProperty('strtotime') ) {
            if ( row.querySelectorAll('.litEventStrtotime').length === 0 ) {
                switcheroo( row, metadata );
            }
            row.querySelector('.litEventStrtotime').value = liturgical_event.strtotime;
        } else {
            if ( row.querySelectorAll('.litEventStrtotime').length > 0 ) {
                unswitcheroo( row, liturgical_event );
            }
            row.querySelector('.litEventDay').value = liturgical_event.day;
            row.querySelector('.litEventMonth').value = liturgical_event.month;
        }
        setCommonMultiselect( row, liturgical_event.common );
        $(row.querySelector('.litEventColor')).multiselect({
            buttonWidth: '100%',
            buttonClass: 'form-select',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
            }
        }).multiselect('deselectAll', false).multiselect('select', liturgical_event.color);
        row.querySelector('.litEventSinceYear').value = metadata.since_year;
        if ( metadata.hasOwnProperty('until_year') ) {
            row.querySelector('.litEventUntilYear').value = metadata.until_year;
        } else {
            row.querySelector('.litEventUntilYear').min = metadata.since_year + 1;
        }
    }
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

/**
 * Handles the change event for the national calendar select list.
 *
 * When the selected national calendar changes, we need to update the list of dioceses, locales, and timezones.
 * This function is called when the user selects a different national calendar from the select list.
 *
 * It disables the "Remove diocesan data" button, removes the diocese remove prompt if it exists, and resets the
 * selected diocese, list of dioceses for the current selected nation, diocesanCalendarGroup, list of locales for the
 * current selected nation, and list of timezones for the current selected nation.
 *
 * @param {Event} ev - The event object for the change event.
 */
const diocesanCalendarNationalDependencyChanged = (ev) => {
    console.log('National dependency changed', ev);
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
        ? Object.freeze(Object.entries(AvailableLocalesWithRegion).filter(([key, ]) => key.split('_').pop() === currentSelectedNation))
        : Object.freeze(Object.entries(AvailableLocalesWithRegion));
    }
    if (localesForNation.length > 0) {
        const diocesanCalendarLocales = document.getElementById('diocesanCalendarLocales');
        diocesanCalendarLocales.innerHTML = localesForNation.map(item => `<option value="${item[0]}" selected>${item[1]}</option>`).join('');
        $(diocesanCalendarLocales).multiselect('rebuild');
        const currentLocalization = document.getElementById('currentLocalization');
        currentLocalization.innerHTML = localesForNation.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
        //currentLocalization.value = '';
    } else {
        // this should never be the case?
    }

    // Reset the list of timezones for the current selected nation
    const timezonesForCountry = currentSelectedNation !== '' ? tzdata.filter(tz => tz.countryCode === currentSelectedNation): tzdata;
    const timezonesOptions = timezonesForCountry.map(tz => `<option value="${tz.name}" title="${tz.alternativeName} (${tz.mainCities.join(' - ')})">${tz.name} (${tz.abbreviation})</option>`);
    document.querySelector('#diocesanCalendarTimezone').innerHTML = timezonesOptions.length ? timezonesOptions.join('') : '<option value=""></option>';
}

/**
 * Handles the change event for the diocese name input in the diocesan calendar form.
 *
 * This function is triggered when the diocese name input changes. It processes the input
 * value, resets the form, and updates the calendar data and UI elements based on the selected diocese.
 * It also manages the API request setup, including the method and key, and handles the display of
 * localization options and timezone settings for the selected diocese.
 *
 * If the selected diocese is found in the diocesan calendars metadata, it enables the removal
 * of diocesan data and loads additional data for editing. Otherwise, it prepares the form for
 * creating a new diocesan calendar.
 *
 * @param {Event} ev - The event object for the change event.
 */
const diocesanCalendarDioceseNameChanged = (ev) => {
    const currentVal = sanitizeInput( ev.target.value );
    CalendarData = { litcal: [], i18n: {} };
    document.querySelectorAll('.carousel-item form').forEach(form => {
        form.reset();
        form.querySelectorAll('.row').forEach((row, idx) => {
            if (idx >= 3) {
                if (row.previousElementSibling && row.previousElementSibling.querySelector('.data-group-title')) {
                    row.previousElementSibling.remove();
                }
                row.remove();
            }
        });
        form.querySelectorAll('.litEventCommon').forEach(el => $(el).multiselect('deselectAll', false).multiselect('select', 'Proper'));
        form.querySelectorAll('.litEventColor').forEach(el => $(el).multiselect('deselectAll', false).multiselect('select', 'white'));
        form.querySelectorAll('.litEventName').forEach(el => el.setAttribute('data-valuewas', ''));
    });
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.classList.remove('was-validated'));
    const selectedOption = document.querySelector(`#DiocesesList > option[value="${currentVal}"]`);
    if (selectedOption) {
        ev.target.classList.remove('is-invalid');
        resetOtherLocalizationInputs();
        API.category = 'diocese';
        API.key = selectedOption.getAttribute('data-value');
        console.log('selected diocese with key = ' + API.key);
        if (LitCalMetadata.diocesan_calendars_keys.includes(API.key)) {
            API.method = 'PATCH';
            const diocesan_calendar = LitCalMetadata.diocesan_calendars.find(el => el.calendar_id === API.key);

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
            const LocalesForDiocese = Object.entries(AvailableLocalesWithRegion).filter(([localeIso, ]) => diocesan_calendar.locales.includes(localeIso));
            document.querySelector('#currentLocalization').innerHTML = LocalesForDiocese.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
            $('#diocesanCalendarLocales').multiselect('deselectAll', false).multiselect('select', diocesan_calendar.locales);

            // Set the timezone for the current selected diocese
            document.querySelector('#diocesanCalendarTimezone').value = diocesan_calendar.timezone;

            loadDiocesanCalendarData();
        } else {
            API.method = 'PUT';
            document.querySelector('#removeExistingDiocesanDataBtn').disabled = true;
            const removePrompt = document.getElementById('removeDiocesanCalendarPrompt');
            if (removePrompt) {
                removePrompt.remove();
            }
        }
    } else {
        ev.target.classList.add('is-invalid');
    }
}

/**
 * Handles the delete button click event for the diocesan calendar form.
 *
 * This function manages the deletion of the diocesan calendar from the API.
 * It checks if the diocese currently selected is present in the list of diocesan calendars.
 * If it is, it sends a request to delete the diocesan calendar and resets the form.
 *
 * The function also updates the global metadata and resets the form inputs.
 *
 * The function handles form validation, error handling, and updates to the global
 * metadata after a successful delete. It sets the request method to DELETE,
 * the API.category to 'diocese', and the API.key based on the current selected calendar.
 *
 * @returns {void}
 */
const deleteDiocesanCalendarConfirmClicked = () => {
    document.querySelector('#overlay').classList.remove('hidden');
    const modalElement = document.getElementById('removeDiocesanCalendarPrompt');
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal.toggle();
    document.querySelector('#diocesanCalendarNationalDependency').focus();

    API.method = 'DELETE';
    API.category = 'diocese';
    const diocese = document.querySelector('#diocesanCalendarDioceseName').value;
    API.key = document.querySelector('#DiocesesList option[value="' + diocese + '"]').dataset.value;

    const headers = new Headers({
        'Accept': 'application/json'
    });

    const request = new Request(API.path, {
        method: API.method,
        headers
    });

    fetch(request).then(response => {
        if (response.ok) {
            LitCalMetadata.diocesan_calendars = LitCalMetadata.diocesan_calendars.filter(el => el.calendar_id !== API.key);
            LitCalMetadata.diocesan_calendars_keys = LitCalMetadata.diocesan_calendars_keys.filter(el => el !== API.key);

            document.getElementById('diocesanCalendarNationalDependency').value = '';
            document.getElementById('diocesanCalendarNationalDependency').dispatchEvent(new CustomEvent('change', {
                bubbles: true,
                cancelable: true
              }));

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
            document.querySelector('#diocesanOverridesForm').reset();
            resetOtherLocalizationInputs();

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
    }).finally(() => {
        document.querySelector('#overlay').classList.add('hidden');
    });
}

/**
 * Handles the save button click event for the diocesan calendar form.
 *
 * This function collects data from the form related to the diocesan calendar
 * and constructs a payload for an API request. It checks the validity of form inputs
 * and, if valid, sends a request to save or update the diocesan calendar information.
 * The payload includes liturgical events, settings, and metadata for the calendar.
 *
 * The function also manages form validation, error handling, and updates to the global
 * metadata after a successful save. It adapts the request method and API key based on
 * whether the calendar is being created or updated.
 */
const saveDiocesanCalendar_btnClicked = () => {
    document.querySelector('#overlay').classList.remove('hidden');
    const diocese = document.querySelector('#diocesanCalendarDioceseName').value;
    const option = document.querySelector('#DiocesesList option[value="' + diocese + '"]');
    const diocese_id = option ? option.getAttribute('data-value') : null;
    const saveObj = { payload: CalendarData };
    API.category = 'diocese';
    if (API.method === 'PATCH') {
        API.key = diocese_id;
    }
    API.locale = document.querySelector('#currentLocalization').value;

    saveObj.payload.i18n[API.locale] = saveObj.payload.litcal.reduce((obj, item) => {
        const liturgicalEventCopy = { ...item.liturgical_event };
        if (liturgicalEventCopy.hasOwnProperty('name')) {
            obj[liturgicalEventCopy.event_key] = sanitizeInput(liturgicalEventCopy.name);
            delete item.liturgical_event.name;
        } else {
            obj[liturgicalEventCopy.event_key] = document.querySelector(`.litEventName[data-valuewas="${liturgicalEventCopy.event_key}"]`).value;
        }
        return obj;
    }, {});;

    // If the diocesan calendar overrides the national calendar settings for Epiphany, Ascension and Corpus Christi,
    // then we add these `settings` to the payload
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

    // Check if forms are valid
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
        }
    });

    // And if forms are valid, proceed to the API call
    if ( formsValid ) {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        });
        if (API.locale !== '') {
            headers.append('Accept-Language', API.locale);
        }

        const selectedOptions = document.querySelector('#diocesanCalendarLocales').selectedOptions;
        saveObj.payload.metadata = {
            diocese_id,
            diocese_name: document.querySelector('#diocesanCalendarDioceseName').value,
            nation: document.querySelector('#diocesanCalendarNationalDependency').value,
            locales: Array.from(selectedOptions).map(({ value }) => value),
            timezone: document.querySelector('#diocesanCalendarTimezone').value
        };

        const diocesanGroup = document.querySelector('#diocesanCalendarGroup').value;
        if (diocesanGroup !== '') {
            saveObj.payload.metadata.group = diocesanGroup;
        }

        // If we are dealing with a multi-locale diocesan calendar,
        // we need to build the i18n data for each locale
        if (saveObj.payload.metadata.locales.length > 1) {
            const eventKeys = Object.keys(saveObj.payload.i18n[API.locale]);

            // Pre-fetch all elements with the class `litEventName` and `data-valuewas` attribute
            const litEventNameElements = document.querySelectorAll(`.litEventName[data-valuewas]`);

            // Create a Map for fast lookups of litEventNameElements by data-valuewas
            const litEventNameMap = new Map();
            litEventNameElements.forEach(el => {
                litEventNameMap.set(el.dataset.valuewas, el);
            });

            eventKeys.forEach(eventKey => {
                // Find the specific litEventNameEl
                const litEventNameEl = litEventNameMap.get(eventKey);

                if (litEventNameEl) {
                    // Find all input elements with the data-locale attribute within the same parent
                    const localeInputs = litEventNameEl.parentElement.querySelectorAll('input[data-locale]');

                    localeInputs.forEach(el => {
                        const locale = el.dataset.locale;
                        const value = el.value;

                        // Ensure the locale object exists in saveObj.payload.i18n
                        if (false === saveObj.payload.i18n.hasOwnProperty(locale)) {
                            saveObj.payload.i18n[locale] = {};
                        }

                        // Assign the value to the corresponding eventKey
                        saveObj.payload.i18n[locale][eventKey] = value;
                    });
                }
            });
        }

        // For a patch request, we only need to provide the payload with `litcal` and `i18n` properties
        const body = JSON.stringify(saveObj.payload);

        const request = new Request(API.path, {
            method: API.method,
            headers,
            body
        });

        fetch(request)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(responseData => {
            console.log('Data returned from save action:', responseData);
            toastr["success"](responseData.success, "Success");

            document.querySelector('#removeExistingDiocesanDataBtn').disabled = false;

            // Create "Remove diocesan data" modal if it doesn't exist
            const removePrompt = document.getElementById('removeDiocesanCalendarPrompt');
            if (!removePrompt) {
                document.body.insertAdjacentHTML('beforeend', removeDiocesanCalendarModal(document.querySelector('#diocesanCalendarDioceseName').value, Messages));
            }

            // If we just created a calendar, we should now set the method to PATCH to allow updating the calendar
            // and update our global metadata to reflect the new calendar
            if (API.method === 'PUT') {
                const { diocese_id, diocese_name, ...rest } = responseData.data.metadata;
                const metadata = {
                    calendar_id: diocese_id,
                    diocese: diocese_name,
                    ...rest
                };
                LitCalMetadata.diocesan_calendars_keys.push(diocese_id);
                LitCalMetadata.diocesan_calendars.push(metadata);
                LitCalMetadata.national_calendars.filter(el => el.calendar_id === responseData.data.metadata.nation)[0].dioceses.push(diocese_id);
                console.log('updated LitCalMetadata:', LitCalMetadata);
                API.method = 'PATCH';
                API.key = diocese_id;
                API.locale = document.querySelector('#currentLocalization').value;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            toastr["error"](error.status + ' ' + error.message, "Error");
        }).finally(() => {
            document.querySelector('#overlay').classList.add('hidden');
        });
    } else {
        document.querySelector('#overlay').classList.add('hidden');
    }
}


/**
 * Handles clicks on the diocesan calendar definition card pagination links.
 *
 * Gets the instance of the Bootstrap carousel and navigates to the next or previous slide
 * depending on the link clicked.
 *
 * @param {Event} ev The event object for the click event.
 */
const diocesanCalendarDefinitionsCardLinksClicked = (ev) => {
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

/**
 * Handles changes to liturgical_event selections in modals.
 *
 * When a liturgical_event name is changed (whether selected from a list or entered manually),
 * the 'was-validated' class is removed from the form in the modal.
 * Then, if the input is set to required, the selected liturgical_event is validated
 * by looking for an option with the same value in the #existingLiturgicalEventsList select element.
 * If the liturgical_event name is not valid, an 'is-invalid' class is added to the select element.
 * If instead the input is not set to required, no validations will take place,
 * but simply a warning message will be displayed to ensure the user understands
 * that they are creating a new liturgical_event that does not already exist.
 * Finally, the buttons in the modal are enabled or disabled
 * based on whether the liturgical_event name is valid or not when the input is set to required.
 * If the input is not set to required, the submission button will always be enabled.
 * In a 'newLiturgicalEventActionPrompt' modal, the button id is 'newLiturgicalEventFromExistingButton' by default,
 * but will be changed to 'newLiturgicalEventExNovoButton' if the liturgical_event name is not found in the list.
 *
 * @param {Event} ev The event object for the change event.
 */
const existingLiturgicalEventNameChanged = (ev) => {
    const modal = ev.target.closest('.actionPromptModal');
    const form = modal.querySelector('form');
    form.classList.remove('was-validated');

    const option = modal.querySelector(`#existingLiturgicalEventsList option[value="${ev.target.value}"]`);
    // if no option corresponding to the selected liturgical_event name is found, disable the submission buttons
    const invalidState = !option && ev.target.required;
    const warningState = !option && !ev.target.required;
    ev.target.classList.toggle('is-invalid', invalidState);
    const warningEl = modal.querySelector('.text-warning');
    warningEl.classList.toggle('d-block', warningState);
    warningEl.classList.toggle('d-none', !warningState);
    console.log(`input is required to have an existing value from the list: ${ev.target.required}, selected value: ${ev.target.value}, option found: ${!!option}`);
    console.log(`invalidState: ${invalidState}, warningState: ${warningState}`);
    switch (modal.id) {
        case 'makePatronActionPrompt':
            document.querySelector('#designatePatronButton').disabled = (ev.target.required ? invalidState : false);
            break;
        case 'setPropertyActionPrompt':
            document.querySelector('#setPropertyButton').disabled = invalidState;
            break;
        case 'moveLiturgicalEventActionPrompt':
            document.querySelector('#moveLiturgicalEventButton').disabled = invalidState;
            break;
        case 'newLiturgicalEventActionPrompt': {
            const actionPromptButton = modal.querySelector('.actionPromptButton');
            if (option) {
                actionPromptButton.id = 'newLiturgicalEventFromExistingButton';
                actionPromptButton.disabled = false;
            } else {
                actionPromptButton.id = 'newLiturgicalEventExNovoButton';
                actionPromptButton.disabled = invalidState;
            }
            break;
        }
    }
}

/**
 * Handles clicks on the "Add language edition Roman Missal" button in the "Add Missal" modal.
 *
 * Gets the value of the #languageEditionRomanMissalName input, sanitizes it, and adds it to the
 * #publishedRomanMissalList as a new list item. Then, it hides the modal.
 *
 * @param {Event} ev The event object for the click event.
 */
const addLanguageEditionRomanMissalClicked = (ev) => {
    const languageEditionRomanMissal = sanitizeInput( document.querySelector('#languageEditionRomanMissalName').value );
    document.querySelector('#publishedRomanMissalList').insertAdjacentHTML('beforeend', `<li class="list-group-item">${languageEditionRomanMissal}</li>`);
    const modal = ev.target.closest('.modal.show');
    bootstrap.Modal.getInstance(modal).hide();
}

document.addEventListener('change', (ev) => {
    if (ev.target.classList.contains('litEvent')) {
        litEventChanged(ev);
    }
    if (ev.target.id === 'diocesanCalendarNationalDependency') {
        diocesanCalendarNationalDependencyChanged(ev);
    }
    if (ev.target.id === 'diocesanCalendarDioceseName') {
        diocesanCalendarDioceseNameChanged(ev);
    }
    if (ev.target.classList.contains('existingLiturgicalEventName')) {
        existingLiturgicalEventNameChanged(ev);
    }
    if (ev.target.id === 'languageEditionRomanMissalName') {
        document.querySelector('#addLanguageEditionRomanMissal').disabled = false;
    }
    if (ev.target.id === 'currentLocalization') {
        if (API.category === 'diocese') {
            if (API.method === 'PATCH') {
                loadDiocesanCalendarData();
            }
            if (API.method === 'PUT') {
                const currentLocalization = document.querySelector('#currentLocalization').value;
                const otherLocalizations = Array.from(document.querySelector('.calendarLocales').selectedOptions)
                                            .filter(({ value }) => value !== currentLocalization)
                                            .map(({ value }) => value);
                refreshOtherLocalizationInputs(otherLocalizations);
            }
        }
        else if (API.method === 'PATCH') {
            if (API.category === 'widerregion') {
                document.querySelector('#widerRegionCalendarName').value = `${API.key} - ${ev.target.value}`;
            }
            API.locale = ev.target.value;
            console.log(`currentLocalization changed to ${ev.target.value}, now fetching events and calendar data...`);
            fetchEventsAndCalendarData();
        }
    }
    if (ev.target.classList.contains('regionalNationalCalendarName')) {
        regionalNationalCalendarNameChanged(ev);
    }
    if (ev.target.classList.contains('calendarLocales')) {
        calendarLocalesChanged(ev);
    }
});

document.addEventListener('click', (ev) => {
    /**
     * Diocesan calendar interactions
     */
    if (ev.target.closest('#diocesanCalendarDefinitionCardLinks a.page-link')) {
        diocesanCalendarDefinitionsCardLinksClicked(ev);
    }
    if (ev.target.classList.contains('onTheFlyEventRow')) {
        onTheFlyEventRowClicked(ev);
    }
    if (ev.target.closest('#saveDiocesanCalendar_btn')) {
        saveDiocesanCalendar_btnClicked();
    }
    if (ev.target.closest('#removeExistingDiocesanDataBtn')) {
        // We don't want any forms to submit, so we prevent the default action
        ev.preventDefault();
        // Since this opens a bootstrap modal, we don't have to do anything here
    }
    if (ev.target.closest('#deleteDiocesanCalendarConfirm')) {
        deleteDiocesanCalendarConfirmClicked();
    }

    /**
     * Wider Region and / or national calendar interactions
     */
    if (ev.target.closest('#addLanguageEditionRomanMissal')) {
        addLanguageEditionRomanMissalClicked(ev);
    }
    if (ev.target.closest('.actionPromptButton')) {
        actionPromptButtonClicked(ev);
    }
    if (ev.target.classList.contains('datetype-toggle-btn')) {
        datetypeToggleBtnClicked(ev);
    }
    if (ev.target.closest('.serializeRegionalNationalData')) {
        serializeRegionalNationalDataClicked(ev);
    }
    if (ev.target.closest('#removeExistingCalendarDataBtn')) {
        ev.preventDefault();
    }
    if (ev.target.closest('#deleteCalendarConfirm')) {
        deleteCalendarConfirmClicked(ev);
    }
});

document.addEventListener('hide.bs.modal', () => {
    document.activeElement.blur();
});

document.addEventListener('hidden.bs.modal', (ev) => {
    if (ev.target.classList.contains('actionPromptModal')) {
        console.log(`attempting to focus on input element with id: #onTheFly${FormControls.uniqid}Name`);
        const litEventNameElements = document.querySelectorAll(`.litEventName`);
        if (litEventNameElements.length > 0) {
            litEventNameElements[litEventNameElements.length-1].focus();
        }
    }
    if (ev.target.id === 'removeCalendarDataPrompt') {
        document.querySelector('.regionalNationalCalendarName').focus();
    }
    if (ev.target.id === 'addPublishedRomanMissalPrompt') {
        document.querySelector('#addPublishedRomanMissal').focus();
    }
});
