const now = new Date();
const daysInMonth = new Date( now.getFullYear(), now.getMonth() + 1, 0 ).getDate();
const dtFormat = new Intl.DateTimeFormat( currentLocale.language, { dateStyle: 'full' } );
const highContrast = Object.freeze( [ 'green', 'red', 'purple' ] );
let liturgyDate = new Date( Date.UTC( now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0 ) );
let CalData = null;


class CalendarState {
    // We initialize the default state to today's date
    static #previousYearTypeValue = ( now.getMonth() + 1 === 12 && now.getDate() === 31 ) ? 'LITURGICAL' : 'CIVIL';
    static #year = now.getFullYear();
    static #month = now.getMonth() + 1;
    static #day = now.getDate();
    static #calendar = '';
    static #calendarType = '';
    static #apiRequestFlag = true; // we need an initial API request to load data

    /**
     * Determines the correct value for the year_type parameter based on the current day and month.
     * If the current date is December 31st, returns 'LITURGICAL', otherwise returns 'CIVIL'.
     * @returns {string} The year type for the current date.
     * @example CalendarState.yearType // returns 'LITURGICAL' or 'CIVIL'
     */
    static get yearType() {
        const isDec31 = ( this.#month === 12 && this.#day === 31 );
        if ( AppEnv === 'development' ) console.debug( `Determining year type for date ${this.#year}-${this.#month}-${this.#day}: is December 31st? ${isDec31 ? 'yes' : 'no'}; year type: ${isDec31 ? 'LITURGICAL' : 'CIVIL'}` );
        return isDec31 ? 'LITURGICAL' : 'CIVIL';
    }

    /**
     * Returns the full endpoint URL for the API /calendar endpoint
     * @returns {string} The full endpoint URL for the API /calendar endpoint
     */
    static get requestPath() {
        const yearPathParam = this.yearType === 'LITURGICAL' ? this.#year + 1 : this.#year;
        const pathParams = this.#calendarType !== '' ? `${this.#calendarType}/${this.#calendar}/` : '';
        return `${CalendarUrl}/${pathParams}${yearPathParam}?year_type=${this.yearType}`;
    }


    /**
     * Returns the flag indicating whether an API request is needed to load data.
     * This flag is set to true when the CalendarState is first initialized, and
     * is set to false after the first API request is made.
     * This flag is used to determine whether an API request should be made to
     * load new data when the user navigates to a different date.
     * @returns {boolean} true if an API request is needed, false otherwise.
     */
    static get apiRequestFlag() {
        return this.#apiRequestFlag;
    }

    /**
     * Returns the year of the CalendarState.
     * @returns {number} The year of the CalendarState.
     */
    static get year() {
        return this.#year;
    }


    /**
     * Returns the month of the CalendarState as a number (1-12) of the CalendarState.
     * @returns {number} The month of the CalendarState as a number (1-12) of the CalendarState.
     * @example CalendarState.month // returns 3 if the current month is March
     */
    static get month() {
        return this.#month;
    }

    /**
     * Returns the day of the month as a number (1-31) of the CalendarState.
     * @returns {number} The day of the month as a number (1-31) of the CalendarState.
     */
    static get day() {
        return this.#day;
    }

    /**
     * Evaluates whether an API request is necessary based on the current year type
     * and the previous year type.
     * @private
     * @static
     * @returns {void}
     */
    static #evaluateApiRequest() {
        if ( AppEnv === 'development' ) console.debug( `Evaluating API request necessity. Previous year type: ${this.#previousYearTypeValue}, Current year type: ${this.yearType}` );
        if ( this.#previousYearTypeValue !== this.yearType ) {
            this.#previousYearTypeValue = this.yearType;
            this.#apiRequestFlag = true;
        }
    }

    /**
     * Resets the API request flag to false.
     * This flag is used to determine if an API request should be made when the calendar is updated.
     * When the flag is true, an API request is made when the calendar is updated.
     * When the flag is false, no API request is made when the calendar is updated.
     */
    static resetApiRequestFlag() {
        this.#apiRequestFlag = false;
        if ( AppEnv === 'development' ) console.debug( `Resetting API request flag: ${this.#apiRequestFlag ? 'true' : 'false'}` );
    }

    /**
     * Sets the year of the CalendarState. Sets the API request flag to true.
     * @param {string} newYearValue The new year of the CalendarState (4 digits)
     * @example CalendarState.year = '2022' // sets the year to 2022
     */
    static set year( newYearValue ) {
        this.#year = parseInt( newYearValue, 10 );
        this.#apiRequestFlag = true;
    }


    /**
     * Sets the month of the year. Triggers an API request evaluation to set the state of the API request flag.
     * @param {string} newMonthValue The new month of the year (1-12)
     * @example CalendarState.month = '6' // sets the month to June
     */
    static set month( newMonthValue ) {
        if ( AppEnv === 'development' ) console.debug( `Setting month to ${newMonthValue}, current day is ${this.#day}` );
        this.#month = parseInt( newMonthValue, 10 );
        this.#evaluateApiRequest();
    }

    /**
     * Sets the day of the month. Triggers the API request evaluation to set the state of the API request flag.
     * @param {string} newDayValue The new day of the month (1-31)
     * @example CalendarState.day = '15' // sets the day to 15
     */
    static set day( newDayValue ) {
        if ( AppEnv === 'development' ) console.debug( `Setting day to ${newDayValue}, current month is ${this.#month}` );
        this.#day = parseInt( newDayValue, 10 );
        this.#evaluateApiRequest();
    }

    /**
     * Sets the calendar. If the calendar is set to 'VA' or no calendar is set, the calendar is set to an empty string.
     * Sets the API request flag to true.
     * @param {string} newCalendarValue The new calendar value.
     * @example CalendarState.calendar = 'NATION' // sets the calendar to 'NATION'
     */
    static set calendar( newCalendarValue ) {
        this.#calendar = ( newCalendarValue === 'VA' ) ? '' : newCalendarValue;
        this.#apiRequestFlag = true;
    }

    /**
     * Sets the calendar type. If the calendar is set to 'VA' or no calendar is set, the calendar type is set to an empty string.
     * Sets the API request flag to true.
     * @param {string} newCalendarTypeValue The new calendar type value.
     * @example CalendarState.calendarType = 'NATION' // sets the calendar type to 'NATION'
     */
    static set calendarType( newCalendarTypeValue ) {
        this.#calendarType = ( this.#calendar === 'VA' || this.#calendar === '' ) ? '' : newCalendarTypeValue;
        this.#apiRequestFlag = true;
    }
}


const filterTagsDisplayGrade = [
    /OrdSunday[0-9]{1,2}(_vigil){0,1}/,
    /Advent[1-4](_vigil){0,1}/,
    /Lent[1-5](_vigil){0,1}/,
    /Easter[1-7](_vigil){0,1}/
];

document.addEventListener( 'change', ( event ) => {
    const target = event.target;

    // Only process changes from our specific controls
    if ( ![ 'monthControl', 'yearControl', 'calendarSelect', 'dayControl' ].includes( target.id ) ) {
        return;
    }

    if ( [ 'monthControl', 'yearControl' ].includes( target.id ) ) {
        const year = document.querySelector( '#yearControl' ).value;
        const month = document.querySelector( '#monthControl' ).value;
        const daysInMonth = new Date( year, month, 0 ).getDate();
        document.querySelector( '#dayControl' ).setAttribute( 'max', daysInMonth );
        if ( document.querySelector( '#dayControl' ).value > daysInMonth ) {
            document.querySelector( '#dayControl' ).value = daysInMonth;
            CalendarState.day = daysInMonth;
        }
    }

    switch ( target.id ) {
        case 'monthControl':
            CalendarState.month = document.querySelector( '#monthControl' ).value;
            liturgyDate = new Date( Date.UTC( CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0 ) );
            break;
        case 'dayControl':
            CalendarState.day = document.querySelector( '#dayControl' ).value;
            liturgyDate = new Date( Date.UTC( CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0 ) );
            break;
        case 'yearControl':
            CalendarState.year = document.querySelector( '#yearControl' ).value;
            liturgyDate = new Date( Date.UTC( CalendarState.year, CalendarState.month - 1, CalendarState.day, 0, 0, 0, 0 ) );
            break;
        case 'calendarSelect': {
            const calendarSelect = document.querySelector( '#calendarSelect' );
            const selectedOption = calendarSelect.options[ calendarSelect.selectedIndex ];
            const calendarType   = selectedOption.getAttribute( 'data-calendartype' );

            switch ( calendarType ) {
                case 'nationalcalendar':
                    CalendarState.calendar = calendarSelect.value;
                    CalendarState.calendarType = 'nation';
                    break;
                case 'diocesancalendar':
                    CalendarState.calendar = calendarSelect.value;
                    CalendarState.calendarType = 'diocese';
                    break;
                default:
                    CalendarState.calendar = '';
                    CalendarState.calendarType = '';
            }
            break;
        }
    }

    getLiturgyOfADay();
} );


/**
 * If apiRequest is true, this function fetches data from the API endpoint
 * defined in CalendarState.requestPath and updates the #liturgyResults element
 * with the result. If apiRequest is false, this function just updates the
 * #liturgyResults element with the result of filtering the CalData object for
 * the data with a date matching the timestamp of liturgyDate.
 *
 */
const getLiturgyOfADay = () => {
    const rfc3339datetime = liturgyDate.toISOString().split( '.' )[ 0 ] + '+00:00';
    if ( AppEnv === 'development' ) console.info( `Getting liturgy of day for date ${rfc3339datetime} (API request: ${CalendarState.apiRequestFlag ? 'yes' : 'no'})` );

    if ( CalendarState.apiRequestFlag ) {
        if ( AppEnv === 'development' ) console.info( `Fetching data from ${CalendarState.requestPath}` );
        const headers = new Headers();
        headers.append( 'Origin', location.origin );
        if ( CalendarState.calendar === 'VA' || CalendarState.calendar === '' ) {
            headers.append( 'Accept-Language', currentLocale.language );
        }
        const url = new URL( CalendarState.requestPath );
        const request = new Request( url, {
            method: "GET",
            headers
        } );
        fetch( request )
            .then( response => response.json() )
            .then( data => {
                if ( data.hasOwnProperty( 'litcal' ) ) {
                    CalData = data.litcal;
                    if ( AppEnv === 'development' ) {
                        console.info( `Fetched ${CalData.length} liturgical events for year ${CalendarState.year}` );
                        console.debug( CalData );
                    }
                    const liturgyOfADay = CalData.filter( ( celebration ) => celebration.date === rfc3339datetime );
                    if ( AppEnv === 'development' ) {
                        console.info( `Found ${liturgyOfADay.length} liturgical events for date ${rfc3339datetime}` );
                        console.debug( liturgyOfADay );
                    }
                    updateResults( liturgyOfADay );
                } else {
                    document.querySelector( '#liturgyResults' ).insertAdjacentHTML( 'beforeend', `<div>ERROR: no 'litcal' property: ${JSON.stringify( data )}</div>` );
                }
                CalendarState.resetApiRequestFlag();
            } )
            .catch( error => {
                console.error( 'Error fetching liturgy of a day:', error );
                document.querySelector( '#liturgyResults' ).insertAdjacentHTML( 'beforeend', `<div>There was an error fetching liturgy of a day, see console for details</div>` );
            } );
    } else {
        let liturgyOfADay = CalData.filter( ( celebration ) => celebration.date === rfc3339datetime );
        updateResults( liturgyOfADay );
    }
}



/**
 * Detects the type of readings object based on its properties
 * @param {Object|string} readings - The readings object or string
 * @returns {string} The type of readings
 */
const detectReadingType = ( readings ) => {
    if ( typeof readings === 'string' ) {
        return 'commons';
    }
    if ( readings.hasOwnProperty( 'night' ) && readings.hasOwnProperty( 'dawn' ) && readings.hasOwnProperty( 'day' ) ) {
        return 'christmas';
    }
    if ( readings.hasOwnProperty( 'day' ) && readings.hasOwnProperty( 'evening' ) ) {
        return 'withEvening';
    }
    if ( readings.hasOwnProperty( 'schema_one' ) && readings.hasOwnProperty( 'schema_two' ) && readings.hasOwnProperty( 'schema_three' ) ) {
        return 'multipleSchemas';
    }
    if ( readings.hasOwnProperty( 'easter_season' ) && readings.hasOwnProperty( 'outside_easter_season' ) ) {
        return 'seasonal';
    }
    if ( readings.hasOwnProperty( 'first_reading' ) && readings.hasOwnProperty( 'seventh_reading' ) ) {
        return 'easterVigil';
    }
    if ( readings.hasOwnProperty( 'palm_gospel' ) ) {
        return 'palmSunday';
    }
    if ( readings.hasOwnProperty( 'second_reading' ) ) {
        return 'festive';
    }
    if ( readings.hasOwnProperty( 'first_reading' ) ) {
        return 'ferial';
    }
    return 'unknown';
}

/**
 * Formats a simple reading set (ferial, festive, or palm sunday)
 * @param {Object} readings - The readings object
 * @param {string} type - The type of readings
 * @param {boolean} skipWrapper - If true, don't add the outer wrapper div
 * @returns {string} HTML string
 */
const formatSimpleReadings = ( readings, type, skipWrapper = false ) => {
    let html = skipWrapper ? '' : '<div class="readings mt-2">';

    if ( type === 'palmSunday' ) {
        html += `<div class="reading-item"><strong>Palm Gospel:</strong> ${readings.palm_gospel}</div>`;
    }

    html += `<div class="reading-item"><strong>First Reading:</strong> ${readings.first_reading}</div>`;
    html += `<div class="reading-item"><strong>Responsorial Psalm:</strong> ${readings.responsorial_psalm}</div>`;

    if ( type === 'festive' || type === 'palmSunday' ) {
        html += `<div class="reading-item"><strong>Second Reading:</strong> ${readings.second_reading}</div>`;
    }

    html += `<div class="reading-item"><strong>Gospel Acclamation:</strong> ${readings.gospel_acclamation}</div>`;
    html += `<div class="reading-item"><strong>Gospel:</strong> ${readings.gospel}</div>`;

    if ( !skipWrapper ) {
        html += '</div>';
    }

    return html;
}

/**
 * Formats Easter Vigil readings
 * @param {Object} readings - The readings object
 * @returns {string} HTML string
 */
const formatEasterVigilReadings = ( readings ) => {
    let html = '<div class="readings mt-2">';
    html += '<div class="reading-section"><strong>Liturgy of the Word:</strong></div>';

    for ( let i = 1; i <= 7; i++ ) {
        const readingKey = i === 1 ? 'first_reading' : `${['', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][i]}_reading`;
        const psalmKey = i === 1 ? 'responsorial_psalm' : `responsorial_psalm_${i}`;
        html += `<div class="reading-item"><strong>Reading ${i}:</strong> ${readings[readingKey]}</div>`;
        html += `<div class="reading-item"><strong>Responsorial Psalm ${i}:</strong> ${readings[psalmKey]}</div>`;
    }

    html += `<div class="reading-item mt-2"><strong>Epistle:</strong> ${readings.epistle}</div>`;
    html += `<div class="reading-item"><strong>Responsorial Psalm (Epistle):</strong> ${readings.responsorial_psalm_epistle}</div>`;
    html += `<div class="reading-item"><strong>Gospel Acclamation:</strong> ${readings.gospel_acclamation}</div>`;
    html += `<div class="reading-item"><strong>Gospel:</strong> ${readings.gospel}</div>`;
    html += '</div>';

    return html;
}

/**
 * Formats Christmas readings (night, dawn, day)
 * @param {Object} readings - The readings object
 * @returns {string} HTML string
 */
const formatChristmasReadings = ( readings ) => {
    let html = '<div class="readings mt-2">';

    [ 'night', 'dawn', 'day' ].forEach( ( mass ) => {
        const massTitle = mass.charAt( 0 ).toUpperCase() + mass.slice( 1 );
        html += `<div class="reading-section mt-2"><strong>Mass at ${massTitle}:</strong></div>`;
        html += formatSimpleReadings( readings[mass], 'festive', true );
    } );

    html += '</div>';
    return html;
}

/**
 * Formats readings with evening option
 * @param {Object} readings - The readings object
 * @returns {string} HTML string
 */
const formatWithEveningReadings = ( readings ) => {
    let html = '<div class="readings mt-2">';

    html += '<div class="reading-section"><strong>Day Mass:</strong></div>';
    html += formatSimpleReadings( readings.day, 'festive', true );

    html += '<div class="reading-section mt-2"><strong>Evening Mass:</strong></div>';
    html += formatSimpleReadings( readings.evening, 'festive', true );

    html += '</div>';
    return html;
}

/**
 * Formats multiple schema readings (All Souls Day)
 * @param {Object} readings - The readings object
 * @returns {string} HTML string
 */
const formatMultipleSchemasReadings = ( readings ) => {
    let html = '<div class="readings mt-2">';

    [ 'schema_one', 'schema_two', 'schema_three' ].forEach( ( schema, index ) => {
        html += `<div class="reading-section mt-2"><strong>Schema ${index + 1}:</strong></div>`;
        html += formatSimpleReadings( readings[schema], 'festive', true );
    } );

    html += '</div>';
    return html;
}

/**
 * Formats seasonal readings
 * @param {Object} readings - The readings object
 * @returns {string} HTML string
 */
const formatSeasonalReadings = ( readings ) => {
    let html = '<div class="readings mt-2">';

    html += '<div class="reading-section"><strong>During Easter Season:</strong></div>';
    html += formatSimpleReadings( readings.easter_season, 'ferial', true );

    html += '<div class="reading-section mt-2"><strong>Outside Easter Season:</strong></div>';
    html += formatSimpleReadings( readings.outside_easter_season, 'ferial', true );

    html += '</div>';
    return html;
}

/**
 * Main function to format readings based on their type
 * @param {Object|string} readings - The readings object or string
 * @returns {string} HTML string
 */
const formatReadings = ( readings ) => {
    if ( !readings ) {
        return '';
    }

    const type = detectReadingType( readings );

    switch ( type ) {
        case 'commons':
            return `<div class="readings mt-2"><div class="reading-item"><em>Readings from: ${readings}</em></div></div>`;
        case 'ferial':
        case 'festive':
        case 'palmSunday':
            return formatSimpleReadings( readings, type );
        case 'easterVigil':
            return formatEasterVigilReadings( readings );
        case 'christmas':
            return formatChristmasReadings( readings );
        case 'withEvening':
            return formatWithEveningReadings( readings );
        case 'multipleSchemas':
            return formatMultipleSchemasReadings( readings );
        case 'seasonal':
            return formatSeasonalReadings( readings );
        default:
            return '';
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
 *          * readings: Object|string - the lectionary readings for the event
 */
const updateResults = ( liturgyOfADay ) => {
    document.querySelector( '#dateOfLiturgy' ).textContent = dtFormat.format( liturgyDate );
    document.querySelector( '#liturgyResults' ).innerHTML = '';
    liturgyOfADay.forEach( ( celebration ) => {
        const lclzdGrade = celebration.grade < 7 ? celebration.grade_lcl : '';
        const isSundayOrdAdvLentEaster = filterTagsDisplayGrade.some( pattern => pattern.test( celebration.event_key ) );
        const celebrationGrade = celebration.grade_display !== null
            ? celebration.grade_display
            : ( !isSundayOrdAdvLentEaster && celebration.grade !== 0 ? lclzdGrade : '' );
        const celebrationCommon = celebration.common.length ? celebration.common_lcl : '';
        const celebrationColor = celebration.color;
        const litGradeStyle = celebration.grade < 3 ? ' style="font-style:italic;"' : '';
        let finalHTML = `<div class="p-4 m-4 border rounded" style="background-color:${celebrationColor[ 0 ] === 'rose' ? 'pink' : celebrationColor[ 0 ]};color:${highContrast.includes( celebrationColor[ 0 ] ) ? "white" : "black"};">`;
        finalHTML += `<h3>${celebration.name}</h3>`;
        finalHTML += ( celebrationGrade !== '' ? `<div${litGradeStyle}>${celebrationGrade}</div>` : '' );
        finalHTML += `<div>${celebrationCommon}</div>`;
        finalHTML += ( celebration.hasOwnProperty( 'liturgical_year' ) ? `<div>${celebration.liturgical_year}</div>` : '' );
        finalHTML += ( celebration.hasOwnProperty( 'readings' ) ? formatReadings( celebration.readings ) : '' );
        finalHTML += `</div>`;
        document.querySelector( '#liturgyResults' ).insertAdjacentHTML( 'beforeend', finalHTML );
    } );
}

const initializeControls = () => {
    document.querySelector( '#monthControl' ).value = String( CalendarState.month );
    document.querySelector( '#dayControl' ).value = String( CalendarState.day );
    document.querySelector( '#yearControl' ).value = String( CalendarState.year );
    getLiturgyOfADay();
};

if ( document.readyState === "loading" ) {
    document.addEventListener( "DOMContentLoaded", initializeControls );
} else {
    initializeControls();
}
