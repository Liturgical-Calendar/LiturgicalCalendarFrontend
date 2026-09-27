/**
 * Fetching many small resources without tripping the API's rate limit.
 *
 * The calendar editors load one translation file per locale, and a wider region
 * has two dozen of them. Fired all at once, the production nginx answers part of
 * the burst with `429 Too Many Requests` — and that 429 carries no CORS header, so
 * the browser cannot even read its status: the fetch rejects with a TypeError and
 * the console calls it a CORS failure. Staging lost 8 of the Americas' 23 locales
 * that way.
 *
 * So the loads are bounded (a few in flight at a time) and each one is retried
 * with backoff on the failures a rate limit produces. Both are only safe because
 * these are idempotent GETs.
 *
 * @module boundedFetch
 */

/** Statuses a rate limiter or an overloaded upstream answers with. */
const RETRYABLE_STATUSES = Object.freeze([429, 502, 503, 504]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Map `items` through async `task`, at most `limit` at a time, keeping order.
 *
 * Rejects with the first rejection, like Promise.all, but starts no new task
 * after it.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} task
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    let failed = false;
    const worker = async () => {
        while (!failed && next < items.length) {
            const index = next++;
            try {
                results[index] = await task(items[index], index);
            } catch (error) {
                failed = true;
                throw error;
            }
        }
    };
    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
    await Promise.all(workers);
    return results;
}

/**
 * `fetch()`, retried with exponential backoff on a rate-limit status or on a
 * network error (which is how a CORS-less 429 reaches the page).
 *
 * A non-retryable response is returned as-is for the caller to judge, and so is
 * the last retryable one once the attempts run out.
 *
 * @param {RequestInfo} input
 * @param {RequestInit} [init]
 * @param {{retries?: number, baseDelayMs?: number, fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>}} [options]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(input, init = {}, options = {}) {
    const { retries = 4, baseDelayMs = 400, fetchImpl = globalThis.fetch, sleep = defaultSleep } = options;
    for (let attempt = 0; ; attempt++) {
        let response;
        try {
            response = await fetchImpl(input, init);
        } catch (error) {
            if (attempt >= retries) throw error;
            await sleep(baseDelayMs * 2 ** attempt);
            continue;
        }
        if (!RETRYABLE_STATUSES.includes(response.status) || attempt >= retries) {
            return response;
        }
        await sleep(baseDelayMs * 2 ** attempt);
    }
}
