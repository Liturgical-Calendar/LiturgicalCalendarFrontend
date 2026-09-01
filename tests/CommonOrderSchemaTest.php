<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\FormControls;
use LiturgicalCalendar\Frontend\I18n;
use LiturgicalCalendar\Frontend\LitCommon;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Guards FormControls::COMMON_ORDER against drifting away from the API's
 * `LitCommon` enum.
 *
 * Why this matters (issue #526): the editor's "Common (or Proper)" control is a
 * multi-select whose options ARE COMMON_ORDER. A browser submits only options the
 * control actually has, so a schema-valid value missing from COMMON_ORDER cannot
 * render as selected and is silently dropped from any event that already carried
 * it, the first time anyone saves that event.
 */
#[CoversClass(FormControls::class)]
#[CoversClass(LitCommon::class)]
final class CommonOrderSchemaTest extends TestCase
{
    use ApiSchemaTrait;


    /**
     * A verbatim copy of `definitions.LitCommon.items.enum` from the API's
     * `jsondata/schemas/CommonDef.json`, in the schema's own order.
     *
     * It is duplicated here rather than read from the API repo because the PHP
     * unit-test job in `.github/workflows/tests.yml` checks out this repository
     * only — the API repo is not on disk there. testGoldenListMatchesLiveSchema()
     * below reconciles this copy with the real file whenever the API repo *is*
     * available (any developer checkout, and the E2E workflow's `api-repo`), so
     * the copy cannot quietly go stale either.
     *
     * @var array<int, string>
     */
    private const SCHEMA_LIT_COMMON = [
        'Proper',
        'Dedication of a Church',
        'Blessed Virgin Mary',
        'Martyrs',
        'Pastors',
        'Doctors',
        'Virgins',
        'Holy Men and Women',
        'Martyrs:For One Martyr',
        'Martyrs:For Several Martyrs',
        'Martyrs:For Missionary Martyrs',
        'Martyrs:For One Missionary Martyr',
        'Martyrs:For Several Missionary Martyrs',
        'Martyrs:For a Virgin Martyr',
        'Martyrs:For a Holy Woman Martyr',
        'Pastors:For a Pope',
        'Pastors:For a Bishop',
        'Pastors:For One Pastor',
        'Pastors:For Several Pastors',
        'Pastors:For Founders of a Church',
        'Pastors:For One Founder',
        'Pastors:For Several Founders',
        'Pastors:For Missionaries',
        'Virgins:For One Virgin',
        'Virgins:For Several Virgins',
        'Holy Men and Women:For Several Saints',
        'Holy Men and Women:For One Saint',
        'Holy Men and Women:For an Abbot',
        'Holy Men and Women:For a Monk',
        'Holy Men and Women:For a Nun',
        'Holy Men and Women:For Religious',
        'Holy Men and Women:For Those Who Practiced Works of Mercy',
        'Holy Men and Women:For Educators',
        'Holy Men and Women:For Holy Women',
        'For Giving Thanks to God for the Gift of Human Life [USA]',
        'For the Preservation of Peace and Justice'
    ];

    /**
     * COMMON_ORDER must offer every schema value, and offer nothing else.
     *
     * Order is compared as a sorted set rather than positionally: COMMON_ORDER
     * deliberately regroups the schema's flat "all generals, then all specifics"
     * sequence so each specific common sits under its general one. What must not
     * differ is the *membership*, which is what silently loses data.
     */
    public function testCommonOrderHoldsExactlyTheSchemaValues(): void
    {
        $schema = self::SCHEMA_LIT_COMMON;
        $ui     = FormControls::COMMON_ORDER;
        sort($schema);
        sort($ui);

        $this->assertSame(
            $schema,
            $ui,
            'FormControls::COMMON_ORDER has drifted from the API\'s LitCommon enum. '
                . 'A value the schema allows but COMMON_ORDER omits gets no <option>, so it is '
                . 'silently dropped from any event that already carried it (issue #526).'
        );
    }

    public function testCommonOrderHasNoDuplicates(): void
    {
        $this->assertSame(
            FormControls::COMMON_ORDER,
            array_values(array_unique(FormControls::COMMON_ORDER)),
            'FormControls::COMMON_ORDER would render the same <option> value twice.'
        );
    }

    /**
     * The two Masses for Various Needs and Occasions the schema admits are the
     * values issue #526 was actually about: the US national calendar's
     * `PrayerUnborn` event carries both, and they used to be dropped on save.
     */
    public function testTheTwoVariousNeedsValuesAreOffered(): void
    {
        foreach (LitCommon::VARIOUS_NEEDS as $value) {
            $this->assertContains($value, self::SCHEMA_LIT_COMMON, "'{$value}' is not a schema value.");
            $this->assertContains($value, FormControls::COMMON_ORDER, "'{$value}' is not offered by the editor.");
        }
    }

    /**
     * Every segment of every COMMON_ORDER entry must be known to LitCommon, or the
     * option renders with an untranslated (English) label in every locale.
     */
    public function testEveryCommonOrderSegmentIsTranslatable(): void
    {
        foreach (FormControls::COMMON_ORDER as $common) {
            foreach (explode(':', $common) as $segment) {
                $this->assertTrue(
                    LitCommon::isValid($segment),
                    "'{$segment}' (from '{$common}') is missing from LitCommon::\$values, so it cannot be translated."
                );
            }
        }
    }

    /**
     * The end-to-end regression: a value already stored on an event must come back
     * as a `selected` option, otherwise the browser cannot resubmit it.
     */
    public function testStoredCommonsRenderAsSelectedOptions(): void
    {
        $formControls = new FormControls(new I18n());
        $html         = $formControls->getCommonsOptionsHtml(LitCommon::VARIOUS_NEEDS);

        foreach (LitCommon::VARIOUS_NEEDS as $value) {
            $escaped = htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $this->assertStringContainsString(
                '<option value="' . $escaped . '" selected>',
                $html,
                "'{$value}' does not render as a selected <option>, so saving the form would drop it."
            );
        }
    }

    /**
     * Masses for Various Needs and Occasions are not commons, so their labels must
     * not be prefixed with the "From the Common of…" glue.
     */
    public function testVariousNeedsLabelsCarryNoFromTheCommonGlue(): void
    {
        $litCommon = new LitCommon('en');

        foreach (LitCommon::VARIOUS_NEEDS as $value) {
            $this->assertSame($value, $litCommon->fullTranslate($value));
        }
    }

    /**
     * Reconciles the copy above with the real schema, when the API repo is on disk.
     * Skips (rather than fails) when it is not: the PHP unit-test CI job does not
     * check the API out.
     */
    public function testGoldenListMatchesLiveSchema(): void
    {
        $schemaPath = self::locateCommonDef();

        if (null === $schemaPath) {
            $this->markTestSkipped(self::schemaUnavailableMessage());
        }

        $this->assertSame(
            self::SCHEMA_LIT_COMMON,
            self::schemaEnum($schemaPath, 'LitCommon'),
            "The copy of the LitCommon enum in this test no longer matches {$schemaPath}. "
                . 'Update SCHEMA_LIT_COMMON *and* FormControls::COMMON_ORDER together.'
        );
    }
}
