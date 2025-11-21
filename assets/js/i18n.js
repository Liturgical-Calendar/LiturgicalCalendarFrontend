if(Cookies.get("currentLocale") === undefined){
    Cookies.set("currentLocale", navigator.language );
}
const currentLocale = new Intl.Locale(Cookies.get("currentLocale").replaceAll('_','-') || 'en');
const LITCAL_LOCALE = currentLocale.language;

(function ($) {
    $(document).ready(function() {
        $(document).on( 'click', '#langChoicesDropdownItems .dropdown-item', ev => {
            ev.preventDefault();
            //let oldLocale = Cookies.get('currentLocale');
            let langChoice = $(ev.currentTarget).attr('id').split('-')[1];
            if( langChoice === 'la' ) {
                langChoice = 'lat';
            }
            Cookies.set('currentLocale', langChoice);
            //only reload if the value has changed
            if(Cookies.get('currentLocale') != LITCAL_LOCALE){
                location.reload();
            }
        });
    });
})(jQuery);
