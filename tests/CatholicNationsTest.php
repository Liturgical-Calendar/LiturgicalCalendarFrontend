<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\CatholicNations;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(CatholicNations::class)]
final class CatholicNationsTest extends TestCase
{
    public function testIncludesNationsWithoutAnExistingCalendar(): void
    {
        // France has no national calendar yet (API issue #990): it must still
        // be requestable, or its calendar can never be created.
        $nations = CatholicNations::localized('en');
        $this->assertArrayHasKey('FR', $nations);
        $this->assertSame('France', $nations['FR']);
    }

    public function testKeysAreUppercaseAlpha2Codes(): void
    {
        $nations = CatholicNations::localized('en');
        $this->assertNotEmpty($nations);
        foreach (array_keys($nations) as $code) {
            $this->assertMatchesRegularExpression('/^[A-Z]{2}$/', $code);
        }
    }

    public function testNamesAreLocalizedAndSorted(): void
    {
        $nations = CatholicNations::localized('it');
        $this->assertSame('Francia', $nations['FR']);

        $names  = array_values($nations);
        $sorted = $names;
        ( new \Collator('it') )->sort($sorted);
        $this->assertSame($sorted, $names);
    }

    public function testThrowsOnUnreadableSource(): void
    {
        $this->expectException(\RuntimeException::class);
        CatholicNations::localized('en', __DIR__ . '/does-not-exist.json');
    }
}
