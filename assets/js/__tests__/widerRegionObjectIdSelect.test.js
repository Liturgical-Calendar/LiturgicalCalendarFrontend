/**
 * Tests for the `wider_region` scope's picker (#591).
 *
 * The regression it guards: the picker offered a fixed list of five continents,
 * so a region created under any other name could not be granted, and Africa and
 * Oceania were offered although no such region existed.
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
};

const prospective = [
    {
        name: 'Nordic',
        description: 'Nordic Episcopal Conference',
        roster: ['DK', 'SE', 'NO', 'FI', 'IS'],
        locales: [],
    },
    {
        name: 'Southern Africa',
        description: '',
        roster: ['ZA', 'BW', 'SZ'],
        locales: [],
    },
];

const existing = [
    {
        name: 'Europe',
        locales: ['it_IT'],
        api_path: '/data/widerregion/Europe',
        national_calendars: ['IT', 'NL'],
        roster: ['IT', 'NL', 'DE'],
    },
    {
        name: 'Americas',
        locales: ['en_US'],
        api_path: '/data/widerregion/Americas',
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

    it('groups existing regions (sorted) apart from prospective ones', () => {
        const select = build(existing);
        const groups = select.querySelectorAll('optgroup');
        expect(groups).toHaveLength(2);
        expect(groups[0].label).toBe(i18n.existingGroup);
        expect(Array.from(groups[0].children, (o) => o.value)).toEqual([
            'Americas',
            'Europe',
        ]);
        expect(groups[1].label).toBe(i18n.newGroup);
        expect(Array.from(groups[1].children, (o) => o.value)).toEqual([
            'Nordic',
            'Southern Africa',
        ]);
    });

    it('never offers the old continents that do not exist', () => {
        const all = values(build(existing));
        expect(all).not.toContain('Africa');
        expect(all).not.toContain('Oceania');
        expect(all).not.toContain('Asia');
    });

    it('lists a prospective region that now exists only once, as existing', () => {
        const withNordic = [
            ...existing,
            {
                name: 'Nordic',
                locales: ['da_DK'],
                api_path: '',
                national_calendars: [],
                roster: ['DK', 'SE'],
            },
        ];
        const select = build(withNordic);
        expect(values(select).filter((v) => v === 'Nordic')).toHaveLength(1);
        expect(groupOf(select, 'Nordic').label).toBe(i18n.existingGroup);
    });

    it('labels an option with its roster and a prospective one with its description as title', () => {
        const select = build(existing);
        expect(select.querySelector('option[value="Europe"]').textContent).toBe(
            'Europe (IT, NL, DE)',
        );
        const nordic = select.querySelector('option[value="Nordic"]');
        expect(nordic.textContent).toBe('Nordic (DK, SE, NO, FI, IS)');
        expect(nordic.title).toBe('Nordic Episcopal Conference');
        expect(
            select
                .querySelector('option[value="Southern Africa"]')
                .hasAttribute('title'),
        ).toBe(false);
    });

    it('falls back to national_calendars, then to the bare name, when no roster is published', () => {
        const older = [
            {
                name: 'Europe',
                locales: [],
                api_path: '',
                national_calendars: ['IT'],
            },
            { name: 'Asia', locales: [], api_path: '' },
        ];
        const select = build(older);
        expect(select.querySelector('option[value="Europe"]').textContent).toBe(
            'Europe (IT)',
        );
        expect(select.querySelector('option[value="Asia"]').textContent).toBe(
            'Asia',
        );
    });

    it('lists the prospective regions ungrouped when metadata is unknown', () => {
        const select = build(null);
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect(values(select)).toEqual(['Nordic', 'Southern Africa']);
    });

    it('omits an empty group', () => {
        const allExist = prospective.map((p) => ({
            name: p.name,
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
        expect(values(select)).toEqual(['Nordic', 'Southern Africa']);
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
