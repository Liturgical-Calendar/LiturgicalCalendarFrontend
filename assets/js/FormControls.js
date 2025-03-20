import {
    Festivity
} from './Festivity.js';


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

const getMonthMaxDay = (month) => month === Month.FEBRUARY ? 28 : (MonthsOfThirty.includes(month) ? 30 : 31);


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
 * @property {String} SetNameProperty - Set the name of a festivity (setNameProperty)
 * @property {String} SetGradeProperty - Set the grade of a festivity (setGradeProperty)
 * @property {String} MoveFestivity - Move a festivity to a different date (moveFestivity)
 * @property {String} CreateNew - Create a new festivity (createNew)
 * @property {String} CreateNewFromExisting - Create a new festivity using an existing one as a template (createNewFromExisting), only for diocesan calendars
 */
const RowAction = Object.freeze({
    MakePatron:            'makePatron',
    MakeDoctor:            'makeDoctor',
    SetProperty:           'setProperty',
    SetNameProperty:       'setNameProperty',
    SetGradeProperty:      'setGradeProperty',
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
 * @property {String} RowAction.SetNameProperty - Set the name of a festivity ('Change name')
 * @property {String} RowAction.SetGradeProperty - Set the grade of a festivity ('Change grade')
 * @property {String} RowAction.MoveFestivity - Move a festivity to a different date ('Move festivity')
 * @property {String} RowAction.CreateNew - Create a new festivity ('New festivity')
 * @property {String} RowAction.CreateNewFromExisting - Create a new festivity using an existing one as a template ('New festivity')
 */
const RowActionTitle = Object.freeze({
    [RowAction.MakePatron]:            'Designate patron',
    [RowAction.MakeDoctor]:            'Designate Doctor',
    [RowAction.SetProperty]:           'Change name or grade',
    [RowAction.SetNameProperty]:       'Change name',
    [RowAction.SetGradeProperty]:      'Change grade',
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
    [RowAction.MakePatron]:    Object.freeze([ 'event_key', 'name', 'grade' ]),
    [RowAction.SetProperty]:   Object.freeze([ 'event_key', 'name', 'grade' ]),
    [RowAction.MoveFestivity]: Object.freeze([ 'event_key', 'day', 'month', 'missal', 'reason' ]),
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
 * @property {Function} CreateDiocesanFormRow - a function that creates a new form row for a liturgical event
 * @property {Function} CreateRegionalFormRow - a function that creates a new form row for a patron saint
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
     * @property {Boolean} nameField - whether the form field for the name of the festivity is editable (true) or readonly (false)
     * @property {Boolean} dayField - whether the form field for the day of the festivity is editable (true) or readonly (false)
     * @property {Boolean} monthField - whether the form field for the month of the festivity is editable (true) or readonly (false)
     * @property {Boolean} colorField - whether the form field for the color of the festivity is editable (true) or readonly (false)
     * @property {Boolean} gradeField - whether the form field for the grade of the festivity is editable (true) or readonly (false)
     * @property {Boolean} commonField - whether the form field for the common of the festivity is editable (true) or readonly (false)
     * @property {Boolean} gradeFieldShow - whether the grade field is shown at all
     * @property {Boolean} commonFieldShow - whether the common field is shown at all
     * @property {Boolean} fromYearField - whether the form field for the year that the festivity starts is editable (true) or readonly (false)
     * @property {Boolean} untilYearField - whether the form field for the year that the festivity ends is editable (true) or readonly (false)
     * @property {Boolean} eventKeyField - whether the form field for the event_key of the festivity is shown and editable or hidden (seems to make more sense to hide than set readonly)
     * @property {Boolean} decreeURLFieldShow - whether the form field for the url of the decree on which the festivity is based is shown
     * @property {Boolean} decreeLangMapFieldShow - whether the form field for the language map of the decree on which the festivity is based is shown
     * @property {Boolean} reasonFieldShow - whether the form field for the reason for which the festivity is being moved is shown
     * @property {Boolean} readingsFieldShow - whether the form field for the readings of the festivity is shown
     * @property {Boolean} missalFieldShow - whether the form field for the missal on which the festivity is based is shown
     * @property {Boolean} strtotimeFieldShow - whether the form field for the relative date of the festivity (in PHP strtotime format) is shown
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
        eventKeyField: false,
        decreeURLFieldShow: false,
        decreeLangMapFieldShow: false,
        reasonFieldShow: false,
        readingsFieldShow: false,
        missalFieldShow: false,
        strtotimeFieldShow: false
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
     * Creates a form row for a new festivity / liturgical event on a diocesan calendar form.
     * It contains fields for name, day, month, common, color, since_year and until_year.
     * The fields shown depend on the settings in FormControls.settings.
     * Used in diocesan calendar forms.
     *
     * @returns {string} The HTML for the form row.
     * @static
     */
    static CreateDiocesanFormRow() {
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
            <label for="onTheFly${FormControls.uniqid}Month" class="d-flex justify-content-between align-items-end"><span class="month-label">${Messages[ "Month" ]}</span><div class="form-check form-check-inline form-switch me-0 ps-5 pe-2 border border-2 border-secondary rounded bg-light" title="switch on for mobile celebration as opposed to fixed date">
                <label class="form-check-label" for="onTheFly${FormControls.uniqid}StrtotimeSwitch">Mobile</label>
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

        if(FormControls.settings.strtotimeFieldShow) {
            formRow += `<div class="form-group col-sm-3">
            <label for="onTheFly${FormControls.uniqid}Strtotime" class="d-flex justify-content-between align-items-end"><span class="month-label">Relative date</span><div class="form-check form-check-inline form-switch me-0 ps-5 pe-2 border border-2 border-secondary rounded bg-light" title="switch on for mobile celebration as opposed to fixed date">
                <label class="form-check-label" for="onTheFly${FormControls.uniqid}StrtotimeSwitch">Mobile</label>
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
     * Creates a form row for a national calendar or wider region celebration, e.g. a Patron saint.
     * The fields shown depend on the settings in FormControls.settings.
     *
     * @param {string|object} [element=null] - Either a string (the event_key of the FestivityCollection) or an object with the festivity and its metadata.
     * @returns {DocumentFragment} The HTML Document Fragment for the form row, consisting in a "Title" div and a "Form Controls Row" div.
     * @static
     */
    static CreateRegionalFormRow(element = null) {
        const fragment = document.createDocumentFragment();
        let festivity = null;
        if( element !== null ) {
            if (element instanceof Festivity) {
                console.log('element instanceof Festivity');
                festivity = element;
                festivity.url = '';
                festivity.url_lang_map = {};
            }
            else if ( typeof element === 'string' ) {
                // rather than filter the FestivityCollection, we should be either getting from EventsCollection
                // based on EventsLoader.lastRequestPath and EventsLoader.lastRequestLocale,
                // or we should be able to pass a festivity object directly to  the CreateRegionalFormRow method
                festivity = FestivityCollection.filter(item => item.event_key === element)[0];
                festivity.url = '';
                festivity.url_lang_map = {};
            }
            else if ( typeof element === 'object' && 'festivity' in element && 'metadata' in element ) {
                festivity = {
                    ...element.festivity,
                    ...element.metadata
                };
                if (FestivityCollectionKeys.includes(festivity.event_key)) {
                    const knownEvent = FestivityCollection.filter(fest => fest.event_key === festivity.event_key)[0];
                    if(  false === 'name' in festivity && 'name' in knownEvent ) {
                        festivity.name = knownEvent.name;
                    }
                    if ( false === 'strtotime' in festivity ) {
                        if ( false === 'day' in festivity && 'day' in knownEvent ) {
                            festivity.day = knownEvent.day;
                        }
                        if ( false === 'month' in festivity && 'month' in knownEvent ) {
                            festivity.month = knownEvent.month;
                        }
                    }
                    if ( false === 'grade' in festivity && 'grade' in knownEvent ) {
                        festivity.grade = knownEvent.grade;
                    }
                    if ( false === 'color' in festivity && 'color' in knownEvent ) {
                        festivity.color = knownEvent.color;
                    }
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            const titleDiv = document.createElement('div');
            titleDiv.className = 'mt-4 d-flex justify-content-between data-group-title';
            const titleH4 = document.createElement('h4');
            titleH4.className = 'data-group-title';
            titleH4.innerText = FormControls.title;
            titleDiv.appendChild(titleH4);

            if(FormControls.action === RowAction.CreateNew) {
                const isStrToTime = festivity !== null && 'strtotime' in festivity;
                const radioGroupDiv = document.createElement('div');
                radioGroupDiv.className = 'btn-group ms-auto';
                radioGroupDiv.setAttribute('role', 'group');
                radioGroupDiv.setAttribute('aria-label', 'Exact date or relative strtotime toggle group');

                const exactDateRadio = document.createElement('input');
                exactDateRadio.type = 'radio';
                exactDateRadio.className = 'btn-check datetype-toggle-btn exact-date';
                exactDateRadio.name = `btnradio${FormControls.uniqid}`;
                exactDateRadio.id = `exactDate${FormControls.uniqid}`;
                exactDateRadio.autocomplete = 'off';
                exactDateRadio.setAttribute('data-row-uniqid', FormControls.uniqid);
                exactDateRadio.checked = false === isStrToTime;
                radioGroupDiv.appendChild(exactDateRadio);

                const exactDateLabel = document.createElement('label');
                exactDateLabel.className = 'btn btn-outline-info';
                exactDateLabel.setAttribute('for', `exactDate${FormControls.uniqid}`);
                exactDateLabel.title = 'month and day';
                exactDateLabel.innerHTML = `<i class="fas fa-calendar-day me-2"></i>exact date`;
                radioGroupDiv.appendChild(exactDateLabel);

                const relativeDateRadio = document.createElement('input');
                relativeDateRadio.type = 'radio';
                relativeDateRadio.className = 'btn-check datetype-toggle-btn strtotime';
                relativeDateRadio.name = `btnradio${FormControls.uniqid}`;
                relativeDateRadio.id = `relativeDate${FormControls.uniqid}`;
                relativeDateRadio.autocomplete = 'off';
                relativeDateRadio.setAttribute('data-row-uniqid', FormControls.uniqid);
                relativeDateRadio.checked = isStrToTime;
                radioGroupDiv.appendChild(relativeDateRadio);

                const relativeDateLabel = document.createElement('label');
                relativeDateLabel.className = 'btn btn-outline-info';
                relativeDateLabel.setAttribute('for', `relativeDate${FormControls.uniqid}`);
                relativeDateLabel.title = 'php strtotime';
                relativeDateLabel.innerHTML = `relative date<i class="fas fa-comment ms-2"></i>`;
                radioGroupDiv.appendChild(relativeDateLabel);

                titleDiv.appendChild(radioGroupDiv);
            }

            const closeButton = document.createElement('button');
            closeButton.className = 'btn btn-danger ms-2';
            closeButton.title = 'Remove this form row';
            const closeIcon = document.createElement('i');
            closeIcon.className = 'fa fa-times';
            closeButton.appendChild(closeIcon);
            closeButton.addEventListener('click', (event) => {
                const titleRow = event.target.closest('.data-group-title');
                const formRow = titleRow.nextSibling;
                formRow.remove();
                titleRow.remove();
            });
            titleDiv.appendChild(closeButton);

            fragment.appendChild(titleDiv);
        }

        const controlsRow = document.createElement('div');
        controlsRow.className = 'row gx-2 align-items-baseline';

        /**
         * Event Name form group
         * We always have an event name form group
         */
        const eventNameFormGroup = document.createElement('div');
        eventNameFormGroup.className = 'form-group col-sm-6';
        if(FormControls.settings.eventKeyField === false) {
            const eventKeyInput = document.createElement('input');
            eventKeyInput.type = 'hidden';
            eventKeyInput.className = 'litEventEventKey';
            eventKeyInput.id = `onTheFly${FormControls.uniqid}EventKey`;
            eventKeyInput.value = festivity !== null ? festivity.event_key : '';
            eventNameFormGroup.appendChild(eventKeyInput);
        }
        const nameLabel = document.createElement('label');
        nameLabel.for = `onTheFly${FormControls.uniqid}Name`;
        nameLabel.innerText = Messages[ "Name" ];
        eventNameFormGroup.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-control litEvent litEventName';
        nameInput.id = `onTheFly${FormControls.uniqid}Name`;
        nameInput.value = festivity !== null ? festivity.name : '';
        nameInput.readOnly = FormControls.settings.nameField === false;
        eventNameFormGroup.appendChild(nameInput);
        const nameInputInvalidFeedback = document.createElement('div');
        nameInputInvalidFeedback.className = 'invalid-feedback';
        nameInputInvalidFeedback.innerText = 'There is no locale data for this celebration in the current locale. Perhaps try a different locale?.';
        eventNameFormGroup.appendChild(nameInputInvalidFeedback);
        controlsRow.appendChild(eventNameFormGroup);

        /**
         * Since year Form group
         */
        if (FormControls.settings.fromYearField) {
            const fromYearFormGroup = document.createElement('div');
            fromYearFormGroup.className = 'form-group col-sm-1';
            const fromYearLabel = document.createElement('label');
            fromYearLabel.for = `onTheFly${FormControls.uniqid}FromYear`;
            fromYearLabel.innerText = Messages[ "Since" ];
            fromYearFormGroup.appendChild(fromYearLabel);

            const fromYearInput = document.createElement('input');
            fromYearInput.type = 'number';
            fromYearInput.min = 1582; // start of the Gregorian calendar
            fromYearInput.max = 9998; // max date that PHP supports minus one
            fromYearInput.className = 'form-control litEvent litEventSinceYear';
            fromYearInput.id = `onTheFly${FormControls.uniqid}FromYear`;
            fromYearInput.value = festivity?.since_year || 1970;
            fromYearFormGroup.appendChild(fromYearInput);
            controlsRow.appendChild(fromYearFormGroup);
        }

        /**
         * Until year Form group
         */
        if (FormControls.settings.untilYearField) {
            const untilYearFormGroup = document.createElement('div');
            untilYearFormGroup.className = 'form-group col-sm-1';
            const untilYearLabel = document.createElement('label');
            untilYearLabel.for = `onTheFly${FormControls.uniqid}UntilYear`;
            untilYearLabel.innerText = Messages[ "Until" ];
            untilYearFormGroup.appendChild(untilYearLabel);

            const untilYearInput = document.createElement('input');
            untilYearInput.type = 'number';
            untilYearInput.min = festivity?.since_year ? festivity.since_year + 1 : 1583;
            untilYearInput.max = 9999; // max date that PHP supports
            untilYearInput.className = 'form-control litEvent litEventUntilYear';
            untilYearInput.id = `onTheFly${FormControls.uniqid}UntilYear`;
            untilYearInput.value = festivity?.until_year || '';
            untilYearFormGroup.appendChild(untilYearInput);
            controlsRow.appendChild(untilYearFormGroup);
        }

        /**
         * Liturgical color form group
         * We always have a liturgical color form group
         */
        const selectedColors = festivity !== null ? (Array.isArray(festivity.color) ? festivity.color : festivity.color.split(',')) : [];
        const colorFormGroup = document.createElement('div');
        colorFormGroup.className = 'form-group col-sm-2';
        const colorLabel = document.createElement('label');
        colorLabel.for = `onTheFly${FormControls.uniqid}Color`;
        colorLabel.innerText = Messages[ "Liturgical color" ];
        colorFormGroup.appendChild(colorLabel);

        const colorSelect = document.createElement('select');
        colorSelect.className = 'form-select litEvent litEventColor';
        colorSelect.id = `onTheFly${FormControls.uniqid}Color`;
        colorSelect.multiple = 'multiple';
        colorSelect.readOnly = FormControls.settings.colorField === false;

        const whiteOption = document.createElement('option');
        whiteOption.value = 'white';
        whiteOption.innerText = Messages[ "white" ].toUpperCase();
        whiteOption.selected = selectedColors.includes("white");
        colorSelect.appendChild(whiteOption);

        const redOption = document.createElement('option');
        redOption.value = 'red';
        redOption.innerText = Messages[ "red" ].toUpperCase();
        redOption.selected = selectedColors.includes("red");
        colorSelect.appendChild(redOption);

        const purpleOption = document.createElement('option');
        purpleOption.value = 'purple';
        purpleOption.innerText = Messages[ "purple" ].toUpperCase();
        purpleOption.selected = selectedColors.includes("purple");
        colorSelect.appendChild(purpleOption);

        const greenOption = document.createElement('option');
        greenOption.value = 'green';
        greenOption.innerText = Messages[ "green" ].toUpperCase();
        greenOption.selected = selectedColors.includes("green");
        colorSelect.appendChild(greenOption);

        colorFormGroup.appendChild(colorSelect);
        controlsRow.appendChild(colorFormGroup);

        /**
         * Day/month or strtotime form group
         * We always have a day/month or strtotime form group
         */
        const dayFormGroup = document.createElement('div');
        dayFormGroup.setAttribute('data-valuewas', '');

        const dayLabel = document.createElement('label');
        const dayInput = document.createElement('input');
        if( festivity !== null && 'strtotime' in festivity ) {
            dayFormGroup.className = 'form-group col-sm-2';
            dayLabel.for = `onTheFly${FormControls.uniqid}Strtotime`;
            dayLabel.innerText = 'Relative date';
            dayFormGroup.appendChild(dayLabel);

            dayInput.type = 'text';
            dayInput.className = 'form-control litEvent litEventStrtotime';
            dayInput.id = `onTheFly${FormControls.uniqid}Strtotime`;
            dayInput.value = festivity.strtotime;
            dayFormGroup.appendChild(dayInput);
            controlsRow.appendChild(dayFormGroup);
        } else {
            dayFormGroup.className = 'form-group col-sm-1';
            dayLabel.for = `onTheFly${FormControls.uniqid}Day`;
            dayLabel.innerText = Messages[ "Day" ];
            dayFormGroup.appendChild(dayLabel);

            dayInput.type = 'number';
            dayInput.min = 1;
            dayInput.max = festivity !== null ? getMonthMaxDay(festivity.month) : 31;
            dayInput.className = 'form-control litEvent litEventDay';
            dayInput.id = `onTheFly${FormControls.uniqid}Day`;
            dayInput.value = festivity !== null ? festivity.day : '';
            dayFormGroup.appendChild(dayInput);
            controlsRow.appendChild(dayFormGroup);

            const monthFormGroup = document.createElement('div');
            monthFormGroup.className = 'form-group col-sm-1';

            const monthLabel = document.createElement('label');
            monthLabel.for = `onTheFly${FormControls.uniqid}Month`;
            monthLabel.innerText = Messages[ "Month" ];
            monthFormGroup.appendChild(monthLabel);

            const monthSelect = document.createElement('select');
            monthSelect.className = 'form-select litEvent litEventMonth';
            monthSelect.id = `onTheFly${FormControls.uniqid}Month`;
            monthSelect.readOnly = FormControls.settings.monthField === false;

            const formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
            for (let i = 0; i < 12; i++) {
                let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                const monthOption = document.createElement('option');
                monthOption.value = i + 1;
                monthOption.selected = festivity !== null && festivity.month === i+1;
                monthOption.innerText = formatter.format(month);
                monthSelect.appendChild(monthOption);
            }

            monthFormGroup.appendChild(monthSelect);
            controlsRow.appendChild(monthFormGroup);
        }

        /**
         * Event Key form group
         */
        if (FormControls.settings.eventKeyField) {
            const eventKeyFormGroup = document.createElement('div');
            eventKeyFormGroup.className = 'form-group col-sm-2';
            const eventKeyLabel = document.createElement('label');
            eventKeyLabel.for = `onTheFly${FormControls.uniqid}EventKey`;
            eventKeyLabel.innerText = Messages[ "EventKey" ];
            eventKeyFormGroup.appendChild(eventKeyLabel);

            const eventKeyInput = document.createElement('input');
            eventKeyInput.type = 'text';
            eventKeyInput.className = 'form-control litEvent litEventEventKey';
            eventKeyInput.id = `onTheFly${FormControls.uniqid}EventKey`;
            eventKeyInput.value = festivity !== null ? festivity.event_key : '';
            eventKeyFormGroup.appendChild(eventKeyInput);
            controlsRow.appendChild(eventKeyFormGroup);
        }

        /**
         * Liturgical grade form group
         */
        if (FormControls.settings.gradeFieldShow) {
            const range = document.createRange();
            const gradeHtmlFragment = Messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:4});
            const gradeFormGroup = range.createContextualFragment( gradeHtmlFragment );
            controlsRow.appendChild(gradeFormGroup);
        }

        /**
         * Liturgical common form group
         */
        if (FormControls.settings.commonFieldShow) {
            const range = document.createRange();
            const commonHtmlFragment = Messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:6});
            const commonFormGroup = range.createContextualFragment( commonHtmlFragment );
            controlsRow.appendChild(commonFormGroup);
        }

        /**
         * Readings form group
         */
        if (FormControls.settings.readingsFieldShow) {
            const readingsContainer = document.createElement('div');
            readingsContainer.className = 'col-sm-6 mt-2';
            const readingsTable = document.createElement('table');
            readingsProperties.forEach((prop,idx) => {
                const tr = document.createElement('tr');
                const labelCell = document.createElement('td');
                const label = document.createElement('label');
                label.for = `onTheFly${FormControls.uniqid}Readings_${prop}`;
                label.innerText = prop;
                labelCell.appendChild(label);
                tr.appendChild(labelCell);

                const inputCell = document.createElement('td');
                inputCell.style.paddingLeft = '15px';
                const input = document.createElement('input');
                input.type = 'text';
                input.className = `form-control litEvent litEventReadings litEventReadings_${prop}`;
                input.id = `onTheFly${FormControls.uniqid}Readings_${prop}`;
                input.value = festivity && festivity?.common === 'Proper' ? festivity.readings[prop] : '';
                input.disabled = festivity === null || typeof festivity.common === 'undefined' || festivity.common !== 'Proper';
                inputCell.appendChild(input);
                tr.appendChild(inputCell);

                if (idx === 0) {
                    const infoCell = document.createElement('td');
                    infoCell.rowspan = 5;
                    infoCell.style.verticalAlign = 'top';
                    const i = document.createElement('i');
                    i.className = 'fas fa-info-circle m-2';
                    i.style.color = '#4e73df';
                    i.title = "When the festivity has its own Proper, then Readings can be defined, otherwise the readings will depend on the Common.";
                    infoCell.appendChild(i);
                    tr.appendChild(infoCell);
                }
                readingsTable.appendChild(tr);
            });
            readingsContainer.appendChild(readingsTable);
            controlsRow.appendChild(readingsContainer);
        }

        /**
         * Reason form group
         */
        if (FormControls.settings.reasonFieldShow) {
            const reasonFormGroup = document.createElement('div');
            reasonFormGroup.className = 'form-group col-sm-6';
            const reasonLabel = document.createElement('label');
            reasonLabel.for = `onTheFly${FormControls.uniqid}Reason`;
            reasonLabel.innerText = Messages[ "Reason" ];
            reasonFormGroup.appendChild(reasonLabel);

            const reasonInput = document.createElement('input');
            reasonInput.type = 'text';
            reasonInput.className = 'form-control litEvent litEventReason';
            reasonInput.id = `onTheFly${FormControls.uniqid}Reason`;
            reasonInput.value = festivity?.reason || '';
            reasonFormGroup.appendChild(reasonInput);
            controlsRow.appendChild(reasonFormGroup);
        }

        /**
         * Missal form group
         */
        if (FormControls.settings.missalFieldShow) {
            const missalFormGroup = document.createElement('div');
            missalFormGroup.className = 'form-group col-sm-6';
            const missalLabel = document.createElement('label');
            missalLabel.for = `onTheFly${FormControls.uniqid}Missal`;
            missalLabel.innerText = Messages[ "Missal" ];
            missalFormGroup.appendChild(missalLabel);

            const missalSelect = document.createElement('select');
            missalSelect.className = 'form-select litEvent litEventMissal';
            missalSelect.id = `onTheFly${FormControls.uniqid}Missal`;

            FormControls.missals.forEach(({missal_id,name}) => {
                const missalOption = document.createElement('option');
                missalOption.classList.add('list-group-item');
                missalOption.value = missal_id;
                missalOption.innerText = name;
                missalSelect.appendChild(missalOption);
            });

            missalFormGroup.appendChild(missalSelect);
            controlsRow.appendChild(missalFormGroup);
        }

        /**
         * Decree URL form group
         */
        if(FormControls.settings.decreeURLFieldShow) {
            const decreeURLFormGroup = document.createElement('div');
            decreeURLFormGroup.className = 'form-group col-sm-6';
            const decreeURLLabel = document.createElement('label');
            decreeURLLabel.for = `onTheFly${FormControls.uniqid}DecreeURL`;
            decreeURLLabel.innerText = Messages[ "Decree URL" ];
            const i = document.createElement('i');
            i.className = 'fas fa-info-circle ms-2';
            i.title = 'Use %s in place of the language code if using a language mapping';
            decreeURLLabel.appendChild(i);
            decreeURLFormGroup.appendChild(decreeURLLabel);

            const decreeURLInput = document.createElement('input');
            decreeURLInput.type = 'text';
            decreeURLInput.className = 'form-control litEvent litEventDecreeURL';
            decreeURLInput.id = `onTheFly${FormControls.uniqid}DecreeURL`;
            decreeURLInput.value = festivity !== null && typeof festivity.url !== 'undefined' ? festivity.url : '';
            decreeURLFormGroup.appendChild(decreeURLInput);
            controlsRow.appendChild(decreeURLFormGroup);
        }

        /**
         * Decree Langs form group
         */
        if(FormControls.settings.decreeLangMapFieldShow) {
            const decreeLangs = festivity !== null && typeof festivity.url_lang_map !== 'undefined' ? Object.keys(festivity.url_lang_map).map(key => key+'='+festivity.url_lang_map[key] ) : null;
            const decreeLangsFormGroup = document.createElement('div');
            decreeLangsFormGroup.className = 'form-group col-sm-6';
            const decreeLangsLabel = document.createElement('label');
            decreeLangsLabel.for = `onTheFly${FormControls.uniqid}DecreeLangs`;
            decreeLangsLabel.innerText = Messages[ "Decree Langs" ];
            const i = document.createElement('i');
            i.className = 'fas fa-info-circle ms-2';
            i.title = 'Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL';
            decreeLangsLabel.appendChild(i);
            decreeLangsFormGroup.appendChild(decreeLangsLabel);

            const decreeLangsInput = document.createElement('input');
            decreeLangsInput.type = 'text';
            decreeLangsInput.className = 'form-control litEvent litEventDecreeLangs';
            decreeLangsInput.id = `onTheFly${FormControls.uniqid}DecreeLangs`;
            decreeLangsInput.value = festivity !== null && typeof festivity.url_lang_map !== 'undefined' ? decreeLangs.join(',') : '';
            decreeLangsFormGroup.appendChild(decreeLangsInput);
            controlsRow.appendChild(decreeLangsFormGroup);
        }

        fragment.appendChild(controlsRow);
        ++FormControls.uniqid;
        return {fragment, controlsRow};
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
                if( false === 'until_year' in festivity ) {
                    festivity.until_year = '';
                }
            }
            if (FestivityCollectionKeys.includes(festivity.event_key)) {
                let event = FestivityCollection.filter(fest => fest.event_key === festivity.event_key)[0];
                if( false === 'color' in festivity ) {
                    festivity.color = 'color' in event ? event.color : [];
                }
                if( false === 'name' in festivity ) {
                    if( 'name' in event ) {
                        festivity.name = event.name;
                    }
                }
                if( false === 'day' in festivity ) {
                    if( 'day' in event ) {
                        festivity.day = event.day;
                    }
                }
                if( false === 'month' in festivity ) {
                    console.log( 'festivity does not have a month property, now trying to retrieve info...' );
                    if( 'month' in event ) {
                        festivity.month = event.month;
                    }
                     else {
                        console.log( 'could not retrieve month info...' );
                    }
                }
            }
            //console.log(festivity);
        }

        if (FormControls.title !== null) {
            formRow += `<hr><div class="mt-4 d-flex justify-content-left"><h4 class="data-group-title">${FormControls.title}</h4>`;
            if(FormControls.action === RowAction.CreateNew) {
                if( festivity !== null && 'strtotime' in festivity ) {
                    formRow += `<button type="button" class="ms-auto btn btn-info strtotime-toggle-btn active" data-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="true" autocomplete="off"><i class="fas fa-comment me-2"></i>relative date</button>`;
                } else {
                    formRow += `<button type="button" class="ms-auto btn btn-secondary strtotime-toggle-btn" data-toggle="button" data-row-uniqid="${FormControls.uniqid}" aria-pressed="false" autocomplete="off"><i class="fas fa-comment-slash me-2"></i>relative date</button>`;
                }
            }
            formRow += `</div>`;
        }

        formRow += `<div class="row">`;

        formRow += `<div class="form-group col-sm-6">`;
        if(FormControls.settings.eventKeyField === false){
            formRow += `<input type="hidden" class="litEventEventKey" id="onTheFly${FormControls.uniqid}EventKey" value="${festivity !== null ? festivity.event_key : ''}" />`;
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

        if( festivity !== null && 'strtotime' in festivity ) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}StrToTime">Relative date</label>
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

        if (FormControls.settings.eventKeyField) {
            formRow += `<div class="form-group col-sm-2">
            <label for="onTheFly${FormControls.uniqid}EventKey">${Messages[ "EventKey" ]}</label>
            <input type="text" value="${festivity !== null ? festivity.event_key : ''}" class="form-control litEvent litEventEventKey" id="onTheFly${FormControls.uniqid}EventKey" />
            </div>`;
        }

        if (FormControls.settings.gradeFieldShow) {
            formRow +=  Messages.gradeTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:2});
        }

        if (FormControls.settings.commonFieldShow) {
            formRow += Messages.commonsTemplate.formatUnicorn({uniqid:FormControls.uniqid,colWidth:3});
        }

        if (FormControls.settings.readingsFieldShow) {
            formRow += `<div class="col-sm-5"><table>`;
            formRow += readingsProperties.map((prop,idx) => `<tr><td><label for="onTheFly${FormControls.uniqid}Readings_${prop}">${prop}</label></td><td style="padding-left: 15px;"><input type="text" class="form-control litEvent litEventReadings litEventReadings_${prop}" id="onTheFly${FormControls.uniqid}Readings_${prop}" ${festivity === null || typeof festivity.common === 'undefined' || festivity.common !== 'Proper' ? `disabled` : ``} value="${festivity && festivity?.common === 'Proper' ? festivity.readings[prop] : ''}" /></td>${idx===0 ? `<td rowspan="5" style="vertical-align: top;"><i class="fas fa-info-circle m-2" style="color: #4e73df;" title="When the festivity has its own Proper, then Readings can be defined, otherwise the readings will depend on the Common"></i>` : ``}</td></tr>`).join('');
            formRow += `</table></div>`;
        }

        if (FormControls.settings.reasonFieldShow) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}Reason">${Messages[ "Reason" ]}</label>
            <input type="text" value="${festivity?.reason||''}" class="form-control litEvent litEventReason" id="onTheFly${FormControls.uniqid}Reason" />
            </div>`;
        }

        if(FormControls.settings.decreeURLFieldShow) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${Messages[ "Decree URL" ]}<i class="ms-2 fas fa-info-circle" title="Use %s in place of the language code if using a language mapping"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.url !== 'undefined' ? festivity.url : ''}" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapFieldShow) {
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
            FormControls.settings.eventKeyField   = false;
            FormControls.settings.nameField       = true;
            FormControls.settings.gradeFieldShow  = false;
            FormControls.settings.gradeField      = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = false;
            FormControls.settings.monthField      = false;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.reasonFieldShow     = false;
            FormControls.settings.readingsFieldShow   = false;
            FormControls.title  = Messages[ RowActionTitle[RowAction.MakeDoctor] ];
            FormControls.action = RowAction.MakeDoctor;
            break;
        case 'designatePatronButton':
            //nobreak
        case RowAction.MakePatron:
            FormControls.settings.eventKeyField   = false;
            FormControls.settings.nameField       = true;
            FormControls.settings.gradeFieldShow  = true;
            FormControls.settings.gradeField      = true;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = false;
            FormControls.settings.monthField      = false;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.missalFieldShow     = false;
            FormControls.settings.reasonFieldShow     = false;
            FormControls.settings.readingsFieldShow   = false;
            FormControls.title  =  Messages[ RowActionTitle[RowAction.MakePatron] ];
            FormControls.action = RowAction.MakePatron;
            break;
        case 'setPropertyButton':
            //nobreak
        case RowAction.SetProperty:
            FormControls.settings.eventKeyField   = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = false;
            FormControls.settings.monthField      = false;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.missalFieldShow     = false;
            FormControls.settings.reasonFieldShow     = false;
            FormControls.settings.readingsFieldShow   = false;
            FormControls.title  = Messages[ RowActionTitle[RowAction.SetProperty] ];
            FormControls.action = RowAction.SetProperty;
            break;
        case 'moveFestivityButton':
            //nobreak
        case RowAction.MoveFestivity:
            FormControls.settings.eventKeyField   = false;
            FormControls.settings.nameField       = false;
            FormControls.settings.gradeFieldShow  = false;
            FormControls.settings.commonFieldShow = false;
            FormControls.settings.dayField        = true;
            FormControls.settings.monthField      = true;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = false;
            FormControls.settings.missalFieldShow     = true;
            FormControls.settings.reasonFieldShow     = true;
            FormControls.settings.readingsFieldShow   = false;
            FormControls.title  = Messages[ RowActionTitle[RowAction.MoveFestivity] ];
            FormControls.action = RowAction.MoveFestivity;
            break;
        case 'newFestivityFromExistingButton':
            //nobreak
        case RowAction.CreateNewFromExisting:
            FormControls.settings.eventKeyField   = false;
            FormControls.settings.nameField       = false;
            FormControls.settings.gradeFieldShow  = true;
            FormControls.settings.commonFieldShow = true;
            FormControls.settings.gradeField      = false; //defaults to true in admin.js
            FormControls.settings.commonField     = false; //defaults to true in admin.js
            FormControls.settings.dayField        = false; //defaults to true in admin.js
            FormControls.settings.monthField      = false; //defaults to true in admin.js
            FormControls.settings.untilYearField  = true; //defaults to true in admin.js
            FormControls.settings.colorField      = false; //defaults to true in admin.js
            FormControls.settings.missalFieldShow     = false;
            FormControls.settings.reasonFieldShow     = false;
            FormControls.settings.readingsFieldShow   = true;
            FormControls.title  = Messages[ RowActionTitle[RowAction.CreateNew] ];
            FormControls.action = RowAction.CreateNew;
            break;
        case 'newFestivityExNovoButton':
            //nobreak
        case RowAction.CreateNew:
            FormControls.settings.eventKeyField   = true;
            FormControls.settings.nameField       = true;
            FormControls.settings.gradeFieldShow  = true;
            FormControls.settings.commonFieldShow = true;
            FormControls.settings.gradeField      = true;
            FormControls.settings.commonField     = true;
            FormControls.settings.dayField        = true;
            FormControls.settings.monthField      = true;
            FormControls.settings.untilYearField  = true;
            FormControls.settings.colorField      = true;
            FormControls.settings.missalFieldShow     = false;
            FormControls.settings.reasonFieldShow     = false;
            FormControls.settings.readingsFieldShow   = true;
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
            FormControls.title = Messages[ RowActionTitle[RowAction.SetNameProperty] ];
            break;
        case 'grade':
            FormControls.settings.nameField      = false;
            FormControls.settings.gradeFieldShow = true;
            FormControls.settings.gradeField     = true;
            FormControls.title = Messages[ RowActionTitle[RowAction.SetGradeProperty] ];
            break;
    }
}


/**
 * Represents a liturgical event.
 * @class
 * @property {string} event_key - Key of the liturgical event.
 * @property {string} name - Name of the liturgical event.
 * @property {string[]} color - Color of the liturgical event.
 * @property {number} grade - Grade of the liturgical event.
 * @property {string[]} common - Common of the liturgical event.
 * @property {number} day - Day of the month of the liturgical event.
 * @property {number} month - Month of the liturgical event.
 */
class LitEvent {
    /**
     * Creates a new LitEvent.
     * @param {string} [event_key=""] - Key of the liturgical event.
     * @param {string} [name=""] - Name of the liturgical event.
     * @param {string[]} [color=[]] - Color of the liturgical event.
     * @param {number} [grade=0] - Grade of the liturgical event.
     * @param {string[]} [common=[]] - Common of the liturgical event.
     * @param {number} [day=1] - Day of the month of the liturgical event.
     * @param {number} [month=1] - Month of the liturgical event.
     */
    constructor(key = "", name = "", color = [], grade = 0, common = [], day = 1, month = 1 ) {
        this.event_key = key;
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
 * @param {?HTMLElement} row - The HTMLElement representing the row to configure the multiselect for. If null, the function will configure all rows.
 * @param {?Array<string>} common - The values to select in the multiselect. If null, the function will select all values.
 */
const setCommonMultiselect = (row=null, common=null) => {
    let litEventCommon;
    if( row !== null ) {
        litEventCommon = row.querySelector('.litEventCommon');
    } else {
        litEventCommon = document.querySelectorAll('.litEventCommon');
    }
    $(litEventCommon).multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        },
        maxHeight: 200,
        enableCaseInsensitiveFiltering: true,
        /**
         * Triggered when the selected values of the multiselect for the liturgical common field change.
         * @param {HTMLOptionElement} option - The option that was selected or deselected.
         * @param {boolean} checked - Whether the option was selected or deselected.
         * @fires CustomEvent#change
         */
        onChange: (option, checked) => {
            const selectEl = option[0].parentElement;
            const selectedOptions = Array.from(selectEl.selectedOptions).map(({value}) => value);
            console.log('setCommonMultiselect: litEventCommon has changed, new value is: ', selectedOptions);
            if (option[0].value !== 'Proper' && checked === true && selectedOptions.includes('Proper')) {
                console.log('setCommonMultiselect: option[0].value:', option[0].value, 'checked:', checked, 'selectedOptions.includes(\'Proper\'):', selectedOptions.includes('Proper'));
                console.log('setCommonMultiselect: deselecting Proper');
                $(selectEl).multiselect('deselect', 'Proper');
                row = option[0].closest('.row');
                const litEventReadingsEl = row.querySelector('.litEventReadings');
                if( litEventReadingsEl ) {
                    litEventReadingsEl.disabled = true;
                }
            } else if (option[0].value === 'Proper' && checked === true) {
                console.log('setCommonMultiselect: option[0].value:', option[0].value, 'checked:', checked);
                console.log('setCommonMultiselect: selecting Proper');
                $(selectEl).multiselect('deselectAll', false).multiselect('select', 'Proper');
                row = option[0].closest('.row');
                const litEventReadingsEls = row.querySelectorAll('.litEventReadings');
                if( litEventReadingsEls.length > 0 ) {
                    litEventReadingsEls.forEach(el => el.disabled = false);
                }
            }
            selectEl.dispatchEvent(new CustomEvent('change', {
                bubbles: true,
                cancelable: true
              }));
        }
    }).multiselect('deselectAll', false);

    if( common !== null ) {
        $(litEventCommon).multiselect('select', common);
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
    getMonthMaxDay,
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
