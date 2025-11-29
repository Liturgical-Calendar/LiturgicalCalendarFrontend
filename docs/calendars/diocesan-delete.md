# Deleting a Diocesan Calendar

This guide explains how to delete an existing diocesan calendar and all its associated data.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Existing Calendar** - The diocesan calendar must already exist

> **Warning:** Deleting a diocesan calendar is **permanent** and cannot be undone. All liturgical events
> and translations defined for the diocese will be removed.

## Impact of Deletion

Before deleting, understand the impact:

- All liturgical events specific to the diocese will be removed
- All translations (i18n) for the diocesan calendar will be deleted
- Diocesan override settings will be lost
- The calendar will no longer be available in client applications

### What Is NOT Affected

- The parent national calendar remains intact
- Other diocesan calendars for the same nation are not affected
- The General Roman Calendar base data is not changed
- Wider region calendar data is preserved

## Step-by-Step Guide

### Step 1: Access the Calendar

1. Navigate to `/extending.php?choice=diocesan`
2. Select the **National Calendar** the diocese depends on
3. In the **Diocese** field, select the diocese to delete
4. The existing data will load
5. The **Remove existing data** button will become enabled

### Step 2: Initiate Deletion

1. Click the **Remove existing data** button (red button with trash icon)
2. A confirmation modal will appear

### Step 3: Confirm Deletion

The confirmation modal will display a warning message:

> "If you choose to delete this diocesan calendar, the liturgical events defined for the calendar and the
> corresponding index entries will be removed and no longer available in the client applications."

1. Read the warning message carefully
2. Click **Confirm** to proceed with deletion
3. Or click **Cancel** to abort

### Step 4: Verify Deletion

After successful deletion:

1. You'll receive a success notification
2. The form will reset
3. The diocese will no longer appear in the dropdown (for that national calendar)

## API Request

The deletion sends a **DELETE** request:

```text
DELETE /data?category=diocesan&nation={nation_iso}&diocese={diocese_id}
```

## What Gets Deleted

| Data Type              | Deleted |
|------------------------|---------|
| Liturgical events      | Yes     |
| Event translations     | Yes     |
| Diocesan group link    | Yes     |
| Diocesan overrides     | Yes     |
| Locale associations    | Yes     |
| Timezone setting       | Yes     |

## What Is NOT Deleted

- Parent national calendar
- Wider region calendars
- Other diocesan calendars
- The diocese entry in the world dioceses database

## Recovering from Accidental Deletion

If you accidentally delete a diocesan calendar:

1. **Contact the system administrator** - Calendar data is stored in version-controlled JSON files on the server.
   An administrator can restore the deleted calendar from the git repository history.
2. **If you have a local backup** - Restore from your backup
3. **Otherwise** - Recreate the calendar manually

> **Note:** Since all calendar definitions are version-controlled in the API's git repository, deletions can be
> undone by a system administrator using git commands to restore the deleted files.

## Troubleshooting

### Delete Button Disabled

The **Remove existing data** button is disabled when:

- No diocese is selected
- The selected diocese has no existing data
- You're not authenticated

### Deletion Failed

If the deletion fails:

1. Verify you're authenticated (log in again if needed)
2. Check that the API is running
3. Look at browser console for error messages
4. Try refreshing the page and attempting again

### Diocese Still Appears in List

After deletion, the diocese may still appear in the autocomplete:

- This is normal - the diocese exists in the world dioceses database
- The calendar data is deleted, not the diocese itself
- Selecting it will show empty data (ready to create a new calendar)

## Best Practices

1. **Backup first** - Export data before deletion
2. **Verify selection** - Double-check you're deleting the correct diocese
3. **Communicate** - Inform stakeholders before deleting public calendars
4. **Consider archiving** - Instead of deleting, you might set an "Until" year on events

## Deleting Multiple Diocesan Calendars

If you need to delete multiple diocesan calendars:

1. Delete them one at a time
2. Select each diocese and delete individually
3. There is no bulk delete functionality

## Example: Deleting the Boston Diocesan Calendar

1. Navigate to `/extending.php?choice=diocesan`
2. Select **United States** from national calendar dropdown
3. Select **Boston** from the diocese dropdown
4. Verify the loaded data is for Boston
5. Click **Remove existing data** (red button)
6. Read the confirmation message
7. Click **Confirm**
8. Verify success notification appears

## Next Steps

- [Creating a Diocesan Calendar](diocesan-create.md)
- [Editing a Diocesan Calendar](diocesan-edit.md)
- [Back to Calendar Management Guide](index.md)
