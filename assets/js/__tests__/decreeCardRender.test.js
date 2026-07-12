/**
 * Card-rendering regression tests for admin-decrees.js.
 *
 * window.AdminDecreesConfig must be in place BEFORE the module is imported,
 * because admin-decrees.js evaluates `const config = window.AdminDecreesConfig`
 * at module-load time — same vi.hoisted() pattern as adminDecreesForm.test.js.
 * CSS.escape is stubbed because the test DOM environment does not provide it.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
    globalThis.window = globalThis;
    if (typeof globalThis.CSS === 'undefined') {
        globalThis.CSS = { escape: (s) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&') };
    }
    globalThis.window.AdminDecreesConfig = {
        apiUrl: 'http://localhost:8000',
        locale: 'en-US',
        userSub: 'test-sub',
        isGlobalAdmin: true,
        i18n: {
            translations: 'Translations',
            readings: 'Readings',
            firstReading: 'First reading',
            responsorialPsalm: 'Responsorial psalm',
            secondReading: 'Second reading (optional)',
            gospelAcclamation: 'Gospel acclamation',
            gospel: 'Gospel',
            sinceYear: 'Since %s',
            sourceLink: 'Source',
            managePerms: 'Manage permissions',
            editAriaLabel: 'Edit',
            deleteAriaLabel: 'Delete',
            errorText: '(error)',
            gradeLabels: {
                0: 'weekday', 1: 'commemoration', 2: 'optional memorial', 3: 'memorial',
                4: 'feast', 5: 'feast of the Lord', 6: 'solemnity', 7: 'higher solemnity',
            },
        },
    };
});

import { renderDecreeCard } from '../admin-decrees.js';

const CAPS = { canEdit: true, canAdmin: true };

const createNewDecree = () => ({
    decree_id: 'MaryMotherChurch_Create',
    decree_date: '2018-02-11',
    decree_protocol: 'Prot. N. 10/18',
    description: 'x',
    liturgical_event: {
        event_key: 'MaryMotherChurch',
        name: 'Mary Mother of the Church',
        grade: 3,
        color: ['white'],
        type: 'mobile',
        strtotime: { day_of_the_week: 'Monday', relative_time: 'after', event_key: 'Pentecost' },
        common: ['Proper'],
        readings: {
            first_reading: 'Genesis 3: 9-15, 20|Acts 1: 12-14',
            responsorial_psalm: 'Psalm 87',
            second_reading: 'Acts 1: 12-14',
            gospel_acclamation: '',
            gospel: 'John 19: 25-34',
        },
    },
    metadata: { action: 'createNew', since_year: 2018, url: 'https://www.vatican.va/x' },
});

const gradeChangeDecree = () => ({
    decree_id: 'StMaryMagdalene_Upgrade',
    decree_date: '2016-06-03',
    decree_protocol: 'Prot. N. 257/16',
    description: 'x',
    liturgical_event: {
        event_key: 'StMaryMagdalene',
        name: 'Saint Mary Magdalene',
        grade: 4,
        calendar: 'GENERAL ROMAN',
    },
    metadata: { action: 'setProperty', property: 'grade', since_year: 2016, url: 'https://www.vatican.va/x' },
});

describe('renderDecreeCard: translations toggle gating', () => {
    it('shows the translations toggle for name-bearing decrees (createNew)', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, createNewDecree(), CAPS, ['en', 'it']);
        expect(container.querySelector('[data-bs-target^="#trans-"]')).not.toBeNull();
    });

    it('hides the translations toggle for grade-change decrees (no translatable name)', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, gradeChangeDecree(), CAPS, ['en', 'it']);
        expect(container.querySelector('[data-bs-target^="#trans-"]')).toBeNull();
    });
});

describe('renderDecreeCard: readings panel', () => {
    it('renders flat readings including the optional second reading', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, createNewDecree(), CAPS, ['en', 'it']);
        const panel = container.querySelector('[id^="readings-"]');
        expect(panel).not.toBeNull();
        expect(panel.textContent).toContain('Genesis 3: 9-15, 20|Acts 1: 12-14');
        expect(panel.textContent).toContain('Second reading (optional)');
        expect(panel.textContent).toContain('Acts 1: 12-14');
        // empty gospel_acclamation is skipped
        expect(panel.textContent).not.toContain('Gospel acclamation');
    });

    it('omits the readings toggle when the event has no readings', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, gradeChangeDecree(), CAPS, ['en', 'it']);
        expect(container.querySelector('[data-bs-target^="#readings-"]')).toBeNull();
    });
});
