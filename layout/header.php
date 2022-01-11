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
            <?php echo _( "Scripts" ); ?>
            </div>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="<?php echo $endpointURL ?>">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "API endpoint" ); ?></span></a>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="/dist/">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Swagger / Open API Docs" ); ?></span></a>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="<?php echo $dateOfEasterURL ?>">
                <i class="fas fa-fw fa-folder"></i>
                <span><?php echo _( "Date of Easter API" ); ?></span></a>
        </li>

        <!-- Divider -->
        <li>
            <hr class="sidebar-divider" />
        </li>

        <!-- Heading -->
        <li>
            <div class="sidebar-heading<?php echo $currentPage === "usage" ? " text-white" : "" ?>">
                <?php echo _( "Examples" ); ?>
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

        <!-- Heading -->
        <li>
            <div class="sidebar-heading<?php echo $currentPage === "extending" ? " text-white" : "" ?>">
                <?php echo _( "Extending the API" ); ?>
            </div>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="/extending.php?choice=national">
                <i class="fas fa-fw fa-folder<?php echo $currentPage === "extending" && $_GET["choice"] === "national" ? " text-white" : "" ?>"></i>
                <span class="<?php echo $currentPage === "extending" && $_GET["choice"] === "national" ? "text-white" : "" ?>"><?php echo _("National Calendar") ?></span></a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="/extending.php?choice=diocesan">
                <i class="fas fa-fw fa-folder<?php echo $currentPage === "extending" && $_GET["choice"] === "diocesan" ? " text-white" : "" ?>"></i>
                <span class="<?php echo $currentPage === "extending" && $_GET["choice"] === "diocesan" ? "text-white" : "" ?>"><?php echo _("Diocesan Calendar") ?></span></a>
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
                    <li class="nav-item<?php echo $currentPage=="usage" ? " active" : ""; ?>" id="topNavBar_Usage"><a class="nav-link<?php echo $currentPage=="usage" ? " font-weight-bold" : ""; ?>" href="./usage.php"><?php echo _( "Usage" ); ?></a></li>
                    <li class="nav-item dropdown<?php echo $currentPage=="extending" ? " active" : ""; ?>" id="topNavBar_Extending">
                        <a class="nav-link dropdown-toggle<?php echo $currentPage=="extending" ? " font-weight-bold" : ""; ?>" href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" id="extendingChoicesDropdown"><?php echo _( "Extending the API" ); ?></a>
                        <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="extendingChoicesDropdown" id="extendingChoicesDropdownItems">
                            <a class="dropdown-item<?php echo isset($_GET["choice"]) && $_GET["choice"]==="national"?" active":"" ?>" id="extendingChoiceNationalCalendar" href="./extending.php?choice=national"><?php echo _( "Create a National Calendar" ); ?></a>
                            <a class="dropdown-item<?php echo isset($_GET["choice"]) && $_GET["choice"]==="diocesan"?" active":"" ?>" id="extendingChoiceDiocesanCalendar" href="./extending.php?choice=diocesan"><?php echo _( "Create a Diocesan Calendar" ); ?></a>
                        </div>
                    </li>
                    <li class="nav-item<?php echo $currentPage=="about" ? " active" : ""; ?>" id="topNavBar_AboutUs"><a class="nav-link<?php echo $currentPage=="about" ? " font-weight-bold" : ""; ?>" href="./about.php"><?php echo _( "About us" ); ?></a></li>
                </ul>                
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item dropdown">
                        <!-- this should contain the value of the currently selected language, based on a cookie -->
                        <a class="nav-link dropdown-toggle" href="#" id="langChoicesDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                          English
                        </a>
                        <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="langChoicesDropdown" id="langChoicesDropdownItems">
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="en" ? " active" : "" ?>" id="langChoiceEnglish" href="#">English</a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="fr" ? " active" : "" ?>" id="langChoiceFrench" href="#">French</a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="de" ? " active" : "" ?>" id="langChoiceGerman" href="#">German</a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="it" ? " active" : "" ?>" id="langChoiceItalian" href="#">Italian</a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="la" ? " active" : "" ?>" id="langChoiceLatin" href="#">Latin</a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="pt" ? " active" : "" ?>" id="langChoicePortuguese" href="#">Portuguese</a>
                          <a class="dropdown-item<?php echo $i18n->LOCALE==="es" ? " active" : "" ?>" id="langChoiceSpanish" href="#">Spanish</a>
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
