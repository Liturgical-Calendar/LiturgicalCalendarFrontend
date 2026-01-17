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
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css"
    integrity="sha512-2SwdPD6INVrV/lHTZbO2nodKhrnDdJK9/kg2XD1r9uGqPo1cUbujc+IYdlYdEErWNu69gVcYgdxlmVmzTWnetw=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer" />
<link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">

<!-- Custom styles for this template-->
<link href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin@7.0.7/dist/css/styles.css" rel="stylesheet">
<link href="assets/css/liturgicalcalendar.css" rel="stylesheet">
<?php
    //some assets are only needed on certain pages
    $pageName = basename($_SERVER['SCRIPT_FILENAME'], '.php');
if (file_exists("assets/css/{$pageName}.css")) {
    echo "<link href=\"assets/css/{$pageName}.css\" rel=\"stylesheet\">";
}
if ($pageName === 'index') {
    echo '<link href="assets/css/homepage.css" rel="stylesheet">';
}
if (in_array($pageName, [ 'index', 'extending', 'usage', 'admin', 'examples' ])) {
    echo '<link href="https://cdn.jsdelivr.net/npm/bootstrap-multiselect@2.0.0/dist/css/bootstrap-multiselect.min.css" rel="stylesheet">';
    echo '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.css" '
        . 'integrity="sha512-6S2HWzVFxruDlZxI3sXOZZ4/eJ8AcxkQH1+JjSe/ONCEqR9L4Ysq5JdT5ipqtzU7WHalNwzwBv+iE51gNHJNqQ==" '
        . 'crossorigin="anonymous" referrerpolicy="no-referrer" />';
}
if ('extending' === $pageName) {
    echo '<link rel="preconnect" href="https://fonts.googleapis.com">';
    echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    echo '<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">';
}
?>
