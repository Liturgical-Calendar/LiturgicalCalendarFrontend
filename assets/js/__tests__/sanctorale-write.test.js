/**
 * The write transport.
 *
 * Reads and writes differ in a way that is invisible until it fails: the reads
 * are public and answer with a wildcard CORS header a browser refuses to pair
 * with credentials, while the writes echo the validated origin and require them.
 * So `getJson` cannot be reused, and this pins the difference.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

let writeJson, entryPath, ApiWriteError;

beforeAll(async () => {
    global.window = global.window ?? {};
    ({ writeJson, entryPath, ApiWriteError } = await import('../sanctorale.js'));
});

afterEach(() => { vi.unstubAllGlobals(); });

const respond = (status, body, ok = status < 400) => vi.fn(async () => ({
    ok, status,
    json: async () => {
        if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
        return body;
    }
}));

describe('entryPath', () => {
    it('addresses one entry, rite first', () => {
        expect(entryPath('roman', 'US_2011', 'StIsidore'))
            .toBe('/missals/roman/US_2011/StIsidore');
    });

    it('encodes each segment separately', () => {
        expect(entryPath('roman', 'US 2011', 'St/Isidore'))
            .toBe('/missals/roman/US%202011/St%2FIsidore');
    });
});

describe('writeJson', () => {
    it('sends credentials, which the read helper must never do', () => {
        const fetchMock = respond(200, { success: 'ok' });
        vi.stubGlobal('fetch', fetchMock);
        return writeJson('PATCH', '/missals/roman/US_2011/StIsidore', { day: 16 }).then(() => {
            const [, init] = fetchMock.mock.calls[0];
            expect(init.credentials).toBe('include');
            expect(init.method).toBe('PATCH');
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(JSON.parse(init.body)).toEqual({ day: 16 });
        });
    });

    it('sends no body when there is none, so DELETE stays bodyless', async () => {
        const fetchMock = respond(200, { success: 'gone' });
        vi.stubGlobal('fetch', fetchMock);
        await writeJson('DELETE', '/missals/roman/US_2011/StIsidore');
        expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });

    it('returns null for an empty body instead of reporting a success as a failure', async () => {
        // This is issue #503 item 3, the bug the old editor shipped: an unguarded
        // response.json() on a 204 throws, is caught, and surfaces as "failed to save".
        vi.stubGlobal('fetch', respond(204, undefined));
        await expect(writeJson('DELETE', '/missals/roman/US_2011/StIsidore')).resolves.toBeNull();
    });

    it('throws an ApiWriteError carrying the parsed body, so a 409 can be shown', async () => {
        const conflict = { error: 'StIsidore is declared on 4/4 by EDITIO_TYPICA_1970' };
        vi.stubGlobal('fetch', respond(409, conflict, false));
        await expect(writeJson('PATCH', '/missals/roman/US_2011/StIsidore', { day: 16 }))
            .rejects.toMatchObject({ status: 409, body: conflict });
    });

    it('still throws when an error response has no parseable body', async () => {
        vi.stubGlobal('fetch', respond(403, undefined, false));
        await expect(writeJson('PATCH', '/missals/roman/US_2011/StIsidore', { day: 16 }))
            .rejects.toBeInstanceOf(ApiWriteError);
    });
});
