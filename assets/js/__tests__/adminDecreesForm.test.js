/**
 * Unit tests for the form-collection and action-visibility helpers exported
 * from admin-decrees.js.
 *
 * The vitest environment is jsdom (see vitest.config.js), so DOM APIs are
 * available without a browser.
 *
 * window.AdminDecreesConfig must be in place BEFORE the module is imported,
 * because admin-decrees.js evaluates `const config = window.AdminDecreesConfig`
 * and the MONTH_NAMES IIFE at module-load time. We use vi.hoisted() to inject
 * the stub before any import is resolved.
 */

import { describe, it, expect, vi } from 'vitest';

// vi.hoisted() runs before module imports — the only way to set globals that
// module-level code (executed at import time) depends on.
vi.hoisted(() => {
    globalThis.window = globalThis;
    globalThis.bootstrap = {
        Modal: { getOrCreateInstance: vi.fn(() => ({ show: vi.fn() })) },
    };
    globalThis.window.AdminDecreesConfig = {
        apiUrl:        'http://localhost:8000',
        locale:        'en-US',
        isGlobalAdmin: false,
        userSub:       '',
        i18n: {
            loading:           'Loading…',
            noAccess:          'No access.',
            loadFailed:        'Load failed.',
            noDecrees:         'No decrees.',
            confirmDelete:     'Confirm delete?',
            created:           'Created.',
            updated:           'Updated.',
            deleted:           'Deleted.',
            translations:      'Translations',
            readings:          'Lectionary readings',
            newDecree:         'New Decree',
            editDecree:        'Edit Decree',
            selectLocale:      'Select locale',
            removeRow:         'Remove',
            langCodeVatican:   'Vatican URL code',
            duplicateLangCode: 'Duplicate language code "%s" — each language may appear only once',
            firstReading:      'First reading',
            responsorialPsalm: 'Responsorial psalm',
            secondReading:     'Second reading (optional)',
            gospelAcclamation: 'Gospel acclamation',
            gospel:            'Gospel',
            validationErrors:  'Please fix the following errors:',
            sinceYear:         'Since %s',
            sourceLink:        'Source',
            sessionExpired:    'Your session has expired. Please log in again.',
            loginLink:         'Log in',
            permissionDenied:  'You do not have permission to perform this action.',
            eventKeyNew:       'Not in the General Roman Calendar — a new event will be created.',
            eventKeyCollision: 'Already in the General Roman Calendar as "%s" — choose another key.',
            eventKeyMissing:   'Not in the General Roman Calendar — this decree will not match any event.',
            eventKeyMatch:     'Matches "%s" in the General Roman Calendar.',
        },
    };
});

import {
    collectFormValues,
    applyActionVisibility,
    reverseMapAction,
    addUrlLangRow,
    aggregateUrlCodeSuggestions,
    prefillI18nRows,
    prefillReadingsGroups,
    findUrlLangDuplicateErrors,
    describeEventKeyHint,
    syncEventKeyHint,
} from '../admin-decrees.js';
import { DecreeAction } from '../DecreePayload.js';

// ---- helpers ---------------------------------------------------------------

/**
 * Build a minimal form element that mirrors the PHP form markup so that
 * collectFormValues() can extract all expected fields.
 *
 * @returns {HTMLFormElement}
 */
function buildForm({
    action   = DecreeAction.CreateNew,
    decreeId = 'StTest_Create',
    eventKey = 'StTest',
    eventType = 'fixed',
    day      = '14',
    month    = '2',
    grade    = '2',
    colors   = ['white'],
    commons  = ['Pastors'],
    baseLocale = 'en_US',
    baseName   = 'Saint Test',
    sinceYear  = '2025',
    url        = 'https://www.vatican.va/test.html',
} = {}) {
    const form = document.createElement('form');
    form.id = 'decreeEditorForm';

    const field = (name, type, value) => {
        const el = document.createElement('input');
        el.name  = name;
        el.type  = type;
        el.value = value;
        return el;
    };

    // Action
    const actionSel = document.createElement('select');
    actionSel.name = 'action';
    [
        DecreeAction.CreateNew,
        DecreeAction.MakeDoctor,
        DecreeAction.SetPropertyName,
        DecreeAction.SetPropertyGrade,
    ].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.selected = v === action;
        actionSel.appendChild(opt);
    });
    form.appendChild(actionSel);

    form.appendChild(field('decree_id',       'text', decreeId));
    form.appendChild(field('decree_date',     'date', '2025-01-01'));
    form.appendChild(field('decree_protocol', 'text', 'Prot. N. 1/25'));
    form.appendChild(field('description',     'text', 'Test decree.'));
    form.appendChild(field('event_key',       'text', eventKey));
    form.appendChild(field('since_year',      'number', sinceYear));
    form.appendChild(field('url',             'url', url));

    // event_type radios
    const radioFixed  = field('event_type', 'radio', 'fixed');
    radioFixed.checked = eventType === 'fixed';
    const radioMobile = field('event_type', 'radio', 'mobile');
    radioMobile.checked = eventType === 'mobile';
    form.appendChild(radioFixed);
    form.appendChild(radioMobile);

    form.appendChild(field('day',   'number', day));
    form.appendChild(field('month', 'number', month));
    form.appendChild(field('strtotime_day_of_the_week', 'text', eventType === 'mobile' ? 'Monday' : ''));
    form.appendChild(field('strtotime_relative_time',   'text', eventType === 'mobile' ? 'after' : ''));
    form.appendChild(field('strtotime_event_key',       'text', eventType === 'mobile' ? 'Pentecost' : ''));

    // Grade (createNew)
    const gradeSel = document.createElement('select');
    gradeSel.name = 'grade';
    for (let g = 0; g <= 7; g++) {
        const opt = document.createElement('option');
        opt.value = String(g);
        opt.selected = String(g) === grade;
        gradeSel.appendChild(opt);
    }
    form.appendChild(gradeSel);

    // grade_set (setProperty:grade)
    const gradeSetSel = document.createElement('select');
    gradeSetSel.name = 'grade_set';
    for (let g = 0; g <= 7; g++) {
        const opt = document.createElement('option');
        opt.value = String(g);
        opt.selected = String(g) === '3';
        gradeSetSel.appendChild(opt);
    }
    form.appendChild(gradeSetSel);

    // Color multi-select
    const colorSel = document.createElement('select');
    colorSel.name = 'color';
    colorSel.multiple = true;
    ['white', 'red', 'green', 'purple', 'rose'].forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.selected = colors.includes(c);
        colorSel.appendChild(opt);
    });
    form.appendChild(colorSel);

    // Common multi-select
    const commonSel = document.createElement('select');
    commonSel.name = 'common';
    commonSel.multiple = true;
    ['Proper', 'Pastors', 'Martyrs', 'Doctors', 'Holy Men and Women'].forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.selected = commons.includes(c);
        commonSel.appendChild(opt);
    });
    form.appendChild(commonSel);

    // Base i18n row
    const baseRow = document.createElement('div');
    baseRow.className = 'i18n-row';
    baseRow.setAttribute('data-base-row', 'true');

    const baseOpt = document.createElement('option');
    baseOpt.id    = 'i18nBaseLocaleOption';
    baseOpt.value = baseLocale;
    baseOpt.textContent = baseLocale;
    const baseLocSel = document.createElement('select');
    baseLocSel.name = 'i18n_locale[]';
    baseLocSel.disabled = true;
    baseLocSel.appendChild(baseOpt);
    baseRow.appendChild(baseLocSel);

    const baseNameInp = document.createElement('input');
    baseNameInp.name  = 'i18n_name[]';
    baseNameInp.value = baseName;
    baseRow.appendChild(baseNameInp);

    const i18nRows = document.createElement('div');
    i18nRows.id = 'i18nRows';
    i18nRows.appendChild(baseRow);
    form.appendChild(i18nRows);

    return form;
}

// ---- collectFormValues tests -----------------------------------------------

describe('collectFormValues — createNew', () => {
    it('collects action, decree_id, event_key', () => {
        const form = buildForm();
        const v = collectFormValues(form);
        expect(v.action).toBe(DecreeAction.CreateNew);
        expect(v.decree_id).toBe('StTest_Create');
        expect(v.event_key).toBe('StTest');
    });

    it('collects event_type=fixed with day/month', () => {
        const form = buildForm({ eventType: 'fixed', day: '14', month: '2' });
        const v = collectFormValues(form);
        expect(v.event_type).toBe('fixed');
        expect(v.day).toBe('14');
        expect(v.month).toBe('2');
    });

    it('collects event_type=mobile with a structured strtotime object', () => {
        const form = buildForm({ eventType: 'mobile' });
        const v = collectFormValues(form);
        expect(v.event_type).toBe('mobile');
        expect(v.strtotime).toEqual({
            day_of_the_week: 'Monday',
            relative_time: 'after',
            event_key: 'Pentecost',
        });
    });

    it('collects selected colors as array', () => {
        const form = buildForm({ colors: ['white', 'red'] });
        const v = collectFormValues(form);
        expect(v.color).toEqual(['white', 'red']);
    });

    it('collects selected commons as array', () => {
        const form = buildForm({ commons: ['Pastors', 'Martyrs'] });
        const v = collectFormValues(form);
        expect(v.common).toEqual(['Pastors', 'Martyrs']);
    });

    it('collects an empty common array when nothing is selected', () => {
        const form = buildForm({ commons: [] });
        const v = collectFormValues(form);
        expect(v.common).toEqual([]);
    });

    it('collects base i18n locale+name from pre-added row', () => {
        const form = buildForm({ baseLocale: 'en_US', baseName: 'Saint Test' });
        const v = collectFormValues(form);
        expect(v.i18n).toEqual({ en_US: 'Saint Test' });
    });

    it('returns undefined i18n when base name is empty', () => {
        const form = buildForm({ baseName: '' });
        const v = collectFormValues(form);
        expect(v.i18n).toBeUndefined();
    });

    it('collects url and since_year', () => {
        const form = buildForm({ sinceYear: '2025', url: 'https://www.vatican.va/test.html' });
        const v = collectFormValues(form);
        expect(v.since_year).toBe('2025');
        expect(v.url).toBe('https://www.vatican.va/test.html');
    });
});

describe('collectFormValues — setProperty:grade', () => {
    it('reads grade from grade_set select instead of grade', () => {
        const form = buildForm({ action: DecreeAction.SetPropertyGrade });
        // grade_set defaults to '3' in buildForm
        const v = collectFormValues(form);
        expect(v.grade).toBe('3');
    });
});

describe('collectFormValues — additional i18n rows', () => {
    it('collects additional locale rows added to i18nRows', () => {
        const form = buildForm({ baseLocale: 'en_US', baseName: 'Saint Test' });
        const i18nRows = form.querySelector('#i18nRows');

        // Add an extra row
        const row = document.createElement('div');
        row.className = 'i18n-row';

        const locSel = document.createElement('select');
        locSel.name = 'i18n_locale[]';
        const opt = document.createElement('option');
        opt.value = 'it_IT';
        opt.selected = true;
        locSel.appendChild(opt);
        row.appendChild(locSel);

        const nameInp = document.createElement('input');
        nameInp.name  = 'i18n_name[]';
        nameInp.value = 'Santo Test';
        row.appendChild(nameInp);

        i18nRows.appendChild(row);

        const v = collectFormValues(form);
        expect(v.i18n).toEqual({ en_US: 'Saint Test', it_IT: 'Santo Test' });
    });
});

describe('collectFormValues — readings groups', () => {
    it('collects readings groups (locale, fields)', () => {
        const form = buildForm();

        // Build a readings group manually
        const group = document.createElement('div');
        group.className = 'readings-group';

        const locSel = document.createElement('select');
        locSel.name = 'readings_locale[]';
        const opt = document.createElement('option');
        opt.value = 'en_US';
        opt.selected = true;
        locSel.appendChild(opt);
        group.appendChild(locSel);

        const addInput = (name, value) => {
            const inp = document.createElement('input');
            inp.name  = name;
            inp.value = value;
            group.appendChild(inp);
        };
        addInput('first_reading[]',      'Gen 1:1');
        addInput('responsorial_psalm[]', 'Ps 1');
        addInput('second_reading[]',     '');
        addInput('gospel_acclamation[]', 'Jn 1:1');
        addInput('gospel[]',             'Jn 1:1-14');

        form.appendChild(group);

        const v = collectFormValues(form);
        expect(v.readings).toBeDefined();
        expect(v.readings['en_US'].first_reading).toBe('Gen 1:1');
        expect(v.readings['en_US'].gospel).toBe('Jn 1:1-14');
        expect('second_reading' in v.readings['en_US']).toBe(false);
    });

    it('includes second_reading when non-empty', () => {
        const form = buildForm();
        const group = document.createElement('div');
        group.className = 'readings-group';

        const locSel = document.createElement('select');
        locSel.name = 'readings_locale[]';
        const opt = document.createElement('option');
        opt.value = 'en_US';
        opt.selected = true;
        locSel.appendChild(opt);
        group.appendChild(locSel);

        ['first_reading[]', 'responsorial_psalm[]', 'gospel_acclamation[]', 'gospel[]'].forEach((n) => {
            const inp = document.createElement('input');
            inp.name  = n;
            inp.value = 'reading value';
            group.appendChild(inp);
        });
        const secondInp = document.createElement('input');
        secondInp.name  = 'second_reading[]';
        secondInp.value = 'Rom 8:1';
        group.appendChild(secondInp);

        form.appendChild(group);

        const v = collectFormValues(form);
        expect(v.readings['en_US'].second_reading).toBe('Rom 8:1');
    });

    it('skips a readings group with no locale selected', () => {
        const form = buildForm();
        const group = document.createElement('div');
        group.className = 'readings-group';

        const locSel = document.createElement('select');
        locSel.name = 'readings_locale[]';
        // No option selected — value will be ''
        locSel.appendChild(document.createElement('option'));
        group.appendChild(locSel);

        form.appendChild(group);

        const v = collectFormValues(form);
        expect(v.readings).toBeUndefined();
    });
});

// ---- applyActionVisibility tests -------------------------------------------

describe('applyActionVisibility', () => {
    /**
     * Build a form with the structural blocks the toggle function expects.
     *
     * @returns {HTMLFormElement}
     */
    function buildBlockForm() {
        const form = document.createElement('form');

        // createNew block (event details)
        const createBlock = document.createElement('fieldset');
        createBlock.className = 'action-block action-createNew';
        form.appendChild(createBlock);

        // setPropertyGrade block
        const gradeBlock = document.createElement('fieldset');
        gradeBlock.className = 'action-block action-setPropertyGrade';
        form.appendChild(gradeBlock);

        // common block (needs-common) — starts hidden
        const commonBlock = document.createElement('fieldset');
        commonBlock.className = 'action-block needs-common d-none';
        form.appendChild(commonBlock);

        // i18n block
        const i18nBlock = document.createElement('fieldset');
        i18nBlock.className = 'action-block needs-i18n';
        form.appendChild(i18nBlock);

        // readings block
        const readingsBlock = document.createElement('fieldset');
        readingsBlock.className = 'action-block needs-readings';
        form.appendChild(readingsBlock);

        return form;
    }

    it('createNew: shows createNew+common+i18n+readings, hides grade block', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.CreateNew, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-common').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(false);
    });

    it('makeDoctor: shows common+i18n, hides createNew+grade+readings blocks', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.MakeDoctor, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-common').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });

    it('setProperty:name: shows i18n, hides createNew+grade+common+readings blocks', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.SetPropertyName, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-common').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });

    it('setProperty:grade: hides createNew+common+i18n+readings, shows grade block', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.SetPropertyGrade, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-common').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });

    it('unknown action: hides all blocks (graceful fallback)', () => {
        const form = buildBlockForm();
        applyActionVisibility('unknownAction', form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-common').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });
});

// ---- reverseMapAction tests -------------------------------------------------

describe('reverseMapAction', () => {
    it('returns the action unchanged when no property is present', () => {
        expect(reverseMapAction('createNew', undefined)).toBe('createNew');
        expect(reverseMapAction('makeDoctor', undefined)).toBe('makeDoctor');
    });

    it('combines action and property into compound form', () => {
        expect(reverseMapAction('setProperty', 'grade')).toBe('setProperty:grade');
        expect(reverseMapAction('setProperty', 'name')).toBe('setProperty:name');
    });

    it('round-trips through DecreeAction values', () => {
        // Verify the output matches what the form select uses
        expect(reverseMapAction('setProperty', 'grade')).toBe(DecreeAction.SetPropertyGrade);
        expect(reverseMapAction('setProperty', 'name')).toBe(DecreeAction.SetPropertyName);
        expect(reverseMapAction('createNew', undefined)).toBe(DecreeAction.CreateNew);
        expect(reverseMapAction('makeDoctor', undefined)).toBe(DecreeAction.MakeDoctor);
    });
});

// ---- collectFormValues: url_lang_map ---------------------------------------

/**
 * Build a minimal form carrying a source URL, the multilingual switch, and
 * any number of url_lang_map rows — the DOM subset collectFormValues reads
 * for url_lang_map.
 *
 * @param {{multilang: boolean, url?: string, rows?: Array<[string,string]>}} opts
 * @returns {HTMLFormElement}
 */
function buildUrlForm({ multilang, url = 'https://vatican.va/%s/doc.html', rows = [] }) {
    const form = document.createElement('form');

    const urlInput = document.createElement('input');
    urlInput.name = 'url';
    urlInput.value = url;
    form.appendChild(urlInput);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.name = 'url_multilang';
    toggle.checked = multilang;
    form.appendChild(toggle);

    const rowsContainer = document.createElement('div');
    rowsContainer.id = 'urlLangMapRows';
    rows.forEach(([iso, code]) => {
        const row = document.createElement('div');
        row.className = 'url-lang-row';
        const isoSel = document.createElement('select');
        isoSel.name = 'url_lang_iso[]';
        const opt = document.createElement('option');
        opt.value = iso;
        opt.selected = true;
        isoSel.appendChild(opt);
        const codeInp = document.createElement('input');
        codeInp.name = 'url_lang_code[]';
        codeInp.value = code;
        row.appendChild(isoSel);
        row.appendChild(codeInp);
        rowsContainer.appendChild(row);
    });
    form.appendChild(rowsContainer);

    return form;
}

describe('collectFormValues — url_lang_map', () => {
    it('gathers url_lang_map when the multilingual switch is on', () => {
        const form = buildUrlForm({ multilang: true, rows: [['en', 'en'], ['de', 'ge'], ['pt', 'po']] });
        const v = collectFormValues(form);
        expect(v.url_lang_map).toEqual({ en: 'en', de: 'ge', pt: 'po' });
    });

    it('returns undefined url_lang_map when the switch is off', () => {
        const form = buildUrlForm({ multilang: false, rows: [['en', 'en'], ['de', 'ge']] });
        const v = collectFormValues(form);
        expect(v.url_lang_map).toBeUndefined();
    });

    it('ignores blank rows (missing iso or code)', () => {
        const form = buildUrlForm({ multilang: true, rows: [['en', 'en'], ['', 'xx'], ['it', '']] });
        const v = collectFormValues(form);
        expect(v.url_lang_map).toEqual({ en: 'en' });
    });
});

describe('findUrlLangDuplicateErrors', () => {
    it('flags each ISO code used by more than one row', () => {
        const form = buildUrlForm({
            multilang: true,
            rows: [['de', 'ge'], ['de', 'tedesca'], ['en', 'en'], ['pt', 'po'], ['pt', 'pt']],
        });
        const errors = findUrlLangDuplicateErrors(form);
        expect(errors).toHaveLength(2);
        expect(errors.some((e) => e.includes('"de"'))).toBe(true);
        expect(errors.some((e) => e.includes('"pt"'))).toBe(true);
    });

    it('returns no errors when every ISO is unique', () => {
        const form = buildUrlForm({ multilang: true, rows: [['de', 'ge'], ['en', 'en'], ['it', 'it']] });
        expect(findUrlLangDuplicateErrors(form)).toEqual([]);
    });

    it('returns no errors when the multilingual switch is off', () => {
        const form = buildUrlForm({ multilang: false, rows: [['de', 'ge'], ['de', 'tedesca']] });
        expect(findUrlLangDuplicateErrors(form)).toEqual([]);
    });
});

describe('addUrlLangRow — datalist-backed ISO input', () => {
    it('pre-fills any ISO code and its Vatican code via a datalist input', () => {
        // Source-URL languages are independent of the GRC locale set: the row is
        // a free text input bound to the global ISO 639-1 datalist, so even a
        // language like ru (never in the GRC set) round-trips without loss.
        const container = document.createElement('div');
        addUrlLangRow(container, 'ru', 'russian');
        const isoInput = container.querySelector('[name="url_lang_iso[]"]');
        expect(isoInput.value).toBe('ru');
        expect(isoInput.getAttribute('list')).toBe('isoLangDatalist');
        expect(container.querySelector('[name="url_lang_code[]"]').value).toBe('russian');
    });

    it('creates an empty row when no values are given', () => {
        const container = document.createElement('div');
        addUrlLangRow(container);
        expect(container.querySelector('[name="url_lang_iso[]"]').value).toBe('');
        expect(container.querySelector('[name="url_lang_code[]"]').value).toBe('');
    });

    it('binds the code field to the per-language datalist when one exists for the ISO', () => {
        const dl = document.createElement('datalist');
        dl.id = 'urlCodes-de';
        document.body.appendChild(dl);
        try {
            const container = document.createElement('div');
            addUrlLangRow(container, 'de', 'ge');
            expect(container.querySelector('[name="url_lang_code[]"]').getAttribute('list')).toBe('urlCodes-de');
        } finally {
            dl.remove();
        }
    });

    it('leaves the code field unbound when no per-language datalist exists', () => {
        const container = document.createElement('div');
        addUrlLangRow(container, 'zz', 'x'); // no #urlCodes-zz in the DOM
        expect(container.querySelector('[name="url_lang_code[]"]').getAttribute('list')).toBeNull();
    });
});

describe('prefillI18nRows — GRC-live minimum + all defined translations', () => {
    const buildI18nContainer = () => {
        const rows = document.createElement('div');
        rows.id = 'i18nRows';
        const baseRow = document.createElement('div');
        baseRow.className = 'i18n-row';
        baseRow.setAttribute('data-base-row', 'true');
        const baseName = document.createElement('input');
        baseName.name = 'i18n_name[]';
        baseRow.appendChild(baseName);
        rows.appendChild(baseRow);
        document.body.appendChild(rows);
        return { rows, baseName };
    };

    it('seeds the base row + a row per GRC-live locale and per defined translation', () => {
        const { rows, baseName } = buildI18nContainer();
        try {
            // page locale en (base); GRC-live = en,fr,it,la,nl; defined adds es, pt
            prefillI18nRows(
                { en: 'Blessed…', it: 'Beata…', es: 'Santa…', pt: 'Abençoada…' },
                'en',
                '',
                ['en', 'fr', 'it', 'la', 'nl'],
            );
            expect(baseName.value).toBe('Blessed…');
            const addl = [...rows.querySelectorAll('.i18n-row:not([data-base-row="true"])')];
            const byLocale = Object.fromEntries(addl.map((r) => [
                r.querySelector('[name="i18n_locale[]"]').value,
                r.querySelector('[name="i18n_name[]"]').value,
            ]));
            // fr/la/nl seeded empty (GRC-live minimum); it/es/pt carry their values
            expect(Object.keys(byLocale).sort()).toEqual(['es', 'fr', 'it', 'la', 'nl', 'pt']);
            expect(byLocale.it).toBe('Beata…');
            expect(byLocale.es).toBe('Santa…');
            expect(byLocale.fr).toBe('');
            expect(byLocale.la).toBe('');
        } finally {
            rows.remove();
        }
    });

    it('falls back to the single event name for the base row when the map lacks it', () => {
        const { rows, baseName } = buildI18nContainer();
        try {
            prefillI18nRows(null, 'en', 'Fallback Name', ['en']);
            expect(baseName.value).toBe('Fallback Name');
        } finally {
            rows.remove();
        }
    });
});

describe('prefillReadingsGroups — GRC-live minimum + defined readings', () => {
    it('seeds a group per GRC-live locale plus each locale with readings', () => {
        const groups = document.createElement('div');
        groups.id = 'readingsGroups';
        document.body.appendChild(groups);
        try {
            prefillReadingsGroups(
                groups,
                { en: { first_reading: 'Gen 1:1', gospel: 'John 1' }, es: { first_reading: 'Gen 1:1 es' } },
                'en',
                ['en', 'fr', 'it', 'la', 'nl'],
            );
            const locales = [...groups.querySelectorAll('[name="readings_locale[]"]')].map((i) => i.value);
            // base (en) first, then GRC-live + defined unioned & sorted
            expect(locales[0]).toBe('en');
            expect(locales.slice(1).sort()).toEqual(['es', 'fr', 'it', 'la', 'nl']);
            // en readings filled
            const enGroup = [...groups.querySelectorAll('.readings-group')]
                .find((g) => g.querySelector('[name="readings_locale[]"]').value === 'en');
            expect(enGroup.querySelector('[name="first_reading[]"]').value).toBe('Gen 1:1');
        } finally {
            groups.remove();
        }
    });
});

describe('aggregateUrlCodeSuggestions', () => {
    it('collects distinct Vatican codes per ISO language, sorted', () => {
        const decrees = [
            { metadata: { url_lang_map: { de: 'ge', it: 'it' } } },
            { metadata: { url_lang_map: { de: 'tedesca', it: 'it', la: 'lat' } } },
            { metadata: { url_lang_map: { de: 'ge' } } }, // duplicate ge
            { metadata: {} },                              // no map
            { metadata: { url_lang_map: { de: '' } } },    // empty value ignored
        ];
        expect(aggregateUrlCodeSuggestions(decrees)).toEqual({
            de: ['ge', 'tedesca'],
            it: ['it'],
            la: ['lat'],
        });
    });

    it('returns an empty object when no decree carries a url_lang_map', () => {
        expect(aggregateUrlCodeSuggestions([{ metadata: {} }, {}])).toEqual({});
    });
});

describe('collectFormValues — ISO key validation', () => {
    it('drops rows whose language field is not a two-letter ISO code', () => {
        // A user may type a display name ("German") without picking a datalist
        // option; such rows must not be sent as bogus url_lang_map keys.
        const form = buildUrlForm({ multilang: true, rows: [['German', 'ge'], ['DE', 'ge2'], ['it', 'it']] });
        const v = collectFormValues(form);
        // 'German' dropped (not 2 letters); 'DE' lowercased to 'de'; 'it' kept
        expect(v.url_lang_map).toEqual({ de: 'ge2', it: 'it' });
    });
});

// ---- event_key catalog hint ------------------------------------------------

/**
 * Stand-in for the GRC event catalog loaded by loadEventCatalog() from
 * GET /events. `keys` holds every event_key (including events with no name of
 * their own); `names` maps only the named ones to their localized name.
 */
const CATALOG = {
    keys:  new Set(['StMotherTeresa', 'StJohnPaulII', 'Advent1', 'NamelessEvent']),
    names: {
        StMotherTeresa: 'Saint Teresa of Calcutta',
        StJohnPaulII:   'Saint John Paul II',
        Advent1:        'First Sunday of Advent',
        // NamelessEvent deliberately absent: a catalog entry with no name
    },
};

const EMPTY_CATALOG = { keys: new Set(), names: {} };

/**
 * Minimal markup for the identity row of the decree editor: the event_key
 * input, the action select and the hint slot beneath the input.
 *
 * @returns {HTMLFormElement}
 */
function buildEventKeyForm({ eventKey = '', action = DecreeAction.CreateNew, mode = 'create' } = {}) {
    const form = document.createElement('form');
    form.dataset.mode = mode;
    form.innerHTML = `
        <input type="text" id="decreeEventKey" name="event_key" list="grcEventKeysDatalist">
        <div class="form-text mt-1" id="decreeEventKeyHint"></div>
        <select name="action">
            <option value="createNew"></option>
            <option value="makeDoctor"></option>
            <option value="setProperty:name"></option>
            <option value="setProperty:grade"></option>
        </select>
    `;
    form.querySelector('[name="event_key"]').value = eventKey;
    form.querySelector('[name="action"]').value = action;
    return form;
}

describe('describeEventKeyHint — silence when there is nothing to compare against', () => {
    it('returns null when the catalog has not loaded (or the fetch failed)', () => {
        // loadEventCatalog is best-effort: a failed /events fetch leaves the
        // catalog empty. Reporting "not in the General Roman Calendar" then
        // would be a fabricated verdict, not an observation.
        expect(describeEventKeyHint('StMotherTeresa', DecreeAction.MakeDoctor, EMPTY_CATALOG.keys, EMPTY_CATALOG.names)).toBeNull();
        expect(describeEventKeyHint('Whatever', DecreeAction.CreateNew, EMPTY_CATALOG.keys, EMPTY_CATALOG.names)).toBeNull();
    });

    it('returns null for an empty or whitespace-only event key', () => {
        expect(describeEventKeyHint('', DecreeAction.CreateNew, CATALOG.keys, CATALOG.names)).toBeNull();
        expect(describeEventKeyHint('   ', DecreeAction.MakeDoctor, CATALOG.keys, CATALOG.names)).toBeNull();
    });

    it('returns null for an action it does not know', () => {
        expect(describeEventKeyHint('StMotherTeresa', 'someFutureAction', CATALOG.keys, CATALOG.names)).toBeNull();
    });
});

describe('describeEventKeyHint — createNew mints a key, so absence is the good case', () => {
    it('reports a key absent from the catalog as informational', () => {
        // Issue #493: StJohnHenryNewman is by definition not yet in the GRC.
        const hint = describeEventKeyHint('StJohnHenryNewman', DecreeAction.CreateNew, CATALOG.keys, CATALOG.names);
        expect(hint).not.toBeNull();
        expect(hint.level).toBe('info');
        expect(hint.text).toBe('Not in the General Roman Calendar — a new event will be created.');
    });

    it('warns on a key that already exists, naming the event it collides with', () => {
        const hint = describeEventKeyHint('StMotherTeresa', DecreeAction.CreateNew, CATALOG.keys, CATALOG.names);
        expect(hint.level).toBe('warn');
        expect(hint.text).toBe('Already in the General Roman Calendar as "Saint Teresa of Calcutta" — choose another key.');
    });

    it('trims surrounding whitespace before testing membership', () => {
        const hint = describeEventKeyHint('  StMotherTeresa  ', DecreeAction.CreateNew, CATALOG.keys, CATALOG.names);
        expect(hint.level).toBe('warn');
    });
});

describe('describeEventKeyHint — targeting actions need an existing key', () => {
    it.each([
        DecreeAction.MakeDoctor,
        DecreeAction.SetPropertyName,
        DecreeAction.SetPropertyGrade,
    ])('warns for %s when the key is not in the catalog', (action) => {
        const hint = describeEventKeyHint('StJohnHenryNewman', action, CATALOG.keys, CATALOG.names);
        expect(hint.level).toBe('warn');
        expect(hint.text).toBe('Not in the General Roman Calendar — this decree will not match any event.');
    });

    it.each([
        DecreeAction.MakeDoctor,
        DecreeAction.SetPropertyName,
        DecreeAction.SetPropertyGrade,
    ])('confirms the matched event for %s when the key is in the catalog', (action) => {
        const hint = describeEventKeyHint('StJohnPaulII', action, CATALOG.keys, CATALOG.names);
        expect(hint.level).toBe('info');
        expect(hint.text).toBe('Matches "Saint John Paul II" in the General Roman Calendar.');
    });

    it('falls back to the event key itself when the catalog entry has no name', () => {
        const hint = describeEventKeyHint('NamelessEvent', DecreeAction.MakeDoctor, CATALOG.keys, CATALOG.names);
        expect(hint.level).toBe('info');
        expect(hint.text).toBe('Matches "NamelessEvent" in the General Roman Calendar.');
    });
});

describe('syncEventKeyHint — DOM shell', () => {
    it('renders the hint text into #decreeEventKeyHint in create mode', () => {
        const form = buildEventKeyForm({ eventKey: 'StJohnHenryNewman', action: DecreeAction.CreateNew });
        document.body.appendChild(form);
        syncEventKeyHint(form, CATALOG);
        const hint = form.querySelector('#decreeEventKeyHint');
        expect(hint.textContent).toBe('Not in the General Roman Calendar — a new event will be created.');
        expect(hint.classList.contains('text-danger')).toBe(false);
        form.remove();
    });

    it('marks a warning-level hint with text-danger', () => {
        const form = buildEventKeyForm({ eventKey: 'StMotherTeresa', action: DecreeAction.CreateNew });
        document.body.appendChild(form);
        syncEventKeyHint(form, CATALOG);
        expect(form.querySelector('#decreeEventKeyHint').classList.contains('text-danger')).toBe(true);
        form.remove();
    });

    it('clears a stale hint when the key becomes non-reportable', () => {
        const form = buildEventKeyForm({ eventKey: 'StMotherTeresa', action: DecreeAction.CreateNew });
        document.body.appendChild(form);
        syncEventKeyHint(form, CATALOG);
        expect(form.querySelector('#decreeEventKeyHint').textContent).not.toBe('');

        form.querySelector('[name="event_key"]').value = '';
        syncEventKeyHint(form, CATALOG);
        const hint = form.querySelector('#decreeEventKeyHint');
        expect(hint.textContent).toBe('');
        expect(hint.classList.contains('text-danger')).toBe(false);
        form.remove();
    });

    it('stays silent in edit mode, where event_key is immutable static text', () => {
        const form = buildEventKeyForm({ eventKey: 'StMotherTeresa', action: DecreeAction.CreateNew, mode: 'edit' });
        document.body.appendChild(form);
        syncEventKeyHint(form, CATALOG);
        expect(form.querySelector('#decreeEventKeyHint').textContent).toBe('');
        form.remove();
    });

    it('renders nothing when the catalog is empty', () => {
        const form = buildEventKeyForm({ eventKey: 'StJohnHenryNewman', action: DecreeAction.MakeDoctor });
        document.body.appendChild(form);
        syncEventKeyHint(form, EMPTY_CATALOG);
        expect(form.querySelector('#decreeEventKeyHint').textContent).toBe('');
        form.remove();
    });
});
