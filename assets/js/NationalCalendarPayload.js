/**
 * Represents the possible values for the `epiphany` setting.
 * @typedef Epiphany
 * @enum {'JAN6'|'SUNDAY_JAN2_JAN8'}
 */

/**
 * Represents the possible values for the `ascension` setting.
 * @typedef Ascension
 * @enum {'THURSDAY'|'SUNDAY'}
 */

/**
 * Represents the possible values for the `corpus_christi` setting.
 * @typedef CorpusChristi
 * @enum {'THURSDAY'|'SUNDAY'}
 */

/**
 * Represents the possible values for the `eternal_high_priest` setting.
 * @typedef EternalHighPriest
 * @enum {boolean}
 */

/**
 * Represents the possible values for the `locale` setting.
 * @typedef Locale
 * @enum {string}
 */

/**
 * @typedef LitGrade
 * @enum {7|6|5|4|3|2|1|0}
 */

import { CalendarSettings, Locale } from './Settings.js';

/** @enum {'white'|'red'|'green'|'purple'|'pink'} */
class LitColor {
    static White    = 'white';
    static Red      = 'red';
    static Green    = 'green';
    static Purple   = 'purple';
    static Pink     = 'pink';
    static #map     = Object.freeze({ white: 'White', red: 'Red', green: 'Green', purple: 'Purple', pink: 'Pink' });
    constructor(value) {
        if (typeof value !== 'string') {
            throw new Error('the value passed to the constructor of a LitColor must be a string');
        }
        if (!Object.keys(LitColor.#map).includes(value)) {
            throw new Error(`the value passed to the constructor of a LitColor must be one of ${Object.keys(LitColor.#map).join(', ')}, instead it was ${value}`);
        }
        this.value = value;
        this.name = LitColor.#map[value];
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
};
Object.freeze(LitColor);

class LitGrade {
    static HIGHER_SOLEMNITY = 7;
    static SOLEMNITY        = 6;
    static FEAST_LORD       = 5;
    static FEAST            = 4;
    static MEMORIAL         = 3;
    static MEMORIAL_OPT     = 2;
    static COMMEMORATION    = 1;
    static WEEKDAY          = 0;
    static #map = Object.freeze([
        'HIGHER_SOLEMNITY',
        'SOLEMNITY',
        'FEAST_LORD',
        'FEAST',
        'MEMORIAL',
        'MEMORIAL_OPT',
        'COMMEMORATION',
        'WEEKDAY'
    ]);
    constructor(value) {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            throw new Error('the value passed to the constructor of a LitGrade must be an integer');
        }
        if (value < 0 || value > 7) {
            throw new Error('the value passed to the constructor of a LitGrade must be between 0 and 7');
        }
        this.value = value;
        this.name = LitGrade.#map[value];
        return Object.freeze(this);
    }
    toJSON() {
        return this.value;
    }
};
Object.freeze(LitGrade);


class NationalCalendarLitCalArray {
    constructor( litcalarray = [] ) {
        let litCalItemsArr = litcalarray.map(litcalitem => new NationalCalendarLitCalItem(litcalitem));
        return new Array(...litCalItemsArr);
    }
}

class LitCalFestivityData {
    constructor( event_key = null ) {
        if (event_key === null) {
            throw new Error('`festivity.event_key` parameter is required');
        }
        if (typeof event_key !== 'string') {
            throw new Error('`festivity.event_key` must be a string');
        }
        this.event_key = event_key;
    }
}

class LitCalMoveFestivityData extends LitCalFestivityData {
    static #isValidDayValueForMonth(month, day) {
        switch (month) {
            case 2:
                return day > 0 && day < 29;
            case 4:
            case 6:
            case 9:
            case 11:
                return day > 0 && day < 32;
            default:
                return day > 0 && day < 31;
        }
    }
    constructor( festivity ) {
        if (false === festivity.hasOwnProperty('event_key') || false === festivity.hasOwnProperty('day') || false === festivity.hasOwnProperty('month')) {
            throw new Error('`festivity.event_key`, `festivity.day` and `festivity.month` properties are required for a `metadata.action` of `moveFestivity`');
        }
        super(festivity.event_key);
        this.day    = festivity.day;
        this.month  = festivity.month;
        if (typeof festivity.month !== 'number' || !Number.isInteger(festivity.month) || festivity.month < 1 || festivity.month > 12) {
            throw new Error('`festivity.month` must be an integer between 1 and 12');
        }
        if (
            typeof festivity.day !== 'number'
            || !Number.isInteger(festivity.day)
            || false === LitCalMoveFestivityData.#isValidDayValueForMonth(festivity.month, festivity.day)
        ) {
            throw new Error('`festivity.day` must be an integer between 1 and 31 and it must be a valid day value for the given month');
        }
        return Object.freeze(this);
    }
}

class LitCalCreateNewFixedData extends LitCalFestivityData {
    static #isValidDayValueForMonth(month, day) {
        switch (month) {
            case 2:
                return day > 0 && day < 29;
            case 4:
            case 6:
            case 9:
            case 11:
                return day > 0 && day < 32;
            default:
                return day > 0 && day < 31;
        }
    }

    constructor( festivity ) {
        if (
            false === festivity.hasOwnProperty('event_key')
            || false === festivity.hasOwnProperty('day')
            || false === festivity.hasOwnProperty('month')
            || false === festivity.hasOwnProperty('color')
            || false === festivity.hasOwnProperty('grade')
            || false === festivity.hasOwnProperty('common')
        ) {
            throw new Error('`festivity.event_key`, `festivity.day`, `festivity.month`, `festivity.color`, `festivity.grade`, and `festivity.common` properties are required for a `metadata.action` of `createNew` and when the new festivity is fixed');
        }
        if (typeof festivity.month !== 'number' || !Number.isInteger(festivity.month) || festivity.month < 1 || festivity.month > 12) {
            throw new Error('`festivity.month` must be an integer between 1 and 12');
        }
        if (
            typeof festivity.day !== 'number'
            || !Number.isInteger(festivity.day)
            || false === LitCalCreateNewFixedData.#isValidDayValueForMonth(festivity.month, festivity.day)
        ) {
            throw new Error('`festivity.day` must be an integer between 1 and 31 and it must be a valid day value for the given month');
        }
        if (false === Array.isArray(festivity.color) || 0 === festivity.color.length) {
            throw new Error('`festivity.color` must be an array with at least one element');
        }
        if (false === Array.isArray(festivity.common)) {
            throw new Error('`festivity.common` must be an array');
        }
        if (festivity.common.length) {
            for (const common of festivity.common) {
                if (typeof common !== 'string') {
                    throw new Error('`festivity.common` must be an array of strings');
                }
            }
        }
        super(festivity.event_key);
        this.day    = festivity.day;
        this.month  = festivity.month;
        this.color  = festivity.color.map(color => new LitColor(color));
        this.grade  = new LitGrade(festivity.grade);
        this.common = festivity.common;
        return Object.freeze(this);
    }
}

class LitCalCreateNewMobileData extends LitCalFestivityData {
    constructor( festivity ) {
        if (
            false === festivity.hasOwnProperty('event_key')
            || false === festivity.hasOwnProperty('strtotime')
            || false === festivity.hasOwnProperty('color')
            || false === festivity.hasOwnProperty('grade')
            || false === festivity.hasOwnProperty('common')
        ) {
            throw new Error('`festivity.event_key`, `festivity.strtotime`, `festivity.color`, `festivity.grade`, and `festivity.common` properties are required for a `metadata.action` of `createNew` and when the new festivity is mobile');
        }
        if (typeof festivity.strtotime !== 'string') {
            throw new Error('`festivity.strtotime` must be a string');
        }
        if (false === Array.isArray(festivity.color) || 0 === festivity.color.length) {
            throw new Error('`festivity.color` must be an array with at least one element');
        }
        if (false === Array.isArray(festivity.common)) {
            throw new Error('`festivity.common` must be an array');
        }
        if (festivity.common.length) {
            for (const common of festivity.common) {
                if (typeof common !== 'string') {
                    throw new Error('`festivity.common` must be an array of strings');
                }
            }
        }
        super(festivity.event_key);
        this.strtotime = festivity.strtotime;
        this.color  = festivity.color.map(color => new LitColor(color));
        this.grade  = new LitGrade(festivity.grade);
        this.common = festivity.common;
        return Object.freeze(this);
    }
}

class LitCalSetPropertyNameData extends LitCalFestivityData {
    constructor( festivity ) {
        if (false === festivity.hasOwnProperty('event_key') || false === festivity.hasOwnProperty('name')) {
            throw new Error('`festivity.event_key` and `festivity.name` properties are required for a `metadata.action` of `setProperty` and when the property is `name`');
        }
        if (typeof festivity.name !== 'string') {
            throw new Error('`festivity.name` must be a string');
        }
        super(festivity.event_key);
        this.name = festivity.name;
        return Object.freeze(this);
    }
}

class LitCalSetPropertyGradeData extends LitCalFestivityData {
    constructor( festivity ) {
        if (false === festivity.hasOwnProperty('event_key') || false === festivity.hasOwnProperty('grade')) {
            throw new Error('`festivity.event_key` and `festivity.grade` properties are required for a `metadata.action` of `setProperty` and when the property is `grade`');
        }
        super(festivity.event_key);
        this.grade = new LitGrade(festivity.grade);
        return Object.freeze(this);
    }
}

class LitCalMakePatronData extends LitCalFestivityData {
    constructor( festivity ) {
        if (false === festivity.hasOwnProperty('event_key') || false === festivity.hasOwnProperty('name') || false === festivity.hasOwnProperty('grade')) {
            throw new Error('`festivity.event_key`, `festivity.name` and `festivity.grade` properties are required for a `metadata.action` of `makePatron`, we received: ' + JSON.stringify(festivity));
        }
        if (typeof festivity.name !== 'string') {
            throw new Error('`festivity.name` must be a string');
        }
        super(festivity.event_key);
        this.name = festivity.name;
        this.grade = new LitGrade(festivity.grade);
        return Object.freeze(this);
    }
}

class LitCalMetadata {
    constructor( since_year = null, until_year = null ) {
        if ( null === since_year ) {
            throw new Error('since_year parameters is required');
        }
        if ( typeof since_year !== 'number' || !Number.isInteger(since_year) ) {
            throw new Error('since_year parameter must be an integer');
        }
        if ( since_year < 1900 ) {
            throw new Error('since_year parameter must represent a year from the 20th century or later');
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

class LitCalMoveFestivityMetadata extends LitCalMetadata {
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('missal') || false === metadata.hasOwnProperty('reason') ) {
            throw new Error('since_year, missal, and reason parameters are required');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'moveFestivity';
        this.missal      = metadata.missal;
        this.reason      = metadata.reason;
        return Object.freeze(this);
    }
}

class LitCalSetPropertyNameMetadata extends LitCalMetadata {
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('property') || metadata.property !== 'name' ) {
            throw new Error('`metadata.since_year` and `metadata.property` parameters are required, and `metadata.property` must have a value of `name`');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'setProperty';
        this.property    = 'name';
        return Object.freeze(this);
    }
}

class LitCalSetPropertyGradeMetadata extends LitCalMetadata {
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('property') || metadata.property !== 'grade' ) {
            throw new Error('`metadata.since_year` and `metadata.property` parameters are required, and `metadata.property` must have a value of `grade`');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'setProperty';
        this.property    = 'grade';
        return Object.freeze(this);
    }
}

class LitCalMakePatronMetadata extends LitCalMetadata {
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') ) {
            throw new Error('`metadata.since_year` parameter is required');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'makePatron';
        if (metadata.hasOwnProperty('url')) {
            this.url = metadata.url;
        }
        return Object.freeze(this);
    }
}

class NationalCalendarLitCalItem {
    constructor( litcalItem ) {
        if (typeof litcalItem !== 'object') {
            throw new Error('litcalItem parameter must be an object');
        }
        if (false === litcalItem.hasOwnProperty('festivity') || false === litcalItem.hasOwnProperty('metadata')) {
            throw new Error('`festivity` and `metadata` parameters are required');
        }
        if (false === litcalItem.metadata.hasOwnProperty('action')) {
            throw new Error('metadata must have an `action` property');
        }
        console.log('verifying integrity of NationalCalendarLitCalItem with action = ' + litcalItem.metadata.action);
        switch (litcalItem.metadata.action) {
            case 'moveFestivity':
                /**@type {LitCalMoveFestivityData} */
                this.festivity = new LitCalMoveFestivityData(litcalItem.festivity);
                /**@type {LitCalMoveFestivityMetadata} */
                this.metadata = new LitCalMoveFestivityMetadata(litcalItem.metadata);
                break;
            case 'createNew':
                if (litcalItem.festivity.hasOwnProperty('day') && litcalItem.festivity.hasOwnProperty('month')) {
                    /**@type {LitCalCreateNewFixedData} */
                    this.festivity = new LitCalCreateNewFixedData(litcalItem.festivity);
                } else if (festivity.hasOwnProperty('strtotime')) {
                    /**@type {LitCalCreateNewMobileData} */
                    this.festivity = new LitCalCreateNewMobileData(litcalItem.festivity);
                } else {
                    throw new Error('when metadata.action is `createNew`, `festivity` must have either `day` and `month` properties or `strtotime` property');
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
                        this.festivity = new LitCalSetPropertyNameData(litcalItem.festivity);
                        /**@type {LitCalSetPropertyNameMetadata} */
                        this.metadata = new LitCalSetPropertyNameMetadata(litcalItem.metadata);
                        break;
                    case 'grade':
                        /**@type {LitCalSetPropertyGradeData} */
                        this.festivity = new LitCalSetPropertyGradeData(litcalItem.festivity);
                        /**@type {LitCalSetPropertyGradeMetadata} */
                        this.metadata = new LitCalSetPropertyGradeMetadata(litcalItem.metadata);
                        break;
                    default:
                        throw new Error('when metadata.action is `setProperty`, the metadata `property` property must be either `name` or `grade`');
                }
                break;
            case 'makePatron':
                /**@type {LitCalMakePatronData} */
                this.festivity = new LitCalMakePatronData(litcalItem.festivity);
                /**@type {LitCalMakePatronMetadata} */
                this.metadata = new LitCalMakePatronMetadata(litcalItem.metadata);
                break;
            default:
                throw new Error('metadata.action must be one of `moveFestivity`, `createNew`, `setProperty` or `makePatron`');
        }
        return Object.freeze(this);
    }
}


class NationalCalendarPayloadMetadata {
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
        return Object.freeze(this);
    }
}

class NationalCalendarPayload {
    constructor( litcal = null, settings = null, metadata = null, i18n = null ) {
        const allowedProps = new Set(['litcal', 'settings', 'metadata', 'i18n']);
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
        /**@type {NationalCalendarLitCalArray} */
        this.litcal   = new NationalCalendarLitCalArray(litcal);
        /**@type {CalendarSettings} */
        this.settings = new CalendarSettings(settings);
        /**@type {NationalCalendarPayloadMetadata} */
        this.metadata = new NationalCalendarPayloadMetadata(metadata);
        this.i18n     = i18n;
        return Object.freeze(this);
    }
}

export {
    NationalCalendarPayload
}
