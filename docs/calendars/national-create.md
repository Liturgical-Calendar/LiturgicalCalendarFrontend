# Creating a National Calendar

A National calendar defines country-specific liturgical events that extend the General Roman Calendar. It can
optionally inherit events from a Wider Region calendar.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Translations** - The General Roman Calendar must be translated into the required language(s)
   (see [Translations](../translations.php) page)
3. **Wider Region (optional)** - If the nation belongs to a wider region with shared events, create that first

## Accessing the Form

1. Navigate to `/extending.php`
2. Select **National** from the calendar type options, or go directly to `/extending.php?choice=national`

## Step-by-Step Guide

### Step 1: Select or Enter the Nation

In the **National Calendar** field:

1. Start typing the country name or ISO code
2. Select from the dropdown list of available countries
3. The country's ISO code (e.g., `US`, `IT`, `DE`) will be used as the calendar identifier

If the nation already has calendar data, it will be loaded for editing. Otherwise, you'll create a new calendar.

### Step 2: Configure National Calendar Settings

#### Epiphany Setting

Choose when Epiphany is celebrated:

- **January 6** - Fixed date celebration
- **Sunday between January 2 and January 8** - Transferred to Sunday

#### Ascension Setting

Choose when Ascension is celebrated:

- **Thursday** - Traditional Thursday celebration (40 days after Easter)
- **Sunday** - Transferred to Sunday (7th Sunday of Easter)

#### Corpus Christi Setting

Choose when Corpus Christi (Body and Blood of Christ) is celebrated:

- **Thursday** - Traditional Thursday celebration
- **Sunday** - Transferred to Sunday

#### Eternal High Priest

Toggle whether the Feast of Jesus Christ Eternal High Priest is celebrated:

- **Enabled** - Celebrated on Thursday after Pentecost
- **Disabled** - Not celebrated

> **Note:** This feast was authorized by Pope Benedict XVI in 2012 for Episcopal Conferences to optionally include.

### Step 3: Configure Locales

1. **Locales** - Select all language/region combinations supported by this national calendar.
   For example, for Canada, you might select:
   - `en_CA` (English - Canada)
   - `fr_CA` (French - Canada)

2. **Current Localization** - Choose the locale you're currently editing. The event name entered in the main
   Name field will be saved for this locale. If you have selected multiple locales, you must also fill in the
   event name for each additional locale in the corresponding translation fields that appear below the main
   Name field.

   > **Note:** If you change the Current Localization after entering localized names, the fields will be
   > reordered so that the newly selected locale becomes the main Name field, and the previous locale moves
   > to the translation fields below.

### Step 4: Add Published Roman Missals (Optional)

If a language edition of the Roman Missal for this nation has been incorporated into the LitCal engine:

1. Click **Add Missal**
2. Select the Missal from the dropdown
3. Click **Add language edition Roman Missal**

This associates the Missal's proper of saints with the national calendar.

### Step 5: Associate Wider Region (Optional)

If this nation belongs to a wider region with shared events:

1. In the **Wider Region** field, select the region (e.g., Americas, Europe)
2. The wider region's events will be inherited by this national calendar

### Step 6: Add Liturgical Events

Use the action buttons to add events:

#### Designate Patron

Click **Designate patron** to add a national patron saint:

1. Select an existing liturgical event from the dropdown
2. Set the **Since** year
3. Enter the **Decree URL**
4. Configure decree language mappings

#### Change Name or Grade (Set Property)

Click **Change name or grade of existing liturgical event** to modify an existing event:

1. Select the liturgical event to modify
2. Choose whether to change the **Name**, **Grade**, or both
3. Enter the new values
4. Set the **Since** year and decree information

#### Move Liturgical Event

Click **Move liturgical event to new date** to change when an event is celebrated:

1. Select the liturgical event to move
2. Enter the new **Day** and **Month**
3. Optionally specify a **Reason** (existing event that takes precedence)
4. Set the **Since** year and decree information

#### Create New Liturgical Event

Click **Create a new liturgical event** to define a completely new event:

1. Enter the **Event Key** (unique identifier)
2. Enter the **Name**
3. Set the **Day** and **Month**
4. Choose the **Grade**
5. Select **Liturgical Color(s)**
6. Optionally select **Common(s)**
7. Set the **Since** year and decree information

### Step 7: Review and Save

1. Review all settings and events
2. Click **Save National Calendar Data**
3. Wait for the success confirmation

## Form Fields Reference

### Settings

| Field                   | Required | Description                            |
|-------------------------|----------|----------------------------------------|
| National Calendar       | Yes      | Country ISO code (e.g., US, IT, DE)    |
| Epiphany                | No       | When Epiphany is celebrated            |
| Ascension               | No       | When Ascension is celebrated           |
| Corpus Christi          | No       | When Corpus Christi is celebrated      |
| Eternal High Priest     | No       | Whether this feast is celebrated       |
| Locales                 | Yes      | Supported language/region combinations |
| Current Localization    | Yes      | The locale being edited                |
| Published Roman Missals | No       | Associated Missal editions             |
| Wider Region            | No       | Associated wider region (if any)       |

### Event Fields

| Field                    | Required | Description                                          |
|--------------------------|----------|------------------------------------------------------|
| Event Key                | Yes      | Unique identifier (PascalCase)                       |
| Name                     | Yes      | Display name in current locale                       |
| Day                      | Yes      | Day of the month (1-31)                              |
| Month                    | Yes      | Month (January-December)                             |
| Grade                    | Yes      | Celebration grade                                    |
| Liturgical Color         | Yes      | Color(s) for the celebration                         |
| Common                   | No       | Common of saints category                            |
| Since                    | Yes      | Year from which this takes effect                    |
| Until                    | No       | Year until which this applies                        |
| Decree URL               | Yes      | URL to official decree                               |
| Decree Language Mappings | Yes      | Languages the decree is available in                 |

## Available Actions

National calendars support all action types:

| Action           | Description                                           |
|------------------|-------------------------------------------------------|
| `makePatron`     | Designate an existing saint as national patron        |
| `setProperty`    | Change the name or grade of an existing event         |
| `moveFeast`      | Move an event to a different date                     |
| `createNew`      | Create a completely new liturgical event              |
| `makeDoctor`     | Designate a saint as Doctor of the Church             |

## Example: Creating the USA National Calendar

1. Select **US** from the National Calendar dropdown
2. Configure settings:
   - Epiphany: Sunday between January 2-8
   - Ascension: Sunday
   - Corpus Christi: Sunday
   - Eternal High Priest: Disabled
3. In Locales, select: `en_US`, `es_US`
4. Set Current Localization to `en_US`
5. Associate with **Americas** wider region
6. Add patron saints and national events
7. Click **Save National Calendar Data**

## Troubleshooting

### "This value cannot be empty" Error

Ensure the National Calendar field contains a valid country ISO code from the dropdown list.

### Settings Not Saving

- Verify you've selected valid options for Epiphany, Ascension, and Corpus Christi
- Ensure at least one locale is selected

### Save Button Disabled

The save button requires:

1. A valid national calendar (country) selected
2. At least one locale selected
3. Valid settings configured

### Missal Not in List

If a Missal edition isn't available in the dropdown, it hasn't been incorporated into the LitCal engine yet.
Contact the API curator to request addition.

## Next Steps

- [Editing a National Calendar](national-edit.md)
- [Deleting a National Calendar](national-delete.md)
- [Back to Calendar Management Guide](index.md)
