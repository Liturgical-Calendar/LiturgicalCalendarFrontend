const updateSubscriptionURL = () => {
    let params = {};
    switch( $('#calendarSelect').find(':selected').attr('data-calendartype') ) {
        case 'nationalcalendar':
            params.nationalcalendar = $('#calendarSelect').val();
            break;
        case 'diocesancalendar':
            params.diocesancalendar = $('#calendarSelect').val();
            break;
        default:
            params.diocesancalendar = 'DIOCESIDIROMA';
    }
    params.returntype = "ICS";
    $('#calSubscriptionURL').text(calSubscriptionURL + new URLSearchParams(params).toString());
}

//let stagingURL = isStaging ? "-staging" : "";
let calSubscriptionURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/?`;


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
    }else if (document.selection) { //older ie
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
