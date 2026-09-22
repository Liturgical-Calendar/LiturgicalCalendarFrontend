/**
 * Tests for the `national_calendar` scope's nation picker.
 *
 * The regression it guards: the picker used to be a CalendarSelect filtered to
 * national calendars, which lists only nations whose calendar already exists,
 * so nobody could request the `admin` access needed to create a new one.
 */
import { describe, it, expect } from 'vitest';
import { buildNationObjectIdSelect, buildNationObjectIdSelectFromConfig } from '../nationObjectIdSelect.js';

const i18n = {
    placeholder:   'Select calendar ID...',
    existingGroup: 'Existing national calendars',
    newGroup:      'New national calendars (not yet created)'
};

// Display order, as CatholicNations::localized() emits it.
const nations = { BR: 'Brazil', FR: 'France', IT: 'Italy', US: 'United States' };

function build(existingIds, extra = {}) {
    return buildNationObjectIdSelect({
        nations,
        existingIds,
        locale:    'en',
        className: 'form-select perm-object-id',
        i18n,
        ...extra
    });
}

function groupValues(select, label) {
    const group = [...select.querySelectorAll('optgroup')].find(g => g.label === label);
    return group ? [...group.querySelectorAll('option')].map(o => o.value) : null;
}

describe('buildNationObjectIdSelect', () => {
    it('offers a nation whose calendar does not exist yet', () => {
        const select = build(['IT', 'US']);
        expect(groupValues(select, i18n.newGroup)).toEqual(['BR', 'FR']);
        select.value = 'FR';
        expect(select.value).toBe('FR');
    });

    it('lists the existing calendars in their own group, sorted by name', () => {
        const select = build(['US', 'IT']);
        expect(groupValues(select, i18n.existingGroup)).toEqual(['IT', 'US']);
    });

    it('names an existing calendar missing from the nation list (the Vatican)', () => {
        const select = build(['VA', 'US']);
        expect(groupValues(select, i18n.existingGroup)).toContain('VA');
        const va = select.querySelector('option[value="VA"]');
        expect(va.textContent).toMatch(/\(VA\)$/);
        expect(va.textContent).not.toBe('VA (VA)');
    });

    it('starts on a disabled, empty placeholder so a nation must be chosen', () => {
        const select = build(['US']);
        expect(select.required).toBe(true);
        expect(select.value).toBe('');
        const placeholder = select.options[0];
        expect(placeholder.disabled).toBe(true);
        expect(placeholder.textContent).toBe(i18n.placeholder);
    });

    it('offers every nation ungrouped when the existing calendars are unknown', () => {
        const select = build(null);
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect([...select.options].slice(1).map(o => o.value)).toEqual(['BR', 'FR', 'IT', 'US']);
    });

    it('omits an empty group', () => {
        const select = build([]);
        expect(groupValues(select, i18n.existingGroup)).toBeNull();
        expect(groupValues(select, i18n.newGroup)).toEqual(['BR', 'FR', 'IT', 'US']);
    });

    it('applies the class and id', () => {
        const select = build([], { id: 'grantObjectId', className: 'form-select' });
        expect(select.id).toBe('grantObjectId');
        expect(select.className).toBe('form-select');
    });
});

describe('buildNationObjectIdSelectFromConfig', () => {
    const config = {
        nations,
        i18n: {
            selectCalendarId:          'Choisir...',
            existingNationalCalendars: 'Existants',
            newNationalCalendars:      'Nouveaux'
        }
    };

    it('groups by the resolved client\'s metadata and uses the config labels', () => {
        const client = { _metadata: { national_calendars_keys: ['US'] } };
        const select = buildNationObjectIdSelectFromConfig(config, client, { locale: 'fr', className: 'form-select' });
        expect(select.options[0].textContent).toBe('Choisir...');
        expect(groupValues(select, 'Existants')).toEqual(['US']);
        expect(groupValues(select, 'Nouveaux')).toEqual(['BR', 'FR', 'IT']);
    });

    it('offers the full list ungrouped when the client failed to initialize', () => {
        const select = buildNationObjectIdSelectFromConfig(config, false, { locale: 'fr', className: 'form-select' });
        expect(select.querySelectorAll('optgroup')).toHaveLength(0);
        expect(select.options).toHaveLength(5);
    });

    it('falls back to English labels and an empty list when the config lacks them', () => {
        const select = buildNationObjectIdSelectFromConfig({}, false, { locale: 'en', className: 'form-select' });
        expect(select.options).toHaveLength(1);
        expect(select.options[0].textContent).toBe('Select calendar ID...');
    });
});
