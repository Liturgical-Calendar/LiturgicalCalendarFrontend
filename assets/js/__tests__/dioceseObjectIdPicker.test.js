import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    diocesesByNation,
    diocesesOfNation,
    loadWorldDioceses,
    mountDioceseObjectIdPicker,
    nationOfDiocese,
    nationsWithDioceses
} from '../dioceseObjectIdPicker.js';

const WORLD = {
    catholic_dioceses_latin_rite: [
        { country_iso: 'us', dioceses: [
            { diocese_id: 'boston_us', diocese_name: 'Boston' },
            { diocese_id: 'albany_us', diocese_name: 'Albany' }
        ] },
        { country_iso: 'fr', dioceses: [{ diocese_id: 'paris_fr', diocese_name: 'Paris' }] },
        { country_iso: 'ca', dioceses: [{ diocese_id: 'charlo_ca', diocese_name: 'Charlottetown' }] },
        { country_iso: 'va', dioceses: [] }
    ]
};

const METADATA = {
    national_calendars_keys: ['VA', 'US', 'CA'],
    diocesan_calendars: [
        { calendar_id: 'boston_us', diocese: 'Archdiocese of Boston', nation: 'US', rite: 'roman' },
        { calendar_id: 'lugano_ch', diocese: 'Lugano', nation: 'CH', rite: 'ambrosian' },
        { calendar_id: 'milano_it', diocese: 'Milano', nation: 'IT', rite: 'ambrosian' }
    ]
};

const I18N = {
    selectNation: 'Select a nation...',
    selectDiocese: 'Select a diocese...',
    existingGroup: 'Existing diocesan calendars',
    newGroup: 'New diocesan calendars (not yet created)',
    diocesesUnavailable: 'Could not load the dioceses.',
    retry: 'Retry'
};

const DIOCESES = diocesesByNation(WORLD);

function riteSelect() {
    const el = document.createElement('select');
    for (const rite of ['roman', 'ambrosian']) {
        const o = document.createElement('option');
        o.value = rite;
        el.appendChild(o);
    }
    return el;
}

function mount(overrides = {}) {
    const container = document.createElement('div');
    document.body.replaceChildren(container);
    const riteEl = riteSelect();
    const picker = mountDioceseObjectIdPicker({
        mount: container,
        riteEl,
        metadata: METADATA,
        dioceses: DIOCESES,
        ...overrides,
        locale: 'en',
        nation: { className: 'perm-object-nation' },
        diocese: { className: 'perm-object-id' },
        i18n: I18N
    });
    return { container, riteEl, picker };
}

const optionValues = (select) => Array.from(select.options, o => o.value).filter(Boolean);
const groups = (select) => Array.from(select.querySelectorAll('optgroup'), g => [g.label, Array.from(g.children, o => o.value)]);

describe('nationsWithDioceses', () => {
    it('offers only nations with a national calendar and dioceses, never the Vatican', () => {
        expect(nationsWithDioceses(METADATA, DIOCESES, 'en').map(([code]) => code)).toEqual(['CA', 'US']);
    });

    it('offers nothing without metadata', () => {
        expect(nationsWithDioceses(undefined, DIOCESES, 'en')).toEqual([]);
    });
});

describe('diocesesOfNation', () => {
    it('splits existing calendars from those not yet created', () => {
        expect(diocesesOfNation(METADATA, DIOCESES, 'US', 'en')).toEqual({
            existing: [{ id: 'boston_us', name: 'Archdiocese of Boston' }],
            created: [{ id: 'albany_us', name: 'Albany' }]
        });
    });
});

describe('nationOfDiocese', () => {
    it('reads the nation from the calendar, the diocese list, or the id', () => {
        expect(nationOfDiocese(METADATA, DIOCESES, 'lugano_ch')).toBe('CH');
        expect(nationOfDiocese(METADATA, DIOCESES, 'albany_us')).toBe('US');
        expect(nationOfDiocese(METADATA, DIOCESES, 'nowhere_zz')).toBe('ZZ');
    });
});

describe('mountDioceseObjectIdPicker', () => {
    it('asks for a nation before offering its dioceses, grouped', () => {
        const { picker } = mount();
        expect(optionValues(picker.nationEl)).toEqual(['CA', 'US']);
        expect(picker.dioceseEl.disabled).toBe(true);

        picker.nationEl.value = 'US';
        picker.nationEl.dispatchEvent(new Event('change'));

        expect(picker.dioceseEl.disabled).toBe(false);
        expect(groups(picker.dioceseEl)).toEqual([
            ['Existing diocesan calendars', ['boston_us']],
            ['New diocesan calendars (not yet created)', ['albany_us']]
        ]);
        expect(picker.dioceseEl.value).toBe('');
    });

    it('never offers a diocese of a nation without a national calendar', () => {
        const { picker } = mount();
        expect(optionValues(picker.nationEl)).not.toContain('FR');
    });

    it('hides the nation step under the Ambrosian rite and offers its existing calendars', () => {
        const { riteEl, picker } = mount();
        riteEl.value = 'ambrosian';
        riteEl.dispatchEvent(new Event('change'));

        expect(picker.nationEl.parentElement.hidden).toBe(true);
        expect(picker.nationEl.required).toBe(false);
        expect(optionValues(picker.dioceseEl)).toEqual(['lugano_ch', 'milano_it']);
    });

    it('restores a stored diocese, nation and rite included', () => {
        const { riteEl, picker } = mount();
        picker.restore('roman', 'albany_us');
        expect(picker.nationEl.value).toBe('US');
        expect(picker.dioceseEl.value).toBe('albany_us');

        picker.restore('ambrosian', 'lugano_ch');
        expect(riteEl.value).toBe('ambrosian');
        expect(picker.dioceseEl.value).toBe('lugano_ch');
    });

    it('replaces what the mount held', () => {
        const { container } = mount();
        const again = mountDioceseObjectIdPicker({
            mount: container, riteEl: riteSelect(), metadata: METADATA, dioceses: DIOCESES, locale: 'en',
            nation: { className: 'perm-object-nation' }, diocese: { className: 'perm-object-id' }, i18n: I18N
        });
        expect(container.querySelectorAll('.perm-object-id')).toHaveLength(1);
        expect(again.dioceseEl.isConnected).toBe(true);
    });
});

describe('when the list of dioceses could not be loaded', () => {
    it('offers the existing calendars and says the rest are missing', () => {
        const { container, picker } = mount({ dioceses: null });
        const notice = container.querySelector('.dioceses-unavailable');
        expect(notice.hidden).toBe(false);
        expect(notice.textContent).toContain('Could not load the dioceses.');
        expect(notice.querySelector('button')).toBeNull(); // no loader, no retry

        expect(optionValues(picker.nationEl)).toEqual(['US']); // only the nation with an existing calendar
        picker.nationEl.value = 'US';
        picker.nationEl.dispatchEvent(new Event('change'));
        expect(groups(picker.dioceseEl)).toEqual([['Existing diocesan calendars', ['boston_us']]]);
    });

    it('hides the notice under the Ambrosian rite, which has no prospective dioceses', () => {
        const { container, riteEl } = mount({ dioceses: null });
        riteEl.value = 'ambrosian';
        riteEl.dispatchEvent(new Event('change'));
        expect(container.querySelector('.dioceses-unavailable').hidden).toBe(true);
    });

    it('restores the full list on a successful retry, keeping the choice made', async () => {
        const loadDioceses = vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(DIOCESES);
        const { container, picker } = mount({ dioceses: null, loadDioceses });
        picker.nationEl.value = 'US';
        picker.nationEl.dispatchEvent(new Event('change'));
        picker.dioceseEl.value = 'boston_us';
        const notice = container.querySelector('.dioceses-unavailable');
        const retry = notice.querySelector('button');

        retry.click();
        await vi.waitFor(() => expect(loadDioceses).toHaveBeenCalledTimes(1));
        await vi.waitFor(() => expect(retry.disabled).toBe(false));
        expect(notice.hidden).toBe(false); // still failing

        retry.click();
        await vi.waitFor(() => expect(notice.hidden).toBe(true));
        expect(optionValues(picker.nationEl)).toEqual(['CA', 'US']);
        expect(picker.nationEl.value).toBe('US');
        expect(picker.dioceseEl.value).toBe('boston_us');
        expect(groups(picker.dioceseEl)[1]).toEqual(['New diocesan calendars (not yet created)', ['albany_us']]);
    });
});

describe('loadWorldDioceses', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('degrades to no prospective dioceses when the list cannot be fetched, and retries later', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const failing = vi.fn(async () => ({ ok: false, status: 500 }));
        expect(await loadWorldDioceses(failing)).toBeNull();

        const working = vi.fn(async () => ({ ok: true, json: async () => WORLD }));
        expect((await loadWorldDioceses(working)).get('US')).toHaveLength(2);
        expect(working).toHaveBeenCalledTimes(1);
    });
});
