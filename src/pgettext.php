<?php

if (!function_exists('pgettext')) {

    function pgettext(string $context, string $msgid): string
    {
        $contextString = "{$context}\004{$msgid}";
        $translation   = dcgettext('litcal', $contextString, LC_MESSAGES);
        if ($translation === $contextString) {
            return $msgid;
        } else {
            return $translation;
        }
    }

}
