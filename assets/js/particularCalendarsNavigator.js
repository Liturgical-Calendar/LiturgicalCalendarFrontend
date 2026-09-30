/**
 * The particular calendars navigator: the hub page of `extending.php` when it has no
 * `choice` (#66).
 *
 * It draws the tree `particularCalendarsTree.js` builds — wider regions, then the nations in
 * no region, then the Ambrosian dioceses — as a Bootstrap accordion, with a "My calendars" /
 * "Show all" toggle, a filter on labels, and each item's actions as links into the three
 * existing forms, the sanctorale editor, or the access-request form. A nation's dioceses that
 * have no calendar yet come from `WorldDiocesesByNation.json`, fetched on the first expansion
 * of a nation. See docs/superpowers/specs/2026-09-30-particular-calendars-navigator-design.md
 * Part 3.
 *
 * `renderNavigator()` is a pure function of its options; the page wiring at the bottom owns
 * the state (view, filter, expanded items, loaded dioceses) and re-renders on every change.
 *
 * @module particularCalendarsNavigator
 */

import { actionUrl, buildNavigatorTree, filterMine, nationDioceses } from './particularCalendarsTree.js';
import { loadWorldDioceses } from './dioceseObjectIdPicker.js';
import { nationOfLocale } from './widerRegionEditRights.js';

/** @typedef {import('./particularCalendarsTree.js').NavigatorNode} NavigatorNode */
/** @typedef {import('./particularCalendarsTree.js').NavigatorRights} NavigatorRights */

/** The two views. */
const VIEW_MINE = 'mine';
const VIEW_ALL = 'all';

/** Where the user's chosen view is remembered for the session. */
const VIEW_STORAGE_KEY = 'litcal.particularCalendarsNavigator.view';

/** The English strings, used for any key the page's `messages` lacks. */
const DEFAULT_MESSAGES = {
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
    'Navigator - No match': 'No calendars match the filter',
};

/** The label key of each action button (`sanctorale` takes the Missal ids as `%1$s`). */
const ACTION_LABEL_KEYS = {
    edit: 'Navigator - Edit',
    create: 'Navigator - Create',
    translate: 'Navigator - Translate',
    sanctorale: 'Navigator - Proper of Saints',
    request: 'Navigator - Request access',
};

/** The button style of each action: the primary ones filled, the rest outlined. */
const ACTION_CLASSES = {
    edit: 'btn-primary',
    create: 'btn-success',
    translate: 'btn-outline-primary',
    sanctorale: 'btn-outline-primary',
    request: 'btn-outline-secondary',
};

/**
 * @param {string} text
 * @returns {string} `text`, lower-cased and without diacritics, for matching
 */
function normalize(text) {
    return String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

/**
 * Keeps the nodes whose label contains `filter` (case- and accent-insensitive), each with its
 * whole subtree, plus the ancestors needed to reach them (marked `filterAncestor: true`).
 * @param {NavigatorNode[]} nodes
 * @param {string} filter
 * @returns {NavigatorNode[]} `nodes` itself when the filter is blank
 */
export function filterTree(nodes, filter) {
    const needle = normalize(filter).trim();
    if (needle === '') return nodes;

    const visit = (node) => {
        if (normalize(node.label).includes(needle)) return node;
        const children = (node.children ?? []).map(visit).filter((child) => child !== null);
        if (children.length === 0) return null;
        return { ...node, children, filterAncestor: true };
    };
    return (nodes ?? []).map(visit).filter((node) => node !== null);
}

/**
 * The view the hub opens in: the one remembered for this session, else "Show all" for a global
 * admin and "My calendars" for everyone else.
 * @param {NavigatorRights|undefined} rights
 * @param {string|null} remembered - The value stored in `sessionStorage`, if any
 * @returns {'mine'|'all'}
 */
export function defaultView(rights, remembered) {
    if (remembered === VIEW_MINE || remembered === VIEW_ALL) return remembered;
    return rights?.isGlobalAdmin === true ? VIEW_ALL : VIEW_MINE;
}

/**
 * The locale each region's Translate action opens: the region's first locale of a member
 * nation whose calendar the user edits, else the first locale of that nation's own calendar
 * (a national editor may add it to the region). A region with neither is left out, and its
 * Translate action opens the region without a locale.
 * @param {NavigatorNode[]} tree - The full tree (not a filtered one), for the region members
 * @param {object} metadata - `/calendars` `litcal_metadata`
 * @param {NavigatorRights|undefined} rights
 * @returns {Object<string, string>} Region id => locale
 */
export function translateLocales(tree, metadata, rights) {
    const edited = new Set(
        [...(rights?.editor?.national_calendar ?? []), ...(rights?.admin?.national_calendar ?? [])]
            .filter((id) => id.startsWith('roman/'))
            .map((id) => id.slice('roman/'.length)),
    );
    const regionLocales = new Map(
        (metadata?.wider_regions ?? []).map((region) => [region.id ?? region.name, region.locales ?? []]),
    );
    const nationLocales = new Map(
        (metadata?.national_calendars ?? []).map((calendar) => [calendar.calendar_id, calendar.locales ?? []]),
    );

    const result = {};
    for (const node of tree ?? []) {
        if (node.kind !== 'region' || !node.actions.includes('translate')) continue;
        const members = node.children.map((child) => child.id).filter((iso) => edited.has(iso));
        const locale = (regionLocales.get(node.id) ?? []).find((l) => members.includes(nationOfLocale(l)))
            ?? members.map((iso) => nationLocales.get(iso)?.[0]).find(Boolean);
        if (locale) result[node.id] = locale;
    }
    return result;
}

/**
 * @param {Object<string,string>} messages
 * @param {string} key
 * @param {...string} args - Values for `%1$s`, `%2$s`, …
 * @returns {string}
 */
function t(messages, key, ...args) {
    const template = messages?.[key] ?? DEFAULT_MESSAGES[key] ?? key;
    return args.reduce((text, arg, i) => text.replaceAll(`%${i + 1}$s`, arg), template);
}

/**
 * @param {string} tag
 * @param {Object<string, string|boolean>} [attrs] - `class`, `text`, and attributes; `false` omits one
 * @param {Array<Node|string|null>} [children]
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
        if (value === false || value === undefined || value === null) continue;
        if (name === 'class') element.className = value;
        else if (name === 'text') element.textContent = value;
        else element.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children) {
        if (child !== null && child !== undefined) element.append(child);
    }
    return element;
}

/**
 * @param {string} key
 * @returns {string} `key` made safe for an element id
 */
function domId(key) {
    return `pcn-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

/**
 * A status dot: ● for a created calendar, ○ for one not yet created, with a text alternative.
 * @param {NavigatorNode} node
 * @param {Object<string,string>} messages
 * @returns {HTMLElement}
 */
function statusDot(node, messages) {
    return el('span', { class: `pcn-status ${node.exists ? 'pcn-status-created' : 'pcn-status-pending'}` }, [
        el('span', { 'aria-hidden': 'true', text: node.exists ? '●' : '○' }),
        el('span', { class: 'visually-hidden', text: t(messages, node.exists ? 'Navigator - Created' : 'Navigator - Not yet created') }),
    ]);
}

/**
 * @param {NavigatorNode} node
 * @param {object} options - See renderNavigator()
 * @returns {HTMLElement|null} The node's action links, or null for a node kept only for context
 */
function actionButtons(node, options) {
    if (node.context) return null;
    const { messages } = options;
    const wrapper = el('div', { class: 'pcn-actions' });
    for (const action of node.actions) {
        const label = action === 'sanctorale'
            ? t(messages, ACTION_LABEL_KEYS.sanctorale, (node.missals ?? []).join(', '))
            : t(messages, ACTION_LABEL_KEYS[action]);
        const btnClass = `btn btn-sm ${ACTION_CLASSES[action]}`;

        if (action === 'create' && node.disabledReason) {
            const reason = t(messages, `Navigator - ${node.disabledReason}`);
            wrapper.append(el('a', {
                class: `${btnClass} disabled`,
                role: 'link',
                'aria-disabled': 'true',
                title: reason,
            }, [label, el('span', { class: 'visually-hidden', text: ` (${reason})` })]));
            continue;
        }

        let href;
        if (action === 'translate') {
            const locale = options.translateLocales?.[node.id];
            href = locale ? actionUrl(node, 'translate', { locale }) : actionUrl(node, 'edit');
        } else {
            href = actionUrl(node, action);
        }
        wrapper.append(el('a', { class: btnClass, href, text: label }));
    }
    return wrapper;
}

/**
 * @param {Map<string, boolean>} expanded
 * @param {string} key
 * @param {boolean} fallback
 * @returns {boolean}
 */
function isExpanded(expanded, key, fallback) {
    return expanded.has(key) ? expanded.get(key) : fallback;
}

/**
 * A diocese row (also used for the Ambrosian group's dioceses).
 * @param {NavigatorNode} node
 * @param {object} options
 * @returns {HTMLElement}
 */
function dioceseItem(node, options) {
    return el('li', {
        class: `list-group-item pcn-item${node.context ? ' pcn-context' : ''}`,
        'data-kind': node.kind,
        'data-id': node.id,
    }, [
        el('div', { class: 'pcn-row' }, [
            el('div', { class: 'pcn-row-main' }, [
                statusDot(node, options.messages),
                el('span', { class: 'pcn-label', text: node.label }),
            ]),
            actionButtons(node, options),
        ]),
    ]);
}

/**
 * A nation row, with its dioceses in a collapsible list.
 * @param {NavigatorNode} node
 * @param {string} parentId - The region or group it is placed under (a nation can be under several)
 * @param {object} options
 * @returns {HTMLElement}
 */
function nationItem(node, parentId, options) {
    const { messages, view, expanded, dioceseState } = options;
    const key = `n:${parentId}/${node.id}`;
    const pending = view === VIEW_ALL && node.childrenPending === true;
    const expandable = node.children.length > 0 || pending;
    // While filtering, the way to a match is always open, whatever the user closed before.
    const defaultOpen = view === VIEW_MINE && node.children.length > 0;
    const open = expandable && (node.filterAncestor === true || isExpanded(expanded, key, defaultOpen));
    const listId = domId(key);

    const item = el('li', {
        class: `list-group-item pcn-item${node.context ? ' pcn-context' : ''}`,
        'data-kind': node.kind,
        'data-id': node.id,
    });

    const main = el('div', { class: 'pcn-row-main' });
    if (expandable) {
        const toggle = el('button', {
            type: 'button',
            class: 'btn btn-sm btn-link pcn-toggle',
            'aria-expanded': String(open),
            'aria-controls': listId,
            'aria-label': t(messages, 'Navigator - Dioceses of', node.label),
        }, [el('i', { class: 'fas fa-chevron-right', 'aria-hidden': 'true' })]);
        toggle.addEventListener('click', () => {
            const nowOpen = toggle.getAttribute('aria-expanded') !== 'true';
            expanded.set(key, nowOpen);
            toggle.setAttribute('aria-expanded', String(nowOpen));
            item.querySelector(`#${listId}`).hidden = !nowOpen;
            if (nowOpen && pending && dioceseState.get(node.id) !== 'loading') {
                options.onExpandNation(node, key);
            }
        });
        main.append(toggle);
    } else {
        main.append(el('span', { class: 'pcn-toggle-spacer', 'aria-hidden': 'true' }));
    }
    main.append(
        statusDot(node, messages),
        el('span', { class: 'pcn-label', text: node.label }),
        el('code', { class: 'pcn-code', text: node.id }),
    );
    if (node.note === 'no-missal') {
        main.append(el('small', { class: 'pcn-note', text: t(messages, 'Navigator - No national Missal data') }));
    }
    item.append(el('div', { class: 'pcn-row' }, [main, actionButtons(node, options)]));

    if (expandable) {
        const list = el('ul', { class: 'list-group list-group-flush pcn-dioceses', id: listId });
        list.hidden = !open;
        if (pending) {
            const state = dioceseState.get(node.id);
            if (state === 'loading') {
                list.append(el('li', { class: 'list-group-item pcn-loading', role: 'status' }, [
                    el('span', { class: 'spinner-border spinner-border-sm me-2', 'aria-hidden': 'true' }),
                    t(messages, 'Navigator - Loading'),
                ]));
            } else if (state === 'failed') {
                const retry = el('button', {
                    type: 'button',
                    class: 'btn btn-sm btn-outline-danger ms-2',
                    text: t(messages, 'Navigator - Retry'),
                });
                retry.addEventListener('click', () => options.onExpandNation(node, key));
                list.append(el('li', { class: 'list-group-item list-group-item-danger pcn-load-failed', role: 'alert' }, [
                    t(messages, 'Navigator - Could not load the dioceses'),
                    retry,
                ]));
            }
        }
        for (const child of node.children) list.append(dioceseItem(child, options));
        item.append(list);
    }
    return item;
}

/**
 * One accordion item: a region, or the `no-region` / `ambrosian` group.
 * @param {NavigatorNode} node
 * @param {object} options
 * @returns {HTMLElement}
 */
function accordionItem(node, options) {
    const { messages, view, filter, expanded } = options;
    const key = `r:${node.id}`;
    const collapseId = domId(key);
    const headerId = `${collapseId}-header`;
    const filterActive = String(filter ?? '').trim() !== '';
    // While filtering, the way to a match is always open, whatever the user closed before.
    const open = (filterActive && node.filterAncestor === true)
        || isExpanded(expanded, key, view === VIEW_MINE || filterActive);
    const isGroup = node.kind === 'group';
    const label = isGroup ? t(messages, `Navigator - ${node.id}`) : node.label;

    const button = el('button', {
        class: `accordion-button${open ? '' : ' collapsed'}`,
        type: 'button',
        'data-bs-toggle': 'collapse',
        'data-bs-target': `#${collapseId}`,
        'aria-expanded': String(open),
        'aria-controls': collapseId,
    }, [isGroup ? null : statusDot(node, messages), el('span', { class: 'pcn-label', text: label })]);

    const body = el('div', { class: 'accordion-body p-0' });
    if (!isGroup) {
        const actions = actionButtons(node, options);
        if (actions) body.append(el('div', { class: 'pcn-row pcn-region-actions' }, [el('div', { class: 'pcn-row-main' }), actions]));
    }
    const list = el('ul', { class: 'list-group list-group-flush' });
    for (const child of node.children) {
        list.append(child.kind === 'nation' ? nationItem(child, node.id, options) : dioceseItem(child, options));
    }
    body.append(list);

    const collapse = el('div', {
        id: collapseId,
        class: `accordion-collapse collapse${open ? ' show' : ''}`,
        'aria-labelledby': headerId,
    }, [body]);
    // Bootstrap toggles the collapse itself; remember the choice across re-renders.
    collapse.addEventListener('show.bs.collapse', (ev) => { if (ev.target === collapse) expanded.set(key, true); });
    collapse.addEventListener('hide.bs.collapse', (ev) => { if (ev.target === collapse) expanded.set(key, false); });

    return el('div', {
        class: `accordion-item${node.context ? ' pcn-context' : ''}`,
        'data-kind': node.kind,
        'data-id': node.id,
    }, [el('h2', { class: 'accordion-header', id: headerId }, [button]), collapse]);
}

/**
 * @param {object} options
 * @returns {HTMLElement} The view toggle and the filter
 */
function toolbar(options) {
    const { messages, view, filter } = options;
    const viewButton = (value, key) => {
        const button = el('button', {
            type: 'button',
            class: `btn btn-sm ${view === value ? 'btn-primary' : 'btn-outline-primary'}`,
            'aria-pressed': String(view === value),
            text: t(messages, key),
        });
        button.addEventListener('click', () => { if (view !== value) options.onToggleView(value); });
        return button;
    };

    const input = el('input', {
        type: 'search',
        class: 'form-control form-control-sm pcn-filter',
        placeholder: t(messages, 'Navigator - Filter'),
        'aria-label': t(messages, 'Navigator - Filter'),
    });
    input.value = filter ?? '';
    input.addEventListener('input', () => options.onFilter?.(input.value));

    return el('div', { class: 'pcn-toolbar' }, [
        el('div', { class: 'btn-group pcn-view-toggle', role: 'group' }, [
            viewButton(VIEW_MINE, 'Navigator - My calendars'),
            viewButton(VIEW_ALL, 'Navigator - Show all'),
        ]),
        input,
    ]);
}

/**
 * Draws the navigator into `container`, replacing what it held.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @param {NavigatorNode[]} options.tree - The full tree from `buildNavigatorTree()`
 * @param {'mine'|'all'} options.view
 * @param {string} options.filter - Text to filter labels by; blank for none
 * @param {Object<string,string>} options.messages - The `Navigator - …` strings from `includes/messages.php`
 * @param {(view: 'mine'|'all') => void} options.onToggleView
 * @param {(nation: NavigatorNode, key: string) => void} options.onExpandNation - Called when a
 *   nation whose not-yet-created dioceses are not loaded is expanded, or on Retry
 * @param {(filter: string) => void} [options.onFilter]
 * @param {Map<string, boolean>} [options.expanded] - Items the user opened or closed, by key
 *   (`r:{region id}`, `n:{region id}/{ISO}`); updated in place as the user toggles
 * @param {Map<string, 'loading'|'failed'>} [options.dioceseState] - By nation ISO code
 * @param {Object<string,string>} [options.translateLocales] - See translateLocales()
 * @returns {void}
 */
export function renderNavigator(container, options) {
    const opts = {
        ...options,
        expanded: options.expanded ?? new Map(),
        dioceseState: options.dioceseState ?? new Map(),
    };
    const { messages, view, filter } = opts;

    // Keep the filter's focus and caret across the re-render its own input triggers.
    const previousFilter = container.querySelector('.pcn-filter');
    const filterFocused = previousFilter !== null && previousFilter === document.activeElement;
    const caret = filterFocused ? previousFilter.selectionStart : null;

    const viewTree = view === VIEW_MINE ? filterMine(opts.tree) : opts.tree;
    const nodes = filterTree(viewTree, filter);

    const content = [toolbar(opts)];
    if (view === VIEW_MINE && viewTree.length === 0) {
        const browse = el('button', {
            type: 'button',
            class: 'btn btn-primary btn-sm',
            text: t(messages, 'Navigator - Browse all calendars'),
        });
        browse.addEventListener('click', () => opts.onToggleView(VIEW_ALL));
        content.push(el('div', { class: 'pcn-empty' }, [el('p', { text: t(messages, 'Navigator - Empty') }), browse]));
    } else if (nodes.length === 0) {
        content.push(el('p', { class: 'pcn-no-match', role: 'status', text: t(messages, 'Navigator - No match') }));
    } else {
        content.push(el('div', { class: 'accordion pcn-accordion' }, nodes.map((node) => accordionItem(node, opts))));
    }
    container.replaceChildren(...content);

    if (filterFocused) {
        const input = container.querySelector('.pcn-filter');
        input.focus();
        if (caret !== null) input.setSelectionRange(caret, caret);
    }
}

/**
 * @returns {string|null} The remembered view, or null (also when storage is unavailable)
 */
function readStoredView() {
    try {
        return window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * @param {string} view
 * @returns {void}
 */
function storeView(view) {
    try {
        window.sessionStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
        // storage unavailable (private mode, blocked): the choice lasts only this page
    }
}

/**
 * The nations whose dioceses must be loaded up front: those holding a not-yet-created Roman
 * diocese the user administers, which "My calendars" could not list otherwise.
 * @param {NavigatorRights} rights
 * @param {object} metadata
 * @returns {string[]} The bare ids of the Roman dioceses the user administers that metadata does not list
 */
function unknownAdministeredDioceses(rights, metadata) {
    const known = new Set((metadata?.diocesan_calendars ?? []).map((c) => c.calendar_id));
    return (rights?.admin?.diocesan_calendar ?? [])
        .filter((id) => id.startsWith('roman/'))
        .map((id) => id.slice('roman/'.length))
        .filter((id) => !known.has(id));
}

/**
 * Wires the hub: state, re-rendering, the session-remembered view, and diocese loading.
 * @param {HTMLElement} container
 * @param {{metadata: object, prospectiveRegions: object[], nations: Object<string,string>,
 *   missals: Object<string,string[]>, rights: NavigatorRights, uiLocale: string,
 *   messages: Object<string,string>}} config - `window.ParticularCalendarsConfig`
 * @returns {void}
 */
function initNavigator(container, config) {
    const dioceses = new Map();
    const state = {
        view: defaultView(config.rights, readStoredView()),
        filter: '',
        expanded: new Map(),
        dioceseState: new Map(),
    };
    let tree = [];
    let locales = {};

    const rebuild = () => {
        tree = buildNavigatorTree({ ...config, dioceses });
        locales = translateLocales(tree, config.metadata, config.rights);
    };

    const render = () => renderNavigator(container, {
        tree,
        view: state.view,
        filter: state.filter,
        messages: config.messages,
        expanded: state.expanded,
        dioceseState: state.dioceseState,
        translateLocales: locales,
        onToggleView: (view) => {
            state.view = view;
            storeView(view);
            render();
        },
        onFilter: (filter) => {
            state.filter = filter;
            render();
        },
        onExpandNation: async (nation, key) => {
            state.dioceseState.set(nation.id, 'loading');
            state.expanded.set(key, true);
            render();
            const world = await loadWorldDioceses();
            if (world === null) {
                state.dioceseState.set(nation.id, 'failed');
            } else {
                state.dioceseState.delete(nation.id);
                dioceses.set(nation.id, nationDioceses(nation.id, world));
                rebuild();
            }
            render();
        },
    });

    rebuild();
    render();

    const unknown = unknownAdministeredDioceses(config.rights, config.metadata);
    if (unknown.length > 0) {
        loadWorldDioceses().then((world) => {
            if (world === null) return;
            for (const [iso, list] of world) {
                if (list.some((d) => unknown.includes(d.id))) dioceses.set(iso, nationDioceses(iso, world));
            }
            rebuild();
            render();
        });
    }
}

const navigatorContainer = typeof document !== 'undefined'
    ? document.getElementById('particularCalendarsNavigator')
    : null;
if (navigatorContainer && typeof window.ParticularCalendarsConfig === 'object' && window.ParticularCalendarsConfig !== null) {
    initNavigator(navigatorContainer, window.ParticularCalendarsConfig);
}
