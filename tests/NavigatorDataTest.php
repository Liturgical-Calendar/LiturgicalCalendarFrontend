<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\NavigatorData;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(NavigatorData::class)]
final class NavigatorDataTest extends TestCase
{
    public function testRightsWithAdminAndEditorOverlapMergesAdminIntoEditor(): void
    {
        $dashboardScopes = [
            'is_global_admin' => false,
            'admin_scopes'    => [
                ['object_type' => 'national_calendar', 'object_id' => 'roman/IT'],
                ['object_type' => 'diocesan_calendar', 'object_id' => 'roman/roma_it'],
            ],
            'editor_scopes'   => [
                'national_calendar' => ['roman/IT', 'roman/FR'],
                'diocesan_calendar' => ['roman/roma_it'],
            ],
        ];

        $rights = NavigatorData::rights($dashboardScopes);

        $this->assertFalse($rights['isGlobalAdmin']);
        $this->assertSame(['roman/IT'], $rights['admin']['national_calendar']);
        $this->assertSame(['roman/roma_it'], $rights['admin']['diocesan_calendar']);
        $this->assertSame([], $rights['admin']['wider_region']);

        // Admin ids are folded into editor, deduplicated (roman/IT appears in both sources once).
        $this->assertSame(['roman/IT', 'roman/FR'], $rights['editor']['national_calendar']);
        $this->assertSame(['roman/roma_it'], $rights['editor']['diocesan_calendar']);
        $this->assertSame([], $rights['editor']['wider_region']);
    }

    public function testRightsDropsOtherObjectTypes(): void
    {
        $dashboardScopes = [
            'is_global_admin' => false,
            'admin_scopes'    => [
                ['object_type' => 'national_calendar', 'object_id' => 'roman/IT'],
                ['object_type' => 'rite_calendar', 'object_id' => 'roman/general'],
                ['object_type' => 'test_definition', 'object_id' => 'roman/IT/some-test'],
            ],
            'editor_scopes'   => [
                'national_calendar' => ['roman/IT'],
                'rite_calendar'     => ['roman/general'],
            ],
        ];

        $rights = NavigatorData::rights($dashboardScopes);

        $this->assertSame(['national_calendar', 'diocesan_calendar', 'wider_region'], array_keys($rights['admin']));
        $this->assertSame(['national_calendar', 'diocesan_calendar', 'wider_region'], array_keys($rights['editor']));
        $this->assertSame(['roman/IT'], $rights['admin']['national_calendar']);
        $this->assertSame(['roman/IT'], $rights['editor']['national_calendar']);
    }

    public function testRightsDropsNonStringIdsAndMalformedScopeEntries(): void
    {
        $dashboardScopes = [
            'is_global_admin' => true,
            'admin_scopes'    => [
                ['object_type' => 'national_calendar', 'object_id' => 42],
                ['object_type' => 'national_calendar'],
                ['object_id' => 'roman/IT'],
                'not an array',
                ['object_type' => 'wider_region', 'object_id' => 'roman/europe'],
            ],
            'editor_scopes'   => [
                'national_calendar' => ['roman/FR', 42, null, ['nested' => true]],
                'wider_region'      => 'not an array',
            ],
        ];

        $rights = NavigatorData::rights($dashboardScopes);

        $this->assertTrue($rights['isGlobalAdmin']);
        $this->assertSame([], $rights['admin']['national_calendar']);
        $this->assertSame(['roman/europe'], $rights['admin']['wider_region']);
        $this->assertSame(['roman/FR'], $rights['editor']['national_calendar']);
        $this->assertSame(['roman/europe'], $rights['editor']['wider_region']);
    }

    public function testRightsWithEmptyOrUnauthenticatedScopesReturnsAllEmpty(): void
    {
        $failClosed = [
            'is_global_admin'   => false,
            'is_resource_admin' => false,
            'admin_scopes'      => [],
            'viewer_scopes'     => [],
            'editor_scopes'     => [],
        ];

        $rights = NavigatorData::rights($failClosed);

        $this->assertFalse($rights['isGlobalAdmin']);
        foreach (['national_calendar', 'diocesan_calendar', 'wider_region'] as $type) {
            $this->assertSame([], $rights['admin'][$type]);
            $this->assertSame([], $rights['editor'][$type]);
        }
    }

    public function testRightsWithMissingKeysReturnsAllEmpty(): void
    {
        $rights = NavigatorData::rights([]);

        $this->assertFalse($rights['isGlobalAdmin']);
        foreach (['national_calendar', 'diocesan_calendar', 'wider_region'] as $type) {
            $this->assertSame([], $rights['admin'][$type]);
            $this->assertSame([], $rights['editor'][$type]);
        }
    }

    public function testNationalMissalsFiltersVaAndNonNationRegionsAndSorts(): void
    {
        $missalsResponse = [
            'litcal_missals' => [
                ['missal_id' => 'EDITIO_TYPICA_1970', 'region' => 'VA'],
                ['missal_id' => 'EDITIO_TYPICA_2002', 'region' => 'VA'],
                ['missal_id' => 'IT_1983', 'region' => 'IT'],
                ['missal_id' => 'US_2011', 'region' => 'US'],
                ['missal_id' => 'SOME_AMBROSIAN_EDITION', 'region' => 'AMBROSIAN'],
            ],
        ];

        $this->assertSame(
            ['IT' => ['IT_1983'], 'US' => ['US_2011']],
            NavigatorData::nationalMissals($missalsResponse)
        );
    }

    public function testNationalMissalsSortsMultipleEditionsPerNationAndKeysByRegion(): void
    {
        $missalsResponse = [
            'litcal_missals' => [
                ['missal_id' => 'US_2011', 'region' => 'US'],
                ['missal_id' => 'IT_1983', 'region' => 'IT'],
                ['missal_id' => 'IT_2004', 'region' => 'IT'],
            ],
        ];

        $this->assertSame(
            ['IT' => ['IT_1983', 'IT_2004'], 'US' => ['US_2011']],
            NavigatorData::nationalMissals($missalsResponse)
        );
    }

    public function testNationalMissalsSkipsMalformedEntries(): void
    {
        $missalsResponse = [
            'litcal_missals' => [
                ['missal_id' => 'IT_1983', 'region' => 'IT'],
                ['missal_id' => 'MISSING_REGION'],
                ['region' => 'US'],
                ['missal_id' => 42, 'region' => 'US'],
                ['missal_id' => 'BAD_REGION', 'region' => 'usa'],
                ['missal_id' => 'LOWERCASE_REGION', 'region' => 'it'],
                'not an array',
            ],
        ];

        $this->assertSame(['IT' => ['IT_1983']], NavigatorData::nationalMissals($missalsResponse));
    }

    public function testNationalMissalsWithNoLitcalMissalsKeyReturnsEmptyArray(): void
    {
        $this->assertSame([], NavigatorData::nationalMissals([]));
    }

    public function testNationalMissalsWithNonArrayLitcalMissalsReturnsEmptyArray(): void
    {
        $this->assertSame([], NavigatorData::nationalMissals(['litcal_missals' => 'not an array']));
    }
}
