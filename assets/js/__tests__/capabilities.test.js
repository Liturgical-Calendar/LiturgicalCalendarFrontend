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
    it('maps an editio typica onto general_roman_calendar, by missal id', () => {
        expect(missalFgaObject(VA_1970, 'roman', 'VA'))
            .toEqual({ objectType: 'general_roman_calendar', objectId: 'EDITIO_TYPICA_1970' });
    });

    it('maps a national edition onto its rite-qualified national calendar', () => {
        expect(missalFgaObject(US_2011, 'roman', 'VA'))
            .toEqual({ objectType: 'national_calendar', objectId: 'roman/US' });
    });

    it('treats a single-region rite as entirely base', () => {
        // The Ambrosian edition IS the base of its rite, so it is a GRC object even
        // though AMBROSIAN is not a nation code.
        expect(missalFgaObject(AMBR, 'ambrosian', 'AMBROSIAN'))
            .toEqual({ objectType: 'general_roman_calendar', objectId: 'EDITIO_TYPICA_2024' });
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
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canDelete: true });
    });

    it('denies everything when there is no subject to check', async () => {
        const checkAllowed = vi.fn();
        const caps = await detectMissalCapabilities({
            missals: [VA_1970], rite: 'roman', baseRegion: 'VA',
            userSub: '', isGlobalAdmin: false, checkAllowed
        });
        expect(checkAllowed).not.toHaveBeenCalled();
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: false, canDelete: false });
    });

    it('resolves each Missal independently, so a scoped grant is scoped', async () => {
        // This is the whole point: editor on US_2011, nothing on the 1970 typica.
        const checkAllowed = async (path) =>
            path.includes('object_id=roman%2FUS') && path.includes(`relation=${RELATION_EDITOR}`);
        const caps = await detectMissalCapabilities({
            missals: [VA_1970, US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canDelete: false });
        expect(caps.get('EDITIO_TYPICA_1970')).toEqual({ canEdit: false, canDelete: false });
    });

    it('treats a failing check as a denial rather than propagating', async () => {
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false,
            checkAllowed: async () => { throw new Error('network'); }
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: false, canDelete: false });
    });

    it('admin implies edit, so a delete-capable user is never shown a read-only row', async () => {
        const checkAllowed = async (path) => path.includes(`relation=${RELATION_ADMIN}`);
        const caps = await detectMissalCapabilities({
            missals: [US_2011], rite: 'roman', baseRegion: 'VA',
            userSub: 'u', isGlobalAdmin: false, checkAllowed
        });
        expect(caps.get('US_2011')).toEqual({ canEdit: true, canDelete: true });
    });
});
