/**
 * @typedef {Object} WiderRegionPayload
 * @prop {Array<RowData>} litcal
 * @prop {Object} national_calendars
 * @prop {Object} metadata
 * @prop {Array<string>} metadata.locales
 * @prop {string} metadata.wider_region
 */

class WiderRegionPayload {
    constructor( litcal, national_calendars, metadata ) {
        const allowedProps = new Set(['litcal', 'national_calendars', 'metadata']);
        this.litcal = litcal;
        this.national_calendars = national_calendars;
        this.metadata = metadata;
        return new Proxy( this, {
            get: (target, prop) => {
                if ( allowedProps.has( prop ) ) {
                    return Reflect.get(target, prop);
                } else {
                    throw new Error( `Cannot access invalid property "${prop}".` );
                }
            },

            set( target, prop, value ) {
                if ( allowedProps.has( prop ) ) {
                    //TODO: Add validations
                    return Reflect.set(target, prop, value);
                } else {
                    throw new Error( `Cannot add new property "${prop}".` );
                }
            }
        } );
    }
}

export {
    WiderRegionPayload
}
