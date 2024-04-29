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
        untilYearField: true, //defaults to false in admin.js
        tagField: false,
        decreeURLField: false,
        decreeLangMapField: false,
        reasonField: false,
        missalField: false,
        strtotimeField: false
    }
    static action = null;
    static title = null;
    static jsLocale = null;
    static weekdayFormatter = null;
    static index = null;

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
            <select class="form-select litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple" />
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
        <select class="form-select litEvent litEventColor" id="onTheFly${FormControls.uniqid}Color" multiple="multiple"${FormControls.settings.colorField === false ? ' readonly' : ''} />
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
            <select class="form-select litEvent litEventMissal" id="onTheFly${FormControls.uniqid}Missal">`;
            //console.log(Object.values( FormControls.index.RomanMissals ).map(({value,name}) => `<option class="list-group-item" value="${value}">${name}</option>`));
            formRow += Object.values( FormControls.index.RomanMissals ).map(({value,name}) => `<option class="list-group-item" value="${value}">${name}</option>`).join('');
            formRow += `</select>
            </div>`;
        }

        if(FormControls.settings.decreeURLField) {
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeURL">${messages[ "Decree URL" ]}<i class="ms-2 fas fa-info-circle" title="Use %s in place of the language code if using a language mapping"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeURL" value="${festivity !== null && typeof festivity.decreeURL !== 'undefined' ? festivity.decreeURL : ''}" id="onTheFly${FormControls.uniqid}DecreeURL" />
            </div>`;
        }

        if(FormControls.settings.decreeLangMapField) {
            let decreeLangs = festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? Object.keys(festivity.decreeLangs).map(key => key+'='+festivity.decreeLangs[key] ) : null;
            formRow += `<div class="form-group col-sm-6">
            <label for="onTheFly${FormControls.uniqid}DecreeLangs">${messages[ "Decree Langs" ]}<i class="ms-2 fas fa-info-circle" title="Use a comma separated list of key=value pairings, e.g. DE=ge,EN=en. Key is uppercased two letter ISO code, value is (generally lowercased) two letter representation used within the actual URL"></i></label>
            <input type="text" class="form-control litEvent litEventDecreeLangs" value="${festivity !== null && typeof festivity.decreeLangs !== 'undefined' ? decreeLangs.join(',') : ''}" id="onTheFly${FormControls.uniqid}DecreeLangs" />
            </div>`;
        }

        formRow += `</div>`;
        ++FormControls.uniqid;

        return formRow;
    }

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
                formRow += `<option value="${daysOfTheWeek[i]}"${festivity.strtotime.dayOfTheWeek === daysOfTheWeek[i] ? ' selected' : '' }>${FormControls.weekdayFormatter.format(dayOfTheWeek)}</option>`;
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
            FormControls.settings.gradeField = false; //defaults to true in admin.js
            FormControls.settings.commonField = false; //defaults to true in admin.js
            FormControls.settings.dayField = false; //defaults to true in admin.js
            FormControls.settings.monthField = false; //defaults to true in admin.js
            FormControls.settings.untilYearField = true; //defaults to true in admin.js
            FormControls.settings.colorField = false; //defaults to true in admin.js
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

class RowAction {
    static MakePatron       = Symbol('makePatron');
    static MakeDoctor       = Symbol('makeDoctor');
    static SetProperty      = Symbol('setProperty');
    static MoveFestivity    = Symbol('moveFestivity');
    static CreateNew        = Symbol('createNew');
    static CreateNewFromExisting = Symbol('createNewFromExisting');
    constructor(name) {
        this.name = name;
    }
}

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

const lowercaseKeys = obj =>
  Object.keys(obj).reduce((acc, key) => {
    acc[key.toLowerCase()] = obj[key];
    return acc;
  }, {});

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
const daysOfTheWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


export {
    FormControls,
    RowAction,
    RANK,
    litEvent,
    READINGS_PROPERTIES,
    integerVals,
    expectedJSONProperties,
    metadataProps,
    setFormSettings,
    setFormSettingsForProperty,
    setCommonMultiselect,
    lowercaseKeys,
    monthsOfThirty,
    daysOfTheWeek
};
