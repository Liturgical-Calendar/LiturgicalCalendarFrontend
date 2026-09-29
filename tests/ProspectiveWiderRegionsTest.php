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

    public function testShippedFileLoadsEveryEntry(): void
    {
        $regions = ProspectiveWiderRegions::all();
        $names   = array_column($regions, 'name');
        $this->assertSame([
            'German Language Area',
            'Malaysia Singapore Brunei',
            'Nordic',
            'North Africa',
            'Senegal Mauritania Cabo Verde Guinea Bissau',
            'Southern Africa',
        ], $names);
        foreach ($regions as $region) {
            $this->assertMatchesRegularExpression(ProspectiveWiderRegions::NAME_PATTERN, $region['name']);
            $this->assertNotEmpty($region['roster']);
            $this->assertNotSame('', $region['description']);
        }
    }

    public function testOnlyBrowserFieldsAreReturned(): void
    {
        $regions = ProspectiveWiderRegions::all();
        $this->assertSame(['name', 'description', 'roster', 'locales'], array_keys($regions[0]));
    }

    public function testDropsInvalidEntriesAndSortsByName(): void
    {
        $file = $this->fixture(json_encode(['wider_regions' => [
            ['name' => 'Zeta', 'roster' => ['AA', 'BB']],
            ['name' => 'lowercase', 'roster' => ['AA']],
            ['name' => 'Hyphen-Name', 'roster' => ['AA']],
            ['name' => 'Empty Roster', 'roster' => []],
            ['name' => 'Bad Code', 'roster' => ['AA', 'usa']],
            ['name' => 'Alpha', 'roster' => ['CC'], 'description' => 'First', 'locales' => ['en_CC', 42]],
            ['name' => 'Alpha', 'roster' => ['DD']],
            'not an object',
        ]], JSON_THROW_ON_ERROR));

        $this->assertSame([
            ['name' => 'Alpha', 'description' => 'First', 'roster' => ['CC'], 'locales' => ['en_CC']],
            ['name' => 'Zeta', 'description' => '', 'roster' => ['AA', 'BB'], 'locales' => []],
        ], ProspectiveWiderRegions::all($file));
    }

    public function testUnreadableFileThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::all(sys_get_temp_dir() . '/does-not-exist-' . uniqid() . '.json');
    }

    public function testMissingWiderRegionsArrayThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        ProspectiveWiderRegions::all($this->fixture('{"regions": []}'));
    }
}
