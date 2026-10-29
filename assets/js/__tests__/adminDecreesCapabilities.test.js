/**
 * Capability detection on the decrees page (assets/js/admin-decrees.js).
 *
 * Reading comes from the role (LiturgicalCalendarAPI #1049): `canView` is the
 * server-side rule passed in as `AdminDecreesConfig.canView`, and no
 * `/admin/permissions/check` call asks about `viewer` any more. `canEdit` and
 * `canAdmin` still come from the `editor` / `admin` relation checks.
 *
 * window.AdminDecreesConfig and fetch must be in place BEFORE the module is
 * imported: it reads the config and starts detectCapabilities() at load time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => {
    const state = { allowed: new Set(), relationsAsked: [] };
    globalThis.window = globalThis;
    globalThis.window.AdminDecreesConfig = {
        apiUrl:  'http://localhost:8000',
        locale:  'en-US',
        userSub: 'test-sub',
        isGlobalAdmin: false,
        canView: false,
        i18n: {},
    };
    globalThis.fetch = async (url) => {
        const relation = new URL(url).searchParams.get('relation');
        state.relationsAsked.push(relation);
        const body = JSON.stringify({ allowed: state.allowed.has(relation) });
        return { ok: true, status: 200, text: async () => body };
    };
    return state;
});

import { detectCapabilities } from '../admin-decrees.js';

const config = window.AdminDecreesConfig;

beforeEach(() => {
    state.allowed = new Set();
    state.relationsAsked = [];
    config.isGlobalAdmin = false;
    config.userSub = 'test-sub';
    config.canView = false;
});

describe('detectCapabilities', () => {
    it('reads canView from the page config, not from a viewer check', async () => {
        config.canView = true;
        await expect(detectCapabilities()).resolves.toEqual({ canView: true, canEdit: false, canAdmin: false });
        expect(state.relationsAsked).not.toContain('viewer');
        expect(state.relationsAsked.sort()).toEqual(['admin', 'editor']);
    });

    it('denies reading when the config says the role does not read', async () => {
        await expect(detectCapabilities()).resolves.toEqual({ canView: false, canEdit: false, canAdmin: false });
        expect(state.relationsAsked).not.toContain('viewer');
    });

    it('keeps the editor and admin relation checks', async () => {
        config.canView = true;
        state.allowed = new Set(['editor']);
        await expect(detectCapabilities()).resolves.toEqual({ canView: true, canEdit: true, canAdmin: false });

        state.allowed = new Set(['admin']);
        await expect(detectCapabilities()).resolves.toEqual({ canView: true, canEdit: true, canAdmin: true });
    });

    it('without a user sub, reads from the role but asks no relation', async () => {
        config.userSub = '';
        config.canView = true;
        await expect(detectCapabilities()).resolves.toEqual({ canView: true, canEdit: false, canAdmin: false });
        expect(state.relationsAsked).toEqual([]);
    });

    it('still short-circuits a global admin without asking the API', async () => {
        config.isGlobalAdmin = true;
        await expect(detectCapabilities()).resolves.toEqual({ canView: true, canEdit: true, canAdmin: true });
        expect(state.relationsAsked).toEqual([]);
    });
});
