/**
 * The color a common implies, shared by the extending page and the sanctorale
 * editor so the two cannot disagree.
 */
import { describe, it, expect } from 'vitest';
import { colorsForCommons } from '../FormControls.js';

describe('colorsForCommons', () => {
    it('implies red for any common whose general category is Martyrs', () => {
        expect(colorsForCommons(['Martyrs'])).toEqual(['red']);
        expect(colorsForCommons(['Martyrs:For a Virgin Martyr'])).toEqual(['red']);
    });

    it('implies white for any other common', () => {
        for (const common of [
            'Blessed Virgin Mary', 'Pastors:For a Bishop', 'Doctors', 'Virgins:For One Virgin',
            'Holy Men and Women:For Religious', 'Dedication of a Church'
        ]) {
            expect(colorsForCommons([common])).toEqual(['white']);
        }
    });

    it('implies both when a Martyrs common is chosen beside another', () => {
        expect(colorsForCommons(['Pastors:For One Pastor', 'Martyrs:For One Martyr'])).toEqual(['red', 'white']);
    });

    it('implies nothing for Proper, the votive Masses, or no common at all', () => {
        expect(colorsForCommons(['Proper'])).toEqual([]);
        expect(colorsForCommons(['For the Preservation of Peace and Justice'])).toEqual([]);
        expect(colorsForCommons([])).toEqual([]);
        expect(colorsForCommons(undefined)).toEqual([]);
    });
});
