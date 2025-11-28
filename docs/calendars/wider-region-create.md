# Creating a Wider Region Calendar

A Wider Region calendar defines liturgical events shared across multiple countries in a geographical or cultural
region. These events are automatically applied to all national calendars belonging to the wider region.

## Prerequisites

1. **Authentication** - You must be logged in with valid credentials
2. **Translations** - The General Roman Calendar should be translated into the required language(s)

## Accessing the Form

1. Navigate to `/extending.php`
2. Select **Wider Region** from the calendar type options, or go directly to `/extending.php?choice=widerRegion`

## Step-by-Step Guide

### Step 1: Select or Enter the Wider Region Name

In the **Wider Region** field, select from the available regions:

- **Americas** - North and South American countries
- **Europe** - European countries
- **Asia** - Asian countries
- **Africa** - African countries
- **Oceania** - Oceania countries

> **Important:** You must use one of the valid wider region names listed above. Custom region names are not supported.

If the region already has data, the existing data will be loaded for editing. If not, you'll create a new calendar
for that region.

### Step 2: Configure Locales

1. **Locales** - Select all language/region combinations that should be supported for this wider region calendar.
   For example, for the Americas region, you might select:
   - `en_US` (English - United States)
   - `es_MX` (Spanish - Mexico)
   - `pt_BR` (Portuguese - Brazil)
   - `fr_CA` (French - Canada)

2. **Current Localization** - Choose the locale you're currently working with. Event names will be saved for this
   locale.

### Step 3: Add Liturgical Events

Use the action buttons at the bottom of the form to add events:

#### Designate Patron

Click **Designate patron** to add a patron saint for the wider region:

1. Select an existing liturgical event from the dropdown (type to search)
2. Set the **Since** year (when the patronage was established)
3. Enter the **Decree URL** (link to the official decree document)
4. Configure **Decree Language Mappings** (which languages the decree is available in)
5. Click **Designate patron** to add the event

#### Create New Liturgical Event

Click **Create a new liturgical event** to define a completely new event:

1. Enter the **Event Key** (unique identifier, use PascalCase like `OurLadyOfGuadalupe`)
2. Enter the **Name** (display name in the current locale)
3. Select the **Day** and **Month** for the celebration
4. Choose the **Grade** (Memorial, Feast, Solemnity, etc.)
5. Select the **Liturgical Color(s)**
6. Optionally select **Common(s)** for the saint
7. Set the **Since** year
8. Enter the **Decree URL** and language mappings
9. Click **Create Liturgical Event** to add

### Step 4: Review and Save

1. Review all the events in the form
2. Click **Save Wider Region Calendar Data** at the bottom of the page
3. Wait for the success confirmation

## Form Fields Reference

| Field                    | Required | Description                                                  |
|--------------------------|----------|--------------------------------------------------------------|
| Wider Region             | Yes      | The region name (Americas, Europe, Asia, Africa, Oceania)    |
| Locales                  | Yes      | Supported language/region combinations                       |
| Current Localization     | Yes      | The locale being edited                                      |
| Event Key                | Yes      | Unique identifier for the event (PascalCase)                 |
| Name                     | Yes      | Display name in the current locale                           |
| Day                      | Yes      | Day of the month (1-31)                                      |
| Month                    | Yes      | Month of the year (January-December)                         |
| Grade                    | Yes      | Celebration grade (Memorial, Optional Memorial, Feast, etc.) |
| Liturgical Color         | Yes      | Color(s) for the celebration                                 |
| Common                   | No       | Common of saints category                                    |
| Since                    | Yes      | Year from which this event takes effect                      |
| Until                    | No       | Year until which this event applies (leave empty if ongoing) |
| Decree URL               | Yes      | URL to the official decree document                          |
| Decree Language Mappings | Yes      | Languages the decree is available in                         |

## Available Actions

For wider region calendars, the following actions are supported:

| Action            | Description                                    |
|-------------------|------------------------------------------------|
| `makePatron`      | Designate an existing saint as patron          |
| `createNew`       | Create a completely new liturgical event       |

> **Note:** The `setProperty` and `moveFeast` actions are **not available** for wider region calendars. These
> actions are only supported by national calendars.

## Example: Creating the Americas Wider Region Calendar

1. Select **Americas** from the Wider Region dropdown
2. In Locales, select: `en_US`, `es_MX`, `pt_BR`, `fr_CA`
3. Set Current Localization to `en_US`
4. Click **Designate patron** button
5. Search for and select "Our Lady of Guadalupe"
6. Set Since year to the year the patronage was established
7. Enter the decree URL
8. Click **Designate patron**
9. Click **Save Wider Region Calendar Data**

## Troubleshooting

### "Invalid wider region name" Error

You must use one of the predefined wider region names. Custom names are not allowed.

### "i18n validation error" Error

Ensure that:

1. You have selected at least one locale in the Locales field
2. The Current Localization matches one of the selected locales
3. Event names are provided for all selected locales

### Save Button Disabled

The save button is disabled until:

1. You have selected a valid wider region
2. You have selected at least one locale
3. You have added at least one liturgical event

## Next Steps

- [Editing a Wider Region Calendar](wider-region-edit.md)
- [Deleting a Wider Region Calendar](wider-region-delete.md)
- [Back to Calendar Management Guide](index.md)
