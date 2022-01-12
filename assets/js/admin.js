$(document).ready(() => {

});
$(document).on('change', '#jsonFileSelect', () => {
    if( location.href.includes('-staging') ) {
        console.log('we cannot actually manage the JSON files in the staging environment');
        return;
    }

});