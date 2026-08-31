/**
 * Curation gating for admin-locales.
 *
 * The two rules worth pinning are asymmetric on purpose, mirroring the API:
 * promotion is readiness-gated because making a locale official turns quiet
 * degradation into a hard failure, while demotion is not — it only loosens
 * enforcement — but it may never empty the official list.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let disabledReason;
let curationNoticeVariant;

const strings = {
    readOnly:         'Curation is unavailable.',
    volatile:         'Changes here are not durable.',
    reviewed:         'Changes here are reviewed.',
    notReadyHint:     'This locale is not ready to be promoted.',
    lastOfficialHint: 'This is the only officially supported locale.'
};

const WRITABLE_CR   = { writable: true,  mode: 'change_request', reason: 'recorded as a reviewable change request' };
const WRITABLE_DISK = { writable: true,  mode: 'disk',           reason: 'the next deploy would overwrite it' };
const REFUSED       = { writable: false, mode: 'misconfigured',  reason: 'Postgres and/or OpenFGA are not reachable' };

beforeAll(async () => {
    // The module reads window.AdminLocalesConfig at import time and self-runs only
    // when its table exists; neither is present here, which is the point.
    global.window = global.window ?? {};
    const mod = await import('../admin-locales.js');
    disabledReason        = mod.disabledReason;
    curationNoticeVariant = mod.curationNoticeVariant;
});

describe('disabledReason', () => {
    it('refuses every action when curation is not writable, quoting the API reason', () => {
        expect(disabledReason({ ready: true, official: false }, 'promote', REFUSED, 5, strings))
            .toBe(REFUSED.reason);
        expect(disabledReason({ ready: true, official: true }, 'demote', REFUSED, 5, strings))
            .toBe(REFUSED.reason);
    });

    it('refuses when curation state is unknown, rather than assuming it is allowed', () => {
        expect(disabledReason({ ready: true, official: false }, 'promote', null, 5, strings))
            .toBe(strings.readOnly);
    });

    it('gates promotion on readiness', () => {
        expect(disabledReason({ ready: false, official: false }, 'promote', WRITABLE_CR, 5, strings))
            .toBe(strings.notReadyHint);
        expect(disabledReason({ ready: true, official: false }, 'promote', WRITABLE_CR, 5, strings))
            .toBeNull();
    });

    it('does NOT gate demotion on readiness — that asymmetry is deliberate', () => {
        expect(disabledReason({ ready: false, official: true }, 'demote', WRITABLE_CR, 5, strings))
            .toBeNull();
    });

    it('refuses to demote the last official locale', () => {
        expect(disabledReason({ ready: true, official: true }, 'demote', WRITABLE_CR, 1, strings))
            .toBe(strings.lastOfficialHint);
        expect(disabledReason({ ready: true, official: true }, 'demote', WRITABLE_CR, 2, strings))
            .toBeNull();
    });

    it('reports unwritability ahead of the per-row reason it would otherwise mask', () => {
        // Not ready AND not writable: the deployment-wide refusal is the useful one.
        expect(disabledReason({ ready: false, official: false }, 'promote', REFUSED, 5, strings))
            .toBe(REFUSED.reason);
    });
});

describe('curationNoticeVariant', () => {
    it('distinguishes refused, volatile and reviewed — three states, not two', () => {
        expect(curationNoticeVariant(REFUSED, strings))
            .toEqual({ variant: 'danger', label: strings.readOnly });
        expect(curationNoticeVariant(WRITABLE_DISK, strings))
            .toEqual({ variant: 'warning', label: strings.volatile });
        expect(curationNoticeVariant(WRITABLE_CR, strings))
            .toEqual({ variant: 'info', label: strings.reviewed });
    });

    it('warns on disk mode even though it is writable', () => {
        // The regression this guards: an early draft returned nothing whenever
        // `writable` was true, hiding the warning that the next deploy reverts it.
        expect(curationNoticeVariant(WRITABLE_DISK, strings).variant).not.toBe('info');
    });
});
