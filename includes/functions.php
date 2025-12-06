<?php

/**
 * Helper functions for the Liturgical Calendar Frontend.
 *
 * This file contains utility functions used across multiple pages.
 */

/**
 * Get a plural-aware translation string using ngettext
 *
 * @param string $key   The message key
 * @param int    $count The count for plural determination
 * @return string The translated string (use with sprintf for placeholders)
 */
function messagesPlural(string $key, int $count): string
{
    switch ($key) {
        case 'Decrees count':
            /** translators: singular form for 1 decree - %1$d is count (1), %2$s is URL link */
            $singular = 'Currently, these endpoints are read-only. There is currently <b>%1$d Decree</b> defined at the endpoint %2$s.';
            /** translators: plural form for multiple decrees - %1$d is count, %2$s is URL link */
            $plural = 'Currently, these endpoints are read-only. There are currently <b>%1$d Decrees</b> defined at the endpoint %2$s.';
            return ngettext($singular, $plural, $count);
        default:
            return '';
    }
}
