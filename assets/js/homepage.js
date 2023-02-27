const { COUNTRIES, LITCAL_LOCALE } = ISO_3166_1_alpha_2;
let countryNames = new Intl.DisplayNames([LITCAL_LOCALE], {type: 'region'});
let CalendarNations = [];
let selectOptions = {};
let requestURL = {
    year: null,
    corpuschristi: null,
    epiphany: null,
    ascension: null,
    locale: null,
    returntype: null,
    nationalcalendar: null,
    diocesancalendar: null
};
let serializeRequestURL = function(obj){
    let parameters = [];
    for (const key in obj) {
        if(obj[key] != null && obj[key] != ''){
            parameters.push(key + "=" + encodeURIComponent(obj[key]));
        }
    }
    return parameters.join('&');
};

(function ($) {
    $.getJSON( MetaDataURL, data => {
        const { LitCalMetadata } = data;
        const { NationalCalendars, DiocesanCalendars } = LitCalMetadata;
        for(const [key,value] of Object.entries(DiocesanCalendars)){
            if(CalendarNations.indexOf(value.nation) === -1){
                CalendarNations.push(value.nation);
                selectOptions[value.nation] = [];
            }
            selectOptions[value.nation].push(`<option data-calendartype="diocesancalendar" value="${key}">${value.diocese}</option>`);
        }

        let nations = Object.keys( NationalCalendars );
        nations.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])))
        nations.forEach(item => {
            if( false === CalendarNations.includes(item) ) {
                $('#APICalendarSelect').append(`<option data-calendartype="nationalcalendar" value="${item}">${countryNames.of(COUNTRIES[item])}</option>`);
            }
        });

        CalendarNations.sort((a, b) => countryNames.of(COUNTRIES[a]).localeCompare(countryNames.of(COUNTRIES[b])));
        CalendarNations.forEach(item => {
            $('#APICalendarSelect').append(`<option data-calendartype="nationalcalendar" value="${item}">${countryNames.of(COUNTRIES[item])}</option>`);
            let $optGroup = $(`<optgroup label="${countryNames.of(COUNTRIES[item])}">`);
            $('#APICalendarSelect').append($optGroup);
            selectOptions[item].forEach(groupItem => $optGroup.append(groupItem));
        });
    });

    $(document).on('change','#APICalendarSelect',function(){
        if($(this).val() != "" && $(this).val() != "VATICAN" ){
            let calendarType = $(this).find(':selected').attr("data-calendartype");
            switch(calendarType){
                case 'nationalcalendar':
                    requestURL.nationalcalendar = $(this).val();
                    requestURL.diocesancalendar = null;
                    break;
                case 'diocesancalendar':
                    requestURL.diocesancalendar = $(this).val();
                    requestURL.nationalcalendar = null;
                    break;
            }
        } else {
            requestURL.nationalcalendar = null;
            requestURL.diocesancalendar = null;
        }
        requestURL.locale = null;
        requestURL.ascension = null;
        requestURL.corpuschristi = null;
        requestURL.epiphany = null;
        $('.requestOption').val('');
        let requestURL_encoded = serializeRequestURL(requestURL);
        $('#RequestURLExample').text(`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
        $('#RequestURLButton').attr('href',`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
    });

    $(document).on('change','#RequestOptionReturnType',function(){
        requestURL.returntype = $(this).val();
        let requestURL_encoded = serializeRequestURL(requestURL);
        $('#RequestURLExample').text(`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
        $('#RequestURLButton').attr('href',`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
    });

    $(document).on('change','.requestOption',function(){
        $('#APICalendarSelect').val("");
        requestURL.nationalcalendar = null;
        requestURL.diocesancalendar = null;
        switch($(this).attr("id")){
            case 'RequestOptionEpiphany':
                requestURL.epiphany = $(this).val();
                break;
            case 'RequestOptionCorpusChristi':
                requestURL.corpuschristi = $(this).val();
                break;
            case 'RequestOptionAscension':
                requestURL.ascension = $(this).val();
                break;
            case 'RequestOptionLocale':
                requestURL.locale = $(this).val();
                break;
        }
        let requestURL_encoded = serializeRequestURL(requestURL);
        $('#RequestURLExample').text(`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
        $('#RequestURLButton').attr('href',`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
    });

    $(document).on('change','#RequestOptionYear',function(){
        requestURL.year = $(this).val();
        let requestURL_encoded = serializeRequestURL(requestURL);
        $('#RequestURLExample').text(`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
        $('#RequestURLButton').attr('href',`${RequestURLBase}${requestURL_encoded!=''?'?':''}${requestURL_encoded}`);
    });

})(jQuery);
/*
const onlyUnique = function(value, index, self) {
    return self.indexOf(value) === index;
}
*/
