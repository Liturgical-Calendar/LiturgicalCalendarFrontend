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
    for (const id of REGISTRATION_USER_IDS) expect(SEEDED_USER_IDS).not.toContain(id);
});
