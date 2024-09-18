import {
    FormControls,
    RowAction,
    setFormSettings,
    setFormSettingsForProperty,
    RANK,
    LitEvent,
    integerVals,
    expectedJSONProperties,
    metadataProps,
    setCommonMultiselect,
    monthsOfThirty
} from './FormControls.js';


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


const { LOCALE, LOCALE_WITH_REGION } = messages;
const jsLocale = LOCALE.replace('_', '-');
FormControls.jsLocale = jsLocale;
FormControls.weekdayFormatter = new Intl.DateTimeFormat(jsLocale, { weekday: "long" });

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

const removeDiocesanCalendarModal = diocese => {
    return `
<div class="modal fade" id="removeDiocesanCalendarPrompt" tabindex="-1" role="dialog" aria-labelledby="removeDiocesanCalendarModalLabel" aria-hidden="true">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="removeDiocesanCalendarModalLabel">${messages[ "Delete diocesan calendar" ]} ${diocese}?</h5>
      </div>
      <div class="modal-body">
        ${messages[ "If you choose" ]}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-backspace me-2">Cancel</button>
        <button type="button" id="deleteDiocesanCalendarButton" class="btn btn-danger"><i class="far fa-trash-alt me-2"></i>Delete calendar</button>
      </div>
    </div>
  </div>
</div>`;
};

const DIOCESES_ARR = {};

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
    })
]).then(responses => {
    return Promise.all(responses.map((response) => {
        if(response.ok) {
            return response.json();
        }
        else {
            throw new Error(response.status + ' ' + response.statusText + ': ' + response.text);
        }
    }));
}).then(data => {
    DIOCESES_ARR.ITALY = data[0];
    DIOCESES_ARR.USA = [];
    let USDiocesesByState = data[1];
    let c = 0;
    for (const [state, arr] of Object.entries(USDiocesesByState)) {
        arr.forEach(diocese => DIOCESES_ARR.USA[c++] = diocese + " (" + state + ")");
    }
    DIOCESES_ARR.NETHERLANDS = data[2];
})

let $CALENDAR = { litcal: {} };
let $index = null;
let $missals = null;

const loadDiocesanCalendarData = () => {
    let diocese = $('#diocesanCalendarDioceseName').val();
    let dioceseKey = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value').toUpperCase();
    jQuery.ajax({
        url: RegionalDataURL,
        method: 'GET',
        dataType: 'json',
        //crossDomain: true,
        data: { "key" : dioceseKey, "category": "DIOCESANCALENDAR" },
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
            $CALENDAR = data;
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
                    case RANK.SOLEMNITY:
                        $form = $('#carouselItemSolemnities form');
                        numLastRow = $form.find('.row').length - 1;
                        if (metadata.form_rownum > numLastRow) {
                            numMissingRows = metadata.form_rownum - numLastRow;
                            FormControls.title = messages['Other Solemnity'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $form.append($(FormControls.createFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemSolemnities form .row').eq(metadata.form_rownum);
                        break;
                    case RANK.FEAST:
                        numLastRow = $('#carouselItemFeasts form .row').length - 1;
                        if (metadata.form_rownum > numLastRow) {
                            numMissingRows = metadata.form_rownum - numLastRow;
                            FormControls.title = messages['Other Feast'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(1).find('form').append($(FormControls.createFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemFeasts form .row').eq(metadata.form_rownum);
                        break;
                    case RANK.MEMORIAL:
                        numLastRow = $('#carouselItemMemorials form .row').length - 1;
                        if (metadata.form_rownum > numLastRow) {
                            numMissingRows = metadata.form_rownum - numLastRow;
                            FormControls.title = messages['Other Memorial'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(2).find('form').append($(FormControls.createFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemMemorials form .row').eq(metadata.form_rownum);
                        break;
                    case RANK.OPTIONALMEMORIAL:
                        numLastRow = $('#carouselItemOptionalMemorials form .row').length - 1;
                        if (metadata.form_rownum > numLastRow) {
                            numMissingRows = metadata.form_rownum - numLastRow;
                            FormControls.title = messages['Other Optional Memorial'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(3).find('form').append($(FormControls.createFestivityRow()));
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

Promise.all([
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
            throw new Error(response.status + ' ' + response.statusText + ': ' + response.text);
        }
    }));
})
.then(dataArray => {
    dataArray.forEach(data => {
        if(data.hasOwnProperty('litcal_metadata')) {
            console.log('retrieved /calendars metadata:');
            console.log(data);
            $index = data.litcal_metadata;
            FormControls.index = data.litcal_metadata;
            toastr["success"]('Successfully retrieved data from /calendars path', "Success");
            if ($missals !== null) {
                console.log('missals finished loading first');
            }
        } else if (data.hasOwnProperty('litcal_missals')) {
            console.log('retrieved /missals metadata:');
            console.log(data);
            $missals = data.litcal_missals;
            FormControls.missals = data.litcal_missals;
            let publishedRomanMissalsStr = $missals.map(({missal_id,name}) => !missal_id.startsWith('EDITIO_TYPICA_') ? `<option class="list-group-item" value="${missal_id}">${name}</option>` : null).join('')
            $('#languageEditionRomanMissalList').append(publishedRomanMissalsStr);
            toastr["success"]('Successfully retrieved data from /missals path', "Success");
            if ($index !== null) {
                console.log('calendars data finished loading first');
            }
        }
    });
}).catch(error => {
    console.error(error);
    toastr["error"](error, "Error");
});

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
            if ($CALENDAR.litcal.hasOwnProperty(oldEventKey)) {
                delete $CALENDAR.litcal[oldEventKey];
            }
            $(ev.currentTarget).attr('data-valuewas', '');
        } else {
            let eventKey = $(ev.currentTarget).val().replace(/[^a-zA-Z]/gi, '');
            console.log('new LitEvent name identifier is ' + eventKey);
            console.log('festivity name is ' + $(ev.currentTarget).val());
            if ($(ev.currentTarget).attr('data-valuewas') == '' && $CALENDAR.litcal.hasOwnProperty(eventKey) === false) {
                console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                $CALENDAR.litcal[eventKey] = { festivity: {}, metadata: {} };
                $CALENDAR.litcal[eventKey].festivity = new LitEvent(
                    $(ev.currentTarget).val(), //name
                    $row.find('.litEventColor').val(), //color
                    null,
                    $row.find('.litEventCommon').val(), //common
                    parseInt($row.find('.litEventDay').val()), //day
                    parseInt($row.find('.litEventMonth').val()), //month
                );
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                $CALENDAR.litcal[eventKey].metadata.since_year = parseInt($row.find('.litEventSinceYear').val());
                if( $row.find('.litEventUntilYear').val() !== '' ) {
                    $CALENDAR.litcal[eventKey].metadata.until_year = parseInt($row.find('.litEventUntilYear').val());
                }
                let formRowIndex = $card.find('.row').index($row);
                $CALENDAR.litcal[eventKey].metadata.form_rownum = formRowIndex;
                console.log('form row index is ' + formRowIndex);
                $(ev.currentTarget).attr('data-valuewas', eventKey);
                $(ev.currentTarget).removeClass('is-invalid');
                console.log( $CALENDAR.litcal[eventKey] );
            } else if ($(ev.currentTarget).attr('data-valuewas') != '') {
                let oldEventKey = $(ev.currentTarget).attr('data-valuewas');
                console.log('the preceding value here was ' + oldEventKey);
                if ($CALENDAR.litcal.hasOwnProperty(oldEventKey)) {
                    if (oldEventKey !== eventKey) {
                        if( /_2$/.test(eventKey) ) {
                            console.log('oh geez, we are dealing with a second festivity that has the same name as a first festivity, because it continues where the previous untilYear left off...');
                            eventKey = oldEventKey;
                            console.log('but wait, why would you be changing the name of the second festivity? it will no longer match the first festivity!');
                            console.log('this is becoming a big mess, arghhhh... results can start to be unpredictable');
                            $CALENDAR.litcal[eventKey].festivity.name = $(ev.currentTarget).val();
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        } else {
                            console.log('I see you are trying to change the name of a festivity that was already defined. This will effectively change the relative key also, so here is what we are going to do:');
                            console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
                            Object.defineProperty($CALENDAR.litcal, eventKey,
                                Object.getOwnPropertyDescriptor($CALENDAR.litcal, oldEventKey));
                            $CALENDAR.litcal[eventKey].festivity.name = $(ev.currentTarget).val();
                            delete $CALENDAR.litcal[oldEventKey];
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        }
                    }
                }
            } else if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                if( false === $CALENDAR.litcal[eventKey].metadata.hasOwnProperty('until_year') ) {
                    console.log('exact same festivity name was already defined elsewhere! key ' + eventKey + ' already exists! and the untilYear property was not defined!');
                    $(ev.currentTarget).val('');
                    $(ev.currentTarget).addClass('is-invalid');
                } else {
                    let confrm = confirm('The same festivity name was already defined elsewhere. However an untilYear property was also defined, so perhaps you are wanting to define again for the years following. If this is the case, press OK, otherwise Cancel');
                    if(confrm) {
                        //retrieve untilYear from the previous festivity with the same name
                        let untilYear = $CALENDAR.litcal[eventKey].metadata.until_year;
                        //set the sinceYear field on this row to the previous untilYear plus one
                        $row.find('.litEventSinceYear').val(untilYear+1);
                        //update our eventKey to be distinct from the previous festivity
                        eventKey = eventKey+'_2';
                        $(ev.currentTarget).attr('data-valuewas', eventKey);
                        $CALENDAR.litcal[eventKey] = { festivity: {}, metadata: {} };
                        $CALENDAR.litcal[eventKey].festivity = new LitEvent(
                            $(ev.currentTarget).val(), //name
                            $row.find('.litEventColor').val(), //color
                            null,
                            $row.find('.litEventCommon').val(), //common
                            parseInt($row.find('.litEventDay').val()), //day
                            parseInt($row.find('.litEventMonth').val()), //month
                        );
                        $CALENDAR.litcal[eventKey].metadata.since_year = untilYear + 1;
                        let formRowIndex = $card.find('.row').index($row);
                        $CALENDAR.litcal[eventKey].metadata.form_rownum = formRowIndex;
                        console.log('form row index is ' + formRowIndex);
                    }
                }
            }
            switch ($(ev.currentTarget).closest('.carousel-item').attr('id')) {
                case 'carouselItemSolemnities':
                    $CALENDAR.litcal[eventKey].festivity.grade = 6;
                    if ($(ev.currentTarget).val().match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'red');
                        $CALENDAR.litcal[eventKey].festivity.color = [ 'red' ];
                    } else {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                        $CALENDAR.litcal[eventKey].festivity.color = [ 'white' ];
                    }
                    break;
                case 'carouselItemFeasts':
                    $CALENDAR.litcal[eventKey].festivity.grade = 4;
                    break;
                case 'carouselItemMemorials':
                    $CALENDAR.litcal[eventKey].festivity.grade = 3;
                    break;
                case 'carouselItemOptionalMemorials':
                    $CALENDAR.litcal[eventKey].festivity.grade = 2;
                    break;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventDay')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                $CALENDAR.litcal[eventKey].festivity.day = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventMonth')) {
        let selcdMonth = parseInt($(ev.currentTarget).val());
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                $CALENDAR.litcal[eventKey].festivity.month = selcdMonth;
            }
        }
        $row.find('.litEventDay').attr('max', selcdMonth === FEBRUARY ? "28" : (monthsOfThirty.includes(selcdMonth) ? "30" : "31"));
        if (parseInt($row.find('.litEventDay').val()) > parseInt($row.find('.litEventDay').attr('max'))) {
            $row.find('.litEventDay').val($row.find('.litEventDay').attr('max'));
        }
    } else if ($(ev.currentTarget).hasClass('litEventCommon')) {
        if ($row.find('.litEventName').val() !== "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                $CALENDAR.litcal[eventKey].festivity.common = $(ev.currentTarget).val();
                let eventColors = [];
                if ($CALENDAR.litcal[eventKey].festivity.common.some( m => /Martyrs/.test(m) )) {
                    eventColors.push('red');
                }
                if ($CALENDAR.litcal[eventKey].festivity.common.some( m => /(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/.test(m) ) ) {
                    eventColors.push('white');
                }
                $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', eventColors);
                $CALENDAR.litcal[eventKey].festivity.color = eventColors;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventColor')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                $CALENDAR.litcal[eventKey].festivity.color = $(ev.currentTarget).val();
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventSinceYear')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                $CALENDAR.litcal[eventKey].metadata.since_year = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventUntilYear')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                if($(ev.currentTarget).val() !== '') {
                    $CALENDAR.litcal[eventKey].metadata.until_year = parseInt($(ev.currentTarget).val());
                } else {
                    delete $CALENDAR.litcal[eventKey].metadata.until_year;
                }
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventStrtotimeSwitch')) {
        if ($row.find('.litEventName').val() != "") {
            let eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                if(false === $(ev.currentTarget).prop('checked')) {
                    delete $CALENDAR.litcal[eventKey].metadata.strtotime;
                    $CALENDAR.litcal[eventKey].festivity.day = 1;
                    $CALENDAR.litcal[eventKey].festivity.month = 1;
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
                    delete $CALENDAR.litcal[eventKey].festivity.day;
                    delete $CALENDAR.litcal[eventKey].festivity.month;
                    $CALENDAR.litcal[eventKey].metadata.strtotime = '';
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
            if ($CALENDAR.litcal.hasOwnProperty(eventKey)) {
                $CALENDAR.litcal[eventKey].metadata.strtotime = $(ev.currentTarget).val();
            }
        }
    }
});

$(document).on('click', '#saveDiocesanCalendar_btn', () => {
    $nation = $('#diocesanCalendarNationalDependency').val();
    $diocese = $('#diocesanCalendarDioceseName').val();
    //console.log('save button was clicked for NATION = ' + $nation + ', DIOCESE = ' + $diocese);
    let saveObj = { CalData: $CALENDAR, Diocese: $diocese, Nation: $nation, category: 'diocesanCalendar' };
    if($('#diocesanCalendarGroup').val() != ''){
        saveObj.group = $('#diocesanCalendarGroup').val();
    }
    if( diocesanOvveridesDefined() ) {
        //console.log( 'This diocesan calendar has defined some options that will override the national calendar.' );
        saveObj.CalData.overrides = {};
        if( $('#diocesanCalendarOverrideEpiphany').val() !== "" ) {
            saveObj.CalData.overrides.epiphany = $('#diocesanCalendarOverrideEpiphany').val();
            //console.log( 'Epiphany in this diocese will override Epiphany in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideAscension').val() !== "" ) {
            saveObj.CalData.overrides.ascension = $('#diocesanCalendarOverrideAscension').val();
            //console.log( 'Ascension in this diocese will override Ascension in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideCorpusChristi').val() !== "" ) {
            saveObj.CalData.overrides.corpus_christi = $('#diocesanCalendarOverrideCorpusChristi').val();
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


$(document).on('click', '#removeExistingDiocesanData', evt => {
    evt.preventDefault();
    //let diocese = $('#diocesanCalendarDioceseName').val();
    //let dioceseKey = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value').toUpperCase();
});

$(document).on('click', '.onTheFlyEventRow', ev => {
    let $row;
    switch (ev.currentTarget.id) {
        case "addSolemnity":
            FormControls.title = messages['Other Solemnity'];
            $row = $(FormControls.createFestivityRow());
            $('.carousel-item').first().find('form').append($row);
            break;
        case "addFeast":
            FormControls.title = messages['Other Feast'];
            $row = $(FormControls.createFestivityRow());
            $('.carousel-item').eq(1).find('form').append($row);
            break;
        case "addMemorial":
            FormControls.title = messages['Other Memorial'];
            $row = $(FormControls.createFestivityRow());
            $('.carousel-item').eq(2).find('form').append($row);
            break;
        case "addOptionalMemorial":
            FormControls.title = messages['Other Optional Memorial'];
            $row = $(FormControls.createFestivityRow());
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
    if( FormControls.action.description === RowAction.SetProperty.description ) {
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
    const category = ev.currentTarget.dataset.category;
    let key = ev.currentTarget.value;
    let apiDataPath = `${RegionalDataURL}/${category}/`;
    const headers = {
        'Accept': 'application/json'
    };
    if ( category === 'WIDERREGIONCALENDAR' ) {
        let locale;
        ([key, locale] = ev.currentTarget.value.split(' - '));
        apiDataPath += key;
        headers['Accept-Language'] = locale;
    } else if (category === 'NATIONALCALENDAR') {
        key = key.toUpperCase();
        if (key === 'UNITED STATES') {
            key = 'USA';
        }
        apiDataPath += key;
    } else {
        apiDataPath += key;
    }

    fetch(apiDataPath, { headers }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            if (404 === response.status) {
                toastr["warning"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />The Data File for the ' + category + ' ' + key + ' does not exist yet. Not that it\'s a big deal, just go ahead and create it now!', "Warning");
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown + 'The Data File for the ' + category + ' ' + key + ' does not exist yet (just saying, not that it is really a big deal. Just go ahead and create it now!)');
                switch(category) {
                    case 'WIDERREGIONCALENDAR':
                        $('#widerRegionIsMultilingual').prop('checked', false);
                        $('#widerRegionLanguages').multiselect('deselectAll', false);
                        break;
                    case 'NATIONALCALENDAR':
                        $('form#nationalCalendarSettingsForm')[0].reset();
                        $('#publishedRomanMissalList').empty();
                        break;
                }
                $('form.regionalNationalDataForm').empty();
                return;
            }
            return Promise.reject(response);
        }
    }).then(data => {
        console.log( `successfully retrieved the data file for the ${category} ${key}` );
        console.log(data);
        switch(category) {
            case 'WIDERREGIONCALENDAR':
                $('#widerRegionIsMultilingual').prop('checked', data.metadata.multilingual);
                FormControls.settings.decreeURLField = true;
                FormControls.settings.decreeLangMapField = true;
                $('#widerRegionLanguages').multiselect('deselectAll', false).multiselect('select', data.metadata.languages);
                break;
            case 'NATIONALCALENDAR':
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
            if( el.metadata.action === RowAction.CreateNew.description && FestivityCollection.hasOwnProperty( existingFestivityTag ) ) {
                el.metadata.action = RowAction.CreateNewFromExisting.description;
            }
            setFormSettings( el.metadata.action );
            if( el.metadata.action === RowAction.SetProperty.description ) {
                setFormSettingsForProperty( el.metadata.property );
            }

            let rowStr = FormControls.CreatePatronRow( el );
            let rowEls = $.parseHTML(rowStr);
            let $row = $(rowEls);
            $('.regionalNationalDataForm').append($row);

            let $formrow = $row.find('.form-group').closest('.row');
            $formrow.data('action', el.metadata.action).attr('data-action', el.metadata.action);
            if( el.metadata.action === RowAction.SetProperty.description ) {
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
        console.error(error);
        response.json().then(json => {
            console.error(json);
        })
        toastr["error"](error.status + ' ' + error.statusText + ': ' + error.text, "Error");
    });
});

$(document).on('change', '#diocesanCalendarDioceseName', ev => {
    const currentVal = sanitizeInput( $(ev.currentTarget).val() );
    $CALENDAR = { litcal: {} };
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
        let $key = $('#DiocesesList').find('option[value="' + currentVal + '"]').attr('data-value').toUpperCase();
        //console.log('selected diocese with key = ' + $key);
        if ($index.diocesan_calendars_keys.includes($key)) {
            const diocesan_calendar = $index.diocesan_calendars.filter(el => el.calendar_id === $key)[0];
            $('#removeExistingDiocesanData').prop('disabled', false);
            $('body').append(removeDiocesanCalendarModal(currentVal));
            if(diocesan_calendar.hasOwnProperty('group')){
                $('#diocesanCalendarGroup').val(diocesan_calendar.group);
            }
            loadDiocesanCalendarData();
            //console.log('we have an existing entry for this diocese!');
        } else {
            $('#removeExistingDiocesanData').prop('disabled', true);
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

$(document).on('click', '#deleteDiocesanCalendarButton', ev => {
    $('#removeDiocesanCalendarPrompt').modal('toggle');
    let $diocese = $('#diocesanCalendarDioceseName').val();
    let $key = $('#DiocesesList').find('option[value="' + $diocese + '"]').attr('data-value').toUpperCase();
    let $nation = $('#diocesanCalendarNationalDependency').val();
    delete $index.DiocesanCalendars[$key];
    let deleteKey = { LitCal: $key, Diocese: $diocese, Nation: $nation, category: 'diocesanCalendar' };
    $.ajax({
        url: RegionalDataURL,
        method: 'DELETE',
        dataType: 'json',
        contentType: 'application/json',
        crossDomain: false,
        data: JSON.stringify( deleteKey ),
        success: data => {
            $('#retrieveExistingDiocesanData').prop('disabled', true);
            $('#removeExistingDiocesanData').prop('disabled', true);
            $('body').find('#removeDiocesanCalendarPrompt').remove();
            $('#diocesanCalendarDioceseName').val('');
            $('#diocesanCalendarNationalDependency').val('');
            //console.log('data returned from delete action: ');
            //console.log(data);
            toastr["success"]("Diocesan Calendar was deleted successfully", "Success");
        },
        error: (xhr, textStatus, errorThrown) => {
            console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown);
            toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
        }
    });
});

$(document).on('click', '.serializeRegionalNationalData', ev => {
    const category = $(ev.currentTarget).data('category');
    const lcl = $('#nationalCalendarSettingLocale').val();
    let finalObj = {};
    switch(category) {
        case 'NATIONALCALENDAR':
            const regionNamesLocalized = new Intl.DisplayNames(['en'], { type: 'region' });
            const widerRegion = $('#associatedWiderRegion').val();
            finalObj = {
                "litcal": [],
                "settings": {
                    "epiphany": $('#nationalCalendarSettingEpiphany').val(),
                    "ascension": $('#nationalCalendarSettingAscension').val(),
                    "corpus_christi": $('#nationalCalendarSettingCorpusChristi').val(),
                    "eternal_high_priest": $('#nationalCalendarSettingHighPriest').is(':checked'),
                    "locale": lcl
                },
                "metadata": {
                    "region": regionNamesLocalized.of( messages.countryISOCodes[$('.regionalNationalCalendarName').val().toUpperCase()] ).toUpperCase().replace(/[.]/g,'_'),
                    "wider_region": {
                        "name": widerRegion,
                        "json_file": `nations/${widerRegion}.json`,
                        "i18n_file": `nations/${widerRegion.toUpperCase()}/${lcl}.json`
                    },
                    "missals": $.map( $('#publishedRomanMissalList li'), el => { return $(el).text() })
                }
            }
            break;
        case 'WIDERREGIONCALENDAR':
            const regionNamesLocalizedEng = new Intl.DisplayNames(['en'], { type: 'region' });
            let nationalCalendars = $('#widerRegionLanguages').val().reduce((prev, curr) => {
                curr = curr.replaceAll('_', '-');
                //this should never be the case, if we are careful to select only languages associated with a specific territory...
                //might be even better to exclude non-regional languages from the select list, so that regions will have to be associated
                //and perhaps the language-region locale should be define in the RomanMissal enum itself;
                //we should try to get an exhaustive list of all printed Roman Missals since Vatican II!
                if( curr.includes('-') === false ) {
                    curr += '-' + curr.toUpperCase();
                }
                let locale = new Intl.Locale( curr );
                console.log( 'curr = ' + curr + ', nation = ' + locale.region );
                prev[ regionNamesLocalizedEng.of( locale.region ) ] = locale.region;
                return prev;
            }, {});
            finalObj = {
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
        if( action === RowAction.SetProperty.description ) {
            rowData.metadata.property = $(el).data('prop');
        }
        expectedJSONProperties[action].forEach(prop => {
            let propClass = '.litEvent' + prop.charAt(0).toUpperCase() + prop.substring(1).toLowerCase();
            if( $(el).find(propClass).length ) {
                let val = $(el).find(propClass).val();
                if( integerVals.includes(prop) ) {
                    val = parseInt( val );
                }
                if( metadataProps.includes(prop) ) {
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
        finalObj.litcal.push(rowData);
    });

    //console.log(finalObj);
    //console.log(JSON.stringify(finalObj));
    $.ajax({
        url: RegionalDataURL,
        method: 'PUT',
        dataType: 'json',
        contentType: 'application/json',
        crossDomain: false,
        data: JSON.stringify( finalObj ),
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
    $('#removeExistingDiocesanData').prop('disabled', true);
    $('body').find('#removeDiocesanCalendarPrompt').remove();
    let currentSelectedNation = $(ev.currentTarget).val();
    if (['ITALY','USA','NETHERLANDS'].includes(currentSelectedNation)) {
        $('#DiocesesList').empty();
        DIOCESES_ARR[currentSelectedNation].forEach(diocese => $('#DiocesesList').append('<option data-value="' + diocese.replace(/[^a-zA-Z]/gi, '').toUpperCase() + '" value="' + diocese + '">'));
    } else {
        $('#DiocesesList').empty();
        let dioceses = Object.filter( $index.diocesan_calendars, key => key.nation === currentSelectedNation );
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

//kudos to https://stackoverflow.com/a/47140708/394921 for the idea
const sanitizeInput = (input) => {
    let doc = new DOMParser().parseFromString(input, 'text/html');
    return doc.body.textContent || "";
}
