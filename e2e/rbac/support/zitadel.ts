export class ZitadelAdmin {
    private issuer = process.env.ZITADEL_ISSUER!.replace(/\/$/, '');
    private token = process.env.ZITADEL_MACHINE_TOKEN!;
    private orgId = process.env.ZITADEL_ORG_ID!;
    private projectId = process.env.ZITADEL_PROJECT_ID!;

    private async req(method: string, path: string, body?: unknown): Promise<any> {
        const res = await fetch(`${this.issuer}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'x-zitadel-orgid': this.orgId,
                // Send Host = the issuer hostname (port-stripped) so a non-localhost
                // ZITADEL_ISSUER still matches Zitadel's configured external domain.
                Host: new URL(this.issuer).hostname,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`Zitadel ${method} ${path} -> ${res.status}: ${text}`);
        return text ? JSON.parse(text) : {};
    }

    async findUserIdByEmail(email: string): Promise<string | null> {
        const data = await this.req('POST', '/v2/users', {
            queries: [
                { emailQuery: { emailAddress: email } },
                { stateQuery: { state: 'USER_STATE_ACTIVE' } },
            ],
        });
        const u = (data.result ?? [])[0];
        return u?.userId ?? null;
    }

    async createVerifiedUser(u: { email: string; password: string; firstName: string; lastName: string }): Promise<string> {
        const data = await this.req('POST', '/v2/users/human', {
            profile: { givenName: u.firstName, familyName: u.lastName },
            email: { email: u.email, isVerified: true },
            password: { password: u.password, changeRequired: false },
        });
        // Zitadel's search projection (users14) is eventually consistent; poll until the
        // new user is visible to findUserIdByEmail before returning. The window must
        // absorb projection lag during the setup's delete-all-then-reseed churn, where a
        // burst of user.removed/user.added events queues behind the search projection — a
        // tight 2.25 s window flaked there. 40 × 250 ms = 10 s is generous but bounded.
        // Fail fast if it never appears: a user invisible to search after the full window
        // would otherwise be silently skipped by findUserIdByEmail-based cleanup, orphaning it.
        const maxAttempts = 40;
        let found: string | null = null;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            found = await this.findUserIdByEmail(u.email);
            if (found !== null) break;
            await new Promise<void>(r => setTimeout(r, 250));
        }
        if (found === null) {
            throw new Error(`createVerifiedUser: projection timed out — ${u.email} not visible to search after ${maxAttempts} attempts`);
        }
        return data.userId as string;
    }

    async grantProjectRole(userId: string, role: string): Promise<void> {
        await this.req('POST', `/management/v1/users/${userId}/grants`, {
            projectId: this.projectId,
            roleKeys: [role],
        });
    }

    async deleteUser(userId: string): Promise<void> {
        // Zitadel soft-deletes users but KEEPS the `usernames` unique-constraint reservation
        // on the deleted user's username (which defaults to the email). A later re-create of
        // the same email then fails with 409 "User already exists" even though no active user
        // holds it — fragmenting the seed set on every delete→reseed cycle (the recurring
        // rbac-setup flake). Rename the username to a unique throwaway BEFORE deleting, so the
        // reservation that lingers is on the throwaway, freeing the real email for the next
        // seed. (Verified: PUT /v2/users/human/{id} {username} releases the original reservation;
        // re-creating the freed email then succeeds.) Best-effort: if the rename fails, fall
        // through to the delete anyway — never worse than the un-renamed soft-delete.
        const throwaway = `deleted-${userId}@litcal.invalid`;
        try {
            await this.req('PUT', `/v2/users/human/${userId}`, { username: throwaway });
        } catch (e) {
            console.warn(`deleteUser: username anonymize failed for ${userId} (constraint may linger): ${String(e)}`);
        }
        try {
            await this.req('DELETE', `/v2/users/${userId}`);
        } catch (e) {
            // 404 on DELETE means the user was already removed from the command store
            // (possibly by a concurrent cleanup, or the search projection shows a stale
            // ACTIVE entry whose aggregate was already deleted). Treat as a no-op: the
            // goal (user absent) is already satisfied. Re-throw everything else.
            if (!String(e).includes('-> 404:')) throw e;
            console.warn(`deleteUser: DELETE returned 404 for ${userId} (already removed; projection drift)`);
        }
        // Zitadel's search projection is eventually consistent; a brief pause ensures
        // callers can immediately call findUserIdByEmail and get a consistent result.
        await new Promise<void>(r => setTimeout(r, 200));
    }

    async findUserIdByUsername(userName: string): Promise<string | null> {
        const data = await this.req('POST', '/v2/users', {
            queries: [
                { userNameQuery: { userName } },
                { stateQuery: { state: 'USER_STATE_ACTIVE' } },
            ],
        });
        const u = (data.result ?? [])[0];
        return u?.userId ?? null;
    }

    async mintPat(userId: string): Promise<{ tokenId: string; token: string }> {
        // Short-lived PAT (6h) for the ephemeral setup flow: minimizes the blast
        // radius if cleanup (deletePat) fails to remove it. The setup→test→cleanup
        // cycle is minutes, so 6h is ample margin.
        const expirationDate = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
        const data = await this.req('POST', `/management/v1/users/${userId}/pats`, {
            expirationDate,
        });
        return { tokenId: data.tokenId as string, token: data.token as string };
    }

    async deletePat(userId: string, tokenId: string): Promise<void> {
        await this.req('DELETE', `/management/v1/users/${userId}/pats/${tokenId}`);
    }
}
