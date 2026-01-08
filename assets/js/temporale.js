/**
 * Temporale Viewer Module
 *
 * Fetches and displays temporale events with filtering capabilities.
 */

import { escapeHtml } from './templates.js';

/**
 * Grade labels for display
 */
const gradeLabels = {
    0: 'Weekday',
    1: 'Commemoration',
    2: 'Optional Memorial',
    3: 'Memorial',
    4: 'Feast',
    5: 'Feast of the Lord',
    6: 'Solemnity',
    7: 'Higher Solemnity'
};

/**
 * Season labels for display
 */
const seasonLabels = {
    'ADVENT': 'Advent',
    'CHRISTMAS': 'Christmas',
    'LENT': 'Lent',
    'EASTER_TRIDUUM': 'Easter Triduum',
    'EASTER': 'Easter',
    'ORDINARY_TIME': 'Ordinary Time'
};

/**
 * Color display mapping
 */
const colorDisplay = {
    'white': { label: 'White', class: 'bg-light text-dark border' },
    'red': { label: 'Red', class: 'bg-danger text-white' },
    'green': { label: 'Green', class: 'bg-success text-white' },
    'purple': { label: 'Purple', class: 'text-white', style: 'background-color: #800080;' },
    'rose': { label: 'Rose', class: 'text-dark', style: 'background-color: pink;' },
    'black': { label: 'Black', class: 'bg-dark text-white' }
};

/**
 * All temporale events (cached)
 */
let allEvents = [];

/**
 * Currently filtered events
 */
let filteredEvents = [];

/**
 * Fetch temporale events from API
 */
async function fetchTemporaleEvents() {
    if (typeof TemporaleUrl === 'undefined' || !TemporaleUrl) {
        console.error('TemporaleUrl not configured');
        showError('API URL not configured');
        return;
    }

    try {
        const response = await fetch(TemporaleUrl, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        allEvents = data.events || [];
        filteredEvents = [...allEvents];

        updateTable();
        updateEventCount();
    } catch (error) {
        console.error('Failed to fetch temporale events:', error);
        showError('Failed to load temporale events: ' + error.message);
    }
}

/**
 * Show error message in table
 * @param {string} message
 */
function showError(message) {
    const tbody = document.getElementById('temporaleTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}


/**
 * Update the events table with filtered data
 */
function updateTable() {
    const tbody = document.getElementById('temporaleTableBody');
    if (!tbody) return;

    if (filteredEvents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="fas fa-search me-2"></i>No events found matching your filters.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredEvents.map(event => {
        const colorBadges = (event.color || []).map(c => {
            const colorInfo = colorDisplay[c] || { label: c, class: 'bg-secondary' };
            const style = colorInfo.style ? `style="${colorInfo.style}"` : '';
            return `<span class="badge ${colorInfo.class} me-1" ${style}>${escapeHtml(colorInfo.label)}</span>`;
        }).join('');

        return `
            <tr data-event-key="${escapeHtml(event.event_key)}">
                <td><code>${escapeHtml(event.event_key)}</code></td>
                <td>${escapeHtml(event.name || '')}</td>
                <td>
                    <span class="badge bg-${getGradeBadgeColor(event.grade)}">
                        ${event.grade} - ${escapeHtml(gradeLabels[event.grade] || 'Unknown')}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${getSeasonBadgeColor(event.liturgical_season)}">
                        ${escapeHtml(seasonLabels[event.liturgical_season] || event.liturgical_season)}
                    </span>
                </td>
                <td>${escapeHtml(event.type || '')}</td>
                <td>${colorBadges}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-details-btn" data-event-key="${escapeHtml(event.event_key)}">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach event listeners for view buttons
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const eventKey = btn.dataset.eventKey;
            showEventDetails(eventKey);
        });
    });
}

/**
 * Get badge color for grade
 * @param {number} grade
 * @returns {string}
 */
function getGradeBadgeColor(grade) {
    const colors = {
        7: 'danger',
        6: 'warning',
        5: 'info',
        4: 'primary',
        3: 'success',
        2: 'secondary',
        1: 'light text-dark border',
        0: 'light text-dark border'
    };
    return colors[grade] || 'secondary';
}

/**
 * Get badge color for season
 * @param {string} season
 * @returns {string}
 */
function getSeasonBadgeColor(season) {
    const colors = {
        'ADVENT': 'purple',
        'CHRISTMAS': 'light text-dark border',
        'LENT': 'purple',
        'EASTER_TRIDUUM': 'danger',
        'EASTER': 'warning',
        'ORDINARY_TIME': 'success'
    };
    return colors[season] || 'secondary';
}

/**
 * Update the event count badge
 */
function updateEventCount() {
    const countEl = document.getElementById('eventCount');
    if (countEl) {
        countEl.textContent = `${filteredEvents.length} of ${allEvents.length}`;
    }
}

/**
 * Apply filters to events
 */
function applyFilters() {
    const seasonFilter = document.getElementById('seasonFilter')?.value || '';
    const gradeFilter = document.getElementById('gradeFilter')?.value || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const searchFilter = (document.getElementById('searchFilter')?.value || '').toLowerCase();

    filteredEvents = allEvents.filter(event => {
        // Season filter
        if (seasonFilter && event.liturgical_season !== seasonFilter) {
            return false;
        }

        // Grade filter
        if (gradeFilter && String(event.grade) !== gradeFilter) {
            return false;
        }

        // Category filter
        if (categoryFilter && event.lectionary_category !== categoryFilter) {
            return false;
        }

        // Search filter
        if (searchFilter) {
            const searchIn = `${event.event_key} ${event.name || ''}`.toLowerCase();
            if (!searchIn.includes(searchFilter)) {
                return false;
            }
        }

        return true;
    });

    updateTable();
    updateEventCount();
}

/**
 * Show event details in modal
 * @param {string} eventKey
 */
function showEventDetails(eventKey) {
    const event = allEvents.find(e => e.event_key === eventKey);
    if (!event) return;

    const modalBody = document.getElementById('eventDetailsBody');
    if (!modalBody) return;

    const colorBadges = (event.color || []).map(c => {
        const colorInfo = colorDisplay[c] || { label: c, class: 'bg-secondary' };
        const style = colorInfo.style ? `style="${colorInfo.style}"` : '';
        return `<span class="badge ${colorInfo.class}" ${style}>${escapeHtml(colorInfo.label)}</span>`;
    }).join(' ');

    // Build readings section
    let readingsHtml = '';
    if (event.readings) {
        const years = Object.keys(event.readings);
        if (years.length > 0) {
            readingsHtml = `
                <h6 class="mt-4 mb-3"><i class="fas fa-book me-2"></i>Readings</h6>
                <ul class="nav nav-tabs" id="readingsTabs" role="tablist">
                    ${years.map((year, idx) => `
                        <li class="nav-item" role="presentation">
                            <button class="nav-link ${idx === 0 ? 'active' : ''}" id="tab-${year}" data-bs-toggle="tab"
                                    data-bs-target="#pane-${year}" type="button" role="tab">
                                ${escapeHtml(year.replace('annum_', 'Year ').toUpperCase())}
                            </button>
                        </li>
                    `).join('')}
                </ul>
                <div class="tab-content border border-top-0 p-3" id="readingsTabContent">
                    ${years.map((year, idx) => {
                        const readings = event.readings[year];
                        return `
                            <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" id="pane-${year}" role="tabpanel">
                                <dl class="row mb-0">
                                    ${Object.entries(readings).map(([key, value]) => `
                                        <dt class="col-sm-4">${escapeHtml(key.replace(/_/g, ' '))}</dt>
                                        <dd class="col-sm-8">${escapeHtml(value || '—')}</dd>
                                    `).join('')}
                                </dl>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-key me-2"></i>Event Key</h6>
                <p><code class="fs-5">${escapeHtml(event.event_key)}</code></p>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-font me-2"></i>Name</h6>
                <p class="fs-5">${escapeHtml(event.name || '—')}</p>
            </div>
        </div>
        <hr>
        <div class="row">
            <div class="col-md-4">
                <h6><i class="fas fa-layer-group me-2"></i>Grade</h6>
                <p>
                    <span class="badge bg-${getGradeBadgeColor(event.grade)} fs-6">
                        ${event.grade} - ${escapeHtml(gradeLabels[event.grade] || 'Unknown')}
                    </span>
                </p>
            </div>
            <div class="col-md-4">
                <h6><i class="fas fa-leaf me-2"></i>Season</h6>
                <p>
                    <span class="badge bg-${getSeasonBadgeColor(event.liturgical_season)} fs-6">
                        ${escapeHtml(seasonLabels[event.liturgical_season] || event.liturgical_season)}
                    </span>
                </p>
            </div>
            <div class="col-md-4">
                <h6><i class="fas fa-calendar me-2"></i>Type</h6>
                <p><span class="badge bg-secondary fs-6">${escapeHtml(event.type || '—')}</span></p>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-6">
                <h6><i class="fas fa-palette me-2"></i>Liturgical Color</h6>
                <p>${colorBadges || '—'}</p>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-book-open me-2"></i>Lectionary Category</h6>
                <p><code>${escapeHtml(event.lectionary_category || '—')}</code></p>
            </div>
        </div>
        ${readingsHtml}
    `;

    // Update modal title
    const modalTitle = document.getElementById('eventDetailsModalLabel');
    if (modalTitle) {
        modalTitle.textContent = event.name || event.event_key;
    }

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
    modal.show();
}

/**
 * Export filtered events as JSON
 */
function exportJson() {
    const dataStr = JSON.stringify({ events: filteredEvents }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'temporale-events.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Initialize the temporale viewer
 */
function init() {
    // Fetch events
    fetchTemporaleEvents();

    // Attach filter event listeners
    const filterIds = ['seasonFilter', 'gradeFilter', 'categoryFilter'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', applyFilters);
        }
    });

    // Search with debounce
    const searchEl = document.getElementById('searchFilter');
    if (searchEl) {
        let debounceTimer;
        searchEl.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(applyFilters, 300);
        });
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportJson);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
