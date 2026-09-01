<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

/**
 * Locates and reads the API's `jsondata/schemas/CommonDef.json`, the source of
 * truth for the enums this repository mirrors by hand.
 *
 * The API repo is NOT on disk in the PHP unit-test CI job
 * (`.github/workflows/tests.yml` checks out this repository only), so every test
 * using this trait has to tolerate its absence — hence the nullable return.
 * Tests keep their own verbatim copy of the enum they guard, and reconcile it
 * with the live file only when the file is there.
 */
trait ApiSchemaTrait
{
    /**
     * Finds the API's CommonDef.json without assuming a fixed layout: honours
     * LITCAL_API_PATH, then walks up from this repository looking for a sibling
     * LiturgicalCalendarAPI checkout (which also covers git worktrees nested a
     * few levels below the repository root) and the E2E workflow's `api-repo`.
     */
    protected static function locateCommonDef(): ?string
    {
        $suffix = '/jsondata/schemas/CommonDef.json';

        $configured = getenv('LITCAL_API_PATH');
        if (is_string($configured) && $configured !== '') {
            $candidate = rtrim($configured, '/') . $suffix;
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        $dir = dirname(__DIR__);
        for ($i = 0; $i < 6 && $dir !== '' && $dir !== '/'; $i++) {
            foreach (['/LiturgicalCalendarAPI', '/api-repo'] as $repoDir) {
                $candidate = $dir . $repoDir . $suffix;
                if (is_file($candidate)) {
                    return $candidate;
                }
            }
            $dir = dirname($dir);
        }

        return null;
    }

    /**
     * Reads `definitions.<name>.items.enum` out of the schema at $path.
     *
     * @return array<int, string>
     */
    protected static function schemaEnum(string $path, string $definition): array
    {
        $raw = file_get_contents($path);
        if (false === $raw) {
            throw new \RuntimeException("Could not read {$path}");
        }

        /** @var array{definitions: array<string, array{items: array{enum: array<int, string>}}>} $schema */
        $schema = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        return $schema['definitions'][$definition]['items']['enum'];
    }

    /**
     * The message a test shows when the API repo is not available.
     */
    protected static function schemaUnavailableMessage(): string
    {
        return 'LiturgicalCalendarAPI/jsondata/schemas/CommonDef.json was not found. '
            . 'Set LITCAL_API_PATH to the API checkout to run this reconciliation.';
    }
}
