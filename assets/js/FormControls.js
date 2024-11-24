
/**
 * An enumeration of the months of the year.
 * @readonly
 * @enum {(1|2|3|4|5|6|7|8|9|10|11|12)}
 */
const Month = Object.freeze({
    JANUARY:    1,
    FEBRUARY:   2,
    MARCH:      3,
    APRIL:      4,
    MAY:        5,
    JUNE:       6,
    JULY:       7,
    AUGUST:     8,
    SEPTEMBER:  9,
    OCTOBER:    10,
    NOVEMBER:   11,
    DECEMBER:   12
});

/**
 * Thirty days hath September = 9, April = 4, June = 6, and November = 11. Useful for setting the limit on the day input.
 * @readonly
 * @type {[Month.SEPTEMBER, Month.APRIL, Month.JUNE, Month.NOVEMBER]}
 */
const MonthsOfThirty = Object.freeze([Month.SEPTEMBER, Month.APRIL, Month.JUNE, Month.NOVEMBER]);


/**
 * English names of the seven days of the week indexed from 0 to 7, used to check or set the value of the strtotime property in liturgical events.
 * @readonly
 * @type {['Sunday'|'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday']}
 */
const DaysOfTheWeek = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

/**
 * A mapping of festivity ranks to numerical values for sorting purposes.
 * @readonly
 * @enum {(7|6|5|4|3|2|1|0)}
 * @property {Number} HIGHERSOLEMNITY - Higher solemnity (7)
 * @property {Number} SOLEMNITY - Solemnity (6)
 * @property {Number} FEASTLORD - Feast of the Lord (5)
 * @property {Number} FEAST - Feast (4)
 * @property {Number} MEMORIAL - Memorial (3)
 * @property {Number} OPTIONALMEMORIAL - Optional memorial (2)
 * @property {Number} COMMEMORATION - Commemoration (1)
 * @property {Number} WEEKDAY - Weekday (0)
 */
const Rank = Object.freeze({
    HIGHERSOLEMNITY:  7,
    SOLEMNITY:        6,
    FEASTLORD:        5,
    FEAST:            4,
    MEMORIAL:         3,
    OPTIONALMEMORIAL: 2,
    COMMEMORATION:    1,
    WEEKDAY:          0
});


/**
 * An enumeration of possible actions that can be used to create a form row.
 * @readonly
 * @enum {('makePatron'|'makeDoctor'|'setProperty'|'moveFestivity'|'createNew'|'createNewFromExisting')} RowAction
 * @property {String} MakePatron - Designate a festivity as a patron saint (makePatron)
 * @property {String} MakeDoctor - Designate a festivity as a doctor of the Church (makeDoctor)
 * @property {String} SetProperty - Set the name, grade, color, or readings of a festivity (setProperty)
 * @property {String} MoveFestivity - Move a festivity to a different date (moveFestivity)
 * @property {String} CreateNew - Create a new festivity (createNew)
 * @property {String} CreateNewFromExisting - Create a new festivity using an existing one as a template (createNewFromExisting), only for diocesan calendars
 */
const RowAction = Object.freeze({
    MakePatron:            'makePatron',
    MakeDoctor:            'makeDoctor',
    SetProperty:           'setProperty',
    MoveFestivity:         'moveFestivity',
    CreateNew:             'createNew',
    CreateNewFromExisting: 'createNewFromExisting'
});

/**
 * An enumeration of possible form row titles based on the RowAction. Produces the string key for localization purposes.
 * @readonly
 * @enum {('Designate patron'|'Designate Doctor'|'Change name or grade'|'Move festivity'|'New festivity'|'New festivity')} RowActionTitle
 * @property {String} RowAction.MakePatron - Designate a festivity as a patron saint ('Designate patron')
 * @property {String} RowAction.MakeDoctor - Designate a festivity as a doctor of the Church ('Designate Doctor')
 * @property {String} RowAction.SetProperty - Set the name, grade, color, or readings of a festivity ('Change name or grade')
 * @property {String} RowAction.MoveFestivity - Move a festivity to a different date ('Move festivity')
 * @property {String} RowAction.CreateNew - Create a new festivity ('New festivity')
 * @property {String} RowAction.CreateNewFromExisting - Create a new festivity using an existing one as a template ('New festivity')
 */
const RowActionTitle = Object.freeze({
    [RowAction.MakePatron]:            'Designate patron',
    [RowAction.MakeDoctor]:            'Designate Doctor',
    [RowAction.SetProperty]:           'Change name or grade',
    [RowAction.MoveFestivity]:         'Move festivity',
    [RowAction.CreateNew]:             'New festivity',
    [RowAction.CreateNewFromExisting]: 'New festivity',
});

/**
 * Properties that are relevant for Mass readings.
 * @readonly
 * @type {['first_reading', 'responsorial_psalm', 'second_reading', 'alleluia_verse', 'gospel']}
 */
const readingsProperties = Object.freeze([
    "first_reading",
    "responsorial_psalm",
    "second_reading",
    "alleluia_verse",
    "gospel"
]);

/**
 * The properties of the `LitCal` object that should be treated as integers.
 * @readonly
 * @type {['day', 'month', 'grade', 'since_year', 'until_year']}
 */
const integerProperties = Object.freeze([ 'day', 'month', 'grade', 'since_year', 'until_year' ]);

/**
 * The properties of the `LitCal` object that are expected to be present in the JSON payload of each action.
 * @readonly
 * @type {Object<RowAction, string[]>}
 * @property {[ 'event_key', 'name', 'color', 'grade', 'day', 'month' ]} [RowAction.MakePatron] - The properties to expect in the JSON payload for the "makePatron" action.
 * @property {[ 'event_key', 'name', 'grade', 'day', 'month' ]} [RowAction.SetProperty] - The properties to expect in the JSON payload for the "setProperty" action.
 * @property {[ 'event_key', 'name', 'day', 'month', 'missal', 'reason' ]} [RowAction.MoveFestivity] - The properties to expect in the JSON payload for the "moveFestivity" action.
 * @property {[ 'event_key', 'name', 'color', 'grade', 'day', 'month', 'strtotime', 'common' ]} [RowAction.CreateNew] - The properties to expect in the JSON payload for the "createNew" action.
 */
const payloadProperties = Object.freeze({
    [RowAction.MakePatron]:    Object.freeze([ 'event_key', 'name', 'color', 'grade', 'day', 'month' ]),
    [RowAction.SetProperty]:   Object.freeze([ 'event_key', 'name', 'grade', 'day', 'month' ]),
    [RowAction.MoveFestivity]: Object.freeze([ 'event_key', 'name', 'day', 'month', 'missal', 'reason' ]),
    [RowAction.CreateNew]:     Object.freeze([ 'event_key', 'name', 'color', 'grade', 'day', 'month', 'strtotime', 'common' ]) //'readings' is only expected for createNew when common=Proper
});

/**
 * The properties of the `LitCal` object that are related to the metadata of a festivity / liturgical event.
 * @readonly
 * @type {['missal', 'reason']}
 */
const metadataProperties = Object.freeze([ 'missal', 'reason' ]);



/**
 * A class containing static methods and properties used to create form controls.
 * @class
 * @property {Number} uniqid - a unique id for the form elements
 * @property {Object} settings - an object containing settings for the form controls
 * @property {RowAction?} action - sets the fields of the form row according to the action that the form row intends to take
 * @property {RowActionTitle?} title - the localizable title of the form row based on the action being taken
 * @property {String?} jsLocale - the current locale used for localizing form elements
 * @property {Intl.DateTimeFormat?} weekdayFormatter - the formatter for the weekday
 * @property {Number?} index - the index of the form row, which is stored in the submitted form data in order to be able to recreate the exact order for form rows
 * @property {Function} CreateFestivityRow - a function that creates a new form row for a liturgical event
 * @property {Function} CreatePatronRow - a function that creates a new form row for a patron saint
 * @property {Function} CreateDoctorRow - a function that creates a new form row for a doctor of the church
 */
class FormControls {
    /**
     * A unique id for the form elements. This is used to create distinct form field names, which is important when creating multiple form rows dynamically.
     * @type {Number}
     * @static
     */
    static uniqid = 0;

    /**
     * An object containing settings for the form controls. The properties of this object determine whether a given form field is shown or not, or in some cases whether it is enabled.
     * @type {Object}
     * @property {Boolean} nameField - whether the form field for the name of the festivity is shown
     * @property {Boolean} dayField - whether the form field for the day of the festivity is shown
     * @property {Boolean} monthField - whether the form field for the month of the festivity is shown
     * @property {Boolean} colorField - whether the form field for the color of the festivity is shown
     * @property {Boolean} gradeField - whether the form field for the grade of the festivity is enabled
     * @property {Boolean} commonField - whether the form field for the common of the festivity is enabled
     * @property {Boolean} gradeFieldShow - whether the grade field is shown
     * @property {Boolean} commonFieldShow - whether the common field is shown
     * @property {Boolean} fromYearField - whether the form field for the year that the festivity starts is shown
     * @property {Boolean} untilYearField - whether the form field for the year that the festivity ends is shown
     * @property {Boolean} tagField - whether the form field for the tag of the festivity is shown
     * @property {Boolean} decreeURLField - whether the form field for the url of the decree on which the festivity is based is shown
     * @property {Boolean} decreeLangMapField - whether the form field for the language map of the decree on which the festivity is based is shown
     * @property {Boolean} reasonField - whether the form field for the reason for which the festivity is being moved is shown
     * @property {Boolean} missalField - whether the form field for the missal on which the festivity is based is shown
     * @property {Boolean} strtotimeField - whether the form field for the relative date of the festivity (in PHP strtotime format) is shown
     * @static
     */
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
        untilYearField: true, //defaults to false in admin.js
        tagField: false,
        decreeURLField: false,
        decreeLangMapField: false,
        reasonField: false,
        missalField: false,
        strtotimeField: false
    }

    /**
     * The action that the form will perform, e.g. RowAction.MakePatron, RowAction.MakeDoctor, RowAction.SetProperty, RowAction.MoveFestivity, RowAction.CreateNew, or RowAction.CreateNewFromExisting.
     * @type {RowAction?}
     * @static
     */
    static action = null;

    /**
     * The localized title of the action being performed, e.g. RowActionTitle[RowAction.MakePatron], RowActionTitle[RowAction.MakeDoctor], RowActionTitle[RowAction.SetProperty], RowActionTitle[RowAction.MoveFestivity], RowActionTitle[RowAction.CreateNew], or RowActionTitle[RowAction.CreateNewFromExisting].
     * @type {RowActionTitle?}
     * @static
     */
    static title = null;

    /**
     * The current locale used for localizing form elements.
     * @type {String?}
     * @static
     * @example "en" for English, "es" for Spanish, "de" for German, etc.
     */
    static jsLocale = null;

    /**
     * An object used to format the weekday in the date picker.
     * It must be an instance of the Intl.DateTimeFormat class.
     * @type {Intl.DateTimeFormat?}
     * @static
     * @example new Intl.DateTimeFormat('en', { weekday: 'long' }) for English.
     */
    static weekdayFormatter = null;

    /**
     * The index of the form row, which is stored in the submitted form data in order to be able to recreate the exact order for form rows.
     * @type {Number?}
     * @static
     */
    static index = null;

    /**
     * Creates a form row for a new festivity / liturgical event.
     * It contains fields for name, day, month, common, color, since_year and until_year.
     * The fields shown depend on the settings in FormControls.settings.
     * @returns {string} The HTML for the form row.
     * @static
     */
    static CreateFestivityRow() {
        let formRow = '';

        if (FormControls.title !== null) {
            formRow += `<div class="mt-4 d-flex justify-content-left data-group-title"><h4 class="data-group-title">${FormControls.title}</h4></div>`;
        }

        formRow += `<div class="row gx-2 align-items-baseline">`;

        if (FormControls.settings.nameField) {
            formRow += `<div class="form-group col-sm-3">
            <label for="onTheFly${FormControls.uniqid}Name">${Messages[ "Name" ]}</label><input type="text" class="form-control litEvent litEventName" id="onTheFly${FormControls.uniqid}Name" data-valuewas="" />
            <div class="invalid-feedback">This same celebration was already defined elsewhere. Please remove it first where it is defined, then you can define it here.</div>
            </div>`;
        }

        if (FormControls.settings.dayField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Day">${Messages[ "Day" ]}</label><input type="number" min="1" max="31" value="1" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day" />
            </div>`;
        }

        if (FormControls.settings.monthField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Month"><span class="month-label">${Messages[ "Month" ]}</span><div class="form-check form-check-inline form-switch ms-2 ps-5 border border-secondary bg-light" title="switch on for mobile celebration as opposed to fixed date">
                <label class="form-check-label me-1" for="onTheFly${FormControls.uniqid}StrtotimeSwitch">Mobile</label>
                <input class="form-check-input litEvent litEventStrtotimeSwitch" type="checkbox" data-bs-toggle="toggle" data-bs-size="xs" data-bs-onstyle="info" data-bs-offstyle="dark" role="switch" id="onTheFly${FormControls.uniqid}StrtotimeSwitch">
            </div></label>
            <select class="form-select litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month">`;

            let formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
            for (let i = 0; i < 12; i++) {
                let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                formRow += `<option value=${i + 1}>${formatter.format(month)}</option>`;
            }

            formRow += `</select>
            </div>`;
        }

        if(FormControls.settings.strtotimeField) {
            formRow += `<div class="form-group col-sm-3">
            <label for="onTheFly${FormControls.uniqid}Strtotime"><span class="month-label">Explicatory date</span><div class="form-check form-check-inline form-switch ms-2 ps-5 border border-secondary bg-light" title="switch on for mobile celebration as opposed to fixed date">
                <label class="form-check-label me-1" for="onTheFly${FormControls.uniqid}StrtotimeSwitch">Mobile</label>
                <input class="form-check-input litEvent litEventStrtotimeSwitch" type="checkbox" data-bs-toggle="toggle" data-bs-size="xs" data-bs-onstyle="info" data-bs-offstyle="dark" role="switch" id="onTheFly${FormControls.uniqid}StrtotimeSwitch">
            </div></label>
            <input type="text" class="form-control litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}Strtotime" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" />
            </div>`;
        }

        if (FormControls.settings.commonField) {
            formRow += Messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:3});
        }

        if (FormControls.settings.colorField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Color">${Messages[ "Liturgical color" ]}</label>
            <select class="form-select litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple" />
            <option value="white" selected>${Messages[ "white" ].toUpperCase()}</option>
            <option value="red">${Messages[ "red" ].toUpperCase()}</option>
            <option value="purple">${Messages[ "purple" ].toUpperCase()}</option>
            <option value="green">${Messages[ "green" ].toUpperCase()}</option>
            </select>
            </div>`;
        }

        if (FormControls.settings.fromYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}FromYear">${Messages[ "Since" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventSinceYear" id="onTheFly${FormControls.uniqid}FromYear" value="1970" />
            </div>`;
        }

        if (FormControls.settings.untilYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}UntilYear">${Messages[ "Until" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventUntilYear" id="onTheFly${FormControls.uniqid}UntilYear" value="" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow.replaceAll('    ','').replace(/(?:\r\n|\r|\n)/g,'');
    }

    /**
     * Creates a form row for a new patron saint celebration.
     * The fields shown depend on the settings in FormControls.settings.
     * @param {string|object} [element=null] - Either a string (the event_key of the FestivityCollection) or an object with the festivity and its metadata.
     * @returns {string} The HTML for the form row.
     * @static
     */
    static CreatePatronRow(element = null) {
        let formRow = '';
        let festivity = null;
        if( element !== null ) {
            if( typeof element === 'string' ) {
                festivity = FestivityCollection[element];
                festivity.event_key = element;
                festivity.since_year = 1970;
                //festivity.until_year = null;
                festivity.url = '';
                festivity.url_lang_map = {};
            }
            if( typeof element === 'object' ) {
                festivity = {
                    ...element.festivity,
                    ...element.metadata
                };
                if( festivity.hasOwnProperty( 'until_year' ) === false ) {
                    //festivity.until_year = null;
                }
                if( festivity.hasOwnProperty( 'color' ) === false ) {
                    festivity.color = FestivityCollection.hasOwnProperty(festivity.event_key) ? FestivityCollection[festivity.event_key].color : [];
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            formRow += `<div class="mt-4 d-flex justify-content-left data-group-title"><h4 class="data-group-title">${FormControls.title}</h4>`;
            if(FormControls.action.description === RowAction.CreateNew) {
                if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
                    formRow += `<button type="button" class="ms-auto btn btn-info strtotime-toggle-btn active" data-bs-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="true" autocomplete="off"><i class="fas fa-comment me-2"></i>explicatory date</button>`;
                } else {
                    formRow += `<button type="button" class="ms-auto btn btn-info strtotime-toggle-btn" data-bs-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="false" autocomplete="off"><i class="fas fa-comment-slash me-2"></i>explicatory date</button>`;
                }
            }
            formRow += `</div>`;
        }

        formRow += `<div class="row gx-2 align-items-baseline">`;

        formRow += `<div class="form-group col-sm-6">`;
        if(FormControls.settings.tagField === false){
            formRow += `<input type="hidden" class="litEventTag" id="onTheFly${FormControls.uniqid}Tag" value="${festivity !== null ? festivity.event_key : ''}" />`;
        }
        formRow += `<label for="onTheFly${FormControls.uniqid}Name">${Messages[ "Name" ]}</label>
        <input type="text" class="form-control litEvent litEventName${festivity !== null && typeof festivity.name==='undefined' ? ` is-invalid` : ``}" id="onTheFly${FormControls.uniqid}Name" value="${festivity !== null ? festivity.name : ''}"${FormControls.settings.nameField === false ? ' readonly' : ''} />
        <div class="invalid-feedback">There is no locale data for this celebration in the current locale. Perhaps try a different locale?.</div>
        </div>`;

        if (FormControls.settings.fromYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}FromYear">${Messages[ "Since" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventSinceYear" id="onTheFly${FormControls.uniqid}FromYear" value="${festivity !== null ? festivity.since_year : ''}" />
            </div>`;
        }

        if (FormControls.settings.untilYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}UntilYear">${Messages[ "Until" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventUntilYear" id="onTheFly${FormControls.uniqid}UntilYear" value="${festivity !== null ? festivity.until_year : ''}" />
            </div>`;
        }

        let selectedColors = festivity !== null ? (Array.isArray(festivity.color) ? festivity.color : festivity.color.split(',')) : [];
        formRow += `<div class="form-group col-sm-2">
        <label for="onTheFly${FormControls.uniqid}Color">${Messages[ "Liturgical color" ]}</label>
        <select class="form-select litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple"${FormControls.settings.colorField === false ? ' readonly' : ''} />
        <option value="white"${festivity !== null && selectedColors.includes("white") ? ' selected' : '' }>${Messages[ "white" ].toUpperCase()}</option>
        <option value="red"${festivity !== null && selectedColors.includes("red") ? ' selected' : '' }>${Messages[ "red" ].toUpperCase()}</option>
        <option value="purple"${festivity !== null && selectedColors.includes("purple") ? ' selected' : '' }>${Messages[ "purple" ].toUpperCase()}</option>
        <option value="green"${festivity !== null && selectedColors.includes("green") ? ' selected' : '' }>${Messages[ "green" ].toUpperCase()}</option>
        </select>
        </div>`;

        if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Strtotime">Explicatory date</label>
            <input type="text" value="${festivity.strtotime}" placeholder="e.g. fourth thursday of november" title="e.g. fourth thursday of november | php strtotime syntax supported here!" class="form-control litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}Strtotime" />
            </div>`;
        } else {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Day">${Messages[ "Day" ]}</label>
            <input type="number" min="1" max="31" value="${festivity !== null && festivity.day}" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day"${FormControls.settings.dayField === false ?  'readonly' : '' } />
            </div>`;

            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Month">${Messages[ "Month" ]}</label>
            <select class="form-select litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month"${FormControls.settings.monthField === false ?  'readonly' : '' } >`;

            let formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
            for (let i = 0; i < 12; i++) {
                let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                formRow += `<option value=${i + 1}${festivity !== null && festivity.month === i+1 ? ' selected' : '' }>${formatter.format(month)}</option>`;
            }

            formRow += `</select>
            </div>`;
        }

        if (FormControls.settings.tagField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Tag">${Messages[ "Tag" ]}</label>
            <input type="text" value="${festivity !== null ? festivity.event_key : ''}" class="form-control litEvent litEventTag" id="onTheFly${FormControls.uniqid}Tag" />
            </div>`;
        }

        if (FormControls.settings.gradeFieldShow) {
            formRow +=  Messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:4});
        }

        if (FormControls.settings.commonFieldShow) {
            formRow += Messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:6});
        }

        if (FormControls.settings.readingsField) {
            formRow += `<div class="col-sm-6"><table>`;
            formRow += readingsProperties.map((prop,idx) => `<tr><td><label for="onTheFly${FormControls.uniqid}Readings_${prop}">${prop}</label></td><td style="padding-left: 15px;"><input type="text" class="form-control litEvent litEventReadings litEventReadings_${prop}" id="onTheFly${FormControls.uniqid}Readings_${prop}" ${festivity === null || typeof festivity.common === 'undefined' || festivity.common !== 'Proper' ? `disabled` : ``} value="${festivity && festivity?.common === 'Proper' ? festivity.readings[prop] : ''}" /></td>${idx===0 ? `<td rowspan="5" style="vertical-align: top;"><i class="fas fa-info-circle m-2" style="color: #4e73df;" title="When the festivity has its own Proper, then Readings can be defined, otherwise the readings will depend on the Common"></i></td>` : ``}</tr>`).join('');
            formRow += `</table></div>`;
        }

        if (FormControls.settings.reasonField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Reason">${Messages[ "Reason" ]}</label>
            <input type="text" value="${festivity?.reason||''}" class="form-control litEvent litEventReason" id="onTheFly${FormControls.uniqid}Reason" />
            </div>`;
        }

        if (FormControls.settings.missalField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Missal">${Messages[ "Missal" ]}</label>
            <select class="form-select litEvent litEventMissal" id="onTheFly${FormControls.uniqid}Missal">`;
            //console.log(Object.values( FormControls.missals ).map(({value,name}) => `<option class="list-group-item" value="${value}">${name}</option>`));
            formRow += FormControls.missals.map(({missal_id,name}) => `<option class="list-group-item" value="${missal_id}">${name}</option>`).join('');
            formRow += `</select>
            </div>`;
        }

        if(FormControls.settings.decreeURLField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${Messages[ "Decree URL" ]}<i class="ms-2 fas fa-info-circle" title="Use %s in place of the language code if using a language mapping"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.url !== 'undefined' ? festivity.url : ''}" id="onTheFly${FormControls.uniqid}DecreeURL" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapField) {
            let decreeLangs = festivity !== null && typeof festivity.url_lang_map !== 'undefined' ? Object.keys(festivity.url_lang_map).map(key => key+'='+festivity.url_lang_map[key] ) : null;
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${Messages[ "Decree Langs" ]}<i class="ms-2 fas fa-info-circle" title="Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.url_lang_map !== 'undefined' ? decreeLangs.join(',') : ''}" id="onTheFly${FormControls.uniqid}DecreeLangs" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow.replaceAll('    ','').replace(/(?:\r\n|\r|\n)/g,'');
    }

    /**
     * Creates a form row for a new doctor of the Church celebration.
     * The fields shown depend on the settings in FormControls.settings.
     * @param {string|object} [element=null] - Either a string (the event_key of the FestivityCollection) or an object with the festivity and its metadata.
     * @returns {string} The HTML for the form row.
     * @static
     */
    static CreateDoctorRow(element = null) {
        let formRow = '';
        let festivity = null;
        if( element !== null ) {
            if( typeof element === 'string' ) {
                festivity.event_key = element;
                festivity.since_year = 1970;
                festivity.until_year = '';
                festivity.url = '';
                festivity.url_lang_map = {};
            }
            if( typeof element === 'object' ) {
                festivity = {
                    ...element.festivity,
                    ...element.metadata
                };
                if( false === festivity.hasOwnProperty( 'until_year' ) ) {
                    festivity.until_year = '';
                }
                if( false === festivity.hasOwnProperty( 'color' ) ) {
                    festivity.color = FestivityCollection.hasOwnProperty(festivity.event_key) && FestivityCollection[festivity.event_key].hasOwnProperty( 'color' ) ? FestivityCollection[festivity.event_key].color : [];
                }
            }
            if( false === festivity.hasOwnProperty( 'name' ) ) {
                if( FestivityCollection.hasOwnProperty( festivity.event_key ) && FestivityCollection[festivity.event_key].hasOwnProperty( 'name' ) ) {
                    festivity.name = FestivityCollection[festivity.event_key].name;
                }
            }
            if( false === festivity.hasOwnProperty( 'day' ) ) {
                if( FestivityCollection.hasOwnProperty(festivity.event_key) && FestivityCollection[festivity.event_key].hasOwnProperty( 'day' ) ) {
                    festivity.day = FestivityCollection[festivity.event_key].day;
                }
            }
            if( false === festivity.hasOwnProperty( 'month' ) ) {
                console.log( 'festivity does not have a month property, now trying to retrieve info...' );
                if( FestivityCollection.hasOwnProperty(festivity.event_key) && FestivityCollection[festivity.event_key].hasOwnProperty( 'month' ) ) {
                    festivity.month = FestivityCollection[festivity.event_key].month;
                } else {
                    console.log( 'could not retrieve month info...' );
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            formRow += `<hr><div class="mt-4 d-flex justify-content-left"><h4 class="data-group-title">${FormControls.title}</h4>`;
            if(FormControls.action.description === RowAction.CreateNew) {
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
            formRow += `<input type="hidden" class="litEventTag" id="onTheFly${FormControls.uniqid}Tag" value="${festivity !== null ? festivity.event_key : ''}" />`;
        }
        formRow += `<label for="onTheFly${FormControls.uniqid}Name">${Messages[ "Name" ]}</label>
        <input type="text" class="form-control litEvent litEventName${festivity !== null && typeof festivity.name==='undefined' ? ` is-invalid` : ``}" id="onTheFly${FormControls.uniqid}Name" value="${festivity !== null ? festivity.name : ''}"${FormControls.settings.nameField === false ? ' readonly' : ''} />
        <div class="invalid-feedback">There is no locale data for this celebration in the current locale. Perhaps try a different locale?.</div>
        </div>`;

        if (FormControls.settings.fromYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}FromYear">${Messages[ "Since" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventFromYear" id="onTheFly${FormControls.uniqid}FromYear" value="${festivity !== null ? festivity.since_year : ''}" />
            </div>`;
        }

        if (FormControls.settings.untilYearField) {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}UntilYear">${Messages[ "Until" ]}</label>
            <input type="number" min="1582" max="9999" class="form-control litEvent litEventUntilYear" id="onTheFly${FormControls.uniqid}UntilYear" value="${festivity !== null ? festivity.until_year : ''}" />
            </div>`;
        }

        let selectedColors = festivity !== null ? (Array.isArray(festivity.color) ? festivity.color : festivity.color.split(',')) : [];
        formRow += `<div class="form-group col-sm-2">
        <label for="onTheFly${FormControls.uniqid}Color">${Messages[ "Liturgical color" ]}</label>
        <select class="form-select litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple"${FormControls.settings.colorField === false ? ' readonly' : ''} />
        <option value="white"${festivity !== null && selectedColors.includes("white") ? ' selected' : '' }>${Messages[ "white" ].toUpperCase()}</option>
        <option value="red"${festivity !== null && selectedColors.includes("red") ? ' selected' : '' }>${Messages[ "red" ].toUpperCase()}</option>
        <option value="purple"${festivity !== null && selectedColors.includes("purple") ? ' selected' : '' }>${Messages[ "purple" ].toUpperCase()}</option>
        <option value="green"${festivity !== null && selectedColors.includes("green") ? ' selected' : '' }>${Messages[ "green" ].toUpperCase()}</option>
        </select>
        </div>`;

        if( festivity !== null && festivity.hasOwnProperty( 'strtotime' ) ) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}StrToTime">Explicatory date</label>
            <select class="form-select litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}StrToTime-dayOfTheWeek">`;
            for (let i = 0; i < 7; i++ ) {
                let dayOfTheWeek = new Date(Date.UTC(2000, 0, 2+i));
                formRow += `<option value="${DaysOfTheWeek[i]}"${festivity.strtotime.day_of_the_week === DaysOfTheWeek[i] ? ' selected' : '' }>${FormControls.weekdayFormatter.format(dayOfTheWeek)}</option>`;
            }
            formRow += `</select>
            <select class="form-select litEvent litEventStrtotime" id="onTheFly${FormControls.uniqid}StrToTime-relativeTime">
                <option value="before"${festivity.strtotime.relative_time === 'before' ? ' selected' : ''}>before</option>
                <option value="after"${festivity.strtotime.relative_time === 'after' ? ' selected' : ''}>after</option>
            </select>
            <input list="existingFestivitiesList" value="${festivity.strtotime.festivity_key}" class="form-control litEvent litEventStrtotime existingFestivityName" id="onTheFly${FormControls.uniqid}StrToTime-festivityKey" required>
            </div>`;
        } else {
            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Day">${Messages[ "Day" ]}</label>
            <input type="number" min="1" max="31" value="${festivity !== null && festivity.day}" class="form-control litEvent litEventDay" id="onTheFly${FormControls.uniqid}Day"${FormControls.settings.dayField === false ?  'readonly' : '' } />
            </div>`;

            formRow += `<div class="form-group col-sm-1">
            <label for="onTheFly${FormControls.uniqid}Month">${Messages[ "Month" ]}</label>
            <select class="form-select litEvent litEventMonth" id="onTheFly${FormControls.uniqid}Month"${FormControls.settings.monthField === false ?  'readonly' : '' } >`;

            let formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
            for (let i = 0; i < 12; i++) {
                let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                formRow += `<option value=${i + 1}${festivity !== null && festivity.month === i+1 ? ' selected' : '' }>${formatter.format(month)}</option>`;
            }

            formRow += `</select>
            </div>`;
        }

        if (FormControls.settings.tagField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}Tag">${Messages[ "Tag" ]}</label>
            <input type="text" value="${festivity !== null ? festivity.event_key : ''}" class="form-control litEvent litEventTag" id="onTheFly${FormControls.uniqid}Tag" />
            </div>`;
        }

        if (FormControls.settings.gradeFieldShow) {
            formRow +=  Messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:2});
        }

        if (FormControls.settings.commonFieldShow) {
            formRow += Messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:3});
        }

        if (FormControls.settings.readingsField) {
            formRow += `<div class="col-sm-5"><table>`;
            formRow += readingsProperties.map((prop,idx) => `<tr><td><label for="onTheFly${FormControls.uniqid}Readings_${prop}">${prop}</label></td><td style="padding-left: 15px;"><input type="text" class="form-control litEvent litEventReadings litEventReadings_${prop}" id="onTheFly${FormControls.uniqid}Readings_${prop}" ${festivity === null || typeof festivity.common === 'undefined' || festivity.common !== 'Proper' ? `disabled` : ``} value="${festivity && festivity?.common === 'Proper' ? festivity.readings[prop] : ''}" /></td>${idx===0 ? `<td rowspan="5" style="vertical-align: top;"><i class="fas fa-info-circle m-2" style="color: #4e73df;" title="When the festivity has its own Proper, then Readings can be defined, otherwise the readings will depend on the Common"></i>` : ``}</td></tr>`).join('');
            formRow += `</table></div>`;
        }

        if (FormControls.settings.reasonField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Reason">${Messages[ "Reason" ]}</label>
            <input type="text" value="${festivity?.reason||''}" class="form-control litEvent litEventReason" id="onTheFly${FormControls.uniqid}Reason" />
            </div>`;
        }

        if(FormControls.settings.decreeURLField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${Messages[ "Decree URL" ]}<i class="ms-2 fas fa-info-circle" title="Use %s in place of the language code if using a language mapping"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.url !== 'undefined' ? festivity.url : ''}" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapField) {
            let decreeLangs = festivity !== null && typeof festivity.url_lang_map !== 'undefined' ? Object.keys(festivity.url_lang_map).map(key => key+'='+festivity.url_lang_map[key] ) : null;
            formRow += `<div class="form-group col-sm-4">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${Messages[ "Decree Langs" ]}<i class="ms-2 fas fa-info-circle" title="Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.url_lang_map !== 'undefined' ? decreeLangs.join(',') : ''}" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow.replaceAll('    ','').replace(/(?:\r\n|\r|\n)/g,'');
    }

}

/**
 * Sets the FormControls settings based on the given action.
 * @param {RowAction|string} action - the RowAction type action, or related action as given by a frontend action button
 */
const setFormSettings = action => {
    switch( action ) {
        case 'designateDoctorButton':
            //nobreak
        case RowAction.MakeDoctor:
            FormControls.settings.tagField        = false;
            FormControls.settings.nameField       = true;
            FormControls.settings.gradeFieldShow  = false;
            FormControls.settings.gradeField      = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = false;
            FormControls.settings.monthField      = false;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.reasonField     = false;
            FormControls.settings.readingsField   = false;
            FormControls.title  = Messages[ RowActionTitle[RowAction.MakeDoctor] ];
            FormControls.action = RowAction.MakeDoctor;
            break;
        case 'designatePatronButton':
            //nobreak
        case RowAction.MakePatron:
            FormControls.settings.tagField        = false;
            FormControls.settings.nameField       = true;
            FormControls.settings.gradeFieldShow  = true;
            FormControls.settings.gradeField      = true;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = false;
            FormControls.settings.monthField      = false;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.missalField     = false;
            FormControls.settings.reasonField     = false;
            FormControls.settings.readingsField   = false;
            FormControls.title  =  Messages[ RowActionTitle[RowAction.MakePatron] ];
            FormControls.action = RowAction.MakePatron;
            break;
        case 'setPropertyButton':
            //nobreak
        case RowAction.SetProperty:
            FormControls.settings.tagField        = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = false;
            FormControls.settings.monthField      = false;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.missalField     = false;
            FormControls.settings.reasonField     = false;
            FormControls.settings.readingsField   = false;
            FormControls.title  = Messages[ RowActionTitle[RowAction.SetProperty] ];
            FormControls.action = RowAction.SetProperty;
            break;
        case 'moveFestivityButton':
            //nobreak
        case RowAction.MoveFestivity:
            FormControls.settings.tagField        = false;
            FormControls.settings.nameField       = false;
            FormControls.settings.gradeFieldShow  = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = true;
            FormControls.settings.monthField      = true;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.missalField     = true;
            FormControls.settings.reasonField     = true;
            FormControls.settings.readingsField   = false;
            FormControls.title  = Messages[ RowActionTitle[RowAction.MoveFestivity] ];
            FormControls.action = RowAction.MoveFestivity;
            break;
        case 'newFestivityFromExistingButton':
            //nobreak
        case RowAction.CreateNewFromExisting:
            FormControls.settings.tagField        = false;
            FormControls.settings.nameField       = false;
            FormControls.settings.gradeFieldShow  = true;
            FormControls.settings.commonFieldShow = true;
            FormControls.settings.gradeField      = false; //defaults to true in admin.js
            FormControls.settings.commonField     = false; //defaults to true in admin.js
            FormControls.settings.dayField        = false; //defaults to true in admin.js
            FormControls.settings.monthField      = false; //defaults to true in admin.js
            FormControls.settings.untilYearField  = true; //defaults to true in admin.js
            FormControls.settings.colorField      = false; //defaults to true in admin.js
            FormControls.settings.missalField     = false;
            FormControls.settings.reasonField     = false;
            FormControls.settings.readingsField   = true;
            FormControls.title  = Messages[ RowActionTitle[RowAction.CreateNew] ];
            FormControls.action = RowAction.CreateNew;
            break;
        case 'newFestivityExNovoButton':
            //nobreak
        case RowAction.CreateNew:
            FormControls.settings.tagField        = true;
            FormControls.settings.nameField       = true;
            FormControls.settings.gradeFieldShow  = true;
            FormControls.settings.commonFieldShow = true;
            FormControls.settings.gradeField      = true;
            FormControls.settings.commonField     = true;
            FormControls.settings.dayField        = true;
            FormControls.settings.monthField      = true;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = true;
            FormControls.settings.missalField     = false;
            FormControls.settings.reasonField     = false;
            FormControls.settings.readingsField   = true;
            FormControls.title = Messages[ RowActionTitle[RowAction.CreateNew] ];
            FormControls.action = RowAction.CreateNew;
            break;
    }
}

/**
 * Sets the FormControls settings for a given property.
 * @param {string} property - name of the property being set, one of 'name' or 'grade'
 */
const setFormSettingsForProperty = property => {
    switch(property) {
        case 'name':
            FormControls.settings.nameField      = true;
            FormControls.settings.gradeFieldShow = false;
            break;
        case 'grade':
            FormControls.settings.nameField      = false;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.gradeField     = true;
            break;
    }
}


/**
 * Represents a liturgical event.
 * @class
 * @property {string} name - Name of the liturgical event.
 * @property {string} color - Color of the liturgical event.
 * @property {number} grade - Grade of the liturgical event.
 * @property {string} common - Common of the liturgical event.
 * @property {number} day - Day of the month of the liturgical event.
 * @property {number} month - Month of the liturgical event.
 */
class LitEvent {
    /**
     * Creates a new LitEvent.
     * @param {string} [name=""] - Name of the liturgical event.
     * @param {string} [color=""] - Color of the liturgical event.
     * @param {number} [grade=0] - Grade of the liturgical event.
     * @param {string} [common=""] - Common of the liturgical event.
     * @param {number} [day=1] - Day of the month of the liturgical event.
     * @param {number} [month=1] - Month of the liturgical event.
     */
    constructor(name = "", color = "", grade = 0, common = "", day = 1, month = 1 ) {
        this.name   = name;
        this.color  = color;
        this.grade  = grade;
        this.common = common;
        this.day    = day;
        this.month  = month;
    }
}

/**
 * Configures the multiselect for the liturgical common field of a festivity / liturgical event row.
 * @param {jQuery} $row - The jQuery object of the row to configure the multiselect for. If null, the function will configure all rows.
 * @param {Array<string>} common - The values to select in the multiselect. If null, the function will select all values.
 */
const setCommonMultiselect = ($row=null,common=null) => {
    let $litEventCommon;
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

/**
 * Returns a new object with the same values as the passed in object, but with
 * all property names converted to lowercase.
 * @param {Object} obj - The object to convert
 * @returns {Object} - The new object with lowercase property names
 */
const lowercaseKeys = obj =>
  Object.keys(obj).reduce((acc, key) => {
    acc[key.toLowerCase()] = obj[key];
    return acc;
  }, {});



export {
    FormControls,
    RowAction,
    Rank,
    LitEvent,
    Month,
    MonthsOfThirty,
    DaysOfTheWeek,
    readingsProperties,
    integerProperties,
    payloadProperties,
    metadataProperties,
    setFormSettings,
    setFormSettingsForProperty,
    setCommonMultiselect,
    lowercaseKeys
};
