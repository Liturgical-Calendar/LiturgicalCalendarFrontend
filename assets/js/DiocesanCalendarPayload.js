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
                // Allow JSON.stringify
                if (prop === 'toJSON') {
                    return () => ({
                        litcal: this.litcal,
                        settings: this.settings,
                        metadata: this.metadata
                    });
                }
                if ( allowedProps.has( prop ) ) {
                    return Reflect.get(target, prop);
                }
                throw new Error( `Cannot access invalid property "${prop}".` );
            },

            set( target, prop, value ) {
                if ( allowedProps.has( prop ) ) {
                    //TODO: Add validations
                    return Reflect.set(target, prop, value);
                }
                throw new Error( `Cannot add new property "${prop}".` );
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
                // Allow JSON.stringify
                if (prop === 'toJSON') {
                    return () => ({
                        diocese: this.diocese,
                        nation: this.nation
                    });
                }
                if ( allowedProps.has( prop ) ) {
                    return Reflect.get(target, prop);
                }
                throw new Error( `Cannot access invalid property "${prop}".` );
            },

            set( target, prop, value ) {
                if ( allowedProps.has( prop ) ) {
                    //TODO: Add validation for diocese and nation
                    return Reflect.set(target, prop, value);
                }
                throw new Error( `Cannot add new property "${prop}".` );
            }
        } );
    }
}

export {
    DiocesanCalendarPayload,
    DiocesanCalendarDELETEPayload
}
