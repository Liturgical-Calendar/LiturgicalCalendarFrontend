<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\FormControls;
use LiturgicalCalendar\Frontend\I18n;
use LiturgicalCalendar\Frontend\LitColor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * The colour counterpart of CommonOrderSchemaTest.
 *
 * Colour multi-selects lose data exactly the way the Common multi-select did
 * (issue #526): a colour with no `<option>` cannot render as selected, so a
 * browser cannot resubmit it and the value is dropped on the next save. `rose`
 * was missing from two of the three colour option sources for exactly that
 * reason.
 *
 * The palette is pinned to the schema's `RomanLitColor`, not the union
 * `LitColor`. Colours are rite-scoped: `morello` and `black` are Ambrosian and
 * "must not appear in Roman source data", while the write schemas `$ref` the
 * union only because JSON Schema cannot key a colour facet off the rite of the
 * containing document. Offering them unconditionally in this editor would
 * therefore be wrong; editing Ambrosian calendars needs a rite-aware palette,
 * which is a separate piece of work.
 */
#[CoversClass(FormControls::class)]
#[CoversClass(LitColor::class)]
final class ColorOrderSchemaTest extends TestCase
{
    use ApiSchemaTrait;

    /**
     * A verbatim copy of `definitions.RomanLitColor.items.enum` from the API's
     * `jsondata/schemas/CommonDef.json`. Reconciled with the live file by
     * testGoldenListMatchesLiveSchema() whenever the API repo is on disk.
     *
     * @var array<int, string>
     */
    private const SCHEMA_ROMAN_LIT_COLOR = [
        'white',
        'red',
        'green',
        'purple',
        'rose'
    ];

    public function testColorOrderHoldsExactlyTheRomanPalette(): void
    {
        $schema = self::SCHEMA_ROMAN_LIT_COLOR;
        $ui     = FormControls::COLOR_ORDER;
        sort($schema);
        sort($ui);

        $this->assertSame(
            $schema,
            $ui,
            'FormControls::COLOR_ORDER has drifted from the schema\'s RomanLitColor. '
                . 'A licit colour it omits gets no <option>, so it is silently dropped from any '
                . 'event that already carried it (the issue #526 failure mode).'
        );
    }

    public function testLitColorValuesHoldExactlyTheRomanPalette(): void
    {
        $schema = self::SCHEMA_ROMAN_LIT_COLOR;
        $values = LitColor::$values;
        sort($schema);
        sort($values);

        // LitColor::i18n() throws on anything outside $values, so COLOR_ORDER
        // cannot be widened without widening this list first.
        $this->assertSame($schema, $values);
    }

    /**
     * Every colour select this class renders must offer the whole palette. The
     * event row used to pass an explicit four-colour override that dropped `rose`.
     */
    public function testEveryRenderedColorSelectOffersTheWholePalette(): void
    {
        $formControls = new FormControls(new I18n());

        FormControls::setOptions(['colorField' => true]);
        ob_start();
        $formControls->createEventRow();
        $eventRow = (string) ob_get_clean();

        foreach (self::SCHEMA_ROMAN_LIT_COLOR as $color) {
            $this->assertStringContainsString(
                '<option value="' . $color . '"',
                $eventRow,
                "The event row does not offer '{$color}', so saving the form would drop it."
            );
            $this->assertStringContainsString(
                '<option value="' . $color . '"',
                $formControls->getColorOptionsHtml(),
                "getColorOptionsHtml() does not offer '{$color}'."
            );
        }
    }

    public function testStoredColorsRenderAsSelectedOptions(): void
    {
        $formControls = new FormControls(new I18n());
        $html         = $formControls->getColorOptionsHtml([LitColor::ROSE]);

        $this->assertStringContainsString('<option value="rose" selected>', $html);
    }

    public function testGoldenListMatchesLiveSchema(): void
    {
        $schemaPath = self::locateCommonDef();

        if (null === $schemaPath) {
            $this->markTestSkipped(self::schemaUnavailableMessage());
        }

        $this->assertSame(
            self::SCHEMA_ROMAN_LIT_COLOR,
            self::schemaEnum($schemaPath, 'RomanLitColor'),
            "The copy of the RomanLitColor enum in this test no longer matches {$schemaPath}. "
                . 'Update SCHEMA_ROMAN_LIT_COLOR, FormControls::COLOR_ORDER, LitColor and the '
                . 'LITURGICAL_COLORS list in assets/js/FormControls.js together.'
        );
    }
}
