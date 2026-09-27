import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry, mapWithConcurrency } from '../boundedFetch.js';

const noSleep = () => Promise.resolve();
const response = (status) => ({ status, ok: status >= 200 && status < 300 });

describe('mapWithConcurrency', () => {
    it('keeps the order of its input', async () => {
        const out = await mapWithConcurrency([30, 10, 20], 2, (ms, i) =>
            new Promise((resolve) => setTimeout(() => resolve(i), ms)));
        expect(out).toEqual([0, 1, 2]);
    });

    it('never runs more than `limit` tasks at once', async () => {
        let inFlight = 0;
        let peak = 0;
        await mapWithConcurrency(Array.from({ length: 23 }, (_, i) => i), 4, async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 1));
            inFlight--;
        });
        expect(peak).toBe(4);
    });

    it('rejects with the first failure and starts nothing after it', async () => {
        const started = [];
        await expect(mapWithConcurrency([0, 1, 2, 3, 4], 1, async (i) => {
            started.push(i);
            if (i === 1) throw new Error('boom');
        })).rejects.toThrow('boom');
        expect(started).toEqual([0, 1]);
    });
});

describe('fetchWithRetry', () => {
    it('retries a 429 and returns the eventual success', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(429))
            .mockResolvedValueOnce(response(200));
        const out = await fetchWithRetry('/x', {}, { fetchImpl, sleep: noSleep });
        expect(out.status).toBe(200);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('retries a network error, which is how a CORS-less 429 reaches the page', async () => {
        const fetchImpl = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(response(200));
        expect((await fetchWithRetry('/x', {}, { fetchImpl, sleep: noSleep })).status).toBe(200);
    });

    it('does not retry a 404: that is an answer, not a rate limit', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(response(404));
        expect((await fetchWithRetry('/x', {}, { fetchImpl, sleep: noSleep })).status).toBe(404);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('gives up after the last retry and backs off exponentially', async () => {
        const sleeps = [];
        const fetchImpl = vi.fn().mockResolvedValue(response(429));
        const out = await fetchWithRetry('/x', {}, {
            fetchImpl, retries: 3, baseDelayMs: 100, sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); }
        });
        expect(out.status).toBe(429);
        expect(fetchImpl).toHaveBeenCalledTimes(4);
        expect(sleeps).toEqual([100, 200, 400]);
    });

    it('rethrows a network error once the retries are spent', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(fetchWithRetry('/x', {}, { fetchImpl, retries: 1, sleep: noSleep })).rejects.toThrow('Failed to fetch');
    });
});
