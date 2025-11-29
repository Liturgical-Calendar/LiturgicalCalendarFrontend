<?php
$currentPage = basename($_SERVER['SCRIPT_FILENAME'], '.php');

$i18nDirs       = glob('i18n/*', GLOB_ONLYDIR);
$langsAvailable = ['en', ...array_map('basename', $i18nDirs !== false ? $i18nDirs : [])];
$langsAssoc     = [];
foreach ($langsAvailable as $lang) {
    $langsAssoc[$lang] = Locale::getDisplayLanguage($lang, $i18n->LOCALE);
}
asort($langsAssoc);
?>
<!-- Topbar --><!-- Current page: <?php echo $currentPage; ?> -->
<nav class="sb-topnav navbar navbar-expand navbar-light bg-white shadow">
    <!-- Navbar Brand -->
    <a class="navbar-brand ps-3" href="/">Navbar</a>

    <!-- Sidebar Toggle (Topbar) -->
    <button class="btn btn-link btn-sm order-1 order-lg-0 me-4 me-lg-0" id="sidebarToggle"><i class="fas fa-bars"></i></button>

    <!-- Topbar Navbar -->
    <ul class="navbar-nav ms-auto ms-md-0 me-3 me-lg-4">
        <li class="nav-item ms-2" id="topNavBar_API">
            <a class="nav-link btn btn-outline-light border-0<?php echo $currentPage === 'index' || $currentPage === '' ? ' fw-bold active' : ''; ?>" href="./index.php">API</a>
        </li>
        <li class="nav-item ms-2 dropdown" id="topNavBar_Extending">
            <a class="nav-link dropdown-toggle btn btn-outline-light border-0<?php echo $currentPage === 'extending' ? ' fw-bold active' : ''; ?>" style="white-space: normal;" role="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" id="extendingChoicesDropdown">
                <?php echo _('Extending the API'); ?>
            </a>
            <div class="dropdown-menu dropdown-menu-left shadow animated--grow-in" aria-labelledby="extendingChoicesDropdown" id="extendingChoicesDropdownItems">
                <a class="dropdown-item<?php echo isset($_GET['choice']) && $_GET['choice'] === 'widerRegion' ? ' fw-bold active' : '' ?>" id="extendingChoiceWiderRegion" href="./extending.php?choice=widerRegion"><?php echo _('Create a Calendar for a Wider Region'); ?></a>
                <a class="dropdown-item<?php echo isset($_GET['choice']) && $_GET['choice'] === 'national' ? ' fw-bold active' : '' ?>" id="extendingChoiceNationalCalendar" href="./extending.php?choice=national"><?php echo _('Create a National Calendar'); ?></a>
                <a class="dropdown-item<?php echo isset($_GET['choice']) && $_GET['choice'] === 'diocesan' ? ' fw-bold active' : '' ?>" id="extendingChoiceDiocesanCalendar" href="./extending.php?choice=diocesan"><?php echo _('Create a Diocesan Calendar'); ?></a>
            </div>
        </li>
        <li class="nav-item ms-2" id="topNavBar_Usage">
            <a class="nav-link btn btn-outline-light border-0<?php echo $currentPage === 'usage' || $currentPage === 'examples' ? ' fw-bold active' : ''; ?>" href="./usage.php"><?php echo _('Usage'); ?></a>
        </li>
        <li class="nav-item ms-2" id="topNavBar_Translations">
            <a class="nav-link btn btn-outline-light border-0<?php echo $currentPage === 'translations' ? ' fw-bold active' : ''; ?>" href="./translations.php"><?php echo _('Translations'); ?></a>
        </li>
        <li class="nav-item ms-2" id="topNavBar_Decrees">
            <a class="nav-link btn btn-outline-light border-0<?php echo $currentPage === 'decrees' ? ' fw-bold active' : ''; ?>" href="./decrees.php"><?php echo _('Decrees'); ?></a>
        </li>
        <li class="nav-item ms-2" id="topNavBar_AboutUs">
            <a class="nav-link btn btn-outline-light border-0<?php echo $currentPage === 'about' ? ' fw-bold active' : ''; ?>" href="./about.php"><?php echo _('About us'); ?></a>
        </li>
    </ul>
    <ul class="navbar-nav ms-auto">
        <!-- Authentication Status -->
        <li class="nav-item" id="authStatus">
            <button class="nav-link btn btn-sm btn-outline-primary border-0 d-none" id="loginBtn" title="<?php echo _('Login'); ?>">
                <i class="fas fa-sign-in-alt"></i>
                <span class="d-none d-md-inline ms-1"><?php echo _('Login'); ?></span>
            </button>
            <div class="btn-group d-none" id="userMenu">
                <button type="button" class="nav-link btn btn-sm btn-outline-success border-0" id="userInfo">
                    <i class="fas fa-user"></i>
                    <span class="d-none d-md-inline ms-1" id="username"></span>
                </button>
                <button type="button" class="nav-link btn btn-sm btn-outline-danger border-0" id="logoutBtn" title="<?php echo _('Logout'); ?>">
                    <i class="fas fa-sign-out-alt"></i>
                    <span class="d-none d-md-inline ms-1"><?php echo _('Logout'); ?></span>
                </button>
            </div>
        </li>

        <li class="nav-item dropdown">
            <!-- this should contain the value of the currently selected language, based on a cookie -->
            <a class="nav-link dropdown-toggle btn btn-outline-light border-0" href="#" id="langChoicesDropdown" role="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                <?php echo Locale::getDisplayLanguage($i18n->LOCALE, $i18n->LOCALE); ?>
            </a>
            <div class="dropdown-menu dropdown-menu-end shadow animated--grow-in" aria-labelledby="langChoicesDropdown" id="langChoicesDropdownItems">
                <?php
                foreach ($langsAssoc as $key => $lang) {
                    $classList   = substr($i18n->LOCALE, 0, 2) === $key ? 'dropdown-item active' : 'dropdown-item';
                    $isoLang     = strtoupper($key);
                    $displayName = Locale::getDisplayLanguage($key, 'en');
                    echo "<a class=\"$classList\" id=\"langChoice-$key\" href=\"#\" title=\"$displayName\"><span class=\"d-none d-md-inline\">$lang</span><span class=\"d-inline d-md-none\">$isoLang</span></a>";
                }
                ?>
            </div>
        </li>

        <li class="nav-item">
            <a class="nav-link btn btn-outline-light text-dark border-0"
                href="https://github.com/Liturgical-Calendar/" target="_blank"
                title="See the project repositories on GitHub">
                <i class="fab fa-github"></i>
            </a>
        </li>
    </ul>
</nav>


<!-- Page Wrapper -->
<div id="layoutSidenav">

    <div id="layoutSidenav_nav">
        <!-- Sidebar -->
        <nav class="sb-sidenav accordion sb-sidenav-dark bg-gradient" id="accordionSidebar">
            <div class="sb-sidenav-menu">
                <div class="nav">
                    <!-- Sidebar - Brand -->
                    <div class="text-center lh-2 px-5 pt-2 sidebar-brand">
                        <a class="text-uppercase fs-6 fw-bold text-white text-decoration-none" href="/">
                            <?php echo _('Catholic Liturgical Calendar'); ?>
                        </a>
                    </div>
                    <!-- <hr> -->
                    <a class="nav-link<?php echo in_array($currentPage, ['', 'index'], true) ? ' active' : '' ?>" href="/">
                        <i class="sb-nav-link-icon fas fa-fw fa-cross"></i>
                        <span><?php echo _('Home'); ?></span>
                    </a>
                    <!-- <hr> -->
                    <div class="sb-sidenav-menu-heading<?php echo in_array($currentPage, ['', 'index', 'extending'], true) ? ' text-white' : '' ?>">
                        <?php echo 'API'; ?>
                    </div>
                    <a class="nav-link<?php echo $currentPage === 'extending' ? ' active' : '' ?>" href="extending.php?choice=diocesan">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Extending the API'); ?></span>
                    </a>
                    <a class="nav-link" href="/dist/">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Documentation'); ?></span>
                    </a>
                    <!-- <hr> -->
                    <div class="sb-sidenav-menu-heading<?php echo $currentPage === 'usage' ? ' text-white' : '' ?>">
                        <?php echo _('Examples of Usage'); ?>
                    </div>
                    <a class="nav-link" href="usage.php#webCalendar">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Web calendar'); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#calSubscription">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Calendar subscription'); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#datesOfEaster">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Dates of Easter'); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#liturgyOfTheDay">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Liturgy of the Day'); ?></span>
                    </a>

                </div>
            </div>
            <div class="sb-sidenav-footer">
                <!-- Sidebar Toggler (Sidebar) -->
                <div class="text-center">
                    <button type="button" class="btn btn-secondary rounded-circle border-0 sidebarToggle" id="sidebarToggleB"><i class="fas fa-angle-left"></i></button>
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
