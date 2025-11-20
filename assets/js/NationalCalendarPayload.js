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

/** @enum {'white'|'red'|'green'|'purple'|'rose'} */
class LitColor {
    static White    = 'white';
    static Red      = 'red';
    static Green    = 'green';
    static Purple   = 'purple';
    static Pink     = 'rose';
    static #map     = Object.freeze({ white: 'White', red: 'Red', green: 'Green', purple: 'Purple', rose: 'Pink' });
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
    constructor( litcalarray = [], i18nData ) {
        let litCalItemsArr = litcalarray.map(litcalitem => new NationalCalendarLitCalItem(litcalitem, i18nData));
        return new Array(...litCalItemsArr);
    }
}

class LitCalEventData {
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
    static #isValidDayValueForMonth(month, day) {
        switch (month) {
            // Save February at twenty-eight
            case 2:
                return day > 0 && day < 29;
            // Thirty days hath September, April, June, and November
            case 9:
            case 4:
            case 6:
            case 11:
                return day > 0 && day < 31;
            // All the rest have thirty-one
            default:
                return day > 0 && day < 32;
        }
    }
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
            || false === LitCalMoveEventData.#isValidDayValueForMonth(liturgical_event.month, liturgical_event.day)
        ) {
            throw new Error('`liturgical_event.day` must be an integer between 1 and 31 and it must be a valid day value for the given month');
        }
        return Object.freeze(this);
    }
}

class LitCalCreateNewFixedData extends LitCalEventData {
    static #isValidDayValueForMonth(month, day) {
        switch (month) {
            // Save February at twenty-eight
            case 2:
                return day > 0 && day < 29;
            // Thirty days hath September, April, June, and November
            case 9:
            case 4:
            case 6:
            case 11:
                return day > 0 && day < 31;
            // All the rest have thirty-one
            default:
                return day > 0 && day < 32;
        }
    }

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
            || false === LitCalCreateNewFixedData.#isValidDayValueForMonth(liturgical_event.month, liturgical_event.day)
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
        this.color  = liturgical_event.color.map(color => new LitColor(color));
        this.grade  = new LitGrade(liturgical_event.grade);
        this.common = liturgical_event.common;
        return Object.freeze(this);
    }
}

class LitCalCreateNewMobileData extends LitCalEventData {
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
        this.color  = liturgical_event.color.map(color => new LitColor(color));
        this.grade  = new LitGrade(liturgical_event.grade);
        this.common = liturgical_event.common;
        return Object.freeze(this);
    }
}

class LitCalSetPropertyNameData extends LitCalEventData {
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('name')) {
            throw new Error('`liturgical_event.event_key` and `liturgical_event.name` properties are required for a `metadata.action` of `setProperty` and when the property is `name`');
        }
        if (typeof liturgical_event.name !== 'string') {
            throw new Error('`liturgical_event.name` must be a string');
        }
        super(liturgical_event.event_key);
        this.name = liturgical_event.name;
        return Object.freeze(this);
    }
}

class LitCalSetPropertyGradeData extends LitCalEventData {
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('grade')) {
            throw new Error('`liturgical_event.event_key` and `liturgical_event.grade` properties are required for a `metadata.action` of `setProperty` and when the property is `grade`');
        }
        super(liturgical_event.event_key);
        this.grade = new LitGrade(liturgical_event.grade);
        return Object.freeze(this);
    }
}

class LitCalMakePatronData extends LitCalEventData {
    constructor( liturgical_event ) {
        if (false === liturgical_event.hasOwnProperty('event_key') || false === liturgical_event.hasOwnProperty('grade')) {
            throw new Error('`liturgical_event.event_key` and `liturgical_event.grade` properties are required for a `metadata.action` of `makePatron`, we received: ' + JSON.stringify(liturgical_event));
        }
        super(liturgical_event.event_key);
        this.grade = new LitGrade(liturgical_event.grade);
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
    constructor( metadata ) {
        if ( false === metadata.hasOwnProperty('since_year') || false === metadata.hasOwnProperty('missal') || false === metadata.hasOwnProperty('reason') ) {
            throw new Error('since_year, missal, and reason parameters are required');
        }
        super(metadata.since_year, metadata.until_year ?? null);
        this.action      = 'moveEvent';
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
                if (false === litcalItem.liturgical_event.event_key in translations) {
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
        this.litcal   = new NationalCalendarLitCalArray(litcal, this.i18n);
        /**@type {CalendarSettings} */
        this.settings = new CalendarSettings(settings);
        /**@type {NationalCalendarPayloadMetadata} */
        this.metadata = new NationalCalendarPayloadMetadata(metadata);
        return Object.freeze(this);
    }
}

export {
    NationalCalendarPayload
}
