const isStaging = location.href.includes( "-staging" );
const endpointV = isStaging ? "namespaced" : "v3";
const endpointURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/?`;

if( typeof currentLocale === 'undefined' ) {
    currentLocale = new Intl.Locale(Cookies.get('currentLocale').replaceAll('_','-') || 'en');
}

i18next.use(i18nextHttpBackend).init({
    debug: true,
    lng: currentLocale.language,
    backend: {
        loadPath: '/assets/locales/{{lng}}/{{ns}}.json'
    }
  }, () => { //(err, t)
    // for options see
    // https://github.com/i18next/jquery-i18next#initialize-the-plugin
    jqueryI18next.init(i18next, $);

    // start localizing, details:
    // https://github.com/i18next/jquery-i18next#usage-of-selector-function
    //$('.nav').localize();
    //$('.content').localize();
  });

let queryString = '';
let cookieVal = Cookies.get('queryString');
if(typeof cookieVal !== 'undefined') {
    console.log('looks like we have a queryString cookie?');
    let cookieObj = JSON.parse(cookieVal);
    queryString = cookieObj.queryString;
    $('#calendarSelect').val(cookieObj.calendar);
} else {
    console.log('no queryString cookie found, will load default results...');
}
jQuery(() => {
    i18next.on('initialized', () => {
        setTranslations();
        getLiturgyOfADay(typeof cookieVal !== 'undefined');
    });
});
let CalData = {};
let dtFormat = new Intl.DateTimeFormat(currentLocale.language, { dateStyle: 'full', timeZone: 'UTC' });
let newDate = new Date();
let highContrast = [ "green", "red", "purple" ];
let commonsMap = {};
let translGrade = [];

const setTranslations = () => {

    commonsMap = {
        "For-One-Martyr"                          : i18next.t( "For-One-Martyr" ),
        "For-Several-Martyrs"                     : i18next.t( "For-Several-Martyrs" ),
        "For-Missionary-Martyrs"                  : i18next.t( "For-Missionary-Martyrs" ),
        "For-One-Missionary-Martyr"               : i18next.t( "For-One-Missionary-Martyr" ),
        "For-Several-Missionary-Martyrs"          : i18next.t( "For-Several-Missionary-Martyrs" ),
        "For-a-Virgin-Martyr"                     : i18next.t( "For-a-Virgin-Martyr" ),
        "For-a-Holy-Woman-Martyr"                 : i18next.t( "For-a-Holy-Woman-Martyr" ),
        "For-a-Pope"                              : i18next.t( "For-a-Pope" ),
        "For-a-Bishop"                            : i18next.t( "For-a-Bishop" ),
        "For-One-Pastor"                          : i18next.t( "For-One-Pastor" ),
        "For-Several-Pastors"                     : i18next.t( "For-Several-Pastors" ),
        "For-Founders-of-a-Church"                : i18next.t( "For-Founders-of-a-Church" ),
        "For-One-Founder"                         : i18next.t( "For-One-Founder" ),
        "For-Several-Founders"                    : i18next.t( "For-Several-Founders" ),
        "For-Missionaries"                        : i18next.t( "For-Missionaries" ),
        "For-One-Virgin"                          : i18next.t( "For-One-Virgin" ),
        "For-Several-Virgins"                     : i18next.t( "For-Several-Virgins" ),
        "For-Several-Saints"                      : i18next.t( "For-Several-Saints" ),
        "For-One-Saint"                           : i18next.t( "For-One-Saint" ),
        "For-an-Abbot"                            : i18next.t( "For-an-Abbot" ),
        "For-a-Monk"                              : i18next.t( "For-a-Monk" ),
        "For-a-Nun"                               : i18next.t( "For-a-Nun" ),
        "For-Religious"                           : i18next.t( "For-Religious" ),
        "For-Those-Who-Practiced-Works-of-Mercy"  : i18next.t( "For-Those-Who-Practiced-Works-of-Mercy" ),
        "For-Educators"                           : i18next.t( "For-Educators" ),
        "For-Holy-Women"                          : i18next.t( "For-Holy-Women" )
    };

    translGrade = [
        i18next.t( "weekday" ),
        i18next.t( "Commemoration" ),
        i18next.t( "Optional-memorial" ),
        i18next.t( "Memorial" ),
        i18next.t( "FEAST" ),
        i18next.t( "FEAST-OF-THE-LORD" ),
        i18next.t( "SOLEMNITY" )
    ];

};

$(document).on("change", "#monthControl,#yearControl", () => {
    let year =  $('#yearControl').val();
    let month = $('#monthControl').val();
    let daysInMonth = new Date(year, month, 0).getDate();
    $('#dayControl').attr("max",daysInMonth);
    getLiturgyOfADay();
});

$(document).on("change", "#calendarSelect,#dayControl", () => {
    getLiturgyOfADay();
});

let getLiturgyOfADay = (useCookie=false) => {
    let newQueryString = '';
    let year;
    let month;
    let day;
    if(useCookie && typeof Cookies.get('queryString') !== 'undefined' ){
        let cookieVal = JSON.parse(Cookies.get('queryString'));
        year = cookieVal.year;
        month = cookieVal.month;
        day = cookieVal.day;
        queryString = cookieVal.queryString;
        newQueryString = queryString;
    } else {
        year =  $('#yearControl').val();
        month = $('#monthControl').val();
        day = $('#dayControl').val();

        let params = {
            year: year
        };
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
        newQueryString = new URLSearchParams(params).toString();
    }
    console.log(`queryString = ${queryString}, year = ${year}, month = ${month}, day = ${day}`);
    Cookies.set('queryString', JSON.stringify({queryString: newQueryString, year: year, month: month, day: day, calendar: $('#calendarSelect').val()}));
    newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    let timestamp = newDate.getTime() / 1000;

    if( newQueryString !== queryString || useCookie === true ) {
        console.log(`queryString = ${queryString}, newQueryString = ${newQueryString}`);
        if(false === useCookie) {
            console.log( 'queryString has changed. queryString = ' + queryString + ', newQueryString = ' + newQueryString );
            queryString = newQueryString;
        } else {
            console.log('we have a cookie with the last settings used, since this is a new page or page refresh we will use that information...');
        }
        $.getJSON( `${endpointURL}${queryString}`, data => {
            if( data.hasOwnProperty('LitCal') ) {
                CalData = data.LitCal;
                console.log( 'now filtering entries with a date value of ' + timestamp );
                //key === key is superfluous, it's just to make codefactor happy that key is being used!
                let liturgyOfADay = Object.entries(CalData).filter(([key, value]) => parseInt(value.date) === timestamp && key === key );
                updateResults(liturgyOfADay);
            } else {
                $('#liturgyResults').append(`<div>ERROR: no LitCal property: ${JSON.stringify(data)}</div>`);
            }
        });
    } else {
        console.log( 'queryString has not changed, no need for a new ajax request: ' + queryString );
        //key === key is superfluous, it's just to make codefactor happy that key is being used!
        let liturgyOfADay = Object.entries(CalData).filter(([key, value]) => parseInt(value.date) === timestamp && key === key );
        updateResults( liturgyOfADay );
    }
}

const filterTagsDisplayGrade = [
    /OrdSunday[0-9]{1,2}(_vigil){0,1}/,
    /Advent[1-4](_vigil){0,1}/,
    /Lent[1-5](_vigil){0,1}/,
    /Easter[1-7](_vigil){0,1}/
];

const universalCommons = [
    "Blessed Virgin Mary",
    "Virgins",
    "Martyrs",
    "Pastors",
    "Doctors",
    "Holy Men and Women",
    "Dedication of a Church"
];

const translCommon = common => {
    if( common.includes( 'Proper' ) ) {
        return i18next.t('Proper');
    } else {
        commons = common.map(txt => {
            let common = txt.split(":");
            if( universalCommons.includes(common[0]) ) {
                let commonGeneral = i18next.t(common[0].replaceAll(' ', '-'));
                let commonSpecific = (typeof common[1] !== 'undefined' && common[1] != "") ? i18next.t(common[1].replaceAll(' ', '-')) : "";
                let commonKey = '';
                switch (commonGeneral) {
                    case i18next.t("Blessed-Virgin-Mary"):
                        commonKey = i18next.t("of", {context: "(SING_FEMM)"});
                        break;
                    case i18next.t("Virgins"):
                        commonKey = i18next.t("of", {context: "(PLUR_FEMM)"});
                        break;
                    case i18next.t("Martyrs"):
                    case i18next.t("Pastors"):
                    case i18next.t("Doctors"):
                    case i18next.t("Holy-Men-and-Women"):
                        commonKey = i18next.t("of", {context: "(PLUR_MASC)"});
                        break;
                    case i18next.t("Dedication-of-a-Church"):
                        commonKey = i18next.t("of", {context: "(SING_FEMM)"});
                        break;
                    default:
                        commonKey = i18next.t("of", {context: "(SING_MASC)"});
                }
                return i18next.t("From-the-Common") + " " + commonKey + " " + commonGeneral + (commonSpecific != "" ? ": " + commonsMap[(common[1].replaceAll(' ', '-'))] : "");
            } else {
                return i18next.t("From-the-Common") + " " + i18next.t("of") + " " + txt.split(':').join(': ');
            }
        });
        return commons.join("; " + i18next.t("or") + " ");
    }
}

let updateResults = liturgyOfADay => {
    $('#dateOfLiturgy').text( dtFormat.format(newDate) );
    $('#liturgyResults').empty();
    liturgyOfADay.forEach(([tag,eventData]) => {
        const lclzdGrade = eventData.grade < 7 ? translGrade[eventData.grade] : '';
        const isSundayOrdAdvLentEaster = filterTagsDisplayGrade.some(pattern => pattern.test(tag));
        const eventDataGrade = eventData.displayGrade !== '' ? 
          eventData.displayGrade : (!isSundayOrdAdvLentEaster ? lclzdGrade : '');
        const eventDataCommon = eventData.common.length ? translCommon(eventData.common) : '';
        const eventDataColor = eventData.color;
        let finalHTML = `<div class="p-4 m-4 border rounded" style="background-color:${eventDataColor[0]};color:${highContrast.includes(eventDataColor[0]) ? "white" : "black"};">`;
        finalHTML += `<h3>${eventData.name}</h3>`;
        finalHTML += (eventDataGrade !== '' ? `<div>${eventDataGrade}</div>` : '');
        finalHTML += `<div>${eventDataCommon }</div>`;
        finalHTML += (eventData.hasOwnProperty('liturgicalYear') ? `<div>${eventData.liturgicalYear}</div>` : '');
        finalHTML += `</div>`;
        $('#liturgyResults').append(finalHTML);
    });
}
