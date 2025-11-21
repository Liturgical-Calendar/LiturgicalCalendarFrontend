/** @import { RowData } from './extending.js' */

/**
 * @typedef DiocesanCalendarPayload
 * @prop {Array<RowData>} litcal
 * @prop {Object} settings
 * @prop {string} settings.locale
 * @prop {Object} metadata
 * @prop {string} metadata.region
 */

class DiocesanCalendarPayload {
    /**
     * Constructs a DiocesanCalendarPayload instance.
     *
     * @param {Array<RowData>} litcal - The liturgical calendar data.
     * @param {Object} settings - The settings for the calendar, containing properties such as epiphany, ascension, and corpus_christi.
     * @param {Object} metadata - Additional metadata about the calendar, such as the diocese name, diocese id, nation, supported locales, etc.
     *
     * @returns {Proxy} - A proxy to control access to properties and prevent adding new ones.
     *
     * The constructor initializes the payload with the provided liturgical calendar, settings, and metadata.
     * It also returns a Proxy that restricts access to only allowed properties and supports JSON serialization.
     */
    constructor( litcal, settings, metadata ) {
        const allowedProps = new Set(['litcal', 'settings', 'metadata']);
        this.litcal = litcal;
        this.settings = settings;
        this.metadata = metadata;
        return new Proxy(this, {
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
                    // Theoretically we could add validations here against calendars metadata
                    // But that would probably be more feasible with a dedicated metadata class...
                    return Reflect.set(target, prop, value);
                }
                throw new Error( `Cannot add new property "${prop}".` );
            }
        });
    }
}

export {
    DiocesanCalendarPayload
}
