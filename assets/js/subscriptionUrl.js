/**
 * The subscription URL model for usage.php's calendar-subscription card.
 *
 * Deliberately free of imports, DOM access and globals: `usage.js` injects
 * `CurrentEndpoint.apiBase` at startup, and the rite arrives as a plain string.
 * `@liturgical-calendar/components-js` resolves only through the browser
 * importmap, so importing it here would break the Vitest suite.
 */

/**
 * Enum CalendarType
 * Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = Object.freeze({
    NATIONAL: 'nation',
    DIOCESAN: 'diocese',
});

/**
 * Represents the query parameters for the API /calendar endpoint request
 */
class RequestPayload {
    static epiphany = null;
    static ascension = null;
    static corpus_christi = null;
    static eternal_high_priest = null;
    static locale = null;
    static return_type = 'ICS';
    static year_type = 'CIVIL';
}

/**
 * Class CurrentEndpoint
 * Builds the full endpoint URL used as the calendar subscription URL.
 */
class CurrentEndpoint {
    /** @type {string} Set by usage.js from the CalendarUrl global; already ends in `/calendar`. */
    static apiBase = '';

    /**
     * The liturgical rite, as a plain string (`'roman'` / `'ambrosian'`) rather
     * than the components-js `Rite` enum, which this module cannot import.
     *
     * Emitted unconditionally, `roman` included. The API's
     * `Router::extractRiteSegment()` accepts the explicit spelling and treats
     * `/calendar/roman/nation/IT` and `/calendar/nation/IT` as the same request,
     * so rite-explicit URLs are the default from here on and users transition
     * onto them. URLs already pasted into calendar apps keep resolving.
     *
     * @type {string}
     */
    static rite = 'roman';
    static calendarType = null;
    static calendarId = null;
    static calendarYear = null;

    static serialize = () => {
        let currentEndpoint = CurrentEndpoint.apiBase;
        // Before the calendar segment, never after: apiBase already ends in
        // `/calendar`, and `/calendar/nation/IT/roman` is not a route.
        currentEndpoint += `/${CurrentEndpoint.rite}`;
        if (
            CurrentEndpoint.calendarType !== null &&
            CurrentEndpoint.calendarId !== null
        ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if (CurrentEndpoint.calendarYear !== null) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        const parameters = [];
        for (const key in RequestPayload) {
            if (RequestPayload[key] !== null && RequestPayload[key] !== '') {
                parameters.push(
                    key + '=' + encodeURIComponent(RequestPayload[key]),
                );
            }
        }
        const urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${currentEndpoint}${urlParams}`;
    };
}

export { CalendarType, RequestPayload, CurrentEndpoint };
