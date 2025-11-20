/**
 * @typedef {Object} WiderRegionPayload
 * @prop {Array<RowData>} litcal
 * @prop {Object} national_calendars
 * @prop {Object} metadata
 * @prop {Array<string>} metadata.locales
 * @prop {string} metadata.wider_region
 */

class WiderRegionPayload {
    constructor( litcal = null, national_calendars = null, metadata = null, i18n = null ) {
        if (null === litcal || null === national_calendars || null === metadata || null === i18n) {
            throw new Error('litcal, national_calendars, metadata and i18n parameters are required');
        }
        if (false === Array.isArray(litcal)) {
            throw new Error('litcal parameter must be an array');
        }
        if (typeof national_calendars !== 'object') {
            // should national_calendars be an array?
            throw new Error('national_calendars parameter must be an object');
        }
        if (typeof metadata !== 'object') {
            throw new Error('metadata parameter must be an object');
        }
        if (typeof i18n !== 'object') {
            throw new Error('i18n parameter must be an object');
        }
        if (false === metadata.hasOwnProperty('locales')) {
            throw new Error('`metadata.locales` parameter is required');
        }
        if (false === Array.isArray(metadata.locales) || 0 === metadata.locales.length) {
            throw new Error('`metadata.locales` parameter must be an array and must not be empty');
        }
        if (Object.keys(i18n).sort().join(',') !== metadata.locales.sort().join(',')) {
            throw new Error('`i18n` object must have the same keys as found in the `metadata.locales` array');
        }
        if (false === metadata.hasOwnProperty('wider_region')) {
            throw new Error('`metadata.wider_region` parameter is required');
        }
        if (typeof metadata.wider_region !== 'string') {
            throw new Error('`metadata.wider_region` parameter must be a string');
        }
        if (metadata.wider_region.includes(' - ')) {
            metadata.wider_region = metadata.wider_region.split(' - ')[0];
        }
        this.litcal = litcal;
        this.national_calendars = national_calendars;
        this.metadata = metadata;
        this.i18n = i18n;
        return Object.freeze(this);
    }
}

export {
    WiderRegionPayload
}
