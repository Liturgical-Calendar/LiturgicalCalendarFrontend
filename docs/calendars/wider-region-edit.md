# Editing a Wider Region Calendar

This guide explains how to modify an existing wider region calendar, including adding, updating, or removing
liturgical events.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Existing Calendar** - The wider region calendar must already exist

## Accessing an Existing Calendar

1. Navigate to `/extending.php?choice=widerRegion`
2. In the **Wider Region** field, select the region you want to edit from the dropdown
3. The existing data will be loaded automatically

## Identifying Edit vs. Create Mode

When you select an existing wider region:

- The form will populate with existing events
- The save operation will use **PATCH** (update) instead of **PUT** (create)
- The **Remove existing data** button will become enabled

## Editing Operations

### Modifying Existing Events

1. Locate the event row in the form
2. Update the fields as needed:
   - **Name** - Change the display name (for current locale)
   - **Day/Month** - Modify the celebration date
   - **Grade** - Change the celebration grade
   - **Liturgical Color** - Update the color(s)
   - **Common** - Modify the common of saints
   - **Since/Until** - Adjust the year range

3. Click **Save Wider Region Calendar Data** to save changes

### Adding New Events

Use the same process as creating events (see [Creating a Wider Region Calendar](wider-region-create.md)):

1. Click **Designate patron** or **Create a new liturgical event**
2. Fill in the event details
3. Click the action button to add the event
4. Click **Save Wider Region Calendar Data**

### Removing Events

To remove a liturgical event from the calendar:

1. Locate the event row in the form
2. Click the **Remove** button (trash icon) on that row
3. The row will be removed from the form
4. Click **Save Wider Region Calendar Data** to persist the removal

## Changing Locales

### Adding a New Locale

1. In the **Locales** multi-select, add the new locale
2. Change **Current Localization** to the new locale
3. Update event names for the new locale
4. Save the calendar

### Removing a Locale

1. In the **Locales** multi-select, remove the locale
2. Save the calendar

> **Warning:** Removing a locale will delete all translations for that locale.

### Editing Translations

To edit event names in different languages:

1. Change the **Current Localization** dropdown to the target locale
2. Update the event names in the form
3. Repeat for each locale you need to update
4. Save the calendar

## Form Behavior on Edit

| Field                | Behavior                                         |
|----------------------|--------------------------------------------------|
| Wider Region         | Read-only (identifies the calendar being edited) |
| Locales              | Can add or remove locales                        |
| Current Localization | Can switch to edit different language versions   |
| Event rows           | Can modify, add, or remove                       |

## API Request

When editing, the system sends a **PATCH** request to the API with only the changed data:

```text
PATCH /data?category=widerregion&key={region_name}
```

## Example: Adding a New Event to Americas

1. Navigate to `/extending.php?choice=widerRegion`
2. Select **Americas** from the dropdown (existing data loads)
3. Click **Create a new liturgical event**
4. Fill in the new event details
5. Click **Create Liturgical Event**
6. Click **Save Wider Region Calendar Data**

## Troubleshooting

### Changes Not Saving

- Ensure you're authenticated (log in again if needed)
- Check the browser console for error messages
- Verify the API is running and accessible

### Locale Changes Not Reflected

- Make sure you saved after changing locales
- Try refreshing the page after saving
- Verify the locale is properly selected in both Locales and Current Localization

### Event Names Not Updating

- Confirm you've selected the correct Current Localization
- Ensure the event key matches the existing event
- Save the calendar and refresh to verify

## Next Steps

- [Creating a Wider Region Calendar](wider-region-create.md)
- [Deleting a Wider Region Calendar](wider-region-delete.md)
- [Back to Calendar Management Guide](index.md)
