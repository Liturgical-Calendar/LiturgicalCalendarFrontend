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
