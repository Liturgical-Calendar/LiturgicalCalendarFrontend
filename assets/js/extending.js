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
    static CreateNewFromExisting = Symbol('createNewFromExisting');
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
    constructor(name = "", color = "", grade = 0, common = "", day = 1, month = 1 ) {
        this.name = name;
        this.color = color;
        this.grade = grade;
        this.common = common;
        this.day = day;
        this.month = month;
    }
}

const { LOCALE } = messages;
const jsLocale = LOCALE.replace('_', '-');

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
    'createNew': [ 'tag', 'name', 'color', 'grade', 'day', 'month', 'strtotime', 'common' ] //'readings' is only expected for createNew when common=Proper
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
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-backspace me-2">Cancel</button>
        <button type="button" id="deleteDiocesanCalendarButton" class="btn btn-danger"><i class="far fa-trash-alt me-2"></i>Delete calendar</button>
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
        commonField: true,
        gradeFieldShow: false,
        commonFieldShow: false,
        fromYearField: true,
        untilYearField: true,
        tagField: false,
        decreeURLField: false,
        decreeLangMapField: false,
        reasonField: false,
        missalField: false,
        strtotimeField: false
    }
    static action = null;
    static title = null;

    static CreateFestivityRow() {
        let formRow = '';

        if (FormControls.title !== null) {
            formRow += `<div class="d-flex justify-content-left data-group-title"><h4 class="data-group-title">${FormControls.title}</h4></div>`;
        }

        formRow += `<div class="row gx-2">`;

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
            <label for="onTheFly${FormControls.uniqid}Month"><span class="month-label">${messages[ "Month" ]}</span><div class="form-check form-check-inline form-switch ms-2 ps-5 border border-end-0 border-secondary rounded-start bg-light" title="switch on for mobile celebration as opposed to fixed date">
                <label class="form-check-label me-1" for="onTheFly${FormControls.uniqid}StrtotimeSwitch">Mobile</label>
                <input class="form-check-input litEvent litEventStrtotimeSwitch" type="checkbox" data-bs-toggle="toggle" data-bs-size="xs" data-bs-onstyle="info" data-bs-offstyle="dark" role="switch" id="onTheFly${FormControls.uniqid}StrtotimeSwitch">
            </div></label>
            <select class="form-control litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month">`;

            let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
            for (let i = 0; i < 12; i++) {
                let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
            }

            formRow += `</select>
            </div>`;
        }

        if(FormControls.settings.strtotimeField) {
            formRow += `<div class="form-group col-sm-3">
            <label for="onTheFly${FormControls.uniqid}Strtotime"><span class="month-label">Explicatory date</span><div class="form-check form-check-inline form-switch ms-2 ps-5 border border-end-0 border-secondary rounded-start bg-light" title="switch on for mobile celebration as opposed to fixed date">
                <label class="form-check-label me-1" for="onTheFly${FormControls.uniqid}StrtotimeSwitch">Mobile</label>
                <input class="form-check-input litEvent litEventStrtotimeSwitch" type="checkbox" data-bs-toggle="toggle" data-bs-size="xs" data-bs-onstyle="info" data-bs-offstyle="dark" role="switch" id="onTheFly${FormControls.uniqid}StrtotimeSwitch">
            </div></label>
            <input type="text" class="form-control litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}Strtotime" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" />
            </div>`;
        }

        if (FormControls.settings.commonField) {
            formRow += messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:3});
        }

        if (FormControls.settings.colorField) {
            formRow += `<div class="form-group col-sm-1">
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
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventSinceYear" id="onTheFly${FormControls.uniqid}FromYear" value="1970" />
            </div>`;
        }

        if (FormControls.settings.untilYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}UntilYear">${messages[ "Until" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventUntilYear" id="onTheFly${FormControls.uniqid}UntilYear" value="" />
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
                //festivity.untilYear = null;
                festivity.decreeURL = '';
                festivity.decreeLangs = {};
            }
            if( typeof element === 'object' ) {
                festivity = {
                    ...element.Festivity,
                    ...element.Metadata
                };
                if( festivity.hasOwnProperty( 'untilYear' ) === false ) {
                    //festivity.untilYear = null;
                }
                if( festivity.hasOwnProperty( 'color' ) === false ) {
                    festivity.color = FestivityCollection.hasOwnProperty(festivity.tag) ? FestivityCollection[festivity.tag].COLOR : [];
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            formRow += `<div class="d-flex justify-content-left data-group-title"><h4 class="data-group-title">${FormControls.title}</h4>`;
            if(FormControls.action.description === RowAction.CreateNew.description) {
                if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
                    formRow += `<button type="button" class="ms-auto btn btn-info strtotime-toggle-btn active" data-bs-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="true" autocomplete="off"><i class="fas fa-comment me-2"></i>explicatory date</button>`;
                } else {
                    formRow += `<button type="button" class="ms-auto btn btn-info strtotime-toggle-btn" data-bs-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="false" autocomplete="off"><i class="fas fa-comment-slash me-2"></i>explicatory date</button>`;
                }
            }
            formRow += `</div>`;
        }

        formRow += `<div class="row gx-2">`;

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
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventSinceYear" id="onTheFly${FormControls.uniqid}FromYear" value="${festivity !== null ? festivity.sinceYear : ''}" />
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
            <label for="onTheFly${FormControls.uniqid}Strtotime">Explicatory date</label>
            <input type="text" value="${festivity.strtotime}" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}Strtotime" />
            </div>`;
        } else {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Day">${messages[ "Day" ]}</label>
            <input type="number" min="1" max="31" value="${festivity !== null && festivity.day}" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day"${FormControls.settings.dayField === false ?  'readonly' : '' } />
            </div>`;

            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Month">${messages[ "Month" ]}</label>
            <select class="form-control litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month"${FormControls.settings.monthField === false ?  'readonly' : '' } >`;

            let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
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
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${messages[ "Decree URL" ]}<i class="ms-2 fas fa-info-circle" title="Use %s in place of the language code if using a language mapping"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.decreeURL !== 'undefined' ? festivity.decreeURL : ''}" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapField) {
            let decreeLangs = festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? Object.keys(festivity.decreeLangs).map(key => key+'='+festivity.decreeLangs[key] ) : null;
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${messages[ "Decree Langs" ]}<i class="ms-2 fas fa-info-circle" title="Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? decreeLangs.join(',') : ''}" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }

}

const setFormSettings = action => {
    switch( action ) {
        case 'designatePatronButton':
            //nobreak
        case RowAction.MakePatron.description:
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
            FormControls.settings.reasonField = false;
            FormControls.settings.readingsField = false;
            FormControls.title =  messages[ 'Designate patron' ];
            FormControls.action = RowAction.MakePatron;
            break;
        case 'setPropertyButton':
            //nobreak
        case RowAction.SetProperty.description:
            FormControls.settings.tagField = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.missalField = false;
            FormControls.settings.reasonField = false;
            FormControls.settings.readingsField = false;
            FormControls.title = messages[ 'Change name or grade' ];
            FormControls.action = RowAction.SetProperty;
            break;
        case 'moveFestivityButton':
            //nobreak
        case RowAction.MoveFestivity.description:
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = false;
            FormControls.settings.gradeFieldShow = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField = true;
            FormControls.settings.monthField = true;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.missalField = true;
            FormControls.settings.reasonField = true;
            FormControls.settings.readingsField = false;
            FormControls.title = messages[ 'Move festivity' ];
            FormControls.action = RowAction.MoveFestivity;
            break;
        case 'newFestivityFromExistingButton':
            //nobreak
        case RowAction.CreateNewFromExisting.description:
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
            FormControls.settings.reasonField = false;
            FormControls.settings.readingsField = true;
            FormControls.title = messages[ 'New festivity' ];
            FormControls.action = RowAction.CreateNew;
            break;
        case 'newFestivityExNovoButton':
            //nobreak
        case RowAction.CreateNew.description:
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
            FormControls.settings.reasonField = false;
            FormControls.settings.readingsField = true;
            FormControls.title = messages[ 'New festivity' ];
            FormControls.action = RowAction.CreateNew;
            break;
    }
}

const setFormSettingsForProperty = property => {
    switch(property) {
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
}

const setCommonMultiselect = ($row=null,common=null) => {
    if( $row !== null ) {
        $litEventCommon = $row.find('.litEventCommon');
    } else {
        $litEventCommon = $('.litEventCommon');
    }
    $litEventCommon.multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        },
        maxHeight: 200,
        enableCaseInsensitiveFiltering: true,
        onChange: (option, checked, select) => {
            if (($(option).val() !== 'Proper' && checked === true && $(option).parent().val().includes('Proper')) || checked === false ) {
                $(option).parent().multiselect('deselect', 'Proper');
                $row = $(option).closest('.row');
                if( $row.find('.litEventReadings').length ) {
                    $row.find('.litEventReadings').prop('disabled',true);
                }
            } else if ($(option).val() === 'Proper' && checked === true) {
                $(option).parent().multiselect('deselectAll', false).multiselect('select', 'Proper');
                $row = $(option).closest('.row');
                if( $row.find('.litEventReadings').length ) {
                    $row.find('.litEventReadings').prop('disabled',false);
                }
            }
        }
    }).multiselect('deselectAll', false);
    if( common !== null ) {
        $litEventCommon.multiselect('select', common);
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

const loadDiocesanCalendarData = () => {
    let diocese = $('#diocesanCalendarDioceseName').val();
    let dioceseKey = $('#DiocesesList').find('option[value="' + diocese + '"]').attr('data-value').toUpperCase();
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
            for (const [key, obj] of Object.entries(data.LitCal)) {
                const { Festivity, Metadata } = obj;
                let $form;
                let $row;
                let numLastRow;
                let numMissingRows;
                if(Metadata.hasOwnProperty('strtotime')) {
                    FormControls.settings.dayField = false;
                    FormControls.settings.monthField = false;
                    FormControls.settings.strtotimeField = true;
                } else {
                    FormControls.settings.dayField = true;
                    FormControls.settings.monthField = true;
                    FormControls.settings.strtotimeField = false;
                }
                switch (Festivity.grade) {
                    case RANK.SOLEMNITY:
                        $form = $('#carouselItemSolemnities form');
                        numLastRow = $form.find('.row').length - 1;
                        if (Metadata.formRowNum > numLastRow) {
                            numMissingRows = Metadata.formRowNum - numLastRow;
                            FormControls.title = messages['Other Solemnity'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $form.append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemSolemnities form .row').eq(Metadata.formRowNum);
                        break;
                    case RANK.FEAST:
                        numLastRow = $('#carouselItemFeasts form .row').length - 1;
                        if (Metadata.formRowNum > numLastRow) {
                            numMissingRows = Metadata.formRowNum - numLastRow;
                            FormControls.title = messages['Other Feast'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(1).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemFeasts form .row').eq(Metadata.formRowNum);
                        break;
                    case RANK.MEMORIAL:
                        numLastRow = $('#carouselItemMemorials form .row').length - 1;
                        if (Metadata.formRowNum > numLastRow) {
                            numMissingRows = Metadata.formRowNum - numLastRow;
                            FormControls.title = messages['Other Memorial'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(2).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemMemorials form .row').eq(Metadata.formRowNum);
                        break;
                    case RANK.OPTIONALMEMORIAL:
                        numLastRow = $('#carouselItemOptionalMemorials form .row').length - 1;
                        if (Metadata.formRowNum > numLastRow) {
                            numMissingRows = Metadata.formRowNum - numLastRow;
                            FormControls.title = messages['Other Optional Memorial'];
                            FormControls.settings.commonField = true;
                            while (numMissingRows-- > 0) {
                                $('.carousel-item').eq(3).find('form').append($(FormControls.CreateFestivityRow()));
                            }
                        }
                        $row = $('#carouselItemOptionalMemorials form .row').eq(Metadata.formRowNum);
                        break;
                }
                $row.find('.litEventName').val(Festivity.name).attr('data-valuewas', key);
                //if(Metadata.formRowNum > 2) {
                //    $row.find('.litEventStrtotimeSwitch').bootstrapToggle();
                //}
                if( Metadata.hasOwnProperty('strtotime') ) {
                    $row.find('.litEventStrtotimeSwitch').prop('checked', true);
                    if( $row.find('.litEventStrtotime').length === 0 ) {
                        switcheroo( $row, Metadata );
                    }
                    $row.find('.litEventStrtotime').val(Metadata.strtotime);
                } else {
                    if( $row.find('.litEventStrtotime').length > 0 ) {
                        unswitcheroo( $row, Festivity );
                    }
                    $row.find('.litEventDay').val(Festivity.day);
                    $row.find('.litEventMonth').val(Festivity.month);
                }
                setCommonMultiselect( $row, Festivity.common );
                $row.find('.litEventColor').multiselect({
                    buttonWidth: '100%',
                    buttonClass: 'form-select',
                    templates: {
                        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                    }
                }).multiselect('deselectAll', false).multiselect('select', Festivity.color);
                $row.find('.litEventSinceYear').val(Metadata.sinceYear);
                if( Metadata.hasOwnProperty('untilYear') ) {
                    $row.find('.litEventUntilYear').val(Metadata.untilYear);
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
    let formRow = `<select class="form-control litEvent litEventMonth" id="${monthId}">`;
    let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
    for (let i = 0; i < 12; i++) {
        let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
        formRow += `<option value=${i + 1}${(i+1)===Festivity.month ? ' selected' : ''}>${formatter.format(month)}</option>`;
    }
    formRow += `</select>`;
    $strToTimeFormGroup.append(formRow);
    $strToTimeFormGroup.find('.month-label').text(messages[ 'Month' ]).attr('for',monthId);
}

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
        $dayFormGroup.empty().removeClass('col-sm-1').addClass('col-sm-2').append(`<label for="onTheFly${uniqid}Strtotime">Explicatory date</label><input type="text" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="onTheFly${uniqid}Strtotime" />`);
    } else {
        $(ev.currentTarget).find('i').removeClass('fa-comment').addClass('fa-comment-slash');
        let $strToTimeFormGroup = $(`#onTheFly${uniqid}Strtotime`).closest('.form-group');
        $strToTimeFormGroup.empty().removeClass('col-sm-2').addClass('col-sm-1').append(`<label for="onTheFly${uniqid}Day">Day</label><input type="number" min="1" max="31" value="false" class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`);
        let formRow = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${messages[ "Month" ]}</label>
        <select class="form-control litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
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
    $row = $(ev.currentTarget).closest('.row');
    $card = $(ev.currentTarget).closest('.card-body');
    if ($(ev.currentTarget).hasClass('litEventName')) {
        //console.log('LitEvent name has changed');
        if ($(ev.currentTarget).val() == '') {
            //empty value probably means we are trying to delete an already defined event
            //so let's find the key and remove it
            oldEventKey = $(ev.currentTarget).attr('data-valuewas');
            console.log('seems we are trying to delete the object key ' + oldEventKey);
            if ($CALENDAR.LitCal.hasOwnProperty(oldEventKey)) {
                delete $CALENDAR.LitCal[oldEventKey];
            }
            $(ev.currentTarget).attr('data-valuewas', '');
        } else {
            eventKey = $(ev.currentTarget).val().replace(/[^a-zA-Z]/gi, '');
            console.log('new LitEvent name identifier is ' + eventKey);
            console.log('festivity name is ' + $(ev.currentTarget).val());
            if ($(ev.currentTarget).attr('data-valuewas') == '' && $CALENDAR.LitCal.hasOwnProperty(eventKey) === false) {
                console.log('there was no data-valuewas attribute or it was empty, so we are creating ex-novo a new LitEvent');
                $CALENDAR.LitCal[eventKey] = { Festivity: {}, Metadata: {} };
                $CALENDAR.LitCal[eventKey].Festivity = new litEvent(
                    $(ev.currentTarget).val(), //name
                    $row.find('.litEventColor').val(), //color
                    null,
                    $row.find('.litEventCommon').val(), //common
                    parseInt($row.find('.litEventDay').val()), //day
                    parseInt($row.find('.litEventMonth').val()), //month
                );
                //let's initialize defaults just in case the default input values happen to be correct, so no change events are fired
                $CALENDAR.LitCal[eventKey].Metadata.sinceYear = parseInt($row.find('.litEventSinceYear').val());
                if( $row.find('.litEventUntilYear').val() !== '' ) {
                    $CALENDAR.LitCal[eventKey].Metadata.untilYear = parseInt($row.find('.litEventUntilYear').val());
                }
                let formRowIndex = $card.find('.row').index($row);
                $CALENDAR.LitCal[eventKey].Metadata.formRowNum = formRowIndex;
                console.log('form row index is ' + formRowIndex);
                $(ev.currentTarget).attr('data-valuewas', eventKey);
                $(ev.currentTarget).removeClass('is-invalid');
                console.log( $CALENDAR.LitCal[eventKey] );
            } else if ($(ev.currentTarget).attr('data-valuewas') != '') {
                oldEventKey = $(ev.currentTarget).attr('data-valuewas');
                console.log('the preceding value here was ' + oldEventKey);
                if ($CALENDAR.LitCal.hasOwnProperty(oldEventKey)) {
                    if (oldEventKey !== eventKey) {
                        if( /_2$/.test(eventKey) ) {
                            console.log('oh geez, we are dealing with a second festivity that has the same name as a first festivity, because it continues where the previous untilYear left off...');
                            eventKey = oldEventKey;
                            console.log('but wait, why would you be changing the name of the second festivity? it will no longer match the first festivity!');
                            console.log('this is becoming a big mess, arghhhh... results can start to be unpredictable');
                            $CALENDAR.LitCal[eventKey].Festivity.name = $(ev.currentTarget).val();
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        } else {
                            console.log('I see you are trying to change the name of a festivity that was already defined. This will effectively change the relative key also, so here is what we are going to do:');
                            console.log('will now attempt to copy the values from <' + oldEventKey + '> to <' + eventKey + '> and then remove <' + oldEventKey + '>');
                            Object.defineProperty($CALENDAR.LitCal, eventKey,
                                Object.getOwnPropertyDescriptor($CALENDAR.LitCal, oldEventKey));
                            $CALENDAR.LitCal[eventKey].Festivity.name = $(ev.currentTarget).val();
                            delete $CALENDAR.LitCal[oldEventKey];
                            $(ev.currentTarget).attr('data-valuewas', eventKey);
                            $(ev.currentTarget).removeClass('is-invalid');
                        }
                    }
                }
            } else if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                if( false === $CALENDAR.LitCal[eventKey].Metadata.hasOwnProperty('untilYear') ) {
                    console.log('exact same festivity name was already defined elsewhere! key ' + eventKey + ' already exists! and the untilYear property was not defined!');
                    $(ev.currentTarget).val('');
                    $(ev.currentTarget).addClass('is-invalid');
                } else {
                    let confrm = confirm('The same festivity name was already defined elsewhere. However an untilYear property was also defined, so perhaps you are wanting to define again for the years following. If this is the case, press OK, otherwise Cancel');
                    if(confrm) {
                        //retrieve untilYear from the previous festivity with the same name
                        let untilYear = $CALENDAR.LitCal[eventKey].Metadata.untilYear;
                        //set the sinceYear field on this row to the previous untilYear plus one
                        $row.find('.litEventSinceYear').val(untilYear+1);
                        //update our eventKey to be distinct from the previous festivity
                        eventKey = eventKey+'_2';
                        $(ev.currentTarget).attr('data-valuewas', eventKey);
                        $CALENDAR.LitCal[eventKey] = { Festivity: {}, Metadata: {} };
                        $CALENDAR.LitCal[eventKey].Festivity = new litEvent(
                            $(ev.currentTarget).val(), //name
                            $row.find('.litEventColor').val(), //color
                            null,
                            $row.find('.litEventCommon').val(), //common
                            parseInt($row.find('.litEventDay').val()), //day
                            parseInt($row.find('.litEventMonth').val()), //month
                        );
                        $CALENDAR.LitCal[eventKey].Metadata.sinceYear = untilYear + 1;
                        let formRowIndex = $card.find('.row').index($row);
                        $CALENDAR.LitCal[eventKey].Metadata.formRowNum = formRowIndex;
                        console.log('form row index is ' + formRowIndex);
                    }
                }
            }
            switch ($(ev.currentTarget).closest('.carousel-item').attr('id')) {
                case 'carouselItemSolemnities':
                    $CALENDAR.LitCal[eventKey].Festivity.grade = 6;
                    if ($(ev.currentTarget).val().match(/(martyr|martir|mártir|märtyr)/i) !== null) {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'red');
                        $CALENDAR.LitCal[eventKey].Festivity.color = [ 'red' ];
                    } else {
                        $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', 'white');
                        $CALENDAR.LitCal[eventKey].Festivity.color = [ 'white' ];
                    }
                    break;
                case 'carouselItemFeasts':
                    $CALENDAR.LitCal[eventKey].Festivity.grade = 4;
                    break;
                case 'carouselItemMemorials':
                    $CALENDAR.LitCal[eventKey].Festivity.grade = 3;
                    break;
                case 'carouselItemOptionalMemorials':
                    $CALENDAR.LitCal[eventKey].Festivity.grade = 2;
                    break;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventDay')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].Festivity.day = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventMonth')) {
        let selcdMonth = parseInt($(ev.currentTarget).val());
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].Festivity.month = selcdMonth;
            }
        }
        $row.find('.litEventDay').attr('max', selcdMonth === FEBRUARY ? "28" : (monthsOfThirty.includes(selcdMonth) ? "30" : "31"));
        if (parseInt($row.find('.litEventDay').val()) > parseInt($row.find('.litEventDay').attr('max'))) {
            $row.find('.litEventDay').val($row.find('.litEventDay').attr('max'));
        }
    } else if ($(ev.currentTarget).hasClass('litEventCommon')) {
        if ($row.find('.litEventName').val() !== "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].Festivity.common = $(ev.currentTarget).val();
                let eventColors = [];
                if ($CALENDAR.LitCal[eventKey].Festivity.common.some( m => /Martyrs/.test(m) )) {
                    eventColors.push('red');
                }
                if ($CALENDAR.LitCal[eventKey].Festivity.common.some( m => /(Blessed Virgin Mary|Pastors|Doctors|Virgins|Holy Men and Women|Dedication of a Church)/.test(m) ) ) {
                    eventColors.push('white');
                }
                $row.find('.litEventColor').multiselect('deselectAll', false).multiselect('select', eventColors);
                $CALENDAR.LitCal[eventKey].Festivity.color = eventColors;
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventColor')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].Festivity.color = $(ev.currentTarget).val();
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventSinceYear')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].Metadata.sinceYear = parseInt($(ev.currentTarget).val());
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventUntilYear')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                if($(ev.currentTarget).val() !== '') {
                    $CALENDAR.LitCal[eventKey].Metadata.untilYear = parseInt($(ev.currentTarget).val());
                } else {
                    delete $CALENDAR.LitCal[eventKey].Metadata.untilYear;
                }
            }
        }
    } else if ($(ev.currentTarget).hasClass('litEventStrtotimeSwitch')) {
        if ($row.find('.litEventName').val() != "") {
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                if(false === $(ev.currentTarget).prop('checked')) {
                    delete $CALENDAR.LitCal[eventKey].Metadata.strtotime;
                    $CALENDAR.LitCal[eventKey].Festivity.Day = 1;
                    $CALENDAR.LitCal[eventKey].Festivity.Month = 1;
                    let $strToTimeFormGroup = $(ev.currentTarget).closest('.form-group');
                    $strToTimeFormGroup.removeClass('col-sm-3').addClass('col-sm-2');
                    let $litEventStrtotime = $strToTimeFormGroup.find('.litEventStrtotime');
                    let dayId = $litEventStrtotime.attr('id').replace('Strtotime', 'Day');
                    let monthId = $litEventStrtotime.attr('id').replace('Strtotime', 'Month');
                    $strToTimeFormGroup.before(`<div class="form-group col-sm-1">
                    <label for="${dayId}">${messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="${dayId}" />
                    </div>`);
                    $litEventStrtotime.remove();
                    let formRow = `<select class="form-control litEvent litEventMonth" id="${monthId}">`;
                    let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
                    for (let i = 0; i < 12; i++) {
                        let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                        formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
                    }
                    formRow += `</select>`;
                    $strToTimeFormGroup.append(formRow);
                    $strToTimeFormGroup.find('.month-label').text(messages[ 'Month' ]).attr('for',monthId);
                } else {
                    delete $CALENDAR.LitCal[eventKey].Festivity.Day;
                    delete $CALENDAR.LitCal[eventKey].Festivity.Month;
                    $CALENDAR.LitCal[eventKey].Metadata.strtotime = '';
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
            eventKey = $row.find('.litEventName').attr('data-valuewas');
            if ($CALENDAR.LitCal.hasOwnProperty(eventKey)) {
                $CALENDAR.LitCal[eventKey].Metadata.strtotime = $(ev.currentTarget).val();
            }
        }
    }
});

$(document).on('click', '#saveDiocesanCalendar_btn', () => {
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
    let currentUniqid = FormControls.uniqid;
    let $modal = $(ev.currentTarget).closest('.actionPromptModal');
    let $modalForm = $modal.find('form');
    let existingFestivityTag = $modalForm.find('.existingFestivityName').val();
    let propertyToChange;
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
                    $('#nationalCalendarSettingLocale').val( Settings.Locale );
                    $('#publishedRomanMissalList').empty().append( '<li class="list-group-item">' + Metadata.Missals.join('</li><li class="list-group-item">') + '</li>' );
                    $('#associatedWiderRegion').val( Metadata.WiderRegion.name );
            }
            $('.regionalNationalDataForm').empty();
            data.LitCal.forEach((el) => {
                let currentUniqid = FormControls.uniqid;
                let existingFestivityTag = el.Festivity.hasOwnProperty( 'tag' ) ? el.Festivity.tag : null;
                if( el.Metadata.action === RowAction.CreateNew.description && FestivityCollection.hasOwnProperty( existingFestivityTag ) ) {
                    el.Metadata.action = RowAction.CreateNewFromExisting.description;
                }
                setFormSettings( el.Metadata.action );
                if( el.Metadata.action === RowAction.SetProperty.description ) {
                    setFormSettingsForProperty( el.Metadata.property );
                }

                $row = $(FormControls.CreatePatronRow( el ));
                $('.regionalNationalDataForm').append($row);

                $formrow = $row.find('.form-group').closest('.row');
                $formrow.data('action', el.Metadata.action).attr('data-action', el.Metadata.action);
                if( el.Metadata.action === RowAction.SetProperty.description ) {
                    $formrow.data('prop', el.Metadata.property).attr('data-prop', el.Metadata.property);
                }
                if( el.Festivity.hasOwnProperty('common') && el.Festivity.common.includes('Proper') ) {
                    $formrow.find('.litEventReadings').prop('disabled',false);
                }

                if( FormControls.settings.missalField && existingFestivityTag !== null ) {
                    const { MISSAL } = FestivityCollection[existingFestivityTag];
                    $row.find(`#onTheFly${currentUniqid}Missal`).val(MISSAL); //.prop('disabled', true);
                }
                $row.find('.litEventColor').multiselect({
                    buttonWidth: '100%',
                    buttonClass: 'form-select',
                    templates: {
                        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                    }
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
                        setCommonMultiselect( $row, common );
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
        $(el).find('.row').slice(3).remove();
        $(el).find('div.data-group-title').remove();
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
            $('#removeExistingDiocesanData').prop('disabled', false);
            $('body').append(removeDiocesanCalendarModal($(ev.currentTarget).val()));
            if($index.DiocesanCalendars[$key].hasOwnProperty('group')){
                $('#diocesanCalendarGroup').val($index.DiocesanCalendars[$key].group);
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
            const regionNamesLocalized = new Intl.DisplayNames(['en'], { type: 'region' });
            const widerRegion = $('#associatedWiderRegion').val();
            finalObj = {
                "LitCal": [],
                "Settings": {
                    "Epiphany": $('#nationalCalendarSettingEpiphany').val(),
                    "Ascension": $('#nationalCalendarSettingAscension').val(),
                    "CorpusChristi": $('#nationalCalendarSettingCorpusChristi').val(),
                    "Locale": lcl
                },
                "Metadata": {
                    "Region": regionNamesLocalized.of( messages.countryISOCodes[$('.regionalNationalCalendarName').val().toUpperCase()] ).toUpperCase().replace(/[.]/g,'_'),
                    "WiderRegion": {
                        "name": widerRegion,
                        "jsonFile": `nations/${widerRegion}.json`,
                        "i18nFile": `nations/${widerRegion.toUpperCase()}/${lcl}.json`
                    },
                    "Missals": $.map( $('#publishedRomanMissalList li'), el => { return $(el).text() })
                }
            }
            break;
        case 'widerRegionCalendar':
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

    $('.regionalNationalDataForm .row').each((idx, el) => {
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
        if( action === 'createNew' && rowData.Festivity.common.includes( 'Proper' ) ) {
            rowData.Festivity.readings = {
                FIRST_READING: $(el).find('.litEventReadings_FIRST_READING').val(),
                RESPONSORIAL_PSALM: $(el).find('.litEventReadings_RESPONSORIAL_PSALM').val(),
                ALLELUIA_VERSE: $(el).find('.litEventReadings_ALLELUIA_VERSE').val(),
                GOSPEL: $(el).find('.litEventReadings_GOSPEL').val()
            };
            if( $(el).find('.litEventReadings_SECOND_READING').val() !== "" ) {
                rowData.Festivity.readings.SECOND_READING = $(el).find('.litEventReadings_SECOND_READING').val();
            }
        }

        if( $(el).find('.litEventSinceYear').length ) {
            let sinceYear = parseInt($(el).find('.litEventSinceYear').val());
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

Object.filter = (obj, predicate) => 
    Object.keys(obj)
      .filter( key => predicate(obj[key]) )
      .reduce( (res, key) => (res[key] = obj[key], res), {} );


$(document).on('change', '#diocesanCalendarNationalDependency', ev => {
    $('#diocesanCalendarDioceseName').val('');
    //$('#retrieveExistingDiocesanData').prop('disabled', true);
    $('#removeExistingDiocesanData').prop('disabled', true);
    $('body').find('#removeDiocesanCalendarPrompt').remove();
    let currentSelectedNation = $(ev.currentTarget).val();
    switch (currentSelectedNation) {
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
            let dioceses = Object.filter( $index.DiocesanCalendars, key => key.nation === currentSelectedNation );
            console.log(dioceses);
            Object.values( dioceses ).forEach( el => $('#DiocesesList').append('<option data-value="' + el.diocese.replace(/[^a-zA-Z]/gi, '').toUpperCase() + '" value="' + el.diocese + '">') )
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
