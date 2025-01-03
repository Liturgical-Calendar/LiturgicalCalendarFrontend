import {
    FormControls,
    RowAction,
    setFormSettings,
    setFormSettingsForProperty,
    setCommonMultiselect,
    DaysOfTheWeek
} from './FormControls.js';

import {
    sanitizeInput
} from './templates.js';

// The global messages object is set in admin.php
const { LOCALE } = messages;
FormControls.jsLocale = LOCALE.replace('_','-');
FormControls.weekdayFormatter = new Intl.DateTimeFormat(FormControls.jsLocale, { weekday: "long" });

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
            let existingFestivityTag = el.Festivity.hasOwnProperty( 'tag' ) ? el.Festivity.tag : null;
            if( el.Metadata.action === RowAction.CreateNew && FestivityCollectionKeys.includes( existingFestivityTag ) ) {
                el.Metadata.action = RowAction.CreateNewFromExisting;
            }
            setFormSettings( el.Metadata.action );
            if( el.Metadata.action === RowAction.SetProperty ) {
                setFormSettingsForProperty( el.Metadata.property );
            }

            let $row = $(FormControls.CreateDoctorRow( el ));
            $('#memorialsFromDecreesForm').append($row);

            let $formrow = $row.find('.form-group').closest('.row');
            $formrow.data('action', el.Metadata.action).attr('data-action', el.Metadata.action);
            if( el.Metadata.action === RowAction.SetProperty ) {
                $formrow.data('prop', el.Metadata.property).attr('data-prop', el.Metadata.property);
            }
            if( el.Festivity.hasOwnProperty('common') && el.Festivity.common.includes('Proper') ) {
                $formrow.find('.litEventReadings').prop('disabled', false);
            }

            if( false === el.Festivity.hasOwnProperty( 'color' ) ) {
                if( existingFestivityTag !== null ) {
                    el.Festivity.color = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0].color;
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

    },
    jsonFileData = {};


$(document).on('change', '#jsonFileSelect', () => {
    let baseJsonFile = $('#jsonFileSelect :selected').text();
    let jsonFile = sanitizeInput( $('#jsonFileSelect').val() );
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
    let filename = sanitizeInput( $('#jsonFileSelect').val() );
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
    let currentUniqid = parseInt( FormControls.uniqid );
    let $modal = $(ev.currentTarget).closest('.actionPromptModal');
    let $modalForm = $modal.find('form');
    let existingFestivityTag = sanitizeInput( $modalForm.find('.existingFestivityName').val() );
    let propertyToChange;
    //let buttonId = ev.currentTarget.id;
    //console.log(buttonId + ' button was clicked');
    FormControls.settings.decreeURLField = true;
    FormControls.settings.decreeLangMapField = true; //TODO: check how this should be set, it's different than extending.js
    setFormSettings( ev.currentTarget.id );
    if( ev.currentTarget.id === 'setPropertyButton' ) {
        propertyToChange = sanitizeInput( $('#propertyToChange').val() );
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
    if( FormControls.action.description === RowAction.SetProperty ) {
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
        litevent = FestivityCollection.filter(el => el.event_key === existingFestivityTag)[0];

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
    const curTargVal = sanitizeInput( $(ev.currentTarget).val() );
    if ($('#existingFestivitiesList').find('option[value="' + curTargVal + '"]').length > 0) {
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
    let uniqid = parseInt( $(ev.currentTarget).attr('data-row-uniqid') );
    let currentJsonFile = $('#jsonFileSelect :selected').text();
    let tag = sanitizeInput( $(`#onTheFly${uniqid}Tag`).val() );
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
            $strToTimeFormGroup += `<option value="${DaysOfTheWeek[i]}"${strtotime.hasOwnProperty('dayOfTheWeek') && strtotime.dayOfTheWeek === DaysOfTheWeek[i] ? ' selected': ''}>${FormControls.weekdayFormatter.format(dayOfTheWeek)}</option>`;
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
        let formatter = new Intl.DateTimeFormat(FormControls.jsLocale, { month: 'long' });
        for (let i = 0; i < 12; i++) {
            let month = new Date(Date.UTC(0, i, 2, 0, 0, 0));
            formRow += `<option value=${i + 1}${typeof festivityData !== 'undefined' && festivityData.Festivity.hasOwnProperty('month') && festivityData.Festivity.month === i+1 ? ' selected' : ''}>${formatter.format(month)}</option>`;
        }
        formRow += `</select>
        </div>`;
        $strToTimeFormGroup.after(formRow);
    }
});

