<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<link rel="icon" type="image/x-icon" href="favicon.ico">
<meta name="msapplication-TileColor" content="#ffffff"/>
<meta name="msapplication-TileImage" content="assets/img/easter-egg-5-144-279148.png">
<link rel="apple-touch-icon-precomposed" sizes="152x152" href="assets/img/easter-egg-5-152-279148.png">
<link rel="apple-touch-icon-precomposed" sizes="144x144" href="assets/img/easter-egg-5-144-279148.png">
<link rel="apple-touch-icon-precomposed" sizes="120x120" href="assets/img/easter-egg-5-120-279148.png">
<link rel="apple-touch-icon-precomposed" sizes="114x114" href="assets/img/easter-egg-5-114-279148.png">
<link rel="apple-touch-icon-precomposed" sizes="72x72" href="assets/img/easter-egg-5-72-279148.png">
<link rel="apple-touch-icon-precomposed" href="assets/img/easter-egg-5-57-279148.png">
<link rel="icon" href="assets/img/easter-egg-5-32-279148.png" sizes="32x32">

<!-- Custom fonts for this template-->
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.1/css/all.min.css" rel="stylesheet" type="text/css">
<link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">

<!-- Custom styles for this template-->
<link href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin@7.0.5/dist/css/styles.css" rel="stylesheet">
<link href="assets/css/liturgicalcalendar.css" rel="stylesheet">
<?php 
    //some assets are only needed on certain pages
    $pageName = basename($_SERVER["SCRIPT_FILENAME"], '.php');
    if( file_exists( "assets/css/{$pageName}.css" ) ) {
        echo "<link href=\"assets/css/{$pageName}.css\" rel=\"stylesheet\">";
    }
    if($pageName === "index"){
        echo '<link href="assets/css/homepage.css">';
    }
    if( in_array( $pageName, [ 'extending', 'usage', 'admin' ] ) ) {
        echo '<link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-multiselect/1.1.1/css/bootstrap-multiselect.min.css" rel="stylesheet">';
        echo '<link href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css" rel="stylesheet">';
    }
?>
