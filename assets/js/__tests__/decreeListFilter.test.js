/**
 * Sorting and filtering tests for the decrees list.
 *
 * window.AdminDecreesConfig must be in place BEFORE the module is imported,
 * because admin-decrees.js evaluates `const config = window.AdminDecreesConfig`
 * at module-load time — same vi.hoisted() pattern as adminDecreesForm.test.js.
 *
 * The fixtures below mirror the real GET /decrees payload, including its three
 * awkward cases: a decree whose liturgical_event carries no name of its own
 * (StMaryMagdalene, a grade change), a decree with no protocol at all
 * (StThereseChildJesus), and three decrees sharing one decree_date.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
    globalThis.window = globalThis;
    globalThis.window.AdminDecreesConfig = {
        apiUrl:  'http://localhost:8000',
        locale:  'en-US',
        userSub: 'test-sub',
        isGlobalAdmin: true,
        i18n: {},
    };
});

import {
    sortDecrees,
    filterDecrees,
    decreeYears,
    decreeSearchText,
    populateYearFilter,
} from '../admin-decrees.js';

/**
 * @param {object} o
 * @returns {object} a decree shaped like a GET /decrees entry
 */
const decree = ({ id, date, protocol = '', description = '', key, name = null, action, property }) => ({
    decree_id:       id,
    decree_date:     date,
    decree_protocol: protocol,
    description,
    liturgical_event: { event_key: key, calendar: 'GENERAL ROMAN', ...(name ? { name } : {}) },
    metadata: { action, ...(property ? { property } : {}) },
});

const MAGDALENE = decree({
    id: 'StMaryMagdalene_Upgrade', date: '2016-06-03', protocol: 'Prot. N. 257/16',
    description: 'the celebration of Saint Mary Magdalene was elevated to the rank of Feast',
    key: 'StMaryMagdalene', name: null, action: 'setProperty', property: 'grade',
});
const THERESE = decree({
    id: 'StThereseChildJesus_Doctor', date: '1997-10-19', protocol: '',
    description: 'proclaimed a Doctor of the universal Church',
    key: 'StThereseChildJesus', name: 'Saint Thérèse of the Child Jesus', action: 'makeDoctor',
});
const NAREK = decree({
    id: 'StGregoryNarek_Create', date: '2021-01-25', protocol: 'Prot. N. 40/21',
    key: 'StGregoryNarek', name: 'Saint Gregory of Narek, Abbot', action: 'createNew',
});
const AVILA = decree({
    id: 'StJohnAvila_Create', date: '2021-01-25', protocol: 'Prot. N. 40/21',
    key: 'StJohnAvila', name: 'Saint John of Avila, Priest', action: 'createNew',
});
const HILDEGARD = decree({
    id: 'StHildegardBingen_Create', date: '2021-01-25', protocol: 'Prot. N. 40/21',
    key: 'StHildegardBingen', name: 'Saint Hildegard of Bingen, Virgin', action: 'createNew',
});
const MARTHA = decree({
    id: 'StMartha_NameChange', date: '2021-01-26', protocol: 'Prot. N. 35/21',
    key: 'StMartha', name: 'Saints Martha, Mary and Lazarus', action: 'setProperty', property: 'name',
});
const TERESA = decree({
    id: 'StMotherTeresa_Create', date: '2024-12-24', protocol: 'B0125-XX.01 00250-LA.01',
    key: 'StMotherTeresa', name: 'Saint Teresa of Calcutta, Virgin', action: 'createNew',
});

const ALL = [MAGDALENE, MARTHA, NAREK, TERESA, AVILA, THERESE, HILDEGARD];

/** event_key → localized name, as loadEventCatalog builds it. */
const NAMES = { StMaryMagdalene: 'Saint Mary Magdalene' };

const ids = (list) => list.map((d) => d.decree_id);

// ---- sorting ---------------------------------------------------------------

describe('sortDecrees', () => {
    it('puts the most recent decree first and the oldest last', () => {
        const sorted = sortDecrees(ALL);
        expect(sorted[0].decree_id).toBe('StMotherTeresa_Create');           // 2024-12-24
        expect(sorted[sorted.length - 1].decree_id).toBe('StThereseChildJesus_Doctor'); // 1997-10-19
    });

    it('breaks a shared decree_date deterministically by decree_id', () => {
        // Narek, Avila and Hildegard all carry 2021-01-25; without a tiebreak
        // their relative order would be whatever sort() happened to do.
        const sorted = ids(sortDecrees(ALL));
        const tied = sorted.filter((id) => id.endsWith('_Create') && id !== 'StMotherTeresa_Create');
        expect(tied).toEqual(['StGregoryNarek_Create', 'StHildegardBingen_Create', 'StJohnAvila_Create']);
    });

    it('is stable regardless of input order', () => {
        const forward  = ids(sortDecrees(ALL));
        const reversed = ids(sortDecrees([...ALL].reverse()));
        expect(reversed).toEqual(forward);
    });

    it('does not mutate the array it is given', () => {
        const input = [...ALL];
        sortDecrees(input);
        expect(ids(input)).toEqual(ids(ALL));
    });

    it('sorts a decree with a missing or unparseable date last rather than throwing', () => {
        const undated = decree({ id: 'NoDate_Create', date: null, key: 'NoDate', action: 'createNew' });
        const junk    = decree({ id: 'Junk_Create', date: 'not-a-date', key: 'Junk', action: 'createNew' });
        const sorted  = ids(sortDecrees([undated, THERESE, junk, TERESA]));
        expect(sorted.slice(0, 2)).toEqual(['StMotherTeresa_Create', 'StThereseChildJesus_Doctor']);
        expect(sorted.slice(2).sort()).toEqual(['Junk_Create', 'NoDate_Create']);
    });
});

// ---- the searchable text of a decree ---------------------------------------

describe('decreeSearchText', () => {
    // The haystack comes back folded (lowercased, diacritics stripped), so the
    // expectations below are folded too.
    it('uses the resolved catalog name when the event carries none of its own', () => {
        // StMaryMagdalene is a grade change: liturgical_event has no `name`, so
        // without the catalog fallback the decree would be unfindable by the
        // very name its card displays.
        expect(decreeSearchText(MAGDALENE, NAMES)).toContain('saint mary magdalene');
    });

    it('falls back to the decree_id when neither the event nor the catalog has a name', () => {
        expect(decreeSearchText(MAGDALENE, {})).toContain('stmarymagdalene_upgrade');
    });

    it('covers event key, protocol and description', () => {
        const text = decreeSearchText(MAGDALENE, NAMES);
        expect(text).toContain('stmarymagdalene');
        expect(text).toContain('257/16');
        expect(text).toContain('elevated');
    });

    it('tolerates a decree with no protocol', () => {
        expect(() => decreeSearchText(THERESE, NAMES)).not.toThrow();
    });
});

// ---- filtering -------------------------------------------------------------

describe('filterDecrees — search', () => {
    it('returns everything for an empty or whitespace-only query', () => {
        expect(filterDecrees(ALL, { query: '' }, NAMES)).toHaveLength(ALL.length);
        expect(filterDecrees(ALL, { query: '   ' }, NAMES)).toHaveLength(ALL.length);
    });

    it('matches on the event name', () => {
        expect(ids(filterDecrees(ALL, { query: 'Hildegard' }, NAMES))).toEqual(['StHildegardBingen_Create']);
    });

    it('matches a grade-change decree by its catalog name', () => {
        expect(ids(filterDecrees(ALL, { query: 'Mary Magdalene' }, NAMES))).toEqual(['StMaryMagdalene_Upgrade']);
    });

    it('matches on the event key', () => {
        expect(ids(filterDecrees(ALL, { query: 'StJohnAvila' }, NAMES))).toEqual(['StJohnAvila_Create']);
    });

    it('matches on the protocol number', () => {
        expect(ids(filterDecrees(ALL, { query: '35/21' }, NAMES))).toEqual(['StMartha_NameChange']);
    });

    it('matches on the newer bulletin-style protocol', () => {
        expect(ids(filterDecrees(ALL, { query: 'B0125' }, NAMES))).toEqual(['StMotherTeresa_Create']);
    });

    it('matches on the description', () => {
        expect(ids(filterDecrees(ALL, { query: 'Doctor of the universal' }, NAMES)))
            .toEqual(['StThereseChildJesus_Doctor']);
    });

    it('ignores case', () => {
        expect(ids(filterDecrees(ALL, { query: 'hILDEGARD' }, NAMES))).toEqual(['StHildegardBingen_Create']);
    });

    it('ignores diacritics in both the query and the text', () => {
        // "Therese" must find "Saint Thérèse", and vice versa.
        expect(ids(filterDecrees(ALL, { query: 'Therese' }, NAMES))).toEqual(['StThereseChildJesus_Doctor']);
        expect(ids(filterDecrees(ALL, { query: 'Thérèse' }, NAMES))).toEqual(['StThereseChildJesus_Doctor']);
    });

    it('returns an empty array when nothing matches', () => {
        expect(filterDecrees(ALL, { query: 'Newman' }, NAMES)).toEqual([]);
    });
});

describe('filterDecrees — year', () => {
    it('filters on the year of decree_date', () => {
        expect(ids(filterDecrees(ALL, { year: '2021' }, NAMES)).sort()).toEqual([
            'StGregoryNarek_Create', 'StHildegardBingen_Create', 'StJohnAvila_Create', 'StMartha_NameChange',
        ]);
    });

    it('treats an empty year as "any"', () => {
        expect(filterDecrees(ALL, { year: '' }, NAMES)).toHaveLength(ALL.length);
    });

    it('files a December decree under its decree year, not its effective year', () => {
        // Mother Teresa: signed 2024-12-24, in force from 2025.
        expect(ids(filterDecrees(ALL, { year: '2024' }, NAMES))).toEqual(['StMotherTeresa_Create']);
        expect(filterDecrees(ALL, { year: '2025' }, NAMES)).toEqual([]);
    });
});

describe('filterDecrees — action', () => {
    it('filters on a simple action', () => {
        expect(ids(filterDecrees(ALL, { action: 'makeDoctor' }, NAMES))).toEqual(['StThereseChildJesus_Doctor']);
    });

    it('distinguishes the two compound setProperty actions', () => {
        expect(ids(filterDecrees(ALL, { action: 'setProperty:grade' }, NAMES))).toEqual(['StMaryMagdalene_Upgrade']);
        expect(ids(filterDecrees(ALL, { action: 'setProperty:name' }, NAMES))).toEqual(['StMartha_NameChange']);
    });

    it('treats an empty action as "any"', () => {
        expect(filterDecrees(ALL, { action: '' }, NAMES)).toHaveLength(ALL.length);
    });
});

describe('filterDecrees — combination', () => {
    it('combines search, year and action with AND', () => {
        expect(ids(filterDecrees(ALL, { query: 'Saint', year: '2021', action: 'createNew' }, NAMES)).sort())
            .toEqual(['StGregoryNarek_Create', 'StHildegardBingen_Create', 'StJohnAvila_Create']);
    });

    it('returns nothing when the criteria cannot be satisfied together', () => {
        // Martha is a 2021 decree, but a setProperty:name one.
        expect(filterDecrees(ALL, { query: 'Martha', action: 'createNew' }, NAMES)).toEqual([]);
    });

    it('preserves the order of the list it is given', () => {
        const sorted = sortDecrees(ALL);
        expect(ids(filterDecrees(sorted, { action: 'createNew' }, NAMES)))
            .toEqual(ids(sorted).filter((id) => id.endsWith('_Create')));
    });
});

// ---- year options ----------------------------------------------------------

describe('decreeYears', () => {
    it('lists the distinct decree years, most recent first', () => {
        expect(decreeYears(ALL)).toEqual(['2024', '2021', '2016', '1997']);
    });

    it('skips decrees with no usable date', () => {
        const undated = decree({ id: 'NoDate_Create', date: null, key: 'NoDate', action: 'createNew' });
        expect(decreeYears([...ALL, undated])).toEqual(['2024', '2021', '2016', '1997']);
    });

    it('returns an empty list for an empty input', () => {
        expect(decreeYears([])).toEqual([]);
    });
});

// ---- the year <select>, across a reload ------------------------------------

describe('populateYearFilter', () => {
    /**
     * The server-rendered select: an "Any year" option and nothing else, which
     * populateYearFilter must always keep as the first option.
     */
    function mountYearSelect() {
        document.body.innerHTML = '<select id="decreeYearFilter"><option value="">Any year</option></select>';
        return document.getElementById('decreeYearFilter');
    }

    const values = (sel) => [...sel.options].map((o) => o.value);

    it('appends the decree years after the "Any year" option, most recent first', () => {
        const select = mountYearSelect();
        populateYearFilter(ALL);
        expect(values(select)).toEqual(['', '2024', '2021', '2016', '1997']);
    });

    it('does not accumulate options when called again (a write reloads the list)', () => {
        const select = mountYearSelect();
        populateYearFilter(ALL);
        populateYearFilter(ALL);
        expect(values(select)).toEqual(['', '2024', '2021', '2016', '1997']);
    });

    it('keeps the selected year across a reload', () => {
        const select = mountYearSelect();
        populateYearFilter(ALL);
        select.value = '2021';
        populateYearFilter(ALL);
        expect(select.value).toBe('2021');
    });

    it('falls back to "Any year" when the selected year no longer exists', () => {
        // Deleting the only 2016 decree must not leave the filter pinned to a
        // year that now matches nothing.
        const select = mountYearSelect();
        populateYearFilter(ALL);
        select.value = '2016';
        populateYearFilter(ALL.filter((d) => d !== MAGDALENE));
        expect(select.value).toBe('');
        expect(values(select)).toEqual(['', '2024', '2021', '1997']);
    });
});
