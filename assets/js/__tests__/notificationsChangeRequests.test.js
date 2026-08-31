/**
 * Unit tests for the two defects in issue #505.
 *
 *   1. Change-request notifications had no renderer, so they fell through to the
 *      default branch and rendered literally as **"Unknown"** with a dead `'#'`
 *      link — and that branch also read `item.created_at`, which neither
 *      change-request type has (they carry `settled_at` and `reviewed_at`).
 *
 *   2. In admin mode the bell polled `/admin/notifications` EXCLUSIVELY. That
 *      feed carries pending access-request counts and no change-request items at
 *      all, so every global and resource admin — precisely the people whose own
 *      batches are auto-approved — could never see one. `markSeen()` was likewise
 *      user-mode only, so their unread bookmark never advanced.
 *
 * `notifications.js` is a classic script that defines a global `const`, so it is
 * evaluated here from source, the way the browser loads it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SOURCE = readFileSync(resolve(process.cwd(), 'assets/js/notifications.js'), 'utf8');

/**
 * Evaluate the script and hand back its `Notifications` object.
 *
 * The trailing `window.addEventListener` / `document.addEventListener`
 * registrations at the bottom of the file run too; they are harmless here
 * because nothing dispatches those events in these tests.
 */
function loadNotifications({ baseUrl = 'https://api.example.test', repoUrl = '' } = {}) {
    const factory = new Function(
        'BaseUrl',
        'SourceDataRepoUrl',
        'Auth',
        'NotificationTranslations',
        `${SOURCE}\nreturn Notifications;`
    );
    return factory(
        baseUrl,
        repoUrl,
        { isAuthenticated: () => true, hasRole: () => false, isResourceAdmin: async () => false },
        undefined
    );
}

/** The bell's DOM: badge plus list container. */
function mountBell() {
    document.body.innerHTML = `
        <div id="notificationsContainer"></div>
        <a id="notificationsDropdown"></a>
        <span id="notificationsBadge" class="d-none">0</span>
        <div id="notificationsList"></div>
    `;
}

const reviewedItem = (overrides = {}) => ({
    type: 'change_request_reviewed',
    batch_id: '11111111-2222-3333-4444-555555555555',
    resource_type: 'national_calendar',
    resource_id: 'roman/US',
    review_status: 'approved',
    rejected_reason: null,
    reviewed_at: new Date(Date.now() - 3600_000).toISOString(),
    unread: true,
    ...overrides
});

const publishedItem = (overrides = {}) => ({
    type: 'change_request_published',
    batch_id: '66666666-7777-8888-9999-000000000000',
    resource_type: 'diocesan_calendar',
    resource_id: 'ambrosian/lugano_ch',
    publication_status: 'merged',
    pr_number: 1234,
    settled_at: new Date(Date.now() - 7200_000).toISOString(),
    unread: false,
    ...overrides
});

beforeEach(() => {
    mountBell();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('change-request notification renderers', () => {
    it('renders a reviewed batch with its decision, not "Unknown"', () => {
        const Notifications = loadNotifications();
        const html = Notifications._renderNotificationItem(reviewedItem());

        expect(html).not.toContain('Unknown');
        expect(html).toContain('Your change request was approved');
        // resource_id is rite-qualified; the bare calendar id is what a reader wants.
        expect(html).toContain('US');
        expect(html).toContain('change-requests.php#batch-11111111-2222-3333-4444-555555555555');
        // unread items are visually distinguished
        expect(html).toContain('bg-light fw-semibold');
    });

    it('reads reviewed_at, not created_at, for a reviewed batch', () => {
        const Notifications = loadNotifications();
        const spy = vi.spyOn(Notifications, '_formatTimeAgo');
        const item = reviewedItem();

        Notifications._renderNotificationItem(item);

        expect(spy).toHaveBeenCalledWith(item.reviewed_at);
    });

    it('shows the reviewer’s reason on a rejection', () => {
        const Notifications = loadNotifications();
        const html = Notifications._renderNotificationItem(reviewedItem({
            review_status: 'rejected',
            rejected_reason: 'The locale file is missing.'
        }));

        expect(html).toContain('Your change request was rejected');
        expect(html).toContain('The locale file is missing.');
    });

    it('renders a published batch and reads settled_at, not created_at', () => {
        const Notifications = loadNotifications();
        const spy = vi.spyOn(Notifications, '_formatTimeAgo');
        const item = publishedItem();

        const html = Notifications._renderNotificationItem(item);

        expect(spy).toHaveBeenCalledWith(item.settled_at);
        expect(html).toContain('Your change request was published');
        expect(html).toContain('lugano_ch');
        expect(html).not.toContain('Unknown');
    });

    it('distinguishes a batch closed without merging from one that merged', () => {
        const Notifications = loadNotifications();
        const html = Notifications._renderNotificationItem(publishedItem({ publication_status: 'closed' }));

        expect(html).toContain('Your change request was closed without merging');
    });

    it('links the pull request only when the deployment names the repository', () => {
        const withRepo = loadNotifications({ repoUrl: 'https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI' });
        expect(withRepo._renderNotificationItem(publishedItem()))
            .toContain('https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/pull/1234');

        // Without it, the number is still reported — but unlinked, because a wrong
        // link is worse than none.
        const withoutRepo = loadNotifications();
        const html = withoutRepo._renderNotificationItem(publishedItem());
        expect(html).toContain('Pull request #1234');
        expect(html).not.toContain('href="https://github.com');
    });

    it('handles a bare (non rite-qualified) resource id', () => {
        const Notifications = loadNotifications();
        const html = Notifications._renderNotificationItem(publishedItem({
            resource_type: 'general_roman_calendar',
            resource_id: 'decrees'
        }));

        expect(html).toContain('decrees');
    });
});

describe('admin-mode notification feed', () => {
    /** Stub fetch to answer each of the two feeds. */
    function stubFeeds({ admin, user }) {
        const fetchMock = vi.fn(async (url) => {
            if (String(url).includes('/admin/notifications')) {
                return { ok: true, status: 200, json: async () => admin };
            }
            if (String(url).includes('/auth/notifications')) {
                return { ok: true, status: 200, json: async () => user };
            }
            throw new Error(`Unexpected request: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    const adminFeed = {
        pending_access_requests: 2,
        total: 2,
        items: [
            { type: 'access_request', id: 'r1', user_name: 'Ada', role: 'calendar_editor', created_at: new Date().toISOString(), url: 'admin-permissions.php' }
        ]
    };

    const userFeed = {
        items: [publishedItem(), reviewedItem()],
        total: 2,
        unread_count: 1,
        last_seen_at: new Date(0).toISOString()
    };

    it('MERGES both feeds in admin mode instead of replacing the personal inbox', async () => {
        const fetchMock = stubFeeds({ admin: adminFeed, user: userFeed });
        const Notifications = loadNotifications();
        Notifications._mode = 'admin';

        await Notifications.fetchNotifications();

        const requested = fetchMock.mock.calls.map(([url]) => String(url));
        expect(requested.some(u => u.includes('/admin/notifications'))).toBe(true);
        expect(requested.some(u => u.includes('/auth/notifications'))).toBe(true);

        const rendered = document.getElementById('notificationsList').innerHTML;
        // The admin's own change-request notifications now reach them.
        expect(rendered).toContain('Your change request was published');
        expect(rendered).toContain('Your change request was approved');
        // …without losing the review queue.
        expect(rendered).toContain('Ada');
        expect(rendered).not.toContain('Unknown');
    });

    it('adds the two counts for the admin badge', async () => {
        stubFeeds({ admin: adminFeed, user: userFeed });
        const Notifications = loadNotifications();
        Notifications._mode = 'admin';

        await Notifications.fetchNotifications();

        // 2 pending review items + 1 unread personal item
        expect(document.getElementById('notificationsBadge').textContent).toBe('3');
    });

    it('degrades to the personal inbox when the admin feed is unavailable', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchMock = vi.fn(async (url) => {
            if (String(url).includes('/admin/notifications')) {
                return { ok: false, status: 403, text: async () => 'forbidden' };
            }
            return { ok: true, status: 200, json: async () => userFeed };
        });
        vi.stubGlobal('fetch', fetchMock);

        const Notifications = loadNotifications();
        Notifications._mode = 'admin';

        await Notifications.fetchNotifications();

        expect(document.getElementById('notificationsList').innerHTML)
            .toContain('Your change request was published');
        expect(document.getElementById('notificationsBadge').textContent).toBe('1');
    });

    it('does not poll the admin feed in user mode', async () => {
        const fetchMock = vi.fn(async (url) => {
            if (String(url).includes('/auth/access-requests/status')) {
                return { ok: true, status: 200, json: async () => ({ needs_access_request: false }) };
            }
            return { ok: true, status: 200, json: async () => userFeed };
        });
        vi.stubGlobal('fetch', fetchMock);

        const Notifications = loadNotifications();
        Notifications._mode = 'user';

        await Notifications.fetchNotifications();

        expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/admin/notifications'))).toBe(true);
    });
});

describe('markSeen', () => {
    it('runs in admin mode and leaves the pending-review count on the badge', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, seen_at: '2026-08-31T00:00:00+00:00' }) }));
        vi.stubGlobal('fetch', fetchMock);

        const Notifications = loadNotifications();
        Notifications._mode = 'admin';
        Notifications._adminPendingTotal = 4;
        Notifications.updateBadge(7);

        await Notifications.markSeen();

        // The one seen endpoint the API has, in both modes.
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/auth/notifications/seen');
        // A queue of undecided access requests is not "seen away", so 4 remains.
        expect(document.getElementById('notificationsBadge').textContent).toBe('4');
    });

    it('clears the badge entirely in user mode', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, seen_at: '2026-08-31T00:00:00+00:00' }) }));
        vi.stubGlobal('fetch', fetchMock);

        const Notifications = loadNotifications();
        Notifications._mode = 'user';
        Notifications.updateBadge(3);

        await Notifications.markSeen();

        expect(document.getElementById('notificationsBadge').classList.contains('d-none')).toBe(true);
    });
});
