/**
 * Tests for the particular calendars navigator's renderer (#66): the hub page drawn from a
 * `particularCalendarsTree.js` tree, with its "My calendars" / "Show all" views, its filter,
 * its per-item actions, and its on-demand diocese loading.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNavigatorTree } from '../particularCalendarsTree.js';
import {
    defaultView,
    filterTree,
    renderNavigator,
    translateLocales,
} from '../particularCalendarsNavigator.js';

// The same shapes as particularCalendarsTree.test.js: national IT and NL (both declaring
// `europe`), IT with a Missal edition and NL without, a Roman diocese roma_it and an Ambrosian
// lugano_ch, the existing region europe, and a prospective nordic.
const METADATA = {
    national_calendars: [
        { calendar_id: 'IT', wider_regions: ['europe'], locales: ['it_IT'] },
        { calendar_id: 'NL', wider_regions: ['europe'], locales: ['nl_NL'] },
    ],
    diocesan_calendars: [
        { calendar_id: 'roma_it', diocese: 'Roma', nation: 'IT', rite: 'roman' },
        { calendar_id: 'lugano_ch', diocese: 'Lugano', nation: 'CH', rite: 'ambrosian' },
    ],
    wider_regions: [
        { id: 'europe', label: 'Europe', roster: ['IT', 'NL', 'SE'], locales: ['en_IE', 'it_IT', 'nl_NL'] },
    ],
};

const PROSPECTIVE_REGIONS = [{ id: 'nordic', label: 'Nordic', roster: ['SE', 'DK'] }];

const NATIONS = { IT: 'Italy', NL: 'Netherlands', SE: 'Sweden', DK: 'Denmark', FR: 'France', CH: 'Switzerland' };

const MISSALS = { IT: ['IT_1983'] };

const MESSAGES = {
    'Navigator - My calendars': 'My calendars',
    'Navigator - Show all': 'Show all',
    'Navigator - Filter': 'Filter',
    'Navigator - Not yet created': 'Not yet created',
    'Navigator - Created': 'Created',
    'Navigator - Edit': 'Edit',
    'Navigator - Create': 'Create',
    'Navigator - Translate': 'Translate',
    'Navigator - Proper of Saints': 'Proper of Saints (%1$s)',
    'Navigator - Request access': 'Request access',
    'Navigator - No national Missal data': 'No national Missal data: the national calendar alone defines it',
    'Navigator - nation-missing': 'Create the national calendar first',
    'Navigator - no-region': 'Nations in no wider region',
    'Navigator - ambrosian': 'Ambrosian rite',
    'Navigator - Could not load the dioceses': 'Could not load the dioceses',
    'Navigator - Retry': 'Retry',
    'Navigator - Empty': 'You have no particular calendars yet',
    'Navigator - Browse all calendars': 'Browse all calendars',
    'Navigator - Dioceses of': 'Dioceses of %1$s',
    'Navigator - Loading': 'Loading…',
};

function rights({ isGlobalAdmin = false, admin = {}, editor = {} } = {}) {
    return {
        isGlobalAdmin,
        admin: { national_calendar: [], diocesan_calendar: [], wider_region: [], ...admin },
        editor: { national_calendar: [], diocesan_calendar: [], wider_region: [], ...editor },
    };
}

/** An editor of Italy's national calendar (admin implies editor, so `editor` alone is enough). */
const IT_EDITOR = rights({ editor: { national_calendar: ['roman/IT'] } });

function tree(theRights, dioceses = new Map()) {
    return buildNavigatorTree({
        metadata: METADATA,
        prospectiveRegions: PROSPECTIVE_REGIONS,
        nations: NATIONS,
        missals: MISSALS,
        rights: theRights,
        dioceses,
        uiLocale: 'en',
    });
}

function render(options) {
    const container = document.createElement('div');
    document.body.append(container);
    renderNavigator(container, {
        view: 'all',
        filter: '',
        messages: MESSAGES,
        onToggleView: () => {},
        onExpandNation: () => {},
        ...options,
    });
    return container;
}

/** The rows of every node with this kind and id, wherever they are placed. */
function rows(container, kind, id) {
    return [...container.querySelectorAll(`[data-kind="${kind}"][data-id="${id}"]`)];
}

/**
 * The action labels of a row, as a screen reader would read the buttons: its first action bar
 * is its own (a region's sits atop its body, before the nations; a nation's before its dioceses).
 */
function actionLabels(row) {
    return [...(row.querySelector('.pcn-actions')?.querySelectorAll('a') ?? [])]
        .map((a) => a.textContent.trim());
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('renderNavigator — My calendars vs Show all, for an IT editor', () => {
    it('My calendars lists Italy (Edit, Proper of Saints) and Europe (Translate), and not France', () => {
        const container = render({ tree: tree(IT_EDITOR), view: 'mine' });

        const [italy] = rows(container, 'nation', 'IT');
        expect(italy).toBeTruthy();
        expect(actionLabels(italy)).toEqual(['Edit', 'Proper of Saints (IT_1983)']);

        const [europe] = rows(container, 'region', 'europe');
        expect(actionLabels(europe)).toEqual(['Translate']);

        expect(rows(container, 'nation', 'FR')).toHaveLength(0);
        expect(rows(container, 'nation', 'NL')).toHaveLength(0);
    });

    it('Show all also lists France and the Netherlands, offering Request access', () => {
        const container = render({ tree: tree(IT_EDITOR), view: 'all' });

        const [france] = rows(container, 'nation', 'FR');
        expect(actionLabels(france)).toEqual(['Request access']);
        expect(france.querySelector('a').getAttribute('href'))
            .toBe('permission-requests.php?object_type=national_calendar&object_id=roman%2FFR');

        expect(rows(container, 'nation', 'NL')).toHaveLength(1);
    });

    it('marks the pressed view button', () => {
        const container = render({ tree: tree(IT_EDITOR), view: 'mine' });
        const [mine, all] = container.querySelectorAll('.pcn-view-toggle button');
        expect(mine.getAttribute('aria-pressed')).toBe('true');
        expect(all.getAttribute('aria-pressed')).toBe('false');
    });

    it('calls onToggleView with the other view', () => {
        const onToggleView = vi.fn();
        const container = render({ tree: tree(IT_EDITOR), view: 'mine', onToggleView });
        container.querySelectorAll('.pcn-view-toggle button')[1].click();
        expect(onToggleView).toHaveBeenCalledWith('all');
    });

    it('links Translate to the region with the editor\'s locale', () => {
        const t = tree(IT_EDITOR);
        const container = render({
            tree: t,
            view: 'mine',
            translateLocales: translateLocales(t, METADATA, IT_EDITOR),
        });
        const [europe] = rows(container, 'region', 'europe');
        expect(europe.querySelector('.pcn-actions a').getAttribute('href'))
            .toBe('extending.php?choice=widerRegion&calendar=europe&locale=it_IT');
    });
});

describe('renderNavigator — a nation\'s two editors', () => {
    it('offers Proper of Saints only on Italy', () => {
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })) });
        const proper = [...container.querySelectorAll('a')].filter((a) => a.textContent.includes('Proper of Saints'));
        expect(proper.length).toBeGreaterThan(0);
        for (const a of proper) {
            expect(a.closest('[data-kind="nation"]').dataset.id).toBe('IT');
            expect(a.getAttribute('href')).toBe('sanctorale.php#rite=roman&calendar=IT');
        }
    });

    it('notes that the Netherlands has no national Missal data, and Italy does not', () => {
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })) });
        const [netherlands] = rows(container, 'nation', 'NL');
        expect(netherlands.querySelector(':scope > .pcn-row').textContent)
            .toContain('No national Missal data: the national calendar alone defines it');
        const [italy] = rows(container, 'nation', 'IT');
        expect(italy.querySelector(':scope > .pcn-row').textContent).not.toContain('No national Missal data');
    });

    it('shows each nation\'s status dot with a text alternative, and its ISO code', () => {
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })) });
        const [italy] = rows(container, 'nation', 'IT');
        const [sweden] = rows(container, 'nation', 'SE');
        expect(italy.querySelector('.pcn-row').textContent).toContain('Created');
        expect(italy.querySelector('.pcn-code').textContent).toBe('IT');
        expect(sweden.querySelector('.pcn-row').textContent).toContain('Not yet created');
    });
});

describe('renderNavigator — a disabled Create', () => {
    it('gives its reason as a title and as visually-hidden text', () => {
        // An admin of a diocese of Sweden, which has no national calendar.
        const theRights = rights({ admin: { diocesan_calendar: ['roman/stockh_se'] } });
        const dioceses = new Map([['SE', [{ id: 'stockh_se', name: 'Stockholm' }]]]);
        const container = render({ tree: tree(theRights, dioceses), view: 'mine' });

        const [stockholm] = rows(container, 'diocese', 'stockh_se');
        const create = stockholm.querySelector('.pcn-actions .disabled');
        expect(create).toBeTruthy();
        expect(create.hasAttribute('href')).toBe(false);
        expect(create.getAttribute('aria-disabled')).toBe('true');
        expect(create.getAttribute('title')).toBe('Create the national calendar first');
        expect(create.querySelector('.visually-hidden').textContent).toContain('Create the national calendar first');
    });
});

describe('renderNavigator — groups', () => {
    it('localizes the group labels', () => {
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })) });
        const headers = [...container.querySelectorAll('.accordion-button')].map((b) => b.textContent.trim());
        expect(headers).toContain('Nations in no wider region');
        expect(headers).toContain('Ambrosian rite');
    });

    it('keeps the groups collapsed under Show all', () => {
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })) });
        for (const collapse of container.querySelectorAll('.accordion-collapse')) {
            expect(collapse.classList.contains('show')).toBe(false);
        }
    });
});

describe('filterTree', () => {
    it('keeps the ancestors of a match, and nothing else', () => {
        const filtered = filterTree(tree(rights({ isGlobalAdmin: true })), 'ital');
        expect(filtered.map((n) => n.id)).toEqual(['europe']);
        expect(filtered[0].children.map((n) => n.id)).toEqual(['IT']);
    });

    it('is case- and accent-insensitive', () => {
        const filtered = filterTree(tree(rights({ isGlobalAdmin: true })), 'LUGÁNO');
        expect(filtered.map((n) => n.id)).toEqual(['ambrosian']);
        expect(filtered[0].children.map((n) => n.id)).toEqual(['lugano_ch']);
    });

    it('keeps a matching node\'s whole subtree', () => {
        const filtered = filterTree(tree(rights({ isGlobalAdmin: true })), 'europe');
        expect(filtered[0].children.map((n) => n.id)).toEqual(['IT', 'NL', 'SE']);
    });

    it('returns the tree unchanged for an empty filter', () => {
        const t = tree(rights({ isGlobalAdmin: true }));
        expect(filterTree(t, '  ')).toBe(t);
    });
});

describe('renderNavigator — filter', () => {
    it('renders only the matches and their ancestors, expanded', () => {
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })), filter: 'roma' });
        expect(rows(container, 'diocese', 'roma_it')).toHaveLength(1);
        expect(rows(container, 'nation', 'IT')).toHaveLength(1);
        expect(rows(container, 'nation', 'NL')).toHaveLength(0);
        const [europe] = rows(container, 'region', 'europe');
        expect(europe.querySelector('.accordion-collapse').classList.contains('show')).toBe(true);
        const [italy] = rows(container, 'nation', 'IT');
        expect(italy.querySelector('.pcn-dioceses').hidden).toBe(false);
    });

    it('calls onFilter as the user types', () => {
        const onFilter = vi.fn();
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })), onFilter });
        const input = container.querySelector('input[type="search"]');
        input.value = 'fra';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(onFilter).toHaveBeenCalledWith('fra');
    });
});

describe('renderNavigator — empty My calendars', () => {
    it('shows a message and a button that switches to Show all', () => {
        const onToggleView = vi.fn();
        const container = render({ tree: tree(rights()), view: 'mine', onToggleView });
        expect(container.textContent).toContain('You have no particular calendars yet');
        const browse = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Browse all calendars'));
        browse.click();
        expect(onToggleView).toHaveBeenCalledWith('all');
    });
});

describe('renderNavigator — expanding a nation', () => {
    it('asks for the dioceses on first expansion', () => {
        const onExpandNation = vi.fn();
        const container = render({ tree: tree(rights({ isGlobalAdmin: true })), onExpandNation });
        const [italy] = rows(container, 'nation', 'IT');
        const toggle = italy.querySelector('.pcn-toggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(onExpandNation).toHaveBeenCalledTimes(1);
        expect(onExpandNation.mock.calls[0][0].id).toBe('IT');
    });

    it('does not ask again once the dioceses are loaded', () => {
        const onExpandNation = vi.fn();
        const dioceses = new Map([['IT', [{ id: 'torino_it', name: 'Torino' }]]]);
        const container = render({ tree: tree(rights({ isGlobalAdmin: true }), dioceses), onExpandNation });
        const [italy] = rows(container, 'nation', 'IT');
        italy.querySelector('.pcn-toggle').click();
        expect(onExpandNation).not.toHaveBeenCalled();
        expect(rows(container, 'diocese', 'torino_it')).toHaveLength(1);
    });

    it('on failure, shows Retry and still lists the created dioceses', () => {
        const onExpandNation = vi.fn();
        const t = tree(rights({ isGlobalAdmin: true }));
        const expanded = new Map([['n:europe/IT', true]]);
        const container = render({
            tree: t,
            expanded,
            dioceseState: new Map([['IT', 'failed']]),
            onExpandNation,
        });
        const [italy] = rows(container, 'nation', 'IT');
        const dioceses = italy.querySelector('.pcn-dioceses');
        expect(dioceses.hidden).toBe(false);
        expect(dioceses.textContent).toContain('Could not load the dioceses');
        expect(rows(container, 'diocese', 'roma_it')).toHaveLength(1);

        const retry = [...dioceses.querySelectorAll('button')].find((b) => b.textContent.includes('Retry'));
        retry.click();
        expect(onExpandNation).toHaveBeenCalledTimes(1);
        expect(onExpandNation.mock.calls[0][0].id).toBe('IT');
    });
});

describe('defaultView', () => {
    it('is Show all for a global admin and My calendars otherwise, unless remembered', () => {
        expect(defaultView(rights({ isGlobalAdmin: true }), null)).toBe('all');
        expect(defaultView(IT_EDITOR, null)).toBe('mine');
        expect(defaultView(IT_EDITOR, 'all')).toBe('all');
        expect(defaultView(IT_EDITOR, 'bogus')).toBe('mine');
    });
});

describe('translateLocales', () => {
    it('picks the region\'s first locale of a nation the user edits', () => {
        expect(translateLocales(tree(IT_EDITOR), METADATA, IT_EDITOR)).toEqual({ europe: 'it_IT' });
    });

    it('falls back to the nation\'s own calendar locale when the region has none of its locales yet', () => {
        const metadata = {
            ...METADATA,
            wider_regions: [{ ...METADATA.wider_regions[0], locales: ['en_IE'] }],
        };
        const t = buildNavigatorTree({
            metadata, prospectiveRegions: [], nations: NATIONS, missals: MISSALS, rights: IT_EDITOR, uiLocale: 'en',
        });
        expect(translateLocales(t, metadata, IT_EDITOR)).toEqual({ europe: 'it_IT' });
    });
});
