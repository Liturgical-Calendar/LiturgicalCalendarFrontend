import { describe, it, expect } from 'vitest';
import { nationOfLocale, editsWholeWiderRegion, editsWiderRegionLocale, localeWrites, nationMayJoinWiderRegion } from '../widerRegionEditRights.js';

const CANADA_EDITOR = { isGlobalAdmin: false, nations: ['CA'], widerRegions: [] };
const AMERICAS_EDITOR = { isGlobalAdmin: false, nations: [], widerRegions: ['Americas'] };
const ADMIN = { isGlobalAdmin: true, nations: [], widerRegions: [] };

describe('nationOfLocale', () => {
    it('reads the nation off a language+nation locale', () => {
        expect(nationOfLocale('fr_CA')).toBe('CA');
        expect(nationOfLocale('es-VE')).toBe('VE');
    });

    it('finds no nation in a bare language or a supranational region', () => {
        expect(nationOfLocale('en')).toBe('');
        expect(nationOfLocale('es_419')).toBe('');
        expect(nationOfLocale('')).toBe('');
    });
});

describe('wider region edit rights', () => {
    it('lets a global admin or the region\'s own editor edit the whole region', () => {
        expect(editsWholeWiderRegion(ADMIN, 'Americas')).toBe(true);
        expect(editsWholeWiderRegion(AMERICAS_EDITOR, 'Americas')).toBe(true);
        expect(editsWholeWiderRegion(AMERICAS_EDITOR, 'Europe')).toBe(false);
        expect(editsWholeWiderRegion(CANADA_EDITOR, 'Americas')).toBe(false);
    });

    it('lets a national editor write only their own nation\'s locales', () => {
        expect(editsWiderRegionLocale(CANADA_EDITOR, 'Americas', 'en_CA')).toBe(true);
        expect(editsWiderRegionLocale(CANADA_EDITOR, 'Americas', 'fr_CA')).toBe(true);
        expect(editsWiderRegionLocale(CANADA_EDITOR, 'Americas', 'en_US')).toBe(false);
        expect(editsWiderRegionLocale(CANADA_EDITOR, 'Americas', 'es_VE')).toBe(false);
    });

    it('lets the whole-region editors write any locale', () => {
        expect(editsWiderRegionLocale(ADMIN, 'Americas', 'es_UY')).toBe(true);
        expect(editsWiderRegionLocale(AMERICAS_EDITOR, 'Americas', 'fr_HT')).toBe(true);
    });

    it('grants nothing without rights', () => {
        expect(editsWiderRegionLocale(null, 'Americas', 'fr_CA')).toBe(false);
        expect(editsWholeWiderRegion(undefined, 'Americas')).toBe(false);
    });
});

describe('localeWrites', () => {
    it('keeps only the locales the editor may write, one write each', () => {
        const i18n = {
            en_CA: { OurLadyOfGuadalupe: 'Our Lady of Guadalupe' },
            fr_CA: { OurLadyOfGuadalupe: 'Notre-Dame de Guadalupe' },
            en_US: { OurLadyOfGuadalupe: 'Our Lady of Guadalupe' }
        };
        expect(localeWrites(i18n, CANADA_EDITOR, 'Americas').map(({ locale }) => locale)).toEqual(['en_CA', 'fr_CA']);
        expect(localeWrites(i18n, CANADA_EDITOR, 'Americas')[1].names).toEqual({ OurLadyOfGuadalupe: 'Notre-Dame de Guadalupe' });
    });
});

describe('wider region membership', () => {
    // Americas as the page sees it: its own member list, and the region each national
    // calendar declares in /calendars.
    const AMERICAS = { members: ['CA', 'US'], declaredRegion: { CA: 'Americas', US: 'Americas', IT: 'Europe' } };
    const EUROPE = { members: ['IT', 'HU'], declaredRegion: { CA: 'Americas', US: 'Americas', IT: 'Europe' } };

    it('admits a member, or a nation no region claims', () => {
        expect(nationMayJoinWiderRegion('CA', 'Americas', AMERICAS)).toBe(true);
        expect(nationMayJoinWiderRegion('VE', 'Americas', AMERICAS)).toBe(true);
        expect(nationMayJoinWiderRegion('CA', 'Europe', EUROPE)).toBe(false);
    });

    it('keeps an editor of Canada out of Europe, and lets an editor of Venezuela into the Americas', () => {
        expect(editsWiderRegionLocale(CANADA_EDITOR, 'Europe', 'fr_CA', EUROPE)).toBe(false);
        expect(editsWiderRegionLocale(CANADA_EDITOR, 'Americas', 'fr_CA', AMERICAS)).toBe(true);
        const venezuelaEditor = { isGlobalAdmin: false, nations: ['VE'], widerRegions: [] };
        expect(editsWiderRegionLocale(venezuelaEditor, 'Americas', 'es_VE', AMERICAS)).toBe(true);
    });

    it('does not restrict the whole-region editors', () => {
        expect(editsWiderRegionLocale(ADMIN, 'Europe', 'fr_CA', EUROPE)).toBe(true);
    });

    it('filters the writes the same way', () => {
        const i18n = { fr_CA: { StBenedict: 'Saint Benoît' }, it_IT: { StBenedict: 'San Benedetto' } };
        const bothNations = { isGlobalAdmin: false, nations: ['CA', 'IT'], widerRegions: [] };
        expect(localeWrites(i18n, bothNations, 'Europe', EUROPE).map(({ locale }) => locale)).toEqual(['it_IT']);
    });
});
