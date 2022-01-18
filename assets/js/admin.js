const isStaging = location.href.includes('-staging');

const createPropriumDeTemporeTable = ( data ) => {
    const $theadRow = $('#jsonDataTbl thead tr');
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
    $('#jsonDataTbl tbody').append( tbodyHtmlStrr );
}
/*
$(document).ready(() => {

});
*/
$(document).on('change', '#jsonFileSelect', () => {
    let jsonFile = $('#jsonFileSelect').val();
    if( isStaging ) {
        console.log('we cannot actually manage the JSON files in the staging environment, because of CORS issues');
        jsonFile = 'https://litcal.johnromanodorazio.com/' + jsonFile;
        return false;
    } else {
        jsonFile = './' + jsonFile;
    }
    $.getJSON(jsonFile, data => {
        console.log(data);
        const $theadRow = $('#jsonDataTbl thead tr');
        $('#jsonDataTbl tbody').empty();
        $theadRow.empty();
        if( Array.isArray(data) ) {
            const keys = Object.keys( data[0] );
            keys.forEach(el => {
                $theadRow.append(`<th>${el}</th>`);
            });
            data.forEach(row => {
                let $tr = $('<tr>');
                keys.forEach(prop => {
                    $tr.append(`<td contenteditable="false">${row[prop]}</td>`);
                });
                $('#jsonDataTbl tbody').append($tr);
            });
        } else {
            createPropriumDeTemporeTable( data );
        }
    });
});

//$(document).on('dblclick', '#jsonDataTbl th,#jsonDataTbl td', ev => {
    $(document).on('dblclick', '#jsonDataTbl table tr td:last-child', ev => {
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
    $('#jsonDataTbl th').each((i,el) => {
        props.push($(el).text());
    });
    $('#jsonDataTbl > tbody > tr').each((i,el) => {
        let newRow = {};
        $(el).find('> td').each((i,el) => {
            if( $(el).find('table').length ) {
                let subJson = {};
                $(el).find('table tr').each((j,em) => {
                    let prop    = $(em).find('td:first-child').text();
                    let val     = $(em).find('td:last-child').text();
                    subJson[prop] = val;
                });
                newRow[props[i]] = subJson;
            } else {
                newRow[props[i]] = $(el).text();
            }
        });
        jsonData.push(newRow);
    });
    //navigator.clipboard.writeText( JSON.stringify(jsonData) );
    //alert('JSON data copied to clipboard');
    let filename = $('#jsonFileSelect').val();
    let jsonstring = JSON.stringify(jsonData, null, 4);
    console.log('now writing jsonData to file ' + filename);
    console.log(jsonData);
    $.ajax({
        method: 'POST',
        url: 'includes/writeJSONFile.php',
        data: { filename: filename, jsondata: jsonstring },
        success: data => {
            //if( data === 'SUCCESS' )
            console.log(data);
        }
    });
});
