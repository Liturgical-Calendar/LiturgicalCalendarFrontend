const isStaging = location.href.includes('-staging');

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
    static MakeDoctor       = Symbol('makeDoctor');
    static SetProperty      = Symbol('setProperty');
    static MoveFestivity    = Symbol('moveFestivity');
    static CreateNew        = Symbol('createNew');
    static CreateNewFromExisting = Symbol('createNewFromExisting');
    constructor(name) {
        this.name = name;
    }
}

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
        untilYearField: false,
        tagField: false,
        decreeURLField: true,
        decreeLangMapField: true,
        reasonField: false,
    }
    static action = null;
    static title = null;

    static CreateDoctorRow(element = null) {
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
                element.Festivity = lowercaseKeys( element.Festivity );
                festivity = {
                    ...element.Festivity,
                    ...element.Metadata
                };
                if( false === festivity.hasOwnProperty( 'untilYear' ) ) {
                    festivity.untilYear = '';
                }
                if( false === festivity.hasOwnProperty( 'color' ) ) {
                    festivity.color = FestivityCollection.hasOwnProperty(festivity.tag) && FestivityCollection[festivity.tag].hasOwnProperty( 'COLOR' ) ? FestivityCollection[festivity.tag].COLOR : [];
                }
            }
            if( false === festivity.hasOwnProperty( 'name' ) ) {
                if( FestivityCollection.hasOwnProperty( festivity.tag ) && FestivityCollection[festivity.tag].hasOwnProperty( 'NAME' ) ) {
                    festivity.name = FestivityCollection[festivity.tag].NAME;
                }
            }
            if( false === festivity.hasOwnProperty( 'day' ) ) {
                if( FestivityCollection.hasOwnProperty(festivity.tag) && FestivityCollection[festivity.tag].hasOwnProperty( 'DAY' ) ) {
                    festivity.day = FestivityCollection[festivity.tag].DAY;
                }
            }
            if( false === festivity.hasOwnProperty( 'month' ) ) {
                console.log( 'festivity does not have a month property, now trying to retrieve info...' );
                if( FestivityCollection.hasOwnProperty(festivity.tag) && FestivityCollection[festivity.tag].hasOwnProperty( 'MONTH' ) ) {
                    festivity.month = FestivityCollection[festivity.tag].MONTH;
                } else {
                    console.log( 'could not retrieve month info...' );
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            formRow += `<hr><div class="d-flex justify-content-left"><h4 class="data-group-title">${FormControls.title}</h4>`;
            if(FormControls.action.description === RowAction.CreateNew.description) {
                if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
                    formRow += `<button type="button" class="ms-auto btn btn-info strtotime-toggle-btn active" data-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="true" autocomplete="off"><i class="fas fa-comment me-2"></i>explicatory date</button>`;
                } else {
                    formRow += `<button type="button" class="ms-auto btn btn-secondary strtotime-toggle-btn" data-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="false" autocomplete="off"><i class="fas fa-comment-slash me-2"></i>explicatory date</button>`;
                }
            }
            formRow += `</div>`;
        }

        formRow += `<div class="row">`;

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
        <select class="form-select litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple"${FormControls.settings.colorField === false ? ' readonly' : ''} />
        <option value="white"${festivity !== null && selectedColors.includes("white") ? ' selected' : '' }>${messages[ "white" ].toUpperCase()}</option>
        <option value="red"${festivity !== null && selectedColors.includes("red") ? ' selected' : '' }>${messages[ "red" ].toUpperCase()}</option>
        <option value="purple"${festivity !== null && selectedColors.includes("purple") ? ' selected' : '' }>${messages[ "purple" ].toUpperCase()}</option>
        <option value="green"${festivity !== null && selectedColors.includes("green") ? ' selected' : '' }>${messages[ "green" ].toUpperCase()}</option>
        </select>
        </div>`;

        if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}StrToTime">Explicatory date</label>
            <select class="form-select litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}StrToTime-dayOfTheWeek">`;
            for (let i = 0; i < 7; i++ ) {
                let dayOfTheWeek = new Date(Date.UTC(2000, 0, 2+i));
                formRow += `<option value="${daysOfTheWeek[i]}"${festivity.strtotime.dayOfTheWeek === daysOfTheWeek[i] ? ' selected' : '' }>${weekdayFormatter.format(dayOfTheWeek)}</option>`;
            }
            formRow += `</select>
            <select class="form-select litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}StrToTime-relativeTime">
                <option value="before"${festivity.strtotime.relativeTime === 'before' ? ' selected' : ''}>before</option>
                <option value="after"${festivity.strtotime.relativeTime === 'after' ? ' selected' : ''}>after</option>
            </select>
            <input list="existingFestivitiesList" value="${festivity.strtotime.festivityKey}" class="form-control litEvent litEventStrtotime existingFestivityName" id="onTheFly${FormControls.uniqid}StrToTime-festivityKey" required>
            </div>`;
        } else {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Day">${messages[ "Day" ]}</label>
            <input type="number" min="1" max="31" value="${festivity !== null && festivity.day}" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day"${FormControls.settings.dayField === false ?  'readonly' : '' } />
            </div>`;

            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Month">${messages[ "Month" ]}</label>
            <select class="form-select litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month"${FormControls.settings.monthField === false ?  'readonly' : '' } >`;

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
            formRow +=  messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:2});
        }

        if (FormControls.settings.commonFieldShow) {
            formRow += messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:3});
        }

        if (FormControls.settings.readingsField) {
            formRow += `<div class="col-sm-5"><table>`;
            formRow += READINGS_PROPERTIES.map((prop,idx) => `<tr><td><label for="onTheFly${FormControls.uniqid}Readings_${prop}">${prop}</label></td><td style="padding-left: 15px;"><input type="text" class="form-control litEvent litEventReadings litEventReadings_${prop}" id="onTheFly${FormControls.uniqid}Readings_${prop}" ${festivity === null || typeof festivity.common === 'undefined' || festivity.common !== 'Proper' ? `disabled` : ``} value="${festivity && festivity?.common === 'Proper' ? festivity.readings[prop] : ''}" /></td>${idx===0 ? `<td rowspan="5" style="vertical-align: top;"><i class="fas fa-info-circle m-2" style="color: #4e73df;" title="When the festivity has its own Proper, then Readings can be defined, otherwise the readings will depend on the Common"></i>` : ``}</td></tr>`).join('');
            formRow += `</table></div>`;
        }

        if (FormControls.settings.reasonField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Reason">${messages[ "Reason" ]}</label>
            <input type="text" value="${festivity?.reason||''}" class="form-control litEvent litEventReason" id="onTheFly${FormControls.uniqid}Reason" />
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
            formRow += `<div class="form-group col-sm-4">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${messages[ "Decree Langs" ]}<i class="ms-2 fas fa-info-circle" title="Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? decreeLangs.join(',') : ''}" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }

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

const { LOCALE } = messages;
const jsLocale = LOCALE.replace('_','-');
const monthsOfThirty = [SEPTEMBER, APRIL, JUNE, NOVEMBER];
const daysOfTheWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayFormatter = new Intl.DateTimeFormat(jsLocale, { weekday: "long" });

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
    'makeDoctor': [ 'tag', 'name', 'color', 'grade', 'day', 'month' ],
    'setProperty': [ 'tag', 'name', 'grade', 'day', 'month' ],
    'moveFestivity': [ 'tag', 'name', 'day', 'month', 'missal', 'reason' ],
    'createNew': [ 'tag', 'name', 'color', 'grade', 'day', 'month', 'strtotime', 'common' ] //'readings' is only expected for createNew when common=Proper
};

const setFormSettings = action => {
    switch( action ) {
        case 'designateDoctorButton':
            //nobreak
        case RowAction.MakeDoctor.description:
            FormControls.settings.tagField = false;
            FormControls.settings.nameField = true;
            FormControls.settings.gradeFieldShow = false;
            FormControls.settings.gradeField = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField = false;
            FormControls.settings.monthField = false;
            FormControls.settings.untilYearField = true;
            FormControls.settings.colorField = false;
            FormControls.settings.reasonField = false;
            FormControls.settings.readingsField = false;
            FormControls.title = messages[ 'Designate Doctor' ];
            FormControls.action = RowAction.MakeDoctor;
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
            FormControls.settings.reasonField = true;
            FormControls.settings.readingsField = false;
            FormControls.title = messages[ 'Move festivity' ];
            FormControls.action = RowAction.MoveFestivity;
            break;
        case 'newFestivityFromExistingButton':
        case RowAction.CreateNewFromExisting.description:
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

const createPropriumDeTemporeTable = ( data ) => {
        const $theadRow = $('#jsonDataTbl thead tr');
        $theadRow.empty();
        const keys = Object.keys( data );
        const thh = Object.keys( data[keys[0]] );
        $theadRow.append(`<th>TAG</th>`);
        thh.forEach(el => {
            $theadRow.append(`<th>${el}</th>`);
        });
        let tbodyHtmlStrr = '';
        keys.forEach(tag => {
            //let $tr = $('<tr>');
            let dataTag = data[tag];
            let trHtmlStr = '';
            thh.forEach(el => {
                let tbodyHtmlStr = '';
                let dataTagEl = dataTag[el];
                const readingsProps = Object.keys( dataTagEl );
                readingsProps.forEach(prop => {
                    tbodyHtmlStr += `<tr><td>${prop}</td><td>${dataTagEl[prop]}</td></tr>`;
                });
                trHtmlStr += `<td contenteditable="false"><table><tbody>${tbodyHtmlStr}</tbody></table></td>`;
            });
            //$('#jsonDataTbl tbody').append( `<tr><td contenteditable="false">${tag}</td>${trHtmlStr}</tr>` );
            tbodyHtmlStrr += `<tr><td contenteditable="false">${tag}</td>${trHtmlStr}</tr>`;
        });
        $('#jsonDataTbl').addClass('propriumDeTempore');
        $('#jsonDataTbl tbody').append( tbodyHtmlStrr );
    },
    createPropriumDeSanctisTable = ( data, jsonFile ) => {
        const $theadRow = $('#jsonDataTbl thead tr');
        $theadRow.empty();
        $('#jsonDataTbl').removeClass('propriumDeTempore');
        let n;
        if( jsonFile.includes('USA') || jsonFile.includes('ITALY') ) {
            $('#jsonDataTbl').addClass('nationalCalendar');
            n = [10, 10, 14, 0, 5, 0, 25, 0, 6, 30];
        } else {
            $('#jsonDataTbl').removeClass('nationalCalendar');
            n = [10, 10, 14, 5, 25, 0, 6, 30];
        }
        const keys = Object.keys( data[0] );
        keys.forEach((el,i) => {
            $theadRow.append(`<th class="sticky-top" style="width: ${n[i]}%;" scope="col">${el}</th>`);
        });
        let tbodyHtmlStrr = '';
        data.forEach(row => {
            //let $tr = $('<tr>');
            let trHtmlStr = '<tr>';
            keys.forEach(prop => {
                if( Array.isArray( row[prop] ) ) {
                    //console.log(`we have an array in key ${prop}:`);
                    //console.log( row[prop] );
                    trHtmlStr += `<td contenteditable="false">${row[prop].join(',')}</td>`;
                }
                else if( typeof row[prop] === 'object' ) {
                    //console.log(`we have an object in key ${prop}:`);
                    //console.log( row[prop] );
                    let htmlStr = '<table><tbody>';
                    Object.keys( row[prop] ).forEach(title => {
                        let val = row[prop][title];
                        if( typeof val === 'object' ) {
                            htmlStr += `<tr><td colspan="2" style="text-align:center;font-weight:bold;border:0;background-color:lightgray;">${title}</td></tr>`;
                            Object.keys( val ).forEach(title2 => {
                                let val2 = val[title2];
                                htmlStr += `<tr><td>${title2}</td><td contenteditable="false">${val2}</td></tr>`;
                            })
                        } else {
                            htmlStr += `<tr><td>${title}</td><td contenteditable="false">${val}</td></tr>`;
                        }
                    });
                    htmlStr += '</tbody></table>';
                    trHtmlStr += `<td contenteditable="false">${htmlStr}</td>`;
                } else {
                    trHtmlStr += `<td contenteditable="false">${row[prop]}</td>`;
                }
            });
            trHtmlStr += '</tr>';
            tbodyHtmlStrr += trHtmlStr;
        });
        $('#jsonDataTbl tbody').append(tbodyHtmlStrr);
    },
    createMemorialsFromDecreesInterface = ( data ) => {
        $('#saveDataBtn').prop('disabled', true);
        $('#tableContainer,#addColumnBtn').hide();
        $('#memorialsFromDecreesBtnGrp').fadeIn( 'slow' );
        $('#memorialsFromDecreesForm').empty();
        data.forEach((el) => {
            let currentUniqid = FormControls.uniqid;
            //console.log( el );
            el.Festivity = lowercaseKeys( el.Festivity );
            let existingFestivityTag = el.Festivity.hasOwnProperty( 'tag' ) ? el.Festivity.tag : null;
            if( el.Metadata.action === RowAction.CreateNew.description && FestivityCollection.hasOwnProperty( existingFestivityTag ) ) {
                el.Metadata.action = RowAction.CreateNewFromExisting.description;
            }
            setFormSettings( el.Metadata.action );
            if( el.Metadata.action === RowAction.SetProperty.description ) {
                setFormSettingsForProperty( el.Metadata.property );
            }

            $row = $(FormControls.CreateDoctorRow( el ));
            $('#memorialsFromDecreesForm').append($row);

            $formrow = $row.find('.form-group').closest('.row');
            $formrow.data('action', el.Metadata.action).attr('data-action', el.Metadata.action);
            if( el.Metadata.action === RowAction.SetProperty.description ) {
                $formrow.data('prop', el.Metadata.property).attr('data-prop', el.Metadata.property);
            }
            if( el.Festivity.hasOwnProperty('common') && el.Festivity.common.includes('Proper') ) {
                $formrow.find('.litEventReadings').prop('disabled', false);
            }

            if( false === el.Festivity.hasOwnProperty( 'color' ) ) {
                if( existingFestivityTag !== null ) {
                    el.Festivity.color = FestivityCollection[existingFestivityTag].COLOR;
                }
            }

            if( el.Festivity.hasOwnProperty( 'color' ) ) {
                let colorVal = Array.isArray(el.Festivity.color) ? el.Festivity.color : el.Festivity.color.split(',');
                $row.find('.litEventColor').multiselect({
                    buttonWidth: '100%',
                    buttonClass: 'form-select',
                    templates: {
                        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                    },
                }).multiselect('deselectAll', false).multiselect('select', colorVal);
                if(FormControls.settings.colorField === false) {
                    $row.find('.litEventColor').multiselect('disable');
                }
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

            if(FormControls.settings.monthField === false) {
                $row.find(`#onTheFly${currentUniqid}Month > option[value]:not([value=${el.Festivity.month}])`).prop('disabled',true);
            }
        });

    }
/*
$(document).ready(() => {

});
*/

const jsonFileData = {};

$(document).on('change', '#jsonFileSelect', () => {
    let baseJsonFile = $('#jsonFileSelect :selected').text();
    let jsonFile = $('#jsonFileSelect').val();
    let jsonFileFull = '';
    if( isStaging ) {
        jsonFileFull = 'includes/readJSONFile.php?filename=https://litcal.johnromanodorazio.com/' + jsonFile;
    } else {
        jsonFileFull = './' + jsonFile;
    }
    //console.log(baseJsonFile);
    if( false === jsonFileData.hasOwnProperty( baseJsonFile ) ) {
        $.getJSON(jsonFileFull, data => {
            //console.log(data);
            console.log('storing data in script cache...');
            if(/memorialsFromDecrees\.json$/.test(jsonFile)) {
                // b - a for reverse sort: this is what we want, so the newer decrees will be on top
                data.sort((a,b) => b.Metadata.sinceYear - a.Metadata.sinceYear);
            }
            jsonFileData[baseJsonFile] = data;
            handleJsonFileData( data, jsonFile );
        });
    } else {
        console.log( 'using stored data to avoid making another ajax call uselessly...' );
        let data = jsonFileData[baseJsonFile];
        handleJsonFileData( data, jsonFile );
    }
});

const handleJsonFileData = ( data, jsonFile ) => {
    if(/memorialsFromDecrees\.json$/.test(jsonFile)) {
        $('#jsonDataTbl tbody').empty();
        createMemorialsFromDecreesInterface( data );
    } else {
        if( $( '#memorialsFromDecreesBtnGrp' ).is(':hidden') === false ) {
            $('#memorialsFromDecreesForm').empty();
            $('#memorialsFromDecreesBtnGrp').fadeOut( 'slow' );
        }
        if( $( '#tableContainer' ).is(':hidden') ) {
            console.log( 'tableContainer was hidden, now showing in order to repopulate...' );
            $( '#tableContainer,#addColumnBtn' ).show(200, () => { createPropriumTable( data, jsonFile ) } );
        } else {
            createPropriumTable( data, jsonFile );
        }
    }
}

const createPropriumTable = ( data, jsonFile ) => {
    $('#saveDataBtn').prop('disabled', false);
    $('#jsonDataTbl tbody').empty();
    if( Array.isArray(data) ) {
        createPropriumDeSanctisTable( data, jsonFile );
    } else {
        createPropriumDeTemporeTable( data );
    }
}

//$(document).on('dblclick', '#jsonDataTbl th,#jsonDataTbl td', ev => {
$(document).on('dblclick', '#jsonDataTbl table tr td:nth-child(2)', ev => {
    $(ev.currentTarget).attr('contenteditable',true).addClass('bg-white').focus();
});

$(document).on('keydown', '#jsonDataTbl th,#jsonDataTbl td', ev => {
    const key = ev.key;
    if((key === "Enter" || key === "Escape") && $(ev.currentTarget).hasClass('bg-white') ) {
        ev.preventDefault();
        $(ev.currentTarget).attr('contenteditable',false).removeClass('bg-white');
    }
});

$(document).on('click', '#addColumnBtn', () => {
    let column = prompt("Please enter the name for the new column (this will become the JSON property name):");

    $('#jsonDataTbl thead tr').append(`<th>${column}</th>`);
    $('#jsonDataTbl tbody tr').each((i,el) => { $(el).append('<td></td>'); });
});

$(document).on('click', '#saveDataBtn', () => {
    const jsonData = [];
    const props = [];
    const intProps = [ "MONTH", "DAY", "GRADE" ];

    $('#jsonDataTbl th').each((i,el) => {
        props.push($(el).text());
    });
    $('#jsonDataTbl > tbody > tr').each((i,el) => {
        let newRow = {};
        $(el).find('> td').each((i,el) => {
            if( $(el).find('table').length ) {
                let subJson = {};
                let tdCount = $(el).find('table tr:first-child td').length;
                if( tdCount > 1 ) {
                    $(el).find('table tr').each((j,em) => {
                        let prop    = $(em).find('td:first-child').text();
                        let val     = $(em).find('td:last-child').text().replaceAll(' ',' ');
                        val = val.replaceAll('\r','');
                        subJson[prop] = val;
                    });
                }
                else if( tdCount === 1 ) {
                    let currentProperty;
                    $(el).find('table tr').each((j,em) => {
                        if( $(em).find('td').length === 1 ) {
                            currentProperty = $(em).find('td').text();
                            subJson[currentProperty] = {};
                        }
                        else {
                            let prop    = $(em).find('td:first-child').text();
                            let val     = $(em).find('td:last-child').text().replaceAll(' ',' ');
                            val = val.replaceAll('\r','');
                            subJson[currentProperty][prop] = val;
                        }
                    });
                }
                newRow[props[i]] = subJson;
            } else {
                if(intProps.includes(props[i])) {
                        newRow[props[i]] = parseInt($(el).text());
                    } else{
                        newRow[props[i]] = $(el).text();
                    }
                }
        });
        jsonData.push(newRow);
    });
    //navigator.clipboard.writeText( JSON.stringify(jsonData) );
    //alert('JSON data copied to clipboard');
    let filename = $('#jsonFileSelect').val();
    //JSON.stringify will automatically use DOS/Windows syntax \r\n
    //which git will see as a change in the code from what was previously just \n
    //so let's make sure we get rid of all \r's
    let jsonstring = JSON.stringify(jsonData, null, 4).replace(/[\r]/g, '');
    console.log('now writing jsonData to file ' + filename);
    console.log(jsonData);
    $.ajax({
        method: 'POST',
        url: 'includes/writeJSONFile.php',
        data: { filename: filename, jsondata: jsonstring },
        success: data => {
            //if( data === 'SUCCESS' )
            console.log(data);
            alert('Data was written with ' + data);
        }
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
    FormControls.settings.decreeLangMapField = true; //TODO: check how this should be set, it's different than extending.js
    setFormSettings( ev.currentTarget.id );
    if( ev.currentTarget.id === 'setPropertyButton' ) {
        propertyToChange = $('#propertyToChange').val();
        setFormSettingsForProperty( propertyToChange );
    }

    if( existingFestivityTag !== '' ) {
        $row = $(FormControls.CreateDoctorRow( existingFestivityTag ));
    } else {
        $row = $(FormControls.CreateDoctorRow());
    }
    $('#memorialsFromDecreesForm').prepend($row);
    $modal.modal('hide');
    $row.find('.form-group').closest('.row').data('action', FormControls.action.description).attr('data-action', FormControls.action.description);
    if( FormControls.action.description === RowAction.SetProperty.description ) {
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
        case 'makeDoctorActionPrompt':
            $('#designateDoctorButton').prop('disabled', disabledState);
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


$(document).on('click', '.strtotime-toggle-btn', ev => {
    let uniqid = $(ev.currentTarget).attr('data-row-uniqid');
    let currentJsonFile = $('#jsonFileSelect :selected').text();
    let tag = $(`#onTheFly${uniqid}Tag`).val();
    let festivityData = jsonFileData[currentJsonFile].filter(el => el.Festivity.tag === tag)[0];
    let strtotime = typeof festivityData !== 'undefined' && festivityData.Metadata.hasOwnProperty('strtotime') ? festivityData.Metadata.strtotime : {};
    // console.log('festivityData = ');
    // console.log(festivityData);
    // console.log('strtotime = ');
    // console.log(strtotime);
    if( $(ev.currentTarget).attr('aria-pressed') === 'true' ) {
        $(ev.currentTarget).find('i').removeClass('fa-comment-slash').addClass('fa-comment');
        $(ev.currentTarget).removeClass('btn-secondary').addClass('btn-info');
        $(`#onTheFly${uniqid}Month`).closest('.form-group').remove();
        let $dayFormGroup = $(`#onTheFly${uniqid}Day`).closest('.form-group');
        let $strToTimeFormGroup = `<label for="onTheFly${uniqid}StrToTime-dayOfTheWeek">Explicatory date</label>
        <select class="form-select litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime-dayOfTheWeek">`;
        for (let i = 0; i < 7; i++ ) {
            let dayOfTheWeek = new Date(Date.UTC(2000, 0, 2+i));
            $strToTimeFormGroup += `<option value="${daysOfTheWeek[i]}"${strtotime.hasOwnProperty('dayOfTheWeek') && strtotime.dayOfTheWeek === daysOfTheWeek[i] ? ' selected': ''}>${weekdayFormatter.format(dayOfTheWeek)}</option>`;
        }
        $strToTimeFormGroup += `</select>
        <select class="form-select litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime-relativeTime">
            <option value="before"${strtotime.hasOwnProperty('relativeTime') && strtotime.relativeTime === 'before' ? ' selected': ''}>before</option>
            <option value="after"${strtotime.hasOwnProperty('relativeTime') && strtotime.relativeTime === 'after' ? ' selected': ''}>after</option>
        </select>
        <input list="existingFestivitiesList" class="form-control litEvent litEventStrtotime existingFestivityName" id="onTheFly${uniqid}StrToTime-festivityKey" value="${strtotime.hasOwnProperty('festivityKey') ? strtotime.festivityKey : ''}" required>`;
        $dayFormGroup.empty().removeClass('col-sm-1').addClass('col-sm-2').append($strToTimeFormGroup);
    } else {
        $(ev.currentTarget).find('i').removeClass('fa-comment').addClass('fa-comment-slash');
        $(ev.currentTarget).removeClass('btn-info').addClass('btn-secondary');
        let $strToTimeFormGroup = $(`#onTheFly${uniqid}StrToTime-dayOfTheWeek`).closest('.form-group');
        $strToTimeFormGroup.empty().removeClass('col-sm-2').addClass('col-sm-1').append(
            `<label for="onTheFly${uniqid}Day">Day</label>
            <input type="number" min="1" max="31" value="${typeof festivityData !== 'undefined' && festivityData.Festivity.hasOwnProperty('day') ? festivityData.Festivity.day : ''}" class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`
        );
        let formRow = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${messages[ "Month" ]}</label>
        <select class="form-select litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
        let formatter = new Intl.DateTimeFormat(jsLocale, { month: 'long' });
        for (let i = 0; i < 12; i++) {
            let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
            formRow += `<option value=${i + 1}${typeof festivityData !== 'undefined' && festivityData.Festivity.hasOwnProperty('month') && festivityData.Festivity.month === i+1 ? ' selected' : ''}>${formatter.format(month)}</option>`;
        }
        formRow += `</select>
        </div>`;
        $strToTimeFormGroup.after(formRow);
    }
});
