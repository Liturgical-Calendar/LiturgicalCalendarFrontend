jQuery(() => {
    
});

$(document).on("change", "#monthControl,#yearControl", ev => {
    let year =  $('#yearControl').val();
    let month = $('#monthControl').val();
    let daysInMonth = new Date(year, month, 0).getDate();
    $('#dayControl').attr("max",daysInMonth);
});