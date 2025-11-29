# Editing a Diocesan Calendar

This guide explains how to modify an existing diocesan calendar, including updating events, settings, and
translations.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Existing Calendar** - The diocesan calendar must already exist

## Accessing an Existing Calendar

1. Navigate to `/extending.php?choice=diocesan`
2. Select the **National Calendar** the diocese depends on
3. In the **Diocese** field, select the diocese from the autocomplete list
4. The existing data will load automatically

## Identifying Edit vs. Create Mode

When you select an existing diocesan calendar:

- Event rows will populate with existing data
- Settings fields will show current values
- The **Remove existing data** button will become enabled
- The save operation uses **PATCH** (update) instead of **PUT** (create)

## Editing Operations

### Modifying Settings

#### Changing Diocesan Group

1. In the **Diocesan group** field, select a different group
2. Or enter a new group name
3. Or clear the field to remove group association
4. Save the calendar

#### Changing Locales

**Adding a locale:**

1. In **Locales**, select additional languages
2. Switch **Current Localization** to the new locale
3. Enter translations for event names
4. Save the calendar

**Removing a locale:**

1. Deselect the locale from **Locales**
2. Save the calendar

> **Warning:** Removing a locale deletes all translations for that language.

#### Changing Timezone

1. Select a different timezone from the dropdown
2. Save the calendar

### Modifying Existing Events

Navigate to the appropriate tab (Solemnities, Feasts, Memorials, Optional Memorials) and:

1. Locate the event row to modify
2. Update fields as needed:
   - **Event Key** - Change the identifier
   - **Name** - Edit the display name (for current locale)
   - **Day/Month** - Change the celebration date
   - **Since** - Modify the start year
   - **Until** - Set or change the end year

3. Save the calendar

### Adding New Events

1. Navigate to the appropriate tab for the event's grade
2. Click the **+** button to add a new row
3. Fill in the event details
4. Save the calendar

### Removing Events

1. Locate the event row to remove
2. Click the **Remove** button on that row
3. The row will be removed from the form
4. Save the calendar

### Updating Diocesan Overrides

To change how mobile feasts are celebrated in this diocese:

1. Scroll to the **Diocesan overrides** section
2. Update **Epiphany**, **Ascension**, or **Corpus Christi** settings
3. Leave empty to inherit from national calendar
4. Save the calendar

## Editing Translations

To provide translations in different languages:

1. Ensure all target locales are selected in **Locales**
2. Change **Current Localization** to the target language
3. Navigate through all tabs and update event names
4. Repeat for each locale
5. Save the calendar

## Form Behavior on Edit

| Field                        | Behavior                                         |
|------------------------------|--------------------------------------------------|
| Depends on national calendar | Can be changed (affects inheritance)             |
| Diocese                      | Read-only (identifies the calendar being edited) |
| Diocesan group               | Can be modified                                  |
| Locales                      | Can add or remove                                |
| Current Localization         | Can switch for translation editing               |
| Timezone                     | Can be changed                                   |
| Event rows                   | Can modify, add, or remove                       |
| Diocesan overrides           | Can be set or cleared                            |

## Changing National Calendar Dependency

If you need to change which national calendar a diocese depends on:

1. Select the new national calendar from the dropdown
2. The diocese will now inherit from the new nation
3. Save the calendar

> **Caution:** This is a significant change that affects all inherited events. Use carefully.

## API Request

When editing, the system sends a **PATCH** request:

```text
PATCH /data?category=diocesan&nation={nation_iso}&diocese={diocese_id}
```

## Example: Adding a New Memorial to Boston

1. Navigate to `/extending.php?choice=diocesan`
2. Select **United States** from national calendar
3. Select **Boston** from diocese dropdown (data loads)
4. Click on **Memorials** tab in the carousel
5. Click the **+** button to add a new row
6. Enter the memorial details:
   - Event Key: `StPatrickOfBoston`
   - Name: St. Patrick
   - Day: 17
   - Month: March
   - Since: 2024
7. Click **SAVE DIOCESAN CALENDAR**

## Example: Adding Spanish Translations

1. Access the diocesan calendar
2. In **Locales**, add `es_US` if not present
3. Change **Current Localization** to `es_US`
4. Navigate through all carousel tabs
5. Enter Spanish translations for each event name
6. Click **SAVE DIOCESAN CALENDAR**

## Troubleshooting

### Changes Not Saving

- Verify authentication status
- Check for form validation errors
- Look at browser console for error messages

### Cannot Find Diocese

- Make sure the correct national calendar is selected
- The diocese must exist in the system
- Try typing the full name

### Events Not Appearing in Correct Tab

Events are organized by grade:

- Solemnities are on tab 1
- Feasts are on tab 2
- Memorials are on tab 3
- Optional Memorials are on tab 4

If an event is in the wrong tab, remove it and add it to the correct one.

### Override Settings Not Taking Effect

- Ensure you selected a valid option (not left blank)
- Save the calendar
- Clear any caching on the API side

### Translations Not Showing

- Confirm the locale is in the **Locales** list
- Switch **Current Localization** to the target locale
- Some fields may not support per-locale values

## Next Steps

- [Creating a Diocesan Calendar](diocesan-create.md)
- [Deleting a Diocesan Calendar](diocesan-delete.md)
- [Back to Calendar Management Guide](index.md)
