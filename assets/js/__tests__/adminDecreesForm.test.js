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
            managePerms:       'Manage permissions',
            translations:      'Translations',
            readings:          'Lectionary readings',
            newDecree:         'New Decree',
            editDecree:        'Edit Decree',
            selectLocale:      'Select locale',
            removeRow:         'Remove',
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
        },
    };
});

import { collectFormValues, applyActionVisibility, reverseMapAction } from '../admin-decrees.js';
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
    commonText = 'Pastors',
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
    form.appendChild(field('strtotime', 'text', eventType === 'mobile' ? 'Monday after Pentecost' : ''));

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

    // Common text
    form.appendChild(field('common_text', 'text', commonText));

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

    it('collects event_type=mobile with strtotime', () => {
        const form = buildForm({ eventType: 'mobile' });
        const v = collectFormValues(form);
        expect(v.event_type).toBe('mobile');
        expect(v.strtotime).toBe('Monday after Pentecost');
    });

    it('collects selected colors as array', () => {
        const form = buildForm({ colors: ['white', 'red'] });
        const v = collectFormValues(form);
        expect(v.color).toEqual(['white', 'red']);
    });

    it('collects common as array split by comma', () => {
        const form = buildForm({ commonText: 'Pastors, Martyrs' });
        const v = collectFormValues(form);
        expect(v.common).toEqual(['Pastors', 'Martyrs']);
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

    it('createNew: shows createNew+i18n+readings, hides grade block', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.CreateNew, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(false);
    });

    it('makeDoctor: shows i18n, hides createNew+grade+readings blocks', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.MakeDoctor, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });

    it('setProperty:name: shows i18n, hides createNew+grade+readings blocks', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.SetPropertyName, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });

    it('setProperty:grade: hides createNew+i18n+readings, shows grade block', () => {
        const form = buildBlockForm();
        applyActionVisibility(DecreeAction.SetPropertyGrade, form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(false);
        expect(form.querySelector('.needs-i18n').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.needs-readings').classList.contains('d-none')).toBe(true);
    });

    it('unknown action: hides all blocks (graceful fallback)', () => {
        const form = buildBlockForm();
        applyActionVisibility('unknownAction', form);

        expect(form.querySelector('.action-createNew').classList.contains('d-none')).toBe(true);
        expect(form.querySelector('.action-setPropertyGrade').classList.contains('d-none')).toBe(true);
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
