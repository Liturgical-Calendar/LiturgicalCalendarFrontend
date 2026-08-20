<?php

/**
 * Development server router for `php -S`.
 *
 * Refuses any request whose path contains a dot-prefixed segment, so the
 * bind-mounted repository root does not expose `.env*` or `.git/` over HTTP.
 * See {@see \LiturgicalCalendar\Frontend\DevServerRouter} for the reasoning and
 * for the percent-decoding this depends on.
 *
 * Everything else returns false, handing the request back to the built-in
 * server unchanged — real files are still served, and an unknown path still
 * falls back to index.php exactly as before.
 *
 * Wired up by `command:` in docker-compose.override.yml rather than by the
 * Dockerfile, so the image is untouched.
 *
 * @see https://www.php.net/manual/en/features.commandline.webserver.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use LiturgicalCalendar\Frontend\DevServerRouter;

if (DevServerRouter::isForbidden($_SERVER['REQUEST_URI'] ?? '/')) {
    http_response_code(404);
    return true;
}

return false;
