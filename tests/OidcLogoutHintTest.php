<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend\Tests;

use LiturgicalCalendar\Frontend\JwtSegments;
use LiturgicalCalendar\Frontend\OidcClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

/**
 * `id_token_hint` must not be forwarded when the ID token was minted for a different client.
 *
 * Sibling sites share a cookie domain, so the ID token in this application's cookie is frequently
 * UnitTestInterface's: logging in there authenticates here too. Forwarding that alongside our own
 * `client_id` makes Zitadel refuse the entire logout request --
 *
 *     {"error":"invalid_request","error_description":"client_id does not match azp of id_token_hint"}
 *
 * -- so the user cannot log out at all. Observed live on litcal-staging after logging in at litcal-tests.
 * UnitTestInterface fixed the mirror image of this in its own #88; this is the same guard on this side.
 *
 * Asserted through the public getLogoutUrl() rather than by reflecting into the private predicate, so the
 * test pins the behaviour that actually reaches Zitadel. The discovery document is seeded directly to keep
 * the test offline -- getEndSessionEndpoint() would otherwise fetch it.
 */
#[CoversClass(OidcClient::class)]
#[CoversClass(JwtSegments::class)]
final class OidcLogoutHintTest extends TestCase
{
    private const OURS   = '373289176235245570'; // LiturgicalCalendarFrontend
    private const THEIRS = '387831835490582530'; // UnitTestInterface
    private const END_SESSION = 'https://auth.example.test/oidc/v1/end_session';

    private function client(): OidcClient
    {
        $client = new OidcClient('https://auth.example.test', self::OURS, 'https://front.example.test/auth/callback.php');
        $doc    = new ReflectionProperty(OidcClient::class, 'discoveryDoc');
        $doc->setValue($client, ['end_session_endpoint' => self::END_SESSION]);
        return $client;
    }

    /** Build an unsigned-but-well-formed JWT carrying the given claims. */
    private function token(array $claims): string
    {
        $b64 = static fn(array $v): string => rtrim(strtr(base64_encode(json_encode($v)), '+/', '-_'), '=');
        return $b64(['alg' => 'RS256', 'typ' => 'JWT']) . '.' . $b64($claims) . '.' . $b64(['sig']);
    }

    public function testForwardsHintMintedForThisClient(): void
    {
        $token = $this->token(['azp' => self::OURS, 'aud' => [self::OURS, 'project']]);
        $url   = $this->client()->getLogoutUrl($token, 'https://front.example.test/');
        $this->assertStringContainsString('id_token_hint=', $url);
    }

    public function testDropsHintMintedForAnotherClient(): void
    {
        $token = $this->token(['azp' => self::THEIRS, 'aud' => [self::THEIRS, 'project']]);
        $url   = $this->client()->getLogoutUrl($token, 'https://front.example.test/');

        // The hint is gone, but the request is still a valid logout: client_id and the redirect remain,
        // which is what lets Zitadel validate post_logout_redirect_uri against this application.
        $this->assertStringNotContainsString('id_token_hint', $url);
        $this->assertStringContainsString('client_id=' . self::OURS, $url);
        $this->assertStringContainsString('post_logout_redirect_uri=', $url);
    }

    public function testAcceptsSingleValuedAudienceWhenAzpAbsent(): void
    {
        // `azp` is required only when the audience has more than one value; a single-valued `aud` carries
        // the same meaning.
        $url = $this->client()->getLogoutUrl($this->token(['aud' => self::OURS]), 'https://front.example.test/');
        $this->assertStringContainsString('id_token_hint=', $url);
    }

    public function testRejectsMultiValuedAudienceWhenAzpAbsent(): void
    {
        // No authorized party is named, so this cannot be shown to be ours. Guessing would reintroduce
        // the bug.
        $url = $this->client()->getLogoutUrl($this->token(['aud' => [self::OURS, 'project']]), 'https://front.example.test/');
        $this->assertStringNotContainsString('id_token_hint', $url);
    }

    /**
     * The alphabet check in JwtSegments is what makes this fail. base64_decode() in non-strict mode
     * silently discards `!`, so a corrupted payload would otherwise decode to a matching `azp` and the
     * hint would be forwarded on the strength of a token that is not well-formed.
     */
    public function testRejectsTokenWithCorruptedSegment(): void
    {
        $valid  = $this->token(['azp' => self::OURS]);
        $parts  = explode('.', $valid);
        $broken = $parts[0] . '.' . $parts[1] . '!' . '.' . $parts[2];

        $this->assertNull(JwtSegments::payload($broken), 'a corrupted segment must not decode');
        $url = $this->client()->getLogoutUrl($broken, 'https://front.example.test/');
        $this->assertStringNotContainsString('id_token_hint', $url);
    }

    public function testRejectsNonJwt(): void
    {
        $url = $this->client()->getLogoutUrl('not-a-jwt', 'https://front.example.test/');
        $this->assertStringNotContainsString('id_token_hint', $url);
    }

    public function testOmitsHintParameterEntirelyWhenNoneSupplied(): void
    {
        $url = $this->client()->getLogoutUrl(null, 'https://front.example.test/');
        $this->assertStringNotContainsString('id_token_hint', $url);
        $this->assertStringContainsString('client_id=' . self::OURS, $url);
    }
}
