/**
 * Tests for the `wider_region` scope's picker (#591, #1018).
 *
 * The regression it guards: the picker offered a fixed list of five continents,
 * so a region created under any other name could not be granted, and Africa and
 * Oceania were offered although no such region existed. Since #1018 a region is
 * identified by a permanent id (the option value) and shown by its label (the
 * option text) — an API older than #1018 that publishes only `name` still works.
 */
import { describe, it, expect } from 'vitest';
import {
    buildWiderRegionObjectIdSelect,
    buildWiderRegionObjectIdSelectFromConfig,
    WIDER_REGION_TYPE,
} from '../widerRegionObjectIdSelect.js';

const i18n = {
    placeholder: 'Select calendar ID...',
    existingGroup: 'Existing wider regions',
    newGroup: 'New wider regions (not yet created)',
    nations: '%d nations',
};

const prospective = [
    {
        id: 'nordic',
        label: 'Nordic Countries',
        labels: { en: 'Nordic Countries' },
        m49: null,
        description: 'Nordic Episcopal Conference',
        roster: ['DK', 'SE', 'NO', 'FI', 'IS'],
        locales: [],
    },
    {
        id: 'southern-africa',
        label: 'Southern Africa',
        labels: { en: 'Southern Africa' },
        m49: null,
        description: '',
        roster: ['ZA', 'BW', 'SZ'],
        locales: [],
    },
];

// Shaped like an API #1018 `/calendars` wider region item: `id`, `label`, and a
// deprecated `name` alias of `id`.
const existing = [
    {
        id: 'europe',
        label: 'Europe',
        name: 'europe',
        locales: ['it_IT'],
        api_path: '/data/widerregion/europe',
        national_calendars: ['IT', 'NL'],
        roster: ['IT', 'NL', 'DE'],
    },
    {
        id: 'americas',
        label: 'Americas',
        name: 'americas',
        locales: ['en_US'],
        api_path: '/data/widerregion/americas',
        national_calendars: ['US'],
        roster: ['US', 'CA'],
    },
];

function build(existingRegions, extra = {}) {
    return buildWiderRegionObjectIdSelect({
        prospective,
        existing: existingRegions,
        locale: 'en',
        className: 'form-select perm-object-id',
        i18n,
        ...extra,
    });
}

const values = (select) =>
    Array.from(
        select.querySelectorAll('option:not([value=""])'),
        (o) => o.value,
    );
const groupOf = (select, value) =>
    select.querySelector(`option[value="${value}"]`).parentElement;

describe('buildWiderRegionObjectIdSelect', () => {
    it('is the wider_region scope', () => {
        expect(WIDER_REGION_TYPE).toBe('wider_region');
    });

    it('starts with a disabled, selected placeholder and is required', () => {
        const select = build(existing, { id: 'grantObjectId' });
        expect(select.required).toBe(true);
        expect(select.id).toBe('grantObjectId');
        expect(select.className).toBe('form-select perm-object-id');
        const first = select.options[0];
        expect(first.value).toBe('');
        expect(first.disabled).toBe(true);
        expect(first.selected).toBe(true);
        expect(first.textContent).toBe(i18n.placeholder);
    });

    it('groups existing regions (sorted by label) apart from prospective ones, values as ids', () => {
        const select = build(existing);
        const groups = select.querySelectorAll('optgroup');
        expect(groups).toHaveLength(2);
        expect(groups[0].label).toBe(i18n.existingGroup);
        expect(Array.from(groups[0].children, (o) => o.value)).toEqual([
            'americas',
            'europe',
        ]);
        expect(groups[1].label).toBe(i18n.newGroup);
        expect(Array.from(groups[1].children, (o) => o.value)).toEqual([
            'nordic',
            'southern-africa',
        ]);
    });

    it('never offers the old continents that do not exist', () => {
        const all = values(build(existing));
        expect(all).not.toContain('africa');
        expect(all).not.toContain('oceania');
        expect(all).not.toContain('asia');
    });

    it('lists a prospective region that now exists only once, as existing, keyed by id', () => {
        const withNordic = [
            ...existing,
            {
                id: 'nordic',
                label: 'Nordic Countries',
                name: 'nordic',
                locales: ['da_DK'],
                api_path: '',
                national_calendars: [],
                roster: ['DK', 'SE'],
            },
        ];
        const select = build(withNordic);
        expect(values(select).filter((v) => v === 'nordic')).toHaveLength(1);
        expect(groupOf(select, 'nordic').label).toBe(i18n.existingGroup);
    });

    it('labels an option with its roster (≤6 codes) and a prospective one with its description as title', () => {
        const select = build(existing);
        expect(select.querySelector('option[value="europe"]').textContent).toBe(
            'Europe (IT, NL, DE)',
        );
        const nordic = select.querySelector('option[value="nordic"]');
        expect(nordic.textContent).toBe('Nordic Countries (DK, SE, NO, FI, IS)');
        expect(nordic.title).toBe('Nordic Episcopal Conference');
        expect(
            select
                .querySelector('option[value="southern-africa"]')
                .hasAttribute('title'),
        ).toBe(false);
    });

    it('shows a nation count instead of the code list above 6 nations', () => {
        const bigRegion = [
            {
                id: 'europe',
                label: 'Europe',
                name: 'europe',
                locales: [],
                api_path: '',
                roster: Array.from({ length: 54 }, (_, i) => `N${i}`),
            },
        ];
        const select = build(bigRegion);
        expect(select.querySelector('option[value="europe"]').textContent).toBe(
            'Europe (54 nations)',
        );
    });

    it('falls back to national_calendars, then to no parenthetical, when no roster is published', () => {
        const older = [
            {
                id: 'europe',
                label: 'Europe',
                name: 'europe',
                locales: [],
                api_path: '',
                national_calendars: ['IT'],
            },
            { id: 'asia', label: 'Asia', name: 'asia', locales: [], api_path: '' },
        ];
        const select = build(older);
        expect(select.querySelector('option[value="europe"]').textContent).toBe(
            'Europe (IT)',
        );
        expect(select.querySelector('option[value="asia"]').textContent).toBe(
            'Asia',
        );
    });

    it('falls back to name for an older API that publishes no id/label', () => {
        const older = [
            { name: 'Europe', locales: [], api_path: '', national_calendars: ['IT'] },
        ];
        const select = build(older);
        const option = select.querySelector('option[value="Europe"]');
        expect(option).not.toBeNull();
        expect(option.textContent).toBe('Europe (IT)');
    });

    it('lists the prospective regions ungrouped when metadata is unknown', () => {
        const select = build(null);
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect(values(select)).toEqual(['nordic', 'southern-africa']);
    });

    it('omits an empty group', () => {
        const allExist = prospective.map((p) => ({
            id: p.id,
            label: p.label,
            name: p.id,
            locales: [],
            api_path: '',
            roster: p.roster,
        }));
        const select = build(allExist);
        const groups = select.querySelectorAll('optgroup');
        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe(i18n.existingGroup);
    });
});

describe('buildWiderRegionObjectIdSelectFromConfig', () => {
    const config = {
        prospectiveWiderRegions: prospective,
        i18n: {
            selectCalendarId: 'Pick one',
            existingWiderRegions: 'Existing',
            newWiderRegions: 'New',
            widerRegionNations: '%d nations',
        },
    };

    it('reads the prospective list and labels from config, existing regions from the client', () => {
        const select = buildWiderRegionObjectIdSelectFromConfig(
            config,
            { _metadata: { wider_regions: existing } },
            {
                locale: 'en',
                className: 'form-select',
                id: 'grantObjectId',
            },
        );
        expect(select.options[0].textContent).toBe('Pick one');
        expect(
            Array.from(select.querySelectorAll('optgroup'), (g) => g.label),
        ).toEqual(['Existing', 'New']);
    });

    it('is ungrouped when the client failed to initialize', () => {
        const select = buildWiderRegionObjectIdSelectFromConfig(config, false, {
            locale: 'en',
            className: 'form-select',
        });
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect(values(select)).toEqual(['nordic', 'southern-africa']);
    });

    it('uses English defaults when config lacks labels and prospective regions', () => {
        const select = buildWiderRegionObjectIdSelectFromConfig(
            {},
            { _metadata: { wider_regions: existing } },
            {
                locale: 'en',
                className: 'form-select',
            },
        );
        expect(select.options[0].textContent).toBe('Select calendar ID...');
        expect(
            Array.from(select.querySelectorAll('optgroup'), (g) => g.label),
        ).toEqual(['Existing wider regions']);
    });
});
