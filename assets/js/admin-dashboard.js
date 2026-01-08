/**
 * Admin Dashboard Module
 *
 * Handles permission-based UI updates, block interactions, and count fetching
 * for the unified admin dashboard.
 */

/* global Auth, MetadataUrl, MissalsUrl, DecreesUrl, TemporaleUrl, RegionalDataUrl */

/**
 * API endpoint configurations for fetching counts
 * Each entry maps a block ID to its API endpoint and the key containing the countable array
 */
const countEndpoints = {
    temporale: {
        url: typeof TemporaleUrl !== 'undefined' ? TemporaleUrl : null,
        countKey: 'events'
    },
    sanctorale: {
        url: typeof MissalsUrl !== 'undefined' ? MissalsUrl : null,
        countKey: null // Count top-level array
    },
    decrees: {
        url: typeof DecreesUrl !== 'undefined' ? DecreesUrl : null,
        countKey: 'litcal_decrees'
    },
    widerregion: {
        url: typeof RegionalDataUrl !== 'undefined' ? `${RegionalDataUrl}?category=widerregion` : null,
        countKey: 'wider_regions'
    },
    national: {
        url: typeof MetadataUrl !== 'undefined' ? MetadataUrl : null,
        countKey: 'national_calendars'
    },
    diocesan: {
        url: typeof MetadataUrl !== 'undefined' ? MetadataUrl : null,
        countKey: 'diocesan_calendars'
    }
};

/**
 * Fetch counts for all admin blocks
 */
async function fetchAllCounts() {
    const countPromises = Object.entries(countEndpoints).map(async ([blockId, config]) => {
        if (!config.url) {
            console.warn(`No URL configured for ${blockId}`);
            updateCountBadge(blockId, '?');
            return;
        }

        try {
            const response = await fetch(config.url, {
                headers: { 'Accept': 'application/json' }
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
                // Count items in specified key
                const items = data[config.countKey];
                count = Array.isArray(items) ? items.length : 0;
            }

            updateCountBadge(blockId, count);
        } catch (error) {
            console.warn(`Failed to fetch count for ${blockId}:`, error);
            updateCountBadge(blockId, '?');
        }
    });

    await Promise.allSettled(countPromises);
}

/**
 * Update the count badge for a specific block
 *
 * @param {string} blockId - The block identifier
 * @param {number|string} count - The count to display
 */
function updateCountBadge(blockId, count) {
    const badge = document.querySelector(`[data-count="${blockId}"]`);
    if (badge) {
        if (typeof count === 'number') {
            badge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
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
        await Auth.updateAuthCache();
        updateBlockPermissions();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAdminDashboard);

// Listen for auth changes
document.addEventListener('auth:login', updateBlockPermissions);
document.addEventListener('auth:logout', updateBlockPermissions);
