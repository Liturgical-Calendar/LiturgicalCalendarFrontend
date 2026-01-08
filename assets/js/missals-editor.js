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

// Debug flag - set to true for development logging
const DEBUG = false;

if ( typeof Messages === 'undefined' ) {
    throw new Error('Messages object not defined, should have been set in admin.php');
}
const { LOCALE } = Messages;
FormControls.jsLocale = LOCALE.replaceAll('_', '-');
FormControls.weekdayFormatter = new Intl.DateTimeFormat(FormControls.jsLocale, { weekday: "long" });

// Cache DOM elements with null checks
const jsonDataTbl = document.getElementById('jsonDataTbl');
if (!jsonDataTbl) {
    throw new Error('Required element #jsonDataTbl not found in DOM');
}
const jsonDataTblThead = jsonDataTbl.querySelector('thead tr');
const jsonDataTblTbody = jsonDataTbl.querySelector('tbody');
if (!jsonDataTblThead || !jsonDataTblTbody) {
    throw new Error('Required thead tr or tbody not found in #jsonDataTbl');
}
const jsonFileSelect = document.getElementById('jsonFileSelect');
const saveDataBtn = document.getElementById('saveDataBtn');
const addColumnBtn = document.getElementById('addColumnBtn');
const tableContainer = document.getElementById('tableContainer');
const memorialsFromDecreesBtnGrp = document.getElementById('memorialsFromDecreesBtnGrp');
const memorialsFromDecreesForm = document.getElementById('memorialsFromDecreesForm');
const existingLiturgicalEventsList = document.getElementById('existingLiturgicalEventsList');

// Verify all required elements exist
const requiredElements = {
    jsonFileSelect,
    saveDataBtn,
    addColumnBtn,
    tableContainer,
    memorialsFromDecreesBtnGrp,
    memorialsFromDecreesForm,
    existingLiturgicalEventsList
};
for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
        throw new Error(`Required element #${name} not found in DOM`);
    }
}

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

// Animation duration constant - keeps CSS transition and JS timeout in sync
const FADE_DURATION_MS = 300;

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
            el.style.transition = `opacity ${FADE_DURATION_MS}ms ease-in`;
            el.style.opacity = '1';
        });
    } else {
        el.style.transition = '';
        el.style.opacity = '1';
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
        el.style.transition = `opacity ${FADE_DURATION_MS}ms ease-out`;
        el.style.opacity = '0';
        setTimeout(() => {
            el.style.display = 'none';
            el.style.transition = '';
            if (callback) callback();
        }, FADE_DURATION_MS);
    } else {
        el.style.transition = '';
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

/**
 * Initialize color multiselect plugin on a select element
 * @param {HTMLSelectElement} colorSelect - The color select element
 * @param {boolean} disabled - Whether to disable the multiselect
 */
const initializeColorMultiselect = (colorSelect, disabled = false) => {
    if (!colorSelect) return;
    $(colorSelect).multiselect({
        buttonWidth: '100%',
        buttonClass: 'form-select',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
        }
    }).multiselect('deselectAll', false);
    if (disabled) {
        $(colorSelect).multiselect('disable');
    }
};

/**
 * Populate form fields from an existing liturgical event
 * @param {Object} litevent - The liturgical event data
 * @param {Object} elements - Object containing form elements {gradeSelect, commonSelect, colorSelect, monthSelect}
 * @param {boolean} monthDisabled - Whether month field should have options disabled
 */
const populateFormFromEvent = (litevent, elements, monthDisabled = false) => {
    if (!litevent) return;

    const { gradeSelect, commonSelect, colorSelect, monthSelect } = elements;

    if (gradeSelect) gradeSelect.value = litevent.grade;
    if (commonSelect) $(commonSelect).multiselect('select', litevent.common);

    if (colorSelect && litevent.color) {
        const colorVal = Array.isArray(litevent.color) ? litevent.color : litevent.color.split(',');
        $(colorSelect).multiselect('select', colorVal);
    }

    if (monthDisabled && monthSelect) {
        monthSelect.querySelectorAll(`option[value]:not([value="${litevent.month}"])`).forEach(opt => {
            opt.disabled = true;
        });
    }
};

/**
 * Build strtotime form group HTML
 * @param {number} uniqid - Unique ID for form elements
 * @param {Object} strtotime - Strtotime data object
 * @returns {string} HTML string for strtotime form group
 */
const buildStrtotimeFormGroup = (uniqid, strtotime = {}) => {
    // Escape API-provided values to prevent XSS
    const escapedEventKey = escapeHtml(strtotime.event_key || '');
    const escapedDayOfWeek = escapeHtml(strtotime.day_of_the_week || '');
    const escapedRelativeTime = escapeHtml(strtotime.relative_time || '');

    let html = `<label for="onTheFly${uniqid}StrToTime-dayOfTheWeek">Explicatory date</label>
        <select class="form-select litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime-dayOfTheWeek">`;
    for (let i = 0; i < 7; i++) {
        const dayOfTheWeek = new Date(Date.UTC(2000, 0, 2 + i));
        const selected = escapedDayOfWeek === DaysOfTheWeek[i] ? ' selected' : '';
        html += `<option value="${escapeHtml(DaysOfTheWeek[i])}"${selected}>${escapeHtml(FormControls.weekdayFormatter.format(dayOfTheWeek))}</option>`;
    }
    html += `</select>
        <select class="form-select litEvent litEventStrtotime" id="onTheFly${uniqid}StrToTime-relativeTime">
            <option value="before"${escapedRelativeTime === 'before' ? ' selected' : ''}>before</option>
            <option value="after"${escapedRelativeTime === 'after' ? ' selected' : ''}>after</option>
        </select>
        <input list="existingLiturgicalEventsList" class="form-control litEvent litEventStrtotime existingLiturgicalEventName" id="onTheFly${uniqid}StrToTime-eventKey" value="${escapedEventKey}" required>`;
    return html;
};

/**
 * Build day/month form group HTML
 * @param {number} uniqid - Unique ID for form elements
 * @param {Object} liturgicalEventData - Liturgical event data
 * @returns {Object} Object with {dayHtml, monthHtml}
 */
const buildDayMonthFormGroup = (uniqid, liturgicalEventData) => {
    const eventData = liturgicalEventData?.liturgical_event || {};

    // Escape API-provided values to prevent XSS
    const escapedDay = escapeHtml(eventData.day ?? '');

    const dayHtml = `<label for="onTheFly${uniqid}Day">Day</label>
        <input type="number" min="1" max="31" value="${escapedDay}" class="form-control litEvent litEventDay" id="onTheFly${uniqid}Day" />`;

    const formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
    let monthHtml = `<div class="form-group col-sm-1">
        <label for="onTheFly${uniqid}Month">${escapeHtml(Messages["Month"])}</label>
        <select class="form-select litEvent litEventMonth" id="onTheFly${uniqid}Month" >`;
    for (let i = 0; i < 12; i++) {
        const month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
        const selected = eventData.month === i + 1 ? ' selected' : '';
        monthHtml += `<option value="${i + 1}"${selected}>${escapeHtml(formatter.format(month))}</option>`;
    }
    monthHtml += `</select></div>`;

    return { dayHtml, monthHtml };
};

/**
 * Toggle strtotime button appearance and aria-pressed state
 * @param {HTMLElement} target - The button element
 * @param {boolean} toActive - Whether to set to active (relative date) state
 */
const toggleStrtotimeButton = (target, toActive) => {
    // Update aria-pressed to match the visual state for assistive technology
    target.setAttribute('aria-pressed', toActive ? 'true' : 'false');

    const icon = target.querySelector('i');
    if (toActive) {
        icon.classList.remove('fa-comment-slash');
        icon.classList.add('fa-comment');
        target.classList.remove('btn-secondary');
        target.classList.add('btn-info', 'active');
    } else {
        icon.classList.remove('fa-comment');
        icon.classList.add('fa-comment-slash');
        target.classList.remove('btn-info', 'active');
        target.classList.add('btn-secondary');
    }
};

/**
 * Switch form to strtotime (relative date) UI
 * @param {number} uniqid - Unique ID for form elements
 * @param {Object} strtotime - Strtotime data object
 */
const switchToStrtotimeUI = (uniqid, strtotime) => {
    const monthFormGroup = document.getElementById(`onTheFly${uniqid}Month`)?.closest('.form-group');
    if (monthFormGroup) monthFormGroup.remove();

    const dayFormGroup = document.getElementById(`onTheFly${uniqid}Day`)?.closest('.form-group');
    if (dayFormGroup) {
        dayFormGroup.innerHTML = buildStrtotimeFormGroup(uniqid, strtotime);
        dayFormGroup.classList.remove('col-sm-1');
        dayFormGroup.classList.add('col-sm-2');
    }
};

/**
 * Switch form to fixed day/month UI
 * @param {number} uniqid - Unique ID for form elements
 * @param {Object} liturgicalEventData - Liturgical event data
 */
const switchToFixedDateUI = (uniqid, liturgicalEventData) => {
    const strToTimeFormGroup = document.getElementById(`onTheFly${uniqid}StrToTime-dayOfTheWeek`)?.closest('.form-group');
    if (strToTimeFormGroup) {
        const { dayHtml, monthHtml } = buildDayMonthFormGroup(uniqid, liturgicalEventData);
        strToTimeFormGroup.innerHTML = dayHtml;
        strToTimeFormGroup.classList.remove('col-sm-2');
        strToTimeFormGroup.classList.add('col-sm-1');
        strToTimeFormGroup.insertAdjacentHTML('afterend', monthHtml);
    }
};

const createPropriumDeTemporeTable = ( data ) => {
    jsonDataTblThead.innerHTML = '';
    const keys = Object.keys( data );
    const thh = Object.keys( data[keys[0]] );
    jsonDataTblThead.insertAdjacentHTML('beforeend', '<th>TAG</th>');
    thh.forEach(el => {
        jsonDataTblThead.insertAdjacentHTML('beforeend', `<th>${escapeHtml(el)}</th>`);
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
                tbodyHtmlStr += `<tr><td>${escapeHtml(prop)}</td><td>${escapeHtml(dataTagEl[prop])}</td></tr>`;
            });
            trHtmlStr += `<td contenteditable="false"><table><tbody>${tbodyHtmlStr}</tbody></table></td>`;
        });
        tbodyHtmlStrr += `<tr><td contenteditable="false">${escapeHtml(tag)}</td>${trHtmlStr}</tr>`;
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
        jsonDataTblThead.insertAdjacentHTML('beforeend', `<th class="sticky-top" scope="col">${escapeHtml(el)}</th>`);
    });
    let tbodyHtmlStrr = '';
    data.forEach(row => {
        let trHtmlStr = '<tr>';
        keys.forEach(prop => {
            const value = row[prop];
            if( Array.isArray( value ) ) {
                trHtmlStr += `<td contenteditable="false">${escapeHtml(value.join(','))}</td>`;
            }
            else if( typeof value === 'object' && value !== null ) {
                if (DEBUG) {
                    console.log(`we have an object in key ${prop}:`);
                    console.log( value );
                }
                let htmlStr = '<table><tbody>';
                Object.keys( value ).forEach(title => {
                    let val = value[title];
                    if( typeof val === 'object' ) {
                        htmlStr += `<tr><td colspan="2" style="text-align:center;font-weight:bold;border:0;background-color:lightgray;">${escapeHtml(title)}</td></tr>`;
                        Object.keys( val ).forEach(title2 => {
                            let val2 = val[title2];
                            htmlStr += `<tr><td>${escapeHtml(title2)}</td><td contenteditable="false">${escapeHtml(val2)}</td></tr>`;
                        });
                    } else {
                        htmlStr += `<tr><td>${escapeHtml(title)}</td><td contenteditable="false">${escapeHtml(val)}</td></tr>`;
                    }
                });
                htmlStr += '</tbody></table>';
                trHtmlStr += `<td contenteditable="false">${htmlStr}</td>`;
            } else if ( value === null ) {
                trHtmlStr += `<td contenteditable="false">null</td>`;
            } else if ( value === undefined ) {
                trHtmlStr += `<td contenteditable="false">undefined</td>`;
            } else {
                trHtmlStr += `<td contenteditable="false">${escapeHtml(value)}</td>`;
            }
        });
        trHtmlStr += '</tr>';
        tbodyHtmlStrr += trHtmlStr;
    });
    jsonDataTblTbody.insertAdjacentHTML('beforeend', tbodyHtmlStrr);
};

/**
 * Prepare decree row metadata: determine action, configure form settings, build title
 * @param {Object} el - Decree element data
 * @returns {string|null} - Existing liturgical event key if found
 */
const prepareDecreeRowMetadata = (el) => {
    const existingKey = el.liturgical_event.hasOwnProperty('event_key') ? el.liturgical_event.event_key : null;

    // Adjust action if creating from existing event
    if (el.metadata.action === RowAction.CreateNew && LiturgicalEventCollectionKeys.includes(existingKey)) {
        el.metadata.action = RowAction.CreateNewFromExisting;
    }

    // Configure form settings based on action
    setFormSettings(el.metadata.action);
    if (el.metadata.action === RowAction.SetProperty) {
        setFormSettingsForProperty(el.metadata.property);
    }

    // Enable decree URL and language map fields
    FormControls.settings.decreeUrlFieldShow = true;
    FormControls.settings.decreeLangMapFieldShow = true;

    // Build title with decree protocol and date info
    const titleParts = [FormControls.title];
    if (el.decree_protocol) titleParts.push(el.decree_protocol);
    if (el.decree_date) titleParts.push(el.decree_date);
    FormControls.title = titleParts.join(' - ');

    return existingKey;
};

/**
 * Add decree description paragraph after the title element
 * @param {Object} el - Decree element data
 * @param {HTMLElement|null} titleDiv - Title div element
 */
const addDecreeDescription = (el, titleDiv) => {
    if (el.description && titleDiv) {
        const descriptionP = document.createElement('p');
        descriptionP.className = 'text-muted small mb-2';
        descriptionP.textContent = el.description;
        titleDiv.insertAdjacentElement('afterend', descriptionP);
    }
};

/**
 * Configure row dataset attributes and enable readings field if needed
 * @param {HTMLElement|null} formrow - Form row element
 * @param {Object} el - Decree element data
 */
const configureDecreeRowDataset = (formrow, el) => {
    if (!formrow) return;

    formrow.dataset.action = el.metadata.action;
    if (el.metadata.action === RowAction.SetProperty) {
        formrow.dataset.prop = el.metadata.property;
    }
    if (el.liturgical_event.hasOwnProperty('common') && el.liturgical_event.common.includes('Proper')) {
        const litEventReadings = formrow.querySelector('.litEventReadings');
        if (litEventReadings) litEventReadings.disabled = false;
    }
};

/**
 * Apply color fallback from existing liturgical event if color not specified
 * @param {Object} el - Decree element data
 * @param {string|null} existingKey - Existing liturgical event key
 */
const applyColorFallback = (el, existingKey) => {
    if (el.liturgical_event.hasOwnProperty('color') || existingKey === null) return;

    const fallbackEvent = LiturgicalEventCollection.find(ev => ev.event_key === existingKey);
    if (fallbackEvent && fallbackEvent.hasOwnProperty('color')) {
        el.liturgical_event.color = fallbackEvent.color;
    }
};

/**
 * Initialize form field multiselects and values from decree data
 * @param {Object} el - Decree element data
 * @param {Object} elements - Object containing form elements (colorSelect, commonSelect, gradeSelect, monthSelect, formGroupEl)
 */
const initializeDecreeFormFields = (el, elements) => {
    const { colorSelect, commonSelect, gradeSelect, monthSelect, formGroupEl } = elements;

    // Initialize color multiselect
    if (el.liturgical_event.hasOwnProperty('color') && colorSelect) {
        const colorVal = Array.isArray(el.liturgical_event.color)
            ? el.liturgical_event.color
            : el.liturgical_event.color.split(',');
        $(colorSelect).multiselect({
            buttonWidth: '100%',
            buttonClass: 'form-select',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
            },
        }).multiselect('deselectAll', false).multiselect('select', colorVal);
        if (FormControls.settings.colorField === false) {
            $(colorSelect).multiselect('disable');
        }
    }

    // Initialize common multiselect
    if (el.liturgical_event.hasOwnProperty('common') && FormControls.settings.commonFieldShow) {
        const common = Array.isArray(el.liturgical_event.common)
            ? el.liturgical_event.common
            : el.liturgical_event.common.split(',');
        const rowEl = formGroupEl?.closest('.row') || memorialsFromDecreesForm;
        setCommonMultiselect(rowEl, common);
        if (FormControls.settings.commonField === false && commonSelect) {
            $(commonSelect).multiselect('disable');
        }
    }

    // Initialize grade select
    if (FormControls.settings.gradeFieldShow && gradeSelect) {
        gradeSelect.value = el.liturgical_event.grade;
        if (FormControls.settings.gradeField === false) {
            gradeSelect.disabled = true;
        }
    }

    // Disable non-matching month options if month field is locked
    if (FormControls.settings.monthField === false && monthSelect) {
        monthSelect.querySelectorAll(`option[value]:not([value="${el.liturgical_event.month}"])`).forEach(opt => {
            opt.disabled = true;
        });
    }
};

const createMemorialsFromDecreesInterface = (data) => {
    saveDataBtn.disabled = true;
    tableContainer.style.display = 'none';
    addColumnBtn.style.display = 'none';
    showElement(memorialsFromDecreesBtnGrp, true);
    memorialsFromDecreesForm.innerHTML = '';

    data.forEach((el) => {
        const currentUniqid = FormControls.uniqid;
        const existingKey = prepareDecreeRowMetadata(el);

        // Create row HTML and fragment
        const rowHtml = FormControls.CreateDoctorRow(el);
        const rowFragment = createElementFromHTML(rowHtml);

        // Query elements BEFORE appending (DocumentFragment becomes empty after append)
        const formGroupEl = rowFragment.querySelector('.form-group');
        const titleDiv = rowFragment.querySelector('.data-group-title')?.parentElement;
        const elements = {
            formGroupEl,
            colorSelect: rowFragment.querySelector('.litEventColor'),
            commonSelect: rowFragment.querySelector(`#onTheFly${currentUniqid}Common`),
            gradeSelect: rowFragment.querySelector(`#onTheFly${currentUniqid}Grade`),
            monthSelect: rowFragment.querySelector(`#onTheFly${currentUniqid}Month`)
        };

        addDecreeDescription(el, titleDiv);
        memorialsFromDecreesForm.appendChild(rowFragment);

        // Configure row and initialize fields (references obtained before append are still valid)
        const formrow = formGroupEl?.closest('.row');
        configureDecreeRowDataset(formrow, el);
        applyColorFallback(el, existingKey);
        initializeDecreeFormFields(el, elements);
    });
};

const jsonFileData = {};

/**
 * Encode URL path segments individually (preserves slashes, encodes each segment)
 * @param {string} path - Path like "missals/EDITIO_TYPICA_1970"
 * @returns {string} - Encoded path like "missals/EDITIO_TYPICA_1970" (segments encoded if needed)
 */
const encodePathSegments = (path) => path.split('/').map(encodeURIComponent).join('/');

// Event: jsonFileSelect change
jsonFileSelect.addEventListener('change', async () => {
    const selectedOption = jsonFileSelect.options[jsonFileSelect.selectedIndex];
    const baseJsonFile = selectedOption.text;
    // Keep unencoded path for string checks (e.g., === 'decrees', includes('/US_'))
    const jsonFile = jsonFileSelect.value;
    // Encode path segments individually for URL construction (preserves slashes)
    const jsonFileFull = BaseUrl + '/' + encodePathSegments(jsonFile);

    if( false === jsonFileData.hasOwnProperty( baseJsonFile ) ) {
        try {
            const response = await fetch(jsonFileFull, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let data = await response.json();
            if (DEBUG) console.log('storing data in script cache...');
            // Handle API response format for decrees endpoint
            if (jsonFile === 'decrees') {
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
        if (DEBUG) console.log( 'using stored data to avoid making another fetch call uselessly...' );
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
            if (DEBUG) console.log( 'tableContainer was hidden, now showing in order to repopulate...' );
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
        const th = document.createElement('th');
        th.textContent = column;
        jsonDataTblThead.appendChild(th);
        jsonDataTblTbody.querySelectorAll('tr').forEach(tr => {
            const td = document.createElement('td');
            tr.appendChild(td);
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

    jsonDataTblTbody.querySelectorAll(':scope > tr').forEach((tr) => {
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
                        // Replace non-breaking spaces (U+00A0) with regular spaces and remove carriage returns
                        val = val.replaceAll('\u00A0', ' ').replaceAll('\r', '');
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
                            // Replace non-breaking spaces (U+00A0) with regular spaces and remove carriage returns
                            val = val.replaceAll('\u00A0', ' ').replaceAll('\r', '');
                            subJson[currentProperty][prop] = val;
                        }
                    });
                }
                newRow[props[j]] = subJson;
            } else {
                const cellText = td.textContent.trim();
                if(intProps.includes(props[j])) {
                    // Handle empty, null, or undefined values
                    if (cellText === '' || cellText.toLowerCase() === 'null' || cellText.toLowerCase() === 'undefined') {
                        newRow[props[j]] = null;
                    } else {
                        const parsed = parseInt(cellText, 10);
                        newRow[props[j]] = Number.isNaN(parsed) ? null : parsed;
                    }
                } else {
                    newRow[props[j]] = cellText;
                }
            }
        });
        jsonData.push(newRow);
    });

    // Keep unencoded path for logging, encode segments for URL
    const endpoint = jsonFileSelect.value;
    const jsonstring = JSON.stringify(jsonData, null, 4).replace(/[\r]/g, '');
    if (DEBUG) {
        console.log('Attempting to save data to endpoint: ' + endpoint);
        console.log(jsonData);
    }

    // Determine the API endpoint for saving (encode path segments individually)
    const apiUrl = BaseUrl + '/' + encodePathSegments(endpoint);

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
        if (DEBUG) console.log(data);
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

    const currentUniqid = parseInt(FormControls.uniqid, 10);
    const modal = target.closest('.actionPromptModal');
    const modalForm = modal.querySelector('form');
    const existingEventInput = modalForm.querySelector('.existingLiturgicalEventName');
    // Use raw value for data lookups - escapeHtml is only for HTML output
    const existingLiturgicalEventKey = existingEventInput?.value || '';
    let propertyToChange;

    FormControls.settings.decreeUrlFieldShow = true;
    FormControls.settings.decreeLangMapFieldShow = true;
    setFormSettings(target.id);

    if (target.id === 'setPropertyButton') {
        const propertySelect = document.getElementById('propertyToChange');
        // Use raw value for function arguments and dataset attributes
        propertyToChange = propertySelect?.value || '';
        setFormSettingsForProperty(propertyToChange);
    }

    // Create form row
    const rowHtml = existingLiturgicalEventKey !== ''
        ? FormControls.CreateDoctorRow(existingLiturgicalEventKey)
        : FormControls.CreateDoctorRow();
    const rowFragment = createElementFromHTML(rowHtml);

    // Query elements BEFORE prepending (DocumentFragment becomes empty after prepend)
    const formGroupEl = rowFragment.querySelector('.form-group');
    const colorSelect = rowFragment.querySelector('.litEventColor');
    const commonSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Common`);
    const gradeSelect = rowFragment.querySelector(`#onTheFly${currentUniqid}Grade`);

    // Prepend to form and hide modal
    memorialsFromDecreesForm.prepend(rowFragment);
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();

    // Set data attributes on form row
    const formrow = formGroupEl?.closest('.row');
    if (formrow) {
        formrow.dataset.action = FormControls.action;
        if (FormControls.action === RowAction.SetProperty) {
            formrow.dataset.prop = propertyToChange;
        }
    }

    // Initialize multiselects using helper function
    initializeColorMultiselect(colorSelect, FormControls.settings.colorField === false);

    if (FormControls.settings.commonFieldShow) {
        const rowEl = formGroupEl?.closest('.row') || memorialsFromDecreesForm;
        setCommonMultiselect(rowEl, null);
        if (FormControls.settings.commonField === false && commonSelect) {
            $(commonSelect).multiselect('disable');
        }
    }

    if (FormControls.settings.gradeFieldShow && FormControls.settings.gradeField === false && gradeSelect) {
        gradeSelect.disabled = true;
    }

    // Populate form from existing event using helper function
    if (existingLiturgicalEventKey !== '') {
        const litevent = LiturgicalEventCollection.find(el => el.event_key === existingLiturgicalEventKey);
        const monthSelect = formrow?.querySelector(`#onTheFly${currentUniqid}Month`);
        populateFormFromEvent(litevent, { gradeSelect, commonSelect, colorSelect, monthSelect }, FormControls.settings.monthField === false);
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

    // Check if value exists in datalist by iterating options (avoids selector injection)
    const targetValue = target.value;
    const optionExists = Array.from(existingLiturgicalEventsList.options).some(opt => opt.value === targetValue);

    if (optionExists) {
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

    const uniqid = parseInt(target.dataset.rowUniqid, 10);
    const selectedOption = jsonFileSelect.options[jsonFileSelect.selectedIndex];
    const currentJsonFile = selectedOption.text;
    const eventKeyInput = document.getElementById(`onTheFly${uniqid}EventKey`);
    // Use raw value for data comparison - escapeHtml is only for HTML output, not data matching
    const eventKey = eventKeyInput?.value || '';
    const liturgicalEventData = jsonFileData[currentJsonFile]?.find(el => el.liturgical_event.event_key === eventKey);
    const strtotime = liturgicalEventData?.liturgical_event?.strtotime || {};

    // Toggle: if currently active, switch to inactive and vice versa
    const isCurrentlyActive = target.getAttribute('aria-pressed') === 'true';
    const newActiveState = !isCurrentlyActive;
    toggleStrtotimeButton(target, newActiveState);

    if (newActiveState) {
        switchToStrtotimeUI(uniqid, strtotime);
    } else {
        switchToFixedDateUI(uniqid, liturgicalEventData);
    }
});
