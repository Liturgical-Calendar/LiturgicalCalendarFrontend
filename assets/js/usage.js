let toast = `<div aria-live="polite" aria-atomic="true" style="position: absolute; min-height: 50vh; min-width: 300px; top: 10px; right: -500px;" id="toast-wrapper">
<div style="position: sticky; top: 0; right: 0;">
<div class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="3000">
<div class="toast-header bg-success text-white">
  <i class="fas fa-info mr-2"></i>
  <strong class="mr-auto">Notification</strong>
  <small>11 mins ago</small>
  <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
    <span aria-hidden="true">&times;</span>
  </button>
</div>
<div class="toast-body">
  URL was successfully copied to the clipboard.
</div>
</div>
</div>
</div>`;

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

let isStaging = location.href.includes( "-staging" );
//let stagingURL = isStaging ? "-staging" : "";
let endpointV = isStaging ? "dev" : "v3";
let calSubscriptionURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/LitCalEngine.php?`;

$(document).ready(() => {
    if( location.hash != null && location.hash != "" ) {
        console.log( location.hash );
        //$('.collapse').collapse('hide');
        $(location.hash + '.collapse').collapse('show');
        $('a.nav-link[href*="usage.php"]').find('i,span').removeClass('text-white');
        $('a.nav-link[href*="'+location.hash+'"]').find('i,span').addClass('text-white');
    }
    updateSubscriptionURL();
    $('body').append(toast);
    $('.toast').on('show.bs.toast', () => {
        $('#toast-wrapper').css({"right":"10px"});
    });
    $('.toast').on('hidden.bs.toast', () => {
        $('#toast-wrapper').css({"right":"-500px"});
    });
});

$(document).on('click', '#calSubscriptionURLWrapper', () => {
    navigator.clipboard.writeText($('#calSubscriptionURL').text());
    $('.toast').toast('show');
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
