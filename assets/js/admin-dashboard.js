/**
 * Admin Dashboard Module
 *
 * Handles permission-based UI updates, block interactions, and count fetching
 * for the unified admin dashboard.
 */

/* global Auth, MetadataUrl, MissalsUrl, DecreesUrl, TemporaleUrl */

/**
 * API endpoint configurations for fetching counts
 * Each entry maps a block ID to its API endpoint and the key containing the countable array
 *
 * Note: widerregion, national, and diocesan all use the same MetadataUrl endpoint,
 * so they are fetched together in a single request for efficiency.
 */
const countEndpoints = {
    temporale: {
        url: typeof TemporaleUrl !== 'undefined' ? TemporaleUrl : null,
        countKey: 'events',
        unit: 'items'
    },
    sanctorale: {
        url: typeof MissalsUrl !== 'undefined' ? MissalsUrl : null,
        countKey: 'litcal_missals',
        unit: 'editions'
    },
    decrees: {
        url: typeof DecreesUrl !== 'undefined' ? DecreesUrl : null,
        countKey: 'litcal_decrees',
        unit: 'items'
    }
};

/**
 * Metadata endpoint count keys for calendar types
 * These are all fetched from a single MetadataUrl request
 */
const metadataCountKeys = {
    widerregion: 'wider_regions',
    national: 'national_calendars',
    diocesan: 'diocesan_calendars'
};

/**
 * Fetch counts from the metadata endpoint (wider region, national, diocesan)
 * Makes a single request and extracts all three counts
 */
async function fetchMetadataCounts() {
    if (typeof MetadataUrl === 'undefined' || !MetadataUrl) {
        console.warn('MetadataUrl not configured');
        Object.keys(metadataCountKeys).forEach(blockId => updateCountBadge(blockId, '?', 'calendars'));
        return;
    }

    try {
        const response = await fetch(MetadataUrl, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const metadata = data.litcal_metadata || data;

        // Extract counts for each calendar type
        Object.entries(metadataCountKeys).forEach(([blockId, countKey]) => {
            const items = metadata[countKey];
            const count = Array.isArray(items) ? items.length : (items ? Object.keys(items).length : 0);
            updateCountBadge(blockId, count, 'calendars');
        });
    } catch (error) {
        console.warn('Failed to fetch metadata counts:', error);
        Object.keys(metadataCountKeys).forEach(blockId => updateCountBadge(blockId, '?', 'calendars'));
    }
}

/**
 * Fetch counts for individual endpoint blocks (temporale, sanctorale, decrees)
 */
async function fetchIndividualCounts() {
    const countPromises = Object.entries(countEndpoints).map(async ([blockId, config]) => {
        if (!config.url) {
            console.warn(`No URL configured for ${blockId}`);
            updateCountBadge(blockId, '?', config.unit);
            return;
        }

        try {
            const response = await fetch(config.url, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            let count;

            if (config.countKey === null) {
                // Count top-level array or object keys
                count = Array.isArray(data) ? data.length : Object.keys(data).length;
            } else {
                // Count items in specified key (handle both arrays and objects)
                const items = data[config.countKey];
                count = Array.isArray(items) ? items.length : (items ? Object.keys(items).length : 0);
            }

            updateCountBadge(blockId, count, config.unit);
        } catch (error) {
            console.warn(`Failed to fetch count for ${blockId}:`, error);
            updateCountBadge(blockId, '?', config.unit);
        }
    });

    await Promise.allSettled(countPromises);
}

/**
 * Fetch counts for all admin blocks
 */
async function fetchAllCounts() {
    // Fetch metadata counts (single request for 3 calendar types) and individual counts in parallel
    await Promise.all([
        fetchMetadataCounts(),
        fetchIndividualCounts()
    ]);
}

/**
 * Unit labels for count badges
 */
const unitLabels = {
    items: { singular: 'item', plural: 'items' },
    calendars: { singular: 'calendar', plural: 'calendars' },
    editions: { singular: 'edition', plural: 'editions' }
};

/**
 * Update the count badge for a specific block
 *
 * @param {string} blockId - The block identifier
 * @param {number|string} count - The count to display
 * @param {string} unit - The unit label ('items', 'calendars', or 'editions'), defaults to 'items'
 */
function updateCountBadge(blockId, count, unit = 'items') {
    const badge = document.querySelector(`[data-count="${blockId}"]`);
    if (badge) {
        if (typeof count === 'number') {
            const labels = unitLabels[unit] || unitLabels.items;
            badge.textContent = `${count} ${count === 1 ? labels.singular : labels.plural}`;
        } else {
            badge.textContent = count;
        }
    }
}

/**
 * Update block permissions based on authentication state
 */
function updateBlockPermissions() {
    const blocks = document.querySelectorAll('.admin-block');
    const isAuth = typeof Auth !== 'undefined' && Auth.isAuthenticated();

    blocks.forEach(block => {
        const editBtns = block.querySelectorAll('[data-requires-permission]');
        editBtns.forEach(btn => {
            if (isAuth) {
                // Future: check specific permission
                // const perm = btn.dataset.requiresPermission;
                // if (Auth.hasPermission(perm)) { ... }
                btn.classList.remove('d-none');
            } else {
                btn.classList.add('d-none');
            }
        });
    });
}

/**
 * Initialize the admin dashboard
 */
async function initAdminDashboard() {
    // Fetch counts for all blocks
    await fetchAllCounts();

    // Wait for auth state and update permissions
    if (typeof Auth !== 'undefined') {
        try {
            await Auth.updateAuthCache();
        } catch (error) {
            console.warn('Failed to update auth cache:', error);
        }
        // Update permissions regardless of cache update success
        updateBlockPermissions();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAdminDashboard);

// Listen for auth changes
document.addEventListener('auth:login', updateBlockPermissions);
document.addEventListener('auth:logout', updateBlockPermissions);
