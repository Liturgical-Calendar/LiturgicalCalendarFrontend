/**
 * Per-Missal FGA objects.
 *
 * A sanctorale write is authorized against the MISSAL, not the page, so a
 * composed view can mix editions the user may edit with editions they may not.
 * Getting the object wrong fails open or fails closed silently, so it is pinned.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    missalFgaObject, capabilityCheckPath, detectMissalCapabilities,
    RELATION_EDITOR, RELATION_ADMIN
} from '../capabilities.js';

const VA_1970 = { missal_id: 'EDITIO_TYPICA_1970', region: 'VA', year_published: 1970 };
const US_2011 = { missal_id: 'US_2011', region: 'US', year_published: 2011 };
const AMBR = { missal_id: 'EDITIO_TYPICA_2024', region: 'AMBROSIAN', year_published: 2024 };

describe('missalFgaObject', () => {
    it('maps an editio typica onto rite_calendar, rite-qualified by missal id', () => {
        expect(missalFgaObject(VA_1970, 'roman', 'VA'))
            .toEqual({ objectType: 'rite_calendar', objectId: 'roman/EDITIO_TYPICA_1970' });
    });

    it('maps a national edition onto its rite-qualified national calendar', () => {
        expect(missalFgaObject(US_2011, 'roman', 'VA'))
            .toEqual({ objectType: 'national_calendar', objectId: 'roman/US' });
    });

    it('treats a single-region rite as entirely base, under its OWN rite', () => {
        // The Ambrosian edition IS the base of its rite, so it is a rite_calendar
        // object even though AMBROSIAN is not a nation code — and the qualifier is
        // `ambrosian`, which is precisely what `general_roman_calendar` could not
        // express (API #955).
        expect(missalFgaObject(AMBR, 'ambrosian', 'AMBROSIAN'))
            .toEqual({ objectType: 'rite_calendar', objectId: 'ambrosian/EDITIO_TYPICA_2024' });
    });
});

describe('capabilityCheckPath', () => {
    it('encodes the separator in a rite-qualified object id', () => {
        // The separator is a literal '/', which would otherwise read as a path segment.
        const path = capabilityCheckPath({
            userSub: 'user|1', objectType: 'national_calendar',
            objectId: 'roman/US', relation: RELATION_EDITOR
        });
        expect(path).toContain('object_id=roman%2FUS');
        expect(path).toContain('user=user%7C1');
        expect(path).toContain('relation=editor');
        expect(path.startsWith('/admin/permissions/check?')).toBe(true);
    });
});

describe('detectMissalCapabilities', () => {
    it('grants everything to a global admin without issuing a single check', async () => {
        const checkAllowed = vi.fn();
        const caps = await detectMissalCapabilities({
            missals: [VA_1970, US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: true, checkAllowed
        });
        expect(checkAllowed).not.toHaveBeenCalled();
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canCreate: true, canDelete: true });
    });

    it('denies everything when there is no subject to check', async () => {
        const checkAllowed = vi.fn();
        const caps = await detectMissalCapabilities({
            missals: [VA_1970], rite: 'roman', baseRegion: 'VA',
            userSub: '', isGlobalAdmin: false, checkAllowed
        });
        expect(checkAllowed).not.toHaveBeenCalled();
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: false, canCreate: false, canDelete: false });
    });

    it('resolves each Missal independently, so a scoped grant is scoped', async () => {
        // This is the whole point: editor on US_2011, nothing on the 1970 typica.
        const checkAllowed = async (path) =>
            path.includes('object_id=roman%2FUS') && path.includes(`relation=${RELATION_EDITOR}`);
        const caps = await detectMissalCapabilities({
            missals: [VA_1970, US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canCreate: false, canDelete: false });
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: false, canCreate: false, canDelete: false });
    });

    it('withholds create from a plain editor, because PUT wants admin', async () => {
        // The regression this shape exists to prevent. `forMissals()` passes no
        // relation-map override, so missals take DEFAULT_RELATION_MAP verbatim:
        // PUT => admin. Gating create on `editor` (as the /decrees route's own
        // override would) hands a curator the whole form and then a 403.
        const checkAllowed = async (path) => path.includes(`relation=${RELATION_EDITOR}`);
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canCreate: false, canDelete: false });
    });

    it('treats a failing check as a denial rather than propagating', async () => {
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false,
            checkAllowed: async () => { throw new Error('network'); }
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: false, canCreate: false, canDelete: false });
    });

    it('admin implies edit, so a delete-capable user is never shown a read-only row', async () => {
        // Admin also carries create: PUT and DELETE share the `admin` relation.
        const checkAllowed = async (path) => path.includes(`relation=${RELATION_ADMIN}`);
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canCreate: true, canDelete: true });
    });

    // ---- the #955 migration window ------------------------------------------
    //
    // The API stays additive: a tuple written before its migration ran still
    // names `general_roman_calendar`, and `forMissals()` still honours it. But
    // `GET /admin/permissions/check` answers on the object it is handed and does
    // NOT widen, so the UI has to ask both — otherwise it hides a control whose
    // write the API would have accepted.

    it('honours a legacy general_roman_calendar grant on a typical edition', async () => {
        const seen = [];
        const checkAllowed = async (path) => {
            seen.push(path);
            return path.includes('object_type=general_roman_calendar')
                && path.includes('object_id=EDITIO_TYPICA_1970');
        };
        const caps = await detectMissalCapabilities({
            missals: [VA_1970], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: true, canCreate: true, canDelete: true });
        // The rite-qualified object is still asked FIRST; the legacy one is a fallback.
        expect(seen[0]).toContain('object_type=rite_calendar');
    });

    it('honours a legacy grant on the AMBROSIAN typical edition, whose legacy id was bare', async () => {
        // Missal ids are unique across rites, so `general_roman_calendar:EDITIO_TYPICA_2024`
        // genuinely denoted the Ambrosian edition. The pairing is therefore
        // unconditional across rites — unlike the fixed sub-resources'.
        const checkAllowed = async (path) =>
            path.includes('object_type=general_roman_calendar')
            && path.includes('object_id=EDITIO_TYPICA_2024');
        const caps = await detectMissalCapabilities({
            missals: [AMBR], rite: 'ambrosian', baseRegion: 'AMBROSIAN',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('EDITIO_TYPICA_2024')).toEqual({ canEdit: true, canCreate: true, canDelete: true });
    });

    it('does not ask a legacy object for a national edition, which never had one', async () => {
        const seen = [];
        await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false,
            checkAllowed: async (path) => { seen.push(path); return false; }
        });
        expect(seen.every((p) => p.includes('object_type=national_calendar'))).toBe(true);
    });

    it('asks the legacy object only once the qualified one has denied', async () => {
        const seen = [];
        await detectMissalCapabilities({
            missals: [VA_1970], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false,
            // Allowed on the new object: the legacy fallback must not be reached.
            checkAllowed: async (path) => { seen.push(path); return true; }
        });
        expect(seen.every((p) => p.includes('object_type=rite_calendar'))).toBe(true);
    });
});
