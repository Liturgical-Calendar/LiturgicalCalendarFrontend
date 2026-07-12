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
            noReadings: 'No readings defined for this locale yet',
            sinceYear: 'Since %s',
            sourceLink: 'Source',
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

describe('renderDecreeCard: card title name fallback', () => {
    // Real grade-change decrees carry no translatable name (the fixture's is
    // removed here to match), so the title must come from the event catalog.
    const namelessGradeChange = () => {
        const d = gradeChangeDecree();
        delete d.liturgical_event.name;
        return d;
    };

    it('uses the event-catalog name as the title for a grade-change decree (no own name)', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, namelessGradeChange(), CAPS, ['en', 'it'], {
            StMaryMagdalene: 'Mary Magdalene (from catalog)',
        });
        const header = container.querySelector('.card-header');
        expect(header.textContent).toContain('Mary Magdalene (from catalog)');
    });

    it('falls back to the decree_id when neither a name nor a catalog entry exists', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, namelessGradeChange(), CAPS, ['en', 'it'], {});
        const header = container.querySelector('.card-header');
        expect(header.textContent).toContain('StMaryMagdalene_Upgrade');
        expect(header.textContent).not.toContain('from catalog');
    });

    it('prefers the decree own name over the catalog for name-bearing decrees', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, createNewDecree(), CAPS, ['en', 'it'], {
            MaryMotherChurch: 'Catalog Name Should Not Win',
        });
        const header = container.querySelector('.card-header');
        expect(header.textContent).toContain('Mary Mother of the Church');
        expect(header.textContent).not.toContain('Catalog Name Should Not Win');
    });
});

describe('renderDecreeCard: readings panel', () => {
    it('renders the page-locale readings in the active tab, including the optional second reading', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, createNewDecree(), CAPS, ['en', 'it']);
        const activePane = container.querySelector('#readings-MaryMotherChurch_Create-en');
        expect(activePane).not.toBeNull();
        expect(activePane.classList.contains('active')).toBe(true);
        expect(activePane.textContent).toContain('Genesis 3: 9-15, 20|Acts 1: 12-14');
        expect(activePane.textContent).toContain('Second reading (optional)');
        expect(activePane.textContent).toContain('Acts 1: 12-14');
        // empty gospel_acclamation is skipped
        expect(activePane.textContent).not.toContain('Gospel acclamation');
    });

    it('renders one tab per supported locale, non-active tabs lazy', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, createNewDecree(), CAPS, ['en', 'it']);
        const tabs = [...container.querySelectorAll('[data-bs-toggle="pill"]')];
        expect(tabs.map((t) => t.textContent)).toEqual(['en', 'it']);
        const itPane = container.querySelector('#readings-MaryMotherChurch_Create-it');
        expect(itPane).not.toBeNull();
        expect(itPane.classList.contains('active')).toBe(false);
        // not fetched until the panel is first expanded
        expect(itPane.textContent).toBe('…');
    });

    it('shows a muted note when the page-locale readings are all empty (untranslated locale)', () => {
        const decree = createNewDecree();
        decree.liturgical_event.readings = {
            first_reading: '',
            responsorial_psalm: '',
            gospel_acclamation: '',
            gospel: '',
        };
        const container = document.createElement('div');
        renderDecreeCard(container, decree, CAPS, ['en', 'it']);
        const activePane = container.querySelector('#readings-MaryMotherChurch_Create-en');
        expect(activePane.textContent).toBe('No readings defined for this locale yet');
    });

    it('still shows the readings toggle for a createNew decree whose page-locale readings are missing', () => {
        const decree = createNewDecree();
        delete decree.liturgical_event.readings;
        const container = document.createElement('div');
        renderDecreeCard(container, decree, CAPS, ['en', 'it']);
        expect(container.querySelector('[data-bs-target^="#readings-"]')).not.toBeNull();
        const activePane = container.querySelector('#readings-MaryMotherChurch_Create-en');
        expect(activePane.textContent).toBe('No readings defined for this locale yet');
    });

    it('omits the readings toggle for non-createNew decrees without readings', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, gradeChangeDecree(), CAPS, ['en', 'it']);
        expect(container.querySelector('[data-bs-target^="#readings-"]')).toBeNull();
    });
});

describe('renderDecreeCard: source link(s)', () => {
    const footerLinks = (container) => [...container.querySelector('.card-footer').querySelectorAll('a')];

    it('renders a single Source link when the URL has no %s placeholder', () => {
        const container = document.createElement('div');
        renderDecreeCard(container, createNewDecree(), CAPS, ['en', 'it']);
        const links = footerLinks(container);
        expect(links).toHaveLength(1);
        expect(links[0].textContent).toBe('Source');
        expect(links[0].getAttribute('href')).toBe('https://www.vatican.va/x');
    });

    it('lists one per-language link (urls_langs) when the URL has %s and a url_lang_map', () => {
        const decree = createNewDecree();
        decree.metadata.url = 'https://www.vatican.va/content/john-paul-ii/%s/doc.html';
        decree.metadata.url_lang_map = { en: 'en', it: 'it', de: 'ge' };
        const container = document.createElement('div');
        renderDecreeCard(container, decree, CAPS, ['en', 'it']);
        const links = footerLinks(container);
        expect(links).toHaveLength(3);
        // every link expands %s — none still contains the placeholder
        expect(links.every((a) => !a.getAttribute('href').includes('%s'))).toBe(true);
        const byText = Object.fromEntries(links.map((a) => [a.textContent, a.getAttribute('href')]));
        // labelled by language display name (Intl.DisplayNames, en-US locale)
        expect(byText.English).toBe('https://www.vatican.va/content/john-paul-ii/en/doc.html');
        expect(byText.Italian).toBe('https://www.vatican.va/content/john-paul-ii/it/doc.html');
        expect(byText.German).toBe('https://www.vatican.va/content/john-paul-ii/ge/doc.html');
    });

    it('never emits a link whose href still contains the %s placeholder', () => {
        const decree = createNewDecree();
        decree.metadata.url = 'https://www.vatican.va/content/john-paul-ii/%s/doc.html';
        decree.metadata.url_lang_map = { en: 'en' };
        const container = document.createElement('div');
        renderDecreeCard(container, decree, CAPS, ['en', 'it']);
        const badLink = footerLinks(container).find((a) => a.getAttribute('href').includes('%s'));
        expect(badLink).toBeUndefined();
    });
});
