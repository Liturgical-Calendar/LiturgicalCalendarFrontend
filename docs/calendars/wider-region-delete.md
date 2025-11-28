# Deleting a Wider Region Calendar

This guide explains how to delete an existing wider region calendar and all its associated data.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Existing Calendar** - The wider region calendar must already exist

> **Warning:** Deleting a wider region calendar is **permanent** and cannot be undone. All liturgical events and
> translations defined for the wider region will be removed.

## Impact of Deletion

Before deleting, understand the impact:

- All liturgical events defined for the wider region will be removed
- All translations (i18n) for the wider region will be deleted
- National calendars associated with this wider region will no longer inherit its events
- The calendar will no longer be available in client applications

## Step-by-Step Guide

### Step 1: Access the Calendar

1. Navigate to `/extending.php?choice=widerRegion`
2. In the **Wider Region** field, select the region you want to delete
3. The existing data will load, and the **Remove existing data** button will become enabled

### Step 2: Initiate Deletion

1. Click the **Remove existing data** button (red button with trash icon)
2. A confirmation modal will appear

### Step 3: Confirm Deletion

The confirmation modal will display:

> "If you choose to delete this calendar, the liturgical events defined for the calendar and the corresponding
> index entries will be removed and no longer available in the client applications."

1. Review the warning message
2. Click **Confirm** to proceed with deletion
3. Or click **Cancel** to abort

### Step 4: Verify Deletion

After successful deletion:

1. You'll receive a success notification
2. The form will reset
3. The wider region will no longer appear in the dropdown (if it has no more data)

## API Request

The deletion sends a **DELETE** request to the API:

```text
DELETE /data?category=widerregion&key={region_name}
```

## What Gets Deleted

| Data Type           | Deleted |
|---------------------|---------|
| Liturgical events   | Yes     |
| Event translations  | Yes     |
| Metadata            | Yes     |
| Locale associations | Yes     |

## What Is NOT Deleted

- National calendars that were associated with the wider region (they remain but lose inherited events)
- The General Roman Calendar base data
- Any other wider region calendars

## Recovering from Accidental Deletion

If you accidentally delete a wider region calendar:

1. **Contact the system administrator** - Calendar data is stored in version-controlled JSON files on the server.
   An administrator can restore the deleted calendar from the git repository history.
2. **If you have a local backup** - Restore from your backup
3. **Otherwise** - You'll need to recreate the calendar manually

> **Note:** Since all calendar definitions are version-controlled in the API's git repository, deletions can be
> undone by a system administrator using git commands to restore the deleted files.

## Troubleshooting

### Delete Button Disabled

The **Remove existing data** button is disabled when:

- No wider region is selected
- The selected region has no existing data
- You're not authenticated

### Deletion Failed

If the deletion fails:

1. Check that you're authenticated
2. Verify the API is running
3. Check the browser console for error messages
4. Try refreshing the page and attempting again

### National Calendars Still Show Wider Region Events

After deleting a wider region:

1. National calendars may cache the wider region data
2. Clear the API cache if applicable
3. Refresh the national calendar data

## Next Steps

- [Creating a Wider Region Calendar](wider-region-create.md)
- [Editing a Wider Region Calendar](wider-region-edit.md)
- [Back to Calendar Management Guide](index.md)
