<?php

declare(strict_types=1);

namespace LiturgicalCalendar\Frontend;

/**
 * Request filtering for the `php -S` development server.
 *
 * PHP's built-in web server serves any file under the document root verbatim,
 * dotfiles included. The docker dev stack bind-mounts this repository root, so
 * without this filter `GET /.env.local` returns the file byte for byte —
 * `JWT_SECRET` and all — and `GET /.git/config` exposes the repository's git
 * metadata.
 *
 * Lives here rather than inline in `router.php` so it can be unit tested: the
 * built-in server re-includes its router script per request, which makes a
 * function declared there a redeclaration hazard.
 */
final class DevServerRouter
{
    /**
     * Whether a request URI must be refused.
     *
     * The URI is percent-decoded before its segments are examined, because the
     * built-in server decodes too when it resolves a path on disk. Without that
     * step `GET /%2egit/config` reached the real `.git/config` while a literal
     * `GET /.git/config` was correctly refused — the check and the resolution
     * disagreed about what the path was.
     *
     * Decoding before splitting on `/` also means an encoded separator (`%2f`)
     * becomes a real segment boundary here, so it cannot smuggle a leading dot
     * past the loop.
     *
     * @param string $requestUri The raw request URI, e.g. `$_SERVER['REQUEST_URI']`.
     * @return bool True when the request must be refused.
     */
    public static function isForbidden(string $requestUri): bool
    {
        $path = parse_url($requestUri, PHP_URL_PATH);

        // parse_url() returns false on a seriously malformed URI. Refuse rather
        // than hand something unparseable to the default handler.
        if (!is_string($path)) {
            return true;
        }

        foreach (explode('/', rawurldecode($path)) as $segment) {
            if ($segment !== '' && str_starts_with($segment, '.')) {
                return true;
            }
        }

        return false;
    }
}
