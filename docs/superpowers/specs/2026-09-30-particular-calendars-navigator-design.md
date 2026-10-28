# Particular calendars navigator

- **Issue:** #66 (region → nation → diocese navigation). The first part of #66, the predefined list of wider regions,
  shipped in #593.
- **Branch:** `feat/particular-calendars-navigator` → `development`

## Goal

One entry point for particular calendars. It shows each user the calendars they can work on, lets them browse the
whole hierarchy of regions, nations and dioceses, and offers the right action on every item: edit, create,
translate, or request access. Two constraints shape it:

- **Governance.** Rights are granted per calendar and do not cascade: a national admin holds no rights on that
  nation's dioceses, and a diocese admin holds none on the nation. So the navigator cannot assume that a user can
  walk from a region down to its dioceses. What a user may _do_ is decided item by item; what they may _see_ is the
  public list of calendars.
- **The hierarchy is not a tree.** A nation can belong to several wider regions (Sweden: Europe and Nordic) or to
  none. The Ambrosian rite has diocesan calendars but no national tier and no regions. A diocesan calendar requires
  its nation's calendar to exist.
- **Two editors per nation.** The sanctorale editor and the national calendar editor have not been unified. A
  nation's data lives in up to two places, edited by two pages, and both are authorised by the same
  `national_calendar:{rite}/{ISO}` grant:
    - its **national calendar** (`extending.php?choice=national`): operations over the calendar, such as `moveEvent`,
      `createNew` and `makePatron`;
    - its **national Missal edition**, the Proper of Saints (`sanctorale.php`): fixed-date entries. It exists only
      where `/missals/{rite}` lists an edition for that nation. Today that is `IT_1983` and `US_2011`.

    Where no Missal data is available, a national calendar is created and maintained with the national calendar editor
    alone, as for the Netherlands.

## Decisions

1. **A hub page with deep links.** `extending.php` with no `choice` becomes the navigator. Every action opens one of
   the three existing forms, deep-linked to the calendar and loaded. The forms themselves do not change.
2. **"My calendars" first, everything browsable.**
    - The default view lists only the calendars the user holds rights on, with their parents greyed for context.
    - A "Show all" toggle shows the full hierarchy, and items without rights offer "Request access".
    - A global admin starts in "Show all".
3. **One sidebar entry.** "Particular Calendars" points to the hub and replaces the three entries (Wider Region,
   National, Diocesan). The dashboard's admin cards point to the hub too.
4. **A breadcrumb on each form** links back to the hub and to the calendars above the current one.
5. **Prefilled access requests.** `permission-requests.php` accepts a scope and calendar in its query string.

## Part 1: data and rights

The hub needs no new API endpoint. Its inputs are:

| Input                             | Source                                                                               | When                           |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| Existing calendars and regions    | `/calendars` `litcal_metadata` (already loaded server-side in extending.php)         | page load                      |
| Prospective regions               | `ProspectiveWiderRegions::all($uiLocale)`                                            | page load                      |
| Nations that can have a calendar  | `CatholicNations::localized($uiLocale)`                                              | page load                      |
| Dioceses that can have a calendar | `assets/data/WorldDiocesesByNation.json` via `loadWorldDioceses()`                   | on first expansion of a nation |
| National Missal editions          | `/missals/{rite}` (`region` = nation code, `missal_id`), fetched server-side         | page load                      |
| The user's rights                 | `AuthHelper::dashboardScopes()` (`is_global_admin`, `admin_scopes`, `editor_scopes`) | page load                      |

The rights are passed to the page as `NavigatorRights`:

```js
{
    isGlobalAdmin: false,
    admin:  { national_calendar: ['roman/IT'], diocesan_calendar: ['roman/torino_it'], wider_region: [] },
    editor: { national_calendar: ['roman/IT'], diocesan_calendar: ['roman/roma_it'],   wider_region: ['roman/europe'] }
}
```

- Ids are kept as the API scopes them: rite-qualified (`roman/IT`, `roman/roma_it`, `ambrosian/lugano_ch`,
  `roman/europe`). `AuthHelper::editableObjectIds()` strips the prefix the same way.
- The server passes only the three calendar object types. The rest of the dashboard scopes (tests, decrees,
  missals…) stay out of the page.
- Admin implies editor, as in the OpenFGA model (`editor` includes `admin`).
- The same national grant covers the nation's Missal edition. The sanctorale editor gates each action: `PATCH`
  requires editor, and `PUT`/`DELETE` require admin (`OpenFgaAuthorizationMiddleware::forMissals()`, see the
  sanctorale editor phase 4 spec).
- A national editor may **translate** a region their nation belongs to (declared in `wider_regions` or listed in
  the region's roster). `widerRegionEditRights.js` already decides this; the navigator reuses it.

## Part 2: the tree model (`assets/js/particularCalendarsTree.js`)

A pure module with no DOM and no fetching, fully unit-tested.

- `buildNavigatorTree({ metadata, prospectiveRegions, nations, dioceses, rights, uiLocale })` returns
  `NavigatorNode[]`:

    ```js
    /** @typedef {{
     *   kind: 'region'|'nation'|'diocese'|'group',
     *   id: string,            // region id, ISO nation code, or rite-qualified diocese id; group ids: 'no-region', 'ambrosian'
     *   label: string,
     *   exists: boolean,
     *   actions: Array<'edit'|'create'|'translate'|'request'>,
     *   disabledReason?: string, // e.g. 'nation-missing' for a diocese whose nation has no calendar
     *   mine: boolean,         // the user holds rights on this node
     *   missals?: string[],  // nation nodes: the national Missal editions `/missals` lists for it (e.g. ['IT_1983'])
     *   children: NavigatorNode[],
     *   childrenPending?: boolean // dioceses not loaded yet
     * }} NavigatorNode */
    ```

- **Structure:**
    - The regions come first: existing regions from metadata, then prospective ones not yet created, sorted by label.
        - Under each region are its member nations: the region's `roster`, or `national_calendars` for an older API.
            - Under each nation are its dioceses: the created diocesan calendars of that nation from metadata, plus the
              not-yet-created dioceses of the nation once `dioceses` is loaded for it.
    - Then a group of nations that belong to no region (`no-region`).
    - Then an `ambrosian` group holding the Ambrosian diocesan calendars.
    - A nation belonging to several regions appears under each of them.
- **Actions, per node:**

    | Action       | When it is offered                                                                                                                                                                                            |
    | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `edit`       | the calendar exists and the user is editor or admin on it, or is a global admin                                                                                                                               |
    | `create`     | the calendar does not exist and the user is admin on it, or is a global admin. A diocese whose nation has no national calendar gets `create` with `disabledReason: 'nation-missing'` (Roman rite only)        |
    | `sanctorale` | a nation with at least one national Missal edition, when the user is editor or admin on its `national_calendar`, or is a global admin. The nation's calendar need not exist: the edition is edited on its own |
    | `translate`  | an existing region the user may not edit as a whole, but whose member nation they edit                                                                                                                        |
    | `request`    | an authenticated user who has none of the above                                                                                                                                                               |

    The hub is part of the admin backend, which requires login like the rest of `extending.php`: anonymous visitors
    are redirected to the home page and never see it. Every tree is therefore built for an authenticated user.

- `filterMine(tree)` returns the nodes with `mine: true` plus the ancestors needed to reach them; those ancestors are
  marked `context: true`.
- `nationDioceses(nationCode, worldDioceses)` returns the not-yet-created entries for one nation, from the
  WorldDiocesesByNation shape.

## Part 3: the hub UI

- **Server (`extending.php`):** when `choice` is absent, it renders the hub container and injects `NavigatorRights`,
  the prospective regions, the nations, and its strings through `Messages`. The existing branches for
  `choice=widerRegion|national|diocesan` are unchanged.
- **Client:** a new module, `assets/js/particularCalendarsNavigator.js`, loaded as an ES module only on the hub. It
  builds the tree and renders:
    - a toolbar: "My calendars" / "Show all" (a Bootstrap button group; the choice is remembered in `sessionStorage`),
      and a text filter on labels;
    - an accordion of regions, each with a list of nations; expanding a nation lists its dioceses, loaded on first
      expansion;
    - a status dot on every item (● created, ○ not yet created) and its action buttons.
- **Where each action goes:**

    | Action                    | URL                                                                                                                    |
    | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
    | Edit or create a region   | `extending.php?choice=widerRegion&calendar={id}`                                                                       |
    | Translate a region        | `extending.php?choice=widerRegion&calendar={id}&locale={locale}`, with the user's first editable locale of that region |
    | Edit or create a nation   | `extending.php?choice=national&calendar={ISO}`                                                                         |
    | Proper of Saints (nation) | `sanctorale.php#rite={rite}&calendar={ISO}` (the sanctorale page's existing hash state)                                |
    | Edit or create a diocese  | `extending.php?choice=diocesan&calendar={bare diocese id}&rite={rite}`                                                 |
    | Request access            | `permission-requests.php?object_type={type}&object_id={qualified id}`                                                  |

- **A nation's two editors are shown together.** A nation row shows its national calendar action, and, when the
  nation has a Missal edition, a "Proper of Saints ({missal ids})" action beside it. A nation without Missal data
  carries a short note, "No national Missal data: the national calendar alone defines it". So a curator sees that
  the Netherlands is complete with the calendar alone, while Italy has two parts to maintain.
- **Empty state:** "My calendars" with no rights shows a message and a button that switches to "Show all".
- **Accessibility:** buttons are real `<button>`/`<a>` elements, the accordion uses Bootstrap's ARIA attributes,
  and the status dots have text alternatives.

## Part 4: deep links into the forms (`assets/js/extending.js`)

- Read `calendar`, `locale` and `rite` from the query string.
- **`widerRegion`:** set `#widerRegionCalendarName` to `{id}` (or `{id} - {locale}`) and dispatch the same change the
  user's input would.
- **`national`:** select the nation in the national form's name control and dispatch change.
- **`diocesan`:** select the rite, then the national dependency (derived from the diocese entry in metadata, or from
  WorldDioceses for a new diocese), then the diocese.
- A value that is not a valid key, or not found, shows an error toast and leaves the form empty. A parser helper,
  `parseDeepLink(search)` in `assets/js/particularCalendarsTree.js`, is unit-tested.

## Part 5: breadcrumb on each form

A `<nav aria-label="breadcrumb">` above each form. Its segments are rebuilt when the loaded calendar changes:

- region form: **Particular Calendars › {region label}**;
- national form: **Particular Calendars › {regions…} › {nation}**, one link per region the nation belongs to;
- diocesan form: **Particular Calendars › {nation} › {diocese}**; for the Ambrosian rite, **Particular Calendars ›
  Ambrosian rite › {diocese}**.

Every segment except the last links to the hub or to that calendar's deep link.

## Part 6: sidebar, dashboard, access requests

- `layout/header.php`:
    - The three "Particular Calendars" links become one link to `extending.php`, active on any `extending` page.
    - The existing visibility condition is kept (`$sidebarHasCalendarRole`).
- `includes/admin-blocks.php`: the view and edit URLs of the three calendar cards point to the hub.
- `permission-requests.php` / `assets/js/permission-requests.js`:
    - `?object_type=…&object_id=…` preselects the first row's scope and calendar, reusing the existing restore path
      (`restorePermissionRow`).
    - An unknown type is ignored.
    - The requested role defaults to `calendar_editor` when the scope requires it.

## Part 7: tests

- **Unit (Vitest)**, for `buildNavigatorTree`:
    - a nation with a Missal edition (IT: `sanctorale` offered) and without one (NL: national calendar only, with the
      "no Missal data" note);
    - each kind of user: global admin, national editor (IT), diocese-only admin, admin on a prospective region,
      authenticated user with no rights;
        - `filterMine`, including context ancestors;
        - `nationDioceses`;
        - `parseDeepLink`.
- **E2E (chromium):**
    - The hub as an admin shows "Show all" with Europe › Italy.
    - A deep link to `?choice=national&calendar=IT` loads IT's form.
    - A deep link to a region with a locale loads that localization.
    - "Request access" opens the access-request form preselected.
    - The sidebar shows the single entry.
- **E2E (rbac):** a national editor of IT sees "My calendars" with Italy, whose actions are Edit and Proper of Saints
  (IT_1983), and Europe with
  Translate. France, under "Show all", offers Request access.

## Out of scope

- Changing what the three forms do.
- Unifying the sanctorale editor with the national calendar editor, or creating a new national Missal edition. The
  navigator only links to the sanctorale editor where an edition already exists.
- Any change to the permission model.
- A server-side tree endpoint.
- Moving any of the per-calendar editing into the hub itself.
