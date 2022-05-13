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

class RowAction {
    static MakePatron       = Symbol('makePatron');
    static SetProperty      = Symbol('setProperty');
    static MoveFestivity    = Symbol('moveFestivity');
    static CreateNew        = Symbol('createNew');
    constructor(name) {
        this.name = name;
    }
}

const isStaging = location.hostname.includes( '-staging' );
const endpointV = isStaging ? 'dev' : 'v3';
const MetaDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/LitCalMetadata.php`;
const RegionalDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/LitCalRegionalData.php`;

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

const READINGS_PROPERTIES = [
    "FIRST_READING",
    "RESPONSORIAL_PSALM",
    "SECOND_READING",
    "ALLELUIA_VERSE",
    "GOSPEL"
];

const integerVals = [ 'day', 'month', 'grade', 'sinceYear', 'untilYear' ];
const expectedJSONProperties = {
    'makePatron': [ 'tag', 'name', 'color', 'grade', 'day', 'month' ],
    'setProperty': [ 'tag', 'name', 'grade', 'day', 'month' ],
    'moveFestivity': [ 'tag', 'name', 'day', 'month', 'missal', 'reason' ],
    'createNew': [ 'tag', 'name', 'color', 'grade', 'day', 'month', 'strtotime', 'common', 'readings' ]
};
const metadataProps = [ 'missal', 'reason' ];

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
        <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="fas fa-backspace mr-2">Cancel</button>
        <button type="button" id="deleteDiocesanCalendarButton" class="btn btn-danger"><i class="far fa-trash-alt mr-2"></i>Delete calendar</button>
      </div>
    </div>
  </div>
</div>`;
};

class FormControls {
    static uniqid = 0;
    static settings = {
        nameField: true,
        dayField: true,
        monthField: true,
        colorField: true,
        gradeField: false,
        commonField: false,
        gradeFieldShow: false,
        commonFieldShow: false,
        fromYearField: true,
        untilYearField: false,
        tagField: false,
        decreeURLField: false,
        decreeLangMapField: false,
        reasonField: false,
        missalField: false
    }
    static action = null;
    static title = null;

    static CreateFestivityRow() {
        let formRow = '';

        if (FormControls.title !== null) {
            formRow += `<div class="d-flex justify-content-left"><h4 class="data-group-title">${FormControls.title}</h4></div>`;
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

        if (FormControls.settings.commonField) {
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
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventFromYear" id="onTheFly${FormControls.uniqid}FromYear" value="1970" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }

    static CreatePatronRow(element = null) {
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
                festivity = {
                    ...element.Festivity,
                    ...element.Metadata
                };
                if( festivity.hasOwnProperty( 'untilYear' ) === false ) {
                    festivity.untilYear = '';
                }
                if( festivity.hasOwnProperty( 'color' ) === false ) {
                    festivity.color = FestivityCollection.hasOwnProperty(festivity.tag) ? FestivityCollection[festivity.tag].COLOR : [];
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            formRow += `<div class="d-flex justify-content-left"><h4 class="data-group-title">${FormControls.title}</h4>`;
            if(FormControls.action.description === RowAction.CreateNew.description) {
                if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
                    formRow += `<button type="button" class="ml-auto btn btn-info strtotime-toggle-btn active" data-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="true" autocomplete="off"><i class="fas fa-comment mr-2"></i>explicatory date</button>`;
                } else {
                    formRow += `<button type="button" class="ml-auto btn btn-info strtotime-toggle-btn" data-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="false" autocomplete="off"><i class="fas fa-comment-slash mr-2"></i>explicatory date</button>`;
                }
            }
            formRow += `</div>`;
        }

        formRow += `<div class="form-row">`;

        formRow += `<div class="form-group col-sm-6">`;
        if(FormControls.settings.tagField === false){
            formRow += `<input type="hidden" class="litEventTag" id="onTheFly${FormControls.uniqid}Tag" value="${festivity !== null ? festivity.tag : ''}" />`;
        }
        formRow += `<label for="onTheFly${FormControls.uniqid}Name">${messages[ "Name" ]}</label>
        <input type="text" class="form-control litEvent litEventName${festivity !== null && typeof festivity.name==='undefined' ? ` is-invalid` : ``}" id="onTheFly${FormControls.uniqid}Name" value="${festivity !== null ? festivity.name : ''}"${FormControls.settings.nameField === false ? ' readonly' : ''} />
        <div class="invalid-feedback">There is no locale data for this celebration in the current locale. Perhaps try a different locale?.</div>
        </div>`;

        if (FormControls.settings.fromYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}FromYear">${messages[ "Since" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventFromYear" id="onTheFly${FormControls.uniqid}FromYear" value="${festivity !== null ? festivity.sinceYear : ''}" />
            </div>`;
        }

        if (FormControls.settings.untilYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}UntilYear">${messages[ "Until" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventUntilYear" id="onTheFly${FormControls.uniqid}UntilYear" value="${festivity !== null ? festivity.untilYear : ''}" />
            </div>`;
        }

        let selectedColors = festivity !== null ? (Array.isArray(festivity.color) ? festivity.color : festivity.color.split(',')) : [];
        formRow += `<div class="form-group col-sm-2">
        <label for="onTheFly${FormControls.uniqid}Color">${messages[ "Liturgical color" ]}</label>
        <select class="form-control litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple"${FormControls.settings.colorField === false ? ' readonly' : ''} />
        <option value="white"${festivity !== null && selectedColors.includes("white") ? ' selected' : '' }>${messages[ "white" ].toUpperCase()}</option>
        <option value="red"${festivity !== null && selectedColors.includes("red") ? ' selected' : '' }>${messages[ "red" ].toUpperCase()}</option>
        <option value="purple"${festivity !== null && selectedColors.includes("purple") ? ' selected' : '' }>${messages[ "purple" ].toUpperCase()}</option>
        <option value="green"${festivity !== null && selectedColors.includes("green") ? ' selected' : '' }>${messages[ "green" ].toUpperCase()}</option>
        </select>
        </div>`;

        if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}StrToTime">Explicatory date</label>
            <input type="text" value="${festivity.strtotime}" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}StrToTime" />
            </div>`;
        } else {
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
        }

        if (FormControls.settings.tagField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Tag">${messages[ "Tag" ]}</label>
            <input type="text" value="${festivity !== null ? festivity.tag : ''}" class="form-control litEvent litEventTag" id="onTheFly${FormControls.uniqid}Tag" />
            </div>`;
        }
        
        if (FormControls.settings.gradeFieldShow) {
            formRow +=  messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:4});
        }

        if (FormControls.settings.commonFieldShow) {
            formRow += messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:6});
        }

        if (FormControls.settings.readingsField) {
            formRow += `<div class="col-sm-6"><table>`;
            formRow += READINGS_PROPERTIES.map((prop,idx) => `<tr><td><label for="onTheFly${FormControls.uniqid}Readings_${prop}">${prop}</label></td><td style="padding-left: 15px;"><input type="text" class="form-control litEvent litEventReadings litEventReadings_${prop}" id="onTheFly${FormControls.uniqid}Readings_${prop}" ${festivity === null || typeof festivity.common === 'undefined' || festivity.common !== 'Proper' ? `disabled` : ``} value="${festivity && festivity?.common === 'Proper' ? festivity.readings[prop] : ''}" /></td>${idx===0 ? `<td rowspan="5" style="vertical-align: top;"><i class="fas fa-info-circle m-2" style="color: #4e73df;" title="When the festivity has its own Proper, then Readings can be defined, otherwise the readings will depend on the Common"></i>` : ``}</td></tr>`).join('');
            formRow += `</table></div>`;
        }

        if (FormControls.settings.reasonField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Reason">${messages[ "Reason" ]}</label>
            <input type="text" value="${festivity?.reason||''}" class="form-control litEvent litEventReason" id="onTheFly${FormControls.uniqid}Reason" />
            </div>`;
        }

        if (FormControls.settings.missalField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Missal">${messages[ "Missal" ]}</label>
            <select class="form-control litEvent litEventMissal" id="onTheFly${FormControls.uniqid}Missal">`;
            //console.log(Object.values( $index.RomanMissals ).map(({value,name}) => `<option class="list-group-item" value="${value}">${name}</option>`));
            formRow += Object.values( $index.RomanMissals ).map(({value,name}) => `<option class="list-group-item" value="${value}">${name}</option>`).join('');
            formRow += `</select>
            </div>`;
        }

        if(FormControls.settings.decreeURLField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${messages[ "Decree URL" ]}<i class="ml-2 fas fa-info-circle" title="Use %s in place of the language code if using a language mapping"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.decreeURL !== 'undefined' ? festivity.decreeURL : ''}" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapField) {
            let decreeLangs = festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? Object.keys(festivity.decreeLangs).map(key => key+'='+festivity.decreeLangs[key] ) : null;
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${messages[ "Decree Langs" ]}<i class="ml-2 fas fa-info-circle" title="Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? decreeLangs.join(',') : ''}" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }

}

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
            toastr["warning"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />' + xhr.responseText, "Warning");
        }
    },
    success: data => {
        console.log('retrieved data from index file:');
        console.log(data);
        $index = data.LitCalMetadata;
        let publishedRomanMissalsStr = Object.values( $index.RomanMissals ).map(({value,name}) => !value.startsWith('VATICAN_') ? `<option class="list-group-item" value="${value}">${name}</option>` : null).join('')
        $('#languageEditionRomanMissalList').append(publishedRomanMissalsStr);
        toastr["success"]('Successfully retrieved data from index file', "Success");
    }
});

$(document).on('click', '.strtotime-toggle-btn', ev => {
    let uniqid = $(ev.currentTarget).attr('data-row-uniqid');
    if( $(ev.currentTarget).attr('aria-pressed') === 'true' ) {
        $(ev.currentTarget).find('i').removeClass('fa-comment-slash').addClass('fa-comment');
        $(`#onTheFly${uniqid}Month`).closest('.form-group').remove();
        let $dayFormGroup = $(`#onTheFly${uniqid}Day`).closest('.form-group');
        $dayFormGroup.empty().removeClass('col-sm-1').addClass('col-sm-2').append(`<label for="onTheFly${uniqid}StrToTime">Explicatory date</label><input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime" />`);
    } else {
        $(ev.currentTarget).find('i').removeClass('fa-comment').addClass('fa-comment-slash');
        let $strToTimeFormGroup = $(`#onTheFly${uniqid}StrToTime`).closest('.form-group');
        $strToTimeFormGroup.empty().removeClass('col-sm-2').addClass('col-sm-1').append(`<label for="onTheFly${uniqid}Day">Day</label><input type="number" min="1" max="31" value="false" class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`);
        let formRow = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${messages[ "Month" ]}</label>
        <select class="form-control litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
        let formatter = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
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
        $('.carousel').carousel(parseInt($(ev.currentTarget).attr('data-slide-to')));
    }
});

$(document).on('change', '.litEvent', ev => {
    $row = $(ev.currentTarget).closest('.form-row');
    $card = $(ev.currentTarget).closest('.card-body');
    if ($(ev.currentTarget).hasClass('litEventName')) {
        //console.log('LitEvent name has changed');
        if ($(ev.currentTarget).val() == '') {
            //empty value probably means we are trying to delete an already defined event
            //so let's find the key and remove it
            oldEventKey = $(ev.currentTarget).attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(oldEventKey)) {
                delete $CALENDAR.LitCal[oldEventKey];
            }
        } else {
            eventKey = $(ev.currentTarget).val().replace(/[^a-zA-Z]/gi, '');
            //console.log('new LitEvent name identifier is ' + eventKey);
            if ($(ev.currentTarget).attr('data-valuewas') == '' && $CALENDAR.LitCal.hasOwnProperty(eventKey) === false) {
                //console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                $CALENDAR.LitCal[eventKey] = new litEvent();
                $CALENDAR.LitCal[eventKey].name = $(ev.currentTarget).val();
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                $CALENDAR.LitCal[eventKey].day = parseInt($row.find('.litEventDay').val());
                $CALENDAR.LitCal[eventKey].month = parseInt($row.find('.litEventMonth').val());
                $CALENDAR.LitCal[eventKey].color = $row.find('.litEventColor').val();
                $CALENDAR.LitCal[eventKey].common = $row.find('.litEventCommon').val();
                $CALENDAR.LitCal[eventKey].sinceYear = parseInt($row.find('.litEventFromYear').val());
                $CALENDAR.LitCal[eventKey].formRowNum = $card.find('.form-row').index($row);
                $(ev.currentTarget).attr('data-valuewas', eventKey);
                $(ev.currentTarget).removeClass('is-invalid');
            } else if ($(ev.currentTarget).attr('data-valuewas') != '') {
                oldEventKey = $(ev.currentTarget).attr('data-valuewas');
                //console.log('the preceding value here was ' + oldEventKey);
                if ($CALENDAR.LitCal.hasOwnProperty(oldEventKey)) {
                    if (oldEventKey !== eventKey) {
                        //console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
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
                        $CALENDAR.LitCal[eventKey].color = [ 'red' ];
                    } else {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                        $CALENDAR.LitCal[eventKey].color = [ 'white' ];
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
    } else if ($(ev.currentTarget).hasClass('litEventCommon')) {
        if ($row.find('.litEventName').val() !== "") {
            eventKey = $row.find('.litEventName').val().replace(/[^a-zA-Z]/gi, '');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].common = $(ev.currentTarget).val();
                let eventColors = [];
                if ($CALENDAR.LitCal[eventKey].common.includes('Martyrs')) {
                    eventColors.push('red');
                }
                if ($CALENDAR.LitCal[eventKey].common.match(/(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/) !== null) {
                    eventColors.push('white');
                }
                $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', eventColors);
                $CALENDAR.LitCal[eventKey].color = eventColors;
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
                $CALENDAR.LitCal[eventKey].sinceYear = parseInt($(ev.currentTarget).val());
            }
        }
    }
});

$(document).on('click', '#saveDiocesanCalendar_btn', ev => {
    $data = JSON.stringify($CALENDAR);
    $nation = $('#diocesanCalendarNationalDependency').val();
    $diocese = $('#diocesanCalendarDioceseName').val();
    //console.log('save button was clicked for NATION = ' + $nation + ', DIOCESE = ' + $diocese);
    let saveObj = { LitCal: $data, Diocese: $diocese, Nation: $nation, category: 'diocesanCalendar' };
    if($('#diocesanCalendarGroup').val() != ''){
        saveObj.group = $('#diocesanCalendarGroup').val();
    }
    if( diocesanOvveridesDefined() ) {
        //console.log( 'This diocesan calendar has defined some options that will override the national calendar.' );
        saveObj.Overrides = {};
        if( $('#diocesanCalendarOverrideEpiphany').val() !== "" ) {
            saveObj.Overrides.Epiphany = $('#diocesanCalendarOverrideEpiphany').val();
            //console.log( 'Epiphany in this diocese will override Epiphany in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideAscension').val() !== "" ) {
            saveObj.Overrides.Ascension = $('#diocesanCalendarOverrideAscension').val();
            //console.log( 'Ascension in this diocese will override Ascension in the national calendar.' );
        }
        if( $('#diocesanCalendarOverrideCorpusChristi').val() !== "" ) {
            saveObj.Overrides.CorpusChristi = $('#diocesanCalendarOverrideCorpusChristi').val();
            //console.log( 'Corpus Christi in this diocese will override Corpus Christi in the national calendar.' );
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
            url: RegionalDataURL,
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

$(document).on('click', '#retrieveExistingDiocesanData', evt => {
    evt.preventDefault();
    let diocese = $('#diocesanCalendarDioceseName').val();
    let dioceseKey = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value').toUpperCase();
    //let $diocesanCalendar;
    jQuery.ajax({
        url: RegionalDataURL,
        method: 'GET',
        dataType: 'json',
        data: { "key" : dioceseKey, "category": "diocesanCalendar" },
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
                            FormControls.title = messages['Other Solemnity'];
                            while (numMissingRows-- > 0) {
                                $form.append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemSolemnities form .form-row').eq(litevent.formRowNum);
                        break;
                    case RANK.FEAST:
                        numLastRow = $('#carouselItemFeasts form .form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            FormControls.title = messages['Other Feast'];
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(1).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemFeasts form .form-row').eq(litevent.formRowNum);
                        break;
                    case RANK.MEMORIAL:
                        numLastRow = $('#carouselItemMemorials form .form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            FormControls.title = messages['Other Memorial'];
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(2).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemMemorials form .form-row').eq(litevent.formRowNum);
                        break;
                    case RANK.OPTIONALMEMORIAL:
                        numLastRow = $('#carouselItemOptionalMemorials form .form-row').length - 1;
                        if (litevent.formRowNum > numLastRow) {
                            numMissingRows = litevent.formRowNum - numLastRow;
                            FormControls.title = messages['Other Optional Memorial'];
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(3).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemOptionalMemorials form .form-row').eq(litevent.formRowNum);
                        break;
                }
                $row.find('.litEventName').val(litevent.name).attr('data-valuewas', litevent.name.replace(/[^a-zA-Z]/gi, ''));
                $row.find('.litEventDay').val(litevent.day);
                $row.find('.litEventMonth').val(litevent.month);
                $row.find('.litEventCommon').multiselect({
                    buttonWidth: '100%',
                    maxHeight: 200,
                    enableCaseInsensitiveFiltering: true,
                    onChange: (option, checked, select) => {
                        if ($(option).val() !== 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                            $(option).parent().multiselect('deselect', 'Proper');
                            $row = $(option).closest('.form-row');
                            if( $row.find('.litEventReadings').length ) {
                                $row.find('.litEventReadings').prop('disabled',true);
                            }
                        } else if ($(option).val() === 'Proper' && checked === true) {
                            $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
                            $row = $(option).closest('.form-row');
                            if( $row.find('.litEventReadings').length ) {
                                $row.find('.litEventReadings').prop('disabled',false);
                            }
                        }
                    }
                }).multiselect('deselectAll', false).multiselect('select', litevent.common);
                $row.find('.litEventColor').multiselect({ buttonWidth: '100%' }).multiselect('deselectAll', false).multiselect('select', litevent.color);
                $row.find('.litEventFromYear').val(litevent.sinceYear);
            };
            setFocusFirstTabWithData();
        },
        error: (xhr, textStatus, errorThrown) => {
            if( xhr.status !== 404 ) { //we have already handled 404 Not Found above
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown, "Error");
            }
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

    $row.find('.litEventCommon').multiselect({
        buttonWidth: '100%',
        maxHeight: 200,
        //enableCollapsibleOptGroups: true,
        //collapseOptGroupsByDefault: true,
        enableCaseInsensitiveFiltering: true,
        onChange: (option, checked, select) => {
            if ($(option).val() !== 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                $(option).parent().multiselect('deselect', 'Proper');
                $row = $(option).closest('.form-row');
                if( $row.find('.litEventReadings').length ) {
                    $row.find('.litEventReadings').prop('disabled',true);
                }
            } else if ($(option).val() === 'Proper' && checked === true) {
                $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
                $row = $(option).closest('.form-row');
                if( $row.find('.litEventReadings').length ) {
                    $row.find('.litEventReadings').prop('disabled',false);
                }
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
    let propertyToChange;
    //let buttonId = ev.currentTarget.id;
    //console.log(buttonId + ' button was clicked');
    FormControls.settings.decreeURLField = true;
    FormControls.settings.decreeLangMapField = $('.regionalNationalCalendarName').attr('id') === 'widerRegionCalendarName';
    switch( ev.currentTarget.id ) {
        case 'designatePatronButton':
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = true;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.gradeField = true;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.missalField = false;
            FormControls.settings.readingsField = false;
            FormControls.settings.reasonField = false;
            FormControls.title =  messages[ 'Designate patron' ];
            FormControls.action = RowAction.MakePatron;
            break;
        case 'setPropertyButton':
            FormControls.settings.tagField = false;
            propertyToChange = $('#propertyToChange').val();
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
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.missalField = false;
            FormControls.settings.readingsField = false;
            FormControls.settings.reasonField = false;
            FormControls.title = messages[ 'Change name or grade' ];
            FormControls.action = RowAction.SetProperty;
            break;
        case 'moveFestivityButton':
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = false;
            FormControls.settings.gradeFieldShow = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.missalField = true;
            FormControls.settings.readingsField = false;
            FormControls.settings.reasonField = true;
            FormControls.title = messages[ 'Move festivity' ];
            FormControls.action = RowAction.MoveFestivity;
            break;
        case 'newFestivityFromExistingButton':
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = false;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.commonFieldShow = true;
            FormControls.settings.gradeField = false;
            FormControls.settings.commonField = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.missalField = false;
            FormControls.settings.readingsField = true;
            FormControls.settings.reasonField = false;
            FormControls.title = messages[ 'New festivity' ];
            FormControls.action = RowAction.CreateNew;
            break;
        case 'newFestivityExNovoButton':
            FormControls.settings.tagField = true;
            FormControls.settings.nameField = true;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.commonFieldShow = true;
            FormControls.settings.gradeField = true;
            FormControls.settings.commonField = true;
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = true;
            FormControls.settings.missalField = false;
            FormControls.settings.readingsField = true;
            FormControls.settings.reasonField = false;
            FormControls.title = messages[ 'New festivity' ];
            FormControls.action = RowAction.CreateNew;
            break;
    }

    if( existingFestivityTag !== '' ) {
        $row = $(FormControls.CreatePatronRow( existingFestivityTag ));
        if( FormControls.settings.missalField ) {
            const { MISSAL } = FestivityCollection[existingFestivityTag];
            $row.find(`#onTheFly${currentUniqid}Missal`).val(MISSAL); //.prop('disabled', true);
        }
    } else {
        $row = $(FormControls.CreatePatronRow());
    }
    $('.regionalNationalDataForm').append($row);
    $modal.modal('hide');
    $row.find('.form-group').closest('.form-row').data('action', FormControls.action.description).attr('data-action', FormControls.action.description);
    if( FormControls.action.description === RowAction.SetProperty.description ) {
        console.log('propertyToChange is of type ' + typeof propertyToChange + ' and has a value of ' + propertyToChange);
        $row.find('.form-group').closest('.form-row').data('prop', propertyToChange).attr('data-prop', propertyToChange);
    }
    $row.find('.litEventColor').multiselect({
        buttonWidth: '100%'
    }).multiselect('deselectAll', false);

    if(FormControls.settings.colorField === false) {
        $row.find('.litEventColor').multiselect('disable');
    }

    if(FormControls.settings.commonFieldShow) {
        $row.find(`#onTheFly${currentUniqid}Common`).multiselect({
            buttonWidth: '100%',
            maxHeight: 200,
            enableCaseInsensitiveFiltering: true,
            onChange: (option, checked, select) => {
                if ($(option).val() !== 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                    $(option).parent().multiselect('deselect', 'Proper');
                    $row = $(option).closest('.form-row');
                    if( $row.find('.litEventReadings').length ) {
                        $row.find('.litEventReadings').prop('disabled',true);
                    }
                } else if ($(option).val() === 'Proper' && checked === true) {
                    $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
                    $row = $(option).closest('.form-row');
                    if( $row.find('.litEventReadings').length ) {
                        $row.find('.litEventReadings').prop('disabled',false);
                    }
                }
            }
        }).multiselect('deselectAll', false);
        if(FormControls.settings.commonField === false) {
            $row.find(`#onTheFly${currentUniqid}Common`).multiselect('disable');
        }
    }

    if(FormControls.settings.gradeFieldShow && FormControls.settings.gradeField === false) {
        $row.find(`#onTheFly${currentUniqid}Grade`).prop('disabled', true);
    }

    if( existingFestivityTag !== '' ) {
        litevent = FestivityCollection[existingFestivityTag];

        $row.find(`#onTheFly${currentUniqid}Grade`).val(litevent.GRADE);
        $row.find(`#onTheFly${currentUniqid}Common`).multiselect('select', litevent.COMMON)
        let colorVal = Array.isArray( litevent.COLOR ) ? litevent.COLOR : litevent.COLOR.split(',');
        $row.find(`.litEventColor`).multiselect('select', colorVal);

        if(FormControls.settings.monthField === false) {
            $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${litevent.MONTH}])`).prop('disabled',true);
        }
    }

    if( $('.serializeRegionalNationalData').prop('disabled') ) {
        $('.serializeRegionalNationalData').prop('disabled', false);
    }

});

$(document).on('change', '.regionalNationalCalendarName', ev => {
    const category = $(ev.currentTarget).data('category');
    const key = ( category === 'widerRegionCalendar' ? $(ev.currentTarget).val() : ($(ev.currentTarget).val().toUpperCase() === 'UNITED STATES' ? 'USA' : $(ev.currentTarget).val().toUpperCase()) );
    //console.log('category: ' + category + ', key = ' + key);
    jQuery.ajax({
        url: RegionalDataURL,
        method: 'GET',
        dataType: 'json',
        data: { "key" : key, "category": category, "locale": LOCALE },
        statusCode: {
            404: (xhr, textStatus, errorThrown) => {
                toastr["warning"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<br />The Data File for the ' + category + ' ' + key + ' does not exist yet. Not that it\'s a big deal, just go ahead and create it now!', "Warning");
                console.log(xhr.status + ' ' + textStatus + ': ' + errorThrown + 'The Data File for the ' + category + ' ' + key + ' does not exist yet (just saying, not that it is really a big deal. Just go ahead and create it now!)');
                switch(category) {
                    case 'widerRegionCalendar':
                        $('#widerRegionIsMultilingual').prop('checked', false);
                        $('#widerRegionLanguages').multiselect('deselectAll', false);
                        break;
                    case 'nationalCalendar':
                        $('form#nationalCalendarSettingsForm')[0].reset();
                        $('#publishedRomanMissalList').empty();
                        break;
                }
                $('form.regionalNationalDataForm').empty();
            }
        },
        success: data => {
            console.log( `successfully retrieved the data file for the ${category} ${key}` );
            console.log(data);
            switch(category) {
                case 'widerRegionCalendar':
                    $('#widerRegionIsMultilingual').prop('checked', data.Metadata.IsMultilingual);
                    FormControls.settings.decreeURLField = true;
                    FormControls.settings.decreeLangMapField = true;
                    $('#widerRegionLanguages').multiselect('deselectAll', false).multiselect('select', data.Metadata.Languages);
                    break;
                case 'nationalCalendar':
                    FormControls.settings.decreeURLField = true;
                    FormControls.settings.decreeLangMapField = false;
                    const { Settings, Metadata } = data;
                    $('#nationalCalendarSettingEpiphany').val( Settings.Epiphany );
                    $('#nationalCalendarSettingAscension').val( Settings.Ascension );
                    $('#nationalCalendarSettingCorpusChristi').val( Settings.CorpusChristi );
                    $('#nationalCalendarSettingLocale').val( Settings.Locale.toLowerCase() );
                    $('#publishedRomanMissalList').empty().append( '<li class="list-group-item">' + Metadata.Missals.join('</li><li class="list-group-item">') + '</li>' );
                    $('#associatedWiderRegion').val( Metadata.WiderRegion.name );
            }
            $('.regionalNationalDataForm').empty();
            data.LitCal.forEach((el) => {
                let currentUniqid = FormControls.uniqid;
                let existingFestivityTag = el.Festivity.hasOwnProperty( 'tag' ) ? el.Festivity.tag : null;
                switch(el.Metadata.action) {
                    case RowAction.MakePatron.description:
                        FormControls.action = RowAction.MakePatron;
                        FormControls.settings.tagField = false;
                        FormControls.settings.nameField = true;
                        FormControls.settings.gradeFieldShow = true;
                        FormControls.settings.gradeField = true;
                        FormControls.settings.commonFieldShow = false;
                        FormControls.settings.dayField = false;
                        FormControls.settings.monthField = false;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        FormControls.settings.missalField = false;
                        FormControls.settings.readingsField = false;
                        FormControls.settings.reasonField = false;
                        FormControls.title =  messages[ 'Designate patron' ];
                        break;
                    case RowAction.SetProperty.description:
                        FormControls.action = RowAction.SetProperty;
                        FormControls.settings.tagField = false;
                        switch(el.Metadata.property) {
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
                        FormControls.settings.commonFieldShow = false;
                        FormControls.settings.dayField = false;
                        FormControls.settings.monthField = false;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        FormControls.settings.missalField = false;
                        FormControls.settings.readingsField = false;
                        FormControls.settings.reasonField = false;
                        FormControls.title = messages[ 'Change name or grade' ];
                        break;
                    case RowAction.MoveFestivity.description:
                        FormControls.action = RowAction.MoveFestivity;
                        FormControls.settings.tagField = false;
                        FormControls.settings.nameField = false;
                        FormControls.settings.gradeFieldShow = false;
                        FormControls.settings.commonFieldShow = false;
                        FormControls.settings.dayField = true;
                        FormControls.settings.monthField = true;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = false;
                        FormControls.settings.missalField = true;
                        FormControls.settings.readingsField = false;
                        FormControls.settings.reasonField = true;
                        FormControls.title = messages[ 'Move festivity' ];
                        break;
                    case RowAction.CreateNew.description:
                        FormControls.action = RowAction.CreateNew;
                        FormControls.settings.tagField = FestivityCollection.hasOwnProperty( existingFestivityTag ) ? false : true;
                        FormControls.settings.nameField = FestivityCollection.hasOwnProperty( existingFestivityTag ) ? false : true;
                        FormControls.settings.gradeFieldShow = true;
                        FormControls.settings.commonFieldShow = true;
                        FormControls.settings.gradeField = FestivityCollection.hasOwnProperty( existingFestivityTag ) ? false : true;
                        FormControls.settings.commonField = FestivityCollection.hasOwnProperty( existingFestivityTag ) ? false : true;
                        FormControls.settings.dayField = false;
                        FormControls.settings.monthField = false;
                        FormControls.settings.untilYearField = true;
                        FormControls.settings.colorField = FestivityCollection.hasOwnProperty( existingFestivityTag ) ? false : true;
                        FormControls.settings.missalField = false;
                        FormControls.settings.readingsField = true;
                        FormControls.settings.reasonField = false;
                        FormControls.title = messages[ 'New festivity' ];
                        break;
                }

                $row = $(FormControls.CreatePatronRow( el ));
                $('.regionalNationalDataForm').append($row);

                $formrow = $row.find('.form-group').closest('.form-row');
                $formrow.data('action', el.Metadata.action).attr('data-action', el.Metadata.action);
                if( el.Metadata.action === RowAction.SetProperty.description ) {
                    $formrow.data('prop', el.Metadata.property).attr('data-prop', el.Metadata.property);
                }
                if( FormControls.settings.missalField && existingFestivityTag !== null ) {
                    const { MISSAL } = FestivityCollection[existingFestivityTag];
                    $row.find(`#onTheFly${currentUniqid}Missal`).val(MISSAL); //.prop('disabled', true);
                }
                $row.find('.litEventColor').multiselect({
                    buttonWidth: '100%'
                }).multiselect('deselectAll', false);

                if( el.Festivity.hasOwnProperty( 'color' ) === false && existingFestivityTag !== null ) {
                    console.log( 'retrieving default festivity info for ' + existingFestivityTag );
                    console.log( FestivityCollection[existingFestivityTag] );
                    el.Festivity.color = FestivityCollection[existingFestivityTag].COLOR;
                }
                let colorVal = Array.isArray(el.Festivity.color) ? el.Festivity.color : el.Festivity.color.split(',');
                $row.find('.litEventColor').multiselect('select', colorVal);
                if(FormControls.settings.colorField === false) {
                    $row.find('.litEventColor').multiselect('disable');
                }

                if( el.Festivity.hasOwnProperty( 'common' ) ) {
                    let common = Array.isArray( el.Festivity.common ) ? el.Festivity.common : el.Festivity.common.split(',');
                    if(FormControls.settings.commonFieldShow) {
                        $row.find(`#onTheFly${currentUniqid}Common`).multiselect({
                            buttonWidth: '100%'
                        }).multiselect('deselectAll', false).multiselect('select', common)
                        if(FormControls.settings.commonField === false) {
                            $row.find(`#onTheFly${currentUniqid}Common`).multiselect('disable');
                        }
                    }
                }

                if(FormControls.settings.gradeFieldShow) {
                    $row.find(`#onTheFly${currentUniqid}Grade`).val(el.Festivity.grade);
                    if(FormControls.settings.gradeField === false) {
                        $row.find(`#onTheFly${currentUniqid}Grade`).prop('disabled', true);
                    }
                }

                if(FormControls.settings.missalField && el.Metadata.hasOwnProperty('missal') ) {
                    $row.find(`#onTheFly${currentUniqid}Missal`).val(el.Metadata.missal);
                }

                if(FormControls.settings.monthField === false) {
                    $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${el.Festivity.month}])`).prop('disabled',true);
                }
            });
            $('.serializeRegionalNationalData').prop('disabled', false);
        },
        error: (xhr, textStatus, errorThrown) => {
            if( xhr.status !== 404 ) { //we have already handled 404 Not Found above
                let errorBody = '';
                if( xhr.responseText !== '' ) {
                    let responseObj = JSON.parse(xhr.responseText);
                    if( responseObj.hasOwnProperty( 'error' ) ) {
                        errorBody = responseObj.error;
                    }
                }
                toastr["error"](xhr.status + ' ' + textStatus + ': ' + errorThrown + '<hr>' + errorBody, "Error");
            }
        }
    });
});

$(document).on('change', '#diocesanCalendarDioceseName', ev => {
    $CALENDAR = { LitCal: {} };
    $('.carousel-item form').each((idx, el) => {
        el.reset();
        $(el).find('.form-row').slice(3).remove();
        $(el).find('h4.data-group-title').slice(3).remove();
        $(el).find('.litEventCommon').multiselect('deselectAll', false).multiselect('select', 'Proper');
        $(el).find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
        $(el).find('.litEventName').attr('data-valuewas', '');
    });
    $('form').each((idx, el) => { $(el).removeClass('was-validated') });
    //first we'll enforce only values from the current datalist
    if ($('#DiocesesList').find('option[value="' + $(ev.currentTarget).val() + '"]').length > 0) {
        $(ev.currentTarget).removeClass('is-invalid');
        $key = $('#DiocesesList').find('option[value="' + $(ev.currentTarget).val() + '"]').attr('data-value').toUpperCase();
        //console.log('selected diocese with key = ' + $key);
        if ($index.DiocesanCalendars.hasOwnProperty($key)) {
            $('#retrieveExistingDiocesanData').prop('disabled', false);
            $('#removeExistingDiocesanData').prop('disabled', false);
            $('body').append(removeDiocesanCalendarModal($(ev.currentTarget).val()));
            if($index.DiocesanCalendars[$key].hasOwnProperty('group')){
                $('#diocesanCalendarGroup').val($index.DiocesanCalendars[$key].group);
            }
            //console.log('we have an existing entry for this diocese!');
        } else {
            $('#retrieveExistingDiocesanData').prop('disabled', true);
            $('#removeExistingDiocesanData').prop('disabled', true);
            $('body').find('#removeDiocesanCalendarPrompt').remove();
            //console.log('no existing entry for this diocese');
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
        case 'nationalCalendar':
            const regionNamesLocalized = new Intl.DisplayNames([lcl], { type: 'region' });
            const widerRegion = $('#associatedWiderRegion').val();
            finalObj = {
                "LitCal": [],
                "Settings": {
                    "Epiphany": $('#nationalCalendarSettingEpiphany').val(),
                    "Ascension": $('#nationalCalendarSettingAscension').val(),
                    "CorpusChristi": $('#nationalCalendarSettingCorpusChristi').val(),
                    "Locale": lcl.toUpperCase()
                },
                "Metadata": {
                    "Region": regionNamesLocalized.of( messages.countryISOCodes[$('.regionalNationalCalendarName').val().toUpperCase()] ).toUpperCase(),
                    "WiderRegion": {
                        "name": widerRegion,
                        "jsonFile": `nations/${widerRegion}.json`,
                        "i18nFile": `nations/${widerRegion.toUpperCase()}/${lcl.toLowerCase()}.json`
                    },
                    "Missals": $.map( $('#publishedRomanMissalList li'), el => { return $(el).text() })
                }
            }
            break;
        case 'widerRegionCalendar':
            const regionNamesLocalizedEng = new Intl.DisplayNames(['en'], { type: 'region' });
            let nationalCalendars = $('#widerRegionLanguages').val().reduce((prev, curr) => {
                curr = curr.replaceAll('_', '-');
                if( curr.includes('-') === false ) {
                    curr += '-' + curr.toUpperCase();
                }
                let locale = new Intl.Locale( curr );
                console.log( 'curr = ' + curr + ', nation = ' + locale.region );
                prev[ regionNamesLocalizedEng.of( locale.region ) ] = locale.region;
                return prev;
            }, {});
            finalObj = {
                "LitCal": [],
                "NationalCalendars": nationalCalendars,
                "Metadata": {
                    "IsMultilingual": $('#widerRegionIsMultilingual').prop('checked'),
                    "Languages": $('#widerRegionLanguages').val(),
                    "WiderRegion": $('#widerRegionCalendarName').val()
                }
            }
            break;
    }

    $('.regionalNationalDataForm .form-row').each((idx, el) => {
        const action = $(el).data('action');
        let rowData = {
            "Festivity": {},
            "Metadata": {
                "action": action
            }
        }
        if( action === RowAction.SetProperty.description ) {
            rowData.Metadata.property = $(el).data('prop');
        }
        expectedJSONProperties[action].forEach(prop => {
            let propClass = '.litEvent' + prop.charAt(0).toUpperCase() + prop.substring(1).toLowerCase();
            if( $(el).find(propClass).length ) {
                let val = $(el).find(propClass).val();
                if( integerVals.includes(prop) ) {
                    val = parseInt( val );
                }
                if( metadataProps.includes(prop) ) {
                    rowData.Metadata[prop] = val;
                } else {
                    rowData.Festivity[prop] = val;
                }
            }
        });

        if( $(el).find('.litEventFromYear').length ) {
            let sinceYear = parseInt($(el).find('.litEventFromYear').val());
            if( sinceYear > 1582 && sinceYear <= 9999 ) {
                rowData.Metadata.sinceYear = sinceYear;
            }
        }
        if( $(el).find('.litEventUntilYear').length ) {
            let untilYear = parseInt($(el).find('.litEventUntilYear').val());
            if( untilYear >= 1970 && untilYear <= 9999 ) {
                rowData.Metadata.untilYear = untilYear;
            }
        }
        if( $(el).find('.litEventDecreeURL').length ) {
            let decreeURL = $(el).find('.litEventDecreeURL').val();
            if( decreeURL !== '' ) {
                rowData.Metadata.decreeURL = decreeURL;
            }
        }
        if( $(el).find('.litEventDecreeLangs').length ) {
            let decreeLangs = $(el).find('.litEventDecreeLangs').val();
            if( decreeLangs !== '' ) {
                rowData.Metadata.decreeLangs = decreeLangs.split(',').reduce((prevVal, curVal) => { let assoc = curVal.split('='); prevVal[assoc[0]] = assoc[1]; return prevVal; }, {}) ;
            }
        }
        finalObj.LitCal.push(rowData);
    });

    //console.log(finalObj);
    //console.log(JSON.stringify(finalObj));
    $.ajax({
        url: RegionalDataURL,
        method: 'put',
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

$(document).on('change', '#languageEditionRomanMissalName', ev => {
    $('#addLanguageEditionRomanMissal').prop('disabled', false);
});

$(document).on('click', '#addLanguageEditionRomanMissal', ev => {
    let languageEditionRomanMissal = $('#languageEditionRomanMissalName').val();
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
        $('#diocesanCalendarDefinitionCardLinks li').find('[data-slide-to=' + event.to + ']').parent('li').addClass('active');
    });

    $('#widerRegionLanguages').multiselect({
        buttonWidth: '100%',
        maxHeight: 200,
        enableCaseInsensitiveFiltering: true
    });

    $('.litEventCommon').multiselect({
        buttonWidth: '100%',
        maxHeight: 200,
        //enableCollapsibleOptGroups: true,
        //collapseOptGroupsByDefault: true,
        enableCaseInsensitiveFiltering: true,
        onChange: (option, checked, select) => {
            if ($(option).val() !== 'Proper' && checked === true && $(option).parent().val().includes('Proper')) {
                $row = $(option).closest('.form-row');
                $(option).parent().multiselect('deselect', 'Proper');
                if( $row.find('.litEventReadings').length ) {
                    $row.find('.litEventReadings').prop('disabled',true);
                }
            } else if ($(option).val() === 'Proper' && checked === true) {
                $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
                $row = $(option).closest('.form-row');
                if( $row.find('.litEventReadings').length ) {
                    $row.find('.litEventReadings').prop('disabled',false);
                }
            }
        }
    });

    $('.litEventColor').multiselect({
        buttonWidth: '100%'
    });

});
