/**
 * Shared constants for E2E tests
 */

/**
 * The API's shape rule for a wider region id (`WiderRegionId`, API #1018): lowercase
 * kebab-case, permanent once the region exists. Whether a region exists is a runtime
 * check against `/calendars`.
 */
export const WIDER_REGION_ID_PATTERN = /^[a-z]+(-[a-z]+)*$/;
