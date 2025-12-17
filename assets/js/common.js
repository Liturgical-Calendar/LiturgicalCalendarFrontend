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

$(document).on('click', '.sidebarToggle', event => {
    event.preventDefault();
    // Only toggle icon direction for buttons with angle icons (sidebar bottom button)
    // Leave the fa-table-columns icon (topnav button) unchanged
    const isCollapsed = document.body.classList.contains('sb-sidenav-collapsed');
    $('.sidebarToggle i.fa-angle-left, .sidebarToggle i.fa-angle-right')
        .removeClass(isCollapsed ? 'fa-angle-right' : 'fa-angle-left')
        .addClass(isCollapsed ? 'fa-angle-left' : 'fa-angle-right');
    document.body.classList.toggle('sb-sidenav-collapsed');
});
