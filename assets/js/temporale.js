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
 * Currently selected locale
 */
let selectedLocale = '';

/**
 * Fetch available locales from API metadata
 */
async function fetchAvailableLocales() {
    const localeSelect = document.getElementById('localeFilter');
    if (!localeSelect) return;

    // Get the current page locale from data attribute
    const currentLocale = localeSelect.dataset.currentLocale || 'en';

    if (typeof MetadataUrl === 'undefined' || !MetadataUrl) {
        console.warn('MetadataUrl not configured, using current locale');
        localeSelect.innerHTML = `<option value="${escapeHtml(currentLocale)}">${escapeHtml(currentLocale)}</option>`;
        selectedLocale = currentLocale;
        return;
    }

    try {
        // Public metadata endpoint - credentials omitted to avoid CORS error
        // (API returns Access-Control-Allow-Origin: * which is incompatible with credentials)
        const response = await fetch(MetadataUrl, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const metadata = data.litcal_metadata || data;
        const locales = metadata.locales || [];

        // Handle empty locales array
        if (locales.length === 0) {
            console.warn('No locales found in metadata, using current locale');
            localeSelect.innerHTML = `<option value="${escapeHtml(currentLocale)}">${escapeHtml(currentLocale)}</option>`;
            selectedLocale = currentLocale;
            return;
        }

        // Build options with display names
        localeSelect.innerHTML = locales.map(locale => {
            // Try to get display name using Intl.DisplayNames
            let displayName = locale;
            try {
                const displayNames = new Intl.DisplayNames([locale], { type: 'language' });
                displayName = displayNames.of(locale.split('_')[0]) || locale;
                // Capitalize first letter
                displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            } catch {
                // Fallback to locale code
            }
            return `<option value="${escapeHtml(locale)}">${escapeHtml(displayName)} (${escapeHtml(locale)})</option>`;
        }).join('');

        // Try to select current locale, fallback to first matching language, then first option
        const exactMatch = locales.find(l => l === currentLocale);
        const langMatch = locales.find(l => l.split('_')[0] === currentLocale.split('_')[0]);
        selectedLocale = exactMatch || langMatch || locales[0] || currentLocale;
        localeSelect.value = selectedLocale;

    } catch (error) {
        console.warn('Failed to fetch locales:', error);
        localeSelect.innerHTML = `<option value="${escapeHtml(currentLocale)}">${escapeHtml(currentLocale)}</option>`;
        selectedLocale = currentLocale;
    }
}

/**
 * Fetch temporale events from API
 */
async function fetchTemporaleEvents() {
    if (typeof TemporaleUrl === 'undefined' || !TemporaleUrl) {
        console.error('TemporaleUrl not configured');
        showError('API URL not configured');
        return;
    }

    // Show loading state
    const tbody = document.getElementById('temporaleTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    try {
        const headers = { 'Accept': 'application/json' };
        if (selectedLocale) {
            headers['Accept-Language'] = selectedLocale;
        }

        const response = await fetch(TemporaleUrl, {
            headers,
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
 * Last focused element before modal opened (for returning focus)
 */
let lastFocusedElement = null;

/**
 * Flag to track if modal event listener has been attached
 */
let modalListenerAttached = false;

/**
 * Current event index in filteredEvents array (for prev/next navigation)
 */
let currentEventIndex = -1;

/**
 * Format a reading key for display (e.g., "FIRST_READING" -> "First Reading")
 * @param {string} key - The reading key
 * @returns {string}
 */
function formatReadingKey(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/annum /i, 'Year ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Render a flat readings object as a definition list
 * @param {Object} readings - Object with reading keys and string values
 * @returns {string}
 */
function renderFlatReadings(readings) {
    return `
        <dl class="row mb-0">
            ${Object.entries(readings).map(([key, value]) => `
                <dt class="col-sm-4 fw-bold">${escapeHtml(formatReadingKey(key))}</dt>
                <dd class="col-sm-8">${escapeHtml(String(value) || '—')}</dd>
            `).join('')}
        </dl>
    `;
}

/**
 * Check if an object contains only string/primitive values (flat structure)
 * @param {Object} obj
 * @returns {boolean}
 */
function isFlatReadings(obj) {
    return Object.values(obj).every(v => typeof v !== 'object' || v === null);
}

/**
 * Build HTML for readings section, handling various structures:
 * - Flat: { FIRST_READING: "...", RESPONSORIAL_PSALM: "...", ... }
 * - Nested by year: { annum_a: {...}, annum_b: {...}, ... }
 * - Nested by mass time: { VIGIL: {...}, NIGHT: {...}, DAWN: {...}, DAY: {...} }
 * - Mixed: { annum_a: { VIGIL: {...}, ... }, ... }
 * @param {Object} readings
 * @returns {string}
 */
function buildReadingsHtml(readings) {
    const keys = Object.keys(readings);
    if (keys.length === 0) return '';

    // Check if this is a flat structure (all values are strings/primitives)
    if (isFlatReadings(readings)) {
        return `
            <h6 class="mt-4 mb-3"><i class="fas fa-book me-2"></i>Readings</h6>
            ${renderFlatReadings(readings)}
        `;
    }

    // Nested structure - use tabs for the top level
    return `
        <h6 class="mt-4 mb-3"><i class="fas fa-book me-2"></i>Readings</h6>
        <ul class="nav nav-tabs" id="readingsTabs" role="tablist">
            ${keys.map((key, idx) => `
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${idx === 0 ? 'active' : ''}" id="tab-${key}" data-bs-toggle="tab"
                            data-bs-target="#pane-${key}" type="button" role="tab">
                        ${escapeHtml(formatReadingKey(key))}
                    </button>
                </li>
            `).join('')}
        </ul>
        <div class="tab-content border border-top-0 p-3" id="readingsTabContent">
            ${keys.map((key, idx) => {
                const value = readings[key];
                let content;

                if (typeof value !== 'object' || value === null) {
                    // Primitive value (shouldn't happen at this level, but handle it)
                    content = `<p>${escapeHtml(String(value) || '—')}</p>`;
                } else if (isFlatReadings(value)) {
                    // Second level is flat (e.g., VIGIL: { FIRST_READING: "...", ... })
                    content = renderFlatReadings(value);
                } else {
                    // Third level nesting (e.g., annum_a: { VIGIL: { FIRST_READING: "...", ... }, ... })
                    content = buildNestedReadingsTabs(value, key);
                }

                return `
                    <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" id="pane-${key}" role="tabpanel">
                        ${content}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Build nested tabs for deeply nested readings (e.g., year > mass time > readings)
 * @param {Object} readings
 * @param {string} parentKey - Parent key for unique IDs
 * @returns {string}
 */
function buildNestedReadingsTabs(readings, parentKey) {
    const keys = Object.keys(readings);
    if (keys.length === 0) return '';

    return `
        <ul class="nav nav-pills nav-fill mb-3" id="subTabs-${parentKey}" role="tablist">
            ${keys.map((key, idx) => `
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${idx === 0 ? 'active' : ''}" id="subtab-${parentKey}-${key}"
                            data-bs-toggle="pill" data-bs-target="#subpane-${parentKey}-${key}" type="button" role="tab">
                        ${escapeHtml(formatReadingKey(key))}
                    </button>
                </li>
            `).join('')}
        </ul>
        <div class="tab-content" id="subTabContent-${parentKey}">
            ${keys.map((key, idx) => {
                const value = readings[key];
                const content = (typeof value === 'object' && value !== null)
                    ? renderFlatReadings(value)
                    : `<p>${escapeHtml(String(value) || '—')}</p>`;

                return `
                    <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" id="subpane-${parentKey}-${key}" role="tabpanel">
                        ${content}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render event details content in the modal body
 * @param {Object} event - The event object to render
 */
function renderEventDetails(event) {
    const modalBody = document.getElementById('eventDetailsBody');
    if (!modalBody) return;

    const colorBadges = (event.color || []).map(c => {
        const colorInfo = colorDisplay[c] || { label: c, class: 'bg-secondary' };
        const style = colorInfo.style ? `style="${colorInfo.style}"` : '';
        return `<span class="badge ${colorInfo.class}" ${style}>${escapeHtml(colorInfo.label)}</span>`;
    }).join(' ');

    // Build readings section
    let readingsHtml = '';
    if (event.readings && typeof event.readings === 'object') {
        readingsHtml = buildReadingsHtml(event.readings);
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
}

/**
 * Update the state of navigation buttons and position counter
 */
function updateNavigationButtons() {
    const firstBtn = document.getElementById('firstEventBtn');
    const prevBtn = document.getElementById('prevEventBtn');
    const nextBtn = document.getElementById('nextEventBtn');
    const lastBtn = document.getElementById('lastEventBtn');
    const positionEl = document.getElementById('eventPosition');

    const isFirst = currentEventIndex <= 0;
    const isLast = currentEventIndex >= filteredEvents.length - 1;

    if (firstBtn) {
        firstBtn.disabled = isFirst;
    }
    if (prevBtn) {
        prevBtn.disabled = isFirst;
    }
    if (nextBtn) {
        nextBtn.disabled = isLast;
    }
    if (lastBtn) {
        lastBtn.disabled = isLast;
    }
    if (positionEl) {
        positionEl.textContent = `${currentEventIndex + 1} / ${filteredEvents.length}`;
    }
}

/**
 * Show the first event in the modal
 */
function showFirstEvent() {
    if (filteredEvents.length > 0) {
        currentEventIndex = 0;
        renderEventDetails(filteredEvents[currentEventIndex]);
        updateNavigationButtons();
    }
}

/**
 * Show the previous event in the modal
 */
function showPreviousEvent() {
    if (currentEventIndex > 0) {
        currentEventIndex--;
        renderEventDetails(filteredEvents[currentEventIndex]);
        updateNavigationButtons();
    }
}

/**
 * Show the next event in the modal
 */
function showNextEvent() {
    if (currentEventIndex < filteredEvents.length - 1) {
        currentEventIndex++;
        renderEventDetails(filteredEvents[currentEventIndex]);
        updateNavigationButtons();
    }
}

/**
 * Show the last event in the modal
 */
function showLastEvent() {
    if (filteredEvents.length > 0) {
        currentEventIndex = filteredEvents.length - 1;
        renderEventDetails(filteredEvents[currentEventIndex]);
        updateNavigationButtons();
    }
}

/**
 * Show event details in modal
 * @param {string} eventKey
 */
function showEventDetails(eventKey) {
    // Find the event index in filteredEvents (for navigation)
    currentEventIndex = filteredEvents.findIndex(e => e.event_key === eventKey);
    if (currentEventIndex === -1) return;

    const event = filteredEvents[currentEventIndex];

    // Store the element that triggered the modal for returning focus
    lastFocusedElement = document.activeElement;

    // Render the event details
    renderEventDetails(event);
    updateNavigationButtons();

    // Get or create the modal instance (Bootstrap's built-in singleton pattern)
    const modalEl = document.getElementById('eventDetailsModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Attach focus handler once to avoid aria-hidden warning on close
    if (!modalListenerAttached) {
        modalEl.addEventListener('hide.bs.modal', () => {
            // Return focus to the element that opened the modal
            if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                lastFocusedElement.focus();
            }
        });
        modalListenerAttached = true;
    }

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
 * Handle locale change - re-fetch events with new locale
 */
function onLocaleChange() {
    const localeSelect = document.getElementById('localeFilter');
    if (localeSelect) {
        selectedLocale = localeSelect.value;
        fetchTemporaleEvents();
    }
}

/**
 * Initialize the temporale viewer
 */
async function init() {
    // First fetch available locales, then fetch events
    await fetchAvailableLocales();
    await fetchTemporaleEvents();

    // Event delegation for view details buttons (more efficient than per-button listeners)
    const tbody = document.getElementById('temporaleTableBody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-details-btn');
            if (btn) {
                showEventDetails(btn.dataset.eventKey);
            }
        });
    }

    // Locale change listener - re-fetches events
    const localeSelect = document.getElementById('localeFilter');
    if (localeSelect) {
        localeSelect.addEventListener('change', onLocaleChange);
    }

    // Attach filter event listeners (client-side filtering)
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

    // Modal navigation buttons
    const firstBtn = document.getElementById('firstEventBtn');
    const prevBtn = document.getElementById('prevEventBtn');
    const nextBtn = document.getElementById('nextEventBtn');
    const lastBtn = document.getElementById('lastEventBtn');
    if (firstBtn) {
        firstBtn.addEventListener('click', showFirstEvent);
    }
    if (prevBtn) {
        prevBtn.addEventListener('click', showPreviousEvent);
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', showNextEvent);
    }
    if (lastBtn) {
        lastBtn.addEventListener('click', showLastEvent);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
