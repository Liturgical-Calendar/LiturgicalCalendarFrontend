export class Fga {
    private url = process.env.OPENFGA_API_URL!.replace(/\/$/, '');
    private store = process.env.OPENFGA_STORE_ID!;
    private model = process.env.OPENFGA_MODEL_ID!;

    private async post(path: string, body: unknown): Promise<{ status: number; text: string }> {
        // Abort after 10s so a hung OpenFGA call can't block setup/cleanup indefinitely.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch(`${this.url}/stores/${this.store}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            return { status: res.status, text: await res.text() };
        } finally {
            clearTimeout(timeout);
        }
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

    async delete(user: string, relation: string, object: string): Promise<void> {
        const r = await this.post('/write', {
            deletes: { tuple_keys: [{ user, relation, object }] },
            authorization_model_id: this.model,
        });
        if (r.status >= 400 && !/not found|cannot delete/i.test(r.text)) {
            throw new Error(`FGA delete ${r.status}: ${r.text}`);
        }
    }

    async check(user: string, relation: string, object: string): Promise<boolean> {
        const r = await this.post('/check', {
            tuple_key: { user, relation, object },
            authorization_model_id: this.model,
        });
        if (r.status >= 400) throw new Error(`FGA check ${r.status}: ${r.text}`);
        return JSON.parse(r.text).allowed === true;
    }
}
