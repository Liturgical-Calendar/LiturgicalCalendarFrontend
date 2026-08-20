<?php

/**
 * Development server router for `php -S`.
 *
 * PHP's built-in web server serves any file under the document root verbatim,
 * dotfiles included. That is harmless when the docroot is a built artefact, but
 * the docker dev stack bind-mounts this repository root — so without this router
 * `GET /.env.local` returns the file byte for byte, `JWT_SECRET` and all, and
 * `GET /.git/config` exposes the repository's git metadata. Both were reachable
 * on http://localhost:3000 before this file existed.
 *
 * Any path segment beginning with a dot is refused. Everything else returns
 * false, which hands the request back to the built-in server unchanged — real
 * files are still served, and an unknown path still falls back to index.php
 * exactly as it did before.
 *
 * Wired up by `command:` in docker-compose.override.yml rather than by the
 * Dockerfile, so the image is untouched; see that file for the rationale.
 *
 * @see https://www.php.net/manual/en/features.commandline.webserver.php
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// parse_url() returns false on a seriously malformed URI; treat that as unroutable
// rather than letting it fall through to the default handler.
if (!is_string($path)) {
    http_response_code(400);
    return true;
}

foreach (explode('/', $path) as $segment) {
    if ($segment !== '' && str_starts_with($segment, '.')) {
        http_response_code(404);
        return true;
    }
}

return false;
