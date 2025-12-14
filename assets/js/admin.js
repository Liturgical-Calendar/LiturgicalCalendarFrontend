import {
    FormControls,
    RowAction,
    setFormSettings,
    setFormSettingsForProperty,
    setCommonMultiselect,
    DaysOfTheWeek
} from './FormControls.js';

import {
    escapeHtml
} from './templates.js';

if ( typeof Messages === 'undefined' ) {
    throw new Error('Messages object not defined, should have been set in admin.php');
}
const { LOCALE } = Messages;
FormControls.jsLocale = LOCALE.replace('_','-');
FormControls.weekdayFormatter = new Intl.DateTimeFormat(FormControls.jsLocale, { weekday: "long" });

// Cache DOM elements
const jsonDataTbl = document.getElementById('jsonDataTbl');
const jsonDataTblThead = jsonDataTbl.querySelector('thead tr');
const jsonDataTblTbody = jsonDataTbl.querySelector('tbody');
const jsonFileSelect = document.getElementById('jsonFileSelect');
const saveDataBtn = document.getElementById('saveDataBtn');
const addColumnBtn = document.getElementById('addColumnBtn');
const tableContainer = document.getElementById('tableContainer');
const memorialsFromDecreesBtnGrp = document.getElementById('memorialsFromDecreesBtnGrp');
const memorialsFromDecreesForm = document.getElementById('memorialsFromDecreesForm');
const existingLiturgicalEventsList = document.getElementById('existingLiturgicalEventsList');

/**
 * Helper function to create elements from HTML string
 * Returns a DocumentFragment containing all parsed elements
 * @param {string} html - HTML string
 * @returns {DocumentFragment} - Document fragment with all children
 */
const createElementFromHTML = (html) => {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
};

/**
 * Helper function to show element with optional fade effect
 * @param {HTMLElement} el - Element to show
 * @param {boolean} fade - Whether to fade in
 * @param {string} displayValue - CSS display value to use (default: 'block')
 */
const showElement = (el, fade = false, displayValue = 'block') => {
    if (fade) {
        el.style.opacity = '0';
        el.style.display = displayValue;
        el.classList.remove('d-none');
        requestAnimationFrame(() => {
            el.style.transition = 'opacity 0.3s ease-in';
            el.style.opacity = '1';
        });
    } else {
        el.style.display = displayValue;
        el.classList.remove('d-none');
    }
};

/**
 * Helper function to hide element with optional fade effect
 * @param {HTMLElement} el - Element to hide
 * @param {boolean} fade - Whether to fade out
 * @param {Function} callback - Callback after hiding
 */
const hideElement = (el, fade = false, callback = null) => {
    if (fade) {
        el.style.transition = 'opacity 0.3s ease-out';
        el.style.opacity = '0';
        setTimeout(() => {
            el.style.display = 'none';
            if (callback) callback();
        }, 300);
    } else {
        el.style.display = 'none';
        if (callback) callback();
    }
};

/**
 * Check if element is hidden
 * @param {HTMLElement} el - Element to check
 * @returns {boolean} - Whether element is hidden
 */
const isHidden = (el) => {
    return el.style.display === 'none' || el.classList.contains('d-none') || window.getComputedStyle(el).display === 'none';
};

const createPropriumDeTemporeTable = ( data ) => {
    jsonDataTblThead.innerHTML = '';
    const keys = Object.keys( data );
    const thh = Object.keys( data[keys[0]] );
    jsonDataTblThead.insertAdjacentHTML('beforeend', '<th>TAG</th>');
    thh.forEach(el => {
        jsonDataTblThead.insertAdjacentHTML('beforeend', `<th>${el}</th>`);
    });
    let tbodyHtmlStrr = '';
    keys.forEach(tag => {
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
        tbodyHtmlStrr += `<tr><td contenteditable="false">${tag}</td>${trHtmlStr}</tr>`;
    });
    jsonDataTbl.classList.add('propriumDeTempore');
    jsonDataTblTbody.insertAdjacentHTML('beforeend', tbodyHtmlStrr);
};

const createPropriumDeSanctisTable = ( data, jsonFile ) => {
    jsonDataTblThead.innerHTML = '';
    jsonDataTbl.classList.remove('propriumDeTempore');
    // Check for national calendar missals (US, IT, etc.)
    if( jsonFile.includes('/US_') || jsonFile.includes('/IT_') ) {
        jsonDataTbl.classList.add('nationalCalendar');
    } else {
        jsonDataTbl.classList.remove('nationalCalendar');
    }
    // Filter out "calendar" property - not needed in the admin table
    const keys = Object.keys( data[0] ).filter(key => key !== 'calendar');
    keys.forEach((el) => {
        jsonDataTblThead.insertAdjacentHTML('beforeend', `<th class="sticky-top" scope="col">${el}</th>`);
    });
    let tbodyHtmlStrr = '';
    data.forEach(row => {
        let trHtmlStr = '<tr>';
        keys.forEach(prop => {
            const value = row[prop];
            if( Array.isArray( value ) ) {
                trHtmlStr += `<td contenteditable="false">${value.join(',')}</td>`;
            }
            else if( typeof value === 'object' && value !== null ) {
                console.log(`we have an object in key ${prop}:`);
                console.log( value );
                let htmlStr = '<table><tbody>';
                Object.keys( value ).forEach(title => {
                    let val = value[title];
                    if( typeof val === 'object' ) {
                        htmlStr += `<tr><td colspan="2" style="text-align:center;font-weight:bold;border:0;background-color:lightgray;">${title}</td></tr>`;
                        Object.keys( val ).forEach(title2 => {
                            let val2 = val[title2];
                            htmlStr += `<tr><td>${title2}</td><td contenteditable="false">${val2}</td></tr>`;
                        });
                    } else {
                        htmlStr += `<tr><td>${title}</td><td contenteditable="false">${val}</td></tr>`;
                    }
                });
                htmlStr += '</tbody></table>';
                trHtmlStr += `<td contenteditable="false">${htmlStr}</td>`;
            } else if ( value === null ) {
                trHtmlStr += `<td contenteditable="false">null</td>`;
            } else if ( value === undefined ) {
                trHtmlStr += `<td contenteditable="false">undefined</td>`;
            } else {
                trHtmlStr += `<td contenteditable="false">${value}</td>`;
            }
        });
        trHtmlStr += '</tr>';
        tbodyHtmlStrr += trHtmlStr;
    });
    jsonDataTblTbody.insertAdjacentHTML('beforeend', tbodyHtmlStrr);
};

const createMemorialsFromDecreesInterface = ( data ) => {
    saveDataBtn.disabled = true;
    tableContainer.style.display = 'none';
    addColumnBtn.style.display = 'none';
    showElement(memorialsFromDecreesBtnGrp, true);
    memorialsFromDecreesForm.innerHTML = '';
    data.forEach((el) => {
        let currentUniqid = FormControls.uniqid;
        let existingLiturgicalEventKey = el.liturgical_event.hasOwnProperty( 'event_key' ) ? el.liturgical_event.event_key : null;
        if( el.metadata.action === RowAction.CreateNew && LiturgicalEventCollectionKeys.includes( existingLiturgicalEventKey ) ) {
            el.metadata.action = RowAction.CreateNewFromExisting;
        }
        setFormSettings( el.metadata.action );
        if( el.metadata.action === RowAction.SetProperty ) {
            setFormSettingsForProperty( el.metadata.property );
        }

        // Enable decree URL and language map fields for all decree rows
        FormControls.settings.decreeUrlFieldShow = true;
        FormControls.settings.decreeLangMapFieldShow = true;

        // Build title with decree protocol and date info
        let titleParts = [FormControls.title];
        if (el.decree_protocol) {
            titleParts.push(el.decree_protocol);
        }
        if (el.decree_date) {
            titleParts.push(el.decree_date);
        }
        FormControls.title = titleParts.join(' - ');

        const rowHtml = FormControls.CreateDoctorRow( el );
        const rowFragment = createElementFromHTML(rowHtml);

        // Query elements BEFORE appending (DocumentFragment becomes empty after append)
        const formGroupEl = rowFragment.querySelector('.form-group');
        const colorSelect = rowFragment.querySelector('.litEventColor');
        const commonSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Common`);
        const gradeSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Grade`);
        const monthSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Month`);
        const titleDiv = rowFragment.querySelector('.data-group-title')?.parentElement;

        // Add decree description after the title if available
        if (el.description && titleDiv) {
            const descriptionP = document.createElement('p');
            descriptionP.className = 'text-muted small mb-2';
            descriptionP.textContent = el.description;
            titleDiv.insertAdjacentElement('afterend', descriptionP);
        }

        // Now append - the fragment's contents are moved to the DOM
        memorialsFromDecreesForm.appendChild(rowFragment);

        // References obtained before append are still valid
        const formrow = formGroupEl?.closest('.row');
        if (formrow) {
            formrow.dataset.action = el.metadata.action;
            if( el.metadata.action === RowAction.SetProperty ) {
                formrow.dataset.prop = el.metadata.property;
            }
            if( el.liturgical_event.hasOwnProperty('common') && el.liturgical_event.common.includes('Proper') ) {
                const litEventReadings = formrow.querySelector('.litEventReadings');
                if (litEventReadings) litEventReadings.disabled = false;
            }
        }

        if( false === el.liturgical_event.hasOwnProperty( 'color' ) ) {
            if( existingLiturgicalEventKey !== null ) {
                const fallbackEvent = LiturgicalEventCollection.find(ev => ev.event_key === existingLiturgicalEventKey);
                if( fallbackEvent && fallbackEvent.hasOwnProperty('color') ) {
                    el.liturgical_event.color = fallbackEvent.color;
                }
            }
        }

        if( el.liturgical_event.hasOwnProperty( 'color' ) && colorSelect ) {
            let colorVal = Array.isArray(el.liturgical_event.color) ? el.liturgical_event.color : el.liturgical_event.color.split(',');
            // jQuery needed for multiselect plugin
            $(colorSelect).multiselect({
                buttonWidth: '100%',
                buttonClass: 'form-select',
                templates: {
                    button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                },
            }).multiselect('deselectAll', false).multiselect('select', colorVal);
            if(FormControls.settings.colorField === false) {
                $(colorSelect).multiselect('disable');
            }
        }

        if( el.liturgical_event.hasOwnProperty( 'common' ) ) {
            let common = Array.isArray( el.liturgical_event.common ) ? el.liturgical_event.common : el.liturgical_event.common.split(',');
            if(FormControls.settings.commonFieldShow) {
                // Pass a parent element that contains the common select
                const rowEl = formGroupEl?.closest('.row') || memorialsFromDecreesForm;
                setCommonMultiselect( rowEl, common );
                if(FormControls.settings.commonField === false && commonSelect) {
                    $(commonSelect).multiselect('disable');
                }
            }
        }

        if(FormControls.settings.gradeFieldShow && gradeSelect) {
            gradeSelect.value = el.liturgical_event.grade;
            if(FormControls.settings.gradeField === false) {
                gradeSelect.disabled = true;
            }
        }

        if(FormControls.settings.monthField === false && monthSelect) {
            monthSelect.querySelectorAll(`option[value]:not([value="${el.liturgical_event.month}"])`).forEach(opt => {
                opt.disabled = true;
            });
        }
    });
};

const jsonFileData = {};

// Event: jsonFileSelect change
jsonFileSelect.addEventListener('change', async () => {
    const selectedOption = jsonFileSelect.options[jsonFileSelect.selectedIndex];
    const baseJsonFile = selectedOption.text;
    const jsonFile = escapeHtml( jsonFileSelect.value );
    // Fetch directly from the API (BaseUrl is set in the page from PHP config)
    const jsonFileFull = BaseUrl + '/' + jsonFile;

    if( false === jsonFileData.hasOwnProperty( baseJsonFile ) ) {
        try {
            // GET requests for missals/decrees are public, no credentials needed
            const response = await fetch(jsonFileFull, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let data = await response.json();
            console.log('storing data in script cache...');
            // Handle API response format for decrees endpoint
            if(jsonFile === 'decrees') {
                // Decrees API returns { litcal_decrees: [...] }
                if (data.litcal_decrees) {
                    data = data.litcal_decrees;
                }
                // b - a for reverse sort: this is what we want, so the newer decrees will be on top
                data.sort((a,b) => b.metadata.since_year - a.metadata.since_year);
            }
            jsonFileData[baseJsonFile] = data;
            handleJsonFileData( data, jsonFile );
        } catch (error) {
            console.error('Error fetching JSON file:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error(`Failed to load ${baseJsonFile}: ${error.message}`);
            }
        }
    } else {
        console.log( 'using stored data to avoid making another fetch call uselessly...' );
        const data = jsonFileData[baseJsonFile];
        handleJsonFileData( data, jsonFile );
    }
});

const handleJsonFileData = ( data, jsonFile ) => {
    // Check if this is the decrees endpoint
    if(jsonFile === 'decrees') {
        jsonDataTblTbody.innerHTML = '';
        createMemorialsFromDecreesInterface( data );
    } else {
        if( !isHidden(memorialsFromDecreesBtnGrp) ) {
            memorialsFromDecreesForm.innerHTML = '';
            hideElement(memorialsFromDecreesBtnGrp, true);
        }
        if( isHidden(tableContainer) ) {
            console.log( 'tableContainer was hidden, now showing in order to repopulate...' );
            showElement(tableContainer);
            showElement(addColumnBtn);
            setTimeout(() => createPropriumTable( data, jsonFile ), 200);
        } else {
            createPropriumTable( data, jsonFile );
        }
    }
};

const createPropriumTable = ( data, jsonFile ) => {
    saveDataBtn.disabled = false;
    jsonDataTblTbody.innerHTML = '';
    if( Array.isArray(data) ) {
        createPropriumDeSanctisTable( data, jsonFile );
    } else {
        createPropriumDeTemporeTable( data );
    }
};

// Event: Double-click on table cells for editing
jsonDataTbl.addEventListener('dblclick', (ev) => {
    const target = ev.target;
    if (target.matches('#jsonDataTbl table tr td:nth-child(2)')) {
        target.setAttribute('contenteditable', 'true');
        target.classList.add('bg-white');
        target.focus();
    }
});

// Event: Keydown on table cells
jsonDataTbl.addEventListener('keydown', (ev) => {
    const target = ev.target;
    if (target.matches('th, td')) {
        const key = ev.key;
        if((key === "Enter" || key === "Escape") && target.classList.contains('bg-white') ) {
            ev.preventDefault();
            target.setAttribute('contenteditable', 'false');
            target.classList.remove('bg-white');
        }
    }
});

// Event: Add column button
addColumnBtn.addEventListener('click', () => {
    const column = prompt("Please enter the name for the new column (this will become the JSON property name):");
    if (column) {
        jsonDataTblThead.insertAdjacentHTML('beforeend', `<th>${column}</th>`);
        jsonDataTblTbody.querySelectorAll('tr').forEach(tr => {
            tr.insertAdjacentHTML('beforeend', '<td></td>');
        });
    }
});

// Event: Save data button
saveDataBtn.addEventListener('click', async () => {
    const jsonData = [];
    const props = [];
    const intProps = [ "month", "day", "grade" ];

    jsonDataTbl.querySelectorAll('th').forEach(th => {
        props.push(th.textContent);
    });

    jsonDataTblTbody.querySelectorAll(':scope > tr').forEach((tr, i) => {
        const newRow = {};
        tr.querySelectorAll(':scope > td').forEach((td, j) => {
            const nestedTable = td.querySelector('table');
            if( nestedTable ) {
                const subJson = {};
                const firstRowTds = nestedTable.querySelector('tr:first-child')?.querySelectorAll('td');
                const tdCount = firstRowTds ? firstRowTds.length : 0;
                if( tdCount > 1 ) {
                    nestedTable.querySelectorAll('tr').forEach(nestedTr => {
                        const prop = nestedTr.querySelector('td:first-child')?.textContent || '';
                        let val = nestedTr.querySelector('td:last-child')?.textContent || '';
                        val = val.replaceAll(' ',' ').replaceAll('\r','');
                        subJson[prop] = val;
                    });
                }
                else if( tdCount === 1 ) {
                    let currentProperty;
                    nestedTable.querySelectorAll('tr').forEach(nestedTr => {
                        const tds = nestedTr.querySelectorAll('td');
                        if( tds.length === 1 ) {
                            currentProperty = tds[0].textContent;
                            subJson[currentProperty] = {};
                        }
                        else {
                            const prop = nestedTr.querySelector('td:first-child')?.textContent || '';
                            let val = nestedTr.querySelector('td:last-child')?.textContent || '';
                            val = val.replaceAll(' ',' ').replaceAll('\r','');
                            subJson[currentProperty][prop] = val;
                        }
                    });
                }
                newRow[props[j]] = subJson;
            } else {
                if(intProps.includes(props[j])) {
                    newRow[props[j]] = parseInt(td.textContent);
                } else {
                    newRow[props[j]] = td.textContent;
                }
            }
        });
        jsonData.push(newRow);
    });

    const endpoint = escapeHtml( jsonFileSelect.value );
    const jsonstring = JSON.stringify(jsonData, null, 4).replace(/[\r]/g, '');
    console.log('Attempting to save data to endpoint: ' + endpoint);
    console.log(jsonData);

    // Determine the API endpoint for saving
    const apiUrl = BaseUrl + '/' + endpoint;

    try {
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: jsonstring,
            credentials: 'include'
        });

        if (response.status === 405) {
            // Method not allowed - API doesn't support write operations yet
            if (typeof toastr !== 'undefined') {
                toastr.warning('API write operations are not yet implemented. Changes cannot be saved.');
            } else {
                alert('API write operations are not yet implemented. Changes cannot be saved.');
            }
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(data);
        if (typeof toastr !== 'undefined') {
            toastr.success('Data saved successfully');
        } else {
            alert('Data saved successfully');
        }
    } catch (error) {
        console.error('Error saving data:', error);
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to save data: ' + error.message);
        } else {
            alert('Failed to save data: ' + error.message);
        }
    }
});

// Event: Action prompt buttons (delegated)
document.addEventListener('click', (ev) => {
    const target = ev.target.closest('.actionPromptButton');
    if (!target) return;

    const currentUniqid = parseInt( FormControls.uniqid );
    const modal = target.closest('.actionPromptModal');
    const modalForm = modal.querySelector('form');
    const existingEventInput = modalForm.querySelector('.existingLiturgicalEventName');
    const existingLiturgicalEventKey = escapeHtml( existingEventInput?.value || '' );
    let propertyToChange;

    FormControls.settings.decreeUrlFieldShow = true;
    FormControls.settings.decreeLangMapFieldShow = true;

    setFormSettings( target.id );

    if( target.id === 'setPropertyButton' ) {
        const propertySelect = document.getElementById('propertyToChange');
        propertyToChange = escapeHtml( propertySelect?.value || '' );
        setFormSettingsForProperty( propertyToChange );
    }

    const rowHtml = existingLiturgicalEventKey !== ''
        ? FormControls.CreateDoctorRow( existingLiturgicalEventKey )
        : FormControls.CreateDoctorRow();
    const rowFragment = createElementFromHTML(rowHtml);

    // Query elements BEFORE prepending (DocumentFragment becomes empty after prepend)
    const formGroupEl = rowFragment.querySelector('.form-group');
    const colorSelect = rowFragment.querySelector('.litEventColor');
    const commonSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Common`);
    const gradeSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Grade`);

    // Now prepend - the fragment's contents are moved to the DOM
    memorialsFromDecreesForm.prepend(rowFragment);

    // Hide modal using Bootstrap 5 API
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();

    // References obtained before prepend are still valid
    const formrow = formGroupEl?.closest('.row');
    if (formrow) {
        formrow.dataset.action = FormControls.action.description;
        if( FormControls.action.description === RowAction.SetProperty ) {
            formrow.dataset.prop = propertyToChange;
        }
    }

    // jQuery needed for multiselect plugin
    if (colorSelect) {
        $(colorSelect).multiselect({
            buttonWidth: '100%',
            buttonClass: 'form-select',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
            }
        }).multiselect('deselectAll', false);

        if(FormControls.settings.colorField === false) {
            $(colorSelect).multiselect('disable');
        }
    }

    if(FormControls.settings.commonFieldShow) {
        const rowEl = formGroupEl?.closest('.row') || memorialsFromDecreesForm;
        setCommonMultiselect( rowEl, null );
        if(FormControls.settings.commonField === false && commonSelect) {
            $(commonSelect).multiselect('disable');
        }
    }

    if(FormControls.settings.gradeFieldShow && FormControls.settings.gradeField === false && gradeSelect) {
        gradeSelect.disabled = true;
    }

    if( existingLiturgicalEventKey !== '' ) {
        litevent = LiturgicalEventCollection.find(el => el.event_key === existingLiturgicalEventKey);

        const gradeSelect = row.querySelector(`#onTheFly${currentUniqid}Grade`);
        if (gradeSelect) gradeSelect.value = litevent.GRADE;

        const commonSelect = row.querySelector(`#onTheFly${currentUniqid}Common`);
        if (commonSelect) $(commonSelect).multiselect('select', litevent.COMMON);

        const colorVal = Array.isArray( litevent.COLOR ) ? litevent.COLOR : litevent.COLOR.split(',');
        $(colorSelect).multiselect('select', colorVal);

        if(FormControls.settings.monthField === false) {
            const monthSelect = row.querySelector(`#onTheFly${currentUniqid}Month`);
            if (monthSelect) {
                monthSelect.querySelectorAll(`option[value]:not([value="${litevent.MONTH}"])`).forEach(opt => {
                    opt.disabled = true;
                });
            }
        }
    }
});

// Event: Existing liturgical event name change (delegated)
document.addEventListener('change', (ev) => {
    const target = ev.target;
    if (!target.classList.contains('existingLiturgicalEventName')) return;

    const modal = target.closest('.actionPromptModal');
    if (!modal) return;

    const forms = modal.querySelectorAll('form');
    let disabledState;

    forms.forEach(form => form.classList.remove('was-validated'));

    const curTargVal = escapeHtml( target.value );

    if (existingLiturgicalEventsList.querySelector(`option[value="${curTargVal}"]`)) {
        disabledState = false;
        if( target.required ) {
            target.classList.remove('is-invalid');
        }
    } else {
        disabledState = true;
        if( target.required ) {
            target.classList.add('is-invalid');
        }
    }

    switch( modal.id ) {
        case 'makeDoctorActionPrompt':
            document.getElementById('designateDoctorButton').disabled = disabledState;
            break;
        case 'setPropertyActionPrompt':
            document.getElementById('setPropertyButton').disabled = disabledState;
            break;
        case 'moveLiturgicalEventActionPrompt':
            document.getElementById('moveLiturgicalEventButton').disabled = disabledState;
            break;
        case 'newLiturgicalEventActionPrompt':
            document.getElementById('newLiturgicalEventFromExistingButton').disabled = disabledState;
            document.getElementById('newLiturgicalEventExNovoButton').disabled = !disabledState;
            break;
    }
});

// Event: Strtotime toggle button (delegated)
document.addEventListener('click', (ev) => {
    const target = ev.target.closest('.strtotime-toggle-btn');
    if (!target) return;

    const uniqid = parseInt( target.dataset.rowUniqid );
    const selectedOption = jsonFileSelect.options[jsonFileSelect.selectedIndex];
    const currentJsonFile = selectedOption.text;
    const eventKeyInput = document.getElementById(`onTheFly${uniqid}EventKey`);
    const eventKey = escapeHtml( eventKeyInput?.value || '' );
    const liturgicalEventData = jsonFileData[currentJsonFile]?.find(el => el.liturgical_event.event_key === eventKey);
    const strtotime = typeof liturgicalEventData !== 'undefined' && liturgicalEventData.liturgical_event.hasOwnProperty('strtotime') ? liturgicalEventData.liturgical_event.strtotime : {};

    if( target.getAttribute('aria-pressed') === 'true' ) {
        const icon = target.querySelector('i');
        icon.classList.remove('fa-comment-slash');
        icon.classList.add('fa-comment');
        target.classList.remove('btn-secondary');
        target.classList.add('btn-info');

        const monthFormGroup = document.getElementById(`onTheFly${uniqid}Month`)?.closest('.form-group');
        if (monthFormGroup) monthFormGroup.remove();

        const dayFormGroup = document.getElementById(`onTheFly${uniqid}Day`)?.closest('.form-group');
        if (dayFormGroup) {
            let strToTimeFormGroup = `<label for="onTheFly${uniqid}StrToTime-dayOfTheWeek">Explicatory date</label>
            <select class="form-select litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime-dayOfTheWeek">`;
            for (let i = 0; i < 7; i++ ) {
                const dayOfTheWeek = new Date(Date.UTC(2000, 0, 2+i));
                strToTimeFormGroup += `<option value="${DaysOfTheWeek[i]}"${strtotime.hasOwnProperty('day_of_the_week') && strtotime.day_of_the_week === DaysOfTheWeek[i] ? ' selected': ''}>${FormControls.weekdayFormatter.format(dayOfTheWeek)}</option>`;
            }
            strToTimeFormGroup += `</select>
            <select class="form-select litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime-relativeTime">
                <option value="before"${strtotime.hasOwnProperty('relative_time') && strtotime.relative_time === 'before' ? ' selected': ''}>before</option>
                <option value="after"${strtotime.hasOwnProperty('relative_time') && strtotime.relative_time === 'after' ? ' selected': ''}>after</option>
            </select>
            <input list="existingLiturgicalEventsList" class="form-control litEvent litEventStrtotime existingLiturgicalEventName" id="onTheFly${uniqid}StrToTime-eventKey" value="${strtotime.hasOwnProperty('event_key') ? strtotime.event_key : ''}" required>`;
            dayFormGroup.innerHTML = strToTimeFormGroup;
            dayFormGroup.classList.remove('col-sm-1');
            dayFormGroup.classList.add('col-sm-2');
        }
    } else {
        const icon = target.querySelector('i');
        icon.classList.remove('fa-comment');
        icon.classList.add('fa-comment-slash');
        target.classList.remove('btn-info');
        target.classList.add('btn-secondary');

        const strToTimeFormGroup = document.getElementById(`onTheFly${uniqid}StrToTime-dayOfTheWeek`)?.closest('.form-group');
        if (strToTimeFormGroup) {
            strToTimeFormGroup.innerHTML = `<label for="onTheFly${uniqid}Day">Day</label>
                <input type="number" min="1" max="31" value="${typeof liturgicalEventData !== 'undefined' && liturgicalEventData.liturgical_event.hasOwnProperty('day') ? liturgicalEventData.liturgical_event.day : ''}" class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`;
            strToTimeFormGroup.classList.remove('col-sm-2');
            strToTimeFormGroup.classList.add('col-sm-1');

            const formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
            let formRow = `<div class="form-group col-sm-1">
            <label for="onTheFly${uniqid}Month">${Messages[ "Month" ]}</label>
            <select class="form-select litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
            for (let i = 0; i < 12; i++) {
                const month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
                formRow += `<option value=${i + 1}${typeof liturgicalEventData !== 'undefined' && liturgicalEventData.liturgical_event.hasOwnProperty('month') && liturgicalEventData.liturgical_event.month === i+1 ? ' selected' : ''}>${formatter.format(month)}</option>`;
            }
            formRow += `</select>
            </div>`;
            strToTimeFormGroup.insertAdjacentHTML('afterend', formRow);
        }
    }
});
