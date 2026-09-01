/**
 * The readings shape vocabulary, resolved from the API's own schema.
 *
 * frontend #525: the create modal could not offer readings at all, because this
 * page had no vocabulary for what a `Readings` object may contain — a 404 from
 * `GET /lectionary/{rite}/sanctorale/{key}` is a NORMAL state ("nothing curated
 * yet"), and an empty response gives a form nothing to render.
 *
 * The fix reads the vocabulary rather than restating it: reading ORDER and labels
 * come from `ReadingsRenderer` (exported in liturgy-components-js 2.10.0), and the
 * SHAPES come from `CommonDef.json` over `GET /schemas/CommonDef.json`. These
 * tests pin the resolver against a fixture with the schema's real structure,
 * because the two mistakes worth guarding are both structural.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let resolveReadingsShapes, inferReadingsShape, readingFieldKeys;

beforeAll(async () => {
    global.window = global.window ?? {};
    ({ resolveReadingsShapes, inferReadingsShape, readingFieldKeys } = await import('../sanctorale.js'));
});

// The shape of CommonDef.json that matters here: a union of unions, one string
// branch, and nested branches whose slots $ref a union rather than a citation.
const SCHEMA = {
    definitions: {
        SourceReadings: {
            oneOf: [
                { $ref: '#/definitions/Readings' },
                { $ref: '#/definitions/ReadingsWithVigil' },
                { $ref: '#/definitions/ReadingsChristmasWithVigil' }
            ]
        },
        Readings: {
            oneOf: [
                { $ref: '#/definitions/ReadingsFerial' },
                { $ref: '#/definitions/ReadingsFestive' },
                { $ref: '#/definitions/ReadingsCommons' },
                { $ref: '#/definitions/ReadingsMultipleSchemas' }
            ]
        },
        ReadingsFerial: {
            type: 'object',
            title: 'Ferial Readings',
            properties: {
                first_reading: { type: 'string' },
                responsorial_psalm: { type: 'string' },
                gospel_acclamation: { type: 'string' },
                gospel: { type: 'string' }
            }
        },
        ReadingsFestive: {
            type: 'object',
            title: 'Festive Readings',
            properties: {
                first_reading: { type: 'string' },
                responsorial_psalm: { type: 'string' },
                second_reading: { type: 'string' },
                gospel_acclamation: { type: 'string' },
                gospel: { type: 'string' }
            }
        },
        ReadingsCommons: { type: 'string', title: 'Readings from liturgical Commons' },
        ReadingsMultipleSchemas: {
            type: 'object',
            title: 'Readings with Multiple Schemas',
            properties: {
                schema_one: { $ref: '#/definitions/ReadingsFestive' },
                schema_two: { $ref: '#/definitions/ReadingsFestive' },
                schema_three: { $ref: '#/definitions/ReadingsFestive' }
            }
        },
        ReadingsWithVigil: {
            type: 'object',
            title: 'Readings with a Vigil Mass',
            properties: {
                vigil: { $ref: '#/definitions/Readings' },
                day: { $ref: '#/definitions/Readings' }
            }
        },
        ReadingsChristmasWithVigil: {
            type: 'object',
            title: 'Christmas Readings with a Vigil Mass',
            properties: {
                vigil: { $ref: '#/definitions/Readings' },
                night: { $ref: '#/definitions/Readings' },
                dawn: { $ref: '#/definitions/Readings' },
                day: { $ref: '#/definitions/Readings' }
            }
        }
    }
};

describe('resolveReadingsShapes', () => {
    it('flattens the union of unions to leaf shapes only', () => {
        // `SourceReadings`' first branch is `Readings`, itself a union. A single
        // pass would offer "Readings" as a shape, which is not one — it has no
        // properties, so it would render a form with no fields.
        const ids = resolveReadingsShapes(SCHEMA).map((s) => s.id);
        expect(ids).not.toContain('Readings');
        expect(ids).toEqual([
            'ReadingsFerial',
            'ReadingsFestive',
            'ReadingsCommons',
            'ReadingsMultipleSchemas',
            'ReadingsWithVigil',
            'ReadingsChristmasWithVigil'
        ]);
    });

    it('offers the two vigil-bearing shapes, which only SOURCE data admits', () => {
        // The schema is explicit that `Readings` describes OUTPUT and must not be
        // widened to admit these: in output a vigil Mass is an event in its own
        // right with its own event_key. This editor writes source data, so
        // resolving from `Readings` rather than `SourceReadings` would leave a
        // curator unable to express a shape the corpus already stores.
        const ids = resolveReadingsShapes(SCHEMA).map((s) => s.id);
        expect(ids).toContain('ReadingsWithVigil');
        expect(ids).toContain('ReadingsChristmasWithVigil');
    });

    it('classifies a string branch as string, not as an empty object', () => {
        // ReadingsCommons is a plain string naming the Common the readings are
        // taken from. Treated as an object it has no properties, so it would
        // render zero inputs and a curator could never enter the value.
        const commons = resolveReadingsShapes(SCHEMA).find((s) => s.id === 'ReadingsCommons');
        expect(commons.kind).toBe('string');
        expect(commons.keys).toEqual([]);
    });

    it('reads a nested slot\'s declared shape as its default', () => {
        // The schema refs a CONCRETE shape from most nested slots rather than the
        // union — Christmas' three Masses are each a ReadingsFestive — so the slot
        // carries a default worth honouring. `null` marks the slots that ref the
        // union, where the choice is genuinely open.
        const shapes = resolveReadingsShapes(SCHEMA);
        const byId = Object.fromEntries(shapes.map((s) => [s.id, s]));
        expect(byId.ReadingsMultipleSchemas.slotShapes).toEqual({
            schema_one: 'ReadingsFestive', schema_two: 'ReadingsFestive', schema_three: 'ReadingsFestive'
        });
        expect(byId.ReadingsWithVigil.slotShapes).toEqual({ vigil: null, day: null });
        expect(byId.ReadingsFerial.slotShapes).toEqual({});
    });

    it('tells a nested shape from a flat one by what its slots RESOLVE to', () => {
        const shapes = resolveReadingsShapes(SCHEMA);
        const byId = Object.fromEntries(shapes.map((s) => [s.id, s]));
        expect(byId.ReadingsFerial.kind).toBe('flat');
        expect(byId.ReadingsFerial.keys).toEqual([
            'first_reading', 'responsorial_psalm', 'gospel_acclamation', 'gospel'
        ]);
        expect(byId.ReadingsWithVigil.kind).toBe('nested');
        expect(byId.ReadingsWithVigil.keys).toEqual(['vigil', 'day']);
        // Not "refs the union": a slot refing a concrete shape is still a slot.
        // Testing for the union read ReadingsChristmas, ReadingsWithEvening,
        // ReadingsMultipleSchemas and ReadingsSeasonal as FLAT, which would have
        // rendered `night`/`dawn`/`day` as three citation inputs.
        expect(byId.ReadingsMultipleSchemas.kind).toBe('nested');
        expect(byId.ReadingsMultipleSchemas.keys).toEqual(['schema_one', 'schema_two', 'schema_three']);
    });

    it('carries the schema title so a shape has a readable name', () => {
        const shapes = resolveReadingsShapes(SCHEMA);
        expect(shapes.find((s) => s.id === 'ReadingsFerial').title).toBe('Ferial Readings');
    });

    it('survives a schema it cannot read rather than throwing', () => {
        // The page falls back to rendering the data's own keys when the schema
        // fetch fails; an exception here would take the whole modal down instead.
        expect(resolveReadingsShapes(null)).toEqual([]);
        expect(resolveReadingsShapes({})).toEqual([]);
    });
});

describe('inferReadingsShape', () => {
    const shapes = () => resolveReadingsShapes(SCHEMA);

    it('recognises the four-key ferial entry the API stores as its placeholder', () => {
        // `MissalsHandler::emptyReadings()` writes exactly these four keys into
        // every readings locale file on the first save, so this is the entry the
        // editor meets most often.
        const entry = { first_reading: '', responsorial_psalm: '', gospel_acclamation: '', gospel: '' };
        expect(inferReadingsShape(entry, shapes())).toBe('ReadingsFerial');
    });

    it('does not read key order as a difference', () => {
        const entry = { gospel: 'Mt 1:1', gospel_acclamation: '', responsorial_psalm: '', first_reading: '' };
        expect(inferReadingsShape(entry, shapes())).toBe('ReadingsFerial');
    });

    it('recognises a string entry as the Commons shape', () => {
        expect(inferReadingsShape('Common of Martyrs', shapes())).toBe('ReadingsCommons');
    });

    it('recognises a nested entry by its slot names', () => {
        const entry = { vigil: { first_reading: 'Gn 1:1' }, day: { first_reading: 'Ex 1:1' } };
        expect(inferReadingsShape(entry, shapes())).toBe('ReadingsWithVigil');
    });

    it('refuses to call a festive entry with a gap a ferial one', () => {
        // A partial match would re-render the entry without `second_reading`,
        // dropping a curated citation out of the form and then out of the file.
        const entry = { first_reading: 'a', responsorial_psalm: 'b', gospel_acclamation: 'c', gospel: 'd', second_reading: '' };
        expect(inferReadingsShape(entry, shapes())).toBe('ReadingsFestive');
    });

    it('returns null for an entry matching nothing, so the caller keeps its keys', () => {
        expect(inferReadingsShape({ mystery_reading: 'x' }, shapes())).toBeNull();
        expect(inferReadingsShape(null, shapes())).toBeNull();
    });
});

describe('readingFieldKeys', () => {
    const ferial = { keys: ['first_reading', 'responsorial_psalm', 'gospel_acclamation', 'gospel'] };

    it('offers the shape\'s fields for an entry that has none — the whole of #525', () => {
        // A form built from the DATA renders nothing here, which is why readings
        // could not be added to a celebration that had none, and why the create
        // modal offered no readings panel at all.
        expect(readingFieldKeys(ferial, {})).toEqual(ferial.keys);
        expect(readingFieldKeys(ferial, undefined)).toEqual(ferial.keys);
    });

    it('keeps a curated value the chosen shape does not name', () => {
        // Otherwise narrowing the shape would drop the citation out of the form,
        // and the next save would drop it out of the file.
        expect(readingFieldKeys(ferial, { second_reading: 'Rom 1:1' }))
            .toEqual([...ferial.keys, 'second_reading']);
    });

    it('does not offer a text input for a nested slot left over from another shape', () => {
        // Switching Vigil -> Ferial re-renders with the previous values in hand;
        // `vigil` and `day` hold whole readings maps, not citations.
        expect(readingFieldKeys(ferial, { vigil: { gospel: 'Mt 1:1' }, day: { gospel: 'Lk 1:1' } }))
            .toEqual(ferial.keys);
    });

    it('falls back to the data\'s own keys, in canonical order, with no shape', () => {
        // The schema fetch failed; the panel still renders what is there rather
        // than nothing, and orders it so locales stay comparable line by line.
        expect(readingFieldKeys(null, { gospel: 'a', first_reading: 'b' }))
            .toEqual(['first_reading', 'gospel']);
    });
});
