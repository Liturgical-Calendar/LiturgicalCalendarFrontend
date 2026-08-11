import {
    CalendarType,
    CurrentEndpoint,
} from './subscriptionUrl.js';
import {
    ApiClient,
    CalendarSelect,
    RiteSelect,
    Rite,
} from '@liturgical-calendar/components-js';

/**
 * Updates the text of the element with the id 'calSubscriptionUrl' to reflect the current value of CurrentEndpoint.
 */
const updateSubscriptionURL = () => {
    const calendarSelect = document.getElementById('calendarSelect');
    const calSubscriptionUrl = document.getElementById('calSubscriptionUrl');
    if (!calendarSelect || !calSubscriptionUrl) {
        return;
    }
    CurrentEndpoint.calendarId = calendarSelect.value;
    const selectedOption = calendarSelect.options[calendarSelect.selectedIndex];
    switch (selectedOption?.dataset.calendartype) {
        case 'national':
            CurrentEndpoint.calendarType = CalendarType.NATIONAL;
            break;
        case 'diocesan':
            CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
            break;
        default:
            CurrentEndpoint.calendarId = null;
            CurrentEndpoint.calendarType = null;
    }
    calSubscriptionUrl.textContent = CurrentEndpoint.serialize();
};

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
 * Copies URL to clipboard with fallback for older browsers
 */
const copyUrlToClipboard = () => {
    const urlText = document.getElementById('calSubscriptionUrl').textContent;

    // Check if modern clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlText)
            .then(() => {
                toastr.success(Messages['URL copied to clipboard'], Messages['Success']);
            })
            .catch(err => {
                console.error('Failed to copy to clipboard:', err);
                toastr.error(Messages['Failed to copy URL'], Messages['Error']);
            });
    } else {
        // Fallback for older browsers using execCommand
        try {
            // Create a temporary textarea, copy, then remove
            const textarea = document.createElement('textarea');
            textarea.value = urlText;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (successful) {
                toastr.success(Messages['URL copied to clipboard'], Messages['Success']);
            } else {
                toastr.warning(Messages['Select and copy manually'], Messages['Copy not supported']);
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            toastr.warning(Messages['Select and copy manually'], Messages['Copy not supported']);
        }
    }
};

/**
 * Selects the URL text on mouseup for easy copying
 */
const selectUrlOnMouseUp = () => {
    const calSubscriptionUrl = document.getElementById('calSubscriptionUrl');
    if (window.getSelection && document.createRange) {
        const sel = window.getSelection();
        if (sel.toString() === '') {
            // No text selection - select all content after brief delay
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(calSubscriptionUrl);
                sel.removeAllRanges();
                sel.addRange(range);
            }, 1);
        }
    } else if (document.selection) {
        // Older IE fallback
        const sel = document.selection.createRange();
        if (sel.text === '') {
            const range = document.body.createTextRange();
            range.moveToElementText(calSubscriptionUrl);
            range.select();
        }
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
 * Builds the rite and calendar selects and wires them to the subscription URL.
 *
 * The two selects are linked so that changing the rite repartitions the calendar
 * list: the Ambrosian rite has no national tier and a different set of diocesan
 * calendars, so a selection under one rite is never carried into the other.
 */
const buildCalendarControls = async () => {
    await ApiClient.init(BaseUrl);

    CurrentEndpoint.rite = Rite.ROMAN;

    const lang = currentLocale.language;

    // Must be in the DOM before linkToRiteSelect() below, which reads its
    // element to attach the rite-change listener.
    const riteSelect = new RiteSelect(lang)
        .class('form-select')
        .id('riteSelect')
        .label({ text: Messages['Select rite'], class: 'form-label' });
    riteSelect.appendTo('#riteSelectContainer');

    const calendarSelect = new CalendarSelect(lang)
        .class('form-select')
        .id('calendarSelect')
        .label({ text: Messages['Select calendar'], class: 'form-label' })
        .allowNull(true);
    calendarSelect.appendTo('#calendarSelectContainer');

    calendarSelect.linkToRiteSelect(riteSelect);

    // Default to the rite-level calendar rather than the first nation, so the
    // card opens on the General Roman Calendar.
    calendarSelect._domElement.value = '';

    document.getElementById('riteSelect').addEventListener('change', (ev) => {
        CurrentEndpoint.rite = ev.target.value;
        updateSubscriptionURL();
    });
    document
        .getElementById('calendarSelect')
        .addEventListener('change', updateSubscriptionURL);

    updateSubscriptionURL();
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    CurrentEndpoint.apiBase = CalendarUrl;
    handleHashChange();
    updateSubscriptionURL();

    // Event: Click on subscription URL wrapper to copy
    const calSubscriptionUrlWrapper = document.getElementById('calSubscriptionUrlWrapper');
    if (calSubscriptionUrlWrapper) {
        calSubscriptionUrlWrapper.addEventListener('click', copyUrlToClipboard);
        calSubscriptionUrlWrapper.addEventListener('mouseup', selectUrlOnMouseUp);
    }

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
    });
});

// Handle hash changes
window.addEventListener('hashchange', handleHashChange);
