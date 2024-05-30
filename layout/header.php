<?php
$currentPage = basename($_SERVER["SCRIPT_FILENAME"], '.php');

$isStaging = ( strpos($_SERVER['HTTP_HOST'], "-staging") !== false || strpos($_SERVER['HTTP_HOST'], "localhost") !== false );
//$stagingURL = $isStaging ? "-staging" : "";
$endpointV = $isStaging ? "dev" : "v3";
$endpointURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/";
$metadataURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/metadata/";
$dateOfEasterURL = "https://litcal.johnromanodorazio.com/api/{$endpointV}/easter/";

$langsAvailable = ['en', ...array_map('basename', glob("i18n/*", GLOB_ONLYDIR))];
$langsAssoc = [];
foreach ($langsAvailable as $lang) {
    $langsAssoc[$lang] = Locale::getDisplayLanguage($lang, $i18n->LOCALE);
}
asort($langsAssoc);
?>

<!-- Navbar -->
<nav class="navbar fixed top-0 start-0 z-10 w-full bg-base-200 border-b border-gray-400">
    <div class="navbar-start">
        <a class="text-xl font-bold text-primary" href="/">Litcal.org</a>
    </div>

    <div class="navbar-center hidden md:flex">
        <ul class="menu menu-horizontal px-1">
            <li><a href="/index.php">API</a></li>
            <li>
                <details>
                    <summary><?php echo _( "Extending the API" ); ?></summary>
                    <ul class="p-2 bg-base-200 w-48 md:w-72">
                        <li><a class="<?php echo isset($_GET["choice"]) && $_GET["choice"]==="widerRegion"?" bg-base-200":"" ?>" id="extendingChoiceWiderRegion" href="./extending.php?choice=widerRegion"><?php echo _( "Create a Calendar for a Wider Region" ); ?></a></li>
                        <li><a class="<?php echo isset($_GET["choice"]) && $_GET["choice"]==="national"?" bg-base-200":"" ?>" id="extendingChoiceNationalCalendar" href="./extending.php?choice=national"><?php echo _( "Create a National Calendar" ); ?></a></li>
                        <li><a class="<?php echo isset($_GET["choice"]) && $_GET["choice"]==="diocesan"?" bg-base-200":"" ?>" id="extendingChoiceDiocesanCalendar" href="./extending.php?choice=diocesan"><?php echo _( "Create a Diocesan Calendar" ); ?></a></li>
                    </ul>
                </details>
            </li>
            <li>
                <details>
                    <summary><?php echo _( "Example Usage" ); ?></summary>
                    <ul class="p-2 bg-base-200 w-48">
                        <li><a href="#">Web Calendar</a></li>
                        <li><a href="#">Calendar Subscription</a></li>
                        <li><a href="#">Dates of Easter</a></li>
                        <li><a href="#">Liturgy of the Day</a></li>
                    </ul>
                </details>
            </li>
            <li class="<?php echo $currentPage=="translations" ? " bg-base-200" : ""; ?>" id="topNavBar_Translations"><a href="./translations.php"><?php echo _( "Translations" ); ?></a></li>
            <li class="<?php echo $currentPage=="about" ? " bg-base-200" : ""; ?>" id="topNavBar_AboutUs"><a href="./about.php"><?php echo _( "About Us" ); ?></a></li>
        </ul>
    </div>

    <div class="navbar-end">
        <ul class="menu menu-horizontal px-1 items-center">
            <li>
                <details>
                    <!-- this should contain the value of the currently selected language, based on a cookie -->
                    <summary><?php echo Locale::getDisplayLanguage($i18n->LOCALE, $i18n->LOCALE); ?></summary>
                    <ul class="p-2 bg-base-200">
                        <?php
                            foreach( $langsAssoc as $key => $lang ) {
                                $classList = substr( $i18n->LOCALE, 0, 2 ) === $key ? "bg-base-200" : "";
                                $isoLang = strtoupper( $key );
                                $displayName = Locale::getDisplayLanguage( $key, 'en');
                                echo "<li><a class=\"$classList\" id=\"langChoice-$key\" href=\"#\" title=\"$displayName\"><span class=\"hidden md:inline\">$lang</span><span class=\"inline md:hidden\">$isoLang</span></a></li>";
                            }
                        ?>
                    </ul>
                </details>
            </li>
            <li>
                <a class=""
                    href="https://github.com/Liturgical-Calendar/" target="_blank"
                    title="See the project repository on GitHub">
                    <i class="text-xl fab fa-github"></i>
                </a>
            </li>
        </ul>
    </div>
</nav>


<!-- Page Wrapper -->
<main class="mt-24">
    <div class="container mx-auto min-h-screen">
