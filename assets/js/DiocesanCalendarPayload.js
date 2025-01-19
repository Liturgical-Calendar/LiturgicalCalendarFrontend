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


export {
    DiocesanCalendarPayload
}
