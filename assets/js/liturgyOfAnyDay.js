/**
 * Liturgy of Any Day - using the DayViewer meta-component.
 *
 * DayViewer bundles the RiteSelect, CalendarSelect, ApiOptions locale input and
 * LiturgyOfAnyDay widget that this page previously wired by hand, including the
 * rite's two-wire requirement: linkToRiteSelect() alone rebuilds the calendar
 * list but does NOT turn the rite into a path segment, so a hand-wired page can
 * read `ambrosian` while every request still goes to /calendar/roman/.
 *
 * The label text that used to come from a hand-rolled 12-language map now comes
 * from the library's own Messages, which covers 83 languages.
 *
 * `theme.liturgy` only forwards `class` to the widget: `Theme.resolveChildTheme()`
 * copies through `class`/`labelClass`/`labelText`/`wrapperClass`/`wrapper` only, so
 * any other `theme.liturgy.*` key -- `dateClass`, `dateControlsClass`,
 * `eventsWrapperClass`, `eventClass`, `eventGradeClass`, `eventCommonClass`,
 * `eventYearCycleClass` -- is silently dropped before it ever reaches
 * `DayViewer`'s constructor, even though that constructor's own loop
 * (DayViewer.js:196-209) tries to read exactly those keys from the resolved
 * theme. Filed as liturgy-components-js#43: the resolver strips eight keys the
 * constructor loop expects, making that loop unreachable code. The events
 * wrapper needs the `card-body` class the old hand-wiring gave it --
 * e2e/liturgyOfAnyDay.spec.ts locates rendered events via
 * `#liturgyOfAnyDay > .card-body` -- and the other six reproduce the old page's
 * Bootstrap styling, so all seven are set post-mount below, the same way the
 * ids are. Once #43 lands, these can move back into `theme.liturgy`.
 *
 * The three date controls (`#day`, `#month`, the year input) hit a distinct,
 * separate gap: DayViewer.js:214 resolves that child with role `'input'`, so it
 * looks up `theme.input` -- `theme.select` is never consulted for it -- and
 * DayViewer.js:240-247 shares ONE resolved object across all three controls, even
 * though `#month` is a `<select>` needing `form-select` while the other two are
 * `<input>`s needing `form-control`. Unlike #43, this isn't a key the resolver
 * drops -- it's a role the theme bag has no way to express at all, since one
 * resolved object can't hold two different class strings for the same key. So
 * these three are also set post-mount, one call per control's actual tag.
 */

import { ApiClient, DayViewer } from '@liturgical-calendar/components-js';

const initializePage = async () => {
    const apiClient = await ApiClient.init(BaseUrl);

    const viewer = await DayViewer.mountInto(
        {
            rite: '#riteSelectContainer',
            calendar: '#calendarSelectContainer',
            locale: '#localeSelectContainer',
            liturgy: '#liturgyOfAnyDayContainer',
        },
        {
            locale: currentLocale.language,
            apiClient,
            // The widget's own "Liturgy of the Day" heading is redundant: the page
            // already has an <h3> heading above these controls, exactly as the
            // hand-wired version hid it via `_titleElement.style.display = 'none'`.
            showTitle: false,
            theme: {
                select: 'form-select',
                label: 'form-label',
                liturgy: { class: 'card shadow m-2' },
                dateControls: {
                    labelClass: 'form-label',
                    wrapperClass: 'col-md',
                },
            },
            onError: (error) => {
                console.error(`Liturgy of any day: ${error.message}`);
                showToast(Messages['Failed to load'], 'danger');
            },
        },
    );

    // ids are not theme keys, and id() is not one-shot -- unlike label(), which
    // the theme bag has already called on each child.
    viewer.riteSelect.id('riteSelect');
    viewer.calendarSelect.id('calendarSelect');
    viewer.localeInput.id('apiOptionsLocale');
    viewer.liturgy.id('liturgyOfAnyDay');
    // See the file-level note above (liturgy-components-js#43): none of these
    // seven are reachable through the theme bag, so they are set post-mount,
    // reproducing the classes the old hand-wired page set directly.
    viewer.liturgy
        .dateClass('card-header py-3 d-flex justify-content-between align-items-center')
        .dateControlsClass('row g-3 p-3')
        .eventsWrapperClass('card-body')
        .eventClass('liturgy-event p-3 mb-2 rounded')
        .eventGradeClass('small')
        .eventCommonClass('small fst-italic')
        .eventYearCycleClass('small');
    // See the file-level note above: the date controls' role-shared theme
    // object cannot express one class per tag, so each control's class is set
    // post-mount, matching the old hand-wired page's Bootstrap classes.
    viewer.liturgy
        .dayInputConfig({ class: 'form-control' })
        .monthInputConfig({ class: 'form-select' })
        .yearInputConfig({ class: 'form-control' });
};

const startPage = () => {
    initializePage().catch((error) => {
        console.error(
            `Could not initialize the liturgy of any day page: ${error.message}`,
        );
        showToast(Messages['Failed to load'], 'danger');
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPage);
} else {
    startPage();
}
