<?php

/**
 * Shared change-request translations for JavaScript.
 *
 * Both the reviewer's queue (`admin-changes.php`) and the submitter's own history
 * (`change-requests.php`) render the SAME batch objects and the SAME batch detail
 * body, so the labels for resource types, file operations, publication states and
 * the diff itself are defined once here and merged with each page's own extras.
 *
 * Placeholders are numbered (`%1$s`, `%2$s`) so translators can reorder them; the
 * substitution happens in JavaScript, in `assets/js/change-request-common.js`.
 *
 * @return array<string, mixed>
 */

return [
    // Generic chrome
    'loading'             => _('Loading...'),
    'close'               => _('Close'),
    'view'                => _('View'),
    'actions'             => _('Actions'),
    'status'              => _('Status'),
    'unknownUser'         => _('Unknown user'),

    // Batch columns
    'resource'            => _('Resource'),
    'files'               => _('Files'),
    'submitted'           => _('Submitted'),
    'publication'         => _('Publication'),
    'pullRequest'         => _('Pull request'),
    'proposedChanges'     => _('Proposed changes'),

    // Review statuses
    'statusSubmitted'     => _('Submitted'),
    'statusApproved'      => _('Approved'),
    'statusRejected'      => _('Rejected'),
    'statusWithdrawn'     => _('Withdrawn'),

    // A published pull request that is closed without merging moves an approved
    // batch to `rejected`, so the two fields can disagree. Say which happened
    // rather than implying a reviewer refused something they in fact approved.
    'approvedThenClosed'  => _('Approved by a reviewer; its pull request was later closed without merging.'),

    'resourceTypes'       => [
        'national_calendar'           => _('National calendar'),
        'diocesan_calendar'           => _('Diocesan calendar'),
        'wider_region'                => _('Wider region'),
        'general_roman_calendar'      => _('General Roman Calendar'),
        'national_calendar_test'      => _('National calendar test'),
        'diocesan_calendar_test'      => _('Diocesan calendar test'),
        'general_roman_calendar_test' => _('General Roman Calendar test'),
        'rite_calendar_test'          => _('Rite calendar test'),
    ],

    'operations'          => [
        'create' => _('Added'),
        'update' => _('Changed'),
        'delete' => _('Removed'),
    ],

    'publicationStatuses' => [
        'none'   => _('Not published'),
        'queued' => _('Queued for publication'),
        'open'   => _('Pull request open'),
        'merged' => _('Merged'),
        'closed' => _('Closed without merging'),
    ],

    // Batch detail / diff
    'failedToLoadDetail'  => _('Could not load what this change request proposes.'),
    'noFiles'             => _('This change request proposes no files.'),
    'noChanges'           => _('No content change.'),
    'diffTooLarge'        => _('This file is too large to compare in the browser (%1$s proposed, %2$s currently on disk).'),
    'diffHiddenLines'     => _('@@ %1$d unchanged line(s) hidden @@'),
    'contentSuppressed'   => _('File contents were not requested. Proposed: %1$s; currently on disk: %2$s.'),
    'fileWillBeDeleted'   => _('This file will be removed (%1$s currently on disk).'),
];
