const now         = new Date();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
let liturgyDate   = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
let dtFormat      = new Intl.DateTimeFormat(currentLocale.language, { dateStyle: 'full' });
let highContrast  = [ 'green', 'red', 'purple' ];
let CalData       = null;


class CalendarState {
    // We initialize the default state to today's date
    static #previousYearTypeValue  = (now.getMonth() + 1 === 12 && now.getDate() === 31) ? 'LITURGICAL' : 'CIVIL';
    static #year                   = now.getFullYear();
    static #month                  = now.getMonth() + 1;
    static #day                    = now.getDate();
    static #calendar               = '';
    static #calendarType           = '';
    static #apiRequestFlag         = true; // we need an initial API request to load data

    /**
     * Determines the correct value for the year_type parameter based on the current day and month.
     * If the current date is December 31st, returns 'LITURGICAL', otherwise returns 'CIVIL'.
     * @returns {string} The year type for the current date.
     * @example CalendarState.yearType // returns 'LITURGICAL' or 'CIVIL'
     */
    static get yearType () {
        const isDec31 = (this.#month === 12 && this.#day === 31);
        console.log(`Determining year type for date ${this.#year}-${this.#month}-${this.#day}: is December 31st? ${isDec31 ? 'yes' : 'no'}; year type: ${isDec31 ? 'LITURGICAL' : 'CIVIL'}`);
        return isDec31 ? 'LITURGICAL' : 'CIVIL';
    }

    /**
     * Returns the full endpoint URL for the API /calendar endpoint
     * @returns {string} The full endpoint URL for the API /calendar endpoint
     */
    static get requestPath () {
        const yearPathParam = this.yearType === 'LITURGICAL' ? this.#year + 1 : this.#year;
        const pathParams = this.#calendarType !== '' ? `${this.#calendarType}/${this.#calendar}/` : '';
        return `${CalendarUrl}/${pathParams}${yearPathParam}?year_type=${this.yearType}`;
    }

    static get apiRequestFlag() {
        return this.#apiRequestFlag;
    }

    static get year() {
        return this.#year;
    }

    static get month() {
        return this.#month;
    }

    static get day() {
        return this.#day;
    }

    static #evaluateApiRequest() {
        console.log(`Evaluating API request necessity. Previous year type: ${this.#previousYearTypeValue}, Current year type: ${this.yearType}`);
        if (this.#previousYearTypeValue !== this.yearType) {
            this.#previousYearTypeValue = (this.#previousYearTypeValue === 'CIVIL') ? 'LITURGICAL' : 'CIVIL';
            this.#apiRequestFlag = true;
        }
    }

    static resetApiRequestFlag() {
        this.#apiRequestFlag = false;
        console.log(`Resetting API request flag: ${this.#apiRequestFlag ? 'true' : 'false'}`);
    }

    static set year (newYearValue) {
        this.#year = parseInt(newYearValue, 10);
        this.#apiRequestFlag = true;
    }


    static set month (newMonthValue) {
        console.log(`Setting month to ${newMonthValue}, current day is ${this.#day}`);
        this.#month = parseInt(newMonthValue, 10);
        this.#evaluateApiRequest();
    }


    static set day (newDayValue) {
        console.log(`Setting day to ${newDayValue}, current month is ${this.#month}`);
        this.#day = parseInt(newDayValue, 10);
        this.#evaluateApiRequest();
    }

    static set calendar (newCalendarValue) {
        this.#calendar = (newCalendarValue === 'VA') ? '' : newCalendarValue;
        this.#apiRequestFlag = true;
    }

    static set calendarType (newCalendarTypeValue) {
        this.#calendarType = (this.#calendar === 'VA' || this.#calendar === '') ? '' : newCalendarTypeValue;
        this.#apiRequestFlag = true;
    }
}


const filterTagsDisplayGrade = [
    /OrdSunday[0-9]{1,2}(_vigil){0,1}/,
    /Advent[1-4](_vigil){0,1}/,
    /Lent[1-5](_vigil){0,1}/,
    /Easter[1-7](_vigil){0,1}/
];

$(document).on("change", "#monthControl,#yearControl,#calendarSelect,#dayControl", (event) => {
    if (["monthControl", "yearControl"].includes(event.currentTarget.id)) {
        const year =  document.querySelector('#yearControl').value;
        const month = document.querySelector('#monthControl').value;
        const daysInMonth = new Date(year, month, 0).getDate();
        document.querySelector('#dayControl').setAttribute("max", daysInMonth);
        if (document.querySelector('#dayControl').value > daysInMonth) {
            document.querySelector('#dayControl').value = daysInMonth;
            CalendarState.day = daysInMonth;
        }
    }

    switch( event.currentTarget.id ) {
        case 'monthControl':
            CalendarState.month = document.querySelector('#monthControl').value;
            liturgyDate = new Date(Date.UTC(CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0));
            break;
        case 'dayControl':
            CalendarState.day = document.querySelector('#dayControl').value;
            liturgyDate = new Date(Date.UTC(CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0));
            break;
        case 'yearControl':
            CalendarState.year = document.querySelector('#yearControl').value;
            liturgyDate = new Date(Date.UTC(CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0));
            break;
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
    }

    getLiturgyOfADay();
});


/**
 * If apiRequest is true, this function fetches data from the API endpoint
 * defined in CalendarState.requestPath and updates the #liturgyResults element
 * with the result. If apiRequest is false, this function just updates the
 * #liturgyResults element with the result of filtering the CalData object for
 * the data with a date matching the timestamp of liturgyDate.
 *
 */
let getLiturgyOfADay = () => {
    const rfc3339datetime = liturgyDate.toISOString().split('.')[0] + '+00:00';
    console.log(`Getting liturgy of day for date ${rfc3339datetime} (API request: ${CalendarState.apiRequestFlag ? 'yes' : 'no'})`);

    if( CalendarState.apiRequestFlag ) {
        console.log(`Fetching data from ${CalendarState.requestPath}`);
        const headers = new Headers();
        headers.append('Origin', location.origin);
        if (CalendarState.calendar === 'VA' || CalendarState.calendar === '') {
            headers.append('Accept-Language', currentLocale.language);
        }
        const url = new URL(CalendarState.requestPath);
        const request = new Request(url, {
            method: "GET",
            headers
        });
        fetch(request)
            .then(response => response.json())
            .then(data => {
                if( data.hasOwnProperty('litcal') ) {
                    CalData = data.litcal;
                    console.log(`Fetched ${CalData.length} liturgical events for year ${CalendarState.year}`);
                    console.log(CalData);
                    const liturgyOfADay = CalData.filter((celebration) => celebration.date === rfc3339datetime);
                    console.log(`Found ${liturgyOfADay.length} liturgical events for date ${rfc3339datetime}`);
                    console.log(liturgyOfADay);
                    updateResults(liturgyOfADay);
                } else {
                    $('#liturgyResults').append(`<div>ERROR: no 'litcal' property: ${JSON.stringify(data)}</div>`);
                }
                CalendarState.resetApiRequestFlag();
            })
            .catch(error => {
                console.error('Error fetching liturgy of a day:', error);
                $('#liturgyResults').append(`<div>There was an error fetching liturgy of a day, see console for details</div>`);
            });
    } else {
        let liturgyOfADay = CalData.filter((celebration) => celebration.date === rfc3339datetime);
        updateResults(liturgyOfADay);
    }
}



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
        const celebrationGrade = celebration.grade_display !== null
            ? celebration.grade_display
            : (!isSundayOrdAdvLentEaster && celebration.grade !== 0 ? lclzdGrade : '');
        const celebrationCommon = celebration.common.length ? celebration.common_lcl : '';
        const celebrationColor = celebration.color;
        const litGradeStyle = celebration.grade < 3 ? ' style="font-style:italic;"' : '';
        let finalHTML = `<div class="p-4 m-4 border rounded" style="background-color:${celebrationColor[0] === 'rose' ? 'pink' : celebrationColor[0]};color:${highContrast.includes(celebrationColor[0]) ? "white" : "black"};">`;
        finalHTML += `<h3>${celebration.name}</h3>`;
        finalHTML += (celebrationGrade !== '' ? `<div${litGradeStyle}>${celebrationGrade}</div>` : '');
        finalHTML += `<div>${celebrationCommon}</div>`;
        finalHTML += (celebration.hasOwnProperty('liturgical_year') ? `<div>${celebration.liturgical_year}</div>` : '');
        finalHTML += `</div>`;
        $('#liturgyResults').append(finalHTML);
    });
}

if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", getLiturgyOfADay);
} else {
  // `DOMContentLoaded` has already fired
  getLiturgyOfADay();
}
