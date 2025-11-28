# Deleting a National Calendar

This guide explains how to delete an existing national calendar and all its associated data.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Existing Calendar** - The national calendar must already exist

> **Warning:** Deleting a national calendar is **permanent** and cannot be undone. All liturgical events,
> settings, and translations will be removed.

## Impact of Deletion

Before deleting, understand the impact:

- All liturgical events specific to the nation will be removed
- All translations (i18n) for the national calendar will be deleted
- All calendar settings (Epiphany, Ascension, etc.) will be lost
- **Diocesan calendars** that depend on this national calendar will be affected
- The calendar will no longer be available in client applications

### Effect on Diocesan Calendars

Diocesan calendars depend on national calendars. If you delete a national calendar:

- Diocesan calendars for that nation may become invalid
- They will lose inherited national events
- Consider deleting dependent diocesan calendars first, or reassigning them

## Step-by-Step Guide

### Step 1: Review Dependent Calendars

Before deleting, check for diocesan calendars that depend on this national calendar:

1. Note any diocesan calendars that will be affected
2. Consider whether to delete or reassign them first

### Step 2: Access the Calendar

1. Navigate to `/extending.php?choice=national`
2. In the **National Calendar** field, select the country to delete
3. The existing data will load
4. The **Remove existing data** button will become enabled

### Step 3: Initiate Deletion

1. Click the **Remove existing data** button (red button with trash icon)
2. A confirmation modal will appear

### Step 4: Confirm Deletion

The confirmation modal will display:

> "If you choose to delete this calendar, the liturgical events defined for the calendar and the corresponding
> index entries will be removed and no longer available in the client applications."

1. Review the warning message carefully
2. Click **Confirm** to proceed with deletion
3. Or click **Cancel** to abort

### Step 5: Verify Deletion

After successful deletion:

1. You'll receive a success notification
2. The form will reset
3. The national calendar will no longer appear in the dropdown (for existing calendars)

## API Request

The deletion sends a **DELETE** request:

```text
DELETE /data?category=nation&key={country_iso}
```

## What Gets Deleted

| Data Type             | Deleted |
|-----------------------|---------|
| Liturgical events     | Yes     |
| Event translations    | Yes     |
| Calendar settings     | Yes     |
| Locale associations   | Yes     |
| Missal associations   | Yes     |
| Wider region link     | Yes     |

## What Is NOT Deleted

- The General Roman Calendar base data
- Wider region calendars
- Other national calendars
- Diocesan calendars (but they become orphaned)

## Handling Diocesan Calendars

### Option 1: Delete Diocesan Calendars First

1. Go to the diocesan calendar management
2. Delete each diocesan calendar for this nation
3. Then delete the national calendar

### Option 2: Reassign Diocesan Calendars

If dioceses should belong to a different national calendar:

1. Edit each diocesan calendar
2. Change the national dependency
3. Then delete the original national calendar

### Option 3: Leave Diocesan Calendars

If you delete the national calendar without handling diocesan calendars:

- They will become orphaned
- They may cause errors when accessed
- Clean them up later

## Recovering from Accidental Deletion

If you accidentally delete a national calendar:

1. **Contact the system administrator** - Calendar data is stored in version-controlled JSON files on the server.
   An administrator can restore the deleted calendar from the git repository history.
2. **If you have a local backup** - Restore from your backup
3. **Otherwise** - Recreate the calendar manually

> **Note:** Since all calendar definitions are version-controlled in the API's git repository, deletions can be
> undone by a system administrator using git commands to restore the deleted files.

## Troubleshooting

### Delete Button Disabled

The **Remove existing data** button is disabled when:

- No national calendar is selected
- The selected nation has no existing data
- You're not authenticated

### Deletion Failed

If the deletion fails:

1. Check authentication status
2. Verify API is running
3. Check browser console for errors
4. Ensure no dependent calendars are blocking deletion

### Diocesan Calendars Still Reference Deleted National Calendar

After deleting a national calendar:

1. Diocesan calendars may still show in the system
2. They will fail to load properly
3. Delete or update them to resolve

## Best Practices

1. **Backup first** - Export data before any deletion
2. **Handle dependencies** - Address diocesan calendars before deleting national calendars
3. **Double-check** - Verify you're deleting the correct calendar
4. **Communicate** - Inform stakeholders before deleting public calendars

## Next Steps

- [Creating a National Calendar](national-create.md)
- [Editing a National Calendar](national-edit.md)
- [Back to Calendar Management Guide](index.md)
