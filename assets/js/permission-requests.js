/**
 * Access Requests Page JavaScript
 *
 * Handles the user-facing interface for requesting access (role + permissions)
 * via the unified /auth/access-requests endpoint, and viewing existing request status.
 */

import {
    ApiClient,
    CalendarSelect,
    CalendarSelectFilter,
    RiteSelect,
} from '@liturgical-calendar/components-js';
import {
    AMBROSIAN_RITE,
    qualifyObjectId,
    RITE_CALENDAR_TYPE,
    ROMAN_RITE,
    splitObjectId,
} from './riteScopedObjectId.js';

// Initialize the API client once; CalendarSelect requires this to have resolved.
// Since components-js 2.0.0 init() rejects on failure rather than resolving to
// false, so the `instanceof` check it used to need is gone: the fulfilled value
// is always a client. The catch still maps failure to false, which is what the
// `if (!client)` guards below test for.
const apiClientReady = ApiClient.init(BaseUrl)
    .catch(function(err) {
        console.error('Failed to initialize ApiClient for permission fields:', err);
        return false;
    });

document.addEventListener('DOMContentLoaded', async function() {
    const config = window.AccessRequestsConfig;
    if (!config) {
        console.error('AccessRequestsConfig not found');
        return;
    }

    const existingRequestsBody = document.getElementById('existingRequestsBody');
    const accessRequestForm = document.getElementById('accessRequestForm');
    const formAlerts = document.getElementById('formAlerts');
    const submitBtn = document.getElementById('submitBtn');
    const requestedRoleRadios = document.querySelectorAll('input[name="requested_role"]');
    const requestFormBody = document.getElementById('requestFormBody');
    const permissionsSection = document.getElementById('permissionsSection');

    function getRequestedRole() {
        const checked = document.querySelector('input[name="requested_role"]:checked');
        return checked ? checked.value : '';
    }

    function setRequestedRole(value) {
        requestedRoleRadios.forEach(function(r) { r.checked = (r.value === value); });
    }

    function setRoleSelectionDisabled(disabled) {
        requestedRoleRadios.forEach(function(r) { r.disabled = disabled; });
    }
    const permissionRows = document.getElementById('permissionRows');
    const addPermissionBtn = document.getElementById('addPermissionBtn');

    // Mirror of API CreateAccessRequestBody.permissions maxItems
    const MAX_PERMISSIONS = 50;

    // Role display names
    const roleNames = {
        'calendar_editor': config.i18n.calendarEditor,
        'test_editor': config.i18n.testEditor,
        'developer': config.i18n.developer
    };

    // Object type ("Calendar scope") display names
    // `rite_calendar` and `rite_calendar_test` supersede the two
    // `general_roman_calendar*` entries (API #955 / #785), which stay listed
    // because the API still emits them: pre-migration grants, stored access
    // requests and `audit_log` rows all keep the old names, permanently in the
    // audit log's case. A map without them renders those rows as a raw type id.
    const objectTypeNames = {
        'national_calendar': config.i18n.nationalCalendar,
        'diocesan_calendar': config.i18n.diocesanCalendar,
        'wider_region': config.i18n.widerRegion,
        'rite_calendar': config.i18n.riteCalendar,
        'general_roman_calendar': config.i18n.generalRomanCalendar,
        'national_calendar_test': config.i18n.testsNational,
        'diocesan_calendar_test': config.i18n.testsDiocesan,
        'rite_calendar_test': config.i18n.testsRiteCalendar,
        'general_roman_calendar_test': config.i18n.testsGeneralRoman
    };

    // Relation display names
    const relationNames = {
        'viewer': config.i18n.viewer,
        'editor': config.i18n.editor,
        'admin': config.i18n.admin
    };

    // Relation badge classes
    const relationBadgeClasses = {
        'viewer': 'bg-info',
        'editor': 'bg-primary',
        'admin': 'bg-warning text-dark'
    };

    // Status display info
    const statusInfo = {
        'pending': { class: 'bg-warning text-dark', icon: 'fas fa-clock', text: config.i18n.statusPending },
        'approved': { class: 'bg-success', icon: 'fas fa-check', text: config.i18n.statusApproved },
        'rejected': { class: 'bg-danger', icon: 'fas fa-times', text: config.i18n.statusRejected },
        'revoked': { class: 'bg-secondary', icon: 'fas fa-ban', text: config.i18n.statusRevoked }
    };

    // Fixed object-id choices for the deprecated General Roman Calendar type.
    // The five enumerated General Roman Calendar sub-resource ids.
    // Keep in sync with the API constant AccessRequestRepository::GRC_OBJECT_IDS
    // and the identical copy in assets/js/admin-permissions.js.
    const GRC_OBJECT_IDS = [
        { id: 'temporale',          label: config.i18n.grcTemporale },
        { id: 'EDITIO_TYPICA_1970', label: config.i18n.grcSanctorale1970 },
        { id: 'EDITIO_TYPICA_2002', label: config.i18n.grcSanctorale2002 },
        { id: 'EDITIO_TYPICA_2008', label: config.i18n.grcSanctorale2008 },
        { id: 'decrees',            label: config.i18n.grcDecrees }
    ];

    // The eight object ids valid for the `rite_calendar` type, per rite, in the
    // API's own order. Keep in sync with the service RiteCalendarObjectIds and
    // the identical copy in assets/js/admin-permissions.js.
    //
    // This is a per-rite SET, not the single fixed id `general_roman_calendar_test`
    // has: the ids are the rite's temporale, its typical editions that actually
    // carry sanctorale data, and — for the Roman rite alone — `decrees` and
    // `supported_locales`. Roman EDITIO_TYPICA_1971/1975 and Ambrosian
    // EDITIO_TYPICA_1976 are typical editions with no sanctorale file, which the
    // API deliberately excludes: a grant over one would authorize editing a
    // resource with nothing in it.
    const RITE_CALENDAR_OBJECT_IDS = [
        {
            rite:  ROMAN_RITE,
            label: config.i18n.romanRite,
            ids:   [
                { id: 'temporale',          label: config.i18n.grcTemporale },
                { id: 'decrees',            label: config.i18n.grcDecrees },
                { id: 'supported_locales',  label: config.i18n.rcSupportedLocales },
                { id: 'EDITIO_TYPICA_1970', label: config.i18n.grcSanctorale1970 },
                { id: 'EDITIO_TYPICA_2002', label: config.i18n.grcSanctorale2002 },
                { id: 'EDITIO_TYPICA_2008', label: config.i18n.grcSanctorale2008 }
            ]
        },
        {
            rite:  AMBROSIAN_RITE,
            label: config.i18n.ambrosianRite,
            ids:   [
                { id: 'temporale',          label: config.i18n.grcTemporale },
                { id: 'EDITIO_TYPICA_2024', label: config.i18n.rcSanctorale2024 }
            ]
        }
    ];

    // The five wider-region names (object_id for the wider_region scope).
    // Keep in sync with the API; these are not localized (proper nouns).
    const WIDER_REGIONS = ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania'];

    // Object types allowed per role (mirror AccessRequestRepository::ROLE_OBJECT_TYPES)
    // Membership mirrors AccessRequestRepository::ROLE_OBJECT_TYPES (the API
    // validates the SET, not the order). Display order is deliberate: the
    // rite-level calendar scope(s) come first, and `rite_calendar` precedes the
    // `general_roman_calendar` it supersedes so a new request lands on the
    // current type. The deprecated one is still OFFERED rather than dropped:
    // the API accepts it for the whole migration window, and a grant made on it
    // is picked up by the tuple migration, so removing it would only strand
    // anyone mid-flow (see the API's rite-calendar-migration-runbook, Step 6).
    const roleObjectTypes = {
        'calendar_editor': [
            'rite_calendar',
            'general_roman_calendar',
            'national_calendar',
            'diocesan_calendar',
            'wider_region'
        ],
        'test_editor': [
            'general_roman_calendar_test',
            'national_calendar_test',
            'diocesan_calendar_test'
        ],
        'developer': [
            'rite_calendar',
            'general_roman_calendar',
            'general_roman_calendar_test',
            'national_calendar',
            'diocesan_calendar',
            'wider_region',
            'national_calendar_test',
            'diocesan_calendar_test'
        ]
    };

    let permissionRowCounter = 0;

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const NATIONAL_FILTER_TYPES = ['national_calendar', 'national_calendar_test'];
    const DIOCESAN_FILTER_TYPES = ['diocesan_calendar', 'diocesan_calendar_test'];

    /**
     * Build the stand-in control shown when the CalendarSelect cannot be built.
     *
     * It deliberately still carries `.perm-object-id`, so the control the rest of
     * the form (and the E2E suite) waits for does appear. It is disabled and has
     * no selectable value, so submit validation still blocks — but the failure
     * now reads as "this broke" rather than as an element that never arrives.
     * @returns {HTMLSelectElement} A disabled select carrying the failure notice
     */
    function buildObjectIdLoadFailure() {
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm perm-object-id is-invalid';
        select.required = true;
        select.disabled = true;
        select.dataset.loadFailed = 'true';

        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = config.i18n.calendarIdLoadFailed || 'Could not load calendars — try reloading the page';
        opt.selected = true;
        select.appendChild(opt);
        return select;
    }

    /**
     * Append the `rite_calendar` ids, one <optgroup> per rite.
     *
     * A branch of its own rather than a reuse of the GRC-test one: that type has
     * a single fixed id which can simply be auto-selected, whereas
     * `rite_calendar` has a per-rite SET, and which ids exist differs by rite
     * (`decrees` and `supported_locales` are Roman-only; the typical editions
     * are each their own rite's). Grouping by rite is what makes the two
     * `temporale` entries distinguishable.
     *
     * Option values are the FULL rite-qualified ids the API validates. Composing
     * them here rather than at submit time is what lets a row with no rite
     * control still send a correct id — `qualifyObjectId()` is idempotent, so
     * the submit path passes them through unchanged.
     *
     * @param {HTMLSelectElement} select - The select to append the groups to
     */
    function appendRiteCalendarOptions(select) {
        for (const group of RITE_CALENDAR_OBJECT_IDS) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label || group.rite;
            for (const entry of group.ids) {
                const o = document.createElement('option');
                o.value = qualifyObjectId(RITE_CALENDAR_TYPE, entry.id, group.rite);
                o.textContent = entry.label;
                optgroup.appendChild(o);
            }
            select.appendChild(optgroup);
        }
    }

    /**
     * Build a native <select class="form-select form-select-sm perm-object-id">
     * for the non-calendar scopes (wider_region / rite calendar / GRC / GRC test).
     * @param {string} objectType - The currently selected object type
     * @returns {HTMLSelectElement} The built select element
     */
    function buildStaticObjectIdSelect(objectType) {
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm perm-object-id';
        select.required = true;

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = config.i18n.selectCalendarId || 'Select calendar ID...';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        if (objectType === RITE_CALENDAR_TYPE) {
            appendRiteCalendarOptions(select);
            return select;
        }

        let entries = [];
        if (objectType === 'wider_region') {
            entries = WIDER_REGIONS.map(function(name) { return { value: name, label: name }; });
        } else if (objectType === 'general_roman_calendar') {
            entries = GRC_OBJECT_IDS.map(function(o) { return { value: o.id, label: o.label }; });
        } else if (objectType === 'general_roman_calendar_test') {
            entries = [
                { value: 'general_roman_calendar', label: config.i18n.testsGeneralRoman }
            ];
        }
        for (const e of entries) {
            const o = document.createElement('option');
            o.value = e.value;
            o.textContent = e.label;
            select.appendChild(o);
        }
        // Auto-select the single fixed GRC-test id.
        if (objectType === 'general_roman_calendar_test') {
            select.value = 'general_roman_calendar';
        }
        return select;
    }

    /**
     * Rebuild the Calendar ID control for a row based on the chosen scope.
     * Calendar-backed scopes mount a CalendarSelect; the rest use a native select.
     * @param {HTMLElement} row - The permission row (.card element)
     * @param {string} objectType - The currently selected object type
     */
    async function syncRowObjectIdField(row, objectType) {
        const mount = row.querySelector('.perm-objid-mount');
        if (!mount) return;
        mount.innerHTML = '';

        if (
            NATIONAL_FILTER_TYPES.includes(objectType) ||
            DIOCESAN_FILTER_TYPES.includes(objectType)
        ) {
            // Everything from here can throw or reject: the API may be down, and
            // CalendarSelect itself can fail while parsing calendar metadata. An
            // unhandled rejection here leaves the mount empty, which looks
            // identical to "still loading" — the control simply never appears and
            // the only symptom is a Playwright waitFor timing out ten seconds
            // later with nothing to point at. Fail loudly and visibly instead.
            try {
                const client = await apiClientReady;
                if (!client) throw new Error('ApiClient initialization failed');
                // Guard against a rapid scope change that already replaced the mount.
                if (
                    !row.isConnected ||
                    row.querySelector('.perm-object-type').value !== objectType
                ) return;
                const isNational = NATIONAL_FILTER_TYPES.includes(objectType);
                const filter = isNational
                    ? CalendarSelectFilter.NATIONAL_CALENDARS
                    : CalendarSelectFilter.DIOCESAN_CALENDARS;
                // The Ambrosian rite has no national tier: a `nations` filtered select
                // under it holds only the rite-level calendar and hides itself, which
                // would strand the admin with no way to fill a required field. So the
                // rite select is offered for diocesan scopes only, where the Ambrosian
                // rite does have calendars (Lugano, Bergamo, Milano, Novara).
                //
                // It must be in the DOM before linkToRiteSelect() below, which attaches
                // its change listener to this element.
                let riteSelect = null;
                if (!isNational) {
                    riteSelect = new RiteSelect(LITCAL_LOCALE)
                        .class('form-select form-select-sm mb-2 perm-object-rite');
                    riteSelect.appendTo(mount);
                }
                const calSelect = new CalendarSelect(LITCAL_LOCALE)
                    .filter(filter)
                    .allowNull(true)
                    .class('form-select form-select-sm perm-object-id');
                calSelect.appendTo(mount);
                // CalendarSelect's allowNull adds an empty option that semantically
                // means "no nation/diocese" = General Roman Calendar, which is not a
                // valid national/diocesan object_id. Turn it into a disabled
                // placeholder so the user must pick a concrete calendar (Vatican
                // included — it has its own national-style calendar).
                //
                // Re-applied on every rite change: linkToRiteSelect() rebuilds the
                // option list from scratch, which discards this customization.
                const applyCalendarIdPlaceholder = () => {
                    const calNullOpt = mount.querySelector('.perm-object-id option[value=""]');
                    if (calNullOpt) {
                        calNullOpt.textContent = config.i18n.selectCalendarId || 'Select calendar ID...';
                        calNullOpt.disabled = true;
                        calNullOpt.selected = true;
                    }
                };
                if (riteSelect) {
                    calSelect.linkToRiteSelect(riteSelect);
                    riteSelect._domElement.addEventListener('change', applyCalendarIdPlaceholder);
                }
                applyCalendarIdPlaceholder();
            } catch (err) {
                console.error(
                    `[permission-requests] Could not build the calendar select for object type "${objectType}":`,
                    err
                );
                mount.appendChild(buildObjectIdLoadFailure());
            }
        } else {
            mount.appendChild(buildStaticObjectIdSelect(objectType));
        }
    }

    /**
     * Show alert message in the form
     * @param {string} type - Alert type (success, danger, warning, info)
     * @param {string} message - Alert message
     */
    function showAlert(type, message) {
        const allowedTypes = ['success', 'danger', 'warning', 'info', 'primary', 'secondary', 'light', 'dark'];
        const safeType = allowedTypes.includes(type) ? type : 'info';
        formAlerts.innerHTML = `
            <div class="alert alert-${safeType} alert-dismissible fade show" role="alert">
                ${escapeHtml(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    /**
     * Format a date for display
     * @param {string|null} dateStr - ISO date string
     * @returns {string} Formatted date or '-'
     */
    function formatDate(dateStr) {
        return dateStr ? new Date(dateStr).toLocaleDateString() : '-';
    }

    /**
     * Get allowed object types for the currently selected role
     * @returns {string[]} Array of allowed object type keys
     */
    function getAllowedObjectTypes() {
        const role = getRequestedRole();
        return roleObjectTypes[role] || [];
    }

    /**
     * Build the object type <option> elements for a permission row
     * @returns {string} HTML options
     */
    function buildObjectTypeOptions() {
        const allowed = getAllowedObjectTypes();
        let html = '<option value="">' + escapeHtml(config.i18n.selectCalendarScope) + '</option>';
        for (const type of allowed) {
            html += '<option value="' + escapeHtml(type) + '">' + escapeHtml(objectTypeNames[type] || type) + '</option>';
        }
        return html;
    }

    /**
     * Add a new permission row to the form
     */
    function updateAddPermissionBtnState() {
        const currentCount = permissionRows.querySelectorAll('.card').length;
        addPermissionBtn.disabled = currentCount >= MAX_PERMISSIONS;
    }

    function addPermissionRow() {
        const currentCount = permissionRows.querySelectorAll('.card').length;
        if (currentCount >= MAX_PERMISSIONS) {
            const tmpl = config.i18n.maxPermissionsReached
                || 'You have reached the maximum of %1$d permissions per request.';
            showAlert('warning', tmpl.replace(/%1\$d/g, String(MAX_PERMISSIONS)));
            updateAddPermissionBtnState();
            return;
        }
        permissionRowCounter++;
        const rowId = 'permRow_' + permissionRowCounter;
        const row = document.createElement('div');
        row.className = 'card bg-light mb-2';
        row.id = rowId;
        row.innerHTML = `
            <div class="card-body py-2 px-3">
                <div class="row g-2 align-items-end">
                    <div class="col-md-3">
                        <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.relation)}</label>
                        <select class="form-select form-select-sm perm-relation" required>
                            <option value="">${escapeHtml(config.i18n.selectRelation)}</option>
                            <option value="viewer">${escapeHtml(config.i18n.viewer)}</option>
                            <option value="editor">${escapeHtml(config.i18n.editor)}</option>
                            <option value="admin">${escapeHtml(config.i18n.admin)}</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.calendarScope)}</label>
                        <select class="form-select form-select-sm perm-object-type" required>
                            ${buildObjectTypeOptions()}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label form-label-sm mb-1">${escapeHtml(config.i18n.calendarId)}</label>
                        <div class="perm-objid-mount">
                            <select class="form-select form-select-sm perm-object-id" required>
                                <option value="" disabled selected>${escapeHtml(config.i18n.selectCalendarId)}</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-outline-danger btn-sm w-100 remove-perm-btn"
                                title="${escapeHtml(config.i18n.remove)}"
                                aria-label="${escapeHtml(config.i18n.remove)}">
                            <i class="fas fa-trash-alt" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        permissionRows.appendChild(row);

        // Bind remove button
        row.querySelector('.remove-perm-btn').addEventListener('click', function() {
            row.remove();
            updateAddPermissionBtnState();
        });

        // Swap object-id control when type changes (GRC → <select>; others → <input>)
        row.querySelector('.perm-object-type').addEventListener('change', function() {
            syncRowObjectIdField(row, this.value);
        });

        updateAddPermissionBtnState();
    }

    /**
     * Update the permissions section visibility and rebuild object type
     * options based on selected role.
     */
    function updatePermissionsSection() {
        const role = getRequestedRole();
        if (role) {
            if (requestFormBody) requestFormBody.style.display = '';
            permissionsSection.style.display = '';
            // Rebuild object type options in existing rows
            const selects = permissionRows.querySelectorAll('.perm-object-type');
            const optionsHtml = buildObjectTypeOptions();
            selects.forEach(function(sel) {
                const currentVal = sel.value;
                sel.innerHTML = optionsHtml;
                // Try to restore the previous selection if still valid
                if (currentVal) {
                    const opt = sel.querySelector('option[value="' + currentVal + '"]');
                    if (opt) {
                        sel.value = currentVal;
                    }
                }
                // Sync object-id control in case the type was removed from the allowed list
                syncRowObjectIdField(sel.closest('.card'), sel.value);
            });
            // Add an initial row if there are none
            if (permissionRows.children.length === 0) {
                addPermissionRow();
            }
        } else {
            if (requestFormBody) requestFormBody.style.display = 'none';
            permissionsSection.style.display = 'none';
        }
    }

    /**
     * Collect permissions from the form rows
     * @returns {Array|null} Array of permission objects, or null if validation fails
     */
    function collectPermissions() {
        const rows = permissionRows.querySelectorAll('.card');
        if (rows.length === 0) {
            return null;
        }
        const permissions = [];

        for (const row of rows) {
            const objectType = row.querySelector('.perm-object-type').value;
            const objectIdEl = row.querySelector('.perm-object-id');
            const objectId = objectIdEl ? objectIdEl.value.trim() : '';
            const relation = row.querySelector('.perm-relation').value;

            if (!objectType || !objectId || !relation) {
                return null;
            }

            // The CalendarSelect's option values are bare calendar ids, but the
            // API validates a rite-qualified object id for every type that names
            // a calendar (`AccessRequestRepository::isValidObjectIdForType()`),
            // so qualify on the way out. The rite comes from the RiteSelect this
            // row mounts for diocesan scopes — the same select the diocese list
            // was filtered by, so it IS the diocese's announced rite, never a
            // guess. National/wider-region scopes have no rite select and
            // qualifyObjectId() pins them to `roman` structurally.
            const riteEl = row.querySelector('.perm-object-rite');
            permissions.push({
                object_type: objectType,
                object_id: qualifyObjectId(objectType, objectId, riteEl ? riteEl.value : undefined),
                relation: relation
            });
        }

        return permissions;
    }

    /**
     * Summarize a permissions array into a short display string
     * @param {Array} permissions - Array of permission objects
     * @returns {string} Summary HTML
     */
    function summarizePermissions(permissions) {
        if (!permissions || permissions.length === 0) {
            return '-';
        }
        const parts = [];
        for (const perm of permissions) {
            const typeName = objectTypeNames[perm.object_type] || perm.object_type;
            const relName = relationNames[perm.relation] || perm.relation;
            const badgeClass = relationBadgeClasses[perm.relation] || 'bg-secondary';
            parts.push(
                '<span class="badge ' + badgeClass + ' me-1">'
                + escapeHtml(relName)
                + '</span> '
                + escapeHtml(typeName) + ': <code>' + escapeHtml(perm.object_id) + '</code>'
            );
        }
        return parts.join('<br>');
    }

    // ========================================================================
    // Event listeners
    // ========================================================================

    requestedRoleRadios.forEach(function(r) {
        r.addEventListener('change', updatePermissionsSection);
    });
    addPermissionBtn.addEventListener('click', addPermissionRow);

    // ========================================================================
    // Load existing access requests
    // ========================================================================

    /**
     * Load existing access requests for the current user
     */
    async function loadExistingRequests() {
        try {
            const response = await fetch(config.apiUrl + '/auth/access-requests', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(function() { return {}; });
                const errorMsg = errorData.detail || errorData.error || errorData.message || errorData.title || 'HTTP ' + response.status;
                throw new Error(errorMsg);
            }

            const data = await response.json();
            displayExistingRequests(data.requests || []);
        } catch (error) {
            console.error('Error loading access requests:', error);
            const errorMessage = error.message || config.i18n.unknownError;
            existingRequestsBody.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${escapeHtml(config.i18n.failedToLoad)}
                    <br><small class="text-muted">${escapeHtml(errorMessage)}</small>
                </div>
            `;
        }
    }

    /**
     * Display existing access requests
     * @param {Array} requests - Array of access request objects
     */
    function displayExistingRequests(requests) {
        if (requests.length === 0) {
            existingRequestsBody.innerHTML = `
                <p class="text-muted mb-0">
                    <i class="fas fa-inbox me-2"></i>
                    ${escapeHtml(config.i18n.noRequests)}
                </p>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover mb-0">';
        html += `
            <thead>
                <tr>
                    <th>${escapeHtml(config.i18n.role)}</th>
                    <th>${escapeHtml(config.i18n.permissions)}</th>
                    <th>${escapeHtml(config.i18n.status)}</th>
                    <th>${escapeHtml(config.i18n.reviewNotes)}</th>
                    <th>${escapeHtml(config.i18n.submitted)}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const request of requests) {
            const status = statusInfo[request.status] || statusInfo['pending'];
            const roleName = roleNames[request.requested_role] || request.requested_role;
            const reviewNotes = request.review_notes
                ? (request.review_notes.length > 60
                    ? request.review_notes.substring(0, 60) + '...'
                    : request.review_notes)
                : '-';

            let actionHtml = '';
            if (request.status === 'rejected') {
                actionHtml = `
                    <button class="btn btn-outline-warning btn-sm resubmit-btn"
                            data-request-id="${escapeHtml(String(request.id))}"
                            title="${escapeHtml(config.i18n.resubmit || 'Resubmit')}">
                        <i class="fas fa-redo me-1"></i>${escapeHtml(config.i18n.resubmit || 'Resubmit')}
                    </button>
                `;
            }

            const safeRequestId = escapeHtml(String(request.id));
            html += `
                <tr id="request-${safeRequestId}">
                    <td><span class="badge bg-info">${escapeHtml(roleName)}</span></td>
                    <td>${summarizePermissions(request.permissions)}</td>
                    <td>
                        <span class="badge ${status.class}">
                            <i class="${status.icon} me-1"></i>${escapeHtml(status.text)}
                        </span>
                    </td>
                    <td><small class="text-muted fst-italic">${escapeHtml(reviewNotes)}</small></td>
                    <td><small>${formatDate(request.created_at)}</small></td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        existingRequestsBody.innerHTML = html;

        // Bind resubmit buttons
        existingRequestsBody.querySelectorAll('.resubmit-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                openResubmitForm(this.dataset.requestId, requests);
            });
        });

        scrollToAnchoredRequest();
    }

    /**
     * If the page was loaded with `#request-<uuid>` (e.g. from a
     * notification click-through), scroll the matching row into view and
     * briefly highlight it. No-op if the anchor doesn't match a rendered
     * row.
     */
    function scrollToAnchoredRequest() {
        const hash = window.location.hash;
        if (!hash.startsWith('#request-')) return;

        const target = document.getElementById(hash.slice(1));
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('table-warning');
        setTimeout(() => target.classList.remove('table-warning'), 2500);
    }

    // Track resubmit state
    let resubmitRequestId = null;

    /**
     * Populate the permission rows from a stored permissions array
     * (used during resubmit pre-fill). Truncates to MAX_PERMISSIONS
     * with a single warning if the stored array exceeds the cap.
     * @param {Array|undefined} stored - Stored permissions from the request
     */
    async function populateRowsFromStoredPermissions(stored) {
        if (!Array.isArray(stored)) return;
        if (stored.length > MAX_PERMISSIONS) {
            const tmpl = config.i18n.permissionsTruncated
                || 'This request had more than %1$d permissions; only the first %2$d are shown.';
            showAlert('warning',
                tmpl
                    .replace(/%1\$d/g, String(stored.length))
                    .replace(/%2\$d/g, String(MAX_PERMISSIONS))
            );
        }
        for (const perm of stored.slice(0, MAX_PERMISSIONS)) {
            addPermissionRow();
            const row = permissionRows.lastElementChild;
            if (!row) continue;
            await restorePermissionRow(row, perm);
        }
    }

    /**
     * Restore one stored permission into one freshly added row.
     *
     * Split out of populateRowsFromStoredPermissions() so that function is left
     * with the one thing it is named for — walking the stored array and warning
     * when it is truncated — while the per-row restore, which is where all the
     * ordering subtleties live, stands on its own.
     *
     * @param {HTMLElement} row a row just appended by addPermissionRow()
     * @param {object} perm one stored permission
     */
    async function restorePermissionRow(row, perm) {
        const objectType = perm.object_type || '';
        const typeSelect = row.querySelector('.perm-object-type');
        if (typeSelect) typeSelect.value = objectType;

        // Sync the object-id control (mounts a CalendarSelect for calendar
        // scopes; await so the <select> exists before we set its value).
        await syncRowObjectIdField(row, objectType);

        // A stored object_id is rite-qualified (`ambrosian/lugano_ch`), while
        // the CalendarSelect's option values are bare — so split, restore the
        // rite first, then the calendar. splitObjectId() tolerates a legacy
        // bare id from a request stored before the API migration.
        const { rite, id } = splitObjectId(objectType, perm.object_id || '');
        const riteField = row.querySelector('.perm-object-rite');
        if (riteField && riteField.value !== rite) {
            riteField.value = rite;
            // linkToRiteSelect() rebuilds the calendar options from this event;
            // without it the diocese list still holds the old rite's dioceses and
            // the assignment below silently selects nothing.
            riteField.dispatchEvent(new Event('change'));
        }

        const idField = row.querySelector('.perm-object-id');
        if (idField) {
            // The `rite_calendar` select's own option values are the full
            // qualified ids (there is no rite control to restore alongside a
            // bare one), so it is restored from the stored value verbatim.
            idField.value = objectType === RITE_CALENDAR_TYPE ? (perm.object_id || '') : id;
        }

        const relSelect = row.querySelector('.perm-relation');
        if (relSelect) relSelect.value = perm.relation || '';
    }

    /**
     * Open the form pre-filled with a rejected request's data for resubmission.
     * @param {string} requestId - The request ID to resubmit
     * @param {Array} requests - All requests (to find the one to resubmit)
     */
    async function openResubmitForm(requestId, requests) {
        const request = requests.find(function(r) { return String(r.id) === String(requestId); });
        if (!request) return;

        // Set the role (disable it — role can't change on resubmit)
        setRequestedRole(request.requested_role);
        setRoleSelectionDisabled(true);

        // Reset and populate permissions
        updatePermissionsSection();
        permissionRows.innerHTML = '';
        permissionRowCounter = 0;
        await populateRowsFromStoredPermissions(request.permissions);

        // Pre-fill justification
        const justificationEl = document.getElementById('justification');
        if (justificationEl && request.justification) {
            justificationEl.value = request.justification;
        }

        // Show rejection reason as alert
        if (request.review_notes) {
            showAlert('warning', (config.i18n.rejectionReason || 'Rejection reason') + ': ' + request.review_notes);
        }

        // Set resubmit mode
        resubmitRequestId = requestId;
        submitBtn.innerHTML = '<i class="fas fa-redo me-2"></i>' + escapeHtml(config.i18n.resubmit || 'Resubmit');

        // Scroll to form
        document.getElementById('accessRequestForm').scrollIntoView({ behavior: 'smooth' });
    }

    // ========================================================================
    // Form submission
    // ========================================================================

    /**
     * Build the request body for an access-request submission.
     * @returns {Object} POST body
     */
    function buildRequestBody(requestedRole, permissions) {
        const justification = document.getElementById('justification').value.trim();
        const credentials = document.getElementById('credentials').value.trim();
        const body = {
            requested_role: requestedRole,
            permissions: permissions,
            email: config.userEmail || null,
            name: config.userName || null
        };
        if (justification) body.justification = justification;
        if (credentials) body.credentials = credentials;
        return body;
    }

    /**
     * POST the access request, handling new vs resubmit endpoints and
     * non-OK responses uniformly. Throws Error on failure with a
     * user-readable message; returns parsed JSON on success.
     */
    async function submitAccessRequest(body) {
        const endpoint = resubmitRequestId
            ? config.apiUrl + '/auth/access-requests/' + encodeURIComponent(resubmitRequestId) + '/resubmit'
            : config.apiUrl + '/auth/access-requests';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let errorMsg = config.i18n.failedToSubmit;
            try {
                const errData = await response.json();
                errorMsg = errData.message || errData.error || errData.detail || errorMsg;
            } catch { /* non-JSON error response */ }
            throw new Error(errorMsg);
        }
        return response.json();
    }

    /**
     * Reset the form and resubmit state after a successful submission.
     */
    function resetFormAfterSuccess() {
        resubmitRequestId = null;
        setRoleSelectionDisabled(false);
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>' + escapeHtml(config.i18n.submitRequest);
        accessRequestForm.reset();
        permissionRows.innerHTML = '';
        permissionRowCounter = 0;
        // Reset hides the form body + permissions section since no radio is checked.
        updatePermissionsSection();
    }

    accessRequestForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        formAlerts.innerHTML = '';

        const requestedRole = getRequestedRole();
        if (!requestedRole) {
            showAlert('danger', config.i18n.roleRequired);
            return;
        }

        const permissions = collectPermissions();
        if (permissions === null) {
            showAlert('danger', config.i18n.permissionIncomplete);
            return;
        }

        const body = buildRequestBody(requestedRole, permissions);

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>' + escapeHtml(config.i18n.submitting);

        try {
            const data = await submitAccessRequest(body);
            showAlert('success', data.message || config.i18n.submitSuccess);
            resetFormAfterSuccess();
            await loadExistingRequests();
        } catch (error) {
            console.error('Error submitting access request:', error);
            showAlert('danger', error.message || config.i18n.failedToSubmit);
        } finally {
            submitBtn.disabled = false;
            // Preserve resubmit-mode label if a resubmit failed; only restore the
            // default Submit label after a successful submission (which has already
            // cleared resubmitRequestId) or for a fresh submission.
            if (resubmitRequestId) {
                submitBtn.innerHTML = '<i class="fas fa-redo me-2"></i>' + escapeHtml(config.i18n.resubmit || 'Resubmit');
            } else {
                submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>' + escapeHtml(config.i18n.submitRequest);
            }
        }
    });

    // Load existing requests on page load
    await loadExistingRequests();
});
