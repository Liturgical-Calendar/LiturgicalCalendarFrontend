/**
 * Shared constants for E2E tests
 */

/**
 * Valid wider region names as defined by the Liturgical Calendar API.
 * These represent geographical/cultural regions that can share liturgical events
 * across multiple national calendars.
 */
export const VALID_WIDER_REGIONS = [
    'Americas',
    'Europe',
    'Africa',
    'Oceania',
    'Asia',
    'Antarctica'
] as const;

export type WiderRegion = typeof VALID_WIDER_REGIONS[number];
