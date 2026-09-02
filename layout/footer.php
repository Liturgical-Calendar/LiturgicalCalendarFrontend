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
<script src="assets/js/toast.js"></script>
<script src="assets/js/notifications.js"></script>
<!-- Notification translations for JavaScript -->
<script>
const NotificationTranslations = {
    noNotifications: <?php echo json_encode(_('No pending requests')); ?>,
    noNotificationsUser: <?php echo json_encode(_('No new notifications')); ?>,
    loadError: <?php echo json_encode(_('Could not load notifications')); ?>,
    justNow: <?php echo json_encode(_('Just now')); ?>,
    requestedRole: <?php echo json_encode(_('Requested')); ?>,
    requestedAccess: <?php echo json_encode(_('Requested access')); ?>,
    yourRequestApproved: <?php echo json_encode(_('Your request was approved')); ?>,
    yourRequestRejected: <?php echo json_encode(_('Your request was rejected')); ?>,
    yourRequestRevoked: <?php echo json_encode(_('Your access was revoked')); ?>,
    onboardingInvite: <?php echo json_encode(_('Request access to start using the system')); ?>,
    onboardingInviteCta: <?php echo json_encode(_('Get started')); ?>,
    // Change-request notifications. A batch produces up to two of these at different
    // times: a review decision (approved/rejected), and later a publication outcome
    // (merged/closed). A rejected batch never publishes, so it only ever produces the first.
    changeRequestApproved: <?php echo json_encode(_('Your change request was approved')); ?>,
    changeRequestRejected: <?php echo json_encode(_('Your change request was rejected')); ?>,
    changeRequestMerged: <?php echo json_encode(_('Your change request was published')); ?>,
    changeRequestClosed: <?php echo json_encode(_('Your change request was closed without merging')); ?>,
    changeRequestPullRequest: <?php echo json_encode(_('Pull request #%1$d')); ?>
};
// The GitHub repository the source-data publisher opens pull requests against, so a
// notification carrying a pr_number can link to it. Empty unless the deployment names
// a well-formed "owner/repo", in which case the number is rendered without a link.
<?php
$notificationsRepo    = trim((string) ( $_ENV['SOURCEDATA_REPOSITORY'] ?? '' ));
$notificationsRepoUrl = preg_match('#^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$#', $notificationsRepo) === 1
    ? 'https://github.com/' . $notificationsRepo
    : '';
?>
const SourceDataRepoUrl = <?php echo json_encode($notificationsRepoUrl); ?>;
</script>
<?php include_once('includes/login-modal.php'); ?>
<?php
$isDevelopment   = ( $_ENV['APP_ENV'] ?? 'production' ) === 'development';
$componentsJsUrl = $isDevelopment
    ? './assets/components-js/index.js'
    : 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@2.10.0/+esm';

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

if (in_array($pageName, [ 'index', 'extending', 'usage', 'admin-dashboard', 'admin-decrees', 'examples' ])) {
    echo '<script src="https://cdn.jsdelivr.net/npm/bootstrap-multiselect@2.0.0/dist/js/bootstrap-multiselect.min.js"></script>';
}

// admin-decrees uses its own Bootstrap toast, so it takes the multiselect above without toastr
if (in_array($pageName, [ 'index', 'extending', 'usage', 'admin-dashboard', 'examples' ])) {
    echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.js" '
        . 'integrity="sha512-lbwH47l/tPXJYG9AcFNoJaTMhGvYWhVM9YI43CT+uteTRRaiLCui8snIgyAN8XWgNjNhCqlAUdzZptso6OCoFQ==" '
        . 'crossorigin="anonymous" referrerpolicy="no-referrer"></script>';
}

//don't include the importmap on the examples page, it has it's own importmap
if ('examples' !== $pageName) {
    echo $componentsJsImportMap;
}

//pages built on the shared admin module factory; their page script is a classic
//script (not a module) because the factory is a global, not an export
$adminModulePages = [ 'admin-applications', 'admin-changes' ];

//load admin module base for admin pages that use it
if (in_array($pageName, $adminModulePages, true)) {
    echo '<script src="assets/js/admin-module-base.js?v=' . filemtime('assets/js/admin-module-base.js') . '"></script>';
}

//shared change-request rendering (batch detail diff), used by both the reviewer's
//queue and the submitter's own history
if (in_array($pageName, [ 'admin-changes', 'change-requests' ], true)) {
    echo '<script src="assets/js/change-request-common.js?v=' . filemtime('assets/js/change-request-common.js') . '"></script>';
}

//include any script that has the same name as the current page
if (file_exists("assets/js/{$pageName}.js")) {
    // Admin modules use the base factory, so they're regular scripts, not modules
    $scriptType = in_array($pageName, $adminModulePages, true) ? '' : ' type="module"';
    // filemtime cache-busting: browsers cache module scripts aggressively;
    // without this, a rebuilt container can serve fresh HTML with stale JS
    $scriptVersion = filemtime("assets/js/{$pageName}.js");
    echo "<script{$scriptType} src=\"assets/js/{$pageName}.js?v={$scriptVersion}\"></script>";
}
