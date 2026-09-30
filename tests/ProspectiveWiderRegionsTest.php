<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\ProspectiveWiderRegions;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(ProspectiveWiderRegions::class)]
final class ProspectiveWiderRegionsTest extends TestCase
{
    /** @var list<string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $file) {
            @unlink($file);
        }
        $this->tempFiles = [];
    }

    private function fixture(string $json): string
    {
        $file = tempnam(sys_get_temp_dir(), 'pwr');
        $this->assertIsString($file);
        file_put_contents($file, $json);
        $this->tempFiles[] = $file;
        return $file;
    }

    public function testShippedFileLoadsEveryEntryWithExpectedShape(): void
    {
        $regions = ProspectiveWiderRegions::all('en');
        $ids     = array_column($regions, 'id');
        sort($ids);
        $this->assertSame([
            'africa',
            'german-language-area',
            'malaysia-singapore-brunei',
            'nordic',
            'north-africa',
            'oceania',
            'senegal-mauritania-cabo-verde-guinea-bissau',
            'southern-africa',
        ], $ids);

        foreach ($regions as $region) {
            $this->assertSame(
                ['id', 'label', 'labels', 'm49', 'description', 'roster', 'locales'],
                array_keys($region)
            );
            $this->assertMatchesRegularExpression(ProspectiveWiderRegions::ID_PATTERN, $region['id']);
            $this->assertNotEmpty($region['roster']);
        }
    }

    public function testShippedRosterCodesAreAllKnownNations(): void
    {
        $worldDioceses = json_decode(
            (string) file_get_contents(__DIR__ . '/../assets/data/WorldDiocesesByNation.json'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
        $knownIsoCodes = array_map(
            static fn (array $nation): string => strtoupper((string) $nation['country_iso']),
            $worldDioceses['catholic_dioceses_latin_rite']
        );

        foreach (ProspectiveWiderRegions::all('en') as $region) {
            foreach ($region['roster'] as $code) {
                $this->assertContains(
                    $code,
                    $knownIsoCodes,
                    "roster code {$code} of {$region['id']} is not a known nation"
                );
            }
        }
    }

    public function testShippedFileResolvesLabelsForEnglish(): void
    {
        $regions = array_column(ProspectiveWiderRegions::all('en'), 'label', 'id');
        $this->assertSame('German Language Area', $regions['german-language-area']);
        $this->assertSame('Africa', $regions['africa']);
    }

    public function testShippedFileResolvesLabelsForItalian(): void
    {
        $regions = array_column(ProspectiveWiderRegions::all('it'), 'label', 'id');
        $this->assertSame('Africa', $regions['africa']);
        $this->assertSame('Nordic Countries', $regions['nordic']);
        $this->assertSame('German Language Area', $regions['german-language-area']);
    }

    public function testShippedFileResolvesLabelsForGerman(): void
    {
        $regions = array_column(ProspectiveWiderRegions::all('de'), 'label', 'id');
        $this->assertSame('Deutsches Sprachgebiet', $regions['german-language-area']);
    }

    public function testShippedFileIsSortedByLabel(): void
    {
        $labels = array_column(ProspectiveWiderRegions::all('en'), 'label');
        $sorted = $labels;
        $collator = new \Collator('en');
        usort($sorted, static fn (string $a, string $b): int => (int) $collator->compare($a, $b));
        $this->assertSame($sorted, $labels);
    }

    public function testDropsInvalidEntriesAndSortsByLabel(): void
    {
        $file = $this->fixture(json_encode(['wider_regions' => [
            ['id' => 'zeta', 'roster' => ['AA', 'BB']],
            ['id' => 'Europe', 'roster' => ['AA']],
            ['id' => 'german language', 'roster' => ['AA']],
            ['id' => 'empty-roster', 'roster' => []],
            ['id' => 'bad-code', 'roster' => ['AA', 'usa']],
            ['id' => 'alpha', 'roster' => ['CC'], 'description' => 'First', 'locales' => ['en_CC', 42]],
            ['id' => 'alpha', 'roster' => ['DD']],
            ['id' => 'bad-label-key-upper', 'roster' => ['AA'], 'labels' => ['DE' => 'x']],
            ['id' => 'bad-label-key-locale', 'roster' => ['AA'], 'labels' => ['de_de' => 'x']],
            ['id' => 'empty-label-value', 'roster' => ['AA'], 'labels' => ['en' => '']],
            ['id' => 'bad-m49', 'roster' => ['AA'], 'm49' => '2'],
            'not an object',
        ]], JSON_THROW_ON_ERROR));

        $regions = ProspectiveWiderRegions::all('en', $file);
        $this->assertSame(['alpha', 'zeta'], array_column($regions, 'id'));
        $this->assertSame('First', $regions[0]['description']);
        $this->assertSame(['CC'], $regions[0]['roster']);
        $this->assertSame(['en_CC'], $regions[0]['locales']);
        $this->assertSame('', $regions[1]['description']);
        $this->assertSame(['AA', 'BB'], $regions[1]['roster']);
        $this->assertSame([], $regions[1]['locales']);
    }

    public function testNoLabelsAndNoM49ResolvesToIdWords(): void
    {
        $file    = $this->fixture(json_encode(['wider_regions' => [
            ['id' => 'north-africa', 'roster' => ['AA'], 'labels' => []],
        ]], JSON_THROW_ON_ERROR));
        $regions = ProspectiveWiderRegions::all('en', $file);
        $this->assertSame('North Africa', $regions[0]['label']);
    }

    public function testM49TierResolvesLabelWhenNoStoredLabelMatches(): void
    {
        $file    = $this->fixture(json_encode(['wider_regions' => [
            ['id' => 'my-region', 'roster' => ['AA'], 'labels' => [], 'm49' => '015'],
        ]], JSON_THROW_ON_ERROR));
        $regions = ProspectiveWiderRegions::all('en', $file);
        $this->assertSame('Northern Africa', $regions[0]['label']);
    }

    public function testResolvesScriptAwareChineseLabels(): void
    {
        $file = $this->fixture(json_encode(['wider_regions' => [
            [
                'id'     => 'my-region',
                'roster' => ['AA'],
                'labels' => ['zh_Hans' => '简体', 'en' => 'My Region'],
            ],
        ]], JSON_THROW_ON_ERROR));

        // zh_Hant_TW / zh_TW: an explicit or inferred Traditional script, with only a Simplified label
        // stored, must not fall back to the bare `zh` key (there is none), nor to the Simplified text —
        // it should skip straight to `en`.
        $this->assertSame('My Region', ProspectiveWiderRegions::all('zh_Hant_TW', $file)[0]['label']);
        $this->assertSame('My Region', ProspectiveWiderRegions::all('zh_TW', $file)[0]['label']);

        // zh_CN infers the Simplified script, which does match the stored `zh_Hans` label.
        $this->assertSame('简体', ProspectiveWiderRegions::all('zh_CN', $file)[0]['label']);
    }

    public function testM49CodesIncludesExistingRegionsAndProspectiveContinents(): void
    {
        $codes = ProspectiveWiderRegions::m49Codes();
        $this->assertSame('019', $codes['americas']);
        $this->assertSame('142', $codes['asia']);
        $this->assertSame('150', $codes['europe']);
        $this->assertSame('002', $codes['africa']);
        $this->assertSame('009', $codes['oceania']);
        $this->assertSame('015', $codes['north-africa']);
        $this->assertSame('018', $codes['southern-africa']);
    }

    public function testM49CodesDropsBadIdOrCode(): void
    {
        $file = $this->fixture(json_encode([
            'm49_codes'     => ['americas' => '019', 'Bad-Id' => '020', 'europe' => '2'],
            'wider_regions' => [],
        ], JSON_THROW_ON_ERROR));

        $this->assertSame(['americas' => '019'], ProspectiveWiderRegions::m49Codes($file));
    }

    public function testUnreadableFileThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::all('en', sys_get_temp_dir() . '/does-not-exist-' . uniqid() . '.json');
    }

    public function testMissingWiderRegionsArrayThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::all('en', $this->fixture('{"regions": []}'));
    }

    public function testM49CodesUnreadableFileThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::m49Codes(sys_get_temp_dir() . '/does-not-exist-' . uniqid() . '.json');
    }

    public function testM49CodesMissingWiderRegionsArrayThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::m49Codes($this->fixture('{"regions": []}'));
    }
}
