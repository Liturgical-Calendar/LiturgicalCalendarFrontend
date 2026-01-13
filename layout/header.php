<?php
$currentPage = basename($_SERVER['SCRIPT_FILENAME'], '.php');

// $adminPages is defined in includes/common.php for centralized maintenance
$isAdminPage = in_array($currentPage, $adminPages, true);

$i18nDirs       = glob('i18n/*', GLOB_ONLYDIR);
$langsAvailable = ['en', ...array_map('basename', $i18nDirs !== false ? $i18nDirs : [])];
$langsAssoc     = [];
foreach ($langsAvailable as $lang) {
    $langsAssoc[$lang] = Locale::getDisplayLanguage($lang, $i18n->LOCALE);
}
asort($langsAssoc);
?>
<!-- Topbar -->
<nav class="sb-topnav navbar navbar-expand-lg navbar-light bg-white shadow">
    <!-- Navbar Brand -->
    <a class="navbar-brand text-danger ps-3" href="/">
        <i class="fas fa-cross me-2"></i><span class="d-none d-sm-inline"><?php echo _('Catholic Liturgical Calendar'); ?></span><span class="d-inline d-sm-none">LitCal</span>
    </a>

    <!-- Sidebar Toggle (Topbar) - only visible on lg+ screens where sidebar is shown -->
    <button class="btn btn-link btn-sm d-none d-lg-inline-block sidebarToggle" id="sidebarToggle"
            title="<?php echo htmlspecialchars(_('Toggle sidebar'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
        <i class="fas fa-table-columns"></i>
    </button>

    <!-- Mobile toggle button -->
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent" aria-controls="navbarContent" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
    </button>

    <!-- Collapsible navbar content -->
    <div class="collapse navbar-collapse" id="navbarContent">
        <!-- Main navigation -->
        <ul class="navbar-nav me-auto mb-2 mb-lg-0 align-items-center">
            <?php $apiLabel = _('API'); ?>
            <li class="nav-item<?php echo $currentPage === 'index' || $currentPage === '' ? ' bg-info' : ''; ?>" id="topNavBar_API">
                <a class="nav-link<?php echo $currentPage === 'index' || $currentPage === '' ? ' active' : ''; ?>" href="./index.php"
                   title="<?php echo htmlspecialchars($apiLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-server me-1"></i><span class="nav-text"><?php echo $apiLabel; ?></span>
                </a>
            </li>
            <?php $usageLabel = _('Usage'); ?>
            <li class="nav-item<?php echo in_array($currentPage, ['usage', 'examples', 'liturgyOfAnyDay'], true) ? ' bg-info' : ''; ?>" id="topNavBar_Usage">
                <a class="nav-link<?php echo in_array($currentPage, ['usage', 'examples', 'liturgyOfAnyDay'], true) ? ' active' : ''; ?>" href="./usage.php"
                   title="<?php echo htmlspecialchars($usageLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-book-open me-1"></i><span class="nav-text"><?php echo $usageLabel; ?></span>
                </a>
            </li>
            <?php $translationsLabel = _('Translations'); ?>
            <li class="nav-item<?php echo $currentPage === 'translations' ? ' bg-info' : ''; ?>" id="topNavBar_Translations">
                <a class="nav-link<?php echo $currentPage === 'translations' ? ' active' : ''; ?>" href="./translations.php"
                   title="<?php echo htmlspecialchars($translationsLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-language me-1"></i><span class="nav-text"><?php echo $translationsLabel; ?></span>
                </a>
            </li>
            <?php $aboutUsLabel = _('About us'); ?>
            <li class="nav-item<?php echo $currentPage === 'about' ? ' bg-info' : ''; ?>" id="topNavBar_AboutUs">
                <a class="nav-link<?php echo $currentPage === 'about' ? ' active' : ''; ?>" href="./about.php"
                   title="<?php echo htmlspecialchars($aboutUsLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-info-circle me-1"></i><span class="nav-text"><?php echo $aboutUsLabel; ?></span>
                </a>
            </li>
        </ul>
        <!-- Right side items -->
        <ul class="navbar-nav align-items-center">
            <?php
            $accuracyTestsUrl = $_ENV['ACCURACY_TESTS_URL'] ?? '';
            if (!empty($accuracyTestsUrl)) {
                $accuracyTestsLabel = _('Accuracy Tests');
            ?>
            <!-- Accuracy Tests Link -->
            <li class="nav-item">
                <a class="nav-link"
                   href="<?php echo htmlspecialchars($accuracyTestsUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>"
                   title="<?php echo htmlspecialchars($accuracyTestsLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-arrow-up-right-from-square me-1"></i>
                    <span class="d-lg-none d-xxl-inline">
                        <?php echo htmlspecialchars($accuracyTestsLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                    </span>
                </a>
            </li>
            <?php } ?>
            <!-- GitHub Link -->
            <li class="nav-item">
                <a class="nav-link" href="https://github.com/Liturgical-Calendar/" target="_blank"
                   title="<?php echo htmlspecialchars(_('See the project repositories on GitHub'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fab fa-github me-1"></i><span class="d-lg-none d-xxl-inline">GitHub</span>
                </a>
            </li>
            <li class="vr mx-2 d-none d-lg-block"></li>
            <!-- Language Selector -->
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" id="langChoicesDropdown" role="button"
                    data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <i class="fas fa-globe me-1"></i><span class="d-lg-none d-xxl-inline"><?php
                        $currentLangDisplay = Locale::getDisplayLanguage($i18n->LOCALE, $i18n->LOCALE);
                        echo htmlspecialchars($currentLangDisplay !== false ? $currentLangDisplay : $i18n->LOCALE, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                    ?></span>
                </a>
                <div class="dropdown-menu dropdown-menu-end shadow" aria-labelledby="langChoicesDropdown" id="langChoicesDropdownItems">
                    <?php
                    foreach ($langsAssoc as $key => $lang) {
                        $classList         = substr($i18n->LOCALE, 0, 2) === $key ? 'dropdown-item active' : 'dropdown-item';
                        $isoLang           = strtoupper($key);
                        $displayNameResult = Locale::getDisplayLanguage($key, 'en');
                        $displayName       = $displayNameResult !== false ? $displayNameResult : $key;
                        // Escape all values for safe HTML output
                        $safeClass   = htmlspecialchars($classList, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $safeKey     = htmlspecialchars($key, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $safeTitle   = htmlspecialchars($displayName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $safeLang    = htmlspecialchars($lang !== false ? $lang : $displayName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $safeIsoLang = htmlspecialchars($isoLang, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        echo "<a class=\"$safeClass\" id=\"langChoice-$safeKey\" href=\"#\" title=\"$safeTitle\"><span class=\"d-none d-md-inline\">$safeLang</span><span class=\"d-inline d-md-none\">$safeIsoLang</span></a>";
                    }
                    ?>
                </div>
            </li>
            <li class="vr mx-2 d-none d-lg-block"></li>
            <!-- Authentication Status: Server-side auth detection, JS handles dynamic updates -->
            <li class="nav-item me-lg-2<?php echo $authHelper->isAuthenticated ? ' d-none' : ''; ?>" id="loginBtnContainer" data-requires-no-auth>
                <button class="btn btn-outline-primary btn-sm" id="loginBtn"
                        title="<?php echo htmlspecialchars(_('Login'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-sign-in-alt me-1"></i><span class="d-lg-none d-sm-inline"><?php echo _('Login'); ?></span>
                </button>
            </li>
            <li class="nav-item me-lg-2<?php echo $authHelper->isAuthenticated ? '' : ' d-none'; ?>" id="userMenuContainer" data-requires-auth>
                <div class="btn-group" id="userMenu">
                    <a href="user-profile.php" class="btn btn-outline-success btn-sm" id="userInfo"
                       title="<?php echo htmlspecialchars(_('View Profile'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                        <i class="fas fa-user me-1"></i><span id="username" class="d-lg-none d-sm-inline"><?php echo $authHelper->username !== null ? htmlspecialchars($authHelper->username, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : ''; ?></span>
                    </a>
                    <button class="btn btn-outline-danger btn-sm" id="logoutBtn"
                            title="<?php echo htmlspecialchars(_('Logout'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                        <i class="fas fa-sign-out-alt me-1"></i><span class="d-lg-none"><?php echo _('Logout'); ?></span>
                    </button>
                </div>
            </li>
            <?php $adminLabel = _('Admin'); ?>
            <li class="nav-item<?php echo $currentPage === 'admin-dashboard' ? ' bg-info' : ''; ?><?php echo $authHelper->isAuthenticated ? '' : ' d-none'; ?>" id="topNavBar_Admin" data-requires-auth>
                <a class="nav-link<?php echo $currentPage === 'admin-dashboard' ? ' active' : ''; ?>" href="./admin-dashboard.php"
                   title="<?php echo htmlspecialchars($adminLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>">
                    <i class="fas fa-gear me-1"></i><span class="d-lg-none d-xxl-inline"><?php echo $adminLabel; ?></span>
                </a>
            </li>
        </ul>
    </div>
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

                    <?php if ($isAdminPage) : ?>
                    <!-- Admin Sidebar -->
                    <a class="nav-link<?php echo $currentPage === 'admin-dashboard' ? ' active' : ''; ?>" href="admin-dashboard.php">
                        <i class="sb-nav-link-icon fas fa-fw fa-tachometer-alt"></i>
                        <span><?php echo _('Dashboard'); ?></span>
                    </a>

                    <div class="sb-sidenav-menu-heading text-white-50">
                        <?php echo _('General Roman Calendar'); ?>
                    </div>
                    <a class="nav-link<?php echo $currentPage === 'temporale' ? ' active' : ''; ?>" href="temporale.php">
                        <i class="sb-nav-link-icon fas fa-fw fa-calendar-alt text-primary"></i>
                        <span><?php echo _('Temporale'); ?></span>
                    </a>
                    <a class="nav-link<?php echo $currentPage === 'missals-editor' ? ' active' : ''; ?>" href="missals-editor.php">
                        <i class="sb-nav-link-icon fas fa-fw fa-book-open text-success"></i>
                        <span><?php echo _('Sanctorale'); ?></span>
                    </a>
                    <a class="nav-link<?php echo $currentPage === 'decrees' ? ' active' : ''; ?>" href="decrees.php">
                        <i class="sb-nav-link-icon fas fa-fw fa-gavel text-warning"></i>
                        <span><?php echo _('Decrees'); ?></span>
                    </a>

                    <div class="sb-sidenav-menu-heading text-white-50">
                        <?php echo _('Particular Calendars'); ?>
                    </div>
                        <?php
                    // Get current choice parameter for extending.php active state
                        $extendingChoice = $_GET['choice'] ?? '';
                    ?>
                    <a class="nav-link<?php echo $currentPage === 'extending' && $extendingChoice === 'widerRegion' ? ' active' : ''; ?>" href="extending.php?choice=widerRegion">
                        <i class="sb-nav-link-icon fas fa-fw fa-globe-americas text-info"></i>
                        <span><?php echo _('Wider Region'); ?></span>
                    </a>
                    <a class="nav-link<?php echo $currentPage === 'extending' && $extendingChoice === 'national' ? ' active' : ''; ?>" href="extending.php?choice=national">
                        <i class="sb-nav-link-icon fas fa-fw fa-flag text-danger"></i>
                        <span><?php echo _('National'); ?></span>
                    </a>
                    <a class="nav-link<?php echo $currentPage === 'extending' && $extendingChoice === 'diocesan' ? ' active' : ''; ?>" href="extending.php?choice=diocesan">
                        <i class="sb-nav-link-icon fas fa-fw fa-church text-secondary"></i>
                        <span><?php echo _('Diocesan'); ?></span>
                    </a>

                    <hr class="sidebar-divider my-2">
                    <a class="nav-link" href="/">
                        <i class="sb-nav-link-icon fas fa-fw fa-arrow-left"></i>
                        <span><?php echo _('Back to Website'); ?></span>
                    </a>

                    <?php else : ?>
                    <!-- Main Website Sidebar -->
                    <a class="nav-link<?php echo in_array($currentPage, ['', 'index'], true) ? ' active' : '' ?>" href="/">
                        <i class="sb-nav-link-icon fas fa-fw fa-cross"></i>
                        <span><?php echo _('Home'); ?></span>
                    </a>

                    <div class="sb-sidenav-menu-heading<?php echo in_array($currentPage, ['', 'index'], true) ? ' text-white' : ''; ?>">
                        <?php echo 'API'; ?>
                    </div>
                    <a class="nav-link" href="/dist/">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Documentation'); ?></span>
                    </a>

                    <div class="sb-sidenav-menu-heading<?php echo in_array($currentPage, ['usage', 'examples', 'liturgyOfAnyDay'], true) ? ' text-white' : '' ?>">
                        <?php echo _('Examples of Usage'); ?>
                    </div>
                    <a class="nav-link<?php echo $currentPage === 'examples' ? ' active' : ''; ?>" href="usage.php#webCalendar">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Web calendar'); ?></span>
                    </a>
                    <a class="nav-link" href="usage.php#calSubscription">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Calendar subscription'); ?></span>
                    </a>
                    <a class="nav-link<?php echo $currentPage === 'easter' ? ' active' : ''; ?>" href="usage.php#datesOfEaster">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Dates of Easter'); ?></span>
                    </a>
                    <a class="nav-link<?php echo $currentPage === 'liturgyOfAnyDay' ? ' active' : ''; ?>" href="usage.php#liturgyOfTheDay">
                        <i class="sb-nav-link-icon fas fa-fw fa-folder"></i>
                        <span><?php echo _('Liturgy of the Day'); ?></span>
                    </a>
                    <?php endif; ?>

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
