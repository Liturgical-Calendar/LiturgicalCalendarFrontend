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
    $('#jsonDataTbl').addClass('propriumDeTempore');
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
            $('#jsonDataTbl').removeClass('propriumDeTempore');
            let n;
            if( jsonFile.includes('USA') || jsonFile.includes('ITALY') ) {
                $('#jsonDataTbl').addClass('nationalCalendar');
                n = [0, 10, 10, 14, 0, 5, 0, 25, 0, 6, 30];
            } else {
                $('#jsonDataTbl').removeClass('nationalCalendar');
                n = [0, 10, 10, 14, 5, 25, 0, 6, 30];
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
                    if( typeof row[prop] === 'object' ){
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
        } else {
            createPropriumDeTemporeTable( data );
        }
    });
});

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
    const intProps = ["RECURRENCE_ID","MONTH","DAY","GRADE"];

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
