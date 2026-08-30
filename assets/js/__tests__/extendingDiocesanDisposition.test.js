/**
 * Regression test for issue #501, A1: a diocesan save that was only QUEUED for
 * review must not register the diocese in the page's own metadata.
 *
 * `responseData.data` is populated in queue mode too, but it is the proposed
 * payload rather than a stored resource (API #933). The pre-fix handler pushed
 * `data.metadata` into `LitCalMetadata`, enabled the Delete button and flipped
 * `API.method` to `PATCH` — so the page advertised a diocese the server had
 * never created, and the user's next save became a `PATCH` against a 404.
 *
 * The assertion that matters is the NEGATIVE one: a `submitted` response leaves
 * `LitCalMetadata` untouched. Checking only the toast text would miss the
 * corruption entirely, which is the whole point of the issue.
 *
 * These tests exercise the real module — extending.js loaded in jsdom against a
 * fixture that mirrors extending.php?choice=diocesan — rather than a
 * reimplementation of its logic, following assets/js/__tests__/adminTestsScope.test.js.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// extending.js reads all of these at MODULE level (the Messages destructure, the
// EventsCollection seeding, the /missals fetch), so they must exist before the
// dynamic import in beforeAll resolves. In the browser they are `const`
// declarations in classic scripts emitted by layout/footer.php and extending.php.
vi.hoisted(() => {
    globalThis.EventsUrl       = 'http://localhost:8000/events';
    globalThis.MissalsUrl      = 'http://localhost:8000/missals';
    globalThis.RegionalDataUrl = 'http://localhost:8000/data';
    globalThis.LiturgicalEventCollection = [];
});

/** The diocese the fixture offers, absent from LitCalMetadata so the save is a PUT. */
const DIOCESE_NAME = 'Diocese of Testville';
const DIOCESE_ID   = 'testville_us';

/** Fixture mirroring the ids extending.php?choice=diocesan renders. */
const FIXTURE_HTML = `
    <div id="overlay" class="hidden"></div>

    <select id="diocesanCalendarNationalDependency"><option value="US" selected>United States</option></select>
    <input type="text" id="diocesanCalendarDioceseName" list="DiocesesList" value="">
    <datalist id="DiocesesList">
        <option value="${DIOCESE_NAME}" data-value="${DIOCESE_ID}"></option>
    </datalist>

    <ul id="diocesanCalendarDefinitionCardLinks" class="diocesan-disabled"></ul>
    <div id="carouselExampleIndicators" class="diocesan-disabled"></div>
    <div id="diocesanOverridesContainer" class="diocesan-disabled"></div>

    <select class="calendarLocales currentLocalizationChoices" id="currentLocalizationChoices">
        <option value="en_US" selected>English (United States)</option>
    </select>
    <select class="calendarLocales" id="diocesanCalendarLocales" multiple>
        <option value="en_US" selected>English (United States)</option>
    </select>
    <select id="diocesanCalendarTimezone"><option value="America/New_York" selected>America/New_York</option></select>
    <input type="text" id="diocesanCalendarGroup" value="">

    <form id="diocesanOverridesForm">
        <select id="diocesanCalendarOverrideEpiphany"><option value="" selected></option></select>
        <select id="diocesanCalendarOverrideAscension"><option value="" selected></option></select>
        <select id="diocesanCalendarOverrideCorpusChristi"><option value="" selected></option></select>
    </form>

    <button type="button" id="saveDiocesanCalendar_btn" disabled>Save</button>
    <button type="button" id="removeExistingDiocesanDataBtn" disabled>Remove</button>
`;

/** A fresh LitCalMetadata per test, so one test's mutations cannot mask another's. */
const freshMetadata = () => ({
    diocesan_calendars:      [],
    diocesan_calendars_keys: [],
    national_calendars:      [{ calendar_id: 'US', dioceses: [] }],
    national_calendars_keys: ['US'],
    wider_regions:           [],
    wider_regions_keys:      []
});

/**
 * The body RegionalDataHandler returns for a diocesan PUT. `success` and `data`
 * are present in BOTH modes — that is exactly why neither may be trusted on its
 * own — so only `disposition` and `change_request` differ.
 *
 * @param {string} disposition
 * @returns {object}
 */
const putResponseBody = (disposition) => {
    const body = {
        success:     `Calendar data created for Diocese "${DIOCESE_NAME}" (Nation: "US")`,
        disposition,
        data:        {
            litcal:   [],
            metadata: {
                diocese_id:   DIOCESE_ID,
                diocese_name: DIOCESE_NAME,
                nation:       'US',
                locales:      ['en_US'],
                timezone:     'America/New_York'
            }
        }
    };
    if (disposition !== 'applied') {
        body.change_request = {
            batch_id:             'batch-501',
            review_status:        disposition,
            auto_approved:        disposition === 'approved',
            resource:             { type: 'diocesan_calendar', id: `roman/${DIOCESE_ID}` },
            paths:                [`jsondata/sourcedata/rite/roman/calendars/dioceses/US/${DIOCESE_ID}.json`],
            superseded_batch_ids: []
        };
    }
    return body;
};

/** What the stubbed fetch answers the write with; set by each test. */
let responseBody = putResponseBody('applied');

/** The toastr double extending.js reports through; replaced per test. */
let toastr;

/** The LitCalMetadata the module reads through the global binding; replaced per test. */
let litCalMetadata;

/** The Request the save actually issued, so a test can prove the write went out. */
let writeRequest;

/**
 * Put the globals extending.js expects in place, DOM included.
 *
 * extending.js resolves `LitCalMetadata`, `Messages`, `toastr`, `Auth`, `$` and
 * `fetch` through the global scope at CALL time, so swapping them between tests
 * is enough — the module itself is imported once (see beforeAll), because its
 * listeners are attached to `document` and a second import would double every
 * click handler.
 */
function installGlobals() {
    document.body.innerHTML = FIXTURE_HTML;

    litCalMetadata = freshMetadata();
    globalThis.LitCalMetadata = litCalMetadata;
    globalThis.Messages = {
        LOCALE:                        'en_US',
        LOCALE_WITH_REGION:            'en_US',
        AvailableLocales:              { en: 'English' },
        AvailableLocalesWithRegion:    { en_US: 'English (United States)' },
        CountriesWithCatholicDioceses: { US: 'United States' },
        DiocesesList:                  [{ country_iso: 'US', dioceses: [{ diocese_id: DIOCESE_ID, diocese_name: DIOCESE_NAME, province: 'Testland' }] }],
        Success:                       'Success',
        Error:                         'Error',
        'Pending Review':              'Pending review',
        writeSubmitted:                'Submitted for review as batch %s.',
        writeApproved:                 'Approved as batch %s, queued for publication.',
        writeSuperseded:               'Folded in: %s',
        writeUnknown:                  'Unrecognized outcome (%s).',
        'Modal - Delete diocesan calendar': 'Delete diocesan calendar',
        'If you choose':               'If you choose to delete this calendar…',
        CancelButton:                  'Cancel',
        DeleteCalendarButton:          'Delete calendar'
    };

    toastr = {
        options: {},
        success: vi.fn(),
        info:    vi.fn(),
        warning: vi.fn(),
        error:   vi.fn()
    };
    globalThis.toastr = toastr;
    globalThis.Auth = { isAuthenticated: () => true, refreshToken: vi.fn() };
    globalThis.bootstrap = {
        Carousel: class { static getInstance() { return { to() {} }; } },
        Modal:    { getInstance: () => null, getOrCreateInstance: () => ({ show() {}, hide() {} }) }
    };
    // extending.js only ever calls bootstrap-multiselect methods on jQuery
    // collections here; an inert chainable stand-in is enough, the same way
    // assets/js/__tests__/stubs/components-js.js stands in for the components.
    const jqStub = () => {
        const chain = { multiselect: () => chain, prop: () => chain, val: () => chain };
        return chain;
    };
    globalThis.$ = jqStub;
    globalThis.jQuery = jqStub;

    writeRequest = undefined;
    globalThis.fetch = vi.fn(async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        if (request.method === 'GET') {
            // The /missals load extending.js kicks off at module scope.
            return { ok: true, status: 200, json: async () => ({}) };
        }
        writeRequest = request;
        return { ok: true, status: 201, json: async () => responseBody };
    });
}

/** Yield to the macrotask queue so a fetch and its .then chain can settle. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Drive the page the way a user does: pick the diocese (which sets API.method to
 * PUT, since the fixture's diocese is not in LitCalMetadata), then click Save.
 */
async function saveDiocesanCalendar() {
    const dioceseInput = document.getElementById('diocesanCalendarDioceseName');
    dioceseInput.value = DIOCESE_NAME;
    dioceseInput.dispatchEvent(new Event('change', { bubbles: true }));

    document.getElementById('saveDiocesanCalendar_btn').dispatchEvent(new Event('click', { bubbles: true }));
    // Two turns: the fetch, then the .then chain that reads the parsed body.
    await settle();
    await settle();
}

describe('extending.js — diocesan save honours the write disposition', () => {
    beforeAll(async () => {
        installGlobals();
        await import('../extending.js');
        // Let the module-level /missals promise chain settle before driving the UI.
        await settle();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        installGlobals();
    });

    it('submitted: does NOT register the diocese in LitCalMetadata', async () => {
        responseBody = putResponseBody('submitted');
        await saveDiocesanCalendar();

        // The write did go out — this is a queued write, not a skipped one.
        expect(writeRequest?.method).toBe('PUT');

        // …and nothing about it reached the page's own state.
        expect(litCalMetadata.diocesan_calendars_keys).toEqual([]);
        expect(litCalMetadata.diocesan_calendars).toEqual([]);
        expect(litCalMetadata.national_calendars[0].dioceses).toEqual([]);

        // No Delete button for a diocese that does not exist, and no removal modal.
        expect(document.getElementById('removeExistingDiocesanDataBtn').disabled).toBe(true);
        expect(document.getElementById('removeDiocesanCalendarPrompt')).toBeNull();

        // The user is told what actually happened, and the handler's own
        // unconditional "created" string is not what they are told.
        expect(toastr.success).not.toHaveBeenCalled();
        expect(toastr.info).toHaveBeenCalledWith('Submitted for review as batch batch-501.', 'Pending review');
    });

    it('approved: also leaves LitCalMetadata alone — nothing is published yet', async () => {
        responseBody = putResponseBody('approved');
        await saveDiocesanCalendar();

        expect(litCalMetadata.diocesan_calendars_keys).toEqual([]);
        expect(litCalMetadata.national_calendars[0].dioceses).toEqual([]);
        expect(document.getElementById('removeExistingDiocesanDataBtn').disabled).toBe(true);
        expect(toastr.success).not.toHaveBeenCalled();
        expect(toastr.info).toHaveBeenCalledWith('Approved as batch batch-501, queued for publication.', 'Pending review');
    });

    it('applied: registers the diocese exactly as before', async () => {
        responseBody = putResponseBody('applied');
        await saveDiocesanCalendar();

        expect(litCalMetadata.diocesan_calendars_keys).toEqual([DIOCESE_ID]);
        expect(litCalMetadata.diocesan_calendars).toEqual([{
            calendar_id: DIOCESE_ID,
            diocese:     DIOCESE_NAME,
            nation:      'US',
            locales:     ['en_US'],
            timezone:    'America/New_York'
        }]);
        expect(litCalMetadata.national_calendars[0].dioceses).toEqual([DIOCESE_ID]);

        expect(document.getElementById('removeExistingDiocesanDataBtn').disabled).toBe(false);
        expect(document.getElementById('removeDiocesanCalendarPrompt')).not.toBeNull();

        expect(toastr.info).not.toHaveBeenCalled();
        expect(toastr.success).toHaveBeenCalledWith(responseBody.success, 'Success');
    });
});
