jQuery(() => {
    getLiturgyOfADay();
});

let queryString = '';
let CalData = {};
let dtFormat = new Intl.DateTimeFormat((Cookies.get('currentLocale') || 'en'), { dateStyle: 'full' });
let newDate = new Date();
let highContrast = [ "green", "red", "purple" ];

$(document).on("change", "#monthControl,#yearControl", ev => {
    let year =  $('#yearControl').val();
    let month = $('#monthControl').val();
    let daysInMonth = new Date(year, month, 0).getDate();
    $('#dayControl').attr("max",daysInMonth);
    getLiturgyOfADay();
});

$(document).on("change", "#calendarSelect,#dayControl", () => {
    getLiturgyOfADay();
});

let getLiturgyOfADay = () => {
    let year =  $('#yearControl').val();
    let month = $('#monthControl').val();
    let day = $('#dayControl').val();
    newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) );
    let timestamp = newDate.getTime() / 1000;
    
    let params = {
        year: year
    };
    switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
        case 'nationalcalendar':
            params.nationalcalendar = $('#calendarSelect').val();
            break;
        case 'diocesancalendar':
            params.diocesancalendar = $('#calendarSelect').val();
            break;
        default:
            params.diocesancalendar = 'DIOCESIDIROMA';
    }
    let newQueryString = new URLSearchParams(params).toString();
    if( newQueryString !== queryString ) {
        console.log( 'queryString has changed. queryString = ' + queryString + ', newQueryString = ' + newQueryString );
        queryString = newQueryString;
        $.getJSON( `https://litcal.johnromanodorazio.com/api/v3/LitCalEngine.php?${queryString}`, data => {
            if( data.hasOwnProperty('LitCal') ) {
                CalData = data.LitCal;
                console.log( 'now filtering entries with a date value of ' + timestamp );
                let liturgyOfADay = Object.entries(CalData).filter(([key, value]) => parseInt(value.date) === timestamp );
                updateResults(liturgyOfADay);
            } else {
                $('#liturgyResults').append(`<div>ERROR: no LitCal property: ${JSON.stringify(data)}</div>`);
            }
        });
    } else {
        console.log( 'queryString has not changed, no need for a new ajax request: ' + queryString );
        let liturgyOfADay = Object.entries(CalData).filter(([key, value]) => parseInt(value.date) === timestamp );
        updateResults( liturgyOfADay );
    }
}

const translCommon = common => {
    if( common === 'Proper' ) {
        return i18next.t('Proper');
    } else {
        $commons = common.split(",");
        $commons = $commons.map($txt => {
            let $common = $txt.split(":");
            let $commonGeneral = i18next.t($common[0].replaceAll(' ', '-'));
            let $commonSpecific = (typeof $common[1] !== 'undefined' && $common[1] != "") ? i18next.t($common[1].replaceAll(' ', '-')) : "";
            let $commonKey = '';
            //$txt = str_replace(":", ": ", $txt);
            switch ($commonGeneral) {
                case i18next.t("Blessed-Virgin-Mary"):
                    $commonKey = i18next.t("of", {context: "(SING_FEMM)"});
                    break;
                case i18next.t("Virgins"):
                    $commonKey = i18next.t("of", {context: "(PLUR_FEMM)"});
                    break;
                case i18next.t("Martyrs"):
                case i18next.t("Pastors"):
                case i18next.t("Doctors"):
                case i18next.t("Holy-Men-and-Women"):
                    $commonKey = i18next.t("of", {context: "(PLUR_MASC)"});
                    break;
                default:
                    $commonKey = i18next.t("of", {context: "(SING_MASC)"});
            }
            return i18next.t("From-the-Common") + " " + $commonKey + " " + $commonGeneral + ($commonSpecific != "" ? ": " + $commonSpecific : "");
        });
        return $commons.join("; " + i18next.t("or") + " ");
    }
}

let updateResults = liturgyOfADay => {
    $('#dateOfLiturgy').text( dtFormat.format(newDate) );
    $('#liturgyResults').empty();
    liturgyOfADay.forEach(el => {
        let eventData = el[1];
        let eventDataCommon = eventData.common !== '' ? translCommon(eventData.common) : '';
        $('#liturgyResults').append(`<div class="p-4 m-4 border rounded" style="background-color:${eventData.color};color:${highContrast.includes(eventData.color) ? "white" : "black"};"><h3>${eventData.name}</h3>${'<div>' + eventDataCommon + '</div>'}${eventData.hasOwnProperty('liturgicalYear') ? '<div>' + eventData.liturgicalYear + '</div>' : ''}</div>`);
    });
}
