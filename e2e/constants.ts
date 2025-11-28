/**
 * Shared constants for E2E tests
 */

/**
 * Valid wider region names as defined by the Liturgical Calendar API.
 * These represent geographical/cultural regions that can share liturgical events
 * across multiple national calendars.
 *
 * IMPORTANT: These values must match the enum in the API schema:
 * LiturgicalCalendarAPI/jsondata/schemas/WiderRegionCalendar.json#/definitions/CalendarMetadata/properties/wider_region
 */
export const VALID_WIDER_REGIONS = [
    'Africa',
    'Americas',
    'Asia',
    'Europe',
    'Oceania'
] as const;

export type WiderRegion = typeof VALID_WIDER_REGIONS[number];
