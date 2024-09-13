const isStaging = location.href.includes( "-staging" );
const endpointV = isStaging ? "dev" : "v3";
const endpointURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/calendar`;
let CalData = null;
let dtFormat = new Intl.DateTimeFormat(currentLocale.language, { dateStyle: 'full' });
const now = new Date();
let liturgyDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
let highContrast = [ "green", "red", "purple" ];

if( typeof currentLocale === 'undefined' ) {
    currentLocale = new Intl.Locale(Cookies.get('currentLocale').replaceAll('_','-') || 'en');
}

jQuery(() => {
    switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
        case 'nationalcalendar':
            CalendarState.calendarType = 'nation';
            CalendarState.calendar = $('#calendarSelect').val();
            if (CalendarState.calendar === 'VATICAN') {
                CalendarState.calendarType = '';
            }
            break;
        case 'diocesancalendar':
            CalendarState.calendarType = 'diocese';
            CalendarState.calendar = $('#calendarSelect').val();
            break;
        default:
            CalendarState.calendarType = '';
            CalendarState.calendar = '';
    }
    getLiturgyOfADay(true);
});

class CalendarState {
    static year         = liturgyDate.getFullYear();
    static month        = liturgyDate.getMonth() + 1;
    static day          = liturgyDate.getDate();
    static calendar     = 'DIOCESIDIROMA';
    static calendarType = 'diocese';
    /**
     * Returns the full endpoint URL for the API /calendar endpoint
     * @returns {string} The full endpoint URL for the API /calendar endpoint
     */
    static get requestPath () {
        return `${endpointURL}/${CalendarState.calendarType !== '' ? `${CalendarState.calendarType}/${CalendarState.calendar}/` : ''}${CalendarState.year}`;
    }
}

$(document).on("change", "#monthControl,#yearControl,#calendarSelect,#dayControl", (event) => {
    let apiRequest = false;
    if (["monthControl", "yearControl"].includes(event.currentTarget.id)) {
        let year =  $('#yearControl').val();
        let month = $('#monthControl').val();
        let daysInMonth = new Date(year, month, 0).getDate();
        $('#dayControl').attr("max",daysInMonth);
    }
    if (["yearControl", "calendarSelect"].includes(event.currentTarget.id)) {
        switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
            case 'nationalcalendar':
                CalendarState.calendarType = 'nation';
                CalendarState.calendar = $('#calendarSelect').val();
                break;
            case 'diocesancalendar':
                CalendarState.calendarType = 'diocese';
                CalendarState.calendar = $('#calendarSelect').val();
                break;
            default:
                CalendarState.calendarType = '';
                CalendarState.calendar = '';
        }
        apiRequest = true;
    }
    if (["monthControl", "dayControl", "yearControl"].includes(event.currentTarget.id)) {
        CalendarState.year = $('#yearControl').val();
        CalendarState.month = $('#monthControl').val();
        CalendarState.day = $('#dayControl').val();
        liturgyDate = new Date(Date.UTC(CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0));
    }
    getLiturgyOfADay(apiRequest);
});


/**
 * If apiRequest is true, this function makes an AJAX call to the API endpoint
 * defined in CalendarState.requestPath and updates the #liturgyResults element
 * with the result. If apiRequest is false, this function just updates the
 * #liturgyResults element with the result of filtering the CalData object for
 * the data with a date matching the timestamp of liturgyDate.
 *
 * @param {boolean} [apiRequest=false] - whether to make an AJAX call to the API endpoint
 */
let getLiturgyOfADay = (apiRequest = false) => {
    let timestamp = liturgyDate.getTime() / 1000;
    if( apiRequest ) {
        let headers = {};
        if (CalendarState.calendar === 'VATICAN') {
            headers['Accept-Language'] = currentLocale.language;
        }
        $.ajax({
            url: CalendarState.requestPath,
            headers: headers,
            success: (data, textStatus, xhr) => {
                if( data.hasOwnProperty('litcal') ) {
                    CalData = data.litcal;
                    //key === key is superfluous, it's just to make codefactor happy that key is being used!
                    let liturgyOfADay = Object.entries(CalData).filter(([key, value]) => value.date === timestamp && key === key );
                    updateResults(liturgyOfADay);
                } else {
                    $('#liturgyResults').append(`<div>ERROR: no 'litcal' property: ${JSON.stringify(data)}</div>`);
                }
            },
            error: (xhr, textStatus, errorThrown) => {
                $('#liturgyResults').append(`<div>ERROR: ${JSON.stringify(xhr)}</div>`);
            }
        });
    } else {
        //key === key is superfluous, it's just to make codefactor happy that key is being used!
        let liturgyOfADay = Object.entries(CalData).filter(([key, value]) => value.date === timestamp && key === key );
        updateResults(liturgyOfADay);
    }
}

const filterTagsDisplayGrade = [
    /OrdSunday[0-9]{1,2}(_vigil){0,1}/,
    /Advent[1-4](_vigil){0,1}/,
    /Lent[1-5](_vigil){0,1}/,
    /Easter[1-7](_vigil){0,1}/
];


/**
 * Displays the liturgical events for the currently selected day.
 * @param {Object[][]} liturgyOfADay - A 2D array of objects where the outer
 *   array contains the events for the day. Each inner array contains two
 *   elements: the first is the tag of the event (e.g. "OrdSunday1") and the
 *   second is the event data.
 */
let updateResults = (liturgyOfADay) => {
    $('#dateOfLiturgy').text( dtFormat.format(liturgyDate) );
    $('#liturgyResults').empty();
    liturgyOfADay.forEach(([tag,eventData]) => {
        const lclzdGrade = eventData.grade < 7 ? eventData.grade_lcl : '';
        const isSundayOrdAdvLentEaster = filterTagsDisplayGrade.some(pattern => pattern.test(tag));
        const eventDataGrade = eventData.display_grade !== ''
            ? eventData.displayGrade
            : (!isSundayOrdAdvLentEaster ? lclzdGrade : '');
        const eventDataCommon = eventData.common.length ? eventData.common_lcl : '';
        const eventDataColor = eventData.color;
        let finalHTML = `<div class="p-4 m-4 border rounded" style="background-color:${eventDataColor[0]};color:${highContrast.includes(eventDataColor[0]) ? "white" : "black"};">`;
        finalHTML += `<h3>${eventData.name}</h3>`;
        finalHTML += (eventDataGrade !== '' ? `<div>${eventDataGrade}</div>` : '');
        finalHTML += `<div>${eventDataCommon}</div>`;
        finalHTML += (eventData.hasOwnProperty('liturgical_year') ? `<div>${eventData.liturgical_year}</div>` : '');
        finalHTML += `</div>`;
        $('#liturgyResults').append(finalHTML);
    });
}
