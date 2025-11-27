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

<!-- All API URLs and configuration are provided by common.php -->
<script>
const AppEnv          = <?php echo json_encode($_ENV['APP_ENV'] ?? 'production'); ?>;
const BaseUrl         = <?php echo json_encode($apiConfig->apiBaseUrl); ?>;
const DateOfEasterUrl = <?php echo json_encode($apiConfig->dateOfEasterUrl); ?>;
const CalendarUrl     = <?php echo json_encode($apiConfig->calendarUrl); ?>;
const MetadataUrl     = <?php echo json_encode($apiConfig->metadataUrl); ?>;
const EventsUrl       = <?php echo json_encode($apiConfig->eventsUrl); ?>;
const MissalsUrl      = <?php echo json_encode($apiConfig->missalsUrl); ?>;
const DecreesUrl      = <?php echo json_encode($apiConfig->decreesUrl); ?>;
const RegionalDataUrl = <?php echo json_encode($apiConfig->regionalDataUrl); ?>;
if ( AppEnv === 'development' ) console.info({
    'AppEnv': AppEnv,
    'BaseUrl': BaseUrl,
    'DateOfEasterUrl': DateOfEasterUrl,
    'CalendarUrl': CalendarUrl,
    'MetadataUrl': MetadataUrl,
    'EventsUrl': EventsUrl,
    'MissalsUrl': MissalsUrl,
    'DecreesUrl': DecreesUrl,
    'RegionalDataUrl': RegionalDataUrl
});
</script>

<!-- jQuery-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.4.1/jquery.easing.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.1/js.cookie.min.js"></script>

<!-- Bootstrap / sb-admin JavaScript-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.3/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin@7.0.7/dist/js/scripts.js"></script>

<!-- i18next -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/i18next/21.6.6/i18next.min.js" integrity="sha512-3CUvxyR4WtlZanN/KmorrZ2VALnUndAQBYjf1HEYNa6McBY+G2zYq4gOZPUDkDtuk3uBdQIva0Lk89hYQ9fQrA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-i18next/1.2.1/jquery-i18next.min.js" integrity="sha512-79RgNpOyaf8AvNEUdanuk1x6g53UPoB6Fh2uogMkOMGADBG6B0DCzxc+dDktXkVPg2rlxGvPeAFKoZxTycVooQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdn.jsdelivr.net/npm/i18next-http-backend@1.3.1/i18nextHttpBackend.min.js"></script>

<!-- Custom scripts for all pages-->
<script src="assets/js/i18n.js"></script>
<script src="assets/js/common.js"></script>
<?php
$isDevelopment   = ( $_ENV['APP_ENV'] ?? 'production' ) === 'development';
$componentsJsUrl = $isDevelopment
    ? './assets/components-js/index.js'
    : 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/dist/index.js';

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

if (in_array($pageName, [ 'index', 'extending', 'usage', 'admin', 'examples' ])) {
    echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-multiselect/1.1.2/js/bootstrap-multiselect.min.js"></script>';
    echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>';
}

//don't include the importmap on the examples page, it has it's own importmap
if ('examples' !== $pageName) {
    echo $componentsJsImportMap;
}

//include any script that has the same name as the current page
if (file_exists("assets/js/{$pageName}.js")) {
    echo "<script type=\"module\" src=\"assets/js/{$pageName}.js\"></script>";
}
