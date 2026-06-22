import { test, expect } from '@playwright/test';
import { waitForVerificationLink } from './mailpit';

test('waitForVerificationLink extracts the verification URL from the newest message', async () => {
    const verifyUrl = 'http://localhost:8080/ui/v2/login/verify?code=ABC&userID=42';
    const fetchImpl = (async (url: string) => {
        if (url.includes('/api/v1/messages')) {
            return new Response(
                JSON.stringify({ messages: [{ ID: 'm1', To: [{ Address: 'cei-admin+e2e@litcal.test' }] }] }),
                { status: 200 },
            );
        }
        if (url.includes('/api/v1/message/m1')) {
            return new Response(JSON.stringify({ HTML: `<a href="${verifyUrl}">Verify</a>`, Text: '' }), { status: 200 });
        }
        return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    const link = await waitForVerificationLink('cei-admin+e2e@litcal.test', { fetchImpl, timeoutMs: 1000 });
    expect(link).toBe(verifyUrl);
});

test('waitForVerificationLink times out when no message arrives', async () => {
    const fetchImpl = (async (url: string) => {
        if (url.includes('/api/v1/messages')) {
            return new Response(JSON.stringify({ messages: [] }), { status: 200 });
        }
        return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    await expect(
        waitForVerificationLink('nobody+e2e@litcal.test', { fetchImpl, timeoutMs: 600 }),
    ).rejects.toThrow(/timed out/i);
});
