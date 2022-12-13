<?php 
$currentPage = basename($_SERVER["SCRIPT_FILENAME"], '.php');

$isStaging = ( strpos( $_SERVER['HTTP_HOST'], "-staging" ) !== false );
$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
$endpointURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalEngine.php";
$metadataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/LitCalMetadata.php";
$dateOfEasterURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/DateOfEaster.php";

?>

<!-- Page Wrapper -->
<div id="wrapper">

    <!-- Sidebar -->
    <ul class="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion" id="accordionSidebar">

        <!-- Sidebar - Brand -->
        <li>
            <a class="sidebar-brand d-flex align-items-center justify-content-center" href="/">
                <div class="sidebar-brand-text mx-3"><?php echo _( "Catholic Liturgical Calendar" ); ?></div>
            </a>
        </li>

        <!-- Divider -->
        <li>
            <hr class="sidebar-divider my-0" />
        </li>

        <!-- Nav Item - Dashboard -->
        <li class="nav-item<?php echo $currentPage === "index" || $currentPage === "" ? " active" : "" ?>">
            <a class="nav-link" href="/">
                <i class="fas fa-fw fa-cross"></i>
                <span><?php echo _( "Home" ); ?></span>
            </a>
        </li>

        <!-- Divider -->
        <li>
            <hr class="sidebar-divider" />
        </li>

        <!-- Heading -->
        <li>
            <div class="sidebar-heading<?php echo $currentPage === "index" || $currentPage === "" ? " text-white" : "" ?>">
            <?php echo "API"; ?>
            </div>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="extending.php?choice=diocesan">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Extending the API" ); ?></span>
            </a>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="/dist/">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Documentation" ); ?></span>
            </a>
        </li>

        <!-- Divider -->
        <li>
            <hr class="sidebar-divider" />
        </li>

        <!-- Heading -->
        <li>
            <div class="sidebar-heading<?php echo $currentPage === "usage" ? " text-white" : "" ?>">
                <?php echo _( "Examples of Usage" ); ?>
            </div>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="usage.php#webCalendar">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Web calendar" ); ?></span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="usage.php#calSubscription">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Calendar subscription" ); ?></span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="usage.php#datesOfEaster">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Dates of Easter" ); ?></span></a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="usage.php#liturgyOfTheDay">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Liturgy of the Day" ); ?></span></a>
        </li>

        <!-- Divider -->
        <li>
            <hr class="sidebar-divider" />
        </li>

        <!-- Sidebar Toggler (Sidebar) -->
        <li>
            <div class="text-center d-none d-md-block">
                <button class="rounded-circle border-0" id="sidebarToggle"></button>
            </div>
        </li>
    </ul>
    <!-- End of Sidebar -->

    <!-- Content Wrapper -->
    <div id="content-wrapper" class="d-flex flex-column">

        <!-- Main Content -->
        <div id="content">
            <!-- Topbar -->
            <nav class="navbar navbar-expand navbar-light bg-white mb-4 static-top shadow">

                <!-- Sidebar Toggle (Topbar) -->
                <button id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3">
                    <i class="fa fa-bars"></i>
                </button>

                <!-- Topbar Navbar -->
                <ul class="navbar-nav">
                    <li class="nav-item<?php echo $currentPage=="index" || $currentPage == "" ? " active" : ""; ?>" id="topNavBar_API"><a class="nav-link<?php echo $currentPage=="index" || $currentPage == "" ? " font-weight-bold" : ""; ?>" href="./index.php">API</a></li>
                    <li class="nav-item dropdown<?php echo $currentPage=="extending" ? " active" : ""; ?>" id="topNavBar_Extending">
                        <a class="nav-link dropdown-toggle<?php echo $currentPage=="extending" ? " font-weight-bold" : ""; ?>" style="white-space: normal;" href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" id="extendingChoicesDropdown">
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
                        <a class="nav-link dropdown-toggle" href="#" id="langChoicesDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                          English
                        </a>
                        <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="langChoicesDropdown" id="langChoicesDropdownItems">
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="en" ? " active" : "" ?>" id="langChoiceEnglish" href="#"><span class="d-none d-md-inline">English</span><span class="d-inline d-md-none">EN</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="fr" ? " active" : "" ?>" id="langChoiceFrench" href="#"><span class="d-none d-md-inline">French</span><span class="d-inline d-md-none">FR</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="de" ? " active" : "" ?>" id="langChoiceGerman" href="#"><span class="d-none d-md-inline">German</span><span class="d-inline d-md-none">DE</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="it" ? " active" : "" ?>" id="langChoiceItalian" href="#"><span class="d-none d-md-inline">Italian</span><span class="d-inline d-md-none">IT</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="la" ? " active" : "" ?>" id="langChoiceLatin" href="#"><span class="d-none d-md-inline">Latin</span><span class="d-inline d-md-none">LA</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="pt" ? " active" : "" ?>" id="langChoicePortuguese" href="#"><span class="d-none d-md-inline">Portuguese</span><span class="d-inline d-md-none">PT</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="es" ? " active" : "" ?>" id="langChoiceSpanish" href="#"><span class="d-none d-md-inline">Spanish</span><span class="d-inline d-md-none">ES</span></a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="nl" || $i18n->LOCALE === "nl_NL" ? " active" : "" ?>" id="langChoiceDutch" href="#"><span class="d-none d-md-inline">Dutch</span><span class="d-inline d-md-none">NL</span></a>
                        </div>
                      </li>
                </ul>

                <a class="btn btn-transparent-dark mr-2"
                    href="https://github.com/Liturgical-Calendar/" target="_blank"
                    title="See the project repositories on GitHub">
                    <i class="fab fa-github"></i>
                </a>
            </nav>
            <div class="container-fluid">
