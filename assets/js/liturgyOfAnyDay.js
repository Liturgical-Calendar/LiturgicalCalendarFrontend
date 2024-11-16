const isStaging = location.href.includes( "-staging" );
const endpointV = isStaging ? "dev" : "v3";
const endpointURL = `${API_URL}/calendar` ?? `https://litcal.johnromanodorazio.com/api/${endpointV}/calendar`;

let CalData = null;
let dtFormat = new Intl.DateTimeFormat(currentLocale.language, { dateStyle: 'full' });
const now = new Date();
let liturgyDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
let highContrast = [ 'green', 'red', 'purple' ];

jQuery(() => {
    document.querySelector('#monthControl').value = now.getMonth() + 1;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    document.querySelector('#dayControl').setAttribute("max", daysInMonth);
    document.querySelector('#dayControl').value = now.getDate();

    switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
        case 'nationalcalendar':
            CalendarState.calendarType = 'nation';
            CalendarState.calendar = document.querySelector('#calendarSelect').value;
            if (CalendarState.calendar === 'VA') {
                CalendarState.calendarType = '';
            }
            break;
        case 'diocesancalendar':
            CalendarState.calendarType = 'diocese';
            CalendarState.calendar = document.querySelector('#calendarSelect').value;
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
        return `${endpointURL}/${CalendarState.calendarType !== '' ? `${CalendarState.calendarType}/${CalendarState.calendar}/` : ''}${CalendarState.year}?year_type=CIVIL`;
    }
}

$(document).on("change", "#monthControl,#yearControl,#calendarSelect,#dayControl", (event) => {
    let apiRequest = false;
    if (["monthControl", "yearControl"].includes(event.currentTarget.id)) {
        const year =  document.querySelector('#yearControl').value;
        const month = document.querySelector('#monthControl').value;
        const daysInMonth = new Date(year, month, 0).getDate();
        document.querySelector('#dayControl').setAttribute("max", daysInMonth);
        if (document.querySelector('#dayControl').value > daysInMonth) {
            document.querySelector('#dayControl').value = daysInMonth;
            CalendarState.day = document.querySelector('#dayControl').value;
        }
    }
    if (["yearControl", "calendarSelect"].includes(event.currentTarget.id)) {
        switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
            case 'nationalcalendar':
                CalendarState.calendarType = 'nation';
                CalendarState.calendar = document.querySelector('#calendarSelect').value;
                break;
            case 'diocesancalendar':
                CalendarState.calendarType = 'diocese';
                CalendarState.calendar = document.querySelector('#calendarSelect').value;
                break;
            default:
                CalendarState.calendarType = '';
                CalendarState.calendar = '';
        }
        apiRequest = true;
    }
    if (["monthControl", "dayControl", "yearControl"].includes(event.currentTarget.id)) {
        CalendarState.year = document.querySelector('#yearControl').value;
        CalendarState.month = document.querySelector('#monthControl').value;
        CalendarState.day = document.querySelector('#dayControl').value;
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
        let headers = {
            'Origin': location.origin
        };
        if (CalendarState.calendar === 'VA') {
            headers['Accept-Language'] = currentLocale.language;
        }
        fetch(CalendarState.requestPath, {headers})
            .then(response => response.json())
            .then(data => {
                if( data.hasOwnProperty('litcal') ) {
                    CalData = data.litcal;
                    let liturgyOfADay = CalData.filter((celebration) => celebration.date === timestamp );
                    updateResults(liturgyOfADay);
                } else {
                    $('#liturgyResults').append(`<div>ERROR: no 'litcal' property: ${JSON.stringify(data)}</div>`);
                }
            })
            .catch(error => {
                $('#liturgyResults').append(`<div>ERROR: ${JSON.stringify(error)}</div>`);
            });
    } else {
        //key === key is superfluous, it's just to make codefactor happy that key is being used!
        let liturgyOfADay = CalData.filter((celebration) => celebration.date === timestamp );
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
 * Updates the liturgy results section with the given liturgy of a day array.
 * @param {Object[]} liturgyOfADay - an array of liturgical events, with each event
 *      containing properties:
 *          * date: number - the date of the event in seconds since the Unix epoch
 *          * event_key: string - the key of the event
 *          * name: string - the name of the event
 *          * grade: number - the grade of the event
 *          * grade_display: string - the display version of the grade of the event
 *          * common: string[] - the common of the event
 *          * common_lcl: string - the localized version of the common of the event
 *          * grade_lcl: string - the localized version of the grade of the event
 *          * liturgical_year: string - the liturgical year of the event
 *          * color: string[] - the color of the event
 */
let updateResults = (liturgyOfADay) => {
    $('#dateOfLiturgy').text( dtFormat.format(liturgyDate) );
    $('#liturgyResults').empty();
    liturgyOfADay.forEach((celebration) => {
        const lclzdGrade = celebration.grade < 7 ? celebration.grade_lcl : '';
        const isSundayOrdAdvLentEaster = filterTagsDisplayGrade.some(pattern => pattern.test(celebration.event_key));
        const celebrationGrade = celebration.grade_display !== ''
            ? celebration.grade_display
            : (!isSundayOrdAdvLentEaster ? lclzdGrade : '');
        const celebrationCommon = celebration.common.length ? celebration.common_lcl : '';
        const celebrationColor = celebration.color;
        let finalHTML = `<div class="p-4 m-4 border rounded" style="background-color:${celebrationColor[0]};color:${highContrast.includes(celebrationColor[0]) ? "white" : "black"};">`;
        finalHTML += `<h3>${celebration.name}</h3>`;
        finalHTML += (celebrationGrade !== '' ? `<div>${celebrationGrade}</div>` : '');
        finalHTML += `<div>${celebrationCommon}</div>`;
        finalHTML += (celebration.hasOwnProperty('liturgical_year') ? `<div>${celebration.liturgical_year}</div>` : '');
        finalHTML += `</div>`;
        $('#liturgyResults').append(finalHTML);
    });
}
