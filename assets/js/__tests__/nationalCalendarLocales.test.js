import { describe, expect, it } from 'vitest';
import {
    baseLanguage,
    isOfficialLocale,
    newNationalCalendarLocaleOptions,
    unofficialLocales
} from '../nationalCalendarLocales.js';

const OFFICIAL = ['en', 'fr', 'it', 'la', 'nl'];

const FRANCE = [
    ['br_FR', 'Breton (France)'],
    ['ca_FR', 'Catalan (France)'],
    ['fr_FR', 'French (France)'],
    ['gsw_FR', 'Swiss German (France)'],
    ['oc_FR', 'Occitan (France)']
];

describe('baseLanguage', () => {
    it.each([
        ['fr_FR', 'fr'],
        ['fr-CA', 'fr'],
        ['sr_Latn_BA', 'sr'],
        ['gsw', 'gsw'],
        ['', '']
    ])('%s -> %s', (locale, expected) => {
        expect(baseLanguage(locale)).toBe(expected);
    });
});

describe('isOfficialLocale', () => {
    it('judges a regional locale by its language', () => {
        expect(isOfficialLocale('fr_CA', OFFICIAL)).toBe(true);
        expect(isOfficialLocale('br_FR', OFFICIAL)).toBe(false);
    });

    it('treats a missing official list as none official', () => {
        expect(isOfficialLocale('en_US', undefined)).toBe(false);
    });
});

describe('unofficialLocales', () => {
    it('names the locales that are not official, in order', () => {
        expect(unofficialLocales(FRANCE.map(([locale]) => locale), OFFICIAL))
            .toEqual(['br_FR', 'ca_FR', 'gsw_FR', 'oc_FR']);
    });

    it('is empty when every locale is official', () => {
        expect(unofficialLocales(['fr_FR', 'en_FR'], OFFICIAL)).toEqual([]);
    });
});

describe('newNationalCalendarLocaleOptions', () => {
    it('selects only the official locales of France', () => {
        document.body.innerHTML = `<select multiple>${newNationalCalendarLocaleOptions(FRANCE, OFFICIAL, 'not yet available')}</select>`;
        const select = document.querySelector('select');

        expect(Array.from(select.options, (o) => o.value)).toEqual(['br_FR', 'ca_FR', 'fr_FR', 'gsw_FR', 'oc_FR']);
        expect(Array.from(select.selectedOptions, (o) => o.value)).toEqual(['fr_FR']);
        expect(select.querySelector('[value="fr_FR"]').textContent).toBe('French (France)');
        expect(select.querySelector('[value="br_FR"]').textContent).toBe('Breton (France) (not yet available)');
        expect(select.querySelector('[value="br_FR"]').disabled).toBe(false);
    });

    it('escapes the label', () => {
        expect(newNationalCalendarLocaleOptions([['xx_YY', 'A <b>']], OFFICIAL, '"soon"'))
            .toBe('<option value="xx_YY">A &lt;b&gt; (&quot;soon&quot;)</option>');
    });
});
