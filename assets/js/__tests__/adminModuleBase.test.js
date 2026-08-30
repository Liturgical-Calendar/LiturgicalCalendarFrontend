/**
 * Unit tests for the two things issue #504 identifies as correctness bugs in
 * `createAdminModule`, not merely as limitations:
 *
 *   1. **Pagination must loop on `has_more`, never on page emptiness.**
 *      `/admin/change-requests` filters each SQL page through OpenFGA AFTER
 *      fetching it, so a resource admin's page can come back with zero visible
 *      batches while later pages still hold batches they may act on. A client
 *      that stops on an empty page silently loses them.
 *
 *   2. **The status vocabulary is a parameter, not a constant.** Change requests
 *      speak submitted/approved/rejected/withdrawn, and `withdrawn` is a
 *      SUBMITTER transition that must never be rendered as an admin button.
 *
 * `admin-module-base.js` is a classic script that defines a global function
 * rather than an ES module export (it is loaded with a plain `<script>` tag, see
 * layout/footer.php), so it is evaluated here from source and its factory
 * returned, exactly as the browser would obtain it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Resolved from the vitest root rather than from `import.meta.url`: under the
// jsdom environment that URL is an http: one, which fileURLToPath rejects.
const SOURCE = readFileSync(resolve(process.cwd(), 'assets/js/admin-module-base.js'), 'utf8');

/** Evaluate the classic script and hand back its factory. */
const loadFactory = () => new Function(`${SOURCE}\nreturn createAdminModule;`)();

const createAdminModule = loadFactory();

/** Minimal config the factory reads through `this.config`. */
const baseConfig = {
    apiUrl: 'https://api.example.test',
    i18n: {
        loading: 'Loading…',
        failedToLoad: 'Failed to load',
        noItems: 'None',
        noPendingItems: 'All caught up',
        processing: 'Processing…',
        statusSubmitted: 'Submitted',
        statusApproved: 'Approved',
        statusRejected: 'Rejected',
        statusWithdrawn: 'Withdrawn',
        approveSuccess: 'Approved.',
        rejectSuccess: 'Rejected.',
        alreadyDecided: 'Already decided.'
    }
};

/**
 * The DOM the factory addresses by id: one body container and one count element
 * per status, the attention badge, the modal and its footer buttons.
 */
function mountDom(statuses, containerPrefix, actionButtonIds) {
    document.body.innerHTML = `
        <ul id="statusTabs">
            ${statuses.map((s, i) => `<button id="${s}-tab" class="nav-link${i === 0 ? ' active' : ''}" data-bs-toggle="tab"></button>`).join('')}
        </ul>
        ${statuses.map(s => `<div id="${s}Count"></div><div id="${s}${containerPrefix}Body"></div>`).join('')}
        <span id="pendingBadge"></span>
        <div id="reviewModal">
            <div id="changeRequestDetails"></div>
            <div id="notesSection"><textarea id="reviewNotes"></textarea></div>
            <div id="modalAlerts"></div>
            ${Object.values(actionButtonIds).map(id => `<button id="${id}" class="d-none"></button>`).join('')}
        </div>
    `;
}

/** A minimally viable ChangeRequestBatch. */
const batch = (id, status = 'submitted') => ({
    batch_id: id,
    resource_type: 'national_calendar',
    resource_id: 'roman/US',
    review_status: status,
    review_decision: null,
    publication_status: 'none',
    submitted_by_sub: 'sub-1',
    submitted_by_name: 'Jane Editor',
    submitted_by_email: 'jane@example.test',
    approved_by_sub: null,
    rejected_reason: null,
    pr_number: null,
    file_count: 1,
    paths: ['jsondata/sourcedata/calendars/US.json'],
    created_at: '2026-08-01T00:00:00+00:00',
    updated_at: '2026-08-01T00:00:00+00:00'
});

/** The change-request options, i.e. the ones issue #504 asked the factory to accept. */
const changeRequestOptions = (overrides = {}) => ({
    configName: 'TestChangesConfig',
    entityName: 'change requests',
    containerPrefix: 'Changes',
    apiEndpoint: '/admin/change-requests',
    reviewBtnDataAttr: 'batch',
    detailsContainerIds: ['changeRequestDetails'],
    statuses: ['submitted', 'approved', 'rejected', 'withdrawn'],
    attentionStatus: 'submitted',
    statusBadges: {
        submitted: { class: 'bg-warning text-dark', icon: 'fas fa-hourglass-half', i18nKey: 'statusSubmitted' },
        approved: { class: 'bg-success', icon: 'fas fa-check-circle', i18nKey: 'statusApproved' },
        rejected: { class: 'bg-danger', icon: 'fas fa-times-circle', i18nKey: 'statusRejected' },
        withdrawn: { class: 'bg-secondary', icon: 'fas fa-undo', i18nKey: 'statusWithdrawn' }
    },
    actionsForStatus: (status) => ( status === 'submitted' ? ['approve', 'reject'] : [] ),
    actionButtonIds: { approve: 'approveBtn', reject: 'rejectBtn' },
    buildActionBody: (action, notes) => ( action === 'reject' && notes ? { reason: notes } : {} ),
    pagination: {
        limit: 100,
        getItems: (data) => data.change_requests || [],
        getHasMore: (data) => data.has_more === true
    },
    getItemId: (b) => b.batch_id,
    parseResponse(data) {
        const items = { submitted: [], approved: [], rejected: [], withdrawn: [] };
        for (const b of ( data.items || [] )) {
            if (items[b.review_status]) items[b.review_status].push(b);
        }
        return { items, counts: null };
    },
    getTableHeaders: () => '<th>Resource</th><th>Actions</th>',
    renderTableRow(b, status) {
        return `<tr><td>${b.resource_id}</td><td>`
            + `<button class="review-btn" data-batch-id="${b.batch_id}" data-batch-status="${status}"></button>`
            + '</td></tr>';
    },
    renderModalDetails: (b) => `<p>${b.batch_id}</p>`,
    ...overrides
});

/** Build a module already wired to a config and a mocked Bootstrap modal. */
function buildModule(options) {
    const module = createAdminModule(options);
    module.config = baseConfig;
    module.modals.review = { show: vi.fn(), hide: vi.fn() };
    return module;
}

/** A fetch stub answering a fixed sequence of pages. */
function pagedFetch(pages) {
    const calls = [];
    const fetchMock = vi.fn(async (url) => {
        calls.push(url);
        const page = pages.shift();
        if (!page) throw new Error(`Unexpected extra request: ${url}`);
        return { ok: true, status: 200, json: async () => page };
    });
    return { fetchMock, calls };
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('createAdminModule pagination', () => {
    it('keeps paging while has_more is true even when a page comes back EMPTY', async () => {
        // The exact resource-admin shape: the middle SQL page filtered down to zero
        // visible batches, but two later batches survive on the following page.
        // Stopping on the empty page would silently hide them.
        const { fetchMock, calls } = pagedFetch([
            { change_requests: [batch('b1')], count: 1, total: 300, limit: 100, offset: 0, has_more: true },
            { change_requests: [], count: 0, total: 300, limit: 100, offset: 100, has_more: true },
            { change_requests: [batch('b2'), batch('b3')], count: 2, total: 300, limit: 100, offset: 200, has_more: false }
        ]);
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);

        await module.loadItems();

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(module.items.submitted.map(b => b.batch_id)).toEqual(['b1', 'b2', 'b3']);
        // offset advances by the server's effective page size, never by the number
        // of items that survived post-SQL filtering.
        expect(calls[1]).toContain('offset=100');
        expect(calls[2]).toContain('offset=200');
    });

    it('stops as soon as has_more is false, even on a full page', async () => {
        const { fetchMock } = pagedFetch([
            { change_requests: [batch('b1')], count: 1, total: 1, limit: 100, offset: 0, has_more: false }
        ]);
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);

        await module.loadItems();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(module.items.submitted).toHaveLength(1);
    });

    it('stops rather than spinning when the server advertises more but does not advance', async () => {
        const stuck = { change_requests: [], count: 0, total: 5, limit: 100, offset: 0, has_more: true };
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => stuck }));
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const options = changeRequestOptions();
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);

        await module.loadItems();

        // Second page repeats offset 0, so the cursor guard fires immediately.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('leaves an unpaginated caller on a single unparameterised request', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ applications: [{ id: 'a1', status: 'pending' }] })
        }));
        vi.stubGlobal('fetch', fetchMock);

        const options = {
            configName: 'TestApplicationsConfig',
            entityName: 'applications',
            containerPrefix: 'Applications',
            apiEndpoint: '/admin/applications',
            parseResponse(data) {
                const items = { pending: [], approved: [], rejected: [], revoked: [] };
                for (const app of data.applications) items[app.status].push(app);
                return { items, counts: null };
            },
            getTableHeaders: () => '<th>App</th>',
            renderTableRow: (app) => `<tr><td>${app.id}</td></tr>`,
            renderModalDetails: () => ''
        };
        mountDom(['pending', 'approved', 'rejected', 'revoked'], 'Applications', { approve: 'approveBtn', reject: 'rejectBtn', revoke: 'revokeBtn' });
        const module = buildModule(options);

        await module.loadItems();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/admin/applications');
        expect(module.items.pending).toHaveLength(1);
    });
});

describe('createAdminModule status vocabulary', () => {
    it('uses the supplied statuses for buckets, counts and the attention badge', async () => {
        const { fetchMock } = pagedFetch([
            {
                change_requests: [batch('b1'), batch('b2', 'withdrawn'), batch('b3', 'approved')],
                count: 3,
                total: 3,
                limit: 100,
                offset: 0,
                has_more: false
            }
        ]);
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);

        await module.loadItems();

        expect(Object.keys(module.items).sort()).toEqual(['approved', 'rejected', 'submitted', 'withdrawn']);
        expect(document.getElementById('submittedCount').textContent).toBe('1');
        expect(document.getElementById('withdrawnCount').textContent).toBe('1');
        expect(document.getElementById('approvedCount').textContent).toBe('1');
        // The attention badge follows attentionStatus, not the literal word "pending".
        expect(document.getElementById('pendingBadge').textContent).toBe('1');
    });

    it('renders change-request status badges from the supplied vocabulary', () => {
        const options = changeRequestOptions();
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);

        expect(module.renderStatusBadge('submitted')).toContain('Submitted');
        expect(module.renderStatusBadge('withdrawn')).toContain('Withdrawn');
        // A status outside the vocabulary degrades to escaped text, never to a
        // badge claiming a meaning it does not have.
        expect(module.renderStatusBadge('revoked')).toBe('revoked');
    });

    it('never offers withdrawn as an admin action', async () => {
        const { fetchMock } = pagedFetch([
            {
                change_requests: [batch('b1'), batch('b2', 'withdrawn')],
                count: 2,
                total: 2,
                limit: 100,
                offset: 0,
                has_more: false
            }
        ]);
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);
        await module.loadItems();

        // A submitted batch offers exactly approve and reject…
        module.openReviewModal('b1', 'submitted');
        expect(document.getElementById('approveBtn').classList.contains('d-none')).toBe(false);
        expect(document.getElementById('rejectBtn').classList.contains('d-none')).toBe(false);
        expect(document.getElementById('notesSection').classList.contains('d-none')).toBe(false);

        // …and a withdrawn one offers nothing at all: withdrawal is the submitter's
        // transition and there is no admin endpoint for it.
        module.openReviewModal('b2', 'withdrawn');
        expect(document.getElementById('approveBtn').classList.contains('d-none')).toBe(true);
        expect(document.getElementById('rejectBtn').classList.contains('d-none')).toBe(true);
        expect(document.getElementById('notesSection').classList.contains('d-none')).toBe(true);
    });
});

describe('createAdminModule action requests', () => {
    /** Load one submitted batch and open its modal, ready for an action. */
    async function openSubmitted(options) {
        mountDom(options.statuses, 'Changes', options.actionButtonIds);
        const module = buildModule(options);
        module.items = { submitted: [batch('b1')], approved: [], rejected: [], withdrawn: [] };
        module.openReviewModal('b1', 'submitted');
        return module;
    }

    it('sends {reason} on reject, not the applications-shaped {notes}', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        const module = await openSubmitted(options);
        document.getElementById('reviewNotes').value = '  schema drift  ';

        await module.processItem('reject');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.example.test/admin/change-requests/b1/reject');
        // {reason} — the endpoint is additionalProperties:false, so {notes} is a 400.
        expect(JSON.parse(init.body)).toEqual({ reason: 'schema drift' });
        expect(init.credentials).toBe('include');
    });

    it('omits the reason entirely when the reviewer left the box empty', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        const module = await openSubmitted(options);

        await module.processItem('reject');

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    });

    it('keeps sending {notes} for a caller that did not override the body builder', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions({ buildActionBody: undefined });
        delete options.buildActionBody;
        const module = await openSubmitted(options);
        document.getElementById('reviewNotes').value = 'looks fine';

        await module.processItem('approve');

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ notes: 'looks fine' });
    });

    it('reports a 409 as "already decided" and reloads instead of as a generic error', async () => {
        const fetchMock = vi.fn(async (url) => {
            if (String(url).endsWith('/approve')) {
                return { ok: false, status: 409, json: async () => ({ error: 'Change request batch was already decided' }) };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ change_requests: [], count: 0, total: 0, limit: 100, offset: 0, has_more: false })
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const options = changeRequestOptions();
        const module = await openSubmitted(options);

        await module.processItem('approve');

        const alerts = document.getElementById('modalAlerts').innerHTML;
        expect(alerts).toContain('alert-warning');
        expect(alerts).toContain('Already decided.');
        expect(alerts).not.toContain('alert-danger');

        // …and the list is reloaded so the row shows its real state.
        await vi.advanceTimersByTimeAsync(1600);
        expect(module.modals.review.hide).toHaveBeenCalled();
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/admin/change-requests?'))).toBe(true);
    });
});
