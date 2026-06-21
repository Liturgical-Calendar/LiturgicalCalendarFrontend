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
        // Zitadel's search projection is eventually consistent; poll until the new
        // user is visible to findUserIdByEmail before returning (max ~2.25 s).
        const maxAttempts = 15;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const found = await this.findUserIdByEmail(u.email);
            if (found !== null) break;
            await new Promise<void>(r => setTimeout(r, 150));
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
        await this.req('DELETE', `/v2/users/${userId}`);
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
        const data = await this.req('POST', `/management/v1/users/${userId}/pats`, {
            expirationDate: '2030-01-01T00:00:00Z',
        });
        return { tokenId: data.tokenId as string, token: data.token as string };
    }

    async deletePat(userId: string, tokenId: string): Promise<void> {
        await this.req('DELETE', `/management/v1/users/${userId}/pats/${tokenId}`);
    }
}
