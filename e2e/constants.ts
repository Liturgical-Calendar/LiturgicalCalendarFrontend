/**
 * Shared constants for E2E tests
 */

/**
 * The API's shape rule for a wider region name (`WiderRegionName`, API #1007).
 * Whether a region exists is a runtime check against `/calendars`.
 */
export const WIDER_REGION_NAME_PATTERN = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;
