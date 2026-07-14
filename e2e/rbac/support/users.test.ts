import { test, expect } from '@playwright/test';
import { USERS, SEEDED_USER_IDS, REGISTRATION_USER_IDS } from './users';

test('matrix has 13 users with unique emails', () => {
    const ids = Object.keys(USERS);
    expect(ids).toHaveLength(13);
    const emails = ids.map((i) => USERS[i].email);
    expect(new Set(emails).size).toBe(13);
});

test('roles are assigned per fixture design: super-admin=admin, tests-editor*=test_editor, rest=calendar_editor', () => {
    const validRoles = ['admin', 'calendar_editor', 'test_editor'];
    const testEditorIds = ['tests-editor', 'tests-editor-noscope'];

    for (const id of Object.keys(USERS)) {
        expect(validRoles).toContain(USERS[id].role);

        if (id === 'super-admin') {
            expect(USERS[id].role).toBe('admin');
        } else if (testEditorIds.includes(id)) {
            expect(USERS[id].role).toBe('test_editor');
        } else {
            expect(USERS[id].role).toBe('calendar_editor');
        }
    }
});

test('super-admin has no fga scope; tests-editor-noscope has no fga scope by design; all others are scoped', () => {
    expect(USERS['super-admin'].fga).toBeNull();
    // tests-editor-noscope is the deliberate "role without scope" fixture: test_editor role, fga: null
    expect(USERS['tests-editor-noscope'].fga).toBeNull();

    const scopedIds = Object.keys(USERS).filter(
        (id) => id !== 'super-admin' && id !== 'tests-editor-noscope'
    );
    for (const id of scopedIds) {
        expect(USERS[id].fga).not.toBeNull();
    }
});

test('registration users are a subset not included in seeded ids', () => {
    expect(REGISTRATION_USER_IDS).toEqual(['cei-admin', 'usccb-editor']);
    for (const id of REGISTRATION_USER_IDS) expect(SEEDED_USER_IDS).not.toContain(id);
});
