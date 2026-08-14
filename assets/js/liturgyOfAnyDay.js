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
 * The widget's own styling now goes through `theme.liturgy`. It could not before:
 * `Theme.resolveChildTheme()` used to copy through
 * `class`/`labelClass`/`labelText`/`wrapperClass`/`wrapper` only, so `dateClass`,
 * `dateControlsClass`, `eventsWrapperClass`, `eventClass`, `eventGradeClass`,
 * `eventCommonClass` and `eventYearCycleClass` were dropped before reaching
 * `DayViewer`'s constructor, whose own loop reads exactly those keys -- filed as
 * liturgy-components-js#43 and fixed in 2.3.0, which gave the resolver a
 * `liturgy` role carrying all eight. They were set post-mount until then.
 *
 * The three date controls (`#day`, `#month`, the year input) hit a distinct gap
 * that is still open: `DayViewer` resolves that child with role `'input'`, so it
 * looks up `theme.input` -- `theme.select` is never consulted for it -- and it
 * shares ONE resolved object across all three controls, even though `#month` is a
 * `<select>` needing `form-select` while the other two are `<input>`s needing
 * `form-control`. Unlike #43, this isn't a key the resolver drops -- it's a role
 * the theme bag has no way to express at all, since one resolved object can't hold
 * two different class strings for the same key. 2.6.1 left `dateControls`
 * deliberately unchanged for this reason. So these three stay set post-mount, one
 * call per control's actual tag, passing only `class`: `dayInputConfig()` and its
 * siblings call `Input.wrapper()` only when handed a `wrapper` key, and since
 * 2.6.0 a second `wrapper()` call on the same input throws.
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
                liturgy: {
                    class: 'card shadow m-2',
                    dateClass: 'card-header py-3 d-flex justify-content-between align-items-center',
                    dateControlsClass: 'row g-3 p-3',
                    // e2e/liturgyOfAnyDay.spec.ts locates rendered events via
                    // `#liturgyOfAnyDay > .card-body`, so this class is load-bearing.
                    eventsWrapperClass: 'card-body',
                    eventClass: 'liturgy-event p-3 mb-2 rounded',
                    eventGradeClass: 'small',
                    eventCommonClass: 'small fst-italic',
                    eventYearCycleClass: 'small'
                },
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
