import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { USERS, type RbacUser } from './users';
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

/**
 * Provision a user in Zitadel: delete any account already holding the email, create a verified
 * one, grant its project role, and — for resource-admins only — write its FGA tuple.
 *
 * Takes the record rather than a USERS key so an identity that is deliberately NOT a USERS
 * member can be seeded too. That matters because rbac.setup.ts calls deleteAllSeededUsers(),
 * which iterates Object.keys(USERS): anything in that map is deleted at the start of an rbac
 * run. See E2E_ADMIN in e2e/auth.setup.ts, which must survive one.
 */
export async function seedUserRecord(u: RbacUser): Promise<string> {
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

/** seedUserRecord() addressed by USERS key. */
export async function seedUser(id: string): Promise<string> {
    return seedUserRecord(USERS[id]);
}

/**
 * Obtain Zitadel OIDC tokens for a user via the headless session→PKCE flow.
 * `loginClientToken` is a session-capable PAT (minted for the `login-client` user in setup).
 * Returns both the access_token and id_token; production's auth/callback.php sets BOTH as
 * cookies, and AuthHelper's OIDC mode reads user claims (email_verified, name, …) from the
 * id_token in preference to the access token — so the harness must carry the id_token too.
 */
export async function oidcLogin(
    email: string,
    password: string,
    loginClientToken: string,
    userId?: string,
): Promise<{ accessToken: string; idToken: string | null }> {
    const Hl = { Authorization: `Bearer ${loginClientToken}`, 'Content-Type': 'application/json', Host: HOST };
    const json = async (r: Response) => { const t = await r.text(); if (!r.ok) throw new Error(`${r.url} -> ${r.status}: ${t}`); return JSON.parse(t); };

    // 1. Create a password-checked session (login-client token).
    // Prefer userId when provided: avoids Zitadel search-projection phantom collisions where
    // a stale entry for the same email coexists with the newly-created user. Falling back to
    // loginName (email) is safe when no phantom is present.
    const userCheck = userId ? { userId } : { loginName: email };
    const s = await json(await fetch(`${ISSUER}/v2/sessions`, {
        method: 'POST', headers: Hl,
        body: JSON.stringify({ checks: { user: userCheck, password: { password } } }),
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
    return { accessToken: tok.access_token as string, idToken: (tok.id_token ?? null) as string | null };
}

// state param need only be opaque/unique-ish; avoid Math.random for determinism-friendliness.
function id_state(): string { return b64url(crypto.randomBytes(8)); }

/**
 * Log a user in headlessly and write a Playwright storageState file containing the
 * `litcal_access_token` AND `litcal_id_token` cookies — mirroring production's
 * auth/callback.php, which sets both. AuthHelper's OIDC mode prefers the id_token for
 * user claims (email_verified, name, …), so omitting it leaves seeded users looking
 * email-unverified (blocked from email-verified-gated pages like permission-requests.php).
 * Cookie domain is `localhost` (port-agnostic) so cookies reach both the frontend (:3000)
 * and the API (:8000). The real cookies are HttpOnly.
 *
 * Takes the record rather than a USERS key, and accepts an explicit output path, so a caller
 * outside the rbac suite can drive the same flow to a different destination — e2e/auth.setup.ts
 * writes the shared `e2e/.auth/user.json` the chromium projects declare as their storageState.
 */
export async function loginAndSaveStateAs(
    u: RbacUser,
    loginClientToken: string,
    userId?: string,
    authPath?: string,
): Promise<void> {
    const { accessToken, idToken } = await oidcLogin(u.email, u.password, loginClientToken, userId);
    const cookieBase = {
        domain: 'localhost', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' as const,
    };
    const cookies = [{ name: 'litcal_access_token', value: accessToken, ...cookieBase }];
    if (idToken) cookies.push({ name: 'litcal_id_token', value: idToken, ...cookieBase });
    const storageState = {
        cookies,
        origins: [],
    };
    const target = authPath ?? path.join(__dirname, '..', '..', '.auth', `${u.id}.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(storageState, null, 2));
}

/** loginAndSaveStateAs() addressed by USERS key, writing `e2e/.auth/{id}.json`. */
export async function loginAndSaveState(id: string, loginClientToken: string, userId?: string): Promise<void> {
    return loginAndSaveStateAs(USERS[id], loginClientToken, userId);
}

/**
 * Provision a user on demand within a spec's precondition: create the Zitadel account + role
 * (+ admin FGA tuple, for admin-relation users) AND write its login storageState so
 * `actingAs(browser, userKey)` works. Factors the per-user logic of rbac.setup.ts, minting and
 * deleting its own ephemeral login-client PAT. Use this for scenarios that need a
 * REGISTRATION_USER (e.g. cei-admin) to already exist as a precondition — those users are not
 * seeded by rbac.setup.ts. Idempotent on the user (seedUser deletes-existing-first).
 */
export async function seedAndLogin(userKey: string): Promise<string> {
    const z = new ZitadelAdmin();
    const loginClientUserId = await z.findUserIdByUsername('login-client');
    if (!loginClientUserId) throw new Error('seedAndLogin: login-client machine user not found in Zitadel');
    const pat = await z.mintPat(loginClientUserId);
    try {
        const userId = await seedUser(userKey);
        await loginAndSaveState(userKey, pat.token, userId);
        return userId;
    } finally {
        // Surface (don't swallow) a PAT-revocation failure so a leaked ephemeral token is
        // visible, while still not masking a real error from the seeding above.
        await z.deletePat(loginClientUserId, pat.tokenId).catch((e) =>
            console.warn('seedAndLogin: failed to delete ephemeral PAT (token may persist):', String(e)),
        );
    }
}
