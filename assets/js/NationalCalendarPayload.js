import { Settings, Locale } from './Settings.js';
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
            throw new Error(`the value passed to the constructor of a LitColor must be one of ${LitColor.#map.join(', ')}`);
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

/**
 * @typedef LitGrade
 * @enum {7|6|5|4|3|2|1|0}
 */
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

class NationalCalendarFestivityData {
    static #allowedProps = Object.freeze(['event_key', 'name', 'grade', 'color', 'common', 'day', 'month', 'strototime']);
    static #allowedPropsByFlavor = Object.freeze({
        makePatron: ['event_key', 'name', 'grade'],
        setProperty: ['event_key', 'name', 'grade'],
        moveFestivity: ['event_key']
    });
    constructor( festivityData, flavor ) {
        if (typeof festivityData !== 'object' || festivityData === null) {
            throw new Error('the value passed to the constructor of a NationalCalendarFestivityData must be of type object and not null');
        }
        if (false === festivityData.hasOwnProperty('event_key')) {
            throw new Error('the value passed to the constructor of a NationalCalendarFestivityData must have a "event_key" property');
        }
        return new Proxy(this, {
            set: (target, prop, value) => {
                if (false === festivityData.hasOwnProperty(prop)) {
                    throw new Error(`Cannot set invalid property "${prop}" on a NationalCalendarFestivityData instance.`);
                }
                return Reflect.set(target, prop, value);
            }
        });
    }
}
Object.freeze(NationalCalendarFestivityData);

class NationalCalendarFestivityMetadata {
    static #flavors       = Object.freeze(['makePatron', 'setProperty', 'moveFestivity', 'createNew']);
    static #allowedProps  = Object.freeze(['since_year', 'until_year', 'url', 'url_lang_map']);
    static #propOverrides = Object.freeze(['name', 'grade']);
    static MakePatron     = new NationalCalendarFestivityMetadata('makePatron');
    static SetProperty    = new NationalCalendarFestivityMetadata('setProperty');
    static MoveFestivity  = new NationalCalendarFestivityMetadata('moveFestivity');
    static CreateNew      = new NationalCalendarFestivityMetadata('createNew');
    constructor( action ) {
        if (false === NationalCalendarFestivityMetadata.#flavors.includes(action)) {
            throw new Error(`the value passed to the constructor of a NationalCalendarFestivityMetadata must be one of ${NationalCalendarFestivityMetadata.#flavors.join(', ')}`);
        }
        this.action = action;
        return new Proxy(this, {
            set: (target, prop, value) => {
                if (target.action === 'setProperty' && prop === 'property') {
                    if (false === NationalCalendarFestivityMetadata.#propOverrides.includes(value)) {
                        throw new Error(`When using the setProperty action, the value passed to the 'property' property must be one of ${NationalCalendarFestivityMetadata.#propOverrides.join(', ')}`);
                    }
                    return Reflect.set(target, prop, value);
                }
                if (NationalCalendarFestivityMetadata.#allowedProps.includes(prop)) {
                    if (['since_year', 'until_year'].includes(prop)) {
                        if (typeof value !== 'number' || !Number.isInteger(value)) {
                            throw new Error(`The value of the '${prop}' property on an instance of NationalCalendarFestivityMetadata must be an integer`);
                        }
                    }
                    if ('url' === prop) {
                        if (typeof value !== 'string') {
                            throw new Error(`The value of the '${prop}' property on an instance of NationalCalendarFestivityMetadata must be a valid URL string`);
                        }
                        try {
                            const url = new URL(value);
                            value = url.href;
                        } catch (e) {
                            throw new Error(`The value of the '${prop}' property on an instance of NationalCalendarFestivityMetadata must be a valid URL string`);
                        }
                    }
                    if ('url_lang_map' === prop) {
                        if (typeof value !== 'object' || value === null) {
                            throw new Error(`The value of the '${prop}' property on an instance of NationalCalendarFestivityMetadata must be a map of language codes to custom language codes`);
                        }
                        // TODO: validate the contents of the url_lang_map
                    }
                    return Reflect.set(target, prop, value);
                } else {
                    throw new Error(`Cannot set invalid property "${prop}" on a NationalCalendarFestivityMetadata instance.`);
                }
            }
        });
    }
}
Object.freeze(NationalCalendarFestivityMetadata);


class NationalCalendarLitCalItem {
    constructor( litcalitem ) {
        const invalidValError = 'the value passed to the constructor of a NationalCalendarLitCalItem must be an object with "festivity" and "metadata" and "metadata.action" properties';
        if (typeof litcalitem !== 'object' || litcalitem === null) {
            throw new Error(invalidValError);
        }
        if (false === litcalitem.hasOwnProperty('festivity') || false === litcalitem.hasOwnProperty('metadata') || false === litcalitem.metadata.hasOwnProperty('action')) {
            throw new Error(invalidValError);
        }
        if (litcalitem.metadata.action === 'setProperty' && false === litcalitem.metadata.hasOwnProperty('property')) {
            throw new Error('when metadata.action is `setProperty`, the `property` property must also be set');
        }
        this.metadata = new NationalCalendarFestivityMetadata(litcalitem.metadata.action);
        Object.entries(litcalitem.metadata).forEach(([key, value]) => {
            if ('action' !== key) {
                this.metadata[key] = value;
            }
        });
        this.festivity = new NationalCalendarFestivityData(litcalitem.festivity, this.metadata.action);
        return Object.freeze(this);
    }
}

class NationalCalendarLitCalArray {
    constructor( litcalarray ) {
        this._data = litcalarray.map(litcalitem => new NationalCalendarLitCalItem(litcalitem));
    }
    add(itemToPush) {
        let item = new NationalCalendarLitCalItem(itemToPush);
        this._data.push(item);
    }
    [Symbol.iterator]() {
        let index = -1;
        let data  = this._data;
        return {
          next: () => ({ value: data[++index], done: index >= data.length })
        };
    };
}

class NationalCalendarMetadata {
    constructor( metadata ) {
        if (typeof metadata !== 'object' || metadata === null) {
            throw new Error('the value passed to the constructor of a NationalCalendarMetadata must be an object with properties `region`, `wider_region`, and `missals`');
        }
        if (metadata.hasOwnProperty('region') === false || metadata.hasOwnProperty('wider_region') === false || metadata.hasOwnProperty('missals') === false) {
            throw new Error('the value passed to the constructor of a NationalCalendarMetadata must be an object with properties `region`, `wider_region`, and `missals`');
        }
        const regionNames = new Intl.DisplayNames(['en'], {type: 'region'});
        const widerRegions = ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica'];
        if (regionNames.of(metadata.region) === metadata.region) {
            throw new Error('the value passed to the constructor of a NationalCalendarMetadata region property must be a valid ISO 3166-1 alpha-2 region code');
        }
        if (false === widerRegions.includes(metadata.wider_region)) {
            throw new Error('the value passed to the constructor of a NationalCalendarMetadata wider_region property must be a valid wider region name');
        }
        if (false === Array.isArray(metadata.missals)) {
            throw new Error('the value passed to the constructor of a NationalCalendarMetadata missals property must be an array');
        }
        this.region       = metadata.region;
        this.wider_region = metadata.wider_region;
        this.missals      = metadata.missals;
        return Object.freeze(this);
    }
}

/**
 * @typedef {Object} NationalCalendarPayload
 * @prop {NationalCalendarLitCalArray} litcal
 * @prop {Settings} settings
 * @prop {NationalCalendarMetadata} metadata
 */

class NationalCalendarPayload {
    constructor( litcal = null, settings = null, metadata = null ) {
        if (null === litcal || null === settings || null === metadata) {
            throw new Error('litcal, settings and metadata parameters are required');
        }
        /**@type {NationalCalendarLitCalArray} */
        this.litcal = new NationalCalendarLitCalArray(litcal);
        /**@type {Settings} */
        this.settings = new Settings(settings);
        this.metadata = new NationalCalendarMetadata(metadata);
        return Object.freeze(this);
    }
}

export {
    NationalCalendarPayload
}
