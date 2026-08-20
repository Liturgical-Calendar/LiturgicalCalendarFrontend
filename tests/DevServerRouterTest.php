<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\DevServerRouter;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

#[CoversClass(DevServerRouter::class)]
final class DevServerRouterTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function forbiddenUris(): array
    {
        return [
            'literal dotfile'              => ['/.env.local'],
            'literal git metadata'         => ['/.git/config'],
            // The regression this class was extracted for: the built-in server
            // decodes %2e when resolving on disk, so a check on the raw path let
            // /%2egit/config through to the real file while /.git/config was refused.
            'encoded dot, lowercase'       => ['/%2egit/config'],
            'encoded dot, uppercase'       => ['/%2Egit/config'],
            'encoded dotfile'              => ['/%2eenv.local'],
            'encoded dot mid-path'         => ['/assets/%2egit/config'],
            'double-dot traversal'         => ['/assets/../.env.local'],
            'encoded double-dot traversal' => ['/assets/%2e%2e/%2eenv.local'],
            'encoded separator'            => ['/assets%2f.env.local'],
            'dotfile with query string'    => ['/.env.local?x=1'],
        ];
    }

    /** @return array<string, array{string}> */
    public static function allowedUris(): array
    {
        return [
            'root'                  => ['/'],
            'page'                  => ['/about.php'],
            'nested asset'          => ['/assets/css/liturgicalcalendar.css'],
            'unknown path'          => ['/zzz-does-not-exist'],
            'query string'          => ['/index.php?locale=it'],
            // A dot inside a segment is ordinary; only a LEADING dot is refused.
            'dot inside filename'   => ['/assets/js/index.min.js'],
            'encoded space'         => ['/assets/img/easter%20egg.png'],
        ];
    }

    #[DataProvider('forbiddenUris')]
    public function testRefusesDotPrefixedSegments(string $uri): void
    {
        $this->assertTrue(DevServerRouter::isForbidden($uri), $uri . ' should be refused');
    }

    #[DataProvider('allowedUris')]
    public function testAllowsOrdinaryRequests(string $uri): void
    {
        $this->assertFalse(DevServerRouter::isForbidden($uri), $uri . ' should be allowed');
    }
}
