# Calendar Management Guide

This guide explains how to create, edit, and delete liturgical calendars using the Liturgical Calendar Frontend.

## Overview

The Liturgical Calendar system supports three types of calendars, organized in a hierarchical structure:

1. **Wider Region Calendars** - Shared liturgical events for geographical/cultural regions (Americas, Europe, etc.)
2. **National Calendars** - Country-specific liturgical events
3. **Diocesan Calendars** - Diocese-specific liturgical events

## Calendar Hierarchy

```text
General Roman Calendar (base)
    └── Wider Region Calendar (optional shared layer)
        └── National Calendar (country layer)
            └── Diocesan Calendar (local layer)
```

Each level inherits from the levels above it. For example, a diocesan calendar includes:

- All events from the General Roman Calendar
- All events from its nation's Wider Region (if applicable)
- All events from its National Calendar
- Its own diocesan-specific events

## Prerequisites

Before creating or editing calendars, you need:

1. **Authentication** - Log in with valid credentials (required for all write operations)
2. **Translations** - Ensure the General Roman Calendar data is translated into the required language(s)
   (see [Translations](../translations.php) page)

## Getting Started

Access the calendar management interface at: `/extending.php`

Choose the calendar type you want to work with:

- [Wider Region Calendar](wider-region-create.md)
- [National Calendar](national-create.md)
- [Diocesan Calendar](diocesan-create.md)

## Documentation Index

### Wider Region Calendar

A Wider Region calendar defines liturgical events shared across multiple countries in a geographical or cultural
region. These are **not standalone calendars** but rather a shared layer that gets applied to national calendars.

- [Creating a Wider Region Calendar](wider-region-create.md)
- [Editing a Wider Region Calendar](wider-region-edit.md)
- [Deleting a Wider Region Calendar](wider-region-delete.md)

**Valid Wider Regions:** Americas, Europe, Asia, Africa, Oceania

### National Calendar

A National calendar defines country-specific liturgical events. It can optionally be associated with a Wider
Region to inherit shared regional events.

- [Creating a National Calendar](national-create.md)
- [Editing a National Calendar](national-edit.md)
- [Deleting a National Calendar](national-delete.md)

### Diocesan Calendar

A Diocesan calendar defines diocese-specific liturgical events. It must be associated with a National calendar
(dioceses depend on their nation's calendar).

- [Creating a Diocesan Calendar](diocesan-create.md)
- [Editing a Diocesan Calendar](diocesan-edit.md)
- [Deleting a Diocesan Calendar](diocesan-delete.md)

## Common Operations

All calendar types support these operations for liturgical events:

| Operation           | Description                                           |
|---------------------|-------------------------------------------------------|
| **Designate Patron**| Add a patron saint for the region/nation/diocese      |
| **Create New Event**| Define a new liturgical event                         |
| **Change Property** | Modify the name or grade of an existing event         |
| **Move Event**      | Change the date of an existing liturgical event       |

> **Note:** Not all operations are available for all calendar types. See the specific documentation for each
> calendar type for details.

## Localization

Each calendar supports multiple locales (language + region combinations). When creating or editing a calendar:

1. **Locales** - Select all supported locales for the calendar
2. **Current Localization** - Choose the locale you're currently editing

Event names and descriptions are stored per-locale, so you can provide translations for all supported languages.
