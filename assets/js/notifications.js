/**
 * Notifications Module
 *
 * Renders the navbar notification bell.
 *
 * Two modes, decided at init() based on Auth.hasRole('admin') or
 * Auth.isResourceAdmin():
 *   - user:  polls /auth/notifications — the caller's personal inbox
 *           (access_request_reviewed | change_request_reviewed |
 *           change_request_published items). Badge = data.unread_count.
 *   - admin: polls BOTH /admin/notifications (the pending review queue of
 *           role_request | access_request | application items) AND
 *           /auth/notifications, and MERGES them. An admin is also a user:
 *           gaining a role does not stop their own access requests being
 *           reviewed or their own change requests being published, and
 *           /admin/notifications carries neither. Badge = admin pending total
 *           + personal unread count.
 *
 * Both modes POST /auth/notifications/seen when the dropdown opens. That is the
 * only seen endpoint there is — /admin/notifications has none, because its
 * "unread" count is simply how many items are still pending review and clears
 * itself when they are decided. So in admin mode marking seen advances the
 * personal bookmark and the badge falls back to the admin pending total rather
 * than to zero.
 *
 * @module Notifications
 */
const Notifications = {
    _pollInterval: 5 * 60 * 1000,
    _intervalId: null,
    _cachedData: null,

    /**
     * Last known count of items pending review from /admin/notifications.
     * Kept separately because marking the personal inbox seen must not zero it —
     * a queue of undecided access requests is not "seen away".
     * @private
     */
    _adminPendingTotal: 0,

    /**
     * 'admin' | 'user' — fixed at init(). Drives which endpoints are polled and
     * how the badge count is composed.
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
     * authenticated; this method picks the mode based on Auth.hasRole('admin')
     * or Auth.isResourceAdmin() (resource-admins see the scoped review queue).
     */
    async init() {
        if (this._initialized) {
            return;
        }
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
            return;
        }
        this._initialized = true;

        // Global admins use the review queue; resource-admins do too, but the
        // API scopes /admin/notifications to the resources they administer.
        const isAdmin = Auth.hasRole('admin') || await Auth.isResourceAdmin();
        this._mode = isAdmin ? 'admin' : 'user';
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
            dropdownEl.addEventListener('shown.bs.dropdown', async () => {
                // Awaited, not fired alongside markSeen(). Both settle by writing the
                // badge — markSeen() optimistically, fetchNotifications() from the
                // server — so unsequenced they race, and a markSeen() that wins leaves
                // the later fetch re-rendering the pre-seen count: the badge clears and
                // then flicks back to unread.
                //
                // Fetch first, mark seen after, so the items are still rendered as
                // unread when the reviewer opens the dropdown. Marking seen first would
                // be deterministic too, but it would show them already read.
                await this.fetchNotifications();
                // Both modes: an admin has a personal inbox too, and its unread
                // bookmark would otherwise never advance for them.
                await this.markSeen();
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

        try {
            // In admin mode both feeds are polled and merged. They are fetched
            // concurrently and settled independently: one feed being unavailable
            // must not blank the other, since they answer different questions.
            const [adminData, userData] = this._mode === 'admin'
                ? await Promise.all([this._fetchAdminFeed(), this._fetchUserFeed()])
                : [null, await this._fetchUserFeed()];

            if (adminData === null && userData === null) {
                this.showEmpty();
                return;
            }

            this._adminPendingTotal = adminData ? ( adminData.total || 0 ) : 0;

            const data = {
                // Items still awaiting the admin's decision come first: they are
                // the only ones the viewer can act on. The personal inbox follows.
                items: [...( adminData?.items || [] ), ...( userData?.items || [] )],
                unread_count: userData ? ( userData.unread_count || 0 ) : 0,
                total: this._adminPendingTotal
            };

            this._cachedData = data;
            this.updateUI(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            this.showEmpty();
        }
    },

    /**
     * Fetch the admin review queue. Returns null (rather than throwing) when the
     * feed is unavailable, so a failure there degrades to "personal inbox only"
     * instead of blanking the bell.
     * @private
     */
    async _fetchAdminFeed() {
        return this._fetchFeed(`${BaseUrl}/admin/notifications`);
    },

    /**
     * Fetch the caller's personal inbox, augmented with the synthetic
     * onboarding-invite entry when the server says they still need to request
     * access. The invite is user-mode only: an admin or resource admin by
     * definition already holds access, so it would be one wasted request per poll.
     * @private
     */
    async _fetchUserFeed() {
        const data = await this._fetchFeed(`${BaseUrl}/auth/notifications`);
        if (data === null || this._mode !== 'user') {
            return data;
        }

        const status = await this._fetchOnboardingStatus();
        if (status.needs_access_request) {
            data.items = [{ type: 'onboarding_invite' }, ...( data.items || [] )];
            data.unread_count = ( data.unread_count || 0 ) + 1;
        }
        return data;
    },

    /**
     * GET one notifications endpoint. Returns the parsed body, or null on any
     * non-OK response or network failure (both already logged).
     * @private
     */
    async _fetchFeed(endpoint) {
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
                console.error('Notifications API error:', endpoint, response.status, errorText);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch notifications:', endpoint, error);
            return null;
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
     * Mark the caller's personal inbox as seen. Fire-and-forget — a failure is
     * reconciled by the next poll.
     *
     * Runs in BOTH modes. `/auth/notifications/seen` is the only seen endpoint
     * the API has, and it is the right one in admin mode too: it advances the
     * bookmark on the personal inbox, which an admin has like anybody else. The
     * admin review queue has no bookmark to advance — its count is how many items
     * are still undecided — so the badge falls back to that count rather than to
     * zero.
     */
    async markSeen() {
        if (typeof BaseUrl === 'undefined' || !BaseUrl) {
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
            // Optimistically clear the personal-inbox portion of the badge; the
            // admin review queue is untouched by a seen bookmark. Next poll confirms.
            this.updateBadge(this._mode === 'admin' ? this._adminPendingTotal : 0);
        } catch (error) {
            console.warn('Notifications: mark-seen network error', error);
        }
    },

    updateUI(data) {
        // In admin mode the badge is the sum of the two feeds: items awaiting the
        // admin's decision, plus unread items in their own inbox.
        const count = this._mode === 'admin'
            ? ( data.total || 0 ) + ( data.unread_count || 0 )
            : ( data.unread_count || 0 );
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
        if (item.type === 'change_request_reviewed') {
            return this._renderChangeRequestReviewed(item);
        }
        if (item.type === 'change_request_published') {
            return this._renderChangeRequestPublished(item);
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
     * The resource a change-request notification concerns, as a display string.
     *
     * `resource_id` is rite-qualified (`roman/US`, `roman/decrees`) for the
     * calendar-naming types and for `rite_calendar` (API #955), and bare for the
     * rest — `rite_calendar_test`, whose id IS the rite, and the deprecated
     * `general_roman_calendar` / `general_roman_calendar_test`, which the API
     * still emits — so the slash must not be assumed.
     * @private
     */
    _changeResourceLabel(item) {
        const resourceId = typeof item.resource_id === 'string' ? item.resource_id : '';
        const slash = resourceId.indexOf('/');
        return slash === -1 ? resourceId : resourceId.slice(slash + 1);
    },

    /**
     * Link to the batch on the submitter's own change-request page. That page
     * scrolls to and highlights `#batch-<uuid>`.
     * @private
     */
    _changeBatchUrl(item) {
        const batchId = String(item.batch_id || '');
        return this._sanitizeUrl(`change-requests.php#batch-${encodeURIComponent(batchId)}`);
    },

    /**
     * A pull-request link, when the batch has a number AND the deployment names
     * the source-data repository. Without the repository the number is shown
     * unlinked: a wrong link is worse than none.
     * @private
     */
    _pullRequestHtml(prNumber) {
        if (typeof prNumber !== 'number') {
            return '';
        }
        const label = this._getTranslation('changeRequestPullRequest', 'Pull request #%1$d')
            .replace('%1$d', String(prNumber));
        const repoUrl = typeof SourceDataRepoUrl !== 'undefined' ? SourceDataRepoUrl : '';
        if (!repoUrl) {
            return `<div class="small text-muted">${this._escapeHtml(label)}</div>`;
        }
        const href = this._sanitizeUrl(`${repoUrl}/pull/${prNumber}`);
        return `<div class="small"><a href="${href}" target="_blank" rel="noopener">${this._escapeHtml(label)}</a></div>`;
    },

    /**
     * Render a `change_request_reviewed` item — a human decided one of the
     * caller's own change request batches.
     *
     * `review_status` here is the frozen `review_decision`, not the batch's
     * current status, so `approved` here always means "a reviewer approved it".
     * Whether it then published is reported separately, by a
     * `change_request_published` item carrying the same `batch_id`.
     *
     * @param {Object} item - { type, batch_id, resource_type, resource_id,
     *   review_status, rejected_reason, reviewed_at, unread }
     * @returns {string} HTML string
     * @private
     */
    _renderChangeRequestReviewed(item) {
        const visuals = item.review_status === 'rejected'
            ? {
                icon: 'fas fa-times-circle text-danger',
                label: this._getTranslation('changeRequestRejected', 'Your change request was rejected')
            }
            : {
                icon: 'fas fa-check-circle text-success',
                label: this._getTranslation('changeRequestApproved', 'Your change request was approved')
            };

        // reviewed_at, NOT created_at: this type has no created_at, and reading one
        // is exactly the bug that made these items render a blank timestamp.
        const timeAgo = this._formatTimeAgo(item.reviewed_at);
        const reasonHtml = item.rejected_reason
            ? `<div class="small fst-italic text-muted">${this._escapeHtml(item.rejected_reason)}</div>`
            : '';
        const unreadClass = item.unread ? ' bg-light fw-semibold' : '';

        return `
            <a class="dropdown-item py-2${unreadClass}" href="${this._changeBatchUrl(item)}">
                <div class="d-flex align-items-start">
                    <div class="flex-shrink-0">
                        <i class="${visuals.icon} me-2"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="small fw-bold">${this._escapeHtml(visuals.label)}</div>
                        <div class="small text-muted"><code>${this._escapeHtml(this._changeResourceLabel(item))}</code></div>
                        ${reasonHtml}
                        <div class="small text-muted">${timeAgo}</div>
                    </div>
                </div>
            </a>
        `;
    },

    /**
     * Render a `change_request_published` item — one of the caller's own batches
     * settled on GitHub. Only `merged` and `closed` ever reach the inbox; an open
     * pull request is not news yet.
     *
     * @param {Object} item - { type, batch_id, resource_type, resource_id,
     *   publication_status, pr_number, settled_at, unread }
     * @returns {string} HTML string
     * @private
     */
    _renderChangeRequestPublished(item) {
        const visuals = item.publication_status === 'closed'
            ? {
                icon: 'fas fa-circle-xmark text-secondary',
                label: this._getTranslation('changeRequestClosed', 'Your change request was closed without merging')
            }
            : {
                icon: 'fas fa-code-merge text-success',
                label: this._getTranslation('changeRequestMerged', 'Your change request was published')
            };

        // settled_at, NOT created_at — the timestamp this type is ordered and
        // unread-flagged by.
        const timeAgo = this._formatTimeAgo(item.settled_at);
        const unreadClass = item.unread ? ' bg-light fw-semibold' : '';

        return `
            <a class="dropdown-item py-2${unreadClass}" href="${this._changeBatchUrl(item)}">
                <div class="d-flex align-items-start">
                    <div class="flex-shrink-0">
                        <i class="${visuals.icon} me-2"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="small fw-bold">${this._escapeHtml(visuals.label)}</div>
                        <div class="small text-muted"><code>${this._escapeHtml(this._changeResourceLabel(item))}</code></div>
                        ${this._pullRequestHtml(item.pr_number)}
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
        // Bail out on an unparseable timestamp so NaN diffs don't render as "NaN ...".
        if (!Number.isFinite(date.getTime())) {
            return '';
        }
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
            return this._formatAbsoluteDate(date);
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

    /**
     * Locale-formatted absolute date, falling back to the runtime default
     * locale if the page's lang tag is malformed (e.g. "en_US" instead of
     * "en-US"), which would otherwise make toLocaleDateString throw a RangeError.
     * @private
     */
    _formatAbsoluteDate(date) {
        try {
            return date.toLocaleDateString(this._localeTag());
        } catch {
            return date.toLocaleDateString();
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
