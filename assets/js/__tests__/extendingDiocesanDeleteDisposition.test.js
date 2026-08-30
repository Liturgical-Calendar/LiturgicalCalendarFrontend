/**
 * Regression test for issue #501, A2: a diocesan DELETE that was only queued for
 * review must not purge the calendar from the page's own metadata.
 *
 * `handleDeleteResponse()` gated on `response.ok` alone, ran its cleanup callback
 * first and only then parsed the body — so the `disposition` field was received
 * and discarded, and an editor was told "was deleted successfully" about a
 * calendar the API is still serving.
 *
 * Same shape as extendingDiocesanDisposition.test.js (issue #501, A1), in its own
 * file because the delete fixture must carry the removal modal that the save
 * fixture asserts the ABSENCE of.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// extending.js reads all of these at MODULE level; in the browser they are
// `const` declarations in classic scripts emitted by layout/footer.php.
vi.hoisted(() => {
    globalThis.EventsUrl       = 'http://localhost:8000/events';
    globalThis.MissalsUrl      = 'http://localhost:8000/missals';
    globalThis.RegionalDataUrl = 'http://localhost:8000/data';
    globalThis.LiturgicalEventCollection = [];
});

/** The diocese under test — present in LitCalMetadata, since it is being deleted. */
const DIOCESE_NAME = 'Diocese of Testville';
const DIOCESE_ID   = 'testville_us';

/**
 * Fixture mirroring extending.php?choice=diocesan with an existing calendar
 * loaded: the removal prompt modal is present, as templates.js renders it once
 * a diocese with stored data is picked.
 */
const FIXTURE_HTML = `
    <div id="overlay" class="hidden"></div>

    <select id="diocesanCalendarNationalDependency"><option value="US" selected>United States</option></select>
    <input type="text" id="diocesanCalendarDioceseName" list="DiocesesList" value="${DIOCESE_NAME}">
    <small id="diocesanCalendarDioceseNameHelp" class="form-text d-none"></small>
    <datalist id="DiocesesList">
        <option value="${DIOCESE_NAME}" data-value="${DIOCESE_ID}"></option>
    </datalist>

    <ul id="diocesanCalendarDefinitionCardLinks"></ul>
    <div id="carouselExampleIndicators"></div>
    <div id="diocesanOverridesContainer"></div>

    <input list="DiocesanGroupsList" id="diocesanCalendarGroup" value="">
    <select class="form-select currentLocalizationChoices" id="currentLocalizationDiocesan">
        <option value="en_US" selected>English (United States)</option>
    </select>
    <select class="calendarLocales" id="diocesanCalendarLocales" multiple>
        <option value="en_US" selected>English (United States)</option>
    </select>
    <select id="diocesanCalendarTimezone"><option value="America/New_York" selected>America/New_York</option></select>
    <form id="diocesanOverridesForm"></form>

    <div class="modal" id="removeDiocesanCalendarPrompt">
        <button type="button" id="deleteDiocesanCalendarConfirm">Delete calendar</button>
    </div>
`;

/** A fresh LitCalMetadata per test, with the diocese already registered. */
const freshMetadata = () => ({
    diocesan_calendars:      [{ calendar_id: DIOCESE_ID, diocese: DIOCESE_NAME, nation: 'US' }],
    diocesan_calendars_keys: [DIOCESE_ID],
    national_calendars:      [{ calendar_id: 'US', dioceses: [DIOCESE_ID] }],
    national_calendars_keys: ['US'],
    wider_regions:           [],
    wider_regions_keys:      []
});

/**
 * The body RegionalDataHandler returns for a DELETE. `success` is built
 * unconditionally in both modes, which is precisely why it cannot be echoed.
 *
 * @param {string} disposition
 * @returns {object}
 */
const deleteResponseBody = (disposition) => {
    const body = {
        success: `Calendar data "diocese/${DIOCESE_ID}" deletion successful.`,
        disposition
    };
    if (disposition !== 'applied') {
        body.change_request = {
            batch_id:             'batch-501',
            review_status:        disposition,
            auto_approved:        disposition === 'approved',
            resource:             { type: 'diocesan_calendar', id: `roman/${DIOCESE_ID}` },
            paths:                [`jsondata/sourcedata/rite/roman/calendars/dioceses/US/${DIOCESE_ID}.json`],
            superseded_batch_ids: ['batch-499']
        };
    }
    return body;
};

/** One tzdb entry, the shape extending.js maps over to build #diocesanCalendarTimezone. */
const TZDATA = [{
    name:            'America/New_York',
    alternativeName: 'Eastern Time',
    mainCities:      ['New York'],
    abbreviation:    'EST',
    countryCode:     'US'
}];

/** What the stubbed fetch answers the DELETE with; set by each test. */
let responseBody = deleteResponseBody('applied');

let toastr;
let litCalMetadata;

/** Put the globals extending.js resolves at call time in place, DOM included. */
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
        'Diocesan calendar deleted':   'Diocesan Calendar \'%s\' was deleted successfully',
        writeSubmitted:                'Submitted for review as batch %s.',
        writeApproved:                 'Approved as batch %s, queued for publication.',
        writeSuperseded:               'Folded in: %s',
        writeUnknown:                  'Unrecognized outcome (%s).'
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
        Modal:    {
            getInstance:         () => ({ show() {}, hide() {}, toggle() {} }),
            getOrCreateInstance: () => ({ show() {}, hide() {}, toggle() {} })
        }
    };
    const jqStub = () => {
        const chain = { multiselect: () => chain, prop: () => chain, val: () => chain };
        return chain;
    };
    globalThis.$ = jqStub;
    globalThis.jQuery = jqStub;

    globalThis.fetch = vi.fn(async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        if (request.method === 'GET') {
            // Two GETs fire at module scope on ?choice=diocesan: /missals, and the
            // tzdb dump the nation select rebuilds its timezone options from.
            const isTimezones = request.url.includes('raw-time-zones');
            return {
                ok:     true,
                status: 200,
                json:   async () => ( isTimezones ? TZDATA : {} )
            };
        }
        return { ok: true, status: 200, json: async () => responseBody };
    });
}

/** Yield to the macrotask queue so a fetch and its .then chain can settle. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/** Confirm the deletion the way a user does, from the removal prompt modal. */
async function confirmDelete() {
    document.getElementById('deleteDiocesanCalendarConfirm')
        .dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    await settle();
}

describe('extending.js — diocesan delete honours the write disposition', () => {
    beforeAll(async () => {
        // extending.js reads ?choice at module scope and only loads tzdata for the
        // diocesan page — which the applied cleanup path then rebuilds the timezone
        // select from, by resetting the nation select.
        window.history.replaceState({}, '', '/extending.php?choice=diocesan');
        installGlobals();
        await import('../extending.js');
        await settle();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        installGlobals();
    });

    it('submitted: does NOT purge the calendar from LitCalMetadata', async () => {
        responseBody = deleteResponseBody('submitted');
        await confirmDelete();

        // The calendar is still being served, so the page must still know about it.
        expect(litCalMetadata.diocesan_calendars_keys).toEqual([DIOCESE_ID]);
        expect(litCalMetadata.diocesan_calendars).toHaveLength(1);

        expect(toastr.success).not.toHaveBeenCalled();
        // …and the superseded batch is named rather than silently vanishing from
        // the editor's GET /auth/change-requests queue.
        expect(toastr.info).toHaveBeenCalledWith(
            'Submitted for review as batch batch-501. Folded in: batch-499',
            'Pending review'
        );
    });

    it('approved: also leaves LitCalMetadata alone', async () => {
        responseBody = deleteResponseBody('approved');
        await confirmDelete();

        expect(litCalMetadata.diocesan_calendars_keys).toEqual([DIOCESE_ID]);
        expect(toastr.success).not.toHaveBeenCalled();
        expect(toastr.info).toHaveBeenCalledWith(
            'Approved as batch batch-501, queued for publication. Folded in: batch-499',
            'Pending review'
        );
    });

    it('applied: purges the calendar exactly as before, with a localized message', async () => {
        responseBody = deleteResponseBody('applied');
        await confirmDelete();

        expect(litCalMetadata.diocesan_calendars_keys).toEqual([]);
        expect(litCalMetadata.diocesan_calendars).toEqual([]);

        expect(toastr.info).not.toHaveBeenCalled();
        expect(toastr.success).toHaveBeenCalledWith(
            `Diocesan Calendar '${DIOCESE_ID}' was deleted successfully`,
            'Success'
        );
    });
});
