</div>
<!-- /.container-fluid -->

</main>
<!-- End of Main Content -->

<!-- Footer -->
<footer class="sticky-footer bg-white">
    <div class="container my-auto">
        <div class="copyright text-center my-auto">
            <span>Copyright &copy; John D'Orazio 2020</span>
        </div>
    </div>
</footer>
<!-- End of Footer -->

</div>
<!-- End of Content Wrapper -->

</div>
<!-- End of Page Wrapper -->

<!-- All API URLs and configuration are provided by includes/common.php -->
<script>
const AppEnv          = <?php echo json_encode($_ENV['APP_ENV'] ?? 'production'); ?>;
const BaseUrl         = <?php echo json_encode($apiConfig->apiBaseUrl); ?>;
const DateOfEasterUrl = <?php echo json_encode($apiConfig->dateOfEasterUrl); ?>;
const CalendarUrl     = <?php echo json_encode($apiConfig->calendarUrl); ?>;
const MetadataUrl     = <?php echo json_encode($apiConfig->metadataUrl); ?>;
const EventsUrl       = <?php echo json_encode($apiConfig->eventsUrl); ?>;
const MissalsUrl      = <?php echo json_encode($apiConfig->missalsUrl); ?>;
const DecreesUrl      = <?php echo json_encode($apiConfig->decreesUrl); ?>;
const TemporaleUrl    = <?php echo json_encode($apiConfig->temporaleUrl); ?>;
const RegionalDataUrl = <?php echo json_encode($apiConfig->regionalDataUrl); ?>;
const AdminPages      = <?php echo json_encode($adminPages); ?>;
const OidcEnabled     = <?php echo json_encode(\LiturgicalCalendar\Frontend\OidcClient::isConfigured()); ?>;
if ( AppEnv === 'development' ) console.info({
    'AppEnv': AppEnv,
    'BaseUrl': BaseUrl,
    'DateOfEasterUrl': DateOfEasterUrl,
    'CalendarUrl': CalendarUrl,
    'MetadataUrl': MetadataUrl,
    'EventsUrl': EventsUrl,
    'MissalsUrl': MissalsUrl,
    'DecreesUrl': DecreesUrl,
    'TemporaleUrl': TemporaleUrl,
    'RegionalDataUrl': RegionalDataUrl,
    'OidcEnabled': OidcEnabled
});
</script>

<!-- jQuery-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"
    integrity="sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.4.1/jquery.easing.min.js"
    integrity="sha512-0QbL0ph8Tc8g5bLhfVzSqxe9GERORsKhIn1IrpxDAgUsbBGz/V7iSav2zzW325XGd1OMLdL4UiqRJj702IeqnQ=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/3.0.5/js.cookie.min.js"
    integrity="sha512-nlp9/l96/EpjYBx7EP7pGASVXNe80hGhYAUrjeXnu/fyF5Py0/RXav4BBNs7n5Hx1WFhOEOWSAVjGeC3oKxDVQ=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"></script>

<!-- Bootstrap / sb-admin JavaScript-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.8/js/bootstrap.bundle.min.js"
    integrity="sha512-HvOjJrdwNpDbkGJIG2ZNqDlVqMo77qbs4Me4cah0HoDrfhrbA+8SBlZn1KrvAQw7cILLPFJvdwIgphzQmMm+Pw=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"></script>
<script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin@7.0.7/dist/js/scripts.js"></script>

<!-- i18next -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/i18next/25.5.2/i18next.min.js"
    integrity="sha512-41q9Nizfj3hnJoKqqMdlUlqK4K6WUyERaAWE50zuXMDvJT/91KdN9eiulSqOFw703IKsflcvrCJSb8Q+EjtyIQ=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/i18next-http-backend/3.0.2/i18nextHttpBackend.min.js"
    integrity="sha512-RYgVA7vVuFPjAksuk9TPraxVuJvdB5sF3KkbHdPkh47Bw2/q4wfiO67yU/btAG6k8t6qg7bY0VRHddW0/JcEsw=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"></script>

<!-- Custom scripts for all pages-->
<script src="assets/js/i18n.js"></script>
<script src="assets/js/common.js"></script>
<script src="assets/js/auth.js"></script>
<script src="assets/js/notifications.js"></script>
<!-- Notification translations for JavaScript -->
<script>
const NotificationTranslations = {
    noNotifications: <?php echo json_encode(_('No pending requests')); ?>,
    loadError: <?php echo json_encode(_('Could not load notifications')); ?>,
    justNow: <?php echo json_encode(_('Just now')); ?>,
    minutesAgo: <?php echo json_encode(_('min ago')); ?>,
    hoursAgo: <?php echo json_encode(_('hours ago')); ?>,
    daysAgo: <?php echo json_encode(_('days ago')); ?>,
    requestedRole: <?php echo json_encode(_('Requested')); ?>
};
</script>
<?php include_once('includes/login-modal.php'); ?>
<?php
$isDevelopment   = ( $_ENV['APP_ENV'] ?? 'production' ) === 'development';
$componentsJsUrl = $isDevelopment
    ? './assets/components-js/index.js'
    : 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@1.4.0/+esm';

$componentsJsImportMap = <<<SCRIPT
<script type="importmap">
    {
        "imports": {
            "@liturgical-calendar/components-js": "{$componentsJsUrl}"
        }
    }
</script>
SCRIPT;

//some assets are only needed on certain pages
$pageName = basename($_SERVER['SCRIPT_FILENAME'], '.php');

if (in_array($pageName, [ 'index', 'extending', 'usage', 'missals-editor', 'admin-dashboard', 'examples' ])) {
    echo '<script src="https://cdn.jsdelivr.net/npm/bootstrap-multiselect@2.0.0/dist/js/bootstrap-multiselect.min.js"></script>';
    echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.js" '
        . 'integrity="sha512-lbwH47l/tPXJYG9AcFNoJaTMhGvYWhVM9YI43CT+uteTRRaiLCui8snIgyAN8XWgNjNhCqlAUdzZptso6OCoFQ==" '
        . 'crossorigin="anonymous" referrerpolicy="no-referrer"></script>';
}

//don't include the importmap on the examples page, it has it's own importmap
if ('examples' !== $pageName) {
    echo $componentsJsImportMap;
}

//load admin module base for admin pages that use it
if (in_array($pageName, ['admin-applications', 'admin-role-requests'])) {
    echo '<script src="assets/js/admin-module-base.js"></script>';
}

//include any script that has the same name as the current page
if (file_exists("assets/js/{$pageName}.js")) {
    // Admin modules use the base factory, so they're regular scripts, not modules
    $scriptType = in_array($pageName, ['admin-applications', 'admin-role-requests']) ? '' : ' type="module"';
    echo "<script{$scriptType} src=\"assets/js/{$pageName}.js\"></script>";
}
