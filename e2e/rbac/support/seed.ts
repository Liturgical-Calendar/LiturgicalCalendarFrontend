import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { USERS } from './users';
import { ZitadelAdmin } from './zitadel';
import { Fga } from './fga';

const ISSUER = (process.env.ZITADEL_ISSUER || 'http://localhost:8080').replace(/\/$/, '');
// Reuse the existing Zitadel OIDC client (authorization_code + PKCE, public/no-secret) for the
// headless login flow. We drive it server-side via the session API rather than a browser redirect.
const CLIENT_ID = process.env.ZITADEL_CLIENT_ID!;
const REDIRECT_URI = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback.php`;
// Zitadel matches requests by its configured external domain; send Host = the issuer hostname
// (port-stripped) rather than hardcoding 'localhost', so a non-localhost ZITADEL_ISSUER still works.
const HOST = new URL(ISSUER).hostname;
const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function seedUser(id: string): Promise<string> {
    const u = USERS[id];
    const z = new ZitadelAdmin();
    const f = new Fga();

    const existing = await z.findUserIdByEmail(u.email);
    if (existing) {
        if (u.fga) await f.delete(`user:${existing}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`);
        await z.deleteUser(existing);
    }
    const userId = await z.createVerifiedUser({ email: u.email, password: u.password, firstName: u.id, lastName: 'E2E' });
    await z.grantProjectRole(userId, u.role);
    // Seed the FGA tuple only for resource-admins. Editor grants are earned via the
    // request-access UI in scenarios (the approval outcome), seeded per-spec where a
    // scenario needs the grant as a precondition (see support/grant.ts).
    if (u.fga?.relation === 'admin') {
        await f.write(`user:${userId}`, u.fga.relation, `${u.fga.objectType}:${u.fga.objectId}`);
    }
    return userId;
}

/**
 * Obtain a Zitadel OIDC access token (JWT) for a user via the headless session→PKCE flow.
 * `loginClientToken` is a session-capable PAT (minted for the `login-client` user in setup).
 * Returns the access_token to be set as the `litcal_access_token` cookie.
 */
export async function oidcLogin(email: string, password: string, loginClientToken: string): Promise<string> {
    const Hl = { Authorization: `Bearer ${loginClientToken}`, 'Content-Type': 'application/json', Host: HOST };
    const json = async (r: Response) => { const t = await r.text(); if (!r.ok) throw new Error(`${r.url} -> ${r.status}: ${t}`); return JSON.parse(t); };

    // 1. Create a password-checked session (login-client token).
    const s = await json(await fetch(`${ISSUER}/v2/sessions`, {
        method: 'POST', headers: Hl,
        body: JSON.stringify({ checks: { user: { loginName: email }, password: { password } } }),
    }));

    // 2. Start an OIDC auth request (Frontend client, PKCE S256) → 302 to login-v2 with ?authRequest=...
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const qs = new URLSearchParams({
        response_type: 'code', client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
        scope: 'openid profile email', code_challenge: challenge, code_challenge_method: 'S256', state: id_state(),
    });
    const authResp = await fetch(`${ISSUER}/oauth/v2/authorize?${qs}`, { headers: { Host: HOST }, redirect: 'manual' });
    const loc = authResp.headers.get('location') || '';
    const arMatch = loc.match(/authRequest(?:Id)?=([^&]+)/);
    if (!arMatch) throw new Error(`authorize did not return an authRequest id: ${authResp.status} ${loc}`);
    const authRequestId = decodeURIComponent(arMatch[1]);

    // 3. Finalize the auth request with the session (login-client token) → callbackUrl with ?code=
    const fin = await json(await fetch(`${ISSUER}/v2/oidc/auth_requests/${authRequestId}`, {
        method: 'POST', headers: Hl,
        body: JSON.stringify({ session: { sessionId: s.sessionId, sessionToken: s.sessionToken } }),
    }));
    const codeMatch = String(fin.callbackUrl || '').match(/[?&]code=([^&]+)/);
    if (!codeMatch) throw new Error(`finalize returned no code: ${JSON.stringify(fin)}`);
    const code = decodeURIComponent(codeMatch[1]);

    // 4. Exchange the code for tokens (public client, PKCE — no client secret).
    const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, code_verifier: verifier });
    const tok = await json(await fetch(`${ISSUER}/oauth/v2/token`, {
        method: 'POST', headers: { Host: HOST, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    }));
    if (!tok.access_token) throw new Error(`token exchange returned no access_token: ${JSON.stringify(tok)}`);
    return tok.access_token as string;
}

// state param need only be opaque/unique-ish; avoid Math.random for determinism-friendliness.
function id_state(): string { return b64url(crypto.randomBytes(8)); }

/**
 * Log a user in headlessly and write a Playwright storageState file containing the
 * `litcal_access_token` cookie. Cookie domain is `localhost` (port-agnostic) so it is sent to
 * both the frontend (:3000) and the API (:8000). The real cookie is HttpOnly.
 */
export async function loginAndSaveState(id: string, loginClientToken: string): Promise<void> {
    const u = USERS[id];
    const accessToken = await oidcLogin(u.email, u.password, loginClientToken);
    const storageState = {
        cookies: [{
            name: 'litcal_access_token', value: accessToken, domain: 'localhost', path: '/',
            expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' as const,
        }],
        origins: [],
    };
    const authPath = path.join(__dirname, '..', '..', '.auth', `${id}.json`);
    fs.mkdirSync(path.dirname(authPath), { recursive: true });
    fs.writeFileSync(authPath, JSON.stringify(storageState, null, 2));
}
