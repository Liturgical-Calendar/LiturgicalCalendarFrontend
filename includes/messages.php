<?php

/**
 * Centralized translation strings for extending.php and admin-decrees.php
 *
 * This file consolidates all gettext translations used across the calendar
 * definition pages to ensure consistency and easier maintenance.
 */

// phpcs:disable Generic.Files.LineLength

$messages = [
    // =========================================================================
    // Form field labels
    // =========================================================================
    /** translators: form field label for the unique identifier of a liturgical event */
    'EventKey'                                        => _('Event key'),
    /** translators: form field label for the name of a liturgical event */
    'Name'                                            => _('Name'),
    /** translators: form field label for the day of the month */
    'Day'                                             => _('Day'),
    /** translators: form field label for the month of the year */
    'Month'                                           => _('Month'),
    /** translators: form field label for liturgical color selection */
    'Liturgical color'                                => _('Liturgical color'),
    /** translators: form field label - first year a liturgical event takes effect */
    'Since'                                           => _('Since'),
    /** translators: form field label - last year a liturgical event is observed */
    'Until'                                           => _('Until'),
    /** translators: form field label for decree URL */
    'Decree URL'                                      => _('Decree URL'),
    /** translators: form field label for decree language mappings */
    'Decree Langs'                                    => _('Decree Language mappings'),
    /** translators: form field label for Roman Missal selection */
    'Missal'                                          => _('Missal'),
    /** translators: form field label for move event reason */
    'Reason'                                          => _('Reason (in favor of liturgical event)'),
    /** translators: form field label for timezone selection */
    'Timezone'                                        => _('Timezone'),
    /** translators: form field label for selecting JSON file in admin */
    'Select JSON file to manage'                      => _('Select JSON file to manage'),
    /** translators: form field label for selecting data source in admin */
    'Select data source'                              => _('Select data source'),
    /** translators: form field label for year the decree takes effect */
    'To take effect in the year'                      => _('To take effect in the year'),

    // =========================================================================
    // Notification titles (used in toastr notifications)
    // =========================================================================
    /** translators: notification title for successful operations */
    'Success'                                         => _('Success'),
    /** translators: notification title for failed operations */
    'Error'                                           => _('Error'),
    /** translators: notification title for warning messages */
    'Warning'                                         => _('Warning'),
    /** translators: notification title when a write was queued for review instead of being saved */
    'Pending Review'                                  => _('Pending review'),
    /** translators: notification title when translations are missing for a locale */
    'Missing Translations'                            => _('Missing Translations'),

    // =========================================================================
    // Translation-related error messages
    // =========================================================================
    /** translators: error message when translations are missing. %s is the locale code (e.g., "en_US") */
    'Cannot proceed: translations missing for locale' => _('Cannot proceed: translations missing for locale %s'),
    /** translators: shown when a new national calendar's language cannot be used yet. %s is the locale code (e.g. "es_VE").
        "Officially supported" is a status a language reaches once all of these translations are complete. */
    'Locale not officially supported'                 => _('"%s" is not yet an officially supported locale: the translations of the General Roman Calendar, the Decrees and the Lectionary into this language are not complete. A national calendar can only be created in an officially supported locale.'),
    /** translators: shown when a new national calendar declares locales that cannot be used yet. %s is a comma-separated list of locale codes (e.g. "br_FR, oc_FR") */
    'Locales not officially supported'                => _('Not yet officially supported: %s. The translations of the General Roman Calendar, the Decrees and the Lectionary into these languages are not complete, so a new national calendar cannot declare them. Deselect them to save the calendar.'),
    /** translators: link to the page explaining how to contribute translations */
    'Help complete the translations'                  => _('Help complete the translations'),
    /** translators: appended in parentheses to a language in the list of a new national calendar's locales, when it cannot be selected yet */
    'Not yet available: translations incomplete'      => _('not yet available: translations incomplete'),
    /** translators: warning shown when most event names of the calendar being created are untranslated in its locale */
    'Event names mostly untranslated'                 => _('More than half of the event names have not been translated into this locale yet. Consider completing the translations before creating a new calendar.'),

    // =========================================================================
    // Write outcome messages (see assets/js/writeDisposition.js)
    // A write may be recorded as a change request awaiting review instead of being
    // applied to disk; the API says which in the response `disposition` field.
    // =========================================================================
    /** translators: %s is the change request batch id. The changes were queued for review, not saved */
    'writeSubmitted'                                  => _('Your changes were submitted for review as batch %s. Nothing has been saved yet.'),
    /** translators: %s is the change request batch id. The changes were approved but are not published yet */
    'writeApproved'                                   => _('Your changes were approved as batch %s and are queued for publication. They are not live yet.'),
    /** translators: %s is a comma separated list of change request batch ids folded into the current one */
    'writeSuperseded'                                 => _('Earlier pending submissions were folded into this one and no longer appear in your queue: %s'),
    /** translators: %s is the unrecognized outcome value the server sent */
    'writeUnknown'                                    => _('The server reported an unrecognized outcome (\'%s\') for these changes. Reload the page to check whether they were saved.'),
    /** translators: %s is a calendar identifier such as "nation/US" */
    'Calendar deleted'                                => _('Calendar \'%s\' was deleted successfully'),
    /** translators: %s is a diocese identifier such as "rome_it" */
    'Diocesan calendar deleted'                       => _('Diocesan Calendar \'%s\' was deleted successfully'),
    /** translators: confirmation shown after saving a national calendar */
    'National calendar saved'                         => _('National Calendar was created or updated successfully'),
    /** translators: confirmation shown after saving a wider region calendar */
    'Wider region saved'                              => _('Wider Region Calendar was created or updated successfully'),
    /** translators: %s = comma-separated locales, e.g. "en_CA, fr_CA". Shown to a national calendar editor viewing a wider region */
    'Wider region translations only'                  => _('You can edit this wider region\'s translations for: %s. Everything else is read-only.'),
    /** translators: shown to a national calendar editor with no locale of their own in the wider region */
    'Wider region no own translations'                => _('You can add your nation\'s languages to this wider region in the Locales list; everything else is read-only.'),
    /** translators: %s = comma-separated locales, e.g. "en_CA, fr_CA" */
    'Wider region translations saved'                 => _('The wider region\'s translations for %s were saved'),
    /** translators: shown when a national calendar editor saves a wider region with no translation they may write */
    'Wider region nothing to save'                    => _('There are no translations here that you may edit.'),

    // =========================================================================
    // Liturgical colors
    // =========================================================================
    /** translators: liturgical color - white */
    'white'                                           => _('white'),
    /** translators: liturgical color - red */
    'red'                                             => _('red'),
    /** translators: liturgical color - green */
    'green'                                           => _('green'),
    /** translators: liturgical color - purple/violet */
    'purple'                                          => _('purple'),
    /** translators: liturgical color - rose/pink */
    'rose'                                            => _('rose'),

    // =========================================================================
    // Form row action titles (displayed as section headers)
    // =========================================================================
    /** translators: form row title for designating a Doctor of the Church */
    'Designate Doctor'                                => _('Designate Doctor of the Church'),
    /** translators: form row title for creating a new liturgical event */
    'New liturgical event'                            => _('New liturgical event'),
    /** translators: form row title for changing the name of a liturgical event */
    'Change name'                                     => _('Change name'),
    /** translators: form row title for changing the grade of a liturgical event */
    'Change grade'                                    => _('Change grade'),
    /** translators: form row title for changing name or grade */
    'Change name or grade'                            => _('Change name or grade'),
    /** translators: form row title for moving a liturgical event to a new date */
    'Move liturgical event'                           => _('Move liturgical event'),

    // =========================================================================
    // Button labels for diocesan calendar definitions
    // =========================================================================
    /** translators: button text for adding a solemnity in diocesan calendar */
    'Other Solemnity'                                 => _('Other Solemnity'),
    /** translators: button text for adding a feast in diocesan calendar */
    'Other Feast'                                     => _('Other Feast'),
    /** translators: button text for adding a memorial in diocesan calendar */
    'Other Memorial'                                  => _('Other Memorial'),
    /** translators: button text for adding an optional memorial in diocesan calendar */
    'Other Optional Memorial'                         => _('Other Optional Memorial'),

    // =========================================================================
    // Action button descriptions (longer text explaining what button does)
    // =========================================================================
    /** translators: button description for designating patron action */
    'PatronButton'                                    => _('Designate patron'),
    /** translators: button description for changing name or grade of existing event */
    'SetPropertyButton'                               => _('Change name or grade of existing liturgical event'),
    /** translators: button description for moving event to new date */
    'MoveEventButton'                                 => _('Move liturgical event to new date'),
    /** translators: button description for creating new liturgical event */
    'CreateEventButton'                               => _('Create new liturgical event'),
    /** translators: button description for designating Doctor of the Church */
    'MakeDoctorButton'                                => _('Designate Doctor of the Church from existing liturgical event'),

    // =========================================================================
    // Action button labels (actual text shown on buttons)
    // =========================================================================
    /** translators: button label for deleting a calendar */
    'DeleteCalendarButton'                            => _('Delete calendar'),
    /** translators: button label for removing existing data */
    'RemoveDataButton'                                => _('Remove existing data'),
    /** translators: button label for canceling an action */
    'CancelButton'                                    => _('Cancel'),
    /** translators: button label for setting a property */
    'SetPropertyLabel'                                => _('Set Property'),
    /** translators: button label for moving a liturgical event */
    'MoveLiturgicalEventLabel'                        => _('Move Liturgical Event'),
    /** translators: button label for creating a liturgical event */
    'CreateLiturgicalEventLabel'                      => _('Create Liturgical Event'),
    /** translators: button label for creating event from existing */
    'NewEventFromExistingButton'                      => _('New liturgical event from existing'),
    /** translators: button label for creating entirely new event */
    'NewEventExNovoButton'                            => _('New liturgical event ex novo'),
    /** translators: button label for adding a missal */
    'AddMissalButton'                                 => _('Add Missal'),
    /** translators: button label for adding language edition Roman Missal */
    'AddMissalEditionButton'                          => _('Add language edition Roman Missal'),
    /** translators: link text for reading a decree document */
    'ReadDecreeLink'                                  => _('Read the Decree'),
    /** translators: button label for adding a column in admin table */
    'AddColumnButton'                                 => _('Add Column'),
    /** translators: button label for saving data in admin */
    'SaveDataButton'                                  => _('Save data'),
    /** translators: button title for adding a decree */
    'AddDecreeButton'                                 => _('Add Decree'),

    // =========================================================================
    // Page titles
    // =========================================================================
    /** translators: page title for particular calendars */
    'Page title - Particular Calendars'               => _('General Roman Calendar - Particular Calendars'),
    /** translators: page title for decrees */
    'Page title - Decrees'                            => _('General Roman Calendar - Decrees'),
    /** translators: page title for admin tools */
    'Page title - Admin'                              => _('Administration tools'),

    // =========================================================================
    // Page headings and introductory text
    // =========================================================================
    /** translators: main heading for particular calendars page */
    'Particular Calendars heading'                    => _('Define Particular Calendars based on the General Roman Calendar'),
    /** translators: main heading for particular calendars page */
    'Particular Calendars wider region heading'       => _('Particular Calendars - Define Wider Region events'),
    /** translators: main heading for particular calendars page */
    'Particular Calendars national heading'           => _('Particular Calendars - Define a National Calendar'),
    /** translators: main heading for particular calendars page */
    'Particular Calendars diocesan heading'           => _('Particular Calendars - Define a Diocesan Calendar'),
    /** translators: main heading for decrees page */
    'Decrees heading'                                 => _('Refine the General Roman Calendar with Decrees of the Dicastery for Divine Worship and the Discipline of the Sacraments'),
    /** translators: main heading for admin page */
    'Admin heading'                                   => _('Liturgical Calendar project Administration tools'),
    /** translators: introductory paragraph about decrees */
    'Decrees intro'                                   => _('The Liturgical Calendar is based off of both published Roman Missals, and Decrees of the Dicastery for Divine Worship and the Discipline of the Sacraments. These Decrees can refine the data from the Roman Missals, adding or removing or changing liturgical events, or instructing on how to handle any possible coincidences between mandatory celebrations.'),
    /** translators: explanation about API endpoints for missals and decrees */
    'Decrees API endpoints'                           => _('Data for <b>Roman Missals</b> is handled by the <code>/missals</code> endpoint of the API, while data for <b>Decrees</b> is handled by the <code>/decrees</code> endpoint of the API.'),

    // =========================================================================
    // Extending page - How-to explanations
    // =========================================================================
    /** translators: explanation about hierarchy of particular calendars */
    'API_EXTEND_HOWTO_A0'                             => _('The <b>General Roman Calendar</b> serves as the foundation for <b>Particular Calendars</b>, which are established to meet the liturgical needs of a specific territory.'),
    /** translators: explanation about hierarchy of particular calendars */
    'API_EXTEND_HOWTO_A1'                             => _('These calendars follow a hierarchical structure: a <b>Diocesan calendar</b> inherits and adapts the data from its respective <b>National calendar</b>. Therefore, a National calendar must be defined before a Diocesan calendar can be established.'),
    /** translators: explanation about hierarchy of particular calendars */
    'API_EXTEND_HOWTO_A2'                             => sprintf(
        _('The first step in this process is ensuring the <b>General Roman Calendar</b> is available in the local language (see %s). When multiple nations share common liturgical celebrations—such as the patron of a <b>wider region</b> (e.g., a continent)—these events should be defined at the regional level. Data from the wider region is then automatically integrated into all National calendars within that jurisdiction.'),
        /** translators: link to translations page */
        '<a href="translations.php">' . _('Translations') . '</a>'
    ),
    /** translators: help text for diocesan group field */
    'DioceseGroupHelp'                                => _('If a group of dioceses decides to pool their Liturgical Calendar data, for example to print out one single yearly calendar with the data for all the dioceses in the group, the group can be defined or set here.'),

    // =========================================================================
    // Form section labels - Calendar types
    // =========================================================================
    /** translators: label for wider region calendar name field */
    'Wider Region'                                    => _('Wider Region'),
    /** translators: label of the list of wider regions a national calendar inherits from */
    'Wider regions'                                   => _('Wider regions'),
    /** translators: label for national calendar name field */
    'National Calendar'                               => _('National Calendar'),
    /** translators: label for diocesan calendar dependency */
    'Depends on national calendar'                    => _('Depends on national calendar'),
    /** translators: label for diocese name field */
    'Diocese'                                         => _('Diocese'),
    /** translators: label for diocesan group field */
    'Diocesan group'                                  => _('Diocesan group'),
    /** translators: label for locales selection */
    'Locales'                                         => _('Locales'),
    /** translators: label for current localization selection */
    'Current localization'                            => _('Current localization'),
    /** translators: label for published Roman Missals list */
    'Published Roman Missals'                         => _('Published Roman Missals'),

    // =========================================================================
    // Card/section headings
    // =========================================================================
    /** translators: card heading for creating wider region calendar */
    'Define a Calendar for a Wider Region'            => _('Define a Calendar for a Wider Region'),
    /** translators: card heading for creating national calendar */
    'Define a National Calendar'                      => _('Define a National Calendar'),
    /** translators: card heading for creating diocesan calendar */
    'Define a Diocesan Calendar'                      => _('Define a Diocesan Calendar'),
    /** translators: section heading for national calendar settings */
    'National calendar settings'                      => _('National calendar settings'),
    /** translators: heading for diocesan overrides section */
    'Diocesan overrides'                              => _('Diocesan overrides to the national calendar for …'),

    // =========================================================================
    // Liturgical feast setting labels
    // =========================================================================
    /** translators: label for Epiphany setting */
    'EPIPHANY'                                        => _('EPIPHANY'),
    /** translators: option for Epiphany on January 6 */
    'January 6'                                       => _('January 6'),
    /** translators: option for Epiphany on Sunday */
    'Sunday between January 2 and January 8'          => _('Sunday between January 2 and January 8'),
    /** translators: label for Ascension setting */
    'ASCENSION'                                       => _('ASCENSION'),
    /** translators: label for Corpus Christi setting */
    'CORPUS CHRISTI'                                  => _('CORPUS CHRISTI'),
    /** translators: label for Eternal High Priest setting */
    'ETERNAL HIGH PRIEST'                             => _('ETERNAL HIGH PRIEST'),
    /** translators: label for the national calendar's holy days of obligation setting */
    'HOLY DAYS OF OBLIGATION'                         => _('HOLY DAYS OF OBLIGATION'),
    /** translators: a holy day of obligation (Nativity of the Lord) */
    'Christmas'                                       => _('Christmas'),
    /** translators: a holy day of obligation */
    'Epiphany'                                        => _('Epiphany'),
    /** translators: a holy day of obligation */
    'Ascension'                                       => _('Ascension'),
    /** translators: a holy day of obligation */
    'Corpus Christi'                                  => _('Corpus Christi'),
    /** translators: a holy day of obligation (Solemnity of Mary, Mother of God, January 1) */
    'Mary, Mother of God'                             => _('Mary, Mother of God'),
    /** translators: a holy day of obligation */
    'Immaculate Conception'                           => _('Immaculate Conception'),
    /** translators: a holy day of obligation (Assumption of the Blessed Virgin Mary) */
    'Assumption'                                      => _('Assumption'),
    /** translators: a holy day of obligation (Saint Joseph, Spouse of the Blessed Virgin Mary) */
    'St. Joseph'                                      => _('St. Joseph'),
    /** translators: a holy day of obligation */
    'Sts. Peter and Paul, Apostles'                   => _('Sts. Peter and Paul, Apostles'),
    /** translators: a holy day of obligation */
    'All Saints'                                      => _('All Saints'),

    // =========================================================================
    // Carousel/tab labels for liturgical grades
    // =========================================================================
    /** translators: tab label for solemnities section */
    'Solemnities'                                     => _('Solemnities'),
    /** translators: tab label for feasts section */
    'Feasts'                                          => _('Feasts'),
    /** translators: tab label for memorials section */
    'Memorials'                                       => _('Memorials'),
    /** translators: tab label for optional memorials section */
    'Optional memorials'                              => _('Optional memorials'),

    // =========================================================================
    // Carousel section subtitles
    // =========================================================================
    /** translators: subtitle for defining solemnities */
    'Define the Solemnities'                          => _('Define the Solemnities'),
    /** translators: subtitle for defining feasts */
    'Define the Feasts'                               => _('Define the Feasts'),
    /** translators: subtitle for defining memorials */
    'Define the Memorials'                            => _('Define the Memorials'),
    /** translators: subtitle for defining optional memorials */
    'Define the Optional Memorials'                   => _('Define the Optional Memorials'),

    // =========================================================================
    // Diocesan calendar event row titles
    // =========================================================================
    /** translators: row title for principal patron solemnity */
    'Principal Patron(s)'                             => _('Principal Patron(s) of the Place, Diocese, Region, Province or Territory'),
    /** translators: row title for dedication of cathedral */
    'Dedication of the Cathedral'                     => _('Dedication of the Cathedral'),
    /** translators: row title for patron feast */
    'Patron(s)'                                       => _('Patron(s) of the Place, Diocese, Region, Province or Territory'),
    /** translators: row title for secondary patron memorial */
    'Secondary Patron(s)'                             => _('Secondary Patron(s) of the Place, Diocese, Region, Province or Territory'),
    /** translators: row title for local saints optional memorial */
    'Saints local veneration'                         => _('Saints whose veneration is local to the Place, Diocese, Region, Province or Territory'),

    // =========================================================================
    // Save button labels
    // =========================================================================
    /** translators: button to save wider region calendar data */
    'Save Wider Region Calendar Data'                 => _('Save Wider Region Calendar Data'),
    /** translators: button to save national calendar data */
    'Save National Calendar Data'                     => _('Save National Calendar Data'),
    /** translators: button to save diocesan calendar data */
    'Save Diocesan Calendar Data'                     => _('Save Diocesan Calendar Data'),

    // =========================================================================
    // Modal titles
    // =========================================================================
    /** translators: modal title for changing name or grade */
    'Modal - Change name or grade'                    => _('Change the name or grade of an existing liturgical event'),
    /** translators: modal title for moving event */
    'Modal - Move event'                              => _('Move a liturgical event to a new date'),
    /** translators: modal title for creating new event */
    'Modal - Create new event'                        => _('Create a new liturgical event'),
    /** translators: modal title for choosing missal */
    'Modal - Choose missal'                           => _('Choose from known Roman Missal language editions'),
    /** translators: modal title for deleting a diocesan calendar */
    'Modal - Delete diocesan calendar'                => _('Delete diocesan calendar'),

    // =========================================================================
    // Validation messages
    // =========================================================================
    /** translators: validation error when field is empty */
    'This value cannot be empty.'                     => _('This value cannot be empty.'),
    /** translators: validation error for unknown missal */
    'Missal not found'                                => _('This Missal is unknown to the Liturgical Calendar API. Please choose from a value in the list, or contact the curator of the API to have the Missal added to known language edition Missals.'),

    // =========================================================================
    // Warning/confirmation messages
    // =========================================================================
    /** translators: warning message when deleting a calendar */
    'If you choose'                                   => _('If you choose to delete this calendar, the liturgical events defined for the calendar and the corresponding index entries will be removed and no longer available in the client applications.'),

    // =========================================================================
    // Tooltip/help text
    // =========================================================================
    /** translators: tooltip explaining the first step in defining a national calendar */
    'Tooltip - National calendar first step'          => _('please keep in mind that the first step to creating a national calendar, is to translate the already existing calendar data into the correct language. This can be done on the LitCal translation server (see above for details)'),
    /** translators: help text shown when diocese input is disabled */
    'Select a national calendar first'                => _('Select a national calendar first to see available dioceses.'),
    /** translators: tooltip explaining the Eternal High Priest feast */
    'Tooltip - Eternal High Priest'                   => _('In 2012, Pope Benedict XVI gave faculty to the Episcopal Conferences to insert the Feast of Jesus Christ Eternal High Priest in their own liturgical calendars on the Thursday after Pentecost.'),
    /** translators: tooltip explaining published Roman Missals selection */
    'Tooltip - Published Roman Missals'               => _('if data from the Proper of Saints of a given Missal for this nation has already been incorporated into the main LitCal engine, you can choose the Missal from this list to associate it with this National Calendar (if the Missal is not in the list, it has not been incorporated into the LitCal engine)'),
    /** translators: tooltip explaining wider region association */
    /** translators: tooltip of the wider regions of a national calendar */
    'Tooltip - Wider regions association'             => _('The wider regions whose data this national calendar inherits. Only the wider regions that list this nation are offered.'),

    // =========================================================================
    // Navigation/accessibility labels
    // =========================================================================
    /** translators: screen reader text for previous button */
    'Previous'                                        => _('Previous'),
    /** translators: screen reader text for next button */
    'Next'                                            => _('Next'),
    /** translators: aria-label for diocesan calendar definition navigation */
    'Diocesan calendar definition'                    => _('Diocesan calendar definition'),
];

// phpcs:enable Generic.Files.LineLength
