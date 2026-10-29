<?php

namespace LiturgicalCalendar\Frontend;

/**
 * Server-side data shaping for the particular calendars navigator (#66).
 *
 * Turns the two inputs the navigator's hub page already has on hand —
 * `AuthHelper::dashboardScopes()` and a `/missals/{rite}` response — into the
 * exact `rights` and `missals` shapes `buildNavigatorTree()` in
 * `assets/js/particularCalendarsTree.js` expects. See docs/superpowers/specs/
 * 2026-09-30-particular-calendars-navigator-design.md.
 */
final class NavigatorData
{
    /** The `wider_region`/`national_calendar`/`diocesan_calendar` OpenFGA object types the navigator composes. */
    private const OBJECT_TYPES = ['national_calendar', 'diocesan_calendar', 'wider_region'];

    /**
     * The navigator's `rights` input: `isGlobalAdmin`, plus per-object-type
     * `admin`/`editor` lists of rite-qualified ids (e.g. `roman/IT`,
     * `ambrosian/lugano_ch`), restricted to the three object types the
     * navigator understands. Admin ids are also folded into `editor`, since
     * OpenFGA `admin` implies `editor`.
     *
     * @param array{
     *     is_global_admin?: mixed,
     *     admin_scopes?: mixed,
     *     editor_scopes?: mixed,
     * } $dashboardScopes The shape `AuthHelper::dashboardScopes()` returns
     *     (its `DashboardScopes` typedef); read defensively since it may
     *     also be handed a decoded API response.
     * @return array{
     *     isGlobalAdmin: bool,
     *     admin: array<string, list<string>>,
     *     editor: array<string, list<string>>,
     * }
     */
    public static function rights(array $dashboardScopes): array
    {
        $admin  = array_fill_keys(self::OBJECT_TYPES, []);
        $editor = array_fill_keys(self::OBJECT_TYPES, []);

        $adminScopes = $dashboardScopes['admin_scopes'] ?? null;
        if (is_array($adminScopes)) {
            foreach ($adminScopes as $scope) {
                if (
                    !is_array($scope)
                    || !isset($scope['object_type'], $scope['object_id'])
                    || !is_string($scope['object_type'])
                    || !is_string($scope['object_id'])
                    || !in_array($scope['object_type'], self::OBJECT_TYPES, true)
                ) {
                    continue;
                }
                $admin[$scope['object_type']][] = $scope['object_id'];
            }
        }

        $editorScopes = $dashboardScopes['editor_scopes'] ?? null;
        if (is_array($editorScopes)) {
            foreach (self::OBJECT_TYPES as $type) {
                $ids = $editorScopes[$type] ?? null;
                if (!is_array($ids)) {
                    continue;
                }
                foreach ($ids as $id) {
                    if (is_string($id)) {
                        $editor[$type][] = $id;
                    }
                }
            }
        }

        foreach (self::OBJECT_TYPES as $type) {
            $admin[$type]  = array_values(array_unique($admin[$type]));
            $editor[$type] = array_values(array_unique(array_merge($editor[$type], $admin[$type])));
        }

        return [
            'isGlobalAdmin' => ( $dashboardScopes['is_global_admin'] ?? false ) === true,
            'admin'         => $admin,
            'editor'        => $editor,
        ];
    }

    /**
     * The national Missal editions from a `/missals/{rite}` response, keyed
     * by nation. Only entries whose `region` is a bare ISO 3166-1 alpha-2
     * code are national — `VA` (the Vatican / Editio Typica) is the Roman
     * rite's own edition, not a nation's, and anything else (e.g. an
     * `AMBROSIAN` region tag) is not a nation code at all.
     *
     * @param array{litcal_missals?: mixed} $missalsResponse Decoded `/missals/{rite}` JSON.
     * @return array<string, list<string>> ISO code => sorted missal ids, sorted by ISO code.
     */
    public static function nationalMissals(array $missalsResponse): array
    {
        $missals = [];

        $list = $missalsResponse['litcal_missals'] ?? null;
        if (!is_array($list)) {
            return $missals;
        }

        foreach ($list as $entry) {
            if (
                !is_array($entry)
                || !isset($entry['region'], $entry['missal_id'])
                || !is_string($entry['region'])
                || !is_string($entry['missal_id'])
            ) {
                continue;
            }
            $region = $entry['region'];
            if ($region === 'VA' || preg_match('/^[A-Z]{2}$/', $region) !== 1) {
                continue;
            }
            $missals[$region][] = $entry['missal_id'];
        }

        ksort($missals);
        foreach ($missals as &$ids) {
            sort($ids);
        }
        unset($ids);

        return $missals;
    }
}
