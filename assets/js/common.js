String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        let t = typeof arguments[0];
        let args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (const key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

Object.filter = (obj, predicate) =>
    Object.keys(obj)
      .filter( key => predicate(obj[key]) )
      .reduce( (res, key) => (res[key] = obj[key], res), {} );

const isStaging = location.href.includes('-staging');
const endpointV = isStaging ? 'dev' : 'v3';
const MetaDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/calendars`;
const RegionalDataURL = `https://litcal.johnromanodorazio.com/api/${endpointV}/data`;
const RequestURLBase = `https://litcal.johnromanodorazio.com/api/${endpointV}/`;

$(document).on('click', '.sidebarToggle', event => {
    event.preventDefault();
    if(document.body.classList.contains('sb-sidenav-collapsed') ) {
        $('.sidebarToggle i').removeClass('fa-angle-right').addClass('fa-angle-left');
    }
    else {
        $('.sidebarToggle i').removeClass('fa-angle-left').addClass('fa-angle-right');
    }
    document.body.classList.toggle('sb-sidenav-collapsed');
});
