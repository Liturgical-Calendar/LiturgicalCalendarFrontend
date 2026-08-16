/**
 * Regression coverage for the admin-tests `applies_to.rite` bug
 * (LiturgicalCalendarFrontend#459): API #785 made `applies_to.rite` REQUIRED
 * by `LitCalTest.json`, but `selectedScope()` never emitted a `rite` key in
 * any branch, so every create (PUT) and update (PATCH) from this editor was
 * rejected with a 422.
 *
 * `admin-tests.js` imports `@liturgical-calendar/components-js`, which is not
 * an npm dependency of this project (it's wired in at runtime via the
 * browser importmap in layout/footer.php — see CLAUDE.md's "Component
 * Library Methods" section). vitest.config.js aliases that bare specifier to
 * a minimal test stub (`__mocks__/liturgical-calendar-components-js.js`) so
 * this file can be imported directly; the stub's `Rite` enum mirrors the
 * real package's `Rite.ROMAN = 'roman'` / `Rite.AMBROSIAN = 'ambrosian'`
 * (liturgy-components-js/src/Enums.js).
 *
 * `selectedScope()` and `parseScopedId()` are exported from admin-tests.js
 * at module scope specifically so they're unit-testable this way — every
 * other helper in the file is nested inside the `DOMContentLoaded` closure
 * and requires the full admin-tests.php page DOM to exercise.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { selectedScope, parseScopedId } from '../admin-tests.js';

/** Builds a minimal DOM fixture mirroring the admin-tests.php scope picker. */
function setScopeDom({ type, id, rite } = {}) {
    document.body.innerHTML = '';
    const typeSel = document.createElement('select');
    typeSel.id = 'testScopeType';
    // A <select>'s value setter is a no-op without a matching <option> (both
    // in real browsers and jsdom) — admin-tests.php's markup always has all
    // three as static <option>s, so the fixture mirrors that here.
    ['general_roman_calendar', 'national_calendar', 'diocesan_calendar'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        typeSel.appendChild(opt);
    });
    typeSel.value = type ?? 'general_roman_calendar';
    document.body.appendChild(typeSel);
    if (id !== undefined) {
        const idEl = document.createElement('input');
        idEl.id = 'testScopeId';
        idEl.value = id;
        document.body.appendChild(idEl);
    }
    if (rite !== undefined) {
        const riteEl = document.createElement('input');
        riteEl.id = 'testScopeRite';
        riteEl.value = rite;
        document.body.appendChild(riteEl);
    }
}

describe('selectedScope()', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('General Roman Calendar carries a bare rite, not null', () => {
        setScopeDom({ type: 'general_roman_calendar' });
        expect(selectedScope()).toEqual({ rite: 'roman' });
    });

    it('a national calendar is always Roman (Ambrosian has no national tier)', () => {
        setScopeDom({ type: 'national_calendar', id: 'US' });
        expect(selectedScope()).toEqual({ rite: 'roman', national_calendar: 'US' });
    });

    it('a diocesan calendar reads its rite from the linked #testScopeRite control', () => {
        setScopeDom({ type: 'diocesan_calendar', id: 'lugano_ch', rite: 'ambrosian' });
        expect(selectedScope()).toEqual({ rite: 'ambrosian', diocesan_calendar: 'lugano_ch' });
    });

    it('a diocesan calendar with no #testScopeRite control falls back to Roman', () => {
        setScopeDom({ type: 'diocesan_calendar', id: 'boston_us' });
        expect(selectedScope()).toEqual({ rite: 'roman', diocesan_calendar: 'boston_us' });
    });

    it('a scoped type with no calendar ID picked yet is incomplete (undefined)', () => {
        setScopeDom({ type: 'diocesan_calendar', id: '' });
        expect(selectedScope()).toBeUndefined();
    });
});

describe('parseScopedId()', () => {
    it('splits a rite-qualified id (TestScopeResolver::qualify() format)', () => {
        expect(parseScopedId('roman/US')).toEqual({ rite: 'roman', id: 'US' });
        expect(parseScopedId('ambrosian/lugano_ch')).toEqual({ rite: 'ambrosian', id: 'lugano_ch' });
    });

    it('defaults a bare, unqualified legacy id to Roman', () => {
        expect(parseScopedId('US')).toEqual({ rite: 'roman', id: 'US' });
    });
});
