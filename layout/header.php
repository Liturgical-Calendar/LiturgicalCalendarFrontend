<?php 
$currentPage = basename($_SERVER["SCRIPT_FILENAME"], '.php');

$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
$endpointURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalEngine.php";
$metadataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalMetadata.php";
$dateOfEasterURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/DateOfEaster.php";

?>

<!-- Topbar -->
<nav class="sb-topnav navbar navbar-expand navbar-light bg-white shadow">
    <!-- Navbar Brand -->
    <a class="navbar-brand ps-3" href="/">Navbar</a>

    <!-- Sidebar Toggle (Topbar) -->
    <button class="btn btn-link btn-sm order-1 order-lg-0 me-4 me-lg-0" id="sidebarToggle"><i class="fas fa-bars"></i></button>

    <!-- Topbar Navbar -->
    <ul class="navbar-nav ms-auto ms-md-0 me-3 me-lg-4">
        <li class="nav-item<?php echo $currentPage=="index" || $currentPage == "" ? " active" : ""; ?>" id="topNavBar_API"><a class="nav-link<?php echo $currentPage=="index" || $currentPage == "" ? " font-weight-bold" : ""; ?>" href="./index.php">API</a></li>
        <li class="nav-item dropdown<?php echo $currentPage=="extending" ? " active" : ""; ?>" id="topNavBar_Extending">
            <a class="nav-link dropdown-toggle<?php echo $currentPage=="extending" ? " font-weight-bold" : ""; ?>" style="white-space: normal;" href="#" role="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" id="extendingChoicesDropdown">
                <?php echo _( "Extending the API" ); ?>
            </a>
            <div class="dropdown-menu dropdown-menu-left shadow animated--grow-in" aria-labelledby="extendingChoicesDropdown" id="extendingChoicesDropdownItems">
                <a class="dropdown-item<?php echo isset($_GET["choice"]) && $_GET["choice"]==="widerRegion"?" active":"" ?>" id="extendingChoiceWiderRegion" href="./extending.php?choice=widerRegion"><?php echo _( "Create a Calendar for a Wider Region" ); ?></a>
                <a class="dropdown-item<?php echo isset($_GET["choice"]) && $_GET["choice"]==="national"?" active":"" ?>" id="extendingChoiceNationalCalendar" href="./extending.php?choice=national"><?php echo _( "Create a National Calendar" ); ?></a>
                <a class="dropdown-item<?php echo isset($_GET["choice"]) && $_GET["choice"]==="diocesan"?" active":"" ?>" id="extendingChoiceDiocesanCalendar" href="./extending.php?choice=diocesan"><?php echo _( "Create a Diocesan Calendar" ); ?></a>
            </div>
        </li>
        <li class="nav-item<?php echo $currentPage=="usage" ? " active" : ""; ?>" id="topNavBar_Usage"><a class="nav-link<?php echo $currentPage=="usage" ? " font-weight-bold" : ""; ?>" href="./usage.php"><?php echo _( "Usage" ); ?></a></li>
        <li class="nav-item<?php echo $currentPage=="about" ? " active" : ""; ?>" id="topNavBar_AboutUs"><a class="nav-link<?php echo $currentPage=="about" ? " font-weight-bold" : ""; ?>" href="./about.php"><?php echo _( "About us" ); ?></a></li>
    </ul>                
    <ul class="navbar-nav ml-auto">
        <li class="nav-item dropdown">
            <!-- this should contain the value of the currently selected language, based on a cookie -->
            <a class="nav-link dropdown-toggle" href="#" id="langChoicesDropdown" role="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                English
            </a>
            <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="langChoicesDropdown" id="langChoicesDropdownItems">
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "en" ? " active" : "" ?>" id="langChoiceEnglish" href="#"><span class="d-none d-md-inline">English</span><span class="d-inline d-md-none">EN</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "fr" ? " active" : "" ?>" id="langChoiceFrench" href="#"><span class="d-none d-md-inline">French</span><span class="d-inline d-md-none">FR</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "de" ? " active" : "" ?>" id="langChoiceGerman" href="#"><span class="d-none d-md-inline">German</span><span class="d-inline d-md-none">DE</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "it" ? " active" : "" ?>" id="langChoiceItalian" href="#"><span class="d-none d-md-inline">Italian</span><span class="d-inline d-md-none">IT</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "la" ? " active" : "" ?>" id="langChoiceLatin" href="#"><span class="d-none d-md-inline">Latin</span><span class="d-inline d-md-none">LA</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "pt" ? " active" : "" ?>" id="langChoicePortuguese" href="#"><span class="d-none d-md-inline">Portuguese</span><span class="d-inline d-md-none">PT</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "es" ? " active" : "" ?>" id="langChoiceSpanish" href="#"><span class="d-none d-md-inline">Spanish</span><span class="d-inline d-md-none">ES</span></a>
                <a class="dropdown-item<?php echo substr( $i18n->LOCALE, 0 ,2 ) === "nl" ? " active" : "" ?>" id="langChoiceDutch" href="#"><span class="d-none d-md-inline">Dutch</span><span class="d-inline d-md-none">NL</span></a>
            </div>
            </li>
    </ul>

    <a class="btn btn-transparent-dark mr-2"
        href="https://github.com/Liturgical-Calendar/" target="_blank"
        title="See the project repositories on GitHub">
        <i class="fab fa-github"></i>
    </a>
</nav>


<!-- Page Wrapper -->
<div id="layoutSidenav">

    <div id="layoutSidenav_nav">

        <!-- Sidebar -->
        <nav class="sb-sidenav accordion sb-sidenav-dark bg-gradient" id="accordionSidebar">
            <div class="sb-sidenav-menu">
                <div class="nav">
                    <!-- Sidebar - Brand -->
                    <div class="text-center lh-2 px-5 pt-2">
                        <a class="text-uppercase fs-6 fw-bold text-white text-decoration-none" href="/">
                            <?php echo _( "Catholic Liturgical Calendar" ); ?>
                        </a>
                    </div>
                    <!-- <hr> -->
                    <a class="nav-link<?php echo in_array($currentPage, ["", "index"]) ? " active" : "" ?>" href="/">
                        <i class="sb-nav-link-icon fas fa-fw fa-cross"></i>
                        <span><?php echo _( "Home" ); ?></span>
                    </a>
                    <!-- <hr> -->
                    <div class="sb-sidenav-menu-heading<?php echo in_array($currentPage, ["", "index", "extending"]) ? " text-white" : "" ?>">
                        <?php echo "API"; ?>
                    </div>
                    <a class="nav-link<?php echo $currentPage === "extending" ? " active" : "" ?>" href="extending.php?choice=diocesan">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _( "Extending the API" ); ?></span>
                    </a>
                    <a class="nav-link" href="/dist/">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _( "Documentation" ); ?></span>
                    </a>
                    <!-- <hr> -->
                    <div class="sb-sidenav-menu-heading<?php echo $currentPage === "usage" ? " text-white" : "" ?>">
                        <?php echo _( "Examples of Usage" ); ?>
                    </div>
                    <a class="nav-link" href="usage.php#webCalendar">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _( "Web calendar" ); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#calSubscription">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _( "Calendar subscription" ); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#datesOfEaster">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _( "Dates of Easter" ); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#liturgyOfTheDay">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _( "Liturgy of the Day" ); ?></span>
                    </a>

                </div>
            </div>
            <div class="sb-sidenav-footer">
                <!-- Sidebar Toggler (Sidebar) -->
                <div class="text-center">
                    <button class="rounded-circle border-0" id="sidebarToggleB"></button>
                </div>
            </div>

        </nav>
    </div>
    <!-- End of Sidebar (layoutSidenav_nav) -->

    <!-- Content Wrapper -->
    <div id="layoutSidenav_content" class="pt-4">

        <!-- Main Content -->
        <main>
            <div class="container-fluid px-4">
