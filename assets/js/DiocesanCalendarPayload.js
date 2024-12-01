/**
 * @typedef DiocesanCalendarPayload
 * @prop {Array<RowData>} litcal
 * @prop {Object} settings
 * @prop {string} settings.locale
 * @prop {Object} metadata
 * @prop {string} metadata.region
 */

class DiocesanCalendarPayload {
    constructor( litcal, settings, metadata ) {
        const allowedProps = new Set(['litcal', 'settings', 'metadata']);
        this.litcal = litcal;
        this.settings = settings;
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

/**
 * @typedef DiocesanCalendarDELETEPayload
 * @prop {string} diocese
 * @prop {string} nation
 */

class DiocesanCalendarDELETEPayload {
    /**
     * Create a new DiocesanCalendarDELETEPaylod.
     * @param {string} diocese - Diocese code.
     * @param {string} nation - Nation code.
     * @returns {DiocesanCalendarDELETEPayload} A new instance of DiocesanCalendarDELETEPayload.
     */
    constructor( diocese, nation ) {
        const allowedProps = new Set(['diocese', 'nation']);
        this.diocese = diocese;
        this.nation = nation;
        return new Proxy( this, {
            get: (target, prop) => {
                if ( allowedProps.has( prop ) || (prop === 'toJSON' && typeof target[prop] === 'function') ) {
                    return Reflect.get(target, prop);
                } else {
                    throw new Error( `Cannot access invalid property "${prop}".` );
                }
            },

            set( target, prop, value ) {
                if ( allowedProps.has( prop ) ) {
                    //TODO: Add validation for diocese and nation
                    return Reflect.set(target, prop, value);
                } else {
                    throw new Error( `Cannot add new property "${prop}".` );
                }
            }
        } );
    }
}

export {
    DiocesanCalendarPayload,
    DiocesanCalendarDELETEPayload
}
