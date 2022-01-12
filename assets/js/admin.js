const isStaging = location.href.includes('-staging');

$(document).ready(() => {

});
$(document).on('change', '#jsonFileSelect', () => {
    let JSON;
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
        $('#jsonDataTbl tbody').empty();
        $('#jsonDataTbl thead tr').empty();
        const keys = Object.keys( data[0] );
        keys.forEach(el => {
            $('#jsonDataTbl thead tr').append(`<th>${el}</th>`);
        });
        data.forEach(row => {
            let $tr = $('tr');
            keys.forEach(prop => {
                $tr.append(`<td contenteditable="false">${row[prop]}</td>`);
            });
            $('#jsonDataTbl tbody').append($tr);
        });
    });
});

$(document).on('dblclick', '#jsonDataTbl th,#jsonDataTbl td', ev => {
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
    $('#jsonDataTbl tbody tr').each((i,el) => {
        let newRow = {};
        $(el).find('td').each((i,el) => {
            newRow[props[i]] = $(el).text();
        });
        jsonData.push(newRow);
    });
    //navigator.clipboard.writeText( JSON.stringify(jsonData) );
    //alert('JSON data copied to clipboard');
    let filename = $('#jsonFileSelect').val();
    let jsonstring = JSON.stringify(jsonData);
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
