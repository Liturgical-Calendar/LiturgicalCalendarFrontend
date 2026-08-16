export type RbacRelation = 'admin' | 'editor';

/**
 * Object ids that name a calendar are rite-qualified `<rite>/<calendarId>`
 * (LiturgicalCalendarAPI #785 for the `*_test` types, #786/#788 for the data
 * resource types) — the API composes and validates exactly this form, so a
 * tuple seeded on a bare id authorizes nothing.
 *
 * `general_roman_calendar` ids stay BARE: `temporale`, `decrees` and the missal
 * editions are not calendars, and are Roman by construction.
 *
 * Every calendar in these fixtures is Roman (IT, US, Europe, and the diocese of
 * Rome). The four Ambrosian dioceses — lugano_ch, milano_it, bergam_it,
 * novara_it — would take `ambrosian/`; none is seeded here.
 */
export const ROMAN = 'roman';

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
    'cei-admin': mk('cei-admin', 'calendar_editor', { relation: 'admin', objectType: 'national_calendar', objectId: `${ROMAN}/IT` }),
    'cei-editor': mk('cei-editor', 'calendar_editor', { relation: 'editor', objectType: 'national_calendar', objectId: `${ROMAN}/IT` }),
    'usccb-admin': mk('usccb-admin', 'calendar_editor', { relation: 'admin', objectType: 'national_calendar', objectId: `${ROMAN}/US` }),
    'usccb-editor': mk('usccb-editor', 'calendar_editor', { relation: 'editor', objectType: 'national_calendar', objectId: `${ROMAN}/US` }),
    'rome-admin': mk('rome-admin', 'calendar_editor', { relation: 'admin', objectType: 'diocesan_calendar', objectId: `${ROMAN}/romamo_it` }),
    'rome-editor': mk('rome-editor', 'calendar_editor', { relation: 'editor', objectType: 'diocesan_calendar', objectId: `${ROMAN}/romamo_it` }),
    'grc-admin': mk('grc-admin', 'calendar_editor', { relation: 'admin', objectType: 'general_roman_calendar', objectId: 'temporale' }),
    'grc-editor': mk('grc-editor', 'calendar_editor', { relation: 'editor', objectType: 'general_roman_calendar', objectId: 'temporale' }),
    'europe-admin': mk('europe-admin', 'calendar_editor', { relation: 'admin', objectType: 'wider_region', objectId: `${ROMAN}/Europe` }),
    'europe-editor': mk('europe-editor', 'calendar_editor', { relation: 'editor', objectType: 'wider_region', objectId: `${ROMAN}/Europe` }),
    'tests-editor': mk('tests-editor', 'test_editor', { relation: 'editor', objectType: 'national_calendar_test', objectId: `${ROMAN}/IT` }),
    'tests-editor-noscope': mk('tests-editor-noscope', 'test_editor', null),
};

export const REGISTRATION_USER_IDS = ['cei-admin', 'usccb-editor'];
export const SEEDED_USER_IDS = Object.keys(USERS).filter((id) => !REGISTRATION_USER_IDS.includes(id));
