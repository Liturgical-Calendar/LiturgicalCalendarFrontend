/**
 * The national calendar's `holydays_of_obligation` setting. The API writes a
 * national calendar file wholesale, so whatever the save omits is deleted.
 */
import { describe, it, expect } from 'vitest';
import { CalendarSettings, HolydaysOfObligation, holydaysOfObligationSetting } from '../Settings.js';

const OFFERED = HolydaysOfObligation.STANDARD;
const BASE = { epiphany: 'JAN6', ascension: 'SUNDAY', corpus_christi: 'SUNDAY', eternal_high_priest: false };
const US = {
    Christmas: true, Epiphany: false, Ascension: true, CorpusChristi: false, MaryMotherOfGod: true,
    ImmaculateConception: true, Assumption: true, StJoseph: false, StsPeterPaulAp: false, AllSaints: true
};

describe('CalendarSettings holydays_of_obligation', () => {
    it('carries the setting through instead of dropping it', () => {
        const json = JSON.parse(JSON.stringify(new CalendarSettings({ ...BASE, holydays_of_obligation: US })));
        expect(json.holydays_of_obligation).toEqual(US);
    });

    it('stays optional', () => {
        expect(JSON.parse(JSON.stringify(new CalendarSettings(BASE)))).not.toHaveProperty('holydays_of_obligation');
    });

    it('admits a holy day proper to the calendar only as observed', () => {
        expect(() => new HolydaysOfObligation({ ...US, StPatrick: true })).not.toThrow();
        expect(() => new HolydaysOfObligation({ ...US, StPatrick: false })).toThrow();
        expect(() => new HolydaysOfObligation({ ...US, Christmas: 'yes' })).toThrow();
        expect(() => new HolydaysOfObligation(['Christmas'])).toThrow();
    });
});

describe('holydaysOfObligationSetting', () => {
    const selectedIn = (map) => Object.keys(map).filter((key) => map[key]);

    it('writes every offered holy day as observed or not', () => {
        expect(holydaysOfObligationSetting(OFFERED, selectedIn(US), US)).toEqual(US);
    });

    it('keeps a stored setting even when every holy day is observed', () => {
        const all = Object.fromEntries(OFFERED.map((key) => [key, true]));
        expect(holydaysOfObligationSetting(OFFERED, OFFERED, all)).toEqual(all);
    });

    it('omits the setting for a calendar that had none and still observes every holy day', () => {
        expect(holydaysOfObligationSetting(OFFERED, OFFERED, null)).toBeUndefined();
    });

    it('adds the setting once a calendar without one departs from the default', () => {
        const out = holydaysOfObligationSetting(OFFERED, OFFERED.filter((key) => key !== 'Epiphany'), null);
        expect(out.Epiphany).toBe(false);
        expect(Object.keys(out)).toHaveLength(10);
    });

    it('carries a holy day proper to the calendar through unchanged', () => {
        expect(holydaysOfObligationSetting(OFFERED, selectedIn(US), { ...US, StPatrick: true }))
            .toEqual({ StPatrick: true, ...US });
    });
});
