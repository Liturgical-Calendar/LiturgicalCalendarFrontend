# Editing a National Calendar

This guide explains how to modify an existing national calendar, including updating settings, adding events,
and managing translations.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Existing Calendar** - The national calendar must already exist

## Accessing an Existing Calendar

1. Navigate to `/extending.php?choice=national`
2. In the **National Calendar** field, select the country you want to edit
3. The existing data will load automatically

## Identifying Edit vs. Create Mode

When you select an existing national calendar:

- Settings fields will populate with existing values
- Event rows will display existing liturgical events
- The save operation uses **PATCH** (update) instead of **PUT** (create)
- The **Remove existing data** button will become enabled

## Editing Operations

### Modifying Calendar Settings

1. **Epiphany** - Change when Epiphany is celebrated
2. **Ascension** - Change when Ascension is celebrated
3. **Corpus Christi** - Change when Corpus Christi is celebrated
4. **Eternal High Priest** - Toggle this feast on/off

Changes to settings take effect for all future calendar generations.

### Managing Locales

#### Adding a Locale

1. In **Locales**, select additional languages to support
2. Switch **Current Localization** to the new locale
3. Enter translations for all event names
4. Save the calendar

#### Removing a Locale

1. Deselect the locale from **Locales**
2. Save the calendar

> **Warning:** Removing a locale deletes all translations for that language.

### Managing Roman Missals

#### Adding a Missal

1. Click **Add Missal**
2. Select from available Missals
3. Click **Add language edition Roman Missal**
4. Save the calendar

#### Removing a Missal

1. Find the Missal in the Published Roman Missals list
2. Click the remove button next to it
3. Save the calendar

### Changing Wider Region Association

1. In the **Wider Region** field, select a different region or clear it
2. Save the calendar

The national calendar will now inherit events from the new wider region (or no wider region events if cleared).

### Modifying Existing Events

1. Locate the event row in the form
2. Update fields as needed:
   - **Name** - Edit the display name
   - **Day/Month** - Change the date
   - **Grade** - Modify celebration grade
   - **Liturgical Color** - Update colors
   - **Common** - Change the common
   - **Since/Until** - Adjust year range

3. Save the calendar

### Adding New Events

Use the action buttons to add new events (same as creation):

- **Designate patron** - Add a national patron
- **Change name or grade** - Modify an existing General Roman Calendar event
- **Move liturgical event** - Change the date of an event
- **Create new liturgical event** - Add a completely new event

### Removing Events

1. Find the event row you want to remove
2. Click the **Remove** button (trash icon)
3. The row will be removed from the form
4. Save the calendar

## Editing Translations

To provide translations for different languages:

1. Ensure all target locales are selected in **Locales**
2. Change **Current Localization** to the target language
3. The form will show event names in that locale (or empty if not yet translated)
4. Enter or update the translations
5. Repeat for each locale
6. Save the calendar

## Form Behavior on Edit

| Field                | Behavior                                         |
|----------------------|--------------------------------------------------|
| National Calendar    | Read-only (identifies the calendar being edited) |
| Settings             | Can be modified                                  |
| Locales              | Can add or remove                                |
| Current Localization | Can switch for translation editing               |
| Roman Missals        | Can add or remove                                |
| Wider Region         | Can change or clear                              |
| Event rows           | Can modify, add, or remove                       |

## API Request

When editing, the system sends a **PATCH** request:

```text
PATCH /data?category=nation&key={country_iso}
```

## Example: Adding Spanish Support to USA Calendar

1. Navigate to `/extending.php?choice=national`
2. Select **US** from the dropdown (existing data loads)
3. In **Locales**, add `es_US` if not already present
4. Change **Current Localization** to `es_US`
5. Enter Spanish translations for all event names
6. Click **Save National Calendar Data**

## Example: Changing Ascension to Sunday

1. Access the USA national calendar
2. Change **Ascension** setting from Thursday to Sunday
3. Click **Save National Calendar Data**

## Troubleshooting

### Changes Not Persisting

- Verify you're authenticated
- Check for validation errors in the form
- Look for error messages in the browser console

### Translations Not Showing

- Ensure the locale is selected in **Locales**
- Make sure **Current Localization** is set to the correct locale
- Save and refresh the page

### Can't Remove an Event

Some events may be inherited from:

- The General Roman Calendar (cannot be removed, only modified)
- A Wider Region calendar (must be removed there instead)

### Missal Changes Not Reflected

- The Missal must be incorporated into the API
- Clear any API caching if applicable
- Regenerate calendars to see changes

## Next Steps

- [Creating a National Calendar](national-create.md)
- [Deleting a National Calendar](national-delete.md)
- [Back to Calendar Management Guide](index.md)
