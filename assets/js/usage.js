import {
    ApiClient,
    SubscriptionBuilder,
} from '@liturgical-calendar/components-js';

// Toastr configuration
toastr.options = {
    closeButton: true,
    debug: false,
    newestOnTop: false,
    progressBar: true,
    positionClass: 'toast-bottom-center',
    preventDuplicates: false,
    onclick: null,
    showDuration: '300',
    hideDuration: '1000',
    timeOut: '2000',
    extendedTimeOut: '1000',
    showEasing: 'swing',
    hideEasing: 'linear',
    showMethod: 'fadeIn',
    hideMethod: 'fadeOut'
};

/**
 * Updates nav sidebar styling based on which accordion section is active
 * @param {string} sectionId - The ID of the section (with or without #)
 * @param {boolean} isActive - Whether the section is being shown
 */
const updateNavHighlight = (sectionId, isActive) => {
    const hash = sectionId.startsWith('#') ? sectionId : `#${sectionId}`;

    // Remove text-white from all usage nav links
    document.querySelectorAll('a.nav-link[href*="usage.php"] i, a.nav-link[href*="usage.php"] span').forEach(el => {
        el.classList.remove('text-white');
    });

    // Add text-white to matching nav link if section is active
    // Using $= (ends with) selector for exact hash matching at end of href
    if (isActive) {
        document.querySelectorAll(`a.nav-link[href$="${hash}"] i, a.nav-link[href$="${hash}"] span`).forEach(el => {
            el.classList.add('text-white');
        });
    }
};

/**
 * Handles hash change - shows the appropriate collapse section and updates nav styling
 */
const handleHashChange = () => {
    if (location.hash) {
        const collapseEl = document.querySelector(location.hash + '.collapse');
        if (collapseEl) {
            // Use getOrCreateInstance to avoid conflicts with Bootstrap's native handling
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
            bsCollapse.show();
        }
        // Immediately update nav highlight for responsive UX
        // (shown.bs.collapse event will also fire but that's fine)
        updateNavHighlight(location.hash, true);
    }
};

/**
 * Handles navigation to collapse sections from card header buttons
 * @param {Event} ev - The click event
 */
const handleCardHeaderClick = (ev) => {
    const button = ev.target.closest('button');
    if (button?.dataset.target) {
        window.location = button.dataset.target;
    }
};

/**
 * Builds the subscription card's controls and its rendered subscription URL.
 *
 * `SubscriptionBuilder` replaces what this file used to assemble by hand: the rite
 * and calendar selects, the rite -> calendar link that repartitions the calendar
 * list (the Ambrosian rite has no national tier and a different set of diocesan
 * calendars, so a selection under one rite is never carried into the other), the
 * `CurrentEndpoint` bookkeeping that turned those two selections into a URL, and
 * the clipboard handling below it. It also adds a locale select this card did not
 * have, so a subscriber can pick the feed's language.
 *
 * It never fetches: building and copying a subscription URL needs the calendar's
 * shape, not its data, so `apiClient` is passed only to bind the selects to that
 * client's API base -- the same `/calendars` metadata request as before.
 *
 * The URL itself is unchanged: `SubscriptionUrl` pins `return_type=ICS`,
 * `year_type=CIVIL` and an explicit rite segment, which is exactly what
 * `ApiConfig::$calSubscriptionUrl` renders server-side for the placeholder.
 */
const buildCalendarControls = async () => {
    const apiClient = await ApiClient.init(BaseUrl);

    const subscriptionBuilder = await SubscriptionBuilder.mountInto(
        {
            controls: '#subscriptionControls',
            url: '#calSubscriptionUrlWrapper',
        },
        {
            locale: currentLocale.language,
            apiClient,
            copyIcon: '<i class="fas fa-clipboard float-end text-info"></i>',
            onCopy: (ok) => {
                if (ok) {
                    toastr.success(Messages['URL copied to clipboard'], Messages['Success']);
                } else {
                    toastr.error(Messages['Failed to copy URL'], Messages['Error']);
                }
            },
            theme: {
                select: 'form-select',
                label: 'form-label',
                // Flat `wrapper`, so all three controls -- rite, calendar and, since
                // 2.7.0, the locale input -- get a Bootstrap column. Nothing below
                // reaches for those inputs' wrappers again: `Input.wrapper()` is
                // one-shot since 2.6.0, and this bag has already spent that call.
                wrapper: 'form-group col-md',
                // `w-100` because the copy control is a <button>, which unlike the
                // <div> this replaces does not fill its container on its own.
                subscriptionUrl: {
                    class: 'w-100 text-center bg-light border border-info rounded p-2'
                }
            },
        },
    );

    // ids are not theme keys, and id() is not one-shot. e2e/usage.spec.ts selects
    // on both of these.
    subscriptionBuilder.riteSelect.id('riteSelect');
    subscriptionBuilder.calendarSelect.id('calendarSelect');
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    handleHashChange();

    // Event: Click on card header buttons in examples section
    const examplesOfUsage = document.getElementById('examplesOfUsage');
    if (examplesOfUsage) {
        examplesOfUsage.addEventListener('click', (ev) => {
            if (ev.target.closest('.card > .card-header button')) {
                handleCardHeaderClick(ev);
            }
        });

        // Listen for Bootstrap collapse shown event to update nav sidebar highlighting
        // Using 'shown.bs.collapse' (after transition) for reliable state
        examplesOfUsage.addEventListener('shown.bs.collapse', (ev) => {
            updateNavHighlight(ev.target.id, true);
            // Update URL hash without triggering hashchange
            history.replaceState(null, '', `#${ev.target.id}`);
        });
    }

    // The selects are built asynchronously, so their change listeners are
    // attached inside buildCalendarControls() once the elements exist.
    buildCalendarControls().catch((error) => {
        console.error(
            `Could not build the calendar subscription controls: ${error.message}`,
        );
        toastr.error(Messages['Failed to load calendars'], Messages['Error']);
    });
});

// Handle hash changes
window.addEventListener('hashchange', handleHashChange);
