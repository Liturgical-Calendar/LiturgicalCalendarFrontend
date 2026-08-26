<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend;

/**
 * Reading a JWT's segments without verifying it.
 *
 * Used to decide what to do WITH a token, never to trust its contents: {@see OidcClient::getLogoutUrl()}
 * asks whether an ID token names this client before handing it back to the issuer, which then verifies it
 * properly. Nothing here is a substitute for verification.
 *
 * The decoding has a trap in it that is easy to get wrong:
 *
 *   - `base64_decode($s, false)` — non-strict — NEVER returns false. It silently drops characters outside
 *     the alphabet, so `eyJhenAiOiJ4In0!` decodes cleanly to `{"azp":"x"}`. A `false ===` check against it
 *     is dead code, which is worse than no check because it reads like one.
 *   - `base64_decode($s, true)` — strict — rejects `!` and `@`, but still tolerates whitespace.
 *
 * So the alphabet is checked explicitly first, and only then is the value decoded strictly.
 *
 * Named `JwtSegments` rather than `Jwt` deliberately: PHP resolves class names case-insensitively, so a
 * class called `Jwt` is indistinguishable from `Firebase\JWT\JWT` in any file that imports it —
 * `OidcClient` does — and an unqualified call would silently bind to the wrong class.
 *
 * Ported from UnitTestInterface's `src/Oidc/JwtSegments.php` (that repository's #88), which fixed the
 * mirror image of the bug this fixes. Kept deliberately identical so the two do not drift.
 */
final class JwtSegments
{
    private const SEGMENT_HEADER  = 0;
    private const SEGMENT_PAYLOAD = 1;

    /**
     * @return array<string, mixed>|null
     */
    public static function header(string $token): ?array
    {
        return self::segment($token, self::SEGMENT_HEADER);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function payload(string $token): ?array
    {
        return self::segment($token, self::SEGMENT_PAYLOAD);
    }

    /**
     * @return array<string, mixed>|null Decoded claims, or null if the segment is not well-formed.
     */
    private static function segment(string $token, int $index): ?array
    {
        $segments = explode('.', $token);
        if (3 !== count($segments)) {
            return null;
        }

        // Every segment is checked, not just the one being returned: a caller asking for the header learns
        // nothing about the rest, so `<valid header>.<garbage>.<garbage>` would otherwise yield usable
        // claims from something that is not a JWT at all. See the class docblock for why this cannot be
        // left to base64_decode()'s own checking.
        foreach ($segments as $segment) {
            if (1 !== preg_match('/^[A-Za-z0-9_-]+$/', $segment)) {
                return null;
            }
        }

        $decoded = base64_decode(strtr($segments[$index], '-_', '+/'), true);
        if (false === $decoded || '' === $decoded) {
            return null;
        }

        /** @var array<string, mixed>|null $claims */
        $claims = json_decode($decoded, true);
        return is_array($claims) ? $claims : null;
    }
}
