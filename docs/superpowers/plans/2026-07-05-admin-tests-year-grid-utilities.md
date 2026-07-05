# Admin-Tests Year-Grid Utilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the UnitTestInterface year-grid affordances (hammer pivot/toggle, ⓧ exclude with striped-bar restore, Sunday highlighting) into the phase-2 admin-tests editor,
plus a new color legend.

**Architecture:** State-first — the grid is a pure projection of `builder.model` (`excludes`, `assertions`, pivot, `baseMonthDay`); clicks mutate the model via new
`excludeYear`/`includeYear` methods (and existing `setPivot`/`toggleAssert`), then re-render grid + cards. `serialize()` already emits `excludes`; no API/schema work.

**Tech Stack:** Vanilla ES6 (`assets/js/admin-tests.js`, `assets/js/AssertionsBuilder.js`), Vitest + jsdom for unit tests, Playwright (chromium project, stubbed routes) for e2e,
PHP/gettext for markup + i18n.

**Spec:** `docs/superpowers/specs/2026-07-05-admin-tests-year-grid-utilities-design.md`

## Global Constraints

- Branch: `feat/admin-tests-phase2` (PR #379). Commit per task; **do NOT push** (CodeRabbit rate-limit convention — batch for an explicit push request).
- Yarn 4 / node_modules linker: use `yarn …` for everything, never `npm`/`npx`; commit `package.json`+`yarn.lock` only (no `package-lock.json`).
- Never `--no-verify`; pre-commit hooks run PHP lint + markdownlint.
- gettext strings: numbered placeholders (`%1$s`) when more than one; wrap output in `htmlspecialchars(_('…'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- The model is the single source of truth: `serialize()` and the grid must never read state from the DOM.
- E2E prerequisite: the docker stack must be up (`docker compose up -d`) — the chromium project uses the shared auth storage state; the tests below stub every API route they touch.

---

### Task 1: `excludeYear` / `includeYear` model methods

**Files:**

- Modify: `assets/js/AssertionsBuilder.js` (insert after `setPivot`, which ends near line 257)
- Test: `assets/js/__tests__/AssertionsBuilder.test.js` (append a new `describe` at the end)

**Interfaces:**

- Consumes: existing `AssertionsBuilder` internals — `this.model` (`excludes`, `assertions`, `test_type`, `year_since`, `year_until`, `description`), `this.baseMonthDay`,
  `Assertion`, `AssertType`, `TestType`, static `#expectedValue(year, month, day)`.
- Produces: `excludeYear(year: number): this` and `includeYear(year: number): this` — chainable, used by Task 3's click handler.

- [ ] **Step 1: Write the failing tests**

Append to `assets/js/__tests__/AssertionsBuilder.test.js` (the `event` fixture — `{ event_key: 'StIgnatiusOfLoyola', …, month: 7, day: 31 }` — is already defined at module level):

```javascript
describe("excludeYear / includeYear", () => {
  const build = () => {
    const b = new AssertionsBuilder({ locale: "en" });
    b.setMeta({ event_key: event.event_key, test_type: "exactCorrespondence" });
    b.generate({ event, minYear: 2024, maxYear: 2026 });
    return b;
  };

  it("excludeYear removes the assertion and records the exclusion (sorted, deduped)", () => {
    const b = build();
    b.excludeYear(2025).excludeYear(2024).excludeYear(2025);
    expect(b.model.excludes).toEqual([2024, 2025]);
    expect(b.model.assertions.map((a) => a.year)).toEqual([2026]);
  });

  it("excludeYear is a no-op for years without an assertion", () => {
    const b = build();
    b.excludeYear(1999);
    expect(b.model.excludes).toBe(null);
    expect(b.model.assertions).toHaveLength(3);
  });

  it("includeYear restores an exact assertion with expected_value from baseMonthDay", () => {
    const b = build();
    b.excludeYear(2025).includeYear(2025);
    expect(b.model.excludes).toBe(null);
    const a = b.model.assertions.find((x) => x.year === 2025);
    expect(a.assert).toBe("eventExists AND hasExpectedDate");
    expect(a.expected_value).toBe("2025-07-31T00:00:00+00:00");
    expect(b.model.assertions.map((x) => x.year)).toEqual([2024, 2025, 2026]);
  });

  it("includeYear respects the since-pivot (restores eventNotExists before it)", () => {
    const b = new AssertionsBuilder({ locale: "en" });
    b.setMeta({
      event_key: event.event_key,
      test_type: "exactCorrespondenceSince",
    });
    b.generate({ event, minYear: 2024, maxYear: 2026, pivotYear: 2026 });
    b.excludeYear(2024).includeYear(2024);
    const a = b.model.assertions.find((x) => x.year === 2024);
    expect(a.assert).toBe("eventNotExists");
    expect(a.assertion).toContain("should not exist on");
  });

  it("serialize emits excludes while excluded and drops the key after restore", () => {
    const b = build();
    b.excludeYear(2026);
    expect(b.serialize().excludes).toEqual([2026]);
    b.includeYear(2026);
    expect("excludes" in b.serialize()).toBe(false);
  });

  it("includeYear is a no-op when the year is not excluded", () => {
    const b = build();
    b.includeYear(2025);
    expect(b.model.excludes).toBe(null);
    expect(b.model.assertions).toHaveLength(3);
  });

  it("generate skips excludedYears so regeneration preserves exclusions", () => {
    // model-level guarantee behind the regenerate() wiring in admin-tests.js
    const b = build();
    b.excludeYear(2025);
    b.generate({
      event,
      minYear: 2024,
      maxYear: 2026,
      excludedYears: b.model.excludes ?? [],
    });
    expect(b.model.assertions.map((a) => a.year)).toEqual([2024, 2026]);
    expect(b.model.excludes).toEqual([2025]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit`
Expected: 7 new tests FAIL with `b.excludeYear is not a function`; the pre-existing 28 still pass.

- [ ] **Step 3: Implement the two methods**

In `assets/js/AssertionsBuilder.js`, insert immediately AFTER the closing brace of `setPivot(year)` (and before `#formatDate`):

```javascript
    /**
     * Exclude a year from the test: record it in model.excludes (sorted,
     * deduped) and drop its assertion. No-op if the year has no assertion.
     */
    excludeYear(year) {
        const y = Number(year);
        if (!this.model.assertions.some((a) => a.year === y)) return this;
        const current = this.model.excludes ?? [];
        if (!current.includes(y)) {
            this.model.excludes = [...current, y].sort((a, b) => a - b);
        }
        this.model.assertions = this.model.assertions.filter((a) => a.year !== y);
        return this;
    }

    /**
     * Restore a previously excluded year, re-creating its assertion with the
     * same rules generate() uses (pivot- and baseMonthDay-aware). excludes
     * returns to null when the last exclusion is removed, so serialize()
     * drops the key. No-op if the year is not excluded.
     */
    includeYear(year) {
        const y = Number(year);
        const current = this.model.excludes ?? [];
        if (!current.includes(y)) return this;
        const remaining = current.filter((x) => x !== y);
        this.model.excludes = remaining.length ? remaining : null;

        let notExists = false;
        if (this.model.test_type === TestType.ExactCorrespondenceSince && this.model.year_since !== null) {
            notExists = y < this.model.year_since;
        } else if (this.model.test_type === TestType.ExactCorrespondenceUntil && this.model.year_until !== null) {
            notExists = y > this.model.year_until;
        }
        const description = this.model.description;
        if (notExists || !this.baseMonthDay) {
            this.model.assertions.push(
                new Assertion(y, null, AssertType.EventNotExists, description.replace('should fall on', 'should not exist on'))
            );
        } else {
            this.model.assertions.push(
                new Assertion(
                    y,
                    AssertionsBuilder.#expectedValue(y, this.baseMonthDay.month, this.baseMonthDay.day),
                    AssertType.EventTypeExact,
                    description
                )
            );
        }
        this.model.assertions.sort((a, b) => a.year - b.year);
        return this;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: all 35 tests PASS (28 pre-existing + 7 new).

- [ ] **Step 5: Lint and commit**

```bash
yarn lint
node --check assets/js/AssertionsBuilder.js
git add assets/js/AssertionsBuilder.js assets/js/__tests__/AssertionsBuilder.test.js
git commit -m "feat(admin-tests): AssertionsBuilder excludeYear/includeYear (state-first year exclusion)"
```

---

### Task 2: Grid rendering — icons, Sunday highlighting, striped exclusion bar

**Files:**

- Modify: `assets/js/admin-tests.js` — replace `renderYearGrid()` (currently ~lines 246-271) and add a `yearDateAttrs()` helper above it
- Modify: `assets/css/admin-tests.css` — replace the `.testYearSpan.deleted { opacity: 0.3 }` placeholder with the striped bar; add icon hover rules
- Modify: `admin-tests.php` — add 4 keys to the `i18n:` block (after `conflict409`, ~line 323)
- Test: `e2e/admin-tests.spec.ts` (append a new `test.describe`)

**Interfaces:**

- Consumes: `builder.model` / `builder.baseMonthDay`, `AssertType`, `TestType`, `sliderYears()`, `config.locale`, `i18n` (all already in scope in `admin-tests.js`).
- Produces: grid spans with classes/`data-year` that Task 3's click handler targets: `.testYearSpan` (always), `.deleted` (excluded), child icons `.hammerYear` / `.removeYear`.
  Same `renderYearGrid()` name — call sites unchanged.

- [ ] **Step 1: Add the i18n keys**

In `admin-tests.php`, the `i18n:` object currently ends with:

```php
                conflict409:         <?php echo json_encode(_('A test with that name already exists.')); ?>
```

Change that to (comma added, four keys appended):

```php
                conflict409:         <?php echo json_encode(_('A test with that name already exists.')); ?>,
                setYear:             <?php echo json_encode(_('set year')); ?>,
                removeYear:          <?php echo json_encode(_('remove')); ?>,
                sundayInYear:        <?php echo json_encode(_('In the year %1$s, %2$s falls on a Sunday')); ?>,
                excludedRestore:     <?php echo json_encode(_('%s excluded — click to restore')); ?>
```

- [ ] **Step 2: Replace the placeholder CSS**

In `assets/css/admin-tests.css`, replace:

```css
.year-grid .testYearSpan.deleted {
  opacity: 0.3;
}
```

with (striped-bar values ported verbatim from `UnitTestInterface/assets/css/admin.css`; the selector is deliberately NOT ID-scoped so Task 4's legend chips can share it):

```css
.year-grid .testYearSpan.deleted,
.legend-chip.deleted {
  background: repeating-linear-gradient(
    45deg,
    red,
    red 5px,
    white 8px,
    white 12px
  );
  cursor: not-allowed;
}

/* The base .testYearSpan padding stays in effect, so the clickable area is
   ~19px wide even though the visible stripe content is 3px (same as the
   original, where the 3px width sat inside the span's 3px/5px padding). */
.year-grid .testYearSpan.deleted {
  width: 3px;
  height: 32px;
}

.year-grid .testYearSpan .hammerYear,
.year-grid .testYearSpan .removeYear {
  cursor: pointer;
}

.year-grid .testYearSpan .hammerYear:hover,
.year-grid .testYearSpan .removeYear:hover {
  opacity: 1 !important;
}
```

- [ ] **Step 3: Rewrite `renderYearGrid()`**

In `assets/js/admin-tests.js`, replace the whole current `renderYearGrid()` function with the following two functions (`yearDateAttrs` is new — the port of the old UI's
`computeYearDateAttrs`):

```javascript
/**
 * Port of UnitTestInterface's computeYearDateAttrs: title + Sunday flag
 * for the event's fixed date in the given year (empty when the event has
 * no fixed month/day).
 */
function yearDateAttrs(year) {
  if (!builder.baseMonthDay) return { title: "", sunday: false };
  const d = new Date(
    Date.UTC(year, builder.baseMonthDay.month - 1, builder.baseMonthDay.day),
  );
  const sunday = d.getUTCDay() === 0;
  const fmt = new Intl.DateTimeFormat(config.locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const title = sunday
    ? i18n.sundayInYear
        .replace("%1$s", String(year))
        .replace("%2$s", fmt.format(d))
    : fmt.format(d);
  return { title, sunday };
}

function renderYearGrid() {
  const grid = document.getElementById("yearGrid");
  const { minYear, maxYear } = sliderYears();
  const tt = builder.model.test_type;
  const excluded = new Set(builder.model.excludes ?? []);
  const notExists = new Set(
    builder.model.assertions
      .filter((a) => a.assert === AssertType.EventNotExists)
      .map((a) => a.year),
  );
  const pivot =
    tt === TestType.ExactCorrespondenceSince
      ? builder.model.year_since
      : tt === TestType.ExactCorrespondenceUntil
        ? builder.model.year_until
        : null;
  const showHammer = tt !== TestType.ExactCorrespondence;
  grid.innerHTML = "";
  for (let y = minYear; y <= maxYear; y++) {
    const span = document.createElement("span");
    span.className = `testYearSpan year-${y}`;
    span.dataset.year = String(y);
    if (excluded.has(y)) {
      span.classList.add("deleted");
      span.title = i18n.excludedRestore.replace("%s", String(y));
      grid.appendChild(span);
      continue;
    }
    if (showHammer) {
      const hammer = document.createElement("i");
      hammer.className = "fas fa-hammer me-1 opacity-50 hammerYear";
      hammer.setAttribute("role", "button");
      hammer.setAttribute("aria-hidden", "true");
      hammer.title = i18n.setYear;
      span.appendChild(hammer);
    }
    span.appendChild(document.createTextNode(String(y)));
    const xmark = document.createElement("i");
    xmark.className = "fas fa-circle-xmark ms-1 opacity-50 removeYear";
    xmark.setAttribute("role", "button");
    xmark.setAttribute("aria-hidden", "true");
    xmark.title = i18n.removeYear;
    span.appendChild(xmark);
    const { title, sunday } = yearDateAttrs(y);
    if (title) span.title = title;
    if (y === pivot) {
      span.classList.add("bg-info");
    } else if (notExists.has(y)) {
      span.classList.add("bg-warning");
    } else if (sunday) {
      span.classList.add("bg-light");
    }
    grid.appendChild(span);
  }
}
```

Background precedence (pivot > not-exists > Sunday) matches the old UI, where pivot/warning classes replaced `bg-light`.

- [ ] **Step 4: Add the rendering e2e test**

Append to `e2e/admin-tests.spec.ts` (reuses the existing `stubEditor` helper and `grcEvents` fixture — StIgnatiusOfLoyola, July 31; note 2005-07-31 IS a Sunday). This test covers
ONLY rendering; the exclude/restore interaction test is added in Task 3, where the click handler exists — every commit stays green.

```typescript
test.describe("admin-tests year grid (stubbed)", () => {
  test("spans carry hammer/x icons and Sunday highlighting", async ({
    page,
  }) => {
    await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
    await page.goto("/admin-tests.php");
    await page.locator("#createTestBtn").click();
    await page.locator("#tt-variable").check({ force: true });
    await page.locator("#testEventKey").fill("StIgnatiusOfLoyola");
    await page.locator("#testEventKey").dispatchEvent("change");

    const span2005 = page.locator("#yearGrid .testYearSpan.year-2005");
    await expect(span2005).toBeVisible();
    // variable type → hammer present; x always present; 2005-07-31 is a Sunday
    await expect(span2005.locator(".hammerYear")).toHaveCount(1);
    await expect(span2005.locator(".removeYear")).toHaveCount(1);
    await expect(span2005).toHaveClass(/bg-light/);
    // exactCorrespondence type → hammer absent
    await page.locator("#tt-exact").check({ force: true });
    await expect(span2005.locator(".hammerYear")).toHaveCount(0);
    await expect(span2005.locator(".removeYear")).toHaveCount(1);
  });
});
```

- [ ] **Step 5: Run the e2e test to verify it passes**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g "year grid"`
Expected: PASS (rendering only — no interaction is exercised yet).

- [ ] **Step 6: Syntax-check, lint, commit**

```bash
node --check assets/js/admin-tests.js
yarn lint
yarn typecheck
php -l admin-tests.php
git add assets/js/admin-tests.js assets/css/admin-tests.css admin-tests.php e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): year-grid icons, Sunday highlighting, striped exclusion styling"
```

---

### Task 3: Grid interactions + `regenerate()` exclusion preservation

**Files:**

- Modify: `assets/js/admin-tests.js` — replace the existing `#yearGrid` click handler (the block starting with the comment `// For Since/Until types, clicking a year in the
  overview grid sets the pivot`), and one line in `regenerate()`

**Interfaces:**

- Consumes: `builder.excludeYear/includeYear` (Task 1), grid classes `.deleted`/`.hammerYear`/`.removeYear` + `data-year` (Task 2), existing
  `builder.setPivot/toggleAssert/render`, `selectedTestType()`, `assertionsContainer`, `renderYearGrid()`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Replace the grid click handler**

In `assets/js/admin-tests.js`, replace this entire existing block:

```javascript
// For Since/Until types, clicking a year in the overview grid sets the pivot
// (year_since / year_until) and re-splits the assertions around it.
document.getElementById("yearGrid").addEventListener("click", (ev) => {
  const span = ev.target.closest(".testYearSpan");
  if (!span) return;
  const tt = selectedTestType();
  if (
    tt !== TestType.ExactCorrespondenceSince &&
    tt !== TestType.ExactCorrespondenceUntil
  )
    return;
  builder.setPivot(Number(span.dataset.year));
  builder.render(assertionsContainer);
  renderYearGrid();
});
```

with:

```javascript
// Year-grid interactions (ported from UnitTestInterface, state-first):
//   hammer  → Since/Until: set the pivot; Variable: toggle that year
//   x-mark  → exclude the year (collapses to the striped bar)
//   striped bar → restore the year
//   span body   → no action (the icons are the affordances)
document.getElementById("yearGrid").addEventListener("click", (ev) => {
  const span = ev.target.closest(".testYearSpan");
  if (!span) return;
  const year = Number(span.dataset.year);
  if (span.classList.contains("deleted")) {
    builder.includeYear(year);
  } else if (ev.target.closest(".removeYear")) {
    builder.excludeYear(year);
  } else if (ev.target.closest(".hammerYear")) {
    const tt = selectedTestType();
    if (
      tt === TestType.ExactCorrespondenceSince ||
      tt === TestType.ExactCorrespondenceUntil
    ) {
      builder.setPivot(year);
    } else if (tt === TestType.VariableCorrespondence) {
      builder.toggleAssert(year);
    }
  } else {
    return;
  }
  builder.render(assertionsContainer);
  renderYearGrid();
});
```

- [ ] **Step 2: Preserve exclusions across regeneration**

In `regenerate()`, change:

```javascript
builder.generate({ event, minYear, maxYear, pivotYear: pivot });
```

to:

```javascript
// Preserve exclusions when the event/type/slider changes; generate()
// skips excluded years, so without this every regeneration would
// silently restore them.
builder.generate({
  event,
  minYear,
  maxYear,
  pivotYear: pivot,
  excludedYears: builder.model.excludes ?? [],
});
```

- [ ] **Step 3: Add the failing exclude/restore e2e test**

Inside the `test.describe("admin-tests year grid (stubbed)", …)` block added in Task 2, add:

```typescript
  test("exclude collapses to the striped bar and restore brings the card back", async ({
    page,
  }) => {
    await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
    await page.goto("/admin-tests.php");
    await page.locator("#createTestBtn").click();
    await page.locator("#tt-variable").check({ force: true });
    await page.locator("#testEventKey").fill("StIgnatiusOfLoyola");
    await page.locator("#testEventKey").dispatchEvent("change");

    const span2005 = page.locator("#yearGrid .testYearSpan.year-2005");
    await expect(span2005).toBeVisible();

    // exclude: card disappears, span collapses to the striped bar
    await span2005.locator(".removeYear").click();
    await expect(span2005).toHaveClass(/deleted/);
    await expect(page.locator('.assertion-card[data-year="2005"]')).toHaveCount(
      0,
    );

    // restore: card returns, stripes gone
    await span2005.click();
    await expect(span2005).not.toHaveClass(/deleted/);
    await expect(page.locator('.assertion-card[data-year="2005"]')).toHaveCount(
      1,
    );
  });
```

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g "year grid"`
Expected: the new test FAILS before Steps 1-2 are applied (no click handler → span never gains `deleted`); after applying Steps 1-2 it PASSES. If you already applied Steps 1-2,
verify the failure by `git stash`-ing the `admin-tests.js` change, running, then `git stash pop`.
Final state: both year-grid tests PASS.

- [ ] **Step 4: Run the full stubbed e2e file (regression: pivot flow, editor, delete)**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium`
Expected: all tests PASS. If a pre-existing test clicked a span body to set the pivot, update it to click `.hammerYear` instead — the whole-span pivot click is intentionally
removed.

- [ ] **Step 5: Syntax-check, lint, unit tests, commit**

```bash
node --check assets/js/admin-tests.js
yarn lint
yarn test:unit
git add assets/js/admin-tests.js e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): year-grid hammer/exclude interactions; preserve excludes on regenerate"
```

---

### Task 4: Legend chip row

**Files:**

- Modify: `admin-tests.php` — insert the legend row right after `<div class="year-grid mt-2" id="yearGrid"></div>` (~line 211)
- Modify: `assets/css/admin-tests.css` — append `.legend-chip` sizing rules
- Test: `e2e/admin-tests.spec.ts` — extend the year-grid describe with a legend test

**Interfaces:**

- Consumes: the shared `.deleted` striped CSS from Task 2 (selector already matches `.legend-chip.deleted`).
- Produces: `#yearGridLegend` element.

- [ ] **Step 1: Add the legend markup**

In `admin-tests.php`, immediately after the `#yearGrid` div, insert:

```php
                            <div class="d-flex flex-wrap align-items-center column-gap-3 row-gap-1 small text-muted mt-2" id="yearGridLegend">
                                <span><span class="legend-chip me-1"></span><?php echo htmlspecialchars(_('included'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                                <span><span class="legend-chip bg-light me-1"></span><?php echo htmlspecialchars(_('falls on a Sunday'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                                <span><span class="legend-chip bg-info me-1"></span><?php echo htmlspecialchars(_('pivot year'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                                <span><span class="legend-chip bg-warning me-1"></span><?php echo htmlspecialchars(_('event not expected'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                                <span><span class="legend-chip deleted me-1"></span><?php echo htmlspecialchars(_('excluded — click to restore'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
                            </div>
```

- [ ] **Step 2: Add the chip sizing CSS**

Append to `assets/css/admin-tests.css` (AFTER the shared `.deleted` rule from Task 2, so the size override wins):

```css
/* Legend chips reuse the exact grid classes so legend and grid cannot drift. */
.legend-chip {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.25rem;
  vertical-align: text-bottom;
}

.legend-chip.deleted {
  width: 5px;
  height: 1.25rem;
  border: none;
}
```

- [ ] **Step 3: Add the failing e2e assertion**

Inside the `test.describe('admin-tests year grid (stubbed)', …)` block from Task 2, add:

```typescript
test("legend row is visible with all five chips", async ({ page }) => {
  await stubEditor(page, { is_global_admin: true, editor: [], admin: [] });
  await page.goto("/admin-tests.php");
  await page.locator("#createTestBtn").click();
  const legend = page.locator("#yearGridLegend");
  await expect(legend).toBeVisible();
  await expect(legend.locator(".legend-chip")).toHaveCount(5);
  await expect(legend.locator(".legend-chip.deleted")).toHaveCount(1);
});
```

- [ ] **Step 4: Run the e2e tests**

Run: `yarn playwright test e2e/admin-tests.spec.ts --project=chromium -g "year grid"`
Expected: both tests PASS. (If the container serves a stale `admin-tests.php`, remember the bind-mount is per-file and live — but a rebuilt container is only needed if the file
was newly created; here it exists, edits propagate.)

- [ ] **Step 5: Lint and commit**

```bash
php -l admin-tests.php
composer lint
git add admin-tests.php assets/css/admin-tests.css e2e/admin-tests.spec.ts
git commit -m "feat(admin-tests): color legend chip row under the year grid"
```

---

### Task 5: Full validation sweep

**Files:** none new — verification only.

- [ ] **Step 1: Run every quality gate**

```bash
yarn test:unit
yarn lint
yarn typecheck
composer parallel-lint
composer lint
composer analyse
yarn playwright test e2e/admin-tests.spec.ts --project=chromium
```

Expected: everything green (35 unit tests; all stubbed e2e specs).

- [ ] **Step 2: Manual smoke in the running docker stack**

Open `http://localhost:3000/admin-tests.php` (logged in as an admin), create-test flow: pick the Since type → hammer a year → confirm blue pivot + amber pre-pivot years and cards
flip to "should not exist"; ⓧ a year → striped bar + card gone; click the bar → both return; legend visible. Confirm a PATCH round-trip on an existing test preserves `excludes`
(Network tab).

- [ ] **Step 3: Report completion**

Do NOT push — summarize the commits and wait for an explicit push request (the push updates PR #379 and triggers CodeRabbit).
