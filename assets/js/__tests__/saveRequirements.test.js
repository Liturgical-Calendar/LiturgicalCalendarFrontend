import { describe, it, expect } from 'vitest';
import { saveBlockedForMissingEvents } from '../saveRequirements.js';

describe('saveBlockedForMissingEvents', () => {
    it('blocks diocesan and wider region calendars without events', () => {
        expect(saveBlockedForMissingEvents('diocese', 0)).toBe(true);
        expect(saveBlockedForMissingEvents('widerregion', 0)).toBe(true);
    });

    it('allows them once there is an event', () => {
        expect(saveBlockedForMissingEvents('diocese', 1)).toBe(false);
        expect(saveBlockedForMissingEvents('widerregion', 3)).toBe(false);
    });

    it('never blocks a national calendar', () => {
        expect(saveBlockedForMissingEvents('nation', 0)).toBe(false);
        expect(saveBlockedForMissingEvents('nation', 2)).toBe(false);
    });
});
