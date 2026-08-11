# Frontend RBAC E2E — Harness Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Build the reusable Playwright harness that seeds ~11 scoped Zitadel users + OpenFGA tuples,
saves a per-user authenticated session, and proves it end-to-end with one dashboard-scoping smoke spec.

**Architecture:** A new Playwright project `rbac` with its own setup dependency. Seeding is done in
TypeScript against the Zitadel management API and OpenFGA HTTP API directly (self-contained in the
frontend worktree — no API-repo changes). Per-user `storageState` files are produced by the setup project;
an `actingAs(user)` fixture opens a browser context as any user. Cleanup deletes seeded Zitadel users +
FGA tuples and truncates app tables via `docker compose exec db psql`.

**Tech Stack:** Playwright (`@playwright/test`), TypeScript, Zitadel management API v1/v2, OpenFGA HTTP API,
Mailpit API (Phase 2), the project's `docker-compose` stack.

## Global Constraints

- Suite lives under `e2e/rbac/`; do NOT modify `e2e/auth.setup.ts` or the existing specs.
- Playwright runs **serial, single worker** (shared API/DB/FGA state) — keep `fullyParallel: false`.
- All seeded users use email pattern `<user-id>+e2e@litcal.test` so cleanup targets only test users.
- All seeded users live in the **LiturgicalCalendar Zitadel org** (id from `ZITADEL_ORG_ID`).
- Reuse existing env: `API_PROTOCOL/HOST/PORT`, `FRONTEND_URL`, `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`,
  `ZITADEL_MACHINE_TOKEN`, `ZITADEL_ORG_ID`, `OPENFGA_API_URL`, `OPENFGA_STORE_ID`, `OPENFGA_MODEL_ID`.
  (`ZITADEL_CLIENT_ID` is the OIDC client reused for the headless PKCE login flow in Task 5.)
- TypeScript strict: the suite typechecks under `e2e/tsconfig.json` (`yarn typecheck`).
- Project role for non-super users is `calendar_editor`; `super-admin` gets the global `admin` role.

## Environment status (pre-flight done 2026-06-21)

- Run the **frontend** docker stack (`docker compose up -d` in the frontend dir; compose project
  `liturgicalcalendarfrontend`) — NOT the API repo's stack. They share ports, so only one runs at a time.
  Host ports: api 8000, frontend 3000, zitadel 8080, openfga 8083, mailpit 8025. WSL single-file
  bind-mount flakes → `docker compose up -d --force-recreate litcal-frontend`.
- Playwright runs on the **host** and loads `.env.development`. Already added there:
  `ZITADEL_ORG_ID=372235991517298694` and `ZITADEL_MACHINE_TOKEN` (the `test-service-account` token).
  Project/store/model IDs already match the running stack.
- **Login mechanism (validated):** `/auth/login` only authenticates the configured admin, NOT Zitadel
  users. Scoped users authenticate via a Zitadel **OIDC access token** in the `litcal_access_token` cookie
  (validated by `OidcAuthMiddleware`); verify a user via the **frontend `/auth/me.php`** (the API's
  `/auth/me` is HS256/admin-only). The headless token flow (session API + PKCE) is implemented in Task 5
  and was proven end-to-end. The session API needs a `login-client` PAT minted at setup (Task 7). See the
  `project_rbac_e2e_harness` memory for the full validated sequence.

---

### Task 1: Scaffold the `rbac` Playwright project

**Files:**

- Modify: `playwright.config.ts` (add a `rbac` project + its setup)
- Create: `e2e/rbac/.gitignore` (ignore `../.auth/*.json` is already covered; add report dirs if any)
- Create: `e2e/rbac/support/.gitkeep`

**Interfaces:**

- Produces: a Playwright project named `rbac` whose `storageState` is resolved per-spec (not globally),
  depending on a setup project `rbac-setup` that runs `e2e/rbac/rbac.setup.ts`.

- [ ] **Step 1: Add the rbac setup + project to `playwright.config.ts`**

In the `projects` array, append:

```typescript
{
    // Unit/integration tests for the support modules (users/zitadel/fga/seed/cleanup).
    // They run against the live stack but do NOT need the full seed, so no dependency.
    name: 'rbac-support',
    testMatch: /rbac\/support\/.*\.test\.ts/,
},
{
    name: 'rbac-setup',
    testMatch: /rbac\/rbac\.setup\.ts/,
},
{
    name: 'rbac',
    testMatch: /rbac\/.*\.spec\.ts/,
    use: { ...devices['Desktop Chrome'] },
    dependencies: ['rbac-setup'],
},
```

(No global `storageState` here — rbac specs open contexts per user via the `actingAs` fixture in Task 8.
Support `*.test.ts` files run under `--project=rbac-support`; `*.spec.ts` under `--project=rbac`.)

- [ ] **Step 2: Verify config still parses**

Run: `cd LiturgicalCalendarFrontend-e2e-rbac && yarn playwright test --list --project=rbac 2>&1 | head`
Expected: lists 0 rbac specs (none yet) without a config error.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts e2e/rbac/support/.gitkeep
git commit -m "test(rbac): scaffold rbac Playwright project"
```

---

### Task 2: User matrix (`users.ts`)

**Files:**

- Create: `e2e/rbac/support/users.ts`
- Test: `e2e/rbac/support/users.test.ts`

**Interfaces:**

- Produces:
    - `type RbacUser = { id: string; email: string; password: string; role: 'admin' | 'calendar_editor';
fga: { relation: 'admin' | 'editor'; objectType: string; objectId: string } | null }`
    - `const USERS: Record<string, RbacUser>` keyed by id (`super-admin`, `cei-admin`, …, `europe-editor`)
    - `const SEEDED_USER_IDS: string[]` and `const REGISTRATION_USER_IDS: string[]` (`cei-admin`,
      `usccb-editor`) — the two whose specs use real registration (their seeding is skipped in setup).

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from '@playwright/test';
import { USERS, SEEDED_USER_IDS, REGISTRATION_USER_IDS } from './users';

test('matrix has 11 users with unique emails', () => {
    const ids = Object.keys(USERS);
    expect(ids).toHaveLength(11);
    const emails = ids.map((i) => USERS[i].email);
    expect(new Set(emails).size).toBe(11);
});

test('only super-admin holds the global admin role; others are calendar_editor', () => {
    expect(USERS['super-admin'].role).toBe('admin');
    expect(USERS['super-admin'].fga).toBeNull();
    for (const id of Object.keys(USERS).filter((i) => i !== 'super-admin')) {
        expect(USERS[id].role).toBe('calendar_editor');
        expect(USERS[id].fga).not.toBeNull();
    }
});

test('registration users are a subset not included in seeded ids', () => {
    expect(REGISTRATION_USER_IDS).toEqual(['cei-admin', 'usccb-editor']);
    for (const id of REGISTRATION_USER_IDS)
        expect(SEEDED_USER_IDS).not.toContain(id);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn playwright test e2e/rbac/support/users.test.ts --project=rbac-support`
Expected: FAIL — cannot find module `./users`.

- [ ] **Step 3: Implement `users.ts`**

```typescript
export type RbacRelation = 'admin' | 'editor';

export interface RbacUser {
    id: string;
    email: string;
    password: string;
    role: 'admin' | 'calendar_editor';
    fga: {
        relation: RbacRelation;
        objectType: string;
        objectId: string;
    } | null;
}

const pw = 'E2e-Test-Passw0rd!'; // shared test password; users live only in the test org

function mk(
    id: string,
    role: RbacUser['role'],
    fga: RbacUser['fga'],
): RbacUser {
    return { id, email: `${id}+e2e@litcal.test`, password: pw, role, fga };
}

export const USERS: Record<string, RbacUser> = {
    'super-admin': mk('super-admin', 'admin', null),
    'cei-admin': mk('cei-admin', 'calendar_editor', {
        relation: 'admin',
        objectType: 'national_calendar',
        objectId: 'IT',
    }),
    'cei-editor': mk('cei-editor', 'calendar_editor', {
        relation: 'editor',
        objectType: 'national_calendar',
        objectId: 'IT',
    }),
    'usccb-admin': mk('usccb-admin', 'calendar_editor', {
        relation: 'admin',
        objectType: 'national_calendar',
        objectId: 'US',
    }),
    'usccb-editor': mk('usccb-editor', 'calendar_editor', {
        relation: 'editor',
        objectType: 'national_calendar',
        objectId: 'US',
    }),
    'rome-admin': mk('rome-admin', 'calendar_editor', {
        relation: 'admin',
        objectType: 'diocesan_calendar',
        objectId: 'romamo_it',
    }),
    'rome-editor': mk('rome-editor', 'calendar_editor', {
        relation: 'editor',
        objectType: 'diocesan_calendar',
        objectId: 'romamo_it',
    }),
    'grc-admin': mk('grc-admin', 'calendar_editor', {
        relation: 'admin',
        objectType: 'general_roman_calendar',
        objectId: 'temporale',
    }),
    'grc-editor': mk('grc-editor', 'calendar_editor', {
        relation: 'editor',
        objectType: 'general_roman_calendar',
        objectId: 'temporale',
    }),
    'europe-admin': mk('europe-admin', 'calendar_editor', {
        relation: 'admin',
        objectType: 'wider_region',
        objectId: 'Europe',
    }),
    'europe-editor': mk('europe-editor', 'calendar_editor', {
        relation: 'editor',
        objectType: 'wider_region',
        objectId: 'Europe',
    }),
};

export const REGISTRATION_USER_IDS = ['cei-admin', 'usccb-editor'];
export const SEEDED_USER_IDS = Object.keys(USERS).filter(
    (id) => !REGISTRATION_USER_IDS.includes(id),
);
```

> RESOLVED (verified against API source data + live stack, 2026-06-21): nation codes are `IT`/`US` (NOT
> `USA`); wider_region is `Europe` (NOT `EU`); `general_roman_calendar` is one of the enumerated ids
> `temporale,EDITIO_TYPICA_1970,EDITIO_TYPICA_2002,EDITIO_TYPICA_2008,decrees` (NOT `GRC`) — using
> `temporale`; `diocesan_calendar:romamo_it` confirmed. Zitadel project roles `admin` + `calendar_editor`
> both confirmed valid. This matrix is the single source of truth.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn playwright test e2e/rbac/support/users.test.ts --project=rbac-support`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/users.ts e2e/rbac/support/users.test.ts
git commit -m "test(rbac): user/permission seed matrix"
```

---

### Task 3: Zitadel admin client (`support/zitadel.ts`)

**Files:**

- Create: `e2e/rbac/support/zitadel.ts`
- Test: `e2e/rbac/support/zitadel.test.ts`

**Interfaces:**

- Consumes: env `ZITADEL_ISSUER`, `ZITADEL_MACHINE_TOKEN`, `ZITADEL_ORG_ID`, and `ZITADEL_PROJECT_ID`
  (for role grants).
- Produces a `ZitadelAdmin` class:
    - `findUserIdByEmail(email: string): Promise<string | null>`
    - `findUserIdByUsername(userName: string): Promise<string | null>` — used to locate the `login-client`
      machine user.
    - `createVerifiedUser(u: { email: string; password: string; firstName: string; lastName: string }):
Promise<string>` — returns the new userId; email pre-verified, password set, not requiring change.
    - `grantProjectRole(userId: string, role: string): Promise<void>`
    - `deleteUser(userId: string): Promise<void>`
    - `mintPat(userId: string): Promise<{ tokenId: string; token: string }>` — create a Personal Access
      Token for a (machine) user via `POST /management/v1/users/{userId}/pats`.
    - `deletePat(userId: string, tokenId: string): Promise<void>`
    - all calls send `Authorization: Bearer <machine token>`, `Host: localhost` (Zitadel's ExternalDomain
      is `localhost`; Node `fetch` CAN set the Host header), and the org header
      `x-zitadel-orgid: <ZITADEL_ORG_ID>`.

> NOTE: The `ZITADEL_MACHINE_TOKEN` belongs to the `test-service-account` machine user. It can create
> users / grant roles, but CANNOT create Zitadel sessions (lacks `IAM_LOGIN_CLIENT`). The login flow
> (Task 5) needs a session-capable token; mint a fresh PAT for the `login-client` user with `mintPat`
> and use that (the volume's `login-client.pat` is stale). Verified against the live stack 2026-06-21.

- [ ] **Step 1: Write the failing test** (runs against the live Zitadel in the stack)

```typescript
import { test, expect } from '@playwright/test';
import { ZitadelAdmin } from './zitadel';

test('create, find, grant role, delete a verified user', async () => {
    const z = new ZitadelAdmin();
    const email = `zit-probe+e2e@litcal.test`;
    // clean slate
    const existing = await z.findUserIdByEmail(email);
    if (existing) await z.deleteUser(existing);

    const id = await z.createVerifiedUser({
        email,
        password: 'E2e-Test-Passw0rd!',
        firstName: 'Zit',
        lastName: 'Probe',
    });
    expect(id).toMatch(/^\d+$/);
    expect(await z.findUserIdByEmail(email)).toBe(id);

    await z.grantProjectRole(id, 'calendar_editor'); // must not throw
    await z.deleteUser(id);
    expect(await z.findUserIdByEmail(email)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn playwright test e2e/rbac/support/zitadel.test.ts --project=rbac-support`
Expected: FAIL — cannot find module `./zitadel`.

- [ ] **Step 3: Implement `zitadel.ts`**

Use the Zitadel v2 user API for create (`POST {issuer}/v2/users/human`) with
`{ profile, email: { email, isVerified: true }, password: { password, changeRequired: false } }`,
v2 search (`POST {issuer}/v2/users` with an `emailQuery`), v1 management grant
(`POST {issuer}/management/v1/users/{id}/grants` with `{ projectId, roleKeys: [role] }`), and v2 delete
(`DELETE {issuer}/v2/users/{id}`). Headers on every call:
`{ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'x-zitadel-orgid': orgId }`.

```typescript
export class ZitadelAdmin {
    private issuer = process.env.ZITADEL_ISSUER!.replace(/\/$/, '');
    private token = process.env.ZITADEL_MACHINE_TOKEN!;
    private orgId = process.env.ZITADEL_ORG_ID!;
    private projectId = process.env.ZITADEL_PROJECT_ID!;

    private async req(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<any> {
        const res = await fetch(`${this.issuer}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'x-zitadel-orgid': this.orgId,
                Host: new URL(this.issuer).hostname,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok)
            throw new Error(
                `Zitadel ${method} ${path} -> ${res.status}: ${text}`,
            );
        return text ? JSON.parse(text) : {};
    }

    async findUserIdByEmail(email: string): Promise<string | null> {
        const data = await this.req('POST', '/v2/users', {
            queries: [{ emailQuery: { emailAddress: email } }],
        });
        const u = (data.result ?? [])[0];
        return u?.userId ?? null;
    }

    async createVerifiedUser(u: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
    }): Promise<string> {
        const data = await this.req('POST', '/v2/users/human', {
            profile: { givenName: u.firstName, familyName: u.lastName },
            email: { email: u.email, isVerified: true },
            password: { password: u.password, changeRequired: false },
        });
        return data.userId as string;
    }

    async grantProjectRole(userId: string, role: string): Promise<void> {
        await this.req('POST', `/management/v1/users/${userId}/grants`, {
            projectId: this.projectId,
            roleKeys: [role],
        });
    }

    async deleteUser(userId: string): Promise<void> {
        await this.req('DELETE', `/v2/users/${userId}`);
    }

    async findUserIdByUsername(userName: string): Promise<string | null> {
        const data = await this.req('POST', '/v2/users', {
            queries: [{ userNameQuery: { userName } }],
        });
        const u = (data.result ?? [])[0];
        return u?.userId ?? null;
    }

    async mintPat(userId: string): Promise<{ tokenId: string; token: string }> {
        const data = await this.req(
            'POST',
            `/management/v1/users/${userId}/pats`,
            {
                expirationDate: '2030-01-01T00:00:00Z',
            },
        );
        return { tokenId: data.tokenId as string, token: data.token as string };
    }

    async deletePat(userId: string, tokenId: string): Promise<void> {
        await this.req(
            'DELETE',
            `/management/v1/users/${userId}/pats/${tokenId}`,
        );
    }
}
```

> NOTE during execution: exact v2 request/response field names vary slightly by Zitadel version; verify
> against `scripts/setup-zitadel.sh` in the API repo (which already calls these APIs) and the running
> instance, adjusting field names if a call 4xxs.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn playwright test e2e/rbac/support/zitadel.test.ts --project=rbac-support`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/zitadel.ts e2e/rbac/support/zitadel.test.ts
git commit -m "test(rbac): zitadel admin client (create/find/grant/delete user)"
```

---

### Task 4: OpenFGA client (`support/fga.ts`)

**Files:**

- Create: `e2e/rbac/support/fga.ts`
- Test: `e2e/rbac/support/fga.test.ts`

**Interfaces:**

- Consumes: env `OPENFGA_API_URL`, `OPENFGA_STORE_ID`, `OPENFGA_MODEL_ID`.
- Produces a `Fga` class:
    - `write(user: string, relation: string, object: string): Promise<void>` (idempotent — ignores
      `already exists`)
    - `delete(user: string, relation: string, object: string): Promise<void>` (idempotent — ignores
      `not found`)
    - `check(user: string, relation: string, object: string): Promise<boolean>`
    - where `user` is `user:<zitadelUserId>` and `object` is `<objectType>:<objectId>`.

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from '@playwright/test';
import { Fga } from './fga';

test('write, check true, delete, check false (idempotent)', async () => {
    const f = new Fga();
    const user = 'user:fga-probe-e2e';
    const obj = 'national_calendar:ZZ';
    await f.delete(user, 'admin', obj); // clean slate, must not throw
    expect(await f.check(user, 'admin', obj)).toBe(false);
    await f.write(user, 'admin', obj);
    await f.write(user, 'admin', obj); // idempotent
    expect(await f.check(user, 'admin', obj)).toBe(true);
    await f.delete(user, 'admin', obj);
    expect(await f.check(user, 'admin', obj)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn playwright test e2e/rbac/support/fga.test.ts --project=rbac-support`
Expected: FAIL — cannot find module `./fga`.

- [ ] **Step 3: Implement `fga.ts`**

```typescript
export class Fga {
    private url = process.env.OPENFGA_API_URL!.replace(/\/$/, '');
    private store = process.env.OPENFGA_STORE_ID!;
    private model = process.env.OPENFGA_MODEL_ID!;

    private async post(
        path: string,
        body: unknown,
    ): Promise<{ status: number; text: string }> {
        const res = await fetch(`${this.url}/stores/${this.store}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return { status: res.status, text: await res.text() };
    }

    async write(user: string, relation: string, object: string): Promise<void> {
        const r = await this.post('/write', {
            writes: { tuple_keys: [{ user, relation, object }] },
            authorization_model_id: this.model,
        });
        if (r.status >= 400 && !/already exists|duplicate/i.test(r.text)) {
            throw new Error(`FGA write ${r.status}: ${r.text}`);
        }
    }

    async delete(
        user: string,
        relation: string,
        object: string,
    ): Promise<void> {
        const r = await this.post('/write', {
            deletes: { tuple_keys: [{ user, relation, object }] },
            authorization_model_id: this.model,
        });
        if (r.status >= 400 && !/not found|cannot delete/i.test(r.text)) {
            throw new Error(`FGA delete ${r.status}: ${r.text}`);
        }
    }

    async check(
        user: string,
        relation: string,
        object: string,
    ): Promise<boolean> {
        const r = await this.post('/check', {
            tuple_key: { user, relation, object },
            authorization_model_id: this.model,
        });
        if (r.status >= 400)
            throw new Error(`FGA check ${r.status}: ${r.text}`);
        return JSON.parse(r.text).allowed === true;
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn playwright test e2e/rbac/support/fga.test.ts --project=rbac-support`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/fga.ts e2e/rbac/support/fga.test.ts
git commit -m "test(rbac): openfga tuple client (write/delete/check)"
```

---

### Task 5: Seed + login one user (`support/seed.ts`)

**Files:**

- Create: `e2e/rbac/support/seed.ts`
- Test: `e2e/rbac/support/seed.test.ts`

**Interfaces:**

- Consumes: `USERS`, `ZitadelAdmin`, `Fga`.
- Produces:
    - `seedUser(id: string): Promise<string>` — upsert (delete-then-create) the Zitadel user, grant the
      role, write the FGA tuple (if any); returns the Zitadel userId.
    - `oidcLogin(email: string, password: string, loginClientToken: string): Promise<string>` — run the
      headless Zitadel session→PKCE flow and return a Zitadel OIDC access token (JWT).
    - `loginAndSaveState(id: string, loginClientToken: string): Promise<void>` — call `oidcLogin` and write
      a Playwright `storageState` to `e2e/.auth/<id>.json` containing the `litcal_access_token` cookie
      (domain `localhost`, HttpOnly). The `loginClientToken` is a session-capable PAT minted for the
      `login-client` user in setup (Task 7).

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from '@playwright/test';
import { seedUser } from './seed';
import { Fga } from './fga';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('seedUser creates user, grants role, writes scoped tuple', async () => {
    const id = await seedUser('cei-editor');
    expect(id).toMatch(/^\d+$/);
    const f = new Fga();
    const u = USERS['cei-editor'].fga!;
    expect(
        await f.check(
            `user:${id}`,
            u.relation,
            `${u.objectType}:${u.objectId}`,
        ),
    ).toBe(true);
    // cleanup
    await new ZitadelAdmin().deleteUser(id);
    await f.delete(`user:${id}`, u.relation, `${u.objectType}:${u.objectId}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn playwright test e2e/rbac/support/seed.test.ts --project=rbac-support`
Expected: FAIL — cannot find module `./seed`.

- [ ] **Step 3: Implement `seed.ts`**

```typescript
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { USERS } from './users';
import { ZitadelAdmin } from './zitadel';
import { Fga } from './fga';

const ISSUER = (process.env.ZITADEL_ISSUER || 'http://localhost:8080').replace(
    /\/$/,
    '',
);
// Reuse the existing Zitadel OIDC client (authorization_code + PKCE, public/no-secret) for the
// headless login flow. We drive it server-side via the session API rather than a browser redirect.
const CLIENT_ID = process.env.ZITADEL_CLIENT_ID!;
const REDIRECT_URI = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback.php`;
// Zitadel matches requests by its configured external domain; send Host = the issuer hostname
// (port-stripped) rather than hardcoding 'localhost', so a non-localhost ZITADEL_ISSUER still works.
const HOST = new URL(ISSUER).hostname;
const b64url = (b: Buffer) =>
    b
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

export async function seedUser(id: string): Promise<string> {
    const u = USERS[id];
    const z = new ZitadelAdmin();
    const f = new Fga();

    const existing = await z.findUserIdByEmail(u.email);
    if (existing) {
        if (u.fga)
            await f.delete(
                `user:${existing}`,
                u.fga.relation,
                `${u.fga.objectType}:${u.fga.objectId}`,
            );
        await z.deleteUser(existing);
    }
    const userId = await z.createVerifiedUser({
        email: u.email,
        password: u.password,
        firstName: u.id,
        lastName: 'E2E',
    });
    await z.grantProjectRole(userId, u.role);
    if (u.fga)
        await f.write(
            `user:${userId}`,
            u.fga.relation,
            `${u.fga.objectType}:${u.fga.objectId}`,
        );
    return userId;
}

/**
 * Obtain a Zitadel OIDC access token (JWT) for a user via the headless session→PKCE flow.
 * `loginClientToken` is a session-capable PAT (minted for the `login-client` user in setup).
 * Returns the access_token to be set as the `litcal_access_token` cookie.
 */
export async function oidcLogin(
    email: string,
    password: string,
    loginClientToken: string,
): Promise<string> {
    const Hl = {
        Authorization: `Bearer ${loginClientToken}`,
        'Content-Type': 'application/json',
        Host: HOST,
    };
    const json = async (r: Response) => {
        const t = await r.text();
        if (!r.ok) throw new Error(`${r.url} -> ${r.status}: ${t}`);
        return JSON.parse(t);
    };

    // 1. Create a password-checked session (login-client token).
    const s = await json(
        await fetch(`${ISSUER}/v2/sessions`, {
            method: 'POST',
            headers: Hl,
            body: JSON.stringify({
                checks: { user: { loginName: email }, password: { password } },
            }),
        }),
    );

    // 2. Start an OIDC auth request (Frontend client, PKCE S256) → 302 to login-v2 with ?authRequest=...
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(
        crypto.createHash('sha256').update(verifier).digest(),
    );
    const qs = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile email',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: id_state(),
    });
    const authResp = await fetch(`${ISSUER}/oauth/v2/authorize?${qs}`, {
        headers: { Host: HOST },
        redirect: 'manual',
    });
    const loc = authResp.headers.get('location') || '';
    const arMatch = loc.match(/authRequest(?:Id)?=([^&]+)/);
    if (!arMatch)
        throw new Error(
            `authorize did not return an authRequest id: ${authResp.status} ${loc}`,
        );
    const authRequestId = decodeURIComponent(arMatch[1]);

    // 3. Finalize the auth request with the session (login-client token) → callbackUrl with ?code=
    const fin = await json(
        await fetch(`${ISSUER}/v2/oidc/auth_requests/${authRequestId}`, {
            method: 'POST',
            headers: Hl,
            body: JSON.stringify({
                session: {
                    sessionId: s.sessionId,
                    sessionToken: s.sessionToken,
                },
            }),
        }),
    );
    const codeMatch = String(fin.callbackUrl || '').match(/[?&]code=([^&]+)/);
    if (!codeMatch)
        throw new Error(`finalize returned no code: ${JSON.stringify(fin)}`);
    const code = decodeURIComponent(codeMatch[1]);

    // 4. Exchange the code for tokens (public client, PKCE — no client secret).
    const form = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
    });
    const tok = await json(
        await fetch(`${ISSUER}/oauth/v2/token`, {
            method: 'POST',
            headers: {
                Host: HOST,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form,
        }),
    );
    if (!tok.access_token)
        throw new Error(
            `token exchange returned no access_token: ${JSON.stringify(tok)}`,
        );
    return tok.access_token as string;
}

// state param need only be opaque/unique-ish; avoid Math.random for determinism-friendliness.
function id_state(): string {
    return b64url(crypto.randomBytes(8));
}

/**
 * Log a user in headlessly and write a Playwright storageState file containing the
 * `litcal_access_token` cookie. Cookie domain is `localhost` (port-agnostic) so it is sent to
 * both the frontend (:3000) and the API (:8000). The real cookie is HttpOnly.
 */
export async function loginAndSaveState(
    id: string,
    loginClientToken: string,
): Promise<void> {
    const u = USERS[id];
    const accessToken = await oidcLogin(u.email, u.password, loginClientToken);
    const storageState = {
        cookies: [
            {
                name: 'litcal_access_token',
                value: accessToken,
                domain: 'localhost',
                path: '/',
                expires: -1,
                httpOnly: true,
                secure: false,
                sameSite: 'Lax' as const,
            },
        ],
        origins: [],
    };
    const authPath = path.join(__dirname, '..', '..', '.auth', `${id}.json`);
    fs.mkdirSync(path.dirname(authPath), { recursive: true });
    fs.writeFileSync(authPath, JSON.stringify(storageState, null, 2));
}
```

> Validated end-to-end against the live frontend stack on 2026-06-21 (session 201 → finalize 200 → token
> 200; frontend `/auth/me.php` returns `{authenticated:true, roles:[...]}`). `/auth/login` was confirmed
> NOT usable for Zitadel users (it only authenticates the configured admin). All Zitadel calls require the
> `Host: localhost` header.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn playwright test e2e/rbac/support/seed.test.ts --project=rbac-support`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/seed.ts e2e/rbac/support/seed.test.ts
git commit -m "test(rbac): seed one user (zitadel + role + fga tuple)"
```

---

### Task 6: Cleanup (`support/cleanup.ts`)

**Files:**

- Create: `e2e/rbac/support/cleanup.ts`
- Test: `e2e/rbac/support/cleanup.test.ts`

**Interfaces:**

- Produces:
    - `truncateAppTables(): Promise<void>` — `docker compose exec -T db psql` TRUNCATE of
      `access_requests`, `audit_log`, and the user-notification-state table.
    - `deleteAllSeededUsers(): Promise<void>` — for each id in `USERS`, find by email, delete the Zitadel
      user and its FGA tuple if present.

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from '@playwright/test';
import { truncateAppTables, deleteAllSeededUsers } from './cleanup';
import { seedUser } from './seed';
import { ZitadelAdmin } from './zitadel';
import { USERS } from './users';

test('deleteAllSeededUsers removes a seeded user', async () => {
    await seedUser('rome-editor');
    await deleteAllSeededUsers();
    expect(
        await new ZitadelAdmin().findUserIdByEmail(USERS['rome-editor'].email),
    ).toBeNull();
});

test('truncateAppTables runs without error', async () => {
    await truncateAppTables();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn playwright test e2e/rbac/support/cleanup.test.ts --project=rbac-support`
Expected: FAIL — cannot find module `./cleanup`.

- [ ] **Step 3: Implement `cleanup.ts`**

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
import { USERS } from './users';
import { ZitadelAdmin } from './zitadel';
import { Fga } from './fga';

const exec = promisify(execFile);

export async function truncateAppTables(): Promise<void> {
    // The active docker stack is the FRONTEND compose project (this repo root), not the API repo's.
    // Run `docker compose exec` from the frontend repo root so it targets the running `db` service.
    const sql =
        'TRUNCATE access_requests, audit_log, user_notification_state RESTART IDENTITY CASCADE;';
    await exec('docker', [
        'compose',
        'exec',
        '-T',
        'db',
        'psql',
        '-U',
        'litcal',
        '-d',
        'litcal',
        '-c',
        sql,
    ]);
}

export async function deleteAllSeededUsers(): Promise<void> {
    const z = new ZitadelAdmin();
    const f = new Fga();
    for (const id of Object.keys(USERS)) {
        const u = USERS[id];
        const zid = await z.findUserIdByEmail(u.email);
        if (!zid) continue;
        if (u.fga)
            await f.delete(
                `user:${zid}`,
                u.fga.relation,
                `${u.fga.objectType}:${u.fga.objectId}`,
            );
        await z.deleteUser(zid);
    }
}
```

> RESOLVED (verified against the live db 2026-06-21): db/user are `litcal`/`litcal`; tables
> `access_requests`, `audit_log`, `user_notification_state` all exist. The TRUNCATE list and psql
> user/db in the code above are correct as written.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn playwright test e2e/rbac/support/cleanup.test.ts --project=rbac-support`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/cleanup.ts e2e/rbac/support/cleanup.test.ts
git commit -m "test(rbac): cleanup (truncate app tables, delete seeded users)"
```

---

### Task 7: Global setup (`rbac.setup.ts`)

**Files:**

- Create: `e2e/rbac/rbac.setup.ts`

**Interfaces:**

- Consumes: `truncateAppTables`, `deleteAllSeededUsers`, `seedUser`, `loginAndSaveState`,
  `SEEDED_USER_IDS`.
- Produces: 9 `e2e/.auth/<id>.json` session files (all `SEEDED_USER_IDS`), with a clean DB + clean
  Zitadel/FGA state beforehand. (The 2 `REGISTRATION_USER_IDS` are intentionally not seeded.)

- [ ] **Step 1: Implement the setup**

```typescript
import { test as setup } from '@playwright/test';
import { truncateAppTables, deleteAllSeededUsers } from './support/cleanup';
import { seedUser, loginAndSaveState } from './support/seed';
import { SEEDED_USER_IDS } from './support/users';
import { ZitadelAdmin } from './support/zitadel';

setup('seed rbac users', async () => {
    setup.setTimeout(180_000);
    const z = new ZitadelAdmin();

    // The session API needs IAM_LOGIN_CLIENT, which the machine token lacks. Mint a fresh,
    // session-capable PAT for the `login-client` user and delete it when done.
    const loginClientUserId = await z.findUserIdByUsername('login-client');
    if (!loginClientUserId)
        throw new Error('login-client machine user not found in Zitadel');
    const pat = await z.mintPat(loginClientUserId);

    try {
        await deleteAllSeededUsers();
        await truncateAppTables();
        for (const id of SEEDED_USER_IDS) {
            await seedUser(id);
            await loginAndSaveState(id, pat.token);
        }
    } finally {
        await z.deletePat(loginClientUserId, pat.tokenId);
    }
});
```

- [ ] **Step 2: Run the setup standalone**

Run: `yarn playwright test --project=rbac-setup`
Expected: PASS; `ls e2e/.auth` shows 9 `<id>.json` files (super-admin, cei-editor, usccb-admin, …) and
NOT cei-admin/usccb-editor.

- [ ] **Step 3: Commit**

```bash
git add e2e/rbac/rbac.setup.ts
git commit -m "test(rbac): global setup seeds 9 users + saves sessions"
```

---

### Task 8: `actingAs` fixture (`support/actingAs.ts`)

**Files:**

- Create: `e2e/rbac/support/actingAs.ts`
- Test: `e2e/rbac/support/actingAs.spec.ts`

**Interfaces:**

- Consumes: per-user `e2e/.auth/<id>.json` produced by Task 7.
- Produces: `actingAs(browser: Browser, id: string): Promise<{ context: BrowserContext; page: Page }>` —
  opens a context with that user's storageState and a ready page; caller closes the context.

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from '@playwright/test';
import { actingAs } from './actingAs';

test('actingAs super-admin is authenticated with the admin role', async ({
    browser,
}) => {
    const { context, page } = await actingAs(browser, 'super-admin');
    // In OIDC mode the frontend validates the litcal_access_token cookie via its own /auth/me.php
    // (the API's /auth/me is HS256/admin-only and rejects Zitadel OIDC tokens).
    await page.goto('/');
    const me = await page.evaluate(async () => {
        const r = await fetch('/auth/me.php', {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });
        return { status: r.status, body: await r.json() };
    });
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user?.roles ?? me.body.roles).toContain('admin');
    await context.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn playwright test e2e/rbac/support/actingAs.spec.ts --project=rbac`
Expected: FAIL — cannot find module `./actingAs`.

- [ ] **Step 3: Implement `actingAs.ts`**

```typescript
import { Browser, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';

export async function actingAs(
    browser: Browser,
    id: string,
): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        storageState: path.join(__dirname, '..', '..', '.auth', `${id}.json`),
    });
    const page = await context.newPage();
    return { context, page };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn playwright test e2e/rbac/support/actingAs.spec.ts --project=rbac`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/rbac/support/actingAs.ts e2e/rbac/support/actingAs.spec.ts
git commit -m "test(rbac): actingAs fixture (per-user browser context)"
```

---

### Task 9: End-to-end smoke spec — dashboard card scoping

**Files:**

- Create: `e2e/rbac/00-smoke-dashboard-scoping.spec.ts`

**Interfaces:**

- Consumes: `actingAs`. Asserts the harness produces _differently-scoped_ sessions by checking the admin
  dashboard for two users.

- [ ] **Step 1: Write the spec (the deliverable)**

```typescript
import { test, expect } from '@playwright/test';
import { actingAs } from './support/actingAs';

test('super-admin sees the admin section; cei-editor does not', async ({
    browser,
}) => {
    const sa = await actingAs(browser, 'super-admin');
    await sa.page.goto('/admin-dashboard.php');
    // super-admin sees the admin-only section (Users/Permissions); use a stable selector present only for admins
    await expect(sa.page.locator('a[href="admin-users.php"]')).toBeVisible();
    await sa.context.close();

    const ed = await actingAs(browser, 'cei-editor');
    await ed.page.goto('/admin-dashboard.php');
    // a calendar_editor (non-admin) must NOT see the admin-only Users link
    await expect(ed.page.locator('a[href="admin-users.php"]')).toHaveCount(0);
    // but DOES see editor cards (e.g. National)
    await expect(
        ed.page.locator('.admin-block[data-block-id="national"]'),
    ).toBeVisible();
    await ed.context.close();
});
```

- [ ] **Step 2: Run the spec end-to-end**

Run: `yarn playwright test e2e/rbac/00-smoke-dashboard-scoping.spec.ts --project=rbac`
Expected: PASS (setup project runs first, seeds users, then the spec passes). If a selector is wrong,
inspect the real DOM (`admin-dashboard.php`, `includes/admin-blocks.php`) and correct the locator — do not
weaken the assertion.

- [ ] **Step 3: Commit**

```bash
git add e2e/rbac/00-smoke-dashboard-scoping.spec.ts
git commit -m "test(rbac): smoke spec proves per-user dashboard scoping"
```

---

## Self-Review

**Spec coverage (this phase):** Tasks 1–9 cover the harness sections of the spec — Playwright project,
seed matrix, seeding (Zitadel + FGA + role), per-user sessions, `actingAs`, cleanup, and a scoping smoke
spec. The 11 narrative scenarios + real-registration + Mailpit + revoke/negative/scoped-edit/session
specs are **Phase 2** (separate plan), built on this harness — out of scope here by design.

**Placeholder scan:** No "TBD/handle errors/similar to Task N". The three `> NOTE during execution`
callouts are explicit verification points against the live stack (object_ids, Zitadel field names, table
names / login mechanism), not deferred work — each names exactly what to confirm and where.

**Type consistency:** `RbacUser`/`USERS`/`SEEDED_USER_IDS`/`REGISTRATION_USER_IDS` (Task 2) are consumed
unchanged in Tasks 5–8. `ZitadelAdmin` methods (Task 3) and `Fga` methods (Task 4) are used with the same
signatures in `seed.ts`/`cleanup.ts`. `actingAs` returns `{ context, page }` and is used that way in
Tasks 8–9.

## Phase 2 (separate plan, after harness is green)

Scenario specs `01`–`11` from the design spec, each: seed its precondition grants, drive the UI as the
relevant user(s) via `actingAs`, assert request visibility/routing + notifications + dashboard scoping,
and clean up. Includes the two real-registration specs (Zitadel UI + Mailpit) and the negative-auth,
revoke-lifecycle, scoped-edit, and session-resilience specs. Written against the real DOM once the harness
runs green.
