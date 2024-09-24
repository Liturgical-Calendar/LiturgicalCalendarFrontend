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
    sanitizeInput
} from './templates.js';


/**
 * @function diocesanOvveridesDefined
 * @description Returns true if at least one of the overrides for epiphany, ascension, or corpus christi have been set, false otherwise.
 * @returns {boolean}
 */
const diocesanOvveridesDefined = () => {
    return ( $('#diocesanCalendarOverrideEpiphany').val() !== "" || $('#diocesanCalendarOverrideAscension').val() !== "" || $('#diocesanCalendarOverrideCorpusChristi').val() !== "" );
}

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

// the messages global is set in extending.php
const { LOCALE, LOCALE_WITH_REGION } = messages;
const jsLocale = LOCALE.replace('_', '-');
FormControls.jsLocale = jsLocale;
FormControls.weekdayFormatter = new Intl.DateTimeFormat(jsLocale, { weekday: "long" });

/**
 * Proxy sanitizer for the proxied API object. Sanitizes the values assigned to properties of the proxied API object.
 * @type {Proxy}
 * @prop {function} get - the getter for the proxy
 * @prop {function} set - the setter for the proxy
 * @prop {string} prop - the name of the property being accessed or modified
 * @prop {*} value - the value to be assigned to the property
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
                    if (false === ['Americas', 'Europe', 'Africa', 'Oceania', 'Asia'].includes(value)) {
                        console.warn(`property 'key' of this object must be one of the values 'Americas', 'Europe', 'Africa', 'Oceania', or 'Asia'`);
                        return;
                    }
                }
                else if (target['category'] === 'nation') {
                    value = value.toUpperCase();
                    if (value === 'UNITED STATES') {
                        value = 'USA';
                    }
                    /*
                    if (false === isValidNation(value)) {
                        console.warn(`property 'key' of this object must be a valid nation`);
                        return;
                    }
                    */
                }
                else if (target['category'] === 'diocese') {
                    value = value.toUpperCase();
                    /*
                    if (false === isValidDiocese(value)) {
                        console.warn(`property 'key' of this object must be a valid diocese`);
                        return;
                    }
                    */
                }
                if (target.hasOwnProperty('category') && target['category'] !== '') {
                    target['path'] = `${RegionalDataURL}/${target['category']}/${value}`;
                }
                break;
            case 'locale':
                if (false === LOCALE.includes(value) && false === LOCALE_WITH_REGION.includes(value)) {
                    console.warn(`property 'locale' of this object must be one of the values ${LOCALE.join(', ')}, ${LOCALE_WITH_REGION.join(', ')}`);
                    return;
                }
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
 */
const API = new Proxy({
    category: '',
    key: '',
    path: '',
    locale: ''
}, sanitizeProxiedAPI);


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

const DiocesesList = {};
let CalendarData = { litcal: {} };
let CalendarsIndex = null;
let MissalsIndex = null;

Promise.all([
    fetch('./assets/data/ItalyDioceses.json', {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    }),
    fetch('./assets/data/USDiocesesByState.json', {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    }),
    fetch('./assets/data/NetherlandsDioceses.json', {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    }),
    fetch(MetaDataURL, {
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
    DiocesesList.ITALY = data[0];
    DiocesesList.USA = [];
    let USDiocesesByState = data[1];
    let c = 0;
    for (const [state, arr] of Object.entries(USDiocesesByState)) {
        arr.forEach(diocese => DiocesesList.USA[c++] = diocese + " (" + state + ")");
    }
    DiocesesList.NETHERLANDS = data[2];

    if(data[3].hasOwnProperty('litcal_metadata')) {
        console.log('retrieved /calendars metadata:');
        console.log(data[3]);
        CalendarsIndex = data[3].litcal_metadata;
        FormControls.index = data[3].litcal_metadata;
        toastr["success"]('Successfully retrieved data from /calendars path', "Success");
    }

    if (data[4].hasOwnProperty('litcal_missals')) {
        console.log('retrieved /missals metadata:');
        console.log(data[4]);
        MissalsIndex = data[4].litcal_missals;
        FormControls.missals = data[4].litcal_missals;
        const publishedRomanMissalsStr = MissalsIndex.map(({missal_id,name}) => !missal_id.startsWith('EDITIO_TYPICA_') ? `<option class="list-group-item" value="${missal_id}">${name}</option>` : null).join('')
        $('#languageEditionRomanMissalList').append(publishedRomanMissalsStr);
        toastr["success"]('Successfully retrieved data from /missals path', "Success");
    }
}).catch(error => {
    console.error(error);
    toastr["error"](error, "Error");
});

const loadDiocesanCalendarData = () => {
    API.category = 'diocese';
    let diocese = $('#diocesanCalendarDioceseName').val();
    API.key = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value');
    jQuery.ajax({
        url: API.path,
        method: 'GET',
        dataType: 'json',
        statusCode: {
            404: (xhr, textStatus, errorThrown) => {
                toastr["warning"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />The Diocesan Calendar for ' + diocese + ' does not exist yet.', "Warning");
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown + 'The Diocesan Calendar for ' + diocese + ' does not exist yet.');
            }
        },
        success: data => {
            console.log('retrieved diocesan data:');
            console.log(data);
            toastr["success"]("Diocesan Calendar was retrieved successfully", "Success");
            CalendarData = data;
            if( data.hasOwnProperty('overrides') ) {
                if( data.overrides.hasOwnProperty('epiphany') ) {
                    $('#diocesanCalendarOverrideEpiphany').val( data.overrides.epiphany );
                }
                if( data.overrides.hasOwnProperty('ascension') ) {
                    $('#diocesanCalendarOverrideAscension').val( data.overrides.ascension );
                }
                if( data.overrides.hasOwnProperty('corpus_christi') ) {
                    $('#diocesanCalendarOverrideCorpusChristi').val( data.overrides.corpus_christi );
                }
            }
            for (const [key, obj] of Object.entries(data.litcal)) {
                const { festivity, metadata } = obj;
                let $form;
                let $row;
                let numLastRow;
                let numMissingRows;
                if(metadata.hasOwnProperty('strtotime')) {
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
                            FormControls.title = messages['Other Solemnity'];
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
                            FormControls.title = messages['Other Feast'];
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
                            FormControls.title = messages['Other Memorial'];
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
                            FormControls.title = messages['Other Optional Memorial'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(3).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemOptionalMemorials form .row').eq(metadata.form_rownum);
                        break;
                }
                $row.find('.litEventName').val(festivity.name).attr('data-valuewas', key);
                //if(metadata.form_rownum > 2) {
                //    $row.find('.litEventStrtotimeSwitch').bootstrapToggle();
                //}
                if( metadata.hasOwnProperty('strtotime') ) {
                    $row.find('.litEventStrtotimeSwitch').prop('checked', true);
                    if( $row.find('.litEventStrtotime').length === 0 ) {
                        switcheroo( $row, metadata );
                    }
                    $row.find('.litEventStrtotime').val(metadata.strtotime);
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
            setFocusFirstTabWithData();
        },
        error: (xhr, textStatus, errorThrown) => {
            if( xhr.status !== 404 ) { //we have already handled 404 Not Found above
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
            }
        }
    });
}

const switcheroo = ( $row, Metadata ) => {
    $row.find('.litEventDay').closest('.form-group').remove();
    let $litEventMonth = $row.find('.litEventMonth');
    let $litEventMonthFormGrp = $litEventMonth.closest('.form-group');
    console.log($litEventMonth.attr('id'));
    let strtotimeId = $litEventMonth.attr('id').replace('Month','Strtotime');
    console.log(strtotimeId);
    $litEventMonthFormGrp.removeClass('col-sm-2').addClass('col-sm-3');
    $litEventMonth.remove();
    $litEventMonthFormGrp.find('.month-label').text('Explicatory date').attr('for',strtotimeId);
    $litEventMonthFormGrp.append(`<input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="${strtotimeId}" value="${Metadata.strtotime}" />`);
}

const unswitcheroo = ( $row, Festivity ) => {
    let $litEventStrtotime = $row.find('.litEventStrtotime');
    let $strToTimeFormGroup = $litEventStrtotime.closest('.form-group');
    $strToTimeFormGroup.removeClass('col-sm-3').addClass('col-sm-2');
    let dayId = $litEventStrtotime.attr('id').replace('Strtotime', 'Day');
    let monthId = $litEventStrtotime.attr('id').replace('Strtotime', 'Month');
    $strToTimeFormGroup.before(`<div class="form-group col-sm-1">
    <label for="${dayId}">${messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" value="${Festivity.day}" />
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
    $strToTimeFormGroup.find('.month-label').text(messages[ 'Month' ]).attr('for',monthId);
}


$(document).on('click', '.strtotime-toggle-btn', ev => {
    const uniqid = parseInt( $(ev.currentTarget).attr('data-row-uniqid') );
    if( $(ev.currentTarget).attr('aria-pressed') === 'true' ) {
        $(ev.currentTarget).find('i').removeClass('fa-comment-slash').addClass('fa-comment');
        $(`#onTheFly${uniqid}Month`).closest('.form-group').remove();
        let $dayFormGroup = $(`#onTheFly${uniqid}Day`).closest('.form-group');
        $dayFormGroup.empty().removeClass('col-sm-1').addClass('col-sm-2').append(`<label for="onTheFly${uniqid}Strtotime">Explicatory date</label><input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="onTheFly${uniqid}Strtotime" />`);
    } else {
        $(ev.currentTarget).find('i').removeClass('fa-comment').addClass('fa-comment-slash');
        let $strToTimeFormGroup = $(`#onTheFly${uniqid}Strtotime`).closest('.form-group');
        $strToTimeFormGroup.empty().removeClass('col-sm-2').addClass('col-sm-1').append(`<label for="onTheFly${uniqid}Day">Day</label><input type="number" min="1" max="31" value="false" class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`);
        let formRow = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${messages[ "Month" ]}</label>
        <select class="form-select litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
        let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
        for (let i = 0; i < 12; i++) {
            let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
            formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
        }
        formRow += `</select>
        </div>`;
        $strToTimeFormGroup.after(formRow);
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
            if (CalendarData.litcal.hasOwnProperty(oldEventKey)) {
                delete CalendarData.litcal[oldEventKey];
            }
            $(ev.currentTarget).attr('data-valuewas', '');
        } else {
            let eventKey = $(ev.currentTarget).val().replace(/[^a-zA-Z]/gi, '');
            console.log('new LitEvent name identifier is ' + eventKey);
            console.log('festivity name is ' + $(ev.currentTarget).val());
            if ($(ev.currentTarget).attr('data-valuewas') == '' && CalendarData.litcal.hasOwnProperty(eventKey) === false) {
                console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                CalendarData.litcal[eventKey] = { festivity: {}, metadata: {} };
                CalendarData.litcal[eventKey].festivity = new LitEvent(
                    $(ev.currentTarget).val(), //name
                    $row.find('.litEventColor').val(), //color
                    null,
                    $row.find('.litEventCommon').val(), //common
                    parseInt($row.find('.litEventDay').val()), //day
                    parseInt($row.find('.litEventMonth').val()), //month
                );
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                CalendarData.litcal[eventKey].metadata.since_year = parseInt($row.find('.litEventSinceYear').val());
                if( $row.find('.litEventUntilYear').val() !== '' ) {
                    CalendarData.litcal[eventKey].metadata.until_year = parseInt($row.find('.litEventUntilYear').val());
                }
                let formRowIndex = $card.find('.row').index($row);
                CalendarData.litcal[eventKey].metadata.form_rownum = formRowIndex;
                console.log('form row index is ' + formRowIndex);
                $(ev.currentTarget).attr('data-valuewas', eventKey);
                $(ev.currentTarget).removeClass('is-invalid');
                console.log( CalendarData.litcal[eventKey] );
            } else if ($(ev.currentTarget).attr('data-valuewas') != '') {
                let oldEventKey = $(ev.currentTarget).attr('data-valuewas');
                console.log('the preceding value here was ' + oldEventKey);
                if (CalendarData.litcal.hasOwnProperty(oldEventKey)) {
                    if (oldEventKey !== eventKey) {
                        if( /_2$/.test(eventKey) ) {
                            console.log('oh geez, we are dealing with a second festivity that has the same name as a first festivity, because it continues where the previous untilYear left off...');
                            eventKey = oldEventKey;
                            console.log('but wait, why would you be changing the name of the second festivity? it will no longer match the first festivity!');
                            console.log('this is becoming a big mess, arghhhh... results can start to be unpredictable');
                            CalendarData.litcal[eventKey].festivity.name = $(ev.currentTarget).val();
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        } else {
                            console.log('I see you are trying to change the name of a festivity that was already defined. This will effectively change the relative key also, so here is what we are going to do:');
                            console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
                            Object.defineProperty(CalendarData.litcal, eventKey,
                                Object.getOwnPropertyDescriptor(CalendarData.litcal, oldEventKey));
                            CalendarData.litcal[eventKey].festivity.name = $(ev.currentTarget).val();
                            delete CalendarData.litcal[oldEventKey];
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        }
                    }
                }
            } else if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                if( false === CalendarData.litcal[eventKey].metadata.hasOwnProperty('until_year') ) {
                    console.log('exact same festivity name was already defined elsewhere! key ' + eventKey + ' already exists! and the untilYear property was not defined!');
                    $(ev.currentTarget).val('');
                    $(ev.currentTarget).addClass('is-invalid');
                } else {
                    let confrm = confirm('The same festivity name was already defined elsewhere. However an untilYear property was also defined, so perhaps you are wanting to define again for the years following. If this is the case, press OK, otherwise Cancel');
                    if(confrm) {
                        //retrieve untilYear from the previous festivity with the same name
                        let untilYear = CalendarData.litcal[eventKey].metadata.until_year;
                        //set the sinceYear field on this row to the previous untilYear plus one
                        $row.find('.litEventSinceYear').val(untilYear+1);
                        //update our eventKey to be distinct from the previous festivity
                        eventKey = eventKey+'_2';
                        $(ev.currentTarget).attr('data-valuewas', eventKey);
                        CalendarData.litcal[eventKey] = { festivity: {}, metadata: {} };
                        CalendarData.litcal[eventKey].festivity = new LitEvent(
                            $(ev.currentTarget).val(), //name
                            $row.find('.litEventColor').val(), //color
                            null,
                            $row.find('.litEventCommon').val(), //common
                            parseInt($row.find('.litEventDay').val()), //day
                            parseInt($row.find('.litEventMonth').val()), //month
                        );
                        CalendarData.litcal[eventKey].metadata.since_year = untilYear + 1;
                        let formRowIndex = $card.find('.row').index($row);
                        CalendarData.litcal[eventKey].metadata.form_rownum = formRowIndex;
                        console.log('form row index is ' + formRowIndex);
                    }
                }
            }
            switch ($(ev.currentTarget).closest('.carousel-item').attr('id')) {
                case 'carouselItemSolemnities':
                    CalendarData.litcal[eventKey].festivity.grade = 6;
                    if ($(ev.currentTarget).val().match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'red');
                        CalendarData.litcal[eventKey].festivity.color = [ 'red' ];
                    } else {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                        CalendarData.litcal[eventKey].festivity.color = [ 'white' ];
                    }
                    break;
                case 'carouselItemFeasts':
                    CalendarData.litcal[eventKey].festivity.grade = 4;
                    break;
                case 'carouselItemMemorials':
                    CalendarData.litcal[eventKey].festivity.grade = 3;
                    break;
                case 'carouselItemOptionalMemorials':
                    CalendarData.litcal[eventKey].festivity.grade = 2;
                    break;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventDay')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                CalendarData.litcal[eventKey].festivity.day = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventMonth')) {
        let selcdMonth = parseInt($(ev.currentTarget).val());
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                CalendarData.litcal[eventKey].festivity.month = selcdMonth;
            }
        }
        $row.find('.litEventDay').attr('max', selcdMonth === Month.FEBRUARY ? "28" : (MonthsOfThirty.includes(selcdMonth) ? "30" : "31"));
        if (parseInt($row.find('.litEventDay').val()) > parseInt($row.find('.litEventDay').attr('max'))) {
            $row.find('.litEventDay').val($row.find('.litEventDay').attr('max'));
        }
    } else if ($(ev.currentTarget).hasClass('litEventCommon')) {
        if ($row.find('.litEventName').val() !== "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                CalendarData.litcal[eventKey].festivity.common = $(ev.currentTarget).val();
                let eventColors = [];
                if (CalendarData.litcal[eventKey].festivity.common.some( m => /Martyrs/.test(m) )) {
                    eventColors.push('red');
                }
                if (CalendarData.litcal[eventKey].festivity.common.some( m => /(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/.test(m) ) ) {
                    eventColors.push('white');
                }
                $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', eventColors);
                CalendarData.litcal[eventKey].festivity.color = eventColors;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventColor')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                CalendarData.litcal[eventKey].festivity.color = $(ev.currentTarget).val();
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventSinceYear')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                CalendarData.litcal[eventKey].metadata.since_year = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventUntilYear')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                if($(ev.currentTarget).val() !== '') {
                    CalendarData.litcal[eventKey].metadata.until_year = parseInt($(ev.currentTarget).val());
                } else {
                    delete CalendarData.litcal[eventKey].metadata.until_year;
                }
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventStrtotimeSwitch')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                if(false === $(ev.currentTarget).prop('checked')) {
                    delete CalendarData.litcal[eventKey].metadata.strtotime;
                    CalendarData.litcal[eventKey].festivity.day = 1;
                    CalendarData.litcal[eventKey].festivity.month = 1;
                    let $strToTimeFormGroup = $(ev.currentTarget).closest('.form-group');
                    $strToTimeFormGroup.removeClass('col-sm-3').addClass('col-sm-2');
                    let $litEventStrtotime = $strToTimeFormGroup.find('.litEventStrtotime');
                    let dayId = $litEventStrtotime.attr('id').replace('Strtotime', 'Day');
                    let monthId = $litEventStrtotime.attr('id').replace('Strtotime', 'Month');
                    $strToTimeFormGroup.before(`<div class="form-group col-sm-1">
                    <label for="${dayId}">${messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" />
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
                    $strToTimeFormGroup.find('.month-label').text(messages[ 'Month' ]).attr('for',monthId);
                } else {
                    delete CalendarData.litcal[eventKey].festivity.day;
                    delete CalendarData.litcal[eventKey].festivity.month;
                    CalendarData.litcal[eventKey].metadata.strtotime = '';
                    $row.find('.litEventDay').closest('.form-group').remove();
                    let $litEventMonthFormGrp = $(ev.currentTarget).closest('.form-group');
                    let $litEventMonth = $litEventMonthFormGrp.find('.litEventMonth');
                    let strtotimeId = $litEventMonth.attr('id').replace('Month','Strtotime');
                    $litEventMonthFormGrp.removeClass('col-sm-2').addClass('col-sm-3');
                    $litEventMonth.remove();
                    $litEventMonthFormGrp.find('.month-label').text('Explicatory date').attr('for',strtotimeId);
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
            if (CalendarData.litcal.hasOwnProperty(eventKey)) {
                CalendarData.litcal[eventKey].metadata.strtotime = $(ev.currentTarget).val();
            }
        }
    }
});

$(document).on('click', '#saveDiocesanCalendar_btn', () => {
    let nation = $('#diocesanCalendarNationalDependency').val();
    let diocese = $('#diocesanCalendarDioceseName').val();
    //console.log('save button was clicked for NATION = ' + $nation + ', DIOCESE = ' + $diocese);
    let saveObj = { caldata: CalendarData, diocese: diocese, nation: nation, category: 'diocese' };
    if($('#diocesanCalendarGroup').val() != ''){
        saveObj.group = $('#diocesanCalendarGroup').val();
    }
    if( diocesanOvveridesDefined() ) {
        //console.log( 'This diocesan calendar has defined some options that will override the national calendar.' );
        saveObj.caldata.overrides = {};
        if( $('#diocesanCalendarOverrideEpiphany').val() !== "" ) {
            saveObj.caldata.overrides.epiphany = $('#diocesanCalendarOverrideEpiphany').val();
            //console.log( 'Epiphany in this diocese will override Epiphany in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideAscension').val() !== "" ) {
            saveObj.caldata.overrides.ascension = $('#diocesanCalendarOverrideAscension').val();
            //console.log( 'Ascension in this diocese will override Ascension in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideCorpusChristi').val() !== "" ) {
            saveObj.caldata.overrides.corpus_christi = $('#diocesanCalendarOverrideCorpusChristi').val();
            //console.log( 'Corpus Christi in this diocese will override Corpus Christi in the national calendar.' );
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
        $.ajax({
            url: RegionalDataURL,
            method: 'PUT',
            dataType: 'json',
            contentType: 'application/json',
            crossDomain: false,
            data: JSON.stringify( saveObj ),
            success: (data, textStatus, xhr) => {
                console.log(xhr.status + ' ' + textStatus + ': data returned from save action: ');
                console.log(data);
                toastr["success"]("Diocesan Calendar was created or updated successfully", "Success");
            },
            error: (xhr, textStatus, errorThrown) => {
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown);
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
            }
        });
    } else {
        //alert('Nation / Diocese cannot be empty');
    }
});


$(document).on('click', '#removeExistingDiocesanDataBtn', evt => {
    // We don't want any forms to submit, so we prevent the default action
    evt.preventDefault();
});

$(document).on('click', '.onTheFlyEventRow', ev => {
    let $row;
    switch (ev.currentTarget.id) {
        case "addSolemnity":
            FormControls.title = messages['Other Solemnity'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').first().find('form').append($row);
            break;
        case "addFeast":
            FormControls.title = messages['Other Feast'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').eq(1).find('form').append($row);
            break;
        case "addMemorial":
            FormControls.title = messages['Other Memorial'];
            $row = $(FormControls.CreateFestivityRow());
            $('.carousel-item').eq(2).find('form').append($row);
            break;
        case "addOptionalMemorial":
            FormControls.title = messages['Other Optional Memorial'];
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

$(document).on('click', '.actionPromptButton', ev => {
    const currentUniqid = FormControls.uniqid;
    const $modal = $(ev.currentTarget).closest('.actionPromptModal');
    const $modalForm = $modal.find('form');
    const existingFestivityTag = sanitizeInput( $modalForm.find('.existingFestivityName').val() );
    let propertyToChange;
    let rowStr;
    let rowEls;
    let $row;
    //let buttonId = ev.currentTarget.id;
    //console.log(buttonId + ' button was clicked');
    FormControls.settings.decreeURLField = true;
    FormControls.settings.decreeLangMapField = $('.regionalNationalCalendarName').attr('id') === 'widerRegionCalendarName';
    setFormSettings( ev.currentTarget.id );
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
            const { missal } = FestivityCollection[existingFestivityTag];
            $row.find(`#onTheFly${currentUniqid}Missal`).val(missal); //.prop('disabled', true);
        }
    } else {
        rowStr = FormControls.CreatePatronRow();
        rowEls = $.parseHTML( rowStr );
        $row = $( rowEls );
    }
    $('.regionalNationalDataForm').append($row);
    $modal.modal('hide');
    $row.find('.form-group').closest('.row').data('action', FormControls.action.description).attr('data-action', FormControls.action.description);
    if( FormControls.action.description === RowAction.SetProperty ) {
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
        const litevent = FestivityCollection[existingFestivityTag];

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

$(document).on('change', '.regionalNationalCalendarName', ev => {
    API.category = ev.currentTarget.dataset.category;
    // our proxy will take care of splitting locale from wider region, when we are setting a wider region key
    API.key = ev.currentTarget.value;
    const headers = {};
    if ( API.category === 'widerregion' ) {
        headers['Accept-Language'] = API.locale;
    }
    console.log(`API.path is ${API.path} (category is ${API.category} and key is ${API.key}). Now checking if a calendar already exists...`);

    fetch(API.path, { headers }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return Promise.reject(response);
        }
    }).then(data => {
        console.log( `successfully retrieved the data file for the ${API.category} ${API.key}` );
        console.log(data);
        switch(API.category) {
            case 'widerregion':
                $('#widerRegionIsMultilingual').prop('checked', data.metadata.multilingual);
                FormControls.settings.decreeURLField = true;
                FormControls.settings.decreeLangMapField = true;
                $('#widerRegionLanguages').multiselect('deselectAll', false).multiselect('select', data.metadata.languages);
                break;
            case 'nation':
                FormControls.settings.decreeURLField = true;
                FormControls.settings.decreeLangMapField = false;
                const { settings, metadata } = data;
                $('#nationalCalendarSettingEpiphany').val( settings.epiphany );
                $('#nationalCalendarSettingAscension').val( settings.ascension );
                $('#nationalCalendarSettingCorpusChristi').val( settings.corpus_christi );
                $('#nationalCalendarSettingLocale').val( settings.locale );
                $('#publishedRomanMissalList').empty().append( '<li class="list-group-item">' + metadata.missals.join('</li><li class="list-group-item">') + '</li>' );
                $('#associatedWiderRegion').val( metadata.wider_region.name );
                $('#nationalCalendarSettingHighPriest').prop('checked', settings.eternal_high_priest );
        }
        $('.regionalNationalDataForm').empty();
        data.litcal.forEach((el) => {
            let currentUniqid = FormControls.uniqid;
            let existingFestivityTag = el.festivity.event_key ?? null;
            if( el.metadata.action === RowAction.CreateNew && FestivityCollection.hasOwnProperty( existingFestivityTag ) ) {
                el.metadata.action = RowAction.CreateNewFromExisting;
            }
            setFormSettings( el.metadata.action );
            if( el.metadata.action === RowAction.SetProperty ) {
                setFormSettingsForProperty( el.metadata.property );
            }

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
                $formrow.find('.litEventReadings').prop('disabled',false);
            }

            if( FormControls.settings.missalField && existingFestivityTag !== null ) {
                const { missal } = FestivityCollection[existingFestivityTag];
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
                console.log( FestivityCollection[existingFestivityTag] );
                el.festivity.color = FestivityCollection[existingFestivityTag].color;
            }
            let colorVal = Array.isArray(el.festivity.color) ? el.festivity.color : el.festivity.color.split(',');
            $row.find('.litEventColor').multiselect('select', colorVal);
            if(FormControls.settings.colorField === false) {
                $row.find('.litEventColor').multiselect('disable');
            }

            if( el.festivity.hasOwnProperty( 'common' ) ) {
                let common = Array.isArray( el.festivity.common ) ? el.festivity.common : el.festivity.common.split(',');
                if(FormControls.settings.commonFieldShow) {
                    setCommonMultiselect( $row, common );
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
        if (404 === error.status) {
            error.json().then(json => {
                const message = `${error.status} ${json.status} ${json.response}: ${json.description}<br />The Data File for the ${API.category} ${API.key} does not exist yet. Not that it's a big deal, just go ahead and create it now!`;
                toastr["warning"](message, "Warning");
                console.warn(message);
            });
            switch(API.category) {
                case 'widerregion':
                    $('#widerRegionIsMultilingual').prop('checked', false);
                    $('#widerRegionLanguages').multiselect('deselectAll', false);
                    break;
                case 'nation':
                    $('form#nationalCalendarSettingsForm')[0].reset();
                    $('#publishedRomanMissalList').empty();
                    break;
            }
            $('form.regionalNationalDataForm').empty();
            return;
        } else {
            error.json().then(json => {
                console.error(json);
                //We're taking for granted that the API is sending back a JSON object with status, response and description
                toastr["error"](json.status + ' ' + json.response + ': ' + json.description, "Error");
            });
        }
    });
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
            $('body').append(removeDiocesanCalendarModal(currentVal, messages));
            if(diocesan_calendar.hasOwnProperty('group')){
                $('#diocesanCalendarGroup').val(diocesan_calendar.group);
            }
            loadDiocesanCalendarData();
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

$(document).on('click', '#deleteDiocesanCalendarConfirm', () => {
    API.category = 'diocese';
    $('#removeDiocesanCalendarPrompt').modal('toggle');
    const diocese = $('#diocesanCalendarDioceseName').val();
    API.key = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value');
    let nation = $('#diocesanCalendarNationalDependency').val();
    const payload = { diocese: diocese, nation: nation };
    fetch(API.path, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify( payload )
    }).then(response => {
        if (response.ok) {
            //return response.json();
            CalendarsIndex.diocesan_calendars = CalendarsIndex.diocesan_calendars.filter(el => el.calendar_id !== API.key);
            CalendarsIndex.diocesan_calendars_keys = CalendarsIndex.diocesan_calendars_keys.filter(el => el !== API.key);
            $('#retrieveExistingDiocesanData').prop('disabled', true);
            $('#removeExistingDiocesanDataBtn').prop('disabled', true);
            $('#removeDiocesanCalendarPrompt').remove();
            $('#diocesanCalendarDioceseName').val('');
            $('#diocesanCalendarNationalDependency').val('');
            //console.log('data returned from delete action: ');
            //console.log(data);
            toastr["success"](`Diocesan Calendar '${API.key}' was deleted successfully`, "Success");
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

/**
 * TODO: define payload classes for the various possible scenarios
 *
 * The following event handle is used to serialize the data from the wider region or national
 * calendar forms for submission to the API. The event handler receives the jQuery event object as
 * an argument, and prepares a JSON object as the payload with the following structure:
 *
 * For a national calendar:
 *  {
 *      "litcal": litcalevent[],
 *      "settings": {
 *          "epiphany": string,
 *          "ascension": string,
 *          "corpus_christi": string
 *          "eternal_high_priest": boolean,
 *          "locale": string
 *      },
 *      "metadata": {
 *          "region": string,
 *          "wider_region": {
 *              "name": string,
 *              "json_file": string,
 *              "i18n_file": string
 *          },
 *          "missals": string[],
 *      }
 *  }
 *
 * For a wider region:
 *  {
 *      "litcal": litcalevent[],
 *      "national_calendars": {},
 *      "metadata": {
 *          "multilingual": boolean,
 *          "languages": string[],
 *          "wider_region": string
 *      }
 *  }[]
 *
 * The litcal object contains the liturgical events defined for the calendar.
 * litcal is an array of objects, each containing the information about a
 * single event in the calendar.
 * The object structure of the entries for the litcal array depend on the action being taken:
 *
 * - makePatron (will generally take a liturgical event that is already defined in the General Roman Calendar and allow to override the name to indicate patronage):
 *      {
 *          "festivity": {
 *              "event_key": string,
 *              "name": string,
 *              "color": string,
 *              "grade": number ,
 *              "day": number,
 *              "month": number
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
 *              "name": string,
 *              "grade": number,
 *              "day": number,
 *              "month": number
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
 *              "color": string,
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
 *              "color": string,
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
 *   N.B. For any action, if sinceYear, untilYear, decreeURL, or decreeLangs are defined, they will be added to the metadata object:
 *          - metadata.since_year,
 *          - metadata.until_year,
 *          - metadata.url,
 *          - metadata.url_lang_map
*/
$(document).on('click', '.serializeRegionalNationalData', ev => {
    API.category = $(ev.currentTarget).data('category');
    const payload = {};
    switch(API.category) {
        case 'nation':
            API.key = $('#nationalCalendarName').val();
            API.locale = $('#nationalCalendarSettingLocale').val();
            const regionNamesLocalized = new Intl.DisplayNames(['en'], { type: 'region' });
            const widerRegion = $('#associatedWiderRegion').val();
            payload = {
                "litcal": [],
                "settings": {
                    "epiphany": $('#nationalCalendarSettingEpiphany').val(),
                    "ascension": $('#nationalCalendarSettingAscension').val(),
                    "corpus_christi": $('#nationalCalendarSettingCorpusChristi').val(),
                    "eternal_high_priest": $('#nationalCalendarSettingHighPriest').is(':checked'),
                    "locale": API.locale
                },
                "metadata": {
                    "region": regionNamesLocalized.of( messages.countryISOCodes[$('#nationalCalendarName').val().toUpperCase()] ).toUpperCase().replace(/[.]/g,'_'),
                    "wider_region": {
                        "name": widerRegion,
                        "json_file": `nations/${widerRegion}.json`,
                        "i18n_file": `nations/${widerRegion.toUpperCase()}/${API.locale}.json`
                    },
                    "missals": $.map( $('#publishedRomanMissalList li'), el => { return $(el).text() })
                }
            }
            break;
        case 'widerregion':
            // our proxy will take care of splitting locale from wider region
            API.key = document.querySelector('#widerRegionCalendarName').value;
            const regionNamesLocalizedEng = new Intl.DisplayNames(['en'], { type: 'region' });
            let nationalCalendars = $('#widerRegionLanguages').val().reduce((prev, curr) => {
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
            payload = {
                "litcal": [],
                "national_calendars": nationalCalendars,
                "metadata": {
                    "multilingual": $('#widerRegionIsMultilingual').prop('checked'),
                    "languages": $('#widerRegionLanguages').val(),
                    "wider_region": $('#widerRegionCalendarName').val()
                }
            }
            break;
    }

    $('.regionalNationalDataForm .row').each((idx, el) => {
        const action = $(el).data('action');
        let rowData = {
            "festivity": {},
            "metadata": {
                "action": action
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
        if( action === 'createNew' && rowData.festivity.common.includes( 'Proper' ) ) {
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
    //console.log(JSON.stringify(payload));
    $.ajax({
        url: API.path,
        method: 'PUT',
        dataType: 'json',
        contentType: 'application/json',
        crossDomain: false,
        data: payload,
        success: (data, textStatus, xhr) => {
            console.log(xhr.status + ' ' + textStatus + ': data returned from save action: ');
            console.log(data);
            toastr["success"]("National Calendar was created or updated successfully", "Success");
        },
        error: (xhr, textStatus, errorThrown) => {
            let errorBody = '';
            if( xhr.responseText !== '' ) {
                let responseObj = JSON.parse(xhr.responseText);
                if( responseObj.hasOwnProperty( 'error' ) ) {
                    errorBody = responseObj.error;
                    toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<hr>' + errorBody, "Error");
                } else {
                    toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<hr>' + xhr.responseText, "Error");
                }
            } else {
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown);
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
            }
        }
    });

});


$(document).on('change', '#diocesanCalendarNationalDependency', ev => {
    $('#diocesanCalendarDioceseName').val('');
    //$('#retrieveExistingDiocesanData').prop('disabled', true);
    $('#removeExistingDiocesanDataBtn').prop('disabled', true);
    $('body').find('#removeDiocesanCalendarPrompt').remove();
    let currentSelectedNation = $(ev.currentTarget).val();
    if (['ITALY','USA','NETHERLANDS'].includes(currentSelectedNation)) {
        $('#DiocesesList').empty();
        DiocesesList[currentSelectedNation].forEach(diocese => $('#DiocesesList').append('<option data-value="' + diocese.replace(/[^a-zA-Z]/gi, '').toUpperCase() + '" value="' + diocese + '">'));
    } else {
        $('#DiocesesList').empty();
        let dioceses = Object.filter( CalendarsIndex.diocesan_calendars, key => key.nation === currentSelectedNation );
        console.log(dioceses);
        Object.values( dioceses ).forEach( el => $('#DiocesesList').append('<option data-value="' + el.diocese.replace(/[^a-zA-Z]/gi, '').toUpperCase() + '" value="' + el.diocese + '">') )
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

$(document).on('change', '#widerRegionIsMultilingual', ev => {
    console.log('widerRegionIsMultilingual input was changed to ' + $(ev.currentTarget).is(':checked'));
    if ($(ev.currentTarget).is(':checked')) {
        $('#widerRegionLanguages').multiselect('enable');
    } else {
        $('#widerRegionLanguages').multiselect('disable');
    }
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

    $('#widerRegionLanguages').multiselect({
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
