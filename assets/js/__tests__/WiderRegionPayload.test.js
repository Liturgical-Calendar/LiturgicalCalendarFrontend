import { describe, it, expect } from 'vitest';
import { WiderRegionPayload } from '../WiderRegionPayload.js';

const build = (metadata) => new WiderRegionPayload(
    [],
    {},
    { locales: ['de_DE', 'zh_Hans_SG'], wider_region: 'german-language-area', ...metadata },
    { de_DE: {}, zh_Hans_SG: {} },
);

describe('WiderRegionPayload metadata.labels', () => {
    it('accepts labels keyed by language or language_Script', () => {
        const payload = build({ labels: { en: 'German Language Area', de: 'Deutsches Sprachgebiet', zh_Hans: '德语区' } });
        expect(payload.metadata.labels).toEqual({ en: 'German Language Area', de: 'Deutsches Sprachgebiet', zh_Hans: '德语区' });
    });

    it('accepts empty labels, which clear the stored ones', () => {
        expect(build({ labels: {} }).metadata.labels).toEqual({});
    });

    it('accepts a payload without labels', () => {
        expect(build({}).metadata).not.toHaveProperty('labels');
    });

    it('rejects a malformed key', () => {
        expect(() => build({ labels: { de_DE: 'Deutsch' } })).toThrow(/labels/);
        expect(() => build({ labels: { DE: 'Deutsch' } })).toThrow(/labels/);
        expect(() => build({ labels: { zh_hans: '德语区' } })).toThrow(/labels/);
        expect(() => build({ labels: { 'zh-Hans': '德语区' } })).toThrow(/labels/);
    });

    it('rejects an empty or non-string value', () => {
        expect(() => build({ labels: { de: '' } })).toThrow(/labels/);
        expect(() => build({ labels: { de: 42 } })).toThrow(/labels/);
    });

    it('rejects labels that are not an object', () => {
        expect(() => build({ labels: 'German Language Area' })).toThrow(/labels/);
        expect(() => build({ labels: ['German Language Area'] })).toThrow(/labels/);
        expect(() => build({ labels: null })).toThrow(/labels/);
    });
});
