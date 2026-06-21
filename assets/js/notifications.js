/**
 * Notifications Module
 *
 * Renders the navbar notification bell.
 *
 * Two modes, decided at init() based on Auth.hasRole('admin'):
 *   - admin: polls /admin/notifications, shows pending review queue
 *           (role_request | access_request | application items).
 *           Badge = data.total (pending count).
 *   - user:  polls /auth/notifications, shows reviewed-access events
 *           (access_request_reviewed items). Badge = data.unread_count.
 *           POSTs /auth/notifications/seen when dropdown opens, to clear
 *           the unread badge.
 *
 * @module Notifications
 */
const Notifications = {
    _pollInterval: 5 * 60 * 1000,
    _intervalId: null,
    _cachedData: null,

    /**
     * 'admin' | 'user' — fixed at init(). Drives endpoint, badge field,
     * render branch, and whether to POST /seen on dropdown open.
     * @private
     */
    _mode: null,

    /**
     * Role display names for admin-mode rendering. Also reused for
     * user-mode rendering of requested_role labels.
     * @private
     */
    _roleNames: {
        'developer': 'Developer',
        'calendar_editor': 'Calendar Editor',
        'test_editor': 'Accuracy Test Editor'
    },

    _initialized: false,

    /**
     * Initialize the notification bell for the current authenticated user.
     * Caller is responsible for ensuring Auth is ready and the user is
     * authenticated; this method picks the mode based on Auth.hasRole('admin').
     */
    init() {
        if (this._initialized) {
            return;
        }
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
            return;
        }

        this._mode = Auth.hasRole('admin') ? 'admin' : 'user';
        this._initialized = true;
        console.log(`Notifications: Initializing in ${this._mode} mode`);

        // Container should already be visible from PHP for any authenticated
        // user, but force it here in case auth state changed after page load.
        const container = document.getElementById('notificationsContainer');
        if (container) {
            container.classList.remove('d-none');
        }

        this._startNotificationServices();
    },

    _startNotificationServices() {
        this.fetchNotifications();
        this.startPolling();

        const dropdownEl = document.getElementById('notificationsDropdown');
        if (dropdownEl) {
            dropdownEl.addEventListener('shown.bs.dropdown', () => {
                this.fetchNotifications();
                if (this._mode === 'user') {
                    this.markSeen();
                }
            });
        }
    },

    startPolling() {
        if (this._intervalId !== null) {
            return;
        }
        this._intervalId = setInterval(() => {
            this.fetchNotifications();
        }, this._pollInterval);
    },

    stopPolling() {
        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    },

    async fetchNotifications() {
        if (typeof BaseUrl === 'undefined' || !BaseUrl) {
            console.error('Notifications: BaseUrl is not defined');
            this.showEmpty();
            return;
        }
        if (this._mode === null) {
            return;
        }

        const endpoint = this._mode === 'admin'
            ? `${BaseUrl}/admin/notifications`
            : `${BaseUrl}/auth/notifications`;

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
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

            if (this._mode === 'user') {
                const status = await this._fetchOnboardingStatus();
                if (status.needs_access_request) {
                    data.items = [{ type: 'onboarding_invite' }, ...(data.items || [])];
                    data.unread_count = (data.unread_count || 0) + 1;
                }
            }

            this._cachedData = data;
            this.updateUI(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            this.showEmpty();
        }
    },

    /**
     * Fetch the user's access-request status to decide whether to surface
     * the synthetic onboarding-invite entry. Fail-safe: on any error,
     * return `{needs_access_request: false}` so the bell still renders
     * real notifications without the synthetic item.
     * @private
     */
    async _fetchOnboardingStatus() {
        const safeDefault = { needs_access_request: false };
        try {
            const response = await fetch(`${BaseUrl}/auth/access-requests/status`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                return safeDefault;
            }
            const payload = await response.json();
            if (payload === null
                || typeof payload !== 'object'
                || Array.isArray(payload)
                || typeof payload.needs_access_request !== 'boolean') {
                return safeDefault;
            }
            return payload;
        } catch (error) {
            console.warn('Notifications: onboarding status fetch failed', error);
            return safeDefault;
        }
    },

    /**
     * Mark the user's inbox as seen. User mode only; fire-and-forget — a
     * failure is reconciled by the next poll.
     */
    async markSeen() {
        if (this._mode !== 'user' || typeof BaseUrl === 'undefined' || !BaseUrl) {
            return;
        }
        try {
            const response = await fetch(`${BaseUrl}/auth/notifications/seen`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
            if (!response.ok) {
                console.warn('Notifications: mark-seen failed', response.status);
                return;
            }
            // Optimistically clear the badge; next poll confirms.
            this.updateBadge(0);
        } catch (error) {
            console.warn('Notifications: mark-seen network error', error);
        }
    },

    updateUI(data) {
        const count = this._mode === 'user'
            ? (data.unread_count || 0)
            : (data.total || 0);
        this.updateBadge(count);
        this.updateList(data.items || []);
    },

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

    updateList(items) {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        if (items.length === 0) {
            list.innerHTML = `
                <div class="dropdown-item text-muted text-center py-3">
                    <i class="fas fa-check-circle me-2 text-success"></i>
                    ${this._emptyText()}
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
     * Empty-state text, mode-aware: admin sees the pending-queue framing,
     * user sees an inbox framing.
     * @private
     */
    _emptyText() {
        return this._mode === 'user'
            ? this._getTranslation('noNotificationsUser', 'No new notifications')
            : this._getTranslation('noNotifications', 'No pending requests');
    },

    _renderNotificationItem(item) {
        if (item.type === 'onboarding_invite') {
            return this._renderOnboardingInvite();
        }
        if (item.type === 'access_request_reviewed') {
            return this._renderReviewedRequest(item);
        }

        const timeAgo = this._formatTimeAgo(item.created_at);
        const safeUrl = this._sanitizeUrl(item.url);

        if (item.type === 'role_request') {
            const roleName = this._roleNames[item.role] || item.role;
            const userName = this._escapeHtml(item.user_name || item.user_email || 'Unknown');
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

        if (item.type === 'access_request') {
            const roleName = this._roleNames[item.role] || item.role;
            const userName = this._escapeHtml(item.user_name || item.user_email || 'Unknown');
            return `
                <a class="dropdown-item py-2" href="${safeUrl}">
                    <div class="d-flex align-items-start">
                        <div class="flex-shrink-0">
                            <i class="fas fa-key text-warning me-2"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="small fw-bold">${userName}</div>
                            <div class="small text-muted">
                                ${this._getTranslation('requestedAccess', 'Requested access')}: ${this._escapeHtml(roleName)}
                            </div>
                            <div class="small text-muted">${timeAgo}</div>
                        </div>
                    </div>
                </a>
            `;
        }

        if (item.type === 'application') {
            const appName = this._escapeHtml(item.app_name || 'Unknown');
            const scopeLabel = item.requested_scope === 'write'
                ? this._getTranslation('scopeReadWrite', 'Read & Write')
                : this._getTranslation('scopeReadOnly', 'Read-only');
            return `
                <a class="dropdown-item py-2" href="${safeUrl}">
                    <div class="d-flex align-items-start">
                        <div class="flex-shrink-0">
                            <i class="fas fa-cube text-success me-2"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="small fw-bold">${appName}</div>
                            <div class="small text-muted">
                                ${this._getTranslation('newApplication', 'New application')}: ${this._escapeHtml(scopeLabel)}
                            </div>
                            <div class="small text-muted">${timeAgo}</div>
                        </div>
                    </div>
                </a>
            `;
        }

        // Default fallback for other notification types
        const displayName = this._escapeHtml(item.user_name || item.app_name || 'Unknown');
        return `
            <a class="dropdown-item py-2" href="${safeUrl}">
                <div class="small">${displayName}</div>
                <div class="small text-muted">${timeAgo}</div>
            </a>
        `;
    },

    /**
     * Render a user-mode `access_request_reviewed` notification.
     * @param {Object} item - { type, request_id, requested_role, status,
     *   review_notes, reviewed_at, permissions, unread }
     * @returns {string} HTML string
     * @private
     */
    _renderReviewedRequest(item) {
        const statusVisuals = {
            approved: {
                icon: 'fas fa-check-circle text-success',
                label: this._getTranslation('yourRequestApproved', 'Your request was approved')
            },
            rejected: {
                icon: 'fas fa-times-circle text-danger',
                label: this._getTranslation('yourRequestRejected', 'Your request was rejected')
            },
            revoked: {
                icon: 'fas fa-ban text-warning',
                label: this._getTranslation('yourRequestRevoked', 'Your access was revoked')
            }
        };
        let visuals = statusVisuals[item.status];
        if (!visuals) {
            console.warn(`Notifications: unknown status "${item.status}" for request ${item.request_id}; falling back to approved styling`);
            visuals = statusVisuals.approved;
        }

        const timeAgo = this._formatTimeAgo(item.reviewed_at);
        const requestId = String(item.request_id || '');
        const safeUrl = this._sanitizeUrl(`permission-requests.php#request-${encodeURIComponent(requestId)}`);
        const roleName = this._escapeHtml(this._roleNames[item.requested_role] || item.requested_role || '');
        const reviewNotesHtml = item.review_notes
            ? `<div class="small fst-italic text-muted">${this._escapeHtml(item.review_notes)}</div>`
            : '';
        const unreadClass = item.unread ? ' bg-light fw-semibold' : '';

        return `
            <a class="dropdown-item py-2${unreadClass}" href="${safeUrl}">
                <div class="d-flex align-items-start">
                    <div class="flex-shrink-0">
                        <i class="${visuals.icon} me-2"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="small fw-bold">${this._escapeHtml(visuals.label)}</div>
                        <div class="small text-muted">${roleName}</div>
                        ${reviewNotesHtml}
                        <div class="small text-muted">${timeAgo}</div>
                    </div>
                </div>
            </a>
        `;
    },


    /**
     * Render the synthetic onboarding-invite item shown when the user has
     * no roles, no pending requests, and no approved-but-unsynced requests
     * (server-derived `needs_access_request === true` from
     * `/auth/access-requests/status`). The entry self-clears once the user
     * submits a request — no mark-as-seen call.
     * @returns {string} HTML string
     * @private
     */
    _renderOnboardingInvite() {
        const safeUrl = this._sanitizeUrl('permission-requests.php');
        const label = this._escapeHtml(this._getTranslation('onboardingInvite', 'Request access to start using the system'));
        const cta = this._escapeHtml(this._getTranslation('onboardingInviteCta', 'Get started'));
        return `
            <a class="dropdown-item py-2 bg-light fw-semibold" href="${safeUrl}">
                <div class="d-flex align-items-start">
                    <div class="flex-shrink-0">
                        <i class="fas fa-user-plus text-info me-2"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="small fw-bold">${label}</div>
                        <div class="small text-primary">${cta} &rarr;</div>
                    </div>
                </div>
            </a>
        `;
    },

    showEmpty() {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        list.innerHTML = `
            <div class="dropdown-item text-muted text-center py-3">
                <i class="fas fa-check-circle me-2 text-success"></i>
                ${this._emptyText()}
            </div>
        `;
    },

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

    _formatTimeAgo(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // Under a minute: a simple localized "Just now" (no count to pluralize).
        if (diffMins < 1) {
            return this._getTranslation('justNow', 'Just now');
        }
        // A week or more: fall back to an absolute, locale-formatted date.
        if (diffDays >= 7) {
            return date.toLocaleDateString(this._localeTag());
        }

        // Locale-aware relative time. Intl.RelativeTimeFormat applies the correct
        // singular/plural/other forms and word order per CLDR for every locale, so
        // we no longer ship (and mis-translate) "min ago"/"hours ago" fragments.
        const rtf = this._relativeTimeFormatter();
        if (diffMins < 60) {
            return rtf.format(-diffMins, 'minute');
        }
        if (diffHours < 24) {
            return rtf.format(-diffHours, 'hour');
        }
        return rtf.format(-diffDays, 'day');
    },

    /**
     * BCP-47 locale tag for Intl formatting, taken from the page's <html lang>.
     * @private
     */
    _localeTag() {
        return ( document.documentElement.lang || '' ).trim() || 'en';
    },

    /**
     * Build an Intl.RelativeTimeFormat for the page locale, falling back to
     * English when the locale has no relative-time data (e.g. Latin) or the tag
     * is unusable.
     * @private
     */
    _relativeTimeFormatter() {
        try {
            return new Intl.RelativeTimeFormat([this._localeTag(), 'en'], { numeric: 'always' });
        } catch {
            return new Intl.RelativeTimeFormat('en', { numeric: 'always' });
        }
    },

    _getTranslation(key, fallback) {
        if (typeof NotificationTranslations !== 'undefined' && NotificationTranslations[key]) {
            return NotificationTranslations[key];
        }
        return fallback;
    },

    /**
     * Sanitize URL to prevent XSS via javascript:, data:, vbscript: schemes.
     * Only allows http, https, protocol-relative (//), and relative paths.
     * @private
     */
    _sanitizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '#';
        }

        const trimmed = url.trim();
        const normalized = trimmed.toLowerCase().replace(/\s+/g, '');
        const dangerousSchemes = ['javascript:', 'data:', 'vbscript:'];
        for (const scheme of dangerousSchemes) {
            if (normalized.startsWith(scheme)) {
                return '#';
            }
        }

        const isAbsolute = /^https?:\/\//i.test(trimmed);
        const isProtocolRelative = trimmed.startsWith('//');
        const isRelative = trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || !trimmed.includes(':');

        if (!isAbsolute && !isProtocolRelative && !isRelative) {
            return '#';
        }

        return this._escapeHtml(trimmed);
    },

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.addEventListener('beforeunload', () => {
    Notifications.stopPolling();
});

document.addEventListener('DOMContentLoaded', () => {
    // PHP marks the bell visible for any authenticated user, but we still
    // need Auth to be ready before we know admin-vs-user. Retry with
    // exponential backoff to absorb variable Auth init timing.
    const waitForAuth = (retries = 5, delay = 100) => {
        if (typeof Auth !== 'undefined' && Auth.isAuthenticated()) {
            Notifications.init();
        } else if (retries > 0) {
            setTimeout(() => waitForAuth(retries - 1, delay * 2), delay);
        }
    };
    waitForAuth();
});

document.addEventListener('authStateChange', (event) => {
    if (event.detail && event.detail.authenticated) {
        Notifications.init();
    } else {
        Notifications.stopPolling();
        Notifications._initialized = false;
        Notifications._mode = null;
    }
});
