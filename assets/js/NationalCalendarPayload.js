/**
 * Represents the possible values for the `epiphany` setting.
 * @typedef {'JAN6'|'SUNDAY_JAN2_JAN8'} Epiphany
 */

/**
 * Represents the possible values for the `ascension` setting.
 * @typedef {'THURSDAY'|'SUNDAY'} Ascension
 */

/**
 * Represents the possible values for the `corpus_christi` setting.
 * @typedef {'THURSDAY'|'SUNDAY'} CorpusChristi
 */

/**
 * Represents the possible values for the `eternal_high_priest` setting.
 * @typedef {boolean} EternalHighPriest
 */


/**
 * Represents the possible values for liturgical grades (or ranks).
 * @typedef {0|1|2|3|4|5|6|7} LitGradeValue
 */

/**
 * Represents the possible values for liturgical colors.
 * @typedef {'white'|'red'|'green'|'purple'|'rose'} LitColorValue
 */

/** @import { RowData } from './extending.js' */

import { CalendarSettings, Locale } from './Settings.js';
import { Month, getMonthMaxDay } from './FormControls.js';

/**
 * Checks if a given day value is valid for a given month.
 * @param {Month} month - The month to check, 1-12.
 * @param {number} day - The day to check, 1-31.
 * @returns {boolean} true if the day is valid, false otherwise.
 */
const isValidDayValueForMonth = (month, day) => {
    day > 0 && day <= getMonthMaxDay(month);
}

/**
 * @typedef {object} LitColorInstance
 * @property {LitColorValue} value
 * @property {string} name
 */

/**
 * @implements {LitColorInstance}
 */
class LitColor {
    /** @type {'white'} */
    static White    = 'white';
    /** @type {'red'} */
    static Red      = 'red';
    /** @type {'green'} */
    static Green    = 'green';
    /** @type {'purple'} */
    static Purple   = 'purple';
    /** @type {'rose'} */
    static Rose     = 'rose';

    static #map = Object.freeze({
        white: 'White',
        red: 'Red',
        green: 'Green',
        purple: 'Purple',
        rose: 'Rose'
    });

    static #PRIVATE_KEY = Symbol('LitColor');

    /**
     * Construct a new LitColor object from a string value.
     *
     * @param {LitColorValue} value - The string value to use when constructing the LitColor object.
     * @returns {LitColor} A new LitColor object with the given string value.
     * @throws {Error} If the string value is not one of the following: white, red, green, purple, rose.
     */
    static from(value) {
        return new LitColor(value, LitColor.#PRIVATE_KEY);
    }

    /**
     * Construct a new LitColor object from a string.
     *
     * This constructor takes a string value, which it will use to set the properties of the LitColor object.
     * The string value must be one of the following: white, red, green, purple, rose.
     * If the string value is not one of the above, it will throw an error.
     *
     * @param {LitColorValue} value - The string value to use when constructing the LitColor object.
     * @param {Symbol} ctorKey - The private key to allow construction.
     * @throws {Error} If the string value is not one of the above.
     */
    constructor(value, ctorKey) {
        if (ctorKey !== LitColor.#PRIVATE_KEY) {
            throw new Error('LitColor is a static class and cannot be instantiated directly. Use LitColor.from(value) instead.');
        }
        if (typeof value !== 'string') {
            throw new Error('the value passed to the constructor of a LitColor must be a string');
        }
        if (!Object.keys(LitColor.#map).includes(value)) {
            throw new Error(`the value passed to the constructor of a LitColor must be one of ${Object.keys(LitColor.#map).join(', ')}, instead it was ${value}`);
        }
        /** @type {LitColorValue} */
        this.value = value;
        /** @type {string} */
        this.name = LitColor.#map[value];
        Object.freeze(this);
    }

    /**
     * Returns the JSON representation of the LitColor object.
     * @return {LitColorValue} the value of the LitColor object.
     */
    toJSON() {
        return this.value;
    }

    toString() {
        return this.value;
    }
};
Object.freeze(LitColor);

/**
 * @typedef {object} LitGradeInstance
 * @property {LitGradeValue} value
 * @property {string} name
 */

/**
 * @implements {LitGradeInstance}
 */
class LitGrade {
    /** @type {0} */
    static WEEKDAY          = 0;
    /** @type {1} */
    static COMMEMORATION    = 1;
    /** @type {2} */
    static MEMORIAL_OPT     = 2;
    /** @type {3} */
    static MEMORIAL         = 3;
    /** @type {4} */
    static FEAST            = 4;
    /** @type {5} */
    static FEAST_LORD       = 5;
    /** @type {6} */
    static SOLEMNITY        = 6;
    /** @type {7} */
    static HIGHER_SOLEMNITY = 7;

    static #map = Object.freeze([
        'WEEKDAY',
        'COMMEMORATION',
        'MEMORIAL_OPT',
        'MEMORIAL',
        'FEAST',
        'FEAST_LORD',
        'SOLEMNITY',
        'HIGHER_SOLEMNITY',
    ]);

    static #PRIVATE_KEY = Symbol('LitGrade');

    /**
     * Construct a new LitGrade object from a value.
     * @param {LitGradeValue} value The grade of the liturgical event. Must be an integer between 0 and 7.
     * @param {Symbol} ctorKey The private key to allow construction.
     * @throws {Error} If the value passed is not an integer, or if it is not between 0 and 7.
     * @returns {LitGrade} A new LitGrade object.
     */
    static from(value) {
        return new LitGrade(value, LitGrade.#PRIVATE_KEY);
    }

    /**
     * Creates a new LitGrade object.
     * @param {LitGradeValue} value The grade of the liturgical event. Must be an integer between 0 and 7.
     * @param {Symbol} ctorKey The private key to allow construction.
     * @throws {Error} If the value passed is not an integer, or if it is not between 0 and 7.
     * @returns {LitGrade} A new LitGrade object.
     */
    constructor(value, ctorKey) {
        if (ctorKey !== LitGrade.#PRIVATE_KEY) {
            throw new Error('LitGrade is a static class and cannot be instantiated directly. Use LitGrade.from(value) instead.');
        }
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            throw new Error('the value passed to the constructor of a LitGrade must be an integer');
        }
        if (value < 0 || value > 7) {
            throw new Error('the value passed to the constructor of a LitGrade must be between 0 and 7');
        }
        /** @type {LitGradeValue} */
        this.value = value;
        /** @type {string} */
        this.name = LitGrade.#map[value];
        Object.freeze(this);
    }

    /**
     * Returns the JSON representation of the LitGrade object.
     * @return {LitGradeValue} The value of the LitGrade object.
     */
    toJSON() {
        return this.value;
    }

    toString() {
        return this.value;
    }
};
Object.freeze(LitGrade);


class NationalCalendarLitCalArray {
    /**
     * Creates a new NationalCalendarLitCalArray from an array of LitCalEvent objects
     * and an object of i18n data.
     * @param {Array<RowData>} [litcalarray=[]] - The array of LitCalEvent objects.
     * @param {Object} i18nData - The object of i18n data.
     * @return {NationalCalendarLitCalArray} A new NationalCalendarLitCalArray object.
     */
    static create(litcalarray = [], i18nData) {
        return litcalarray.map(
            litcalitem => new NationalCalendarLitCalItem(litcalitem, i18nData)
        );
    }
}

class LitCalEventData {
    /**
     * Creates a new LitCalEventData object.
     * @param {string} [event_key=null] - The key of the liturgical event.
     * @throws {Error} If the `event_key` parameter is not a string, or if it is not provided.
     */
    constructor( event_key = null ) {
        if (event_key === null) {
            throw new Error('`liturgical_event.event_key` parameter is required');
        }
        if (typeof event_key !== 'string') {
            throw new Error('`liturgical_event.event_key` must be a string');
        }
        this.event_key = event_key;
    }
}

class LitCalMoveEventData extends LitCalEventData {

    /**
     * Creates a new LitCalMoveEventData object.
     * @param {Object} liturgical_event - The object containing the properties of the liturgical event.
     * @throws {Error} If the `liturgical_event` object does not have the required properties, or if the properties have invalid types.
     * @returns {LitCalMoveEventData} A new LitCalMoveEventData object.
     */
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('day') || false === liturgical_event.hasOwnProperty('month')) {
            throw new Error('`liturgical_event.event_key`, `liturgical_event.day` and `liturgical_event.month` properties are required for a `metadata.action` of `moveEvent`');
        }
        super(liturgical_event.event_key);
        this.day    = liturgical_event.day;
        this.month  = liturgical_event.month;
        if (typeof liturgical_event.month !== 'number' || !Number.isInteger(liturgical_event.month) || liturgical_event.month < 1 || liturgical_event.month > 12) {
            throw new Error('`liturgical_event.month` must be an integer between 1 and 12');
        }
        if (
            typeof liturgical_event.day !== 'number'
            || !Number.isInteger(liturgical_event.day)
            || false === isValidDayValueForMonth(liturgical_event.month, liturgical_event.day)
        ) {
            throw new Error('`liturgical_event.day` must be an integer between 1 and 31 and it must be a valid day value for the given month');
        }
        Object.freeze(this);
    }
}

/**
 * @typedef {object} LitCalCreateNewFixedData
 * @property {string} event_key
 * @property {number} day
 * @property {number} month
 * @property {Array<LitColor>} color
 * @property {LitGrade} grade
 * @property {Array<string>} common
 */
class LitCalCreateNewFixedData extends LitCalEventData {

    /**
     * Creates a new LitCalCreateNewFixedData object.
     * @param {object} liturgical_event - The object containing the properties of the liturgical event.
     * @throws {Error} If the `liturgical_event` object does not have the required properties, or if the properties have invalid types.
     * @returns {LitCalCreateNewFixedData} A new LitCalCreateNewFixedData object.
     */
    constructor( liturgical_event ) {
        if (
            false === liturgical_event.hasOwnProperty('event_key')
            || false === liturgical_event.hasOwnProperty('day')
            || false === liturgical_event.hasOwnProperty('month')
            || false === liturgical_event.hasOwnProperty('color')
            || false === liturgical_event.hasOwnProperty('grade')
            || false === liturgical_event.hasOwnProperty('common')
        ) {
            throw new Error('`liturgical_event.event_key`, `liturgical_event.day`, `liturgical_event.month`, `liturgical_event.color`, `liturgical_event.grade`, and `liturgical_event.common` properties are required for a `metadata.action` of `createNew` and when the new liturgical_event is fixed');
        }
        if (typeof liturgical_event.month !== 'number' || !Number.isInteger(liturgical_event.month) || liturgical_event.month < 1 || liturgical_event.month > 12) {
            throw new Error('`liturgical_event.month` must be an integer between 1 and 12');
        }
        if (
            typeof liturgical_event.day !== 'number'
            || !Number.isInteger(liturgical_event.day)
            || false === isValidDayValueForMonth(liturgical_event.month, liturgical_event.day)
        ) {
            throw new Error('`liturgical_event.day` must be an integer between 1 and 31 and it must be a valid day value for the given month');
        }
        if (false === Array.isArray(liturgical_event.color) || 0 === liturgical_event.color.length) {
            throw new Error('`liturgical_event.color` must be an array with at least one element');
        }
        if (false === Array.isArray(liturgical_event.common)) {
            throw new Error('`liturgical_event.common` must be an array');
        }
        if (liturgical_event.common.length) {
            for (const common of liturgical_event.common) {
                if (typeof common !== 'string') {
                    throw new Error('`liturgical_event.common` must be an array of strings');
                }
            }
        }
        super(liturgical_event.event_key);
        this.day    = liturgical_event.day;
        this.month  = liturgical_event.month;
        this.color  = liturgical_event.color.map(color => LitColor.from(color));
        this.grade  = LitGrade.from(liturgical_event.grade);
        this.common = liturgical_event.common;
        Object.freeze(this);
    }
}

/**
 * @typedef {object} LitCalCreateNewMobileData
 * @property {string} event_key
 * @property {string} strtotime
 * @property {Array<LitColor>} color
 * @property {LitGrade} grade
 * @property {Array<string>} common
 */
class LitCalCreateNewMobileData extends LitCalEventData {

    /**
     * Creates a new LitCalCreateNewMobileData object.
     * @param {Object} liturgical_event - The object containing the properties of the liturgical event.
     * @throws {Error} If the `liturgical_event` object does not have the required properties, or if the properties have invalid types.
     * @returns {LitCalCreateNewMobileData} A new LitCalCreateNewMobileData object.
     */
    constructor( liturgical_event ) {
        if (
            false === liturgical_event.hasOwnProperty('event_key')
            || false === liturgical_event.hasOwnProperty('strtotime')
            || false === liturgical_event.hasOwnProperty('color')
            || false === liturgical_event.hasOwnProperty('grade')
            || false === liturgical_event.hasOwnProperty('common')
        ) {
            throw new Error('`liturgical_event.event_key`, `liturgical_event.strtotime`, `liturgical_event.color`, `liturgical_event.grade`, and `liturgical_event.common` properties are required for a `metadata.action` of `createNew` and when the new liturgical_event is mobile');
        }
        if (typeof liturgical_event.strtotime !== 'string') {
            throw new Error('`liturgical_event.strtotime` must be a string');
        }
        if (false === Array.isArray(liturgical_event.color) || 0 === liturgical_event.color.length) {
            throw new Error('`liturgical_event.color` must be an array with at least one element');
        }
        if (false === Array.isArray(liturgical_event.common)) {
            throw new Error('`liturgical_event.common` must be an array');
        }
        if (liturgical_event.common.length) {
            for (const common of liturgical_event.common) {
                if (typeof common !== 'string') {
                    throw new Error('`liturgical_event.common` must be an array of strings');
                }
            }
        }
        super(liturgical_event.event_key);
        this.strtotime = liturgical_event.strtotime;
        this.color  = liturgical_event.color.map(color => LitColor.from(color));
        this.grade  = LitGrade.from(liturgical_event.grade);
        this.common = liturgical_event.common;
        Object.freeze(this);
    }
}

/**
 * @typedef {object} LitCalSetPropertyNameData
 * @property {string} event_key
 * @property {string} name
 */
class LitCalSetPropertyNameData extends LitCalEventData {
    /**
     * Creates a new LitCalSetPropertyNameData object.
     *
     * @param {object} liturgical_event - The object containing the properties of the liturgical event.
     * @throws {Error} If the `liturgical_event` object does not have the required properties, or if the properties have invalid types.
     * @returns {LitCalSetPropertyNameData} A new LitCalSetPropertyNameData object.
     */
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('name')) {
            throw new Error('`liturgical_event.event_key` and `liturgical_event.name` properties are required for a `metadata.action` of `setProperty` and when the property is `name`');
        }
        if (typeof liturgical_event.name !== 'string') {
            throw new Error('`liturgical_event.name` must be a string');
        }
        super(liturgical_event.event_key);
        this.name = liturgical_event.name;
        Object.freeze(this);
    }
}

class LitCalSetPropertyGradeData extends LitCalEventData {

    /**
     * Creates a new LitCalSetPropertyGradeData object.
     *
     * @param {object} liturgical_event - The object containing the properties of the liturgical event.
     * @throws {Error} If the `liturgical_event` object does not have the required properties, or if the properties have invalid types.
     * @returns {LitCalSetPropertyGradeData} A new LitCalSetPropertyGradeData object.
     */
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('grade')) {
            throw new Error('`liturgical_event.event_key` and `liturgical_event.grade` properties are required for a `metadata.action` of `setProperty` and when the property is `grade`');
        }
        super(liturgical_event.event_key);
        this.grade = LitGrade.from(liturgical_event.grade);
        Object.freeze(this);
    }
}

class LitCalMakePatronData extends LitCalEventData {

    /**
     * Creates a new LitCalMakePatronData object.
     *
     * @param {Object} liturgical_event - The object containing the properties of the liturgical event.
     * @throws {Error} If the `liturgical_event` object does not have the required `event_key` and `grade` properties.
     * @returns {LitCalMakePatronData} A new LitCalMakePatronData object.
     */
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('grade')) {
            throw new Error('`liturgical_event.event_key` and `liturgical_event.grade` properties are required for a `metadata.action` of `makePatron`, we received: ' + JSON.stringify(liturgical_event));
        }
        super(liturgical_event.event_key);
        /** @type {LitGrade} */
        this.grade = LitGrade.from(liturgical_event.grade);
        Object.freeze(this);
    }
}

class LitCalMetadata {

    /**
     * Creates a new LitCalMetadata object.
     *
     * @param {number} [since_year=null] - The year from which the liturgical event is celebrated.
     * @param {number} [until_year=null] - The year until which the liturgical event is celebrated.
     * @throws {Error} If the `since_year` parameter is not an integer, or if the `since_year` parameter is less than 1800, or if the `until_year` parameter is not an integer, or if the `until_year` parameter is less than or equal to the `since_year` parameter.
     * @returns {LitCalMetadata} A new LitCalMetadata object.
     */
    constructor( since_year = null, until_year = null ) {
        if ( null === since_year ) {
            throw new Error('since_year parameters is required');
        }
        if ( typeof since_year !== 'number' || !Number.isInteger(since_year) ) {
            throw new Error('since_year parameter must be an integer');
        }
        if ( since_year < 1800 ) {
            throw new Error('since_year parameter must represent a year from the 19th century or later');
        }
        this.action      = 'createNew';
        this.since_year  = since_year;
        if (until_year !== null) {
            if (typeof until_year !== 'number' || !Number.isInteger(until_year)) {
                throw new Error('until_year parameter must be an integer');
            }
            if (until_year <= since_year) {
                throw new Error('until_year parameter must be greater than since_year parameter');
            }
            this.until_year  = until_year;
        }
    }
}

class LitCalMoveEventMetadata extends LitCalMetadata {

    /**
     * Creates a new LitCalMoveEventMetadata object.
     *
     * @param {Object} metadata - The object containing the properties of the metadata.
     * @throws {Error} If the `metadata` object does not have the required `since_year`, `missal`, and `reason` properties.
     * @returns {LitCalMoveEventMetadata} A new LitCalMoveEventMetadata object.
     */
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('missal') || false === metadata.hasOwnProperty('reason') ) {
            throw new Error('since_year, missal, and reason parameters are required');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'moveEvent';
        this.missal      = metadata.missal;
        this.reason      = metadata.reason;
        Object.freeze(this);
    }
}

class LitCalSetPropertyNameMetadata extends LitCalMetadata {

    /**
     * Creates a new LitCalSetPropertyNameMetadata object.
     *
     * @param {Object} metadata - The object containing the properties of the metadata.
     * @throws {Error} If the `metadata` object does not have the required `since_year` and `property` properties, or if the `property` property does not have a value of `'name'`.
     * @returns {LitCalSetPropertyNameMetadata} A new LitCalSetPropertyNameMetadata object.
     */
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('property') || metadata.property !== 'name' ) {
            throw new Error('`metadata.since_year` and `metadata.property` parameters are required, and `metadata.property` must have a value of `name`');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'setProperty';
        this.property    = 'name';
        Object.freeze(this);
    }
}

class LitCalSetPropertyGradeMetadata extends LitCalMetadata {

    /**
     * Creates a new LitCalSetPropertyGradeMetadata object.
     *
     * @param {Object} metadata - The object containing the properties of the metadata.
     * @throws {Error} If the `metadata` object does not have the required `since_year` and `property` properties, or if the `property` property does not have a value of `'grade'`.
     * @returns {LitCalSetPropertyGradeMetadata} A new LitCalSetPropertyGradeMetadata object.
     */
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('property') || metadata.property !== 'grade' ) {
            throw new Error('`metadata.since_year` and `metadata.property` parameters are required, and `metadata.property` must have a value of `grade`');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'setProperty';
        this.property    = 'grade';
        Object.freeze(this);
    }
}

class LitCalMakePatronMetadata extends LitCalMetadata {

    /**
     * Creates a new LitCalMakePatronMetadata object.
     *
     * @param {Object} metadata - The object containing the properties of the metadata.
     * @throws {Error} If the `metadata` object does not have the required `since_year` property.
     * @returns {LitCalMakePatronMetadata} A new LitCalMakePatronMetadata object.
     */
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') ) {
            throw new Error('`metadata.since_year` parameter is required');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'makePatron';
        if (metadata.hasOwnProperty('url')) {
            this.url = metadata.url;
        }
        Object.freeze(this);
    }
}

class NationalCalendarLitCalItem {

    /**
     * Constructor for NationalCalendarLitCalItem.
     *
     * @param {RowData} litcalItem - An object containing the properties of the liturgical event and its metadata.
     * @param {Object} i18nData - An object containing the translated strings for the liturgical events.
     *
     * @throws {Error} If the `litcalItem` parameter is not an object, or if the `litcalItem` object does not have the required `liturgical_event` and `metadata` properties, or if the `metadata` object does not have an `action` property, or if the `i18nData` object does not contain the translated string for the liturgical event.
     */
    constructor( litcalItem, i18nData ) {
        if (typeof litcalItem !== 'object') {
            throw new Error('litcalItem parameter must be an object');
        }
        if (false === litcalItem.hasOwnProperty('liturgical_event') || false === litcalItem.hasOwnProperty('metadata')) {
            throw new Error('`liturgical_event` and `metadata` parameters are required');
        }
        if (false === litcalItem.metadata.hasOwnProperty('action')) {
            throw new Error('metadata must have an `action` property');
        }
        console.log('verifying integrity of NationalCalendarLitCalItem with action = ' + litcalItem.metadata.action);

        // Cases in which we would need a `name` property: createNew, makePatron, and setProperty.name
        // We no longer use the `name` property, because we have translated strings in the i18n data
        // We should however check that the i18n data does actually exist for the litcalItem.event_key,
        // and it's simply easier to theck that here rather than continue passing down the i18nData to each subclass
        if (
            (['createNew', 'makePatron'].includes(litcalItem.metadata.action))
            ||
            (litcalItem.metadata.action === 'setProperty' && litcalItem.metadata.property === 'name')
        ) {
            if (false === litcalItem.liturgical_event.hasOwnProperty('event_key')) {
                throw new Error('litcalItem.liturgical_event must have an `event_key` property');
            }
            Object.entries(i18nData).forEach( ([isoCode, translations]) => {
                if (false === (litcalItem.liturgical_event.event_key in translations)) {
                    throw new Error(`The litcalItem.liturgical_event.event_key ${litcalItem.liturgical_event.event_key} is missing in i18nData[${isoCode}]: ${JSON.stringify(translations)}`);
                }
            });
        }

        switch (litcalItem.metadata.action) {
            case 'moveEvent':
                /**@type {LitCalMoveEventData} */
                this.liturgical_event = new LitCalMoveEventData(litcalItem.liturgical_event);
                /**@type {LitCalMoveEventMetadata} */
                this.metadata = new LitCalMoveEventMetadata(litcalItem.metadata);
                break;
            case 'createNew':
                if (litcalItem.liturgical_event.hasOwnProperty('day') && litcalItem.liturgical_event.hasOwnProperty('month')) {
                    /**@type {LitCalCreateNewFixedData} */
                    this.liturgical_event = new LitCalCreateNewFixedData(litcalItem.liturgical_event);
                } else if (litcalItem.liturgical_event.hasOwnProperty('strtotime')) {
                    /**@type {LitCalCreateNewMobileData} */
                    this.liturgical_event = new LitCalCreateNewMobileData(litcalItem.liturgical_event);
                } else {
                    throw new Error('when metadata.action is `createNew`, `liturgical_event` must have either `day` and `month` properties or `strtotime` property');
                }
                /**@type {LitCalMetadata} */
                this.metadata = new LitCalMetadata(litcalItem.metadata.since_year, litcalItem.metadata.until_year ?? null);
                break;
            case 'setProperty':
                if (false === litcalItem.metadata.hasOwnProperty('property')) {
                    throw new Error('when metadata.action is `setProperty`, the metadata `property` property must also be set');
                }
                switch (litcalItem.metadata.property) {
                    case 'name':
                        /**@type {LitCalSetPropertyNameData} */
                        this.liturgical_event = new LitCalSetPropertyNameData(litcalItem.liturgical_event);
                        /**@type {LitCalSetPropertyNameMetadata} */
                        this.metadata = new LitCalSetPropertyNameMetadata(litcalItem.metadata);
                        break;
                    case 'grade':
                        /**@type {LitCalSetPropertyGradeData} */
                        this.liturgical_event = new LitCalSetPropertyGradeData(litcalItem.liturgical_event);
                        /**@type {LitCalSetPropertyGradeMetadata} */
                        this.metadata = new LitCalSetPropertyGradeMetadata(litcalItem.metadata);
                        break;
                    default:
                        throw new Error('when metadata.action is `setProperty`, the metadata `property` property must be either `name` or `grade`');
                }
                break;
            case 'makePatron':
                /**@type {LitCalMakePatronData} */
                this.liturgical_event = new LitCalMakePatronData(litcalItem.liturgical_event);
                /**@type {LitCalMakePatronMetadata} */
                this.metadata = new LitCalMakePatronMetadata(litcalItem.metadata);
                break;
            default:
                throw new Error('metadata.action must be one of `moveEvent`, `createNew`, `setProperty` or `makePatron`');
        }
        Object.freeze(this);
    }
}


class NationalCalendarPayloadMetadata {

    /**
     * Constructs a new instance of NationalCalendarPayloadMetadata.
     *
     * @param {Object} metadata The object passed to the constructor.
     * @param {string} metadata.nation A two-letter country ISO code (capital letters).
     * @param {string[]} metadata.locales An array of valid locale codes, must not be empty.
     * @param {string} metadata.wider_region One of `Americas`, `Europe`, `Asia`, `Africa`, `Oceania`, `Middle East`, or `Antarctica`.
     * @param {string[]} metadata.missals An array of valid Roman Missal identifiers.
     *
     * @throws {Error} If any parameter does not meet the specified criteria.
     */
    constructor( metadata ) {
        if (
            false === metadata.hasOwnProperty('nation')
            || false === metadata.hasOwnProperty('locales')
            || false === metadata.hasOwnProperty('wider_region')
            || false === metadata.hasOwnProperty('missals')
        ) {
            throw new Error('`metadata.nation`, `metadata.locales`, `metadata.wider_region`, and `metadata.missals` parameters are required');
        }
        if (typeof metadata.nation !== 'string') {
            throw new Error('`metadata.nation` parameter must be a string');
        }
        const re = /^[A-Z]{2}$/;
        if (false === re.test(metadata.nation)) {
            throw new Error('`metadata.nation` parameter must be a two letter country ISO code (capital letters)');
        }
        if (false === Array.isArray(metadata.locales) || 0 === metadata.locales.length) {
            throw new Error('`metadata.locales` parameter must be an array and must not be empty');
        }
        for (const locale of metadata.locales) {
            if (typeof locale !== 'string') {
                throw new Error('`metadata.locales` parameter must be an array of strings, an item of a different type was detected');
            }
            if (Locale.isValid(locale) === false) {
                throw new Error('`metadata.locales` parameter must be an array of valid locale codes');
            }
        }
        if (typeof metadata.wider_region !== 'string') {
            throw new Error('`metadata.wider_region` parameter must be a string');
        }
        const re2 = /^(Americas|Europe|Asia|Africa|Oceania|Middle East|Antarctica)$/;
        if (false === re2.test(metadata.wider_region)) {
            throw new Error('`metadata.wider_region` parameter must be one of `Americas`, `Europe`, `Asia`, `Africa`, `Oceania`, `Middle East`, or `Antarctica`');
        }
        if (false === Array.isArray(metadata.missals)) {
            throw new Error('`metadata.missals` parameter must be an array');
        }
        const re3 = /^[A-Z]{2}_[0-9]{4}$/;
        for (const missal of metadata.missals) {
            if (typeof missal !== 'string') {
                throw new Error('`metadata.missals` parameter must be an array of strings, an item of a different type was detected');
            }
            if (false === re3.test(missal)) {
                throw new Error('`metadata.missals` parameter must be an array of valid Roman Missal identifiers, an item with a different value was detected');
            }
        }
        this.nation       = metadata.nation;
        this.locales      = metadata.locales;
        this.wider_region = metadata.wider_region;
        this.missals      = metadata.missals;
        Object.freeze(this);
    }
}

class NationalCalendarPayload {

    /**
     * Constructs a new instance of NationalCalendarPayload.
     *
     * @param {Array<RowData>|null} litcal The liturgical calendar data to be used.
     * @param {Object|null} settings The calendar settings.
     * @param {Object|null} metadata The metadata associated with the calendar.
     * @param {Object|null} i18n The translations associated with the calendar.
     *
     * @throws {Error} If any parameter does not meet the specified criteria.
     */
    constructor( litcal = null, settings = null, metadata = null, i18n = null ) {
        // const allowedProps = new Set(['litcal', 'settings', 'metadata', 'i18n']);
        if (null === litcal || null === settings || null === metadata || null === i18n) {
            throw new Error('litcal, settings, metadata and i18n parameters are required');
        }
        if (false === Array.isArray(litcal)) {
            throw new Error('litcal parameter must be an array');
        }
        if (typeof settings !== 'object') {
            throw new Error('settings parameter must be an object');
        }
        if (typeof metadata !== 'object') {
            throw new Error('metadata parameter must be an object');
        }
        if (false === metadata.hasOwnProperty('locales')) {
            throw new Error('metadata.locales parameter is required');
        }
        if (false === Array.isArray(metadata.locales) || 0 === metadata.locales.length) {
            throw new Error('metadata.locales parameter must be an array and must not be empty');
        }
        if (typeof i18n !== 'object') {
            throw new Error('i18n parameter must be an object');
        }
        if (Object.keys(i18n).sort().join(',') !== metadata.locales.sort().join(',')) {
            throw new Error('i18n parameter must have the same locales as metadata.locales');
        }
        this.i18n     = i18n;
        /**@type {NationalCalendarLitCalArray} */
        this.litcal   = NationalCalendarLitCalArray.create(litcal, this.i18n);
        /**@type {CalendarSettings} */
        this.settings = new CalendarSettings(settings);
        /**@type {NationalCalendarPayloadMetadata} */
        this.metadata = new NationalCalendarPayloadMetadata(metadata);
        Object.freeze(this);
    }
}

export {
    NationalCalendarPayload
}
