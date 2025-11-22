/**
 * Enum CalendarType
 * Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = {
    NATIONAL: 'nation',
    DIOCESAN: 'diocese'
}
Object.freeze(CalendarType);

/**
 * Represents the parameters for the API /calendar endpoint request
 */
class RequestPayload {
    static epiphany             = null;
    static ascension            = null;
    static corpus_christi       = null;
    static eternal_high_priest  = null;
    static locale               = null;
    static return_type          = 'ICS';
    static year_type            = null;
};


/**
 * Class CurrentEndpoint
 * Used to build the full endpoint URL for the API /calendar endpoint
 * @param {string} calendarType The type of calendar (national, diocesan)
 * @param {string} calendarId The ID of the calendar
 * @param {string} calendarYear The year of the calendar
 *
 */
class CurrentEndpoint {
    /**
     * The base URL of the API /calendar endpoint
     * @returns {string} The base URL of the API /calendar endpoint
     */
    static get apiBase() {
        return `${CalendarUrl}`
    };
    static calendarType   = null;
    static calendarId     = null;
    static calendarYear   = null;
    static serialize = () => {
        let currentEndpoint = CurrentEndpoint.apiBase;
        if ( CurrentEndpoint.calendarType !== null && CurrentEndpoint.calendarId !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if ( CurrentEndpoint.calendarYear !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        let parameters = [];
        for (const key in RequestPayload) {
            if(RequestPayload[key] !== null && RequestPayload[key] !== ''){
                parameters.push(key + "=" + encodeURIComponent(RequestPayload[key]));
            }
        }
        let urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${currentEndpoint}${urlParams}`;
    }
}


/**
 * Updates the text of the element with the id 'calSubscriptionURL' to reflect the current value of CurrentEndpoint.
 */
const updateSubscriptionURL = () => {
    CurrentEndpoint.calendarId = $('#calendarSelect').val();
    switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
        case 'nationalcalendar':
            CurrentEndpoint.calendarType = CalendarType.NATIONAL;
            break;
        case 'diocesancalendar':
            CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
            break;
        default:
            CurrentEndpoint.calendarId = null;
            CurrentEndpoint.calendarType = null;
    }
    $('#calSubscriptionURL').text(CurrentEndpoint.serialize());
}

// Toastr configuration
toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": true,
    "positionClass": "toast-bottom-center",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "2000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
}


$(document).ready(() => {
    if( location.hash != null && location.hash != "" ) {
        console.log( location.hash );
        //$('.collapse').collapse('hide');
        $(location.hash + '.collapse').collapse('show');
        $('a.nav-link[href*="usage.php"]').find('i,span').removeClass('text-white');
        $('a.nav-link[href*="'+location.hash+'"]').find('i,span').addClass('text-white');
    }
    updateSubscriptionURL();
});

$(document).on('click', '#calSubscriptionURLWrapper', () => {
    navigator.clipboard.writeText($('#calSubscriptionURL').text());
    toastr["success"]("URL was copied to the clipboard","Success");
});

$(document).on('click', '#examplesOfUsage > .card > .card-header button', ev => {
    window.location = ev.currentTarget.dataset.target;
});

$(document).on('mouseup', '#calSubscriptionURLWrapper', () => {
    var sel, range;
    if (window.getSelection && document.createRange) { //Browser compatibility
        sel = window.getSelection();
        if(sel.toString() == ''){ //no text selection
            window.setTimeout(function(){
            range = document.createRange(); //range object
            range.selectNodeContents($('#calSubscriptionURL')[0]); //sets Range
            sel.removeAllRanges(); //remove all ranges from selection
            sel.addRange(range);//add Range to a Selection.
        },1);
        }
    }
    else if (document.selection) { //older ie
        sel = document.selection.createRange();
        if(sel.text == ''){ //no text selection
            range = document.body.createTextRange();//Creates TextRange object
            range.moveToElementText($('#calSubscriptionURL')[0]);//sets Range
            range.select(); //make selection.
        }
    }
});

$(window).on('hashchange', () => {
    if( location.hash != null && location.hash != "" ) {
        console.log( location.hash );
        $(location.hash + '.collapse').collapse('show');
        $('a.nav-link[href*="usage.php"]').find('i,span').removeClass('text-white');
        $('a.nav-link[href*="'+location.hash+'"]').find('i,span').addClass('text-white');
    }
});

$(document).on('change', '#calendarSelect', updateSubscriptionURL);
