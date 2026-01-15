/**
 * Admin Notifications Module
 *
 * Handles fetching and displaying admin notifications in the navbar.
 * Only active for users with the 'admin' role.
 *
 * @module Notifications
 */
const Notifications = {
    /**
     * Polling interval in milliseconds (5 minutes)
     * @private
     */
    _pollInterval: 5 * 60 * 1000,

    /**
     * Interval ID for polling
     * @private
     */
    _intervalId: null,

    /**
     * Cached notification data
     * @private
     */
    _cachedData: null,

    /**
     * Role display names
     * @private
     */
    _roleNames: {
        'developer': 'Developer',
        'calendar_editor': 'Calendar Editor',
        'test_editor': 'Accuracy Test Editor'
    },

    /**
     * Flag to prevent double initialization
     * @private
     */
    _initialized: false,

    /**
     * Initialize as admin (skip Auth.hasRole check)
     * Used when PHP has already verified admin status
     * @private
     */
    _initAsAdmin() {
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        console.log('Notifications: Initializing (admin verified by PHP)');
        this._startNotificationServices();
    },

    /**
     * Initialize notifications module
     * Call this after Auth has initialized
     */
    init() {
        // Prevent double initialization
        if (this._initialized) {
            return;
        }

        // Only initialize for admin users
        if (!Auth.hasRole('admin')) {
            console.log('Notifications: User is not admin, skipping initialization');
            return;
        }

        this._initialized = true;
        console.log('Notifications: Initializing for admin user');

        // Show the notifications container
        const container = document.getElementById('notificationsContainer');
        if (container) {
            container.classList.remove('d-none');
        }

        this._startNotificationServices();
    },

    /**
     * Start notification fetching and polling services
     * @private
     */
    _startNotificationServices() {
        // Fetch notifications immediately
        this.fetchNotifications();

        // Start polling
        this.startPolling();

        // Refresh on dropdown open (use Bootstrap 5 event)
        const dropdownEl = document.getElementById('notificationsDropdown');
        if (dropdownEl) {
            dropdownEl.addEventListener('shown.bs.dropdown', () => {
                this.fetchNotifications();
            });
        }
    },

    /**
     * Start polling for new notifications
     */
    startPolling() {
        if (this._intervalId !== null) {
            return;
        }

        this._intervalId = setInterval(() => {
            if (Auth.hasRole('admin')) {
                this.fetchNotifications();
            }
        }, this._pollInterval);
    },

    /**
     * Stop polling
     */
    stopPolling() {
        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    },

    /**
     * Fetch notifications from the API
     */
    async fetchNotifications() {
        console.log('Notifications: Fetching notifications...');

        if (typeof BaseUrl === 'undefined' || !BaseUrl) {
            console.error('Notifications: BaseUrl is not defined');
            this.showEmpty();
            return;
        }

        try {
            const response = await fetch(`${BaseUrl}/admin/notifications`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('Notifications: Response status:', response.status);

            if (!response.ok) {
                // Try to get error details but don't fail if we can't
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch {
                    errorText = 'Could not read error response';
                }
                console.error('Notifications API error:', response.status, errorText);
                this.showEmpty();
                return;
            }

            const data = await response.json();
            console.log('Notifications: Received data:', data);
            this._cachedData = data;
            this.updateUI(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            // Show empty state instead of error for better UX
            this.showEmpty();
        }
    },

    /**
     * Update the UI with notification data
     * @param {Object} data - Notification data from API
     */
    updateUI(data) {
        this.updateBadge(data.total || 0);
        this.updateList(data.items || []);
    },

    /**
     * Update the notification badge count
     * @param {number} count - Total notification count
     */
    updateBadge(count) {
        const badge = document.getElementById('notificationsBadge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    },

    /**
     * Update the notifications list dropdown
     * @param {Array} items - Array of notification items
     */
    updateList(items) {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        if (items.length === 0) {
            list.innerHTML = `
                <div class="dropdown-item text-muted text-center py-3">
                    <i class="fas fa-check-circle me-2 text-success"></i>
                    ${this._getTranslation('noNotifications', 'No pending requests')}
                </div>
            `;
            return;
        }

        let html = '';
        for (const item of items) {
            html += this._renderNotificationItem(item);
        }
        list.innerHTML = html;
    },

    /**
     * Render a single notification item
     * @param {Object} item - Notification item
     * @returns {string} HTML string
     * @private
     */
    _renderNotificationItem(item) {
        const roleName = this._roleNames[item.role] || item.role;
        const userName = this._escapeHtml(item.user_name || item.user_email || 'Unknown');
        const timeAgo = this._formatTimeAgo(item.created_at);
        const safeUrl = this._sanitizeUrl(item.url);

        if (item.type === 'role_request') {
            return `
                <a class="dropdown-item py-2" href="${safeUrl}">
                    <div class="d-flex align-items-start">
                        <div class="flex-shrink-0">
                            <i class="fas fa-user-plus text-primary me-2"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="small fw-bold">${userName}</div>
                            <div class="small text-muted">
                                ${this._getTranslation('requestedRole', 'Requested')}: ${this._escapeHtml(roleName)}
                            </div>
                            <div class="small text-muted">${timeAgo}</div>
                        </div>
                    </div>
                </a>
            `;
        }

        // Default fallback for other notification types
        return `
            <a class="dropdown-item py-2" href="${safeUrl}">
                <div class="small">${userName}</div>
                <div class="small text-muted">${timeAgo}</div>
            </a>
        `;
    },

    /**
     * Show empty state in the dropdown (no pending notifications)
     * @private
     */
    showEmpty() {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        list.innerHTML = `
            <div class="dropdown-item text-muted text-center py-3">
                <i class="fas fa-check-circle me-2 text-success"></i>
                ${this._getTranslation('noNotifications', 'No pending requests')}
            </div>
        `;
    },

    /**
     * Show error state in the dropdown
     * @private
     */
    showError() {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        list.innerHTML = `
            <div class="dropdown-item text-muted text-center py-3">
                <i class="fas fa-exclamation-triangle me-2 text-warning"></i>
                ${this._getTranslation('loadError', 'Could not load notifications')}
            </div>
        `;
    },

    /**
     * Format a timestamp as relative time
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Relative time string
     * @private
     */
    _formatTimeAgo(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return this._getTranslation('justNow', 'Just now');
        } else if (diffMins < 60) {
            const key = diffMins === 1 ? 'minuteAgo' : 'minutesAgo';
            const fallback = diffMins === 1 ? 'min ago' : 'mins ago';
            return `${diffMins} ${this._getTranslation(key, fallback)}`;
        } else if (diffHours < 24) {
            const key = diffHours === 1 ? 'hourAgo' : 'hoursAgo';
            const fallback = diffHours === 1 ? 'hour ago' : 'hours ago';
            return `${diffHours} ${this._getTranslation(key, fallback)}`;
        } else if (diffDays < 7) {
            const key = diffDays === 1 ? 'dayAgo' : 'daysAgo';
            const fallback = diffDays === 1 ? 'day ago' : 'days ago';
            return `${diffDays} ${this._getTranslation(key, fallback)}`;
        } else {
            return date.toLocaleDateString();
        }
    },

    /**
     * Get translation string (with fallback)
     * @param {string} key - Translation key
     * @param {string} fallback - Fallback string
     * @returns {string} Translated string or fallback
     * @private
     */
    _getTranslation(key, fallback) {
        // Check if translations object exists (set via PHP)
        if (typeof NotificationTranslations !== 'undefined' && NotificationTranslations[key]) {
            return NotificationTranslations[key];
        }
        return fallback;
    },

    /**
     * Sanitize URL to prevent XSS via javascript:, data:, vbscript: schemes
     * Only allows http, https, protocol-relative (//), and relative paths
     * @param {string} url - URL to sanitize
     * @returns {string} Sanitized URL safe for href attribute
     * @private
     */
    _sanitizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '#';
        }

        // Trim and normalize
        const trimmed = url.trim();

        // Block dangerous schemes (case-insensitive, ignore whitespace)
        const normalized = trimmed.toLowerCase().replace(/\s+/g, '');
        const dangerousSchemes = ['javascript:', 'data:', 'vbscript:'];
        for (const scheme of dangerousSchemes) {
            if (normalized.startsWith(scheme)) {
                return '#';
            }
        }

        // Allow only safe schemes: http://, https://, protocol-relative (//), or relative paths
        const isAbsolute = /^https?:\/\//i.test(trimmed);
        const isProtocolRelative = trimmed.startsWith('//');
        const isRelative = trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || !trimmed.includes(':');

        if (!isAbsolute && !isProtocolRelative && !isRelative) {
            return '#';
        }

        // HTML-escape the URL to prevent attribute injection
        return this._escapeHtml(trimmed);
    },

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Clean up polling on page unload
window.addEventListener('beforeunload', () => {
    Notifications.stopPolling();
});

// Initialize after Auth is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if notifications container exists and is visible (PHP determined user is admin)
    const container = document.getElementById('notificationsContainer');
    const isVisibleFromPhp = container && !container.classList.contains('d-none');

    // If PHP already determined user is admin, initialize immediately
    if (isVisibleFromPhp) {
        console.log('Notifications: Container visible from PHP, initializing...');
        // Force initialization since PHP already verified admin status
        Notifications._initialized = false; // Reset in case of reload
        Notifications._initAsAdmin();
        return;
    }

    // Otherwise, wait for Auth to initialize and check auth state
    // Use exponential backoff retry to handle variable Auth initialization times
    const waitForAuth = (retries = 5, delay = 100) => {
        if (typeof Auth !== 'undefined' && Auth.isAuthenticated()) {
            if (Auth.hasRole('admin')) {
                Notifications.init();
            }
        } else if (retries > 0) {
            setTimeout(() => waitForAuth(retries - 1, delay * 2), delay);
        }
    };
    waitForAuth();
});

// Also listen for auth state changes (if user logs in after page load)
document.addEventListener('authStateChange', (event) => {
    if (event.detail && event.detail.authenticated && Auth.hasRole('admin')) {
        Notifications.init();
    } else {
        Notifications.stopPolling();
    }
});
