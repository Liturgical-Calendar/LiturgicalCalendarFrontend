String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        let t = typeof arguments[0];
        let args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (const key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

const isStaging = location.hostname.includes( '-staging' );
const endpointV = isStaging ? 'dev' : 'v3';
const MetaDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/LitCalMetadata.php`;
const DiocesanDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/LitCalDiocesanData.php`;
const NationalDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/LitCalNationalAndRegionalData.php`;

let ITALYDiocesesArr;
let USDiocesesByState;
let USDiocesesArr = [];

$.getJSON( './assets/data/ItalyDioceses.json', data => { ITALYDiocesesArr = data; } );
$.getJSON( './assets/data/USDiocesesByState.json', data => {
    USDiocesesByState = data;
    let c = 0;
    for (const [state, arr] of Object.entries(USDiocesesByState)) {
        arr.forEach(diocese => USDiocesesArr[c++] = diocese + " (" + state + ")");
    }
});

const JANUARY = 1;
const FEBRUARY = 2;
const MARCH = 3;
const APRIL = 4;
const MAY = 5;
const JUNE = 6;
const JULY = 7;
const AUGUST = 8;
const SEPTEMBER = 9;
const OCTOBER = 10;
const NOVEMBER = 11;
const DECEMBER = 12;

const monthsOfThirty = [SEPTEMBER, APRIL, JUNE, NOVEMBER];

const RANK = {
    HIGHERSOLEMNITY: 7,
    SOLEMNITY: 6,
    FEASTLORD: 5,
    FEAST: 4,
    MEMORIAL: 3,
    OPTIONALMEMORIAL: 2,
    WEEKDAY: 1
}

class litEvent {
    constructor(name = "", color = "", grade = 0, common = "", day = 1, month = 1, formRowNum = -1, sinceYear = 1970) {
        this.name = name;
        this.color = color;
        this.grade = grade;
        this.common = common;
        this.day = day;
        this.month = month;
        this.formRowNum = formRowNum;
        this.sinceYear = sinceYear;
    }
}

const { LOCALE } = messages;

const lowercaseKeys = obj =>
  Object.keys(obj).reduce((acc, key) => {
    acc[key.toLowerCase()] = obj[key];
    return acc;
  }, {});

class FormControls {
    static uniqid = 0;
    static settings = {
        nameField: true,
        dayField: true,
        monthField: true,
        colorField: true,
        gradeField: false,
        properField: false,
        gradeFieldShow: false,
        properFieldShow: false,
        fromYearField: true,
        untilYearField: false,
        tagField: false,
        decreeURLField: false,
        decreeLangMapField: false
    }

    static CreateFestivityRow(title = null) {
        let formRow = '';

        if (title !== null) {
            formRow += `<h4>${title}</h4>`;
        }

        formRow += `<div class="form-row">`;

        if (FormControls.settings.nameField) {
            formRow += `<div class="form-group col-sm-3">
            <label for="onTheFly${FormControls.uniqid}Name">${messages[ "Name" ]}</label><input type="text" class="form-control litEvent litEventName" id="onTheFly${FormControls.uniqid}Name" data-valuewas="" />
            <div class="invalid-feedback">This same celebration was already defined elsewhere. Please remove it first where it is defined, then you can define it here.</div>
            </div>`;
        }

        if (FormControls.settings.dayField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Day">${messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day" />
            </div>`;
        }

        if (FormControls.settings.monthField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Month">${messages[ "Month" ]}</label>
            <select class="form-control litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month">`;

            let formatter = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
            for (let i = 0; i < 12; i++) {
                let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
            }

            formRow += `</select>
            </div>`;
        }

        if (FormControls.settings.properField) {
            formRow += messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:3});
        }

        if (FormControls.settings.colorField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Color">${messages[ "Liturgical color" ]}</label>
            <select class="form-control litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple" />
            <option value="white" selected>${messages[ "white" ].toUpperCase()}</option>
            <option value="red">${messages[ "red" ].toUpperCase()}</option>
            <option value="purple">${messages[ "purple" ].toUpperCase()}</option>
            <option value="green">${messages[ "green" ].toUpperCase()}</option>
            </select>
            </div>`;
        }

        if (FormControls.settings.fromYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}FromYear">${messages[ "Since" ]}</label>
            <input type="number" min="1970" max="9999" class="form-control litEvent litEventFromYear" id="onTheFly${FormControls.uniqid}FromYear" value="1970" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }


    static CreatePatronRow(title = null, element = null) {
        let formRow = '';
        let festivity = null;
        if( element !== null ) {
            if( typeof element === 'string' ) {
                festivity = lowercaseKeys( FestivityCollection[element] );
                festivity.tag = element;
                festivity.sinceYear = 1970;
                festivity.untilYear = '';
                festivity.decreeURL = '';
                festivity.decreeLangs = {};
            }
            if( typeof element === 'object' ) {
                festivity = element.Festivity;
                festivity.sinceYear = element.Metadata.sinceYear;
                festivity.untilYear = element.Metadata.untilYear || '';
                festivity.decreeURL = element.Metadata.decreeURL;
                festivity.decreeLangs = element.Metadata.decreeLangs;
            }
            console.log(festivity);
        }

        if (title !== null) {
            formRow += `<h4>${title}</h4>`;
        }

        formRow += `<div class="form-row">`;

        formRow += `<div class="form-group col-sm-6">`;
        if(FormControls.settings.tagField === false){
            formRow += `<input type="hidden" id="onTheFly${FormControls.uniqid}Tag" value="${festivity !== null ? festivity.tag : ''}" />`;
        }
        formRow += `<label for="onTheFly${FormControls.uniqid}Name">${messages[ "Name" ]}</label>
        <input type="text" class="form-control litEvent litEventName${festivity !== null && typeof festivity.name==='undefined' ? ` is-invalid` : ``}" id="onTheFly${FormControls.uniqid}Name" value="${festivity !== null ? festivity.name : ''}"${FormControls.settings.nameField === false ? ' readonly' : ''} />
        <div class="invalid-feedback">There is no locale data for this celebration in the current locale. Perhaps try a different locale?.</div>
        </div>`;

        if (FormControls.settings.fromYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}FromYear">${messages[ "Since" ]}</label>
            <input type="number" min="1970" max="9999" class="form-control litEvent litEventFromYear" id="onTheFly${FormControls.uniqid}FromYear" value="${festivity !== null ? festivity.sinceYear : ''}" />
            </div>`;
        }

        if (FormControls.settings.untilYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}UntilYear">${messages[ "Until" ]}</label>
            <input type="number" min="1970" max="9999" class="form-control litEvent litEventUntilYear" id="onTheFly${FormControls.uniqid}UntilYear" value="${festivity !== null ? festivity.untilYear : ''}" />
            </div>`;
        }

        let selectedColors = festivity !== null ? festivity.color.split(',') : null;
        formRow += `<div class="form-group col-sm-2">
        <label for="onTheFly${FormControls.uniqid}Color">${messages[ "Liturgical color" ]}</label>
        <select class="form-control litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple"${FormControls.settings.colorField === false ? ' readonly' : ''} />
        <option value="white"${festivity !== null && selectedColors.includes("white") ? ' selected' : '' }>${messages[ "white" ].toUpperCase()}</option>
        <option value="red"${festivity !== null && selectedColors.includes("red") ? ' selected' : '' }>${messages[ "red" ].toUpperCase()}</option>
        <option value="purple"${festivity !== null && selectedColors.includes("purple") ? ' selected' : '' }>${messages[ "purple" ].toUpperCase()}</option>
        <option value="green"${festivity !== null && selectedColors.includes("green") ? ' selected' : '' }>${messages[ "green" ].toUpperCase()}</option>
        </select>
        </div>`;

        formRow += `<div class="form-group col-sm-1">
        <label for="onTheFly${FormControls.uniqid}Day">${messages[ "Day" ]}</label>
        <input type="number" min="1" max="31" value="${festivity !== null && festivity.day}" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day"${FormControls.settings.dayField === false ?  'readonly' : '' } />
        </div>`;

        formRow += `<div class="form-group col-sm-1">
        <label for="onTheFly${FormControls.uniqid}Month">${messages[ "Month" ]}</label>
        <select class="form-control litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month"${FormControls.settings.monthField === false ?  'readonly' : '' } >`;

        let formatter = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
        for (let i = 0; i < 12; i++) {
            let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
            formRow += `<option value=${i + 1}${festivity !== null && festivity.month === i+1 ? ' selected' : '' }>${formatter.format(month)}</option>`;
        }

        formRow += `</select>
        </div>`;

        if (FormControls.settings.tagField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Tag">${messages[ "Tag" ]}</label>
            <input type="text" value="${festivity !== null ? festivity.tag : ''}" class="form-control litEvent litEventTag" id="onTheFly${FormControls.uniqid}Tag" />
            </div>`;
        }
        
        if (FormControls.settings.gradeFieldShow) {
            formRow +=  messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:4});
        }

        if (FormControls.settings.properFieldShow) {
            formRow += messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:6});
        }

        if(FormControls.settings.decreeURLField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${messages[ "Decree URL" ]}</label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.decreeURL !== 'undefined' ? festivity.decreeURL : ''}" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapField) {
            let decreeLangs = festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? Object.keys(festivity.decreeLangs).map(key => key+'='+festivity.decreeLangs[key] ) : null;
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${messages[ "Decree Langs" ]}</label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? decreeLangs.join(',') : ''}" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }

}

let $CALENDAR = { LitCal: {} };
let $index = {};

let WiderRegionData = {};

jQuery.ajax({
    url: MetaDataURL,
    dataType: 'json',
    statusCode: {
        404: (xhr, textStatus, errorThrown) => {
            console.log('The JSON definition "nations/index.json" does not exist yet.');
            console.log( xhr.responseText );
            toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />' + xhr.responseText, "Error");
        }
    },
    success: data => {
        console.log('retrieved data from index file:');
        console.log(data);
        $index = data.LitCalMetadata;
        toastr["success"]('Successfully retrieved data from index file', "Success");
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
        $('.carousel').carousel(parseInt($(ev.currentTarget).attr('data-slide-to')));
    }
});

$(document).on('change', '.litEvent', ev => {
    $row = $(ev.currentTarget).closest('.form-row');
    $card = $(ev.currentTarget).closest('.card-body');
    if ($(ev.currentTarget).hasClass('litEventName')) {
        console.log('LitEvent name has changed');
        if ($(ev.currentTarget).val() == '') {
            //empty value probably means we are trying to delete an already defined event
            //so let's find the key and remove it
            oldEventKey = $(ev.currentTarget).attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(oldEventKey)) {
                delete $CALENDAR.LitCal[oldEventKey];
            }
        } else {
            eventKey = $(ev.currentTarget).val().replace(/[^a-zA-Z]/gi, '');
            console.log('new LitEvent name identifier is ' + eventKey);
            if ($(ev.currentTarget).attr('data-valuewas') == '' && $CALENDAR.LitCal.hasOwnProperty(eventKey) === false) {
                console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                $CALENDAR.LitCal[eventKey] = new litEvent();
                $CALENDAR.LitCal[eventKey].name = $(ev.currentTarget).val();
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                $CALENDAR.LitCal[eventKey].day = parseInt($row.find('.litEventDay').val());
                $CALENDAR.LitCal[eventKey].month = parseInt($row.find('.litEventMonth').val());
                $CALENDAR.LitCal[eventKey].color = $row.find('.litEventColor').val();
                $CALENDAR.LitCal[eventKey].common = $row.find('.litEventProper').val().join(',');
                $CALENDAR.LitCal[eventKey].sinceYear = $row.find('.litEventFromYear').val();
                $CALENDAR.LitCal[eventKey].formRowNum = $card.find('.form-row').index($row);
                $(ev.currentTarget).attr('data-valuewas', eventKey);
                $(ev.currentTarget).removeClass('is-invalid');
            } else if ($(ev.currentTarget).attr('data-valuewas') != '') {
                oldEventKey = $(ev.currentTarget).attr('data-valuewas');
                console.log('the preceding value here was ' + oldEventKey);
                if ($CALENDAR.LitCal.hasOwnProperty(oldEventKey)) {
                    if (oldEventKey !== eventKey) {
                        console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
                        Object.defineProperty($CALENDAR.LitCal, eventKey,
                            Object.getOwnPropertyDescriptor($CALENDAR.LitCal, oldEventKey));
                        $CALENDAR.LitCal[eventKey].name = $(ev.currentTarget).val();
                        delete $CALENDAR.LitCal[oldEventKey];
                        $(ev.currentTarget).attr('data-valuewas', eventKey);
                        $(ev.currentTarget).removeClass('is-invalid');
                    }
                }
            } else if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                //ev.currentTarget exact same festivity name was already defined elsewhere!
                $(ev.currentTarget).val('');
                $(ev.currentTarget).addClass('is-invalid');
            }
            switch ($(ev.currentTarget).closest('.carousel-item').attr('id')) {
                case 'carouselItemSolemnities':
                    $CALENDAR.LitCal[eventKey].grade = 6;
                    if ($(ev.currentTarget).val().match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'red');
                        $CALENDAR.LitCal[eventKey].color = 'red';
                    } else {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                        $CALENDAR.LitCal[eventKey].color = 'white';
                    }
                    break;
                case 'carouselItemFeasts':
                    $CALENDAR.LitCal[eventKey].grade = 4;
                    break;
                case 'carouselItemMemorials':
                    $CALENDAR.LitCal[eventKey].grade = 3;
                    break;
                case 'carouselItemOptionalMemorials':
                    $CALENDAR.LitCal[eventKey].grade = 2;
                    break;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventDay')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').val().replace(/[^a-zA-Z]/gi, '');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].day = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventMonth')) {
        let selcdMonth = parseInt($(ev.currentTarget).val());
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').val().replace(/[^a-zA-Z]/gi, '');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].month = selcdMonth;
            }
        }
        $row.find('.litEventDay').attr('max', selcdMonth === FEBRUARY ? "28" : (monthsOfThirty.includes(selcdMonth) ? "30" : "31"));
        if (parseInt($row.find('.litEventDay').val()) > parseInt($row.find('.litEventDay').attr('max'))) {
            $row.find('.litEventDay').val($row.find('.litEventDay').attr('max'));
        }
    } else if ($(ev.currentTarget).hasClass('litEventProper')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').val().replace(/[^a-zA-Z]/gi, '');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                if (typeof $(ev.currentTarget).val() === 'object') {
                    $CALENDAR.LitCal[eventKey].common = $(ev.currentTarget).val().join();
                } else {
                    $CALENDAR.LitCal[eventKey].common = $(ev.currentTarget).val();
                }
                switch ($row.closest('.carousel-item').attr('id')) {
                    case 'carouselItemSolemnities':
                        /* we actually check this on name change
                        if($row.find('.litEventName').match(/(martyr|martir|mártir|märtyr)/i) !== null){
                            $row.find('.litEventColor').multiselect('deselectAll',false).multiselect('select','red');
                        } else {
                            $row.find('.litEventColor').multiselect('deselectAll',false).multiselect('select','white');
                        }
                        */
                        break;
                    case 'carouselItemFeasts':
                    case 'carouselItemMemorials':
                    case 'carouselItemOptionalMemorials':
                        let eventColors = [];
                        if ($CALENDAR.LitCal[eventKey].common.includes('Martyrs')) {
                            eventColors.push('red');
                        }
                        if ($CALENDAR.LitCal[eventKey].common.match(/(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/) !== null) {
                            eventColors.push('white');
                        }
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', eventColors);
                        $CALENDAR.LitCal[eventKey].color = eventColors.join(',');
                        break;
                }
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventColor')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').val().replace(/[^a-zA-Z]/gi, '');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].color = $(ev.currentTarget).val();
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventFromYear')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').val().replace(/[^a-zA-Z]/gi, '');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].sinceYear = $(ev.currentTarget).val();
            }
        }
    }
});

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

const diocesanOvveridesDefined = () => {
    return ( $('#diocesanCalendarOverrideEpiphany').val() !== "" || $('#diocesanCalendarOverrideAscension').val() !== "" || $('#diocesanCalendarOverrideCorpusChristi').val() !== "" );
}

$(document).on('click', '#saveDiocesanCalendar_btn', ev => {
    $data = JSON.stringify($CALENDAR);
    $nation = $('#diocesanCalendarNationalDependency').val();
    $diocese = $('#diocesanCalendarDioceseName').val();
    console.log('save button was clicked for NATION = ' + $nation + ', DIOCESE = ' + $diocese);
    let saveObj = { calendar: $data, diocese: $diocese, nation: $nation };
    if($('#diocesanCalendarGroup').val() != ''){
        saveObj.group = $('#diocesanCalendarGroup').val();
    }
    if( diocesanOvveridesDefined() ) {
        console.log( 'This diocesan calendar has defined some options that will override the national calendar.' );
        saveObj.overrides = {};
        if( $('#diocesanCalendarOverrideEpiphany').val() !== "" ) {
            saveObj.overrides.Epiphany = $('#diocesanCalendarOverrideEpiphany').val();
            console.log( 'Epiphany in this diocese will override Epiphany in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideAscension').val() !== "" ) {
            saveObj.overrides.Ascension = $('#diocesanCalendarOverrideAscension').val();
            console.log( 'Ascension in this diocese will override Ascension in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideCorpusChristi').val() !== "" ) {
            saveObj.overrides.CorpusChristi = $('#diocesanCalendarOverrideCorpusChristi').val();
            console.log( 'Corpus Christi in this diocese will override Corpus Christi in the national calendar.' );
        }
    }

    let formsValid = true;
    $('form').each((idx, el) => {
        if (el.checkValidity() === false) {
            formsValid = false;
        }
        $(el).addClass('was-validated');
    });
    if ( formsValid ) {
        $.ajax({
            url: DiocesanDataURL,
            method: 'put',
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
        alert('Nation / Diocese cannot be empty');
    }
});

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

$(document).on('click', '#retrieveExistingDiocesanData', evt => {
    evt.preventDefault();
    let diocese = $('#diocesanCalendarDioceseName').val();
    let dioceseKey = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value').toUpperCase();
    //let $diocesanCalendar;
    jQuery.ajax({
        url: DiocesanDataURL,
        method: 'GET',
        dataType: 'json',
        data: { "key" : dioceseKey },
        statusCode: {
            404: (xhr, textStatus, errorThrown) => {
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />The Diocesan Calendar for ' + diocese + ' does not exist yet.', "Error");
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown + 'The Diocesan Calendar for ' + diocese + ' does not exist yet.');
            }
        },
        success: data => {
            console.log('retrieved diocesan data:');
            console.log(data);
            toastr["success"]("Diocesan Calendar was retrieved successfully", "Success");
            $CALENDAR = data;
            if( data.hasOwnProperty('Overrides') ) {
                if( data.Overrides.hasOwnProperty('Epiphany') ) {
                    $('#diocesanCalendarOverrideEpiphany').val( data.Overrides.Epiphany );
                }
                if( data.Overrides.hasOwnProperty('Ascension') ) {
                    $('#diocesanCalendarOverrideAscension').val( data.Overrides.Ascension );
                }
                if( data.Overrides.hasOwnProperty('CorpusChristi') ) {
                    $('#diocesanCalendarOverrideCorpusChristi').val( data.Overrides.CorpusChristi );
                }
            }
            for (const [key, litevent] of Object.entries(data.LitCal)) {
                let $form;
                let $row;
                let numLastRow;
                let numMissingRows;
                switch (litevent.grade) {
                    case RANK.SOLEMNITY:
                        $form = $('#carouselItemSolemnities form');
                        numLastRow = $form.find('.form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            while (numMissingRows-- > 0) {
                                $form.append($(FormControls.CreateFestivityRow(messages['Other Solemnity'])));
                            }
                        }
                        $row = $('#carouselItemSolemnities form .form-row').eq(litevent.formRowNum);
                        break;
                    case RANK.FEAST:
                        numLastRow = $('#carouselItemFeasts form .form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(1).find('form').append($(FormControls.CreateFestivityRow(messages['Other Feast'])));
                            }
                        }
                        $row = $('#carouselItemFeasts form .form-row').eq(litevent.formRowNum);
                        break;
                    case RANK.MEMORIAL:
                        numLastRow = $('#carouselItemMemorials form .form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(2).find('form').append($(FormControls.CreateFestivityRow(messages['Other Memorial'])));
                            }
                        }
                        $row = $('#carouselItemMemorials form .form-row').eq(litevent.formRowNum);
                        break;
                    case RANK.OPTIONALMEMORIAL:
                        numLastRow = $('#carouselItemOptionalMemorials form .form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(3).find('form').append($(FormControls.CreateFestivityRow(messages['Other Optional Memorial'])));
                            }
                        }
                        $row = $('#carouselItemOptionalMemorials form .form-row').eq(litevent.formRowNum);
                        break;
                }
                $row.find('.litEventName').val(litevent.name).attr('data-valuewas', litevent.name.replace(/[^a-zA-Z]/gi, ''));
                $row.find('.litEventDay').val(litevent.day);
                $row.find('.litEventMonth').val(litevent.month);
                $row.find('.litEventProper').multiselect({
                    buttonWidth: '100%',
                    maxHeight: 200,
                    enableCaseInsensitiveFiltering: true,
                    onChange: (option, checked, select) => {
                        if ($(option).val() != 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                            $(option).parent().multiselect('deselect', 'Proper');
                        } else if ($(option).val() == 'Proper' && checked === true) {
                            $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
                        }
                    }
                }).multiselect('deselectAll', false).multiselect('select', litevent.common.toString().split(','));
                if (typeof litevent.color !== 'string') {
                    litevent.color = litevent.color.join(',');
                }
                $row.find('.litEventColor').multiselect({ buttonWidth: '100%' }).multiselect('deselectAll', false).multiselect('select', litevent.color.toString().split(','));
                $row.find('.litEventFromYear').val(litevent.sinceYear);
            };
            setFocusFirstTabWithData();
        },
        error: (xhr, textStatus, errorThrown) => {
            toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
        }
    });
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
            $row = $(FormControls.CreateFestivityRow(messages['Other Solemnity']));
            $('.carousel-item').first().find('form').append($row);
            break;
        case "addFeast":
            $row = $(FormControls.CreateFestivityRow(messages['Other Feast']));
            $('.carousel-item').eq(1).find('form').append($row);
            break;
        case "addMemorial":
            $row = $(FormControls.CreateFestivityRow(messages['Other Memorial']));
            $('.carousel-item').eq(2).find('form').append($row);
            break;
        case "addOptionalMemorial":
            $row = $(FormControls.CreateFestivityRow(messages['Other Optional Memorial']));
            $('.carousel-item').eq(3).find('form').append($row);
            break;
    }

    $row.find('.litEventProper').multiselect({
        buttonWidth: '100%',
        maxHeight: 200,
        //enableCollapsibleOptGroups: true,
        //collapseOptGroupsByDefault: true,
        enableCaseInsensitiveFiltering: true,
        onChange: (option, checked, select) => {
            if ($(option).val() != 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                $(option).parent().multiselect('deselect', 'Proper');
            } else if ($(option).val() == 'Proper' && checked === true) {
                $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
            }
        }
    });

    $row.find('.litEventColor').multiselect({
        buttonWidth: '100%'
    });
});

$(document).on('click', '.actionPromptButton', ev => {
    let currentUniqid = FormControls.uniqid;
    let $modal = $(ev.currentTarget).closest('.actionPromptModal');
    let $modalForm = $modal.find('form');
    let existingFestivityTag = $modalForm.find('.existingFestivityName').val();
    let title = '';
    FormControls.settings.decreeURLField = true;
    FormControls.settings.decreeLangMapField = $('.regionalNationalCalendarName').attr('id') === 'widerRegionCalendarName';
    switch( ev.currentTarget.id ) {
        case 'designatePatronButton':
            FormControls.settings.tagField = false;
            FormControls.settings.gradeFieldShow = false;
            FormControls.settings.properFieldShow = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            title =  messages[ 'Designate patron' ];
            break;
        case 'setPropertyButton':
            let propertyToChange = $('#propertyToChange').val();
            switch(propertyToChange) {
                case 'name':
                    FormControls.settings.nameField = true;
                    FormControls.settings.gradeFieldShow = false;
                    break;
                case 'grade':
                    FormControls.settings.nameField = false;
                    FormControls.settings.gradeFieldShow = true;
                    FormControls.settings.gradeField = true;
                    break;
            }
            FormControls.settings.tagField = false;
            FormControls.settings.properFieldShow = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            title = messages[ 'Change name or grade' ];
            break;
        case 'moveFestivityButton':
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = false;
            FormControls.settings.gradeFieldShow = false;
            FormControls.settings.properFieldShow = false;
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            title = messages[ 'Move festivity' ];
            break;
        case 'newFestivityFromExistingButton':
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = false;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.properFieldShow = true;
            FormControls.settings.gradeField = false;
            FormControls.settings.properField = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            title = messages[ 'New festivity' ];
            break;
        case 'newFestivityExNovoButton':
            FormControls.settings.tagField = true;
            FormControls.settings.nameField = true;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.properFieldShow = true;
            FormControls.settings.gradeField = true;
            FormControls.settings.properField = true;
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = true;
            title = messages[ 'New festivity' ];
            break;
    }

    if( existingFestivityTag !== '' ) {
        $row = $(FormControls.CreatePatronRow(title, existingFestivityTag ));
    } else {
        $row = $(FormControls.CreatePatronRow(title, null ));
    }
    $('#widerRegionForm').append($row);
    $modal.modal('hide');
    $row.find('.litEventColor').multiselect({
        buttonWidth: '100%'
    }).multiselect('deselectAll', false);

    if(FormControls.settings.colorField === false) {
        $row.find('.litEventColor').multiselect('disable');
    }

    if(FormControls.settings.properFieldShow) {
        $row.find(`#onTheFly${currentUniqid}Proper`).multiselect({
            buttonWidth: '100%'
        }).multiselect('deselectAll', false);
        if(FormControls.settings.properField === false) {
            $row.find(`#onTheFly${currentUniqid}Proper`).multiselect('disable');
        }
    }

    if(FormControls.settings.gradeFieldShow && FormControls.settings.gradeField === false) {
        $row.find(`#onTheFly${currentUniqid}Grade`).prop('disabled', true);
    }

    if( existingFestivityTag !== '' ) {
        litevent = FestivityCollection[existingFestivityTag];

        $row.find(`#onTheFly${currentUniqid}Grade`).val(litevent.GRADE);
        $row.find(`#onTheFly${currentUniqid}Proper`).multiselect('select', litevent.COMMON.split(','))
        $row.find(`.litEventColor`).multiselect('select', litevent.COLOR.split(','));

        if(FormControls.settings.monthField === false) {
            $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${litevent.MONTH}])`).prop('disabled',true);
        }
    }
});

$(document).on('change', '.regionalNationalCalendarName', ev => {
    const key = $(ev.currentTarget).val();
    const category = $(ev.currentTarget).data('category');
    console.log('category: ' + category);
    jQuery.ajax({
        url: NationalDataURL,
        method: 'GET',
        dataType: 'json',
        data: { "key" : key, "category": category, "locale": LOCALE },
        statusCode: {
            404: (xhr, textStatus, errorThrown) => {
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />The Data File for the ' + category + ' ' + key + ' does not exist yet.', "Error");
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown + 'The Data File for the ' + category + ' ' + key + ' does not exist yet.');
            }
        },
        success: data => {
            console.log( `successfully retrieved the data file for the ${category} ${key}` );
            console.log(data);
            switch(category) {
                case 'widerRegionCalendar':
                    $('#widerRegionIsMultilingual').prop('checked', data.isMultilingual);
                    FormControls.settings.decreeURLField = true;
                    FormControls.settings.decreeLangMapField = true;
                    break;
                case 'nationalCalendar':
                    FormControls.settings.decreeURLField = true;
                    FormControls.settings.decreeLangMapField = false;
            }
            data.LitCal.forEach((el) => {
                let currentUniqid = FormControls.uniqid;
                let title;
                switch(el.Metadata.action) {
                    case 'makePatron':
                        FormControls.settings.tagField = false;
                        FormControls.settings.gradeFieldShow = false;
                        FormControls.settings.properFieldShow = false;
                        FormControls.settings.dayField = false;
                        FormControls.settings.monthField = false;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        title =  messages[ 'Designate patron' ];
                        break;
                    case 'setProperty':
                        let propertyToChange = $('#propertyToChange').val();
                        switch(propertyToChange) {
                            case 'name':
                                FormControls.settings.nameField = true;
                                FormControls.settings.gradeFieldShow = false;
                                break;
                            case 'grade':
                                FormControls.settings.nameField = false;
                                FormControls.settings.gradeFieldShow = true;
                                FormControls.settings.gradeField = true;
                                break;
                        }
                        FormControls.settings.tagField = false;
                        FormControls.settings.properFieldShow = false;
                        FormControls.settings.dayField = false;
                        FormControls.settings.monthField = false;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        title = messages[ 'Change name or grade' ];
                        break;
                    case 'moveFestivity':
                        FormControls.settings.tagField = false;
                        FormControls.settings.nameField = false;
                        FormControls.settings.gradeFieldShow = false;
                        FormControls.settings.properFieldShow = false;
                        FormControls.settings.dayField = true;
                        FormControls.settings.monthField = true;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        title = messages[ 'Move festivity' ];
                        break;
                    case 'createNew':
                        FormControls.settings.tagField = false;
                        FormControls.settings.nameField = false;
                        FormControls.settings.gradeFieldShow = true;
                        FormControls.settings.properFieldShow = true;
                        FormControls.settings.gradeField = false;
                        FormControls.settings.properField = false;
                        FormControls.settings.dayField = false;
                        FormControls.settings.monthField = false;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        title = messages[ 'New festivity' ];
                        break;
                    }

                    $row = $(FormControls.CreatePatronRow(title, el ));
                    $('.regionalNationalDataForm').append($row);
                    $row.find('.litEventColor').multiselect({
                        buttonWidth: '100%'
                    }).multiselect('deselectAll', false);

                    $row.find(`.litEventColor`).multiselect('select', el.Festivity.color.split(','));
                    if(FormControls.settings.colorField === false) {
                        $row.find('.litEventColor').multiselect('disable');
                    }

                    if(FormControls.settings.properFieldShow) {
                        $row.find(`#onTheFly${currentUniqid}Proper`).multiselect({
                            buttonWidth: '100%'
                        }).multiselect('deselectAll', false).multiselect('select', el.Festivity.common.split(','))
                        if(FormControls.settings.properField === false) {
                            $row.find(`#onTheFly${currentUniqid}Proper`).multiselect('disable');
                        }
                    }

                    if(FormControls.settings.gradeFieldShow) {
                        $row.find(`#onTheFly${currentUniqid}Grade`).val(el.Festivity.grade);
                        if(FormControls.settings.gradeField === false) {
                            $row.find(`#onTheFly${currentUniqid}Grade`).prop('disabled', true);
                        }
                    }

                    if(FormControls.settings.monthField === false) {
                        $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${el.Festivity.month}])`).prop('disabled',true);
                    }

            });
        },
        error: (xhr, textStatus, errorThrown) => {
            toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
        }
    });
});

let removeDiocesanCalendarModal = diocese => {
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
        <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-backspace mr-2">Cancel</button>
        <button type="button" id="deleteDiocesanCalendarButton" class="btn btn-danger"><i class="far fa-trash-alt mr-2"></i>Delete calendar</button>
      </div>
    </div>
  </div>
</div>`;
};

$(document).on('change', '#diocesanCalendarDioceseName', ev => {
    $CALENDAR = { LitCal: {} };
    $('.carousel-item form').each((idx, el) => {
        el.reset();
        $(el).find('.form-row').slice(3).remove();
        $(el).find('h4').slice(3).remove();
        $(el).find('.litEventProper').multiselect('deselectAll', false).multiselect('select', 'Proper');
        $(el).find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
        $(el).find('.litEventName').attr('data-valuewas', '');
    });
    $('form').each((idx, el) => { $(el).removeClass('was-validated') });
    //first we'll enforce only values from the current datalist
    if ($('#DiocesesList').find('option[value="' + $(ev.currentTarget).val() + '"]').length > 0) {
        $(ev.currentTarget).removeClass('is-invalid');
        $key = $('#DiocesesList').find('option[value="' + $(ev.currentTarget).val() + '"]').attr('data-value').toUpperCase();
        console.log('selected diocese with key = ' + $key);
        if ($index.DiocesanCalendars.hasOwnProperty($key)) {
            $('#retrieveExistingDiocesanData').prop('disabled', false);
            $('#removeExistingDiocesanData').prop('disabled', false);
            $('body').append(removeDiocesanCalendarModal($(ev.currentTarget).val()));
            if($index.DiocesanCalendars[$key].hasOwnProperty('group')){
                $('#diocesanCalendarGroup').val($index.DiocesanCalendars[$key].group);
            }
            console.log('we have an existing entry for this diocese!');
        } else {
            $('#retrieveExistingDiocesanData').prop('disabled', true);
            $('#removeExistingDiocesanData').prop('disabled', true);
            $('body').find('#removeDiocesanCalendarPrompt').remove();
            console.log('no existing entry for this diocese');
        }
    } else {
        $(ev.currentTarget).addClass('is-invalid');
    }
});

$(document).on('change', '.existingFestivityName', ev => {
    $modal = $(ev.currentTarget).closest('.actionPromptModal');
    $form = $modal.find('form');
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
    let deleteKey = { calendar: $key, diocese: $diocese, nation: $nation};
    $.ajax({
        url: DiocesanDataURL,
        method: 'delete',
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
            console.log('data returned from delete action: ');
            console.log(data);
            toastr["success"]("Diocesan Calendar was deleted successfully", "Success");
        },
        error: (xhr, textStatus, errorThrown) => {
            console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown);
            toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
        }
    });
});


$(document).on('change', '#diocesanCalendarNationalDependency', ev => {
    $('#diocesanCalendarDioceseName').val('');
    $('#retrieveExistingDiocesanData').prop('disabled', true);
    $('#removeExistingDiocesanData').prop('disabled', true);
    $('body').find('#removeDiocesanCalendarPrompt').remove();
    switch ($(ev.currentTarget).val()) {
        case "ITALY":
            $('#DiocesesList').empty();
            ITALYDiocesesArr.forEach(diocese => $('#DiocesesList').append('<option data-value="' + diocese.replace(/[^a-zA-Z]/gi, '').toUpperCase() + '" value="' + diocese + '">'));
            break;
        case "USA":
            $('#DiocesesList').empty();
            USDiocesesArr.forEach(diocese => $('#DiocesesList').append('<option data-value="' + diocese.replace(/[^a-zA-Z]/gi, '').toUpperCase() + '" value="' + diocese + '">'));
            break;
        default:
            $('#DiocesesList').empty();
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
        $('#diocesanCalendarDefinitionCardLinks li').find('[data-slide-to=' + event.to + ']').parent('li').addClass('active');
    });

    $('.litEventProper').multiselect({
        buttonWidth: '100%',
        maxHeight: 200,
        //enableCollapsibleOptGroups: true,
        //collapseOptGroupsByDefault: true,
        enableCaseInsensitiveFiltering: true,
        onChange: (option, checked, select) => {
            if ($(option).val() != 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                $(option).parent().multiselect('deselect', 'Proper');
            } else if ($(option).val() == 'Proper' && checked === true) {
                $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
            }
        }
    });

    $('.litEventColor').multiselect({
        buttonWidth: '100%'
    });

});
