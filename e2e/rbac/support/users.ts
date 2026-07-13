export type RbacRelation = 'admin' | 'editor';

export interface RbacUser {
    id: string;
    email: string;
    password: string;
    role: 'admin' | 'calendar_editor' | 'test_editor';
    fga: { relation: RbacRelation; objectType: string; objectId: string } | null;
}

const pw = 'E2e-Test-Passw0rd!'; // shared test password; users live only in the test org

function mk(id: string, role: RbacUser['role'], fga: RbacUser['fga']): RbacUser {
    return { id, email: `${id}+e2e@litcal.test`, password: pw, role, fga };
}

export const USERS: Record<string, RbacUser> = {
    'super-admin': mk('super-admin', 'admin', null),
    'cei-admin': mk('cei-admin', 'calendar_editor', { relation: 'admin', objectType: 'national_calendar', objectId: 'IT' }),
    'cei-editor': mk('cei-editor', 'calendar_editor', { relation: 'editor', objectType: 'national_calendar', objectId: 'IT' }),
    'usccb-admin': mk('usccb-admin', 'calendar_editor', { relation: 'admin', objectType: 'national_calendar', objectId: 'US' }),
    'usccb-editor': mk('usccb-editor', 'calendar_editor', { relation: 'editor', objectType: 'national_calendar', objectId: 'US' }),
    'rome-admin': mk('rome-admin', 'calendar_editor', { relation: 'admin', objectType: 'diocesan_calendar', objectId: 'romamo_it' }),
    'rome-editor': mk('rome-editor', 'calendar_editor', { relation: 'editor', objectType: 'diocesan_calendar', objectId: 'romamo_it' }),
    'grc-admin': mk('grc-admin', 'calendar_editor', { relation: 'admin', objectType: 'general_roman_calendar', objectId: 'temporale' }),
    'grc-editor': mk('grc-editor', 'calendar_editor', { relation: 'editor', objectType: 'general_roman_calendar', objectId: 'temporale' }),
    'europe-admin': mk('europe-admin', 'calendar_editor', { relation: 'admin', objectType: 'wider_region', objectId: 'Europe' }),
    'europe-editor': mk('europe-editor', 'calendar_editor', { relation: 'editor', objectType: 'wider_region', objectId: 'Europe' }),
    'tests-editor': mk('tests-editor', 'test_editor', { relation: 'editor', objectType: 'national_calendar_test', objectId: 'IT' }),
    'tests-editor-noscope': mk('tests-editor-noscope', 'test_editor', null),
};

export const REGISTRATION_USER_IDS = ['cei-admin', 'usccb-editor'];
export const SEEDED_USER_IDS = Object.keys(USERS).filter((id) => !REGISTRATION_USER_IDS.includes(id));
