/**
 * Tests for the wider region label-fields module (#1018): one field per language a region's
 * member countries speak, each preceded by a fixed-width flag cell.
 */
import { describe, it, expect } from 'vitest';
import {
    FLAG_LIMIT,
    buildWiderRegionLabelFields,
    collectLabels,
    country2flag,
    labelFieldsFor,
    labelsToSave,
    m49Suggestions,
    readLabelInputs,
    rebuiltLabelState,
} from '../widerRegionLabels.js';

const COUNTRY_NAMES = {
    AT: 'Austria',
    BE: 'Belgium',
    DE: 'Germany',
    LI: 'Liechtenstein',
    LU: 'Luxembourg',
    CH: 'Switzerland',
    ZA: 'South Africa',
    BW: 'Botswana',
};
const regionName = (code) => COUNTRY_NAMES[code] ?? code;

describe('country2flag', () => {
    it('builds the regional-indicator flag for a two-letter code', () => {
        expect(country2flag('it')).toBe('\u{1F1EE}\u{1F1F9}');
    });
    it('returns an empty string for anything else', () => {
        expect(country2flag('')).toBe('');
        expect(country2flag('ITA')).toBe('');
        expect(country2flag(null)).toBe('');
    });
});

describe('FLAG_LIMIT', () => {
    it('is 4', () => {
        expect(FLAG_LIMIT).toBe(4);
    });
});

describe('labelFieldsFor', () => {
    it('groups locales by label key, en first, in first-seen order', () => {
        expect(labelFieldsFor(['de_DE', 'it_IT', 'de_AT', 'zh_Hans_SG'])).toEqual([
            { key: 'en', regions: [] },
            { key: 'de', regions: ['DE', 'AT'] },
            { key: 'it', regions: ['IT'] },
            { key: 'zh_Hans', regions: ['SG'] },
        ]);
    });
    it('merges regions under an already-first en', () => {
        expect(labelFieldsFor(['en_ZA', 'en_BW'])).toEqual([
            { key: 'en', regions: ['ZA', 'BW'] },
        ]);
    });
    it('still returns en with no locales at all', () => {
        expect(labelFieldsFor([])).toEqual([{ key: 'en', regions: [] }]);
    });
    it('adds a key with no region for a locale that names none', () => {
        expect(labelFieldsFor(['de'])).toEqual([
            { key: 'en', regions: [] },
            { key: 'de', regions: [] },
        ]);
    });
    it('de-duplicates repeated regions under the same key', () => {
        expect(labelFieldsFor(['it_IT', 'it_IT'])).toEqual([
            { key: 'en', regions: [] },
            { key: 'it', regions: ['IT'] },
        ]);
    });
});

describe('buildWiderRegionLabelFields', () => {
    const fields = [
        { key: 'en', regions: [] },
        { key: 'de', regions: ['AT', 'BE', 'DE', 'LI', 'LU', 'CH'] },
        { key: 'it', regions: ['IT'] },
    ];

    it('renders one .wr-label-row per field, each with the same three-cell structure', () => {
        const container = buildWiderRegionLabelFields({ fields, regionName, i18n: { more: '+%d' } });
        const rows = container.querySelectorAll('.wr-label-row');
        expect(rows.length).toBe(fields.length);
        rows.forEach((row) => {
            expect(row.children.length).toBe(3);
            expect(row.children[0].classList.contains('wr-label-flags')).toBe(true);
            expect(row.children[1].tagName).toBe('LABEL');
            expect(row.children[2].tagName).toBe('INPUT');
        });
    });

    it('sets data-label-key, value and placeholder on the input', () => {
        const container = buildWiderRegionLabelFields({
            fields,
            values: { it: 'Europa' },
            placeholders: { de: 'Europe' },
            regionName,
            i18n: { more: '+%d' },
        });
        const itInput = container.querySelector('#widerRegionLabel_it');
        expect(itInput.dataset.labelKey).toBe('it');
        expect(itInput.value).toBe('Europa');
        const deInput = container.querySelector('#widerRegionLabel_de');
        expect(deInput.placeholder).toBe('Europe');
    });

    it('shows exactly min(n, 4) flags when n <= 4', () => {
        const container = buildWiderRegionLabelFields({
            fields: [{ key: 'it', regions: ['IT'] }],
            regionName,
            i18n: { more: '+%d' },
        });
        const flagsCell = container.querySelector('.wr-label-flags');
        expect(flagsCell.querySelector('.wr-label-more')).toBeNull();
        expect([...flagsCell.textContent].filter((ch) => ch === '\u{1F1EE}').length).toBe(1);
    });

    it('shows 3 flags plus a +3 .wr-label-more for a 6-country field', () => {
        const container = buildWiderRegionLabelFields({ fields, regionName, i18n: { more: '+%d' } });
        const deRow = [...container.querySelectorAll('.wr-label-row')]
            .find((row) => row.querySelector('input').dataset.labelKey === 'de');
        const flagsCell = deRow.querySelector('.wr-label-flags');
        const more = flagsCell.querySelector('.wr-label-more');
        expect(more.textContent).toBe('+3');
        // 3 flags shown = 6 regional-indicator codepoint pairs (AT, BE, DE), not the 6 of all 6 countries.
        const codepoints = [...flagsCell.textContent];
        const regionalIndicators = codepoints.filter((ch) => ch.codePointAt(0) >= 0x1F1E6 && ch.codePointAt(0) <= 0x1F1FF);
        expect(regionalIndicators.length).toBe(6);
    });

    it('lists all country names in the flag cell title, not just the shown ones', () => {
        const container = buildWiderRegionLabelFields({ fields, regionName, i18n: { more: '+%d' } });
        const deRow = [...container.querySelectorAll('.wr-label-row')]
            .find((row) => row.querySelector('input').dataset.labelKey === 'de');
        const flagsCell = deRow.querySelector('.wr-label-flags');
        expect(flagsCell.title).toBe('Austria, Belgium, Germany, Liechtenstein, Luxembourg, Switzerland');
    });

    it('shows a globe for en with no regions', () => {
        const container = buildWiderRegionLabelFields({ fields, regionName, i18n: { more: '+%d' } });
        const enRow = [...container.querySelectorAll('.wr-label-row')]
            .find((row) => row.querySelector('input').dataset.labelKey === 'en');
        expect(enRow.querySelector('.wr-label-flags').textContent).toBe('\u{1F310}');
    });

    it('pre-fills a suggested value, marks it, and clears the mark on first input', () => {
        const container = buildWiderRegionLabelFields({
            fields: [{ key: 'it', regions: ['IT'] }],
            suggestions: { it: 'Europa' },
            regionName,
            i18n: { more: '+%d', suggested: 'Suggested from the continent' },
        });
        const input = container.querySelector('#widerRegionLabel_it');
        expect(input.value).toBe('Europa');
        expect(input.classList.contains('wr-label-suggested')).toBe(true);
        expect(input.title).toBe('Suggested from the continent');
        input.dispatchEvent(new Event('input'));
        expect(input.classList.contains('wr-label-suggested')).toBe(false);
    });

    it('lets a stored value win over a suggestion', () => {
        const container = buildWiderRegionLabelFields({
            fields: [{ key: 'it', regions: ['IT'] }],
            values: { it: 'Area italiana' },
            suggestions: { it: 'Europa' },
            regionName,
            i18n: { more: '+%d' },
        });
        const input = container.querySelector('#widerRegionLabel_it');
        expect(input.value).toBe('Area italiana');
        expect(input.classList.contains('wr-label-suggested')).toBe(false);
    });
});

describe('m49Suggestions', () => {
    it('resolves each label key\'s region name for the M.49 code', () => {
        expect(m49Suggestions(['en', 'fr', 'it', 'de'], '150')).toEqual({
            en: 'Europe',
            fr: 'Europe',
            it: 'Europa',
            de: 'Europa',
        });
    });
    it('capitalises a name ICU returns lower-cased (Irish "an Eoraip")', () => {
        // Confirmed against this Node's ICU: `new Intl.DisplayNames(['ga'], { type: 'region' }).of('150')`
        // returns 'an Eoraip'; capitalising the first character yields the brief's 'An Eoraip'.
        expect(m49Suggestions(['ga'], '150')).toEqual({ ga: 'An Eoraip' });
    });
    it('omits a key whose script tag ICU cannot resolve', () => {
        expect(m49Suggestions(['not a locale!'], '150')).toEqual({});
    });
});

describe('collectLabels', () => {
    it('returns trimmed, non-empty values keyed by label key, suggestions included', () => {
        const container = buildWiderRegionLabelFields({
            fields: [
                { key: 'en', regions: [] },
                { key: 'it', regions: ['IT'] },
                { key: 'de', regions: ['DE'] },
            ],
            values: { en: '  Europe  ' },
            suggestions: { it: 'Europa' },
            regionName,
            i18n: { more: '+%d' },
        });
        container.querySelector('#widerRegionLabel_de').value = '   ';
        expect(collectLabels(container)).toEqual({ en: 'Europe', it: 'Europa' });
    });
});

describe('rebuiltLabelState', () => {
    const base = { en: 'Europe', it: 'Europa' };
    const suggestions = { en: 'Europe', it: 'Europa', fr: 'Europe', de: 'Europa' };

    it('uses the stored labels and all suggestions when no field existed yet', () => {
        expect(rebuiltLabelState(base, suggestions, [])).toEqual({ values: base, suggestions });
    });

    it('keeps what a field holds, typed or emptied, over the stored label and the suggestion', () => {
        const state = rebuiltLabelState(base, suggestions, [
            { key: 'en', value: ' Old Continent ', suggested: false },
            { key: 'it', value: '', suggested: false },
            { key: 'fr', value: '', suggested: false },
        ]);
        expect(state.values).toEqual({ en: 'Old Continent', it: '', fr: '' });
        expect(state.suggestions).toEqual({ de: 'Europa' });
    });

    it('recomputes an untouched suggestion rather than keeping it as a typed value', () => {
        const state = rebuiltLabelState({}, { fr: 'Europe' }, [{ key: 'fr', value: 'Europe', suggested: true }]);
        expect(state.values).toEqual({});
        expect(state.suggestions).toEqual({ fr: 'Europe' });
    });

    it('falls back to the stored label for a key that had no field before', () => {
        const state = rebuiltLabelState(base, {}, [{ key: 'en', value: 'Europe', suggested: false }]);
        expect(state.values).toEqual({ en: 'Europe', it: 'Europa' });
    });
});

describe('readLabelInputs', () => {
    it('reads each field\'s key, raw value and whether it still holds a suggestion', () => {
        const container = buildWiderRegionLabelFields({
            fields: [{ key: 'en', regions: [] }, { key: 'fr', regions: ['FR'] }],
            values: { en: 'Europe' },
            suggestions: { fr: 'Europe' },
            regionName: (code) => code,
        });
        expect(readLabelInputs(container)).toEqual([
            { key: 'en', value: 'Europe', suggested: false },
            { key: 'fr', value: 'Europe', suggested: true },
        ]);
    });
});

describe('labelsToSave', () => {
    // asia (#1018): stored with a bare `zh` no field is rendered for.
    const stored = { en: 'Asia', zh: '亚洲', zh_Hans: '亚洲', ja: 'アジア' };
    const locales = ['ja_JP', 'zh_Hans_CN'];

    it('carries over a stored label that has no field but is still allowed', () => {
        const fields = [
            { key: 'en', value: 'Asia', suggested: false },
            { key: 'ja', value: 'アジア', suggested: false },
            { key: 'zh_Hans', value: '亚洲', suggested: false },
        ];
        expect(labelsToSave(fields, stored, locales)).toEqual(stored);
    });

    it('drops a stored label no selected locale allows any more', () => {
        const fields = [
            { key: 'en', value: 'Asia', suggested: false },
            { key: 'zh_Hans', value: '亚洲', suggested: false },
        ];
        expect(labelsToSave(fields, stored, ['zh_Hans_CN'])).toEqual({ en: 'Asia', zh: '亚洲', zh_Hans: '亚洲' });
    });

    it('drops a key whose field was emptied, rather than carrying the stored label over', () => {
        const fields = [
            { key: 'en', value: 'Asia', suggested: false },
            { key: 'ja', value: '  ', suggested: false },
            { key: 'zh_Hans', value: ' 亚洲 ', suggested: false },
        ];
        expect(labelsToSave(fields, stored, locales)).toEqual({ en: 'Asia', zh: '亚洲', zh_Hans: '亚洲' });
    });

    it('saves a field still holding a suggestion, as collectLabels does', () => {
        const fields = [{ key: 'en', value: 'Asia', suggested: true }];
        expect(labelsToSave(fields, {}, [])).toEqual({ en: 'Asia' });
    });
});
