/**
 * Mailpit verification-email retrieval for the registration scenarios (01/04).
 *
 * Mailpit (axllent/mailpit) exposes a REST API on MAILPIT_API_URL (host http://localhost:8025
 * in the local stack; service `mailpit`, SMTP at mailpit:1025 where Zitadel delivers). We query
 * `GET /api/v1/messages` (newest-first) for the latest message to an address, then
 * `GET /api/v1/message/{ID}` for its body, and extract the Zitadel verification link.
 *
 * `fetchImpl` is injectable so the unit test runs without a live Mailpit.
 */
const MAILPIT_API_URL = (process.env.MAILPIT_API_URL || 'http://localhost:8025').replace(/\/$/, '');

type FetchLike = typeof fetch;

interface MailpitListItem {
    ID: string;
    To?: Array<{ Address?: string }>;
}

export async function latestMessageTo(
    toEmail: string,
    fetchImpl: FetchLike = fetch,
): Promise<{ id: string; html: string; text: string } | null> {
    const listRes = await fetchImpl(`${MAILPIT_API_URL}/api/v1/messages`);
    if (!listRes.ok) return null;
    const list = (await listRes.json()) as { messages?: MailpitListItem[] };
    const target = toEmail.toLowerCase();
    const msg = (list.messages || []).find(
        (m) => (m.To || []).some((t) => (t.Address || '').toLowerCase() === target),
    );
    if (!msg) return null;

    const msgRes = await fetchImpl(`${MAILPIT_API_URL}/api/v1/message/${encodeURIComponent(msg.ID)}`);
    if (!msgRes.ok) return null;
    const body = (await msgRes.json()) as { HTML?: string; Text?: string };
    return { id: msg.ID, html: body.HTML || '', text: body.Text || '' };
}

export async function waitForVerificationLink(
    toEmail: string,
    opts: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? 30000;
    const fetchImpl = opts.fetchImpl ?? fetch;
    // Date.now() is available in e2e TS (only restricted in workflow scripts).
    const deadline = Date.now() + timeoutMs;
    let lastErr = 'no message for address';

    while (Date.now() < deadline) {
        const msg = await latestMessageTo(toEmail, fetchImpl);
        if (msg) {
            const link = extractVerificationUrl(msg.html) || extractVerificationUrl(msg.text);
            if (link) return link;
            lastErr = 'message found but no verification link';
        }
        await new Promise<void>((r) => setTimeout(r, 500));
    }
    throw new Error(`waitForVerificationLink: timed out for ${toEmail} (${lastErr})`);
}

/**
 * Extract the verification URL from an email body. Prefers an href whose URL mentions
 * verification (verif/verify/code=); falls back to the first http(s) URL in the body.
 */
function extractVerificationUrl(body: string): string | null {
    if (!body) return null;
    const hrefMatch = body.match(/href=["']([^"']*(?:verif|verify|code=)[^"']*)["']/i);
    if (hrefMatch) return decodeHtmlEntities(hrefMatch[1]);
    const urlMatch = body.match(/https?:\/\/[^\s"'<>]+/i);
    return urlMatch ? decodeHtmlEntities(urlMatch[0]) : null;
}

function decodeHtmlEntities(s: string): string {
    // Single-pass replace of the two HTML encodings of '&'. Chained .replace() calls can
    // double-unescape (e.g. "&amp;#38;" -> "&#38;" -> "&"); one alternation pass over the
    // original string decodes each occurrence exactly once.
    return s.replace(/&(amp|#38);/g, '&');
}
