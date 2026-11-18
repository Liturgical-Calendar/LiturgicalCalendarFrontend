/**
 * Calendar categories whose definition the API refuses without liturgical events:
 * a diocesan or wider region calendar with an empty `litcal` is answered with 422.
 * A national calendar may have none, because a calendar of settings only is valid.
 */
const CATEGORIES_REQUIRING_EVENTS = Object.freeze(['diocese', 'widerregion']);

/**
 * Whether Save must stay disabled because the calendar has no events yet.
 *
 * @param {string} category 'diocese', 'widerregion' or 'nation'
 * @param {number} eventCount how many event rows the form has
 * @returns {boolean}
 */
export const saveBlockedForMissingEvents = (category, eventCount) =>
    CATEGORIES_REQUIRING_EVENTS.includes(category) && eventCount === 0;
