# Creating a Diocesan Calendar

A Diocesan calendar defines liturgical events specific to a diocese. It inherits from the General Roman Calendar,
any applicable Wider Region calendar, and its parent National calendar.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **National Calendar** - The parent national calendar must exist
3. **Translations** - Required languages should be available in the system

## Accessing the Form

1. Navigate to `/extending.php`
2. Select **Diocesan** from the calendar type options, or go directly to `/extending.php?choice=diocesan`

## Step-by-Step Guide

### Step 1: Select the National Calendar Dependency

In the **Depends on national calendar** dropdown:

1. Select the nation this diocese belongs to
2. The diocese will inherit all events from this national calendar

> **Note:** The national calendar must already exist. If it doesn't, create it first.

### Step 2: Enter the Diocese Name

In the **Diocese** field:

1. Start typing the diocese name
2. Select from the autocomplete list if the diocese exists in the database
3. Or enter a new diocese name if it's not listed

The diocese identifier will be generated from the name (e.g., "Archdiocese of Boston" becomes `BOSTON`).

### Step 3: Select Diocesan Group (Optional)

In the **Diocesan group** field:

1. Select an existing group if the diocese belongs to one
2. Or enter a new group name to create one
3. Leave empty if the diocese doesn't belong to a group

> **What is a Diocesan Group?** A group of dioceses that pool their Liturgical Calendar data, for example,
> to print a single yearly calendar for all dioceses in the group.

### Step 4: Configure Locales

1. **Locales** - Select all language/region combinations supported by this diocesan calendar
2. **Current Localization** - Choose the locale you're currently editing

### Step 5: Set Timezone

Select the diocese's **Timezone** from the dropdown. This affects date calculations for liturgical events.

### Step 6: Define Liturgical Events by Grade

The diocesan calendar form uses a carousel with four sections, one for each celebration grade:

#### Solemnities Tab

Define high-ranking solemnities:

1. **Principal Patron(s)** - The patron saint(s) of the diocese (Solemnity rank)
2. **Dedication of the Cathedral** - The cathedral dedication anniversary
3. **Other Solemnity** - Any other solemnity specific to the diocese

For each event row:

- **Event Key** - Unique identifier (or select existing)
- **Name** - Display name in current locale
- **Day/Month** - Date of celebration
- **Since** - Year from which this event applies
- **Until** - Year until which this event applies (optional)

Click the **+** button to add more solemnity rows.

#### Feasts Tab

Define feast-rank celebrations:

1. **Patron(s)** - Patron at Feast rank
2. **Dedication of the Cathedral** - If celebrated as Feast
3. **Other Feast** - Other feasts specific to the diocese

#### Memorials Tab

Define obligatory memorials:

1. **Secondary Patron(s)** - Secondary patrons of the diocese
2. **Other Memorial** - Other obligatory memorials

#### Optional Memorials Tab

Define optional memorials:

1. **Saints with local veneration** - Saints venerated locally in the diocese
2. **Other Optional Memorial** - Other optional celebrations

### Step 7: Configure Diocesan Overrides (Optional)

If the diocese has different settings than the national calendar for mobile feasts:

1. **Epiphany** - Override when Epiphany is celebrated
2. **Ascension** - Override when Ascension is celebrated
3. **Corpus Christi** - Override when Corpus Christi is celebrated

Leave these empty to use the national calendar settings.

### Step 8: Save the Calendar

1. Review all entries in each tab
2. Click **SAVE DIOCESAN CALENDAR**
3. Wait for the success confirmation

## Form Fields Reference

### Settings

| Field                       | Required | Description                                    |
|-----------------------------|----------|------------------------------------------------|
| Depends on national calendar| Yes      | Parent national calendar                       |
| Diocese                     | Yes      | Diocese name                                   |
| Diocesan group              | No       | Group for pooling calendar data                |
| Locales                     | Yes      | Supported languages                            |
| Current Localization        | Yes      | Language being edited                          |
| Timezone                    | Yes      | Diocese timezone                               |

### Event Fields

| Field      | Required | Description                               |
|------------|----------|-------------------------------------------|
| Event Key  | Yes      | Unique identifier for the event           |
| Name       | Yes      | Display name in current locale            |
| Day        | Yes      | Day of the month (1-31)                   |
| Month      | Yes      | Month (January-December)                  |
| Since      | Yes      | Year from which event takes effect        |
| Until      | No       | Year until which event applies            |

### Override Settings

| Field         | Required | Description                              |
|---------------|----------|------------------------------------------|
| Epiphany      | No       | Override national Epiphany setting       |
| Ascension     | No       | Override national Ascension setting      |
| Corpus Christi| No       | Override national Corpus Christi setting |

## Available Actions

Diocesan calendars support these actions:

| Action        | Description                                   |
|---------------|-----------------------------------------------|
| `makePatron`  | Designate a saint as diocesan patron          |
| `createNew`   | Create a new liturgical event                 |

> **Note:** The `setProperty` and `moveFeast` actions are **not available** for diocesan calendars.
> These are only supported by national calendars.

## Example: Creating the Boston Diocesan Calendar

1. Navigate to `/extending.php?choice=diocesan`
2. Select **United States** from national calendar dropdown
3. Enter **Boston** in the Diocese field
4. Leave Diocesan group empty (or select if applicable)
5. In Locales, select `en_US`
6. Set Current Localization to `en_US`
7. Select timezone: **America/New_York**
8. In Solemnities tab:
   - Add principal patron
   - Add cathedral dedication date
9. Navigate through Feasts, Memorials, Optional Memorials tabs to add events
10. Configure any diocesan overrides if needed
11. Click **SAVE DIOCESAN CALENDAR**

## Navigation Between Tabs

Use the carousel navigation:

- **Pagination links** at the top (Solemnities, Feasts, Memorials, Optional memorials)
- **Arrow buttons** on the sides to move between tabs
- **Keyboard navigation** may also be supported

## Troubleshooting

### "Diocese does not seem to exist" Warning

This is informational - you can still create a calendar for a diocese not in the database. The system will
create a new entry.

### "This value cannot be empty" Error

Ensure required fields are filled:

- National calendar dependency must be selected
- Diocese name must be entered
- At least one locale must be selected

### Save Button Not Working

- Verify you're authenticated
- Check all required fields are filled
- Look for validation errors in the form

### Cannot Select National Calendar

- Ensure national calendars exist in the system
- The dropdown only shows nations with defined calendars

### Timezone Not Available

The timezone dropdown should populate automatically. If empty:

- Refresh the page
- Check browser console for errors

## Understanding the Carousel

The diocesan form uses a Bootstrap carousel to organize events by grade:

1. **Slide 1** - Solemnities (highest rank)
2. **Slide 2** - Feasts
3. **Slide 3** - Memorials
4. **Slide 4** - Optional Memorials (lowest rank)

Each slide can contain multiple event rows. Use the **+** button to add more rows within each section.

## Next Steps

- [Editing a Diocesan Calendar](diocesan-edit.md)
- [Deleting a Diocesan Calendar](diocesan-delete.md)
- [Back to Calendar Management Guide](index.md)
