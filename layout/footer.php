</div>
</main>
<!-- End Page wrapper -->

<!-- Footer -->
<footer class="bg-base-200">
    <div class="container mx-auto py-2 text-center">
        Copyright &copy; John D'Orazio 2020
    </div>
</footer>
<!-- End of Footer -->

<!-- jQuery-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.4.1/jquery.easing.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.1/js.cookie.min.js"></script>

<!-- i18next -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/i18next/21.6.6/i18next.min.js" integrity="sha512-3CUvxyR4WtlZanN/KmorrZ2VALnUndAQBYjf1HEYNa6McBY+G2zYq4gOZPUDkDtuk3uBdQIva0Lk89hYQ9fQrA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-i18next/1.2.1/jquery-i18next.min.js" integrity="sha512-79RgNpOyaf8AvNEUdanuk1x6g53UPoB6Fh2uogMkOMGADBG6B0DCzxc+dDktXkVPg2rlxGvPeAFKoZxTycVooQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdn.jsdelivr.net/npm/i18next-http-backend@1.3.1/i18nextHttpBackend.min.js"></script>

<!-- Custom scripts for all pages-->
<script src="assets/js/i18n.js"></script>
<script src="assets/js/common.js"></script>

<?php
    //some assets are only needed on certain pages
    $pageName = basename($_SERVER["SCRIPT_FILENAME"], '.php');
    if($pageName === "index"){
        echo '<script src="assets/js/homepage.js"></script>';
    }
    if(in_array($pageName, [ "extending", "usage", "admin" ])) {
        echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>';
    }
    if(file_exists("assets/js/{$pageName}.js")) {
        echo "<script type=\"module\" src=\"assets/js/{$pageName}.js\"></script>";
    }
