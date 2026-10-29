/**
 * Unit tests for the starting `i18n` object of a national or wider region
 * calendar payload (assets/js/calendarTranslations.js).
 *
 * The payload classes refuse an `i18n` whose locales differ from
 * `metadata.locales`, so the object must name every selected locale even when
 * no event row adds a translation for it.
 */

import { describe, it, expect } from 'vitest';

import { emptyTranslations } from '../calendarTranslations.js';

describe('emptyTranslations', () => {
    it('has one empty entry per locale', () => {
        expect(emptyTranslations(['en_FR', 'fr_FR'])).toEqual({ en_FR: {}, fr_FR: {} });
    });

    it('gives each locale its own object', () => {
        const i18n = emptyTranslations(['en_FR', 'fr_FR']);
        i18n.fr_FR.some_event = 'Un événement';
        expect(i18n.en_FR).toEqual({});
    });

    it('has the same keys as the locales it was given', () => {
        const locales = ['oc_FR', 'fr_FR', 'en_FR'];
        expect(Object.keys(emptyTranslations(locales)).sort()).toEqual([...locales].sort());
    });

    it('is empty for no locales', () => {
        expect(emptyTranslations([])).toEqual({});
        expect(emptyTranslations(undefined)).toEqual({});
    });
});
